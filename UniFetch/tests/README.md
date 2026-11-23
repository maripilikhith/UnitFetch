# Verification

Run commands from the parent workspace directory.

```powershell
node scripts/validate.mjs
node --test UniFetch/tests/*.test.js
python -m unittest discover -s helper/tests -v
python scripts/native-protocol-test.py
```

The browser check uses Playwright and a separate Chrome for Testing profile. It never touches your normal Chrome profile. Run `npm ci` and `npx playwright install chromium --no-shell` to prepare the development dependency. Set `PLAYWRIGHT_MODULE` to another installed Playwright package and `TEST_BROWSER` to another extension-capable Chromium executable only if needed, then run:

```powershell
npm run fixture
npm run test:browser
npm run test:ui
```

The test expects `test-results/fixture.mp4`, a generated three-second test-pattern/sine-wave video. Generate it using the portable FFmpeg:

```powershell
helper/bin/ffmpeg.exe -hide_banner -loglevel error -f lavfi -i testsrc2=size=320x180:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart -y test-results/fixture.mp4
```

The browser test starts a temporary loopback server for this generated fixture only. The application does not start a server.

The v2 UI suite (`test:ui`) serves a clearly labeled local HTML fixture at a routed YouTube URL and seeds test-only previews into an isolated extension session. It verifies automatic URL capture/inspection, actual Chrome native-panel opening, SPA navigation, manual-link preservation, theme synchronization, fullscreen hiding, and a 320 px layout. It does **not** prove live extraction or downloading from YouTube. It needs the registered local helper for the connection check. Fixture screenshots remain under ignored `test-results/`; public README screenshots show the actual empty app.

Run `npm run test:upgrade` from a **Git clone containing the `v1.0.0` and `v2.0.0` tags** to test updating an already-loaded unpacked extension. It uses an isolated profile with Developer mode enabled, copies tagged files into a temporary directory, reproduces the old-worker failures, and checks direct preference saving, the reload prompt, and the active-download guard. It then reloads and uses `chrome.action.openPopup()` to create a real toolbar popup; trusted mouse events through its CDP target verify both header buttons. This test uses the installed helper and Chrome for Testing 151 or newer. `REPRO_ONLY=1` stops after reproducing the original fault. It does not touch your regular Chrome profile or download a video.

## Covered checks

- Manifest parsing, module syntax, permission allowlist, icon files, popup rendering.
- YouTube URL variants and canonicalization; playlist, credential-bearing, blob, and script URL rejection; hostname spoofing.
- Direct MP4/WebM identification and HLS/DASH capability reporting.
- Safe filenames and unknown metadata.
- Format pairing, exclusion of DRM and silent-video choices, and signed-URL redaction.
- Native message framing and size limits, expired inspection tokens, restart recovery, and clear-history behavior.
- Native cancellation against a controlled subprocess, including process termination and temporary-file cleanup. Run this test with normal Windows process permissions; restricted execution sandboxes can prevent the test's `taskkill` call.
- Real Chrome/native-helper handshake.
- Real direct MP4 save, missing-file failure, duplicate-active rejection, cancellation, and history clearing.
- Settings/history after popup reload and rejected untrusted message senders.
- V1 preference migration, theme persistence, and file-type/quality selection.
- Exact UI-origin validation and rejection of panel requests from untrusted pages or subframes.
- Automatic current-video capture, native panel opening from the page and popup, video navigation, and hiding the launcher on non-video/fullscreen pages.
- An opt-in live YouTube helper test is provided in `scripts/live-test.py`. It downloads the lowest-resolution WebM choice of the official Big Buck Bunny film into `test-results/youtube`, combines video and audio, and verifies both tracks with FFmpeg. It does not prove compatibility with every YouTube video.

During this build, the live helper test completed successfully and produced a 15.5 MB WebM with both tracks. A later full UI attempt was rejected by YouTube's sign-in/bot check, so a live YouTube download from the popup was **not** verified to completion. The UI reported the failure; no cookies were imported or checks bypassed. Live results depend on YouTube's current response and network conditions.

## Manual regression checks

1. Load the unpacked extension and check that the footer says the helper is connected.
2. Paste your authorized YouTube link, choose a format, and download. Close and reopen the popup while downloading; confirm the job remains visible.
3. Cancel an active native download. Confirm its status changes and it is no longer writing temporary media.
4. Close Chrome during a native download, reopen, and check that the job is marked interrupted rather than saved.
5. Try a playlist, live stream, restricted video, invalid URL, and unsupported webpage. Confirm useful failure messages.
6. Disable/unregister the helper and check that the popup still loads and direct file downloads remain available; re-register afterward.
7. Inspect keyboard focus, 400 px popup layout, 320 px side-panel layout, expanded-tab layout, both themes, and reduced-motion behavior.
8. Open the extension on an authorized YouTube video, confirm the URL and available formats appear without pasting, then use the page button to open the panel. Navigate to another video and confirm it follows. Paste a different link and confirm navigation no longer overwrites it until **Use current tab** is selected.

## Sample attribution

Big Buck Bunny: (c) copyright 2008, Blender Foundation / www.bigbuckbunny.org. Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) according to the [project's license page](https://peach.blender.org/about/). Live tests retain the full movie including credits. Generated color-bar/sine-wave fixtures are original test assets.
