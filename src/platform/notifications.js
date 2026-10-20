import { CHANNEL_ID } from '../lib/alarmPlan'
import { dlog } from './log'

// پلاگین فقط داخل اپ اندروید و با import پویا بارگذاری می‌شه
let LN
export const getLN = async () => (LN ??= (await import('@capacitor/local-notifications')).LocalNotifications)

let channelReady = false
export async function ensureChannel(ln) {
  if (channelReady) return
  try {
    await ln.createChannel({
      id: CHANNEL_ID,
      name: 'یادآورها',
      description: 'آلارم یادآورهای یادداشت‌ها',
      importance: 5,
      visibility: 1,
      sound: 'bell.wav',
      vibration: true,
      lights: true,
    })
    channelReady = true
  } catch (e) {
    dlog('channel', e)
  }
}
