// منطق خالص هماهنگ‌سازی آلارم‌های بومی با یادداشت‌ها (بدون وابستگی به Capacitor، قابل تست)

export const CHANNEL_ID = 'alarm_v1' // صدای کانال بعد از ساخت قابل تغییر نیست؛ برای تغییر، شناسه‌ی جدید بذار

// یادآور در انتظار: همون تعریفی که NoteList برای نوار پیشرفت استفاده می‌کنه
export const isPending = (n) => !!n.remindAt && !n.fired && !n.done

export const sigOf = (n) => `${n.remindAt}|${n.text}`

// notes: همه‌ی یادداشت‌ها
// planned: Map(شناسه‌ی عددی -> امضا) آلارم‌هایی که قبلاً ثبت کردیم
// خروجی: چی باید ثبت بشه، چی لغو بشه، و وضعیت بعدی
export function planAlarms(notes, planned, now, idOf) {
  const next = new Map()
  const schedule = []
  for (const n of notes) {
    if (!isPending(n)) continue
    const id = idOf(n.id)
    const sig = sigOf(n)
    if (planned.get(id) === sig) { next.set(id, sig); continue } // بدون تغییر
    if (n.remindAt > now) {
      schedule.push({ id, at: n.remindAt, body: n.text, sig })
      next.set(id, sig)
    }
    // وقتش گذشته و ثبت نشده بود: خود اپ (check) زنگش رو می‌زنه
  }
  const cancel = [...planned.keys()].filter((id) => !next.has(id))
  return { schedule, cancel, next }
}
