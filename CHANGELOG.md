# Changelog

## 1.0.0 — 2026-11-23

First public source release of UniFetch.

- Paste-link interface with automatic YouTube detection and direct video file support.
- Real format selection, local yt-dlp extraction, FFmpeg merging, and audio/video verification.
- Dark popup, expanded-tab view, preferred quality, progress, cancellation, and download history.
- Windows native messaging helper with per-user setup and uninstall scripts.
- Validated messaging, safe filenames, duplicate-download prevention, and restart recovery.
- Automated validation and Windows CI, plus opt-in browser and live YouTube checks.

Known limits: YouTube may require a sign-in/bot check; no cookies are imported or checks bypassed. Playlists, live streams, private/paid/DRM videos, and arbitrary website extraction are not supported. See [verification notes](TEST-RESULTS.md) for the distinction between the successful live helper sample and the later blocked full-UI attempt.
