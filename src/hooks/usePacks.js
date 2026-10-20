import { useEffect, useState } from 'react'
import { GENERAL_ID, cleanPackName, samePack } from '../lib/packs'

const KEY = 'packs'
const ACTIVE = 'activePack'
const GENERAL = { id: GENERAL_ID, name: 'عمومی' }

const parse = (raw) => {
  try {
    const a = JSON.parse(raw || '[]')
    const list = Array.isArray(a) ? a.filter((p) => p && p.id && p.name) : []
    return list.some((p) => p.id === GENERAL_ID) ? list : [GENERAL, ...list]
  } catch {
    return [GENERAL]
  }
}
const load = () => {
  try { return parse(localStorage.getItem(KEY)) } catch { return [GENERAL] }
}
const loadActive = () => {
  try { return localStorage.getItem(ACTIVE) || 'all' } catch { return 'all' }
}

export default function usePacks() {
  const [packs, setPacks] = useState(load)
  const [selected, setSelected] = useState(loadActive)
  // اگه پک انتخابی دیگه وجود نداره، برمی‌گرده به «همه»
  const active = selected === 'all' || packs.some((p) => p.id === selected) ? selected : 'all'

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(packs)) } catch {} }, [packs])
  useEffect(() => { try { localStorage.setItem(ACTIVE, active) } catch {} }, [active])

  // همگام‌سازی بین تب‌ها
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY && e.storageArea === localStorage) setPacks(parse(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // پک جدید می‌سازه؛ اگه هم‌نام داشت همون رو برمی‌گردونه. خروجی: { pack, created } یا null
  const create = (raw) => {
    const name = cleanPackName(raw)
    if (!name) return null
    const exist = packs.find((p) => samePack(p.name, name))
    if (exist) return { pack: exist, created: false }
    const pack = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name }
    setPacks((p) => [...p, pack])
    return { pack, created: true }
  }

  const rename = (id, raw) => {
    const name = cleanPackName(raw)
    if (!name || id === GENERAL_ID || packs.some((p) => p.id !== id && samePack(p.name, name))) return false
    setPacks((p) => p.map((x) => (x.id === id ? { ...x, name } : x)))
    return true
  }

  const remove = (id) => {
    if (id === GENERAL_ID) return
    setPacks((p) => p.filter((x) => x.id !== id))
    setSelected('all')
  }

  return { packs, active, select: setSelected, create, rename, remove }
}
