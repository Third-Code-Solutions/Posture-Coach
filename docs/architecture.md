# Architecture and validation notes

## Runtime flow

```text
camera / local video / still image
        |
        v
video or image element -> ImageBitmap -> capability route
                                      |                |
                         worker Canvas2D available?     no
                                      |                |
                                      v                v
                           dedicated worker     main-thread compatibility path
                              |        |                |
                         WebGL yes     no WebGL         |
                              |        |                |
                              v        v                v
                       MediaPipe     BlazePose TFJS / WASM CPU
                              \___________|____________/
                                          |
                                          v
                       raw landmarks -> normalization -> confidence gate
                                          |
                  smoothing -> calibration/view gate -> geometry -> mode evaluator
                                          |
                              deterministic priority resolver -> local evidence registry -> React snapshot
```

`src/domain/**` has no React, DOM, MediaPipe, network, randomness, or wall-clock dependencies. All timestamps enter as arguments. `src/browser-session/**` owns generated countdown audio, timer cancellation, stale wake-lock requests, browser release events, and session-stop cleanup behind deterministic controllers. React subscribes to those controller snapshots. Presentation mirroring is applied only in `PoseCanvas`; canonical left/right landmark labels remain unchanged.

`src/knowledge/posture-evidence.ts` is a static, versioned cache of paraphrased posture guidance and direct source metadata. It performs no fetches. Evaluator feedback carries source IDs, and the UI resolves those IDs locally so a cue remains inspectable without an API key or a live research service.

The MediaPipe Tasks Web landmark type provides visibility but not a separate presence field. The adapter preserves an explicit presence value when a runtime supplies one and otherwise uses visibility as the conservative presence proxy before confidence gating.

## Safety policy

The evaluator uses required-landmark gates, camera-view declarations, calibration, persistence, and movement thresholds. A one-frame observation cannot produce a form warning or repetition. Insufficient evidence is the highest-priority state and suppresses corrective advice. Copy stays at the level of “possible form issue” and “try adjusting.”

The current browser surface shows one cue at a time, keeps camera activation behind a user action, and disposes tracks, workers, callbacks, object URLs, and transferred frames on session exit.

Dedicated-worker inference remains preferred. WebKit builds that expose `ImageBitmap` and WebAssembly but cannot create a worker `OffscreenCanvasRenderingContext2D` use a one-frame-in-flight main-thread BlazePose/WASM compatibility client. The heavy model stays lazy-loaded, all assets remain same-origin, and the client still drops work instead of queueing stale frames.

Camera constraints prefer portrait dimensions and preserve selected front/rear lens through preferred, reduced-resolution, and unconstrained fallbacks. Switching lenses stops the prior stream before requesting another. Front preview mirrors by default; rear preview does not, while canonical anatomical labels stay unchanged. When a compact or touch device still reports a landscape camera track, the client rotates frames into a portrait canvas locally before both preview and inference. That compositor preserves aspect ratio and caps its longest edge at 960px. It copies accepted inference frames into a separate bounded canvas, so asynchronous bitmap capture cannot mutate or freeze the displayed canvas. On the dedicated-worker path it paints each new camera frame before checking inference backpressure, so worker inference cadence does not freeze the preview. The WebKit main-thread compatibility path still shares main-thread frame time with inference. Inference bitmaps start at a 720px longest-edge budget and can step to 576px or 480px after sustained capture-to-result latency; normalized landmark geometry remains aligned to the effective portrait source dimensions. Browsers without `createImageBitmap` resize options scale through a bounded local canvas instead of submitting full-resolution frames.

Camera sessions enter guided setup before calibration: a five-second visual/local-tone countdown accepts no baseline samples, then starts the existing confidence-gated calibration window. Desk calibration requires stable torso distance, head offset, shoulder level, and trunk lean across the accepted window. Countdown timers, generated-audio context, and optional screen wake lock are released on every source/session exit.

Browser API basis: [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext), and [generated oscillator tones](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createOscillator).

Standing mode is a separate stationary evaluator. It requires head-to-ankle landmarks, calibrates a relaxed full-body baseline, and uses side-view head/trunk geometry plus front-view shoulder/hip geometry only when the selected view supports that signal. A steady result means the visible landmarks are close to that baseline; it is not a clinical normal/abnormal judgment.

The worker also short-circuits the optional ODML telemetry request bundled by the MediaPipe runtime. The model and Wasm load from the app origin; runtime network validation showed only same-origin assets and the local upload object URL.

When a worker-capable page cannot create either WebGL 2 or WebGL 1, the worker does not start MediaPipe's WebGL-backed image upload path. It loads the vendored BlazePose Full TFJS model and WASM binaries from same-origin assets instead, preserving the 33-keypoint contract while trading throughput for compatibility. GPU-capable worker paths keep MediaPipe. Browsers without worker Canvas2D use the same BlazePose/WASM contract on the main thread.

Uploaded-video `ended` events stop the frame loop, dispose the worker, and retain only aggregate in-memory session summary data for the completed view. Still images run one inference, retain only their overlay state, and do not fabricate movement or repetition results. Refresh or stop clears the media source and object URL.

## MediaPipe asset policy

- Package: `@mediapipe/tasks-vision@1.0.1`.
- Model: official Pose Landmarker Full float16 bundle, same-origin at `/models/pose_landmarker_full.task`.
- Wasm: copied from the exact installed package into `/wasm`; runtime code uses `/wasm`, never `@latest` or a third-party CDN.
- Segmentation masks are disabled for the MVP to keep inference work bounded.
- No-WebGL fallback: `@tensorflow-models/pose-detection@2.1.3` BlazePose TFJS Full with TensorFlow.js WASM `4.22.0`, all vendored under `public/models/blazepose-tfjs` and `public/tfjs-wasm`.

## Known validation limits

Automated domain tests use deterministic landmark fixtures. Browser tests must distinguish mocked media-permission evidence from a real hardware camera. Real-camera performance depends on the named browser/device and is not a universal claim. The model may degrade with poor light, occlusion, extreme distance, or multiple people; the UI asks the user to reposition instead of guessing.
