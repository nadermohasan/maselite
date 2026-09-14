import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';ظظ
import { toast } from 'react-hot-toast';
import Footer from './Footer';

const EMAIL_DOMAIN = 'maselite';
const TEACHER_IMAGE = '/teacher.png';

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

  // 🕵️ عداد النقر السري
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
        setPartnerName('');
      });
  }, []);

  // ============ بوابة المعلم السرية ============
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('teacher') === '1') {
      setView('teacher');
    }

    const handleKeyDown = (e) => {
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 't'
      ) {
        e.preventDefault();
        resetForm();
        setView('teacher');
        toast.success('🔓 تم فتح بوابة المعلم');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 🖱️ النقر السري على صورة المعلم
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

        toast(
          'رقم الهوية غير مسجل. أكمل بياناتك لإنشاء حساب',
          { icon: '📝' }
        );

        return;
      }

      if (profile.role !== 'student') {
        toast.error('هذا الحساب غير مصرح له بالدخول كطالب');
        setLoading(false);
        return;
      }

      const email = `${id}@${EMAIL_DOMAIN}`;

      const { data, error } =
        await supabase.auth.signInWithPassword({
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

    if (!id) {
      toast.error('رقم الهوية مطلوب');
      return;
    }

    if (!/^\d{9}$/.test(id)) {
      toast.error('رقم الهوية يجب أن يكون 9 أرقام');
      return;
    }

    if (
      !fullName.trim() ||
      fullName.trim().split(/\s+/).length < 4
    ) {
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
      toast.error(
        'رقم الجوال غير صحيح (يجب أن يبدأ بـ 059 أو 056)'
      );
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
        toast.error(
          'رقم الهوية مسجل مسبقاً. جرب تسجيل الدخول'
        );

        setView('student');
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password: id,
        });

      if (signUpError) {
        if (
          signUpError.message?.includes('already') ||
          signUpError.message?.includes('duplicate')
        ) {
          toast.error(
            'هذا الحساب موجود بالفعل. جرب تسجيل الدخول'
          );

          setView('student');
          setLoading(false);
          return;
        }

        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error(
          'فشل إنشاء الحساب - لم يتم إنشاء المستخدم'
        );
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
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

        throw new Error(
          'فشل حفظ البيانات الشخصية: ' +
            profileError.message
        );
      }

      toast.success(
        'تم إنشاء حسابك بنجاح! جاري تحويلك...'
      );

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 800);
    } catch (err) {
      console.error('Signup error:', err);

      toast.error(
        'فشل إنشاء الحساب: ' +
          (err.message || 'خطأ غير معروف')
      );

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
      toast.error(
        'الرجاء إدخال اسم المستخدم وكلمة المرور'
      );
      return;
    }

    setLoading(true);

    const email = `${username}@${EMAIL_DOMAIN}`;

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error || !data.user) {
        toast.error(
          'اسم المستخدم أو كلمة المرور غير صحيحة'
        );

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

        toast.error(
          'هذا الحساب غير مصرح له بالدخول كمعلم'
        );

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

      {/* ============================================================
          HERO
      ============================================================ */}
      <section className="teacher-hero">

        {/* الخلفية الدائرية */}
        <div className="hero-glow hero-glow-one"></div>
        <div className="hero-glow hero-glow-two"></div>

        {/* النص */}
        <div className="teacher-info">

          <div className="teacher-name">
            أ. محمد أبو سليمان
          </div>

          <div className="teacher-role">
            English Teacher
          </div>

          <div className="teacher-line"></div>

          <div className="teacher-motto">
            Better English
            <br />
            <span>Bigger Dreams</span>
          </div>

        </div>

        {/* صورة المعلم */}
        <div
          className="teacher-image-wrapper"
          onClick={handleLogoClick}
          title="English Teacher"
        >
          <div className="number-shape">1</div>

          <img
            src="/teacher.png"
            alt="أ. محمد أبو سليمان"
            className="teacher-image"
            draggable={false}
          />
        </div>

      </section>


      {/* ============================================================
          PARTNER
      ============================================================ */}
      {(partnerLabel || partnerName) && (
        <div className="partner-text">
          {partnerLabel && (
            <div className="partner-label">
              {partnerLabel}
            </div>
          )}

          {partnerName && (
            <div className="partner-name">
              {partnerName}
            </div>
          )}
        </div>
      )}


      {/* ============================================================
          AUTH CARD
      ============================================================ */}
      <div className="auth-card">

        {/* ============================================================
            STUDENT LOGIN
        ============================================================ */}
        {view === 'student' && (
          <>
            <div className="card-header">

              <div className="card-title">
                تسجيل الدخول
              </div>

            </div>

            <form
              onSubmit={handleStudentLogin}
              className="auth-form"
            >

              <div className="input-group">

                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>

                  رقم الهوية
                </label>

                <div className="input-wrapper">
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) =>
                      setStudentId(
                        e.target.value.replace(/\s/g, '')
                      )
                    }
                    placeholder="أدخل رقم الهوية"
                    maxLength={9}
                    required
                    className="auth-input"
                    style={{
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  />
                </div>

              </div>


              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading
                  ? 'جاري التحميل...'
                  : 'دخول الاختبار'}
              </button>

            </form>

            <div className="toggle-view">
              <span className="toggle-muted">
                ليس لديك حساب؟
              </span>

              <span
                onClick={goToSignup}
                className="toggle-link"
              >
                إنشاء حساب جديد
              </span>
            </div>
          </>
        )}


        {/* ============================================================
            SIGN UP
        ============================================================ */}
        {view === 'signup' && (
          <>
            <div className="card-header">
              <div className="card-title">
                إنشاء حساب جديد
              </div>

              <div className="card-subtitle">
                أدخل بياناتك للبدء في الاختبارات الإلكترونية
              </div>
            </div>

            <form
              onSubmit={handleStudentSignup}
              className="auth-form"
            >

              {/* رقم الهوية */}
              <div className="input-group">
                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="16"
                      rx="2"
                    />
                    <line
                      x1="7"
                      y1="9"
                      x2="17"
                      y2="9"
                    />
                    <line
                      x1="7"
                      y1="13"
                      x2="17"
                      y2="13"
                    />
                    <line
                      x1="7"
                      y1="17"
                      x2="13"
                      y2="17"
                    />
                  </svg>

                  رقم الهوية
                  <span className="required-star">*</span>
                </label>

                <div className="input-wrapper">
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) =>
                      setStudentId(
                        e.target.value.replace(/\s/g, '')
                      )
                    }
                    placeholder="مثال: 123456789"
                    maxLength={9}
                    required
                    className="auth-input"
                    style={{
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  />
                </div>
              </div>


              {/* الاسم */}
              <div className="input-group">
                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>

                  الاسم الرباعي
                  <span className="required-star">*</span>
                </label>

                <div className="input-wrapper">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    placeholder="أدخل الاسم الرباعي"
                    required
                    className="auth-input"
                  />
                </div>
              </div>


              {/* الفرع */}
              <div className="input-group">
                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                  </svg>

                  الفرع الدراسي
                  <span className="required-star">*</span>
                </label>

                <div className="input-wrapper">
                  <select
                    value={branch}
                    onChange={(e) =>
                      setBranch(e.target.value)
                    }
                    required
                    className="auth-input"
                  >
                    <option value="" disabled>
                      — اختر الفرع —
                    </option>

                    <option value="العلمي">
                      العلمي
                    </option>

                    <option value="الأدبي">
                      الأدبي
                    </option>
                  </select>
                </div>
              </div>


              {/* الجوال */}
              <div className="input-group">
                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="5"
                      y="2"
                      width="14"
                      height="20"
                      rx="2"
                    />
                    <line
                      x1="12"
                      y1="18"
                      x2="12.01"
                      y2="18"
                    />
                  </svg>

                  رقم الجوال
                  <span className="required-star">*</span>
                </label>

                <div className="input-wrapper">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target.value.replace(/\s/g, '')
                      )
                    }
                    placeholder="059xxxxxxx"
                    maxLength={10}
                    required
                    className="auth-input"
                    style={{
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  />
                </div>
              </div>


              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
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
              <span className="toggle-muted">
                لديك حساب بالفعل؟
              </span>

              <span
                onClick={goToStudentLogin}
                className="toggle-link"
              >
                تسجيل الدخول
              </span>
            </div>
          </>
        )}


        {/* ============================================================
            TEACHER LOGIN
        ============================================================ */}
        {view === 'teacher' && (
          <>
            <div className="card-header">
              <div className="card-title">
                بوابة المعلم
              </div>

              <div className="card-subtitle">
                تسجيل الدخول إلى لوحة التحكم
              </div>
            </div>

            <form
              onSubmit={handleTeacherLogin}
              className="auth-form"
            >

              <div className="input-group">
                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>

                  اسم المستخدم
                </label>

                <div className="input-wrapper">
                  <input
                    type="text"
                    value={teacherUsername}
                    onChange={(e) =>
                      setTeacherUsername(e.target.value)
                    }
                    placeholder="اسم المستخدم"
                    required
                    autoComplete="username"
                    className="auth-input"
                    style={{
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  />
                </div>
              </div>


              <div className="input-group">
                <label>
                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="11"
                      rx="2"
                    />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>

                  كلمة المرور
                </label>

                <div className="input-wrapper">
                  <input
                    type="password"
                    value={teacherPassword}
                    onChange={(e) =>
                      setTeacherPassword(e.target.value)
                    }
                    placeholder="•••••••"
                    required
                    autoComplete="current-password"
                    className="auth-input"
                  />
                </div>
              </div>


              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading
                  ? 'جاري التحقق...'
                  : 'دخول لوحة المعلم'}
              </button>

            </form>

            <div className="toggle-view">
              <span
                onClick={goToStudentLogin}
                className="toggle-link"
              >
                العودة لتسجيل الدخول
              </span>
            </div>
          </>
        )}

      </div>


      {/* ============================================================
          FOOTER
      ============================================================ */}
      <Footer />


      {/* ============================================================
          STYLES
      ============================================================ */}
      <style>{`

        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');

        :root {
          color-scheme: light only;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
        }

        body {
          font-family: 'Cairo', sans-serif;
          background: #edf5ff;
          color: #1e293b;
        }

        input,
        select,
        button,
        textarea {
          font-family: 'Cairo', sans-serif;
        }


        /* ============================================================
           PAGE
        ============================================================ */

        .auth-page-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          direction: rtl;
          overflow-x: hidden;

          background:
            radial-gradient(
              circle at 20% 10%,
              rgba(255,255,255,0.9) 0%,
              transparent 32%
            ),
            linear-gradient(
              145deg,
              #f4f9ff 0%,
              #e9f3ff 45%,
              #dcecff 100%
            );

          padding:
            max(18px, env(safe-area-inset-top))
            18px
            max(24px, env(safe-area-inset-bottom));
        }


        /* ============================================================
           HERO
        ============================================================ */

        .teacher-hero {
          position: relative;
          width: 100%;
          max-width: 720px;
          min-height: 285px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin: 0 auto 8px;

          overflow: hidden;
          isolation: isolate;
        }


        /* دوائر الخلفية */

        .hero-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: -1;
        }

        .hero-glow-one {
          width: 340px;
          height: 340px;
          right: 50%;
          top: -110px;

          background:
            radial-gradient(
              circle,
              rgba(83, 143, 221, 0.13),
              rgba(83, 143, 221, 0)
            );
        }

        .hero-glow-two {
          width: 230px;
          height: 230px;
          left: -80px;
          bottom: -110px;

          background:
            radial-gradient(
              circle,
              rgba(79, 142, 222, 0.09),
              rgba(79, 142, 222, 0)
            );
        }


        /* ============================================================
           TEACHER INFO
        ============================================================ */

        .teacher-info {
          position: relative;
          z-index: 4;

          width: 47%;

          display: flex;
          flex-direction: column;
          align-items: flex-start;

          padding-right: 18px;

          margin-top: -8px;
        }

        .teacher-name {
          color: #203b5f;
          font-size: clamp(25px, 4vw, 38px);
          line-height: 1.3;
          font-weight: 800;
          letter-spacing: -0.8px;

          white-space: nowrap;
        }

        .teacher-role {
          color: #5e8fc9;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 3px;

          margin-top: 4px;
          direction: ltr;
        }

        .teacher-line {
          width: 58px;
          height: 3px;

          background: #4b8bd9;
          border-radius: 99px;

          margin-top: 11px;
        }

        .teacher-motto {
          margin-top: 18px;

          color: rgba(54, 101, 155, 0.17);

          font-family: Arial, sans-serif;
          font-size: 19px;
          line-height: 1.08;
          font-weight: 700;
          letter-spacing: 1px;

          direction: ltr;
          text-align: left;
        }

        .teacher-motto span {
          color: rgba(54, 101, 155, 0.27);
        }


        /* ============================================================
           TEACHER IMAGE
        ============================================================ */

        .teacher-image-wrapper {
          position: relative;

          width: 52%;
          height: 300px;

          display: flex;
          align-items: flex-end;
          justify-content: center;

          cursor: default;
          user-select: none;

          z-index: 3;
        }

        .number-shape {
          position: absolute;

          right: 12%;
          top: 8px;

          font-family: Arial, sans-serif;
          font-size: 280px;
          line-height: 0.85;
          font-weight: 900;

          color: rgba(68, 120, 187, 0.12);

          z-index: -1;
          pointer-events: none;
        }

        .teacher-image {
          position: relative;

          width: 100%;
          max-width: 390px;
          height: 100%;

          object-fit: contain;
          object-position: center bottom;

          display: block;

          filter:
            drop-shadow(
              0 18px 24px rgba(45, 84, 128, 0.12)
            );

          -webkit-user-drag: none;
        }


        /* ============================================================
           PARTNER
        ============================================================ */

        .partner-text {
          text-align: center;
          margin: 0 auto 15px;

          line-height: 1.2;
        }

        .partner-label {
          color: #7191b2;
          font-size: 11px;
          font-weight: 500;
        }

        .partner-name {
          color: #55789d;
          font-size: 14px;
          font-weight: 700;
        }


        /* ============================================================
           AUTH CARD
        ============================================================ */

        .auth-card {
          position: relative;

          width: 100%;
          max-width: 500px;

          background: rgba(255, 255, 255, 0.96);

          border-radius: 30px;

          padding: 31px 34px 25px;

          box-shadow:
            0 20px 55px rgba(53, 88, 124, 0.10),
            0 4px 15px rgba(53, 88, 124, 0.05);

          border: 1px solid rgba(255,255,255,0.8);

          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);

          z-index: 10;
        }


        /* ============================================================
           CARD HEADER
        ============================================================ */

        .card-header {
          text-align: center;
          margin-bottom: 23px;
        }

        .card-title {
          color: #263b55;

          font-size: 27px;
          line-height: 1.3;

          font-weight: 800;

          letter-spacing: -0.4px;
        }

        .card-subtitle {
          color: #8a9aad;

          font-size: 12px;
          font-weight: 500;

          margin-top: 6px;
        }


        /* ============================================================
           FORM
        ============================================================ */

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .input-group {
          width: 100%;
        }

        .input-group label {
          display: flex;
          align-items: center;
          gap: 7px;

          margin-bottom: 8px;

          color: #596a7d;

          font-size: 13px;
          font-weight: 700;
        }

        .label-icon {
          width: 18px;
          height: 18px;

          color: #5792d4;

          flex-shrink: 0;
        }

        .required-star {
          color: #ef5350;
          font-weight: 800;
        }


        /* ============================================================
           INPUT
        ============================================================ */

        .input-wrapper {
          width: 100%;
        }

        .auth-input {
          width: 100%;

          height: 57px;

          padding:
            0 17px;

          border:
            1.5px solid #e2eaf2;

          border-radius: 17px;

          background: #f8fafc;

          color: #243447;

          font-size: 14px;
          font-weight: 500;

          outline: none;

          transition:
            border-color 0.25s ease,
            box-shadow 0.25s ease,
            background 0.25s ease,
            transform 0.25s ease;
        }

        .auth-input::placeholder {
          color: #a8b2be;
          opacity: 1;
        }

        .auth-input:hover {
          border-color: #cddceb;
        }

        .auth-input:focus {
          border-color: #5792d4;

          background: #fff;

          box-shadow:
            0 0 0 4px rgba(87, 146, 212, 0.10);
        }

        select.auth-input {
          cursor: pointer;
          appearance: auto;
        }


        /* ============================================================
           SUBMIT BUTTON
        ============================================================ */

        .submit-btn {
          width: 100%;
          height: 58px;

          border: none;
          border-radius: 17px;

          margin-top: 4px;

          background:
            linear-gradient(
              135deg,
              #5796dc 0%,
              #397bc7 100%
            );

          color: #fff;

          font-size: 17px;
          font-weight: 800;

          cursor: pointer;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;

          box-shadow:
            0 10px 22px rgba(62, 126, 201, 0.22);

          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            opacity 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);

          box-shadow:
            0 14px 27px rgba(62, 126, 201, 0.28);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }


        /* ============================================================
           SPINNER
        ============================================================ */

        .btn-spinner {
          width: 17px;
          height: 17px;

          border:
            2px solid rgba(255,255,255,0.35);

          border-top-color: #fff;

          border-radius: 50%;

          animation:
            spin 0.7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }


        /* ============================================================
           TOGGLE
        ============================================================ */

        .toggle-view {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;

          margin-top: 19px;

          font-size: 13px;
        }

        .toggle-muted {
          color: #68788a;
        }

        .toggle-link {
          color: #4d8bcf;

          font-weight: 800;

          cursor: pointer;

          transition: color 0.2s ease;
        }

        .toggle-link:hover {
          color: #286bb0;
          text-decoration: underline;
        }


        /* ============================================================
           MOBILE
        ============================================================ */

        @media (max-width: 600px) {

          .auth-page-container {
            padding:
              10px
              12px
              max(22px, env(safe-area-inset-bottom));
          }

          .teacher-hero {
            min-height: 275px;
            margin-bottom: 0;
          }

          .teacher-info {
            position: absolute;

            left: 5%;
            bottom: 35px;

            width: 50%;

            padding: 0;

            align-items: flex-start;

            z-index: 5;
          }

          .teacher-name {
            font-size: clamp(21px, 6vw, 29px);
          }

          .teacher-role {
            font-size: 11px;
            letter-spacing: 2px;
          }

          .teacher-motto {
            font-size: 15px;
            margin-top: 13px;
          }

          .teacher-line {
            margin-top: 8px;
          }

          .teacher-image-wrapper {
            position: absolute;

            right: -2%;
            bottom: 0;

            width: 67%;
            height: 285px;
          }

          .number-shape {
            right: 8%;
            top: 10px;
            font-size: 250px;
          }

          .teacher-image {
            max-width: 330px;
          }

          .partner-text {
            margin-top: -2px;
            margin-bottom: 12px;
          }

          .auth-card {
            max-width: 100%;

            padding:
              26px
              18px
              22px;

            border-radius: 26px;
          }

          .card-title {
            font-size: 24px;
          }

          .card-header {
            margin-bottom: 20px;
          }

          .auth-form {
            gap: 15px;
          }

          .auth-input {
            height: 54px;
            border-radius: 15px;
          }

          .submit-btn {
            height: 55px;
            border-radius: 15px;
            font-size: 16px;
          }
        }


        /* ============================================================
           VERY SMALL PHONES
        ============================================================ */

        @media (max-width: 380px) {

          .teacher-hero {
            min-height: 250px;
          }

          .teacher-image-wrapper {
            width: 68%;
            height: 260px;
          }

          .teacher-info {
            bottom: 29px;
            left: 3%;
          }

          .teacher-name {
            font-size: 20px;
          }

          .teacher-role {
            font-size: 10px;
          }

          .teacher-motto {
            font-size: 13px;
          }

          .number-shape {
            font-size: 225px;
          }

          .auth-card {
            padding: 23px 15px 20px;
          }
        }

      `}</style>
    </div>
  );
}
