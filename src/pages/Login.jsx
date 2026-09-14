import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import Footer from './Footer';

const EMAIL_DOMAIN = 'maselite';
const TEACHER_IMAGE = '/teacher.png';

export default function Login() {
  const [view, setView] = useState('student');
  const [loading, setLoading] = useState(false);

  // ==============================
  // STUDENT DATA
  // ==============================
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');

  // ==============================
  // TEACHER DATA
  // ==============================
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // ==============================
  // PARTNER
  // ==============================
  const [partnerLabel, setPartnerLabel] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // ==============================
  // SECRET TEACHER ACCESS
  // ==============================
  const [secretClicks, setSecretClicks] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    fetch('/partner.json')
      .then((res) => res.json())
      .then((data) => {
        setPartnerLabel(data.label || '');
        setPartnerName(data.name || '');
      })
      .catch(() => {
        setPartnerLabel('بالتعاون مع:');
        setPartnerName('');
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('teacher') === '1') {
      setView('teacher');
    }

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        resetForm();
        setView('teacher');
        toast.success('🔓 تم فتح بوابة المعلم');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoClick = () => {
    const newCount = secretClicks + 1;
    setSecretClicks(newCount);

    if (newCount >= 5) {
      setSecretClicks(0);
      resetForm();
      setView('teacher');
      toast.success('🔓 تم فتح بوابة المعلم');
      return;
    }

    setTimeout(() => {
      setSecretClicks(0);
    }, 2000);
  };

  const resetForm = () => {
    setStudentId('');
    setFullName('');
    setBranch('');
    setPhone('');
    setTeacherUsername('');
    setTeacherPassword('');
  };

  const goToStudentLogin = () => {
    resetForm();
    setView('student');
  };

  const goToSignup = () => {
    setView('signup');
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    if (!id) {
      toast.error('الرجاء إدخال رقم الهوية');
      return;
    }
    if (!/^\d+$/.test(id)) {
      toast.error('رقم الهوية يجب أن يتكون من أرقام فقط');
      return;
    }
    if (id.length !== 9) {
      toast.error('رقم الهوية يجب أن يكون 9 أرقام');
      return;
    }

    setLoading(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('nationalID', id)
        .maybeSingle();

      if (!profile) {
        setView('signup');
        setLoading(false);
        toast('رقم الهوية غير مسجل. أكمل بياناتك لإنشاء حساب', { icon: '📝' });
        return;
      }

      if (profile.role !== 'student') {
        toast.error('هذا الحساب غير مصرح له بالدخول كطالب');
        setLoading(false);
        return;
      }

      const email = `${id}@${EMAIL_DOMAIN}`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: id,
      });

      if (error || !data.user) {
        toast.error('فشل تسجيل الدخول. تواصل مع الإدارة');
        setLoading(false);
        return;
      }

      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  const handleStudentSignup = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    if (!id) {
      toast.error('رقم الهوية مطلوب');
      return;
    }
    if (!/^\d{9}$/.test(id)) {
      toast.error('رقم الهوية يجب أن يكون 9 أرقام');
      return;
    }
    if (!fullName.trim() || fullName.trim().split(/\s+/).length < 4) {
      toast.error('الرجاء إدخال الاسم الرباعي كاملاً');
      return;
    }
    if (!branch) {
      toast.error('الرجاء اختيار الفرع الدراسي');
      return;
    }
    if (!phone.trim()) {
      toast.error('الرجاء إدخال رقم الجوال');
      return;
    }
    if (!/^(059|056)\d{7}$/.test(phone.trim())) {
      toast.error('رقم الجوال غير صحيح (يجب أن يبدأ بـ 059 أو 056)');
      return;
    }

    setLoading(true);

    try {
      const email = `${id}@${EMAIL_DOMAIN}`;
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('nationalID', id)
        .maybeSingle();

      if (existingProfile) {
        toast.error('رقم الهوية مسجل مسبقاً. جرب تسجيل الدخول');
        setView('student');
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: id,
      });

      if (signUpError) {
        if (
          signUpError.message?.includes('already') ||
          signUpError.message?.includes('duplicate')
        ) {
          toast.error('هذا الحساب موجود بالفعل. جرب تسجيل الدخول');
          setView('student');
          setLoading(false);
          return;
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error('فشل إنشاء الحساب - لم يتم إنشاء المستخدم');
      }

      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: signUpData.user.id,
          nationalID: id,
          name: fullName.trim(),
          role: 'student',
          branch: branch,
          phone: phone.trim(),
        },
      ]);

      if (profileError) {
        await supabase.auth.signOut();
        throw new Error('فشل حفظ البيانات الشخصية: ' + profileError.message);
      }

      toast.success('تم إنشاء حسابك بنجاح! جاري تحويلك...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 800);
    } catch (err) {
      console.error('Signup error:', err);
      toast.error('فشل إنشاء الحساب: ' + (err.message || 'خطأ غير معروف'));
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    const username = teacherUsername.trim();
    const password = teacherPassword;

    if (!username || !password) {
      toast.error('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    const email = `${username}@${EMAIL_DOMAIN}`;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        toast.error('اسم المستخدم أو كلمة المرور غير صحيحة');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.role !== 'teacher') {
        await supabase.auth.signOut();
        toast.error('هذا الحساب غير مصرح له بالدخول كمعلم');
        setLoading(false);
        return;
      }

      toast.success('مرحباً بك');
      navigate('/teacher', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* القسم العلوي بالكامل */}
      <div className="hero-section">
        {/* الدوائر المتداخلة خلف المعلم */}
        <div className="rings-container">
          <div className="ring ring-inner" />
          <div className="ring ring-middle" />
          <div className="ring ring-outer" />
        </div>

        {/* النصوص اليسرى: اسم المعلم والتخصص */}
        <div className="teacher-info">
          <h1 className="teacher-name">أ. محمد أبو سليمان</h1>
          <div className="brush-stroke">
            <svg viewBox="0 0 120 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 7C30 2 90 2 118 6C95 3 45 3 2 7Z" fill="#1b6edc" />
            </svg>
          </div>
          <span className="teacher-subtitle">English Teacher</span>
        </div>

        {/* النص الأيمن: العبارة الإنجليزية المائلة بخط اليد */}
        <div className="motto-container">
          <p>Better</p>
          <p>English</p>
          <p>Bigger</p>
          <p>Dreams</p>
          <svg className="motto-line" viewBox="0 0 50 6" fill="none">
            <path d="M2 4 C 18 1, 35 1, 48 4" stroke="#a0ccf7" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* صورة المعلم المكبّرة (Zoomed In) */}
        <div className="teacher-photo-wrapper" onClick={handleLogoClick}>
          <img
            src={TEACHER_IMAGE}
            alt="أ. محمد أبو سليمان"
            className="teacher-photo"
            draggable={false}
          />
        </div>
      </div>

      {/* كارت تسجيل الدخول الأبيض */}
      <main className="auth-card">
        {view === 'student' && (
          <>
            <h2 className="card-title">تسجيل الدخول</h2>

            <form onSubmit={handleStudentLogin} className="auth-form">
              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">رقم الهوية</span>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>

                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\s/g, ''))}
                  placeholder="أدخل رقم الهوية"
                  maxLength={9}
                  required
                  className="auth-input"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري التحميل...' : 'دخول الاختبار'}
              </button>
            </form>

            <div className="toggle-view">
              <span className="toggle-muted">ليس لديك حساب؟</span>
              <button type="button" onClick={goToSignup} className="toggle-link">
                إنشاء حساب جديد
              </button>
            </div>
          </>
        )}

        {view === 'signup' && (
          <>
            <div className="card-header">
              <h2 className="card-title">إنشاء حساب جديد</h2>
              <p className="card-subtitle">أدخل بياناتك للبدء في الاختبارات الإلكترونية</p>
            </div>

            <form onSubmit={handleStudentSignup} className="auth-form signup-form">
              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">رقم الهوية *</span>
                </div>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\s/g, ''))}
                  placeholder="مثال: 123456789"
                  maxLength={9}
                  required
                  className="auth-input"
                />
              </div>

              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">الاسم الرباعي *</span>
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أدخل الاسم الرباعي"
                  required
                  className="auth-input"
                />
              </div>

              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">الفرع الدراسي *</span>
                </div>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  required
                  className="auth-input select-input"
                >
                  <option value="" disabled>— اختر الفرع —</option>
                  <option value="العلمي">العلمي</option>
                  <option value="الأدبي">الأدبي</option>
                </select>
              </div>

              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">رقم الجوال *</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))}
                  placeholder="059xxxxxxx"
                  maxLength={10}
                  required
                  className="auth-input"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
              </button>
            </form>

            <div className="toggle-view">
              <span className="toggle-muted">لديك حساب بالفعل؟</span>
              <button type="button" onClick={goToStudentLogin} className="toggle-link">
                تسجيل الدخول
              </button>
            </div>
          </>
        )}

        {view === 'teacher' && (
          <>
            <div className="card-header">
              <h2 className="card-title">بوابة المعلم</h2>
              <p className="card-subtitle">تسجيل الدخول إلى لوحة التحكم</p>
            </div>

            <form onSubmit={handleTeacherLogin} className="auth-form">
              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">اسم المستخدم</span>
                </div>
                <input
                  type="text"
                  value={teacherUsername}
                  onChange={(e) => setTeacherUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  required
                  className="auth-input"
                />
              </div>

              <div className="input-group">
                <div className="label-row">
                  <span className="input-label">كلمة المرور</span>
                </div>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="•••••••"
                  required
                  className="auth-input"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري التحقق...' : 'دخول لوحة المعلم'}
              </button>
            </form>

            <div className="toggle-view">
              <button type="button" onClick={goToStudentLogin} className="toggle-link">
                العودة لتسجيل الدخول
              </button>
            </div>
          </>
        )}
      </main>

      {(partnerLabel || partnerName) && (
        <div className="partner-section">
          {partnerLabel && <div className="partner-label">{partnerLabel}</div>}
          {partnerName && <div className="partner-name">{partnerName}</div>}
        </div>
      )}

      {/* ذيل الصفحة */}
      <footer className="page-footer">
        <p className="developer-info">تطوير : نادر محمد أبو سليمان</p>
        <p className="copyright-info">© Developed by Nader Sulieman</p>
        <Footer />
      </footer>

      {/* =====================================================
          CSS RULES
      ====================================================== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Caveat:wght@600;700&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
        }

        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }

        .login-page {
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          min-height: 100vh;
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
          background: linear-gradient(180deg, #edf4fc 0%, #e2eefb 45%, #d8e8fa 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 20px;
          overflow: hidden;
        }

        /* ----------------------------------------------------
           HERO SECTION & TEACHER ZOOM
        ---------------------------------------------------- */
        .hero-section {
          position: relative;
          width: 100%;
          height: 360px;
          overflow: hidden;
        }

        /* الدوائر البيضاء المتداخلة خلف المعلم */
        .rings-container {
          position: absolute;
          top: 10px;
          right: -70px;
          width: 420px;
          height: 420px;
          pointer-events: none;
          z-index: 1;
        }

        .ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.45);
        }

        .ring-inner {
          top: 90px;
          right: 90px;
          width: 240px;
          height: 240px;
          background: rgba(255, 255, 255, 0.35);
          box-shadow: 0 0 40px rgba(255, 255, 255, 0.5);
        }

        .ring-middle {
          top: 50px;
          right: 50px;
          width: 320px;
          height: 320px;
          background: rgba(255, 255, 255, 0.2);
        }

        .ring-outer {
          top: 0;
          right: 0;
          width: 420px;
          height: 420px;
          background: rgba(255, 255, 255, 0.1);
        }

        /* معلومات المعلم الجانبية اليسرى */
        .teacher-info {
          position: absolute;
          top: 72px;
          left: 20px;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .teacher-name {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          color: #0d3862;
          white-space: nowrap;
        }

        .brush-stroke {
          width: 110px;
          height: 8px;
          margin-top: 2px;
          margin-bottom: 6px;
        }

        .brush-stroke svg {
          width: 100%;
          height: 100%;
        }

        .teacher-subtitle {
          font-family: Arial, sans-serif;
          font-size: 13px;
          color: #7296bc;
          letter-spacing: 1.5px;
          font-weight: 500;
        }

        /* المقولة المائلة بخط اليد جهة اليمين العلوي */
        .motto-container {
          position: absolute;
          top: 30px;
          right: 22px;
          z-index: 2;
          direction: ltr;
          text-align: left;
          transform: rotate(-10deg);
          font-family: 'Caveat', cursive;
          color: rgba(140, 180, 218, 0.5);
          font-size: 21px;
          line-height: 1.05;
          font-weight: 700;
        }

        .motto-container p {
          margin: 0;
        }

        .motto-line {
          width: 45px;
          height: 6px;
          margin-top: 2px;
        }

        /* حاوية الصورة المكبّرة (Zoom & Position) */
        .teacher-photo-wrapper {
          position: absolute;
          top: -10px;
          right: -30px;
          width: 320px;
          height: 380px;
          z-index: 3;
          cursor: pointer;
        }

        .teacher-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          transform: scale(1.15); /* إعطاء الزوم المطلوب */
          transform-origin: top right;
        }

        /* ----------------------------------------------------
           CARD FORM & BUTTONS
        ---------------------------------------------------- */
        .auth-card {
          position: relative;
          z-index: 10;
          width: calc(100% - 36px);
          margin-top: -35px;
          background: #ffffff;
          border-radius: 26px;
          padding: 28px 22px;
          box-shadow: 0 10px 30px rgba(18, 52, 88, 0.07);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .card-header {
          text-align: center;
          margin-bottom: 18px;
          width: 100%;
        }

        .card-title {
          margin: 0 0 18px 0;
          font-size: 23px;
          font-weight: 800;
          color: #0d3862;
          text-align: center;
        }

        .card-subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #7b91a7;
        }

        .auth-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .signup-form {
          gap: 12px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .label-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
        }

        .input-label {
          font-size: 14.5px;
          font-weight: 700;
          color: #0d3862;
        }

        .label-icon {
          width: 18px;
          height: 18px;
          color: #2b77e5;
        }

        .auth-input {
          width: 100%;
          height: 50px;
          padding: 0 16px;
          background-color: #f4f7fb;
          border: 1px solid #e1e8f0;
          border-radius: 13px;
          font-size: 14.5px;
          color: #1a202c;
          outline: none;
          transition: all 0.2s ease;
          text-align: right;
        }

        .auth-input::placeholder {
          color: #9ab0c7;
          font-size: 13.5px;
        }

        .auth-input:focus {
          background-color: #ffffff;
          border-color: #2b77e5;
          box-shadow: 0 0 0 3px rgba(43, 119, 229, 0.1);
        }

        .select-input {
          cursor: pointer;
        }

        .submit-btn {
          width: 100%;
          height: 52px;
          margin-top: 4px;
          background: linear-gradient(135deg, #2b76df 0%, #1f64cc 100%);
          border: none;
          border-radius: 13px;
          color: #ffffff;
          font-size: 16.5px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 7px 18px rgba(35, 107, 212, 0.28);
          transition: all 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 9px 20px rgba(35, 107, 212, 0.35);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .toggle-view {
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 13.5px;
        }

        .toggle-muted {
          color: #61788f;
          font-weight: 500;
        }

        .toggle-link {
          background: none;
          border: none;
          padding: 0;
          color: #2b77e5;
          font-weight: 800;
          font-family: inherit;
          font-size: inherit;
          cursor: pointer;
        }

        .toggle-link:hover {
          text-decoration: underline;
        }

        /* ----------------------------------------------------
           FOOTER
        ---------------------------------------------------- */
        .partner-section {
          margin-top: 14px;
          text-align: center;
          z-index: 5;
        }

        .partner-label {
          font-size: 11.5px;
          color: #7b91a7;
        }

        .partner-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #0d3862;
        }

        .page-footer {
          margin-top: 22px;
          text-align: center;
          z-index: 5;
        }

        .developer-info {
          margin: 0;
          font-size: 13px;
          color: #7890a8;
          font-weight: 600;
        }

        .copyright-info {
          margin: 2px 0 0 0;
          font-size: 12.5px;
          color: #7890a8;
          font-weight: 600;
          direction: ltr;
        }
      `}</style>
    </div>
  );
}
