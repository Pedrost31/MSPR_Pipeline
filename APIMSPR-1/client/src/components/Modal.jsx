export default function Modal({ title, subtitle, children, onClose, onConfirm, confirmLabel = 'Confirmer', danger = false }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{title}</h3>
        {subtitle && <div className="sub">{subtitle}</div>}
        {children}
        <div className="modal-btns">
          <button className="btn-cancel" onClick={onClose}>Annuler</button>
          <button className={`btn-confirm${danger ? ' danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
