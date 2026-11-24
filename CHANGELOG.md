# Version 3.0.0 - Chrome-only edition

- ZIP -> extract -> Load unpacked. No native helper or setup required.
- Bundled browser extraction, SABR transport and lossless MP4/WebM merging.
- Preserved automatic YouTube detection, page launcher, side panel and light/dark UI.
- Chrome download saving, background progress, cancellation, and truncated-stream checks.
- 256 MiB input cap, 10-minute processing timeout, and explicit verification-required errors.
- Updated install guide, bundled license/source notices, end-user ZIP packaging and browser CI.
- YouTube remains experimental: the live sample required verification before completion; deterministic browser pipeline tests passed.

# Changelog

## 2.0.1 — 2026-11-23

- Fix the inert dark-mode button when new popup files are opened while Chrome still runs the v1 background worker. Preferences are now applied immediately and saved directly to extension storage, preserving quality and save-location settings.
- Open the side panel directly from the popup click, avoiding the old worker's `Unknown action` response and preserving Chrome's required click gesture. The toolbar popup closes after opening the panel.
- Detect mismatched UI, manifest, and worker versions and offer **Reload UniFetch**. Reloading is disabled while downloads are active. Missing side-panel permission explains the required reload.
- Add a regression that reproduces the exact v1/v2 mismatch, checks the repair and reload, and exercises both buttons in a real Chrome toolbar popup.

## 2.0.0 — 2026-11-23

- Automatically capture and inspect the active YouTube video when the extension opens.
- Add a small bottom-right YouTube launcher and Chrome native side panel, with navigation following and fullscreen hiding.
- Replace the original interface with a compact white/light-blue design and persistent navy dark mode.
- Split file type and quality into separate controls, preserving resolution when switching MP4/WebM.
- Share settings, inspection results, download progress, and history across the popup and side panel.
- Limit page integration to explicit YouTube hosts; keep native helper commands restricted to the extension UI.
- Preserve v1 preferences/history and add browser coverage for capture, native panel opening, navigation, themes, and narrow layouts.

Upgrade: reload the extension and refresh open YouTube tabs. Run setup again if the project folder moved. The YouTube service limitations described below still apply.

## 1.0.0 — 2026-11-23

First public source release of UniFetch.

- Paste-link interface with automatic YouTube detection and direct video file support.
- Real format selection, local yt-dlp extraction, FFmpeg merging, and audio/video verification.
- Dark popup, expanded-tab view, preferred quality, progress, cancellation, and download history.
- Windows native messaging helper with per-user setup and uninstall scripts.
- Validated messaging, safe filenames, duplicate-download prevention, and restart recovery.
- Automated validation and Windows CI, plus opt-in browser and live YouTube checks.

Known limits: YouTube may require a sign-in/bot check; no cookies are imported or checks bypassed. Playlists, live streams, private/paid/DRM videos, and arbitrary website extraction are not supported. See [verification notes](TEST-RESULTS.md) for the distinction between the successful live helper sample and the later blocked full-UI attempt.
