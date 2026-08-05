# Deployment readiness

Form / Local is a browser-local static export. The deployed site runs the same client bundle as the local production export; it does not need a runtime API.

## Vercel frontend

Use the repository root as the project root. [`vercel.json`](../vercel.json) pins the expected settings:

- install: `pnpm install --frozen-lockfile`
- build: `pnpm build`
- output: `out`
- framework: Next.js static export

No environment variables are required for the MVP. The camera, uploaded video, uploaded image, MediaPipe worker, model, Wasm, overlay, and coaching state all run in the browser. Vercel should receive only the application source and build artifacts; user media is never sent to it.

## Railway static fallback

Railway uses the root [`Dockerfile`](../Dockerfile) and [`railway.json`](../railway.json). The image builds the static export, then runs [`scripts/static-server.mjs`](../scripts/static-server.mjs). The server:

- binds `0.0.0.0:${PORT}` and defaults to port `3000` locally;
- serves `/`, `/_next/*`, `/models/*`, and `/wasm/*` from `out/`;
- returns `200 ok` from `GET /healthz`;
- supports `GET` and `HEAD` only for static content;
- returns a static `404.html` for missing routes;
- does not persist requests, media, landmarks, or session data.

Local container proof:

```powershell
docker build -t posture-coach:local .
docker run --rm --name posture-coach-hosting-check -p 3012:3000 posture-coach:local
```

With the container running:

```powershell
Invoke-WebRequest http://127.0.0.1:3012/healthz
Invoke-WebRequest http://127.0.0.1:3012/ -UseBasicParsing
```

Then run the browser smoke against the container or inspect the app at `http://127.0.0.1:3012/`. Stop only the named local check container after validation:

```powershell
docker stop posture-coach-hosting-check
```

## Release gates

Before an authorized provider deployment, run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm hosting:check
pnpm test:e2e
docker build -t posture-coach:local .
```

`pnpm hosting:check` starts the same static server used by the Railway container on a temporary local port and verifies `PORT`, `/healthz`, the root app, model/Wasm MIME types, missing-route handling, and unsupported methods. It does not contact Vercel or Railway.

If `docker build` reports `HCS_E_HYPERV_NOT_INSTALLED`, enable CPU virtualization in firmware and the Windows Virtual Machine Platform/WSL2 components, reboot, then start Docker Desktop's Linux engine. The project does not change BIOS or Windows virtualization settings.

Also verify the deployed origin in a real browser: model and Wasm requests are same-origin, no camera/video/image/frame/landmark/session request leaves the browser, image upload shows a landmark overlay, denied-camera fallback remains actionable, and `/healthz` is `200` on Railway.

No deployment, provider login, project linking, commit, or push was performed during this readiness pass.
