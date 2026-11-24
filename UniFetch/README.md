# UniFetch 3 - quick start

1. Extract UniFetch-v3.0.0-Chrome.zip to a permanent folder.
2. Open chrome://extensions and turn on Developer mode.
3. Click Load unpacked and choose this UniFetch folder (the one containing manifest.json).

Pin UniFetch, open a YouTube video, and click the extension. The current link is detected automatically. Choose a quality and click Download video. The small blue button at the bottom-right of YouTube opens Chrome's side panel. The moon/sun button switches themes.

No helper, Python, FFmpeg, Node.js, setup script, account, or external server is needed. All libraries are already bundled. Requires desktop Chrome 120+ and internet access.

Keep Chrome running during downloads. You can close the popup. Files save through Chrome, normally in Downloads / UniFetch. Settings controls whether to ask where to save.

## Limits

YouTube support is experimental. Verification-required videos can fail even after downloading begins. UniFetch does not bypass verification or sign-in. A failed stream is not saved as a successful partial file.

YouTube downloads are limited to 256 MiB of combined input and 10 minutes of processing. Choose lower quality or a shorter video if needed. Live, upcoming, private, paid, DRM-protected videos, playlists and arbitrary websites are unsupported. Direct .mp4, .webm, .m4v and .mov links also work.

Use only for media you are authorized to download.

## Updates

Download the new ZIP, extract it, then reload the extension at chrome://extensions. Refresh already-open YouTube pages. Keep the extracted folder in place. If Chrome is using an older worker, the interface offers Reload UniFetch after active downloads finish.

## Libraries and source

Third-party notices: vendor/THIRD-PARTY.txt. Licenses: vendor/licenses.
Unmodified Mediabunny MPL-2.0 source: vendor/sources/mediabunny.
Source, complete guide and verification details: https://github.com/maripilikhith/UnitFetch
