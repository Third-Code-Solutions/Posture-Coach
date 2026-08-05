# Posture Coach Engineering Rules

## Mission

Build a privacy-first, browser-local posture coaching MVP. The product is educational guidance, not a medical device. No account, backend, paid AI API, frame upload, or frame retention is required for the MVP.

## Non-negotiables

- Keep camera and uploaded-video processing in the browser by default.
- Never diagnose, promise clinical accuracy, or claim injury prevention. Use "possible form issue" and "try adjusting" language.
- Stop authoritative evaluation when landmarks are missing, occluded, mirrored incorrectly, or below the configured confidence threshold.
- Show a visible disclaimer and recommend a qualified professional for pain, injury, or rehabilitation.
- Keep the posture engine independent from React and deterministic/auditable.
- Preserve unrelated user changes. Do not commit, push, deploy, purchase services, or run destructive commands unless explicitly requested.
- Do not claim camera, video, performance, or browser behavior without running and recording the relevant check.

## Architecture boundaries

Keep these layers separate:

1. camera/video input
2. MediaPipe Pose Landmarker adapter
3. landmark normalization and mirroring
4. confidence gating and temporal smoothing
5. calibration
6. geometry utilities
7. movement state machines
8. desk/exercise evaluators
9. feedback prioritization
10. session metrics
11. React presentation

Domain code must not import React, browser globals, or UI components. MediaPipe/browser adapters must not own evaluation policy. Feedback must be deterministic and confidence-aware.

## Agent ownership

- `sol_orchestrator`: requirements, architecture, acceptance criteria, integration, final validation.
- `luna_implementer`: scaffolding, configuration, UI, responsive styling, types/constants, docs, simple tests.
- `terra_implementer`: MediaPipe adapter, camera/video processing, normalization, confidence/smoothing, geometry, state machines, evaluators, performance, complex tests.
- `sol_reviewer`: fresh read-only review; reports P0-P3 findings with exact file/symbol citations.

Every handoff must list completed work, changed files, decisions, commands/results, and remaining risks. No overlapping write scopes.

## Required quality gates

Run formatting, lint, typecheck, unit/domain tests, production build, browser smoke, camera-permission/no-camera fallback, uploaded-video flow, responsive checks at 320/768/1024/1440, console-error inspection, and a performance sanity check. Separate automated checks from real browser/runtime evidence.

## Definition of done

The app runs locally; camera and uploaded-video analysis work; skeleton overlay renders; desk mode and all five exercises are available; calibration, confidence gating, deterministic feedback, privacy/safety copy, docs, tests, build, and critical browser flows are verified. Do not declare complete with unresolved P0/P1 review findings.
