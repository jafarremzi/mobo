import { describe, it, expect } from 'vitest'
import { parseCreatePack, findPackIn, cleanPackName } from '../src/lib/packs'

const packs = [
  { id: 'general', name: 'عمومی' },
  { id: 'u', name: 'دانشگاه' },
  { id: 's', name: 'سایت' },
  { id: 'w', name: 'کیف پول' },
]

describe('parseCreatePack', () => {
  it.each([
    ['یک پک بساز برای کارهای دانشگاه', 'دانشگاه'],
    ['یه پک بساز برای کارهای مربوط به سایت', 'سایت'],
    ['پک دانشگاه بساز', 'دانشگاه'],
    ['یه پک برای کارهای عمومی بساز', 'عمومی'],
    ['پک کارهای سایت را درست کن', 'سایت'],
    ['پک جدید خرید', 'خرید'],
    ['پک بساز', ''],
  ])('%s', (text, name) => expect(parseCreatePack(text)).toEqual({ name }))
  it('جمله‌ی معمولی دستور نیست', () => {
    expect(parseCreatePack('خرید کوله برای دانشگاه')).toBeNull()
    expect(parseCreatePack('پک غذا رو ببر')).toBeNull()
  })
  it('cleanPackName', () => expect(cleanPackName('کارهای مربوط به سایت')).toBe('سایت'))
})

describe('findPackIn', () => {
  it('پک رو پیدا و عبارتش رو حذف می‌کنه', () => {
    const r = findPackIn('خرید کوله برای دانشگاه', packs)
    expect(r.pack.id).toBe('u')
    expect(r.text).toBe('خرید کوله')
  })
  it('زمان تو متن می‌مونه', () => {
    expect(findPackIn('خرید کوله برای دانشگاه سه ساعت دیگه', packs).text).toBe('خرید کوله سه ساعت دیگه')
  })
  it('توی پک ...', () => {
    const r = findPackIn('توی پک سایت لاگین رو چک کن', packs)
    expect([r.pack.id, r.text]).toEqual(['s', 'لاگین رو چک کن'])
  })
  it('نیم‌فاصله', () => expect(findPackIn('برای کیف‌پول یه جا بخرم', packs).pack.id).toBe('w'))
  it('پک ناشناس یا کلمه‌ی شبیه → بدون پک', () => {
    expect(findPackIn('خرید کوله برای مدرسه', packs).pack).toBeNull()
    expect(findPackIn('به مامان زنگ بزنم', packs).pack).toBeNull()
    expect(findPackIn('هدیه برای دانشگاهیان', packs).pack).toBeNull()
  })
})
