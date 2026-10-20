import { useEffect, useRef, useState } from 'react'
import { GENERAL_ID } from '../lib/packs'

const KEY = 'notes'
export const SNOOZE_MIN = 5

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// داده‌ی ذخیره‌شده رو اعتبارسنجی می‌کنه؛ یادداشت‌های قدیمی بدون پک می‌رن تو «عمومی»
const parse = (raw) => {
  try {
    const a = JSON.parse(raw || '[]')
    if (!Array.isArray(a)) return []
    return a
      .filter((n) => n && n.id != null && typeof n.text === 'string')
      .map((n) => ({ ...n, id: String(n.id), packId: n.packId || GENERAL_ID }))
  } catch {
    return []
  }
}
const load = () => {
  try { return parse(localStorage.getItem(KEY)) } catch { return [] }
}

export default function useNotes(onDue) {
  const [notes, setNotes] = useState(load)
  const ref = useRef(notes)
  ref.current = notes
  const onDueRef = useRef(onDue) // همیشه آخرین نسخه‌ی callback
  onDueRef.current = onDue

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch {}
  }, [notes])

  // همگام‌سازی بین تب‌ها: تغییر تو یه تب، تو بقیه هم اعمال می‌شه
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY || e.storageArea !== localStorage) return
      const next = parse(e.newValue)
      if (JSON.stringify(next) !== JSON.stringify(ref.current)) setNotes(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // چک سررسید یادآورها. «ringing» ذخیره می‌شه تا آلارمِ دیده‌نشده با رفرش گم نشه
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const due = ref.current.filter((n) => n.remindAt && !n.fired && !n.done && n.remindAt <= now)
      if (!due.length) return
      const ids = new Set(due.map((n) => n.id))
      const mark = (p) => p.map((n) => (ids.has(n.id) ? { ...n, fired: true, ringing: true } : n))
      ref.current = mark(ref.current) // فوراً، تا چک بعدی دوباره نگیردش
      setNotes(mark)
      onDueRef.current?.(due)
    }

    // تایمر داخل Worker توسط مرورگر کند نمی‌شه؛ اگه نشد، setInterval معمولی
    let worker, url, interval
    const fallback = () => { if (!interval) interval = setInterval(check, 1000) }
    try {
      url = URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),1000)'], { type: 'text/javascript' }))
      worker = new Worker(url)
      worker.onmessage = check
      worker.onerror = fallback
    } catch {
      fallback()
    }
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    check()

    return () => {
      clearInterval(interval)
      worker?.terminate()
      if (url) URL.revokeObjectURL(url)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  const add = (text, remindAt, packId = GENERAL_ID) =>
    setNotes((p) => [
      { id: newId(), text, remindAt, startAt: Date.now(), fired: false, ringing: false, done: false, packId },
      ...p,
    ])

  const toggle = (id) =>
    setNotes((p) =>
      p.map((n) => {
        if (n.id !== id) return n
        const done = !n.done
        // اگه وقتش گذشته و هنوز نخورده، با برداشتن «انجام شد» ناگهان زنگ نخوره
        const missed = !done && n.remindAt && !n.fired && n.remindAt <= Date.now()
        return { ...n, done, ringing: false, fired: n.fired || !!missed }
      })
    )

  const remove = (id) => setNotes((p) => p.filter((n) => n.id !== id))
  const restore = (note, index) =>
    setNotes((p) => (p.some((n) => n.id === note.id) ? p : [...p.slice(0, index), note, ...p.slice(index)]))
  const dismiss = (id) => setNotes((p) => p.map((n) => (n.id === id ? { ...n, ringing: false } : n)))
  const snooze = (id, minutes = SNOOZE_MIN) =>
    setNotes((p) =>
      p.map((n) =>
        n.id === id
          ? { ...n, startAt: Date.now(), remindAt: Date.now() + minutes * 60e3, fired: false, ringing: false }
          : n
      )
    )
  const moveAll = (from, to) => setNotes((p) => p.map((n) => (n.packId === from ? { ...n, packId: to } : n)))

  return { notes, add, toggle, remove, restore, dismiss, snooze, moveAll }
}
