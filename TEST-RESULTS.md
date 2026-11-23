# UniFetch v1.0.0 verification — 23 November 2026

## Passed

- Manifest, referenced assets, exact permission set, and JavaScript syntax.
- 6 JavaScript tests and 13 Python helper tests.
- Native messaging request/response using the registered extension origin.
- Real Chrome for Testing extension load and native helper connection.
- Real direct-file download of a generated MP4, failed-file reporting, duplicate prevention, cancellation, and history clearing.
- Settings and history after popup reload; untrusted runtime-message sender rejection; no uncaught popup errors during the browser suite.
- Native cancellation against a controlled subprocess, with process termination and temporary-directory cleanup. This test needs normal Windows process permissions.
- Real YouTube metadata extraction for the official Big Buck Bunny film: 16 format choices returned.
- Real YouTube helper download of the 144p WebM choice; separate media streams were downloaded and merged, and FFmpeg decoded both required tracks to verify the final file. Output: 15,549,298 bytes. The sample is in `test-results/youtube`.
- Visual inspection of the actual empty popup and connected state.
- Final setup idempotency check and complete isolated browser regression passed after the last code changes and removal of obsolete binaries.

## Limitation observed

A later live YouTube UI attempt returned YouTube's sign-in/bot-check response. It did not produce a preview or download. The UI reports this state, and the helper now translates that response into a readable explanation. Full live YouTube downloading through the popup was therefore not verified to completion. No browser cookies were imported, and the check was not bypassed.

Version 1.0.0 is a personal-use experimental release. The engine has completed a live sample, while YouTube's current response can still prevent a particular request. This does not establish compatibility with every YouTube video or network.

## Environment notes

Python 3.13, yt-dlp 2026.10.26, yt-dlp-ejs 0.8.0, Deno 2.9.8, FFmpeg build N-128970, and isolated Chrome for Testing 151. The installed Chrome is 157. Test browser profiles are separate from the user's regular browser profile.

The standalone yt-dlp executable had unreliable startup latency, so the final implementation uses its project-local official Python package. Windows blocked the separate ffprobe binary; it was removed. FFmpeg performs verification instead. Normal Windows process permissions were required for the controlled cancellation test; the restricted shell sandbox prevented `taskkill` in its initial run.

Sample attribution: (c) 2008 Blender Foundation / www.bigbuckbunny.org, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), [project license](https://peach.blender.org/about/).
