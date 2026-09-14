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

  // ==============================
  // VIEW NAVIGATION
  // ==============================

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

      const { data, error } =
        await supabase.auth.signInWithPassword({
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

      const { data: existingProfile } =
        await supabase
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

      const { error: profileError } =
        await supabase.from('profiles').insert([
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

  // ==============================
  // TEACHER LOGIN
  // ==============================

  const handleTeacherLogin = async (e) => {
    e.preventDefault();

    const username =
      teacherUsername.trim();

    const password =
      teacherPassword;

    if (!username || !password) {
      toast.error(
        'الرجاء إدخال اسم المستخدم وكلمة المرور'
      );

      return;
    }

    setLoading(true);

    const email =
      `${username}@${EMAIL_DOMAIN}`;

    try {
      const {
        data,
        error,
      } =
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

      const { data: profile } =
        await supabase
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

      toast.error(
        'حدث خطأ غير متوقع'
      );

      setLoading(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="login-page">

      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      <div className="background-layer">

        <div className="background-circle circle-left" />

        <div className="background-circle circle-center" />

        <div className="background-circle circle-bottom" />

        <div className="background-shape shape-top-left" />

        <div className="background-shape shape-bottom-right" />

      </div>


      {/* =====================================================
          TOP VISUAL AREA
          EVERYTHING HERE IS BEHIND THE LOGIN CARD
      ====================================================== */}

      <div className="visual-layer">

        {/* Teacher image */}

        <div
          className="teacher-image-layer"
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


        {/* Teacher information */}

        <div className="teacher-information">

          <div className="teacher-name">
            أ. محمد أبو سليمان
          </div>

          <div className="teacher-line" />

          <div className="teacher-role">
            English Teacher
          </div>

        </div>


        {/* Motto */}

        <div className="teacher-motto">
          <div>Better</div>
          <div>English</div>
          <div>Bigger</div>
          <div>Dreams</div>

          <div className="motto-line" />
        </div>

      </div>


      {/* =====================================================
          LOGIN CARD
          THIS CARD IS ABOVE THE TEACHER IMAGE
      ====================================================== */}

      <main className="auth-card">

        {/* ===================================================
            STUDENT LOGIN
        ==================================================== */}

        {view === 'student' && (
          <>

            <div className="card-header">

              <h1 className="card-title">
                تسجيل الدخول
              </h1>

            </div>


            <form
              onSubmit={handleStudentLogin}
              className="auth-form"
            >

              <div className="input-group">

                <label className="input-label">

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />
                  </svg>

                  <span>
                    رقم الهوية
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

              <button
                type="button"
                onClick={goToSignup}
                className="toggle-link"
              >
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

              <h1 className="card-title">
                إنشاء حساب جديد
              </h1>

              <div className="card-subtitle">
                أدخل بياناتك للبدء في الاختبارات الإلكترونية
              </div>

            </div>


            <form
              onSubmit={handleStudentSignup}
              className="auth-form signup-form"
            >

              {/* NATIONAL ID */}

              <div className="input-group">

                <label className="input-label">

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

                  <span>
                    رقم الهوية
                  </span>

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


              {/* FULL NAME */}

              <div className="input-group">

                <label className="input-label">

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />
                  </svg>

                  <span>
                    الاسم الرباعي
                  </span>

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


              {/* BRANCH */}

              <div className="input-group">

                <label className="input-label">

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 10v6" />
                    <path d="M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                  </svg>

                  <span>
                    الفرع الدراسي
                  </span>

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


              {/* PHONE */}

              <div className="input-group">

                <label className="input-label">

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

                  <span>
                    رقم الجوال
                  </span>

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


              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >

                {loading ? (
                  <>
                    <span className="btn-spinner" />
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

              <button
                type="button"
                onClick={goToStudentLogin}
                className="toggle-link"
              >
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

              <h1 className="card-title">
                بوابة المعلم
              </h1>

              <div className="card-subtitle">
                تسجيل الدخول إلى لوحة التحكم
              </div>

            </div>


            <form
              onSubmit={handleTeacherLogin}
              className="auth-form"
            >

              {/* USERNAME */}

              <div className="input-group">

                <label className="input-label">

                  <svg
                    className="label-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />

                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />
                  </svg>

                  <span>
                    اسم المستخدم
                  </span>

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


              {/* PASSWORD */}

              <div className="input-group">

                <label className="input-label">

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

                  <span>
                    كلمة المرور
                  </span>

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

              <button
                type="button"
                onClick={goToStudentLogin}
                className="toggle-link"
              >
                العودة لتسجيل الدخول
              </button>

            </div>

          </>
        )}

      </main>


      {/* =====================================================
          PARTNER
      ====================================================== */}

      {(partnerLabel || partnerName) && (
        <div className="partner-section">

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


      {/* =====================================================
          FOOTER
      ====================================================== */}

      <div className="login-footer">
        <Footer />
      </div>


      {/* =====================================================
          CSS
      ====================================================== */}

      <style>{`

        /* =====================================================
           FONT + RESET
        ====================================================== */

        @import url(
          'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap'
        );

        :root {
          color-scheme: light only;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }

        html {
          background: #e9f4ff;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'Cairo', sans-serif;
          background: #e9f4ff;
          color: #173a61;
          overflow-x: hidden;
        }

        input,
        select,
        button,
        textarea {
          font-family: 'Cairo', sans-serif;
        }


        /* =====================================================
           MAIN PAGE
           Reference design: 864 x 1536
        ====================================================== */

        .login-page {
          --design-width: 864;

          position: relative;

          width: 100%;
          min-height: 100vh;

          display: flex;
          flex-direction: column;
          align-items: center;

          direction: rtl;

          overflow-x: hidden;

          background:
            linear-gradient(
              145deg,
              #f0f8ff 0%,
              #e8f4ff 42%,
              #deefff 100%
            );

          isolation: isolate;
        }


        /* =====================================================
           BACKGROUND
        ====================================================== */

        .background-layer {
          position: absolute;
          inset: 0;

          width: 100%;
          min-height: 100%;

          overflow: hidden;

          pointer-events: none;

          z-index: 0;
        }


        .background-circle {
          position: absolute;

          border-radius: 50%;

          pointer-events: none;
        }


        .circle-left {
          width: 115vw;
          height: 115vw;

          left: -78vw;
          top: 14vw;

          background:
            radial-gradient(
              circle,
              rgba(255,255,255,0.72) 0%,
              rgba(255,255,255,0.36) 42%,
              rgba(255,255,255,0) 72%
            );
        }


        .circle-center {
          width: 72vw;
          height: 72vw;

          left: 34vw;
          top: 35vw;

          background:
            radial-gradient(
              circle,
              rgba(137,186,235,0.12) 0%,
              rgba(137,186,235,0.04) 50%,
              rgba(137,186,235,0) 75%
            );
        }


        .circle-bottom {
          width: 100vw;
          height: 100vw;

          right: -74vw;
          bottom: -33vw;

          background:
            radial-gradient(
              circle,
              rgba(255,255,255,0.58) 0%,
              rgba(255,255,255,0.2) 45%,
              rgba(255,255,255,0) 70%
            );
        }


        .background-shape {
          position: absolute;

          pointer-events: none;
        }


        .shape-top-left {
          width: 72vw;
          height: 72vw;

          left: -55vw;
          top: -40vw;

          border-radius: 50%;

          border: 1px solid rgba(255,255,255,0.32);
        }


        .shape-bottom-right {
          width: 110vw;
          height: 45vw;

          right: -65vw;
          bottom: 8vw;

          transform: rotate(-38deg);

          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,0.2),
              rgba(255,255,255,0)
            );
        }


        /* =====================================================
           VISUAL LAYER
           IMPORTANT:
           This entire layer sits BEHIND the white card.
        ====================================================== */

        .visual-layer {
          position: absolute;

          top: 0;
          left: 0;

          width: 100%;

          height: 80vw;

          z-index: 2;

          pointer-events: none;
        }


        /* =====================================================
           TEACHER IMAGE
        ====================================================== */

        .teacher-image-layer {
          position: absolute;

          top: 4.3vw;
          right: -2.5vw;

          width: 70.5vw;
          height: 76vw;

          display: flex;

          align-items: flex-end;
          justify-content: center;

          z-index: 3;

          pointer-events: auto;

          cursor: default;

          user-select: none;
        }


        .teacher-image {
          position: absolute;

          right: 0;
          bottom: 0;

          width: 100%;
          height: 100%;

          object-fit: contain;
          object-position: center bottom;

          display: block;

          user-select: none;

          pointer-events: auto;

          -webkit-user-drag: none;

          filter:
            drop-shadow(
              0 18px 28px
              rgba(47,82,120,0.10)
            );
        }


        /* =====================================================
           TEACHER NAME
        ====================================================== */

        .teacher-information {
          position: absolute;

          top: 35.3vw;
          left: 8.5vw;

          width: 43vw;

          z-index: 5;

          direction: rtl;

          text-align: right;

          pointer-events: none;
        }


        .teacher-name {
          color: #173b64;

          font-size: 6.1vw;

          line-height: 1.25;

          font-weight: 800;

          letter-spacing: -0.45px;

          white-space: nowrap;
        }


        .teacher-line {
          width: 17.2vw;
          height: 0.8vw;

          margin-top: 1.4vw;

          margin-right: 0.5vw;

          border-radius: 999px;

          background:
            linear-gradient(
              90deg,
              #3d83d3 0%,
              #5e9ce0 100%
            );

          transform:
            rotate(-3deg);
        }


        .teacher-role {
          margin-top: 2.6vw;

          color: #5f91c6;

          font-family:
            Arial,
            sans-serif;

          font-size: 4vw;

          font-weight: 500;

          line-height: 1;

          letter-spacing: 0.8vw;

          direction: ltr;

          text-align: left;

          white-space: nowrap;
        }


        /* =====================================================
           MOTTO
        ====================================================== */

        .teacher-motto {
          position: absolute;

          top: 10.8vw;
          right: 7vw;

          z-index: 2;

          color: rgba(
            67,
            125,
            186,
            0.27
          );

          font-family:
            Arial,
            sans-serif;

          font-size: 4.6vw;

          font-weight: 600;

          line-height: 1.12;

          letter-spacing: 0.08vw;

          direction: ltr;

          text-align: left;

          transform: rotate(-7deg);

          pointer-events: none;
        }


        .motto-line {
          width: 13vw;
          height: 0.55vw;

          margin-top: 1.2vw;
          margin-left: 0.5vw;

          border-radius: 99px;

          background:
            rgba(
              69,
              130,
              194,
              0.23
            );

          transform: rotate(-2deg);
        }


        /* =====================================================
           AUTH CARD
           
           Reference:
           card begins around 44.7% of 1536px
           = 79.3vw when using 864px reference width.
           
           This is why it OVERLAPS the teacher.
        ====================================================== */

        .auth-card {
          position: relative;

          width: 88.4vw;

          max-width: none;

          margin-top: 79.35vw;

          padding:
            6.6vw
            4.25vw
            5.2vw;

          background:
            rgba(
              255,
              255,
              255,
              0.97
            );

          border-radius: 5.2vw;

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.9
            );

          box-shadow:
            0 2.5vw 6.5vw
            rgba(
              49,
              91,
              133,
              0.10
            ),

            0 0.8vw 2.2vw
            rgba(
              49,
              91,
              133,
              0.045
            );

          backdrop-filter:
            blur(14px);

          -webkit-backdrop-filter:
            blur(14px);

          z-index: 20;

          flex-shrink: 0;
        }


        /* =====================================================
           CARD HEADER
        ====================================================== */

        .card-header {
          width: 100%;

          text-align: center;

          margin: 0 0 5.5vw;
        }


        .card-title {
          margin: 0;

          color: #173c67;

          font-size: 7.1vw;

          line-height: 1.25;

          font-weight: 800;

          letter-spacing: -0.25vw;
        }


        .card-subtitle {
          margin-top: 1.7vw;

          color: #899caf;

          font-size: 3.1vw;

          line-height: 1.6;

          font-weight: 500;
        }


        /* =====================================================
           FORM
        ====================================================== */

        .auth-form {
          display: flex;

          flex-direction: column;

          width: 100%;

          gap: 4.2vw;
        }


        .signup-form {
          gap: 3.4vw;
        }


        .input-group {
          width: 100%;
        }


        /* =====================================================
           LABEL
        ====================================================== */

        .input-label {
          display: flex;

          align-items: center;

          justify-content: flex-start;

          gap: 1.55vw;

          margin-bottom: 2.1vw;

          color: #536a83;

          font-size: 3.55vw;

          font-weight: 700;

          line-height: 1.4;
        }


        .label-icon {
          width: 5.5vw;
          height: 5.5vw;

          color: #3e8bd5;

          flex-shrink: 0;
        }


        .required-star {
          color: #ef5350;

          font-weight: 800;
        }


        /* =====================================================
           INPUT
        ====================================================== */

        .input-wrapper {
          width: 100%;
        }


        .auth-input {
          width: 100%;

          height: 13.15vw;

          padding:
            0 4.1vw;

          border:
            1.5px solid
            #dfe8f2;

          border-radius: 4vw;

          background:
            #f8fafc;

          color: #263b52;

          font-size: 4vw;

          font-weight: 500;

          outline: none;

          box-shadow: none;

          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }


        .auth-input::placeholder {
          color: #9baabd;

          opacity: 1;
        }


        .auth-input:hover {
          border-color: #ccdbea;
        }


        .auth-input:focus {
          border-color: #5792d4;

          background: #ffffff;

          box-shadow:
            0 0 0 1vw
            rgba(
              87,
              146,
              212,
              0.08
            );
        }


        select.auth-input {
          cursor: pointer;

          appearance: auto;
        }


        /* =====================================================
           SUBMIT BUTTON
        ====================================================== */

        .submit-btn {
          width: 100%;

          height: 13.5vw;

          margin-top: 1vw;

          border: none;

          border-radius: 4vw;

          background:
            linear-gradient(
              135deg,
              #3987dc 0%,
              #2779cf 100%
            );

          color: #ffffff;

          font-size: 5vw;

          font-weight: 800;

          line-height: 1;

          cursor: pointer;

          display: flex;

          align-items: center;

          justify-content: center;

          gap: 2vw;

          box-shadow:
            0 2.8vw 5vw
            rgba(
              47,
              126,
              210,
              0.20
            );

          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            opacity 0.18s ease;
        }


        .submit-btn:hover:not(:disabled) {
          transform: translateY(-0.6vw);

          box-shadow:
            0 3.5vw 6vw
            rgba(
              47,
              126,
              210,
              0.25
            );
        }


        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }


        .submit-btn:disabled {
          opacity: 0.65;

          cursor: not-allowed;
        }


        /* =====================================================
           SPINNER
        ====================================================== */

        .btn-spinner {
          width: 4.5vw;
          height: 4.5vw;

          border:
            0.55vw solid
            rgba(
              255,
              255,
              255,
              0.35
            );

          border-top-color:
            #ffffff;

          border-radius: 50%;

          animation:
            spin 0.7s linear infinite;
        }


        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }


        /* =====================================================
           TOGGLE
        ====================================================== */

        .toggle-view {
          display: flex;

          align-items: center;

          justify-content: center;

          flex-wrap: wrap;

          gap: 1.5vw;

          margin-top: 4.8vw;

          font-size: 3.6vw;

          line-height: 1.5;
        }


        .toggle-muted {
          color: #64778d;

          font-weight: 500;
        }


        .toggle-link {
          padding: 0;

          border: none;

          background: transparent;

          color: #3281d3;

          font-family: 'Cairo', sans-serif;

          font-size: inherit;

          font-weight: 800;

          cursor: pointer;
        }


        .toggle-link:hover {
          color: #1766b1;

          text-decoration: underline;
        }


        /* =====================================================
           PARTNER
        ====================================================== */

        .partner-section {
          position: relative;

          z-index: 15;

          width: 100%;

          text-align: center;

          margin-top: 8vw;

          line-height: 1.4;
        }


        .partner-label {
          color: #8298b0;

          font-size: 3vw;

          font-weight: 500;
        }


        .partner-name {
          color: #607c9b;

          font-size: 3.5vw;

          font-weight: 700;

          margin-top: 0.4vw;
        }


        /* =====================================================
           FOOTER
           
           The original screenshot has the footer below
           the card, around the lower center.
        ====================================================== */

        .login-footer {
          position: relative;

          z-index: 15;

          width: 100%;

          margin-top: 7vw;

          padding-bottom:
            max(
              5vw,
              env(safe-area-inset-bottom)
            );

          text-align: center;
        }


        /* =====================================================
           FORCE FOOTER CONTENT TO LOOK LIKE REFERENCE
           
           If Footer.jsx contains its own styling, these rules
           still keep the overall position centered.
        ====================================================== */

        .login-footer > * {
          width: 100%;
        }


        /* =====================================================
           MOBILE HEIGHT CONTROL
           
           The design is intentionally width-based because
           the supplied reference is a portrait mobile screen.
        ====================================================== */

        @media (min-width: 601px) {

          .login-page {
            width: 100%;

            max-width: 432px;

            margin: 0 auto;

            min-height: 100vh;

            box-shadow:
              0 0 80px
              rgba(
                32,
                73,
                113,
                0.08
              );
          }

          .auth-card {
            width: 88.4%;

            margin-top: 79.35%;

            padding:
              6.6%
              4.8%
              5.2%;
          }

          .visual-layer {
            width: 100%;
            height: 80%;
          }

          .teacher-image-layer {
            top: 4.3%;
            right: -2.5%;
            width: 70.5%;
            height: 76%;
          }

          .teacher-information {
            top: 35.3%;
            left: 8.5%;
          }

          .teacher-name {
            font-size: 6.1%;
          }

          .teacher-role {
            font-size: 4%;
          }

          .teacher-motto {
            top: 10.8%;
            right: 7%;
            font-size: 4.6%;
          }
        }


        /* =====================================================
           VERY SMALL MOBILE
        ====================================================== */

        @media (max-width: 360px) {

          .teacher-name {
            font-size: 5.9vw;
          }

          .teacher-role {
            font-size: 3.75vw;

            letter-spacing: 0.65vw;
          }

          .teacher-motto {
            font-size: 4.2vw;
          }

          .card-title {
            font-size: 6.8vw;
          }

          .input-label {
            font-size: 3.4vw;
          }

          .auth-input {
            height: 13vw;
          }

          .submit-btn {
            height: 13.3vw;

            font-size: 4.7vw;
          }
        }


        /* =====================================================
           REDUCE MOTION
        ====================================================== */

        @media (prefers-reduced-motion: reduce) {

          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

      `}</style>

    </div>
  );
}