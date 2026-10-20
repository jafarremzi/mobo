
import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.argv[2] || process.cwd()
const MARKER = 'NOTES APP ANDROID MIC FIX'

function replaceRequired(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1

  if (count !== 1) {
    throw new Error(
      `Cannot safely patch SpeechRecognition.java (${label}); ` +
      `expected one match, found ${count}. ` +
      'No changes were written. Check the installed plugin source.'
    )
  }

  return source.replace(oldText, newText)
}

function replacePatternRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    const start = source.indexOf('beginListening()')
    const context = start >= 0
      ? source.slice(start, start + 1800)
      : 'beginListening() not found'

    throw new Error(
      `Cannot safely patch SpeechRecognition.java (${label}); ` +
      `pattern not found.\nNearby source:\n${context}\n` +
      'No changes were written.'
    )
  }

  return source.replace(pattern, replacement)
}

export function patchSpeechRecognitionPlugin(
  rootDir = root
) {
  const path = join(
    rootDir,
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

  if (!existsSync(path)) {
    throw new Error(
      `Speech recognition Android source not found at ${path}. ` +
      'Run npm install before preparing Android.'
    )
  }

  let source = readFileSync(path, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  if (source.includes(MARKER)) {
    console.log(
      'Android speech-recognition lifecycle fix already applied.'
    )
    return
  }

  // All changes are made in memory first.
  // The Java file is written only if every patch succeeds.
  let patched = source

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
            // ${MARKER}: acknowledge the stop request.
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getLocalizedMessage());
        }
    }`

  patched = replaceRequired(
    patched,
    oldStop,
    newStop,
    'stop()'
  )

  const beginPattern =
    /SpeechRecognition\.this\.lock\.lock\(\);\s*if\s*\(\s*speechRecognizer\s*!=\s*null\s*\)\s*\{/

  patched = replacePatternRequired(
    patched,
    beginPattern,
    `SpeechRecognition.this.lock.lock();
                        // ${MARKER}: reset partial results for each session.
                        previousPartialResults = new JSONArray();
                        if (speechRecognizer != null) {`,
    'beginListening() cleanup'
  )

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
                    // ${MARKER}: handle stale recognizers safely.
                    if (speechRecognizer != null) {
                        if (SpeechRecognition.this.listening) {
                            try {
                                speechRecognizer.stopListening();
                            } catch (Exception ignored) {
                                // Recognizer may already have stopped.
                            }
                        } else {
                            try {
                                speechRecognizer.cancel();
                            } catch (Exception ignored) {
                                // Ignore stale recognizer cleanup errors.
                            }

                            try {
                                speechRecognizer.destroy();
                            } catch (Exception ignored) {
                                // Ignore stale recognizer cleanup errors.
                            }

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

  patched = replaceRequired(
    patched,
    oldStopListening,
    newStopListening,
    'stopListening()'
  )

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
                            try {
                                speechRecognizer.cancel();
                            } catch (Exception ignored) {
                                // Recognizer may already have stopped.
                            }

                            try {
                                speechRecognizer.destroy();
                            } catch (Exception ignored) {
                                // Ignore cleanup errors.
                            }

                            speechRecognizer = null;
                        }

                        previousPartialResults = new JSONArray();

                        JSObject err = new JSObject();
                        err.put("message", errorMssg);

                        SpeechRecognition.this.notifyListeners(
                            "error",
                            err
                        );

                        JSObject ret = new JSObject();
                        ret.put("status", "stopped");

                        SpeechRecognition.this.notifyListeners(
                            LISTENING_EVENT,
                            ret
                        );
                    } finally {
                        SpeechRecognition.this.lock.unlock();
                    }
                });

            // ${MARKER}: partial-results mode resolves start() early.
            if (this.call != null && !this.partialResults && !benign) {
                this.call.reject(errorMssg);
            }

            this.call = null;
        }`

  patched = replaceRequired(
    patched,
    oldError,
    newError,
    'onError()'
  )

  writeFileSync(path, patched, 'utf8')

  console.log(
    'Applied Android speech-recognition lifecycle fix to:',
    path
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  patchSpeechRecognitionPlugin(root)
}
