import { useCallback, useEffect, useState } from 'react'
import { isNative } from '../platform/native'
import { getLN } from '../platform/notifications'
import { dlog } from '../platform/log'

const TIP_KEY = 'batteryTipSeen'

// راهنمای اجازه‌های آلارم؛ فقط داخل اپ اندروید و فقط وقتی چیزی کم باشه دیده می‌شه
export default function NativeSetup() {
  const native = isNative()
  const [st, setSt] = useState({ notif: 'granted', exact: 'granted' })
  const [tip, setTip] = useState(() => {
    try { return !localStorage.getItem(TIP_KEY) } catch { return false }
  })

  const refresh = useCallback(async () => {
    try {
      const ln = await getLN()
      const p = await ln.checkPermissions()
      let exact = 'granted'
      try { exact = (await ln.checkExactNotificationSetting()).exact_alarm } catch {}
      setSt({ notif: p.display, exact })
    } catch (e) {
      dlog('perm', e)
    }
  }, [])

  useEffect(() => {
    if (!native) return
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [native, refresh])

  if (!native) return null

  const needNotif = st.notif !== 'granted'
  const needExact = st.exact !== 'granted'
  if (!needNotif && !needExact && !tip) return null

  const askNotif = async () => {
    try { await (await getLN()).requestPermissions() } catch {}
    await refresh()
    window.dispatchEvent(new Event('alarms:resync'))
  }
  const askExact = async () => {
    try { await (await getLN()).changeExactNotificationSetting() } catch {}
    await refresh()
  }
  const seen = () => {
    try { localStorage.setItem(TIP_KEY, '1') } catch {}
    setTip(false)
  }

  return (
    <section className="setup" aria-label="تنظیمات آلارم">
      <strong>برای اینکه آلارم‌ها درست کار کنن:</strong>
      {needNotif && (
        <div className="setup-row">
          <span>اجازه‌ی اعلان لازمه تا یادآور وقتی برنامه بسته است هم بیاد. اگه پنجره‌ای نیومد، از تنظیمات گوشی ← برنامه‌ها ← اعلان‌ها روشنش کن.</span>
          <button className="btn-primary" onClick={askNotif}>فعال‌سازی اعلان</button>
        </div>
      )}
      {needExact && (
        <div className="setup-row">
          <span>گزینه‌ی «آلارم و یادآور» رو برای این برنامه روشن کن تا یادآور دقیقاً سر وقت بیاد.</span>
          <button className="btn-primary" onClick={askExact}>باز کردن تنظیمات</button>
        </div>
      )}
      {tip && (
        <div className="setup-row">
          <span>اگه گوشی‌ت شیائومی، سامسونگ، هوآوی یا مشابه‌شونه، بهینه‌سازی باتری رو برای این برنامه خاموش کن (تنظیمات ← باتری ← این برنامه ← بدون محدودیت)؛ وگرنه ممکنه آلارم دیر بیاد.</span>
          <button className="btn-ghost" onClick={seen}>فهمیدم</button>
        </div>
      )}
    </section>
  )
}
