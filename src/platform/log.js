// گزارش کوتاه خطاهای بخش بومی؛ داخل پنل «عیب‌یابی» نمایش داده می‌شه
const buf = []
const subs = new Set()

const text = (e) => {
  if (typeof e === 'string') return e
  if (e?.message) return e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

export const dlog = (tag, e) => {
  const t = new Date().toLocaleTimeString('fa-IR')
  buf.push(`${t} [${tag}] ${text(e)}`)
  if (buf.length > 40) buf.shift()
  subs.forEach((f) => f())
}
export const getLog = () => [...buf]
export const subscribeLog = (f) => {
  subs.add(f)
  return () => subs.delete(f)
}
