import type {
  AnalysisMode,
  AbstentionReason,
  CameraView,
  CalibrationProfile,
  EvaluationIssue,
  EvaluationResult,
  FeedbackMessage,
  FrameObservation,
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
import {
  MEASUREMENT_RULE_BY_ID,
  MEASUREMENT_RULES,
  MEASUREMENT_THRESHOLDS,
  type MeasurementRuleId,
} from "../measurement-registry";
import { LandmarkSmoother, PersistenceGate } from "../temporal";
import {
  angleAt,
  isFinitePoint,
  midpoint,
  mostVisibleBodySide,
  normalizedLungeStanceSeparation,
  torsoSegmentForMode,
  verticalDeviation,
  wholeBodyFrameDeviation,
} from "../geometry";
import { evidenceIdsForIssue, evidenceIdsForMode } from "../../knowledge";

type RawIssue = Omit<EvaluationIssue, "persistenceMs">;
type ExerciseMode = Exclude<AnalysisMode, "desk" | "standing">;
type RepMode = Exclude<ExerciseMode, "plank">;
type ComputedFrame = {
  status: EvaluationResult["status"];
  phase: MovementPhase;
  issues: RawIssue[];
  metrics: Record<string, number>;
  validRep: boolean;
  rejectedRep: RejectionReason | null;
  decisionRuleIds?: readonly MeasurementRuleId[];
};
type ExerciseState = {
  phase: MovementPhase;
  repCount: number;
  candidate: boolean;
  candidateStartedAtMs: number | null;
  candidateMinMetric: number | null;
  rangeReached: boolean;
  alignmentStartedAtByRule: Map<MeasurementRuleId, number>;
  alignmentUnstableRuleIds: Set<MeasurementRuleId>;
  evaluatedAlignmentRuleIds: Set<MeasurementRuleId>;
  lastRepTimestampMs: number;
  lastTimestamp: number;
};

const CAUTIOUS =
  "This is a coaching cue, not a diagnosis. Try adjusting gently and stop if you feel pain.";

const defaultExerciseState = (): ExerciseState => ({
  phase: "ready",
  repCount: 0,
  candidate: false,
  candidateStartedAtMs: null,
  candidateMinMetric: null,
  rangeReached: false,
  alignmentStartedAtByRule: new Map(),
  alignmentUnstableRuleIds: new Set(),
  evaluatedAlignmentRuleIds: new Set(),
  lastRepTimestampMs: -Infinity,
  lastTimestamp: -1,
});

function issue(
  measurementRuleId: MeasurementRuleId,
  label: string,
  evidence: number,
  threshold: number,
  severity: 1 | 2 | 3,
  correction: string,
): RawIssue {
  const rule = MEASUREMENT_RULE_BY_ID[measurementRuleId];
  if (rule.issueCodes.length !== 1) {
    throw new Error(`Measurement rule ${measurementRuleId} must map to exactly one issue code.`);
  }
  const code = rule.issueCodes[0];
  return { code, measurementRuleId, label, evidence, threshold, severity, correction };
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
  const torso = Math.max(
    MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale,
    Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y),
  );
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
  if (
    baselineTorso &&
    (torsoRatio < MEASUREMENT_THRESHOLDS.framing.minimumTorsoRatio ||
      torsoRatio > MEASUREMENT_THRESHOLDS.framing.maximumTorsoRatio)
  ) {
    issues.push(
      issue(
        "framing-torso-distance",
        "Return to your calibrated distance",
        Math.abs(torsoRatio - 1),
        MEASUREMENT_THRESHOLDS.framing.torsoRatioDeviation,
        2,
        "Keep your full body in frame and return to the distance used during calibration.",
      ),
    );
  }
  if (observation.cameraView === "front" || observation.cameraView === "three-quarter") {
    if (metrics.shoulderTilt > MEASUREMENT_THRESHOLDS.desk.shoulderTiltRatio) {
      issues.push(
        issue(
          "desk-shoulder-level",
          "Shoulder level",
          metrics.shoulderTilt,
          MEASUREMENT_THRESHOLDS.desk.shoulderTiltRatio,
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
    if (metrics.headOffset > MEASUREMENT_THRESHOLDS.desk.headOffsetRatio) {
      issues.push(
        issue(
          "desk-head-forward",
          "Head-forward tendency",
          metrics.headOffset,
          MEASUREMENT_THRESHOLDS.desk.headOffsetRatio,
          3,
          "Try bringing your head back over your ribs without forcing your chin.",
        ),
      );
    }
    if (neck > MEASUREMENT_THRESHOLDS.desk.neckInclinationDegrees) {
      issues.push(
        issue(
          "desk-neck-inclination",
          "Neck inclination",
          neck,
          MEASUREMENT_THRESHOLDS.desk.neckInclinationDegrees,
          2,
          "Raise the screen toward eye level and let your gaze travel forward.",
        ),
      );
    }
    if (torso > MEASUREMENT_THRESHOLDS.desk.torsoInclinationDegrees) {
      issues.push(
        issue(
          "desk-torso-inclination",
          "Torso inclination",
          torso,
          MEASUREMENT_THRESHOLDS.desk.torsoInclinationDegrees,
          2,
          "Try stacking your ribs over your hips and moving closer to your desk.",
        ),
      );
    }
    if (torso > MEASUREMENT_THRESHOLDS.desk.prolongedTorsoInclinationDegrees) {
      issues.push(
        issue(
          "desk-prolonged-slouch",
          "Prolonged slouch",
          torso,
          MEASUREMENT_THRESHOLDS.desk.prolongedTorsoInclinationDegrees,
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
  mode: AnalysisMode,
): RawIssue | null {
  if (!baseline.torso) return null;
  const { shoulder, hip } = torsoSegmentForMode(observation.landmarks, mode);
  const torso = Math.max(
    MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale,
    Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y),
  );
  const torsoRatio = torso / baseline.torso;
  if (
    torsoRatio >= MEASUREMENT_THRESHOLDS.framing.minimumTorsoRatio &&
    torsoRatio <= MEASUREMENT_THRESHOLDS.framing.maximumTorsoRatio
  )
    return null;
  return issue(
    "framing-torso-distance",
    "Return to your calibrated distance",
    Math.abs(torsoRatio - 1),
    MEASUREMENT_THRESHOLDS.framing.torsoRatioDeviation,
    2,
    "Keep your full body in frame and return to the distance used during calibration.",
  );
}

function wholeBodyFramingIssue(
  observation: FrameObservation,
  baseline: Readonly<Record<string, number>>,
  mode: Exclude<AnalysisMode, "desk">,
): RawIssue | null {
  const torsoIssue = calibrationFramingIssue(observation, baseline, mode);
  if (torsoIssue) return torsoIssue;
  const frameDeviation = wholeBodyFrameDeviation(observation.landmarks, mode);
  if (frameDeviation === 0) return null;
  return issue(
    "framing-whole-body",
    "Keep your whole body visible",
    frameDeviation,
    0,
    2,
    "Move or rotate the phone so your head and both feet have a little space from every frame edge.",
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
  moreFlexedKneeAngle: number;
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

  const stanceSeparation = normalizedLungeStanceSeparation(
    observation.landmarks,
    observation.worldLandmarks,
    observation.cameraView,
  );
  if (stanceSeparation === null) return null;
  const moreFlexedKneeAngle = Math.min(leftKneeAngle, rightKneeAngle);
  return {
    moreFlexedKneeAngle,
    stanceSeparation,
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

function elbowAngleForSide(observation: FrameObservation, side: "left" | "right"): number | null {
  return angleAt(
    observation.landmarks[`${side}Shoulder`],
    observation.landmarks[`${side}Elbow`],
    observation.landmarks[`${side}Wrist`],
  );
}

function elbowFlare(observation: FrameObservation): number | null {
  const shoulders = midpoint(
    observation.landmarks.leftShoulder,
    observation.landmarks.rightShoulder,
  );
  const hips = midpoint(observation.landmarks.leftHip, observation.landmarks.rightHip);
  const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  if (!Number.isFinite(torso) || torso < MEASUREMENT_THRESHOLDS.geometry.minimumDistance)
    return null;
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
    Math.hypot(a.x - b.x, a.y - b.y) >= MEASUREMENT_THRESHOLDS.geometry.minimumDistance
  );
}

function geometryIsAvailable(mode: AnalysisMode, observation: FrameObservation): boolean {
  const { landmarks } = observation;
  const shoulderMidpoint = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hipMidpoint = midpoint(landmarks.leftHip, landmarks.rightHip);
  if (mode === "standing") {
    return (
      projectedSegmentIsAvailable(shoulderMidpoint, hipMidpoint) &&
      angleAt(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle) !== null &&
      angleAt(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle) !== null &&
      (observation.cameraView === "front" ||
        projectedSegmentIsAvailable(landmarks.rightEar, landmarks.rightShoulder))
    );
  }
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
    const visibleSide = mostVisibleBodySide(landmarks, mode);
    return (
      bodyLineAngle(observation, visibleSide) !== null &&
      (mode === "plank" || elbowAngleForSide(observation, visibleSide) !== null)
    );
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
  mode: ExerciseMode,
  baseline: Readonly<Record<string, number>>,
): { down: number; entry: number; up: number } {
  if (mode === "plank") return { down: 0, entry: 0, up: 0 };
  const calibratedTop = baseline.movementMetric;
  if (!Number.isFinite(calibratedTop)) {
    const down = MEASUREMENT_THRESHOLDS.exercise.defaultDownDegrees[mode];
    return {
      down,
      entry: Math.min(
        MEASUREMENT_THRESHOLDS.exercise.defaultEntryMaximumDegrees,
        down + MEASUREMENT_THRESHOLDS.exercise.defaultEntryOffsetDegrees,
      ),
      up: MEASUREMENT_THRESHOLDS.exercise.defaultUpDegrees,
    };
  }
  const range = MEASUREMENT_THRESHOLDS.exercise.calibratedDown[mode];
  const down = bounded(calibratedTop - range.offset, range.minimum, range.maximum);
  return {
    down,
    entry: Math.min(
      MEASUREMENT_THRESHOLDS.exercise.calibratedEntryMaximumDegrees,
      down + MEASUREMENT_THRESHOLDS.exercise.calibratedEntryOffsetDegrees,
    ),
    up: bounded(
      calibratedTop - MEASUREMENT_THRESHOLDS.exercise.calibratedUpOffsetDegrees,
      MEASUREMENT_THRESHOLDS.exercise.calibratedUpMinimumDegrees,
      MEASUREMENT_THRESHOLDS.exercise.calibratedUpMaximumDegrees,
    ),
  };
}

function bodyLineTolerance(baseline: Readonly<Record<string, number>>): number {
  const calibratedLine = baseline.movementMetric;
  return Number.isFinite(calibratedLine)
    ? Math.max(
        MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees,
        Math.abs(MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees - calibratedLine) +
          MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees,
      )
    : MEASUREMENT_THRESHOLDS.exercise.defaultBodyLineToleranceDegrees;
}

function lungeStanceThreshold(baseline: Readonly<Record<string, number>>): number {
  return Math.max(
    MEASUREMENT_THRESHOLDS.exercise.minimumLungeStanceRatio,
    (baseline.stanceSeparation ?? 0) *
      MEASUREMENT_THRESHOLDS.exercise.calibratedLungeStanceMultiplier,
  );
}

function curlFlareThreshold(baseline: Readonly<Record<string, number>>): number {
  return Math.max(
    MEASUREMENT_THRESHOLDS.exercise.minimumCurlFlareRatio,
    (baseline.elbowFlare ?? MEASUREMENT_THRESHOLDS.exercise.fallbackCurlFlareBaseline) +
      MEASUREMENT_THRESHOLDS.exercise.calibratedCurlFlareMargin,
  );
}

type ExerciseDecisionPolicy = {
  rangeRuleId: MeasurementRuleId;
  alignmentRuleIdsByView: Readonly<Partial<Record<CameraView, readonly MeasurementRuleId[]>>>;
};

const EXERCISE_DECISION_POLICY: Readonly<Record<RepMode, ExerciseDecisionPolicy>> = {
  squat: {
    rangeRuleId: "squat-range",
    alignmentRuleIdsByView: {
      front: ["squat-knee-tracking"],
      "three-quarter": ["squat-knee-tracking"],
    },
  },
  lunge: {
    rangeRuleId: "lunge-range",
    alignmentRuleIdsByView: {
      front: ["lunge-split-stance", "lunge-knee-tracking"],
      side: ["lunge-split-stance"],
      "three-quarter": ["lunge-split-stance", "lunge-knee-tracking"],
    },
  },
  pushup: {
    rangeRuleId: "pushup-range",
    alignmentRuleIdsByView: { side: ["pushup-body-line"] },
  },
  curl: {
    rangeRuleId: "curl-range",
    alignmentRuleIdsByView: { front: ["curl-elbow-flare"] },
  },
};

function evaluatedDecisionRuleIds(
  mode: AnalysisMode,
  view: CameraView,
): readonly MeasurementRuleId[] {
  return MEASUREMENT_RULES.filter(
    (rule) =>
      rule.category !== "framing" &&
      rule.id !== "rep-phase-timing" &&
      rule.id !== "rep-alignment-persistence" &&
      (rule.modes as readonly AnalysisMode[]).includes(mode) &&
      (rule.views as readonly CameraView[]).includes(view),
  ).map((rule) => rule.id);
}

function exerciseFrame(
  mode: ExerciseMode,
  observation: FrameObservation,
  state: ExerciseState,
  baseline: Readonly<Record<string, number>>,
): ComputedFrame {
  const issues: RawIssue[] = [];
  const evaluatedAlignmentRuleIds = new Set<MeasurementRuleId>();
  const framingIssue = calibrationFramingIssue(observation, baseline, mode);
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
    metric = mode === "lunge" ? (lunge?.moreFlexedKneeAngle ?? null) : chooseKneeAngle(observation);
    metrics.kneeAngle = metric ?? 0;
    if (lunge) {
      metrics.moreFlexedKneeAngle = lunge.moreFlexedKneeAngle;
      metrics.stanceSeparation = lunge.stanceSeparation;
      evaluatedAlignmentRuleIds.add("lunge-split-stance");
      const stanceThreshold = lungeStanceThreshold(baseline);
      if (lunge.stanceSeparation < stanceThreshold) {
        issues.push(
          issue(
            "lunge-split-stance",
            "Split stance",
            lunge.stanceSeparation,
            stanceThreshold,
            3,
            "Step one foot forward and one foot back so the legs can bend independently.",
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
      evaluatedAlignmentRuleIds.add(
        mode === "squat" ? "squat-knee-tracking" : "lunge-knee-tracking",
      );
      if (kneeAlignmentDeviation > MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation) {
        issues.push(
          issue(
            mode === "squat" ? "squat-knee-tracking" : "lunge-knee-tracking",
            "Knee tracking",
            kneeAlignmentDeviation,
            MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation,
            3,
            "Keep each visible knee tracking near its hip-to-foot corridor instead of letting it drift inward or outward.",
          ),
        );
      }
    }
    if (
      metric !== null &&
      observation.cameraView === "side" &&
      metric > downThreshold &&
      metric < MEASUREMENT_THRESHOLDS.exercise.partialRangeMaximumDegrees &&
      state.candidate
    ) {
      issues.push(
        issue(
          mode === "squat" ? "squat-range" : "lunge-range",
          "Range is not quite there",
          metric,
          downThreshold,
          2,
          mode === "squat"
            ? "Try sitting a little lower while keeping your feet grounded."
            : "Lower with control and keep both visible knees moving steadily over their feet.",
        ),
      );
    }
  } else if (mode === "pushup" || mode === "curl") {
    const visibleSide = mode === "pushup" ? mostVisibleBodySide(observation.landmarks, mode) : null;
    metric = visibleSide
      ? elbowAngleForSide(observation, visibleSide)
      : chooseElbowAngle(observation);
    metrics.elbowAngle = metric ?? 0;
    if (mode === "pushup") {
      const line = bodyLineAngle(observation, visibleSide ?? "left");
      const deviation =
        line === null
          ? null
          : Math.abs(MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees - line);
      metrics.bodyLineAngle = line ?? 0;
      metrics.bodyLineDeviation = deviation ?? 0;
      if (deviation !== null) evaluatedAlignmentRuleIds.add("pushup-body-line");
      if (deviation !== null && deviation > bodyLineTolerance(baseline)) {
        issues.push(
          issue(
            "pushup-body-line",
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
      metric < MEASUREMENT_THRESHOLDS.exercise.partialRangeMaximumDegrees &&
      state.candidate
    ) {
      issues.push(
        issue(
          "pushup-range",
          "Push-up depth",
          metric,
          downThreshold,
          2,
          "Move through a comfortable, consistent depth before pressing away.",
        ),
      );
    }
    const flare =
      mode === "curl" && observation.cameraView === "front" ? elbowFlare(observation) : null;
    if (flare !== null) {
      metrics.elbowFlare = flare;
      evaluatedAlignmentRuleIds.add("curl-elbow-flare");
    }
    if (flare !== null && mode === "curl" && flare > curlFlareThreshold(baseline)) {
      issues.push(
        issue(
          "curl-elbow-flare",
          "Curl control",
          flare,
          curlFlareThreshold(baseline),
          2,
          "Keep the elbow close to your ribs while the forearm moves, then lower with control.",
        ),
      );
    }
  } else if (mode === "plank") {
    const visibleSide = mostVisibleBodySide(observation.landmarks, mode);
    metric = bodyLineAngle(observation, visibleSide);
    metrics.bodyLineAngle = metric ?? 0;
    const lineTolerance = bodyLineTolerance(baseline);
    if (
      metric !== null &&
      Math.abs(MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees - metric) > lineTolerance
    ) {
      issues.push(
        issue(
          "plank-body-line",
          "Body line",
          Math.abs(MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees - metric),
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
    phase =
      metric !== null &&
      Math.abs(MEASUREMENT_THRESHOLDS.geometry.straightAngleDegrees - metric) <= lineTolerance
        ? "hold"
        : "paused";
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
  const repMode = mode as RepMode;
  const decisionPolicy = EXERCISE_DECISION_POLICY[repMode];
  const trackedAlignmentRuleIds =
    decisionPolicy.alignmentRuleIdsByView[observation.cameraView] ?? [];
  const activeAlignmentRuleIds = new Set(
    issues
      .map((candidate) => candidate.measurementRuleId)
      .filter((ruleId) => trackedAlignmentRuleIds.includes(ruleId)),
  );
  if (state.candidate) {
    for (const ruleId of evaluatedAlignmentRuleIds) {
      state.evaluatedAlignmentRuleIds.add(ruleId);
    }
    state.candidateMinMetric =
      state.candidateMinMetric === null ? metric : Math.min(state.candidateMinMetric, metric);
    if (metric <= downThreshold) state.rangeReached = true;
    for (const ruleId of state.alignmentStartedAtByRule.keys()) {
      if (!activeAlignmentRuleIds.has(ruleId)) state.alignmentStartedAtByRule.delete(ruleId);
    }
    for (const ruleId of activeAlignmentRuleIds) {
      const startedAtMs = state.alignmentStartedAtByRule.get(ruleId) ?? timestampMs;
      state.alignmentStartedAtByRule.set(ruleId, startedAtMs);
      if (
        timestampMs - startedAtMs >=
        MEASUREMENT_THRESHOLDS.temporal.minimumAlignmentPersistenceMs
      ) {
        state.alignmentUnstableRuleIds.add(ruleId);
      }
    }
  }
  if (!state.candidate && metric <= entryThreshold) {
    state.candidate = true;
    state.candidateStartedAtMs = timestampMs;
    state.candidateMinMetric = metric;
    state.rangeReached = metric <= downThreshold;
    state.alignmentStartedAtByRule.clear();
    for (const ruleId of activeAlignmentRuleIds) {
      state.alignmentStartedAtByRule.set(ruleId, timestampMs);
    }
    state.alignmentUnstableRuleIds.clear();
    state.evaluatedAlignmentRuleIds.clear();
    for (const ruleId of evaluatedAlignmentRuleIds) {
      state.evaluatedAlignmentRuleIds.add(ruleId);
    }
    phase = "eccentric";
  } else if (
    state.candidate &&
    metric <= downThreshold + MEASUREMENT_THRESHOLDS.exercise.bottomPhaseMarginDegrees
  ) {
    phase = "bottom";
  } else if (state.candidate && metric >= upThreshold) {
    state.candidate = false;
    const dwellMs = timestampMs - (state.candidateStartedAtMs ?? timestampMs);
    const cooldownMs = timestampMs - state.lastRepTimestampMs;
    const rangeReached = state.rangeReached;
    const alignmentUnstableRuleIds = [...state.alignmentUnstableRuleIds];
    const evaluatedAlignmentRuleIdsDuringRep = [...state.evaluatedAlignmentRuleIds];
    state.candidateStartedAtMs = null;
    state.candidateMinMetric = null;
    state.rangeReached = false;
    state.alignmentStartedAtByRule.clear();
    state.alignmentUnstableRuleIds.clear();
    state.evaluatedAlignmentRuleIds.clear();
    state.lastTimestamp = timestampMs;
    if (
      dwellMs < MEASUREMENT_THRESHOLDS.temporal.minimumRepDwellMs ||
      cooldownMs < MEASUREMENT_THRESHOLDS.temporal.minimumRepCooldownMs
    ) {
      state.phase = "paused";
      return {
        status: "valid",
        phase: "paused",
        issues,
        metrics,
        validRep: false,
        rejectedRep: "phase_interrupted",
        decisionRuleIds: ["rep-phase-timing"],
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
        decisionRuleIds: [decisionPolicy.rangeRuleId],
      };
    }
    if (alignmentUnstableRuleIds.length > 0) {
      state.phase = "paused";
      return {
        status: "valid",
        phase: "paused",
        issues,
        metrics,
        validRep: false,
        rejectedRep: "alignment_not_stable",
        decisionRuleIds: ["rep-alignment-persistence", ...alignmentUnstableRuleIds],
      };
    }
    phase = "concentric";
    state.phase = phase;
    state.lastRepTimestampMs = timestampMs;
    state.repCount += 1;
    return {
      status: "valid",
      phase,
      issues,
      metrics,
      validRep: true,
      rejectedRep: null,
      decisionRuleIds: [
        decisionPolicy.rangeRuleId,
        "rep-phase-timing",
        ...(evaluatedAlignmentRuleIdsDuringRep.length > 0
          ? (["rep-alignment-persistence", ...evaluatedAlignmentRuleIdsDuringRep] as const)
          : []),
      ],
    };
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
    measurementRuleIds: ["capture-view-confidence"],
    evidenceIds: evidenceIdsForIssue("positioning"),
  };
}

function decisionRuleIdsForAbstention(
  reasons: readonly AbstentionReason[],
): readonly MeasurementRuleId[] {
  const ruleIds = new Set<MeasurementRuleId>();
  for (const reason of reasons) {
    if (
      reason === "missing_landmarks" ||
      reason === "low_visibility" ||
      reason === "low_presence" ||
      reason === "unstable_tracking"
    ) {
      ruleIds.add("capture-landmark-confidence");
    } else if (
      reason === "unsupported_view" ||
      reason === "observed_view_mismatch" ||
      reason === "unverified_view" ||
      reason === "mirror_unresolved"
    ) {
      ruleIds.add("capture-view-confidence");
    } else if (reason === "invalid_geometry") {
      ruleIds.add("capture-geometry-validity");
    } else if (reason === "stale_frame") {
      ruleIds.add("capture-monotonic-frame-time");
    } else if (reason === "uncalibrated") {
      ruleIds.add("calibration-stable-window");
    }
  }
  return [...ruleIds];
}

type StandingMetrics = {
  torso: number;
  bodyHeight: number;
  headOffset: number;
  bodyLean: number;
  shoulderTilt: number;
  hipTilt: number;
};

function standingMetrics(observation: FrameObservation): StandingMetrics {
  const { landmarks } = observation;
  const shoulders = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hips = midpoint(landmarks.leftHip, landmarks.rightHip);
  const ankles = midpoint(landmarks.leftAnkle, landmarks.rightAnkle);
  const ears = midpoint(landmarks.leftEar, landmarks.rightEar);
  const torso = Math.max(
    MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale,
    Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y),
  );
  const bodyHeight = Math.max(
    MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale,
    Math.max(landmarks.leftAnkle.y, landmarks.rightAnkle.y) -
      Math.min(landmarks.nose.y, landmarks.leftEar.y, landmarks.rightEar.y),
  );
  return {
    torso,
    bodyHeight,
    headOffset: (ears.x - shoulders.x) / torso,
    bodyLean: Math.abs(shoulders.x - ankles.x) / bodyHeight,
    shoulderTilt: (landmarks.leftShoulder.y - landmarks.rightShoulder.y) / torso,
    hipTilt: (landmarks.leftHip.y - landmarks.rightHip.y) / torso,
  };
}

function baselineNumber(
  baseline: Readonly<Record<string, number>>,
  key: string,
  fallback = 0,
): number {
  const value = baseline[key];
  return Number.isFinite(value) ? value : fallback;
}

function standingIssues(
  observation: FrameObservation,
  baseline: Readonly<Record<string, number>>,
): ComputedFrame {
  const metrics = standingMetrics(observation);
  const issues: RawIssue[] = [];
  const baselineHeadOffset = baselineNumber(baseline, "standingHeadOffset");
  const baselineBodyLean = baselineNumber(baseline, "standingBodyLean");
  const baselineShoulderTilt = baselineNumber(baseline, "standingShoulderTilt");
  const baselineHipTilt = baselineNumber(baseline, "standingHipTilt");
  const headDrift = Math.abs(metrics.headOffset - baselineHeadOffset);
  const bodyDrift = Math.abs(metrics.bodyLean - baselineBodyLean);
  const lateralDrift = Math.max(
    Math.abs(metrics.shoulderTilt - baselineShoulderTilt),
    Math.abs(metrics.hipTilt - baselineHipTilt),
  );

  if (
    (observation.cameraView === "side" || observation.cameraView === "three-quarter") &&
    headDrift > MEASUREMENT_THRESHOLDS.standing.headDriftRatio &&
    Math.abs(metrics.headOffset) > MEASUREMENT_THRESHOLDS.standing.headDriftRatio
  ) {
    issues.push(
      issue(
        "standing-head-drift",
        "Head alignment drift",
        headDrift,
        MEASUREMENT_THRESHOLDS.standing.headDriftRatio,
        3,
        "Gently bring your head back over your shoulders and keep your gaze level. Do not force your chin back.",
      ),
    );
  }
  if (
    (observation.cameraView === "side" || observation.cameraView === "three-quarter") &&
    bodyDrift > MEASUREMENT_THRESHOLDS.standing.bodyDriftRatio &&
    metrics.bodyLean > MEASUREMENT_THRESHOLDS.standing.bodyDriftRatio
  ) {
    issues.push(
      issue(
        "standing-trunk-drift",
        "Trunk alignment drift",
        bodyDrift,
        MEASUREMENT_THRESHOLDS.standing.bodyDriftRatio,
        2,
        "Let your shoulders stack more comfortably over your hips and keep your knees easy instead of bracing rigidly.",
      ),
    );
  }
  if (
    (observation.cameraView === "front" || observation.cameraView === "three-quarter") &&
    lateralDrift > MEASUREMENT_THRESHOLDS.standing.lateralDriftRatio
  ) {
    issues.push(
      issue(
        "standing-lateral-drift",
        "Side-to-side difference",
        lateralDrift,
        MEASUREMENT_THRESHOLDS.standing.lateralDriftRatio,
        2,
        "Level the camera, relax both shoulders, and let your weight settle evenly before trying to correct the shape.",
      ),
    );
  }

  return {
    status: "valid",
    phase: "ready",
    issues,
    metrics: {
      torso: metrics.torso,
      bodyHeight: metrics.bodyHeight,
      headOffset: metrics.headOffset,
      bodyLean: metrics.bodyLean,
      shoulderTilt: metrics.shoulderTilt,
      hipTilt: metrics.hipTilt,
      headDrift,
      bodyDrift,
      lateralDrift,
    },
    validRep: false,
    rejectedRep: null,
  };
}

function feedbackFor(result: {
  status: EvaluationResult["status"];
  issues: readonly EvaluationIssue[];
  mode: AnalysisMode;
  view: CameraView;
  confidence: EvaluationResult["confidence"];
  decisionRuleIds: readonly MeasurementRuleId[];
  framingRuleId?: MeasurementRuleId;
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
      issueCode: "positioning",
      measurementRuleIds: result.framingRuleId ? [result.framingRuleId] : undefined,
      evidenceIds: evidenceIdsForIssue("positioning"),
    };
  }
  if (result.confidence.reasons.includes("uncalibrated")) {
    return {
      id: "calibrate-first",
      priority: 115,
      tone: "guide",
      title: "Calibrate first",
      body: "Hold a relaxed position while the view-specific baseline settles. Form advice stays paused until then.",
      measurementRuleIds:
        result.decisionRuleIds.length > 0 ? result.decisionRuleIds : ["calibration-stable-window"],
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
      measurementRuleIds: result.decisionRuleIds,
    };
  }
  if (result.rejectedRep === "phase_interrupted") {
    return {
      id: "rep-not-counted",
      priority: 60,
      tone: "guide",
      title: "Rep not counted",
      body: "Stay in the movement phase a little longer and keep the next repetition controlled.",
      measurementRuleIds: result.decisionRuleIds,
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
      measurementRuleIds: result.decisionRuleIds,
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
      measurementRuleIds: result.decisionRuleIds,
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
      measurementRuleIds: [first.measurementRuleId],
      evidenceIds: evidenceIdsForIssue(first.code),
    };
  }
  if (result.validRep)
    return {
      id: "rep-complete",
      priority: 20,
      tone: "positive",
      title: "Rep logged",
      body: "Movement crossed this mode's local thresholds. Keep a comfortable, controlled rhythm; this count is not a safety or health clearance.",
      measurementRuleIds: result.decisionRuleIds,
      evidenceIds: evidenceIdsForMode(result.mode),
    };
  if (result.mode === "standing")
    return {
      id: "standing-steady",
      priority: 20,
      tone: "positive",
      title: "Standing alignment looks steady",
      body: "No supported persistent deviation is detected in this view. Visible landmarks remain close to your relaxed baseline; this is not a health assessment or medical clearance.",
      measurementRuleIds: result.decisionRuleIds,
      evidenceIds: evidenceIdsForMode(result.mode),
    };
  return {
    id: "ready",
    priority: 10,
    tone: "positive",
    title: "Looking steady",
    body: "No supported persistent issue is detected in this view. Keep breathing normally; this local result is not a safety or health clearance.",
    measurementRuleIds: result.decisionRuleIds,
    evidenceIds: evidenceIdsForMode(result.mode),
  };
}

export class PostureEngine {
  // Favor current-frame response while retaining enough filtering to keep
  // low-light/mobile landmark jitter from becoming false coaching cues.
  private readonly smoother = new LandmarkSmoother(
    MEASUREMENT_THRESHOLDS.temporal.evaluatorSmootherAlphaAtReferenceFrame,
  );
  private readonly gates = new Map<MeasurementRuleId, PersistenceGate>();
  private readonly exercises = new Map<ExerciseMode, ExerciseState>();
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
    const timestampStepMs = timestampMs - this.lastObservationTimestamp;
    if (
      !Number.isFinite(timestampMs) ||
      (this.lastObservationTimestamp >= 0 &&
        timestampStepMs < MEASUREMENT_THRESHOLDS.temporal.minimumSubmittedTimestampStepMs)
    ) {
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
        decisionRuleIds: ["capture-monotonic-frame-time"] as const,
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
        ? this.mode === "desk"
          ? calibrationFramingIssue(smoothed, calibrationProfile.baseline, this.mode)
          : wholeBodyFramingIssue(
              smoothed,
              calibrationProfile.baseline,
              this.mode as Exclude<AnalysisMode, "desk">,
            )
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
        decisionRuleIds: framingIssue
          ? [framingIssue.measurementRuleId]
          : decisionRuleIdsForAbstention(gatedConfidence.reasons),
        validRep: false,
        rejectedRep: null,
        repCount: this.currentRepCount(),
        metrics: {},
      };
      return {
        ...result,
        feedback: feedbackFor({
          ...result,
          view: smoothed.cameraView,
          framingRuleId: framingIssue?.measurementRuleId,
        }),
      };
    }

    const raw =
      this.mode === "standing"
        ? standingIssues(smoothed, this.calibrationProfile?.baseline ?? {})
        : this.mode === "desk"
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
        decisionRuleIds: ["capture-geometry-validity"] as const,
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
      decisionRuleIds:
        raw.decisionRuleIds ?? evaluatedDecisionRuleIds(this.mode, smoothed.cameraView),
      validRep: raw.validRep,
      rejectedRep: raw.rejectedRep,
      repCount: this.currentRepCount(),
      metrics: raw.metrics,
    };
    return { ...result, feedback: feedbackFor({ ...result, view: smoothed.cameraView }) };
  }

  private persist(rawIssues: RawIssue[], timestampMs: number): EvaluationIssue[] {
    const present = new Set(rawIssues.map((candidate) => candidate.measurementRuleId));
    for (const [measurementRuleId, gate] of this.gates) {
      if (!present.has(measurementRuleId)) gate.update(false, timestampMs);
    }
    return rawIssues.flatMap((candidate) => {
      const persistenceMs = MEASUREMENT_RULE_BY_ID[candidate.measurementRuleId].persistenceMs;
      const gate =
        this.gates.get(candidate.measurementRuleId) ?? new PersistenceGate(persistenceMs);
      this.gates.set(candidate.measurementRuleId, gate);
      return gate.update(true, timestampMs)
        ? [
            {
              ...candidate,
              persistenceMs,
            },
          ]
        : [];
    });
  }

  private exerciseState(mode: ExerciseMode): ExerciseState {
    const existing = this.exercises.get(mode);
    if (existing) return existing;
    const state = defaultExerciseState();
    this.exercises.set(mode, state);
    return state;
  }

  private currentRepCount(): number {
    return this.mode === "desk" || this.mode === "standing"
      ? 0
      : this.exerciseState(this.mode).repCount;
  }

  private resetTemporalState(): void {
    this.smoother.reset();
    this.lastObservationTimestamp = -1;
    for (const gate of this.gates.values()) gate.reset();
    this.gates.clear();
    const state =
      this.mode === "desk" || this.mode === "standing" ? null : this.exerciseState(this.mode);
    if (state) {
      state.phase = "ready";
      state.candidate = false;
      state.candidateStartedAtMs = null;
      state.candidateMinMetric = null;
      state.rangeReached = false;
      state.alignmentStartedAtByRule.clear();
      state.alignmentUnstableRuleIds.clear();
      state.evaluatedAlignmentRuleIds.clear();
      state.lastRepTimestampMs = -Infinity;
      state.lastTimestamp = -1;
    }
  }

  private interruptActiveExercise(): void {
    if (this.mode === "desk" || this.mode === "standing") return;
    const state = this.exerciseState(this.mode);
    state.candidate = false;
    state.candidateStartedAtMs = null;
    state.alignmentStartedAtByRule.clear();
    state.alignmentUnstableRuleIds.clear();
    state.evaluatedAlignmentRuleIds.clear();
    state.phase = "paused";
  }
}

export function createEngine(): PostureEngine {
  return new PostureEngine();
}

export function viewForMode(mode: AnalysisMode): CameraView {
  return SUPPORTED_VIEWS[mode][0];
}
