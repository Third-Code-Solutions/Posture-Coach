import type {
  CameraView,
  FrameObservation,
  LandmarkName,
  LandmarkSet,
  SourceKind,
} from "../../../src/domain";
import { createEmptyLandmarkSet } from "../../../src/domain";

export function makeLandmarks(
  overrides: Partial<Record<LandmarkName, Partial<LandmarkSet[LandmarkName]>>> = {},
): LandmarkSet {
  const set = createEmptyLandmarkSet();
  const points: Partial<Record<LandmarkName, [number, number]>> = {
    nose: [0.51, 0.19],
    leftEar: [0.47, 0.24],
    rightEar: [0.55, 0.24],
    leftShoulder: [0.43, 0.43],
    rightShoulder: [0.57, 0.43],
    leftElbow: [0.37, 0.56],
    rightElbow: [0.63, 0.56],
    leftWrist: [0.34, 0.7],
    rightWrist: [0.66, 0.7],
    leftHip: [0.45, 0.64],
    rightHip: [0.55, 0.64],
    leftKnee: [0.45, 0.8],
    rightKnee: [0.55, 0.8],
    leftAnkle: [0.45, 0.96],
    rightAnkle: [0.55, 0.96],
    leftHeel: [0.43, 0.98],
    rightHeel: [0.53, 0.98],
    leftFootIndex: [0.48, 0.98],
    rightFootIndex: [0.58, 0.98],
  };
  for (const [name, [x, y]] of Object.entries(points) as Array<[LandmarkName, [number, number]]>) {
    set[name] = { ...set[name], x, y, z: 0, visibility: 0.96, presence: 0.96 };
  }
  for (const [name, value] of Object.entries(overrides) as Array<
    [LandmarkName, Partial<LandmarkSet[LandmarkName]>]
  >) {
    set[name] = { ...set[name], ...value };
  }
  return set;
}

export function makeObservation(overrides: Partial<FrameObservation> = {}): FrameObservation {
  const cameraView = overrides.cameraView ?? ("side" as CameraView);
  return {
    timestampMs: 0,
    sequence: 0,
    landmarks: makeLandmarks(),
    source: "fixture" as SourceKind,
    cameraView,
    observedView: overrides.observedView ?? cameraView,
    viewConfidence: overrides.viewConfidence ?? 1,
    mirroredPreview: false,
    poseConfidence: 0.96,
    ...overrides,
  };
}

export function lowConfidenceObservation(): FrameObservation {
  const landmarks = makeLandmarks({
    leftShoulder: { visibility: 0.2, presence: 0.2 },
    rightShoulder: { visibility: 0.2, presence: 0.2 },
  });
  return makeObservation({ landmarks, poseConfidence: 0.35 });
}

export function noisySequence(length = 12): FrameObservation[] {
  return Array.from({ length }, (_, index) =>
    makeObservation({
      timestampMs: index * 33,
      sequence: index,
      landmarks: makeLandmarks({ nose: { x: 0.51 + (index % 2 === 0 ? 0.04 : -0.04) } }),
    }),
  );
}
