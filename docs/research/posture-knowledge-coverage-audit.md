# Posture knowledge coverage audit

Reviewed: 2026-08-07
Scope: research-only audit of the current browser-local knowledge library, evaluator issue/feedback mappings, and existing posture research notes.
Change boundary: this note is the only file intentionally added by this audit. No application code, test, configuration, or other documentation was changed.

> Fixed-point snapshot: counts and “current” findings below describe commit `69172539ec4e1db77b3ec9fd62b72680047ee377` plus the first 19-topic library draft inspected during the audit. Follow-up implementation on 2026-08-07 expanded the live registry to 30 topics and 28 sources, populated the desk category, added global safety/calibration/camera-limit education and mode-specific exercise primers, remapped `positioning`, and exposed unvalidated heuristic status. The source registry and tests are authoritative for current behavior; unresolved recommendations remain valid future work.

## Evidence labels

- **OBSERVED** - directly present in the current repository or returned by the URL checks performed for this audit.
- **INFERRED** - a product or evidence-fit conclusion derived from observed code and cited evidence.
- **UNKNOWN** - not established by the repository, source review, or product-specific validation.
- **PROPOSED** - recommended future knowledge, product, validation, or safety work; not current behavior.

## Executive findings

1. **OBSERVED:** the local registry contains **19 user-facing topics**, and the current searchable `PostureLibrary` exposes all 19. The evaluator defines **16 `IssueCode` values**. Every issue code has a non-empty `ISSUE_EVIDENCE_IDS` entry, so there is no mechanically unmapped issue.
2. **INFERRED:** non-empty is not the same as evidence-fit. The current test proves referential completeness only. It does not prove that a source supports the detector, numeric cutpoint, persistence window, label, or correction attached to an issue.
3. **OBSERVED:** none of the exact detector thresholds or persistence windows in the evaluator has source/provenance metadata. Examples include desk shoulder tilt `0.07`, head offset `0.12`, neck inclination `18`, torso inclination `14`/`20`, standing drift thresholds, exercise thresholds, 650/900 ms persistence, and the 15-second `prolonged_slouch` gate.
4. **INFERRED:** all numeric cutpoints must therefore be presented as product heuristics unless and until this exact camera/model/evaluator is validated against a declared reference method. A VICON comparison of another posture app found significant bias in most tested frontal and sagittal measurements, while broader markerless validation shows accuracy varies by system, plane, movement, and variable. [Hopkins et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31000345/), [Edwards et al., 2025](https://pubmed.ncbi.nlm.nih.gov/39733226/)
5. **OBSERVED:** the knowledge type system has a `desk` category and the UI offers a "Desk setup" filter, but no current topic uses that category.
6. **PROPOSED:** the highest-priority additions are a dedicated safety/escalation module, a real desk/workstation module, a camera-measurement limitations module, mode-specific exercise primers, population/adaptation boundaries, and balance/fall and lifting boundaries.

## Audit method and authority

**OBSERVED:** repository inspection covered:

- `src/knowledge/posture-evidence.ts`
- `src/domain/contracts/index.ts`
- `src/domain/evaluators/engine.ts`
- `components/feedback/FeedbackCard.tsx`
- `components/knowledge/PostureLibrary.tsx`
- `components/coach/CoachApp.tsx`
- `tests/knowledge/posture-evidence.test.ts`
- `docs/posture-evidence.md`
- `docs/research/standing-posture-evidence.md`
- `docs/research/cross-device-camera-evidence.md`

**OBSERVED:** external evidence was limited to government health/ergonomics guidance, official clinical guidance, and PubMed-indexed systematic reviews or validation studies. Current registry sources were examined to determine what they actually support; source presence was not treated as automatic endorsement of the app's implementation.

**OBSERVED:** all 25 current source URLs were checked on 2026-08-07. Nineteen returned HTTP 200 directly. Six official sites returned HTTP 403 to command-line retrieval but resolved through browser/search retrieval with current content. No current source returned 404 or 5xx. "Live" here means the cited resource still resolves; it does not mean every current product claim is valid.

## 1. Current user-facing posture coverage

**OBSERVED:** every registry topic is browseable locally, even when it is not connected to a live evaluator issue. The current topic set is:

| Registry topic                                              | Category      | Current user-facing role                         | Runtime relationship                                                                        |
| ----------------------------------------------------------- | ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `neutral-posture` - Neutral posture is a range              | General       | Explains comfortable, variable positioning       | Mapped to `positioning`, although that issue is camera setup rather than neutral posture    |
| `standing-alignment` - Relaxed standing alignment           | General       | Teaches a non-rigid standing reference           | Mapped to all three standing issues and the positive standing result                        |
| `static-posture` - Static or prolonged posture              | General       | Encourages position variation                    | Mapped to `prolonged_slouch` and the positive standing result                               |
| `forward-head` - Forward-head tendency                      | Head + neck   | Conditional side-view observation and gentle cue | Mapped to `head_forward` and `standing_head_alignment`                                      |
| `neck-flexion` - Neck inclination / screen bend             | Head + neck   | Screen-position and movement options             | Mapped to `neck_inclination`                                                                |
| `rounded-shoulders` - Rounded shoulders / thoracic rounding | Head + neck   | Education and diagnostic boundary                | Library only; no evaluator issue                                                            |
| `slouching` - Slouched sitting / torso collapse             | Trunk + spine | Supported sitting and position-change options    | Mapped to `torso_inclination` and `prolonged_slouch`                                        |
| `pelvic-tilt-and-lumbar-curve`                              | Trunk + spine | Explains why 2D labels are unsafe                | Library only; no evaluator issue                                                            |
| `lateral-asymmetry` - Uneven shoulders/hips/lateral lean    | Asymmetry     | Camera recheck and structural-condition boundary | Mapped to `shoulder_imbalance` and `standing_lateral_asymmetry`                             |
| `structural-kyphosis`                                       | Trunk + spine | Clinical boundary and referral language          | Library only; no evaluator issue                                                            |
| `structural-scoliosis`                                      | Asymmetry     | Clinical boundary and referral language          | Library only; no evaluator issue                                                            |
| `rotation-and-twist`                                        | Trunk + spine | Task-setup and exposure education                | Library only; no evaluator issue                                                            |
| `posture-pain-boundary`                                     | General       | Rejects simple posture-causes-pain claims        | Mapped to `standing_trunk_alignment`; also browseable independently                         |
| `movement-health` - Move more and sit less                  | General       | General public-health movement guidance          | Library only; no session-level movement plan                                                |
| `comfortable-range`                                         | Exercise      | Individualized range and scaling                 | Mapped to `squat_depth`, `pushup_depth`, and range-rejection feedback                       |
| `dynamic-knee-valgus`                                       | Exercise      | Cautious knee-tracking education                 | Mapped to `squat_knee_alignment`; lunge knee drift is folded into `lunge_alignment`         |
| `pushup-load-scaling`                                       | Exercise      | Push-up variation/load context                   | Mapped to `pushup_body_line` and `pushup_depth`                                             |
| `lunge-control`                                             | Exercise      | Split-stance and loading context                 | Mapped to the multi-purpose `lunge_alignment` code                                          |
| `controlled-exercise`                                       | Exercise      | Generic tempo/control heuristic                  | Mapped to `plank_alignment`, `curl_control`, rep completion, and some rejected-rep feedback |

**OBSERVED:** the topic families are broad enough to answer common search terms such as posture, neck, shoulders, slouch, spinal curves, asymmetry, squat, push-up, lunge, and curl. Official ergonomics sources support comfortable individualized workstations, component adjustment, relaxed positioning, and position changes. [OSHA Computer Workstations](https://www.osha.gov/etools/computer-workstations), [OSHA Good Working Positions](https://www.osha.gov/etools/computer-workstations/positions), [NIOSH risk factors](https://www.cdc.gov/niosh/ergonomics/ergo-programs/risk-factors.html)

**INFERRED:** breadth currently exceeds runtime assessment. Six topics are deliberately library-only: rounded shoulders, pelvic/lumbar curve labels, kyphosis, scoliosis, rotation/twist, and general movement health. Keeping structural diagnoses library-only is appropriate: clinical examination and sometimes imaging are required, and camera appearance alone is not diagnosis. [MedlinePlus kyphosis](https://medlineplus.gov/ency/article/001240.htm), [MedlinePlus scoliosis](https://medlineplus.gov/ency/article/001241.htm)

**UNKNOWN:** no repository evidence shows which library topics users open, understand, or act on. There is no user study of comprehension, fear reduction, or whether the current terminology causes users to interpret heuristics as medical judgments.

## 2. Evaluator issue-code evidence audit

### Cross-cutting finding

**OBSERVED:** all 16 codes map to at least one registry entry. `tests/knowledge/posture-evidence.test.ts` checks that each array is non-empty and resolves to known topic IDs.

**INFERRED:** the test cannot detect semantic mismatch. A proper mapping has at least three distinct evidence jobs:

1. **Health/education evidence** - supports the plain-language action or boundary.
2. **Measurement evidence** - validates that this camera/model/view/metric measures the intended construct.
3. **Threshold provenance** - explains whether a cutpoint is validated, calibrated to the user, or merely a product heuristic.

The current single `evidenceIds` array represents only the first job. The current standing research note already requires product validation against a declared reference and representative people/conditions before claiming clinical accuracy. A PubMed-indexed scoping review likewise found single-camera systems more capable for simple single-plane measurements than detailed 3D kinematics. [Healthcare applications of single-camera markerless motion capture](https://pubmed.ncbi.nlm.nih.gov/35642200/)

### Code-by-code fit

| `IssueCode`                  | Current mapping                               | Audit result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standing_head_alignment`    | `standing-alignment`, `forward-head`          | **PARTIAL.** Relaxed standing and cautious head-position education are relevant. Neither source validates the normalized `0.14` drift/offset thresholds for this app. The forward-head review evaluates therapeutic exercise in selected FHP populations, not automated detection or an immediate webcam correction. [Forward-head exercise review](https://pubmed.ncbi.nlm.nih.gov/30107937/)                                                                                                                                                          |
| `standing_trunk_alignment`   | `standing-alignment`, `posture-pain-boundary` | **WEAK/PARTIAL.** The pain boundary is useful safety context, but it does not validate body-lean detection, the `0.08` threshold, or the correction. Natural and directed standing differ substantially, supporting a relaxed personal baseline rather than a universal target. [Standing comparison study](https://pubmed.ncbi.nlm.nih.gov/31233893/)                                                                                                                                                                                                  |
| `standing_lateral_asymmetry` | `standing-alignment`, `lateral-asymmetry`     | **PARTIAL.** Camera-level recheck and non-diagnostic wording are appropriate. No source validates the `0.12` shoulder/hip drift threshold or distinguishes anatomy from camera roll, stance, clothing, or lens distortion.                                                                                                                                                                                                                                                                                                                              |
| `head_forward`               | `forward-head`                                | **PARTIAL.** Supports gentle exercise as one option and explicitly leaves the posture-pain relationship uncertain. It does not validate the `0.12` landmark ratio, the label for this model, or a one-step correction. [Forward-head exercise review](https://pubmed.ncbi.nlm.nih.gov/30107937/)                                                                                                                                                                                                                                                        |
| `neck_inclination`           | `neck-flexion`                                | **PARTIAL.** OSHA/NHS guidance supports monitor adjustment and avoiding one sustained neck position. It does not establish `18 degrees` as a clinical or ergonomic cutpoint, and the app cannot see the user's screen or gaze target. [OSHA workstation guidance](https://www.osha.gov/etools/computer-workstations), [NHS neck pain guidance](https://www.nhs.uk/symptoms/neck-pain-and-stiff-neck/)                                                                                                                                                   |
| `shoulder_imbalance`         | `lateral-asymmetry`                           | **WEAK.** The topic is chiefly a scoliosis/camera-artifact boundary. It does not substantiate `0.07`, prove that the shoulders should be leveled, or establish that the suggested correction is appropriate for a specific user.                                                                                                                                                                                                                                                                                                                        |
| `torso_inclination`          | `slouching`                                   | **PARTIAL.** Ergonomic guidance supports comfort, support, moving work closer, and changing position. It does not validate `14 degrees` or infer lumbar mechanics/pain from a shoulder-to-hip segment. [CUH seating and ergonomics](https://www.cuh.nhs.uk/patient-information/seating-and-ergonomics/), [posture/low-back-pain umbrella review](https://pubmed.ncbi.nlm.nih.gov/31451200/)                                                                                                                                                             |
| `prolonged_slouch`           | `static-posture`, `slouching`                 | **PARTIAL.** Duration and static exposure matter, but NIOSH emphasizes intensity, frequency, duration, task, and multiple risk factors. The app's 15-second gate is a feedback-debouncing heuristic, not evidence that 15 seconds is harmful. [NIOSH risk factors](https://www.cdc.gov/niosh/ergonomics/ergo-programs/risk-factors.html)                                                                                                                                                                                                                |
| `squat_depth`                | `comfortable-range`                           | **WEAK/MISMATCHED.** The topic cites NICE low-back-pain guidance plus push-up sources; it contains no squat-specific measurement or depth evidence. Individualized comfortable range is safe wording, but the squat cutpoint and cue are unsupported by the current mapping.                                                                                                                                                                                                                                                                            |
| `squat_knee_alignment`       | `dynamic-knee-valgus`                         | **PARTIAL.** The review reports that some multi-week exercise interventions reduced measured dynamic knee valgus. It does not validate this app's 2D hip-to-ankle midpoint metric, `0.12` threshold, injury prediction, or a universal "middle of the foot" rule. [Dynamic-knee-valgus review](https://pubmed.ncbi.nlm.nih.gov/34268014/)                                                                                                                                                                                                               |
| `plank_alignment`            | `controlled-exercise`                         | **MISSING EXERCISE-SPECIFIC FIT.** The mapped sources support general strengthening, individualized exercise, and cautious control. They do not validate a shoulder-hip-ankle line, the calibrated tolerance, or plank safety/quality.                                                                                                                                                                                                                                                                                                                  |
| `pushup_body_line`           | `pushup-load-scaling`                         | **PARTIAL.** Push-up sources support load differences across variants and summarize kinetics. They do not validate this pose model's body-line angle or tolerance as a quality, safety, or readiness threshold. [Push-up load study](https://pubmed.ncbi.nlm.nih.gov/20179649/), [push-up kinetics review](https://pubmed.ncbi.nlm.nih.gov/30284496/)                                                                                                                                                                                                   |
| `pushup_depth`               | `pushup-load-scaling`, `comfortable-range`    | **PARTIAL.** Scaling load/range for ability is supported. The elbow-angle threshold and counted-rep definition are product heuristics, not clinical targets. [Push-up kinetics review](https://pubmed.ncbi.nlm.nih.gov/30284496/)                                                                                                                                                                                                                                                                                                                       |
| `lunge_alignment`            | `lunge-control`                               | **WEAK.** One mapped descriptive laboratory study involved nine young men and compared forces, moments, and angles in single-leg squat/forward/reverse lunge. It does not validate split-stance separation, a 12-degree front/rear knee gap, 2D knee tracking, or the combined correction set. [Lunge biomechanics study](https://pubmed.ncbi.nlm.nih.gov/26418958/)                                                                                                                                                                                    |
| `curl_control`               | `controlled-exercise`                         | **MISSING EXERCISE-SPECIFIC FIT.** General activity and low-back-pain guidance do not support the elbow-flare metric, threshold, "close to ribs" cue, biceps-curl quality, or injury implications.                                                                                                                                                                                                                                                                                                                                                      |
| `positioning`                | `neutral-posture`                             | **MISMATCHED.** Comfortable posture guidance does not support camera view, full-body framing, distance, calibration, or landmark observability. This code needs measurement-method evidence, not neutral-posture evidence. NIOSH's observation-based posture-assessment material and product-specific camera validation belong in a separate technical evidence layer. [NIOSH observation-based posture assessment](https://www.cdc.gov/niosh/docs/2014-131/default.html), [single-camera markerless review](https://pubmed.ncbi.nlm.nih.gov/35642200/) |

### Feedback paths outside `IssueCode`

**OBSERVED:** issue feedback resolves `evidenceIdsForIssue(first.code)`. Rejected-rep messages map `phase_interrupted` and `alignment_not_stable` to `controlled-exercise`, and `range_not_reached` to `comfortable-range`. `rep-complete` maps to `controlled-exercise`; `standing-steady` maps to `standing-alignment` and `static-posture`.

**OBSERVED:** initial calibration, image status, framing drift, uncalibrated, insufficient evidence, and generic `Looking steady` feedback have no evidence IDs. Most are operational states rather than health claims.

**INFERRED:** operational feedback should not be forced into the health registry. It needs a separate capability/measurement explanation: required view, required landmarks, confidence/abstention behavior, calibration meaning, known model limits, and what a "steady" result does and does not establish.

**UNKNOWN:** no product-specific reference study establishes sensitivity, specificity, measurement error, false-cue rate, or abstention performance for any current issue code. Deterministic unit/fixture tests demonstrate implementation behavior, not clinical or biomechanical validity.

## 3. Important safe educational topics still missing

### P0 - safety and core usefulness

1. **PROPOSED - When to stop and seek care.** Add a dedicated, always-available safety topic covering worsening pain, sudden severe symptoms, trauma, fever/systemic illness, progressive shape change, bilateral leg weakness/numbness, saddle-area sensory loss, and bladder/bowel changes. The current library scatters generic "stop with pain" language but has no single triage entry. The NHS distinguishes routine, urgent, and emergency back-pain escalation; a local coach must not attempt to assess those conditions by camera. [NHS back pain](https://www.nhs.uk/conditions/back-pain/), [NICE NG59](https://www.nice.org.uk/guidance/ng59/chapter/recommendations)
2. **PROPOSED - What calibration and confidence mean.** Explain that calibration is a personal visual baseline, not a healthy/normal diagnosis; confidence is model visibility, not posture quality; and "no issue" means no supported persistent deviation was detected. The standing study supports relaxed rather than maximally upright calibration, while camera validation evidence requires method-specific caution. [Standing comparison study](https://pubmed.ncbi.nlm.nih.gov/31233893/), [mobile posture-app validation](https://pubmed.ncbi.nlm.nih.gov/31000345/)
3. **PROPOSED - Camera measurement limits and validation.** Add a user-readable topic covering 2D projection, view dependence, occlusion, camera roll/distance, model error, plane-specific performance, and the lack of product-specific clinical validation. A single-camera review found better performance in simple single-plane tasks than detailed 3D kinematics; a dynamic validation study found wide system/plane error variation. [Single-camera markerless review](https://pubmed.ncbi.nlm.nih.gov/35642200/), [dynamic markerless validation](https://pubmed.ncbi.nlm.nih.gov/39733226/)
4. **PROPOSED - Real desk setup.** Populate the currently empty `desk` category with separate topics for chair/back support, feet/footrest, monitor height/distance, keyboard/mouse reach, elbow/forearm support, laptop/phone limitations, lighting/glare, and task variation. OSHA explicitly treats these as adjustable components and states there is no single arrangement for everyone. [OSHA Computer Workstations](https://www.osha.gov/etools/computer-workstations), [OSHA Good Working Positions](https://www.osha.gov/etools/computer-workstations/positions), [OSHA Evaluation Checklist](https://www.osha.gov/etools/computer-workstations/checklists/evaluation)
5. **PROPOSED - Mode-specific exercise primers.** Add separate evidence and boundaries for squat, plank, push-up, lunge, and curl: setup, observable cue, easier variation, stop rule, unsupported claims, and source scope. Do not let one generic `controlled-exercise` entry authorize several unrelated metrics.

### P1 - completeness and inclusion

6. **PROPOSED - Exposure and movement planning.** Teach that static exposure, task demands, force, repetition, and duration interact; do not convert a short camera interval into a daily risk score. Offer optional, user-controlled movement prompts without claiming a universal medically necessary interval. [NIOSH risk factors](https://www.cdc.gov/niosh/ergonomics/ergo-programs/risk-factors.html), [NIOSH office environments](https://www.cdc.gov/niosh/office-environment/about/), [WHO physical activity and sedentary behaviour](https://www.who.int/publications/i/item/9789240014886)
7. **PROPOSED - Population and adaptation boundary.** State that age, pregnancy/postpartum status, disability, chronic conditions, recent injury/surgery, and individual capability can change appropriate activity. The app collects none of that information. WHO guidance explicitly covers population subgroups; it does not make one program universal. [WHO guidelines](https://www.who.int/publications/i/item/9789240014886)
8. **PROPOSED - Balance and fall safety.** Add environmental safety and referral guidance for users who feel unsteady, dizzy, or have fallen. Do not infer balance or fall risk from visible standing symmetry. CDC STEADI treats fall-risk screening and intervention as a clinical process. [CDC STEADI](https://www.cdc.gov/steadi/), [mobile balance-assessment systematic review](https://pubmed.ncbi.nlm.nih.gov/31284455/)
9. **PROPOSED - Lifting/manual handling boundary.** Explain that a body silhouette is insufficient to calculate lifting risk: object weight, hand location, travel distance, asymmetry, frequency, duration, rest, and coupling are required by the Revised NIOSH Lifting Equation. Do not add a "safe lift" camera badge without those inputs and task-specific validation. [Revised NIOSH Lifting Equation](https://www.cdc.gov/niosh/ergonomics/about/rnle.html)
10. **PROPOSED - Supported scope answers.** Users may search for sleeping posture, driving posture, phone use, backpacks, gait, lifting, pregnancy, or children's posture. The library should either provide high-trust, carefully scoped education or an explicit "not assessed by this coach" answer. Silence invites users to overgeneralize standing/desk cues.

### P2 - evidence quality and comprehension

11. **PROPOSED - Measurement uncertainty.** Show whether a result is baseline-relative or absolute, the required view, confidence state, persistence, and a plain-language uncertainty statement. Do not expose a precise angle without error bounds and validation appropriate to the exact pipeline.
12. **PROPOSED - Source scope cards.** For each source, expose population, setting, study design, sample size when relevant, measured outcome, and transfer limits. For example, the lunge study's nine young men and the push-up load study's strength-trained male sample should not silently become universal advice.
13. **PROPOSED - Comprehension testing.** Test whether users understand "tendency," "in this view," "baseline," "evidence coverage," and "not a diagnosis." The strongest safety copy is ineffective if users still interpret a green result as medical clearance.

## 4. Claims a camera-only coach must never make

The following are product prohibitions, not merely softer wording preferences.

- **PROPOSED PROHIBITION:** never diagnose or screen for scoliosis, kyphosis, lordosis, pelvic-tilt disorder, nerve compression, joint instability, muscle imbalance, leg-length difference, injury, or another disease from pose landmarks.
- **PROPOSED PROHIBITION:** never say posture caused, explains, predicts, prevents, or cures pain or injury. An umbrella review found association evidence mixed and no consensus on causality for spine posture/physical exposure and low-back pain. [Systematic review of reviews](https://pubmed.ncbi.nlm.nih.gov/31451200/)
- **PROPOSED PROHIBITION:** never call a visible pose medically normal/abnormal, perfect/bad, corrected/fixed, or healthy/unhealthy. A personal calibration baseline is not an anatomical or clinical reference standard.
- **PROPOSED PROHIBITION:** never claim clinical-grade, diagnostic-grade, motion-capture-equivalent, or universally accurate measurement without product-specific validation and published error. Another mobile posture app showed significant bias in most tested measures. [Mobile posture-app validation](https://pubmed.ncbi.nlm.nih.gov/31000345/)
- **PROPOSED PROHIBITION:** never claim true 3D spinal shape, axial rotation, pelvic orientation, joint loading, center of pressure, weight distribution, balance/fall risk, muscle activation, strength, fatigue, breathing quality, flexibility, or pain from one RGB camera.
- **PROPOSED PROHIBITION:** never infer hidden or occluded anatomy, resolve a front-plane question from a side view, or resolve sagittal depth from a front view.
- **PROPOSED PROHIBITION:** never treat landmark confidence as health confidence, tracking failure as poor posture, or a successful frame as proof that all relevant anatomy was measured.
- **PROPOSED PROHIBITION:** never predict injury, certify exercise technique as safe, provide return-to-sport/work clearance, certify rehabilitation readiness, or prescribe treatment from a camera cue.
- **PROPOSED PROHIBITION:** never impose one universal depth, angle, symmetry target, posture, repetition tempo, break interval, or progression across bodies and capabilities.
- **PROPOSED PROHIBITION:** never infer full-day sedentary exposure, work risk, recovery, or habitual posture from a short session.
- **PROPOSED PROHIBITION:** never claim validation across all ages, body sizes, skin tones, clothing, assistive devices, disabilities, pregnancies, cameras, lighting, rooms, browsers, or devices unless those strata were actually tested and reported.
- **PROPOSED PROHIBITION:** never promise zero delay, 100% accuracy, no false cues, or that the whole body can always fit. Camera field of view, device performance, occlusion, and room geometry remain physical constraints.
- **PROPOSED PROHIBITION:** never use "private" as an absolute guarantee. "Processed locally in this tab; no app upload" is testable. Browser extensions, compromised dependencies/origin, device malware, screenshots, and user sharing remain outside that guarantee.

**INFERRED:** the 2025 smartphone-photogrammetry review reports encouraging pooled reliability for some measures but also heterogeneity, small samples, and inconsistent reporting. It does not validate automatic MediaPipe landmarks, this evaluator, or clinical diagnosis. Evidence for one app/protocol cannot be transferred wholesale to another. [Photogrammetry smartphone-app systematic review](https://pubmed.ncbi.nlm.nih.gov/41398198/)

## 5. Recommended local knowledge-library information architecture

**PROPOSED:** keep all content static and browser-local, but replace the current flat `topic -> sources` model with explicit layers:

```text
Source register
  -> Evidence claims
      -> Educational topics
      -> Safety/escalation rules
      -> Mode guides

Measurement studies
  -> Metric definitions
      -> Threshold provenance
          -> Evaluator cue mappings

All layers
  -> Local search index + UI cards + review/version metadata
```

### A. Source register

One immutable record per source:

- `sourceId`, title, publisher, URL, DOI/PMID where applicable
- source class: government guidance, official clinical guidance, systematic review, validation study
- publication/update date and `urlVerifiedAt`
- population, setting, sample size, measured outcomes
- jurisdiction/language and transfer limitations
- review status: current, superseded, recheck-needed

### B. Evidence-claim registry

One atomic paraphrased claim per record:

- `claimId`, plain-language claim, source IDs
- evidence scope and strength
- population/task/view to which it applies
- supported action and explicit non-implications
- contradictions/uncertainty and last review date

This prevents one broad topic from making a source appear to support every sentence in the card.

### C. Educational topic registry

User-browseable content assembled from claim IDs:

- `topicId`, aliases/search terms, category, audience
- "what you may notice," "options to try," and "when to stop"
- `healthClaimIds`, safety-rule IDs, and prohibited-claim IDs
- `cameraObservable: yes | partial | no`
- required view when observable; explicit "not assessed" response when not

### D. Measurement and detector registry

Separate technical evidence from health evidence:

- `metricId`, formula, required landmarks, supported view, units/normalization
- model/version and camera assumptions
- validation source IDs and reference method
- tested populations/devices/conditions
- error, repeatability, false-cue/abstention metrics
- `validationStatus: unvalidated | internal-only | externally-validated`

### E. Threshold registry

Every cutpoint/persistence duration must declare:

- `thresholdId`, metric ID, value/range, applicable mode/view
- `provenance: user-baseline | product-heuristic | validated-reference`
- rationale, calibration behavior, and uncertainty
- whether it may count reps, trigger a cue, or only affect UI
- review/version history

Current thresholds should default to `product-heuristic` until validated.

### F. Cue/issue mapping registry

Each `IssueCode` should map independently to:

- observation template using conditional language
- metric and threshold IDs
- action claim IDs
- measurement-validation IDs
- contraindications and escalation rule IDs
- priority/persistence behavior
- supported and prohibited claims
- positive-state copy describing what was checked and what remains unknown

### G. Safety and escalation registry

Global rules rendered regardless of search or mode:

- stop-now symptoms
- urgent/emergency escalation by locale
- recent injury/surgery/known-condition boundary
- balance/fall/environment safety
- age/pregnancy/disability adaptation boundary
- explicit statement that the coach is education, not diagnosis or treatment

### H. Mode-guide registry

One guide for standing, desk, squat, plank, push-up, lunge, and curl:

- purpose and intended audience
- required camera view/framing
- what the evaluator observes
- setup and easier variations
- cue hierarchy and stop rules
- unsupported measurements/claims
- health evidence, detector evidence, and threshold provenance shown separately

### I. Local delivery and governance

- Keep the source/claim/topic data bundled and searchable without an API, account, or network request.
- Generate source-use reports: orphan sources, uncited claims, issue codes lacking measurement evidence, and stale URL reviews.
- Fail tests when a cue lacks action evidence, a metric lacks declared validation status, or a threshold lacks provenance; do not merely test array length.
- Record content version separately from model/evaluator version so users can identify which knowledge and detector produced a result.
- Reverify URLs and claim scope on a defined cadence; mark blocked/bot-gated checks honestly rather than silently treating them as dead.

## 6. Existing-note alignment

**OBSERVED:** `docs/posture-evidence.md` already establishes the right safety principles: no perfect posture, observation is not diagnosis, posture is not a simple pain cause, duration/task matter, exercise cues are individualized heuristics, and low-confidence/unsupported states must abstain.

**OBSERVED:** `docs/research/standing-posture-evidence.md` already specifies relaxed standing calibration, view-specific observations, conditional language, one gentle cue at a time, full-body framing, temporal aggregation, and product-specific validation before accuracy claims.

**OBSERVED:** `docs/research/cross-device-camera-evidence.md` establishes that portrait constraints are preferences, camera orientation/performance vary, physical-device testing remains required, and pose landmarks are estimates rather than clinical instruments.

**INFERRED:** the main gap is not absence of safety intent. It is lack of structured enforcement between (a) education, (b) detector validity, (c) threshold provenance, and (d) runtime wording.

## 7. URL verification register

### Current registry: direct HTTP 200

**OBSERVED:** these 19 current URLs returned HTTP 200 after redirects on 2026-08-07:

- [OSHA Computer Workstations](https://www.osha.gov/etools/computer-workstations)
- [OSHA Good Working Positions](https://www.osha.gov/etools/computer-workstations/positions)
- [Healthdirect posture guidance](https://www.healthdirect.gov.au/how-to-improve-your-posture)
- [Standing alignment study, PMID 31233893](https://pubmed.ncbi.nlm.nih.gov/31233893/)
- [Mobile posture validation, PMID 31000345](https://pubmed.ncbi.nlm.nih.gov/31000345/)
- [OSHA Evaluation Checklist](https://www.osha.gov/etools/computer-workstations/checklists/evaluation)
- [WHO physical activity and sedentary behaviour](https://www.who.int/publications/i/item/9789240014886)
- [CUH Seating and Ergonomics](https://www.cuh.nhs.uk/patient-information/seating-and-ergonomics/)
- [NHS neck pain guidance](https://www.nhs.uk/symptoms/neck-pain-and-stiff-neck/)
- [MedlinePlus kyphosis](https://medlineplus.gov/ency/article/001240.htm)
- [MedlinePlus scoliosis](https://medlineplus.gov/ency/article/001241.htm)
- [Posture/low-back-pain causality review, PMID 31451200](https://pubmed.ncbi.nlm.nih.gov/31451200/)
- [Office sitting/posture scoping review, PMID 40111906](https://pubmed.ncbi.nlm.nih.gov/40111906/)
- [Forward-head exercise review, PMID 30107937](https://pubmed.ncbi.nlm.nih.gov/30107937/)
- [Forward-head/rounded-shoulder review, PMID 38302926](https://pubmed.ncbi.nlm.nih.gov/38302926/)
- [Dynamic-knee-valgus review, PMID 34268014](https://pubmed.ncbi.nlm.nih.gov/34268014/)
- [Push-up load study, PMID 20179649](https://pubmed.ncbi.nlm.nih.gov/20179649/)
- [Push-up kinetics review, PMID 30284496](https://pubmed.ncbi.nlm.nih.gov/30284496/)
- [Lunge biomechanics study, PMID 26418958](https://pubmed.ncbi.nlm.nih.gov/26418958/)

### Current registry: official bot-gated but live

**OBSERVED:** these six current URLs returned HTTP 403 to command-line retrieval, but their current official content resolved through browser/search retrieval on 2026-08-07. They are bot-gated, not observed dead:

- [NIH Getting It Straight](https://newsinhealth.nih.gov/2017/08/getting-it-straight)
- [NIOSH About Ergonomics](https://www.cdc.gov/niosh/ergonomics/about/index.html)
- [NIOSH Risk Factors](https://www.cdc.gov/niosh/ergonomics/ergo-programs/risk-factors.html)
- [NIOSH Office Environments](https://www.cdc.gov/niosh/office-environment/about/)
- [CDC Adult Activity](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html)
- [NICE NG59 Recommendations](https://www.nice.org.uk/guidance/ng59/chapter/recommendations)

### Additional sources used in this audit

**OBSERVED:** all additional URLs below resolved on 2026-08-07. NHS and PubMed links returned HTTP 200. CDC links returned bot-gated HTTP 403 to command-line retrieval but resolved in browser retrieval:

- [NHS Back Pain](https://www.nhs.uk/conditions/back-pain/)
- [CDC STEADI](https://www.cdc.gov/steadi/)
- [Revised NIOSH Lifting Equation](https://www.cdc.gov/niosh/ergonomics/about/rnle.html)
- [NIOSH Observation-Based Posture Assessment](https://www.cdc.gov/niosh/docs/2014-131/default.html)
- [Photogrammetry smartphone-app systematic review, PMID 41398198](https://pubmed.ncbi.nlm.nih.gov/41398198/)
- [Single-camera healthcare scoping review, PMID 35642200](https://pubmed.ncbi.nlm.nih.gov/35642200/)
- [Dynamic markerless validation study, PMID 39733226](https://pubmed.ncbi.nlm.nih.gov/39733226/)
- [Mobile balance-assessment systematic review, PMID 31284455](https://pubmed.ncbi.nlm.nih.gov/31284455/)

## Bottom line

**OBSERVED:** the current library is unusually careful about non-diagnosis and already covers 19 useful topics without a backend or API key.

**INFERRED:** its central evidence defect is structural: health guidance, detector validity, and threshold provenance are collapsed into one link list. This makes several weak mappings look complete.

**PROPOSED:** preserve the local/offline design, but require separate evidence for the action, the measurement, and the threshold. Until product-specific validation exists, describe every camera result as a conditional visible observation relative to a supported view and, where used, the user's own relaxed baseline.
