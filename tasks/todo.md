# AI Body Posture Coach — Execution Checklist

Status legend: `[ ]` pending, `[~]` active, `[x]` complete, `[!]` blocked. Only Sol changes package status after inspecting the handoff and evidence.

## Integrated implementation snapshot — 2026-08-04

- [x] Browser-local Next.js/TypeScript MVP integrated under `app/`, `components/`, `src/domain/`, and `src/vision/`.
- [x] Pinned local Pose Landmarker Full model and package-compatible Wasm assets recorded in `docs/licensing.md`.
- [x] Desk, squat, plank, push-up, lunge, and curl modes with view guidance, calibration, confidence gates, deterministic feedback, abstention, overlay, reps, and aggregate in-memory summaries.
- [x] `pnpm check`: format, ESLint, TypeScript, and 42 unit/domain/vision tests passed.
- [x] `pnpm audit --audit-level high`: no known vulnerabilities after updating Next, serve, sharp, and the pnpm PostCSS override.
- [x] `pnpm build`: static production export passed.
- [x] `pnpm test:e2e`: 10/10 Chromium scenarios passed, including fake webcam inference, permission denial/no-device fallback, invalid upload, unsupported and mismatched views, local still-image inference with overlay, calibrated local upload summary, responsive widths, and same-origin/blob-only request assertions.
- [x] Vercel static-export settings and Railway Docker/healthcheck settings are present and locally auditable; no provider deployment was performed.
- [x] `pnpm hosting:check`: fresh static build plus local Railway-style `PORT`, health, asset MIME, 404, and method checks passed.
- [x] Exercise evaluator follow-up: lunge requires split stance/front-leg lead; curl accepts full flexion and checks elbow flare; valid/rejected lunge, curl, and push-up cycles are covered by deterministic domain tests; rejection reasons are included in summaries.
- [~] Railway Docker image build is environment-blocked by the host: Docker reports `HCS_E_HYPERV_NOT_INSTALLED`, `HypervisorPresent=False`, and `VirtualizationFirmwareEnabled=False`; the exported runtime server itself passes `PORT`, `/healthz`, root, model, icon, and 404 checks.
- [x] No commit, push, deploy, account, backend, analytics, paid AI call, or frame upload performed.
- [~] Physical webcam, assistive-technology audit, and memory-trend profiling remain environment-specific follow-up evidence; a 60-second local upload completed with a summary, no external requests, and released media source, while automated fake-media coverage is green.
- [~] Session lifecycle remains in the React client adapter; a separate framework-independent controller extraction is deferred and documented in `tasks/plan.md`.

## Gate 0 — Planning and authorization

- [x] Read root `AGENTS.md` and master build prompt.
- [x] Inspect workspace, hidden orchestration files, Git state, runtime, package managers, and installed tools.
- [x] Verify current official MediaPipe Pose Landmarker Web constraints.
- [x] Freeze architecture, dependency graph, ownership, acceptance criteria, validation, privacy, and safety gates in `tasks/plan.md`.
- [x] Sol approval recorded for local implementation only.
- [ ] User changes or revokes scope before dispatch, if desired.

## Phase 1 — Foundation and fail-fast proof

### LUN-01 — Toolchain and quality scaffold

Owner: Luna. Dependencies: Gate 0. Scope: root config files only.

- [ ] Pin Next.js, React, TypeScript, Tailwind, Vitest, Playwright, formatting/lint, and `@mediapipe/tasks-vision` dependencies.
- [ ] Add frozen lockfile and scripts for all required gates.
- [ ] Configure static-export intent and client-safe worker/assets.
- [ ] Produce dependency/license inventory; no analytics/backend/CDN.
- [ ] Verify install, format, lint, typecheck, tests, and build; hand off exact results.

### TER-01 — Pure domain contracts and fixtures

Owner: Terra. Dependencies: LUN-01. Scope: `src/domain/contracts/**`, `src/domain/index.ts`, `tests/domain/fixtures/**`, `tests/domain/contracts.test.ts`.

- [ ] Define typed landmarks, observations, confidence/abstention, calibration, phases, issues, feedback, and summaries.
- [ ] Encode `valid`, `insufficient_evidence`, and `unsupported_view` outcomes.
- [ ] Add immutable fixtures: correct, incorrect, boundary, missing, low-confidence, mirrored, noisy, transition, invalid rep, priority, calibration reset.
- [ ] Prove domain contracts have no React/DOM/browser/MediaPipe imports.
- [ ] Run typecheck/tests and hand off exact results.

### TER-02 — MediaPipe worker feasibility and pinned assets

Owner: Terra. Dependencies: LUN-01. Scope: `src/vision/worker/**`, `src/vision/mediapipe/**`, `public/models/**`, `public/wasm/**`, assigned test.

- [ ] Pin and self-host package-compatible Wasm plus official Pose Landmarker Full model.
- [ ] Record source, exact version, SHA-256, and license/provenance evidence.
- [ ] Initialize Pose Landmarker in a dedicated worker using Web `VIDEO` mode.
- [ ] Prove transferable-frame inference, monotonic timestamps, one-in-flight backpressure, typed errors, and disposal.
- [ ] Run unit and real-browser smoke; capture console/network evidence.
- [ ] If worker proof fails, mark `[!]`, stop, and return evidence to Sol. No silent main-thread fallback.

### LUN-02 — Static app shell and design system

Owner: Luna. Dependencies: LUN-01. Scope: `app/**`, `styles/**`, `components/shell/**`.

- [ ] Build semantic static shell, mode framing, metadata, tokens, and boundaries.
- [ ] Add concise local-processing and non-medical disclaimer content.
- [ ] Verify focus, contrast, reduced motion, and no overflow at 320/768/1024/1440.
- [ ] Run UI/accessibility checks and hand off screenshots/results.

### Checkpoint A — Foundation

- [ ] Sol inspects all Phase 1 diffs and handoffs.
- [ ] No ownership overlap or out-of-scope edits.
- [ ] Worker feasibility, asset provenance/license, and clean build are green.
- [ ] Domain contract is frozen for dependent packages.

## Phase 2 — Evidence pipeline and input lifecycle

### TER-03 — Normalization, confidence, and geometry

Owner: Terra. Dependencies: TER-01. Scope: assigned domain subdirectories/tests only.

- [ ] Normalize image/world landmarks without changing anatomical left/right.
- [ ] Implement mode/view-specific presence and visibility gates.
- [ ] Add guarded 2D/3D geometry with explicit unavailable outcomes.
- [ ] Pass mirror, boundary, missing, low-confidence, and degenerate tests.

### TER-04 — Temporal smoothing and calibration

Owner: Terra. Dependencies: TER-01. May parallelize with TER-03 using disjoint files.

- [ ] Add timestamp-aware bounded smoothing and persistence/hysteresis primitives.
- [ ] Add stable-window calibration and view/orientation validation.
- [ ] Reset on source/mode/mirror/material orientation changes.
- [ ] Pass fake-clock, noisy-sequence, gap, stale, and reset tests.

### TER-05 — Camera, upload, and session controller

Owner: Terra. Dependencies: TER-02. Scope: `src/vision/input/**`, `src/vision/session/**`, `src/vision/index.ts`, assigned test.

- [ ] Explicit-action camera start and typed permission/device errors.
- [ ] Local browser-decodable upload and clear unsupported/invalid errors.
- [ ] Bounded frame scheduler; no duplicate video time; stale result cancellation.
- [ ] Stop tracks; cancel callbacks; dispose worker/frames; revoke object URLs on all exits.
- [ ] Unit-test mocked APIs; reserve real camera/upload proof for browser gate.

### LUN-03 — Source, mode, and calibration controls

Owner: Luna. Dependencies: TER-01 and LUN-02. Scope: assigned controls/calibration/hook/tests only.

- [ ] Expose webcam/upload, desk, squat, plank, push-up, lunge, and curl controls.
- [ ] Add explicit mirror/view guidance and calibration progress/reset.
- [ ] Render distinct denied/no-device/unsupported/worker/low-confidence states.
- [ ] Verify keyboard/screen-reader behavior and cautious uncertainty copy.

### Checkpoint B — Input and evidence

- [ ] Sol verifies controller lifecycle against worker protocol and frozen contracts.
- [ ] No user media/evidence network egress in browser capture.
- [ ] Low confidence, wrong view, and unresolved mirror abstain end-to-end.
- [ ] Start/stop/source/mode loops leave no live tracks, callbacks, object URLs, or stale updates.

## Phase 3 — Deterministic coaching engine

### TER-06 — Desk evaluator

Owner: Terra. Dependencies: TER-03 and TER-04.

- [ ] Head-forward, neck, shoulder, torso, prolonged slouch, and unreliable-evidence paths implemented.
- [ ] Required landmarks and supported camera views declared per metric.
- [ ] Persistence and cautious deterministic feedback token per issue.
- [ ] Correct/incorrect/boundary/occlusion/view mismatch/prolonged tests pass.

### TER-07 — Shared exercise movement state machines

Owner: Terra. Dependencies: TER-03 and TER-04.

- [ ] Phase hysteresis, dwell, completion, confidence interruption, candidate, reject/accept, cooldown, reset.
- [ ] No double counts under jitter/repeated frames.
- [ ] No guessed phase under low confidence.
- [ ] Transition/noisy/partial/invalid sequence tests pass.

### TER-08 — Five exercise evaluators

Owner: Terra. Dependencies: TER-07.

- [ ] Squat evaluator and tests.
- [ ] Plank evaluator and tests.
- [ ] Push-up evaluator and tests.
- [ ] Lunge evaluator and tests.
- [ ] Bicep-curl evaluator and tests.
- [ ] Expected view, required joints, calibration, phases, valid criteria, persistent issues, rejection reasons documented in code contracts.
- [ ] Cross-mode reset/isolation tests pass.

### TER-09 — Feedback priority and session metrics

Owner: Terra. Dependencies: TER-06 and TER-08.

- [ ] Deterministic one-cue resolver with tie, persistence, and cooldown rules.
- [ ] Insufficient evidence/positioning outranks form advice.
- [ ] Aggregate valid duration, evidence coverage, issue duration, valid/rejected reps, reasons.
- [ ] Exclude invalid evidence time; bounded memory; reset tests pass.

### Checkpoint C — Engine

- [ ] Sol reviews thresholds/rationale, state diagrams, issue/rejection codes, and test evidence.
- [ ] No one-frame warning or universal clinical/safety claim.
- [ ] Domain remains pure, deterministic, confidence-aware, and React/browser-free.
- [ ] All required fixture classes pass.

## Phase 4 — Presentation and full workflows

### LUN-04 — Live workspace and overlay

Owner: Luna. Dependencies: TER-05, TER-09, LUN-03.

- [ ] Connect controller snapshots without moving policy into React.
- [ ] Render aligned confidence-aware skeleton and positioning guides.
- [ ] Apply mirror only during presentation.
- [ ] Expose text-equivalent state/cue/phase/count.
- [ ] Verify resize, DPR, aspect ratio, cleanup, and fixture screenshots.

### LUN-05 — Safety, summary, and responsive polish

Owner: Luna. Dependencies: LUN-04.

- [ ] Show one prioritized cue and evidence-aware summary.
- [ ] Add privacy details and qualified-professional guidance.
- [ ] Scan for diagnosis, clinical-accuracy, injury-prevention, and guarantee language.
- [ ] Verify 320/768/1024/1440, keyboard, contrast, reduced motion, and no overflow.

### LUN-06 — Browser workflows and documentation

Owner: Luna. Dependencies: LUN-05.

- [ ] E2E shell and all-mode selection.
- [ ] Fake-media camera granted/denied/no-device flows.
- [ ] Uploaded-video success plus invalid/unsupported file flow.
- [ ] Calibration, low-confidence abstention, overlay, summary/reset, and console checks.
- [ ] Complete run/test/privacy/safety/limitations/troubleshooting docs.
- [ ] Label mocked evidence separately from real hardware evidence.

### Checkpoint D — Release candidate

- [ ] Sol inspects all Phase 4 diffs and handoffs.
- [ ] Clean install and all scripted gates pass.
- [ ] Production/static build is served and smoke-tested.
- [ ] No unexpected console errors or network egress.

## Phase 5 — Sol validation and fresh review

### SOL-01 — Full validation

- [ ] Record OS, Node, pnpm, browser, model/package versions, model/Wasm hashes, and test hardware.
- [ ] Formatting passes.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Unit/domain tests pass.
- [ ] Production build passes.
- [ ] Browser smoke passes against production output.
- [ ] Automated fake camera granted/denied/no-camera checks pass.
- [ ] Real camera permission/start/analyze/stop check passes, or remains explicitly blocked.
- [ ] Uploaded-video flow passes in a real browser.
- [ ] Responsive checks pass at 320/768/1024/1440.
- [ ] Keyboard/accessibility/reduced-motion checks pass.
- [ ] Console inspection is clean.
- [ ] Network capture proves no frame/video/landmark/session egress.
- [~] 60-second local upload completion is recorded; physical-camera performance and detailed p50/p95/memory metrics remain environment-specific.
- [ ] Repeated cleanup cycles show bounded memory and released resources.
- [ ] Reviewer packet prepared with exact diff and evidence.

### REVIEW-01 — Fresh Sol review

- [ ] Fresh read-only reviewer receives requirements, architecture summary, changed files, diff, and validation only.
- [ ] Reviewer reports P0-P3 with exact file/symbol citations.
- [ ] P0/P1 findings routed to original Luna/Terra owner.
- [ ] Affected and full gates rerun after fixes.
- [ ] Second fresh review completed if any P0/P1 was fixed.
- [ ] No unresolved P0/P1 remains.

## Final definition of done

- [ ] Local app, webcam, upload, skeleton, desk mode, and five exercise modes verified.
- [ ] Calibration, confidence gates, deterministic feedback, valid/rejected reps, and summaries verified.
- [ ] Privacy/safety copy and runtime behavior verified.
- [ ] Documentation complete and accurate.
- [ ] All required gates green with exact recorded evidence.
- [ ] No unresolved P0/P1 review finding.
- [ ] No commit, push, deploy, purchase, or destructive action performed without separate explicit authorization.

## Implementation authorization

- [x] **Sol approval: implementation may begin locally with LUN-01 and follow the dependency graph in `tasks/plan.md`.**
- [x] Approval excludes commit, push, deploy, external data transfer, backend/analytics additions, purchases, and destructive operations.
