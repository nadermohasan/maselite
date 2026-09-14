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

  // حقول الطالب
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');

  // حقول المعلم
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  const [partnerLabel, setPartnerLabel] = useState('');
  const [partnerName, setPartnerName] = useState('');

  const navigate = useNavigate();

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

  // ============================
  // تسجيل دخول الطالب
  // ============================
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    if (!id) { toast.error('الرجاء إدخال رقم الهوية'); return; }
    if (!/^\d+$/.test(id)) { toast.error('رقم الهوية يجب أن يتكون من أرقام فقط'); return; }
    if (id.length !== 9) { toast.error('رقم الهوية يجب أن يكون 9 أرقام'); return; }

    setLoading(true);

    try {
      // 1. التحقق من وجود الحساب في profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('nationalID', id)
        .maybeSingle();

      // 2. إذا لم يكن مسجل → انتقل لصفحة إنشاء الحساب
      if (!profile) {
        setView('signup');
        setLoading(false);
        toast('رقم الهوية غير مسجل. أكمل بياناتك لإنشاء حساب', { icon: '📝' });
        return;
      }

      // 3. إذا كان الحساب موجود لكن دوره غير طالب
      if (profile.role !== 'student') {
        toast.error('هذا الحساب غير مصرح له بالدخول كطالب');
        setLoading(false);
        return;
      }

      // 4. محاولة تسجيل الدخول
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

      // 5. توجيه الطالب مباشرة للاختبار عبر /dashboard (StudentRedirect)
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  // ============================
  // إنشاء حساب طالب جديد
  // ============================
  const handleStudentSignup = async (e) => {
    e.preventDefault();
    const id = studentId.trim();

    if (!id) { toast.error('رقم الهوية مطلوب'); return; }
    if (!/^\d{9}$/.test(id)) { toast.error('رقم الهوية يجب أن يكون 9 أرقام'); return; }
    if (!fullName.trim()) { toast.error('الرجاء إدخال الاسم الرباعي'); return; }
    if (!branch) { toast.error('الرجاء اختيار الفرع الدراسي'); return; }
    if (!phone.trim()) { toast.error('الرجاء إدخال رقم الجوال'); return; }
    if (!/^(059|056)\d{7}$/.test(phone.trim())) { toast.error('رقم الجوال غير صحيح'); return; }

    setLoading(true);

    try {
      const email = `${id}@${EMAIL_DOMAIN}`;

      // 1. إنشاء حساب auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: id,
      });

      if (signUpError) {
        // في حال وُجد الحساب مسبقاً
        if (signUpError.message?.includes('already') || signUpError.message?.includes('duplicate')) {
          toast.error('هذا الحساب موجود بالفعل. جرب تسجيل الدخول');
          setView('student');
          setLoading(false);
          return;
        }
        throw signUpError;
      }

      if (!signUpData.user) throw new Error('فشل إنشاء الحساب');

      // 2. إنشاء الملف الشخصي
      const { error: profileError } = await supabase.from('profiles').insert([{
        id: signUpData.user.id,
        nationalID: id,
        name: fullName.trim(),
        role: 'student',
        branch,
        phone: phone.trim(),
      }]);

      if (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }

      toast.success('تم إنشاء حسابك بنجاح!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('فشل إنشاء الحساب: ' + (err.message || 'خطأ غير معروف'));
      setLoading(false);
    }
  };

  // ============================
  // تسجيل دخول المعلم
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
      <div className="top-logo-container">
        <div className="premium-logo-wrapper">
          <img src="https://i.imgur.com/ETr3K2d.png" alt="النخبة" className="premium-logo-img" />
        </div>
      </div>

      <div className="partner-text">
        <div className="partner-label">{partnerLabel}</div>
        <div className="partner-name">{partnerName}</div>
      </div>

      <div className="auth-card">
        {/* ====== شاشة دخول الطالب ====== */}
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

            <div className="divider-or">
              <span>أو</span>
            </div>

            <button
              type="button"
              onClick={goToTeacherLogin}
              className="teacher-btn"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
              </svg>
              دخول المعلم
            </button>
          </>
        )}

        {/* ====== شاشة إنشاء حساب طالب ====== */}
        {view === 'signup' && (
          <>
            <h1 className="auth-title">إكمال بيانات التسجيل</h1>
            <p className="auth-subtitle">رقم الهوية: <strong>{studentId}</strong></p>

            <form onSubmit={handleStudentSignup} className="auth-form">
              <div className="input-group">
                <label>
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  الاسم الرباعي
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
                  الفرع الدراسي
                </label>
                <div className="input-wrapper">
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                    className="auth-input"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="" disabled>اختر الفرع</option>
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
                  رقم الجوال
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
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب والدخول'}
              </button>
            </form>

            <div className="toggle-view">
              <p>لديك حساب بالفعل؟ <span onClick={goToStudentLogin}>تسجيل الدخول</span></p>
            </div>
          </>
        )}

        {/* ====== شاشة دخول المعلم ====== */}
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
              <p>لست معلماً؟ <span onClick={goToStudentLogin}>العودة لتسجيل دخول الطالب</span></p>
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
        .premium-logo-img { width: 160px; height: auto; display: block; }

        .partner-text {
          text-align: center; padding: 8px 20px; border-radius: 40px;
          margin-bottom: 20px; display: inline-block;
        }
        .partner-label { font-size: 12px; font-weight: 500; color: #4a8ada; margin-bottom: -6px; }
        .partner-name { font-size: 16px; font-weight: 700; color: #2c5282; }

        .auth-card {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          width: 100%; max-width: 420px; padding: 30px;
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

        .submit-btn {
          width: 100%; padding: 14px; border: none; border-radius: 12px;
          background: linear-gradient(135deg, #4a8ada, #3b76c4);
          color: white; font-size: 16px; font-weight: 700; cursor: pointer;
          transition: 0.3s; box-shadow: 0 8px 15px rgba(74, 138, 218, 0.25);
          margin-top: 6px;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 20px rgba(74, 138, 218, 0.35);
        }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .teacher-btn {
          width: 100%; padding: 12px; border: 1.5px dashed #cbd5e1;
          background: #f8fafc; border-radius: 12px;
          color: #475569; font-size: 15px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: 0.2s;
        }
        .teacher-btn:hover {
          background: #eff6ff; border-color: #4a8ada; color: #2c5282;
        }

        .divider-or {
          text-align: center; margin: 16px 0 12px;
          position: relative;
        }
        .divider-or::before {
          content: ''; position: absolute; top: 50%; left: 0; right: 0;
          height: 1px; background: #e2e8f0; z-index: 0;
        }
        .divider-or span {
          background: #fff; padding: 0 12px; position: relative; z-index: 1;
          color: #94a3b8; font-size: 12px; font-weight: 600;
        }

        .toggle-view { text-align: center; margin-top: 18px; font-size: 14px; color: #4a5568; }
        .toggle-view span { color: #4a8ada; cursor: pointer; font-weight: 700; margin-right: 5px; }

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
