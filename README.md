# Third Code Posture

Privacy-first browser-local posture coaching for relaxed standing, desk alignment, and movement practice.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Camera access requires a secure context (`localhost` is allowed) and an explicit click. Uploaded videos and still images are read through local object URLs and revoked when the session stops. Front/rear camera selection stays local; switching lenses releases the previous stream before requesting the next one. On phones, keep device upright; if browser returns landscape frames, app rotates them through a bounded local portrait compositor. A separate inference snapshot keeps preview painting active during asynchronous bitmap capture and dedicated-worker backpressure. WebKit-class browsers without worker Canvas2D transfer a bounded RGBA pixel buffer to the dedicated pose worker; the main-thread inference client is reserved for browsers without workers or a worker that cannot initialize or transfer frames.

Quality gates:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:domain
pnpm build
pnpm test:e2e
```

`test:e2e` serves the static export on port `3010` and runs installed Chrome, Firefox, WebKit, Pixel 7 emulation, and iPhone 13 emulation. Chrome and Pixel 7 camera tests use a deterministic Y4M source through the installed Chrome channel; Firefox uses its built-in synthetic camera. Playwright WebKit on Windows cannot certify Safari/iPhone camera drivers, so real iOS hardware remains a separate release gate. The browser gate stays isolated from any other local app on port `3000`.

## Hosting readiness

The web app is a static client-only export. Vercel is configured as the primary frontend host through [`vercel.json`](vercel.json); the build runs `pnpm build` and serves Next's `out/` directory. No environment variables, database, API, account, analytics, or provider secret are required.

Railway is configured as a Docker-based static host through [`railway.json`](railway.json) and [`Dockerfile`](Dockerfile). The container listens on Railway's injected `PORT`, serves the exported app, and exposes `GET /healthz` for readiness. The exact local container check is:

```bash
docker build -t posture-coach:local .
docker run --rm -p 3001:3000 posture-coach:local
```

In a second terminal, confirm `http://127.0.0.1:3001/healthz` returns `ok`, then open `http://127.0.0.1:3001/`. See [docs/deployment.md](docs/deployment.md) for provider setup and release gates.

## Product boundaries

- Relaxed standing, desk posture, and five exercise modes are educational coaching cues, not medical advice.
- The offline Posture Guide makes every cached topic searchable without camera access and shows observable signals, practical options, camera limits, and direct sources.
- Every threshold-driven pause, corrective cue, and rep decision resolves to a versioned registry with its metric, view, threshold, rationale, limitation, and history. See [measurement methodology](docs/measurement-methodology.md).
- Standing mode calibrates a comfortable full-body baseline, then reports only persistent visible head, trunk, or side-to-side alignment tendencies supported by the selected camera view.
- The app does not diagnose, promise clinical accuracy, or promise injury prevention.
- Camera frames, uploaded video, uploaded images, landmarks, and session summaries remain in browser memory. There is no account, backend, analytics, paid AI API, or frame upload.
- Still images run one local pose pass and show the landmark overlay. Movement coaching and repetition counts require a webcam or video sequence.
- Evaluation abstains when required landmarks are missing, confidence is low, the view is unsupported, or calibration is not stable.
- Live inference starts at a 720px longest-edge input budget, then can step to 576px or 480px only after sustained capture-to-result latency. Hysteresis restores detail after a long fast run and worker restarts clear incomplete streaks. Full pose model, uncropped preview, confidence gates, and camera-local processing stay unchanged.
- Locally rotated portrait preview is capped at 960px longest edge. A separate bounded inference snapshot lets it redraw during asynchronous bitmap capture and dedicated-worker backpressure, avoiding full-resolution canvas churn and frozen-looking preview on slower phones.
- Front camera mirrors preview by default; rear camera stays unmirrored and usually offers wider full-body framing. Canonical anatomical left/right labels never change.
- Guided camera setup waits five seconds before accepting baseline samples, giving the person time to leave the controls and stand naturally. A generated local tone accompanies the visible countdown when browser audio is available.
- Live video requests an optional screen wake lock so phones do not dim during hands-free practice. Unsupported or battery-blocked devices continue normally and show a manual sleep-setting fallback.
- The device-readiness panel reports secure context, camera API, local inference capability, worker compatibility, and GPU/WASM fallback status without sending telemetry.
- Device readiness can download a local physical-device report after a camera run. It contains capability flags, sanitized per-facing frame dimensions, observed front/rear modes, aggregate camera latency, backpressure, full-body framing, and track cleanup. Uploaded media does not enter camera metrics. It never contains frames, landmarks, camera IDs, or uploaded telemetry.
- Stop if you feel pain. Seek qualified professional help for injury, pain, or rehabilitation.

## Technical notes

The MediaPipe Pose Landmarker runs in a dedicated worker using the pinned Full model and same-origin Wasm assets. Browsers with workers but without worker Canvas2D copy a bounded frame into an RGBA buffer on the page, transfer that buffer to the worker, and run BlazePose/WASM there. A resilient wrapper preserves the first frame and falls back to the lazy, one-frame-in-flight main-thread client when worker support is absent, initialization fails, frame transport fails, or the primary worker reports a recoverable inference failure. The pure domain engine owns normalization, confidence gating, smoothing, calibration, geometry, movement phases, deterministic feedback, and summaries. Browser-session adapters own guided-setup audio/timing and wake-lock lifecycle; React only binds actions and presents snapshots.

See [docs/architecture.md](docs/architecture.md), [docs/licensing.md](docs/licensing.md), [docs/measurement-methodology.md](docs/measurement-methodology.md), [docs/production-readiness.md](docs/production-readiness.md), [docs/physical-device-certification.md](docs/physical-device-certification.md), and [tasks/plan.md](tasks/plan.md).
