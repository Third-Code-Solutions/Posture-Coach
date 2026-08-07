import type { AnalysisMode, IssueCode } from "../domain/contracts";

export const POSTURE_EVIDENCE_CACHE_VERSION = "2026-08-07";

export type EvidenceType =
  | "government-guideline"
  | "clinical-guidance"
  | "clinical-reference"
  | "systematic-review"
  | "scoping-review"
  | "biomechanics-study";

export type EvidenceLevel =
  | "guideline"
  | "systematic-review"
  | "scoping-review"
  | "clinical-guidance"
  | "clinical-boundary"
  | "biomechanics";

export type EvidenceCategory =
  "general" | "desk" | "head-and-neck" | "trunk-and-spine" | "asymmetry" | "exercise";

export type EvidenceCategoryFilter = EvidenceCategory | "all";

export const EVIDENCE_CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  general: "Foundations",
  desk: "Desk setup",
  "head-and-neck": "Head + neck",
  "trunk-and-spine": "Trunk + spine",
  asymmetry: "Asymmetry",
  exercise: "Movement",
};

export const EVIDENCE_CATEGORIES = Object.keys(EVIDENCE_CATEGORY_LABELS) as EvidenceCategory[];

export interface EvidenceSource {
  id: string;
  title: string;
  publisher: string;
  publishedOrUpdated: string;
  evidenceType: EvidenceType;
  url: string;
}

export interface PostureEvidence {
  id: string;
  title: string;
  category: EvidenceCategory;
  evidenceLevel: EvidenceLevel;
  signal: string;
  claim: string;
  actions: readonly string[];
  limitations: string;
  sourceIds: readonly EvidenceSourceId[];
}

export const POSTURE_EVIDENCE_SOURCES = [
  {
    id: "osha-workstation",
    title: "eTools: Computer Workstations",
    publisher: "U.S. Occupational Safety and Health Administration",
    publishedOrUpdated: "Accessed 2026-08-06",
    evidenceType: "government-guideline",
    url: "https://www.osha.gov/etools/computer-workstations",
  },
  {
    id: "osha-positions",
    title: "eTools: Computer Workstations - Good Working Positions",
    publisher: "U.S. Occupational Safety and Health Administration",
    publishedOrUpdated: "Accessed 2026-08-06",
    evidenceType: "government-guideline",
    url: "https://www.osha.gov/etools/computer-workstations/positions",
  },
  {
    id: "healthdirect-posture",
    title: "How to improve your posture",
    publisher: "Healthdirect Australia",
    publishedOrUpdated: "Accessed 2026-08-06",
    evidenceType: "clinical-guidance",
    url: "https://www.healthdirect.gov.au/how-to-improve-your-posture",
  },
  {
    id: "nih-posture",
    title: "Getting It Straight About Posture",
    publisher: "National Institutes of Health, NIH News in Health",
    publishedOrUpdated: "2017-08",
    evidenceType: "government-guideline",
    url: "https://newsinhealth.nih.gov/2017/08/getting-it-straight",
  },
  {
    id: "standing-alignment-study",
    title: "Comparison of whole-body sagittal alignment in standing and sitting postures",
    publisher: "European Spine Journal; indexed by PubMed",
    publishedOrUpdated: "2019; prospective radiographic study",
    evidenceType: "biomechanics-study",
    url: "https://pubmed.ncbi.nlm.nih.gov/31233893/",
  },
  {
    id: "mobile-posture-validation",
    title: "Validity of a mobile posture application compared with VICON 3D analysis",
    publisher: "Journal of Medical Internet Research; indexed by PubMed",
    publishedOrUpdated: "2019; validation study",
    evidenceType: "biomechanics-study",
    url: "https://pubmed.ncbi.nlm.nih.gov/31000345/",
  },
  {
    id: "single-camera-markerless-review",
    title: "Healthcare applications of single camera markerless motion capture",
    publisher: "PeerJ; indexed by PubMed",
    publishedOrUpdated: "2022; scoping review",
    evidenceType: "scoping-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/35642200/",
  },
  {
    id: "markerless-dynamic-validation",
    title: "Validity and usability of markerless motion capture for dynamic movements",
    publisher: "Medicine & Science in Sports & Exercise; indexed by PubMed",
    publishedOrUpdated: "2025; validation study",
    evidenceType: "biomechanics-study",
    url: "https://pubmed.ncbi.nlm.nih.gov/39733226/",
  },
  {
    id: "osha-evaluation",
    title: "eTools: Computer Workstations - Evaluation Checklist",
    publisher: "U.S. Occupational Safety and Health Administration",
    publishedOrUpdated: "Accessed 2026-08-06",
    evidenceType: "government-guideline",
    url: "https://www.osha.gov/etools/computer-workstations/checklists/evaluation",
  },
  {
    id: "niosh-ergonomics",
    title: "About Ergonomics and Work-Related Musculoskeletal Disorders",
    publisher: "National Institute for Occupational Safety and Health, CDC",
    publishedOrUpdated: "2024-02-21",
    evidenceType: "government-guideline",
    url: "https://www.cdc.gov/niosh/ergonomics/about/index.html",
  },
  {
    id: "niosh-risk-factors",
    title: "Step 1: Identify Risk Factors",
    publisher: "National Institute for Occupational Safety and Health, CDC",
    publishedOrUpdated: "2024-03-05",
    evidenceType: "government-guideline",
    url: "https://www.cdc.gov/niosh/ergonomics/ergo-programs/risk-factors.html",
  },
  {
    id: "niosh-office",
    title: "Office Environments and Your Safety",
    publisher: "National Institute for Occupational Safety and Health, CDC",
    publishedOrUpdated: "2026-07-16",
    evidenceType: "government-guideline",
    url: "https://www.cdc.gov/niosh/office-environment/about/",
  },
  {
    id: "who-activity",
    title: "WHO guidelines on physical activity and sedentary behaviour: at a glance",
    publisher: "World Health Organization",
    publishedOrUpdated: "2020-11-25",
    evidenceType: "government-guideline",
    url: "https://www.who.int/publications/i/item/9789240014886",
  },
  {
    id: "cdc-adult-activity",
    title: "Adult Activity: An Overview",
    publisher: "Centers for Disease Control and Prevention",
    publishedOrUpdated: "2023-12-20",
    evidenceType: "government-guideline",
    url: "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html",
  },
  {
    id: "nice-low-back",
    title: "Low back pain and sciatica in over 16s: recommendations",
    publisher: "National Institute for Health and Care Excellence",
    publishedOrUpdated: "Guideline NG59; accessed 2026-08-06",
    evidenceType: "clinical-guidance",
    url: "https://www.nice.org.uk/guidance/NG59/chapter/Recommendations",
  },
  {
    id: "cuh-seating",
    title: "Seating and ergonomics",
    publisher: "Cambridge University Hospitals NHS Foundation Trust",
    publishedOrUpdated: "Accessed 2026-08-06",
    evidenceType: "clinical-guidance",
    url: "https://www.cuh.nhs.uk/patient-information/seating-and-ergonomics/",
  },
  {
    id: "nhs-neck-pain",
    title: "Neck pain and stiff neck",
    publisher: "National Health Service",
    publishedOrUpdated: "Last reviewed 2023-04-27",
    evidenceType: "clinical-guidance",
    url: "https://www.nhs.uk/symptoms/neck-pain-and-stiff-neck/",
  },
  {
    id: "nhs-back-pain",
    title: "Back pain",
    publisher: "National Health Service",
    publishedOrUpdated: "Last reviewed 2026-03-05",
    evidenceType: "clinical-guidance",
    url: "https://www.nhs.uk/conditions/back-pain/",
  },
  {
    id: "medlineplus-kyphosis",
    title: "Kyphosis",
    publisher: "MedlinePlus, U.S. National Library of Medicine",
    publishedOrUpdated: "Reviewed 2024-08-27",
    evidenceType: "clinical-reference",
    url: "https://medlineplus.gov/ency/article/001240.htm",
  },
  {
    id: "medlineplus-scoliosis",
    title: "Scoliosis",
    publisher: "MedlinePlus, U.S. National Library of Medicine",
    publishedOrUpdated: "Reviewed 2025-09-02",
    evidenceType: "clinical-reference",
    url: "https://medlineplus.gov/ency/article/001241.htm",
  },
  {
    id: "posture-low-back-causality",
    title: "No consensus on causality of spine postures or physical exposure and low back pain",
    publisher: "Journal of Biomechanics; indexed by PubMed",
    publishedOrUpdated: "2020; systematic review of systematic reviews",
    evidenceType: "systematic-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/31451200/",
  },
  {
    id: "posture-low-back-scoping",
    title: "Low back pain and sitting time, posture and behavior in office workers",
    publisher: "Journal of Back and Musculoskeletal Rehabilitation; indexed by PubMed",
    publishedOrUpdated: "2025; scoping review",
    evidenceType: "scoping-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/40111906/",
  },
  {
    id: "forward-head-exercise",
    title: "Effectiveness of Therapeutic Exercise on Forward Head Posture",
    publisher: "Journal of Manipulative & Physiological Therapeutics; indexed by PubMed",
    publishedOrUpdated: "2018; systematic review and meta-analysis",
    evidenceType: "systematic-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/30107937/",
  },
  {
    id: "forward-head-rounded-shoulder",
    title: "Therapeutic exercises for forward head, rounded shoulder, and hyperkyphosis",
    publisher: "BMC Musculoskeletal Disorders; indexed by PubMed",
    publishedOrUpdated: "2024; systematic review and meta-analysis",
    evidenceType: "systematic-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/38302926/",
  },
  {
    id: "knee-valgus-exercise",
    title: "The effects of hip- and ankle-focused exercise intervention on dynamic knee valgus",
    publisher: "PeerJ; indexed by PubMed",
    publishedOrUpdated: "2021; systematic review",
    evidenceType: "systematic-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/34268014/",
  },
  {
    id: "pushup-load",
    title:
      "The effect of position on the percentage of body mass supported during push-up variants",
    publisher: "Journal of Strength and Conditioning Research; indexed by PubMed",
    publishedOrUpdated: "2011; biomechanics study",
    evidenceType: "biomechanics-study",
    url: "https://pubmed.ncbi.nlm.nih.gov/20179649/",
  },
  {
    id: "pushup-kinetics",
    title:
      "Kinetic analysis of push-up exercises: a systematic review with practical recommendations",
    publisher: "Sports Biomechanics; indexed by PubMed",
    publishedOrUpdated: "2018; systematic review",
    evidenceType: "systematic-review",
    url: "https://pubmed.ncbi.nlm.nih.gov/30284496/",
  },
  {
    id: "lunge-biomechanics",
    title: "Joint kinetics and kinematics during common lower limb rehabilitation exercises",
    publisher: "Journal of Athletic Training; indexed by PubMed",
    publishedOrUpdated: "2015; biomechanics study",
    evidenceType: "biomechanics-study",
    url: "https://pubmed.ncbi.nlm.nih.gov/26418958/",
  },
] as const satisfies readonly EvidenceSource[];

export type EvidenceSourceId = (typeof POSTURE_EVIDENCE_SOURCES)[number]["id"];

export const POSTURE_EVIDENCE_SOURCE_BY_ID = Object.fromEntries(
  POSTURE_EVIDENCE_SOURCES.map((source) => [source.id, source]),
) as Record<EvidenceSourceId, EvidenceSource>;

export const POSTURE_EVIDENCE = [
  {
    id: "neutral-posture",
    title: "Neutral posture is a range, not one perfect pose",
    category: "general",
    evidenceLevel: "guideline",
    signal: "A comfortable, supported alignment that can change throughout the day.",
    claim:
      "OSHA says there is no single correct posture for everyone. Neutral positioning is a comfortable joint alignment and can include upright, declined, or reclined working positions.",
    actions: [
      "Aim for comfortable support rather than forcing a rigid pose.",
      "Make small adjustments and let your position change during the day.",
    ],
    limitations:
      "A camera cannot measure comfort, symptoms, joint range, fatigue, or whether a posture is clinically normal.",
    sourceIds: ["osha-workstation", "osha-positions"],
  },
  {
    id: "when-to-seek-care",
    title: "Back pain: when to stop and seek medical care",
    category: "general",
    evidenceLevel: "clinical-guidance",
    signal:
      "When using this coach with back pain, pain worsens during practice, follows serious trauma, or appears with new neurological, bladder, bowel, chest, feverish, or rapidly worsening symptoms.",
    claim:
      "NHS guidance separates routine review, urgent advice, and emergency care for back pain. Bilateral leg weakness or numbness, loss of feeling around the genitals or anus, bladder or bowel changes, chest pain, or pain after a serious accident require emergency assessment.",
    actions: [
      "Stop the session if back pain starts or worsens; this coach cannot assess the cause.",
      "Use your local emergency service for the emergency symptoms above, and urgent medical advice for sudden severe or rapidly worsening pain or feeling systemically unwell.",
      "Seek qualified care when symptoms persist, change shape, limit daily activity, or concern you.",
    ],
    limitations:
      "This is general UK NHS escalation guidance, not diagnosis or individualized triage. Emergency numbers and care pathways vary by location.",
    sourceIds: ["nhs-back-pain", "nice-low-back"],
  },
  {
    id: "calibration-and-confidence",
    title: "Calibration and confidence are not a health score",
    category: "general",
    evidenceLevel: "clinical-boundary",
    signal:
      "The app reports a completed baseline, steady evidence, or a high landmark-confidence state.",
    claim:
      "Calibration stores a personal visual baseline for this session. Landmark confidence describes model visibility, not posture quality. Exact camera thresholds and persistence windows in this app are product heuristics and have not been clinically validated.",
    actions: [
      "Calibrate in a relaxed, comfortable position rather than forcing an upright pose.",
      "Treat a steady result as no supported persistent deviation detected in this view—not medical clearance.",
      "Reframe or change view when landmarks disappear instead of treating tracking failure as a body problem.",
    ],
    limitations:
      "No product-specific study has established sensitivity, specificity, measurement error, false-cue rate, or clinical accuracy for this evaluator.",
    sourceIds: ["standing-alignment-study", "mobile-posture-validation"],
  },
  {
    id: "camera-measurement-limits",
    title: "One camera sees a 2D estimate, not the whole body",
    category: "general",
    evidenceLevel: "scoping-review",
    signal:
      "A result depends on camera view, framing, distance, roll, lighting, clothing, occlusion, or out-of-plane movement.",
    claim:
      "Single-camera markerless systems can be useful for simple measurements in one plane, but reviews report lower capability for detailed 3D kinematics and fine or occluded movement. Validation error varies by system, plane, task, and variable.",
    actions: [
      "Use the requested front or side view, keep the camera level, and keep required joints visible.",
      "Repeat the check after reframing; ignore cues that do not match what you can clearly see or feel.",
      "Use qualified in-person assessment for diagnosis, balance, pain, structural shape, or rehabilitation decisions.",
    ],
    limitations:
      "Evidence from other markerless systems does not validate this MediaPipe pipeline, its thresholds, or every phone, body, room, and movement.",
    sourceIds: [
      "single-camera-markerless-review",
      "markerless-dynamic-validation",
      "mobile-posture-validation",
    ],
  },
  {
    id: "standing-alignment",
    title: "Relaxed standing alignment is a flexible reference",
    category: "general",
    evidenceLevel: "guideline",
    signal:
      "In the selected full-body view, the head, trunk, and shoulder/hip lines stay close to the user's settled standing baseline.",
    claim:
      "Standing guidance describes a comfortable, non-rigid alignment with the head and trunk broadly stacked, while acknowledging that posture varies and should change. This app reports visible relationships only; it does not establish a normal range or diagnose a condition.",
    actions: [
      "Settle into a comfortable stance without pulling the shoulders back or holding the breath.",
      "Use one gentle cue, then move and vary position instead of chasing perfect symmetry.",
    ],
    limitations:
      "A single RGB camera cannot measure pain, balance confidence, foot pressure, spinal structure, true 3D alignment, or the cause of symptoms.",
    sourceIds: [
      "healthdirect-posture",
      "nih-posture",
      "osha-positions",
      "niosh-risk-factors",
      "posture-low-back-causality",
      "mobile-posture-validation",
    ],
  },
  {
    id: "static-posture",
    title: "Static or prolonged posture",
    category: "general",
    evidenceLevel: "guideline",
    signal: "The same visible position or deviation is held for a sustained interval.",
    claim:
      "NIOSH distinguishes neutral, awkward, and static postures. Holding even a neutral position for too long can increase fatigue; changing tasks or taking short breaks can reduce discomfort.",
    actions: [
      "Change position, stand, walk, or move the task closer instead of holding one pose.",
      "Use the cue as a prompt to vary your position, not as a pass/fail score.",
    ],
    limitations:
      "This session only sees the visible interval in front of the camera; it cannot estimate your full-day sitting exposure.",
    sourceIds: ["niosh-risk-factors", "niosh-office", "osha-positions"],
  },
  {
    id: "desk-setup",
    title: "Desk setup should support comfort and position changes",
    category: "desk",
    evidenceLevel: "guideline",
    signal:
      "The chair, display, keyboard, pointing device, or work surface makes the user reach, twist, look down, or remain unsupported.",
    claim:
      "OSHA and NIOSH workstation guidance recommends fitting equipment to the user, keeping frequently used items close, supporting the feet and back, and allowing position changes. No single setup is correct for every body or task.",
    actions: [
      "Bring the display and controls close enough to use without repeated reaching or twisting.",
      "Support your feet and back in a comfortable position, then change position regularly.",
      "Use a separate keyboard or stand when a laptop-only setup forces sustained neck bending.",
    ],
    limitations:
      "A camera cannot measure screen glare, contact pressure, reach force, furniture dimensions, vision needs, or whether equipment fits your body.",
    sourceIds: ["osha-workstation", "osha-evaluation", "niosh-office", "cuh-seating"],
  },
  {
    id: "desk-chair-and-feet",
    title: "Chair, back support, and feet",
    category: "desk",
    evidenceLevel: "guideline",
    signal:
      "The seat leaves the back or feet unsupported, presses behind the knees, or makes the user perch or reach for the floor.",
    claim:
      "OSHA workstation guidance recommends a stable, adjustable chair that supports the back and thighs while the feet rest on the floor or a footrest. Fit depends on the person and task.",
    actions: [
      "Adjust seat height so your feet rest securely; use a stable footrest when they do not reach.",
      "Let the backrest support you without forcing one rigid position.",
      "Leave comfortable clearance behind the knees and change position regularly.",
    ],
    limitations:
      "A camera cannot measure seat pressure, chair dimensions, circulation, comfort, disability needs, or whether a chair is safe and stable.",
    sourceIds: ["osha-workstation", "osha-positions", "osha-evaluation", "cuh-seating"],
  },
  {
    id: "desk-display-and-device",
    title: "Display, laptop, and phone position",
    category: "desk",
    evidenceLevel: "guideline",
    signal:
      "The display or handheld device repeatedly pulls the head down, to one side, or far forward.",
    claim:
      "OSHA recommends placing the main display directly in front, at a comfortable viewing distance, with the top around or below eye level. Laptop-only work can couple screen and keyboard positions, so accessories may improve adjustability.",
    actions: [
      "Center the main display and adjust height and distance until text is readable without leaning.",
      "For longer laptop use, consider a stable riser plus separate keyboard and pointing device.",
      "Bring a phone closer to eye level for short tasks, then lower your arms and change position.",
    ],
    limitations:
      "A camera cannot assess eyesight, font size, display quality, device stability, task duration, or the safest equipment arrangement for you.",
    sourceIds: ["osha-workstation", "osha-positions", "osha-evaluation", "cuh-seating"],
  },
  {
    id: "desk-input-and-reach",
    title: "Keyboard, mouse, forearms, and reach",
    category: "desk",
    evidenceLevel: "guideline",
    signal:
      "Frequently used controls require repeated reaching, lifted shoulders, unsupported forearms, or bent wrists.",
    claim:
      "OSHA guidance recommends placing keyboard and pointing devices close together and within comfortable reach, with shoulders relaxed and wrists near neutral. Contact pressure and repeated reaching also matter.",
    actions: [
      "Bring frequently used controls close and keep the mouse beside the keyboard.",
      "Support the forearms when comfortable without pressing a hard edge into the wrists or elbows.",
      "Move the whole task closer instead of repeatedly reaching from the shoulder.",
    ],
    limitations:
      "A camera cannot measure grip force, key force, repetition exposure, contact pressure, sensation, or upper-limb symptoms.",
    sourceIds: ["osha-workstation", "osha-evaluation", "niosh-risk-factors"],
  },
  {
    id: "desk-lighting-and-variation",
    title: "Lighting, glare, and task variation",
    category: "desk",
    evidenceLevel: "guideline",
    signal:
      "Glare, small text, or an unchanging task encourages squinting, leaning, or holding one position.",
    claim:
      "OSHA and NIOSH office guidance treats lighting, glare, task design, duration, and position changes as part of workstation ergonomics. Posture alone is not the whole exposure.",
    actions: [
      "Reduce reflections by repositioning the display, light, or blinds, and use readable text size.",
      "Alternate tasks and take short, user-controlled movement or visual breaks.",
      "Change position before discomfort builds instead of waiting for a camera warning.",
    ],
    limitations:
      "A camera cannot measure illuminance, glare, visual strain, workload, break needs, or total daily exposure.",
    sourceIds: ["osha-workstation", "osha-evaluation", "niosh-office", "niosh-risk-factors"],
  },
  {
    id: "forward-head",
    title: "Forward-head tendency",
    category: "head-and-neck",
    evidenceLevel: "systematic-review",
    signal: "In a supported side view, the ear appears forward of the shoulder and torso baseline.",
    claim:
      "A systematic review found therapeutic exercise can improve a forward-head measurement and may improve pain, while also stating that the exact posture-pain relationship remains uncertain.",
    actions: [
      "Gently bring your head back over your ribs without forcing your chin.",
      "Raise or move the screen closer so your eyes can look forward, then vary position.",
    ],
    limitations:
      "This is a 2D visual tendency, not a diagnosis of forward-head posture, neck injury, or the cause of pain.",
    sourceIds: ["forward-head-exercise", "posture-low-back-causality", "osha-positions"],
  },
  {
    id: "neck-flexion",
    title: "Neck inclination or screen-related bend",
    category: "head-and-neck",
    evidenceLevel: "guideline",
    signal: "The neck is visibly inclined for the selected side or three-quarter view.",
    claim:
      "OSHA recommends a balanced head and neck with the monitor at or just below eye level. NHS guidance also recommends avoiding one neck position for a long time.",
    actions: [
      "Lift the screen or phone and let your gaze travel forward.",
      "Relax your shoulders and change position instead of holding the bend.",
    ],
    limitations:
      "The app cannot see the screen, measure reading distance, or determine whether the position causes symptoms.",
    sourceIds: ["osha-workstation", "osha-evaluation", "nhs-neck-pain"],
  },
  {
    id: "rounded-shoulders",
    title: "Rounded shoulders or thoracic rounding",
    category: "head-and-neck",
    evidenceLevel: "systematic-review",
    signal:
      "A shoulder or upper-back appearance that may accompany forward-head or thoracic rounding.",
    claim:
      "A 2024 systematic review reported improvements in forward-head, rounded-shoulder, and thoracic-kyphosis measurements across therapeutic-exercise studies, but the intervention literature is heterogeneous.",
    actions: [
      "Let the shoulders settle down and back without pinching them together.",
      "Build general strength and mobility gradually; use a clinician or qualified coach for a persistent or painful problem.",
    ],
    limitations:
      "The current landmark set does not diagnose scapular position or structural hyperkyphosis, and a visible shape is not proof of a disorder.",
    sourceIds: ["forward-head-rounded-shoulder", "osha-positions", "medlineplus-kyphosis"],
  },
  {
    id: "slouching",
    title: "Slouched sitting or torso collapse",
    category: "trunk-and-spine",
    evidenceLevel: "guideline",
    signal: "The shoulders and torso drift away from the calibrated supported position.",
    claim:
      "Ergonomic guidance supports a supported, comfortable torso and warns that prolonged static or awkward positions can increase fatigue. It does not establish one rigid sitting angle for every person.",
    actions: [
      "Bring the ribs back over the hips gently and use the chair or backrest for support.",
      "Move the work closer or change position rather than bracing yourself upright all day.",
    ],
    limitations:
      "The camera estimates trunk orientation from landmarks; it cannot assess the lumbar spine, chair support, or pain mechanism.",
    sourceIds: [
      "osha-positions",
      "cuh-seating",
      "niosh-risk-factors",
      "posture-low-back-causality",
    ],
  },
  {
    id: "pelvic-tilt-and-lumbar-curve",
    title: "Anterior/posterior pelvic tilt and lumbar sway",
    category: "trunk-and-spine",
    evidenceLevel: "clinical-boundary",
    signal:
      "A side-view hip or trunk angle that may be described informally as swayback, anterior tilt, posterior tilt, or flat back.",
    claim:
      "Visible pelvic or trunk angle is not enough to diagnose hyperlordosis, flat back, or a lumbar disorder. Reviews have found no consensus that a particular spine posture causes low back pain.",
    actions: [
      "Return to a comfortable, supported position and vary it instead of forcing the pelvis into a shape.",
      "For persistent pain, weakness, numbness, or a known spinal condition, seek an in-person assessment.",
    ],
    limitations:
      "The current app does not measure lumbar curvature, pelvis orientation in 3D, symptoms, strength, or medical history.",
    sourceIds: ["posture-low-back-causality", "posture-low-back-scoping", "nice-low-back"],
  },
  {
    id: "lateral-asymmetry",
    title: "Uneven shoulders, hips, or lateral trunk lean",
    category: "asymmetry",
    evidenceLevel: "clinical-boundary",
    signal: "One side appears higher or the trunk leans relative to the camera frame.",
    claim:
      "Uneven shoulders or hips can be observed with scoliosis, but MedlinePlus states that diagnosis uses a clinical examination and often imaging. A camera cue should therefore be treated as possible asymmetry only.",
    actions: [
      "Center the camera, level the device, and relax both shoulders before interpreting the cue.",
      "If the asymmetry is persistent, painful, progressive, or associated with weakness or breathing difficulty, ask a clinician to assess it.",
    ],
    limitations:
      "Mirror settings, camera roll, stance, clothing, lens distortion, and natural anatomy can all create apparent asymmetry.",
    sourceIds: ["medlineplus-scoliosis", "osha-evaluation", "niosh-risk-factors"],
  },
  {
    id: "structural-kyphosis",
    title: "Kyphosis or a rounded spinal curve",
    category: "trunk-and-spine",
    evidenceLevel: "clinical-boundary",
    signal: "A rounded-back appearance in a still image or video.",
    claim:
      "Kyphosis is a spinal curve with multiple possible causes. MedlinePlus says a health professional examines it and may use imaging; the app cannot determine whether a rounded appearance is flexible posture or structural kyphosis.",
    actions: [
      "Use gentle movement and comfortable support; do not force a painful correction.",
      "Use professional assessment for a new, painful, progressive, or function-limiting curve.",
    ],
    limitations:
      "No camera-only result can diagnose kyphosis, Scheuermann disease, fracture, or another spinal condition.",
    sourceIds: ["medlineplus-kyphosis", "forward-head-rounded-shoulder", "nice-low-back"],
  },
  {
    id: "structural-scoliosis",
    title: "Scoliosis or a structural side curve",
    category: "asymmetry",
    evidenceLevel: "clinical-boundary",
    signal: "A persistent side-to-side appearance or uneven shoulders/hips.",
    claim:
      "Scoliosis is a structural sideways spinal curve. MedlinePlus notes that the curve may be difficult to judge visually and that examination plus X-ray may be needed; posture coaching cannot confirm or correct it.",
    actions: [
      "Treat a camera result as an observation and check the camera level and stance first.",
      "Ask a clinician for assessment rather than trying to self-correct a persistent curve with force.",
    ],
    limitations:
      "This app is not a scoliosis screening, Cobb-angle measurement, diagnostic tool, or treatment plan.",
    sourceIds: ["medlineplus-scoliosis", "posture-low-back-causality"],
  },
  {
    id: "rotation-and-twist",
    title: "Twisting or rotated task setup",
    category: "trunk-and-spine",
    evidenceLevel: "guideline",
    signal:
      "A task requires the head or trunk to face away from the working direction for a sustained interval.",
    claim:
      "NIOSH lists twisting and awkward postures as physical risk factors and recommends changing task design and exposure where possible.",
    actions: [
      "Turn the screen, chair, or task so you can face it without holding a twist.",
      "Alternate positions and take a short movement break if the task keeps pulling you off-center.",
    ],
    limitations:
      "The current camera view cannot reliably measure spinal rotation or distinguish a deliberate movement from a risky sustained twist.",
    sourceIds: ["niosh-risk-factors", "osha-evaluation"],
  },
  {
    id: "posture-pain-boundary",
    title: "Posture is not a pain diagnosis",
    category: "general",
    evidenceLevel: "clinical-boundary",
    signal: "Any posture label being interpreted as the cause of pain or injury.",
    claim:
      "A systematic review of systematic reviews found no consensus on a causal relationship between spine posture or physical exposure and low back pain. Guidance should be framed as self-management and movement options, not as a diagnosis.",
    actions: [
      "Use cues to explore a more comfortable movement option, not to chase a perfect angle.",
      "Stop if a movement causes pain and seek qualified care for persistent or concerning symptoms.",
    ],
    limitations:
      "This local tool does not ask about pain, neurological symptoms, injury, pregnancy, age, disability, or medical history.",
    sourceIds: ["posture-low-back-causality", "posture-low-back-scoping", "nice-low-back"],
  },
  {
    id: "movement-health",
    title: "Move more and sit less",
    category: "general",
    evidenceLevel: "guideline",
    signal: "A user wants a daily posture fix rather than a single frozen position.",
    claim:
      "WHO and CDC public-health guidance recommends reducing sedentary time and accumulating regular physical activity. CDC guidance for adults includes aerobic activity plus muscle strengthening on at least two days each week.",
    actions: [
      "Break up long sitting with movement that fits your ability and schedule.",
      "Build activity gradually; small amounts count, and variety helps avoid doing too much of one activity.",
    ],
    limitations:
      "Population activity guidance is not an individualized exercise prescription or a treatment for a specific condition.",
    sourceIds: ["who-activity", "cdc-adult-activity", "nice-low-back"],
  },
  {
    id: "comfortable-range",
    title: "Use a comfortable, individualized range",
    category: "exercise",
    evidenceLevel: "clinical-guidance",
    signal: "A squat, lunge, or push-up does not reach a selected range consistently.",
    claim:
      "NICE recommends exercise choices that are tailored to a person's needs, preferences, and capabilities. A camera should not impose one universal depth or range on every body.",
    actions: [
      "Reduce range or use an easier variation until the movement is controlled and comfortable.",
      "Progress gradually rather than forcing depth or speed to satisfy a sensor threshold.",
    ],
    limitations:
      "The app's range thresholds are movement-consistency heuristics, not clinical targets or proof of strength, mobility, or readiness.",
    sourceIds: ["nice-low-back", "pushup-load", "pushup-kinetics"],
  },
  {
    id: "dynamic-knee-valgus",
    title: "Dynamic knee tracking",
    category: "exercise",
    evidenceLevel: "systematic-review",
    signal:
      "During a front or three-quarter squat/lunge view, the knee moves substantially away from the hip-to-foot corridor.",
    claim:
      "A systematic review found that several exercise programs reduced dynamic knee valgus, although results varied and the review did not make a camera cue a diagnosis or injury prediction.",
    actions: [
      "Slow down and let the knee follow a comfortable line over the foot.",
      "Reduce range or load and use an easier variation if you cannot control the line without pain.",
    ],
    limitations:
      "The app sees a 2D projection, not 3D joint loading, foot mechanics, strength, injury risk, or a clinical knee disorder.",
    sourceIds: ["knee-valgus-exercise", "nice-low-back"],
  },
  {
    id: "squat-mode-guide",
    title: "Squat mode: depth and knee path are camera heuristics",
    category: "exercise",
    evidenceLevel: "clinical-boundary",
    signal:
      "In the selected view, the app compares visible hip depth and the 2D knee path with its local movement thresholds.",
    claim:
      "Exercise studies can describe knee movement or changes after training, but they do not validate this app's depth or knee-path cutoffs. Squat results are repeatability cues, not injury prediction or a universal form standard.",
    actions: [
      "Use the requested front view for knee-path cues and side view for depth cues.",
      "Choose a comfortable stance and range you can repeat without pain or loss of balance.",
      "Ignore the counter when tracking is unstable; reframe with hips, knees, ankles, and feet visible.",
    ],
    limitations:
      "The app cannot measure 3D joint loading, foot pressure, strength, mobility, fatigue, balance, pain, or whether squatting is appropriate for you.",
    sourceIds: [
      "knee-valgus-exercise",
      "markerless-dynamic-validation",
      "single-camera-markerless-review",
      "nice-low-back",
    ],
  },
  {
    id: "plank-mode-guide",
    title: "Plank mode: body-line consistency, not a safety grade",
    category: "exercise",
    evidenceLevel: "clinical-boundary",
    signal:
      "In a side view, the app compares the visible shoulder–hip–ankle line with the user's calibrated starting line.",
    claim:
      "Public-health guidance supports strengthening in general, but it does not validate one plank angle or this app's tolerance. The detector only reports visible line consistency relative to calibration.",
    actions: [
      "Use a stable surface and side view with shoulders, hips, and ankles visible.",
      "Choose a supported variation and duration you can manage without pain or breath-holding.",
      "Stop when position, footing, or control is no longer comfortable rather than chasing the timer.",
    ],
    limitations:
      "The app cannot assess breathing, internal pressure, load, fatigue, strength, joint symptoms, surface safety, or readiness for exercise.",
    sourceIds: [
      "cdc-adult-activity",
      "who-activity",
      "single-camera-markerless-review",
      "nice-low-back",
    ],
  },
  {
    id: "pushup-load-scaling",
    title: "Push-up mode: depth, load, and body-line scaling",
    category: "exercise",
    evidenceLevel: "biomechanics",
    signal: "The body line or elbow range changes during a side-view push-up.",
    claim:
      "Biomechanics studies show that push-up position and variation change the percentage of body mass supported by the upper limbs, and that range can be adapted for beginners or rehabilitation. The app therefore coaches consistency rather than a universal depth.",
    actions: [
      "Keep shoulders, hips, and heels moving as one controllable line.",
      "Use knees-down or a higher support surface to scale load and range when needed.",
      "Stop if the movement causes pain or you cannot keep the surface and hand position stable.",
    ],
    limitations:
      "These are movement cues, not a diagnosis or a prescription for shoulder, wrist, elbow, or back rehabilitation.",
    sourceIds: ["pushup-load", "pushup-kinetics", "nice-low-back"],
  },
  {
    id: "lunge-control",
    title: "Lunge mode: stance and controlled loading",
    category: "exercise",
    evidenceLevel: "biomechanics",
    signal:
      "The front and rear legs do not separate clearly or the front knee loses a stable path.",
    claim:
      "Biomechanical studies show that lunge variations distribute motion and loading differently across the hip, knee, and ankle. A stable split stance and controlled range are reasonable technique cues, not universal clinical rules.",
    actions: [
      "Set a split stance you can balance, then lower slowly with the front leg doing the intended work.",
      "Shorten the stance or range if balance or control is lost; stop if you feel pain.",
    ],
    limitations:
      "A single camera view cannot assess joint loading, balance strategy, prior injury, or whether a lunge is appropriate for you.",
    sourceIds: ["lunge-biomechanics", "nice-low-back"],
  },
  {
    id: "curl-mode-guide",
    title: "Curl mode: elbow consistency, not muscle assessment",
    category: "exercise",
    evidenceLevel: "clinical-boundary",
    signal:
      "In a front view, the app checks whether the visible elbow drifts substantially relative to the torso during a repetition.",
    claim:
      "This app's elbow-distance threshold is an unvalidated consistency heuristic. General strengthening guidance does not establish one correct curl path or let a camera infer muscle activation or training load.",
    actions: [
      "Use a stable stance, comfortable load, and front view with shoulders, elbows, and wrists visible.",
      "Reduce load or range if you need to swing or if the movement causes pain.",
      "Treat a counted repetition as a local movement event, not proof of training quality.",
    ],
    limitations:
      "The app cannot measure resistance, muscle activation, tendon load, grip, fatigue, pain, strength, or whether curls are appropriate for you.",
    sourceIds: [
      "cdc-adult-activity",
      "who-activity",
      "single-camera-markerless-review",
      "nice-low-back",
    ],
  },
  {
    id: "controlled-exercise",
    title: "Controlled movement is a coaching heuristic",
    category: "exercise",
    evidenceLevel: "guideline",
    signal: "A plank, curl, or repetition loses its selected body line or joint control.",
    claim:
      "The live evaluator uses body-line and elbow stability as observable consistency cues. Public-health guidance supports regular strengthening, but it does not make one camera-measured angle a medical standard.",
    actions: [
      "Use a slower tempo and a smaller range that you can repeat without pain.",
      "Rest or choose an easier variation when the line cannot be maintained.",
    ],
    limitations:
      "The app cannot measure internal load, breathing strategy, effort, pain, or readiness for training.",
    sourceIds: ["cdc-adult-activity", "who-activity", "nice-low-back"],
  },
] as const satisfies readonly PostureEvidence[];

export type PostureEvidenceId = (typeof POSTURE_EVIDENCE)[number]["id"];

export const POSTURE_EVIDENCE_BY_ID = Object.fromEntries(
  POSTURE_EVIDENCE.map((entry) => [entry.id, entry]),
) as unknown as Record<PostureEvidenceId, PostureEvidence>;

export const ISSUE_EVIDENCE_IDS: Record<IssueCode, readonly PostureEvidenceId[]> = {
  standing_head_alignment: ["standing-alignment", "forward-head"],
  standing_trunk_alignment: ["standing-alignment", "posture-pain-boundary"],
  standing_lateral_asymmetry: ["standing-alignment", "lateral-asymmetry"],
  head_forward: ["forward-head"],
  neck_inclination: ["neck-flexion"],
  shoulder_imbalance: ["lateral-asymmetry"],
  torso_inclination: ["slouching"],
  prolonged_slouch: ["static-posture", "slouching"],
  squat_depth: ["squat-mode-guide", "comfortable-range"],
  squat_knee_alignment: ["squat-mode-guide", "dynamic-knee-valgus"],
  plank_alignment: ["plank-mode-guide"],
  pushup_body_line: ["pushup-load-scaling"],
  pushup_depth: ["pushup-load-scaling", "comfortable-range"],
  lunge_alignment: ["lunge-control"],
  curl_control: ["curl-mode-guide"],
  positioning: ["camera-measurement-limits", "calibration-and-confidence"],
};

export const MODE_GUIDE_EVIDENCE_IDS: Record<AnalysisMode, readonly PostureEvidenceId[]> = {
  standing: ["standing-alignment", "calibration-and-confidence"],
  desk: ["desk-setup", "static-posture"],
  squat: ["squat-mode-guide", "comfortable-range"],
  plank: ["plank-mode-guide"],
  pushup: ["pushup-load-scaling"],
  lunge: ["lunge-control"],
  curl: ["curl-mode-guide"],
};

export type ThresholdProvenance = "product-heuristic" | "operational-only";

export interface IssueMeasurementStatus {
  validationStatus: "unvalidated";
  thresholdProvenance: ThresholdProvenance;
  note: string;
}

const HEURISTIC_MEASUREMENT_NOTE =
  "This trigger is a product heuristic for repeatable coaching, not a validated clinical cutoff or safety test.";

export const ISSUE_MEASUREMENT_STATUS: Record<IssueCode, IssueMeasurementStatus> = {
  standing_head_alignment: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  standing_trunk_alignment: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  standing_lateral_asymmetry: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  head_forward: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  neck_inclination: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  shoulder_imbalance: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  torso_inclination: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  prolonged_slouch: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  squat_depth: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  squat_knee_alignment: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  plank_alignment: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  pushup_body_line: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  pushup_depth: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  lunge_alignment: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  curl_control: {
    validationStatus: "unvalidated",
    thresholdProvenance: "product-heuristic",
    note: HEURISTIC_MEASUREMENT_NOTE,
  },
  positioning: {
    validationStatus: "unvalidated",
    thresholdProvenance: "operational-only",
    note: "This is a framing and visibility check, not a posture finding or health assessment.",
  },
};

export function evidenceIdsForIssue(issueCode: IssueCode): readonly PostureEvidenceId[] {
  return ISSUE_EVIDENCE_IDS[issueCode];
}

export function evidenceIdsForMode(mode: AnalysisMode): readonly PostureEvidenceId[] {
  return MODE_GUIDE_EVIDENCE_IDS[mode];
}

export function measurementStatusForIssue(issueCode: IssueCode): IssueMeasurementStatus {
  return ISSUE_MEASUREMENT_STATUS[issueCode];
}

export function evidenceForIds(ids: readonly string[] | undefined): PostureEvidence[] {
  return (ids ?? []).flatMap((id) => {
    const entry = POSTURE_EVIDENCE_BY_ID[id as PostureEvidenceId];
    return entry ? [entry] : [];
  });
}

export interface PostureEvidenceQuery {
  category?: EvidenceCategoryFilter;
  query?: string;
}

function normalizeEvidenceQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findPostureEvidence({
  category = "all",
  query = "",
}: PostureEvidenceQuery = {}): PostureEvidence[] {
  const terms = normalizeEvidenceQuery(query).split(" ").filter(Boolean);

  return POSTURE_EVIDENCE.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (terms.length === 0) return true;

    const searchableText = normalizeEvidenceQuery(
      [entry.title, entry.signal, entry.claim, entry.actions.join(" "), entry.limitations].join(
        " ",
      ),
    );
    return terms.every((term) => searchableText.includes(term));
  });
}
