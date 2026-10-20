import { describe, it, expect } from 'vitest'
import { parseWhen, mentionsTime } from '../src/lib/time'

// دوشنبه ۲۰ اکتبر ۲۰۲۶، ساعت ۱۰:۰۰
const base = new Date(2026, 9, 20, 10, 0, 0).getTime()
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m, 0).getTime()
const min = (n) => base + n * 60e3

describe('parseWhen: نسبی', () => {
  it('عدد ساده', () => {
    expect(parseWhen('۳ ساعت دیگه', base)).toBe(min(180))
    expect(parseWhen('سه ساعت دیگه به مامان زنگ بزنم', base)).toBe(min(180))
    expect(parseWhen('۲۰ دقیقه بعد', base)).toBe(min(20))
    expect(parseWhen('نیم ساعت دیگه', base)).toBe(min(30))
    expect(parseWhen('ربع ساعت دیگه', base)).toBe(min(15))
  })
  it('عدد مرکب (قبلاً غلط بود)', () => {
    expect(parseWhen('بیست و پنج دقیقه دیگه', base)).toBe(min(25))
    expect(parseWhen('سی و پنج دقیقه دیگه', base)).toBe(min(35))
    expect(parseWhen('دوازده ساعت دیگه', base)).toBe(min(720))
  })
  it('ساعت و نیم / ساعت و دقیقه (قبلاً تشخیص داده نمی‌شد)', () => {
    expect(parseWhen('یک ساعت و نیم دیگه', base)).toBe(min(90))
    expect(parseWhen('دو ساعت و نیم دیگه', base)).toBe(min(150))
    expect(parseWhen('۲ ساعت و ۱۵ دقیقه دیگه', base)).toBe(min(135))
    expect(parseWhen('یک و نیم ساعت دیگه', base)).toBe(min(90))
  })
  it('«سه» وسط کلمه‌ی دیگه حساب نمی‌شه', () => {
    expect(parseWhen('مدرسه ساعت دیگه', base)).toBeNull()
  })
})

describe('parseWhen: مطلق', () => {
  it('ساعت ساده و نیم/ربع', () => {
    expect(parseWhen('ساعت ۱۱ و نیم', base)).toBe(at(20, 11, 30))
    expect(parseWhen('ساعت ۱۴:۳۰', base)).toBe(at(20, 14, 30))
    expect(parseWhen('ساعت سه و بیست دقیقه عصر', base)).toBe(at(20, 15, 20))
    expect(parseWhen('ساعت ۸ و ربع', base)).toBe(at(21, 8, 15)) // ۸:۱۵ امروز گذشته → فردا
  })
  it('شب: ۱۲ شب = نیمه‌شب، ۱ شب = ۱ بامداد، ۸ شب = ۲۰ (قبلاً ۱۲ شب غلط بود)', () => {
    expect(parseWhen('ساعت ۱۲ شب', base)).toBe(at(21, 0))
    expect(parseWhen('ساعت ۱ شب', base)).toBe(at(21, 1))
    expect(parseWhen('ساعت ۸ شب', base)).toBe(at(20, 20))
  })
  it('ظهر و عصر', () => {
    expect(parseWhen('ساعت ۱ ظهر', base)).toBe(at(20, 13))
    expect(parseWhen('ساعت ۵ بعد از ظهر', base)).toBe(at(20, 17))
  })
  it('فردا و پس‌فردا', () => {
    expect(parseWhen('فردا ساعت ۸', base)).toBe(at(21, 8))
    expect(parseWhen('پس فردا ساعت ۹', base)).toBe(at(22, 9))
    expect(parseWhen('پس‌فردا ساعت ۹', base)).toBe(at(22, 9))
  })
  it('ورودی نامعتبر', () => {
    expect(parseWhen('ساعت ۲۵', base)).toBeNull()
    expect(parseWhen('ساعت نهایی', base)).toBeNull()
    expect(parseWhen('خرید نان', base)).toBeNull()
  })
})

describe('mentionsTime', () => {
  it('متن شبیه زمان', () => {
    expect(mentionsTime('فردا برم بانک')).toBe(true)
    expect(mentionsTime('ساعت ۸ جلسه')).toBe(true)
    expect(mentionsTime('ساعت مچی بخرم')).toBe(false)
    expect(mentionsTime('خرید کوله')).toBe(false)
  })
})
