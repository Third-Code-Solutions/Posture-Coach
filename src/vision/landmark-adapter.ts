import type { CameraView, FrameObservation, LandmarkSet, Point3D, SourceKind } from "../domain";
import {
  createEmptyLandmarkSet,
  LANDMARK_NAMES,
  MIN_OBSERVED_VIEW_CONFIDENCE,
  midpoint,
} from "../domain";
import type { RawPoseLandmark } from "./protocol";

function confidenceValue(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value as number)) : 0;
}

export interface ViewEstimate {
  view: CameraView;
  confidence: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function finiteSegment(a: Point3D, b: Point3D): number | null {
  const value = Math.hypot(a.x - b.x, a.y - b.y);
  return Number.isFinite(value) && value > 1e-6 ? value : null;
}

/**
 * Estimate orientation from the observed pose instead of treating the UI
 * selection as evidence. This is intentionally conservative: ambiguous
 * geometry is reported as three-quarter/low-confidence and is gated by the
 * domain before any form advice is emitted.
 */
export function estimateCameraView(
  landmarks: LandmarkSet,
  worldLandmarks?: LandmarkSet,
): ViewEstimate {
  const shoulders = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hips = midpoint(landmarks.leftHip, landmarks.rightHip);
  const torso = finiteSegment(shoulders, hips);
  const shoulderWidth = finiteSegment(landmarks.leftShoulder, landmarks.rightShoulder);
  const hipWidth = finiteSegment(landmarks.leftHip, landmarks.rightHip);
  if (torso === null || shoulderWidth === null || hipWidth === null) {
    return { view: "unknown", confidence: 0 };
  }

  const widthRatio = (shoulderWidth * 0.65 + hipWidth * 0.35) / torso;
  const shoulderDepth =
    worldLandmarks === undefined
      ? 0
      : Math.abs(worldLandmarks.leftShoulder.z - worldLandmarks.rightShoulder.z);
  const bodyQuality = Math.min(
    landmarks.leftShoulder.visibility,
    landmarks.rightShoulder.visibility,
    landmarks.leftHip.visibility,
    landmarks.rightHip.visibility,
  );
  const sideEvidence =
    clamp((0.58 - widthRatio) / 0.28) * 0.72 + clamp(shoulderDepth / 0.35) * 0.28;
  const frontEvidence =
    clamp((widthRatio - 0.48) / 0.3) * 0.72 + clamp(1 - shoulderDepth / 0.35) * 0.28;
  const threeQuarterEvidence = 1 - Math.abs(frontEvidence - sideEvidence);
  const best = Math.max(sideEvidence, frontEvidence, threeQuarterEvidence * 0.72);
  const confidence = clamp(best * bodyQuality);
  if (confidence < MIN_OBSERVED_VIEW_CONFIDENCE) return { view: "unknown", confidence };
  if (sideEvidence >= frontEvidence && sideEvidence >= threeQuarterEvidence * 0.72) {
    return { view: "side", confidence };
  }
  if (frontEvidence >= sideEvidence && frontEvidence >= threeQuarterEvidence * 0.72) {
    return { view: "front", confidence };
  }
  return { view: "three-quarter", confidence };
}

export function normalizeLandmarks(raw: readonly RawPoseLandmark[]): LandmarkSet {
  const set = createEmptyLandmarkSet();
  LANDMARK_NAMES.forEach((name, index) => {
    const point = raw[index];
    if (!point) return;
    const validGeometry =
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
    const visibility = validGeometry ? confidenceValue(point.visibility) : 0;
    const presence = validGeometry ? confidenceValue(point.presence ?? visibility) : 0;
    set[name] = {
      x: validGeometry ? point.x : 0,
      y: validGeometry ? point.y : 0,
      z: validGeometry ? point.z : 0,
      visibility,
      // MediaPipe Tasks Web exposes visibility for pose landmarks; presence is
      // optional in the domain contract, so use visibility as its conservative
      // proxy when the runtime does not provide a separate value.
      presence,
    };
  });
  return set;
}

export function createObservation(input: {
  rawLandmarks: readonly RawPoseLandmark[];
  rawWorldLandmarks: readonly RawPoseLandmark[];
  timestampMs: number;
  sequence: number;
  source: SourceKind;
  cameraView: CameraView;
  mirroredPreview: boolean;
}): FrameObservation {
  const landmarks = normalizeLandmarks(input.rawLandmarks);
  const worldLandmarks = normalizeLandmarks(input.rawWorldLandmarks);
  const viewEstimate = estimateCameraView(landmarks, worldLandmarks);
  const scores = input.rawLandmarks.map((point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z))
      return 0;
    const visibility = confidenceValue(point.visibility);
    return Math.min(visibility, confidenceValue(point.presence ?? visibility));
  });
  const poseConfidence = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;
  return {
    ...input,
    landmarks,
    worldLandmarks,
    observedView: viewEstimate.view,
    viewConfidence: viewEstimate.confidence,
    poseConfidence,
  };
}

export function mirrorForPresentation(x: number, mirrored: boolean): number {
  return mirrored ? 1 - x : x;
}
