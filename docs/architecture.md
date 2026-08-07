# Architecture and validation notes

## Runtime flow

```text
camera / local video / still image
        |
        v
video or image element -> ImageBitmap -> PoseWorkerClient -> dedicated vision worker
                                                       |
                              WebGL available? --------+-------- no WebGL
                                   |                              |
                                   v                              v
                         MediaPipe Pose Landmarker       BlazePose TFJS / WASM CPU
                                   \___________________________/
                                                       |
                                                       v
                       raw landmarks -> normalization -> confidence gate
                                                       |
                  smoothing -> calibration/view gate -> geometry -> mode evaluator
                                                       |
                              deterministic priority resolver -> local evidence registry -> React snapshot
```

`src/domain/**` has no React, DOM, MediaPipe, network, randomness, or wall-clock dependencies. All timestamps enter as arguments. Presentation mirroring is applied only in `PoseCanvas`; canonical left/right landmark labels remain unchanged.

`src/knowledge/posture-evidence.ts` is a static, versioned cache of paraphrased posture guidance and direct source metadata. It performs no fetches. Evaluator feedback carries source IDs, and the UI resolves those IDs locally so a cue remains inspectable without an API key or a live research service.

The MediaPipe Tasks Web landmark type provides visibility but not a separate presence field. The adapter preserves an explicit presence value when a runtime supplies one and otherwise uses visibility as the conservative presence proxy before confidence gating.

## Safety policy

The evaluator uses required-landmark gates, camera-view declarations, calibration, persistence, and movement thresholds. A one-frame observation cannot produce a form warning or repetition. Insufficient evidence is the highest-priority state and suppresses corrective advice. Copy stays at the level of “possible form issue” and “try adjusting.”

The current browser surface shows one cue at a time, keeps camera activation behind a user action, and disposes tracks, workers, callbacks, object URLs, and transferred frames on session exit.

Camera constraints prefer portrait dimensions. When a compact or touch device still reports a landscape camera track, the client rotates frames into a portrait canvas locally before both preview and inference. Inference bitmaps are capped at 720px on the longest edge to reduce mobile transfer and compute pressure; normalized landmark geometry remains aligned to the effective portrait source dimensions.

Standing mode is a separate stationary evaluator. It requires head-to-ankle landmarks, calibrates a relaxed full-body baseline, and uses side-view head/trunk geometry plus front-view shoulder/hip geometry only when the selected view supports that signal. A steady result means the visible landmarks are close to that baseline; it is not a clinical normal/abnormal judgment.

The worker also short-circuits the optional ODML telemetry request bundled by the MediaPipe runtime. The model and Wasm load from the app origin; runtime network validation showed only same-origin assets and the local upload object URL.

When the page cannot create either WebGL 2 or WebGL 1, the worker does not start MediaPipe's WebGL-backed image upload path. It loads the vendored BlazePose Full TFJS model and WASM binaries from same-origin assets instead, preserving the 33-keypoint contract while trading throughput for compatibility. GPU-capable devices keep the MediaPipe path.

Uploaded-video `ended` events stop the frame loop, dispose the worker, and retain only aggregate in-memory session summary data for the completed view. Still images run one inference, retain only their overlay state, and do not fabricate movement or repetition results. Refresh or stop clears the media source and object URL.

## MediaPipe asset policy

- Package: `@mediapipe/tasks-vision@1.0.1`.
- Model: official Pose Landmarker Full float16 bundle, same-origin at `/models/pose_landmarker_full.task`.
- Wasm: copied from the exact installed package into `/wasm`; runtime code uses `/wasm`, never `@latest` or a third-party CDN.
- Segmentation masks are disabled for the MVP to keep inference work bounded.
- No-WebGL fallback: `@tensorflow-models/pose-detection@2.1.3` BlazePose TFJS Full with TensorFlow.js WASM `4.22.0`, all vendored under `public/models/blazepose-tfjs` and `public/tfjs-wasm`.

## Known validation limits

Automated domain tests use deterministic landmark fixtures. Browser tests must distinguish mocked media-permission evidence from a real hardware camera. Real-camera performance depends on the named browser/device and is not a universal claim. The model may degrade with poor light, occlusion, extreme distance, or multiple people; the UI asks the user to reposition instead of guessing.
