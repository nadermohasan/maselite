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

  // STUDENT DATA
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');

  // TEACHER DATA
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // PARTNER
  const [partnerLabel, setPartnerLabel] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // SECRET ACCESS
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
    <div className="app-viewport">
      <div className="login-container">
        
        {/* HERO HEADER */}
        <header className="hero-header">
          <div className="bg-circle circle-front" />

          <div className="teacher-meta">
            <h1 className="teacher-title">أ. محمد أبو سليمان</h1>
            
            <div className="brush-underline">
              <svg viewBox="0 0 100 10" fill="none" preserveAspectRatio="none">
                <path d="M2 5C30 2 70 2 98 5C70 4 30 4 2 5Z" fill="#2575e6" />
              </svg>
            </div>

            <span className="teacher-sub">English Teacher</span>
          </div>

          <div className="motto-handwritten">
            <div>Better</div>
            <div>English</div>
            <div>Bigger</div>
            <div>Dreams</div>
          </div>

          <div className="teacher-frame" onClick={handleLogoClick}>
            <img
              src={TEACHER_IMAGE}
              alt="أ. محمد أبو سليمان"
              className="teacher-img"
              draggable={false}
            />
          </div>
        </header>

        {/* AUTH CARD */}
        <main className="auth-card">
          {view === 'student' && (
            <>
              <h2 className="card-heading">تسجيل الدخول</h2>

              <form onSubmit={handleStudentLogin} className="auth-form">
                <div className="form-group">
                  <div className="label-wrapper">
                    <svg
                      className="field-icon"
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
                    <span className="field-label">رقم الهوية</span>
                  </div>

                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\s/g, ''))}
                    placeholder="أدخل رقم الهوية"
                    maxLength={9}
                    required
                    className="styled-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>

                <button type="submit" className="primary-btn" disabled={loading}>
                  {loading ? 'جاري التحميل...' : 'دخول الاختبار'}
                </button>
              </form>

              <div className="switch-prompt">
                <span className="prompt-text">ليس لديك حساب؟</span>
                <button type="button" onClick={goToSignup} className="prompt-link">
                  إنشاء حساب جديد
                </button>
              </div>
            </>
          )}

          {view === 'signup' && (
            <>
              <div className="card-header-sub">
                <h2 className="card-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                  إنشاء حساب جديد
                </h2>
                <p className="card-desc">أدخل بياناتك للبدء في الاختبارات الإلكترونية</p>
              </div>

              <form onSubmit={handleStudentSignup} className="auth-form compact-form">
                <div className="form-group">
                  <div className="label-wrapper">
                    <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                      <line x1="7" y1="9" x2="17" y2="9"></line>
                      <line x1="7" y1="13" x2="17" y2="13"></line>
                      <line x1="7" y1="17" x2="13" y2="17"></line>
                    </svg>
                    <span className="field-label">رقم الهوية <span className="required-star">*</span></span>
                  </div>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\s/g, ''))}
                    placeholder="مثال: 123456789"
                    maxLength={9}
                    required
                    className="styled-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>

                <div className="form-group">
                  <div className="label-wrapper">
                    <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span className="field-label">الاسم الرباعي <span className="required-star">*</span></span>
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: نادر محمد حسن أبو سليمان"
                    required
                    className="styled-input"
                  />
                </div>

                <div className="form-group">
                  <div className="label-wrapper">
                    <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                    </svg>
                    <span className="field-label">الفرع الدراسي <span className="required-star">*</span></span>
                  </div>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                    className="styled-input select-box"
                  >
                    <option value="" disabled>— اختر الفرع —</option>
                    <option value="العلمي">العلمي</option>
                    <option value="الأدبي">الأدبي</option>
                  </select>
                </div>

                <div className="form-group">
                  <div className="label-wrapper">
                    <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                    <span className="field-label">رقم الجوال <span className="required-star">*</span></span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))}
                    placeholder="059xxxxxxx"
                    maxLength={10}
                    required
                    className="styled-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>

                <button type="submit" className="primary-btn" disabled={loading}>
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

              <div className="switch-prompt">
                <span className="prompt-text">لديك حساب بالفعل؟</span>
                <button type="button" onClick={goToStudentLogin} className="prompt-link">
                  تسجيل الدخول
                </button>
              </div>
            </>
          )}

          {view === 'teacher' && (
            <>
              <div className="card-header-sub">
                <h2 className="card-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="22" height="22">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                  </svg>
                  بوابة المعلم
                </h2>
                <p className="card-desc">تسجيل الدخول إلى لوحة التحكم</p>
              </div>

              <form onSubmit={handleTeacherLogin} className="auth-form">
                <div className="form-group">
                  <div className="label-wrapper">
                    <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span className="field-label">اسم المستخدم</span>
                  </div>
                  <input
                    type="text"
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                    required
                    className="styled-input"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                </div>

                <div className="form-group">
                  <div className="label-wrapper">
                    <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span className="field-label">كلمة المرور</span>
                  </div>
                  <input
                    type="password"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="•••••••"
                    required
                    className="styled-input"
                    style={{ direction: 'rtl', textAlign: 'right' }}
                  />
                </div>

                <button type="submit" className="primary-btn" disabled={loading}>
                  {loading ? 'جاري التحقق...' : 'دخول لوحة المعلم'}
                </button>
              </form>

              <div className="switch-prompt">
                <button type="button" onClick={goToStudentLogin} className="prompt-link">
                  العودة لتسجيل الدخول
                </button>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Caveat:wght@600;700&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .app-viewport {
          width: 100%;
          min-height: 100vh;
          background: #dbeafb;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .login-container {
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          width: 100%;
          max-width: 420px;
          min-height: 100vh;
          background: linear-gradient(180deg, #e3effc 0%, #dbe8f7 40%, #e1eefb 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 24px;
          overflow: hidden;
        }

        /* ----------------------------------
           HERO HEADER & BACKGROUND CIRCLES
        ---------------------------------- */
        .hero-header {
          position: relative;
          width: 100%;
          height: 380px;
          overflow: hidden;
        }

        .bg-circle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .bg-circle.circle-back {
          top: 110px;
          right: -50px;
          width: 340px;
          height: 340px;
          background: #cce1f8;
          z-index: 1;
        }


        .teacher-meta {
          position: absolute;
          top: 172px;
          left: 25px;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .teacher-title {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
          color: #0a345c;
          letter-spacing: -0.3px;
          white-space: nowrap;
        }

        .brush-underline {
          width: 105px;
          height: 6px;
          margin-top: -8px;
          margin-bottom: 8px;
        }

        .brush-underline svg {
          width: 100%;
          height: 100%;
        }

        .teacher-sub {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13.5px;
          color: #6a8cb2;
          letter-spacing: 2px;
          font-weight: 600;
        }

        .motto-handwritten {
          position: absolute;
          top: 36px;
          right: 22px;
          z-index: 2;
          direction: ltr;
          text-align: left;
          transform: rotate(-9deg);
          font-family: 'Caveat', cursive;
          color: #9ac3ec;
          font-size: 22px;
          line-height: 1.05;
          font-weight: 700;
        }

        .motto-handwritten div {
          margin: 0;
        }

        .teacher-frame {
          position: absolute;
          top: 48px;
          right: -10px;
          width: 320px;
          height: 365px;
          z-index: 3;
          cursor: pointer;
          -webkit-mask-image: radial-gradient(ellipse at 55% 30%, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 72%),
                              linear-gradient(to bottom, rgba(0,0,0,1) 15%, rgba(0,0,0,0) 80%);
          -webkit-mask-composite: source-in;
          mask-image: radial-gradient(ellipse at 55% 30%, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 72%),
                      linear-gradient(to bottom, rgba(0,0,0,1) 15%, rgba(0,0,0,0) 115%);
          mask-composite: intersect;
        }

        .teacher-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: top right;
          transform: scale(1.18) translateY(10px);
          transform-origin: top right;
        }

        /* ----------------------------------
           AUTH CARD
        ---------------------------------- */
        .auth-card {
          position: relative;
          z-index: 10;
          width: calc(100% - 36px);
          margin-top: -26px;
          background: #ffffff;
          border-radius: 32px;
          padding: 34px 24px 28px 24px;
          box-shadow: 0 10px 30px rgba(10, 40, 80, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .card-heading {
          margin: 0 0 24px 0;
          font-size: 28px;
          font-weight: 900;
          color: #0a345c;
          text-align: center;
        }

        .card-header-sub {
          text-align: center;
          margin-bottom: 16px;
          width: 100%;
        }

        .card-desc {
          margin: -14px 0 16px 0;
          font-size: 13px;
          color: #728da9;
        }

        .auth-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .compact-form {
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .label-wrapper {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
        }

        .field-label {
          font-size: 15px;
          font-weight: 800;
          color: #0a345c;
        }

        .field-icon {
          width: 19px;
          height: 19px;
          color: #2575e6;
        }
        
        .required-star {
          color: #ef4444;
          font-weight: 700;
        }

        .styled-input {
          width: 100%;
          height: 54px;
          padding: 0 18px;
          background-color: #f8fafc;
          border: 1.5px solid #d8e5f2;
          border-radius: 16px;
          font-size: 15px;
          color: #0a345c;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          text-align: right;
          font-family: 'Cairo', sans-serif;
        }

        .styled-input::placeholder {
          color: #9cb2cb;
          font-size: 14.5px;
        }

        .styled-input:focus {
          background-color: #ffffff;
          border-color: #2575e6;
          box-shadow: 0 0 0 3.5px rgba(37, 117, 230, 0.12);
        }

        .select-box {
          cursor: pointer;
        }

        .primary-btn {
          width: 100%;
          height: 54px;
          margin-top: 6px;
          background: #2575e6;
          border: none;
          border-radius: 16px;
          color: #ffffff;
          font-size: 18px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(37, 117, 230, 0.25);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          font-family: 'Cairo', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(37, 117, 230, 0.32);
        }

        .primary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2.5px solid rgba(255, 255, 255, 0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }

        .switch-prompt {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 14.5px;
        }

        .prompt-text {
          color: #6883a0;
          font-weight: 600;
        }

        .prompt-link {
          background: none;
          border: none;
          padding: 0;
          color: #2575e6;
          font-weight: 800;
          font-family: inherit;
          font-size: inherit;
          cursor: pointer;
        }

        .prompt-link:hover {
          text-decoration: underline;
        }

        /* ----------------------------------
           FOOTER
        ---------------------------------- */
        .partner-credits {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .partner-label {
          font-size: 12px;
          color: #7793b1;
        }

        .partner-val {
          font-size: 14px;
          font-weight: 700;
          color: #0a345c;
        }

        .page-footer {
          margin-top: 28px;
          text-align: center;
        }

        .dev-ar {
          margin: 0;
          font-size: 13.5px;
          color: #7793b1;
          font-weight: 600;
        }

        .dev-en {
          margin: 2px 0 0 0;
          font-size: 13px;
          color: #7793b1;
          font-weight: 600;
          direction: ltr;
        }
      `}</style>
    </div>
  );
}
