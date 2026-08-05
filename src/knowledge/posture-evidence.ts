import type { IssueCode } from "../domain/contracts";

export const POSTURE_EVIDENCE_CACHE_VERSION = "2026-08-06";

export type EvidenceType =
  | "government-guideline"
  | "clinical-guidance"
  | "clinical-reference"
  | "systematic-review"
  | "scoping-review"
  | "biomechanics-study";

export type EvidenceLevel =
  "guideline" | "systematic-review" | "clinical-guidance" | "clinical-boundary" | "biomechanics";

export type EvidenceCategory =
  "general" | "desk" | "head-and-neck" | "trunk-and-spine" | "asymmetry" | "exercise";

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
    id: "pushup-load-scaling",
    title: "Push-up depth and body-line scaling",
    category: "exercise",
    evidenceLevel: "biomechanics",
    signal: "The body line or elbow range changes during a side-view push-up.",
    claim:
      "Biomechanics studies show that push-up position and variation change the percentage of body mass supported by the upper limbs, and that range can be adapted for beginners or rehabilitation. The app therefore coaches consistency rather than a universal depth.",
    actions: [
      "Keep shoulders, hips, and heels moving as one controllable line.",
      "Use knees-down or a higher support surface to scale load and range when needed.",
    ],
    limitations:
      "These are movement cues, not a diagnosis or a prescription for shoulder, wrist, elbow, or back rehabilitation.",
    sourceIds: ["pushup-load", "pushup-kinetics", "nice-low-back"],
  },
  {
    id: "lunge-control",
    title: "Lunge stance and controlled loading",
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
  head_forward: ["forward-head"],
  neck_inclination: ["neck-flexion"],
  shoulder_imbalance: ["lateral-asymmetry"],
  torso_inclination: ["slouching"],
  prolonged_slouch: ["static-posture", "slouching"],
  squat_depth: ["comfortable-range"],
  squat_knee_alignment: ["dynamic-knee-valgus"],
  plank_alignment: ["controlled-exercise"],
  pushup_body_line: ["pushup-load-scaling"],
  pushup_depth: ["pushup-load-scaling", "comfortable-range"],
  lunge_alignment: ["lunge-control"],
  curl_control: ["controlled-exercise"],
  positioning: ["neutral-posture"],
};

export function evidenceIdsForIssue(issueCode: IssueCode): readonly PostureEvidenceId[] {
  return ISSUE_EVIDENCE_IDS[issueCode];
}

export function evidenceForIds(ids: readonly string[] | undefined): PostureEvidence[] {
  return (ids ?? []).flatMap((id) => {
    const entry = POSTURE_EVIDENCE_BY_ID[id as PostureEvidenceId];
    return entry ? [entry] : [];
  });
}
