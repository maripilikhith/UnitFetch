# UniFetch browser architecture

The toolbar popup and Chrome side panel share the same UI and persisted theme. A small isolated content script on YouTube sends only a validated panel-open action. It cannot start downloads or invoke the engine.

The service worker validates exact extension UI senders, serializes starts, stores public previews and history, and delegates anonymous YouTube work to a Chrome offscreen document. Chrome downloads owns final file saving. Completion is recorded only after Chrome reports success.

The offscreen document bundles YouTube.js for metadata/player processing, GoogleVideo for SABR transport, and Mediabunny for lossless MP4/WebM merging. Temporary media and signed URLs remain in memory. Combined input is capped at 256 MiB; one YouTube task runs at a time. Both tracks and approximate duration are checked before saving. Cancel/restart/failure states cannot be replaced by late successful events.

Player transforms execute in an opaque sandbox iframe with no extension APIs and connect-src none. The privileged extension pages have no unsafe-eval permission. Network requests are limited to declared YouTube/API/Googlevideo hosts and omit credentials. Protocol-header rules are limited to the extension initiator, never browsing tabs. Verification-required and protected media are unsupported.

Runtime dependencies are checked into UniFetch/vendor so GitHub source ZIPs are already loadable. scripts/build-vendor.mjs rebuilds the bundle and includes third-party licenses plus unmodified MPL source. scripts/package-extension.mjs creates the smaller end-user ZIP and excludes tests and all legacy helper files.

The helper folder is retained solely as legacy v2 source. It is never invoked by v3. Older implementation notes are available in the v2 Git tags.
