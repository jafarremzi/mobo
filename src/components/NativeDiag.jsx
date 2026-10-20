import { useCallback, useEffect, useState } from 'react'
import { isNative, platformName } from '../platform/native'
import { getLN, ensureChannel } from '../platform/notifications'
import { dlog, getLog, subscribeLog } from '../platform/log'
import { CHANNEL_ID } from '../lib/alarmPlan'

// پنل عیب‌یابی؛ فقط داخل اپ اندروید دیده می‌شه
export default function NativeDiag() {
  const native = isNative()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState({})
  const [lines, setLines] = useState(getLog())

  useEffect(() => {
    if (!native) return
    return subscribeLog(() => setLines(getLog()))
  }, [native])

  const load = useCallback(async () => {
    try {
      const ln = await getLN()
      const perm = await ln.checkPermissions()
      let exact = '؟'
      try { exact = (await ln.checkExactNotificationSetting()).exact_alarm } catch { exact = 'نامشخص' }
      const { notifications } = await ln.getPending()
      setInfo({ notif: perm.display, exact, pending: notifications.length })
    } catch (e) {
      dlog('diag', e)
    }
  }, [])

  useEffect(() => {
    if (native && open) load()
  }, [native, open, load])

  if (!native) return null

  // یه اعلان مستقل از یادداشت‌ها، ۱۰ ثانیه دیگه: نشون می‌ده خود سیستم اعلان/صدا کار می‌کنه یا نه
  const testAlarm = async () => {
    try {
      const ln = await getLN()
      await ensureChannel(ln)
      await ln.schedule({
        notifications: [{
          id: 2147000000,
          title: '⏰ تست آلارم',
          body: 'اگه این رو می‌بینی، اعلان کار می‌کنه',
          channelId: CHANNEL_ID,
          sound: 'bell.wav',
          smallIcon: 'ic_stat_notes',
          schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
        }],
      })
      dlog('test', 'آلارم تست برای ۱۰ ثانیه دیگه ثبت شد؛ برنامه رو ببند یا صفحه رو قفل کن')
    } catch (e) {
      dlog('test', e)
    }
    load()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.join('\n')); dlog('diag', 'گزارش کپی شد') } catch (e) { dlog('diag', e) }
  }

  return (
    <section className="diag">
      <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>عیب‌یابی آلارم و میکروفون</button>
      {open && (
        <div className="diag-body">
          <p>
            پلتفرم: {platformName()} · اعلان: {info.notif ?? '…'} · آلارم دقیق: {info.exact ?? '…'} · آلارم‌های ثبت‌شده: {info.pending ?? '…'}
          </p>
          <div className="setup-row">
            <button className="btn-primary" onClick={testAlarm}>آلارم تست (۱۰ ثانیه دیگه)</button>
            <button className="btn-ghost" onClick={load}>تازه‌سازی</button>
            <button className="btn-ghost" onClick={copy}>کپی گزارش</button>
          </div>
          <pre className="diag-log">{lines.join('\n') || 'گزارشی نیست'}</pre>
        </div>
      )}
    </section>
  )
}
