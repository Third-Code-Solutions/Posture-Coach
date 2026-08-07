# Production readiness

Updated 2026-08-07 for the cross-device production hardening pass.

## Product contract

- No account, login, payment, backend API, analytics, paid model, or runtime research request.
- Webcam, uploaded video, still images, landmarks, feedback, and summaries stay in browser memory.
- MediaPipe Pose Landmarker Full runs in a dedicated worker with same-origin pinned assets.
- GPU delegate is preferred. Local TensorFlow.js WASM BlazePose Full is fallback when WebGL is unavailable.
- Camera requests prefer portrait constraints. Compact/touch devices receive a local 90-degree portrait compositor when hardware returns landscape frames.
- Inference frames are resized to a maximum 720px longest edge. Preview and overlay retain effective source dimensions, so resizing does not crop full-body framing.
- Coach output is educational visible-form guidance. It abstains on missing landmarks, low confidence, unsupported view, stale frames, invalid geometry, calibration mismatch, or framing drift.

## User-critical flows

1. Load static app over HTTPS.
2. Inspect device readiness.
3. Select mode and camera view.
4. Start webcam or choose local video/image.
5. Keep one full body visible inside portrait guide.
6. Calibrate relaxed baseline.
7. Receive one persistent, evidence-linked cue at a time.
8. Stop session to release tracks, worker, callbacks, object URLs, and in-memory summary state.

## Verification record

Local gates required before release:

- `pnpm format:check`
- scoped ESLint plus `pnpm lint` review for generated-output noise
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm hosting:check`
- `pnpm exec playwright test --project=chromium`
- mobile fake-camera test using landscape 320×180 source at 390×844 viewport
- live HTTPS browser check at 390×844 for portrait layout, no horizontal overflow, static asset 200s, and zero console errors

Automated mobile camera evidence proves compositor behavior, not every physical handset camera driver. Real iOS/Android hardware validation still requires representative devices and permission interaction. Claims remain bounded until those devices are exercised.

## Incident response

Rollback is static and reversible: redeploy previous known-good Git commit to linked Vercel project, then repeat root, asset, browser, and console checks. No database migration or user-data rollback exists because product stores no server data.

## Unsupported claims

Never state that posture is “perfect,” “normal/abnormal,” medically diagnosed, pain-causing, injury-preventing, or clinically accurate. Encourage comfortable movement, variation, stopping with pain, and qualified professional assessment for symptoms, injury, progressive asymmetry, neurological signs, or rehabilitation.
