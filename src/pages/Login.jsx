import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';

const EMAIL_DOMAIN = 'maselite';

export default function Login() {
  // 'student' | 'signup' | 'teacher'
  const [view, setView] = useState('student');
  const [loading, setLoading] = useState(false);

  // حقول الطالب
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');

  // حقول المعلم
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // 🕵️ عدّاد النقر السري على الشعار
  const [secretClicks, setSecretClicks] = useState(0);

  const navigate = useNavigate();

  // ============ بوابة المعلم السرية ============
  useEffect(() => {
    // رابط مباشر: /login?teacher=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('teacher') === '1') {
      setView('teacher');
    }

    // اختصار لوحة المفاتيح: Ctrl + Shift + T
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

  // 🖱️ 5 نقرات متتالية على الشعار
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
    setTimeout(() => setSecretClicks(0), 2000);
  };

  const resetForm = () => {
    setStudentId('');
    setFullName('');
    setBranch('');
    setPhone('');
    setTeacherUsername('');
    setTeacherPassword('');
  };

  const goToTeacherLogin = () => {
    resetForm();
    setView('teacher');
  };

  const goToStudentLogin = () => {
    resetForm();
    setView('student');
  };

  const goToSignup = () => {
    setView('signup');
  };

  // ============================
  // 1) تسجيل دخول الطالب
  // ============================
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    if (!id) { toast.error('الرجاء إدخال رقم الهوية'); return; }
    if (!/^\d+$/.test(id)) { toast.error('رقم الهوية يجب أن يتكون من أرقام فقط'); return; }
    if (id.length !== 9) { toast.error('رقم الهوية يجب أن يكون 9 أرقام'); return; }

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

  // ============================
  // 2) إنشاء حساب طالب جديد
  // ============================
  const handleStudentSignup = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    if (!id) { toast.error('رقم الهوية مطلوب'); return; }
    if (!/^\d{9}$/.test(id)) { toast.error('رقم الهوية يجب أن يكون 9 أرقام'); return; }
    if (!fullName.trim() || fullName.trim().split(/\s+/).length < 4) {
      toast.error('الرجاء إدخال الاسم الرباعي كاملاً');
      return;
    }
    if (!branch) { toast.error('الرجاء اختيار الفرع الدراسي'); return; }
    if (!phone.trim()) { toast.error('الرجاء إدخال رقم الجوال'); return; }
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

      if (!signUpData.user) throw new Error('فشل إنشاء الحساب');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: signUpData.user.id,
          nationalID: id,
          name: fullName.trim(),
          role: 'student',
          branch: branch,
          phone: phone.trim(),
        }]);

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

  // ============================
  // 3) تسجيل دخول المعلم
  // ============================
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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
    <div className="auth-page-container">

      {/* ============================================================ */}
      {/* Hero Section - قسم البطل                                      */}
      {/* ============================================================ */}
      <div className="hero-section">
        <div className="hero-inner">

          {/* الاسم والمسمى الوظيفي - على اليسار */}
          <div className="hero-name-block">
            <h1 className="hero-name">أ. محمد أبو سليمان</h1>
            <div className="hero-underline"></div>
            <p className="hero-job">English Teacher</p>
          </div>

          {/* صورة المعلم */}
          <div className="hero-image-wrapper">
            <img
              src="/hero-teacher.png"
              alt="أ. محمد أبو سليمان"
              className="hero-image"
              draggable={false}
            />
          </div>

          {/* الشعار الإنجليزي - على اليمين */}
          <div className="hero-tagline">
            <span>Better</span>
            <span>English</span>
            <span>Bigger</span>
            <span>Dreams</span>
            <div className="hero-tagline-underline"></div>
          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/* Auth Card                                                     */}
      {/* ============================================================ */}
      <div className="auth-card">

        {/* ============ شاشة تسجيل دخول الطالب ============ */}
        {view === 'student' && (
          <>
            <h1 className="auth-title">تسجيل الدخول</h1>

            <form onSubmit={handleStudentLogin} className="auth-form">
              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  رقم الهوية
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\s/g, ''))}
                    placeholder="أدخل رقم الهوية"
                    maxLength={9}
                    required
                    className="auth-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري التحميل...' : 'دخول الاختبار'}
              </button>
            </form>

            <div className="toggle-view">
              <p>
                ليس لديك حساب؟{' '}
                <span onClick={goToSignup}>إنشاء حساب جديد</span>
              </p>
            </div>
          </>
        )}

        {/* ============ شاشة إنشاء حساب ============ */}
        {view === 'signup' && (
          <>
            <h1 className="auth-title">إنشاء حساب جديد</h1>

            <form onSubmit={handleStudentSignup} className="auth-form">
              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                    <line x1="7" y1="9" x2="17" y2="9"></line>
                    <line x1="7" y1="13" x2="17" y2="13"></line>
                    <line x1="7" y1="17" x2="13" y2="17"></line>
                  </svg>
                  رقم الهوية <span className="required-star">*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\s/g, ''))}
                    placeholder="مثال: 123456789"
                    maxLength={9}
                    required
                    className="auth-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  الاسم الرباعي <span className="required-star">*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: نادر محمد حسن أبو سليمان"
                    required
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                  </svg>
                  الفرع الدراسي <span className="required-star">*</span>
                </label>
                <div className="input-wrapper">
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                    className="auth-input"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="" disabled>— اختر الفرع —</option>
                    <option value="العلمي">العلمي</option>
                    <option value="الأدبي">الأدبي</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                  رقم الجوال <span className="required-star">*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))}
                    placeholder="059xxxxxxx"
                    maxLength={10}
                    required
                    className="auth-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    جاري إنشاء الحساب...
                  </>
                ) : (
                  'إنشاء الحساب'
                )}
              </button>
            </form>

            <div className="toggle-view">
              <p>
                لديك حساب بالفعل؟{' '}
                <span onClick={goToStudentLogin}>تسجيل الدخول</span>
              </p>
            </div>
          </>
        )}

        {/* ============ شاشة دخول المعلم (سرية) ============ */}
        {view === 'teacher' && (
          <>
            <h1 className="auth-title">بوابة المعلم</h1>

            <form onSubmit={handleTeacherLogin} className="auth-form">
              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  اسم المستخدم
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                    required
                    autoComplete="username"
                    className="auth-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  كلمة المرور
                </label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="•••••••"
                    required
                    autoComplete="current-password"
                    className="auth-input"
                    style={{ direction: 'rtl', textAlign: 'right' }}
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري التحقق...' : 'دخول لوحة المعلم'}
              </button>
            </form>

            <div className="toggle-view">
              <p>
                لست معلماً؟{' '}
                <span onClick={goToStudentLogin}>العودة لتسجيل الدخول</span>
              </p>
            </div>
          </>
        )}

      </div>

      {/* Footer مخصص مطابق للصورة */}
      <footer className="app-footer">
        <p>تطوير : نادر محمد أبو سليمان</p>
        <p>© Developed by <b>Nader Sulieman</b></p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');

        :root { color-scheme: light only; }
        * { box-sizing: border-box; }

        body, html {
          margin: 0; padding: 0;
          font-family: 'Cairo', sans-serif;
          background: #eef5ff; color: #1e293b;
        }

        input, select, button, textarea { font-family: 'Cairo', sans-serif; }

        /* ============================================================
           الحاوية الرئيسية
           ============================================================ */
        .auth-page-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          direction: rtl;
          background: linear-gradient(180deg, #dbeafe 0%, #e8f1fc 40%, #eef5ff 100%);
          padding: 0 0 20px 0;
          position: relative;
          overflow-x: hidden;
        }

        /* ============================================================
           Hero Section
           ============================================================ */
        .hero-section {
          width: 100%;
          max-width: 560px;
          position: relative;
          padding: 20px 24px 0;
          margin-bottom: -30px;
          z-index: 1;
        }

        .hero-inner {
          position: relative;
          width: 100%;
          min-height: 320px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        /* صورة المعلم */
        .hero-image-wrapper {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: center;
          align-items: flex-end;
          width: 100%;
          max-width: 340px;
        }

        .hero-image {
          width: 100%;
          max-width: 340px;
          height: auto;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
          filter: drop-shadow(0 20px 30px rgba(30, 64, 175, 0.15));
          animation: heroFadeIn 0.8s ease-out both;
        }

        /* اسم المعلم (يسار) */
        .hero-name-block {
          position: absolute;
          top: 20%;
          right: auto;
          left: 0;
          z-index: 3;
          text-align: right;
          animation: heroSlideRight 0.8s ease-out 0.2s both;
        }

        .hero-name {
          font-size: 22px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0;
          line-height: 1.3;
          letter-spacing: -0.5px;
          white-space: nowrap;
        }

        .hero-underline {
          width: 70px;
          height: 3px;
          background: linear-gradient(90deg, #2563eb, #60a5fa);
          border-radius: 3px;
          margin: 6px 0 0 auto;
          margin-right: 0;
        }

        .hero-job {
          font-size: 14px;
          font-weight: 500;
          color: #3b82f6;
          margin: 8px 0 0 0;
          letter-spacing: 1.5px;
          white-space: nowrap;
        }

        /* الشعار الإنجليزي (يمين أعلى) */
        .hero-tagline {
          position: absolute;
          top: 5%;
          right: 0;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          animation: heroSlideLeft 0.8s ease-out 0.3s both;
        }

        .hero-tagline span {
          font-family: 'Georgia', 'Times New Roman', serif;
          font-style: italic;
          font-size: 20px;
          font-weight: 500;
          color: #93c5fd;
          line-height: 1.15;
          letter-spacing: 0.5px;
        }

        .hero-tagline-underline {
          width: 50px;
          height: 2px;
          background: #93c5fd;
          border-radius: 2px;
          margin-top: 4px;
          transform: rotate(-8deg);
        }

        /* ============================================================
           Auth Card
           ============================================================ */
        .auth-card {
          background: #ffffff;
          width: calc(100% - 32px);
          max-width: 500px;
          padding: 32px 28px 28px;
          border-radius: 32px 32px 24px 24px;
          box-shadow: 0 20px 50px rgba(30, 64, 175, 0.12);
          z-index: 2;
          position: relative;
          margin-top: -40px;
        }

        .auth-title {
          text-align: center;
          color: #1e3a8a;
          margin: 0 0 26px 0;
          font-size: 26px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .auth-form { display: flex; flex-direction: column; gap: 18px; }

        .input-group label {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          font-size: 15px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 10px;
        }
        .label-icon { width: 18px; height: 18px; color: #3b82f6; }
        .required-star { color: #ef4444; font-weight: 700; }

        .input-wrapper input, .input-wrapper select {
          width: 100%;
          padding: 16px 18px;
          border: 1.5px solid #dbeafe;
          border-radius: 14px;
          font-size: 15px;
          background: #f8fafc;
          color: #1e293b;
          transition: all 0.25s ease;
          text-align: right;
          outline: none;
        }
        .input-wrapper input::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }
        .input-wrapper input:focus, .input-wrapper select:focus {
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(37, 99, 235, 0.4);
        }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .toggle-view {
          text-align: center;
          margin-top: 20px;
          font-size: 15px;
          color: #64748b;
          font-weight: 500;
        }
        .toggle-view span {
          color: #2563eb;
          cursor: pointer;
          font-weight: 800;
          margin-right: 4px;
        }
        .toggle-view span:hover { text-decoration: underline; }

        /* ============================================================
           Footer
           ============================================================ */
        .app-footer {
          padding: 24px 20px 16px;
          text-align: center;
          font-size: 13px;
          color: #64748b;
          background: transparent;
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          line-height: 1.6;
        }
        .app-footer p { margin: 0; }

        /* ============================================================
           Animations
           ============================================================ */
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroSlideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes heroSlideLeft {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* ============================================================
           Responsive
           ============================================================ */
        @media (max-width: 480px) {
          .hero-section { padding: 12px 16px 0; min-height: 260px; }
          .hero-inner { min-height: 260px; }
          .hero-image { max-width: 240px; }
          .hero-image-wrapper { max-width: 240px; }
          .hero-name { font-size: 17px; }
          .hero-job { font-size: 12px; letter-spacing: 1px; }
          .hero-tagline span { font-size: 15px; }
          .hero-name-block { top: 15%; }
          .hero-tagline { top: 2%; }
          .auth-card {
            padding: 26px 20px 24px;
            border-radius: 28px 28px 20px 20px;
          }
          .auth-title { font-size: 22px; margin-bottom: 20px; }
          .input-wrapper input, .input-wrapper select { padding: 14px 16px; font-size: 14px; }
          .submit-btn { padding: 15px; font-size: 16px; }
        }

        @media (min-width: 481px) and (max-width: 768px) {
          .hero-image { max-width: 300px; }
          .hero-name { font-size: 20px; }
          .hero-tagline span { font-size: 18px; }
        }
      `}</style>
    </div>
  );
}
