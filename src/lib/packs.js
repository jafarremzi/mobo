// پک‌ها (دسته‌بندی یادداشت‌ها) + تشخیص دستورهای صوتی مربوط به پک

export const GENERAL_ID = 'general'

// هم‌طول با ورودی می‌مونه (۱ به ۱)، پس ایندکس‌ها روی متن اصلی هم درستن
export const norm = (s) => s.replace(/\u200c/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const squash = (s) => norm(s).replace(/\s+/g, ' ').trim()

// «کارهای مربوط به دانشگاه» -> «دانشگاه»
export function cleanPackName(raw = '') {
  return squash(raw.replace(/[.!؟?،,:]+/g, ' '))
    .replace(/^پک\s+/, '')
    .replace(/\s+را$/, '')
    .replace(/^(?:(?:کارهای|کار\s+های|کار|امور)\s+)?(?:مربوط\s+به\s+)?/, '')
    .trim()
}

export const samePack = (a, b) => squash(a) === squash(b)

const VERB = '(?:بساز|بسازید|درست\\s+کن|درست\\s+بکن|ایجاد\\s+کن)'
const FOR = '(?:برای|واسه|به\\s+اسم|به\\s+نام|با\\s+اسم)'
const HEAD = '^\\s*(?:(?:یه|یک)\\s+)?پک\\s+(?:جدید\\s+)?'
const END = '[\\s.!؟?]*$'

const CREATE = [
  new RegExp(`${HEAD}${VERB}(?:\\s+${FOR}\\s+(.+?))?${END}`), // «یک پک بساز برای کارهای دانشگاه»
  new RegExp(`${HEAD}${FOR}\\s+(.+?)\\s+${VERB}${END}`),      // «یه پک برای سایت بساز»
  new RegExp(`${HEAD}(.+?)\\s+${VERB}${END}`),                // «پک دانشگاه بساز»
  new RegExp(`^\\s*پک\\s+جدید\\s+(.+?)${END}`),                // «پک جدید سایت»
]

// اگه دستور ساخت پک بود { name } برمی‌گردونه (name ممکنه خالی باشه)، وگرنه null
export function parseCreatePack(text) {
  const t = norm(text)
  for (const re of CREATE) {
    const m = t.match(re)
    if (m) return { name: cleanPackName(m[1] || '') }
  }
  return null
}

// «برای دانشگاه»، «واسه پک سایت»، «توی پک کارهای عمومی»، «پک دانشگاه»
const MARK =
  '(?:(?:برای|واسه)\\s+(?:پک\\s+)?|(?:توی|تو|در|داخل|به)\\s+پک\\s+|پک\\s+)(?:(?:کارهای|کار)\\s+)?(?:مربوط\\s+به\\s+)?'

// دنبال اسم یکی از پک‌های موجود تو متن می‌گرده و عبارتش رو از متن حذف می‌کنه
export function findPackIn(text, packs) {
  const t = norm(text)
  const sorted = [...packs].sort((a, b) => b.name.length - a.name.length)
  for (const p of sorted) {
    const name = esc(squash(p.name)).replace(/ /g, '\\s+')
    const m = new RegExp(`(^|\\s)${MARK}${name}(?=[\\s،,.!؟?:]|$)`).exec(t)
    if (!m) continue
    const out = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length))
      .replace(/\s+/g, ' ')
      .replace(/^[\s،,:]+|[\s،,:]+$/g, '')
    return { pack: p, text: out || text.trim() }
  }
  return { pack: null, text: text.trim() }
}
