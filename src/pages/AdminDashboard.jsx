import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Footer from "./Footer";
import Navbar from "./Navbar";
import ConfirmDialog from "./ConfirmDialog";
import {
  Users, CheckCircle, Search, TrendingUp, RefreshCw,
  Award, ChevronDown, Download, Trash2, Play,
  FlaskConical, BookOpen, Pencil, Check, X, Layers, FolderPlus
} from "lucide-react";
import * as XLSX from "xlsx";

// ============ اللغة الإنجليزية فقط ============
const ENGLISH_SUBJECT_KEYWORD = "إنجليزية";

// ============ المدارس / المراكز التعليمية ============
const SCHOOLS = [
  "مدرسة بيارق الخاصة",
  "مركز النخبة التعليمي",
  "مركز ماكس للتعليم والتدريب",
];

// المواد المراد عرضها في الكشوف
const getBranchSubjects = (allSubjects) =>
  allSubjects.filter(subj => subj.includes(ENGLISH_SUBJECT_KEYWORD));

// ⭐ خريطة المناطق (كما كانت في الأصل - تل الهوى، دير البلح، إلخ)
const AREA_MAP = {
  tlh: "تل الهوى",
  drb: "دير البلح",
  nsr: "النصر",
  nth: "الشمال",
};

// ============================================================
// توليد أسئلة المحاولة (اللغة الإنجليزية فقط)
// ============================================================
const generateAttemptQuestions = async (attemptId, studentBranch) => {
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, questions_count")
    .ilike("name", `%${ENGLISH_SUBJECT_KEYWORD}%`);

  if (!subjects?.length) throw new Error("لا توجد مادة إنجليزية");

  let allInsertData = [];

  for (const subject of subjects) {
    const targetCount = subject.questions_count || 40;
    let query = supabase
      .from("questions")
      .select("id, passage_id, unit_number, degree")
      .eq("subject_id", subject.id)
      .eq("is_active", true);

    if (studentBranch) {
      query = query.or(`branch.is.null,branch.eq.${studentBranch}`);
    }

    const { data: questions } = await query;
    if (!questions?.length) continue;

    const passageMap = new Map();
    const standaloneQuestions = [];

    questions.forEach((q) => {
      if (q.passage_id) {
        if (!passageMap.has(q.passage_id)) passageMap.set(q.passage_id, []);
        passageMap.get(q.passage_id).push(q);
      } else standaloneQuestions.push(q);
    });

    const passages = Array.from(passageMap.entries())
      .map(([passageId, qs]) => ({ passageId, questions: qs, count: qs.length }))
      .sort((a, b) => b.count - a.count);

    let selectedQuestions = [];
    let remaining = targetCount;

    for (const passage of passages) {
      if (remaining <= 0) break;
      if (passage.count <= remaining) {
        selectedQuestions.push(...passage.questions);
        remaining -= passage.count;
      } else {
        const shuffled = [...passage.questions].sort(() => 0.5 - Math.random());
        selectedQuestions.push(...shuffled.slice(0, remaining));
        remaining = 0;
        break;
      }
    }

    if (remaining > 0 && standaloneQuestions.length > 0) {
      const shuffled = [...standaloneQuestions].sort(() => 0.5 - Math.random());
      const take = Math.min(remaining, shuffled.length);
      selectedQuestions.push(...shuffled.slice(0, take));
      remaining -= take;
    }

    if (remaining > 0) {
      const selectedIds = new Set(selectedQuestions.map((q) => q.id));
      const allRemaining = questions.filter((q) => !selectedIds.has(q.id));
      const shuffled = [...allRemaining].sort(() => 0.5 - Math.random());
      selectedQuestions.push(...shuffled.slice(0, remaining));
    }

    allInsertData.push(...selectedQuestions.map(q => ({
      attempt_id: attemptId,
      subject_id: subject.id,
      question_id: q.id,
    })));
  }

  if (allInsertData.length === 0) throw new Error("لا توجد أسئلة نشطة مناسبة");
  await supabase.from("attempt_questions").insert(allInsertData);
};

// ============================================================
// البحث عن حزمة مفتوحة
// ============================================================
const findOpenBatch = async () => {
  const { data: openBatch, error } = await supabase
    .from("attempts")
    .select("batch_id, created_at, student_id")
    .eq("status", "active")
    .not("batch_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("خطأ في البحث عن الحزمة المفتوحة:", error);
    return null;
  }

  if (!openBatch?.batch_id) return null;

  const { count: studentsCount } = await supabase
    .from("attempts")
    .select("student_id", { count: "exact", head: true })
    .eq("batch_id", openBatch.batch_id);

  const { count: activeCount } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", openBatch.batch_id)
    .eq("status", "active");

  return {
    batchId: openBatch.batch_id,
    createdAt: openBatch.created_at,
    studentsCount: studentsCount || 0,
    activeCount: activeCount || 0,
  };
};

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [activatingAll, setActivatingAll] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [stats, setStats] = useState({ totalStudents: 0, activeAttempts: 0 });
  const [activeAttemptsMap, setActiveAttemptsMap] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, batchId: null, message: ""
  });

  // نافذة اختيار الحزمة
  const [batchChoiceDialog, setBatchChoiceDialog] = useState({
    isOpen: false,
    openBatchInfo: null,
    pendingAction: null,
  });

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [scientificResults, setScientificResults] = useState({ subjects: [], students: [] });
  const [literaryResults, setLiteraryResults] = useState({ subjects: [], students: [] });
  const [resultsLoading, setResultsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [deletingBatch, setDeletingBatch] = useState(null);
  const [selectedBranchView, setSelectedBranchView] = useState(null);

  // تحرير رقم الجوال
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");
  const [phoneSaveLoadingId, setPhoneSaveLoadingId] = useState(null);

  // تحرير المنطقة
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [editAreaValue, setEditAreaValue] = useState("");
  const [areaSaveLoadingId, setAreaSaveLoadingId] = useState(null);

  // تحرير المدرسة
  const [editingSchoolId, setEditingSchoolId] = useState(null);
  const [editSchoolValue, setEditSchoolValue] = useState("");
  const [schoolSaveLoadingId, setSchoolSaveLoadingId] = useState(null);

  // ⭐ الفلاتر
  const [studentAreaFilter, setStudentAreaFilter] = useState("");
  const [studentSchoolFilter, setStudentSchoolFilter] = useState(""); // ⭐ جديد

  const [authChecked, setAuthChecked] = useState(false);

  const activationLockRef = useRef(false);

  const navigate = useNavigate();

  const fetchAdminProfile = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: profile } = await supabase
        .from("profiles").select("name, role").eq("id", currentUser.id).single();
      setAdminProfile(profile);
      return profile;
    }
    return null;
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { count: totalStudents } = await supabase
        .from("profiles").select("*", { count: "exact", head: true }).eq("role", "student");

      const { count: activeAttempts } = await supabase
        .from("attempts").select("*", { count: "exact", head: true }).eq("status", "active");

      setStats({ totalStudents: totalStudents || 0, activeAttempts: activeAttempts || 0 });
    } catch (error) { console.error(error); }
  }, []);

  const fetchActiveAttempts = useCallback(async () => {
    const { data, error } = await supabase.from("attempts")
      .select("student_id, status").eq("status", "active");
    if (!error && data) {
      const map = {};
      data.forEach((a) => { map[a.student_id] = true; });
      setActiveAttemptsMap(map);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles").select("*").eq("role", "student")
      .order("created_at", { ascending: false });
    if (!error) setUsers(data);
    setLoading(false);
  }, []);

  const refreshAllData = useCallback(() => {
    fetchUsers(); fetchStats(); fetchActiveAttempts();
  }, [fetchUsers, fetchStats, fetchActiveAttempts]);

  // ===== تحرير رقم الجوال =====
  const handlePhoneEditClick = (user) => {
    setEditingPhoneId(user.id); setEditPhoneValue(user.phone || "");
  };
  const handlePhoneCancel = () => {
    setEditingPhoneId(null); setEditPhoneValue(""); setPhoneSaveLoadingId(null);
  };
  const handlePhoneSave = async (userId) => {
    const newPhone = editPhoneValue.trim();
    if (newPhone === "") { toast.error("رقم الجوال لا يمكن أن يكون فارغاً"); return; }
    setPhoneSaveLoadingId(userId);
    const { error } = await supabase.from("profiles").update({ phone: newPhone }).eq("id", userId);
    if (error) toast.error("فشل حفظ رقم الجوال: " + error.message);
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, phone: newPhone } : u));
      toast.success("تم تحديث رقم الجوال بنجاح");
      setEditingPhoneId(null); setEditPhoneValue("");
    }
    setPhoneSaveLoadingId(null);
  };

  // ===== تحرير المنطقة =====
  const handleAreaEditClick = (user) => {
    setEditingAreaId(user.id); setEditAreaValue(user.area_code || "");
  };
  const handleAreaCancel = () => {
    setEditingAreaId(null); setEditAreaValue(""); setAreaSaveLoadingId(null);
  };
  const handleAreaSave = async (userId) => {
    const newArea = editAreaValue;
    if (!newArea) { toast.error("الرجاء اختيار منطقة"); return; }
    setAreaSaveLoadingId(userId);
    const { error } = await supabase.from("profiles").update({ area_code: newArea }).eq("id", userId);
    if (error) toast.error("فشل حفظ المنطقة: " + error.message);
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, area_code: newArea } : u));
      toast.success("تم تحديث المنطقة بنجاح");
      setEditingAreaId(null); setEditAreaValue("");
    }
    setAreaSaveLoadingId(null);
  };

  // ⭐ تحرير المدرسة
  const handleSchoolEditClick = (user) => {
    setEditingSchoolId(user.id);
    setEditSchoolValue(user.school || "");
  };
  const handleSchoolCancel = () => {
    setEditingSchoolId(null);
    setEditSchoolValue("");
    setSchoolSaveLoadingId(null);
  };
  const handleSchoolSave = async (userId) => {
    if (!editSchoolValue) {
      toast.error("الرجاء اختيار المدرسة / المركز");
      return;
    }
    setSchoolSaveLoadingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ school: editSchoolValue })
      .eq("id", userId);

    if (error) {
      toast.error("فشل حفظ المدرسة: " + error.message);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, school: editSchoolValue } : u));
      toast.success("تم تحديث المدرسة بنجاح");
      setEditingSchoolId(null);
      setEditSchoolValue("");
    }
    setSchoolSaveLoadingId(null);
  };

  // ===== جلب الحزم =====
  const fetchBatches = useCallback(async () => {
    setResultsLoading(true);
    try {
      const { data: attemptsWithStudents } = await supabase
        .from("attempts")
        .select(`
          id, batch_id, created_at, student_id, status,
          profiles!inner (branch, name)
        `)
        .not("batch_id", "is", null);

      if (!attemptsWithStudents?.length) {
        setBatches([]); setResultsLoading(false); return;
      }

      const batchMap = new Map();
      for (const attempt of attemptsWithStudents) {
        const batchId = attempt.batch_id;
        const studentBranch = attempt.profiles?.branch || "غير محدد";
        const studentId = attempt.student_id;

        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, {
            id: batchId,
            createdAt: attempt.created_at,
            students: new Map(),
            studentIds: new Set(),
            activeCount: 0,
          });
        }

        const batch = batchMap.get(batchId);
        if (!batch.students.has(studentId)) {
          batch.students.set(studentId, { branch: studentBranch, attemptId: attempt.id });
        }
        batch.studentIds.add(studentId);
        if (attempt.status === "active") batch.activeCount += 1;
      }

      for (const [batchId, batch] of batchMap.entries()) {
        const attemptIds = Array.from(batch.students.values()).map(s => s.attemptId);
        const { data: results } = await supabase
          .from("results").select("subject_id").in("attempt_id", attemptIds);

        const uniqueSubjects = new Set(results?.map(r => r.subject_id) || []);
        batch.subjectCount = uniqueSubjects.size;

        const branchCounts = new Map();
        for (const student of batch.students.values()) {
          const branch = student.branch;
          branchCounts.set(branch, (branchCounts.get(branch) || 0) + 1);
        }

        let dominantBranch = "مختلط";
        let maxCount = 0;
        for (const [branch, count] of branchCounts.entries()) {
          if (count > maxCount && branch !== "غير محدد") {
            maxCount = count; dominantBranch = branch;
          }
        }
        if (dominantBranch === "مختلط" && maxCount === 0) dominantBranch = "غير محدد";

        batch.branch = dominantBranch;
        batch.studentCount = batch.studentIds.size;
      }

      const batchesArray = Array.from(batchMap.values());
      batchesArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBatches(batchesArray);
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast.error("فشل جلب الحزم");
    } finally { setResultsLoading(false); }
  }, []);

  // ===== جلب نتائج الحزمة =====
  const fetchBatchResults = useCallback(async (batchId, selectedBranch = null) => {
    setResultsLoading(true);
    setSelectedBranchView(selectedBranch);
    try {
      const { data: attempts, error: attemptsError } = await supabase
        .from("attempts")
        .select(`id, student_id, profiles!inner (name, branch, area_code)`)
        .eq("batch_id", batchId);

      if (attemptsError) throw attemptsError;
      if (!attempts?.length) throw new Error("لا توجد محاولات في هذه الحزمة");

      const attemptIds = attempts.map(a => a.id);

      const { data: resultsData, error: resultsError } = await supabase
        .from("results")
        .select(`id, score, student_id, subject_id, attempt_id, subjects!inner (id, name)`)
        .in("attempt_id", attemptIds);

      if (resultsError) throw resultsError;

      if (!resultsData || resultsData.length === 0) {
        toast.info("لا توجد نتائج محفوظة لهذه الحزمة بعد");
        setScientificResults({ subjects: [], students: [] });
        setLiteraryResults({ subjects: [], students: [] });
        setSelectedBatch(batchId);
        setResultsLoading(false);
        return;
      }

      const englishResults = resultsData.filter(r =>
        r.subjects?.name?.includes(ENGLISH_SUBJECT_KEYWORD)
      );

      if (englishResults.length === 0) {
        toast.info("لا توجد نتائج إنجليزية لهذه الحزمة");
        setScientificResults({ subjects: [], students: [] });
        setLiteraryResults({ subjects: [], students: [] });
        setSelectedBatch(batchId);
        setResultsLoading(false);
        return;
      }

      const uniqueSubjectIds = [...new Set(englishResults.map(r => r.subject_id))];
      const subjectTotalMarksMap = new Map();

      for (const subjectId of uniqueSubjectIds) {
        const { data: questionsData } = await supabase
          .from("questions").select("degree")
          .eq("subject_id", subjectId).eq("is_active", true);

        let totalDegree = 0;
        if (questionsData && questionsData.length > 0) {
          totalDegree = questionsData.reduce((sum, q) => sum + (q.degree || 0), 0);
        }
        if (totalDegree === 0) totalDegree = 40;
        subjectTotalMarksMap.set(subjectId, totalDegree);
      }

      const attemptStudentMap = new Map();
      attempts.forEach(attempt => {
        attemptStudentMap.set(attempt.id, {
          name: attempt.profiles?.name || "غير معروف",
          branch: attempt.profiles?.branch || "",
          areaCode: attempt.profiles?.area_code || ""
        });
      });

      const allSubjectsSet = new Set();
      const studentMap = new Map();

      englishResults.forEach((result) => {
        const studentId = result.student_id;
        const attemptId = result.attempt_id;
        const studentInfo = attemptStudentMap.get(attemptId);
        if (!studentInfo) return;

        const subjectId = result.subject_id;
        const subjectName = result.subjects?.name;
        if (!subjectName) return;

        allSubjectsSet.add(subjectName);

        const totalMarks = subjectTotalMarksMap.get(subjectId) || 40;
        const studentScore = result.score;

        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            studentId,
            studentName: studentInfo.name,
            branch: studentInfo.branch,
            areaCode: studentInfo.areaCode,
            subjects: {}
          });
        }

        const studentRecord = studentMap.get(studentId);
        if (!studentRecord.subjects[subjectName]) {
          studentRecord.subjects[subjectName] = { score: studentScore, totalMarks };
        }
      });

      const subjectsList = Array.from(allSubjectsSet).sort();
      const scientific = [];
      const literary = [];

      studentMap.forEach((student) => {
        if (Object.keys(student.subjects).length === 0) return;
        const row = {
          studentName: student.studentName,
          areaCode: student.areaCode,
          subjects: student.subjects
        };
        if (student.branch === "العلمي") scientific.push(row);
        else if (student.branch === "الأدبي") literary.push(row);
      });

      scientific.sort((a, b) => a.studentName.localeCompare(b.studentName));
      literary.sort((a, b) => a.studentName.localeCompare(b.studentName));

      setScientificResults({ subjects: getBranchSubjects(subjectsList), students: scientific });
      setLiteraryResults({ subjects: getBranchSubjects(subjectsList), students: literary });

      setStudentFilter(""); setSubjectFilter(""); setAreaFilter("");
      setSelectedBatch(batchId);

      if (selectedBranch === 'scientific' || selectedBranch === 'literary') {
        setSelectedBranchView(selectedBranch);
      }
    } catch (error) {
      console.error("Error fetching batch results:", error);
      toast.error("فشل جلب نتائج الحزمة: " + error.message);
    } finally { setResultsLoading(false); }
  }, []);

  const handleDeleteBatch = (batchId) => {
    setConfirmDialog({
      isOpen: true, batchId,
      message: "هل أنت متأكد من حذف هذه الحزمة وجميع نتائجها؟ لا يمكن التراجع."
    });
  };

  const handleConfirmDelete = async () => {
    const batchId = confirmDialog.batchId;
    setConfirmDialog({ isOpen: false, batchId: null, message: "" });

    setDeletingBatch(batchId);
    try {
      const { data: attempts } = await supabase.from("attempts").select("id").eq("batch_id", batchId);
      const attemptIds = attempts?.map(a => a.id) || [];
      if (attemptIds.length) {
        await supabase.from("results").delete().in("attempt_id", attemptIds);
        await supabase.from("attempt_questions").delete().in("attempt_id", attemptIds);
        await supabase.from("attempts").delete().in("id", attemptIds);
      }
      toast.success("تم حذف الحزمة بنجاح");
      setBatches(prev => prev.filter(b => b.id !== batchId));
      if (selectedBatch === batchId) {
        setSelectedBatch(null); setSelectedBranchView(null);
      }
    } catch (error) {
      toast.error("فشل حذف الحزمة: " + error.message);
    } finally { setDeletingBatch(null); }
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, batchId: null, message: "" });
  };

  const exportCurrentBranchToExcel = () => {
    if (!selectedBranchView || !selectedBatch) return;
    const isScientific = selectedBranchView === 'scientific';
    const currentSubjects = isScientific ? scientificResults.subjects : literaryResults.subjects;
    const currentStudents = isScientific ? scientificResults.students : literaryResults.students;

    const filteredSubjects = subjectFilter ? currentSubjects.filter(s => s === subjectFilter) : currentSubjects;
    const filteredStudents = currentStudents.filter(s =>
      s.studentName.includes(studentFilter) &&
      (!subjectFilter || s.subjects[subjectFilter]) &&
      (!areaFilter || s.areaCode === areaFilter)
    );

    if (filteredStudents.length === 0) {
      toast.error("لا توجد بيانات لتصديرها وفقاً للفلاتر الحالية");
      return;
    }

    const branchName = isScientific ? "العلمي" : "الأدبي";
    const wb = XLSX.utils.book_new();
    const header = ["اسم الطالب", ...filteredSubjects];
    const dataRows = filteredStudents.map((s, idx) => [
      `${idx + 1}. ${s.studentName}`,
      ...filteredSubjects.map(subj => {
        const subjData = s.subjects[subj];
        return subjData ? `${subjData.score}/${subjData.totalMarks}` : "—";
      })
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    XLSX.utils.book_append_sheet(wb, sheet, branchName);
    XLSX.writeFile(wb, `نتائج_إنجليزي_${branchName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ============================================================
  // منطق التفعيل
  // ============================================================
  const performSingleActivation = async (studentId, batchId) => {
    try {
      const { data: studentProfile } = await supabase
        .from("profiles").select("branch").eq("id", studentId).single();
      const studentBranch = studentProfile?.branch?.trim() || null;

      await supabase
        .from("attempts")
        .update({ status: "completed" })
        .eq("student_id", studentId)
        .eq("status", "active");

      const { data: newAttempt, error: insertError } = await supabase
        .from("attempts")
        .insert([{ student_id: studentId, status: "active", batch_id: batchId }])
        .select().single();

      if (insertError) throw insertError;

      await generateAttemptQuestions(newAttempt.id, studentBranch);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const performBulkActivation = async (students, batchId) => {
    try {
      const studentIds = students.map(s => s.id);
      const { error: updateError } = await supabase
        .from("attempts")
        .update({ status: "completed" })
        .in("student_id", studentIds)
        .eq("status", "active");

      if (updateError) throw new Error("فشل في إنهاء المحاولات القديمة");

      const results = await Promise.all(
        students.map(async (student) => {
          try {
            const { data: studentProfile } = await supabase
              .from("profiles").select("branch").eq("id", student.id).single();
            const studentBranch = studentProfile?.branch?.trim() || null;

            const { data: newAttempt, error: insertError } = await supabase
              .from("attempts")
              .insert([{ student_id: student.id, status: "active", batch_id: batchId }])
              .select().single();

            if (insertError) return { success: false, name: student.name, error: insertError.message };

            await generateAttemptQuestions(newAttempt.id, studentBranch);
            return { success: true, name: student.name };
          } catch (err) {
            return { success: false, name: student.name, error: err.message };
          }
        })
      );

      return results;
    } catch (err) {
      throw err;
    }
  };

  const handleActivateAttempt = async (studentId) => {
    if (activationLockRef.current) {
      toast.loading("جاري معالجة طلب سابق...", { duration: 1500 });
      return;
    }

    const openBatch = await findOpenBatch();

    if (openBatch) {
      setBatchChoiceDialog({
        isOpen: true,
        openBatchInfo: openBatch,
        pendingAction: { type: 'single', studentId },
      });
      return;
    }

    const newBatchId = crypto.randomUUID();
    await executeSingleActivation(studentId, newBatchId, true);
  };

  const executeSingleActivation = async (studentId, batchId, isNew) => {
    activationLockRef.current = true;
    setProcessingId(studentId);

    try {
      const result = await performSingleActivation(studentId, batchId);
      if (!result.success) throw new Error(result.error);

      toast.success(isNew ? "تم تفعيل المحاولة في حزمة جديدة! ✅" : "تم ضم الطالب للحزمة الحالية! ✅");

      await fetchStats();
      await fetchActiveAttempts();
      await fetchBatches();
    } catch (e) {
      console.error("خطأ في تفعيل المحاولة:", e);
      toast.error("خطأ: " + e.message);
    } finally {
      setProcessingId(null);
      activationLockRef.current = false;
    }
  };

  const handleActivateAll = async () => {
    if (activationLockRef.current) {
      toast.loading("جاري معالجة طلب سابق...", { duration: 1500 });
      return;
    }

    const studentsToActivate = filteredUsers.filter(u => !activeAttemptsMap[u.id]);
    if (studentsToActivate.length === 0) {
      toast("لا يوجد طلاب بحاجة إلى تفعيل (وفقاً للفلاتر الحالية)", { icon: "ℹ️" });
      return;
    }

    const openBatch = await findOpenBatch();

    if (openBatch) {
      setBatchChoiceDialog({
        isOpen: true,
        openBatchInfo: openBatch,
        pendingAction: { type: 'all', students: studentsToActivate },
      });
      return;
    }

    const newBatchId = crypto.randomUUID();
    await executeBulkActivation(studentsToActivate, newBatchId, true);
  };

  const executeBulkActivation = async (students, batchId, isNew) => {
    activationLockRef.current = true;
    setActivatingAll(true);

    const loadingToast = toast.loading(`جاري تفعيل ${students.length} طالب...`);

    try {
      const results = await performBulkActivation(students, batchId);

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      await fetchStats();
      await fetchActiveAttempts();
      await fetchBatches();
      toast.dismiss(loadingToast);

      if (successCount > 0) {
        let message = `تم تفعيل ${successCount} طالب بنجاح!`;
        if (failedCount > 0) message += ` (فشل ${failedCount})`;
        message += isNew ? " - حزمة جديدة ✅" : " - ضُمّوا للحزمة الحالية ✅";
        toast.success(message, { duration: 4000 });
      } else {
        toast.error("❌ فشل تفعيل جميع الطلاب");
      }
    } catch (error) {
      console.error(error);
      toast.dismiss(loadingToast);
      toast.error("حدث خطأ غير متوقع: " + error.message);
    } finally {
      setActivatingAll(false);
      activationLockRef.current = false;
    }
  };

  const handleBatchChoiceExisting = async () => {
    const { pendingAction, openBatchInfo } = batchChoiceDialog;
    setBatchChoiceDialog({ isOpen: false, openBatchInfo: null, pendingAction: null });

    if (pendingAction.type === 'single') {
      await executeSingleActivation(pendingAction.studentId, openBatchInfo.batchId, false);
    } else if (pendingAction.type === 'all') {
      await executeBulkActivation(pendingAction.students, openBatchInfo.batchId, false);
    }
  };

  const handleBatchChoiceNew = async () => {
    const { pendingAction } = batchChoiceDialog;
    setBatchChoiceDialog({ isOpen: false, openBatchInfo: null, pendingAction: null });

    const newBatchId = crypto.randomUUID();

    if (pendingAction.type === 'single') {
      await executeSingleActivation(pendingAction.studentId, newBatchId, true);
    } else if (pendingAction.type === 'all') {
      await executeBulkActivation(pendingAction.students, newBatchId, true);
    }
  };

  const handleBatchChoiceCancel = () => {
    setBatchChoiceDialog({ isOpen: false, openBatchInfo: null, pendingAction: null });
  };

  // ===== الفلاتر ⭐ معدّلة =====
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name?.includes(searchTerm) || u.username?.includes(searchTerm);
    const matchesArea = !studentAreaFilter || u.area_code === studentAreaFilter;
    const matchesSchool = !studentSchoolFilter || u.school === studentSchoolFilter;
    return matchesSearch && matchesArea && matchesSchool;
  });

  const todayNewStudents = users.filter((u) => {
    const createdDate = new Date(u.created_at);
    const today = new Date();
    return createdDate.toDateString() === today.toDateString();
  }).length;

  const currentDisplaySubjects = selectedBranchView === 'scientific'
    ? scientificResults.subjects
    : selectedBranchView === 'literary' ? literaryResults.subjects : [];
  const currentDisplayStudents = selectedBranchView === 'scientific'
    ? scientificResults.students
    : selectedBranchView === 'literary' ? literaryResults.students : [];

  const filteredDisplaySubjects = subjectFilter
    ? currentDisplaySubjects.filter(s => s === subjectFilter) : currentDisplaySubjects;
  const filteredDisplayStudents = currentDisplayStudents.filter(s =>
    s.studentName.includes(studentFilter) &&
    (!subjectFilter || s.subjects[subjectFilter]) &&
    (!areaFilter || s.areaCode === areaFilter)
  );

  useEffect(() => {
    const checkAdmin = async () => {
      const profile = await fetchAdminProfile();
      if (!profile || profile.role !== 'admin') {
        toast.error("غير مصرح لك بالدخول");
        navigate("/login");
      } else {
        setAuthChecked(true);
      }
    };
    checkAdmin();
  }, [fetchAdminProfile, navigate]);

  useEffect(() => {
    if (authChecked) {
      fetchUsers(); fetchStats(); fetchActiveAttempts(); fetchBatches();
    }
  }, [authChecked, fetchUsers, fetchStats, fetchActiveAttempts, fetchBatches]);

  return (
    <div className="dashboard-container">
      <Navbar userName={adminProfile?.name || "مدير النظام"} />
      <main className="dashboard-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">إدارة الطلاب - اللغة الإنجليزية</h1>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-blue"><Users size={24} /></div>
            <div className="stat-content">
              <span className="stat-label">إجمالي الطلاب</span>
              <span className="stat-number">{stats.totalStudents}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-green"><CheckCircle size={24} /></div>
            <div className="stat-content">
              <span className="stat-label">محاولات نشطة</span>
              <span className="stat-number">{stats.activeAttempts}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-purple"><TrendingUp size={24} /></div>
            <div className="stat-content">
              <span className="stat-label">طلاب مسجلين اليوم</span>
              <span className="stat-number">{todayNewStudents}</span>
            </div>
          </div>
        </div>

        <div className="actions-row">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input type="text" placeholder="بحث عن اسم الطالب..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
          </div>

          {/* ⭐ فلتر المدرسة / المركز */}
          <div className="filter-input-wrapper" style={{ maxWidth: "220px" }}>
            <select
              value={studentSchoolFilter}
              onChange={(e) => setStudentSchoolFilter(e.target.value)}
            >
              <option value="">جميع المراكز / المدارس</option>
              {SCHOOLS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="filter-select-icon" />
          </div>

          <button className="btn-primary btn-activate-all" onClick={handleActivateAll}
            disabled={activatingAll || users.length === 0}>
            <Play size={18} /> {activatingAll ? "جاري التفعيل..." : "تفعيل الكل"}
          </button>
        </div>

        {/* جدول الطلاب */}
        <div className="table-card">
          <div className="card-header">
            <h2 className="card-title"><Users size={20} className="icon-blue" /> قائمة الطلاب</h2>
            <div className="card-header-actions">
              <span className="badge-count">{filteredUsers.length} طالب</span>
              <button className="btn-icon-text" onClick={refreshAllData}>
                <RefreshCw size={16} /> <span>تحديث</span>
              </button>
            </div>
          </div>
          <div className="table-responsive">
            {loading ? (
              <div className="empty-state"><div className="spinner"></div><p>جاري تحميل الطلاب...</p></div>
            ) : filteredUsers.length > 0 ? (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الفرع</th>
                    <th>المدرسة / المركز</th>
                    <th>المنطقة</th>
                    <th>رقم الجوال</th>
                    <th className="text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const hasActiveAttempt = activeAttemptsMap[user.id];
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <span className="user-name-cell">{user.name || "غير محدد"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="subject-badge" style={{ color: "#475569" }}>
                            {user.branch || "—"}
                          </span>
                        </td>

                        {/* ⭐ المدرسة / المركز */}
                        <td>
                          {editingSchoolId === user.id ? (
                            <div className="phone-edit-row">
                              <select
                                value={editSchoolValue}
                                onChange={(e) => setEditSchoolValue(e.target.value)}
                                className="phone-input"
                              >
                                <option value="">اختر المدرسة</option>
                                {SCHOOLS.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSchoolSave(user.id)}
                                disabled={schoolSaveLoadingId === user.id}
                                className="icon-btn save"
                                title="حفظ"
                              >
                                {schoolSaveLoadingId === user.id ? <span className="spinner-small"></span> : <Check size={16} />}
                              </button>
                              <button onClick={handleSchoolCancel} className="icon-btn cancel" title="إلغاء">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="phone-display-row">
                              <span>{user.school || "—"}</span>
                              <button
                                onClick={() => handleSchoolEditClick(user)}
                                className="icon-btn edit"
                                title="تعديل"
                              >
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}
                        </td>

                        <td>
                          {editingAreaId === user.id ? (
                            <div className="phone-edit-row">
                              <select value={editAreaValue}
                                onChange={(e) => setEditAreaValue(e.target.value)} className="phone-input">
                                <option value="">اختر المنطقة</option>
                                {Object.entries(AREA_MAP).map(([code, name]) => (
                                  <option key={code} value={code}>{name}</option>
                                ))}
                              </select>
                              <button onClick={() => handleAreaSave(user.id)}
                                disabled={areaSaveLoadingId === user.id} className="icon-btn save" title="حفظ">
                                {areaSaveLoadingId === user.id ? <span className="spinner-small"></span> : <Check size={16} />}
                              </button>
                              <button onClick={handleAreaCancel} className="icon-btn cancel" title="إلغاء">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="phone-display-row">
                              <span>{AREA_MAP[user.area_code] || user.area_code || "—"}</span>
                              <button onClick={() => handleAreaEditClick(user)} className="icon-btn edit" title="تعديل">
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}
                        </td>

                        <td>
                          {editingPhoneId === user.id ? (
                            <div className="phone-edit-row">
                              <input type="tel" value={editPhoneValue}
                                onChange={(e) => setEditPhoneValue(e.target.value)}
                                className="phone-input" autoFocus />
                              <button onClick={() => handlePhoneSave(user.id)}
                                disabled={phoneSaveLoadingId === user.id} className="icon-btn save" title="حفظ">
                                {phoneSaveLoadingId === user.id ? <span className="spinner-small"></span> : <Check size={16} />}
                              </button>
                              <button onClick={handlePhoneCancel} className="icon-btn cancel" title="إلغاء">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="phone-display-row">
                              <span>{user.phone || "—"}</span>
                              <button onClick={() => handlePhoneEditClick(user)} className="icon-btn edit" title="تعديل">
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="text-center">
                          {hasActiveAttempt ? (
                            <button className="btn-attempt active" disabled>✔ محاولة مفعلة</button>
                          ) : (
                            <button className="btn-attempt"
                              onClick={() => handleActivateAttempt(user.id)}
                              disabled={processingId === user.id || activatingAll || activationLockRef.current}>
                              {processingId === user.id ? (
                                <><span className="spinner-small"></span>جاري...</>
                              ) : ("✚ تفعيل محاولة")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>لا يوجد طلاب</h3>
                <p>لم يتم العثور على أي طالب مطابق لبحثك</p>
              </div>
            )}
          </div>
        </div>

        {/* قسم النتائج */}
        <div className="table-card results-section-card">
          <div className="card-header"
            onClick={() => {
              if (!showResults && batches.length === 0) fetchBatches();
              setShowResults(!showResults);
              setSelectedBatch(null);
              setSelectedBranchView(null);
            }}>
            <h2 className="card-title">
              <Award size={20} className="icon-blue" /> كشوف نتائج الطلاب (إنجليزي)
            </h2>
            <div className="card-header-actions">
              <span className="badge-count">{batches.length} حزمة</span>
              <ChevronDown size={20} className={`chevron ${showResults ? 'open' : ''}`} />
            </div>
          </div>
          {showResults && (
            <div className="table-responsive">
              {resultsLoading ? (
                <div className="empty-state"><div className="spinner"></div><p>جاري التحميل...</p></div>
              ) : selectedBatch ? (
                <div className="results-view">
                  <div className="results-toolbar">
                    <button className="btn-secondary"
                      onClick={() => { setSelectedBatch(null); setSelectedBranchView(null); }}>
                      ↪ العودة للحزم
                    </button>
                    <button className="btn-danger" onClick={() => handleDeleteBatch(selectedBatch)}
                      disabled={deletingBatch === selectedBatch}>
                      <Trash2 size={16} /> حذف الحزمة
                    </button>
                  </div>

                  {!selectedBranchView ? (
                    <div className="branch-selector">
                      <h3 className="selector-title">اختر الفرع لعرض نتائج الطلاب</h3>
                      <div className="branch-tabs">
                        <button onClick={() => setSelectedBranchView('scientific')}
                          className={`branch-tab scientific ${selectedBranchView === 'scientific' ? 'active' : ''}`}>
                          <FlaskConical size={20} className="tab-icon" />
                          <span>العلمي</span>
                        </button>
                        <button onClick={() => setSelectedBranchView('literary')}
                          className={`branch-tab literary ${selectedBranchView === 'literary' ? 'active' : ''}`}>
                          <BookOpen size={20} className="tab-icon" />
                          <span>الأدبي</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="branch-results-container">
                      <div className="filters-bar">
                        <div className="filter-input-wrapper">
                          <Search size={16} className="filter-search-icon" />
                          <input type="text" placeholder="اسم الطالب..." value={studentFilter}
                            onChange={(e) => setStudentFilter(e.target.value)} />
                        </div>
                        <div className="filter-input-wrapper">
                          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                            <option value="">جميع المواد (تحديد مادة)</option>
                            {currentDisplaySubjects.map(subj => (
                              <option key={subj} value={subj}>{subj}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="filter-select-icon" />
                        </div>
                        <div className="filter-input-wrapper">
                          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                            <option value="">جميع المناطق</option>
                            {Object.entries(AREA_MAP).map(([code, name]) => (
                              <option key={code} value={code}>{name}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="filter-select-icon" />
                        </div>
                      </div>

                      <div className="results-actions">
                        <button className="btn-primary" onClick={exportCurrentBranchToExcel}>
                          <Download size={16} /> تصدير Excel
                        </button>
                      </div>

                      {filteredDisplayStudents.length > 0 ? (
                        <div className="table-scroll">
                          <h3 className="branch-title">
                            {selectedBranchView === 'scientific' ? (
                              <><FlaskConical size={18} /> كشف نتائج الطلاب – الفرع العلمي</>
                            ) : (
                              <><BookOpen size={18} /> كشف نتائج الطلاب – الفرع الأدبي</>
                            )}
                          </h3>
                          <table className="modern-table results-table">
                            <thead>
                              <tr>
                                <th className="sticky-col-right">#</th>
                                <th className="sticky-col-right-name">اسم الطالب</th>
                                {filteredDisplaySubjects.map(subj => (<th key={subj}>{subj}</th>))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDisplayStudents.map((student, idx) => (
                                <tr key={idx}>
                                  <td className="sticky-col-right">{idx + 1}</td>
                                  <td className="sticky-col-right-name">{student.studentName}</td>
                                  {filteredDisplaySubjects.map(subj => {
                                    const subjData = student.subjects[subj];
                                    return (
                                      <td key={subj}>
                                        {subjData ? `${subjData.score}/${subjData.totalMarks}` : "—"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state" style={{ marginTop: "20px" }}>
                          <div className="empty-icon">🔍</div>
                          <h3>لم يتم العثور على نتائج</h3>
                          <p>لا يوجد طلاب يطابقون الفلاتر المحددة حالياً</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : batches.length > 0 ? (
                <div className="batches-list">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>الحزمة</th>
                        <th>عدد الطلاب</th>
                        <th>الحالة</th>
                        <th>تاريخ الإنشاء</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch, idx) => {
                        const isOpen = batch.activeCount > 0;
                        return (
                          <tr key={batch.id}>
                            <td>حزمة {batches.length - idx}</td>
                            <td>{batch.studentCount} طالب</td>
                            <td>
                              {isOpen ? (
                                <span className="badge-count" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                  مفتوحة ({batch.activeCount} نشط)
                                </span>
                              ) : (
                                <span className="badge-count" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                  مكتملة
                                </span>
                              )}
                            </td>
                            <td>{new Date(batch.createdAt).toLocaleDateString("ar-EG")}</td>
                            <td>
                              <div className="batch-actions">
                                <button className="btn-view-branch"
                                  onClick={() => fetchBatchResults(batch.id, 'scientific')}
                                  title="عرض النتائج - الفرع العلمي">
                                  <FlaskConical size={16} /> علمي
                                </button>
                                <button className="btn-view-branch literary"
                                  onClick={() => fetchBatchResults(batch.id, 'literary')}
                                  title="عرض النتائج - الفرع الأدبي">
                                  <BookOpen size={16} /> أدبي
                                </button>
                                <button className="btn-view-branch delete-batch-btn"
                                  onClick={() => handleDeleteBatch(batch.id)}
                                  disabled={deletingBatch === batch.id}
                                  title="حذف الحزمة">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <h3>لا توجد حزم</h3>
                  <p>لم يتم إنشاء أي حزم بعد</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* نافذة اختيار الحزمة */}
      {batchChoiceDialog.isOpen && (
        <div className="modal-overlay" onClick={handleBatchChoiceCancel}>
          <div className="batch-choice-modal" onClick={(e) => e.stopPropagation()}>

            <div className="batch-choice-header">
              <div className="batch-choice-icon-wrapper">
                <Layers size={28} />
              </div>
              <h2 className="batch-choice-title">يوجد حزمة مفتوحة حالياً</h2>
              <p className="batch-choice-subtitle">
                كيف تريد تفعيل المحاولة الجديدة؟
              </p>
            </div>

            <div className="batch-info-card">
              <div className="batch-info-row">
                <span className="batch-info-label">عدد الطلاب في الحزمة:</span>
                <span className="batch-info-value">{batchChoiceDialog.openBatchInfo?.studentsCount} طالب</span>
              </div>
              <div className="batch-info-row">
                <span className="batch-info-label">المحاولات النشطة حالياً:</span>
                <span className="batch-info-value active">
                  {batchChoiceDialog.openBatchInfo?.activeCount} محاولة
                </span>
              </div>
              <div className="batch-info-row">
                <span className="batch-info-label">تاريخ الإنشاء:</span>
                <span className="batch-info-value">
                  {batchChoiceDialog.openBatchInfo?.createdAt
                    ? new Date(batchChoiceDialog.openBatchInfo.createdAt).toLocaleDateString("ar-EG")
                    : "—"}
                </span>
              </div>
            </div>

            <div className="batch-choice-options">

              <button className="batch-choice-btn existing" onClick={handleBatchChoiceExisting}>
                <div className="choice-icon blue">
                  <Layers size={24} />
                </div>
                <div className="choice-content">
                  <span className="choice-title">ضم للحزمة الحالية</span>
                  <span className="choice-desc">
                    إضافة الطالب/الطلاب إلى نفس الحزمة المفتوحة
                  </span>
                </div>
              </button>

              <button className="batch-choice-btn new" onClick={handleBatchChoiceNew}>
                <div className="choice-icon green">
                  <FolderPlus size={24} />
                </div>
                <div className="choice-content">
                  <span className="choice-title">فتح حزمة جديدة</span>
                  <span className="choice-desc">
                    إنشاء حزمة منفصلة بمحاولات مستقلة
                  </span>
                </div>
              </button>

            </div>

            <button className="batch-choice-cancel" onClick={handleBatchChoiceCancel}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="تأكيد حذف الحزمة"
        message={confirmDialog.message}
        confirmText="نعم، احذف"
        cancelText="إلغاء"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <Footer />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { font-family: 'Cairo', sans-serif; }
        .dashboard-container { direction: rtl; background: linear-gradient(180deg, #f4f7fc 0%, #e9f0f9 100%); min-height: 100vh; display: flex; flex-direction: column; }
        .dashboard-main { flex: 1; width: 100%; max-width: 1280px; margin: 0 auto; padding: 0 24px 32px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .page-title { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 6px; text-align: right; width: 100%; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px; }
        .stat-card { background: white; border-radius: 20px; padding: 20px 24px; display: flex; align-items: center; gap: 18px; box-shadow: 0 6px 14px rgba(0,0,0,0.02); border: 1px solid #edf2f7; transition: transform 0.2s, box-shadow 0.2s; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 20px rgba(0,0,0,0.04); }
        .stat-icon-wrapper { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .stat-icon-wrapper.bg-blue { background: linear-gradient(145deg, #3b82f6, #2563eb); }
        .stat-icon-wrapper.bg-green { background: linear-gradient(145deg, #10b981, #059669); }
        .stat-icon-wrapper.bg-purple { background: linear-gradient(145deg, #8b5cf6, #7c3aed); }
        .stat-content { display: flex; flex-direction: column; align-items: center; flex: 1; text-align: center; }
        .stat-label { font-size: 0.9rem; font-weight: 600; color: #64748b; margin-bottom: 4px; }
        .stat-number { font-size: 2rem; font-weight: 800; color: #1e293b; line-height: 1; }
        .actions-row { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
        .search-wrapper { flex: 1; min-width: 240px; position: relative; }
        .search-icon { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-input { width: 100%; padding: 16px 52px 16px 20px; border: 1px solid #e2e8f0; border-radius: 60px; font-family: inherit; font-size: 1rem; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.02); transition: all 0.2s; }
        .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #2563eb; color: white; border: none; border-radius: 12px; font-family: inherit; font-weight: 600; cursor: pointer; transition: background 0.2s; white-space: nowrap; padding: 14px 28px; }
        .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-activate-all { box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .table-card { background: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); overflow: hidden; margin-bottom: 30px; }
        .card-header { padding: 20px 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .card-title { margin: 0; font-size: 1.1rem; color: #1e293b; display: flex; align-items: center; gap: 10px; }
        .icon-blue { color: #3b82f6; }
        .card-header-actions { display: flex; align-items: center; gap: 12px; }
        .badge-count { background: #eff6ff; color: #3b82f6; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; }
        .btn-icon-text { display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569; font-family: inherit; font-size: 0.9rem; cursor: pointer; transition: 0.2s; }
        .btn-icon-text:hover { background: #e2e8f0; color: #1e293b; }
        .chevron { transition: transform 0.3s; }
        .chevron.open { transform: rotate(180deg); }
        .table-responsive { width: 100%; overflow-x: auto; }
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th, .modern-table td { padding: 12px 15px; text-align: center; vertical-align: middle; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
        .modern-table th { background: #f8fafc; color: #64748b; font-weight: 700; }
        .modern-table tbody tr:hover { background: #f8fafc; }
        .user-cell { display: flex; align-items: center; gap: 12px; justify-content: center; }
        .user-name-cell { font-weight: 600; color: #1e293b; }
        .subject-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; }
        .phone-display-row { display: flex; align-items: center; gap: 8px; justify-content: center; }
        .phone-edit-row { display: flex; align-items: center; gap: 6px; justify-content: center; }
        .phone-input { padding: 6px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; width: 160px; text-align: center; }
        .icon-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .icon-btn.save { background: #10b981; color: white; }
        .icon-btn.cancel { background: #ef4444; color: white; }
        .icon-btn.edit { color: #3b82f6; }
        .icon-btn:disabled { opacity: 0.6; }
        .btn-attempt { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 18px; background: #3b82f6; color: white; border: none; border-radius: 30px; font-family: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; min-width: 130px; }
        .btn-attempt:hover:not(:disabled) { background: #2563eb; }
        .btn-attempt:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-attempt.active { background: #10b981 !important; color: white; }
        .results-section-card { margin-top: 20px; }
        .results-view { padding: 20px; }
        .results-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 10px; }
        .btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; }
        .btn-secondary:hover { background: #f8fafc; color: #1e293b; }
        .btn-danger { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 8px; font-family: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; }
        .btn-danger:hover:not(:disabled) { background: #dc2626; }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .branch-selector { text-align: center; padding: 30px 20px; }
        .selector-title { margin-bottom: 28px; color: #1e293b; font-size: 1.2rem; font-weight: 600; }
        .branch-tabs { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
        .branch-tab { display: inline-flex; align-items: center; gap: 12px; padding: 16px 40px; border-radius: 16px; border: 2px solid transparent; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 1.1rem; transition: all 0.25s; background: #f8fafc; color: #64748b; }
        .branch-tab.scientific { color: #1e3a8a; border-color: #bfdbfe; background: linear-gradient(135deg, #eff6ff, #dbeafe); }
        .branch-tab.scientific.active { border-color: #2563eb; background: linear-gradient(135deg, #dbeafe, #bfdbfe); box-shadow: 0 6px 16px rgba(37,99,235,0.2); transform: scale(1.02); }
        .branch-tab.literary { color: #991b1b; border-color: #fecaca; background: linear-gradient(135deg, #fef2f2, #fee2e2); }
        .branch-tab.literary.active { border-color: #dc2626; background: linear-gradient(135deg, #fee2e2, #fecaca); box-shadow: 0 6px 16px rgba(220,38,38,0.2); transform: scale(1.02); }
        .branch-results-container { margin-top: 10px; }
        .filters-bar { display: flex; align-items: center; gap: 16px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; flex-wrap: wrap; }
        .filter-input-wrapper { flex: 1; min-width: 200px; position: relative; }
        .filter-input-wrapper input { width: 100%; padding: 10px 36px 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; }
        .filter-search-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .filter-input-wrapper select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; appearance: none; background: white; color: #1e293b; cursor: pointer; }
        .filter-select-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .results-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .table-scroll { overflow-x: auto; }
        .branch-title { text-align: center; margin: 20px 0; font-size: 1.3rem; color: #1e293b; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .results-table .sticky-col-right { position: sticky; right: 0; background: inherit; z-index: 1; }
        .results-table .sticky-col-right-name { position: sticky; right: 40px; background: inherit; z-index: 1; white-space: nowrap; }
        .modern-table thead th.sticky-col-right,
        .modern-table thead th.sticky-col-right-name { background: #f8fafc; }
        .modern-table tbody td.sticky-col-right,
        .modern-table tbody td.sticky-col-right-name { background: white; }
        .modern-table tbody tr:hover td.sticky-col-right,
        .modern-table tbody tr:hover td.sticky-col-right-name { background: #f8fafc; }
        .batches-list { padding: 20px; }
        .batch-actions { display: flex; gap: 8px; justify-content: center; }
        .btn-view-branch { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #f1f5f9; border: none; border-radius: 8px; font-family: inherit; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: 0.2s; color: #334155; }
        .btn-view-branch:hover { background: #e2e8f0; }
        .btn-view-branch.literary:hover { background: #fee2e2; color: #991b1b; }
        .btn-view-branch:first-child:hover { background: #dbeafe; color: #1e3a8a; }
        .btn-view-branch.delete-batch-btn { background: #fee2e2; color: #dc2626; }
        .btn-view-branch.delete-batch-btn:hover:not(:disabled) { background: #fecaca; color: #b91c1c; }
        .btn-view-branch.delete-batch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #3b82f6; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
        .spinner-small { border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .empty-state { padding: 40px 20px; text-align: center; color: #64748b; }
        .empty-icon { font-size: 3rem; margin-bottom: 10px; }
        .empty-state h3 { color: #1e293b; margin-bottom: 4px; }

        /* نافذة اختيار الحزمة */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .batch-choice-modal {
          background: #ffffff; border-radius: 28px;
          width: 100%; max-width: 480px;
          padding: 32px 28px 24px;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          direction: rtl;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .batch-choice-header { text-align: center; margin-bottom: 22px; }
        .batch-choice-icon-wrapper {
          width: 64px; height: 64px; border-radius: 20px;
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #1d4ed8;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.2);
        }
        .batch-choice-title { font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
        .batch-choice-subtitle { font-size: 0.9rem; color: #64748b; margin: 0; font-weight: 500; }
        .batch-info-card {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px;
          padding: 16px 20px; margin-bottom: 22px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .batch-info-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; }
        .batch-info-label { color: #64748b; font-weight: 500; }
        .batch-info-value { color: #1e293b; font-weight: 800; font-size: 0.95rem; }
        .batch-info-value.active { color: #16a34a; }
        .batch-choice-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
        .batch-choice-btn {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 18px;
          border: 2px solid #e2e8f0;
          background: #ffffff; border-radius: 16px;
          cursor: pointer; text-align: right; font-family: inherit;
          transition: all 0.2s ease;
        }
        .batch-choice-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
        .batch-choice-btn.existing:hover { border-color: #3b82f6; background: #f0f9ff; }
        .batch-choice-btn.new:hover { border-color: #10b981; background: #f0fdf4; }
        .choice-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .choice-icon.blue { background: #dbeafe; color: #1d4ed8; }
        .choice-icon.green { background: #d1fae5; color: #059669; }
        .choice-content { display: flex; flex-direction: column; gap: 3px; flex: 1; }
        .choice-title { font-size: 1rem; font-weight: 800; color: #0f172a; line-height: 1.3; }
        .choice-desc { font-size: 0.82rem; color: #64748b; font-weight: 500; line-height: 1.5; }
        .batch-choice-cancel {
          width: 100%; padding: 12px; background: transparent; border: none;
          color: #64748b; font-family: inherit; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; border-radius: 12px; transition: all 0.2s ease;
        }
        .batch-choice-cancel:hover { background: #f1f5f9; color: #334155; }

        @media (max-width: 480px) {
          .batch-choice-modal { padding: 24px 20px 18px; border-radius: 24px; }
          .batch-choice-title { font-size: 1.15rem; }
          .batch-choice-btn { padding: 14px 14px; gap: 12px; }
          .choice-icon { width: 42px; height: 42px; }
          .choice-title { font-size: 0.95rem; }
          .choice-desc { font-size: 0.78rem; }
        }
      `}</style>
    </div>
  );
}
