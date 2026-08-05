# Architecture and validation notes

## Runtime flow

```text
camera / local video / still image
        |
        v
video or image element -> ImageBitmap -> PoseWorkerClient -> dedicated MediaPipe worker
                                                       |
                                                       v
                       raw landmarks -> normalization -> confidence gate
                                                       |
                  smoothing -> calibration/view gate -> geometry -> mode evaluator
                                                       |
                              deterministic priority resolver -> React snapshot
```

`src/domain/**` has no React, DOM, MediaPipe, network, randomness, or wall-clock dependencies. All timestamps enter as arguments. Presentation mirroring is applied only in `PoseCanvas`; canonical left/right landmark labels remain unchanged.

The MediaPipe Tasks Web landmark type provides visibility but not a separate presence field. The adapter preserves an explicit presence value when a runtime supplies one and otherwise uses visibility as the conservative presence proxy before confidence gating.

## Safety policy

The evaluator uses required-landmark gates, camera-view declarations, calibration, persistence, and movement thresholds. A one-frame observation cannot produce a form warning or repetition. Insufficient evidence is the highest-priority state and suppresses corrective advice. Copy stays at the level of “possible form issue” and “try adjusting.”

The current browser surface shows one cue at a time, keeps camera activation behind a user action, and disposes tracks, workers, callbacks, object URLs, and transferred frames on session exit.

The worker also short-circuits the optional ODML telemetry request bundled by the MediaPipe runtime. The model and Wasm load from the app origin; runtime network validation showed only same-origin assets and the local upload object URL.

Uploaded-video `ended` events stop the frame loop, dispose the worker, and retain only aggregate in-memory session summary data for the completed view. Still images run one inference, retain only their overlay state, and do not fabricate movement or repetition results. Refresh or stop clears the media source and object URL.

## MediaPipe asset policy

- Package: `@mediapipe/tasks-vision@1.0.1`.
- Model: official Pose Landmarker Full float16 bundle, same-origin at `/models/pose_landmarker_full.task`.
- Wasm: copied from the exact installed package into `/wasm`; runtime code uses `/wasm`, never `@latest` or a third-party CDN.
- Segmentation masks are disabled for the MVP to keep inference work bounded.

## Known validation limits

Automated domain tests use deterministic landmark fixtures. Browser tests must distinguish mocked media-permission evidence from a real hardware camera. Real-camera performance depends on the named browser/device and is not a universal claim. The model may degrade with poor light, occlusion, extreme distance, or multiple people; the UI asks the user to reposition instead of guessing.
