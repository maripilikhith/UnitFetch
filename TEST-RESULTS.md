# UniFetch v3.0.0 verification - 24 November 2026

## Browser-only runtime

V3 removes nativeMessaging and native-client.js. It bundles YouTube.js, GoogleVideo, and Mediabunny; Chrome's offscreen document handles transport and lossless audio/video merging. No helper or executable is included in the user ZIP.

The extension was loaded in clean, isolated Chrome for Testing 151 profiles on Windows. Chrome 120 is the manifest minimum; it was not separately tested.

## Passed checks

- Manifest/version consistency, permission allowlist, sandbox restrictions, referenced assets, and JavaScript syntax.
- 15 unit tests: URL parsing, trusted message origins, settings migration, filenames, format choice, media host restrictions, compatible/stereo pairing, size limits, MP4/WebM remuxing and cancellation.
- Actual Chrome direct-file save, missing-file failure, duplicate prevention, cancellation, persisted preferences/history and history clearing.
- Real offscreen MP4 and WebM merging followed by Chrome downloads completion.
- Network failure and truncated media result in failed history entries and no saved partial file.
- Cancellation is not overwritten by late processing events.
- A download finishes after its popup page closes.
- Direct calls from the UI to privileged engine commands are rejected.
- Automatic current-video capture, format switching, bottom-right launcher, real Chrome side panel, 320px layout, light/dark theme synchronization, SPA navigation, fullscreen hiding, and manually pasted link preservation.
- Dependency audit after updating esbuild/fflate: zero reported vulnerabilities.
- The exact 0.85 MB release ZIP was extracted and loaded in a fresh Chrome profile; startup, direct saving, cancellation, history and themes passed without any build or setup step.

The deterministic engine integration test copies the extension into an isolated test folder and substitutes only YouTube extraction/network input with original generated video/tone fixtures. The production offscreen document, messaging, muxer, download APIs and history run unchanged. This proves the browser pipeline, not live YouTube availability. The fixture adapter is never included in the release ZIP.

## Live YouTube result - limited

The public Big Buck Bunny sample (aqz-KE-bpKQ) returned metadata and MP4/WebM options. The initial Chrome API request returned HTTP 403; scoping required protocol headers to the extension's own requests resolved that issue.

The subsequent live SABR download received approximately 3.7 MB of media, then YouTube required stream-protection verification. It failed without saving a partial file. V3 reports this as an unsupported verification-required download and stops promptly. A complete live YouTube download was **not** established by this test. No cookies, login, proof-token generation, or verification bypass were used.

Sample attribution: (c) 2008 Blender Foundation / www.bigbuckbunny.org, Creative Commons Attribution 3.0. Project: https://peach.blender.org/about/

## Reproduce

npm run check
npm test
npm run test:browser
npm run test:engine
npm run test:ui
npm run package

See README for npm installation and isolated test-browser setup. Earlier native-helper verification belongs to v2 release tags and is not evidence for v3.
