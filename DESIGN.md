# UniFetch v2 interface

The main task is saving the video currently open on YouTube. Opening the toolbar popup or page launcher captures the current video and inspects formats. Manual links remain available. Use the current-page workflow documented by [9xbuddy](https://docs.123sudo.com/9xbuddy/getting-started/install) as a reference; preserve UniFetch's own identity and assets.

Light palette: canvas `#f5f8fc`, surface `#ffffff`, ink `#17243c`, blue `#2563eb`, muted `#62738d`, line `#e2e9f3`. Dark palette retains ink `#0c1220`, panel `#151e30`, blue `#79a8ff`, violet `#b2a1ff`, text `#f3f6ff`, muted `#9caac3`. Use local Segoe UI Variable / Segoe UI. Headings 18–20 px, body 13 px, utility 11–12 px. Left alignment throughout.

Layout: 400 px popup and responsive native side panel, using the same UI. Compact brand header with theme and panel controls, three navigation tabs, current-page context and link field, then the actual video result. A small blue launcher sits at the bottom-right of YouTube video pages and hides in full screen. Chrome controls which side its native panel occupies (right by default).

Review against the screenshot: remove the large marketing headline, oversized select menu, and unnecessary vertical space. Separate file type from quality: MP4/WebM radio controls and a compact quality grid expose the available choices directly. A single blue download action anchors the result. No fabricated thumbnails, format choices, or stats. Use semantic controls, visible keyboard focus, reduced-motion support, and readable loading/error states.
