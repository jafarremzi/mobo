import { useEffect, useRef, useState } from 'react'

const MESSAGES = {
  unsupported: 'این مرورگر تشخیص گفتار رو پشتیبانی نمی‌کنه. از Chrome یا Edge استفاده کن.',
  insecure: 'میکروفون فقط روی HTTPS یا localhost کار می‌کنه.',
  denied: 'دسترسی به میکروفون بسته است.',
  nomic: 'هیچ میکروفونی پیدا نشد.',
  busy: 'میکروفون دست برنامه‌ی دیگه‌ایه. اون رو ببند و دوباره امتحان کن.',
  silent: 'میکروفون صدایی نمی‌گیره.',
  nospeech: 'صدا گرفته شد ولی متنی تشخیص داده نشد. کمی بلندتر بگو و اینترنتت رو چک کن.',
  network: 'تشخیص گفتار به اینترنت نیاز داره.',
  language: 'تشخیص گفتار فارسی روی این مرورگر یا دستگاه پشتیبانی نمی‌شه.',
  unknown: 'تشخیص گفتار با خطای ناشناخته متوقف شد.',
}

// روی موبایل نگه داشتن همزمان میکروفون برای نمایشگر سطح صدا با تشخیص گفتار تداخل پیدا می‌کنه؛ اونجا نمایشگر خاموشه
const MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export default function useVoice({ onFinal }) {
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const [level, setLevel] = useState(0)
  const [device, setDevice] = useState('')
  const [meter, setMeter] = useState(false)
  const startingRef = useRef(false)

  const recRef = useRef(null)
  const streamRef = useRef(null)
  const ctxRef = useRef(null)
  const rafRef = useRef(0)
  const peakRef = useRef(0)

  const cleanup = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    setLevel(0)
  }

  useEffect(() => () => { recRef.current?.abort?.(); cleanup() }, [])

  const fail = (code, label = '', extra = '') => {
    cleanup()
    setError({ code, message: MESSAGES[code] + extra, device: label })
    setListening(false)
    setInterim('')
  }

  // نمایشگر سطح صدا؛ نشون می‌ده میکروفون واقعاً صدا می‌گیره یا نه
  const startMeter = (stream) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const actx = new AC()
      actx.resume?.()
      ctxRef.current = actx
      const analyser = actx.createAnalyser()
      analyser.fftSize = 512
      actx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      let last = 0
      const tick = (t) => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) { const x = (v - 128) / 128; sum += x * x }
        const lv = Math.min(1, Math.sqrt(sum / buf.length) * 5)
        peakRef.current = Math.max(peakRef.current, lv)
        if (t - last > 70) { setLevel(lv); last = t }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {}
  }

  const begin = async () => {
    setError(null)
    peakRef.current = 0
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return fail('unsupported')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return fail('insecure')

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      return fail(e.name === 'NotFoundError' ? 'nomic' : e.name === 'NotReadableError' ? 'busy' : 'denied')
    }
    const label = stream.getAudioTracks()[0]?.label || ''
    setDevice(label)
    if (MOBILE) {
      // فقط برای گرفتن مجوز؛ استریم رو آزاد می‌کنیم تا تشخیص گفتار راحت میکروفون رو بگیره
      stream.getTracks().forEach((t) => t.stop())
      setMeter(false)
    } else {
      // استریم رو باز نگه می‌داریم تا سطح صدا نمایش داده بشه
      streamRef.current = stream
      setMeter(true)
      startMeter(stream)
    }

    const rec = new SR()
    rec.lang = 'fa-IR'
    rec.interimResults = true
    rec.continuous = false

    rec.onresult = (e) => {
      let fin = ''
      let tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) fin += r[0].transcript
        else tmp += r[0].transcript
      }
      setInterim(tmp)
      if (fin && onFinalRef.current(fin.trim()) === 'stop') rec.stop()
    }
    rec.onerror = (e) => {
      if (e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') return fail('denied')
      if (e.error === 'audio-capture') return fail('nomic')
      if (e.error === 'network') return fail('network')
      if (e.error === 'no-speech') return fail(!MOBILE && peakRef.current < 0.04 ? 'silent' : 'nospeech', label)
      if (e.error === 'language-not-supported') return fail('language')
      fail('unknown', label, ` (${e.error})`)
    }
    rec.onend = () => {
      cleanup()
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      cleanup()
      setListening(false)
    }
  }

  // جلوگیری از دو بار شروع پشت‌سرهم (کلیک سریع، قبل از اینکه مجوز میکروفون جواب بده)
  const start = async () => {
    if (startingRef.current) return
    startingRef.current = true
    try {
      await begin()
    } finally {
      startingRef.current = false
    }
  }

  const toggle = () => (listening ? recRef.current?.stop() : start())

  return { listening, interim, error, level, device, meter, toggle, clearError: () => setError(null) }
}
