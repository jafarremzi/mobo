import { useEffect, useState } from 'react'
import { GENERAL_ID } from '../lib/packs'
import { FolderIcon, PlusIcon } from './Icons'

const fa = (n) => (n || 0).toLocaleString('fa-IR')

export default function PackBar({ packs, active, counts, onSelect, onCreate, onRename, onRemove }) {
  const [mode, setMode] = useState(null) // 'new' | 'rename' | null
  const [name, setName] = useState('')
  const cur = packs.find((p) => p.id === active)

  const open = (m) => { setMode(m); setName(m === 'rename' ? cur?.name ?? '' : '') }
  const close = () => { setMode(null); setName('') }
  const submit = () => {
    if (!name.trim()) return
    const ok = mode === 'new' ? onCreate(name) : onRename(active, name)
    if (ok !== false) close()
  }
  const del = () => {
    if (window.confirm(`پک «${cur.name}» حذف بشه؟ یادداشت‌هاش می‌رن تو «عمومی».`)) onRemove(cur.id)
  }

  // اندروید: دکمه‌ی Back فرم ساخت/تغییر نام پک رو می‌بنده
  useEffect(() => {
    if (!mode) return
    const onBack = (e) => { e.preventDefault(); close() }
    window.addEventListener('app:back', onBack)
    return () => window.removeEventListener('app:back', onBack)
  }, [mode])

  return (
    <section className="packbar">
      <div className="packbar-row">
        <label className="pack-select">
          <FolderIcon />
          <select value={active} onChange={(e) => onSelect(e.target.value)} aria-label="انتخاب پک">
            <option value="all">همه‌ی پک‌ها ({fa(counts.all)})</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({fa(counts[p.id])})</option>
            ))}
          </select>
        </label>
        <button className="btn-ghost" onClick={() => open('new')}><PlusIcon /> پک جدید</button>
        {cur && cur.id !== GENERAL_ID && (
          <>
            <button className="btn-ghost" onClick={() => open('rename')}>تغییر نام</button>
            <button className="btn-ghost danger" onClick={del}>حذف</button>
          </>
        )}
      </div>

      {mode && (
        <div className="pack-edit">
          <input
            autoFocus
            value={name}
            placeholder={mode === 'new' ? 'اسم پک، مثلاً دانشگاه' : 'اسم جدید'}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close() }}
          />
          <button className="btn-primary" onClick={submit} disabled={!name.trim()}>{mode === 'new' ? 'ساخت' : 'ذخیره'}</button>
          <button className="btn-ghost" onClick={close}>انصراف</button>
        </div>
      )}
    </section>
  )
}
