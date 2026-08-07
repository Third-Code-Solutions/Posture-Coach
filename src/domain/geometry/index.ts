import type { AnalysisMode, CameraView, Landmark, LandmarkSet, Point3D } from "../contracts";
import { MEASUREMENT_THRESHOLDS } from "../measurement-registry";

export const isFinitePoint = (point: Point3D | undefined): point is Point3D =>
  point !== undefined &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  Number.isFinite(point.z);

export function distance(a: Point3D, b: Point3D): number {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return 0;
  const result = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return Number.isFinite(result) ? result : 0;
}

export function midpoint(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function mostVisibleBodySide(
  landmarks: LandmarkSet,
  mode: "plank" | "pushup",
): "left" | "right" {
  const jointSuffixes =
    mode === "pushup"
      ? (["Shoulder", "Elbow", "Wrist", "Hip", "Ankle", "Heel", "FootIndex"] as const)
      : (["Shoulder", "Hip", "Ankle", "Heel", "FootIndex"] as const);
  const sideQuality = (side: "left" | "right") => {
    const values = jointSuffixes.map((suffix) => {
      const point = landmarks[`${side}${suffix}`];
      return Math.min(point.visibility, point.presence);
    });
    return {
      missing: values.filter(
        (value) => value < MEASUREMENT_THRESHOLDS.confidence.minimumLandmarkScore,
      ).length,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
  };
  const left = sideQuality("left");
  const right = sideQuality("right");
  if (left.missing !== right.missing) return left.missing < right.missing ? "left" : "right";
  return left.average >= right.average ? "left" : "right";
}

export function torsoSegmentForMode(
  landmarks: LandmarkSet,
  mode: AnalysisMode,
): { shoulder: Point3D; hip: Point3D } {
  if (mode === "plank" || mode === "pushup") {
    const side = mostVisibleBodySide(landmarks, mode);
    return {
      shoulder: landmarks[`${side}Shoulder`],
      hip: landmarks[`${side}Hip`],
    };
  }
  return {
    shoulder: midpoint(landmarks.leftShoulder, landmarks.rightShoulder),
    hip: midpoint(landmarks.leftHip, landmarks.rightHip),
  };
}

export function normalizedLungeStanceSeparation(
  landmarks: LandmarkSet,
  worldLandmarks?: LandmarkSet,
  cameraView: CameraView = "side",
): number | null {
  if (worldLandmarks) {
    const worldShoulders = midpoint(worldLandmarks.leftShoulder, worldLandmarks.rightShoulder);
    const worldHips = midpoint(worldLandmarks.leftHip, worldLandmarks.rightHip);
    const worldTorso = distance(worldShoulders, worldHips);
    const shoulderX = worldLandmarks.rightShoulder.x - worldLandmarks.leftShoulder.x;
    const shoulderZ = worldLandmarks.rightShoulder.z - worldLandmarks.leftShoulder.z;
    const shoulderSpan = Math.hypot(shoulderX, shoulderZ);
    const ankleX = worldLandmarks.rightAnkle.x - worldLandmarks.leftAnkle.x;
    const ankleZ = worldLandmarks.rightAnkle.z - worldLandmarks.leftAnkle.z;
    if (
      worldTorso >= MEASUREMENT_THRESHOLDS.geometry.minimumDistance &&
      shoulderSpan >= MEASUREMENT_THRESHOLDS.geometry.minimumDistance &&
      Number.isFinite(ankleX) &&
      Number.isFinite(ankleZ)
    ) {
      const sagittalSeparation = Math.abs(
        ankleX * (-shoulderZ / shoulderSpan) + ankleZ * (shoulderX / shoulderSpan),
      );
      return sagittalSeparation / worldTorso;
    }
  }

  const shoulders = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
  const hips = midpoint(landmarks.leftHip, landmarks.rightHip);
  const projectedTorso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  if (projectedTorso < MEASUREMENT_THRESHOLDS.geometry.minimumDistance) return null;
  if (cameraView === "side") {
    return Math.abs(landmarks.leftAnkle.x - landmarks.rightAnkle.x) / projectedTorso;
  }
  if (cameraView === "front") {
    return Math.abs(landmarks.leftAnkle.y - landmarks.rightAnkle.y) / projectedTorso;
  }
  return null;
}

export function wholeBodyFrameDeviation(landmarks: LandmarkSet, mode: AnalysisMode): number {
  const includedSides: readonly ("left" | "right")[] =
    mode === "plank" || mode === "pushup"
      ? [mostVisibleBodySide(landmarks, mode)]
      : ["left", "right"];
  const extremities = [
    landmarks.nose,
    ...includedSides.flatMap((side) => [
      landmarks[`${side}Ankle`],
      landmarks[`${side}Heel`],
      landmarks[`${side}FootIndex`],
    ]),
  ];
  const left = Math.min(...extremities.map((point) => point.x));
  const right = Math.max(...extremities.map((point) => point.x));
  const top = Math.min(...extremities.map((point) => point.y));
  const bottom = Math.max(...extremities.map((point) => point.y));
  return Math.max(
    MEASUREMENT_THRESHOLDS.framing.minimumHeadMargin - top,
    MEASUREMENT_THRESHOLDS.framing.minimumHeadMargin - left,
    right - MEASUREMENT_THRESHOLDS.framing.maximumFeetCoordinate,
    bottom - MEASUREMENT_THRESHOLDS.framing.maximumFeetCoordinate,
    0,
  );
}

export function angleAt(a: Point3D, vertex: Point3D, b: Point3D): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(vertex) || !isFinitePoint(b)) return null;
  const ab = { x: a.x - vertex.x, y: a.y - vertex.y, z: a.z - vertex.z };
  const cb = { x: b.x - vertex.x, y: b.y - vertex.y, z: b.z - vertex.z };
  const aLength = Math.hypot(ab.x, ab.y, ab.z);
  const cLength = Math.hypot(cb.x, cb.y, cb.z);
  if (
    !Number.isFinite(aLength) ||
    !Number.isFinite(cLength) ||
    aLength < MEASUREMENT_THRESHOLDS.geometry.minimumDistance ||
    cLength < MEASUREMENT_THRESHOLDS.geometry.minimumDistance
  )
    return null;
  const rawCosine = (ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / (aLength * cLength);
  if (!Number.isFinite(rawCosine)) return null;
  const cosine = Math.min(1, Math.max(-1, rawCosine));
  const result = (Math.acos(cosine) * 180) / Math.PI;
  return Number.isFinite(result) ? result : null;
}

export function verticalDeviation(a: Point3D, b: Point3D): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  if (!Number.isFinite(length) || length < MEASUREMENT_THRESHOLDS.geometry.minimumDistance)
    return null;
  const result = (Math.atan2(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 180) / Math.PI;
  return Number.isFinite(result) ? result : null;
}

export function horizontalDeviation(a: Point3D, b: Point3D): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  if (!Number.isFinite(length) || length < MEASUREMENT_THRESHOLDS.geometry.minimumDistance)
    return null;
  const result = (Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * 180) / Math.PI;
  return Number.isFinite(result) ? result : null;
}

export function averageVisibility(points: readonly Landmark[]): number {
  const usable = points.filter(
    (point) =>
      Number.isFinite(point.visibility) &&
      Number.isFinite(point.presence) &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z),
  );
  if (usable.length === 0) return 0;
  return (
    usable.reduce((sum, point) => sum + Math.min(point.visibility, point.presence), 0) /
    usable.length
  );
}
