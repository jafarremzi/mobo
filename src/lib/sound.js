// صدای زنگ: بدون فایل صوتی، خود برنامه یه زنگ سه‌ضربه‌ای می‌سازه (سنتز صدای ناقوس)
let audio
let vibTimer

export function makeBellBuffer() {
  const sr = 22050
  const n = Math.floor(sr * 2.4)
  const data = new Float32Array(n)
  const strikes = [[0, 784], [0.38, 988], [0.76, 1175]] // [زمان شروع، فرکانس]
  const partials = [[1, 1, 2.2], [2.01, 0.55, 3.2], [2.76, 0.35, 4], [5.4, 0.2, 6], [8.93, 0.1, 9]] // [نسبت، دامنه، سرعت محو شدن]

  for (const [t0, f] of strikes) {
    const start = Math.floor(t0 * sr)
    for (let i = start; i < n; i++) {
      const t = (i - start) / sr
      let v = 0
      for (const [r, a, d] of partials) v += a * Math.sin(2 * Math.PI * f * r * t) * Math.exp(-d * t)
      data[i] += v * Math.min(1, t * 400)
    }
  }
  let max = 0
  for (const x of data) max = Math.max(max, Math.abs(x))

  const buf = new ArrayBuffer(44 + n * 2)
  const dv = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  w(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round((data[i] / max) * 0.85 * 32767), true)
  return buf
}

function getAudio() {
  if (!audio) {
    audio = new Audio(URL.createObjectURL(new Blob([makeBellBuffer()], { type: 'audio/wav' })))
    audio.preload = 'auto'
  }
  return audio
}

// مرورگر فقط بعد از اولین کلیک/لمس اجازه‌ی پخش صدا می‌ده؛ اینجا بی‌صدا یه بار پخش می‌کنیم تا قفل باز بشه
export function unlockAudio() {
  try {
    const a = getAudio()
    if (!a.paused || a.loop || a.dataset.unlocked) return
    a.dataset.unlocked = '1'
    a.muted = true
    a.play()
      .then(() => { a.pause(); a.currentTime = 0; a.muted = false })
      .catch(() => { a.muted = false; delete a.dataset.unlocked })
  } catch {}
}

const vibrate = () => { try { navigator.vibrate?.([400, 150, 400]) } catch {} }

// زنگ تکرارشونده تا وقتی کاربر آلارم رو ببنده
export function startRing() {
  try {
    const a = getAudio()
    a.muted = false
    a.loop = true
    a.currentTime = 0
    a.play().catch(() => {})
  } catch {}
  clearInterval(vibTimer)
  vibrate()
  vibTimer = setInterval(vibrate, 2400)
}

export function stopRing() {
  clearInterval(vibTimer)
  try {
    if (!audio) return
    audio.pause()
    audio.loop = false
    audio.currentTime = 0
  } catch {}
}

// اگه مرورگر پخش خودکار زنگ رو بلاک کرده بود (مثلاً بعد از رفرش)، با اولین لمس/کلیک ادامه می‌دیم
export function ensureRing() {
  try {
    const a = getAudio()
    if (a.loop && a.paused) a.play().catch(() => {})
  } catch {}
}

// یک بار پخش، برای دکمه‌ی تست
export function playOnce() {
  try {
    const a = getAudio()
    a.muted = false
    a.loop = false
    a.currentTime = 0
    a.play().catch(() => {})
  } catch {}
}
