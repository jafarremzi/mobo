import { useEffect, useRef } from 'react'
import { BellIcon } from './Icons'
import { SNOOZE_MIN } from '../hooks/useNotes'

export default function AlarmOverlay({ items, packs, onDismiss, onSnooze }) {
  const first = useRef(null)
  const firstId = items[0]?.id

  // فوکوس روی دکمه‌ی «باشه» (کیبورد و screen reader)
  useEffect(() => { first.current?.focus() }, [firstId])

  // Esc اولین آلارم رو می‌بنده
  useEffect(() => {
    if (!firstId) return
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(firstId) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [firstId, onDismiss])

  if (!items.length) return null
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby={'alarm-t-' + firstId}>
      <div className="stack">
        {items.map((n, i) => {
          const pack = packs.find((p) => p.id === n.packId)
          return (
            <div className="alarm" key={n.id}>
              <div className="alarm-ico"><BellIcon /></div>
              <h2 id={'alarm-t-' + n.id}>وقت یادآوریه{pack ? ' · ' + pack.name : ''}</h2>
              <p>{n.text}</p>
              <div className="alarm-actions">
                <button ref={i === 0 ? first : undefined} className="btn-primary" onClick={() => onDismiss(n.id)}>باشه</button>
                <button className="btn-ghost" onClick={() => onSnooze(n)}>{SNOOZE_MIN.toLocaleString('fa-IR')} دقیقه بعد</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
