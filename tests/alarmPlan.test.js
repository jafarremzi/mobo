import { describe, it, expect } from 'vitest'
import { planAlarms, isPending, sigOf } from '../src/lib/alarmPlan'
import { makeAlarmIds } from '../src/platform/native'

const now = 1_000_000
const idOf = (id) => ({ a: 1, b: 2, c: 3 }[id])
const note = (id, over = {}) => ({ id, text: 'متن ' + id, remindAt: now + 60_000, fired: false, done: false, ...over })

describe('planAlarms', () => {
  it('یادآور در انتظار رو ثبت می‌کنه', () => {
    const r = planAlarms([note('a')], new Map(), now, idOf)
    expect(r.schedule).toEqual([{ id: 1, at: now + 60_000, body: 'متن a', sig: sigOf(note('a')) }])
    expect(r.cancel).toEqual([])
  })
  it('یادداشت بدون یادآور، انجام‌شده یا سررسیده ثبت نمی‌شه', () => {
    const r = planAlarms([note('a', { remindAt: null }), note('b', { done: true }), note('c', { fired: true })], new Map(), now, idOf)
    expect(r.schedule).toEqual([])
  })
  it('بدون تغییر = کاری نمی‌کنه', () => {
    const n = note('a')
    const r = planAlarms([n], new Map([[1, sigOf(n)]]), now, idOf)
    expect(r.schedule).toEqual([])
    expect(r.cancel).toEqual([])
  })
  it('تغییر زمان (مثل «۵ دقیقه بعد») دوباره ثبت می‌شه', () => {
    const old = note('a')
    const moved = note('a', { remindAt: now + 300_000 })
    const r = planAlarms([moved], new Map([[1, sigOf(old)]]), now, idOf)
    expect(r.schedule.map((s) => [s.id, s.at])).toEqual([[1, now + 300_000]])
  })
  it('حذف، «انجام شد» و زنگ‌خورده → لغو', () => {
    const planned = new Map([[1, sigOf(note('a'))], [2, sigOf(note('b'))], [3, sigOf(note('c'))]])
    const r = planAlarms([note('b', { done: true }), note('c', { fired: true })], planned, now, idOf)
    expect(r.cancel.sort()).toEqual([1, 2, 3])
  })
  it('سررسیده ولی هنوز زنگ نخورده و قبلاً ثبت شده → دست نمی‌زنه', () => {
    const n = note('a', { remindAt: now - 1000 })
    const r = planAlarms([n], new Map([[1, sigOf(n)]]), now, idOf)
    expect(r.schedule).toEqual([])
    expect(r.cancel).toEqual([])
  })
  it('سررسیده و ثبت‌نشده → ثبت نمی‌شه (خود اپ زنگش رو می‌زنه)', () => {
    const r = planAlarms([note('a', { remindAt: now - 1000 })], new Map(), now, idOf)
    expect(r.schedule).toEqual([])
  })
  it('isPending مثل نوار پیشرفت', () => {
    expect(isPending(note('a'))).toBe(true)
    expect(isPending(note('a', { fired: true }))).toBe(false)
  })
})

describe('makeAlarmIds', () => {
  const fake = () => {
    const m = new Map()
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }
  }
  it('شناسه‌ی پایدار و صعودی', () => {
    const idFor = makeAlarmIds(fake())
    expect([idFor('x'), idFor('y'), idFor('x')]).toEqual([1, 2, 1])
  })
  it('بین دو بار ساخت (مثل ری‌استارت اپ) همون نگاشت می‌مونه', () => {
    const st = fake()
    makeAlarmIds(st)('x'); makeAlarmIds(st)('y')
    expect(makeAlarmIds(st)('y')).toBe(2)
    expect(makeAlarmIds(st)('z')).toBe(3)
  })
  it('داده‌ی خراب ذخیره‌شده کرش نمی‌کنه', () => {
    const st = fake()
    st.setItem('alarmIds', '{خراب')
    expect(makeAlarmIds(st)('x')).toBe(1)
  })
})
