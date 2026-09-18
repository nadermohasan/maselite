import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from 'react-hot-toast';
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import QuizPage from './pages/QuizPage';
import QuizResult from './pages/QuizResult';

// ============================================================
// ⚙️ إعدادات التواصل
// ============================================================
const ADMIN_WHATSAPP = "972597780880";
const ADMIN_PHONE_DISPLAY = "0597780880";

/**
 * مكوّن إعادة التوجيه الذكي للطالب
 */
const StudentRedirect = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', user.id)
          .maybeSingle();

        if (isMounted && profile) {
          setStudentName(profile.name || "");
        }

        if (profile?.role === 'admin') {
          navigate('/admin', { replace: true });
          return;
        }
        if (profile?.role === 'teacher') {
          navigate('/teacher', { replace: true });
          return;
        }

        const { data: subject } = await supabase
          .from('subjects')
          .select('id, name')
          .ilike('name', '%إنجليزية%')
          .limit(1)
          .maybeSingle();

        if (!subject?.id) {
          if (isMounted) setStatus("no_subject");
          return;
        }

        const { data: attempt } = await supabase
          .from('attempts')
          .select('id, status')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!attempt) {
          if (isMounted) setStatus("no_attempt");
          return;
        }

        navigate(`/quiz/${subject.id}`, { replace: true });
      } catch (err) {
        console.error("Redirect error:", err);
        if (isMounted) setStatus("error");
      }
    })();

    return () => { isMounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  // ============================================================
  // ⭐ رابط واتساب — بدون رسالة جاهزة
  // ============================================================
  const buildWhatsAppLink = () => {
    return `https://wa.me/${ADMIN_WHATSAPP}`;
  };

  // ============================================================
  // ⭐ شاشة التحقق — لا شيء يظهر
  // ============================================================
  if (status === "checking") {
    return null;
  }

  // ============================================================
  // شاشة "الاختبار غير متاح حالياً"
  // ============================================================
  if (status === "no_attempt") {
    return (
      <div className="status-page">
        <div className="status-bg-blob blob-1"></div>
        <div className="status-bg-blob blob-2"></div>
        <div className="status-bg-blob blob-3"></div>

        <div className="status-card fade-in-up">

          {/* أيقونة الانتظار */}
          <div className="status-icon-wrapper waiting">
            <div className="status-icon-pulse"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          {/* الترحيب */}
          {studentName && (
            <p className="status-greeting">
              مرحباً، <span className="student-name">{studentName}</span> 👋
            </p>
          )}

          {/* العنوان — مُعدَّل */}
          <h1 className="status-title">الاختبار غير متاح حالياً</h1>

          {/* الرسالة */}
          <p className="status-message">
            يتم فتح الاختبارات بالتنسيق مع أ. محمد أبو سليمان
            <br />
          </p>

          {/* زر واتساب */}
          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-btn"
          >
            <span className="whatsapp-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </span>
            <span className="whatsapp-content">
              <span className="whatsapp-title">تواصل مع الاستاذ عبر واتساب</span>
              <span className="whatsapp-sub">{ADMIN_PHONE_DISPLAY} · رد سريع</span>
            </span>
            <span className="whatsapp-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </span>
          </a>

          {/* فاصل */}
          <div className="divider">
            <span className="divider-line"></span>
            <span className="divider-text">أو</span>
            <span className="divider-line"></span>
          </div>

          {/* الخطوات */}
          <div className="steps-list">
            <div className="step-item">
              <span className="step-number">1</span>
              <span className="step-text">اضغط زر واتساب أعلاه</span>
            </div>
            <div className="step-item">
              <span className="step-number">2</span>
              <span className="step-text">تواصل مع الاستاذ لتفعيل الاختبار</span>
            </div>
            <div className="step-item">
              <span className="step-number">3</span>
              <span className="step-text">حدّث الصفحة بعد التأكيد وابدأ الاختبار</span>
            </div>
          </div>

          {/* الأزرار الثانوية */}
          <div className="status-actions">
            <button
              className="btn-status primary"
              onClick={() => window.location.reload()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="18" height="18">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              تحديث الصفحة
            </button>

            <button
              className="btn-status secondary"
              onClick={handleLogout}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="18" height="18">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              تسجيل الخروج
            </button>
          </div>
        </div>

        <StatusStyles />
      </div>
    );
  }

  // ============================================================
  // شاشة "لا توجد مادة إنجليزية"
  // ============================================================
  if (status === "no_subject") {
    return (
      <div className="status-page">
        <div className="status-bg-blob blob-1"></div>
        <div className="status-bg-blob blob-2"></div>

        <div className="status-card fade-in-up">
          <div className="status-icon-wrapper error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          <h1 className="status-title">المادة غير متوفرة</h1>

          <p className="status-message">
            مادة اللغة الإنجليزية غير متوفرة على المنصة حالياً.
            <br />
            يرجى التواصل مع الإدارة.
          </p>

          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-btn compact"
          >
            <span className="whatsapp-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </span>
            <span className="whatsapp-content">
              <span className="whatsapp-title">تواصل مع الإدارة</span>
            </span>
          </a>

          <div className="status-actions" style={{ marginTop: "14px" }}>
            <button className="btn-status secondary" onClick={handleLogout}>
              تسجيل الخروج
            </button>
          </div>
        </div>

        <StatusStyles />
      </div>
    );
  }

  // ============================================================
  // شاشة الخطأ
  // ============================================================
  return (
    <div className="status-page">
      <div className="status-bg-blob blob-1"></div>
      <div className="status-bg-blob blob-2"></div>

      <div className="status-card fade-in-up">
        <div className="status-icon-wrapper error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="status-title">حدث خطأ غير متوقع</h1>

        <p className="status-message">
          لم نتمكن من تحميل بياناتك.
          <br />
          يرجى المحاولة مرة أخرى أو التواصل مع الإدارة.
        </p>

        <a
          href={buildWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-btn compact"
        >
          <span className="whatsapp-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </span>
          <span className="whatsapp-content">
            <span className="whatsapp-title">تواصل مع الإدارة</span>
          </span>
        </a>

        <div className="status-actions" style={{ marginTop: "14px" }}>
          <button className="btn-status primary" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </button>
          <button className="btn-status secondary" onClick={handleLogout}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      <StatusStyles />
    </div>
  );
};

// ============================================================
// مكوّن الأنماط
// ============================================================
const StatusStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

    * { box-sizing: border-box; }

    .status-page {
      min-height: 100vh;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      direction: rtl;
      font-family: 'Cairo', sans-serif;
      background: linear-gradient(145deg, #eef5ff 0%, #dbeafe 50%, #e0ecff 100%);
      padding: 24px 20px;
      position: relative;
      overflow: hidden;
    }

    .status-bg-blob {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(60px);
      z-index: 0;
    }
    .blob-1 {
      width: 420px; height: 420px;
      top: -140px; right: -100px;
      background: radial-gradient(circle, rgba(96, 165, 250, 0.35), transparent 70%);
    }
    .blob-2 {
      width: 360px; height: 360px;
      bottom: -120px; left: -100px;
      background: radial-gradient(circle, rgba(147, 197, 253, 0.4), transparent 70%);
    }
    .blob-3 {
      width: 260px; height: 260px;
      top: 40%; left: 50%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(191, 219, 254, 0.35), transparent 70%);
    }

    .status-card {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 460px;
      background: #ffffff;
      border-radius: 28px;
      padding: 40px 32px 32px;
      box-shadow:
        0 25px 60px rgba(30, 64, 175, 0.12),
        0 8px 20px rgba(30, 64, 175, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.9);
      text-align: center;
      animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .status-icon-wrapper {
      width: 84px;
      height: 84px;
      margin: 0 auto 22px;
      border-radius: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .status-icon-wrapper.waiting {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706;
      box-shadow: 0 12px 24px rgba(217, 119, 6, 0.18);
    }

    .status-icon-wrapper.error {
      background: linear-gradient(135deg, #fee2e2, #fecaca);
      color: #dc2626;
      box-shadow: 0 12px 24px rgba(220, 38, 38, 0.18);
    }

    .status-icon-wrapper svg {
      width: 42px;
      height: 42px;
      position: relative;
      z-index: 2;
    }

    .status-icon-pulse {
      position: absolute;
      inset: -6px;
      border-radius: 32px;
      background: rgba(251, 191, 36, 0.35);
      animation: pulse 2s ease-in-out infinite;
      z-index: 1;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.08); opacity: 0.35; }
    }

    .status-greeting {
      font-size: 0.95rem;
      color: #64748b;
      margin: 0 0 8px;
      font-weight: 600;
    }

    .student-name {
      color: #1e40af;
      font-weight: 800;
    }

    .status-title {
      font-size: 1.5rem;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 14px;
      line-height: 1.35;
      letter-spacing: -0.4px;
    }

    .status-message {
      font-size: 0.95rem;
      color: #64748b;
      line-height: 1.8;
      margin: 0 0 24px;
      font-weight: 500;
    }

    .whatsapp-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      border: none;
      border-radius: 18px;
      padding: 16px 20px;
      margin-bottom: 20px;
      text-decoration: none;
      color: #ffffff;
      text-align: right;
      box-shadow:
        0 12px 28px rgba(37, 211, 102, 0.3),
        0 4px 10px rgba(18, 140, 126, 0.2);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .whatsapp-btn::before {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.15),
        transparent
      );
      animation: shine 3s ease-in-out infinite;
    }

    @keyframes shine {
      0% { left: -100%; }
      50%, 100% { left: 100%; }
    }

    .whatsapp-btn:hover {
      transform: translateY(-3px);
      box-shadow:
        0 16px 36px rgba(37, 211, 102, 0.4),
        0 6px 14px rgba(18, 140, 126, 0.3);
    }

    .whatsapp-btn:active {
      transform: translateY(-1px);
    }

    .whatsapp-btn.compact {
      padding: 13px 18px;
      margin-bottom: 0;
    }

    .whatsapp-icon-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #ffffff;
      position: relative;
      z-index: 2;
    }

    .whatsapp-btn.compact .whatsapp-icon-wrapper {
      width: 38px;
      height: 38px;
      border-radius: 10px;
    }

    .whatsapp-content {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      position: relative;
      z-index: 2;
    }

    .whatsapp-title {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.3;
    }

    .whatsapp-sub {
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
      letter-spacing: 0.3px;
    }

    .whatsapp-arrow {
      color: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      transition: transform 0.25s ease;
      position: relative;
      z-index: 2;
    }

    .whatsapp-btn:hover .whatsapp-arrow {
      transform: translateX(-4px);
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 4px 0 20px;
    }

    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
    }

    .divider-text {
      font-size: 0.78rem;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 22px;
      text-align: right;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.88rem;
      color: #475569;
      font-weight: 600;
      line-height: 1.6;
    }

    .step-number {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #3b82f6;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: 0 3px 8px rgba(59, 130, 246, 0.25);
    }

    .status-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 13px 22px;
      border-radius: 14px;
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 800;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      flex: 1;
      min-width: 140px;
    }

    .btn-status.primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #ffffff;
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.3);
    }

    .btn-status.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.4);
    }

    .btn-status.secondary {
      background: #ffffff;
      color: #475569;
      border: 1.5px solid #e2e8f0;
    }

    .btn-status.secondary:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      color: #1e293b;
    }

    @media (max-width: 480px) {
      .status-card { padding: 32px 22px 26px; border-radius: 24px; }
      .status-icon-wrapper { width: 72px; height: 72px; border-radius: 22px; }
      .status-icon-wrapper svg { width: 36px; height: 36px; }
      .status-title { font-size: 1.3rem; }
      .status-message { font-size: 0.9rem; }
      .btn-status { padding: 12px 18px; font-size: 0.9rem; min-width: 120px; }
      .step-item { font-size: 0.82rem; }
      .whatsapp-btn { padding: 14px 16px; }
      .whatsapp-icon-wrapper { width: 40px; height: 40px; }
      .whatsapp-title { font-size: 0.92rem; }
      .whatsapp-sub { font-size: 0.72rem; }
    }
  `}</style>
);

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