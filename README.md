# UniFetch

**Version 2.0.0** — a personal video downloader for Chrome on Windows.

Open UniFetch on a YouTube video: it picks up the current link and finds the available formats automatically. Use the small blue button at the bottom-right of the video page to open the side panel, or paste a YouTube or direct video link. A small native helper runs yt-dlp and FFmpeg on your PC.

<img src="docs/images/unifetch-popup.png" alt="UniFetch v2 in white and light blue, with its link field and connected local helper" width="360"> <img src="docs/images/unifetch-dark.png" alt="UniFetch v2 in dark mode" width="360">

## Install

Requirements: Windows x64, Chrome 120 or newer, Python 3.11 or newer available on PATH, and internet access for setup and downloads.

1. Download and extract the [v2.0.0 release](https://github.com/maripilikhith/UnitFetch/releases/tag/v2.0.0), or clone this repository.
2. Run **Setup UniFetch.cmd**. It installs dependencies inside the project and registers the helper for your Windows user.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the **UniFetch** subfolder containing `manifest.json`.
4. Pin UniFetch, open it, and check for **Local helper connected** in the footer.

Keep the project folder in place after setup. If you move it, run setup again. Administrator privileges are not required. Use **Uninstall helper.cmd** to unregister the helper and remove the extension separately in Chrome.

**Upgrading from v1:** update your source folder, click **Reload** for UniFetch at `chrome://extensions`, then refresh any already-open YouTube pages. V2 adds the side-panel permission and access limited to YouTube hosts for its page button. Existing quality preferences and download history are retained; light is the new default theme. If you extracted into a new folder, run setup there and load that folder's extension.

## Features

- Automatic current-video capture when opening the toolbar popup or side panel.
- A small bottom-right launcher on YouTube video pages, hidden during fullscreen playback.
- A native side panel that follows YouTube navigation and preserves manually pasted links.
- White/light-blue and navy dark themes, saved across the popup and side panel.
- Separate MP4/WebM choices and a compact quality grid with video-and-audio pairing.
- YouTube link recognition, including watch, short, Shorts, and embed URLs.
- Local downloading, FFmpeg merging, and output verification.
- Direct MP4, WebM, M4V, and MOV downloads using Chrome's download manager.
- Progress, cancellation, duplicate prevention, recent history, and file-location shortcuts.
- Expanded-tab view, preferred-quality settings, and readable errors.

YouTube files save to **Downloads / UniFetch**. One YouTube download runs at a time. Closing the popup leaves it running; closing Chrome interrupts it.

Opening the interface inspects the video; **Download video** still starts the download. Chrome normally places its native side panel on the right, but follows your browser's side-panel position preference.

## Current limits

This is an experimental personal-use release. YouTube can require a sign-in or bot check, and some requests will fail. The helper completed a real sample download during testing; a later full-UI attempt encountered YouTube's bot check. [Verification details](TEST-RESULTS.md) distinguish these results.

Playlists, ongoing live streams, private/paid/DRM videos, arbitrary website extraction, and standalone HLS/DASH downloads are not supported. UniFetch does not import browser cookies, bypass authentication, or circumvent DRM. Use it only for media you are authorized to save.

## Source layout

| Path | Purpose |
| --- | --- |
| `UniFetch/` | Manifest V3 extension, popup/side panel, YouTube launcher, downloads, and storage. |
| `helper/` | Python native host, validation, extraction, process control, and setup. |
| `scripts/` | Validation, asset generation, and integration checks. |
| `UniFetch/tests/`, `helper/tests/` | JavaScript and Python tests. |
| `.github/workflows/validate.yml` | Windows source and helper CI. |

Downloaded dependencies, browser profiles, machine-specific registration files, and personal history are excluded from Git and the release ZIP. Setup downloads the official tools on the target PC. Dependency licensing and provenance are described in the [full guide](UniFetch/README.md#dependencies).

## Development

Node.js 22 or newer is needed for development checks, not for running the extension.

```powershell
npm run check
npm test
npm run test:helper
```

For optional browser integration checks, install the helper first, then:

```powershell
npm ci
npx playwright install chromium --no-shell
npm run fixture
npm run test:browser
npm run test:ui
```

The browser suites use separate test profiles, generated media, and clearly labeled local navigation fixtures. The v2 suite checks the real native panel, automatic capture, navigation, responsive layout, and themes. Live YouTube checks are opt-in and depend on the service's response. See [testing instructions](UniFetch/tests/README.md).

[Full installation and usage guide](UniFetch/README.md) · [Changelog](CHANGELOG.md) · [UI design notes](DESIGN.md)
