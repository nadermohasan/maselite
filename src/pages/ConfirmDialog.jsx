import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <AlertTriangle size={24} className="confirm-icon" />
          <h3>{title || 'تأكيد العملية'}</h3>
        </div>
        <div className="confirm-body">
          <p>{message}</p>
        </div>
        <div className="confirm-footer">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText || 'إلغاء'}
          </button>
          <button className="btn-primary" onClick={onConfirm}>
            {confirmText || 'تأكيد'}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000; /* ⭐ أعلى من كل المودالات */
        }

        .confirm-modal {
          background: white;
          border-radius: 24px;
          width: 90%;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
          direction: rtl;
          color: #1e293b;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          animation: confirmIn 0.2s ease-out;
        }

        @keyframes confirmIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .confirm-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 25px;
          border-bottom: 1px solid #f1f5f9;
        }

        .confirm-icon {
          color: #f59e0b;
          flex-shrink: 0;
        }

        .confirm-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
        }

        .confirm-body {
          padding: 25px;
        }

        .confirm-body p {
          margin: 0;
          color: #475569;
          line-height: 1.6;
          font-size: 1rem;
        }

        .confirm-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 20px 25px;
          border-top: 1px solid #f1f5f9;
        }

        .btn-primary, .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 12px;
          font-family: 'Cairo', sans-serif;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}
