import { useEffect, useId, useRef } from 'react'
import Icon from './Icon'

// A bottom sheet on the native <dialog> element: focus is trapped inside it, Escape closes it,
// and focus returns to the button that opened it. Tapping the dimmed area closes it too.

export default function Sheet({ open, title, onClose, children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <span className="sheet-grab" />
          <div className="sheet-head">
            <h1 id={titleId}>{title}</h1>
            <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  )
}
