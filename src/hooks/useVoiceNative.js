import { useCallback, useEffect, useRef, useState } from 'react'
import { dlog } from '../platform/log'

// Android uses the operating system's speech UI instead of a silent, in-WebView
// recognizer session. This makes microphone activation visible and lets Android
// own the recognizer lifecycle (especially on first use / permission grant).
const MESSAGES = {
  unsupported: 'سرویس تشخیص گفتار روی گوشی پیدا نشد. سرویس Speech Services by Google را نصب/به‌روز کن و زبان فارسی را فعال کن.',
  denied_native: 'اجازه میکروفون یا تشخیص گفتار داده نشد. از تنظیمات گوشی ← برنامه‌ها ← دفترچه یادداشت ← مجوزها، میکروفون را فعال کن.',
  nospeech: 'صدایی به متن تبدیل نشد. اینترنت، زبان فارسی و سرویس تشخیص گفتار گوشی را بررسی کن و دوباره بگو.',
  busy: 'میکروفون در اختیار برنامه دیگری است. تماس یا برنامه ضبط صدا را ببند و دوباره امتحان کن.',
  network: 'سرویس تشخیص گفتار به شبکه دسترسی ندارد. اینترنت را بررسی کن.',
  unknown: 'تشخیص گفتار با خطا متوقف شد.',
}

let SRPromise
const getSR = () => {
  if (!SRPromise) SRPromise = import('@capacitor-community/speech-recognition').then((m) => m.SpeechRecognition)
  return SRPromise
}

export default function useVoiceNative({ onFinal }) {
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const activeRef = useRef(false)
  const startingRef = useRef(false)
  const manualRef = useRef(false)
  const listenersRef = useRef([])
  const timersRef = useRef([])
  const sessionRef = useRef(0)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }, [])

  const dropListeners = useCallback(() => {
    const handles = listenersRef.current
    listenersRef.current = []
    handles.forEach((h) => {
      try { Promise.resolve(h.remove()).catch(() => {}) } catch {}
    })
  }, [])

  const fail = useCallback((code, extra = '', session = sessionRef.current) => {
    if (session !== sessionRef.current) return
    dlog('voice', `${code}${extra ? ` · ${extra}` : ''}`)
    sessionRef.current += 1
    activeRef.current = false
    clearTimers()
    dropListeners()
    setError({ code, message: `${MESSAGES[code] || MESSAGES.unknown}${extra ? ` (${extra})` : ''}`, device: '' })
    setListening(false)
    setInterim('')
  }, [clearTimers, dropListeners])

  const finish = useCallback((session, finalText = '') => {
    if (!activeRef.current || session !== sessionRef.current) return
    activeRef.current = false
    sessionRef.current += 1
    clearTimers()
    dropListeners()
    const text = String(finalText || interim || '').trim()
    setListening(false)
    setInterim('')
    dlog('voice', text ? `final-result chars=${text.length}` : 'recognition ended without text')
    if (text) onFinalRef.current(text)
    else if (!manualRef.current) setError({ code: 'nospeech', message: MESSAGES.nospeech, device: '' })
  }, [clearTimers, dropListeners, interim])

  // In popup mode Android owns the speech activity. stop() is best-effort only;
  // the user can cancel the system speech window with Android's Back/cancel UI.
  const stop = useCallback(() => {
    const session = sessionRef.current
    manualRef.current = true
    getSR()
      .then((p) => Promise.resolve(p.stop()).catch((e) => dlog('voice-stop', e?.message || String(e))))
      .catch((e) => dlog('voice-stop', e?.message || String(e)))
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((x) => x !== id)
      if (session === sessionRef.current) {
        activeRef.current = false
        sessionRef.current += 1
        dropListeners()
        setListening(false)
        setInterim('')
      }
    }, 1000)
    timersRef.current.push(id)
  }, [dropListeners])

  useEffect(() => () => {
    sessionRef.current += 1
    activeRef.current = false
    clearTimers()
    dropListeners()
    getSR().then((p) => Promise.resolve(p.stop()).catch(() => {})).catch(() => {})
  }, [clearTimers, dropListeners])

  const begin = async () => {
    const session = ++sessionRef.current
    clearTimers()
    dropListeners()
    setError(null)
    setInterim('')
    manualRef.current = false

    try {
      const p = await getSR()
      if (session !== sessionRef.current) return

      let perm = await p.checkPermissions()
      dlog('voice', `permission-before=${JSON.stringify(perm)}`)
      if (perm?.speechRecognition !== 'granted') perm = await p.requestPermissions()
      dlog('voice', `permission-after=${JSON.stringify(perm)}`)
      if (session !== sessionRef.current) return
      if (perm?.speechRecognition !== 'granted') {
        return fail('denied_native', JSON.stringify(perm || {}), session)
      }

      const availability = await p.available()
      dlog('voice', `available=${JSON.stringify(availability)}`)
      if (session !== sessionRef.current) return
      if (!availability?.available) {
        return fail('unsupported', JSON.stringify(availability || {}), session)
      }

      activeRef.current = true
      setListening(true)
      dlog('voice', 'launching Android speech UI language=fa-IR popup=true')

      // popup:true launches Android's native recognizer Activity. With
      // partialResults:false, start() resolves with the final matches array.
      const result = await p.start({ language: 'fa-IR', maxResults: 1, partialResults: false, popup: true })
      if (session !== sessionRef.current) return
      dlog('voice-start-result', JSON.stringify(result || {}))
      const matches = Array.isArray(result?.matches) ? result.matches : []
      const text = String(matches[0] || '').trim()
      finish(session, text)
    } catch (e) {
      const message = String(e?.message || e || 'unknown')
      dlog('voice-native-error', message)
      if (session !== sessionRef.current) return
      // Android returns result code 0 when the system recognition window is
      // cancelled (for example, the user presses Back). This is not a failure.
      if (/^(?:0|cancelled|canceled)$/i.test(message.trim())) {
        activeRef.current = false
        sessionRef.current += 1
        clearTimers()
        dropListeners()
        setListening(false)
        setInterim('')
        setError(null)
      } else if (/permission|denied|not allowed/i.test(message)) {
        fail('denied_native', message, session)
      } else if (/network|internet/i.test(message)) {
        fail('network', message, session)
      } else if (/busy|audio|recognizer.*busy/i.test(message)) {
        fail('busy', message, session)
      } else if (/no match|no speech|speech timeout/i.test(message)) {
        fail('nospeech', message, session)
      } else if (/not available|unavailable|recognition service/i.test(message)) {
        fail('unsupported', message, session)
      } else {
        fail('unknown', message, session)
      }
    }
  }

  const start = async () => {
    if (startingRef.current || activeRef.current) return
    startingRef.current = true
    try { await begin() } finally { startingRef.current = false }
  }

  const toggle = () => {
    if (listening || activeRef.current) return stop()
    return start()
  }

  return { listening, interim, error, level: 0, device: '', meter: false, toggle, clearError: () => setError(null) }
}
