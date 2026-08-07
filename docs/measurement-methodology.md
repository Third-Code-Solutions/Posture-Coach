# Measurement methodology

Registry version: `2026-08-08.1`

Third Code Posture separates three things that are easy to confuse:

1. Pose landmarks are model observations.
2. Measurement rules are deterministic product heuristics or operational capture gates.
3. Evidence guidance explains what a user may try and where camera coaching must stop.

None of these layers diagnoses a condition or turns a 2D camera value into a clinical cutoff.

## Source of truth

`src/domain/measurement-registry/index.ts` owns every numeric value used by confidence, calibration, view estimation, adaptive local inference, sustained posture cues, exercise range, alignment, and rep timing. The same module publishes 29 user-facing capture and coaching decision rules. Each rule contains:

- stable ID;
- optional affected issue codes plus applicable modes;
- supported camera views;
- named metric and unit;
- fixed, range, compound, or adaptive value;
- persistence window;
- operational or product-heuristic provenance;
- validation status;
- rationale, limitation, and revision history.

The evaluator imports these values. The Posture Guide and threshold-driven pauses, corrective cues, and rep decisions render exact IDs from the same registry. This prevents documentation from silently drifting away from production behavior.

Presentation-only sizes, colors, line widths, and UI refresh cadence are interface tokens, not posture decision thresholds, and are outside this registry.

## Adaptive local inference

Live sessions start with a `720px` longest-edge input budget while preserving the uncropped preview. Sustained capture-to-result latency can step preprocessing down to `576px` and then `480px`; a long fast run recovers one profile at a time. Cooldown and consecutive-sample requirements prevent one slow warm-up frame or brief interruption from changing quality. Recreating the inference worker clears incomplete sample streaks without silently raising or lowering the active profile. This changes local preprocessing size only: it never swaps out the Full pose model, weakens confidence gates, crops the body, or sends frames elsewhere.

## Calibration

Calibration stores a short, view-specific visual baseline. It does not learn a medically correct pose. Adaptive movement rules compare later frames with the baseline and clamp the result to conservative product ranges. Coaching pauses when view, framing, landmarks, geometry, or calibration becomes unreliable.

## Persistence

Single frames do not become posture findings. Standing cues require `650ms`, standard cues require `900ms`, and the prolonged desk-position cue requires `15s`. Exercise alignment must persist for `450ms` before invalidating a repetition; counting also requires `250ms` phase dwell and `550ms` cooldown. These are unvalidated product settings intended to reduce transient landmark noise.

## Change control

Any threshold change must:

1. change the registry value instead of adding a literal inside an evaluator;
2. add a new revision-history entry and bump `MEASUREMENT_REGISTRY_VERSION`;
3. state whether the change is operational, heuristic, or externally validated;
4. update deterministic boundary tests;
5. run unit, domain, browser, mobile-width, camera, and production smoke gates;
6. avoid stronger health, safety, or accuracy language unless validation evidence directly supports it.

External validation would require a declared population, protocol, reference system, device matrix, predefined error metrics, and published results. Until then, every coaching cutpoint remains visibly labeled `unvalidated`.
