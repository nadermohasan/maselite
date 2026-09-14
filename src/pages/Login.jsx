import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import Footer from './Footer';

const EMAIL_DOMAIN = 'maselite';

export default function Login() {
  // 'student' | 'signup' | 'teacher'
  const [view, setView] = useState('student');
  const [loading, setLoading] = useState(false);

  // ============ حقول التسجيل / الدخول ============
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');

  // ============ حقول المعلم ============
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  const [partnerLabel, setPartnerLabel] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // 🕵️ عدّاد النقر السري على الشعار
  const [secretClicks, setSecretClicks] = useState(0);

  const navigate = useNavigate();

  // ============ تحميل partner.json ============
  useEffect(() => {
    fetch('/partner.json')
      .then(res => res.json())
      .then(data => {
        setPartnerLabel(data.label);
        setPartnerName(data.name);
      })
      .catch(() => {
        setPartnerLabel('بالتعاون مع:');
        setPartnerName('مركز ماكس');
      });
  }, []);

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
      // التحقق من وجود الحساب
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('nationalID', id)
        .maybeSingle();

      // إذا لم يكن مسجلاً → انتقل لصفحة التسجيل
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

      // تسجيل الدخول
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
  // 2) ⭐ إنشاء حساب طالب جديد
  // ============================
  const handleStudentSignup = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    // ============ التحقق من صحة البيانات ============
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

      // ============ 1) التحقق المسبق من عدم وجود الحساب ============
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

      // ============ 2) إنشاء الحساب في auth ============
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

      // ============ 3) إنشاء الملف الشخصي ============
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
        // لو فشل إنشاء الملف الشخصي، احذف الحساب من auth
        await supabase.auth.signOut();
        throw new Error('فشل حفظ البيانات الشخصية: ' + profileError.message);
      }

      // ============ 4) نجاح ✅ ============
      toast.success('تم إنشاء حسابك بنجاح! جاري تحويلك...');
      
      // التوجيه إلى /dashboard (التي ستعيد التوجيه إلى الاختبار أو تعرض رسالة)
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

      // التحقق من الدور
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
      {/* الشعار - انقر 5 مرات سريعاً لفتح بوابة المعلم */}
      <div className="top-logo-container">
        <div
          className="premium-logo-wrapper"
          onClick={handleLogoClick}
          style={{ cursor: 'default', userSelect: 'none' }}
        >
          <img
            src="https://i.imgur.com/ETr3K2d.png"
            alt="النخبة"
            className="premium-logo-img"
            draggable={false}
          />
        </div>
      </div>

      <div className="partner-text">
        <div className="partner-label">{partnerLabel}</div>
        <div className="partner-name">{partnerName}</div>
      </div>

      <div className="auth-card">

        {/* ============================================================ */}
        {/* 1) شاشة تسجيل دخول الطالب                                    */}
        {/* ============================================================ */}
        {view === 'student' && (
          <>
            <h1 className="auth-title">تسجيل دخول الطالب</h1>

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
                    placeholder="أدخل رقم الهوية المكوّن من 9 أرقام"
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

        {/* ============================================================ */}
        {/* 2) ⭐ شاشة إنشاء حساب طالب جديد (كاملة)                       */}
        {/* ============================================================ */}
        {view === 'signup' && (
          <>
            <h1 className="auth-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                width="22" height="22" style={{ verticalAlign: 'middle', marginLeft: '6px' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              إنشاء حساب جديد
            </h1>

            <form onSubmit={handleStudentSignup} className="auth-form">

              {/* رقم الهوية */}
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
                    placeholder="مثال: 406114967"
                    maxLength={9}
                    required
                    className="auth-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>
                <div className="input-hint">
                  يجب أن يكون 9 أرقام فقط
                </div>
              </div>

              {/* الاسم الرباعي */}
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
                <div className="input-hint">
                  أدخل الاسم الرباعي كاملاً (4 كلمات على الأقل)
                </div>
              </div>

              {/* الفرع الدراسي */}
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

              {/* رقم الجوال */}
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
                <div className="input-hint">
                  يبدأ بـ 059 أو 056 (10 أرقام)
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    جاري إنشاء الحساب...
                  </>
                ) : (
                  'إنشاء الحساب والدخول'
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

        {/* ============================================================ */}
        {/* 3) شاشة دخول المعلم (سرية)                                   */}
        {/* ============================================================ */}
        {view === 'teacher' && (
          <>
            <h1 className="auth-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                width="22" height="22" style={{ verticalAlign: 'middle', marginLeft: '6px' }}>
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
              </svg>
              دخول المعلم
            </h1>

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
                    placeholder="أدخل اسم المستخدم"
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
                <span onClick={goToStudentLogin}>العودة لتسجيل دخول الطالب</span>
              </p>
            </div>
          </>
        )}

      </div>

      <Footer />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');

        :root { color-scheme: light only; }
        * { box-sizing: border-box; }

        body, html {
          margin: 0; padding: 0;
          font-family: 'Cairo', sans-serif;
          background: #eef5ff; color: #1e293b;
        }

        input, select, button, textarea { font-family: 'Cairo', sans-serif; }

        .auth-page-container {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center; direction: rtl;
          background: linear-gradient(135deg, #eef5ff 0%, #d8e8fc 100%);
          padding: 20px;
        }

        .top-logo-container {
          margin-bottom: 15px; display: flex; justify-content: center; width: 100%;
        }
        .premium-logo-wrapper {
          position: relative; display: inline-block;
          animation: floating 4s ease-in-out infinite;
        }
        .premium-logo-img {
          width: 160px; height: auto; display: block;
          user-select: none; -webkit-user-drag: none;
        }

        .partner-text {
          text-align: center; padding: 8px 20px; border-radius: 40px;
          margin-bottom: 20px; display: inline-block;
        }
        .partner-label { font-size: 12px; font-weight: 500; color: #4a8ada; margin-bottom: -6px; }
        .partner-name { font-size: 16px; font-weight: 700; color: #2c5282; }

        .auth-card {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          width: 100%; max-width: 440px; padding: 30px;
          border-radius: 24px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .auth-title {
          text-align: center; color: #2c3e50;
          margin: 0 0 22px 0; font-size: 22px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .auth-subtitle {
          text-align: center; color: #64748b; font-size: 13px;
          margin: -14px 0 18px 0;
        }

        .auth-form { display: flex; flex-direction: column; gap: 16px; }

        .input-group label {
          display: flex; align-items: center; gap: 8px;
          font-size: 14px; font-weight: 600; color: #4a5568; margin-bottom: 7px;
        }
        .label-icon { width: 16px; height: 16px; color: #4a8ada; }
        .required-star { color: #ef4444; font-weight: 700; }

        .input-wrapper input, .input-wrapper select {
          width: 100%; padding: 13px 15px;
          border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-size: 14px; background: #f8fafc; color: #1e293b;
          transition: all 0.3s ease; text-align: right; outline: none;
        }
        .input-wrapper input:focus, .input-wrapper select:focus {
          border-color: #4a8ada; background: #ffffff;
          box-shadow: 0 0 0 4px rgba(74, 138, 218, 0.1);
        }

        .input-hint {
          font-size: 11px; color: #94a3b8;
          margin-top: 5px; padding-right: 4px;
        }

        .submit-btn {
          width: 100%; padding: 14px; border: none; border-radius: 12px;
          background: linear-gradient(135deg, #4a8ada, #3b76c4);
          color: white; font-size: 16px; font-weight: 700; cursor: pointer;
          transition: 0.3s; box-shadow: 0 8px 15px rgba(74, 138, 218, 0.25);
          margin-top: 6px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 20px rgba(74, 138, 218, 0.35);
        }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .toggle-view {
          text-align: center; margin-top: 18px;
          font-size: 14px; color: #4a5568;
        }
        .toggle-view span {
          color: #4a8ada; cursor: pointer;
          font-weight: 700; margin-right: 5px;
        }
        .toggle-view span:hover { text-decoration: underline; }

        @keyframes floating {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @media (max-width: 480px) {
          .premium-logo-img { width: 140px; }
          .auth-card { padding: 25px 18px; margin: 10px; }
        }
      `}</style>
    </div>
  );
}
