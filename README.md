# UniFetch 3 - Chrome edition

Download the ZIP, extract it, and load the **UniFetch** folder in Chrome. **No helper, Python, FFmpeg, Node.js, setup script, or server is needed.**

[Download UniFetch-v3.0.0-Chrome.zip](https://github.com/maripilikhith/UnitFetch/releases/download/v3.0.0/UniFetch-v3.0.0-Chrome.zip) | [Releases](https://github.com/maripilikhith/UnitFetch/releases)

<img src="docs/images/unifetch-popup.png" alt="UniFetch Chrome edition in light mode" width="360"> <img src="docs/images/unifetch-dark.png" alt="UniFetch Chrome edition in dark mode" width="360">

## Install in Chrome

1. Download the ZIP above and **extract** it to a permanent folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted **UniFetch** folder containing `manifest.json`.

Pin UniFetch from Chrome's extensions menu. Open a YouTube video and click UniFetch: it picks up the link automatically. Choose a format and click **Download video**. The small bottom-right button on YouTube opens Chrome's side panel.

Chrome loads an extracted folder, not the ZIP itself. Keep that folder in place. If using GitHub's **Code > Download ZIP**, select the **UniFetch** subfolder inside the extracted repository. All runtime libraries are already included.

Requirements: desktop Chrome 120 or newer and an internet connection. There is no account or helper setup. Managed browsers may disable Developer mode.

## What works

- Automatic current YouTube video detection; pasted watch, short, Shorts, and embed links.
- Chrome side panel, bottom-right page launcher, and automatic navigation tracking.
- White/light-blue and navy dark themes shared across the popup and panel.
- MP4/WebM quality selection with compatible video and audio paired together.
- Anonymous YouTube extraction, supported media transport, and lossless merging inside Chrome.
- Direct MP4, WebM, M4V, and MOV file downloads through Chrome's download manager.
- Progress, cancellation, recent history, preferred quality, save-location choice, and file shortcuts.

One YouTube download runs at a time. You may close the popup while downloading, but keep Chrome running. Files normally save to **Downloads / UniFetch**, or Chrome asks where to save when that preference is enabled.

## YouTube support is experimental and limited

**Loading the extension does not guarantee every YouTube video can be downloaded.** YouTube can require verification before playback or partway through a download. UniFetch stops and reports an error; it does not import cookies, bypass sign-in or verification, or save partial streams as successful downloads.

The live sample test detected formats and received media, but YouTube required verification before completion. Complete browser merging and saving were verified with original test media. See [test results](TEST-RESULTS.md) for the distinction.

- YouTube downloads have a **256 MiB combined input limit** and a **10-minute processing limit**. Oversized known formats are omitted. Unknown-size streams stop at the limit. Browser memory use is higher than the file size during merging.
- Live, upcoming, private, paid, DRM-protected, and verification-required videos are unsupported.
- Playlists, arbitrary website extraction, and standalone HLS/DASH links are unsupported.
- Some codecs may not play in every external player even when their container is supported.
- Save only videos you are authorized to download.

## Updating from v1/v2

Finish active downloads, replace the extension folder, then click **Reload** at `chrome://extensions` and refresh YouTube. If moving to a different folder, choose **Load unpacked** for the new **UniFetch** folder. Review the requested permissions. The extension ID is unchanged; stored settings/history are retained when Chrome retains the installation.

V3 never connects to the old native helper. The helper source and **Uninstall helper.cmd** remain only for existing v2 users; they are excluded from the Chrome release ZIP. Older helper downloads may need to be located manually in Downloads / UniFetch. Older releases remain available on GitHub.

## Privacy and permissions

Video links and download history stay in local Chrome storage. No analytics or external downloader service is used. YouTube/Googlevideo receive anonymous media requests. Temporary signed media data stays in the hidden engine document, not persistent history.

- `storage`: preferences and download history.
- `activeTab` and YouTube host access: capture the current video and display the page launcher.
- `downloads`: save, cancel, and reveal downloaded files.
- `sidePanel`: Chrome's side panel.
- `offscreen`: continue downloading and merge tracks after the popup closes.
- `declarativeNetRequestWithHostAccess`: set protocol headers for **UniFetch's own** YouTube media requests. Browsing-tab requests are not modified.
- Googlevideo/API host access: fetch supported media directly.

The YouTube player transform runs in an isolated sandbox with no extension APIs or network access. Libraries and their licenses are bundled in `UniFetch/vendor`; the included Mediabunny source is unmodified and licensed under MPL-2.0.

## Development

Node.js 22+ is only needed to develop or rebuild the project:

```powershell
npm ci --ignore-scripts
npm run build:vendor
npm run check
npm test
npm run package
npx playwright install chromium --no-shell
npm run test:browser
npm run test:engine
npm run test:ui
```

`TEST_BROWSER` can point to a Chrome for Testing executable. Browser tests use isolated profiles under `.tools/`; generated downloads go under `test-results/`. Test fixtures never ship in the user ZIP. `helper/` is legacy v2 code and is not part of the v3 runtime.
