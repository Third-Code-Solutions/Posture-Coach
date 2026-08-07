# Cross-device camera and local inference evidence

Reviewed: 2026-08-07
Scope: research-only sidecar for the current `Posture-Coach` browser-local posture coach.
Change boundary: this note is the only file intentionally changed by this research pass. No application code, deployment configuration, or test was changed by this research pass. Pre-existing/unrelated worktree changes were preserved.

Evidence labels used below:

- **OBSERVED** — present in the current repository.
- **SOURCE** — stated by a standards body, browser vendor, browser-maintainer document, or Google MediaPipe documentation.
- **INFERENCE** — product implication derived from the cited source and the current implementation.
- **UNKNOWN** — not established by source review or desktop automation.
- **PROPOSED** — validation or engineering work still required.

## Executive findings

1. **A portrait request is not a portrait guarantee.** `getUserMedia()` constraints are a selection/configuration request. The actual track settings and decoded video dimensions can differ, and settings can change during capture. The product must inspect `getSettings()`, `video.videoWidth`, and `video.videoHeight`, then normalize the effective frame before overlay and inference. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), [MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints), [MediaStreamTrack.getSettings()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings)

2. **Screen orientation locking cannot be the camera solution.** The Screen Orientation API is limited, may require fullscreen, and may reject on a normal browser page or a platform that does not allow web orientation changes. It changes the document orientation, not necessarily the sensor frame dimensions. Treat `screen.orientation.lock("portrait")` as an optional hint; keep a local canvas rotation/reacquisition path. [ScreenOrientation.lock()](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock), [Screen Orientation specification](https://www.w3.org/TR/screen-orientation/)

3. **The safest cross-engine frame path is feature-detected.** `createImageBitmap()` and `ImageBitmap` are broadly available and `ImageBitmap` is transferable to a worker, but direct `HTMLVideoElement` capture has had WebKit/iOS failures. Use direct capture only after a successful runtime probe; retain `drawImage(video, ...)` into an `HTMLCanvasElement` as the compatibility path. Close every bitmap after it is consumed or rejected. [ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap), [Window.createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects), [WebKit iOS 16 ImageBitmap test failures](https://bugs.webkit.org/show_bug.cgi?id=245586)

4. **Worker inference is the correct architecture for live pose work.** Google’s Web Pose Landmarker guide says `detectForVideo()` is synchronous and blocks the user interface thread, and recommends a Web Worker for camera video. The current repo follows that direction. [Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

5. **No API can promise every camera, device, browser shell, or full-body frame.** Real production support requires actual Safari iOS, Chrome Android, and Firefox device runs. Desktop Chromium with a fake camera validates application control flow only; it does not prove sensor orientation, iOS permission behavior, GPU/WASM throughput, thermal throttling, or a phone’s field of view.

## Current repository evidence

| Boundary                  | **OBSERVED** current behavior                                                                                                                                                                                                            | **INFERENCE** / implication                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera request            | [`src/vision/camera.ts`](../../src/vision/camera.ts#L20-L90) requests front-facing, portrait-ideal dimensions and has a lower-pressure portrait fallback. It applies constraints and checks `getSettings()`.                             | Keep constraints ideal/preferred rather than treating them as proof. Continue to handle `OverconstrainedError`, `NotAllowedError`, `NotFoundError`, and a user that leaves the prompt unresolved.                               |
| Effective portrait frame  | [`components/coach/CoachApp.tsx`](../../components/coach/CoachApp.tsx#L447-L520) detects a compact landscape camera stream, rotates it into a portrait HTML canvas, and uses that same canvas for the preview and `ImageBitmap` capture. | This is the right alignment invariant: the pixels shown to the user and the pixels sent to the pose worker must have the same orientation and dimensions. A CSS-only rotation would require equally careful landmark remapping. |
| Frame scheduling          | [`components/coach/CoachApp.tsx`](../../components/coach/CoachApp.tsx#L625-L643) prefers `requestVideoFrameCallback()` and falls back to `requestAnimationFrame()`.                                                                      | Keep both paths. `requestVideoFrameCallback()` is useful for video processing, but feature detection is required for older browser versions and embedded browser shells.                                                        |
| Backpressure and transfer | [`src/vision/worker-client.ts`](../../src/vision/worker-client.ts#L8-L74) permits one frame in flight, transfers the `ImageBitmap`, and closes rejected frames.                                                                          | Keep one-frame-in-flight behavior. It bounds latency and memory instead of allowing a queue of stale body frames.                                                                                                               |
| Worker runtime            | [`src/vision/pose.worker.ts`](../../src/vision/pose.worker.ts#L53-L118) uses local same-origin model/WASM assets, tries the GPU path, and falls back to local TFJS WASM.                                                                 | GPU availability must remain an optimization, not a launch requirement. Validate the WASM path on browsers/devices where worker WebGL or GPU contexts fail.                                                                     |
| Privacy headers           | [`vercel.json`](../../vercel.json#L20-L31) sets `connect-src 'self'`, `worker-src 'self' blob:`, `media-src 'self' blob:`, `camera=(self)`, `microphone=()`, `frame-ancestors 'none'`, CORP/COOP, and no-referrer.                       | The headers are a strong defense-in-depth baseline. They are not, by themselves, proof that every dependency or future code path cannot transmit pixels; network regression checks remain required.                             |
| Architecture contract     | [`docs/architecture.md`](../architecture.md#runtime-flow) documents `video/image -> ImageBitmap -> dedicated vision worker` and local-only model/WASM loading.                                                                           | Keep browser adapters, worker inference, domain evaluation, and privacy policy separate. Do not introduce a server frame endpoint merely to solve device compatibility.                                                         |

## Source-backed platform behavior

### Camera permission, constraints, and lifecycle

The [Media Capture and Streams specification](https://www.w3.org/TR/mediacapture-streams/) defines `getUserMedia()` as a permission-gated API and distinguishes **constraints**, **capabilities**, and **settings**. Constraints express acceptable or preferred operating modes; settings expose the current values. The specification also says sources can change dynamically, for example when low light causes a frame-rate change, and that user agents may continue delivering media even when a temporary condition prevents a requested constraint from being met.

Concrete product rules:

- Request `video` and explicitly set `audio: false`; a posture coach does not need microphone permission.
- Use `ideal` values for resolution, aspect ratio, facing mode, and frame rate unless a strict requirement is genuinely necessary. Required constraints can fail camera acquisition and increase the fingerprinting/error surface. [MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints), [Media Capture and Streams constraints model](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints)
- After acquisition and after meaningful resize/orientation events, record actual `track.getSettings()` and decoded `videoWidth`/`videoHeight`. Do not report “portrait” from the requested constraints alone. [MediaStreamTrack.getSettings()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings)
- Handle `OverconstrainedError` without leaking more device detail than necessary. Retry with a smaller preference set, then use the local transform if the stream is usable.
- Attach `ended`, `mute`, and `unmute` handling. Stop tracks when the user stops, the page is hidden if the product does not support background capture, the source changes, or setup becomes stale. [`MediaStreamTrack.stop()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop)
- Keep camera activation behind an explicit user action. `getUserMedia()` may remain pending if a user ignores the prompt, so the UI needs a clear requesting state and a way to abandon the attempt. [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

### Safari on iOS

Apple and WebKit document iPhone-specific inline playback rules. `playsinline` is required to keep video in the page instead of entering fullscreen, and muted/no-audio video is eligible for autoplay under Safari’s policy. WebKit’s WebRTC guidance also explains that capture streams can autoplay after the page is already capturing, but application code should still set `autoplay`, `muted`, and `playsInline` before calling `play()`. [Apple: Delivering Video Content for Safari](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari), [WebKit: New `<video>` Policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/), [WebKit: A Closer Look Into WebRTC](https://webkit.org/blog/7763/a-closer-look-into-webrtc/)

Safari-specific implications:

- A hidden or non-inline video path is risky on iPhone. Keep the live `<video>` element in the document, set `playsInline`/`muted`, call `play()` from the camera-start flow, and handle a rejected play promise.
- Do not assume iOS preserves the requested orientation in `videoWidth`/`videoHeight`. Verify the actual decoded frame and rotate in a canvas when a compact device returns landscape pixels.
- Use the canvas path as a first-class fallback, not only as an error recovery after a failed direct `createImageBitmap(video)`. WebKit’s official iOS 16 test report records failures for `createImageBitmap(HTMLVideoElement)` and its resize/orientation cases. That report is historical and does not establish that every current iOS build fails, but it is sufficient evidence not to make the direct overload a hard dependency. [WebKit bug 245586](https://bugs.webkit.org/show_bug.cgi?id=245586)
- WebKit has also tracked portrait rendering problems for camera video. Treat the preview’s effective canvas dimensions as authoritative for overlay mapping instead of trusting the raw element’s CSS box. [WebKit bug 229792](https://bugs.webkit.org/show_bug.cgi?id=229792)
- Safari’s permissions are controlled per website and can be changed by the user. Test Safari in a normal tab separately from an in-app browser, installed web app, or embedded WebKit view; those shells can have different lifecycle and permission behavior. [WebKit: A Closer Look Into WebRTC](https://webkit.org/blog/7763/a-closer-look-into-webrtc/)
- WebKit reports dedicated-worker `MediaStreamTrack` processing in Safari 18, but that is an optional newer path, not a safe baseline for every supported iPhone. The current `<video>` + canvas + `ImageBitmap` transfer design is more portable. [WebKit Features in Safari 18](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)

### Chrome on Android

Chrome’s first-party camera documentation describes selecting front/rear cameras on phones and using `MediaDevices.getUserMedia()` for camera input on Android. [Chrome for Developers: Choose cameras, microphones and speakers](https://developer.chrome.com/blog/media-devices)

Chrome-specific implications:

- Front/rear selection is now a product requirement. Preserve selected `facingMode` through every constraint fallback, show actual browser-selected lens when available, and stop old tracks before reconnecting. The browser may still choose a source that satisfies the full constraint set rather than the developer’s first preference.
- Chrome Android does not use automatic fullscreen for ordinary video the way iPhone historically did; Chrome’s `playsInline` documentation still supports retaining the attribute for cross-browser parity. [Chrome for Developers: Media updates in Chrome 75](https://developer.chrome.com/blog/media-updates-in-chrome-75/)
- Do not make `MediaStreamTrackProcessor`, `VideoFrame`, WebCodecs, or worker-side `OffscreenCanvas` a required baseline. Chrome documents those APIs as useful for advanced frame processing, but they have a narrower cross-engine contract than the current canvas/ImageBitmap path. [Chrome for Developers: Video processing with WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
- Test low- and mid-tier Android devices under battery saver and thermal load. A fast desktop Chromium run does not establish sustained pose-worker throughput on a phone.

### Firefox

Firefox follows the standards-based `getUserMedia()` permission, secure-context, constraint, track, and indicator model documented by Mozilla’s [getUserMedia reference](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). Mozilla’s documentation specifically describes browser camera-use indicators and the distinction between permission being granted and capture being active.

Firefox-specific implications:

- Use capability/feature detection rather than a user-agent branch for `requestVideoFrameCallback`, `createImageBitmap`, worker transfer, and orientation locking.
- Validate Firefox desktop and Firefox Android separately. “Firefox” is not one hardware path: camera drivers, GPU availability, Android device performance, and browser lifecycle can produce different results.
- Keep the canvas copy fallback even when the current Firefox build passes the direct video `createImageBitmap()` probe. The fallback is cheap insurance against source-type, resize-option, or embedded-runtime differences.

## Canvas, ImageBitmap, and worker compatibility

### Recommended baseline pipeline

```text
MediaStreamTrack
  -> HTMLVideoElement (autoplay + muted + playsinline)
  -> actual videoWidth/videoHeight check
  -> HTMLCanvasElement draw/rotate/resize when needed
  -> createImageBitmap(canvas) or a tested direct source path
  -> worker.postMessage({ frame }, [frame])
  -> synchronous MediaPipe detectForVideo() inside the worker
```

The [ImageBitmap reference](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) states that `ImageBitmap` is available in workers and is transferable. The [transferable-object reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) lists `ImageBitmap`, `OffscreenCanvas`, and `VideoFrame` as transferable resources. Transfer moves ownership; the sender must not reuse the bitmap after `postMessage()`, and the receiving side must call `close()` when finished to release graphical resources.

**INFERENCE for this app:** the current one-frame-in-flight `PoseWorkerClient` is preferable to a FIFO queue. If inference is slower than capture, drop the next frame rather than building latency. The worker must close the received frame on success and error; the main thread must close frames it abandons during source changes or failed transfer.

### Direct video capture versus canvas capture

`Window.createImageBitmap()` accepts an `HTMLVideoElement` in the standard API surface, and it is a good fast path when the target runtime handles it correctly. However, the official WebKit iOS 16 failure report above shows why this cannot be the only path. A 2D canvas `drawImage()` copy is explicitly supported for video painting by WebKit’s iOS video guidance and is also the natural place to rotate a landscape source into the app’s portrait coordinate system. [WebKit iOS video policies](https://webkit.org/blog/6784/new-video-policies-for-ios/), [CanvasRenderingContext2D.drawImage()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)

**PROPOSED runtime probe:** after metadata and playback are ready, test the exact source overload/options used by the app. If it rejects, produces an unexpected bitmap size, or produces a frame that cannot be transferred, permanently switch that source session to canvas capture. A one-time probe is better than retrying every frame and adding latency.

### `requestVideoFrameCallback()` and fallback scheduling

Mozilla describes `requestVideoFrameCallback()` as a callback aligned to decoded/composited video frames and useful for canvas painting and video analysis. It runs on the main thread, does not guarantee zero-latency synchronization, and may be absent on older devices/browsers. [HTMLVideoElement.requestVideoFrameCallback()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)

**INFERENCE:** keep the current feature test and `requestAnimationFrame()` fallback. Neither API creates “0 ms” inference: camera capture, decode, canvas work, message transfer, worker scheduling, model inference, and React paint all contribute latency. Report measured latency and drop/backpressure state instead of promising zero delay.

### `OffscreenCanvas` and newer frame APIs

MDN documents `OffscreenCanvas` as worker-capable and transferable, but notes that some parts have varying support. It is an optimization for moving canvas rendering off the main thread, not a requirement for a reliable browser-local coach. [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

**Product rule:** do not block camera startup on `OffscreenCanvas`, WebCodecs, `MediaStreamTrackProcessor`, `VideoFrame`, or `MediaStreamTrack` processing in a worker. Add them only behind feature detection and a tested fallback. A main-thread 2D canvas used only to rotate/downscale one frame at a time, followed by worker inference, is easier to support across Safari iOS, Chrome Android, and Firefox.

### MediaPipe worker contract

Google’s web guide says the Pose Landmarker `VIDEO` mode consumes decoded video frames with timestamps, and that `detect()`/`detectForVideo()` are synchronous and block the user interface thread. It recommends moving the calls to a Web Worker for camera video. The same guide documents normalized image coordinates, world-coordinate estimates, 33 landmarks, and built-in input preprocessing including rotation/resizing. [Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

**INFERENCE:** worker inference does not remove the need to normalize the preview. The overlay and evaluator need one canonical coordinate space. If the displayed camera frame is rotated locally, the worker must receive the rotated frame or the landmark adapter must apply the exact inverse transform. The current repo chooses the former, which reduces mirror/rotation drift.

## Browser matrix and product policy

This matrix intentionally avoids unsupported exact-version promises. “Feature available” means the API is documented and commonly implemented; it does not mean every OS version, device, embedded browser, or permission state behaves identically.

| Capability                                   | Safari iOS                                                                                                       | Chrome Android                                                                   | Firefox desktop/Android                                    | Product policy                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `getUserMedia({ video, audio: false })`      | Available in secure Safari contexts with user permission; website permissions and lifecycle matter.              | Standard camera path; front/rear selection and mobile constraints are supported. | Standards-based path with permission/indicator behavior.   | Require HTTPS/localhost, explicit activation, friendly permission errors, and a local upload fallback. |
| `playsinline`, `muted`, `autoplay`           | `playsinline` is important to avoid iPhone fullscreen; muted/no-audio playback is the compatible autoplay shape. | Inline video is normal; retain the attributes for shared markup.                 | Retain the same markup and handle rejected `play()`.       | Set all three before attaching/playing the camera stream; never assume `play()` succeeds.              |
| Resolution/aspect/facing constraints         | May return dimensions/orientation different from the request; WebKit has historical camera orientation issues.   | May choose another supported mode; settings are authoritative.                   | Same standards contract; device/driver differences remain. | Treat constraints as preferences; inspect `getSettings()` and video metadata; handle resize.           |
| Direct `createImageBitmap(video)`            | Must be probed; official WebKit iOS 16 tests reported video-source failures.                                     | Use as an optional fast path.                                                    | Use as an optional fast path.                              | Canvas copy/rotation is mandatory fallback, and can be the normal portrait path.                       |
| `ImageBitmap` transfer to worker             | Standards path is useful, but validate real iOS memory and transfer behavior.                                    | Supported modern path; validate low-memory devices.                              | Supported modern path; validate target versions.           | Transfer ownership, keep one frame in flight, close every bitmap.                                      |
| `requestVideoFrameCallback()`                | Feature-detect; older/embedded Safari may not expose it.                                                         | Feature-detect; useful for camera-rate scheduling.                               | Feature-detect; use fallback.                              | Keep `requestAnimationFrame()` fallback and measure latency/dropped frames.                            |
| `OffscreenCanvas` / WebCodecs / `VideoFrame` | Optional and version-sensitive.                                                                                  | Useful advanced optimization, not universal baseline.                            | Optional and version-sensitive.                            | Do not make startup or inference depend on them.                                                       |
| `screen.orientation.lock("portrait")`        | May reject outside fullscreen or be unavailable in Safari contexts.                                              | May work under platform/fullscreen conditions.                                   | Limited/platform-dependent.                                | Best-effort hint only; local portrait canvas is the reliable effective-frame contract.                 |
| GPU worker inference                         | Can vary with WebKit/GPU context and device state.                                                               | Can vary with GPU, battery, and thermal state.                                   | Can vary with graphics stack and device.                   | Probe GPU, fall back to local WASM, and expose “processing on device” without claiming a fixed FPS.    |

The standards and vendor references behind this table are [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), [Apple Safari video guidance](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari), [Chrome camera guidance](https://developer.chrome.com/blog/media-devices), [MDN ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap), [MDN `requestVideoFrameCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), [MDN `OffscreenCanvas`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), and [Google Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## Privacy and security constraints

### Browser-enforced requirements

- `getUserMedia()` is restricted to secure contexts. Production must be HTTPS; local development can use localhost. [MDN getUserMedia security](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- Camera permission is explicit and user-controlled. Browsers are expected to show permission and active-capture indicators. Do not hide the active camera state or imply that a denied permission is an inference failure. [Media Capture and Streams privacy requirements](https://www.w3.org/TR/mediacapture-streams/#privacy-and-security-considerations)
- A top-level valid-origin document can request capture. An embedded frame needs the parent’s Permissions Policy and the iframe’s `allow` attribute where applicable. [MDN getUserMedia privacy/security](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy)
- Permissions Policy and user permission are different controls. A policy can deny the feature before a prompt; a granted permission is not a guarantee that a particular camera request will succeed. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), [MDN Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy)
- Do not use automatic redirects, URL parameters, or third-party endpoints that can turn a stored camera permission into an unexpected video transmission. The W3C privacy section calls out this abuse case directly. [Media Capture and Streams privacy/security](https://www.w3.org/TR/mediacapture-streams/#privacy-and-security-considerations)

### Application controls required for this app

- Keep `connect-src` same-origin and model/WASM assets pinned to the app origin. Verify this with a real browser network trace after camera permission, not only by reading headers.
- Keep `microphone=()` because posture analysis does not need audio. Keep camera permission limited to the product origin; do not loosen it for a future analytics or advertising frame.
- Do not send camera frames, uploaded videos, landmarks, or posture sessions to a server. “Local” is a code and network invariant: audit dependencies, worker fetches, telemetry, service workers, error reporting, and future analytics before release.
- Stop all camera tracks, dispose workers, close transferred or abandoned `ImageBitmap` objects, revoke object URLs, clear frame canvases when practical, and remove event listeners on source changes. Browser garbage collection is not a substitute for explicit media/resource lifecycle management.
- Pause capture/inference when the document is hidden unless background capture is an explicit, user-visible feature. Resume only after rechecking the stream and video dimensions.
- Avoid persisting `deviceId`, camera labels, raw frames, or landmark histories unless a future feature has a documented purpose, consent, retention limit, and deletion path. Device enumeration and failed constraints can expose fingerprinting information; request only what is needed. [Media Capture and Streams privacy/security](https://www.w3.org/TR/mediacapture-streams/#privacy-and-security-considerations)
- Keep the visible consent copy accurate: camera processing is local, no microphone is requested, and the user can stop the camera. Do not claim “private” as an absolute guarantee against browser extensions, compromised dependencies, a compromised origin, device malware, screenshots, or a user’s own sharing action.

### Current header review

**OBSERVED:** the current [`vercel.json`](../../vercel.json#L20-L31) sets a restrictive `Permissions-Policy`, `connect-src 'self'`, `worker-src 'self' blob:`, `media-src 'self' blob:`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, CORP/COOP, and `Referrer-Policy: no-referrer`. That is aligned with the [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy) and [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) defense-in-depth model.

**INFERENCE:** the current CSP still includes `'unsafe-inline'`, `'wasm-unsafe-eval'`, and `'unsafe-eval'`. These may be required by the current Next/TFJS/WASM runtime, but they widen the script execution surface. Treat them as a documented compatibility trade-off, test whether each is still needed, and tighten incrementally. Do not remove them blindly: a broken local WASM path is a functional regression, not a security win.

## Concrete implications for production readiness

### P0 — must be true before a cross-device release claim

1. Camera start is user initiated, secure-context checked, video-only, permission-aware, and abortable when the request becomes stale.
2. Actual `track.getSettings()` and decoded video dimensions are captured in diagnostics for the session. Portrait is determined from the effective source/canvas, not the requested constraints.
3. iOS-compatible `<video autoplay muted playsinline>` behavior is exercised, including a rejected `play()` and a permission denial.
4. Direct `createImageBitmap(video)` is probed; canvas copy/rotation works when direct capture or resize options fail.
5. Preview pixels and worker pixels share the same effective orientation and dimensions. Overlay coordinate mapping is tested after 90-degree rotation and mirroring.
6. Worker transfer is one-frame-in-flight; frames are closed on every success, drop, stale-source, transfer-failure, and worker-error path.
7. GPU failure falls back to local WASM without a network model/API call. No camera/media/landmark/session request leaves the browser.
8. Camera tracks stop on stop, source switch, page teardown, track end, and supported visibility transitions.

### P1 — should be measured before calling the experience polished

- p50/p95 capture-to-result latency and effective inference FPS per browser/device class;
- dropped-frame count and time spent waiting on the worker;
- camera frame dimensions, orientation-transform activation, and camera track errors;
- memory growth during a 10-minute session and after stop/restart;
- behavior after rotate, lock/unlock, background/foreground, permission change, camera-in-use, low light, low battery, and thermal throttling;
- full-body framing success at realistic room distances with front, side, and three-quarter views.

These diagnostics should be aggregate, local, and opt-in if retained. A production privacy posture should not require uploading frames or a device fingerprint merely to learn whether a camera path is healthy.

## Required physical-device validation

**UNKNOWN in this research pass:** no physical iPhone, Android phone, or Firefox camera session was exercised here. The existing repository may have automated fake-camera coverage, but that is not hardware evidence. Do not convert this note into a universal “works on all devices” claim without the following runs.

### Safari iOS

- Current supported iPhone Safari in a normal tab, with front camera, portrait and landscape device rotation, permission allow/deny, camera already in use, background/foreground, low-light room, and a full-body distance.
- At least one smaller iPhone and one larger iPhone; include a device that returns landscape decoded dimensions while the phone is held upright.
- Safari tab versus installed web app/in-app browser only if those shells are in product scope. Record whether orientation lock rejects and confirm local canvas rotation remains correct.
- Verify direct video `ImageBitmap` probe, canvas fallback, worker transfer, WASM fallback, memory after repeated start/stop, and camera indicator behavior.

### Chrome Android

- Current Chrome on at least one low/mid-tier and one recent Android device; front and rear camera; portrait/landscape rotation; battery saver; low light; camera already used by another app.
- Confirm the chosen `facingMode`, actual `getSettings()`, decoded dimensions, effective portrait canvas, overlay alignment, worker latency, and sustained thermal behavior.
- Exercise GPU/WebGL unavailable or context-loss conditions and confirm local WASM recovery.

### Firefox

- Current Firefox desktop with an external webcam and no-WebGL/CPU path where available.
- Current Firefox Android with camera permission, portrait/landscape rotation, background/foreground, and full-body framing.
- Confirm `requestVideoFrameCallback()` feature detection, direct/canvas bitmap paths, transfer cleanup, and errors do not leave the camera active.

### Evidence to save per run

Record browser/OS/device, camera facing mode, permission result, `track.getSettings()`, `videoWidth`/`videoHeight`, effective canvas width/height, whether rotation was activated, inference delegate/model, p50/p95 latency, dropped frames, console errors, network requests, and whether tracks stopped after exit. Do not save camera frames unless a separate, explicit test protocol requires it.

## Unresolved hardware and product limits

- **Camera orientation is not a single web invariant.** Sensor orientation, browser rotation policy, metadata, CSS transforms, and decoded dimensions can disagree. Local normalization reduces risk but still needs device evidence.
- **Full-body capture is optical and environmental.** A browser cannot force a phone’s field of view, room depth, tripod position, lighting, clothing contrast, or visibility of feet. A portrait container can still be too close to fit the user.
- **Performance is device-state dependent.** Worker inference, WebGL, WASM, thermal throttling, memory pressure, and OS scheduling vary. “Realtime” must be a measured range with an abstention/backpressure policy, not a zero-delay promise.
- **Embedded browser shells are separate products.** iOS Safari, an in-app browser, a WKWebView, and an installed web app can have different permission and lifecycle behavior even when they share WebKit.
- **Compatibility tables are not a hardware certification.** Standards and vendor documentation establish API contracts; only a named device/browser/OS run establishes that the camera, canvas, worker, model, and UI work together.
- **Pose landmarks are estimates, not clinical instruments.** This note addresses transport, rendering, and local inference compatibility. It does not establish posture diagnosis, clinical accuracy, or medical suitability.

## Primary-source register

### Standards and browser-maintainer references

- [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/) — secure context, constraints/settings, permissions, indicators, Permissions Policy, privacy/security.
- [W3C Screen Orientation](https://www.w3.org/TR/screen-orientation/) — orientation lock preconditions and platform discretion.
- [Mozilla MDN: `getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — secure context, permission, top-level document, Permissions Policy, indicators, errors.
- [Mozilla MDN: constraints](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints) — capabilities, constraints, settings, `getSettings()` as actual state.
- [Mozilla MDN: `MediaTrackConstraints`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints) — ideal versus exact/range constraints.
- [Mozilla MDN: `MediaStreamTrack.getSettings()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings) — current track settings.
- [Mozilla MDN: `MediaStreamTrack.stop()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop) — explicit track/source stop lifecycle.
- [Mozilla MDN: `ImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) — worker availability, transferability, `close()`.
- [Mozilla MDN: `createImageBitmap()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap) — accepted image sources including video.
- [Mozilla MDN: transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) — ownership transfer and `ImageBitmap`/`OffscreenCanvas`/`VideoFrame` list.
- [Mozilla MDN: `requestVideoFrameCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) — video-frame scheduling, metadata, and lack of strict synchronization guarantee.
- [Mozilla MDN: `OffscreenCanvas`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) — worker rendering, transferability, and varying support.
- [Mozilla MDN: Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy) — header/iframe allowlists and sensitive-feature restriction.
- [Mozilla MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) — defense-in-depth policy for script, worker, media, and network sources.

### First-party vendor/platform references

- [Apple: Delivering Video Content for Safari](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari) — iOS inline playback, `playsinline`, muted/autoplay behavior, WebRTC playback.
- [WebKit: New `<video>` Policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) — iPhone inline playback, user gesture, muted playback, and painting video to canvas.
- [WebKit: A Closer Look Into WebRTC](https://webkit.org/blog/7763/a-closer-look-into-webrtc/) — Safari capture permissions and capture-stream autoplay behavior.
- [WebKit bug 245586](https://bugs.webkit.org/show_bug.cgi?id=245586) — official iOS 16 `ImageBitmap(HTMLVideoElement)` layout-test failures.
- [WebKit bug 229792](https://bugs.webkit.org/show_bug.cgi?id=229792) — official Safari 15 portrait camera-video rendering issue.
- [WebKit Features in Safari 18](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) — newer dedicated-worker media-track processing; optional, not baseline.
- [Chrome for Developers: Choose cameras, microphones and speakers](https://developer.chrome.com/blog/media-devices) — phone camera selection and Chrome Android media-device history.
- [Chrome for Developers: Media updates in Chrome 75](https://developer.chrome.com/blog/media-updates-in-chrome-75/) — Chrome `playsInline` behavior and Android/desktop fullscreen distinction.
- [Chrome for Developers: Video processing with WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — optional `MediaStreamTrackProcessor`, `VideoFrame`, worker, and OffscreenCanvas frame-processing paths.

### Google model/runtime reference

- [Google AI Edge: Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) — `VIDEO` mode, decoded frames/timestamps, synchronous `detectForVideo()`, worker recommendation, landmarks, and coordinates.
