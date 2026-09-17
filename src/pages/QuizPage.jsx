import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import Footer from "./Footer";
import ConfirmDialog from "./ConfirmDialog";

// --- مكون شاشة التحميل ---
const LoadingScreen = () => (
  <div className="loading-overlay">
    <div className="loading-content">
      <div className="status-section">
        <h2 className="loading-title">يرجى الانتظار</h2>
        <div className="loading-bar-container">
          <div className="loading-bar-shimmer"></div>
        </div>
        <p className="loading-text">جاري تحضير محاولة الاختبار...</p>
      </div>
    </div>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      .loading-overlay{position:fixed;inset:0;background:#f8fafc;display:flex;align-items:center;justify-content:center;z-index:9999;direction:rtl;font-family:'Cairo',sans-serif;overflow:hidden}
      .loading-overlay::before{content:'';position:absolute;width:150%;height:150%;background:radial-gradient(circle at center,rgba(59,130,246,0.05) 0%,transparent 70%);animation:rotateBg 10s linear infinite}
      @keyframes rotateBg{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      .loading-content{position:relative;text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px}
      .loading-title{color:#1e293b;font-size:1.8rem;font-weight:700;margin-bottom:15px}
      .loading-text{color:#64748b;font-size:1rem;margin-top:15px;animation:fadeInOut 2s infinite}
      .loading-bar-container{width:260px;height:6px;background:#e2e8f0;border-radius:10px;position:relative;overflow:hidden;margin:0 auto}
      .loading-bar-shimmer{position:absolute;top:0;left:0;height:100%;width:40%;background:linear-gradient(90deg,transparent,#3b82f6,transparent);animation:shimmer 1.5s infinite ease-in-out}
      @keyframes shimmer{0%{left:-50%}100%{left:150%}}
      @keyframes fadeInOut{0%,100%{opacity:0.7}50%{opacity:1}}
      @media (max-width:480px){.loading-title{font-size:1.5rem}.loading-bar-container{width:200px}}
    `}</style>
  </div>
);

// --- دالة مساعدة لعرض الدرجة بالعربية ---
const formatDegree = (degree, isEnglish = false) => {
  if (!degree || degree === 0) return "";
  if (isEnglish) {
    return degree === 1 ? "1 Point" : `${degree} Points`;
  }
  if (degree === 1) return "درجة واحدة";
  if (degree === 2) return "درجتان";
  if (degree === 2.5) return "درجتان ونصف";
  if (degree >= 3 && degree <= 10) return `${degree} درجات`;
  return `${degree} درجة`;
};

export default function QuizPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subjectName, setSubjectName] = useState("");

  const [blocks, setBlocks] = useState([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState(false); // حالة مضافة لتتبع انقطاع الشبكة وثبات الإرسال التلقائي
  const [isEnglishSubject, setIsEnglishSubject] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    cancelText: "",
    resolve: null,
  });

  const hasAutoSubmitted = useRef(false);
  const timerRef = useRef(null);
  const blocksRef = useRef([]);
  const selectedAnswersRef = useRef({});
  const numericSubjectIdRef = useRef(parseInt(subjectId, 10));

  const dotsContainerRef = useRef(null);

  useEffect(() => {
    blocksRef.current = blocks;
    selectedAnswersRef.current = selectedAnswers;
  }, [blocks, selectedAnswers]);

  useEffect(() => {
    if (subjectName) {
      document.title = `${subjectName} - أ. محمد أبو سليمان`;
    } else {
      document.title = "جاري تحضير الاختبار..";
    }
  }, [subjectName]);

  const numericSubjectId = parseInt(subjectId, 10);

  // --- دوال المؤقت ---
  const getTimerStorageKey = useCallback(() => {
    if (!studentId || !attemptId) return null;
    return `quiz_timer_${studentId}_${numericSubjectId}_${attemptId}`;
  }, [studentId, numericSubjectId, attemptId]);

  const saveTimerState = useCallback(
    (currentTimeLeft) => {
      const key = getTimerStorageKey();
      if (!key) return;
      const data = { timeLeft: currentTimeLeft, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(data));
    },
    [getTimerStorageKey],
  );

  const clearTimerState = useCallback(() => {
    const key = getTimerStorageKey();
    if (key) localStorage.removeItem(key);
  }, [getTimerStorageKey]);

  // --- دوال مساعدة لإدارة إجابات الذاكرة المحلية ---
  const getAnswersStorageKey = useCallback(() => {
    if (!studentId || !attemptId) return null;
    return `quiz_answers_${studentId}_${numericSubjectId}_${attemptId}`;
  }, [studentId, numericSubjectId, attemptId]);

  const clearAnswersState = useCallback(() => {
    const key = getAnswersStorageKey();
    if (key) localStorage.removeItem(key);
  }, [getAnswersStorageKey]);

  // --- مودال التأكيد ---
  const showConfirm = (options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || "تأكيد العملية",
        message: options.message,
        confirmText: options.confirmText || "تأكيد",
        cancelText: options.cancelText || "إلغاء",
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  // --- تسليم الاختبار المعدل بالكامل ليدعم العمل دون إنترنت وسيرفر آمن ---
  const performSubmit = useCallback(
    async (isAuto = false) => {
      if (hasAutoSubmitted.current || submitting) return false;

      // 1. فحص الاتصال بالإنترنت أولاً وقبل أي إجراء
      if (!navigator.onLine) {
toast.error(
  <>
    انقطع الاتصال بالإنترنت!
    <br />
    يرجى التأكد من الشبكة.
  </>
);
}

      hasAutoSubmitted.current = true;
      setSubmitting(true);

      // إيقاف المؤقت بصرياً فقط لكي لا يستمر في العد، لكن لا نمسح الذاكرة المحلية بعد
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      try {
        // التعامل مع خطأ الشبكة المحتمل من Supabase بشكل صريح
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          // إذا كان الخطأ بسبب الشبكة، نلقي خطأ ليتم اصطياده في catch
          if (authError?.message?.includes("fetch") || !navigator.onLine) {
            throw new Error("مشكلة في الاتصال بالشبكة.");
          }
          // إذا لم يكن هناك مستخدم فعلاً (الجلسة منتهية)
          navigate("/login");
          return false;
        }

        let studentName = "طالب";
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.name) studentName = profile.name;
        } catch (err) {
          console.warn("تعذر جلب اسم الطالب:", err);
        }

        const currentBlocks = blocksRef.current;
        const currentAnswers = selectedAnswersRef.current;

        let allQuestions = [];
        currentBlocks.forEach((block) => {
          if (block.type === "passage") allQuestions.push(...block.questions);
          else allQuestions.push(block.question);
        });

        let finalScore = 0;
        let totalPossible = 0;
        allQuestions.forEach((q) => {
          const questionDegree = q.degree || 1;
          totalPossible += questionDegree;
          const userAns = currentAnswers[q.id];
          if (
            userAns !== undefined &&
            parseInt(userAns) === parseInt(q.correct_option)
          )
            finalScore += questionDegree;
        });

        const { data: activeAttempt } = await supabase
          .from("attempts")
          .select("id")
          .eq("student_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (!activeAttempt) throw new Error("لا توجد محاولة نشطة لهذا الطالب");

        const { error: resultError } = await supabase.from("results").insert([
          {
            attempt_id: activeAttempt.id,
            student_id: user.id,
            subject_id: numericSubjectIdRef.current,
            student_answers: currentAnswers,
            score: finalScore,
          },
        ]);
        if (resultError) throw resultError;

        const { data: allQuestionsInAttempt } = await supabase
          .from("attempt_questions")
          .select("subject_id")
          .eq("attempt_id", activeAttempt.id);

        const requiredSubjectIds = [
          ...new Set(allQuestionsInAttempt.map((q) => q.subject_id)),
        ];

        const { data: finishedResults } = await supabase
          .from("results")
          .select("subject_id")
          .eq("attempt_id", activeAttempt.id);

        const finishedSubjectIds = finishedResults.map((r) => r.subject_id);
        const isLastSubject = requiredSubjectIds.every((id) =>
          finishedSubjectIds.includes(id),
        );

        if (isLastSubject) {
          await supabase
            .from("attempts")
            .update({ status: "completed" })
            .eq("id", activeAttempt.id);
        }

        // 2. 🟢 هنا فقط وفقط بعد نجاح كل شيء، نقوم بمسح البيانات من الذاكرة المحلية
        clearTimerState();
        clearAnswersState();

        navigate("/result", {
          state: {
            score: finalScore,
            totalPossible: totalPossible,
            total_questions: allQuestions.length,
            questions: allQuestions,
            selectedAnswers: currentAnswers,
            studentName,
            subjectName,
          },
          replace: true,
        });
        return true;
      } catch (err) {
        console.error("Submit error:", err);
        // إعادة تهيئة المتغيرات ليتمكن الطالب من المحاولة مجدداً عند عودة الإنترنت
        hasAutoSubmitted.current = false;
        setSubmitting(false);

        // إعادة تشغيل المؤقت إذا لم يكن الاختبار قد انتهى وقته
        if (timeLeft > 1 && !isReviewMode) {
          timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                clearInterval(timerRef.current);
                if (!hasAutoSubmitted.current && !submitting)
                  handleAutoSubmit();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }

        toast.error(
  err.message.includes("الشبكة") || err.message.includes("fetch") ? (
    <>
تم حفظ إجاباتك.
      <br />
يرجى محاولة التسليم لاحقاً بعد عودة الاتصال.
    </>
  ) : (
    <>
      حدث خطأ أثناء تسليم الاختبار:
      <br />
      {err.message}
    </>
  )
);
        return false;
      }
    },
    [
      navigate,
      submitting,
      clearTimerState,
      clearAnswersState,
      timeLeft,
      isReviewMode,
    ],
  );

  const handleAutoSubmit = useCallback(() => {
    if (hasAutoSubmitted.current || submitting) return;
    performSubmit(true);
  }, [performSubmit, submitting]);

  // --- بدء المؤقت وإدارة الصفر الفوري ---
  useEffect(() => {
    if (
      !loading &&
      blocks.length > 0 &&
      timeLeft !== null &&
      !hasAutoSubmitted.current &&
      !isReviewMode
    ) {
      if (timeLeft === 0) {
        handleAutoSubmit();
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            if (!hasAutoSubmitted.current && !submitting) handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, blocks, timeLeft, handleAutoSubmit, submitting, isReviewMode]);

  // --- مستمع ذكي مضاف لاستشعار عودة الإنترنت وإتمام التسليم المقطوع تلقائياً ---
  useEffect(() => {
    const handleOnlineRestored = () => {
      if (offlineError) {
        toast.success(
          isEnglishSubject
            ? "Internet connection restored! Automatically submitting your exam now..."
            : "تم استعادة الاتصال بالإنترنت! جاري تسليم الاختبار وحفظ درجتك بالكامل الآن...",
        );
        performSubmit(timeLeft === 0 || hasAutoSubmitted.current);
      }
    };

    window.addEventListener("online", handleOnlineRestored);
    return () => window.removeEventListener("online", handleOnlineRestored);
  }, [offlineError, timeLeft, performSubmit, isEnglishSubject]);

  // --- إلغاء المؤقت ومسح التخزين في المراجعة ---
  useEffect(() => {
    if (isReviewMode) {
      clearTimerState();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isReviewMode, clearTimerState]);

  // --- حفظ المؤقت تلقائياً ---
  useEffect(() => {
    if (
      timeLeft !== null &&
      !loading &&
      studentId &&
      attemptId &&
      !isReviewMode
    ) {
      saveTimerState(timeLeft);
    }
  }, [timeLeft, loading, studentId, attemptId, saveTimerState, isReviewMode]);

  // --- خطاف الحفظ التلقائي الفوري للإجابات ---
  useEffect(() => {
    if (
      !loading &&
      studentId &&
      attemptId &&
      !isReviewMode &&
      Object.keys(selectedAnswers).length > 0
    ) {
      const key = getAnswersStorageKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(selectedAnswers));
      }
    }
  }, [
    selectedAnswers,
    loading,
    studentId,
    attemptId,
    isReviewMode,
    getAnswersStorageKey,
  ]);

  // --- جلب بيانات الاختبار واستعادة الحالة ---
  const fetchQuizData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const currentStudentId = user.id;
      setStudentId(currentStudentId);

      // 1. جلب أحدث محاولة للطالب
      const { data: attemptData } = await supabase
        .from("attempts")
        .select("*")
        .eq("student_id", currentStudentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

if (!attemptData) {
  setError("no_active_attempt");
  return;
}
setAttemptId(attemptData.id);

if (attemptData.status === "active" && !attemptData.started_at) {
  try {
    await supabase
      .from("attempts")
      .update({ started_at: new Date().toISOString() })
      .eq("id", attemptData.id);
  } catch (err) {
    console.warn("تعذر تسجيل وقت البدء:", err);
  }
}

      // 2. التحقق من وجود نتيجة سابقة لهذه المادة
      const { data: existingResult } = await supabase
        .from("results")
        .select("*")
        .eq("attempt_id", attemptData.id)
        .eq("subject_id", numericSubjectId)
        .maybeSingle();

      if (existingResult) {
        setIsReviewMode(true);
        setSelectedAnswers(existingResult.student_answers || {});
      } else if (attemptData.status === "completed") {
        setError("attempt_closed");
        return;
      } else {
        // استعادة الإجابات المحفوظة محلياً إن وجدت للمحاولة الحالية الحية
        const answersKey = `quiz_answers_${currentStudentId}_${numericSubjectId}_${attemptData.id}`;
        const savedAnswers = localStorage.getItem(answersKey);
        if (savedAnswers) {
          try {
            setSelectedAnswers(JSON.parse(savedAnswers));
          } catch (e) {
            console.error("Error parsing saved answers:", e);
          }
        }
      }

      // 3. جلب معرفات الأسئلة من attempt_questions
      const { data: aqData } = await supabase
        .from("attempt_questions")
        .select("question_id")
        .eq("attempt_id", attemptData.id)
        .eq("subject_id", numericSubjectId);

      if (!aqData || aqData.length === 0) {
        setError("no_questions");
        return;
      }

      const questionIds = aqData.map((item) => item.question_id);

      // 4. جلب تفاصيل الأسئلة
      const { data: questionsData } = await supabase
        .from("questions")
        .select(
          "*, image_option_a, image_option_b, image_option_c, image_option_d",
        )
        .in("id", questionIds)
        .order("created_at", { ascending: true });

      if (!questionsData) {
        setError("no_questions");
        return;
      }

      // 5. جلب تفاصيل المادة
      const { data: subjectInfo } = await supabase
        .from("subjects")
        .select("name, duration_minutes")
        .eq("id", numericSubjectId)
        .single();

      const isEnglish = subjectInfo?.name?.includes("إنجليزية") || false;
      setIsEnglishSubject(isEnglish);
      setSubjectName(subjectInfo?.name || "اختبار");

      // 6. إعداد المؤقت (فقط لو لم نكن في المراجعة)
      if (!existingResult) {
        const durationMinutes = subjectInfo?.duration_minutes || 60;
        const defaultTime = durationMinutes * 60;

        const storageKey = `quiz_timer_${currentStudentId}_${numericSubjectId}_${attemptData.id}`;
        const saved = localStorage.getItem(storageKey);
        let savedTime = null;
        if (saved) {
          try {
            const { timeLeft: savedTimeLeft, timestamp } = JSON.parse(saved);
            const elapsed = Math.floor((Date.now() - timestamp) / 1000);
            savedTime = Math.max(0, savedTimeLeft - elapsed);
          } catch (e) {}
        }
        const initialTime =
          savedTime !== null && savedTime < defaultTime
            ? savedTime
            : defaultTime;
        setTimeLeft(initialTime);
      } else {
        setTimeLeft(null);
      }

      // 7. بناء الكتل (blocks)
      let finalBlocks = [];
      if (isEnglish) {
        const passageIds = [
          ...new Set(questionsData.map((q) => q.passage_id).filter((id) => id)),
        ];
        let passages = [];
        if (passageIds.length) {
          const { data: pData } = await supabase
            .from("passages")
            .select("*")
            .in("id", passageIds);
          passages = pData || [];
        }
        const passageQuestionsMap = new Map();
        const standalone = [];
        questionsData.forEach((q) => {
          if (q.passage_id) {
            if (!passageQuestionsMap.has(q.passage_id))
              passageQuestionsMap.set(q.passage_id, []);
            passageQuestionsMap.get(q.passage_id).push(q);
          } else standalone.push(q);
        });
        const sortedPassages = passages.sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at),
        );
        for (const passage of sortedPassages) {
          const questionsOfPassage = passageQuestionsMap.get(passage.id) || [];
          questionsOfPassage.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          );
          finalBlocks.push({
            type: "passage",
            passage,
            questions: questionsOfPassage,
          });
        }
        standalone.forEach((q) =>
          finalBlocks.push({ type: "single", question: q }),
        );
      } else {
        finalBlocks = questionsData.map((q) => ({
          type: "single",
          question: q,
        }));
      }

      setBlocks(finalBlocks);
      setCurrentBlockIndex(0);
      hasAutoSubmitted.current = false;
    } catch (err) {
      console.error(err);
      setError("error");
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  }, [navigate, numericSubjectId]);

  useEffect(() => {
    fetchQuizData();
    numericSubjectIdRef.current = numericSubjectId;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [subjectId, fetchQuizData, numericSubjectId]);

  // تمرير الأرقام تلقائياً لتكون في المنتصف
  useEffect(() => {
    if (dotsContainerRef.current) {
      const activeDot = dotsContainerRef.current.querySelector(".dot.active");
      if (activeDot) {
        activeDot.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [currentBlockIndex]);

  const handleSubmitQuiz = async () => {
    if (hasAutoSubmitted.current || submitting) return;
    const totalQuestions = blocks.reduce(
      (acc, block) =>
        acc + (block.type === "passage" ? block.questions.length : 1),
      0,
    );
    const answeredCount = Object.keys(selectedAnswers).length;
    const unanswered = totalQuestions - answeredCount;
    let msg = "هل أنت متأكد من إنهاء وتسليم الاختبار؟";
    if (unanswered > 0) msg = `لديك ${unanswered} سؤال بدون إجابة.\n\n${msg}`;

    const confirmed = await showConfirm({
      title: "تسليم الاختبار",
      message: msg,
      confirmText: "تسليم",
      cancelText: "مراجعة",
    });
    if (!confirmed) return;
    performSubmit(false);
  };

  const formatTime = (s) =>
    s === null
      ? "--:--"
      : `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleAnswerSelect = (qId, idx) => {
    if (isReviewMode) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: idx }));
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div
        className="quiz-page-wrapper"
        style={{ direction: isEnglishSubject ? "ltr" : "rtl" }}
      >
        <header className="quiz-header">
          <div className="timer-pill">
            <span>⏱️</span>
            <span>00:00</span>
          </div>
          <div className="center-brand">
            <img
              src="https://i.imgur.com/U5iofms.png"
              alt="Logo"
              className="quiz-logo"
            />
          </div>
        </header>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: "0%" }}></div>
        </div>
        <main className="quiz-main-content">
          <div className="empty-state-card">
            <div className="empty-state-icon"></div>
            <h2 className="empty-state-title">
              {error === "no_questions"
                ? isEnglishSubject
                  ? "No Questions"
                  : "لا توجد أسئلة"
                : isEnglishSubject
                  ? "No Active Attempt"
                  : "لا توجد محاولة نشطة"}
            </h2>
            <p className="empty-state-description">
              {error === "no_questions"
                ? isEnglishSubject
                  ? "Sorry, no questions were found for this subject."
                  : "عذراً، لم يتم العثور على أسئلة لهذه المادة حالياً."
                : isEnglishSubject
                  ? "Please contact the administration to activate a new attempt."
                  : " يرجى مراجعة الإدارة لتفعيل محاولة جديدة"}
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="back-to-dashboard-btn"
            >
              {isEnglishSubject
                ? "Back to Subjects"
                : "العودة إلى المواد الدراسية"}
            </button>
          </div>
        </main>
        <Footer />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; }
          body { margin: 0; background-color: #f4f7fb; font-family: 'Cairo', sans-serif; direction: rtl; }
          .quiz-page-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: #f4f7fb; }
          .quiz-header { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); padding: 16px 40px; -webkit-backdrop-filter: blur(20px); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid rgba(255, 255, 255, 0.5); border-radius: 0 0 32px 32px; box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6); }
          .timer-pill { background: white; border: 1px solid #e2e8f0; padding: 8px 20px; border-radius: 50px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; font-size: 1.1rem; }
          .center-brand { display: flex; align-items: center; gap: 12px; }
          .quiz-logo { height: 65px; width: auto; }
          .quiz-brand-name { font-weight: 800; color: #1e3a8a; font-size: 1.15rem; }
          .submit-quiz-btn { background: #3b82f6; color: white; border: none; padding: 10px 28px; border-radius: 14px; font-weight: 700; cursor: pointer; font-family: 'Cairo'; }
          .progress-container { height: 6px; background: #e2e8f0; width: 100%; }
          .progress-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); transition: width 0.5s cubic-bezier(0.4,0,0.2,1); }
          .quiz-main-content { flex: 1; padding: 50px 20px; max-width: 900px; margin: 0 auto; width: 100%; display: flex; align-items: center; justify-content: center; }
          .empty-state-title { font-size: 26px; font-weight: 800; color: #1e293b; margin-bottom: 12px; }
          .empty-state-description { font-size: 16px; color: #64748b; line-height: 1.6; margin-bottom: 32px; }
          .back-to-dashboard-btn { background: #3b82f6; color: white; border: none; padding: 14px 32px; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(59,130,246,0.2); }
          .back-to-dashboard-btn:hover { background: #2563eb; transform: translateY(-2px); }
          @media (max-width:768px){.quiz-header{padding:12px 20px}.quiz-brand-name{display:none}.empty-state-card{padding:40px 24px}}
        `}</style>
      </div>
    );
  }

  const currentBlock = blocks[currentBlockIndex];
  if (!currentBlock) return null;

  const totalBlocks = blocks.length;
  const passagesCount = blocks.filter((b) => b.type === "passage").length;

  const totalQuestionsCount = blocks.reduce(
    (acc, b) => acc + (b.type === "passage" ? b.questions.length : 1),
    0,
  );

  const displayTotal = totalBlocks;
  const displayCurrent = currentBlockIndex + 1;

  const answeredCount = Object.keys(selectedAnswers).length;
  const progress =
    totalQuestionsCount > 0 ? (answeredCount / totalQuestionsCount) * 100 : 0;
  const optionLabels = isEnglishSubject
    ? ["A", "B", "C", "D"]
    : ["أ", "ب", "ج", "د"];

  const currentQuestion =
    currentBlock.type === "passage"
      ? currentBlock.questions[0]
      : currentBlock.question;

  const questionLabel = isEnglishSubject ? "Question" : "السؤال";
  const ofLabel = isEnglishSubject ? "of" : "من";
  const passageLabel = isEnglishSubject ? "Passage" : "القطعة";
  const prevLabel = "السابق";
  const nextLabel = "التالي";
  const submitLabel = submitting ? "...جاري التسليم" : "إنهاء الاختبار";

  const currentDegree =
    currentBlock.type === "passage"
      ? currentBlock.questions.reduce((sum, q) => sum + (q.degree || 1), 0)
      : currentQuestion?.degree || 1;

  return (
    <div
      className="quiz-page-wrapper"
      style={{ direction: isEnglishSubject ? "ltr" : "rtl" }}
    >
      <header className="quiz-header">
        <div className="timer-pill">
          <span>⏱️</span>
          <span
            className={
              timeLeft < 60
                ? "time-critical"
                : timeLeft < 300
                  ? "time-warning"
                  : ""
            }
          >
            {isReviewMode ? "--:--" : formatTime(timeLeft)}
          </span>
        </div>
        <div className="center-brand">
          <img
            src="https://i.imgur.com/U5iofms.png"
            alt="Logo"
            className="quiz-logo"
          />
        </div>
        {!isReviewMode ? (
          <button
            onClick={handleSubmitQuiz}
            disabled={
              submitting || (timeLeft === 0 && hasAutoSubmitted.current)
            }
            className="submit-quiz-btn"
          >
            {submitLabel}
          </button>
        ) : (
          <button
            onClick={() => navigate("/dashboard")}
            className="submit-quiz-btn"
            style={{ background: "#3b82f6" }}
          >
            العودة للرئيسية
          </button>
        )}
      </header>

      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>

      <main className="quiz-main-content">
        {/* لافتة التحذير العائمة عند انقطاع الإنترنت لمنع هلع الطلاب ودعم UX احترافي */}
        {offlineError && (
          <div className="offline-notification-banner">
            <div className="offline-banner-content">
              <span className="offline-banner-icon">⚠️</span>
              <p>
                {isEnglishSubject
                  ? "Connection lost! Your answers are safely backed up locally. Do not close this page; submission will resume automatically when online."
                  : "انقطع الاتصال بالإنترنت! إجاباتك محفوظة بأمان على جهازك. يرجى عدم إغلاق الصفحة، وسيتم تسليم الاختبار تلقائياً فور عودة الشبكة."}
              </p>
              <button
                onClick={() => performSubmit(timeLeft === 0)}
                className="retry-submit-btn"
              >
                {isEnglishSubject ? "Retry Now" : "إعادة المحاولة الآن"}
              </button>
            </div>
          </div>
        )}

        <div className="question-section">
          <div className="question-card">
            <div className="q-header">
              <span className="q-number">
                {isEnglishSubject ? (
                  currentBlock.type === "passage" ? (
                    <>
                      {questionLabel} {displayCurrent} {ofLabel} {displayTotal}
                    </>
                  ) : (
                    `${questionLabel} ${displayCurrent} ${ofLabel} ${displayTotal}`
                  )
                ) : currentBlock.type === "passage" ? (
                  <>
                    {passageLabel} {displayCurrent} من{" "}
                    {passagesCount || displayTotal}
                    {" • "}
                    {questionLabel} {displayCurrent} {ofLabel} {displayTotal}
                  </>
                ) : (
                  `${questionLabel} ${displayCurrent} ${ofLabel} ${displayTotal}`
                )}
                <span className="question-degree">
                  ({formatDegree(currentDegree, isEnglishSubject)})
                </span>
              </span>
            </div>

            {currentBlock.type === "passage" && currentBlock.passage && (
              <div className="passage-box">
                <div className="passage-accent"></div>
                <h3>{currentBlock.passage.title}</h3>
                <p>{currentBlock.passage.passage_text}</p>
              </div>
            )}

            <div className="questions-container">
              {(currentBlock.type === "passage"
                ? currentBlock.questions
                : [currentBlock.question]
              ).map((q, qIdx) => (
                <div
                  key={q.id}
                  className="single-question-wrapper"
                  style={{
                    marginBottom:
                      qIdx <
                      (currentBlock.type === "passage"
                        ? currentBlock.questions.length - 1
                        : 0)
                        ? "50px"
                        : "0",
                  }}
                >
                  {currentBlock.type === "passage" && (
                    <div className="question-header">
                      <span className="question-number">
                        {isEnglishSubject
                          ? `Question ${qIdx + 1}`
                          : `سؤال ${qIdx + 1}`}
                      </span>
                    </div>
                  )}

                  {q.image_url ? (
                    <div className="question-image-container">
                      <img
                        src={q.image_url}
                        alt="السؤال"
                        className="question-image"
                      />
                    </div>
                  ) : (
                    <h2 className="question-text">{q.question_text}</h2>
                  )}

                  <div
                    className={`options-grid ${
                      isEnglishSubject ? "english-options" : ""
                    }`}
                  >
                    {q.options?.map((opt, idx) => {
                      const englishLetter = ["a", "b", "c", "d"][idx];
                      const imageKey = `image_option_${englishLetter}`;
                      const optionImageUrl = q[imageKey];
                      const isSelected = selectedAnswers[q.id] === idx;
                      const isCorrectAnswer =
                        parseInt(q.correct_option) === idx;
                      return (
                        <div
                          key={idx}
                          className={`option-item 
                            ${isSelected ? "selected" : ""} 
                            ${
                              isReviewMode && isCorrectAnswer
                                ? "correct-answer-view"
                                : ""
                            }
                            ${
                              isReviewMode && isSelected && !isCorrectAnswer
                                ? "wrong-answer-view"
                                : ""
                            }
                          `}
                          onClick={() => handleAnswerSelect(q.id, idx)}
                        >
                          <span className="option-label">
                            {optionLabels[idx]}
                          </span>
                          {optionImageUrl ? (
                            <div className="option-image-wrapper">
                              <img
                                src={optionImageUrl}
                                alt={`خيار ${optionLabels[idx]}`}
                                className="option-image"
                              />
                            </div>
                          ) : (
                            <span className="option-value">{opt}</span>
                          )}
                          <div className="check-circle"></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="quiz-nav-controls">
            <button
              className="nav-btn prev"
              disabled={currentBlockIndex === 0}
              onClick={() => setCurrentBlockIndex((prev) => prev - 1)}
            >
              {prevLabel}
            </button>

            <div className="q-dots-scroll-container" ref={dotsContainerRef}>
              {blocks.map((block, idx) => {
                let isCompleted = false;
                if (block.type === "passage") {
                  isCompleted = block.questions.every(
                    (q) => selectedAnswers[q.id] !== undefined,
                  );
                } else {
                  isCompleted =
                    selectedAnswers[block.question.id] !== undefined;
                }

                return (
                  <div
                    key={idx}
                    className={`dot ${
                      currentBlockIndex === idx ? "active" : ""
                    } ${isCompleted ? "completed" : ""}`}
                    onClick={() => setCurrentBlockIndex(idx)}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>

            <button
              className="nav-btn next"
              disabled={currentBlockIndex === totalBlocks - 1}
              onClick={() => setCurrentBlockIndex((prev) => prev + 1)}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </main>

      <Footer />

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { margin: 0; background-color: #f4f7fb; font-family: 'Cairo', sans-serif; direction: rtl; -webkit-font-smoothing: antialiased; }

        .quiz-page-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: #f4f7fb; }
        
        .quiz-header { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); padding: 16px 40px; -webkit-backdrop-filter: blur(20px); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid rgba(255, 255, 255, 0.5); border-radius: 0 0 32px 32px; box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6); }
        .timer-pill { background: #ffffff; border: 1px solid #eef2f6; padding: 8px 20px; border-radius: 50px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; font-size: 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .time-warning { color: #f59e0b; animation: pulse 1.5s infinite; }
        .time-critical { color: #ef4444; animation: pulse 0.5s infinite; font-weight: 800; }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
        .center-brand { display: flex; align-items: center; gap: 12px; }
        .quiz-logo { height: 65px; width: auto; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05)); }
        .submit-quiz-btn { background: #ef4444; color: white; border: none; padding: 12px 28px; border-radius: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); font-family: 'Cairo', sans-serif; box-shadow: 0 4px 12px rgba(239,68,68,0.2); }
        .submit-quiz-btn:hover:not(:disabled) { background: #dc2626; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(239,68,68,0.3); }
        .submit-quiz-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .progress-container { height: 6px; background: #eef2f6; width: 100%; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.5s cubic-bezier(0.4,0,0.2,1); border-radius: 0 4px 4px 0; }
        .quiz-main-content { flex: 1; padding: 40px 20px; max-width: 960px; margin: 0 auto; width: 100%; }
        
        /* تنسيقات لافتة انقطاع الاتصال */
        .offline-notification-banner { background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 20px; padding: 16px 24px; margin-bottom: 28px; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.08); animation: fadeIn 0.4s ease; }
        .offline-banner-content { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: space-between; }
        .offline-banner-icon { font-size: 1.5rem; }
        .offline-banner-content p { color: #991b1b; font-weight: 700; font-size: 1rem; margin: 0; flex: 1; text-align: start; line-height: 1.6; }
        .retry-submit-btn { background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-family: 'Cairo', sans-serif; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.2); }
        .retry-submit-btn:hover { background: #b91c1c; transform: translateY(-1px); }

        .question-card { background: #ffffff; border-radius: 28px; padding: 45px; box-shadow: 0 12px 40px -12px rgba(0,0,0,0.06); margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.8); }
        .q-header { margin-bottom: 24px; }
        .q-number { background: #f0fdf4; color: #16a34a; padding: 8px 18px; border-radius: 100px; font-weight: 700; font-size: 0.95rem; display: inline-block; border: 1px solid #dcfce7; }
        .question-degree { margin-inline-start: 8px; font-size: 0.85rem; color: #64748b; }
        
        .passage-box { padding: 30px; border-radius: 20px; margin-bottom: 35px; overflow: hidden; text-align: start; background: #f8fafc; border: 1px solid #e2e8f0; position: relative; }
        .passage-accent { position: absolute; top: 0; inset-inline-start: 0; bottom: 0; width: 4px; background: #3b82f6; border-radius: 4px; }
        .passage-box h3 { margin: 0 0 16px 0; color: #0f172a; font-size: 1.35rem; font-weight: 800; }
        .passage-box p { line-height: 22px; color: #334155; font-size: 15px; text-align: justify; }
        
        .questions-container { display: flex; flex-direction: column; gap: 45px; }
        .single-question-wrapper { border-top: 1px dashed #e2e8f0; padding-top: 35px; }
        .single-question-wrapper:first-child { border-top: none; padding-top: 0; }
        .question-header { margin-bottom: 20px; }
        .question-number { background: #f1f5f9; color: #475569; padding: 6px 14px; border-radius: 100px; font-size: 0.85rem; font-weight: 700; display: inline-block; }
        .question-text { color: #0f172a; line-height: 1.7; font-size: 1.45rem; font-weight: 600; margin-bottom: 32px; text-align: start; }
        .question-image-container { text-align: center; margin: 24px 0; }
        .question-image { max-width: 100%; max-height: 350px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #f1f5f9; }
        .options-grid { display: flex; flex-direction: column; gap: 14px; }

        .option-item { display: flex; align-items: center; padding: 20px 24px; background: #ffffff; border: 2px solid #eef2f6; border-radius: 20px; cursor: pointer; transition: all 0.25s cubic-bezier(0.4,0,0.2,1); gap: 12px; }
        .option-item:hover { border-color: #bfdbfe; background: #fafcff; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(59,130,246,0.06); }
        .option-item.selected { border-color: #3b82f6; background: #eff6ff; box-shadow: 0 8px 24px rgba(59,130,246,0.12); transform: translateY(-2px); }
        .option-item.correct-answer-view { border-color: #10b981; background: #f0fdf4; }
        .option-item.wrong-answer-view { border-color: #ef4444; background: #fef2f2; }

        .option-label { width: 40px; height: 40px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.15rem; color: #64748b; flex-shrink: 0; }
        .selected .option-label { background: #3b82f6; color: white; box-shadow: 0 4px 10px rgba(59,130,246,0.3); }
        .correct-answer-view .option-label { background: #10b981; color: white; }
        .wrong-answer-view .option-label { background: #ef4444; color: white; }

        .option-value { flex: 1; font-size: 1.1rem; font-weight: 600; color: #334155; line-height: 1.5; text-align: right; }
        .selected .option-value { color: #1e3a8a; }
        .english-options .option-value { text-align: left; }

        .option-image-wrapper { max-width: 130px; flex-shrink: 0; }
        .option-image { max-width: 100%; max-height: 100px; border-radius: 14px; object-fit: contain; background: white; border: 1px solid #e2e8f0; padding: 4px; }
        
        .check-circle { width: 26px; height: 26px; border: 2.5px solid #cbd5e1; border-radius: 50%; flex-shrink: 0; margin-left: auto; }
        .selected .check-circle { border-color: #3b82f6; background: #3b82f6; position: relative; transform: scale(1.1); }
        .selected .check-circle::after { content: '✓'; color: white; font-size: 14px; font-weight: bold; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

        .quiz-nav-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 40px; padding-top: 25px; border-top: 1px solid #eef2f6; width: 100%; }
        .nav-btn { padding: 12px 20px; border-radius: 16px; border: 1.5px solid #e2e8f0; background: white; font-family: 'Cairo'; font-weight: 700; cursor: pointer; transition: all 0.2s ease; color: #475569; font-size: 1rem; white-space: nowrap; flex-shrink: 0; display: flex; align-items: center; justify-content: center; z-index: 2; }
        .nav-btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; background: #f8fafc; }

        .q-dots-scroll-container { display: flex; gap: 8px; align-items: center; flex: 1; overflow-x: auto; scroll-behavior: smooth; padding: 10px 40px; -ms-overflow-style: none; scrollbar-width: none; mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); }
        .q-dots-scroll-container::-webkit-scrollbar { display: none; }

        .dot { background: white; border: 2px solid #e2e8f0; border-radius: 30%; min-width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; cursor: pointer; color: #64748b; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); user-select: none; flex-shrink: 0; }
        .dot.active { border-color: #3b82f6; color: white; background: #3b82f6; transform: scale(1.15); z-index: 10; }
        .dot.completed:not(.active) { background: #ecfdf5; color: #10b981; border-color: #a7f3d0; }
        .dot:hover:not(.active) { border-color: #94a3b8; transform: translateY(-2px); }

        ::-webkit-scrollbar { width: 8px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(241, 245, 249, 0.4); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #94a3b8, #cbd5e1); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #3b82f6, #60a5fa); border: 1px solid transparent; background-clip: padding-box; }

        @media (max-width: 768px) {
          .quiz-header { padding: 12px 20px; }
          .question-card { padding: 24px 20px; border-radius: 24px; }
          .question-text { font-size: 1.2rem; }
          .quiz-logo { height: 35px; }
          .quiz-nav-controls { gap: 8px; }
          .nav-btn { padding: 10px 14px; font-size: 0.9rem; border-radius: 14px; }
          .q-dots-scroll-container { gap: 8px; padding: 10px 20px; mask-image: none; -webkit-mask-image: none; }
          .dot { min-width: 38px; height: 38px; font-size: 0.9rem; border-width: 1.5px; }
          .option-item { padding: 14px; gap: 8px; }
          .option-label { width: 34px; height: 34px; font-size: 0.95rem; }
          .option-value { font-size: 0.95rem; }
          .questions-container { gap: 32px; }
          .passage-box { max-height: 350px; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px; }
        }
        
        @media (max-width: 380px) {
          .quiz-nav-controls { flex-wrap: wrap; justify-content: center; }
          .q-dots-scroll-container { order: -1; width: 100%; margin-bottom: 12px; }
          .nav-btn { flex: 1; }
        }
      `}</style>
    </div>
  );
}