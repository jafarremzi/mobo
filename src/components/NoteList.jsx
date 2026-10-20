import { useState } from 'react'
import useNow from '../hooks/useNow'
import { formatTime, formatRemaining } from '../lib/time'
import { BellIcon, CheckIcon, TrashIcon, FolderIcon } from './Icons'

const TABS = [
  ['all', 'همه'],
  ['reminder', 'یادآورها'],
  ['done', 'انجام‌شده'],
]

const isPending = (n) => n.remindAt && !n.fired && !n.done

// درصد پیشرفت: از لحظه‌ی ساخت (یا آخرین «۵ دقیقه بعد») تا زمان یادآور
function progressOf(n, now) {
  const start = n.startAt ?? Number(n.id)
  const span = n.remindAt - start
  if (!(span > 0)) return 100
  return Math.min(100, Math.max(0, ((now - start) / span) * 100))
}

export default function NoteList({ notes, packs, showPack, onToggle, onRemove }) {
  const [tab, setTab] = useState('all')
  // فقط وقتی یادآور در انتظاری هست، هر ثانیه به‌روز می‌شه
  const now = useNow(notes.some(isPending) ? 1000 : null)

  const shown = notes.filter((n) =>
    tab === 'done' ? n.done : tab === 'reminder' ? n.remindAt && !n.done : true
  )
  const counts = {
    all: notes.length,
    reminder: notes.filter((n) => n.remindAt && !n.done).length,
    done: notes.filter((n) => n.done).length,
  }

  return (
    <section>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
            <small>{counts[k].toLocaleString('fa-IR')}</small>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty">
          <div className="empty-ico">📝</div>
          <p>{tab === 'all' ? 'هنوز یادداشتی نداری' : 'چیزی اینجا نیست'}</p>
          {tab === 'all' && <small>اولین یادداشتت رو بنویس یا با میکروفون بگو</small>}
        </div>
      )}

      <ul className="list" role="tabpanel" aria-label="فهرست یادداشت‌ها">
        {shown.map((n) => {
          const pending = isPending(n)
          const pct = pending ? progressOf(n, now) : 0
          return (
            <li key={n.id} className={'note' + (n.done ? ' done' : '')}>
              <button className={'check' + (n.done ? ' on' : '')} onClick={() => onToggle(n.id)} aria-label="انجام شد">
                {n.done && <CheckIcon />}
              </button>
              <div className="body">
                <p>{n.text}</p>
                {showPack && (
                  <span className="badge pack"><FolderIcon /> {packs.find((p) => p.id === n.packId)?.name || 'عمومی'}</span>
                )}
                {n.remindAt && (
                  <span className={'badge' + (n.fired ? ' fired' : '')}>
                    <BellIcon /> {formatTime(n.remindAt)}{n.fired ? ' · یادآوری شد' : ''}
                  </span>
                )}
                {pending && (
                  <div className="pwrap">
                    <div
                      className="ptrack"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(pct)}
                      aria-label="پیشرفت تا زمان یادآور"
                    >
                      <div className={'pfill' + (pct >= 90 ? ' hot' : '')} style={{ width: pct + '%' }} />
                    </div>
                    <div className="pmeta">
                      <span>{formatRemaining(n.remindAt - now)}</span>
                      <span>{Math.floor(pct).toLocaleString('fa-IR')}٪</span>
                    </div>
                  </div>
                )}
              </div>
              <button className="icon-sm del" onClick={() => onRemove(n.id)} aria-label="حذف"><TrashIcon /></button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
