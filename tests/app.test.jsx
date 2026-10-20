// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, host
const mount = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root.render(<App />))
}
const unmount = async () => { await act(async () => root.unmount()); host.remove() }
const tick = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms) }) }

// نوشتن تو textarea به روش React
const type = async (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const click = async (el) => { await act(async () => el.click()) }
const byText = (txt, sel = 'button') => [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(txt))
const addNote = async (text) => {
  await type(document.querySelector('textarea'), text)
  await click(byText('افزودن'))
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.stubGlobal('Audio', class { play() { return Promise.resolve() } pause() {} })
  URL.createObjectURL = () => 'blob:x'
  URL.revokeObjectURL = () => {}
  delete globalThis.Worker // jsdom ندارد → مسیر fallback
})
afterEach(async () => { await unmount(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('اپ', () => {
  it('پک می‌سازه و یادداشت رو با صدا/متن به پک درست می‌ده', async () => {
    await mount()
    await addNote('یک پک بساز برای کارهای دانشگاه')
    const select = document.querySelector('select')
    expect([...select.options].map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('دانشگاه')])
    )
    await addNote('خرید کوله برای دانشگاه')
    expect(document.querySelector('.note p').textContent).toBe('خرید کوله')
    // پک ناشناس → همون پک انتخاب‌شده؛ تو «عمومی» نمی‌ره
    const notes = JSON.parse(localStorage.getItem('notes'))
    const uni = JSON.parse(localStorage.getItem('packs')).find((p) => p.name === 'دانشگاه')
    expect(notes[0].packId).toBe(uni.id)
  })

  it('آلارم با رفرش گم نمی‌شه و باشه/۵ دقیقه بعد کار می‌کنه', async () => {
    await mount()
    await addNote('جلسه ۱ دقیقه دیگه')
    expect(document.querySelector('.overlay')).toBeNull()
    await tick(61_000)
    expect(document.querySelector('.overlay')).not.toBeNull()

    // رفرش وسط زنگ
    await unmount()
    await mount()
    expect(document.querySelector('.overlay')).not.toBeNull()
    expect(document.querySelector('.alarm p').textContent).toContain('جلسه')

    await click(byText('باشه'))
    expect(document.querySelector('.overlay')).toBeNull()
    await unmount()
    await mount()
    expect(document.querySelector('.overlay')).toBeNull() // دوباره زنگ نمی‌زنه
  })

  it('حذف یادداشت با بازگردانی', async () => {
    await mount()
    await addNote('یادداشت تست')
    await click(document.querySelector('.del'))
    expect(document.querySelector('.note')).toBeNull()
    await click(byText('بازگردانی'))
    expect(document.querySelector('.note p').textContent).toBe('یادداشت تست')
  })

  it('وقتی زمان شبیه زمانه ولی تشخیص داده نشه هشدار می‌ده', async () => {
    await mount()
    await addNote('فردا برم بانک')
    expect(document.querySelector('.toast').textContent).toContain('زمان رو نفهمیدم')
  })

  it('تغییر تب دیگه (storage) یادداشت‌ها رو همگام می‌کنه', async () => {
    await mount()
    const other = [{ id: 'x1', text: 'از تب دیگه', remindAt: null, startAt: 1, fired: false, done: false }]
    await act(async () => {
      const v = JSON.stringify(other)
      localStorage.setItem('notes', v)
      window.dispatchEvent(new StorageEvent('storage', { key: 'notes', newValue: v, storageArea: localStorage }))
    })
    expect(document.querySelector('.note p').textContent).toBe('از تب دیگه')
  })
})
