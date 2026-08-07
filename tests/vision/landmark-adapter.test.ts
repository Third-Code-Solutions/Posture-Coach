import { describe, expect, it } from "vitest";
import { LANDMARK_NAMES, MEASUREMENT_THRESHOLDS } from "../../src/domain";
import { createObservation, estimateCameraView, normalizeLandmarks } from "../../src/vision";
import { makeLandmarks } from "../domain/fixtures";

describe("MediaPipe landmark adapter", () => {
  it("uses web visibility as the presence fallback", () => {
    const landmarks = normalizeLandmarks(
      LANDMARK_NAMES.map((_, index) => ({
        x: index / LANDMARK_NAMES.length,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      })),
    );
    expect(landmarks.leftShoulder.visibility).toBe(0.9);
    expect(landmarks.leftShoulder.presence).toBe(0.9);
  });

  it("preserves an explicit presence value when a runtime provides one", () => {
    const observation = createObservation({
      rawLandmarks: [{ x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.4 }],
      rawWorldLandmarks: [],
      timestampMs: 0,
      sequence: 0,
      source: "fixture",
      cameraView: "side",
      mirroredPreview: false,
    });
    expect(observation.landmarks.nose.presence).toBe(0.4);
    expect(observation.poseConfidence).toBe(0.4);
  });

  it("turns non-finite geometry into low-confidence evidence", () => {
    const observation = createObservation({
      rawLandmarks: [{ x: Number.NaN, y: 0, z: 0, visibility: 0.95 }],
      rawWorldLandmarks: [],
      timestampMs: 0,
      sequence: 0,
      source: "fixture",
      cameraView: "side",
      mirroredPreview: false,
    });
    expect(observation.landmarks.nose.visibility).toBe(0);
    expect(observation.landmarks.nose.presence).toBe(0);
    expect(observation.poseConfidence).toBe(0);
  });

  it("estimates front and side orientation from observed geometry", () => {
    expect(estimateCameraView(makeLandmarks()).view).toBe("front");
    const side = makeLandmarks({
      leftShoulder: { x: 0.49 },
      rightShoulder: { x: 0.51 },
      leftHip: { x: 0.495 },
      rightHip: { x: 0.505 },
    });
    expect(estimateCameraView(side).view).toBe("side");
  });

  it("rejects view segments below the registry geometry floor", () => {
    const subMinimum = MEASUREMENT_THRESHOLDS.geometry.minimumDistance / 2;
    const degenerate = makeLandmarks({
      leftShoulder: { x: 0.5 },
      rightShoulder: { x: 0.5 + subMinimum },
      leftHip: { x: 0.5 },
      rightHip: { x: 0.5 + subMinimum },
    });

    expect(estimateCameraView(degenerate)).toEqual({ view: "unknown", confidence: 0 });
  });
});
