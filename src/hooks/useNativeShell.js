import { useEffect, useRef } from 'react'
import { isNative } from '../platform/native'
import { dlog } from '../platform/log'

// دکمه‌ی Back گوشی + برگشتن اپ به جلو. روی وب هیچ کاری نمی‌کنه.
// ترتیب Back: اول پنل‌های باز (با رویداد app:back)، بعد بستن آلارم، در نهایت کوچک کردن اپ.
export default function useNativeShell(ringing, dismiss) {
  const ref = useRef({ ringing, dismiss })
  ref.current = { ringing, dismiss }

  useEffect(() => {
    if (!isNative()) return
    const handles = []
    let dead = false
    import('@capacitor/app')
      .then(({ App }) => {
        if (dead) return
        const add = (name, fn) =>
          App.addListener(name, fn).then((h) => (dead ? h.remove() : handles.push(h)))
        add('backButton', () => {
          const ev = new CustomEvent('app:back', { cancelable: true })
          if (!window.dispatchEvent(ev)) return // یه پنل باز بود و بسته شد
          const { ringing: r, dismiss: d } = ref.current
          if (r.length) { d(r[0].id); return }
          App.minimizeApp()
        })
        // وقتی از پس‌زمینه برمی‌گردیم، چک یادآورها (که روی رویداد focus نصبه) فوراً اجرا بشه
        add('appStateChange', ({ isActive }) => {
          if (isActive) window.dispatchEvent(new Event('focus'))
        })
      })
      .catch((e) => dlog('app', e))
    return () => {
      dead = true
      handles.forEach((h) => h.remove())
    }
  }, [])
}
