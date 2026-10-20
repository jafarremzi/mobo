// تشخیص اجرا داخل اپ اندروید (Capacitor) + شناسه‌ی عددی پایدار برای آلارم‌ها + پیش‌نویس.
// فقط خود @capacitor/core (سبک و بی‌خطر روی وب) import می‌شه؛ پلاگین‌ها فقط با import پویا و داخل اندروید لود می‌شن.
import { Capacitor } from '@capacitor/core'

export const isNative = () => {
  try {
    return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && !!window.androidBridge)
  } catch {
    return false
  }
}
export const platformName = () => {
  try { return Capacitor.getPlatform() } catch { return 'web' }
}

const KEY = 'alarmIds'

const hashId = (s) => {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h & 0x7fffffff) || 1
}

// اندروید برای اعلان‌ها شناسه‌ی عددی (۳۲ بیتی) می‌خواد؛ یادداشت‌ها شناسه‌ی رشته‌ای دارن.
// نگاشت جدا از یادداشت‌ها ذخیره می‌شه و شماره‌ی استفاده‌شده هیچ‌وقت دوباره به کسی داده نمی‌شه.
export function makeAlarmIds(storage) {
  const read = () => {
    try {
      const s = JSON.parse(storage.getItem(KEY) || '{}')
      return {
        seq: Number.isInteger(s.seq) ? s.seq : 0,
        map: s.map && typeof s.map === 'object' ? s.map : {},
      }
    } catch {
      return { seq: 0, map: {} }
    }
  }
  return (noteId) => {
    const key = String(noteId)
    const s = read()
    if (Number.isInteger(s.map[key])) return s.map[key]
    const id = s.seq + 1
    s.map[key] = id
    s.seq = id
    try {
      storage.setItem(KEY, JSON.stringify(s))
    } catch {
      return hashId(key) // ذخیره نشد: حداقل برای همین شناسه همیشه یک عدد برگرده
    }
    return id
  }
}
export const alarmId = (noteId) => makeAlarmIds(localStorage)(noteId)

// پیش‌نویس متن در حال تایپ (فقط نسخه‌ی اندروید ازش استفاده می‌کنه)
const DRAFT = 'draft'
export const readDraft = () => {
  try { return localStorage.getItem(DRAFT) || '' } catch { return '' }
}
export const writeDraft = (t) => {
  try { t ? localStorage.setItem(DRAFT, t) : localStorage.removeItem(DRAFT) } catch {}
}
