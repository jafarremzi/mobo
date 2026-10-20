```js
// بعد از «npx cap add android» اجرا می‌شود و پروژه‌ی اندروید را آماده می‌کند:
// ۱) ساخت صدای زنگ
// ۲) کپی آیکن اعلان
// ۳) افزودن مجوزها و queries تشخیص گفتار
// ۴) تنظیم امضای debug ثابت
// ۵) چاپ اطلاعات تشخیصی افزونه‌ی Speech Recognition در GitHub Actions

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBellBuffer } from '../src/lib/sound.js'
import { patchSpeechRecognitionPlugin } from './patch-speech-recognition.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = process.argv[2] || join(root, 'android')
const app = join(androidDir, 'app')
const main = join(app, 'src', 'main')

if (!existsSync(main)) {
  throw new Error(
    'پوشه‌ی android پیدا نشد؛ اول «npx cap add android» رو اجرا کن: ' + main
  )
}

// ---------- اطلاعات تشخیصی افزونه‌ی تشخیص گفتار ----------
function printSpeechRecognitionDiagnostics() {
  const pluginFile = join(
    root,
    'node_modules',
    '@capacitor-community',
    'speech-recognition',
    'android',
    'src',
    'main',
    'java',
    'com',
    'getcapacitor',
    'community',
    'speechrecognition',
    'SpeechRecognition.java'
  )

  const patchFile = join(root, 'scripts', 'patch-speech-recognition.mjs')

  console.log('\n========== SPEECH RECOGNITION DIAGNOSTICS ==========')
  console.log('Plugin source:', pluginFile)
  console.log('Patch script:', patchFile)

  if (existsSync(pluginFile)) {
    const source = readFileSync(pluginFile, 'utf8')
    console.log('\n----- Installed SpeechRecognition.java: onError -----')

    const lines = source.split(/\r?\n/)
    const matches = []

    for (let i = 0; i < lines.length; i++) {
      if (/\bonError\s*\(/.test(lines[i])) {
        matches.push(i)
      }
    }

    if (matches.length === 0) {
      console.log('No onError method/signature found.')
      console.log('File preview:\n' + lines.slice(0, 100).join('\n'))
    } else {
      for (const index of matches) {
        const start = Math.max(0, index - 8)
        const end = Math.min(lines.length, index + 28)

        console.log(`\n--- Lines ${start + 1}-${end} ---`)
        console.log(
          lines
            .slice(start, end)
            .map((line, offset) => `${start + offset + 1}: ${line}`)
            .join('\n')
        )
      }
    }
  } else {
    console.log('ERROR: Installed plugin source file was not found.')
    console.log('Checking where SpeechRecognition.java exists...')

    const { execSync } = await import('node:child_process')
    try {
      execSync(
        `find "${join(root, 'node_modules', '@capacitor-community', 'speech-recognition')}" -name 'SpeechRecognition.java' -print`,
        { stdio: 'inherit' }
      )
    } catch {
      console.log('Could not locate SpeechRecognition.java.')
    }
  }

  if (existsSync(patchFile)) {
    const patch = readFileSync(patchFile, 'utf8')
    const lines = patch.split(/\r?\n/)

    console.log('\n----- Patch script: onError references -----')
    let found = false

    for (let i = 0; i < lines.length; i++) {
      if (/onError|replaceRequired/.test(lines[i])) {
        found = true
        const start = Math.max(0, i - 3)
        const end = Math.min(lines.length, i + 7)

        console.log(
          lines
            .slice(start, end)
            .map((line, offset) => `${start + offset + 1}: ${line}`)
            .join('\n')
        )
        console.log('---')
      }
    }

    if (!found) console.log('No onError/replaceRequired references found.')
  }

  console.log('\n========== END DIAGNOSTICS ==========\n')
}

// اطلاعات را قبل از patch چاپ کن تا حتی اگر patch شکست خورد، لاگ باقی بماند.
printSpeechRecognitionDiagnostics()

// ---------- اصلاح افزونه ----------
patchSpeechRecognitionPlugin(root)

// ---------- ۱) صدای زنگ ----------
function bellWav(seconds = 20) {
  const sr = 22050
  const src = new Int16Array(makeBellBuffer().slice(44))
  const total = sr * seconds
  const period = Math.floor(sr * 3.2)
  const out = new Int16Array(total)

  for (let start = 0; start < total; start += period) {
    for (let i = 0; i < src.length && start + i < total; i++) {
      out[start + i] = src[i]
    }
  }

  const buf = Buffer.alloc(44 + out.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + out.length * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(out.length * 2, 40)
  Buffer.from(out.buffer).copy(buf, 44)

  return buf
}

mkdirSync(join(main, 'res', 'raw'), { recursive: true })
writeFileSync(join(main, 'res', 'raw', 'bell.wav'), bellWav())

// ---------- ۲) آیکن اعلان ----------
mkdirSync(join(main, 'res', 'drawable'), { recursive: true })
copyFileSync(
  join(root, 'android-overrides', 'res', 'drawable', 'ic_stat_notes.xml'),
  join(main, 'res', 'drawable', 'ic_stat_notes.xml')
)

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

for (const p of perms) {
  if (!manifest.includes(`"${p}"`)) {
    add += `    <uses-permission android:name="${p}" />\n`
  }
}

if (!manifest.includes('android.speech.RecognitionService')) {
  add +=
    '    <queries>\n' +
    '        <intent>\n' +
    '            <action android:name="android.speech.RecognitionService" />\n' +
    '        </intent>\n' +
    '    </queries>\n'
}

if (!manifest.includes('android.hardware.microphone')) {
  add +=
    '    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n'
}

if (add) {
  if (!manifest.includes('</manifest>')) {
    throw new Error('AndroidManifest.xml قالب غیرمنتظره دارد')
  }

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

  if (!m) {
    throw new Error('بلوک android در app/build.gradle پیدا نشد')
  }

  gradle = gradle.replace(m[0], m[0] + block)
  writeFileSync(gradlePath, gradle)
}

console.log('پروژه‌ی اندروید آماده شد:', androidDir)
```
