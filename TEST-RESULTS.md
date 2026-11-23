# UniFetch v2.0.0 verification — 23 November 2026

## Version 2 checks passed

- Manifest, synchronized extension/package/helper versions, referenced assets, JavaScript syntax, and the exact YouTube host/permission allowlist.
- 11 JavaScript tests and 13 Python helper tests, including v1 preference migration, format selection, strict message origins, and native process cancellation.
- Native messaging handshake reports helper version **2.0.0**.
- Real Chrome for Testing extension load, native helper connection, direct MP4 saving, missing-file failure, duplicate prevention, cancellation, and history clearing.
- Light/dark switching, persistence after reload, and synchronization between open surfaces.
- Opening the extension UI captures and inspects the active YouTube video without a manual paste or Find click.
- A trusted click on the bottom-right page button creates an actual Chrome **SIDE_PANEL** context. The popup's panel shortcut also works.
- Side-panel video navigation following, preservation of manually pasted links, and clearing the followed preview on a non-video page.
- Launcher hiding on non-video pages and during fullscreen playback.
- Separate file-type/quality controls preserve resolution when switching containers; the 320 px panel has no horizontal overflow.
- No uncaught page errors in either browser suite. Screenshots of the light/dark empty app and fixture-populated views were visually reviewed.

The new YouTube UI checks use a clearly labeled local navigation fixture and seeded session previews in an isolated test profile. They exercise the production interface and real Chrome side-panel API, but **do not establish live YouTube extraction or download success**. Test fixture previews are not shipped in the extension. README screenshots show the actual empty interface with the connected helper.

Commands: `npm run check`, `npm test`, `npm run test:helper`, `python scripts/native-protocol-test.py`, `npm run test:browser`, and `npm run test:ui`.

## Earlier v1 live-engine results

- Real YouTube metadata extraction for the official Big Buck Bunny film: 16 format choices returned.
- Real YouTube helper download of the 144p WebM choice; separate media streams were downloaded and merged, and FFmpeg decoded both required tracks to verify the final file. Output: 15,549,298 bytes. The sample is in `test-results/youtube`.
- Setup idempotency and isolated browser regression passed for v1 before publication.

## Limitation observed

A later live YouTube UI attempt returned YouTube's sign-in/bot-check response. It did not produce a preview or download. The UI reports this state, and the helper now translates that response into a readable explanation. Full live YouTube downloading through the popup was therefore not verified to completion. No browser cookies were imported, and the check was not bypassed.

Version 2 changes the interface and page integration, retaining the same downloader dependencies and these service limitations. The engine has completed a live sample, while YouTube's current response can still prevent a particular request. This does not establish compatibility with every YouTube video or network.

## Environment notes

Python 3.13, yt-dlp 2026.10.26, yt-dlp-ejs 0.8.0, Deno 2.9.8, FFmpeg build N-128970, and isolated Chrome for Testing 151. The installed Chrome is 157. Test browser profiles are separate from the user's regular browser profile.

The standalone yt-dlp executable had unreliable startup latency, so the final implementation uses its project-local official Python package. Windows blocked the separate ffprobe binary; it was removed. FFmpeg performs verification instead. Normal Windows process permissions were required for the controlled cancellation test; the restricted shell sandbox prevented `taskkill` in its initial run.

Sample attribution: (c) 2008 Blender Foundation / www.bigbuckbunny.org, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), [project license](https://peach.blender.org/about/).
