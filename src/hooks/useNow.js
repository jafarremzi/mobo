import { useEffect, useState } from 'react'

// زمان فعلی رو هر `interval` میلی‌ثانیه به‌روز می‌کنه (null = متوقف)
export default function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!interval) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  // وقتی تایمر تازه روشن می‌شه، مقدار قدیمی نمایش داده نشه
  return interval ? Math.max(now, Date.now()) : now
}
