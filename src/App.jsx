import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from 'react-hot-toast';
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import QuizPage from './pages/QuizPage';
import QuizResult from './pages/QuizResult';

/**
 * مكوّن إعادة التوجيه الذكي للطالب:
 * - يتحقق من تسجيل الدخول
 * - يبحث عن مادة اللغة الإنجليزية
 * - يتحقق من وجود محاولة نشطة
 * - يوجّه الطالب مباشرة إلى صفحة اختبار الإنجليزية
 */
const StudentRedirect = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        // 1. التحقق من تسجيل الدخول
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        // 2. التحقق من الدور - إن كان غير طالب، وجّهه للوحة المناسبة
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role === 'admin') {
          navigate('/admin', { replace: true });
          return;
        }
        if (profile?.role === 'teacher') {
          navigate('/teacher', { replace: true });
          return;
        }

        // 3. البحث عن مادة اللغة الإنجليزية
        const { data: subject } = await supabase
          .from('subjects')
          .select('id, name')
          .ilike('name', '%إنجليزية%')
          .limit(1)
          .maybeSingle();

        if (!subject?.id) {
          if (isMounted) {
            setStatus("no_subject");
            setMessage("مادة اللغة الإنجليزية غير متوفرة. يرجى التواصل مع الإدارة.");
          }
          return;
        }

        // 4. التحقق من وجود محاولة نشطة
        const { data: attempt } = await supabase
          .from('attempts')
          .select('id, status')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!attempt) {
          if (isMounted) {
            setStatus("no_attempt");
            setMessage("لا توجد محاولة نشطة. يرجى مراجعة الإدارة لتفعيل محاولة اختبار جديدة.");
          }
          return;
        }

        // 5. التوجيه المباشر لصفحة اختبار الإنجليزية
        navigate(`/quiz/${subject.id}`, { replace: true });

      } catch (err) {
        console.error("Redirect error:", err);
        if (isMounted) {
          setStatus("error");
          setMessage("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
        }
      }
    })();

    return () => { isMounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const sharedStyle = `
    .redirect-page{
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:100vh;direction:rtl;font-family:'Cairo',sans-serif;
      background:linear-gradient(135deg,#eef5ff 0%,#d8e8fc 100%);
      padding:20px;gap:20px;
    }
    .redirect-spinner{
      width:52px;height:52px;border:4px solid #dbeafe;
      border-top-color:#3b82f6;border-radius:50%;
      animation:spin 0.9s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .redirect-loading-text{
      color:#475569;font-weight:600;font-size:1rem;letter-spacing:0.3px;
    }
    .error-card{
      background:#fff;border-radius:24px;padding:40px 32px;text-align:center;
      max-width:440px;width:100%;box-shadow:0 15px 35px rgba(0,0,0,0.08);
      border:1px solid rgba(255,255,255,0.6);
      animation:cardFadeIn 0.4s ease-out both;
    }
    @keyframes cardFadeIn{
      from{opacity:0;transform:translateY(15px)}
      to{opacity:1;transform:translateY(0)}
    }
    .error-icon{font-size:3.5rem;margin-bottom:16px;line-height:1}
    .error-card h2{
      color:#0f172a;font-size:1.25rem;font-weight:800;
      margin:0 0 10px;letter-spacing:-0.01em;
    }
    .error-card p{
      color:#64748b;margin:0 0 24px;font-size:0.95rem;
      line-height:1.7;
    }
    .error-card button{
      background:#3b82f6;color:white;border:none;padding:12px 28px;
      border-radius:12px;font-family:inherit;font-weight:700;cursor:pointer;
      font-size:0.95rem;transition:all 0.2s ease;
      box-shadow:0 4px 12px rgba(59,130,246,0.25);
    }
    .error-card button:hover{
      background:#2563eb;transform:translateY(-2px);
      box-shadow:0 6px 16px rgba(59,130,246,0.35);
    }
  `;

  if (status === "loading") {
    return (
      <div className="redirect-page">
        <div className="redirect-spinner"></div>
        <p className="redirect-loading-text">جاري تحويلك إلى صفحة الاختبار...</p>
        <style>{sharedStyle}</style>
      </div>
    );
  }

  const getIcon = () => {
    if (status === "no_subject") return "📚";
    if (status === "no_attempt") return "⏳";
    return "⚠️";
  };

  const getTitle = () => {
    if (status === "no_subject") return "مادة اللغة الإنجليزية غير متوفرة";
    if (status === "no_attempt") return "لا توجد محاولة نشطة";
    return "حدث خطأ";
  };

  return (
    <div className="redirect-page">
      <div className="error-card">
        <div className="error-icon">{getIcon()}</div>
        <h2>{getTitle()}</h2>
        <p>{message}</p>
        <button onClick={handleLogout}>تسجيل الخروج</button>
      </div>
      <style>{sharedStyle}</style>
    </div>
  );
};

export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: { fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right' },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          {/* /dashboard → إعادة توجيه ذكية لاختبار الإنجليزية */}
          <Route path="/dashboard" element={<StudentRedirect />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/quiz/:subjectId" element={<QuizPage />} />
          <Route path="/result" element={<QuizResult />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
