# Form / Local

Privacy-first browser-local posture coaching for desk alignment and movement practice.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Camera access requires a secure context (`localhost` is allowed) and an explicit click. Uploaded videos and still images are read through local object URLs and revoked when the session stops.

Quality gates:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:domain
pnpm build
pnpm test:e2e
```

`test:e2e` serves the static export on port `3010` and uses the installed Chrome channel, keeping the browser gate isolated from any other local app on port `3000`.

## Hosting readiness

The MVP is a static client-only export. Vercel is configured as the primary frontend host through [`vercel.json`](vercel.json); the build runs `pnpm build` and serves Next's `out/` directory. No environment variables, database, API, account, analytics, or provider secret are required.

Railway is configured as a Docker-based static host through [`railway.json`](../posture/railway.json) and [`Dockerfile`](../posture/Dockerfile). The container listens on Railway's injected `PORT`, serves the exported app, and exposes `GET /healthz` for readiness. The exact local container check is:

```bash
docker build -t posture-coach:local .
docker run --rm -p 3001:3000 posture-coach:local
```

In a second terminal, confirm `http://127.0.0.1:3001/healthz` returns `ok`, then open `http://127.0.0.1:3001/`. Deployment has not been run. See [docs/deployment.md](docs/deployment.md) for provider setup and release gates.

## Product boundaries

- Desk posture and five exercise modes are educational coaching cues, not medical advice.
- The app does not diagnose, promise clinical accuracy, or promise injury prevention.
- Camera frames, uploaded video, uploaded images, landmarks, and session summaries remain in browser memory. There is no account, backend, analytics, paid AI API, or frame upload.
- Still images run one local pose pass and show the landmark overlay. Movement coaching and repetition counts require a webcam or video sequence.
- Evaluation abstains when required landmarks are missing, confidence is low, the view is unsupported, or calibration is not stable.
- Stop if you feel pain. Seek qualified professional help for injury, pain, or rehabilitation.

## Technical notes

The MediaPipe Pose Landmarker runs in a dedicated worker using the pinned Full model and same-origin Wasm assets. The pure domain engine owns normalization, confidence gating, smoothing, calibration, geometry, movement phases, deterministic feedback, and summaries; React only presents snapshots.

See [docs/architecture.md](docs/architecture.md), [docs/licensing.md](docs/licensing.md), and [tasks/plan.md](tasks/plan.md).
