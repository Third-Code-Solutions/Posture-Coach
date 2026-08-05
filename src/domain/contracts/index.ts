export const LANDMARK_NAMES = [
  "nose",
  "leftEyeInner",
  "leftEye",
  "leftEyeOuter",
  "rightEyeInner",
  "rightEye",
  "rightEyeOuter",
  "leftEar",
  "rightEar",
  "mouthLeft",
  "mouthRight",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftPinky",
  "rightPinky",
  "leftIndex",
  "rightIndex",
  "leftThumb",
  "rightThumb",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
  "leftHeel",
  "rightHeel",
  "leftFootIndex",
  "rightFootIndex",
] as const;

export type LandmarkName = (typeof LANDMARK_NAMES)[number];

export type AnalysisMode = "desk" | "squat" | "plank" | "pushup" | "lunge" | "curl";
export type SourceKind = "camera" | "upload" | "image" | "fixture";
export type CameraView = "front" | "side" | "three-quarter" | "unknown";
export type MovementPhase = "ready" | "eccentric" | "bottom" | "concentric" | "hold" | "paused";
export type ConfidenceState = "high" | "usable" | "insufficient" | "unsupported";
export type EvaluationStatus = "valid" | "insufficient_evidence" | "unsupported_view";

export const MIN_OBSERVED_VIEW_CONFIDENCE = 0.4;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Landmark extends Point3D {
  visibility: number;
  presence: number;
}

export type LandmarkSet = Record<LandmarkName, Landmark>;

export interface FrameObservation {
  timestampMs: number;
  sequence: number;
  landmarks: LandmarkSet;
  worldLandmarks?: LandmarkSet;
  source: SourceKind;
  cameraView: CameraView;
  observedView: CameraView;
  viewConfidence: number;
  mirroredPreview: boolean;
  poseConfidence: number;
}

export type AbstentionReason =
  | "missing_landmarks"
  | "low_visibility"
  | "low_presence"
  | "unstable_tracking"
  | "unsupported_view"
  | "uncalibrated"
  | "framing_drift"
  | "mirror_unresolved"
  | "observed_view_mismatch"
  | "unverified_view"
  | "invalid_geometry"
  | "stale_frame";

export interface ConfidenceAssessment {
  state: ConfidenceState;
  score: number;
  required: readonly LandmarkName[];
  missing: readonly LandmarkName[];
  reasons: readonly AbstentionReason[];
}

export interface CalibrationProfile {
  mode: AnalysisMode;
  cameraView: CameraView;
  observedView: CameraView;
  viewConfidence: number;
  mirroredPreview: boolean;
  stable: boolean;
  sampleCount: number;
  completedAtMs: number | null;
  baseline: Readonly<Record<string, number>>;
}

export type IssueCode =
  | "head_forward"
  | "neck_inclination"
  | "shoulder_imbalance"
  | "torso_inclination"
  | "prolonged_slouch"
  | "squat_depth"
  | "squat_knee_alignment"
  | "plank_alignment"
  | "pushup_body_line"
  | "pushup_depth"
  | "lunge_alignment"
  | "curl_control"
  | "positioning";

export type RejectionReason =
  | "insufficient_evidence"
  | "range_not_reached"
  | "alignment_not_stable"
  | "phase_interrupted"
  | "unsupported_view";

export interface EvaluationIssue {
  code: IssueCode;
  label: string;
  severity: 1 | 2 | 3;
  evidence: number;
  threshold: number;
  persistenceMs: number;
  correction: string;
}

export interface FeedbackMessage {
  id: string;
  priority: number;
  tone: "neutral" | "guide" | "caution" | "positive";
  title: string;
  body: string;
  issueCode?: IssueCode;
}

export interface EvaluationResult {
  mode: AnalysisMode;
  timestampMs: number;
  status: EvaluationStatus;
  confidence: ConfidenceAssessment;
  phase: MovementPhase;
  issues: readonly EvaluationIssue[];
  feedback: FeedbackMessage;
  validRep: boolean;
  rejectedRep: RejectionReason | null;
  repCount: number;
  metrics: Readonly<Record<string, number>>;
}

export interface SessionSummary {
  mode: AnalysisMode;
  source: SourceKind | null;
  durationMs: number;
  analyzedMs: number;
  evidenceCoverage: number;
  validRepCount: number;
  rejectedRepCount: number;
  rejectedRepReasons: Readonly<Partial<Record<RejectionReason, number>>>;
  issueDurationsMs: Readonly<Partial<Record<IssueCode, number>>>;
  endedAtMs: number | null;
}

export const MODE_LABELS: Record<AnalysisMode, string> = {
  desk: "Desk posture",
  squat: "Bodyweight squat",
  plank: "Plank",
  pushup: "Push-up",
  lunge: "Lunge",
  curl: "Bicep curl",
};

export const MODE_DESCRIPTIONS: Record<AnalysisMode, string> = {
  desk: "Check your seated alignment and build a calmer desk setup.",
  squat: "Practice controlled range and knee tracking.",
  plank: "Hold a long, supported body line.",
  pushup: "Build consistent depth without rushing the floor position.",
  lunge: "Find steady balance and a quiet front knee.",
  curl: "Keep the elbow steady and the lift controlled.",
};

export const SUPPORTED_VIEWS: Record<AnalysisMode, readonly CameraView[]> = {
  desk: ["front", "side", "three-quarter"],
  squat: ["front", "side", "three-quarter"],
  plank: ["side"],
  pushup: ["side"],
  lunge: ["front", "side", "three-quarter"],
  curl: ["front", "side", "three-quarter"],
};

export function isViewSupported(mode: AnalysisMode, view: CameraView): boolean {
  return SUPPORTED_VIEWS[mode].includes(view);
}

export function isObservedViewCompatible(
  mode: AnalysisMode,
  declaredView: CameraView,
  observedView: CameraView,
): boolean {
  if (!isViewSupported(mode, declaredView) || observedView === "unknown") return false;
  if (declaredView === observedView) return true;
  if (observedView !== "three-quarter") return false;
  return mode !== "plank" && mode !== "pushup";
}

export const REQUIRED_LANDMARKS: Record<AnalysisMode, readonly LandmarkName[]> = {
  desk: ["nose", "leftEar", "rightEar", "leftShoulder", "rightShoulder", "leftHip", "rightHip"],
  squat: [
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
  ],
  plank: ["leftShoulder", "rightShoulder", "leftHip", "rightHip", "leftAnkle", "rightAnkle"],
  pushup: [
    "leftShoulder",
    "rightShoulder",
    "leftElbow",
    "rightElbow",
    "leftWrist",
    "rightWrist",
    "leftHip",
    "rightHip",
    "leftAnkle",
    "rightAnkle",
  ],
  lunge: [
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
  ],
  curl: [
    "leftShoulder",
    "rightShoulder",
    "leftElbow",
    "rightElbow",
    "leftWrist",
    "rightWrist",
    "leftHip",
    "rightHip",
  ],
};

export function createEmptyLandmarkSet(): LandmarkSet {
  return Object.fromEntries(
    LANDMARK_NAMES.map((name) => [name, { x: 0, y: 0, z: 0, visibility: 0, presence: 0 }]),
  ) as LandmarkSet;
}
