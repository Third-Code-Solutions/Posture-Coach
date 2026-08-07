import type { AnalysisMode, CameraView, CalibrationProfile, FrameObservation } from "../contracts";
import { isObservedViewCompatible, MIN_OBSERVED_VIEW_CONFIDENCE } from "../contracts";
import { assessConfidence } from "../confidence";
import {
  angleAt,
  distance,
  isFinitePoint,
  midpoint,
  mostVisibleBodySide,
  normalizedLungeStanceSeparation,
  torsoSegmentForMode,
  wholeBodyFrameDeviation,
} from "../geometry";
import { MEASUREMENT_THRESHOLDS } from "../measurement-registry";

export const CALIBRATION_SAMPLE_TARGET = MEASUREMENT_THRESHOLDS.calibration.sampleTarget;

export function createCalibrationProfile(
  mode: AnalysisMode,
  view: CameraView,
  mirroredPreview: boolean,
  observedView: CameraView = view,
  viewConfidence = 1,
): CalibrationProfile {
  return {
    mode,
    cameraView: view,
    observedView,
    viewConfidence,
    mirroredPreview,
    stable: false,
    sampleCount: 0,
    completedAtMs: null,
    baseline: {},
  };
}

export class CalibrationWindow {
  private samples: Array<Record<string, number>> = [];
  private readonly targetSamples: number;
  private readonly mode: AnalysisMode;
  private readonly view: CameraView;
  private readonly mirroredPreview: boolean;
  private lastTimestampMs: number | null = null;
  private observedView: CameraView;
  private viewConfidence = 0;

  constructor(
    mode: AnalysisMode,
    view: CameraView,
    mirroredPreview: boolean,
    targetSamples: number = CALIBRATION_SAMPLE_TARGET,
    private readonly startedAtMs: number = -Infinity,
  ) {
    this.mode = mode;
    this.view = view;
    this.mirroredPreview = mirroredPreview;
    this.targetSamples = targetSamples;
    this.observedView = "unknown";
  }

  add(observation: FrameObservation): CalibrationProfile {
    if (!this.acceptsTimestamp(observation.timestampMs)) return this.profile(null);
    const confidence = assessConfidence(observation, this.mode);
    const timestampGap =
      this.lastTimestampMs === null ? null : observation.timestampMs - this.lastTimestampMs;
    if (
      observation.cameraView !== this.view ||
      observation.mirroredPreview !== this.mirroredPreview ||
      observation.viewConfidence < MIN_OBSERVED_VIEW_CONFIDENCE ||
      !isObservedViewCompatible(this.mode, this.view, observation.observedView) ||
      (timestampGap !== null &&
        (timestampGap <= 0 ||
          timestampGap > MEASUREMENT_THRESHOLDS.calibration.maximumSampleGapMs)) ||
      confidence.state === "insufficient" ||
      confidence.state === "unsupported" ||
      (this.mode !== "desk" && wholeBodyFrameDeviation(observation.landmarks, this.mode) > 0)
    ) {
      this.samples = [];
      this.lastTimestampMs = observation.timestampMs;
      return this.profile(null);
    }
    this.lastTimestampMs = observation.timestampMs;
    this.observedView = observation.observedView;
    this.viewConfidence = observation.viewConfidence;
    const { shoulder, hip } = torsoSegmentForMode(observation.landmarks, this.mode);
    if (
      !isFinitePoint(shoulder) ||
      !isFinitePoint(hip) ||
      distance(shoulder, hip) < MEASUREMENT_THRESHOLDS.geometry.minimumDistance
    ) {
      this.samples = [];
      return this.profile(null);
    }
    const torso = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
    if (!Number.isFinite(torso) || torso < MEASUREMENT_THRESHOLDS.geometry.minimumDistance) {
      this.samples = [];
      return this.profile(null);
    }
    const movementMetric = calibrationMovementMetric(this.mode, observation);
    const isStationaryMode = this.mode === "desk" || this.mode === "standing";
    if (!isStationaryMode && movementMetric === null) {
      this.samples = [];
      return this.profile(null);
    }
    const extraMetrics = calibrationExtraMetrics(this.mode, observation);
    if (!isStationaryMode && extraMetrics === null) {
      this.samples = [];
      return this.profile(null);
    }
    const standingMetrics =
      this.mode === "standing" ? standingCalibrationMetrics(observation) : null;
    if (this.mode === "standing" && standingMetrics === null) {
      this.samples = [];
      return this.profile(null);
    }
    const deskMetrics = this.mode === "desk" ? deskCalibrationMetrics(observation) : null;
    if (this.mode === "desk" && deskMetrics === null) {
      this.samples = [];
      return this.profile(null);
    }
    this.samples.push({
      torso,
      shoulderTilt: Math.abs(
        observation.landmarks.leftShoulder.y - observation.landmarks.rightShoulder.y,
      ),
      hipTilt: Math.abs(observation.landmarks.leftHip.y - observation.landmarks.rightHip.y),
      ...(movementMetric === null ? {} : { movementMetric }),
      ...(extraMetrics ?? {}),
      ...(deskMetrics ?? {}),
      ...(standingMetrics ?? {}),
    });
    if (this.samples.length > this.targetSamples) this.samples.shift();
    const stable = this.samples.length >= this.targetSamples && this.isStable();
    const baseline = stable ? this.average() : {};
    return this.profile(stable ? { completedAtMs: observation.timestampMs, baseline } : null);
  }

  reset(): void {
    this.samples = [];
    this.lastTimestampMs = null;
  }

  acceptsTimestamp(timestampMs: number): boolean {
    return Number.isFinite(timestampMs) && timestampMs >= this.startedAtMs;
  }

  private profile(
    completed: { completedAtMs: number; baseline: Record<string, number> } | null,
  ): CalibrationProfile {
    return {
      mode: this.mode,
      cameraView: this.view,
      observedView: this.observedView,
      viewConfidence: this.viewConfidence,
      mirroredPreview: this.mirroredPreview,
      stable: completed !== null,
      sampleCount: this.samples.length,
      completedAtMs: completed?.completedAtMs ?? null,
      baseline: completed?.baseline ?? {},
    };
  }

  private isStable(): boolean {
    const torsos = this.samples.map((sample) => sample.torso);
    const min = Math.min(...torsos);
    const max = Math.max(...torsos);
    if (
      max - min >
      Math.max(
        MEASUREMENT_THRESHOLDS.calibration.torsoAbsoluteRange,
        min * MEASUREMENT_THRESHOLDS.calibration.torsoRelativeRange,
      )
    )
      return false;
    if (this.mode === "desk") {
      return metricsStayWithinRange(this.samples, {
        deskHeadOffset: MEASUREMENT_THRESHOLDS.calibration.deskMetricRange,
        deskShoulderTilt: MEASUREMENT_THRESHOLDS.calibration.deskMetricRange,
        deskTorsoLean: MEASUREMENT_THRESHOLDS.calibration.deskMetricRange,
      });
    }
    if (this.mode === "standing") {
      return metricsStayWithinRange(this.samples, {
        standingHeadOffset: MEASUREMENT_THRESHOLDS.calibration.standingHeadRange,
        standingBodyLean: MEASUREMENT_THRESHOLDS.calibration.standingBodyLeanRange,
        standingShoulderTilt: MEASUREMENT_THRESHOLDS.calibration.standingTiltRange,
        standingHipTilt: MEASUREMENT_THRESHOLDS.calibration.standingTiltRange,
      });
    }
    const metrics = this.samples.map((sample) => sample.movementMetric);
    if (metrics.some((value) => value === undefined)) return false;
    const minMetric = Math.min(...(metrics as number[]));
    const maxMetric = Math.max(...(metrics as number[]));
    if (
      maxMetric - minMetric >
      Math.max(
        MEASUREMENT_THRESHOLDS.calibration.movementAbsoluteRangeDegrees,
        Math.abs(minMetric) * MEASUREMENT_THRESHOLDS.calibration.movementRelativeRange,
      )
    )
      return false;
    const extraKeys =
      this.mode === "lunge" ? ["stanceSeparation"] : this.mode === "curl" ? ["elbowFlare"] : [];
    for (const key of extraKeys) {
      const values = this.samples.map((sample) => sample[key]);
      if (values.some((value) => value === undefined)) return false;
      const minValue = Math.min(...(values as number[]));
      const maxValue = Math.max(...(values as number[]));
      if (
        maxValue - minValue >
        Math.max(
          MEASUREMENT_THRESHOLDS.calibration.extraMetricAbsoluteRange,
          Math.abs(minValue) * MEASUREMENT_THRESHOLDS.calibration.extraMetricRelativeRange,
        )
      )
        return false;
    }
    return true;
  }

  private average(): Record<string, number> {
    const keys = Object.keys(this.samples[0] ?? {});
    return Object.fromEntries(
      keys.map((key) => [
        key,
        this.samples.reduce((sum, s) => sum + (s[key] ?? 0), 0) / this.samples.length,
      ]),
    );
  }
}

function metricsStayWithinRange(
  samples: ReadonlyArray<Readonly<Record<string, number>>>,
  tolerances: Readonly<Record<string, number>>,
): boolean {
  return Object.entries(tolerances).every(([key, tolerance]) => {
    const values = samples.map((sample) => sample[key]);
    if (values.some((value) => value === undefined || !Number.isFinite(value))) return false;
    const finiteValues = values as number[];
    return Math.max(...finiteValues) - Math.min(...finiteValues) <= tolerance;
  });
}

function deskCalibrationMetrics(observation: FrameObservation): Record<string, number> | null {
  const { landmarks } = observation;
  const shoulders = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hips = midpoint(landmarks.leftHip, landmarks.rightHip);
  const ears = midpoint(landmarks.leftEar, landmarks.rightEar);
  if (!isFinitePoint(shoulders) || !isFinitePoint(hips) || !isFinitePoint(ears)) return null;
  const torso = distance(shoulders, hips);
  if (!Number.isFinite(torso) || torso < MEASUREMENT_THRESHOLDS.geometry.minimumDistance)
    return null;
  const metrics = {
    deskHeadOffset: (ears.x - shoulders.x) / torso,
    deskShoulderTilt: (landmarks.leftShoulder.y - landmarks.rightShoulder.y) / torso,
    deskTorsoLean: (shoulders.x - hips.x) / torso,
  };
  return Object.values(metrics).every(Number.isFinite) ? metrics : null;
}

function standingCalibrationMetrics(observation: FrameObservation): Record<string, number> | null {
  const { landmarks } = observation;
  const shoulders = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hips = midpoint(landmarks.leftHip, landmarks.rightHip);
  const ankles = midpoint(landmarks.leftAnkle, landmarks.rightAnkle);
  const ears = midpoint(landmarks.leftEar, landmarks.rightEar);
  if (
    !isFinitePoint(shoulders) ||
    !isFinitePoint(hips) ||
    !isFinitePoint(ankles) ||
    !isFinitePoint(ears)
  ) {
    return null;
  }
  const torso = distance(shoulders, hips);
  const bodyHeight = Math.max(
    MEASUREMENT_THRESHOLDS.geometry.minimumNormalizedScale,
    Math.max(landmarks.leftAnkle.y, landmarks.rightAnkle.y) -
      Math.min(landmarks.nose.y, landmarks.leftEar.y, landmarks.rightEar.y),
  );
  if (
    !Number.isFinite(torso) ||
    torso < MEASUREMENT_THRESHOLDS.geometry.minimumDistance ||
    !Number.isFinite(bodyHeight)
  )
    return null;
  const metrics = {
    standingHeadOffset: (ears.x - shoulders.x) / torso,
    standingBodyLean: Math.abs(shoulders.x - ankles.x) / bodyHeight,
    standingShoulderTilt: (landmarks.leftShoulder.y - landmarks.rightShoulder.y) / torso,
    standingHipTilt: (landmarks.leftHip.y - landmarks.rightHip.y) / torso,
  };
  return Object.values(metrics).every(Number.isFinite) ? metrics : null;
}

function chooseAngle(
  left: number | null,
  right: number | null,
  leftScore: number,
  rightScore: number,
): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return leftScore >= rightScore ? left : right;
}

function calibrationMovementMetric(
  mode: AnalysisMode,
  observation: FrameObservation,
): number | null {
  const { landmarks } = observation;
  if (mode === "squat" || mode === "lunge") {
    const left = angleAt(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle);
    const right = angleAt(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle);
    if (mode === "lunge")
      return left === null ? right : right === null ? left : Math.min(left, right);
    return chooseAngle(
      left,
      right,
      Math.min(landmarks.leftKnee.visibility, landmarks.leftKnee.presence),
      Math.min(landmarks.rightKnee.visibility, landmarks.rightKnee.presence),
    );
  }
  if (mode === "pushup") {
    const side = mostVisibleBodySide(landmarks, mode);
    return angleAt(
      landmarks[`${side}Shoulder`],
      landmarks[`${side}Elbow`],
      landmarks[`${side}Wrist`],
    );
  }
  if (mode === "curl") {
    return chooseAngle(
      angleAt(landmarks.leftShoulder, landmarks.leftElbow, landmarks.leftWrist),
      angleAt(landmarks.rightShoulder, landmarks.rightElbow, landmarks.rightWrist),
      Math.min(landmarks.leftElbow.visibility, landmarks.leftElbow.presence),
      Math.min(landmarks.rightElbow.visibility, landmarks.rightElbow.presence),
    );
  }
  if (mode === "plank") {
    const side = mostVisibleBodySide(landmarks, mode);
    return angleAt(
      landmarks[`${side}Shoulder`],
      landmarks[`${side}Hip`],
      landmarks[`${side}Ankle`],
    );
  }
  return null;
}

function calibrationExtraMetrics(
  mode: AnalysisMode,
  observation: FrameObservation,
): Record<string, number> | null {
  if (mode === "lunge") {
    const stanceSeparation = normalizedLungeStanceSeparation(
      observation.landmarks,
      observation.worldLandmarks,
      observation.cameraView,
    );
    return stanceSeparation === null ? null : { stanceSeparation };
  }
  if (mode === "curl") {
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
    const elbowFlare = Math.max(left, right) / torso;
    return Number.isFinite(elbowFlare) ? { elbowFlare } : null;
  }
  return {};
}
