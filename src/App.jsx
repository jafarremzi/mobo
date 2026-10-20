import { useCallback, useEffect, useRef, useState } from 'react'
import useNotes from './hooks/useNotes'
import usePacks from './hooks/usePacks'
import useNativeAlarms from './hooks/useNativeAlarms'
import useNativeShell from './hooks/useNativeShell'
import PackBar from './components/PackBar'
import NoteForm from './components/NoteForm'
import NoteList from './components/NoteList'
import AlarmOverlay from './components/AlarmOverlay'
import NativeSetup from './components/NativeSetup'
import NativeDiag from './components/NativeDiag'
import { BellIcon } from './components/Icons'
import { GENERAL_ID } from './lib/packs'
import { startRing, stopRing, playOnce, unlockAudio, ensureRing } from './lib/sound'

export default function App() {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  const [perm, setPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  const notify = useCallback((text, kind = 'ok', action = null) => {
    setToast({ text, kind, action })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3000)
  }, [])

  const { notes, add, toggle, remove, restore, dismiss, snooze, moveAll } = useNotes((due) => {
    due.forEach((n) => {
      try {
        new Notification('⏰ یادآور', { body: n.text, tag: n.id, requireInteraction: true, silent: false })
      } catch {}
    })
  })

  // آلارم‌های فعال از خود یادداشت‌ها میان (ذخیره می‌شن، پس با رفرش گم نمی‌شن)
  const ringing = notes.filter((n) => n.ringing)
  const hasRing = ringing.length > 0

  // فقط داخل اپ اندروید کار می‌کنن؛ روی وب هیچ اثری ندارن
  useNativeAlarms(notes)
  useNativeShell(ringing, dismiss)

  const pk = usePacks()
  const visible = pk.active === 'all' ? notes : notes.filter((n) => n.packId === pk.active)
  const counts = { all: notes.length }
  notes.forEach((n) => { counts[n.packId] = (counts[n.packId] || 0) + 1 })

  // ساخت پک (از دکمه یا صدا) و رفتن روی همون پک
  const createPack = (name) => {
    const r = pk.create(name)
    if (r) pk.select(r.pack.id)
    return r
  }
  const createFromUi = (name) => {
    const r = createPack(name)
    if (!r) return false
    notify(r.created ? `پک «${r.pack.name}» ساخته شد` : `پک «${r.pack.name}» از قبل بود`)
  }
  const renamePack = (id, name) => {
    const ok = pk.rename(id, name)
    notify(ok ? 'اسم پک عوض شد' : 'این اسم قبلاً هست یا معتبر نیست', ok ? 'ok' : 'error')
    return ok
  }
  const removePack = (id) => {
    moveAll(id, GENERAL_ID)
    pk.remove(id)
    notify('پک حذف شد؛ یادداشت‌هاش رفتن تو «عمومی»')
  }

  // حذف یادداشت با امکان بازگردانی
  const removeNote = (id) => {
    const i = notes.findIndex((n) => n.id === id)
    if (i < 0) return
    const note = notes[i]
    remove(id)
    notify('یادداشت حذف شد', 'ok', { label: 'بازگردانی', run: () => restore(note, i) })
  }

  useEffect(() => {
    const onDown = () => { unlockAudio(); ensureRing() }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  // تا وقتی آلارمی فعاله، زنگ پخش می‌شه (فقط با روشن/خاموش شدن، نه با تغییر تعداد)
  useEffect(() => {
    if (!hasRing) return
    startRing()
    return () => stopRing()
  }, [hasRing])

  const askPerm = async () => {
    try {
      setPerm(await Notification.requestPermission())
    } catch {}
  }

  const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>یادداشت‌ها</h1>
          <p className="sub">{today}</p>
        </div>
        <div className="top-actions">
          <button className="btn-ghost" onClick={() => { unlockAudio(); playOnce() }} title="تست صدای زنگ">
            <BellIcon /> تست زنگ
          </button>
          {perm === 'default' && (
            <button className="btn-ghost" onClick={askPerm}>فعال‌سازی اعلان</button>
          )}
          {perm === 'granted' && <span className="status ok">اعلان‌ها فعال</span>}
          {perm === 'denied' && <span className="status off">اعلان بسته است</span>}
        </div>
      </header>

      <NativeSetup />

      <PackBar
        packs={pk.packs}
        active={pk.active}
        counts={counts}
        onSelect={pk.select}
        onCreate={createFromUi}
        onRename={renamePack}
        onRemove={removePack}
      />
      <NoteForm onAdd={add} notify={notify} packs={pk.packs} activePack={pk.active} onCreatePack={createPack} />
      <NoteList notes={visible} packs={pk.packs} showPack={pk.active === 'all'} onToggle={toggle} onRemove={removeNote} />

      <NativeDiag />

      <footer className="foot">یادآورها فقط وقتی کار می‌کنن که این صفحه باز باشه</footer>

      <AlarmOverlay items={ringing} packs={pk.packs} onDismiss={dismiss} onSnooze={(n) => snooze(n.id)} />
      {toast && (
        <div className={'toast ' + toast.kind} role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button className="toast-act" onClick={() => { toast.action.run(); setToast(null) }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
