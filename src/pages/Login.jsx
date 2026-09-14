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

  // ==============================
  // LOAD PARTNER
  // ==============================
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

  // ==============================
  // SECRET TEACHER PORTAL
  // ==============================
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

  // ==============================
  // SECRET LOGO CLICKS
  // ==============================
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

  // ==============================
  // RESET FORM
  // ==============================
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

  // ==============================
  // STUDENT LOGIN
  // ==============================
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

  // ==============================
  // STUDENT SIGNUP
  // ==============================
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

  // ==============================
  // TEACHER LOGIN
  // ==============================
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
      {/* خلفية الصفحة */}
      <div className="bg-decorations">
        <div className="bg-circle circle-top-left" />
        <div className="bg-circle circle-center-right" />
      </div>

      {/* المنطقة العلوية (صورة المعلم والأسماء) */}
      <div className="hero-section">
        {/* معلومات المعلم الجانبية */}
        <div className="teacher-info">
          <h1 className="teacher-name">أ. محمد أبو سليمان</h1>
          {/* مسحة الفرشاة الزرقاء تحت الاسم */}
          <div className="brush-stroke-wrapper">
            <svg viewBox="0 0 140 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8C35 2 105 1 137 7C110 4 50 4 3 8Z" fill="#3182ce" />
            </svg>
          </div>
          <span className="teacher-subtitle">English Teacher</span>
        </div>

        {/* المقولة بخط اليد جهة اليمين */}
        <div className="motto-box">
          <p>Better</p>
          <p>English</p>
          <p>Bigger</p>
          <p>Dreams</p>
          <svg className="motto-underline" viewBox="0 0 60 8" fill="none">
            <path d="M2 5 C 20 2, 40 2, 58 5" stroke="#90cdf4" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* صورة المعلم */}
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
        {/* ===================================================
            STUDENT LOGIN
        ==================================================== */}
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
                    strokeWidth="2"
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

        {/* ===================================================
            SIGN UP
        ==================================================== */}
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

        {/* ===================================================
            TEACHER LOGIN
        ==================================================== */}
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

      {/* الشريك التجاري إن وجد */}
      {(partnerLabel || partnerName) && (
        <div className="partner-section">
          {partnerLabel && <div className="partner-label">{partnerLabel}</div>}
          {partnerName && <div className="partner-name">{partnerName}</div>}
        </div>
      )}

      {/* ذيل الصفحة السفلي المطابق للصورة */}
      <footer className="page-footer">
        <p className="developer-info">تطوير : نادر محمد أبو سليمان</p>
        <p className="copyright-info">© Developed by Nader Sulieman</p>
        <Footer />
      </footer>

      {/* =====================================================
          CSS STYLES
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
          max-width: 480px;
          margin: 0 auto;
          background: linear-gradient(180deg, #edf5fd 0%, #e1effc 40%, #d5e7f8 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 24px;
          overflow-x: hidden;
          box-shadow: 0 0 50px rgba(0,0,0,0.05);
        }

        /* الخلفية والدوائر الشفافة */
        .bg-decorations {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        .bg-circle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%);
        }

        .circle-top-left {
          width: 320px;
          height: 320px;
          top: -100px;
          left: -120px;
        }

        .circle-center-right {
          width: 280px;
          height: 280px;
          top: 180px;
          right: -100px;
        }

        /* القسم العلوي (الصورة والأسماء) */
        .hero-section {
          position: relative;
          width: 100%;
          height: 340px;
          z-index: 1;
        }

        /* معلومات المعلم الجانبية اليسرى */
        .teacher-info {
          position: absolute;
          top: 75px;
          left: 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          z-index: 3;
        }

        .teacher-name {
          margin: 0;
          font-size: 23px;
          font-weight: 800;
          color: #0d3660;
          letter-spacing: -0.3px;
          line-height: 1.1;
        }

        .brush-stroke-wrapper {
          width: 125px;
          height: 10px;
          margin-top: 3px;
          margin-bottom: 8px;
        }

        .brush-stroke-wrapper svg {
          width: 100%;
          height: 100%;
        }

        .teacher-subtitle {
          font-family: Arial, sans-serif;
          font-size: 13px;
          color: #7b9ebc;
          letter-spacing: 2px;
          font-weight: 500;
        }

        /* المقولة المائلة بخط اليد */
        .motto-box {
          position: absolute;
          top: 32px;
          right: 28px;
          text-align: left;
          direction: ltr;
          transform: rotate(-10deg);
          font-family: 'Caveat', cursive;
          color: rgba(135, 175, 212, 0.55);
          font-size: 21px;
          line-height: 1.05;
          font-weight: 700;
          z-index: 2;
        }

        .motto-box p {
          margin: 0;
        }

        .motto-underline {
          width: 50px;
          height: 6px;
          margin-top: 2px;
        }

        /* صورة المعلم */
        .teacher-photo-wrapper {
          position: absolute;
          top: 15px;
          right: 5px;
          width: 290px;
          height: 340px;
          z-index: 2;
          cursor: pointer;
        }

        .teacher-photo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: bottom right;
          filter: drop-shadow(0 10px 15px rgba(0,0,0,0.03));
        }

        /* كارت تسجيل الدخول */
        .auth-card {
          position: relative;
          z-index: 10;
          width: calc(100% - 40px);
          margin-top: -30px;
          background: #ffffff;
          border-radius: 28px;
          padding: 32px 24px;
          box-shadow: 0 12px 35px rgba(22, 60, 100, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .card-header {
          text-align: center;
          margin-bottom: 20px;
          width: 100%;
        }

        .card-title {
          margin: 0 0 20px 0;
          font-size: 24px;
          font-weight: 800;
          color: #0f3c68;
          text-align: center;
        }

        .card-subtitle {
          margin: 6px 0 0 0;
          font-size: 13px;
          color: #7b91a7;
          font-weight: 500;
        }

        .auth-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .signup-form {
          gap: 14px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .label-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
        }

        .input-label {
          font-size: 15px;
          font-weight: 700;
          color: #123e6b;
        }

        .label-icon {
          width: 18px;
          height: 18px;
          color: #2b77e5;
        }

        .auth-input {
          width: 100%;
          height: 52px;
          padding: 0 16px;
          background-color: #f3f6f9;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          font-size: 15px;
          color: #1a202c;
          outline: none;
          transition: all 0.2s ease;
          text-align: right;
        }

        .auth-input::placeholder {
          color: #a0aec0;
          font-size: 14px;
        }

        .auth-input:focus {
          background-color: #ffffff;
          border-color: #2b77e5;
          box-shadow: 0 0 0 3px rgba(43, 119, 229, 0.12);
        }

        .select-input {
          cursor: pointer;
        }

        .submit-btn {
          width: 100%;
          height: 54px;
          margin-top: 6px;
          background: #2575fc;
          background: linear-gradient(135deg, #2b77e5 0%, #1e62cf 100%);
          border: none;
          border-radius: 14px;
          color: #ffffff;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(43, 119, 229, 0.3);
          transition: all 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(43, 119, 229, 0.38);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .toggle-view {
          margin-top: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 14px;
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

        /* الشريك */
        .partner-section {
          margin-top: 16px;
          text-align: center;
          z-index: 5;
        }

        .partner-label {
          font-size: 12px;
          color: #7b91a7;
        }

        .partner-name {
          font-size: 14px;
          font-weight: 700;
          color: #123e6b;
        }

        /* ذيل الصفحة السفلي المطابق للصورة */
        .page-footer {
          margin-top: 28px;
          text-align: center;
          z-index: 5;
        }

        .developer-info {
          margin: 0;
          font-size: 13.5px;
          color: #7890a8;
          font-weight: 600;
        }

        .copyright-info {
          margin: 3px 0 0 0;
          font-size: 13px;
          color: #7890a8;
          font-weight: 600;
          direction: ltr;
        }
      `}</style>
    </div>
  );
}
