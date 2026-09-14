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

  // ============================================
  // STUDENT FORM FIELDS
  // ============================================

  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');

  // ============================================
  // TEACHER FORM FIELDS
  // ============================================

  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // ============================================
  // PARTNER DATA
  // ============================================

  const [partnerLabel, setPartnerLabel] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // ============================================
  // SECRET TEACHER ACCESS
  // ============================================

  const [secretClicks, setSecretClicks] = useState(0);

  const navigate = useNavigate();

  // ============================================
  // LOAD PARTNER.JSON
  // ============================================

  useEffect(() => {
    fetch('/partner.json')
      .then((res) => res.json())
      .then((data) => {
        setPartnerLabel(data.label);
        setPartnerName(data.name);
      })
      .catch(() => {
        setPartnerLabel('بالتعاون مع:');
        setPartnerName('');
      });
  }, []);

  // ============================================
  // SECRET TEACHER PORTAL
  // ============================================

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

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ============================================
  // SECRET LOGO CLICKS
  // ============================================

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

  // ============================================
  // RESET FORMS
  // ============================================

  const resetForm = () => {
    setStudentId('');
    setFullName('');
    setBranch('');
    setPhone('');

    setTeacherUsername('');
    setTeacherPassword('');
  };

  // ============================================
  // NAVIGATION BETWEEN VIEWS
  // ============================================

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

  // ============================================
  // 1) STUDENT LOGIN
  // ============================================

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
          {
            icon: '📝',
          }
        );

        return;
      }

      if (profile.role !== 'student') {
        toast.error(
          'هذا الحساب غير مصرح له بالدخول كطالب'
        );

        setLoading(false);

        return;
      }

      const email = `${id}@${EMAIL_DOMAIN}`;

      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password: id,
      });

      if (error || !data.user) {
        toast.error(
          'فشل تسجيل الدخول. تواصل مع الإدارة'
        );

        setLoading(false);

        return;
      }

      toast.success('تم تسجيل الدخول بنجاح');

      navigate('/dashboard', {
        replace: true,
      });
    } catch (err) {
      console.error(err);

      toast.error('حدث خطأ غير متوقع');

      setLoading(false);
    }
  };

  // ============================================
  // 2) STUDENT SIGNUP
  // ============================================

  const handleStudentSignup = async (e) => {
    e.preventDefault();

    const id = studentId.trim();

    if (!id) {
      toast.error('رقم الهوية مطلوب');
      return;
    }

    if (!/^\d{9}$/.test(id)) {
      toast.error(
        'رقم الهوية يجب أن يكون 9 أرقام'
      );

      return;
    }

    if (
      !fullName.trim() ||
      fullName.trim().split(/\s+/).length < 4
    ) {
      toast.error(
        'الرجاء إدخال الاسم الرباعي كاملاً'
      );

      return;
    }

    if (!branch) {
      toast.error(
        'الرجاء اختيار الفرع الدراسي'
      );

      return;
    }

    if (!phone.trim()) {
      toast.error(
        'الرجاء إدخال رقم الجوال'
      );

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

      const {
        data: existingProfile,
      } = await supabase
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

      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
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

      const {
        error: profileError,
      } = await supabase
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
        navigate('/dashboard', {
          replace: true,
        });
      }, 800);
    } catch (err) {
      console.error(
        'Signup error:',
        err
      );

      toast.error(
        'فشل إنشاء الحساب: ' +
          (err.message || 'خطأ غير معروف')
      );

      setLoading(false);
    }
  };

  // ============================================
  // 3) TEACHER LOGIN
  // ============================================

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
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
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

      const {
        data: profile,
      } = await supabase
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

      navigate('/teacher', {
        replace: true,
      });
    } catch (err) {
      console.error(err);

      toast.error('حدث خطأ غير متوقع');

      setLoading(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="auth-page-container">

      {/* ==================================================
          HERO SECTION
          ================================================== */}

      <section className="teacher-hero">

        {/* ----------------------------------------------
            Background decorative elements
            ---------------------------------------------- */}

        <div className="hero-circle hero-circle-1"></div>

        <div className="hero-circle hero-circle-2"></div>

        <div className="hero-shape hero-shape-1"></div>

        <div className="hero-shape hero-shape-2"></div>


        {/* ----------------------------------------------
            Teacher Image
            IMPORTANT:
            This layer is behind the authentication card.
            ---------------------------------------------- */}

        <div
          className="teacher-image-wrapper"
          onClick={handleLogoClick}
          title="English Teacher"
        >
          <img
            src={TEACHER_IMAGE}
            alt="أ. محمد أبو سليمان"
            className="teacher-image"
            draggable={false}
          />
        </div>


        {/* ----------------------------------------------
            Teacher Information
            ---------------------------------------------- */}

        <div className="teacher-info">

          <div className="teacher-name">
            أ. محمد أبو سليمان
          </div>

          <div className="teacher-role">
            English Teacher
          </div>

          <div className="teacher-line"></div>

          <div className="teacher-motto">
            Better
            <br />
            English
            <br />
            Bigger
            <br />
            Dreams
          </div>

        </div>

      </section>


      {/* ==================================================
          AUTH CARD
          This card intentionally overlaps the hero.
          It sits above the teacher image.
          ================================================== */}

      <div className="auth-card">


        {/* ==================================================
            STUDENT LOGIN
            ================================================== */}

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

              {/* ------------------------------------------
                  National ID
                  ------------------------------------------ */}

              <div className="input-group">

                <label>

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    />

                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />
                  </svg>

                  رقم الهوية

                </label>


                <div className="input-wrapper">

                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) =>
                      setStudentId(
                        e.target.value.replace(
                          /\s/g,
                          ''
                        )
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


              {/* ------------------------------------------
                  Submit
                  ------------------------------------------ */}

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


            {/* ------------------------------------------
                Signup Toggle
                ------------------------------------------ */}

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


        {/* ==================================================
            SIGN UP
            ================================================== */}

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

              {/* ------------------------------------------
                  National ID
                  ------------------------------------------ */}

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

                  <span className="required-star">
                    *
                  </span>

                </label>


                <div className="input-wrapper">

                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) =>
                      setStudentId(
                        e.target.value.replace(
                          /\s/g,
                          ''
                        )
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


              {/* ------------------------------------------
                  Full Name
                  ------------------------------------------ */}

              <div className="input-group">

                <label>

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >

                    <path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    />

                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />

                  </svg>

                  الاسم الرباعي

                  <span className="required-star">
                    *
                  </span>

                </label>


                <div className="input-wrapper">

                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(
                        e.target.value
                      )
                    }
                    placeholder="أدخل الاسم الرباعي"
                    required
                    className="auth-input"
                  />

                </div>

              </div>


              {/* ------------------------------------------
                  Branch
                  ------------------------------------------ */}

              <div className="input-group">

                <label>

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >

                    <path
                      d="M22 10v6M2 10l10-5 10 5-10 5z"
                    />

                    <path
                      d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"
                    />

                  </svg>

                  الفرع الدراسي

                  <span className="required-star">
                    *
                  </span>

                </label>


                <div className="input-wrapper">

                  <select
                    value={branch}
                    onChange={(e) =>
                      setBranch(
                        e.target.value
                      )
                    }
                    required
                    className="auth-input"
                  >

                    <option
                      value=""
                      disabled
                    >
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


              {/* ------------------------------------------
                  Phone
                  ------------------------------------------ */}

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

                  <span className="required-star">
                    *
                  </span>

                </label>


                <div className="input-wrapper">

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target.value.replace(
                          /\s/g,
                          ''
                        )
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


              {/* ------------------------------------------
                  Signup Button
                  ------------------------------------------ */}

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


            {/* ------------------------------------------
                Back To Login
                ------------------------------------------ */}

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


        {/* ==================================================
            TEACHER LOGIN
            ================================================== */}

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

              {/* ------------------------------------------
                  Username
                  ------------------------------------------ */}

              <div className="input-group">

                <label>

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >

                    <path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    />

                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />

                  </svg>

                  اسم المستخدم

                </label>


                <div className="input-wrapper">

                  <input
                    type="text"
                    value={teacherUsername}
                    onChange={(e) =>
                      setTeacherUsername(
                        e.target.value
                      )
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


              {/* ------------------------------------------
                  Password
                  ------------------------------------------ */}

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

                    <path
                      d="M7 11V7a5 5 0 0 1 10 0v4"
                    />

                  </svg>

                  كلمة المرور

                </label>


                <div className="input-wrapper">

                  <input
                    type="password"
                    value={teacherPassword}
                    onChange={(e) =>
                      setTeacherPassword(
                        e.target.value
                      )
                    }
                    placeholder="•••••••"
                    required
                    autoComplete="current-password"
                    className="auth-input"
                  />

                </div>

              </div>


              {/* ------------------------------------------
                  Teacher Login Button
                  ------------------------------------------ */}

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


            {/* ------------------------------------------
                Back To Student Login
                ------------------------------------------ */}

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


      {/* ==================================================
          PARTNER SECTION
          ================================================== */}

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


      {/* ==================================================
          FOOTER
          ================================================== */}

      <Footer />


      {/* ==================================================
          STYLES
          ================================================== */}

      <style>{`

        /* ==================================================
           FONT
           ================================================== */

        @import url(
          'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap'
        );


        /* ==================================================
           GLOBAL
           ================================================== */

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

          background: #e5f1fd;

          color: #26384d;
        }


        input,
        select,
        button,
        textarea {
          font-family: 'Cairo', sans-serif;
        }


        /* ==================================================
           MAIN PAGE
           ================================================== */

        .auth-page-container {

          position: relative;

          width: 100%;

          min-height: 100vh;

          display: flex;

          flex-direction: column;

          align-items: center;

          direction: rtl;

          overflow-x: hidden;

          background:

            radial-gradient(
              circle at 10% 18%,
              rgba(255, 255, 255, 0.72) 0%,
              rgba(255, 255, 255, 0) 27%
            ),

            radial-gradient(
              circle at 95% 68%,
              rgba(255, 255, 255, 0.42) 0%,
              rgba(255, 255, 255, 0) 30%
            ),

            linear-gradient(
              145deg,
              #edf6ff 0%,
              #e5f1fc 46%,
              #d9eafa 100%
            );

          padding:

            max(
              0px,
              env(safe-area-inset-top)
            )

            0

            max(
              24px,
              env(safe-area-inset-bottom)
            );
        }


        /* ==================================================
           HERO
           ================================================== */

        .teacher-hero {

          position: relative;

          width: 100%;

          max-width: 864px;

          height: 690px;

          flex-shrink: 0;

          overflow: visible;

          isolation: isolate;
        }


        /* ==================================================
           HERO CIRCLES
           ================================================== */

        .hero-circle {

          position: absolute;

          border-radius: 50%;

          pointer-events: none;

          z-index: 0;
        }


        .hero-circle-1 {

          width: 430px;

          height: 430px;

          left: -185px;

          top: 180px;

          background:
            rgba(255, 255, 255, 0.24);
        }


        .hero-circle-2 {

          width: 360px;

          height: 360px;

          right: -185px;

          bottom: -130px;

          background:
            rgba(255, 255, 255, 0.22);
        }


        /* ==================================================
           HERO GEOMETRIC SHAPES
           ================================================== */

        .hero-shape {

          position: absolute;

          pointer-events: none;

          z-index: 0;

          opacity: 0.25;
        }


        .hero-shape-1 {

          width: 260px;

          height: 260px;

          left: -115px;

          top: -40px;

          border-radius: 40px;

          transform: rotate(45deg);

          background:
            rgba(255, 255, 255, 0.20);
        }


        .hero-shape-2 {

          width: 260px;

          height: 260px;

          right: -170px;

          top: 370px;

          border-radius: 50%;

          background:
            rgba(105, 158, 218, 0.08);
        }


        /* ==================================================
           TEACHER IMAGE WRAPPER
           
           IMPORTANT:
           The image is a separate layer.
           
           z-index 2 = behind the card.
           ================================================== */

        .teacher-image-wrapper {

          position: absolute;

          right: -1%;

          bottom: -5px;

          width: 67%;

          height: 635px;

          display: flex;

          align-items: flex-end;

          justify-content: center;

          z-index: 2;

          cursor: default;

          user-select: none;

          pointer-events: auto;
        }


        /* ==================================================
           TEACHER IMAGE
           ================================================== */

        .teacher-image {

          position: relative;

          display: block;

          width: 100%;

          height: 100%;

          max-width: none;

          object-fit: contain;

          object-position: center bottom;

          filter:

            drop-shadow(
              0 18px 25px
              rgba(45, 84, 128, 0.10)
            );

          -webkit-user-drag: none;

          user-select: none;
        }


        /* ==================================================
           TEACHER INFORMATION
           ================================================== */

        .teacher-info {

          position: absolute;

          left: 8%;

          top: 285px;

          width: 43%;

          display: flex;

          flex-direction: column;

          align-items: flex-start;

          z-index: 6;

          pointer-events: none;

          direction: rtl;
        }


        /* ==================================================
           TEACHER NAME
           ================================================== */

        .teacher-name {

          color: #173f6b;

          font-size:

            clamp(
              24px,
              4.25vw,
              39px
            );

          line-height: 1.3;

          font-weight: 800;

          letter-spacing: -0.8px;

          white-space: nowrap;
        }


        /* ==================================================
           TEACHER ROLE
           ================================================== */

        .teacher-role {

          margin-top: 8px;

          color: #6b94bd;

          font-family: Arial, sans-serif;

          font-size: 17px;

          font-weight: 500;

          letter-spacing: 4px;

          direction: ltr;

          text-align: left;
        }


        /* ==================================================
           BLUE UNDERLINE
           ================================================== */

        .teacher-line {

          width: 63px;

          height: 4px;

          margin-top: 13px;

          border-radius: 99px;

          background: #347bc8;

          transform: rotate(-5deg);

          transform-origin: left center;
        }


        /* ==================================================
           TEACHER MOTTO
           ================================================== */

        .teacher-motto {

          position: absolute;

          left: 100%;

          top: -155px;

          width: 155px;

          color:
            rgba(75, 139, 205, 0.30);

          font-family: Arial, sans-serif;

          font-size: 22px;

          line-height: 1.12;

          font-weight: 700;

          letter-spacing: 1px;

          direction: ltr;

          text-align: left;

          transform: rotate(-5deg);
        }


        /* ==================================================
           AUTH CARD
           
           CRITICAL:
           The card has z-index 20.
           
           Teacher image = z-index 2
           Teacher info = z-index 6
           Card = z-index 20
           
           Therefore the card visually covers
           the lower part of the teacher.
           ================================================== */

        .auth-card {

          position: relative;

          width: calc(100% - 100px);

          max-width: 764px;

          margin-top: -4px;

          padding:
            50px
            38px
            35px;

          background:
            rgba(255, 255, 255, 0.97);

          border:
            1px solid
            rgba(255, 255, 255, 0.90);

          border-radius: 34px;

          box-shadow:

            0 25px 65px
            rgba(45, 84, 128, 0.11),

            0 5px 18px
            rgba(45, 84, 128, 0.05);

          backdrop-filter: blur(16px);

          -webkit-backdrop-filter: blur(16px);

          z-index: 20;
        }


        /* ==================================================
           CARD HEADER
           ================================================== */

        .card-header {

          text-align: center;

          margin-bottom: 29px;
        }


        .card-title {

          color: #173e69;

          font-size: 32px;

          line-height: 1.3;

          font-weight: 800;

          letter-spacing: -0.7px;
        }


        .card-subtitle {

          margin-top: 7px;

          color: #8b9caf;

          font-size: 13px;

          font-weight: 500;
        }


        /* ==================================================
           FORM
           ================================================== */

        .auth-form {

          display: flex;

          flex-direction: column;

          gap: 20px;
        }


        .input-group {

          width: 100%;
        }


        /* ==================================================
           LABEL
           ================================================== */

        .input-group label {

          display: flex;

          align-items: center;

          gap: 8px;

          margin-bottom: 9px;

          color: #596b7e;

          font-size: 14px;

          font-weight: 700;
        }


        /* ==================================================
           LABEL ICON
           ================================================== */

        .label-icon {

          width: 19px;

          height: 19px;

          color: #4a8bd3;

          flex-shrink: 0;
        }


        /* ==================================================
           REQUIRED STAR
           ================================================== */

        .required-star {

          color: #ef5350;

          font-weight: 800;
        }


        /* ==================================================
           INPUT WRAPPER
           ================================================== */

        .input-wrapper {

          width: 100%;
        }


        /* ==================================================
           INPUT
           ================================================== */

        .auth-input {

          width: 100%;

          height: 62px;

          padding:
            0 20px;

          border:
            1.5px solid
            #dfe8f1;

          border-radius: 18px;

          background:
            #f8fafc;

          color: #26384d;

          font-size: 15px;

          font-weight: 500;

          outline: none;

          transition:

            border-color 0.2s ease,

            background 0.2s ease,

            box-shadow 0.2s ease;
        }


        /* ==================================================
           INPUT PLACEHOLDER
           ================================================== */

        .auth-input::placeholder {

          color: #a9b5c2;

          opacity: 1;
        }


        /* ==================================================
           INPUT HOVER
           ================================================== */

        .auth-input:hover {

          border-color: #cbdbea;
        }


        /* ==================================================
           INPUT FOCUS
           ================================================== */

        .auth-input:focus {

          border-color: #5793d4;

          background: #fff;

          box-shadow:

            0 0 0 4px
            rgba(87, 146, 212, 0.09);
        }


        /* ==================================================
           SELECT
           ================================================== */

        select.auth-input {

          cursor: pointer;

          appearance: auto;
        }


        /* ==================================================
           SUBMIT BUTTON
           ================================================== */

        .submit-btn {

          width: 100%;

          height: 62px;

          margin-top: 4px;

          border: none;

          border-radius: 18px;

          background:

            linear-gradient(
              135deg,
              #5796dc 0%,
              #367cc8 100%
            );

          color: #fff;

          font-size: 19px;

          font-weight: 800;

          cursor: pointer;

          display: flex;

          align-items: center;

          justify-content: center;

          gap: 9px;

          box-shadow:

            0 11px 25px
            rgba(62, 126, 201, 0.21);

          transition:

            transform 0.2s ease,

            box-shadow 0.2s ease,

            opacity 0.2s ease;
        }


        /* ==================================================
           BUTTON HOVER
           ================================================== */

        .submit-btn:hover:not(:disabled) {

          transform: translateY(-2px);

          box-shadow:

            0 15px 30px
            rgba(62, 126, 201, 0.27);
        }


        /* ==================================================
           BUTTON ACTIVE
           ================================================== */

        .submit-btn:active:not(:disabled) {

          transform: translateY(0);
        }


        /* ==================================================
           BUTTON DISABLED
           ================================================== */

        .submit-btn:disabled {

          opacity: 0.65;

          cursor: not-allowed;
        }


        /* ==================================================
           LOADING SPINNER
           ================================================== */

        .btn-spinner {

          width: 18px;

          height: 18px;

          border:

            2px solid
            rgba(255, 255, 255, 0.35);

          border-top-color: #fff;

          border-radius: 50%;

          animation:

            spin
            0.7s
            linear
            infinite;
        }


        @keyframes spin {

          to {
            transform: rotate(360deg);
          }
        }


        /* ==================================================
           TOGGLE VIEW
           ================================================== */

        .toggle-view {

          display: flex;

          justify-content: center;

          align-items: center;

          flex-wrap: wrap;

          gap: 5px;

          margin-top: 22px;

          font-size: 14px;
        }


        /* ==================================================
           MUTED TEXT
           ================================================== */

        .toggle-muted {

          color: #68798c;
        }


        /* ==================================================
           TOGGLE LINK
           ================================================== */

        .toggle-link {

          color: #4489cf;

          font-weight: 800;

          cursor: pointer;

          transition:
            color 0.2s ease;
        }


        .toggle-link:hover {

          color: #286bb0;

          text-decoration: underline;
        }


        /* ==================================================
           PARTNER
           ================================================== */

        .partner-text {

          position: relative;

          z-index: 5;

          text-align: center;

          margin:
            30px auto 0;

          line-height: 1.35;
        }


        .partner-label {

          color: #7895b3;

          font-size: 12px;

          font-weight: 500;
        }


        .partner-name {

          color: #55799f;

          font-size: 15px;

          font-weight: 700;
        }


        /* ==================================================
           MOBILE
           
           Based on the attached reference:
           864 x 1536
           
           The hero remains tall.
           The teacher image is large.
           The card overlaps the image.
           ================================================== */

        @media (max-width: 600px) {


          /* ----------------------------------------------
             PAGE
             ---------------------------------------------- */

          .auth-page-container {

            padding:

              0

              0

              max(
                22px,
                env(safe-area-inset-bottom)
              );
          }


          /* ----------------------------------------------
             HERO
             ---------------------------------------------- */

          .teacher-hero {

            height: 688px;

            max-width: 100%;

            margin: 0;
          }


          /* ----------------------------------------------
             TEACHER IMAGE
             ---------------------------------------------- */

          .teacher-image-wrapper {

            right: -4%;

            bottom: -8px;

            width: 74%;

            height: 625px;

            z-index: 2;
          }


          .teacher-image {

            width: 100%;

            height: 100%;

            object-fit: contain;

            object-position:
              center bottom;
          }


          /* ----------------------------------------------
             TEACHER INFORMATION
             ---------------------------------------------- */

          .teacher-info {

            left: 8%;

            top: 310px;

            width: 50%;

            z-index: 6;
          }


          .teacher-name {

            font-size: 25px;

            line-height: 1.35;

            letter-spacing: -0.7px;
          }


          .teacher-role {

            margin-top: 7px;

            font-size: 13px;

            letter-spacing: 3px;
          }


          .teacher-line {

            width: 58px;

            height: 3px;

            margin-top: 10px;
          }


          /* ----------------------------------------------
             MOTTO
             ---------------------------------------------- */

          .teacher-motto {

            left: auto;

            right: -145px;

            top: -145px;

            width: 130px;

            font-size: 18px;

            line-height: 1.08;
          }


          /* ----------------------------------------------
             DECORATIVE CIRCLES
             ---------------------------------------------- */

          .hero-circle-1 {

            width: 390px;

            height: 390px;

            left: -205px;

            top: 250px;
          }


          .hero-circle-2 {

            width: 320px;

            height: 320px;

            right: -170px;

            bottom: -110px;
          }


          /* ----------------------------------------------
             DECORATIVE SHAPES
             ---------------------------------------------- */

          .hero-shape-1 {

            width: 220px;

            height: 220px;

            left: -115px;

            top: 20px;
          }


          /* ----------------------------------------------
             AUTH CARD
             ---------------------------------------------- */

          .auth-card {

            width:
              calc(100% - 52px);

            max-width: none;

            margin-top: 0;

            padding:

              43px

              37px

              31px;

            border-radius: 32px;

            z-index: 20;
          }


          /* ----------------------------------------------
             CARD HEADER
             ---------------------------------------------- */

          .card-header {

            margin-bottom: 27px;
          }


          .card-title {

            font-size: 29px;
          }


          .card-subtitle {

            font-size: 11px;
          }


          /* ----------------------------------------------
             FORM
             ---------------------------------------------- */

          .auth-form {

            gap: 18px;
          }


          /* ----------------------------------------------
             LABEL
             ---------------------------------------------- */

          .input-group label {

            font-size: 13px;

            margin-bottom: 8px;
          }


          /* ----------------------------------------------
             INPUT
             ---------------------------------------------- */

          .auth-input {

            height: 57px;

            border-radius: 17px;

            font-size: 14px;

            padding:
              0 17px;
          }


          /* ----------------------------------------------
             BUTTON
             ---------------------------------------------- */

          .submit-btn {

            height: 59px;

            border-radius: 17px;

            font-size: 17px;
          }


          /* ----------------------------------------------
             TOGGLE
             ---------------------------------------------- */

          .toggle-view {

            margin-top: 20px;

            font-size: 13px;
          }


          /* ----------------------------------------------
             PARTNER
             ---------------------------------------------- */

          .partner-text {

            margin-top: 28px;

            margin-bottom: 0;
          }


          .partner-label {

            font-size: 11px;
          }


          .partner-name {

            font-size: 14px;
          }

        }


        /* ==================================================
           SMALL PHONES
           ================================================== */

        @media (max-width: 380px) {


          /* ----------------------------------------------
             HERO
             ---------------------------------------------- */

          .teacher-hero {

            height: 610px;
          }


          /* ----------------------------------------------
             IMAGE
             ---------------------------------------------- */

          .teacher-image-wrapper {

            width: 76%;

            height: 555px;

            right: -5%;
          }


          /* ----------------------------------------------
             INFO
             ---------------------------------------------- */

          .teacher-info {

            left: 5%;

            top: 285px;

            width: 51%;
          }


          .teacher-name {

            font-size: 21px;
          }


          .teacher-role {

            font-size: 11px;

            letter-spacing: 2px;
          }


          /* ----------------------------------------------
             MOTTO
             ---------------------------------------------- */

          .teacher-motto {

            right: -120px;

            top: -120px;

            font-size: 15px;
          }


          /* ----------------------------------------------
             CARD
             ---------------------------------------------- */

          .auth-card {

            width:
              calc(100% - 30px);

            padding:

              34px

              18px

              25px;

            border-radius: 27px;
          }


          /* ----------------------------------------------
             TITLE
             ---------------------------------------------- */

          .card-title {

            font-size: 25px;
          }


          /* ----------------------------------------------
             INPUT
             ---------------------------------------------- */

          .auth-input {

            height: 54px;

            border-radius: 15px;
          }


          /* ----------------------------------------------
             BUTTON
             ---------------------------------------------- */

          .submit-btn {

            height: 56px;

            border-radius: 15px;

            font-size: 16px;
          }

        }

      `}</style>

    </div>
  );
}