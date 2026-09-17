// TeacherDashboard.jsx
import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import {
  PlusCircle, Trash2, BookOpen, Edit2, X, UploadCloud, CheckCircle2, FileText,
  Upload, Download, FileSpreadsheet, FileJson, AlertCircle, Search, Image as ImageIcon,
  Save, Power, PowerOff, Settings, Info, List
} from "lucide-react";
import * as XLSX from "xlsx";
import Footer from "./Footer";
import Navbar from "./Navbar";
import ConfirmDialog from "./ConfirmDialog";

// ============ اللغة الإنجليزية فقط ============
const ENGLISH_SUBJECT_KEYWORD = "إنجليزية";
const ALLOW_IMAGE_OPTIONS_KEYWORDS = ["إنجليزية"];

// دوال تحويل الإجابة الصحيحة للرفع الجماعي
const mapCorrectOption = (value) => {
  if (value === undefined || value === "") return null;
  if (!isNaN(value) && [0, 1, 2, 3].includes(Number(value))) return Number(value);
  const str = String(value).trim().toLowerCase();
  const englishMap = { a: 0, b: 1, c: 2, d: 3 };
  const arabicMap = { أ: 0, ا: 0, ب: 1, ج: 2, د: 3 };
  if (englishMap[str] !== undefined) return englishMap[str];
  if (arabicMap[str] !== undefined) return arabicMap[str];
  return null;
};

const getCorrectOptionLetter = (correctNumber) =>
  ["A", "B", "C", "D"][correctNumber] || "?";

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [englishSubject, setEnglishSubject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [passageSearch, setPassageSearch] = useState("");
  const [stats, setStats] = useState({ totalQuestions: 0, totalPassages: 0 });

  // Bulk upload states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [showBulkPreview, setShowBulkPreview] = useState(false);

  // Passage modal states
  const [showPassageModal, setShowPassageModal] = useState(false);
  const [editingPassage, setEditingPassage] = useState(null);
  const [passageForm, setPassageForm] = useState({ title: "", passage_text: "" });

  // Upload batches (from Supabase)
  const [uploadBatches, setUploadBatches] = useState([]);

  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editDuration, setEditDuration] = useState(60);
  const [editQuestionsCount, setEditQuestionsCount] = useState(40);

  // توسيع الدفعة
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [batchQuestions, setBatchQuestions] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // تعديل الدرجة
  const [editingCellId, setEditingCellId] = useState(null);
  const [editDegree, setEditDegree] = useState("");
  const [editingBatchCellId, setEditingBatchCellId] = useState(null);
  const [batchEditDegree, setBatchEditDegree] = useState("");

  // ⭐ تعديل سؤال داخل الدفعة
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [editingBatchQuestion, setEditingBatchQuestion] = useState(null);
  const [batchFormData, setBatchFormData] = useState({
    question_text: "",
    optionA: "", optionB: "", optionC: "", optionD: "",
    correct_option: 0,
    image_url: "",
    unit_number: "",
    branch: "",
    degree: "1"
  });
  const [batchSaving, setBatchSaving] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false, title: "", message: "", confirmText: "", cancelText: "", resolve: null
  });

  const [formData, setFormData] = useState({
    question_text: "",
    optionA: "", optionB: "", optionC: "", optionD: "",
    correct_option: 0,
    image_url: "",
    passage_id: "",
    imageA: "", imageB: "", imageC: "", imageD: "",
    unit_number: "",
    branch: "",
    degree: "1"
  });

  // ============ Confirmation Helper ============
  const showConfirm = (options) =>
    new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || "تأكيد العملية",
        message: options.message,
        confirmText: options.confirmText || "تأكيد",
        cancelText: options.cancelText || "إلغاء",
        resolve
      });
    });

  const handleConfirm = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  // ============ Initialization ============
  useEffect(() => {
    const init = async () => {
      try {
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
if (!user) {
  navigate("/login", { replace: true });
  return;
}

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role !== "teacher") {
          toast.error("غير مصرح لك بالدخول");
          await supabase.auth.signOut();
          navigate("/login", { replace: true });
          return;
        }

        setTeacherProfile(profile);
        await fetchEnglishSubject();
        fetchPassages();
      } catch (err) {
        console.error("Init error:", err);
        setFetchError("حدث خطأ أثناء تحميل الصفحة");
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    setStats({ totalQuestions: questions.length, totalPassages: passages.length });
  }, [questions, passages]);

  useEffect(() => {
    document.title = "إدارة بنك أسئلة اللغة الإنجليزية";
  }, []);

  // ============ Data Fetching ============
  const fetchEnglishSubject = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, duration_minutes, questions_count, branch")
        .ilike("name", `%${ENGLISH_SUBJECT_KEYWORD}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setFetchError("مادة اللغة الإنجليزية غير موجودة في قاعدة البيانات. تواصل مع الإدارة.");
        return null;
      }

      setEnglishSubject(data);
      setEditDuration(data.duration_minutes || 60);
      setEditQuestionsCount(data.questions_count || 40);

      fetchQuestionsBySubject(data.id);
      fetchUploadBatches();

      return data;
    } catch (err) {
      console.error("fetchEnglishSubject error:", err);
      setFetchError("فشل تحميل بيانات المادة");
      return null;
    }
  };

  const fetchQuestionsBySubject = async (subjectId) => {
    try {
      setLoading(true);
      setFetchError(null);

      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("subject_id", subjectId)
        .is("bulk_batch_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error("fetchQuestions error:", err);
      setFetchError("حدث خطأ في جلب الأسئلة");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = () => {
    if (englishSubject?.id) {
      return fetchQuestionsBySubject(englishSubject.id);
    }
  };

const fetchPassages = async () => {
  const { data, error } = await supabase
    .from("passages")
    .select("*")
    .order("created_at", { ascending: true });

  if (!error && data) {
    // نحن في تطبيق اللغة الإنجليزية فقط، لذا كل القطع إنجليزية
    setPassages(data || []);
  }
};

  // ⭐ جلب الدفعات من Supabase
  const fetchUploadBatches = async () => {
    try {
      const { data, error } = await supabase
        .from("upload_batches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((b) => ({
        id: b.id,
        date: b.created_at,
        fileName: b.file_name,
        count: b.questions_count,
        subject: englishSubject?.name || "اللغة الإنجليزية",
        isActive: b.is_active,
      }));

      setUploadBatches(mapped);
    } catch (err) {
      console.error("fetchUploadBatches error:", err);
      toast.error("فشل تحميل سجل الدفعات");
    }
  };

  const fetchBatchQuestions = async (batchId) => {
    setBatchLoading(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("bulk_batch_id", batchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setBatchQuestions(data || []);
      setEditingBatchCellId(null);
    } catch (error) {
      toast.error("فشل جلب أسئلة الدفعة");
      setBatchQuestions([]);
    } finally {
      setBatchLoading(false);
    }
  };

  // ============ Image Upload ============
  const uploadImage = async (file) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const { error } = await supabase.storage.from("question-images").upload(fileName, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("question-images").getPublicUrl(fileName);
    return publicUrl;
  };

  // ============ Add/Update Question ============
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!englishSubject?.id) {
      toast.error("المادة غير محمّلة، حاول لاحقاً");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const newQuestion = {
        teacher_id: user.id,
        subject_id: englishSubject.id,
        question_text: formData.question_text,
        options: [formData.optionA, formData.optionB, formData.optionC, formData.optionD],
        correct_option: parseInt(formData.correct_option),
        image_url: formData.image_url || null,
        passage_id: formData.passage_id || null,
        created_at: new Date(),
        image_option_a: formData.imageA || null,
        image_option_b: formData.imageB || null,
        image_option_c: formData.imageC || null,
        image_option_d: formData.imageD || null,
        unit_number: formData.unit_number ? parseInt(formData.unit_number) : null,
        branch: formData.branch || null,
        degree: parseInt(formData.degree) || 1,
        is_active: true
      };

      const { error } = await supabase.from("questions").insert([newQuestion]);
      if (error) throw error;

      toast.success("تم إضافة السؤال بنجاح!");
      resetForm();
      await fetchQuestions();
    } catch (error) {
      toast.error("خطأ في الإضافة: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedQuestion = {
        subject_id: englishSubject.id,
        question_text: formData.question_text,
        options: [formData.optionA, formData.optionB, formData.optionC, formData.optionD],
        correct_option: parseInt(formData.correct_option),
        image_url: formData.image_url || null,
        passage_id: formData.passage_id || null,
        image_option_a: formData.imageA || null,
        image_option_b: formData.imageB || null,
        image_option_c: formData.imageC || null,
        image_option_d: formData.imageD || null,
        unit_number: formData.unit_number ? parseInt(formData.unit_number) : null,
        branch: formData.branch || null
      };

      const { error } = await supabase.from("questions").update(updatedQuestion).eq("id", editingId);
      if (error) throw error;

      toast.success("تم تعديل السؤال بنجاح!");
      resetForm();
      await fetchQuestions();
    } catch (error) {
      toast.error("خطأ في التعديل: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async (id) => {
    const confirmed = await showConfirm({
      title: "حذف السؤال",
      message: "هل أنت متأكد من حذف هذا السؤال؟ لا يمكن التراجع عن هذا الإجراء.",
      confirmText: "حذف",
      cancelText: "إلغاء"
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
      if (editingId === id) resetForm();
      await fetchQuestions();
      toast.success("تم حذف السؤال بنجاح");
    } catch (error) {
      toast.error("خطأ أثناء الحذف: " + error.message);
    }
  };

  const loadQuestionForEdit = (question) => {
    const options = question.options || ["", "", "", ""];
    setFormData({
      question_text: question.question_text || "",
      optionA: options[0] || "",
      optionB: options[1] || "",
      optionC: options[2] || "",
      optionD: options[3] || "",
      correct_option: question.correct_option || 0,
      image_url: question.image_url || "",
      passage_id: question.passage_id || "",
      imageA: question.image_option_a || "",
      imageB: question.image_option_b || "",
      imageC: question.image_option_c || "",
      imageD: question.image_option_d || "",
      unit_number: question.unit_number || "",
      branch: question.branch || "",
      degree: question.degree || "1"
    });
    setIsEditing(true);
    setEditingId(question.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setFormData({
      question_text: "",
      optionA: "", optionB: "", optionC: "", optionD: "",
      correct_option: 0,
      image_url: "",
      passage_id: "",
      imageA: "", imageB: "", imageC: "", imageD: "",
      unit_number: "",
      branch: "",
      degree: "1"
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // ============ Passage CRUD ============
  const handleAddPassage = async (e) => {
    e.preventDefault();
    if (!englishSubject?.id) return;

    const payload = {
      title: passageForm.title,
      passage_text: passageForm.passage_text,
      subject_id: englishSubject.id
    };

    try {
      if (editingPassage) {
        await supabase.from("passages").update(payload).eq("id", editingPassage.id);
        toast.success("تم تحديث النص بنجاح");
      } else {
        await supabase.from("passages").insert([payload]);
        toast.success("تم إضافة النص بنجاح");
      }
      fetchPassages();
      setShowPassageModal(false);
      setEditingPassage(null);
      setPassageForm({ title: "", passage_text: "" });
    } catch (err) {
      toast.error("حدث خطأ: " + err.message);
    }
  };

  const deletePassage = async (id) => {
    const confirmed = await showConfirm({
      title: "حذف النص",
      message: "حذف النص سيؤدي إلى فصل الأسئلة المرتبطة به. هل أنت متأكد؟",
      confirmText: "حذف",
      cancelText: "إلغاء"
    });
    if (!confirmed) return;
    await supabase.from("passages").delete().eq("id", id);
    fetchPassages();
    toast.success("تم حذف النص بنجاح");
  };

  // ============ Settings ============
  const handleSaveSettings = async () => {
    if (!englishSubject?.id) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("subjects")
        .update({
          duration_minutes: editDuration,
          questions_count: editQuestionsCount
        })
        .eq("id", englishSubject.id);

      if (error) throw error;

      setEnglishSubject(prev => ({
        ...prev,
        duration_minutes: editDuration,
        questions_count: editQuestionsCount
      }));

      toast.success("تم حفظ الإعدادات بنجاح");
      setShowSettingsModal(false);
    } catch (error) {
      toast.error("خطأ في الحفظ: " + error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // ============ BULK UPLOAD ============
  const openBulkModal = () => {
    setShowBulkModal(true);
    resetBulkStates();
  };

  const resetBulkStates = () => {
    setBulkPreview([]);
    setBulkErrors([]);
    setBulkFileName("");
    setShowBulkPreview(false);
  };

  const processBulkQuestions = (rawData) => {
    const errors = [];
    const validQuestions = [];
    const rows = rawData.map((row, index) => ({ ...row, _row: index + 1 }));

    rows.forEach((row) => {
      const rowNum = row._row;
      let questionText = row.question_text || row["نص السؤال"] || row["السؤال"] || "";
      if (!questionText) {
        errors.push(`الصف ${rowNum}: لا يوجد نص للسؤال`);
        return;
      }

      const options = [];
      for (let i = 0; i < 4; i++) {
        const opt = row[`option${String.fromCharCode(65 + i)}`]
          || row[`option_${i}`]
          || row[`الخيار ${i + 1}`]
          || row[`خيار${i + 1}`] || "";
        options.push(opt);
      }
      if (!options.every(o => o !== undefined)) {
        errors.push(`الصف ${rowNum}: الخيارات غير مكتملة`);
        return;
      }

      let correctOption = mapCorrectOption(
        row.correct_option || row["الإجابة الصحيحة"] || row["correct"] || row["صحيح"]
      );
      if (correctOption === null || correctOption === undefined) {
        errors.push(`الصف ${rowNum}: الإجابة الصحيحة غير صالحة`);
        return;
      }

      const degree = parseInt(row.degree || row["الدرجة"] || 1) || 1;
      const unit = row.unit_number || row["الوحدة"] || row["unit"] || "";
      const branch = row.branch || row["الفرع"] || "";

      validQuestions.push({
        question_text: questionText.trim(),
        options,
        correct_option: correctOption,
        degree,
        unit_number: unit ? parseInt(unit) : null,
        branch: branch || null,
        image_url: row.image_url || row["الصورة"] || null,
        passage_id: row.passage_id || row["رقم النص"] || null
      });
    });

    setBulkErrors(errors);
    if (errors.length > 0) toast.error(`يوجد ${errors.length} أخطاء في الملف`);
    return validQuestions;
  };

  const handleBulkFileUpload = (file) => {
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        if (!jsonData || jsonData.length === 0) {
          toast.error("الملف لا يحتوي على بيانات");
          return;
        }
        const valid = processBulkQuestions(jsonData);
        setBulkPreview(valid);
        if (valid.length > 0) setShowBulkPreview(true);
      } catch (error) {
        toast.error("فشل قراءة الملف: " + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkJsonUpload = (file) => {
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!Array.isArray(jsonData)) {
          toast.error("ملف JSON يجب أن يحتوي على مصفوفة");
          return;
        }
        const valid = processBulkQuestions(jsonData);
        setBulkPreview(valid);
        if (valid.length > 0) setShowBulkPreview(true);
      } catch (error) {
        toast.error("فشل قراءة ملف JSON: " + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (!englishSubject?.id) {
      toast.error("المادة غير محمّلة");
      return;
    }
    if (bulkPreview.length === 0) {
      toast.error("لا توجد أسئلة صالحة للرفع");
      return;
    }

    setBulkUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("لم يتم العثور على المستخدم");

      const batchId = Date.now().toString();

      // 1) إنشاء الدفعة
      const { error: batchError } = await supabase
        .from("upload_batches")
        .insert([{
          id: batchId,
          file_name: bulkFileName || "ملف غير معروف",
          subject_id: englishSubject.id,
          questions_count: bulkPreview.length,
          is_active: true,
          teacher_id: user.id,
        }]);

      if (batchError) throw batchError;

      // 2) إدراج الأسئلة
      const questionsToInsert = bulkPreview.map(q => ({
        teacher_id: user.id,
        subject_id: englishSubject.id,
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
        degree: q.degree,
        unit_number: q.unit_number,
        branch: q.branch,
        image_url: q.image_url || null,
        passage_id: q.passage_id ? parseInt(q.passage_id) : null,
        is_active: true,
        created_at: new Date(),
        image_option_a: null,
        image_option_b: null,
        image_option_c: null,
        image_option_d: null,
        bulk_batch_id: batchId,
      }));

      const { error } = await supabase.from("questions").insert(questionsToInsert);
      if (error) {
        await supabase.from("upload_batches").delete().eq("id", batchId);
        throw error;
      }

      toast.success(`تم رفع ${questionsToInsert.length} سؤال بنجاح`);
      await fetchUploadBatches();
      setShowBulkModal(false);
      resetBulkStates();
    } catch (error) {
      toast.error("فشل الرفع الجماعي: " + error.message);
    } finally {
      setBulkUploading(false);
    }
  };

  // ============ Batch Actions ============
  const toggleBatchActive = async (batchId, currentlyActive) => {
    const confirmed = await showConfirm({
      title: currentlyActive ? "تعطيل الدفعة" : "تفعيل الدفعة",
      message: `هل أنت متأكد من ${currentlyActive ? "تعطيل" : "تفعيل"} أسئلة هذه الدفعة؟`,
      confirmText: currentlyActive ? "تعطيل" : "تفعيل",
      cancelText: "إلغاء"
    });
    if (!confirmed) return;

    try {
      const { error: qError } = await supabase
        .from("questions")
        .update({ is_active: !currentlyActive })
        .eq("bulk_batch_id", batchId);

      if (qError) throw qError;

      const { error: bError } = await supabase
        .from("upload_batches")
        .update({ is_active: !currentlyActive })
        .eq("id", batchId);

      if (bError) throw bError;

      setUploadBatches(prev => prev.map(b =>
        b.id === batchId ? { ...b, isActive: !currentlyActive } : b
      ));

      if (expandedBatchId === batchId) {
        fetchBatchQuestions(batchId);
      }
      toast.success(`تم ${!currentlyActive ? "تفعيل" : "تعطيل"} الدفعة بنجاح`);
    } catch (error) {
      toast.error("حدث خطأ: " + error.message);
    }
  };

  const toggleQuestionActive = async (questionId, currentlyActive) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ is_active: !currentlyActive })
        .eq("id", questionId);

      if (error) throw error;

      await fetchQuestions();
      toast.success(`تم ${!currentlyActive ? "تفعيل" : "تعطيل"} السؤال`);
    } catch (error) {
      toast.error("فشل تحديث السؤال: " + error.message);
    }
  };

  const toggleBatchQuestionActive = async (questionId, currentlyActive, batchId) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ is_active: !currentlyActive })
        .eq("id", questionId);

      if (error) throw error;
      fetchBatchQuestions(batchId);
      toast.success(`تم ${!currentlyActive ? "تفعيل" : "تعطيل"} السؤال`);
    } catch (error) {
      toast.error("فشل تحديث السؤال: " + error.message);
    }
  };

  const toggleAllQuestions = async (activate) => {
    const action = activate ? "تفعيل" : "تعطيل";
    const confirmed = await showConfirm({
      title: `${action} جميع الأسئلة`,
      message: `هل أنت متأكد من ${action} جميع الأسئلة المعروضة حالياً؟`,
      confirmText: action,
      cancelText: "إلغاء"
    });
    if (!confirmed) return;

    try {
      const questionIds = filteredQuestions.map(q => q.id);
      if (questionIds.length === 0) {
        toast.error("لا توجد أسئلة لتحديثها");
        return;
      }

      const { error } = await supabase
        .from("questions")
        .update({ is_active: activate })
        .in("id", questionIds);

      if (error) throw error;

      await fetchQuestions();
      toast.success(`تم ${action} جميع الأسئلة بنجاح`);
    } catch (error) {
      toast.error("فشل تحديث الأسئلة: " + error.message);
    }
  };

  // ⭐ حذف الدفعة (CASCADE يحذف الأسئلة تلقائياً)
  const deleteBatchQuestions = async (batchId, batchIndex) => {
    const confirmed = await showConfirm({
      title: "حذف الدفعة نهائياً",
      message: `سيتم حذف الدفعة ${batchIndex + 1} (${uploadBatches[batchIndex].count} سؤال) من قاعدة البيانات نهائياً. لا يمكن التراجع.`,
      confirmText: "حذف نهائي",
      cancelText: "إلغاء"
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("upload_batches")
        .delete()
        .eq("id", batchId);

      if (error) throw error;

      setUploadBatches(prev => prev.filter(b => b.id !== batchId));

      if (expandedBatchId === batchId) {
        setExpandedBatchId(null);
        setBatchQuestions([]);
      }

      toast.success("تم حذف الدفعة وأسئلتها نهائياً");
    } catch (error) {
      toast.error("فشل حذف الدفعة: " + error.message);
    }
  };

  const handleBatchRowClick = (batch) => {
    if (expandedBatchId === batch.id) {
      setExpandedBatchId(null);
      setBatchQuestions([]);
      setEditingBatchCellId(null);
    } else {
      setExpandedBatchId(batch.id);
      fetchBatchQuestions(batch.id);
    }
  };

  // ============ Degree Editing (Manual Questions) ============
  const startEditDegree = (question) => {
    setEditingCellId(question.id);
    setEditDegree(question.degree?.toString() || "1");
  };

  const saveDegreeEdit = async (questionId) => {
    const newDegree = parseInt(editDegree) || 1;
    try {
      await supabase.from("questions").update({ degree: newDegree }).eq("id", questionId);
      setEditingCellId(null);
      await fetchQuestions();
      toast.success("تم تحديث الدرجة");
    } catch {
      toast.error("فشل تحديث الدرجة");
    }
  };

  // ============ Degree Editing (Batch Questions) ============
  const startEditBatchDegree = (question) => {
    setEditingBatchCellId(question.id);
    setBatchEditDegree(question.degree?.toString() || "1");
  };

  const saveBatchDegreeEdit = async (questionId, batchId) => {
    const newDegree = parseInt(batchEditDegree) || 1;
    try {
      await supabase.from("questions").update({ degree: newDegree }).eq("id", questionId);
      setEditingBatchCellId(null);
      await fetchBatchQuestions(batchId);
      toast.success("تم تحديث الدرجة");
    } catch {
      toast.error("فشل تحديث الدرجة");
    }
  };

  // ============ ⭐ Batch Question Edit / Delete ============
  const openBatchQuestionEdit = (q) => {
    const options = q.options || ["", "", "", ""];
    setEditingBatchQuestion(q);
    setBatchFormData({
      question_text: q.question_text || "",
      optionA: options[0] || "",
      optionB: options[1] || "",
      optionC: options[2] || "",
      optionD: options[3] || "",
      correct_option: q.correct_option ?? 0,
      image_url: q.image_url || "",
      unit_number: q.unit_number || "",
      branch: q.branch || "",
      degree: q.degree || "1"
    });
    setShowBatchEditModal(true);
  };

  const closeBatchEditModal = () => {
    setShowBatchEditModal(false);
    setEditingBatchQuestion(null);
    setBatchFormData({
      question_text: "",
      optionA: "", optionB: "", optionC: "", optionD: "",
      correct_option: 0,
      image_url: "",
      unit_number: "",
      branch: "",
      degree: "1"
    });
  };

  const handleUpdateBatchQuestion = async (e) => {
    e.preventDefault();
    if (!editingBatchQuestion) return;

    setBatchSaving(true);
    try {
      const updated = {
        question_text: batchFormData.question_text,
        options: [
          batchFormData.optionA,
          batchFormData.optionB,
          batchFormData.optionC,
          batchFormData.optionD,
        ],
        correct_option: parseInt(batchFormData.correct_option),
        image_url: batchFormData.image_url || null,
        unit_number: batchFormData.unit_number ? parseInt(batchFormData.unit_number) : null,
        branch: batchFormData.branch || null,
        degree: parseInt(batchFormData.degree) || 1,
      };

      const { error } = await supabase
        .from("questions")
        .update(updated)
        .eq("id", editingBatchQuestion.id);

      if (error) throw error;

      toast.success("تم تعديل السؤال بنجاح");
      closeBatchEditModal();
      await fetchBatchQuestions(expandedBatchId);
    } catch (err) {
      toast.error("فشل التعديل: " + err.message);
    } finally {
      setBatchSaving(false);
    }
  };

  const deleteBatchQuestion = async (questionId) => {
    const confirmed = await showConfirm({
      title: "حذف السؤال",
      message: "سيتم حذف هذا السؤال نهائياً من الدفعة. هل أنت متأكد؟",
      confirmText: "حذف",
      cancelText: "إلغاء"
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      // تحديث عدد الأسئلة في الدفعة
      const newCount = batchQuestions.length - 1;
      await supabase
        .from("upload_batches")
        .update({ questions_count: newCount })
        .eq("id", expandedBatchId);

      // تحديث القائمة المحلية
      setBatchQuestions(prev => prev.filter(q => q.id !== questionId));
      setUploadBatches(prev => prev.map(b =>
        b.id === expandedBatchId ? { ...b, count: newCount } : b
      ));

      toast.success("تم حذف السؤال بنجاح");
    } catch (err) {
      toast.error("فشل الحذف: " + err.message);
    }
  };

  // ============ Template Download ============
  const downloadTemplate = () => {
    const sampleData = [
      {
        "نص السؤال": "Choose the correct answer: I ___ to school every day.",
        "الخيار 1": "go",
        "الخيار 2": "goes",
        "الخيار 3": "going",
        "الخيار 4": "gone",
        "الإجابة الصحيحة": "A",
        "الدرجة": 1,
        "الوحدة": 1,
        "الفرع": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "English");
    XLSX.writeFile(workbook, "english_questions_template.xlsx");
    toast.success("تم تحميل القالب");
  };

  const handleCancelBulk = () => {
    setShowBulkModal(false);
    resetBulkStates();
  };

  // ============ Filtering ============
  const filteredQuestions = questions.filter(q => {
    return q.question_text?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const allActive = filteredQuestions.length > 0 && filteredQuestions.every(q => q.is_active);

  const ImageUploadField = ({ label, imageUrl, onImageChange, onRemove, inputId }) => (
    <div className="form-group" style={{ marginTop: "12px" }}>
      <label className="sub-label">{label}</label>
      <div className="upload-box compact-upload">
        <input type="file" accept="image/*" id={inputId} style={{ display: "none" }} onChange={onImageChange} />
        {!imageUrl ? (
          <label htmlFor={inputId} className="upload-btn-outline">
            <UploadCloud size={16} /> رفع صورة
          </label>
        ) : (
          <div className="image-preview">
            <img src={imageUrl} alt="preview" />
            <button type="button" onClick={onRemove} className="remove-img-btn">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ============ Render ============
  return (
    <div className="teacher-container">
      <Navbar userName={teacherProfile?.name || "معلم"} />

      <main className="teacher-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {isEditing ? "تعديل السؤال" : "إدارة بنك أسئلة اللغة الإنجليزية"}
            </h1>
            <p className="page-subtitle">
              أضف، عدّل، وأدر أسئلة اختبارات اللغة الإنجليزية بكل سهولة.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => setShowPassageModal(true)}>
              <FileText size={18} /> النصوص (Passages)
            </button>
            <button className="btn-secondary" onClick={() => setShowSettingsModal(true)}>
              <Settings size={18} /> الإعدادات
            </button>
            <button className="btn-primary" onClick={openBulkModal}>
              <Upload size={18} /> رفع جماعي
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper blue"><BookOpen size={24} /></div>
            <div className="stat-content">
              <span className="stat-label">إجمالي الأسئلة اليدوية</span>
              <span className="stat-number">{stats.totalQuestions}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper purple"><FileText size={24} /></div>
            <div className="stat-content">
              <span className="stat-label">نصوص القراءة</span>
              <span className="stat-number">{stats.totalPassages}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper green"><CheckCircle2 size={24} /></div>
            <div className="stat-content">
              <span className="stat-label">المادة</span>
              <span className="stat-number" style={{ fontSize: '1.2rem' }}>
                {englishSubject?.name || "—"}
              </span>
            </div>
          </div>
        </div>

        {fetchError && <div className="error-banner"><X size={20} /> {fetchError}</div>}

        {/* Add/Edit Form */}
        <section className="form-card main-form-section">
          <div className="card-header">
            <h2 className="card-title">
              {isEditing ? <Edit2 size={22} className="icon-accent" /> : <PlusCircle size={22} className="icon-accent" />}
              {isEditing ? "تحديث بيانات السؤال" : "إضافة سؤال جديد"}
            </h2>
            {isEditing && (
              <button className="btn-text" onClick={resetForm}>
                <X size={16} /> إلغاء التعديل
              </button>
            )}
          </div>

          <form onSubmit={isEditing ? handleUpdateQuestion : handleAddQuestion} className="question-form">
            <div className="form-section">
              <h3 className="section-title"><Info size={18} /> المعلومات الأساسية</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>المادة</label>
                  <input
                    type="text"
                    className="modern-input"
                    value={englishSubject?.name || "اللغة الإنجليزية"}
                    disabled
                    style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label>رقم الوحدة</label>
                  <input
                    type="number"
                    className="modern-input"
                    value={formData.unit_number}
                    onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                    placeholder="مثال: 1"
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label>الفرع الدراسي</label>
                  <select
                    className="modern-input"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    <option value="">مشترك (العلمي والأدبي)</option>
                    <option value="العلمي">العلمي</option>
                    <option value="الأدبي">الأدبي</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>القطعة المرتبطة (Passage)</label>
                  <select
                    className="modern-input"
                    value={formData.passage_id}
                    onChange={(e) => setFormData({ ...formData, passage_id: e.target.value })}
                  >
                    <option value="">بدون نص</option>
                    {passages.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>نص السؤال <span className="required">*</span></label>
                  <textarea
                    required
                    className="modern-input textarea-input"
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    placeholder="Write the question here..."
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                </div>

                <div className="form-group full-width">
                  <label>صورة توضيحية للسؤال <span className="hint-text">(اختياري)</span></label>
                  <div className="upload-box">
                    <input
                      type="file"
                      id="q-image"
                      className="hidden-input"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            const url = await uploadImage(file);
                            setFormData({ ...formData, image_url: url });
                          } catch {
                            toast.error("فشل رفع الصورة");
                          }
                        }
                      }}
                    />
                    {!formData.image_url ? (
                      <label htmlFor="q-image" className="upload-label-large">
                        <UploadCloud size={36} className="upload-icon" />
                        <span className="upload-text">اضغط هنا لرفع صورة</span>
                        <span className="upload-hint">PNG, JPG حتى 5MB</span>
                      </label>
                    ) : (
                      <div className="image-preview large-preview">
                        <img src={formData.image_url} alt="preview" />
                        <button
                          type="button"
                          className="remove-img-btn"
                          onClick={() => setFormData({ ...formData, image_url: "" })}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section alt-bg">
              <h3 className="section-title"><List size={18} /> الخيارات والإجابة الصحيحة</h3>
              <div className="options-grid">
                {[0, 1, 2, 3].map(idx => {
                  const optKey = ["A", "B", "C", "D"][idx];
                  const valueKey = ["optionA", "optionB", "optionC", "optionD"][idx];
                  const imageKey = ["imageA", "imageB", "imageC", "imageD"][idx];
                  return (
                    <div className="option-card" key={idx}>
                      <div className="form-group">
                        <label className="option-label">
                          الخيار ({optKey}) <span className="required">*</span>
                        </label>
                        <input
                          required
                          className="modern-input"
                          type="text"
                          value={formData[valueKey]}
                          onChange={(e) => setFormData({ ...formData, [valueKey]: e.target.value })}
                          placeholder="Option content..."
                          style={{ direction: 'ltr', textAlign: 'left' }}
                        />
                        <ImageUploadField
                          label="صورة إضافية للخيار (اختياري)"
                          imageUrl={formData[imageKey]}
                          inputId={`option${optKey}-upload`}
                          onImageChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              try {
                                const url = await uploadImage(file);
                                setFormData({ ...formData, [imageKey]: url });
                              } catch {
                                toast.error("فشل رفع الصورة");
                              }
                            }
                          }}
                          onRemove={() => setFormData({ ...formData, [imageKey]: "" })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-group correct-answer-group">
                <label>الإجابة الصحيحة <span className="required">*</span></label>
                <div className="correct-answer-selector">
                  {[0, 1, 2, 3].map(idx => (
                    <label
                      key={idx}
                      className={`radio-label ${parseInt(formData.correct_option) === idx ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="correct_option"
                        value={idx}
                        checked={parseInt(formData.correct_option) === idx}
                        onChange={(e) => setFormData({ ...formData, correct_option: e.target.value })}
                        className="hidden-radio"
                      />
                      الخيار {["A", "B", "C", "D"][idx]}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary large-btn" disabled={loading}>
                {isEditing ? <Edit2 size={20} /> : <CheckCircle2 size={20} />}
                {loading ? "جاري المعالجة..." : (isEditing ? "حفظ التعديلات" : "إضافة السؤال للبنك")}
              </button>
            </div>
          </form>
        </section>

        {/* Questions List */}
        <section className="table-card">
          <div className="card-header">
            <h2 className="card-title">
              <BookOpen size={20} className="icon-accent" /> بنك الأسئلة اليدوية
            </h2>
            <div className="card-header-actions">
              <span className="badge-count">{filteredQuestions.length} سؤال</span>
              <button
                className="btn-secondary"
                onClick={() => toggleAllQuestions(!allActive)}
                style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                title={allActive ? "تعطيل جميع الأسئلة المعروضة" : "تفعيل جميع الأسئلة المعروضة"}
              >
                {allActive ? <PowerOff size={16} color="#ef4444" /> : <Power size={16} color="#10b981" />}
                {allActive ? "تعطيل الكل" : "تفعيل الكل"}
              </button>
              <div className="search-wrapper" style={{ width: '260px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="ابحث في الأسئلة..."
                  className="search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            {loading && questions.length === 0 ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <p>جاري تحميل الأسئلة...</p>
              </div>
            ) : filteredQuestions.length > 0 ? (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>التفاصيل</th>
                    <th>نص السؤال</th>
                    <th className="text-center">الدرجة</th>
                    <th className="text-center">الإجابة</th>
                    <th className="text-center" style={{ width: '100px' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q) => {
                    const hasImage = !!q.image_url;
                    const imagesCount = [
                      q.image_option_a, q.image_option_b,
                      q.image_option_c, q.image_option_d
                    ].filter(Boolean).length;
                    return (
                      <tr key={q.id} className={q.is_active ? '' : 'inactive-row'}>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b' }}>
                            <span className="badge bg-light" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                              {q.branch || 'عام'}
                            </span>
                            <span>الوحدة: {q.unit_number || '-'}</span>
                          </div>
                        </td>
                        <td className="q-text-cell" title={q.question_text} style={{ maxWidth: '400px' }}>
                          <span style={{ direction: 'ltr', textAlign: 'left', display: 'inline-block' }}>
                            {q.question_text}
                          </span>
                          {hasImage && (
                            <ImageIcon size={12} style={{ marginRight: '6px', color: '#3b82f6', verticalAlign: 'middle' }} />
                          )}
                          {imagesCount > 0 && (
                            <List size={12} style={{ marginRight: '4px', color: '#8b5cf6', verticalAlign: 'middle' }} />
                          )}
                        </td>
                        <td className="text-center">
                          {editingCellId === q.id ? (
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={editDegree}
                              onChange={(e) => setEditDegree(e.target.value)}
                              onBlur={() => saveDegreeEdit(q.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveDegreeEdit(q.id); }}
                              autoFocus
                              className="modern-input"
                              style={{ width: '60px', padding: '4px 8px', textAlign: 'center', fontSize: '0.9rem' }}
                            />
                          ) : (
                            <div
                              style={{ fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                              onClick={() => startEditDegree(q)}
                            >
                              {q.degree || 1}
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="correct-badge">
                            {["A", "B", "C", "D"][q.correct_option] || "?"}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="action-buttons">
                            <button
                              className="btn-icon"
                              style={{ color: q.is_active ? '#f59e0b' : '#10b981', width: '32px', height: '32px' }}
                              onClick={() => toggleQuestionActive(q.id, q.is_active)}
                              title={q.is_active ? "تعطيل السؤال" : "تفعيل السؤال"}
                            >
                              {q.is_active ? <PowerOff size={15} /> : <Power size={15} />}
                            </button>
                            <button
                              className="btn-icon edit"
                              onClick={() => loadQuestionForEdit(q)}
                              title="تعديل"
                              style={{ width: '32px', height: '32px' }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="btn-icon delete"
                              onClick={() => deleteQuestion(q.id)}
                              title="حذف"
                              style={{ width: '32px', height: '32px' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-illustration"><BookOpen size={48} strokeWidth={1} /></div>
                <h3>لا توجد أسئلة يدوية حالياً</h3>
                <p>{searchTerm ? "لم نعثر على نتائج مطابقة لبحثك." : "أضف سؤالك الأول باستخدام النموذج أعلاه."}</p>
              </div>
            )}
          </div>
        </section>

        {/* Upload Batches */}
        <section className="table-card">
          <div className="card-header">
            <h2 className="card-title">
              <Upload size={20} className="icon-accent" /> سجل الدفعات الجماعية
            </h2>
            <span className="badge-count">{uploadBatches.length} دفعة</span>
          </div>
          <div className="table-responsive">
            {uploadBatches.length > 0 ? (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>اسم الملف</th>
                    <th>المادة</th>
                    <th>عدد الأسئلة</th>
                    <th>الحالة</th>
                    <th className="text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadBatches.map((batch, idx) => (
                    <Fragment key={batch.id}>
                      <tr
                        onClick={() => handleBatchRowClick(batch)}
                        style={{
                          cursor: 'pointer',
                          background: expandedBatchId === batch.id ? '#f8fafc' : 'transparent'
                        }}
                      >
                        <td>{new Date(batch.date).toLocaleDateString('ar-SA')}</td>
                        <td><span className="badge bg-slate">{batch.fileName || "ملف غير معروف"}</span></td>
                        <td>{batch.subject}</td>
                        <td className="font-bold">{batch.count}</td>
                        <td>
                          <span className={`badge ${batch.isActive ? 'active-badge' : 'inactive-badge'}`}>
                            {batch.isActive ? "نشطة" : "معطلة"}
                          </span>
                        </td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="action-buttons">
                            <button
                              className="btn-icon"
                              style={{ color: batch.isActive ? '#f59e0b' : '#10b981' }}
                              onClick={() => toggleBatchActive(batch.id, batch.isActive)}
                              title={batch.isActive ? "تعطيل الدفعة" : "تفعيل الدفعة"}
                            >
                              {batch.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                            </button>
                            <button
                              className="btn-icon delete"
                              onClick={() => deleteBatchQuestions(batch.id, idx)}
                              title="حذف الدفعة نهائياً"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedBatchId === batch.id && (
                        <tr>
                          <td colSpan="6" style={{ padding: '0' }}>
                            <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
                              {batchLoading ? (
                                <div style={{ textAlign: 'center', padding: '16px' }}>
                                  <div className="loading-spinner"></div>
                                  <p>جاري تحميل الأسئلة...</p>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: 700, color: '#475569' }}>
                                    <span>أسئلة الدفعة ({batchQuestions.length})</span>
                                    <span>
                                      {batchQuestions.filter(q => q.is_active).length} نشط | {batchQuestions.filter(q => !q.is_active).length} معطل
                                    </span>
                                  </div>
                                  {batchQuestions.length > 0 ? (
                                    <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr>
                                          <th>نص السؤال</th>
                                          <th className="text-center">الوسائط</th>
                                          <th className="text-center">الدرجة</th>
                                          <th className="text-center">الإجابة</th>
                                          <th className="text-center">الحالة</th>
                                          <th className="text-center" style={{ width: '140px' }}>إجراءات</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {batchQuestions.map(q => {
                                          const hasImage = !!q.image_url;
                                          const imagesCount = [
                                            q.image_option_a, q.image_option_b,
                                            q.image_option_c, q.image_option_d
                                          ].filter(Boolean).length;
                                          return (
                                            <tr key={q.id} className={q.is_active ? '' : 'inactive-row'}>
                                              <td className="q-text-cell" title={q.question_text}>
                                                <span style={{ direction: 'ltr', textAlign: 'left', display: 'inline-block' }}>
                                                  {q.question_text}
                                                </span>
                                                {hasImage && (
                                                  <ImageIcon size={12} style={{ marginRight: '6px', color: '#3b82f6', verticalAlign: 'middle' }} />
                                                )}
                                                {imagesCount > 0 && (
                                                  <List size={12} style={{ marginRight: '4px', color: '#8b5cf6', verticalAlign: 'middle' }} />
                                                )}
                                              </td>
                                              <td className="text-center">
                                                <div className="media-badges">
                                                  {hasImage && (
                                                    <span className="media-badge blue" title="يحتوي على صورة">
                                                      <ImageIcon size={14} />
                                                    </span>
                                                  )}
                                                  {imagesCount > 0 && (
                                                    <span className="media-badge purple" title="صور بالخيارات">
                                                      <List size={14} />
                                                    </span>
                                                  )}
                                                  {!hasImage && imagesCount === 0 && <span className="text-muted">-</span>}
                                                </div>
                                              </td>
                                              <td className="text-center">
                                                {editingBatchCellId === q.id ? (
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={batchEditDegree}
                                                    onChange={(e) => setBatchEditDegree(e.target.value)}
                                                    onBlur={() => saveBatchDegreeEdit(q.id, batch.id)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') saveBatchDegreeEdit(q.id, batch.id); }}
                                                    autoFocus
                                                    className="modern-input"
                                                    style={{ width: '60px', padding: '4px 8px', textAlign: 'center', fontSize: '0.9rem' }}
                                                  />
                                                ) : (
                                                  <div
                                                    style={{ fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                                                    onClick={() => startEditBatchDegree(q)}
                                                  >
                                                    {q.degree || 1}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="text-center">
                                                <span className="correct-badge">
                                                  {["A", "B", "C", "D"][q.correct_option] || "?"}
                                                </span>
                                              </td>
                                              <td className="text-center">
                                                <span className={`badge ${q.is_active ? 'active-badge' : 'inactive-badge'}`}>
                                                  {q.is_active ? "نشط" : "معطل"}
                                                </span>
                                              </td>
                                              <td className="text-center">
                                                <div className="action-buttons">
                                                  <button
                                                    className="btn-icon"
                                                    style={{ color: q.is_active ? '#f59e0b' : '#10b981', width: '32px', height: '32px' }}
                                                    onClick={() => toggleBatchQuestionActive(q.id, q.is_active, batch.id)}
                                                    title={q.is_active ? "تعطيل السؤال" : "تفعيل السؤال"}
                                                  >
                                                    {q.is_active ? <PowerOff size={15} /> : <Power size={15} />}
                                                  </button>
                                                  <button
                                                    className="btn-icon edit"
                                                    onClick={() => openBatchQuestionEdit(q)}
                                                    title="تعديل"
                                                    style={{ width: '32px', height: '32px' }}
                                                  >
                                                    <Edit2 size={15} />
                                                  </button>
                                                  <button
                                                    className="btn-icon delete"
                                                    onClick={() => deleteBatchQuestion(q.id)}
                                                    title="حذف"
                                                    style={{ width: '32px', height: '32px' }}
                                                  >
                                                    <Trash2 size={15} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="empty-state" style={{ padding: '20px' }}>
                                      <p>لا توجد أسئلة في هذه الدفعة</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>لا توجد دفعات مرفوعة بعد</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />

      {/* ============ Passage Modal ============ */}
      {showPassageModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowPassageModal(false);
            setEditingPassage(null);
            setPassageForm({ title: "", passage_text: "" });
          }}
        >
          <div className="modal-container" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #fef3c7, #ffffff)' }}>
              <h3>
                <FileText size={20} style={{ color: '#d97706' }} />
                <span style={{ color: '#0f172a' }}>
                  {editingPassage ? 'تعديل النص' : 'إدارة نصوص القراءة (Passages)'}
                </span>
              </h3>
              <button
                className="btn-close"
                onClick={() => {
                  setShowPassageModal(false);
                  setEditingPassage(null);
                  setPassageForm({ title: "", passage_text: "" });
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                  {editingPassage ? <Edit2 size={18} style={{ color: '#d97706' }} /> : <PlusCircle size={18} style={{ color: '#059669' }} />}
                  {editingPassage ? 'تعديل النص' : 'إضافة نص جديد'}
                </h4>
                <form onSubmit={handleAddPassage}>
                  <div className="form-group full-width" style={{ marginBottom: '16px' }}>
                    <label>عنوان النص <span className="required">*</span></label>
                    <input
                      type="text"
                      className="modern-input"
                      required
                      value={passageForm.title}
                      onChange={e => setPassageForm({ ...passageForm, title: e.target.value })}
                      placeholder="Daily Routine"
                      style={{ direction: 'ltr', textAlign: 'left' }}
                    />
                  </div>
                  <div className="form-group full-width" style={{ marginBottom: '16px' }}>
                    <label>نص القطعة <span className="required">*</span></label>
                    <textarea
                      className="modern-input textarea-input"
                      required
                      rows="6"
                      value={passageForm.passage_text}
                      onChange={e => setPassageForm({ ...passageForm, passage_text: e.target.value })}
                      placeholder="Enter the full passage text here..."
                      style={{
                        minHeight: '140px',
                        lineHeight: '1.9',
                        textAlign: 'left',
                        direction: 'ltr',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    {editingPassage ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setEditingPassage(null);
                            setPassageForm({ title: "", passage_text: "" });
                          }}
                        >
                          إلغاء
                        </button>
                        <button type="submit" className="btn-primary" style={{ background: '#d97706' }}>
                          <Save size={18} /> تحديث النص
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setShowPassageModal(false);
                            setPassageForm({ title: "", passage_text: "" });
                          }}
                        >
                          إلغاء
                        </button>
                        <button type="submit" className="btn-primary">
                          <PlusCircle size={18} /> إضافة النص
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: '#d97706' }} />
                  النصوص الحالية
                  <span style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    {passages.length}
                  </span>
                </h4>
                <div className="search-wrapper" style={{ width: '240px' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="ابحث عن نص..."
                    className="search-input"
                    style={{ width: '100%', padding: '8px 35px 8px 12px' }}
                    value={passageSearch}
                    onChange={(e) => setPassageSearch(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passages.length > 0 ? (
                  passages
                    .filter(p => !passageSearch.trim() || p.title.toLowerCase().includes(passageSearch.toLowerCase()))
                    .map(p => (
                      <div
                        key={p.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: '4px' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', direction: 'ltr', textAlign: 'left' }}>
                            {p.passage_text.length > 100 ? p.passage_text.substring(0, 100) + '...' : p.passage_text}
                          </div>
                        </div>
                        <div className="action-buttons" style={{ gap: '4px', marginRight: '12px' }}>
                          <button
                            className="btn-icon edit"
                            onClick={() => {
                              setEditingPassage(p);
                              setPassageForm({ title: p.title, passage_text: p.passage_text });
                            }}
                            title="تعديل"
                            style={{ width: '32px', height: '32px' }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn-icon delete"
                            onClick={() => deletePassage(p.id)}
                            title="حذف"
                            style={{ width: '32px', height: '32px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <FileText size={32} strokeWidth={1} style={{ marginBottom: '12px' }} />
                    <p>لا توجد نصوص قرائية بعد</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ ⭐ Batch Question Edit Modal ============ */}
      {showBatchEditModal && editingBatchQuestion && (
        <div className="modal-backdrop" onClick={closeBatchEditModal}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '750px' }}
          >
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #dbeafe, #ffffff)' }}>
              <h3>
                <Edit2 size={20} style={{ color: '#2563eb' }} />
                <span style={{ color: '#0f172a' }}>تعديل السؤال</span>
              </h3>
              <button className="btn-close" onClick={closeBatchEditModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateBatchQuestion}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '24px' }}>

                {/* رقم الوحدة والفرع */}
                <div className="form-grid" style={{ marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>رقم الوحدة</label>
                    <input
                      type="number"
                      className="modern-input"
                      value={batchFormData.unit_number}
                      onChange={(e) => setBatchFormData({ ...batchFormData, unit_number: e.target.value })}
                      placeholder="مثال: 1"
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label>الفرع الدراسي</label>
                    <select
                      className="modern-input"
                      value={batchFormData.branch}
                      onChange={(e) => setBatchFormData({ ...batchFormData, branch: e.target.value })}
                    >
                      <option value="">مشترك (العلمي والأدبي)</option>
                      <option value="العلمي">العلمي</option>
                      <option value="الأدبي">الأدبي</option>
                    </select>
                  </div>
                </div>

                {/* نص السؤال */}
                <div className="form-group full-width" style={{ marginBottom: '20px' }}>
                  <label>نص السؤال <span className="required">*</span></label>
                  <textarea
                    required
                    className="modern-input textarea-input"
                    value={batchFormData.question_text}
                    onChange={(e) => setBatchFormData({ ...batchFormData, question_text: e.target.value })}
                    placeholder="Write the question here..."
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                </div>

                {/* الخيارات */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', fontSize: '0.95rem', color: '#0f172a' }}>
                    الخيارات <span className="required">*</span>
                  </label>
                  <div className="options-grid">
                    {[0, 1, 2, 3].map(idx => {
                      const optKey = ["A", "B", "C", "D"][idx];
                      const valueKey = ["optionA", "optionB", "optionC", "optionD"][idx];
                      return (
                        <div key={idx} className="form-group">
                          <label className="option-label">الخيار ({optKey})</label>
                          <input
                            required
                            className="modern-input"
                            type="text"
                            value={batchFormData[valueKey]}
                            onChange={(e) => setBatchFormData({ ...batchFormData, [valueKey]: e.target.value })}
                            placeholder="Option content..."
                            style={{ direction: 'ltr', textAlign: 'left' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* الإجابة الصحيحة */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>الإجابة الصحيحة <span className="required">*</span></label>
                  <div className="correct-answer-selector">
                    {[0, 1, 2, 3].map(idx => (
                      <label
                        key={idx}
                        className={`radio-label ${parseInt(batchFormData.correct_option) === idx ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="batch_correct_option"
                          value={idx}
                          checked={parseInt(batchFormData.correct_option) === idx}
                          onChange={(e) => setBatchFormData({ ...batchFormData, correct_option: e.target.value })}
                          className="hidden-radio"
                        />
                        الخيار {["A", "B", "C", "D"][idx]}
                      </label>
                    ))}
                  </div>
                </div>

                {/* الدرجة */}
                <div className="form-group">
                  <label>الدرجة</label>
                  <input
                    type="number"
                    className="modern-input"
                    value={batchFormData.degree}
                    onChange={(e) => setBatchFormData({ ...batchFormData, degree: e.target.value })}
                    min="1"
                    max="100"
                  />
                </div>

              </div>

              <div className="modal-footer" style={{
                padding: '9px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: '#fafafa'
              }}>
                <button type="button" className="btn-secondary" onClick={closeBatchEditModal}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary" disabled={batchSaving}>
                  <Save size={18} />
                  {batchSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ Bulk Modal ============ */}
      {showBulkModal && (
        <div className="modal-backdrop" onClick={handleCancelBulk}>
          <div
            className="modal-container bulk-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '95vw', width: '1200px' }}
          >
            <div className="modal-header">
              <h3>
                <Upload size={20} className="icon-accent" /> رفع مجموعة أسئلة اللغة الإنجليزية
              </h3>
              <button className="btn-close" onClick={handleCancelBulk}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto', padding: '24px' }}>
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                padding: '12px 18px',
                borderRadius: '12px',
                marginBottom: '20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Info size={18} />
                سيتم رفع الأسئلة تلقائياً إلى مادة: <strong>{englishSubject?.name || "اللغة الإنجليزية"}</strong>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ marginBottom: '8px', display: 'block', fontWeight: 600, fontSize: '0.95rem' }}>
                  رفع ملف الأسئلة (Excel أو JSON) <span className="required">*</span>
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', justifyContent: 'center' }}>
                  <label className="btn-secondary" style={{
                    cursor: 'pointer',
                    padding: '10px 18px',
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '10px'
                  }}>
                    <FileSpreadsheet size={18} />
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={(e) => e.target.files[0] && handleBulkFileUpload(e.target.files[0])}
                    />
                    رفع إكسل
                  </label>
                  <label className="btn-secondary" style={{
                    cursor: 'pointer',
                    padding: '10px 18px',
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '10px'
                  }}>
                    <FileJson size={18} />
                    <input
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={(e) => e.target.files[0] && handleBulkJsonUpload(e.target.files[0])}
                    />
                    رفع JSON
                  </label>
                  <label className="btn-secondary" onClick={downloadTemplate} style={{
                    cursor: 'pointer',
                    padding: '10px 18px',
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '10px'
                  }}>
                    <Download size={18} /> تحميل قالب
                  </label>
                </div>
                {bulkFileName && (
                  <p style={{
                    marginTop: '8px',
                    color: 'var(--c-text-muted)',
                    fontSize: '0.85rem',
                    background: '#f1f5f9',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'inline-block'
                  }}>
                    📄 الملف المحدد: <strong>{bulkFileName}</strong>
                  </p>
                )}
              </div>

              {bulkErrors.length > 0 && (
                <div className="error-banner" style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <AlertCircle size={20} />
                  <div style={{ flex: 1 }}>
                    <strong>أخطاء في الملف:</strong>
                    <ul style={{ margin: '8px 0 0 20px', maxHeight: '150px', overflowY: 'auto' }}>
                      {bulkErrors.map((err, i) => <li key={i} style={{ marginBottom: '4px' }}>{err}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {showBulkPreview && bulkPreview.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                      📋 معاينة الأسئلة ({bulkPreview.length} سؤال)
                    </h4>
                  </div>
                  <div className="table-responsive" style={{
                    maxHeight: '50vh',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px'
                  }}>
                    <table className="modern-table bulk-preview-table english-content" style={{
                      minWidth: '900px',
                      fontSize: '0.85rem',
                      marginBottom: '0'
                    }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr>
                          <th style={{ width: '50px', background: '#f8fafc' }}>#</th>
                          <th style={{ minWidth: '250px', background: '#f8fafc' }}>النص</th>
                          <th style={{ minWidth: '250px', background: '#f8fafc' }}>الخيارات</th>
                          <th style={{ width: '90px', background: '#f8fafc' }}>الإجابة</th>
                          <th style={{ width: '80px', background: '#f8fafc' }}>الوحدة</th>
                          <th style={{ width: '90px', background: '#f8fafc' }}>الفرع</th>
                          <th style={{ width: '80px', background: '#f8fafc' }}>الدرجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.map((q, idx) => {
                          const labels = ["A", "B", "C", "D"];
                          const correctLetter = getCorrectOptionLetter(q.correct_option);
                          return (
                            <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ fontWeight: 600, color: '#64748b', textAlign: 'center' }}>{idx + 1}</td>
                              <td className="question-text-cell" style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                direction: 'ltr',
                                whiteSpace: 'normal'
                              }}>
                                {q.question_text}
                              </td>
                              <td className="options-cell" style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                direction: 'ltr',
                                whiteSpace: 'normal'
                              }}>
                                {q.options.map((opt, i) => (
                                  <div key={i} style={{
                                    marginBottom: '6px',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    background: i === q.correct_option ? '#dcfce7' : 'transparent',
                                    color: i === q.correct_option ? '#166534' : '#475569',
                                    fontWeight: i === q.correct_option ? 600 : 400,
                                    border: i === q.correct_option ? '1px solid #bbf7d0' : '1px solid transparent',
                                    textAlign: 'left',
                                    direction: 'ltr'
                                  }}>
                                    {labels[i]}) {opt}
                                  </div>
                                ))}
                              </td>
                              <td style={{ fontWeight: 'bold', color: '#10b981', fontSize: '1rem', textAlign: 'center' }}>
                                {correctLetter}
                              </td>
                              <td style={{ textAlign: 'center', color: q.unit_number ? '#475569' : '#94a3b8' }}>
                                {q.unit_number || '—'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  background: q.branch === 'العلمي' ? '#dbeafe' : q.branch === 'الأدبي' ? '#fee2e2' : '#f1f5f9',
                                  color: q.branch === 'العلمي' ? '#1e40af' : q.branch === 'الأدبي' ? '#991b1b' : '#475569'
                                }}>
                                  {q.branch || 'عام'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600, color: '#6366f1' }}>
                                {q.degree}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{
                padding: '16px 0 0 0',
                marginTop: '24px',
                border: 'none',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button className="btn-secondary" onClick={handleCancelBulk} style={{ padding: '10px 24px' }}>
                  إلغاء
                </button>
                <button
                  className="btn-primary"
                  onClick={handleBulkSubmit}
                  disabled={bulkUploading || bulkPreview.length === 0}
                  style={{ padding: '10px 28px' }}
                >
                  <UploadCloud size={18} />
                  {bulkUploading ? "جاري الرفع..." : `رفع ${bulkPreview.length} سؤال`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ Settings Modal ============ */}
      {showSettingsModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowSettingsModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            padding: '20px'
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              background: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b', fontWeight: 800 }}>
                  إعدادات اختبار اللغة الإنجليزية
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  خصص الوقت وعدد الأسئلة لكل محاولة
                </p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '10px',
                  borderRadius: '12px',
                  display: 'flex'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#334155', fontSize: '1rem', marginBottom: '4px' }}>
                    ⏱️ مدة الاختبار
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    الوقت المتاح لكل طالب (بالدقائق)
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '4px',
                  border: '1px solid #e2e8f0'
                }}>
                  <button
                    onClick={() => setEditDuration(Math.max(1, editDuration - 5))}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      background: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      fontWeight: 700
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 1)}
                    style={{
                      width: '70px',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: '#1e293b',
                      border: 'none',
                      outline: 'none'
                    }}
                    min="1"
                    max="300"
                  />
                  <button
                    onClick={() => setEditDuration(Math.min(300, editDuration + 5))}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      background: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      fontWeight: 700
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#334155', fontSize: '1rem', marginBottom: '4px' }}>
                    📝 عدد الأسئلة
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    عدد الأسئلة المطلوبة لكل محاولة
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '4px',
                  border: '1px solid #e2e8f0'
                }}>
                  <button
                    onClick={() => setEditQuestionsCount(Math.max(1, editQuestionsCount - 5))}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      background: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      fontWeight: 700
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={editQuestionsCount}
                    onChange={(e) => setEditQuestionsCount(parseInt(e.target.value) || 1)}
                    style={{
                      width: '70px',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: '#1e293b',
                      border: 'none',
                      outline: 'none'
                    }}
                    min="1"
                    max="200"
                  />
                  <button
                    onClick={() => setEditQuestionsCount(Math.min(200, editQuestionsCount + 5))}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      background: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      fontWeight: 700
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{
              padding: '24px 32px',
              borderTop: '1px solid #f1f5f9',
              background: '#ffffff',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'transparent',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                style={{
                  padding: '12px 32px',
                  borderRadius: '12px',
                  background: '#3b82f6',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
                }}
              >
                <Save size={18} /> {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* ============ STYLES ============ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');

        :root {
          --c-primary: #3b82f6;
          --c-primary-hover: #2563eb;
          --c-primary-light: #eff6ff;
          --c-secondary: #f1f5f9;
          --c-secondary-hover: #e2e8f0;
          --c-danger: #ef4444;
          --c-danger-light: #fef2f2;
          --c-success: #10b981;
          --c-success-light: #dcfce7;
          --c-accent: #8b5cf6;
          --c-warning: #f59e0b;
          --c-bg: #f4f7fe;
          --c-surface: #ffffff;
          --c-text-main: #0f172a;
          --c-text-body: #334155;
          --c-text-muted: #64748b;
          --c-border: #e2e8f0;
          --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.05);
          --shadow-float: 0 20px 25px -5px rgb(0 0 0 / 0.05);
          --radius-md: 8px;
          --radius-lg: 12px;
          --radius-xl: 16px;
          --radius-2xl: 24px;
        }

        * { box-sizing: border-box; margin: 0; }
        body {
          margin: 0;
          background-color: var(--c-bg);
          font-family: 'Cairo', sans-serif;
          color: var(--c-text-body);
          -webkit-font-smoothing: antialiased;
        }
        .teacher-container { direction: rtl; min-height: 100vh; display: flex; flex-direction: column; }
        .teacher-main { flex: 1; width: 100%; max-width: 1280px; margin: 0 auto; padding: 32px 24px; }
        .page-title {
          font-size: 2.25rem; font-weight: 800; color: var(--c-text-main);
          line-height: 1.2; margin-bottom: 8px; letter-spacing: -0.02em;
        }
        .page-subtitle { font-size: 1.05rem; color: var(--c-text-muted); font-weight: 500; }
        .section-title {
          display: flex; align-items: center; gap: 8px; font-size: 1.15rem;
          color: var(--c-text-main); margin-bottom: 20px; font-weight: 700;
          border-bottom: 2px solid var(--c-secondary); padding-bottom: 12px;
        }
        .icon-accent { color: var(--c-primary); }
        .text-muted { color: var(--c-text-muted); }
        .page-header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 40px;
        }
        .header-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .stats-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px; margin-bottom: 40px;
        }
        .stat-card {
          background: var(--c-surface); border-radius: var(--radius-xl); padding: 24px;
          display: flex; align-items: center; gap: 20px; box-shadow: var(--shadow-sm);
          border: 1px solid var(--c-border); transition: all 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .stat-icon-wrapper {
          width: 56px; height: 56px; border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
        }
        .stat-icon-wrapper.blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
        .stat-icon-wrapper.purple { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
        .stat-icon-wrapper.green { background: linear-gradient(135deg, #34d399, #059669); }
        .stat-label {
          font-size: 0.95rem; font-weight: 600; color: var(--c-text-muted);
          display: block; margin-bottom: 4px;
        }
        .stat-number { font-size: 2.25rem; font-weight: 800; color: var(--c-text-main); line-height: 1; }
        .form-card, .table-card {
          background: var(--c-surface); border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-md); margin-bottom: 40px; overflow: hidden;
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        .card-header {
          padding: 24px 32px; border-bottom: 1px solid var(--c-border);
          display: flex; justify-content: space-between; align-items: center;
          background: #fafafa; flex-wrap: wrap; gap: 12px;
        }
        .card-title {
          margin: 0; font-size: 1.25rem; color: var(--c-text-main);
          display: flex; align-items: center; gap: 12px; font-weight: 700;
        }
        .question-form { padding: 0; }
        .form-section { padding: 32px; }
        .form-section.alt-bg { background-color: #f8fafc; border-top: 1px solid var(--c-border); }
        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .options-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .full-width { grid-column: 1 / -1; }
        .form-group label {
          display: block; font-weight: 600; color: var(--c-text-main);
          margin-bottom: 8px; font-size: 0.95rem;
        }
        .sub-label {
          font-size: 0.85rem !important;
          color: var(--c-text-muted) !important;
          font-weight: 500 !important;
        }
        .hint-text { font-weight: normal; color: var(--c-text-muted); font-size: 0.85em; }
        .required { color: var(--c-danger); }
        .modern-input {
          width: 100%; padding: 14px 16px; border: 1px solid var(--c-border);
          border-radius: var(--radius-lg); font-family: 'Cairo', sans-serif;
          font-size: 1rem; color: var(--c-text-main); background: var(--c-surface);
          transition: all 0.2s ease;
        }
        .modern-input:focus {
          outline: none; border-color: var(--c-primary);
          box-shadow: 0 0 0 4px var(--c-primary-light);
        }
        .modern-input:disabled {
          background: #f1f5f9; cursor: not-allowed;
        }
        .textarea-input { min-height: 120px; resize: vertical; line-height: 1.6; }
        .upload-label-large {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 40px 20px; background: #f8fafc;
          border: 2px dashed #cbd5e1; border-radius: var(--radius-lg);
          cursor: pointer; transition: all 0.2s ease; gap: 12px;
        }
        .upload-label-large:hover {
          background: var(--c-primary-light);
          border-color: var(--c-primary);
        }
        .upload-icon { color: #94a3b8; }
        .upload-text { font-weight: 700; color: var(--c-text-main); font-size: 1.1rem; }
        .upload-hint { font-size: 0.9rem; color: var(--c-text-muted); }
        .upload-btn-outline {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--c-surface); border: 1px dashed #cbd5e1;
          color: var(--c-text-muted); padding: 8px 16px;
          border-radius: var(--radius-md); cursor: pointer;
          font-size: 0.9rem; font-weight: 600;
        }
        .image-preview {
          position: relative; display: inline-block;
          border-radius: var(--radius-md); overflow: hidden;
          border: 1px solid var(--c-border); background: #f1f5f9;
        }
        .image-preview img { display: block; max-width: 100%; height: auto; object-fit: contain; }
        .large-preview img { max-height: 200px; width: auto; }
        .remove-img-btn {
          position: absolute; top: 8px; right: 8px;
          background: var(--c-danger); color: white; border: none;
          border-radius: 50%; width: 28px; height: 28px;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center;
        }
        .correct-answer-selector { display: flex; gap: 16px; flex-wrap: wrap; }
        .radio-label {
          flex: 1; min-width: 120px; text-align: center;
          padding: 14px 16px; border: 2px solid var(--c-border);
          border-radius: var(--radius-lg); cursor: pointer;
          font-weight: 700; color: var(--c-text-muted);
          transition: all 0.2s ease; background: var(--c-surface);
        }
        .radio-label:hover { border-color: #cbd5e1; background: #f8fafc; }
        .radio-label.selected {
          border-color: var(--c-success);
          background: var(--c-success-light);
          color: #16a34a;
        }
        .hidden-radio, .hidden-input { display: none; }
        .btn-primary, .btn-secondary {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; padding: 12px 24px; border-radius: var(--radius-lg);
          font-family: 'Cairo', sans-serif; font-weight: 700;
          font-size: 1rem; cursor: pointer; border: none;
          transition: all 0.2s ease;
        }
        .btn-primary {
          background: var(--c-primary); color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--c-primary-hover); transform: translateY(-2px);
        }
        .btn-primary:disabled {
          background: #94a3b8; cursor: not-allowed; opacity: 0.7;
        }
        .btn-secondary {
          background: var(--c-surface); color: var(--c-text-body);
          border: 1px solid var(--c-border);
        }
        .btn-secondary:hover { background: var(--c-secondary); }
        .btn-text {
          background: none; border: none; color: var(--c-text-muted);
          display: inline-flex; align-items: center; gap: 6px;
          cursor: pointer; font-family: 'Cairo'; font-weight: 600;
          font-size: 0.95rem; padding: 8px 12px; border-radius: var(--radius-md);
        }
        .btn-text:hover { color: var(--c-danger); background: var(--c-danger-light); }
        .form-actions {
          display: flex; padding: 24px 32px;
          background: var(--c-surface); border-top: 1px solid var(--c-border);
        }
        .large-btn {
          padding: 16px 32px; font-size: 1.1rem;
          width: 100%; max-width: 300px; margin: 0 auto;
        }
        .table-responsive { width: 100%; overflow-x: auto; }
        .modern-table {
          width: 100%; border-collapse: separate;
          border-spacing: 0; min-width: 800px; text-align: right;
        }
        .modern-table th {
          background: #f8fafc; padding: 16px 24px;
          color: var(--c-text-muted); font-weight: 700;
          font-size: 0.9rem; border-bottom: 2px solid var(--c-border);
          text-align: center;
        }
        .modern-table td {
          padding: 16px 24px; border-bottom: 1px solid var(--c-secondary);
          color: var(--c-text-body); vertical-align: middle;
          font-size: 0.95rem; text-align: center;
        }
        .modern-table tbody tr:hover td { background: #f8fafc; }
        .inactive-row { opacity: 0.6; filter: grayscale(1); }
        .q-text-cell {
          max-width: 300px; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; font-weight: 600; color: var(--c-text-main);
        }
        .text-center { text-align: center !important; }
        .font-bold { font-weight: 700; }
        .badge {
          padding: 6px 12px; border-radius: 20px;
          font-size: 0.85rem; font-weight: 700; display: inline-block;
        }
        .bg-slate { background: var(--c-secondary); color: var(--c-text-body); }
        .bg-light {
          background: #f8fafc; border: 1px solid var(--c-border);
          color: var(--c-text-muted);
        }
        .active-badge {
          background: var(--c-success-light); color: #16a34a;
          border: 1px solid #bbf7d0;
        }
        .inactive-badge {
          background: var(--c-danger-light); color: #991b1b;
          border: 1px solid #fecaca;
        }
        .correct-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--c-success-light); color: #16a34a;
          width: 32px; height: 32px; border-radius: 10px;
          font-weight: 800; font-size: 1rem;
        }
        .media-badges { display: flex; gap: 8px; justify-content: center; }
        .media-badge {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px;
        }
        .media-badge.blue { background: var(--c-primary-light); color: var(--c-primary); }
        .media-badge.purple { background: #f3e8ff; color: var(--c-accent); }
        .action-buttons { display: flex; gap: 8px; justify-content: center; }
        .btn-icon {
          width: 36px; height: 36px; border-radius: 10px;
          border: none; display: inline-flex; align-items: center;
          justify-content: center; cursor: pointer; background: transparent;
        }
        .btn-icon.edit { color: var(--c-primary); }
        .btn-icon.edit:hover { background: var(--c-primary-light); }
        .btn-icon.delete { color: var(--c-danger); }
        .btn-icon.delete:hover { background: var(--c-danger-light); }
        .card-header-actions {
          display: flex; align-items: center;
          gap: 20px; flex-wrap: wrap;
        }
        .badge-count {
          background: var(--c-primary-light); color: var(--c-primary);
          padding: 6px 16px; border-radius: 20px;
          font-size: 0.9rem; font-weight: 700;
        }
        .search-wrapper { position: relative; }
        .search-icon {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%); color: #94a3b8;
        }
        .search-input {
          padding: 10px 40px 10px 16px; border: 1px solid var(--c-border);
          border-radius: 30px; font-family: 'Cairo';
          font-size: 0.95rem; background: #f8fafc;
          width: 260px;
        }
        .search-input:focus {
          outline: none; border-color: var(--c-primary);
          background: var(--c-surface);
        }
        .empty-state {
          padding: 80px 20px; text-align: center;
          color: var(--c-text-muted);
        }
        .empty-illustration {
          display: inline-flex; align-items: center; justify-content: center;
          width: 100px; height: 100px; border-radius: 50%;
          background: var(--c-secondary); color: #cbd5e1; margin-bottom: 24px;
        }
        .empty-state h3 {
          color: var(--c-text-main); margin: 0 0 12px 0;
          font-size: 1.25rem; font-weight: 700;
        }
        .loading-spinner {
          width: 40px; height: 40px;
          border: 4px solid var(--c-secondary);
          border-top-color: var(--c-primary);
          border-radius: 50%; animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-banner {
          background: var(--c-danger-light); border: 1px solid #fecaca;
          color: #dc2626; padding: 16px 24px; border-radius: var(--radius-lg);
          margin-bottom: 30px; display: flex; align-items: flex-start;
          gap: 12px; font-weight: 600;
        }
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px); display: flex;
          align-items: center; justify-content: center;
          z-index: 9999; padding: 20px;
        }
        .modal-container {
          background: var(--c-surface); border-radius: var(--radius-2xl);
          width: 100%; max-width: 700px; max-height: 95vh;
          display: flex; flex-direction: column;
          box-shadow: var(--shadow-float); overflow: hidden;
        }
        .bulk-modal { max-width: 1200px; }
        .modal-header {
          display: flex; justify-content: space-between;
          align-items: center; padding: 24px 32px;
          border-bottom: 1px solid var(--c-border); background: #fafafa;
        }
        .modal-header h3 {
          display: flex; align-items: center; gap: 10px;
          margin: 0; font-size: 1.25rem; font-weight: 700;
          color: var(--c-text-main);
        }
        .btn-close {
          background: var(--c-secondary); border: none;
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--c-text-muted);
        }
        .btn-close:hover { background: var(--c-danger-light); color: var(--c-danger); }
        .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .bulk-preview-table.english-content td.question-text-cell,
        .bulk-preview-table.english-content td.options-cell {
          text-align: left !important;
          direction: ltr !important;
        }
        .bulk-preview-table.english-content td.options-cell > div {
          text-align: left !important;
          direction: ltr !important;
        }
        @media (max-width: 1024px) {
          .form-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .teacher-main { padding: 20px 16px; }
          .page-header {
            flex-direction: column; align-items: flex-start; gap: 20px;
          }
          .header-actions {
            width: 100%; display: grid;
            grid-template-columns: repeat(3, 1fr); gap: 10px;
          }
          .header-actions button {
            width: 100%; justify-content: center;
            font-size: 0.85rem; padding: 10px;
          }
          .card-header {
            flex-direction: column; align-items: flex-start;
            gap: 16px; padding: 20px;
          }
          .card-header-actions {
            width: 100%; flex-direction: column;
            align-items: stretch; gap: 12px;
          }
          .search-input { width: 100%; }
          .options-grid { grid-template-columns: 1fr; }
          .correct-answer-selector { flex-direction: column; gap: 10px; }
          .form-section { padding: 20px; }
        }
      `}</style>
    </div>
  );
}
