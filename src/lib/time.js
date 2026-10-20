// تشخیص زمان از متن فارسی: «۳ ساعت دیگه»، «بیست و پنج دقیقه دیگه»، «یک ساعت و نیم دیگه»،
// «ساعت ۱۱ و نیم»، «ساعت ۸ شب»، «فردا ساعت ۸»، «پس‌فردا ساعت ۹»

const INT = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, شانزده: 16,
  هفده: 17, هجده: 18, نوزده: 19, بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60,
}
const ALL = { ...INT, نیم: 0.5, ربع: 0.25 }

const alt = (o) => Object.keys(o).sort((a, b) => b.length - a.length).join('|')
const WI = alt(INT) // عدد حروفی (بدون نیم و ربع)
const WA = alt(ALL) // عدد حروفی + نیم و ربع
const AR = String.raw`\u0600-\u06FF`
const B = String.raw`(?:^|[^${AR}])` // مرز سمت چپ: حرف فارسی نباشه (مثلاً «مدرسه» رو «سه» حساب نکنه)
const D = String.raw`\d+(?:\.\d+)?`

// عدد مرکب: «۲»، «بیست و پنج»، «یک و نیم»
const NUMEXPR = String.raw`(?:${D}|${WA})(?:\s+و\s+(?:${D}|${WA}))*`

const normalize = (s) =>
  s
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')

// «بیست و پنج» -> 25 ، «یک و نیم» -> 1.5
const val = (expr) =>
  expr.split(/\s+و\s+/).reduce((sum, tok) => sum + (/^\d/.test(tok) ? parseFloat(tok) : ALL[tok] ?? NaN), 0)

const UNIT_MS = { ساعت: 3600e3, دقیقه: 60e3, روز: 864e5 }

// نسبی: «۳ ساعت دیگه»، «۲ ساعت و نیم دیگه»، «۲ ساعت و ۱۵ دقیقه دیگه»، «ربع ساعت دیگه»
const REL = new RegExp(
  String.raw`${B}(${NUMEXPR})\s*(ساعت|دقیقه|روز)(?:\s+و\s+(نیم|ربع|(${NUMEXPR})\s*(ساعت|دقیقه)|(${NUMEXPR})))?\s*(?:دیگه|دیگر|بعد)`
)

// مطلق: «ساعت ۱۱:۳۰»، «ساعت یازده و نیم»، «ساعت ۸ و ربع»، «ساعت سه و بیست دقیقه»
const HOUR = String.raw`(\d{1,2}(?!\d)|(?:${WI})(?![${AR}]))`
const MIN = String.raw`(?:(?:\s*:\s*|\s+و\s+)(نیم|ربع|\d{1,2}|(?:${WI})(?:\s+و\s+(?:${WI}))*)(?:\s*دقیقه)?)?`
const ABS = new RegExp(String.raw`${B}ساعت\s*${HOUR}${MIN}`)

// تبدیل به ساعت ۲۴ با توجه به صبح/ظهر/عصر/شب
function to24(h, t) {
  if (/عصر|بعد\s*از\s*ظهر|بعدازظهر/.test(t)) return h < 12 ? h + 12 : h
  if (/شب/.test(t)) {
    if (h === 12) return 0 // «۱۲ شب» = نیمه‌شب
    return h >= 6 && h < 12 ? h + 12 : h // «۸ شب» = ۲۰ ، «۱ شب» = ۱ بامداد
  }
  if (/ظهر/.test(t) && h >= 1 && h <= 4) return h + 12 // «۱ ظهر» = ۱۳
  return h
}

export function parseWhen(input, base = Date.now()) {
  const t = normalize(input)

  let m = t.match(REL)
  if (m) {
    const u = m[2]
    let ms = val(m[1]) * UNIT_MS[u]
    if (m[3] === 'نیم') ms += 0.5 * UNIT_MS[u]
    else if (m[3] === 'ربع') ms += 0.25 * UNIT_MS[u]
    else if (m[4]) ms += val(m[4]) * UNIT_MS[m[5]]
    else if (m[6]) ms += val(m[6]) * (u === 'ساعت' ? 60e3 : u === 'روز' ? 3600e3 : 1000) // «۲ ساعت و ۱۵ دیگه»
    return Number.isFinite(ms) ? base + ms : null
  }

  m = t.match(ABS)
  if (m) {
    let h = /^\d/.test(m[1]) ? parseInt(m[1], 10) : INT[m[1]]
    let min = 0
    if (m[2]) {
      if (m[2] === 'نیم') min = 30
      else if (m[2] === 'ربع') min = 15
      else min = val(m[2])
    }
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
    h = to24(h, t)
    const d = new Date(base)
    d.setHours(h, min, 0, 0)
    if (/پس\s*فردا/.test(t)) d.setDate(d.getDate() + 2)
    else if (/فردا/.test(t)) d.setDate(d.getDate() + 1)
    else if (d.getTime() <= base) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  return null
}

// آیا متن چیزی شبیه زمان داره؟ (برای هشدار وقتی زمان تشخیص داده نشد)
const HINT = new RegExp(
  String.raw`(?:ساعت|دقیقه|روز)\s*(?:دیگه|دیگر|بعد)|ساعت\s*(?:\d|(?:${WI})(?![${AR}]))|فردا`
)
export const mentionsTime = (input) => HINT.test(normalize(input))

export const formatTime = (ms) =>
  new Date(ms).toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// زمان باقی‌مانده به‌صورت فارسی: «۲ ساعت و ۱۰ دقیقه مانده»
export function formatRemaining(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const f = (n) => n.toLocaleString('fa-IR')
  let out
  if (d > 0) out = h ? `${f(d)} روز و ${f(h)} ساعت` : `${f(d)} روز`
  else if (h > 0) out = m ? `${f(h)} ساعت و ${f(m)} دقیقه` : `${f(h)} ساعت`
  else if (m >= 5) out = `${f(m)} دقیقه`
  else if (m > 0) out = s ? `${f(m)} دقیقه و ${f(s)} ثانیه` : `${f(m)} دقیقه`
  else out = `${f(s)} ثانیه`
  return out + ' مانده'
}
