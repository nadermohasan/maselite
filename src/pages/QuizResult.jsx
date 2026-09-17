import { useEffect } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "./Footer";

export default function QuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;

  useEffect(() => {
    if (!state) {
      navigate("/dashboard", { replace: true });
    }
  }, [state, navigate]);

  if (!state) return null;

  const {
    score,
    totalPossible,
    questions,
    selectedAnswers,
    studentName,
  } = state;

  // حساب الإحصائيات
  const correctCount = questions.filter((q) => {
    const userAns = selectedAnswers[q.id];
    return userAns !== undefined && parseInt(userAns) === parseInt(q.correct_option);
  }).length;
  const wrongCount = questions.length - correctCount;

  const isEnglish = (text) => /[a-zA-Z]/.test(text);

  const getQuestionOrdinal = (index) => {
    const ordinals = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
    return ordinals[index] || (index + 1);
  };

  const renderOptionContent = (q, optionIndex) => {
    const englishLetter = ['a', 'b', 'c', 'd'][optionIndex];
    const imageKey = `image_option_${englishLetter}`;
    const imageUrl = q[imageKey];

    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={`الخيار ${optionIndex + 1}`}
          className="option-img"
        />
      );
    }
    const optionText = q.options[optionIndex];
    return (
      <span className={isEnglish(optionText) ? 'english-answer-text' : 'arabic-answer-text'}>
        {optionText}
      </span>
    );
  };

  return (
    <div className="result-page">

      <div className="bg-grid"></div>
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <div className="main-container">

        {/* ============================
            الشعار + العنوان
        ============================ */}
        <div className="brand-header">
          <img
            src="https://i.imgur.com/U5iofms.png"
            alt="النخبة"
            className="brand-logo"
          />
          <div className="brand-divider"></div>
          <h1 className="page-title">نتيجــــــة الاختبار</h1>

        </div>

        {/* ============================
            البطاقة الرئيسية
        ============================ */}
        <div className="hero-card">
          {/* الاسم */}
          <div className="student-section">
            <span className="student-label">الطالــب / ــة</span>
            <h2 className="student-name">{studentName}</h2>
          </div>

          {/* الفاصل */}
          <div className="hero-divider"></div>

          {/* الدرجة */}
          <div className="score-section">
            <span className="score-label">الدرجة النهائية</span>
            <div className="score-display">
              <span className="score-value">{score}</span>
              <span className="score-slash">/</span>
              <span className="score-max">{totalPossible}</span>
            </div>
          </div>

          {/* الإحصائيات */}
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-dot correct"></div>
              <div className="stat-info">
                <span className="stat-value">{correctCount}</span>
                <span className="stat-label">صحيحة</span>
              </div>
            </div>

            <div className="stats-divider"></div>

            <div className="stat-item">
              <div className="stat-dot wrong"></div>
              <div className="stat-info">
                <span className="stat-value">{wrongCount}</span>
                <span className="stat-label">خاطئة</span>
              </div>
            </div>

            <div className="stats-divider"></div>

            <div className="stat-item">
              <div className="stat-dot total"></div>
              <div className="stat-info">
                <span className="stat-value">{questions.length}</span>
                <span className="stat-label">الإجمالي</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================
            قسم المراجعة
        ============================ */}
        <div className="review-section">

          <div className="section-header">
            <div className="section-header-line"></div>
            <h3 className="section-title">مراجعة الإجابات</h3>
            <div className="section-header-line"></div>
          </div>

          <div className="questions-list">
            {questions.map((q, idx) => {
              const userAnswerIndex = selectedAnswers[q.id];
              const isCorrect = userAnswerIndex !== undefined && parseInt(userAnswerIndex) === parseInt(q.correct_option);
              const correctAnswerIndex = parseInt(q.correct_option);
              const degree = q.degree || 1;
              const isUnanswered = userAnswerIndex === undefined;

              const status = isCorrect ? 'correct' : isUnanswered ? 'unanswered' : 'wrong';

              return (
                <div key={q.id} className={`question-item ${status}`}>

                  {/* رأس السؤال */}
                  <div className="q-header">
                    <div className="q-header-right">
                      <span className={`q-status-badge ${status}`}>
                        {isCorrect ? '✓' : isUnanswered ? '?' : '✕'}
                      </span>
                      <span className="q-title">
                        السؤال {getQuestionOrdinal(idx)}
                      </span>
                    </div>
                    <span className={`q-degree ${isCorrect ? 'pass' : 'fail'}`}>
                      {isCorrect ? `+${degree}` : `-${degree}`}
                    </span>
                  </div>

                  {/* نص السؤال أو صورته */}
                  <div className="q-body">
                    {q.image_url ? (
                      <div className="q-image-wrapper">
                        <img src={q.image_url} alt="السؤال" className="q-image" />
                      </div>
                    ) : (
                      <p className={`q-text ${isEnglish(q.question_text) ? 'english-question-text' : 'arabic-question-text'}`}>
                        {q.question_text}
                      </p>
                    )}
                  </div>

                  {/* الإجابات */}
                  <div className="answers-list">

                    {/* إجابة الطالب */}
                    <div className={`answer-row ${isCorrect ? 'correct' : isUnanswered ? 'unanswered' : 'wrong'}`}>
                      <div className="answer-marker">
                        <span className="marker-icon">
                          {isCorrect ? '✓' : isUnanswered ? '—' : '✕'}
                        </span>
                      </div>
                      <div className="answer-body">
                        <span className="answer-heading">
                          {isUnanswered ? 'لم تُجب على هذا السؤال' : 'إجابتك'}
                        </span>
                        {!isUnanswered && (
                          <div className="answer-value">
                            {renderOptionContent(q, userAnswerIndex)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* الإجابة الصحيحة */}
                    {!isCorrect && (
                      <div className="answer-row correct-hint">
                        <div className="answer-marker">
                          <span className="marker-icon correct-icon">✓</span>
                        </div>
                        <div className="answer-body">
                          <span className="answer-heading correct-heading">الإجابة الصحيحة</span>
                          <div className="answer-value">
                            {renderOptionContent(q, correctAnswerIndex)}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* زر العودة */}
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>العودة للرئيسية</span>
        </button>

        <Footer />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        .result-page {
          min-height: 100vh;
          background: #f4f6fb;
          direction: rtl;
          font-family: 'Cairo', sans-serif !important;
          padding: 24px 16px 40px;
          position: relative;
          overflow-x: hidden;
        }

        .result-page *,
        .result-page h1,
        .result-page h2,
        .result-page h3,
        .result-page p,
        .result-page span,
        .result-page div,
        .result-page button {
          font-family: 'Cairo', sans-serif !important;
        }

        /* شبكة خفيفة في الخلفية */
        .bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
          mask-image: radial-gradient(ellipse at top, black 20%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse at top, black 20%, transparent 70%);
        }

        /* دوائر ضبابية */
        .bg-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.5;
        }
        .blob-1 {
          width: 400px; height: 400px;
          top: -150px; right: -120px;
          background: radial-gradient(circle, #bfdbfe, transparent 70%);
        }
        .blob-2 {
          width: 340px; height: 340px;
          bottom: -120px; left: -100px;
          background: radial-gradient(circle, #c7d2fe, transparent 70%);
        }

        .main-container {
          max-width: 560px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }

        /* ============================
            الشعار والعنوان
        ============================ */
        .brand-header {
          text-align: center;
              margin-top: 56px;
          margin-bottom: 28px;
        }
        .brand-logo {
          width: 120px;
          height: auto;
          filter: drop-shadow(0 6px 14px rgba(30, 64, 175, 0.12));
        }
        .brand-divider {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
          margin: 16px auto 14px;
        }
        .page-title {
          font-size: 1.6rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
          text-align: center;
        }
        .page-subtitle {
          font-size: 0.88rem;
          color: #64748b;
          margin: 0;
          font-weight: 500;
          letter-spacing: 0.2px;
          text-align: center;
        }

        /* ============================
            البطاقة الرئيسية
        ============================ */
        .hero-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 28px 24px 24px;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04),
            0 12px 40px -8px rgba(15, 23, 42, 0.08);
          border: 1px solid #e8eef6;
          margin-bottom: 28px;
          position: relative;
          overflow: hidden;
          animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* قسم الطالب */
        .student-section {
          margin-bottom: 22px;
          text-align: center;
        }
        .student-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .student-name {
          font-size: 1.4rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.3px;
          line-height: 1.3;
          text-align: center;
        }

        /* الفاصل */
        .hero-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent);
          margin: 0 -4px 22px;
        }

        /* الدرجة */
        .score-section {
          text-align: center;
          margin-bottom: 24px;
        }
        .score-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .score-display {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          line-height: 1;
          direction: ltr;
        }
        .score-value {
          font-size: 3.2rem;
          font-weight: 900;
          color: #1e40af;
          letter-spacing: -2px;
        }
        .score-slash {
          font-size: 2rem;
          color: #cbd5e1;
          font-weight: 300;
        }
        .score-max {
          font-size: 1.6rem;
          font-weight: 700;
          color: #64748b;
        }

        /* الإحصائيات */
        .stats-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 12px;
          background: #f8fafc;
          border-radius: 14px;
          border: 1px solid #eef2f7;
        }
        .stat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          justify-content: center;
        }
        .stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .stat-dot.correct { background: #10b981; box-shadow: 0 0 0 3px #d1fae5; }
        .stat-dot.wrong { background: #ef4444; box-shadow: 0 0 0 3px #fee2e2; }
        .stat-dot.total { background: #3b82f6; box-shadow: 0 0 0 3px #dbeafe; }

        .stat-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .stat-value {
          font-size: 1.15rem;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
        }
        .stat-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: #94a3b8;
          margin-top: 3px;
          letter-spacing: 0.3px;
        }
        .stats-divider {
          width: 1px;
          height: 26px;
          background: #e2e8f0;
        }

        /* ============================
            قسم المراجعة
        ============================ */
        .review-section {
          animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }
        .section-header-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, #cbd5e1);
        }
        .section-header-line:last-child {
          background: linear-gradient(90deg, #cbd5e1, transparent);
        }
        .section-title {
          font-size: 0.95rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }

        .questions-list {
          display: flex;
          flex-direction: column;
        }

        /* بطاقة سؤال */
        .question-item {
          background: #ffffff;
          padding: 18px 18px 16px;
          position: relative;
          overflow: hidden;
          transition: box-shadow 0.2s ease;
        }
        .question-item:hover {
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04),
            0 8px 24px -6px rgba(15, 23, 42, 0.08);
        }

        .question-item::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 3px;
          height: 100%;
        }
 

        /* رأس السؤال */
        .q-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .q-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .q-status-badge {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 900;
          color: #ffffff;
          flex-shrink: 0;
        }
        .q-status-badge.correct { background: #10b981; }
        .q-status-badge.wrong { background: #ef4444; }
        .q-status-badge.unanswered { background: #f59e0b; }

        .q-title {
          font-size: 0.88rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.2px;
        }
        .q-degree {
          padding: 3px 11px;
          border-radius: 50px;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.3px;
          direction: ltr;
        }
        .q-degree.pass {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }
        .q-degree.fail {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        /* جسم السؤال */
        .q-body {
          margin-bottom: 14px;
        }
        .q-image-wrapper {
          text-align: center;
          padding: 8px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #eef2f7;
        }
        .q-image {
          max-width: 100%;
          max-height: 240px;
          border-radius: 8px;
        }
        .q-text {
          font-size: 0.98rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.75;
          margin: 0;
        }

        /* ⭐ العربية: لليمين */
        .arabic-question-text {
          direction: rtl;
          text-align: right;
          unicode-bidi: embed;
        }

        /* ⭐ الإنجليزية: لليسار */
        .english-question-text {
          display: block;
          direction: ltr;
          text-align: left;
          unicode-bidi: embed;
        }

        /* الإجابات */
        .answers-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .answer-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #e8eef6;
          background: #f8fafc;
        }
        .answer-row.correct {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
        .answer-row.wrong {
          background: #fef2f2;
          border-color: #fecaca;
        }
        .answer-row.unanswered {
          background: #fffbeb;
          border-color: #fde68a;
        }
        .answer-row.correct-hint {
          background: #ecfdf5;
          border-color: #a7f3d0;
        }

        .answer-marker {
          flex-shrink: 0;
          padding-top: 1px;
        }
        .marker-icon {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.68rem;
          font-weight: 900;
          color: #ffffff;
          background: #94a3b8;
        }
        .answer-row.correct .marker-icon { background: #10b981; }
        .answer-row.wrong .marker-icon { background: #ef4444; }
        .answer-row.unanswered .marker-icon { background: #f59e0b; }
        .marker-icon.correct-icon { background: #10b981; }

        .answer-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
          text-align: right;
        }
        .answer-heading {
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          text-align: right;
        }
        .answer-row.correct .answer-heading { color: #059669; }
        .answer-row.wrong .answer-heading { color: #dc2626; }
        .answer-row.unanswered .answer-heading { color: #d97706; }
        .answer-heading.correct-heading { color: #059669; }

        .answer-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.5;
          word-break: break-word;
        }
        .answer-row.correct .answer-value { color: #065f46; }
        .answer-row.wrong .answer-value { color: #991b1b; }
        .answer-row.correct-hint .answer-value { color: #065f46; }

        /* ⭐ العربية في الإجابات: لليمين */
        .arabic-answer-text {
          display: inline-block;
          direction: rtl;
          text-align: right;
          unicode-bidi: embed;
          width: 100%;
        }

        /* ⭐ الإنجليزية في الإجابات: لليسار */
        .english-answer-text {
          display: inline-block;
          direction: ltr;
          text-align: left;
          unicode-bidi: embed;
          width: 100%;
        }

        /* الصور داخل الإجابات */
        .option-img {
          max-width: 130px;
          max-height: 90px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          padding: 2px;
          background: #ffffff;
          display: block;
          margin-top: 4px;
        }

        /* ============================
            زر العودة
        ============================ */
        .back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 15px;
          background: #0f172a;
          color: #ffffff;
          border: none;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 24px;
          margin-bottom: 20px;
          letter-spacing: 0.2px;
        }
        .back-btn:hover {
          background: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 12px 24px -6px rgba(15, 23, 42, 0.25);
        }
        .back-btn:active { transform: translateY(0); }

        /* ============================
            Responsive
        ============================ */
        @media (max-width: 480px) {
          .result-page { padding: 20px 12px 32px; }
          .brand-logo { width: 100px; }
          .page-title { font-size: 1.35rem; }
          .page-subtitle { font-size: 0.82rem; }

          .hero-card { padding: 24px 18px 20px; border-radius: 20px; }
          .student-name { font-size: 1.2rem; }
          .score-value { font-size: 2.6rem; letter-spacing: -1.5px; }
          .score-slash { font-size: 1.6rem; }
          .score-max { font-size: 1.3rem; }

          .stats-row { padding: 14px 8px; }
          .stat-value { font-size: 1rem; }
          .stat-label { font-size: 0.62rem; }

          .question-item { padding: 16px 14px 14px; }
          .q-text { font-size: 0.92rem; }
          .answer-row { padding: 11px 12px; }
          .answer-value { font-size: 0.88rem; }
          .option-img { max-width: 100px; }

          .back-btn { padding: 14px; font-size: 0.9rem; }
        }
      `}</style>
    </div>
  );
}
