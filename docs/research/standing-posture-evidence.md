# Standing-posture evidence

Reviewed: 2026-08-06
Scope: research-only note for a non-diagnostic, camera-based teaching tool.
Application code and the existing evidence registry were not changed.

## Bottom line

“Normal posture” is not one rigid pose. A useful consumer definition of relaxed standing is a comfortable, flexible stance that preserves the spine’s natural curves, keeps the head/shoulders/hips approximately stacked in a side view, lets the shoulders relax, distributes weight between both feet, and keeps the knees straight without locking them. This is a coaching reference, not a medical pass/fail threshold. [Healthdirect standing-posture guidance](https://www.healthdirect.gov.au/how-to-improve-your-posture) and the [NIH posture overview](https://newsinhealth.nih.gov/2017/08/getting-it-straight) support this framing.

A camera can report visible landmark relationships under a controlled view. It cannot determine whether a person has a disease, pain-causing “bad posture,” a structural spinal curve, abnormal muscle activity, or a clinically meaningful need for treatment. The product should say “this visible alignment appears…” and “try this gentle cue,” never “you have [condition]” or “this caused your pain.”

## Evidence-based standing reference

Use these as soft, observable cues:

- Stand relaxed and flexible; do not brace, flatten the back, pull the shoulders aggressively backward, or hold a military pose. Healthdirect explicitly says good standing posture does not require stiffness or rigidity.
- Preserve the three natural spinal curves rather than trying to make the spine flat. The head should sit above the shoulders and the shoulder region should be approximately over the hips.
- In a side view, the ears, shoulders, and hips should be broadly in line “as much as possible,” not forced into an exact vertical line.
- Keep both feet in comfortable contact with the floor and aim for balanced weight. A single RGB camera cannot measure plantar pressure or the true center of mass, so “even weight” should be taught as a body-sensation cue, not asserted from landmarks.
- Keep the knees straight but not locked. Let the arms hang naturally and keep the head level when that is comfortable.
- Treat posture as both static and dynamic. Vary position, move regularly, and avoid holding any one posture for a long time.

The distinction between “stand as upright as possible” and natural standing matters. In a prospective radiographic study of 60 healthy 21-year-olds, directed standing and natural, relaxed standing produced significantly different whole-body sagittal alignment. A future assessment should therefore ask for a settled, comfortable stance rather than coaching the user into the most exaggeratedly upright pose before measuring. [Hey et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31233893/)

## What one RGB camera can and cannot infer

### Reasonable observations

With a full-body frame, one person, adequate lighting, visible joints, a level and fixed camera, and a known view, a system can cautiously estimate:

- projected head-to-trunk, trunk-to-pelvis, and lower-limb relationships in a side view;
- projected shoulder/hip height differences and lateral lean in a front or back view;
- whether required landmarks are missing, occluded, unstable, or outside the frame;
- changes in those visible relationships over a short time window.

MediaPipe’s official Pose Landmarker documentation describes 33 estimated body landmarks, normalized image coordinates, and model-produced world coordinates. Those outputs are useful inputs for an on-device coach, but “world coordinates in meters” are still model estimates when the input is a single RGB view; they are not the same as a motion-capture, force-plate, radiographic, or clinician measurement. [MediaPipe Pose Landmarker overview](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) and [MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

### Hard limits

- A single view does not uniquely determine depth. Different 3D poses can project to the same 2D image, and self-occluded joints cannot be verified from pixels that do not show them. [Resolving Position Ambiguity of IMU-Based Human Pose with a Single RGB Camera](https://pmc.ncbi.nlm.nih.gov/articles/PMC7582626/) and [Estimating a 3D Human Skeleton from a Single RGB Image](https://pmc.ncbi.nlm.nih.gov/articles/PMC11679025/) describe this depth and occlusion problem.
- A side view cannot validate frontal symmetry or axial rotation. A front view cannot establish sagittal curvature or true forward/backward depth. Do not merge these into one “whole-body score” without the required view.
- RGB landmarks do not reveal pain, stiffness, fatigue, balance confidence, range of motion, muscle strength, muscle activation, joint loading, foot pressure, or breathing difficulty.
- A landmark pattern cannot diagnose scoliosis, kyphosis, lordosis, pelvic pathology, neurological disease, injury, or leg-length difference. Diagnosis requires history and clinical examination; some questions require additional measurement or imaging.
- A single frame cannot represent a person’s usual posture, task exposure, or symptoms across a day. Age, body shape, injury, pregnancy, footwear, work, fatigue, and context can change standing posture.
- Do not treat “low confidence” as “bad posture.” Missing or unstable points mean “cannot assess.”

Validation evidence also argues against overclaiming. In a study of 50 asymptomatic men, a mobile posture application was compared with VICON 3D analysis. The authors found significant bias in most frontal and sagittal measurements and recommended caution when highly accurate assessment is required. [Hopkins et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31000345/)

## Safe teaching language

Use an observation → uncertainty → cue pattern:

| Observed situation                                                       | Safe teaching language                                                                                                      | Do not say                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Side-view head appears forward of the shoulder/trunk reference           | “Your head appears slightly forward in this view. Try letting it balance over your ribs while keeping your breathing easy.” | “You have forward-head syndrome” or “this caused your neck pain.” |
| Shoulders or hips appear at different heights in a front view            | “This frame shows a possible height difference. Recheck with the camera level and your whole body visible.”                 | “You have scoliosis” or “one leg is shorter.”                     |
| Knees appear pushed backward                                             | “Your knees look very straight here. Try a small, comfortable softness without squatting.”                                  | “You have knee hyperextension” or “you will injure your knees.”   |
| Shoulders look rounded or trunk looks flexed                             | “Try a gentle reset: relax the shoulders, keep the natural curves, and move through a comfortable range.”                   | “Your spine is damaged” or “your muscles are permanently tight.”  |
| Feet or lower body are missing/occluded                                  | “I cannot assess standing alignment until both feet and the full body are visible.”                                         | Guessing a weight-shift or balance problem.                       |
| The user reports pain, numbness, weakness, dizziness, or a new deformity | “Stop the exercise and seek appropriate professional advice.”                                                               | Treating a camera score as a diagnosis or treatment plan.         |

The wording should remain conditional (“appears,” “in this view,” “recheck”) and give one low-force cue at a time. Avoid “perfect,” “fix,” “correct your spine,” “bad,” and fear-based warnings. A user should be able to return to a comfortable neutral position immediately; the app must not reward bracing, breath-holding, pain, or rigid symmetry.

## Minimum assessment protocol for a future refactor

This is a research-derived product specification, not an implementation change:

1. Offer separate view modes: side for sagittal observations and front/back for projected asymmetry. Explain that one view cannot assess the other plane.
2. Require the full body, including feet, one visible person, stable camera, camera approximately level, adequate light, and no major occlusion. Otherwise abstain.
3. Calibrate from the user’s relaxed standing position. Do not calibrate from a forced “stand perfectly straight” pose.
4. Aggregate a short stable time window instead of judging one frame. Require stable visibility and confidence for every landmark used by a cue.
5. Report the measured observation and its view, not a disease label. Prefer user-specific change over universal angular cutoffs because healthy alignment varies.
6. Include a “cannot assess” result for depth-dependent rotation, foot pressure, hidden joints, structural curves, pain, or any unsupported view.
7. Do not call the system clinically accurate until it is tested against a declared reference method, with representative ages, sexes, body sizes, clothing, skin tones, devices, distances, lighting, and view angles. Report error and abstention rates, not only successful demos.

## Evidence-based movement and exercise suggestions

Exercise recommendations should be general, progressive, and capability-based—not automatically prescribed from a camera label.

- Encourage regular movement and changing positions. Healthdirect recommends avoiding all-day sitting or standing, taking breaks, varying tasks, and using a physiotherapist for individualized advice. The NIH similarly recommends frequent movement, stretching breaks, and attention to repetitive or prolonged positions. [Healthdirect](https://www.healthdirect.gov.au/how-to-improve-your-posture), [NIH](https://newsinhealth.nih.gov/2017/08/getting-it-straight)
- Encourage whole-body strength and flexibility rather than a single “posture muscle.” The NHS recommends major-muscle-group strengthening on at least two days per week and gradual progression; it lists stretching, yoga, tai chi, and Pilates as flexibility activities. [NHS strength and flexibility guidance](https://www.nhs.uk/live-well/exercise/how-to-improve-strength-flexibility/)
- For balance practice, use a wall or stable chair, progress gradually, and stop if the exercise is unsafe. The NHS gives these safeguards for simple balance exercises. [NHS balance exercises](https://www.nhs.uk/live-well/exercise/balance-exercises/)
- A targeted program can improve a specific measured condition in a specific population, but that does not make it a universal prescription. In the SHEAF randomized controlled trial, 99 adults aged 60+ with radiographic hyperkyphosis received six months of physical-therapist-led spine strengthening and posture training three times weekly; the between-group Cobb-angle difference was -3.0 degrees. This supports supervised, condition-specific exercise—not diagnosis or treatment by a webcam. [Katzman et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28689306/)
- If exercise increases pain, stop and seek advice. Do not use a visual posture result to select rehabilitation exercises for a known condition, recent injury, pregnancy-related concern, or neurological symptom. The [NHS back-pain guidance](https://www.nhs.uk/conditions/back-pain/) advises professional assessment for severe or worsening pain and urgent care for symptoms such as weakness/numbness in both legs, saddle-area loss of feeling, or bladder/bowel changes.

## Claims the product should avoid

- “You have bad posture,” “your posture is normal/abnormal,” or “your alignment is causing pain.”
- “This camera measures your spine,” “your 3D depth is accurate,” or “your weight is evenly distributed.”
- Diagnoses or screening labels: scoliosis, kyphosis, lordosis, pelvic tilt disorder, nerve compression, joint instability, muscle imbalance, or injury.
- Universal target angles, “perfect symmetry,” or a promise that one exercise will fix a posture pattern.
- A pass result that implies medical clearance, injury prevention, rehabilitation readiness, or treatment success.

## Source register

### Official health and clinical guidance

- https://www.healthdirect.gov.au/how-to-improve-your-posture
- https://medlineplus.gov/guidetogoodposture.html
- https://newsinhealth.nih.gov/2017/08/getting-it-straight
- https://www.nhs.uk/live-well/exercise/how-to-improve-strength-flexibility/
- https://www.nhs.uk/live-well/exercise/balance-exercises/
- https://www.nhs.uk/conditions/back-pain/
- https://www.who.int/publications/i/item/9789240015128
- https://www.who.int/publications/i/item/9789240081789

### Official technical documentation

- https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js

### Primary research and evidence syntheses

- https://pubmed.ncbi.nlm.nih.gov/31233893/ — natural relaxed vs directed standing in healthy young adults.
- https://pubmed.ncbi.nlm.nih.gov/31000345/ — mobile posture-app measurements compared with VICON 3D analysis.
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7582626/ — single-RGB depth ambiguity and image-constraint failure.
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11679025/ — depth ambiguity and occlusion in monocular 3D pose estimation.
- https://pubmed.ncbi.nlm.nih.gov/28689306/ — SHEAF randomized controlled trial of targeted spine strengthening and posture training.
- https://pubmed.ncbi.nlm.nih.gov/31451200/ — systematic review of reviews finding no consensus on posture/physical-exposure causality for low-back pain.

## Safety boundary

This note supports educational movement cues only. It is not a diagnostic protocol and does not establish a clinical normal range. Persistent or concerning symptoms should be assessed by a qualified health professional. Urgent symptoms listed by the NHS—especially new bladder/bowel changes, loss of feeling around the genitals/anus, or weakness/numbness in both legs—should not be handled by a posture coach.
