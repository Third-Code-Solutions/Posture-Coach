# Offline posture evidence cache

Reviewed: 2026-08-07
Cache version: `2026-08-07`

## Purpose

The coach has no API key, backend, model call, or runtime research request. The app ships a small, versioned evidence registry in `src/knowledge/posture-evidence.ts`. It contains paraphrased claims, practical actions, limits, and source URLs. The browser resolves the current deterministic cue to that local registry and shows the relevant research basis in the feedback card. The offline Posture Guide also exposes the same registry through local category filters and full-text search, so users can learn without granting camera access.

The cache deliberately stores summaries and links, not copied articles. Sources remain the authority. A future refresh must re-check every URL and update the cache version before changing a claim.

## Evidence rules

- No single “perfect posture” is presented as a medical truth. OSHA describes neutral posture as a comfortable alignment and explicitly says there is no single workstation posture that fits everyone.
- A visible pose is an observation, not a diagnosis. The app does not diagnose forward-head posture, rounded shoulders, lordosis, kyphosis, scoliosis, pain, injury, or disability.
- Posture and pain are not treated as a simple cause-and-effect relationship. A systematic review of systematic reviews found no consensus on causality between spine posture or physical exposure and low back pain.
- Duration and task design matter. NIOSH distinguishes neutral, awkward, and static postures and recommends changing exposure, equipment, tasks, or breaks where appropriate.
- Exercise cues are individualized movement heuristics. Depth, tempo, body line, knee tracking, and elbow control are not universal clinical targets.
- Every live issue declares measurement status separately from health guidance. Current detector thresholds are labeled unvalidated product heuristics; framing checks are operational only.
- Insufficient landmarks, unsupported views, calibration drift, and unstable tracking suppress form advice. The app must abstain rather than fill gaps with a research-sounding guess.
- Stop with pain. Persistent pain, weakness, numbness, progressive asymmetry, breathing difficulty, a new deformity, or a known condition needs qualified in-person assessment.

## Cached posture topics

The registry covers the posture patterns users commonly mean by “bad posture,” plus the exercise-specific movement cues supported by the current camera modes:

| Topic                                                         | What the app can do                                                  | What it must not claim                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Neutral, upright, declined, or reclined sitting               | Explain comfortable support and position variation                   | One universal angle is correct                             |
| Symptom escalation                                            | Show stop, urgent-care, and emergency boundaries                     | Diagnose or triage the cause                               |
| Calibration and confidence                                    | Explain personal baseline, visibility, and heuristic thresholds      | Treat confidence as health or medical clearance            |
| Single-camera measurement                                     | Explain view, occlusion, 2D projection, and validation limits        | Claim whole-body 3D or clinical accuracy                   |
| Static or prolonged posture                                   | Prompt a position change during a visible session                    | Infer the user’s full-day exposure                         |
| Desk and laptop setup                                         | Explain support, reach, display, and position-change options         | Certify that furniture fits the user                       |
| Forward-head tendency                                         | Cue a gentle head-over-ribs adjustment in side view                  | Diagnose neck pathology or prove pain causality            |
| Neck inclination / screen bend                                | Suggest raising the screen and changing position                     | Measure the screen, gaze, or symptoms                      |
| Rounded shoulders / thoracic rounding                         | Provide general movement and strength context                        | Diagnose scapular dysfunction or structural hyperkyphosis  |
| Slouching / torso collapse                                    | Cue supported, comfortable trunk alignment                           | Measure lumbar curvature or prescribe a rigid sitting pose |
| Anterior/posterior pelvic tilt, lordosis, swayback, flat back | Explain why the camera abstains from labels                          | Diagnose a lumbar curve from 2D landmarks                  |
| Uneven shoulders/hips / lateral lean                          | Ask for a level camera, relaxed stance, and assessment if persistent | Screen for or diagnose scoliosis                           |
| Kyphosis                                                      | Explain the structural-condition boundary                            | Correct a spinal curve with a camera cue                   |
| Scoliosis                                                     | Explain why clinical examination and imaging may be needed           | Calculate a Cobb angle or prescribe treatment              |
| Rotation / twisting                                           | Encourage task setup and position changes                            | Infer 3D spinal rotation reliably                          |
| Squat depth                                                   | Encourage a controlled, individualized range                         | Require a universal depth                                  |
| Squat/lunge knee tracking                                     | Cue a stable 2D knee-to-foot path                                    | Predict injury or measure 3D knee loading                  |
| Plank/push-up body line                                       | Cue repeatable line and load scaling                                 | Certify rehabilitation readiness                           |
| Push-up depth                                                 | Encourage an adapted range and controlled tempo                      | Impose a universal elbow angle                             |
| Lunge stance/control                                          | Cue a balanced split stance and controlled range                     | Infer joint loading or injury status                       |
| Curl control                                                  | Cue a steady elbow and controlled movement                           | Measure muscle activation or prescribe a rehab plan        |

## Source register

The machine-readable registry is the source of truth for the UI. Each source is a direct government, clinical-guidance, clinical-reference, PubMed, or peer-reviewed journal link.

| ID                                | Source                                                                                                                         | Type                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `osha-workstation`                | [OSHA Computer Workstations](https://www.osha.gov/etools/computer-workstations)                                                | Government guidance             |
| `osha-positions`                  | [OSHA Good Working Positions](https://www.osha.gov/etools/computer-workstations/positions)                                     | Government guidance             |
| `osha-evaluation`                 | [OSHA Evaluation Checklist](https://www.osha.gov/etools/computer-workstations/checklists/evaluation)                           | Government guidance             |
| `niosh-ergonomics`                | [CDC/NIOSH About Ergonomics](https://www.cdc.gov/niosh/ergonomics/about/index.html)                                            | Government guidance             |
| `niosh-risk-factors`              | [CDC/NIOSH Risk Factors](https://www.cdc.gov/niosh/ergonomics/ergo-programs/risk-factors.html)                                 | Government guidance             |
| `niosh-office`                    | [CDC/NIOSH Office Environments](https://www.cdc.gov/niosh/office-environment/about/)                                           | Government guidance             |
| `who-activity`                    | [WHO Physical Activity and Sedentary Behaviour](https://www.who.int/publications/i/item/9789240014886)                         | Global guideline                |
| `cdc-adult-activity`              | [CDC Adult Activity Guidelines](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html)                           | Government guidance             |
| `nice-low-back`                   | [NICE Low Back Pain and Sciatica Recommendations](https://www.nice.org.uk/guidance/NG59/chapter/Recommendations)               | Clinical guidance               |
| `cuh-seating`                     | [Cambridge University Hospitals Seating and Ergonomics](https://www.cuh.nhs.uk/patient-information/seating-and-ergonomics/)    | Clinical guidance               |
| `nhs-neck-pain`                   | [NHS Neck Pain](https://www.nhs.uk/symptoms/neck-pain-and-stiff-neck/)                                                         | Clinical guidance               |
| `nhs-back-pain`                   | [NHS Back Pain](https://www.nhs.uk/conditions/back-pain/)                                                                      | Clinical guidance               |
| `medlineplus-kyphosis`            | [MedlinePlus Kyphosis](https://medlineplus.gov/ency/article/001240.htm)                                                        | Clinical reference              |
| `medlineplus-scoliosis`           | [MedlinePlus Scoliosis](https://medlineplus.gov/ency/article/001241.htm)                                                       | Clinical reference              |
| `posture-low-back-causality`      | [PubMed: No consensus on posture and low-back-pain causality](https://pubmed.ncbi.nlm.nih.gov/31451200/)                       | Systematic review of reviews    |
| `posture-low-back-scoping`        | [PubMed: Sitting time, posture, and office-worker low back pain](https://pubmed.ncbi.nlm.nih.gov/40111906/)                    | Scoping review                  |
| `forward-head-exercise`           | [PubMed: Therapeutic exercise for forward-head posture](https://pubmed.ncbi.nlm.nih.gov/30107937/)                             | Systematic review/meta-analysis |
| `forward-head-rounded-shoulder`   | [PubMed: Exercise for forward-head, rounded-shoulder, and hyperkyphosis measures](https://pubmed.ncbi.nlm.nih.gov/38302926/)   | Systematic review/meta-analysis |
| `knee-valgus-exercise`            | [PubMed: Exercise interventions and dynamic knee valgus](https://pubmed.ncbi.nlm.nih.gov/34268014/)                            | Systematic review               |
| `pushup-load`                     | [PubMed: Load supported during push-up variants](https://pubmed.ncbi.nlm.nih.gov/20179649/)                                    | Biomechanics study              |
| `pushup-kinetics`                 | [PubMed: Kinetic analysis of push-up exercises](https://pubmed.ncbi.nlm.nih.gov/30284496/)                                     | Systematic review               |
| `lunge-biomechanics`              | [PubMed: Kinematics and kinetics of common lower-limb exercises](https://pubmed.ncbi.nlm.nih.gov/26418958/)                    | Biomechanics study              |
| `single-camera-markerless-review` | [PubMed: Healthcare applications of single-camera markerless motion capture](https://pubmed.ncbi.nlm.nih.gov/35642200/)        | Scoping review                  |
| `markerless-dynamic-validation`   | [PubMed: Validity and usability of markerless motion capture for dynamic movements](https://pubmed.ncbi.nlm.nih.gov/39733226/) | Validation study                |

## Maintenance gate

Before changing posture feedback, add or update a cache entry, attach its source IDs to the issue mapping, run `tests/knowledge/posture-evidence.test.ts`, and re-check the linked source. Do not add a new clinical label just because a pose landmark looks similar to a textbook image.
