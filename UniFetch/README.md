# UniFetch 2.0.1

A local Chrome extension that picks up the YouTube video you are watching, inspects available formats, and saves a complete video with sound. Pasted YouTube links and direct MP4, WebM, M4V, and MOV links are also supported. No account, cloud downloader, analytics, or external processing service is used.

UniFetch is **YouTube-first, with a Windows local helper**. The page launcher reads the current video URL; it does not scan network traffic or enumerate embedded media. Playlists and universal website support are outside this version.

## Install on Windows

Install Python **3.11 or newer**, with Python available from your terminal. Download the release ZIP or clone the repository, then run **Setup UniFetch.cmd** in the repository root. The script downloads project-local dependencies and registers the native helper for the current Windows user. Administrator privileges are not required. Internet access is required for setup and downloading media.

Keep the extension and sibling `helper` folder together. Moving the repository requires running setup again. Once setup completes:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `UniFetch` folder containing this README and `manifest.json`.
4. Pin UniFetch from Chrome's extensions menu.
5. Open UniFetch. The footer should say **Local helper connected**.

The GitHub source/release archive intentionally excludes downloaded executables, Python vendor packages, machine-specific registration files, and personal history. The setup script prepares those on your PC.

### Upgrade from v1

Update the files in the existing project folder, reload UniFetch at `chrome://extensions`, and refresh already-open YouTube pages so the page launcher is installed. If Chrome asks to re-enable the extension for its new YouTube/side-panel permissions, enable it. Existing settings and history stay in place. Light is the default theme; use the header's moon icon to switch to dark. If you move the project to a new folder, run setup again and load that folder's extension.

If the interface files have changed but Chrome still has the old manifest or worker loaded, v2.0.1 shows **Reload UniFetch**. Finish any active downloads before reloading, then reopen UniFetch and refresh YouTube. This resolves the mixed-version state that caused **Unknown action** on the panel button and ignored dark-mode changes. Appearance and other UI preferences now save directly to extension storage; the popup opens the panel directly through Chrome's API.

## Use

Open a YouTube video, then click UniFetch in Chrome's toolbar. The current video link is filled and inspected automatically. Choose the file type and quality, then **Download video**. You can also paste a complete link and choose **Find**.

The small blue button at the bottom-right of a YouTube video page opens the native Chrome side panel. The popup's panel icon opens it too. The panel follows video changes and tab switches while automatic detection is active. Pasting your own link pauses that following behavior; **Use current tab** resumes it. On a non-video page, the launcher is hidden and a following panel clears its old video. Fullscreen playback hides the launcher. Chrome uses the right side by default; its side-panel position setting takes precedence.

Use the moon/sun icon or **Settings → Appearance** for light/dark mode. The choice is saved and synchronized between open UniFetch surfaces. **Settings → Open in a separate tab** opens the larger view.

- YouTube watch, short, Shorts, embed, and finished-live links are normalized to one video.
- Format choices are based on real extraction results. Every offered YouTube format includes audio, either directly or by merging a separate audio stream.
- Switching file type preserves the selected resolution when it exists in the other container. Missing resolutions are not displayed. A size shown with `~` is an estimate; otherwise it is shown as unknown.
- Opening the popup and panel for the same link reuses a recent preview or joins the same pending inspection. Opening either interface never starts a download by itself.
- The preferred quality setting selects an available resolution at or below the chosen cap when possible. It does not invent missing resolutions.
- YouTube downloads go to the Windows **Downloads / UniFetch** folder. They are handled by the native helper, so they do not appear in Chrome's own Downloads page.
- Direct files use Chrome's download manager. Their save dialog is controlled by Settings.
- One YouTube download can run at a time. Closing the popup does not cancel it. Closing Chrome stops its native connection and interrupts ongoing helper work.
- Progress describes the current stream. It can restart when the audio stream starts; a separate processing stage follows. A download is only marked saved after a file exists and FFmpeg verifies both video and audio.
- **Show file** opens the file location. **Clear list** removes completed/failed history records, not videos or active downloads.

Only download videos you are authorized to save. UniFetch does not read browser cookies, import credentials, unlock private videos, bypass DRM, or enable paid/member-only downloads. YouTube's restrictions and applicable rights still apply.

## Architecture

```text
popup / native side panel (HTML/CSS/ES modules)
  -> validated runtime messages
  -> Manifest V3 service worker
     -> Chrome Downloads API for direct files
     -> Chrome native messaging for YouTube
        -> Python helper -> yt-dlp + Deno -> FFmpeg

YouTube content script -> validated open-panel message -> Chrome sidePanel API
```

`popup/` contains the shared interface. `content/` adds the isolated page button. `background/` handles messages, panel opening, and the native port. `detector/`, `downloader/`, `storage/`, and `utils/` contain small focused modules. The sibling `helper/` implements the native protocol, URL validation, format pairing, process control, verification, and persistent helper job state. No HTTP server is started by the application.

The content script can request only panel opening; it cannot issue helper commands. Helper actions accept messages from the exact extension UI path. Future site support should add a provider-specific resolver and tests, then explicitly allow that provider in both the extension and helper. Do not forward arbitrary command-line options or enable every yt-dlp extractor by default.

## Permissions and data

| Permission | Purpose |
| --- | --- |
| `storage` | Settings, recent download records, and session-only preview data. |
| `activeTab` | Read the current tab's URL when you invoke UniFetch. |
| `downloads` | Save, monitor, cancel, and reveal direct media files. |
| `nativeMessaging` | Communicate with the registered local helper. |
| `sidePanel` | Open the shared interface alongside the current page. |
| Specific YouTube host access | Show the page launcher and follow the current YouTube video URL. |

Host access is restricted to HTTPS on `www.youtube.com`, `youtube.com`, `m.youtube.com`, `music.youtube.com`, and `youtu.be`. There is no all-sites access, cookie permission, browsing-history permission, `webRequest` access, remote script, or externally connectable messaging endpoint. The launcher does not inspect or download videos while the interface is closed. A thumbnail may load from YouTube's image servers for the video you inspected.

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
- If the footer reports setup is needed, run the setup script and press **Reconnect** in Settings. Python must remain installed at the registered path.
- If the YouTube page button is missing after updating, reload the extension and refresh the video page. It appears on video pages, not YouTube's home/search pages, and hides in fullscreen.
- If the panel button says **Unknown action**, update to v2.0.1 and reload the extension itself, not just the YouTube page. This message indicates that older background code did not recognize the new action.
- If Windows blocks a dependency, do not disable security controls. Use a trusted permitted build or report the blocked component. This version uses FFmpeg directly for verification because the separate ffprobe executable was blocked on the development PC.

To change the helper destination, create `helper/config.json` containing `{"downloadDirectory":"D:\\YourFolder"}` and restart Chrome. The UI cannot send arbitrary output paths to the helper.

## Tests

See [tests/README.md](tests/README.md). Generated test files and screenshots are stored in the parent `test-results` folder, outside the extension package. Development tooling requires Node.js; the installed extension itself does not.
