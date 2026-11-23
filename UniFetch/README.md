# UniFetch 1.0.0

A local Chrome extension for pasting a YouTube link, inspecting available formats, and saving a complete video with sound. Direct MP4, WebM, M4V, and MOV links are also supported. No account, cloud downloader, analytics, or external processing service is used.

UniFetch is **YouTube-first, link-based, with a Windows local helper**. Automatic page-wide scanning, playlists, and universal website support are outside this version.

## Install on Windows

Install Python **3.11 or newer**, with Python available from your terminal. Download the release ZIP or clone the repository, then run **Setup UniFetch.cmd** in the repository root. The script downloads project-local dependencies and registers the native helper for the current Windows user. Administrator privileges are not required. Internet access is required for setup and downloading media.

Keep the extension and sibling `helper` folder together. Moving the repository requires running setup again. Once setup completes:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `UniFetch` folder containing this README and `manifest.json`.
4. Pin UniFetch from Chrome's extensions menu.
5. Open UniFetch. The footer should say **Local helper connected**.

The GitHub source/release archive intentionally excludes downloaded executables, Python vendor packages, machine-specific registration files, and personal history. The setup script prepares those on your PC.

## Use

Paste a complete link and choose **Find video**. Select a format, then choose **Download video**. **Use current tab** fills the link from the active tab when the toolbar popup is open. The expand icon opens a larger tab using the same UI.

- YouTube watch, short, Shorts, embed, and finished-live links are normalized to one video.
- Format choices are based on real extraction results. Every offered YouTube format includes audio, either directly or by merging a separate audio stream.
- The preferred quality setting selects an available resolution at or below the chosen cap when possible. It does not invent missing resolutions.
- YouTube downloads go to the Windows **Downloads / UniFetch** folder. They are handled by the native helper, so they do not appear in Chrome's own Downloads page.
- Direct files use Chrome's download manager. Their save dialog is controlled by Settings.
- One YouTube download can run at a time. Closing the popup does not cancel it. Closing Chrome stops its native connection and interrupts ongoing helper work.
- Progress describes the current stream. It can restart when the audio stream starts; a separate processing stage follows. A download is only marked saved after a file exists and FFmpeg verifies both video and audio.
- **Show file** opens the file location. **Clear list** removes completed/failed history records, not videos or active downloads.

Only download videos you are authorized to save. UniFetch does not read browser cookies, import credentials, unlock private videos, bypass DRM, or enable paid/member-only downloads. YouTube's restrictions and applicable rights still apply.

## Architecture

```text
popup (HTML/CSS/ES modules)
  -> validated runtime messages
  -> Manifest V3 service worker
     -> Chrome Downloads API for direct files
     -> Chrome native messaging for YouTube
        -> Python helper -> yt-dlp + Deno -> FFmpeg
```

`popup/` contains the interface. `background/` handles messages and the native port. `detector/`, `downloader/`, `storage/`, and `utils/` contain small focused modules. The sibling `helper/` implements the native protocol, URL validation, format pairing, process control, verification, and persistent helper job state. No HTTP server is started by the application.

No content script or `webRequest` permission is needed for this link-first scope. Future site support should add a provider-specific resolver and tests, then explicitly allow that provider in both the extension and helper. Do not forward arbitrary command-line options or enable every yt-dlp extractor by default.

## Permissions and data

| Permission | Purpose |
| --- | --- |
| `storage` | Settings, recent download records, and session-only preview data. |
| `activeTab` | Read the current tab's URL when you invoke UniFetch. |
| `downloads` | Save, monitor, cancel, and reveal direct media files. |
| `nativeMessaging` | Communicate with the registered local helper. |

There are **no broad host permissions**, cookie permissions, browsing-history permissions, remote scripts, or externally connectable messaging endpoints. A thumbnail may load from YouTube's image servers for the video you inspected.

The helper registration permits this extension's fixed ID only: `dglchdhjnkgalbimblbbpgbmofaicngj`. It is registered under the current user's Chrome, Chrome for Testing, and Chromium native-host keys. `Uninstall helper.cmd` removes those registrations; remove the extension separately in Chrome.

Recent history is limited to 100 finished records plus active jobs. Signed YouTube media URLs stay inside yt-dlp and are not stored in UI history. Direct URLs are kept in session-only preview storage; Chrome may keep its own download history. Error output is stripped of media URLs. Helper job records live in `helper/state/jobs.json`; direct-download history lives in extension local storage.

## Dependencies

- [yt-dlp](https://github.com/yt-dlp/yt-dlp), pinned to `2026.10.26`, plus `yt-dlp-ejs` `0.8.0`, installed under `helper/vendor` from PyPI. Packages run through the installed Python interpreter, not a globally installed yt-dlp.
- [Deno](https://github.com/denoland/deno/releases), portable Windows binary from its official release. It runs yt-dlp's bundled YouTube JavaScript processing.
- [FFmpeg](https://github.com/yt-dlp/FFmpeg-Builds/releases), portable build from yt-dlp's FFmpeg builds project. It merges streams and verifies the output. No transcoding is performed for normal paired formats.

Dependency source URLs and release checksums are saved alongside the binaries in `helper/bin/*.source.json`. The setup script verifies GitHub release digests where supplied. Packages retain their licenses in the vendor directory. Dependencies are not automatically updated during normal use; YouTube changes may require a deliberate dependency update and retest.

## Limitations and troubleshooting

- YouTube can reject some videos, networks, regions, or anonymous requests. If the site requests sign-in or bot verification, UniFetch reports that error; it does not import browser cookies or claim success.
- Live streams, upcoming premieres, playlists, channels, members-only videos, and DRM media are unsupported.
- A `blob:` URL is not accepted as a downloadable file. Standalone HLS/DASH manifests are recognized and reported as unsupported.
- Other webpage links are not generally supported. The helper can inspect an extensionless public URL's content type with a HEAD request; servers rejecting HEAD may require a direct filename link. Direct filenames are hints, not proof of valid video content.
- Direct downloads can fail because of server permissions, expired URLs, missing files, or the browser rejecting the download. Chrome decides their final state.
- Closing Chrome or a helper crash interrupts the native download. Retry by inspecting the video again; automatic resume after a full browser restart is not implemented.
- Temporary media uses disk space under `helper/state/work`; the finished file is moved to Downloads. Large videos need enough space for separate streams and the merged output. A sudden process termination can leave temporary files for manual removal.
- If the footer reports setup is needed, run the setup script and press **Check connection** in Settings. Python must remain installed at the registered path.
- If Windows blocks a dependency, do not disable security controls. Use a trusted permitted build or report the blocked component. This version uses FFmpeg directly for verification because the separate ffprobe executable was blocked on the development PC.

To change the helper destination, create `helper/config.json` containing `{"downloadDirectory":"D:\\YourFolder"}` and restart Chrome. The UI cannot send arbitrary output paths to the helper.

## Tests

See [tests/README.md](tests/README.md). Generated test files and screenshots are stored in the parent `test-results` folder, outside the extension package. Development tooling requires Node.js; the installed extension itself does not.
