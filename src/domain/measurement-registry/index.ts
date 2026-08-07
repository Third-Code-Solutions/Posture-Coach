import type { AnalysisMode, CameraView, IssueCode } from "../contracts";

export const MEASUREMENT_REGISTRY_VERSION = "2026-08-08.1";

export const MEASUREMENT_THRESHOLDS = {
  inference: {
    maximumPoseCount: 1,
    detailFrameDimension: 720,
    balancedFrameDimension: 576,
    recoveryFrameDimension: 480,
    slowLatencyMs: 350,
    criticalLatencyMs: 900,
    recoveryLatencyMs: 160,
    slowSamplesToDownshift: 4,
    criticalSamplesToDownshift: 2,
    fastSamplesToRecover: 24,
    cooldownSamplesAfterChange: 8,
  },
  confidence: {
    modelPoseDetectionScore: 0.55,
    modelPosePresenceScore: 0.55,
    modelTrackingScore: 0.55,
    minimumImagePoseScore: 0.45,
    minimumOverlayLandmarkScore: 0.45,
    minimumCalibrationViewPoseScore: 0.6,
    minimumLandmarkScore: 0.58,
    minimumPoseScore: 0.5,
    highConfidenceScore: 0.82,
    minimumObservedViewConfidence: 0.4,
    mixedEvidenceCoverage: 0.45,
    highEvidenceCoverage: 0.75,
  },
  geometry: {
    minimumDistance: 1e-6,
    minimumNormalizedScale: 0.001,
    straightAngleDegrees: 180,
  },
  calibration: {
    sampleTarget: 12,
    maximumSampleGapMs: 1_000,
    torsoAbsoluteRange: 0.035,
    torsoRelativeRange: 0.16,
    deskMetricRange: 0.08,
    standingHeadRange: 0.1,
    standingBodyLeanRange: 0.06,
    standingTiltRange: 0.1,
    movementAbsoluteRangeDegrees: 8,
    movementRelativeRange: 0.08,
    extraMetricAbsoluteRange: 0.035,
    extraMetricRelativeRange: 0.16,
  },
  framing: {
    minimumTorsoRatio: 0.65,
    maximumTorsoRatio: 1.35,
    torsoRatioDeviation: 0.35,
    minimumHeadMargin: 0.02,
    maximumFeetCoordinate: 0.985,
  },
  desk: {
    shoulderTiltRatio: 0.07,
    headOffsetRatio: 0.12,
    neckInclinationDegrees: 18,
    torsoInclinationDegrees: 14,
    prolongedTorsoInclinationDegrees: 20,
  },
  standing: {
    headDriftRatio: 0.14,
    bodyDriftRatio: 0.08,
    lateralDriftRatio: 0.12,
  },
  exercise: {
    defaultDownDegrees: {
      squat: 105,
      lunge: 110,
      pushup: 100,
      curl: 75,
    },
    defaultEntryOffsetDegrees: 30,
    defaultEntryMaximumDegrees: 155,
    defaultUpDegrees: 160,
    calibratedDown: {
      squat: { offset: 62, minimum: 88, maximum: 125 },
      lunge: { offset: 55, minimum: 95, maximum: 130 },
      pushup: { offset: 65, minimum: 72, maximum: 115 },
      curl: { offset: 82, minimum: 55, maximum: 105 },
    },
    calibratedEntryOffsetDegrees: 28,
    calibratedEntryMaximumDegrees: 160,
    calibratedUpOffsetDegrees: 12,
    calibratedUpMinimumDegrees: 145,
    calibratedUpMaximumDegrees: 175,
    bottomPhaseMarginDegrees: 4,
    partialRangeMaximumDegrees: 140,
    defaultBodyLineToleranceDegrees: 16,
    minimumBodyLineToleranceDegrees: 10,
    calibratedBodyLineMarginDegrees: 8,
    minimumLungeStanceRatio: 0.8,
    calibratedLungeStanceMultiplier: 0.65,
    kneeAlignmentDeviation: 0.12,
    minimumCurlFlareRatio: 0.5,
    fallbackCurlFlareBaseline: 0.28,
    calibratedCurlFlareMargin: 0.22,
  },
  temporal: {
    standardIssuePersistenceMs: 900,
    standingIssuePersistenceMs: 650,
    prolongedSlouchPersistenceMs: 15_000,
    minimumRepDwellMs: 250,
    minimumRepCooldownMs: 550,
    minimumAlignmentPersistenceMs: 450,
    minimumSubmittedTimestampStepMs: 0.1,
    defaultSmootherAlphaAtReferenceFrame: 0.35,
    evaluatorSmootherAlphaAtReferenceFrame: 0.58,
    visualSmootherAlphaAtReferenceFrame: 0.72,
    minimumSmootherAlpha: 0.01,
    maximumSmootherAlpha: 0.99,
    smootherReferenceIntervalMs: 33,
    smootherResetGapMs: 800,
  },
  viewEstimate: {
    shoulderWidthWeight: 0.65,
    hipWidthWeight: 0.35,
    sideWidthCenter: 0.58,
    sideWidthSpan: 0.28,
    frontWidthCenter: 0.48,
    frontWidthSpan: 0.3,
    shoulderDepthScale: 0.35,
    planarEvidenceWeight: 0.72,
    depthEvidenceWeight: 0.28,
    threeQuarterEvidenceWeight: 0.72,
  },
} as const;

export type MeasurementRuleCategory = "framing" | "posture" | "movement";
export type MeasurementUnit =
  | "normalized-image-coordinate"
  | "torso-length ratio"
  | "body-height ratio"
  | "degrees"
  | "score"
  | "count"
  | "milliseconds"
  | "pixels";
export type MeasurementProvenance = "product-heuristic" | "operational-only";

export interface MeasurementThresholdDefinition {
  kind: "fixed" | "range" | "adaptive" | "compound";
  values: readonly number[];
  display: string;
  formula?: string;
}

export interface MeasurementRuleRevision {
  version: string;
  date: string;
  change: string;
}

export interface MeasurementRule {
  id: string;
  label: string;
  category: MeasurementRuleCategory;
  issueCodes: readonly IssueCode[];
  modes: readonly AnalysisMode[];
  views: readonly CameraView[];
  metric: string;
  unit: MeasurementUnit;
  threshold: MeasurementThresholdDefinition;
  persistenceMs: number;
  temporalPolicyLabel?: string;
  provenance: MeasurementProvenance;
  validationStatus: "unvalidated";
  rationale: string;
  limitation: string;
  history: readonly MeasurementRuleRevision[];
}

const initialRevision = (change: string): readonly MeasurementRuleRevision[] => [
  { version: "2026-08-07.1", date: "2026-08-07", change },
];

const currentRevision = (change: string): readonly MeasurementRuleRevision[] => [
  { version: MEASUREMENT_REGISTRY_VERSION, date: "2026-08-08", change },
];

const heuristicLimitation =
  "Single-camera 2D geometry varies with camera placement, clothing, occlusion, and individual anatomy. This rule is not a diagnosis, safety test, or clinical cutoff.";

export const MEASUREMENT_RULES = [
  {
    id: "capture-landmark-confidence",
    label: "Required landmark confidence",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Pose score and minimum visibility for the required or best alternative body chain",
    unit: "score",
    threshold: {
      kind: "compound",
      values: [
        MEASUREMENT_THRESHOLDS.confidence.minimumPoseScore,
        MEASUREMENT_THRESHOLDS.confidence.minimumLandmarkScore,
      ],
      display: `Pose score at least ${MEASUREMENT_THRESHOLDS.confidence.minimumPoseScore}; every landmark in the selected required body chain at least ${MEASUREMENT_THRESHOLDS.confidence.minimumLandmarkScore}`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "Form advice pauses when required body points are not visible enough for deterministic geometry.",
    limitation:
      "Model confidence estimates landmark observability. It is not confidence that posture is healthy or safe.",
    history: initialRevision("Published the existing required-landmark confidence gate."),
  },
  {
    id: "image-pose-confidence",
    label: "Still-image pose confidence",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Pose confidence for a local still-image landmark preview",
    unit: "score",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.confidence.minimumImagePoseScore],
      display: `At least ${MEASUREMENT_THRESHOLDS.confidence.minimumImagePoseScore} pose confidence`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "A still-image overlay is shown only when the local pose model returns enough confidence for a landmark preview.",
    limitation:
      "This gate supports a one-frame landmark preview only. It does not evaluate movement, posture health, pain, injury, or safety.",
    history: initialRevision("Published the local still-image pose-confidence gate."),
  },
  {
    id: "capture-view-confidence",
    label: "Observed camera-view confidence",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Conservative front, side, or three-quarter orientation estimate",
    unit: "score",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.confidence.minimumObservedViewConfidence],
      display: `At least ${MEASUREMENT_THRESHOLDS.confidence.minimumObservedViewConfidence} view confidence and compatible with selected mode`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "View-specific measurements stop when projected geometry cannot support the selected camera angle.",
    limitation:
      "Orientation is estimated from one projected pose and can be uncertain with occlusion or camera roll.",
    history: initialRevision("Published the existing observed-view compatibility gate."),
  },
  {
    id: "capture-geometry-validity",
    label: "Finite geometry gate",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Required projected segments remain finite and non-degenerate",
    unit: "normalized-image-coordinate",
    threshold: {
      kind: "compound",
      values: [
        MEASUREMENT_THRESHOLDS.geometry.minimumDistance,
        MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale,
      ],
      display: `Finite segment length at least ${MEASUREMENT_THRESHOLDS.geometry.minimumDistance}; normalized scale floor ${MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale}`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "Degenerate points would make angles and normalized ratios undefined, so evaluation abstains.",
    limitation:
      "Passing this numerical guard only means calculations are finite; it does not validate anatomical accuracy.",
    history: initialRevision("Published finite-number and minimum-segment guards."),
  },
  {
    id: "capture-monotonic-frame-time",
    label: "Fresh frame ordering",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Current inference timestamp minus previous accepted timestamp",
    unit: "milliseconds",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.temporal.minimumSubmittedTimestampStepMs],
      display: `At least ${MEASUREMENT_THRESHOLDS.temporal.minimumSubmittedTimestampStepMs}ms newer; duplicate or out-of-order results are rejected`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "Monotonic timestamps prevent delayed worker responses from rewinding temporal state.",
    limitation:
      "This orders local observations only and does not measure end-to-end camera latency.",
    history: initialRevision("Published the existing stale-frame rejection rule."),
  },
  {
    id: "capture-adaptive-inference",
    label: "Adaptive local inference budget",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Longest local inference-frame edge selected from sustained capture-to-result latency",
    unit: "pixels",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.inference.detailFrameDimension,
        MEASUREMENT_THRESHOLDS.inference.balancedFrameDimension,
        MEASUREMENT_THRESHOLDS.inference.recoveryFrameDimension,
        MEASUREMENT_THRESHOLDS.inference.slowLatencyMs,
        MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs,
        MEASUREMENT_THRESHOLDS.inference.recoveryLatencyMs,
        MEASUREMENT_THRESHOLDS.inference.slowSamplesToDownshift,
        MEASUREMENT_THRESHOLDS.inference.criticalSamplesToDownshift,
        MEASUREMENT_THRESHOLDS.inference.fastSamplesToRecover,
        MEASUREMENT_THRESHOLDS.inference.cooldownSamplesAfterChange,
      ],
      display: `${MEASUREMENT_THRESHOLDS.inference.detailFrameDimension}/${MEASUREMENT_THRESHOLDS.inference.balancedFrameDimension}/${MEASUREMENT_THRESHOLDS.inference.recoveryFrameDimension}px profiles; downshift after ${MEASUREMENT_THRESHOLDS.inference.slowSamplesToDownshift} results at â‰¥${MEASUREMENT_THRESHOLDS.inference.slowLatencyMs}ms or ${MEASUREMENT_THRESHOLDS.inference.criticalSamplesToDownshift} at â‰¥${MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs}ms; recover after ${MEASUREMENT_THRESHOLDS.inference.fastSamplesToRecover} at â‰¤${MEASUREMENT_THRESHOLDS.inference.recoveryLatencyMs}ms`,
      formula:
        "Hysteretic three-profile state machine using consecutive capture-to-result latency samples",
    },
    persistenceMs: 0,
    temporalPolicyLabel: "sample-window hysteresis",
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "Sustained latency lowers local preprocessing cost on weaker devices while retaining the Full pose model, full-frame preview, and one-frame backpressure.",
    limitation:
      "Resolution adaptation cannot guarantee zero delay or identical accuracy on every camera and processor. Physical-device validation remains required.",
    history: currentRevision(
      "Added hysteretic adaptive input sizing for sustained mobile latency.",
    ),
  },
  {
    id: "calibration-stable-window",
    label: "Stable calibration window",
    category: "framing",
    issueCodes: [],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Accepted stable observations for the selected mode, view, and mirror state",
    unit: "count",
    threshold: {
      kind: "compound",
      values: [
        MEASUREMENT_THRESHOLDS.calibration.sampleTarget,
        MEASUREMENT_THRESHOLDS.calibration.maximumSampleGapMs,
        MEASUREMENT_THRESHOLDS.calibration.torsoAbsoluteRange,
        MEASUREMENT_THRESHOLDS.calibration.torsoRelativeRange,
        MEASUREMENT_THRESHOLDS.calibration.deskMetricRange,
        MEASUREMENT_THRESHOLDS.calibration.standingHeadRange,
        MEASUREMENT_THRESHOLDS.calibration.standingBodyLeanRange,
        MEASUREMENT_THRESHOLDS.calibration.standingTiltRange,
        MEASUREMENT_THRESHOLDS.calibration.movementAbsoluteRangeDegrees,
        MEASUREMENT_THRESHOLDS.calibration.movementRelativeRange,
        MEASUREMENT_THRESHOLDS.calibration.extraMetricAbsoluteRange,
        MEASUREMENT_THRESHOLDS.calibration.extraMetricRelativeRange,
      ],
      display: `${MEASUREMENT_THRESHOLDS.calibration.sampleTarget} samples; gaps ≤ ${MEASUREMENT_THRESHOLDS.calibration.maximumSampleGapMs}ms; torso spread ≤ max(${MEASUREMENT_THRESHOLDS.calibration.torsoAbsoluteRange}, ${MEASUREMENT_THRESHOLDS.calibration.torsoRelativeRange * 100}%); desk ≤ ${MEASUREMENT_THRESHOLDS.calibration.deskMetricRange}; standing head/lean/tilt ≤ ${MEASUREMENT_THRESHOLDS.calibration.standingHeadRange}/${MEASUREMENT_THRESHOLDS.calibration.standingBodyLeanRange}/${MEASUREMENT_THRESHOLDS.calibration.standingTiltRange}; movement spread ≤ max(${MEASUREMENT_THRESHOLDS.calibration.movementAbsoluteRangeDegrees}°, ${MEASUREMENT_THRESHOLDS.calibration.movementRelativeRange * 100}%); extra metrics ≤ max(${MEASUREMENT_THRESHOLDS.calibration.extraMetricAbsoluteRange}, ${MEASUREMENT_THRESHOLDS.calibration.extraMetricRelativeRange * 100}%)`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "A short stable baseline supports camera-relative comparisons without treating one frame as personal posture truth.",
    limitation:
      "Calibration records a visual baseline for this source and view; it does not learn medically correct posture.",
    history: initialRevision("Published calibration sample and continuity requirements."),
  },
  {
    id: "rep-phase-timing",
    label: "Repetition timing",
    category: "movement",
    issueCodes: [],
    modes: ["squat", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Elapsed movement-phase dwell and time since last accepted repetition",
    unit: "milliseconds",
    threshold: {
      kind: "compound",
      values: [
        MEASUREMENT_THRESHOLDS.temporal.minimumRepDwellMs,
        MEASUREMENT_THRESHOLDS.temporal.minimumRepCooldownMs,
      ],
      display: `At least ${MEASUREMENT_THRESHOLDS.temporal.minimumRepDwellMs}ms dwell and ${MEASUREMENT_THRESHOLDS.temporal.minimumRepCooldownMs}ms cooldown`,
    },
    persistenceMs: 0,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Minimum dwell and cooldown suppress threshold jitter, duplicate counts, and implausibly fast phase changes.",
    limitation:
      "These timing values are product settings for stable counting, not an exercise tempo prescription.",
    history: initialRevision("Published repetition dwell and cooldown settings."),
  },
  {
    id: "rep-alignment-persistence",
    label: "Repetition alignment persistence",
    category: "movement",
    issueCodes: [],
    modes: ["squat", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Continuous duration of the exact active alignment rule during a repetition",
    unit: "milliseconds",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.temporal.minimumAlignmentPersistenceMs],
      display: `At least ${MEASUREMENT_THRESHOLDS.temporal.minimumAlignmentPersistenceMs}ms before rejecting a repetition`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.minimumAlignmentPersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Alignment must persist before it can invalidate a repetition, reducing transient landmark-noise rejections.",
    limitation:
      "Persistence improves deterministic stability but does not validate biomechanics, safety, or injury risk.",
    history: initialRevision("Published exact alignment-rejection persistence."),
  },
  {
    id: "framing-torso-distance",
    label: "Calibrated camera distance",
    category: "framing",
    issueCodes: ["positioning"],
    modes: ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Current shoulder-to-hip length divided by calibrated shoulder-to-hip length",
    unit: "torso-length ratio",
    threshold: {
      kind: "range",
      values: [
        MEASUREMENT_THRESHOLDS.framing.minimumTorsoRatio,
        MEASUREMENT_THRESHOLDS.framing.maximumTorsoRatio,
      ],
      display: `Pause outside ${MEASUREMENT_THRESHOLDS.framing.minimumTorsoRatio}–${MEASUREMENT_THRESHOLDS.framing.maximumTorsoRatio}× calibrated torso size`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "Large framing changes make normalized pose comparisons unreliable, so coaching pauses until camera distance returns near calibration.",
    limitation:
      "This checks framing consistency only. It says nothing about posture quality or health.",
    history: initialRevision("Extracted existing live framing gate into auditable registry."),
  },
  {
    id: "framing-whole-body",
    label: "Whole-body frame margin",
    category: "framing",
    issueCodes: ["positioning"],
    modes: ["standing", "squat", "plank", "pushup", "lunge", "curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Head, ankle, heel, and toe extremities inside normalized image width and height",
    unit: "normalized-image-coordinate",
    threshold: {
      kind: "range",
      values: [
        MEASUREMENT_THRESHOLDS.framing.minimumHeadMargin,
        MEASUREMENT_THRESHOLDS.framing.maximumFeetCoordinate,
      ],
      display: `Head, heels, and toes kept between ${MEASUREMENT_THRESHOLDS.framing.minimumHeadMargin} and ${MEASUREMENT_THRESHOLDS.framing.maximumFeetCoordinate} on both image axes`,
    },
    persistenceMs: 0,
    provenance: "operational-only",
    validationStatus: "unvalidated",
    rationale:
      "Full-body standing and exercise coaching needs visible head and feet with a small image-edge margin.",
    limitation: "Image-edge visibility is a capture check, not a posture assessment.",
    history: initialRevision("Extended the full-body framing gate to every non-desk mode."),
  },
  {
    id: "desk-shoulder-level",
    label: "Shoulder level",
    category: "posture",
    issueCodes: ["shoulder_imbalance"],
    modes: ["desk"],
    views: ["front", "three-quarter"],
    metric: "Absolute shoulder height difference divided by torso length",
    unit: "torso-length ratio",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.desk.shoulderTiltRatio],
      display: `> ${MEASUREMENT_THRESHOLDS.desk.shoulderTiltRatio} torso lengths`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Requires a visible, sustained side-to-side difference before offering a gentle desk adjustment.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented existing desk shoulder-level trigger."),
  },
  {
    id: "desk-head-forward",
    label: "Head-forward tendency",
    category: "posture",
    issueCodes: ["head_forward"],
    modes: ["desk"],
    views: ["side", "three-quarter"],
    metric: "Horizontal ear-to-shoulder offset divided by torso length",
    unit: "torso-length ratio",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.desk.headOffsetRatio],
      display: `> ${MEASUREMENT_THRESHOLDS.desk.headOffsetRatio} torso lengths`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Normalizing by torso length reduces sensitivity to camera distance while persistence suppresses brief movements.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented existing desk head-offset trigger."),
  },
  {
    id: "desk-neck-inclination",
    label: "Neck inclination",
    category: "posture",
    issueCodes: ["neck_inclination"],
    modes: ["desk"],
    views: ["side", "three-quarter"],
    metric: "Projected ear-to-shoulder deviation from vertical",
    unit: "degrees",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.desk.neckInclinationDegrees],
      display: `> ${MEASUREMENT_THRESHOLDS.desk.neckInclinationDegrees}° from image vertical`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "A sustained projected angle provides a simple screen-height coaching signal without claiming cervical diagnosis.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented existing desk neck-angle trigger."),
  },
  {
    id: "desk-torso-inclination",
    label: "Torso inclination",
    category: "posture",
    issueCodes: ["torso_inclination"],
    modes: ["desk"],
    views: ["side", "three-quarter"],
    metric: "Projected shoulder-midpoint to hip-midpoint deviation from vertical",
    unit: "degrees",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.desk.torsoInclinationDegrees],
      display: `> ${MEASUREMENT_THRESHOLDS.desk.torsoInclinationDegrees}° from image vertical`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Offers a gentle desk-distance or rib-over-hip cue only after a sustained projected lean.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented existing desk torso-angle trigger."),
  },
  {
    id: "desk-prolonged-slouch",
    label: "Prolonged slouch tendency",
    category: "posture",
    issueCodes: ["prolonged_slouch"],
    modes: ["desk"],
    views: ["side", "three-quarter"],
    metric: "Projected shoulder-midpoint to hip-midpoint deviation from vertical",
    unit: "degrees",
    threshold: {
      kind: "compound",
      values: [
        MEASUREMENT_THRESHOLDS.desk.prolongedTorsoInclinationDegrees,
        MEASUREMENT_THRESHOLDS.temporal.prolongedSlouchPersistenceMs,
      ],
      display: `> ${MEASUREMENT_THRESHOLDS.desk.prolongedTorsoInclinationDegrees}° sustained for ${MEASUREMENT_THRESHOLDS.temporal.prolongedSlouchPersistenceMs / 1_000} seconds`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.prolongedSlouchPersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Long persistence separates a maintained desk position from ordinary reaching or repositioning.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented existing prolonged desk-position trigger and hold time."),
  },
  {
    id: "standing-head-drift",
    label: "Standing head alignment drift",
    category: "posture",
    issueCodes: ["standing_head_alignment"],
    modes: ["standing"],
    views: ["side", "three-quarter"],
    metric: "Change in ear-to-shoulder offset from calibrated relaxed baseline",
    unit: "torso-length ratio",
    threshold: {
      kind: "compound",
      values: [MEASUREMENT_THRESHOLDS.standing.headDriftRatio],
      display: `> ${MEASUREMENT_THRESHOLDS.standing.headDriftRatio} drift and > ${MEASUREMENT_THRESHOLDS.standing.headDriftRatio} absolute offset`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standingIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Uses each user’s relaxed baseline and requires both material drift and material absolute offset.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated standing head-drift trigger."),
  },
  {
    id: "standing-trunk-drift",
    label: "Standing trunk alignment drift",
    category: "posture",
    issueCodes: ["standing_trunk_alignment"],
    modes: ["standing"],
    views: ["side", "three-quarter"],
    metric: "Change in shoulder-to-ankle lean from calibrated relaxed baseline",
    unit: "body-height ratio",
    threshold: {
      kind: "compound",
      values: [MEASUREMENT_THRESHOLDS.standing.bodyDriftRatio],
      display: `> ${MEASUREMENT_THRESHOLDS.standing.bodyDriftRatio} drift and > ${MEASUREMENT_THRESHOLDS.standing.bodyDriftRatio} absolute lean`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standingIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Combines personal baseline drift with an absolute projected lean to avoid cueing small baseline differences.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated standing trunk-drift trigger."),
  },
  {
    id: "standing-lateral-drift",
    label: "Standing side-to-side difference",
    category: "posture",
    issueCodes: ["standing_lateral_asymmetry"],
    modes: ["standing"],
    views: ["front", "three-quarter"],
    metric: "Largest shoulder or hip tilt change from calibrated relaxed baseline",
    unit: "torso-length ratio",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.standing.lateralDriftRatio],
      display: `> ${MEASUREMENT_THRESHOLDS.standing.lateralDriftRatio} torso lengths`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standingIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Uses a baseline-relative front-plane difference and prompts camera leveling before body correction.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated standing lateral-drift trigger."),
  },
  {
    id: "squat-knee-tracking",
    label: "Squat knee tracking",
    category: "movement",
    issueCodes: ["squat_knee_alignment"],
    modes: ["squat"],
    views: ["front", "three-quarter"],
    metric: "Largest knee distance from projected hip-to-ankle midpoint",
    unit: "normalized-image-coordinate",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation],
      display: `> ${MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation} image width`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Front-plane cue appears only when projected knee tracking departs materially from the hip-to-foot corridor.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented existing squat knee-tracking trigger."),
  },
  {
    id: "squat-range",
    label: "Squat selected range",
    category: "movement",
    issueCodes: ["squat_depth"],
    modes: ["squat"],
    views: ["front", "side", "three-quarter"],
    metric: "Selected knee angle compared with calibrated standing angle",
    unit: "degrees",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.minimum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.maximum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.offset,
      ],
      display: `Calibration − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.offset}°, clamped to ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.minimum}–${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.maximum}°; fallback ${MEASUREMENT_THRESHOLDS.exercise.defaultDownDegrees.squat}°`,
      formula: `clamp(calibratedTop − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.offset}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.minimum}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.maximum}°)`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Uses a personal top-position baseline to coach repeatable range instead of prescribing universal squat depth.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated squat range formula and fallback."),
  },
  {
    id: "lunge-split-stance",
    label: "Lunge split stance",
    category: "movement",
    issueCodes: ["lunge_alignment"],
    modes: ["lunge"],
    views: ["front", "side", "three-quarter"],
    metric: "Torso-normalized ankle separation along the estimated sagittal movement axis",
    unit: "torso-length ratio",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.minimumLungeStanceRatio,
        MEASUREMENT_THRESHOLDS.exercise.calibratedLungeStanceMultiplier,
      ],
      display: `At least ${MEASUREMENT_THRESHOLDS.exercise.minimumLungeStanceRatio} torso lengths or ${MEASUREMENT_THRESHOLDS.exercise.calibratedLungeStanceMultiplier * 100}% of calibrated stance separation`,
      formula: `max(${MEASUREMENT_THRESHOLDS.exercise.minimumLungeStanceRatio}, calibratedStance × ${MEASUREMENT_THRESHOLDS.exercise.calibratedLungeStanceMultiplier})`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Rejects lateral wide-stance squats by projecting world-space ankle separation perpendicular to the shoulder axis, with view-specific projected fallback.",
    limitation:
      "Front view falls back to projected vertical foot separation when world orientation is unavailable; side view falls back to projected horizontal separation; ambiguous three-quarter evidence abstains. This remains an unvalidated coaching heuristic, not a clinical cutoff.",
    history: initialRevision(
      "Documented direction-aware, torso-normalized lunge stance gate with conservative view-specific fallback.",
    ),
  },
  {
    id: "lunge-knee-tracking",
    label: "Lunge knee tracking",
    category: "movement",
    issueCodes: ["lunge_alignment"],
    modes: ["lunge"],
    views: ["front", "three-quarter"],
    metric: "Largest visible knee distance from its projected hip-to-ankle midpoint",
    unit: "normalized-image-coordinate",
    threshold: {
      kind: "fixed",
      values: [MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation],
      display: `> ${MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation} image width`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Checks both visible knees only in front or three-quarter views where lateral knee tracking can be observed.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented bilateral lunge knee-tracking trigger."),
  },
  {
    id: "lunge-range",
    label: "Lunge selected range",
    category: "movement",
    issueCodes: ["lunge_alignment"],
    modes: ["lunge"],
    views: ["front", "side", "three-quarter"],
    metric: "More-flexed knee angle compared with calibrated standing angle",
    unit: "degrees",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.minimum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.maximum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.offset,
      ],
      display: `Calibration − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.offset}°, clamped to ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.minimum}–${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.maximum}°; fallback ${MEASUREMENT_THRESHOLDS.exercise.defaultDownDegrees.lunge}°`,
      formula: `clamp(calibratedTop − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.offset}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.minimum}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.maximum}°)`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale: "Uses the calibrated top position to coach consistent, comfortable lunge range.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated lunge range formula and fallback."),
  },
  {
    id: "plank-body-line",
    label: "Plank body line",
    category: "movement",
    issueCodes: ["plank_alignment"],
    modes: ["plank"],
    views: ["side"],
    metric: "Shoulder–hip–ankle angle deviation from 180°",
    unit: "degrees",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees,
        MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees,
        MEASUREMENT_THRESHOLDS.exercise.defaultBodyLineToleranceDegrees,
      ],
      display: `At least ${MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees}°; calibrated deviation + ${MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees}°; fallback ${MEASUREMENT_THRESHOLDS.exercise.defaultBodyLineToleranceDegrees}°`,
      formula: `max(${MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees}°, abs(${MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees}° − calibratedLine) + ${MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees}°)`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Compares a side-view hold with the user’s calibrated line while allowing modest baseline and landmark variation.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated plank body-line tolerance."),
  },
  {
    id: "pushup-body-line",
    label: "Push-up body line",
    category: "movement",
    issueCodes: ["pushup_body_line"],
    modes: ["pushup"],
    views: ["side"],
    metric: "Shoulder–hip–ankle angle deviation from 180°",
    unit: "degrees",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees,
        MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees,
        MEASUREMENT_THRESHOLDS.exercise.defaultBodyLineToleranceDegrees,
      ],
      display: `At least ${MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees}°; calibrated deviation + ${MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees}°; fallback ${MEASUREMENT_THRESHOLDS.exercise.defaultBodyLineToleranceDegrees}°`,
      formula: `max(${MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees}°, abs(${MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees}° − calibratedLine) + ${MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees}°)`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Offers a side-view body-line cue while allowing calibrated baseline and tracking variation.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated push-up body-line tolerance."),
  },
  {
    id: "pushup-range",
    label: "Push-up selected range",
    category: "movement",
    issueCodes: ["pushup_depth"],
    modes: ["pushup"],
    views: ["side"],
    metric: "Selected elbow angle compared with calibrated top-position angle",
    unit: "degrees",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.minimum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.maximum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.offset,
      ],
      display: `Calibration − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.offset}°, clamped to ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.minimum}–${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.maximum}°; fallback ${MEASUREMENT_THRESHOLDS.exercise.defaultDownDegrees.pushup}°`,
      formula: `clamp(calibratedTop − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.offset}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.minimum}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.maximum}°)`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Counts and coaches repeatable range relative to the user’s starting position, not a universal depth prescription.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated push-up range formula and fallback."),
  },
  {
    id: "curl-elbow-flare",
    label: "Curl elbow control",
    category: "movement",
    issueCodes: ["curl_control"],
    modes: ["curl"],
    views: ["front"],
    metric: "Largest elbow-to-shoulder horizontal offset divided by torso length",
    unit: "torso-length ratio",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.minimumCurlFlareRatio,
        MEASUREMENT_THRESHOLDS.exercise.fallbackCurlFlareBaseline,
        MEASUREMENT_THRESHOLDS.exercise.calibratedCurlFlareMargin,
      ],
      display: `At least ${MEASUREMENT_THRESHOLDS.exercise.minimumCurlFlareRatio.toFixed(2)}; calibrated flare + ${MEASUREMENT_THRESHOLDS.exercise.calibratedCurlFlareMargin}`,
      formula: `max(${MEASUREMENT_THRESHOLDS.exercise.minimumCurlFlareRatio.toFixed(2)}, calibratedElbowFlare + ${MEASUREMENT_THRESHOLDS.exercise.calibratedCurlFlareMargin})`,
    },
    persistenceMs: MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Front-view cue compares elbow drift with the user’s calibrated start while tolerating ordinary tracking variation.",
    limitation: heuristicLimitation,
    history: initialRevision("Documented calibrated curl elbow-flare trigger."),
  },
  {
    id: "curl-range",
    label: "Curl selected range",
    category: "movement",
    issueCodes: [],
    modes: ["curl"],
    views: ["front", "side", "three-quarter"],
    metric: "Selected elbow angle compared with calibrated start-position angle",
    unit: "degrees",
    threshold: {
      kind: "adaptive",
      values: [
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.minimum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.maximum,
        MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.offset,
      ],
      display: `Calibration − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.offset}°, clamped to ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.minimum}–${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.maximum}°; fallback ${MEASUREMENT_THRESHOLDS.exercise.defaultDownDegrees.curl}°`,
      formula: `clamp(calibratedTop − ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.offset}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.minimum}°, ${MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.maximum}°)`,
    },
    persistenceMs: 0,
    provenance: "product-heuristic",
    validationStatus: "unvalidated",
    rationale:
      "Counts a repeatable elbow range relative to the calibrated start instead of prescribing one universal curl angle.",
    limitation: heuristicLimitation,
    history: initialRevision("Published the calibrated curl range formula and fallback."),
  },
] as const satisfies readonly MeasurementRule[];

export type MeasurementRuleId = (typeof MEASUREMENT_RULES)[number]["id"];

export const MEASUREMENT_RULE_BY_ID = Object.fromEntries(
  MEASUREMENT_RULES.map((rule) => [rule.id, rule]),
) as Readonly<Record<MeasurementRuleId, (typeof MEASUREMENT_RULES)[number]>>;

export function measurementRulesForIssue(issueCode: IssueCode): readonly MeasurementRule[] {
  return MEASUREMENT_RULES.filter((rule) =>
    (rule.issueCodes as readonly IssueCode[]).includes(issueCode),
  );
}

export function issuePersistenceMs(issueCode: IssueCode): number {
  if (issueCode === "positioning") {
    return 0;
  }
  if (issueCode === "prolonged_slouch") {
    return MEASUREMENT_THRESHOLDS.temporal.prolongedSlouchPersistenceMs;
  }
  if (issueCode.startsWith("standing_")) {
    return MEASUREMENT_THRESHOLDS.temporal.standingIssuePersistenceMs;
  }
  return MEASUREMENT_THRESHOLDS.temporal.standardIssuePersistenceMs;
}
