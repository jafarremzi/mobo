import { useEffect, useState } from 'react'
import useVoiceWeb from '../hooks/useVoice'
import useVoiceNative from '../hooks/useVoiceNative'
import { isNative, readDraft, writeDraft } from '../platform/native'
import { parseWhen, formatTime, mentionsTime } from '../lib/time'
import { parseCreatePack, findPackIn, GENERAL_ID } from '../lib/packs'
import { unlockAudio } from '../lib/sound'
import { MicIcon, StopIcon, BellIcon, PlusIcon, CloseIcon, FolderIcon } from './Icons'

// دستورهای پایان جمله که یادداشت رو خودکار ذخیره می‌کنن: «... اضافه کن»
const CMD = /[\s،,.!؟?]*(?:اضافه\s*(?:کن|بکن|کنید)|ثبت\s*(?:کن|بکن)|ذخیره\s*(?:کن|بکن))[\s.!؟?]*$/

// داخل اپ اندروید تشخیص گفتار بومی، روی وب همون Web Speech API
const useVoice = isNative() ? useVoiceNative : useVoiceWeb

const QUICK = ['۱۰ دقیقه دیگه', 'نیم ساعت دیگه', '۱ ساعت دیگه', '۳ ساعت دیگه', 'فردا ساعت ۸']

export default function NoteForm({ onAdd, notify, packs, activePack, onCreatePack }) {
  const [text, setText] = useState(() => (isNative() ? readDraft() : ''))
  const [when, setWhen] = useState('')
  const [dt, setDt] = useState('')
  const [panel, setPanel] = useState(false)
  const [noAuto, setNoAuto] = useState(false)

  // اندروید: پیش‌نویس متن در حال تایپ ذخیره می‌شه (با بسته شدن اپ از بین نره)
  useEffect(() => {
    if (isNative()) writeDraft(text)
  }, [text])

  // اندروید: دکمه‌ی Back اول پنل یادآور رو می‌بنده
  useEffect(() => {
    if (!panel) return
    const onBack = (e) => { e.preventDefault(); setPanel(false) }
    window.addEventListener('app:back', onBack)
    return () => window.removeEventListener('app:back', onBack)
  }, [panel])

  const { listening, interim, error, level, device, meter, toggle, clearError } = useVoice({
    onFinal: handleFinal,
  })

  // زمان نهایی: تاریخ دقیق > متن کادر یادآور > زمان تشخیص‌داده‌شده از خود متن
  const typed = when.trim()
  const parsedTyped = typed ? parseWhen(typed) : null
  const auto = !noAuto && !typed && !dt ? parseWhen(text) : null
  const at = dt ? new Date(dt).getTime() : typed ? parsedTyped : auto

  // پک مقصد: اگه تو متن اسم پکی بیاد همون، وگرنه پک انتخاب‌شده تو منو («همه» = عمومی)
  const defaultPack = activePack === 'all' ? GENERAL_ID : activePack
  const found = findPackIn(text, packs)
  const targetId = found.pack ? found.pack.id : defaultPack
  const targetName = packs.find((p) => p.id === targetId)?.name || 'عمومی'

  const reset = () => {
    setText(''); setWhen(''); setDt(''); setPanel(false); setNoAuto(false)
  }

  // یادداشت رو با متن داده‌شده ثبت می‌کنه؛ اگه موفق بود true برمی‌گردونه
  const commit = (raw) => {
    const t = raw.trim()
    if (!t) return false
    unlockAudio()
    const { pack, text: body } = findPackIn(t, packs)
    const packId = pack ? pack.id : defaultPack
    const packName = packs.find((p) => p.id === packId)?.name || 'عمومی'
    let when_ = null
    if (dt) when_ = new Date(dt).getTime()
    else if (typed) {
      when_ = parsedTyped
      if (!when_) { notify('زمان یادآور رو نفهمیدم', 'error'); return false }
    } else if (!noAuto) when_ = parseWhen(body)
    if (when_ && when_ <= Date.now()) { notify('این زمان گذشته است', 'error'); return false }
    // متن شبیه زمان بود ولی تشخیص داده نشد: بی‌صدا رد نشیم
    const missed = !when_ && !typed && !dt && !noAuto && mentionsTime(body)
    onAdd(body, when_ || null, packId)
    notify(
      (when_ ? 'یادآور تنظیم شد: ' + formatTime(when_) : 'یادداشت ذخیره شد') + ` · «${packName}»` +
        (missed ? ' — ولی زمان رو نفهمیدم، یادآور تنظیم نشد' : ''),
      missed ? 'error' : 'ok'
    )
    reset()
    return true
  }

  // دستور «یک پک بساز برای ...»؛ اگه دستور بود true برمی‌گردونه
  const tryPackCommand = (raw) => {
    const cmd = parseCreatePack(raw)
    if (!cmd) return false
    if (!cmd.name) {
      notify('اسم پک رو هم بگو؛ مثلاً «یک پک بساز برای کارهای دانشگاه»', 'error')
      return true
    }
    const r = onCreatePack(cmd.name)
    if (!r) notify('اسم پک رو نفهمیدم', 'error')
    else notify(r.created ? `پک «${r.pack.name}» ساخته شد` : `پک «${r.pack.name}» از قبل بود`)
    return true
  }

  const submit = () => {
    if (tryPackCommand(text)) { setText(''); return true }
    return commit(text)
  }

  // متن گفتاری رسیده؛ اگه آخرش «اضافه کن» بود، خودکار ذخیره می‌شه
  function handleFinal(spoken) {
    const norm = spoken.replace(/\u200c/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    const m = norm.match(CMD)
    if (tryPackCommand(m ? norm.slice(0, m.index) : norm)) return 'stop'
    if (!m) {
      setText((t) => (t ? t + ' ' : '') + spoken)
      return
    }
    const full = [text.trim(), spoken.slice(0, m.index).trim()].filter(Boolean).join(' ')
    if (!commit(full)) setText(full)
    return 'stop'
  }

  const clearReminder = () => { setWhen(''); setDt(''); setNoAuto(true) }

  return (
    <section className="composer">
      <textarea
        rows={3}
        placeholder="چی تو ذهنته؟ مثلاً: سه ساعت دیگه به مامان زنگ بزنم"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit()}
      />

      {(listening || interim) && (
        <div className="interim" aria-live="polite">
          <div className="interim-row">
            {meter && <span className="meter" aria-hidden="true"><i style={{ transform: `scaleX(${level})` }} /></span>}
            <span>{interim || 'در حال گوش دادن… آخرش بگو «اضافه کن»'}</span>
          </div>
          {device && <small>میکروفون: {device}</small>}
        </div>
      )}

      {error && (
        <div className="alert" role="alert">
          <div className="alert-head">
            <strong>{error.message}</strong>
            <button className="icon-sm" onClick={clearError} aria-label="بستن"><CloseIcon /></button>
          </div>
          {error.code === 'denied' && (
            <ol>
              <li>روی آیکن قفل (یا تنظیمات) کنار آدرس مرورگر بزن.</li>
              <li>گزینه‌ی «میکروفون» رو روی «اجازه» بذار و صفحه رو رفرش کن.</li>
              {window.self !== window.top && <li>اگه این صفحه داخل پیش‌نمایش یا iframe بازه، اون رو توی یه تب جدا باز کن.</li>}
            </ol>
          )}
          {error.code === 'silent' && (
            <>
              {error.device && <p className="alert-note">میکروفون فعلی: {error.device}</p>}
              <ol>
                <li>نوار سطح صدا موقع ضبط باید تکون بخوره. اگه ثابته، همین میکروفون صدا نمی‌گیره.</li>
                <li>توی تنظیمات صدای سیستم‌عامل، ورودی پیش‌فرض رو روی میکروفون درست بذار و مطمئن شو میوت نیست.</li>
                <li>آدرس chrome://settings/content/microphone رو باز کن و همون میکروفون رو انتخاب کن.</li>
                <li>اگه هدست بلوتوثی وصله، قطعش کن یا میکروفونش رو انتخاب کن، بعد دوباره امتحان کن.</li>
              </ol>
            </>
          )}
        </div>
      )}

      {at && (
        <div className="chips">
          <span className="chip on">
            <BellIcon /> {formatTime(at)}
            <button onClick={clearReminder} aria-label="حذف یادآور"><CloseIcon /></button>
          </span>
        </div>
      )}

      {panel && (
        <div className="panel">
          <div className="quick">
            {QUICK.map((q) => (
              <button key={q} className={'chip' + (when === q ? ' on' : '')} onClick={() => { setWhen(q); setDt('') }}>{q}</button>
            ))}
          </div>
          <label className="field">
            <span>یا بنویس</span>
            <input
              placeholder="ساعت ۱۱ و نیم"
              value={when}
              onChange={(e) => { setWhen(e.target.value); setDt('') }}
            />
          </label>
          {typed && !parsedTyped && <div className="err-text">زمان رو نفهمیدم؛ مثلاً «۲ ساعت دیگه» یا «ساعت ۱۴:۳۰»</div>}
          <label className="field">
            <span>تاریخ و ساعت دقیق</span>
            <input type="datetime-local" value={dt} onChange={(e) => { setDt(e.target.value); setWhen('') }} />
          </label>
        </div>
      )}

      <div className="bar">
        <button
          className={'icon-btn' + (listening ? ' live' : '')}
          onClick={() => { unlockAudio(); toggle() }}
          aria-label={listening ? 'توقف ضبط' : 'یادداشت صوتی'}
          title="یادداشت صوتی"
        >
          {listening ? <StopIcon /> : <MicIcon />}
        </button>
        <button
          className={'icon-btn' + (panel || at ? ' on' : '')}
          onClick={() => setPanel((p) => !p)}
          aria-label="تنظیم یادآور"
          title="یادآور"
        >
          <BellIcon />
        </button>
        <span className="spacer" />
        {text.trim() && <span className="target" title="پکی که یادداشت توش ذخیره می‌شه"><FolderIcon /> {targetName}</span>}
        <button className="btn-primary" onClick={submit} disabled={!text.trim()}>
          <PlusIcon /> افزودن
        </button>
      </div>
      <p className="tip">
        <MicIcon /> با میکروفون بگو «… اضافه کن» تا ذخیره بشه. مثلاً: «خرید کوله برای دانشگاه، اضافه کن». برای ساخت پک: «یک پک بساز برای کارهای دانشگاه»
      </p>
    </section>
  )
}
