import type {
  AnalysisMode,
  CameraView,
  CalibrationProfile,
  EvaluationIssue,
  EvaluationResult,
  FeedbackMessage,
  FrameObservation,
  IssueCode,
  MovementPhase,
  Point3D,
  RejectionReason,
} from "../contracts";
import {
  isObservedViewCompatible,
  MIN_OBSERVED_VIEW_CONFIDENCE,
  SUPPORTED_VIEWS,
} from "../contracts";
import { assessConfidence } from "../confidence";
import { LandmarkSmoother, PersistenceGate } from "../temporal";
import { angleAt, isFinitePoint, midpoint, verticalDeviation } from "../geometry";
import { evidenceIdsForIssue } from "../../knowledge";

type RawIssue = Omit<EvaluationIssue, "persistenceMs">;
type ComputedFrame = {
  status: EvaluationResult["status"];
  phase: MovementPhase;
  issues: RawIssue[];
  metrics: Record<string, number>;
  validRep: boolean;
  rejectedRep: RejectionReason | null;
};
type ExerciseState = {
  phase: MovementPhase;
  repCount: number;
  candidate: boolean;
  candidateStartedAtMs: number | null;
  candidateMinMetric: number | null;
  rangeReached: boolean;
  alignmentStartedAtMs: number | null;
  alignmentUnstable: boolean;
  lastRepTimestampMs: number;
  lastTimestamp: number;
};

const MIN_REP_DWELL_MS = 250;
const MIN_REP_COOLDOWN_MS = 550;
const MIN_ALIGNMENT_PERSIST_MS = 450;

const CAUTIOUS =
  "This is a coaching cue, not a diagnosis. Try adjusting gently and stop if you feel pain.";

const defaultExerciseState = (): ExerciseState => ({
  phase: "ready",
  repCount: 0,
  candidate: false,
  candidateStartedAtMs: null,
  candidateMinMetric: null,
  rangeReached: false,
  alignmentStartedAtMs: null,
  alignmentUnstable: false,
  lastRepTimestampMs: -Infinity,
  lastTimestamp: -1,
});

function issue(
  code: IssueCode,
  label: string,
  evidence: number,
  threshold: number,
  severity: 1 | 2 | 3,
  correction: string,
): RawIssue {
  return { code, label, evidence, threshold, severity, correction };
}

function torsoMetrics(observation: FrameObservation): {
  torso: number;
  shoulderTilt: number;
  headOffset: number;
} {
  const shoulders = midpoint(
    observation.landmarks.leftShoulder,
    observation.landmarks.rightShoulder,
  );
  const hips = midpoint(observation.landmarks.leftHip, observation.landmarks.rightHip);
  const torso = Math.max(0.001, Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y));
  const shoulderTilt =
    Math.abs(observation.landmarks.leftShoulder.y - observation.landmarks.rightShoulder.y) / torso;
  const ear = midpoint(observation.landmarks.leftEar, observation.landmarks.rightEar);
  const headOffset = Math.abs(ear.x - shoulders.x) / torso;
  return { torso, shoulderTilt, headOffset };
}

function deskIssues(
  observation: FrameObservation,
  baseline: Readonly<Record<string, number>>,
): ComputedFrame {
  const baseMetrics = torsoMetrics(observation);
  const metrics = { ...baseMetrics, torsoRatio: 1 };
  const issues: RawIssue[] = [];
  const baselineTorso = baseline.torso;
  const torsoRatio = baselineTorso ? metrics.torso / baselineTorso : 1;
  metrics.torsoRatio = torsoRatio;
  if (baselineTorso && (torsoRatio < 0.65 || torsoRatio > 1.35)) {
    issues.push(
      issue(
        "positioning",
        "Return to your calibrated distance",
        Math.abs(torsoRatio - 1),
        0.35,
        2,
        "Keep your full body in frame and return to the distance used during calibration.",
      ),
    );
  }
  if (observation.cameraView === "front" || observation.cameraView === "three-quarter") {
    if (metrics.shoulderTilt > 0.07) {
      issues.push(
        issue(
          "shoulder_imbalance",
          "Shoulder level",
          metrics.shoulderTilt,
          0.07,
          2,
          "Let both shoulders soften down and level out. Keep your screen in front of you.",
        ),
      );
    }
  }
  if (observation.cameraView === "side" || observation.cameraView === "three-quarter") {
    const neck =
      verticalDeviation(observation.landmarks.rightEar, observation.landmarks.rightShoulder) ?? 0;
    const torso =
      verticalDeviation(
        midpoint(observation.landmarks.leftShoulder, observation.landmarks.rightShoulder),
        midpoint(observation.landmarks.leftHip, observation.landmarks.rightHip),
      ) ?? 0;
    if (metrics.headOffset > 0.12) {
      issues.push(
        issue(
          "head_forward",
          "Head-forward tendency",
          metrics.headOffset,
          0.12,
          3,
          "Try bringing your head back over your ribs without forcing your chin.",
        ),
      );
    }
    if (neck > 18) {
      issues.push(
        issue(
          "neck_inclination",
          "Neck inclination",
          neck,
          18,
          2,
          "Raise the screen toward eye level and let your gaze travel forward.",
        ),
      );
    }
    if (torso > 14) {
      issues.push(
        issue(
          "torso_inclination",
          "Torso inclination",
          torso,
          14,
          2,
          "Try stacking your ribs over your hips and moving closer to your desk.",
        ),
      );
    }
    if (torso > 20) {
      issues.push(
        issue(
          "prolonged_slouch",
          "Prolonged slouch",
          torso,
          20,
          3,
          "Reset gently: bring your ribs over your hips, then let your shoulders relax.",
        ),
      );
    }
  }
  const status = observation.cameraView === "unknown" ? "unsupported_view" : "valid";
  return {
    status,
    phase: "ready",
    issues,
    metrics: { ...metrics },
    validRep: false,
    rejectedRep: null,
  };
}

function calibrationFramingIssue(
  observation: FrameObservation,
  baseline: Readonly<Record<string, number>>,
): RawIssue | null {
  if (!baseline.torso) return null;
  const shoulders = midpoint(
    observation.landmarks.leftShoulder,
    observation.landmarks.rightShoulder,
  );
  const hips = midpoint(observation.landmarks.leftHip, observation.landmarks.rightHip);
  const torso = Math.max(0.001, Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y));
  const torsoRatio = torso / baseline.torso;
  if (torsoRatio >= 0.65 && torsoRatio <= 1.35) return null;
  return issue(
    "positioning",
    "Return to your calibrated distance",
    Math.abs(torsoRatio - 1),
    0.35,
    2,
    "Keep your full body in frame and return to the distance used during calibration.",
  );
}

function bodyLineAngle(observation: FrameObservation, side: "left" | "right"): number | null {
  const shoulder = observation.landmarks[`${side}Shoulder`];
  const hip = observation.landmarks[`${side}Hip`];
  const ankle = observation.landmarks[`${side}Ankle`];
  return angleAt(shoulder, hip, ankle);
}

function chooseKneeAngle(observation: FrameObservation): number | null {
  const left = angleAt(
    observation.landmarks.leftHip,
    observation.landmarks.leftKnee,
    observation.landmarks.leftAnkle,
  );
  const right = angleAt(
    observation.landmarks.rightHip,
    observation.landmarks.rightKnee,
    observation.landmarks.rightAnkle,
  );
  if (left === null) return right;
  if (right === null) return left;
  const leftScore = Math.min(
    observation.landmarks.leftKnee.visibility,
    observation.landmarks.leftKnee.presence,
  );
  const rightScore = Math.min(
    observation.landmarks.rightKnee.visibility,
    observation.landmarks.rightKnee.presence,
  );
  return leftScore >= rightScore ? left : right;
}

type LungeMetrics = {
  frontKneeAngle: number;
  rearKneeAngle: number;
  kneeAngleGap: number;
  stanceSeparation: number;
};

function lungeMetrics(observation: FrameObservation): LungeMetrics | null {
  const leftKneeAngle = angleAt(
    observation.landmarks.leftHip,
    observation.landmarks.leftKnee,
    observation.landmarks.leftAnkle,
  );
  const rightKneeAngle = angleAt(
    observation.landmarks.rightHip,
    observation.landmarks.rightKnee,
    observation.landmarks.rightAnkle,
  );
  if (leftKneeAngle === null || rightKneeAngle === null) return null;

  const projectedSeparation = Math.hypot(
    observation.landmarks.leftAnkle.x - observation.landmarks.rightAnkle.x,
    observation.landmarks.leftAnkle.y - observation.landmarks.rightAnkle.y,
  );
  const worldSeparation = observation.worldLandmarks
    ? Math.hypot(
        observation.worldLandmarks.leftAnkle.x - observation.worldLandmarks.rightAnkle.x,
        observation.worldLandmarks.leftAnkle.z - observation.worldLandmarks.rightAnkle.z,
      )
    : 0;
  const frontKneeAngle = Math.min(leftKneeAngle, rightKneeAngle);
  const rearKneeAngle = Math.max(leftKneeAngle, rightKneeAngle);
  return {
    frontKneeAngle,
    rearKneeAngle,
    kneeAngleGap: rearKneeAngle - frontKneeAngle,
    stanceSeparation: Math.max(projectedSeparation, worldSeparation),
  };
}

function chooseElbowAngle(observation: FrameObservation): number | null {
  const left = angleAt(
    observation.landmarks.leftShoulder,
    observation.landmarks.leftElbow,
    observation.landmarks.leftWrist,
  );
  const right = angleAt(
    observation.landmarks.rightShoulder,
    observation.landmarks.rightElbow,
    observation.landmarks.rightWrist,
  );
  if (left === null) return right;
  if (right === null) return left;
  const leftScore = Math.min(
    observation.landmarks.leftElbow.visibility,
    observation.landmarks.leftElbow.presence,
  );
  const rightScore = Math.min(
    observation.landmarks.rightElbow.visibility,
    observation.landmarks.rightElbow.presence,
  );
  return leftScore >= rightScore ? left : right;
}

function elbowFlare(observation: FrameObservation): number | null {
  const shoulders = midpoint(
    observation.landmarks.leftShoulder,
    observation.landmarks.rightShoulder,
  );
  const hips = midpoint(observation.landmarks.leftHip, observation.landmarks.rightHip);
  const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  if (!Number.isFinite(torso) || torso < 1e-6) return null;
  const left = Math.abs(observation.landmarks.leftElbow.x - observation.landmarks.leftShoulder.x);
  const right = Math.abs(
    observation.landmarks.rightElbow.x - observation.landmarks.rightShoulder.x,
  );
  return Math.max(left, right) / torso;
}

function projectedSegmentIsAvailable(a: Point3D, b: Point3D): boolean {
  return (
    isFinitePoint(a) &&
    isFinitePoint(b) &&
    Number.isFinite(Math.hypot(a.x - b.x, a.y - b.y)) &&
    Math.hypot(a.x - b.x, a.y - b.y) >= 1e-6
  );
}

function geometryIsAvailable(mode: AnalysisMode, observation: FrameObservation): boolean {
  const { landmarks } = observation;
  const shoulderMidpoint = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hipMidpoint = midpoint(landmarks.leftHip, landmarks.rightHip);
  if (mode === "desk") {
    return (
      projectedSegmentIsAvailable(shoulderMidpoint, hipMidpoint) &&
      (observation.cameraView === "front" ||
        projectedSegmentIsAvailable(landmarks.rightEar, landmarks.rightShoulder))
    );
  }
  if (mode === "squat" || mode === "lunge") {
    if (mode === "lunge") return lungeMetrics(observation) !== null;
    return (
      angleAt(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle) !== null &&
      angleAt(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle) !== null
    );
  }
  if (mode === "plank" || mode === "pushup") {
    const leftLine = bodyLineAngle(observation, "left");
    const rightLine = bodyLineAngle(observation, "right");
    return leftLine !== null && rightLine !== null;
  }
  return (
    chooseElbowAngle(observation) !== null &&
    angleAt(landmarks.leftShoulder, landmarks.leftElbow, landmarks.leftWrist) !== null &&
    angleAt(landmarks.rightShoulder, landmarks.rightElbow, landmarks.rightWrist) !== null
  );
}

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function exerciseThresholds(
  mode: Exclude<AnalysisMode, "desk">,
  baseline: Readonly<Record<string, number>>,
): { down: number; entry: number; up: number } {
  if (mode === "plank") return { down: 0, entry: 0, up: 0 };
  const calibratedTop = baseline.movementMetric;
  if (!Number.isFinite(calibratedTop)) {
    const down = mode === "squat" ? 105 : mode === "lunge" ? 110 : mode === "pushup" ? 100 : 75;
    return { down, entry: Math.min(155, down + 30), up: 160 };
  }
  const down =
    mode === "squat"
      ? bounded(calibratedTop - 62, 88, 125)
      : mode === "lunge"
        ? bounded(calibratedTop - 55, 95, 130)
        : mode === "pushup"
          ? bounded(calibratedTop - 65, 72, 115)
          : bounded(calibratedTop - 82, 55, 105);
  return {
    down,
    entry: Math.min(160, down + 28),
    up: bounded(calibratedTop - 12, 145, 175),
  };
}

function bodyLineTolerance(baseline: Readonly<Record<string, number>>): number {
  const calibratedLine = baseline.movementMetric;
  return Number.isFinite(calibratedLine) ? Math.max(10, Math.abs(180 - calibratedLine) + 8) : 16;
}

function lungeStanceThreshold(baseline: Readonly<Record<string, number>>): number {
  return Math.max(0.18, (baseline.stanceSeparation ?? 0) * 0.65);
}

function curlFlareThreshold(baseline: Readonly<Record<string, number>>): number {
  return Math.max(0.5, (baseline.elbowFlare ?? 0.28) + 0.22);
}

function alignmentIssueCodes(mode: Exclude<AnalysisMode, "desk" | "plank">): IssueCode[] {
  if (mode === "squat") return ["squat_knee_alignment"];
  if (mode === "lunge") return ["lunge_alignment"];
  if (mode === "pushup") return ["pushup_body_line"];
  return ["curl_control"];
}

function exerciseFrame(
  mode: Exclude<AnalysisMode, "desk">,
  observation: FrameObservation,
  state: ExerciseState,
  baseline: Readonly<Record<string, number>>,
): ComputedFrame {
  const issues: RawIssue[] = [];
  const framingIssue = calibrationFramingIssue(observation, baseline);
  if (framingIssue) issues.push(framingIssue);
  const metrics: Record<string, number> = {};
  let metric: number | null = null;
  const thresholds = exerciseThresholds(mode, baseline);
  const downThreshold = thresholds.down;
  const entryThreshold = thresholds.entry;
  const upThreshold = thresholds.up;
  let phase: MovementPhase = state.phase;
  const timestampMs = observation.timestampMs;
  if (timestampMs <= state.lastTimestamp) {
    state.candidate = false;
    state.candidateStartedAtMs = null;
    state.phase = "paused";
    state.lastTimestamp = Math.max(state.lastTimestamp, timestampMs);
    return {
      status: "valid",
      phase: "paused",
      issues: [],
      metrics,
      validRep: false,
      rejectedRep: "phase_interrupted",
    };
  }

  if (mode === "squat" || mode === "lunge") {
    const lunge = mode === "lunge" ? lungeMetrics(observation) : null;
    metric = lunge?.frontKneeAngle ?? chooseKneeAngle(observation);
    metrics.kneeAngle = metric ?? 0;
    if (lunge) {
      metrics.frontKneeAngle = lunge.frontKneeAngle;
      metrics.rearKneeAngle = lunge.rearKneeAngle;
      metrics.kneeAngleGap = lunge.kneeAngleGap;
      metrics.stanceSeparation = lunge.stanceSeparation;
      const stanceThreshold = lungeStanceThreshold(baseline);
      if (lunge.stanceSeparation < stanceThreshold) {
        issues.push(
          issue(
            "lunge_alignment",
            "Split stance",
            lunge.stanceSeparation,
            stanceThreshold,
            3,
            "Step one foot forward and one foot back so the front leg can bend independently.",
          ),
        );
      } else if (lunge.kneeAngleGap < 12) {
        issues.push(
          issue(
            "lunge_alignment",
            "Front-leg lead",
            lunge.kneeAngleGap,
            12,
            3,
            "Keep the front knee doing the work while the back knee stays lighter and more extended.",
          ),
        );
      }
    }
    if (
      (mode === "squat" || mode === "lunge") &&
      (observation.cameraView === "front" || observation.cameraView === "three-quarter")
    ) {
      const leftMidpoint =
        (observation.landmarks.leftHip.x + observation.landmarks.leftAnkle.x) / 2;
      const rightMidpoint =
        (observation.landmarks.rightHip.x + observation.landmarks.rightAnkle.x) / 2;
      const kneeAlignmentDeviation = Math.max(
        Math.abs(observation.landmarks.leftKnee.x - leftMidpoint),
        Math.abs(observation.landmarks.rightKnee.x - rightMidpoint),
      );
      metrics.kneeAlignmentDeviation = kneeAlignmentDeviation;
      if (kneeAlignmentDeviation > 0.12) {
        issues.push(
          issue(
            mode === "squat" ? "squat_knee_alignment" : "lunge_alignment",
            mode === "squat" ? "Knee tracking" : "Front-knee tracking",
            kneeAlignmentDeviation,
            0.12,
            3,
            "Keep the knee tracking in line with the middle of the foot instead of letting it drift inward or outward.",
          ),
        );
      }
    }
    if (metric !== null && metric > downThreshold && metric < 140 && state.candidate) {
      issues.push(
        issue(
          mode === "squat" ? "squat_depth" : "lunge_alignment",
          "Range is not quite there",
          metric,
          downThreshold,
          2,
          mode === "squat"
            ? "Try sitting a little lower while keeping your feet grounded."
            : "Lower with control and keep the front knee tracking over the foot.",
        ),
      );
    }
  } else if (mode === "pushup" || mode === "curl") {
    metric = chooseElbowAngle(observation);
    metrics.elbowAngle = metric ?? 0;
    if (mode === "pushup") {
      const leftLine = bodyLineAngle(observation, "left");
      const rightLine = bodyLineAngle(observation, "right");
      const line =
        leftLine === null
          ? rightLine
          : rightLine === null
            ? leftLine
            : Math.min(leftLine, rightLine);
      const deviation = line === null ? null : Math.abs(180 - line);
      metrics.bodyLineAngle = line ?? 0;
      metrics.bodyLineDeviation = deviation ?? 0;
      if (deviation !== null && deviation > bodyLineTolerance(baseline)) {
        issues.push(
          issue(
            "pushup_body_line",
            "Push-up body line",
            deviation,
            bodyLineTolerance(baseline),
            3,
            "Brace gently and keep your shoulders, hips, and heels moving as one line.",
          ),
        );
      }
    }
    if (
      metric !== null &&
      mode === "pushup" &&
      metric > downThreshold &&
      metric < 140 &&
      state.candidate
    ) {
      issues.push(
        issue(
          "pushup_depth",
          "Push-up depth",
          metric,
          downThreshold,
          2,
          "Move through a comfortable, consistent depth before pressing away.",
        ),
      );
    }
    const flare = mode === "curl" ? elbowFlare(observation) : null;
    if (flare !== null) {
      metrics.elbowFlare = flare;
    }
    if (flare !== null && mode === "curl" && flare > curlFlareThreshold(baseline)) {
      issues.push(
        issue(
          "curl_control",
          "Curl control",
          flare,
          curlFlareThreshold(baseline),
          2,
          "Keep the elbow close to your ribs while the forearm moves, then lower with control.",
        ),
      );
    }
  } else if (mode === "plank") {
    const leftLine = bodyLineAngle(observation, "left");
    const rightLine = bodyLineAngle(observation, "right");
    metric =
      leftLine === null ? rightLine : rightLine === null ? leftLine : Math.min(leftLine, rightLine);
    metrics.bodyLineAngle = metric ?? 0;
    const lineTolerance = bodyLineTolerance(baseline);
    if (metric !== null && Math.abs(180 - metric) > lineTolerance) {
      issues.push(
        issue(
          "plank_alignment",
          "Body line",
          Math.abs(180 - metric),
          lineTolerance,
          3,
          "Brace gently and find one long line from shoulders through heels.",
        ),
      );
    }
    if (metric === null) {
      state.phase = "paused";
      state.lastTimestamp = timestampMs;
      return {
        status: "insufficient_evidence",
        phase: "paused",
        issues: [],
        metrics,
        validRep: false,
        rejectedRep: "insufficient_evidence",
      };
    }
    phase = metric !== null && Math.abs(180 - metric) <= lineTolerance ? "hold" : "paused";
    state.lastTimestamp = timestampMs;
    return { status: "valid", phase, issues, metrics, validRep: false, rejectedRep: null };
  }

  if (metric === null) {
    state.candidate = false;
    state.candidateStartedAtMs = null;
    state.phase = "paused";
    state.lastTimestamp = timestampMs;
    return {
      status: "insufficient_evidence",
      phase: "paused",
      issues,
      metrics,
      validRep: false,
      rejectedRep: "insufficient_evidence",
    };
  }
  const alignmentCodes = alignmentIssueCodes(mode);
  if (state.candidate) {
    state.candidateMinMetric =
      state.candidateMinMetric === null ? metric : Math.min(state.candidateMinMetric, metric);
    if (metric <= downThreshold) state.rangeReached = true;
    const alignmentActive = issues.some((candidate) => alignmentCodes.includes(candidate.code));
    if (alignmentActive) {
      state.alignmentStartedAtMs ??= timestampMs;
      if (timestampMs - state.alignmentStartedAtMs >= MIN_ALIGNMENT_PERSIST_MS) {
        state.alignmentUnstable = true;
      }
    } else {
      state.alignmentStartedAtMs = null;
    }
  }
  if (!state.candidate && metric <= entryThreshold) {
    state.candidate = true;
    state.candidateStartedAtMs = timestampMs;
    state.candidateMinMetric = metric;
    state.rangeReached = metric <= downThreshold;
    state.alignmentStartedAtMs = issues.some((candidate) => alignmentCodes.includes(candidate.code))
      ? timestampMs
      : null;
    state.alignmentUnstable = false;
    phase = "eccentric";
  } else if (state.candidate && metric <= downThreshold + 4) {
    phase = "bottom";
  } else if (state.candidate && metric >= upThreshold) {
    state.candidate = false;
    const dwellMs = timestampMs - (state.candidateStartedAtMs ?? timestampMs);
    const cooldownMs = timestampMs - state.lastRepTimestampMs;
    const rangeReached = state.rangeReached;
    const alignmentUnstable = state.alignmentUnstable;
    state.candidateStartedAtMs = null;
    state.candidateMinMetric = null;
    state.rangeReached = false;
    state.alignmentStartedAtMs = null;
    state.alignmentUnstable = false;
    state.lastTimestamp = timestampMs;
    if (dwellMs < MIN_REP_DWELL_MS || cooldownMs < MIN_REP_COOLDOWN_MS) {
      state.phase = "paused";
      return {
        status: "valid",
        phase: "paused",
        issues,
        metrics,
        validRep: false,
        rejectedRep: "phase_interrupted",
      };
    }
    if (!rangeReached) {
      state.phase = "paused";
      return {
        status: "valid",
        phase: "paused",
        issues,
        metrics,
        validRep: false,
        rejectedRep: "range_not_reached",
      };
    }
    if (alignmentUnstable) {
      state.phase = "paused";
      return {
        status: "valid",
        phase: "paused",
        issues,
        metrics,
        validRep: false,
        rejectedRep: "alignment_not_stable",
      };
    }
    phase = "concentric";
    state.phase = phase;
    state.lastRepTimestampMs = timestampMs;
    state.repCount += 1;
    return { status: "valid", phase, issues, metrics, validRep: true, rejectedRep: null };
  } else if (state.candidate) {
    phase = "concentric";
  } else {
    phase = "ready";
  }
  state.lastTimestamp = timestampMs;
  state.phase = phase;
  return { status: "valid", phase, issues, metrics, validRep: false, rejectedRep: null };
}

function positioningFeedback(mode: AnalysisMode, view: CameraView): FeedbackMessage {
  const side =
    mode === "desk" || mode === "plank" || mode === "pushup" || mode === "curl"
      ? "side"
      : "front or side";
  return {
    id: `position-${mode}-${view}`,
    priority: 100,
    tone: "guide",
    title: "Set your view",
    body: `Use a ${side} view with your full body visible, then calibrate. This keeps advice evidence-aware.`,
    evidenceIds: evidenceIdsForIssue("positioning"),
  };
}

function feedbackFor(result: {
  status: EvaluationResult["status"];
  issues: readonly EvaluationIssue[];
  mode: AnalysisMode;
  view: CameraView;
  confidence: EvaluationResult["confidence"];
  validRep: boolean;
  rejectedRep: RejectionReason | null;
}): FeedbackMessage {
  if (result.status === "unsupported_view") return positioningFeedback(result.mode, result.view);
  if (result.confidence.reasons.includes("framing_drift")) {
    return {
      id: "framing-drift",
      priority: 112,
      tone: "guide",
      title: "Return to your calibrated distance",
      body: "Keep the same framing you used for calibration. Form advice and repetition counting are paused until your body is back in range.",
    };
  }
  if (result.confidence.reasons.includes("uncalibrated")) {
    return {
      id: "calibrate-first",
      priority: 115,
      tone: "guide",
      title: "Calibrate first",
      body: "Hold a relaxed position while the view-specific baseline settles. Form advice stays paused until then.",
    };
  }
  if (
    result.status === "insufficient_evidence" ||
    result.confidence.state === "insufficient" ||
    result.confidence.state === "unsupported"
  ) {
    return {
      id: "insufficient-evidence",
      priority: 110,
      tone: "caution",
      title: "Move into view",
      body: "I’m pausing form advice until the required landmarks are clear. Step back, improve lighting, or adjust the camera.",
    };
  }
  if (result.rejectedRep === "phase_interrupted") {
    return {
      id: "rep-not-counted",
      priority: 60,
      tone: "guide",
      title: "Rep not counted",
      body: "Stay in the movement phase a little longer and keep the next repetition controlled.",
      evidenceIds: ["controlled-exercise"],
    };
  }
  if (result.rejectedRep === "range_not_reached") {
    return {
      id: "range-not-reached",
      priority: 60,
      tone: "guide",
      title: "Rep not counted",
      body: "Move through the selected range with control before returning to the start position.",
      evidenceIds: ["comfortable-range"],
    };
  }
  if (result.rejectedRep === "alignment_not_stable") {
    return {
      id: "alignment-not-stable",
      priority: 65,
      tone: "guide",
      title: "Rep not counted",
      body: "Keep the relevant joints aligned through the full repetition before returning to the start position.",
      evidenceIds: ["controlled-exercise"],
    };
  }
  if (result.issues.length > 0) {
    const first = [...result.issues].sort(
      (left, right) =>
        right.severity - left.severity ||
        right.persistenceMs - left.persistenceMs ||
        left.code.localeCompare(right.code),
    )[0];
    return {
      id: `issue-${first.code}`,
      priority: 70 + first.severity * 5,
      tone: "caution",
      title: first.label,
      body: `${first.correction} ${CAUTIOUS}`,
      issueCode: first.code,
      evidenceIds: evidenceIdsForIssue(first.code),
    };
  }
  if (result.validRep)
    return {
      id: "rep-complete",
      priority: 20,
      tone: "positive",
      title: "Rep logged",
      body: "Nice. Keep the same controlled rhythm.",
      evidenceIds: ["controlled-exercise"],
    };
  return {
    id: "ready",
    priority: 10,
    tone: "positive",
    title: "Looking steady",
    body: "Keep breathing normally and use the visual guide as a gentle cue.",
  };
}

export class PostureEngine {
  // Favor current-frame response while retaining enough filtering to keep
  // low-light/mobile landmark jitter from becoming false coaching cues.
  private readonly smoother = new LandmarkSmoother(0.58);
  private readonly gates = new Map<IssueCode, PersistenceGate>();
  private readonly exercises = new Map<Exclude<AnalysisMode, "desk">, ExerciseState>();
  private mode: AnalysisMode = "desk";
  private calibrationStable = false;
  private calibrationProfile: CalibrationProfile | null = null;
  private lastObservationTimestamp = -1;

  setMode(mode: AnalysisMode): void {
    this.mode = mode;
    this.calibrationProfile = null;
    this.calibrationStable = false;
    this.resetTemporalState();
    for (const state of this.exercises.values()) Object.assign(state, defaultExerciseState());
  }

  setCalibrationStable(stable: boolean): void {
    if (!stable) {
      this.calibrationStable = false;
      this.calibrationProfile = null;
      return;
    }
    this.calibrationStable = this.calibrationProfile?.stable === true;
  }

  setCalibrationProfile(profile: CalibrationProfile): void {
    if (!profile.stable || profile.mode !== this.mode) {
      this.calibrationProfile = null;
      this.calibrationStable = false;
      return;
    }
    this.calibrationProfile = profile;
    this.calibrationStable = true;
  }

  reset(): void {
    this.calibrationStable = false;
    this.calibrationProfile = null;
    this.resetTemporalState();
    for (const state of this.exercises.values()) Object.assign(state, defaultExerciseState());
  }

  process(observation: FrameObservation): EvaluationResult {
    const timestampMs = observation.timestampMs;
    if (!Number.isFinite(timestampMs) || timestampMs <= this.lastObservationTimestamp) {
      this.interruptActiveExercise();
      const confidence = assessConfidence(observation, this.mode);
      const staleResult = {
        mode: this.mode,
        timestampMs: Number.isFinite(timestampMs)
          ? timestampMs
          : Math.max(0, this.lastObservationTimestamp),
        status: "insufficient_evidence" as const,
        confidence: {
          ...confidence,
          state: "insufficient" as const,
          reasons: [...new Set([...confidence.reasons, "stale_frame" as const])],
        },
        phase: "paused" as const,
        issues: [],
        validRep: false,
        rejectedRep: "insufficient_evidence" as const,
        repCount: this.currentRepCount(),
        metrics: {},
      };
      return {
        ...staleResult,
        feedback: feedbackFor({ ...staleResult, view: observation.cameraView }),
      };
    }
    this.lastObservationTimestamp = timestampMs;
    const smoothed = {
      ...observation,
      landmarks: this.smoother.update(observation.landmarks, observation.timestampMs),
    };
    const confidence = assessConfidence(smoothed, this.mode);
    const calibrationProfile = this.calibrationProfile;
    const calibrationMatches =
      this.calibrationStable &&
      calibrationProfile?.stable === true &&
      calibrationProfile.mode === this.mode &&
      calibrationProfile.cameraView === smoothed.cameraView &&
      isObservedViewCompatible(
        this.mode,
        calibrationProfile.cameraView,
        calibrationProfile.observedView,
      ) &&
      smoothed.viewConfidence >= MIN_OBSERVED_VIEW_CONFIDENCE &&
      isObservedViewCompatible(this.mode, smoothed.cameraView, smoothed.observedView) &&
      calibrationProfile.mirroredPreview === smoothed.mirroredPreview;
    const geometryAvailable = geometryIsAvailable(this.mode, smoothed);
    const framingIssue =
      calibrationMatches && calibrationProfile && geometryAvailable
        ? calibrationFramingIssue(smoothed, calibrationProfile.baseline)
        : null;
    if (
      !calibrationMatches ||
      !geometryAvailable ||
      confidence.state === "insufficient" ||
      confidence.state === "unsupported" ||
      framingIssue !== null
    ) {
      this.interruptActiveExercise();
      const gatedConfidence =
        confidence.state === "unsupported"
          ? confidence
          : calibrationMatches && geometryAvailable && framingIssue === null
            ? confidence
            : {
                ...confidence,
                state: "insufficient" as const,
                reasons: [
                  ...confidence.reasons,
                  ...(calibrationMatches ? [] : ["uncalibrated" as const]),
                  ...(!geometryAvailable ? ["invalid_geometry" as const] : []),
                  ...(framingIssue ? ["framing_drift" as const] : []),
                ],
              };
      const result = {
        mode: this.mode,
        timestampMs: smoothed.timestampMs,
        status: (gatedConfidence.state === "unsupported"
          ? "unsupported_view"
          : "insufficient_evidence") as EvaluationResult["status"],
        confidence: gatedConfidence,
        phase: "paused" as MovementPhase,
        issues: [],
        validRep: false,
        rejectedRep: null,
        repCount: this.currentRepCount(),
        metrics: {},
      };
      return { ...result, feedback: feedbackFor({ ...result, view: smoothed.cameraView }) };
    }

    const raw =
      this.mode === "desk"
        ? deskIssues(smoothed, this.calibrationProfile?.baseline ?? {})
        : exerciseFrame(
            this.mode,
            smoothed,
            this.exerciseState(this.mode),
            this.calibrationProfile?.baseline ?? {},
          );
    if (Object.values(raw.metrics).some((value) => !Number.isFinite(value))) {
      this.interruptActiveExercise();
      const invalidGeometryResult = {
        mode: this.mode,
        timestampMs: smoothed.timestampMs,
        status: "insufficient_evidence" as const,
        confidence: {
          ...confidence,
          state: "insufficient" as const,
          reasons: [...new Set([...confidence.reasons, "invalid_geometry" as const])],
        },
        phase: "paused" as const,
        issues: [],
        validRep: false,
        rejectedRep: "insufficient_evidence" as const,
        repCount: this.currentRepCount(),
        metrics: {},
      };
      return {
        ...invalidGeometryResult,
        feedback: feedbackFor({ ...invalidGeometryResult, view: smoothed.cameraView }),
      };
    }
    const issues = this.persist(raw.issues, smoothed.timestampMs);
    const status = raw.status;
    const result = {
      mode: this.mode,
      timestampMs: smoothed.timestampMs,
      status: status as EvaluationResult["status"],
      confidence,
      phase: raw.phase,
      issues,
      validRep: raw.validRep,
      rejectedRep: raw.rejectedRep,
      repCount: this.currentRepCount(),
      metrics: raw.metrics,
    };
    return { ...result, feedback: feedbackFor({ ...result, view: smoothed.cameraView }) };
  }

  private persist(rawIssues: RawIssue[], timestampMs: number): EvaluationIssue[] {
    const present = new Set(rawIssues.map((candidate) => candidate.code));
    for (const [code, gate] of this.gates) {
      if (!present.has(code)) gate.update(false, timestampMs);
    }
    return rawIssues.flatMap((candidate) => {
      const gate =
        this.gates.get(candidate.code) ??
        new PersistenceGate(candidate.code === "prolonged_slouch" ? 15_000 : 900);
      this.gates.set(candidate.code, gate);
      return gate.update(true, timestampMs)
        ? [{ ...candidate, persistenceMs: candidate.code === "prolonged_slouch" ? 15_000 : 900 }]
        : [];
    });
  }

  private exerciseState(mode: Exclude<AnalysisMode, "desk">): ExerciseState {
    const existing = this.exercises.get(mode);
    if (existing) return existing;
    const state = defaultExerciseState();
    this.exercises.set(mode, state);
    return state;
  }

  private currentRepCount(): number {
    return this.mode === "desk" ? 0 : this.exerciseState(this.mode).repCount;
  }

  private resetTemporalState(): void {
    this.smoother.reset();
    this.lastObservationTimestamp = -1;
    for (const gate of this.gates.values()) gate.reset();
    this.gates.clear();
    const state = this.mode === "desk" ? null : this.exerciseState(this.mode);
    if (state) {
      state.phase = "ready";
      state.candidate = false;
      state.candidateStartedAtMs = null;
      state.candidateMinMetric = null;
      state.rangeReached = false;
      state.alignmentStartedAtMs = null;
      state.alignmentUnstable = false;
      state.lastRepTimestampMs = -Infinity;
      state.lastTimestamp = -1;
    }
  }

  private interruptActiveExercise(): void {
    if (this.mode === "desk") return;
    const state = this.exerciseState(this.mode);
    state.candidate = false;
    state.candidateStartedAtMs = null;
    state.phase = "paused";
  }
}

export function createEngine(): PostureEngine {
  return new PostureEngine();
}

export function viewForMode(mode: AnalysisMode): CameraView {
  return SUPPORTED_VIEWS[mode][0];
}
