import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || process.cwd()
const MARKER = 'NOTES APP ANDROID MIC FIX'

function replaceRequired(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`Cannot safely patch SpeechRecognition.java (${label}); expected one match, found ${count}. Check the installed speech-recognition plugin version.`)
  return source.replace(oldText, newText)
}

export function patchSpeechRecognitionPlugin(rootDir = root) {
  const path = join(rootDir, 'node_modules', '@capacitor-community', 'speech-recognition', 'android', 'src', 'main', 'java', 'com', 'getcapacitor', 'community', 'speechrecognition', 'SpeechRecognition.java')
  if (!existsSync(path)) {
    throw new Error(`Speech recognition Android source not found at ${path}. Run npm install before preparing Android.`)
  }

  let source = readFileSync(path, 'utf8')
  if (source.includes(MARKER)) {
    console.log('Android speech-recognition lifecycle fix already applied.')
    return
  }

  const oldStop = `    @PluginMethod
    public void stop(final PluginCall call) {
        try {
            stopListening();
        } catch (Exception ex) {
            call.reject(ex.getLocalizedMessage());
        }
    }`
  const newStop = `    @PluginMethod
    public void stop(final PluginCall call) {
        try {
            stopListening();
            // ${MARKER}: always resolve so JavaScript can finish its session.
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getLocalizedMessage());
        }
    }`
  source = replaceRequired(source, oldStop, newStop, 'stop()')

  const beginStart = `                        SpeechRecognition.this.lock.lock();
                        if (speechRecognizer != null) {`
  const beginPatched = `                        SpeechRecognition.this.lock.lock();
                        // ${MARKER}: don't leak partial text between recording sessions.
                        previousPartialResults = new JSONArray();
                        if (speechRecognizer != null) {`
  source = replaceRequired(source, beginStart, beginPatched, 'beginListening() cleanup')

  const oldStopListening = `    private void stopListening() {
        bridge
            .getWebView()
            .post(() -> {
                try {
                    SpeechRecognition.this.lock.lock();
                    if (SpeechRecognition.this.listening) {
                        speechRecognizer.stopListening();
                        SpeechRecognition.this.listening(false);
                    }
                } catch (Exception ex) {
                    throw ex;
                } finally {
                    SpeechRecognition.this.lock.unlock();
                }
            });
    }`
  const newStopListening = `    private void stopListening() {
        bridge
            .getWebView()
            .post(() -> {
                try {
                    SpeechRecognition.this.lock.lock();
                    // ${MARKER}: tear down an ended/stale recognizer as well as an active one.
                    if (speechRecognizer != null) {
                        if (SpeechRecognition.this.listening) {
                            try { speechRecognizer.stopListening(); } catch (Exception ignored) {}
                        } else {
                            try { speechRecognizer.cancel(); } catch (Exception ignored) {}
                            try { speechRecognizer.destroy(); } catch (Exception ignored) {}
                            speechRecognizer = null;
                            previousPartialResults = new JSONArray();
                        }
                    }
                    SpeechRecognition.this.listening(false);
                } finally {
                    SpeechRecognition.this.lock.unlock();
                }
            });
    }`
  source = replaceRequired(source, oldStopListening, newStopListening, 'stopListening()')

  const oldError = `        @Override
        public void onError(int error) {
            SpeechRecognition.this.stopListening();
            String errorMssg = getErrorText(error);
            if (this.call != null) {
                call.reject(errorMssg);
            }
        }`
  const newError = `        @Override
        public void onError(int error) {
            final boolean benign =
                error == SpeechRecognizer.ERROR_NO_MATCH
                || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                || error == SpeechRecognizer.ERROR_CLIENT;
            final String errorMssg = getErrorText(error);
            bridge
                .getWebView()
                .post(() -> {
                    try {
                        SpeechRecognition.this.lock.lock();
                        SpeechRecognition.this.listening(false);
                        if (speechRecognizer != null) {
                            try { speechRecognizer.cancel(); } catch (Exception ignored) {}
                            try { speechRecognizer.destroy(); } catch (Exception ignored) {}
                            speechRecognizer = null;
                        }
                        previousPartialResults = new JSONArray();
                        JSObject err = new JSObject();
                        err.put("message", errorMssg);
                        SpeechRecognition.this.notifyListeners("error", err);
                        JSObject ret = new JSObject();
                        ret.put("status", "stopped");
                        SpeechRecognition.this.notifyListeners(LISTENING_EVENT, ret);
                    } finally {
                        SpeechRecognition.this.lock.unlock();
                    }
                });
            // ${MARKER}: partialResults mode resolves start() immediately; don't reject that call later.
            if (this.call != null && !this.partialResults && !benign) {
                this.call.reject(errorMssg);
            }
            this.call = null;
        }`
  source = replaceRequired(source, oldError, newError, 'onError()')

  writeFileSync(path, source, 'utf8')
  console.log('Applied Android speech-recognition lifecycle fix to:', path)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  patchSpeechRecognitionPlugin(root)
}
