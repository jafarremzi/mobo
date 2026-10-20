// بعد از «npx cap add android» اجرا می‌شه و پروژه‌ی اندروید تولیدشده رو آماده می‌کنه:
//  ۱) فایل صدای زنگ (res/raw/bell.wav) از همون زنگ داخل کد ساخته می‌شه
//  ۲) آیکن اعلان کپی می‌شه
//  ۳) مجوزها و queries تشخیص گفتار به AndroidManifest اضافه می‌شن؛ چرخه‌ی عمر افزونه‌ی میکروفون هم اصلاح می‌شه
//  ۴) امضای debug روی یه keystore ثابت تنظیم می‌شه (تا APK جدید روی قبلی نصب بشه و یادداشت‌ها نپرن)
// چند بار اجرا کردنش بی‌خطره.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBellBuffer } from '../src/lib/sound.js'
import { patchSpeechRecognitionPlugin } from './patch-speech-recognition.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = process.argv[2] || join(root, 'android')
const app = join(androidDir, 'app')
const main = join(app, 'src', 'main')
if (!existsSync(main)) throw new Error('پوشه‌ی android پیدا نشد؛ اول «npx cap add android» رو اجرا کن: ' + main)

// Patch known Android SpeechRecognizer lifecycle bugs before Gradle builds the plugin.
patchSpeechRecognitionPlugin(root)

// ---------- ۱) صدای زنگ: همون زنگ سه‌ضربه، تکرارشده تا حدود ۲۰ ثانیه ----------
function bellWav(seconds = 20) {
  const sr = 22050
  const src = new Int16Array(makeBellBuffer().slice(44))
  const total = sr * seconds
  const period = Math.floor(sr * 3.2)
  const out = new Int16Array(total)
  for (let start = 0; start < total; start += period) {
    for (let i = 0; i < src.length && start + i < total; i++) out[start + i] = src[i]
  }
  const buf = Buffer.alloc(44 + out.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + out.length * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(out.length * 2, 40)
  Buffer.from(out.buffer).copy(buf, 44)
  return buf
}
mkdirSync(join(main, 'res', 'raw'), { recursive: true })
writeFileSync(join(main, 'res', 'raw', 'bell.wav'), bellWav())

// ---------- ۲) آیکن اعلان ----------
mkdirSync(join(main, 'res', 'drawable'), { recursive: true })
copyFileSync(join(root, 'android-overrides', 'res', 'drawable', 'ic_stat_notes.xml'), join(main, 'res', 'drawable', 'ic_stat_notes.xml'))

// ---------- ۳) AndroidManifest ----------
const manifestPath = join(main, 'AndroidManifest.xml')
let manifest = readFileSync(manifestPath, 'utf8')
const perms = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.VIBRATE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.RECORD_AUDIO',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
]
let add = ''
for (const p of perms) if (!manifest.includes(`"${p}"`)) add += `    <uses-permission android:name="${p}" />\n`
if (!manifest.includes('android.speech.RecognitionService')) {
  add += '    <queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n'
}
if (!manifest.includes('android.hardware.microphone')) {
  add += '    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n'
}
if (add) {
  if (!manifest.includes('</manifest>')) throw new Error('AndroidManifest.xml قالب غیرمنتظره دارد')
  manifest = manifest.replace('</manifest>', add + '</manifest>')
  writeFileSync(manifestPath, manifest)
}

// ---------- ۴) امضای debug ثابت ----------
const gradlePath = join(app, 'build.gradle')
let gradle = readFileSync(gradlePath, 'utf8')
if (!gradle.includes('debug.keystore')) {
  const block = `
    signingConfigs {
        debug {
            storeFile file('../../debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
`
  const m = gradle.match(/^android\s*\{[^\n]*\n/m)
  if (!m) throw new Error('بلوک android در app/build.gradle پیدا نشد')
  gradle = gradle.replace(m[0], m[0] + block)
  writeFileSync(gradlePath, gradle)
}
console.log('پروژه‌ی اندروید آماده شد:', androidDir)
