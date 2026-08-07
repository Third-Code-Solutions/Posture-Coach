# Production readiness

Updated 2026-08-08 for the adaptive mobile-inference hardening pass.

## Product contract

- No account, login, payment, backend API, analytics, paid model, or runtime research request.
- Webcam, uploaded video, still images, landmarks, feedback, and summaries stay in browser memory.
- MediaPipe Pose Landmarker Full runs in a dedicated worker with same-origin pinned assets when worker Canvas2D is available.
- GPU delegate is preferred. Local TensorFlow.js WASM BlazePose Full is the no-WebGL worker fallback. WebKit-class browsers without worker Canvas2D transfer bounded RGBA buffers to that worker; main-thread inference remains the final compatibility route when workers are absent or cannot initialize.
- User can choose front or rear camera. Lens selection survives all constraint fallbacks; active switching releases old tracks before reconnecting.
- Camera sessions default to a five-second hands-free guided setup before calibration. Baseline sampling cannot begin during the countdown; users can start immediately or disable guided setup.
- Active video requests the optional Screen Wake Lock API and reports active, unsupported, system-released, or blocked state without treating wake lock as required for coaching.
- Camera requests prefer portrait constraints. Compact/touch devices receive a bounded 960px local portrait compositor when hardware returns landscape frames. A separate bounded inference snapshot keeps preview painting active during asynchronous bitmap capture and dedicated-worker backpressure. The WebKit pixel bridge performs one bounded page readback per accepted frame while keeping model inference off the main thread.
- Inference starts at a 720px longest-edge budget and can step to 576px or 480px after sustained capture-to-result latency. Preview and overlay retain effective source dimensions, so resizing does not crop full-body framing. The Full model and confidence gates remain unchanged.
- Coach output is educational visible-form guidance. It abstains on missing landmarks, low confidence, unsupported view, stale frames, invalid geometry, calibration mismatch, or framing drift.

## User-critical flows

1. Load static app over HTTPS.
2. Inspect device readiness.
3. Select mode, camera view, and front/rear lens.
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
- `pnpm exec playwright test tests/e2e/smoke.spec.ts --project=firefox --project=webkit --project=mobile-chromium --project=mobile-webkit`
- mobile fake-camera test using landscape 320×180 source at 390×844 viewport
- live HTTPS browser check at 390×844 for portrait layout, no horizontal overflow, static asset 200s, and zero console errors

2026-08-08 local production-export evidence:

- 114 unit/domain/browser-adapter tests passed, including bounded portrait-preview geometry, adaptive-profile hysteresis, worker-lifecycle sample reset, resilient worker initialization, first-frame preservation, post-ready transport/inference fallback, one-shot static-source replay, and final-fallback loop prevention, custom inference bounds, React unmount cleanup, exact live decision-rule attribution, registry-value coupling, delayed pre-calibration frame rejection, direction-aware lunge classification, visible-chain profile calibration/evaluation, full-foot framing, and operational-versus-heuristic labeling.
- Full Playwright matrix: 63 passed; 9 explicit platform-bound skips.
- Desktop Chromium, Firefox, and WebKit: 39 passed; 5 skipped. Firefox's dedicated resize-option probe and synthetic portrait-camera compositor case are skipped; WebKit's 3 local-video cases remain skipped for documented fixture/capability limits. WebKit passed real local-image inference through the dedicated BlazePose/WASM pixel worker; the browser test observed the transferable `infer-pixels` worker message and rendered the pose overlay.
- Pixel 7 and iPhone 13 emulation: 24 passed; 4 skipped. Pixel Chrome passed all shared mobile and camera behavior except the desktop-only resize probe. iPhone WebKit attempted the real-image pixel-worker route, recovered the same image through the main-thread fallback after an injected recoverable worker inference failure, rendered the overlay, and retains 3 codec-bound local-video skips.
- Chrome runtime: 4 camera-path tests passed. Coverage includes a synthetic landscape source exercised at 1024×576 logical dimensions and capped to a 540×960 portrait canvas, multiple preview paints while asynchronous bitmap capture is deliberately held open and separately while worker inference submission is held for 1.5s, repeated camera start/stop cycles with track, wake-lock, and worker release, guided setup with a directly observed zero-sample invariant, lens-switch reacquisition, hidden-page cleanup, hands-free calibration start, and a forced Safari-style resize-option failure that downshifted actual submitted canvas frames to 576×576 after sustained capture-side delay.
- Firefox synthetic camera: 2 passed for guided setup, local inference startup, wake-lock system release, stop, and hidden-page cleanup. Firefox portrait-compositor coverage is skipped because its synthetic source is not the deterministic Chrome Y4M fixture.
- Pixel 7 Chrome camera emulation: 3 passed for front/rear source switching, guided setup, portrait rotation, local inference, wake-lock lifecycle, and hidden-page cleanup.
- Browser-adapter tests cover unsupported and rejected wake-lock requests, system release, active-session stop, and a delayed stale request resolving after stop. Static-host verification requires identical camera and screen-wake-lock permissions on the exported server.
- Pixel 7 guided-setup visual check: 412px viewport/document width, 330×587 countdown exactly covered the portrait preview, 55px guided control, no overflow, no console/page/HTTP errors, no external requests, and source released on stop.
- Firefox completed real local-video calibration for all three front-view-compatible exercise modes (squat, lunge, and curl); the same browser test verifies that plank and push-up reject front view and accept side-view selection. A deterministic side-view video fixture is still needed before claiming automated local-video calibration for those two modes.
- Cold local shell: 142,493 initial transfer bytes; desktop LCP 332ms, mobile LCP 112ms, CLS 0 for both. Localhost timing is a regression baseline, not internet-user latency.
- Pixel 7 emulation local-video tracking sample: model ready in 843ms, sampled live latency p50 19ms / p95 26ms / max 27ms, zero external requests, console errors, or page errors. Emulator timing is not physical-device certification.
- Rendered semantics: one `main`, one `h1`, `lang=en`, no duplicate IDs, no unlabeled controls in the checked surface, and a keyboard-visible skip link.

Automated mobile camera evidence proves compositor behavior, not every physical handset camera driver. Real iOS/Android hardware validation still requires representative devices and permission interaction. Claims remain bounded until those devices are exercised.

## Incident response

Rollback is static and reversible: redeploy previous known-good Git commit to linked Vercel project, then repeat root, asset, browser, and console checks. No database migration or user-data rollback exists because product stores no server data.

## Unsupported claims

Never state that posture is “perfect,” “normal/abnormal,” medically diagnosed, pain-causing, injury-preventing, or clinically accurate. Encourage comfortable movement, variation, stopping with pain, and qualified professional assessment for symptoms, injury, progressive asymmetry, neurological signs, or rehabilitation.
