import { describe, expect, it } from "vitest";
import {
  type AnalysisMode,
  assessConfidence,
  CALIBRATION_SAMPLE_TARGET,
  CalibrationWindow,
  type CameraView,
  LandmarkSmoother,
  MEASUREMENT_THRESHOLDS,
  SessionTracker,
  angleAt,
  createEmptyLandmarkSet,
  isViewSupported,
} from "../../src/domain";
import { createEngine } from "../../src/domain/evaluators";
import {
  lowConfidenceObservation,
  makeLandmarks,
  makeObservation,
  noisySequence,
} from "./fixtures";

function setStableCalibration(
  engine: ReturnType<typeof createEngine>,
  mode: AnalysisMode,
  cameraView: CameraView = "side",
): void {
  engine.setMode(mode);
  engine.setCalibrationProfile({
    mode,
    cameraView,
    observedView: cameraView,
    viewConfidence: 1,
    mirroredPreview: false,
    stable: true,
    sampleCount: CALIBRATION_SAMPLE_TARGET,
    completedAtMs: 1,
    baseline: {},
  });
}

function makeFrontSplitWorldLandmarks() {
  return makeLandmarks({
    leftShoulder: { x: -0.2, y: 0, z: 0 },
    rightShoulder: { x: 0.2, y: 0, z: 0 },
    leftHip: { x: -0.15, y: 0.5, z: 0 },
    rightHip: { x: 0.15, y: 0.5, z: 0 },
    leftAnkle: { x: -0.1, y: 1, z: -0.5 },
    rightAnkle: { x: 0.1, y: 1, z: 0.5 },
  });
}

describe("domain contracts and evidence gates", () => {
  it("creates a complete 33-landmark set without undefined entries", () => {
    const set = createEmptyLandmarkSet();
    expect(Object.keys(set)).toHaveLength(33);
    expect(
      Object.values(set).every((point) => point.visibility === 0 && point.presence === 0),
    ).toBe(true);
  });

  it("abstains on low-confidence required landmarks", () => {
    const assessment = assessConfidence(lowConfidenceObservation(), "desk");
    expect(assessment.state).toBe("insufficient");
    expect(assessment.missing).toContain("leftShoulder");
    expect(assessment.reasons).toContain("low_visibility");
  });

  it("keeps a pose above the registered pose gate usable when landmarks are clear", () => {
    const assessment = assessConfidence(makeObservation({ poseConfidence: 0.55 }), "desk");
    expect(assessment.state).toBe("usable");
    expect(assessment.reasons).not.toContain("unstable_tracking");
  });

  it("accepts the visible body chain when the far side is occluded in a side view", () => {
    const landmarks = makeLandmarks({
      rightShoulder: { visibility: 0.15, presence: 0.15 },
      rightElbow: { visibility: 0.15, presence: 0.15 },
      rightWrist: { visibility: 0.15, presence: 0.15 },
      rightHip: { x: 0.95, visibility: 0.15, presence: 0.15 },
      rightAnkle: { visibility: 0.15, presence: 0.15 },
      rightHeel: { visibility: 0.15, presence: 0.15 },
      rightFootIndex: { visibility: 0.15, presence: 0.15 },
    });
    for (const mode of ["plank", "pushup"] as const) {
      const assessment = assessConfidence(makeObservation({ landmarks }), mode);
      expect(assessment.state).not.toBe("insufficient");
      expect(assessment.required).toContain("leftShoulder");
      expect(assessment.required).not.toContain("rightShoulder");
    }
    const engine = createEngine();
    setStableCalibration(engine, "plank", "side");
    engine.process(makeObservation({ landmarks, timestampMs: 0 }));
    const persisted = engine.process(makeObservation({ landmarks, timestampMs: 1_000 }));
    expect(persisted.status).toBe("valid");
    expect(persisted.phase).toBe("hold");
    expect(persisted.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ measurementRuleId: "plank-body-line" })]),
    );
  });

  it("abstains when the observed camera view is unverified", () => {
    const assessment = assessConfidence(
      makeObservation({ observedView: "unknown", viewConfidence: 0.2 }),
      "desk",
    );
    expect(assessment.state).toBe("insufficient");
    expect(assessment.reasons).toContain("unverified_view");
  });

  it("keeps the presentation mirror separate from anatomical labels", () => {
    const observation = makeObservation({ mirroredPreview: true });
    expect(observation.landmarks.leftShoulder.x).toBeLessThan(
      observation.landmarks.rightShoulder.x,
    );
    expect(observation.mirroredPreview).toBe(true);
  });
});

describe("temporal smoothing and calibration", () => {
  it("reduces alternating landmark noise", () => {
    const smoother = new LandmarkSmoother(0.3);
    const values = noisySequence().map(
      (frame) => smoother.update(frame.landmarks, frame.timestampMs).nose.x,
    );
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.08);
  });

  it("does not complete calibration until a stable window exists", () => {
    const window = new CalibrationWindow("desk", "side", false, 4);
    let profile = makeObservation();
    let result = window.add(profile);
    expect(result.stable).toBe(false);
    for (let index = 1; index < 4; index += 1) {
      profile = makeObservation({ timestampMs: index * 40, sequence: index });
      result = window.add(profile);
    }
    expect(result.stable).toBe(true);
    expect(result.sampleCount).toBe(4);
    expect(result.baseline.torso).toBeGreaterThan(0);
    window.reset();
    expect(window.add(makeObservation()).sampleCount).toBe(1);
  });

  it("ignores delayed frames submitted before calibration started", () => {
    const window = new CalibrationWindow("desk", "side", false, 4, 100);

    expect(window.acceptsTimestamp(90)).toBe(false);
    expect(window.acceptsTimestamp(100)).toBe(true);
    expect(window.add(makeObservation({ timestampMs: 90 })).sampleCount).toBe(0);
    expect(window.add(makeObservation({ timestampMs: 100, sequence: 1 })).sampleCount).toBe(1);
    expect(window.add(makeObservation({ timestampMs: 95, sequence: 2 })).sampleCount).toBe(1);
    expect(window.add(makeObservation({ timestampMs: 140, sequence: 3 })).sampleCount).toBe(2);
  });

  it("calibrates and evaluates a side plank from the visible body chain only", () => {
    const window = new CalibrationWindow("plank", "side", false, 4);
    const landmarks = makeLandmarks({
      rightShoulder: { visibility: 0.15, presence: 0.15 },
      rightHip: { x: 0.95, visibility: 0.15, presence: 0.15 },
      rightAnkle: { visibility: 0.15, presence: 0.15 },
      rightHeel: { visibility: 0.15, presence: 0.15 },
      rightFootIndex: { visibility: 0.15, presence: 0.15 },
    });
    let profile = window.add(makeObservation({ landmarks, timestampMs: 0 }));
    for (let index = 1; index < 4; index += 1) {
      profile = window.add(
        makeObservation({ landmarks, timestampMs: index * 40, sequence: index }),
      );
    }
    expect(profile.stable).toBe(true);
    expect(profile.baseline.movementMetric).toBeGreaterThan(150);
    expect(profile.baseline.torso).toBeCloseTo(
      Math.hypot(
        landmarks.leftShoulder.x - landmarks.leftHip.x,
        landmarks.leftShoulder.y - landmarks.leftHip.y,
      ),
      6,
    );

    const engine = createEngine();
    engine.setMode("plank");
    engine.setCalibrationProfile(profile);
    const malformedFarSide = makeLandmarks({
      rightShoulder: { x: -4, y: 6, visibility: 0.15, presence: 0.15 },
      rightHip: { x: 5, y: -3, visibility: 0.15, presence: 0.15 },
      rightAnkle: { x: 4, y: 4, visibility: 0.15, presence: 0.15 },
      rightHeel: { x: -2, y: 3, visibility: 0.15, presence: 0.15 },
      rightFootIndex: { x: 3, y: -2, visibility: 0.15, presence: 0.15 },
    });
    engine.process(makeObservation({ landmarks: malformedFarSide, timestampMs: 200, sequence: 5 }));
    const result = engine.process(
      makeObservation({ landmarks: malformedFarSide, timestampMs: 1_000, sequence: 6 }),
    );
    expect(result.status).toBe("valid");
    expect(result.confidence.reasons).not.toContain("framing_drift");
  });

  it("rejects a desk baseline while head and shoulders are moving", () => {
    const window = new CalibrationWindow("desk", "side", false, 4);
    let profile = window.add(makeObservation());
    for (let index = 1; index < 4; index += 1) {
      const headShift = index % 2 === 0 ? 0.08 : -0.08;
      profile = window.add(
        makeObservation({
          timestampMs: index * 40,
          sequence: index,
          landmarks: makeLandmarks({
            nose: { x: 0.51 + headShift },
            leftEar: { x: 0.47 + headShift },
            rightEar: { x: 0.55 + headShift },
            leftShoulder: { y: 0.43 + headShift / 2 },
          }),
        }),
      );
    }
    expect(profile.stable).toBe(false);
    expect(profile.sampleCount).toBe(4);

    for (let index = 4; index < 8; index += 1) {
      profile = window.add(makeObservation({ timestampMs: index * 40, sequence: index }));
    }
    expect(profile.stable).toBe(true);
  });

  it("uses the mobile-safe default calibration target", () => {
    const window = new CalibrationWindow("desk", "side", false);
    let result = window.add(makeObservation());
    for (let index = 1; index < CALIBRATION_SAMPLE_TARGET; index += 1) {
      result = window.add(makeObservation({ timestampMs: index * 40, sequence: index }));
      if (index < CALIBRATION_SAMPLE_TARGET - 1) expect(result.stable).toBe(false);
    }
    expect(result.stable).toBe(true);
    expect(result.sampleCount).toBe(CALIBRATION_SAMPLE_TARGET);
  });

  it("resets calibration when required evidence becomes unreliable", () => {
    const window = new CalibrationWindow("desk", "side", false, 4);
    window.add(lowConfidenceObservation());
    expect(window.add(lowConfidenceObservation()).sampleCount).toBe(0);
  });

  it("does not calibrate a torso that only differs along depth", () => {
    const window = new CalibrationWindow("desk", "side", false, 4);
    const landmarks = makeLandmarks({
      leftShoulder: { x: 0.5, y: 0.5, z: 0 },
      rightShoulder: { x: 0.5, y: 0.5, z: 0 },
      leftHip: { x: 0.5, y: 0.5, z: 1 },
      rightHip: { x: 0.5, y: 0.5, z: 1 },
    });
    expect(window.add(makeObservation({ landmarks })).sampleCount).toBe(0);
  });

  it("stores a stable, mode-specific movement baseline", () => {
    const window = new CalibrationWindow("squat", "front", false, 4);
    let profile = window.add(makeObservation({ cameraView: "front", observedView: "front" }));
    for (let index = 1; index < 4; index += 1) {
      profile = window.add(
        makeObservation({
          cameraView: "front",
          observedView: "front",
          timestampMs: index * 40,
          sequence: index,
        }),
      );
    }
    expect(profile.stable).toBe(true);
    expect(profile.baseline.movementMetric).toBeGreaterThan(0);
    expect(profile.observedView).toBe("front");
  });
});

describe("geometry and deterministic coaching", () => {
  it("returns null for degenerate angles instead of NaN", () => {
    const point = { x: 0, y: 0, z: 0 };
    expect(angleAt(point, point, point)).toBeNull();
  });

  it("returns null for nonfinite derived geometry", () => {
    const extreme = { x: Number.MAX_VALUE, y: 0, z: 0 };
    const opposite = { x: -Number.MAX_VALUE, y: 0, z: 0 };
    expect(angleAt(extreme, { x: 0, y: 0, z: 0 }, opposite)).toBeNull();
  });

  it("abstains when a required landmark has nonfinite geometry", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    const malformed = makeLandmarks({ leftShoulder: { x: Number.NaN } });
    const result = engine.process(makeObservation({ landmarks: malformed }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.title).toBe("Move into view");
    expect(result.confidence.missing).toContain("leftShoulder");
    expect(result.feedback.measurementRuleIds).toContain("capture-landmark-confidence");
  });

  it("does not emit authoritative advice before calibration", () => {
    const engine = createEngine();
    engine.setCalibrationStable(false);
    const result = engine.process(makeObservation());
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.title).toBe("Calibrate first");
    expect(result.confidence.reasons).toContain("uncalibrated");
    expect(result.feedback.measurementRuleIds).toContain("calibration-stable-window");
  });

  it("requires a stable matching profile on a fresh engine", () => {
    const result = createEngine().process(makeObservation());
    expect(result.status).toBe("insufficient_evidence");
    expect(result.confidence.reasons).toContain("uncalibrated");
    expect(result.feedback.title).toBe("Calibrate first");
  });

  it("abstains on duplicate desk timestamps", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    engine.process(makeObservation({ timestampMs: 1_000 }));
    const result = engine.process(makeObservation({ timestampMs: 1_000, sequence: 1 }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.confidence.reasons).toContain("stale_frame");
    expect(result.feedback.title).toBe("Move into view");
    expect(result.feedback.measurementRuleIds).toEqual(["capture-monotonic-frame-time"]);
  });

  it("enforces the registered minimum frame timestamp step", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    engine.process(makeObservation({ timestampMs: 1_000 }));
    const result = engine.process(makeObservation({ timestampMs: 1_000.05, sequence: 1 }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.measurementRuleIds).toEqual(["capture-monotonic-frame-time"]);
  });

  it("pauses exercise coaching when the full body touches a frame edge", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat", "front");
    const cropped = makeLandmarks({ nose: { y: 0 } });
    const result = engine.process(
      makeObservation({
        landmarks: cropped,
        cameraView: "front",
        observedView: "front",
      }),
    );
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.measurementRuleIds).toEqual(["framing-whole-body"]);
  });

  it("pauses exercise coaching when heels or toes are cropped", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat", "front");
    const cropped = makeLandmarks({ rightFootIndex: { y: 1 } });
    const result = engine.process(
      makeObservation({
        landmarks: cropped,
        cameraView: "front",
        observedView: "front",
      }),
    );
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.measurementRuleIds).toEqual(["framing-whole-body"]);
  });

  it("abstains when a plank angle is geometrically unavailable", () => {
    const engine = createEngine();
    setStableCalibration(engine, "plank");
    const degenerate = makeLandmarks({
      leftShoulder: { x: 0.5, y: 0.5 },
      leftHip: { x: 0.5, y: 0.5 },
      leftAnkle: { x: 0.5, y: 0.5 },
      rightShoulder: { x: 0.5, y: 0.5 },
      rightHip: { x: 0.5, y: 0.5 },
      rightAnkle: { x: 0.5, y: 0.5 },
    });
    const result = engine.process(makeObservation({ landmarks: degenerate }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.title).toBe("Move into view");
    expect(result.feedback.measurementRuleIds).toContain("capture-geometry-validity");
  });

  it("abstains when desk torso geometry collapses", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    const collapsed = makeLandmarks({
      leftShoulder: { x: 0.5, y: 0.5 },
      rightShoulder: { x: 0.5, y: 0.5 },
      leftHip: { x: 0.5, y: 0.5 },
      rightHip: { x: 0.5, y: 0.5 },
    });
    const result = engine.process(makeObservation({ landmarks: collapsed }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.confidence.reasons).toContain("invalid_geometry");
  });

  it("abstains when a push-up body line is unavailable", () => {
    const engine = createEngine();
    setStableCalibration(engine, "pushup");
    const collapsed = makeLandmarks({
      leftShoulder: { x: 0.5, y: 0.5 },
      rightShoulder: { x: 0.5, y: 0.5 },
      leftHip: { x: 0.5, y: 0.5 },
      rightHip: { x: 0.5, y: 0.5 },
      leftAnkle: { x: 0.5, y: 0.5 },
      rightAnkle: { x: 0.5, y: 0.5 },
    });
    const result = engine.process(makeObservation({ landmarks: collapsed }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.confidence.reasons).toContain("invalid_geometry");
  });

  it("keeps a correct, calibrated desk observation free of issues", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    const result = engine.process(makeObservation({ cameraView: "side" }));
    expect(result.status).toBe("valid");
    expect(result.issues).toHaveLength(0);
    expect(result.feedback.tone).toBe("positive");
    expect(result.feedback.measurementRuleIds).toEqual([
      "desk-head-forward",
      "desk-neck-inclination",
      "desk-torso-inclination",
      "desk-prolonged-slouch",
    ]);
  });

  it("calibrates a relaxed full-body standing baseline and recognizes steady alignment", () => {
    const window = new CalibrationWindow("standing", "side", false, 4);
    let profile = window.add(
      makeObservation({ cameraView: "side", observedView: "side", timestampMs: 0 }),
    );
    for (let index = 1; index < 4; index += 1) {
      profile = window.add(
        makeObservation({
          cameraView: "side",
          observedView: "side",
          timestampMs: index * 40,
          sequence: index,
        }),
      );
    }
    expect(profile.stable).toBe(true);
    expect(profile.baseline.standingHeadOffset).toBeDefined();
    expect(profile.baseline.standingBodyLean).toBeDefined();

    const engine = createEngine();
    engine.setMode("standing");
    engine.setCalibrationProfile(profile);
    const result = engine.process(
      makeObservation({ cameraView: "side", observedView: "side", timestampMs: 1_000 }),
    );
    expect(result.status).toBe("valid");
    expect(result.issues).toHaveLength(0);
    expect(result.feedback.title).toBe("Standing alignment looks steady");
    expect(result.feedback.body).toContain("not a health assessment or medical clearance");
    expect(result.feedback.measurementRuleIds).toEqual([
      "standing-head-drift",
      "standing-trunk-drift",
    ]);
  });

  it("teaches a persistent side-view head and trunk alignment drift", () => {
    const engine = createEngine();
    engine.setMode("standing");
    engine.setCalibrationProfile({
      mode: "standing",
      cameraView: "side",
      observedView: "side",
      viewConfidence: 1,
      mirroredPreview: false,
      stable: true,
      sampleCount: 4,
      completedAtMs: 100,
      baseline: {
        torso: 0.21,
        standingHeadOffset: 0.05,
        standingBodyLean: 0,
        standingShoulderTilt: 0,
        standingHipTilt: 0,
      },
    });
    const drift = makeLandmarks({
      leftEar: { x: 0.72 },
      rightEar: { x: 0.72 },
      leftShoulder: { x: 0.56 },
      rightShoulder: { x: 0.7 },
    });
    const first = engine.process(
      makeObservation({
        landmarks: drift,
        cameraView: "side",
        observedView: "side",
        timestampMs: 0,
      }),
    );
    const second = engine.process(
      makeObservation({
        landmarks: drift,
        cameraView: "side",
        observedView: "side",
        timestampMs: 700,
        sequence: 1,
      }),
    );
    expect(first.feedback.title).not.toBe("Head alignment drift");
    expect(second.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["standing_head_alignment", "standing_trunk_alignment"]),
    );
    expect(second.feedback.title).toBe("Head alignment drift");
  });

  it("teaches a persistent front-view side-to-side difference without diagnosing it", () => {
    const engine = createEngine();
    engine.setMode("standing");
    engine.setCalibrationProfile({
      mode: "standing",
      cameraView: "front",
      observedView: "front",
      viewConfidence: 1,
      mirroredPreview: false,
      stable: true,
      sampleCount: 4,
      completedAtMs: 100,
      baseline: {
        torso: 0.21,
        standingHeadOffset: 0,
        standingBodyLean: 0,
        standingShoulderTilt: 0,
        standingHipTilt: 0,
      },
    });
    const uneven = makeLandmarks({
      leftShoulder: { y: 0.52 },
      rightShoulder: { y: 0.43 },
    });
    engine.process(
      makeObservation({
        landmarks: uneven,
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    const result = engine.process(
      makeObservation({
        landmarks: uneven,
        cameraView: "front",
        observedView: "front",
        timestampMs: 700,
        sequence: 1,
      }),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "standing_lateral_asymmetry" })]),
    );
    expect(result.feedback.body).toContain("Level the camera");
  });

  it("uses the calibration baseline to detect a material framing change", () => {
    const engine = createEngine();
    engine.setCalibrationProfile({
      mode: "desk",
      cameraView: "side",
      observedView: "side",
      viewConfidence: 1,
      mirroredPreview: false,
      stable: true,
      sampleCount: 4,
      completedAtMs: 100,
      baseline: { torso: 0.1 },
    });
    engine.process(makeObservation({ timestampMs: 0 }));
    const result = engine.process(makeObservation({ timestampMs: 1200, sequence: 1 }));
    expect(result.status).toBe("insufficient_evidence");
    expect(result.issues).toHaveLength(0);
    expect(result.confidence.reasons).toContain("framing_drift");
    expect(result.feedback.title).toBe("Return to your calibrated distance");
    expect(result.feedback.measurementRuleIds).toEqual(["framing-torso-distance"]);
  });

  it("abstains when a mode is used from an unsupported view", () => {
    expect(isViewSupported("plank", "side")).toBe(true);
    expect(isViewSupported("plank", "front")).toBe(false);
    const engine = createEngine();
    setStableCalibration(engine, "plank");
    const result = engine.process(makeObservation({ cameraView: "front" }));
    expect(result.status).toBe("unsupported_view");
    expect(result.feedback.title).toBe("Set your view");
  });

  it("abstains when observed orientation contradicts the selected view", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk", "side");
    const result = engine.process(makeObservation({ observedView: "front", viewConfidence: 0.95 }));
    expect(result.status).toBe("unsupported_view");
    expect(result.confidence.reasons).toContain("observed_view_mismatch");
    expect(result.feedback.title).toBe("Set your view");
  });

  it("requires persistence before a possible form issue is surfaced", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    const leaning = makeLandmarks({
      leftEar: { x: 0.75 },
      rightEar: { x: 0.75 },
    });
    const first = engine.process(makeObservation({ landmarks: leaning, timestampMs: 0 }));
    const second = engine.process(
      makeObservation({ landmarks: leaning, timestampMs: 1200, sequence: 1 }),
    );
    expect(first.feedback.title).not.toBe("Torso inclination");
    expect(second.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "head_forward" })]),
    );
  });

  it("does not count a repetition that crosses phases too quickly", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat");
    const down = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.65 },
      rightKnee: { x: 0.55, y: 0.65 },
      leftAnkle: { x: 0.6, y: 0.65 },
      rightAnkle: { x: 0.7, y: 0.65 },
    });
    const first = engine.process(makeObservation({ landmarks: down, timestampMs: 0 }));
    const results = [engine.process(makeObservation({ timestampMs: 150, sequence: 1 }))];
    expect(first.phase).toBe("eccentric");
    expect(results.some((result) => result.rejectedRep === "phase_interrupted")).toBe(true);
    expect(
      results.find((result) => result.rejectedRep === "phase_interrupted")?.feedback.title,
    ).toBe("Rep not counted");
    expect(
      results.find((result) => result.rejectedRep === "phase_interrupted")?.feedback
        .measurementRuleIds,
    ).toEqual(["rep-phase-timing"]);
    expect(results.at(-1)?.repCount).toBe(0);
  });

  it("rejects a repetition that returns before the calibrated range", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat");
    const partial = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.78 },
      rightKnee: { x: 0.55, y: 0.78 },
      leftAnkle: { x: 0.57, y: 0.88 },
      rightAnkle: { x: 0.67, y: 0.88 },
    });
    engine.process(makeObservation({ landmarks: partial, timestampMs: 0 }));
    const result = engine.process(makeObservation({ timestampMs: 1_000, sequence: 1 }));
    expect(result.validRep).toBe(false);
    expect(result.rejectedRep).toBe("range_not_reached");
    expect(result.repCount).toBe(0);
    expect(result.feedback.measurementRuleIds).toEqual(["squat-range"]);
  });

  it("rejects a repetition with persistent alignment drift", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat", "front");
    const misalignedDown = makeLandmarks({
      leftKnee: { x: 0.7, y: 0.65 },
      rightKnee: { x: 0.55, y: 0.65 },
      leftAnkle: { x: 0.6, y: 0.65 },
      rightAnkle: { x: 0.7, y: 0.65 },
    });
    engine.process(
      makeObservation({
        landmarks: misalignedDown,
        cameraView: "front",
        timestampMs: 0,
      }),
    );
    engine.process(
      makeObservation({
        landmarks: misalignedDown,
        cameraView: "front",
        timestampMs: 500,
        sequence: 1,
      }),
    );
    const result = engine.process(
      makeObservation({ cameraView: "front", timestampMs: 1_200, sequence: 2 }),
    );
    expect(result.validRep).toBe(false);
    expect(result.rejectedRep).toBe("alignment_not_stable");
    expect(result.repCount).toBe(0);
    expect(result.feedback.measurementRuleIds).toEqual([
      "rep-alignment-persistence",
      "squat-knee-tracking",
    ]);
  });

  it("keeps all five exercise evaluators confidence-gated and deterministic", () => {
    const exerciseLandmarks = {
      squat: makeLandmarks({
        leftKnee: { x: 0.45, y: 0.65 },
        rightKnee: { x: 0.55, y: 0.65 },
        leftAnkle: { x: 0.6, y: 0.65 },
        rightAnkle: { x: 0.7, y: 0.65 },
      }),
      lunge: makeLandmarks({
        leftKnee: { x: 0.45, y: 0.65 },
        rightKnee: { x: 0.55, y: 0.65 },
        leftAnkle: { x: 0.6, y: 0.65 },
        rightAnkle: { x: 0.7, y: 0.65 },
      }),
      pushup: makeLandmarks({
        leftElbow: { x: 0.43, y: 0.56 },
        rightElbow: { x: 0.57, y: 0.56 },
        leftWrist: { x: 0.56, y: 0.56 },
        rightWrist: { x: 0.44, y: 0.56 },
      }),
      curl: makeLandmarks({
        leftElbow: { x: 0.43, y: 0.58 },
        rightElbow: { x: 0.57, y: 0.58 },
        leftWrist: { x: 0.55, y: 0.68 },
        rightWrist: { x: 0.45, y: 0.68 },
      }),
    } as const;
    for (const [mode, landmarks] of Object.entries(exerciseLandmarks) as Array<
      [
        Exclude<AnalysisMode, "desk" | "plank">,
        (typeof exerciseLandmarks)[keyof typeof exerciseLandmarks],
      ]
    >) {
      const engine = createEngine();
      setStableCalibration(engine, mode);
      const result = engine.process(makeObservation({ landmarks, timestampMs: 0 }));
      expect(result.status).toBe("valid");
      expect(result.confidence.reasons).not.toContain("uncalibrated");
    }
    const plankEngine = createEngine();
    setStableCalibration(plankEngine, "plank");
    const plank = plankEngine.process(makeObservation({ timestampMs: 0 }));
    expect(plank.status).toBe("valid");
    expect(plank.phase).toBe("hold");

    const pushupEngine = createEngine();
    setStableCalibration(pushupEngine, "pushup");
    const bentPushup = makeLandmarks({
      leftElbow: { x: 0.43, y: 0.56 },
      rightElbow: { x: 0.57, y: 0.56 },
      leftWrist: { x: 0.55, y: 0.56 },
      rightWrist: { x: 0.45, y: 0.56 },
    });
    pushupEngine.process(makeObservation({ landmarks: bentPushup, timestampMs: 0 }));
    pushupEngine.process(makeObservation({ landmarks: bentPushup, timestampMs: 500, sequence: 1 }));
    const pushup = pushupEngine.process(makeObservation({ timestampMs: 1_200, sequence: 2 }));
    expect(pushup.validRep).toBe(true);
    expect(pushup.repCount).toBe(1);
    expect(pushup.feedback.body).toContain("not a safety or health clearance");
    expect(pushup.feedback.measurementRuleIds).toEqual([
      "pushup-range",
      "rep-phase-timing",
      "rep-alignment-persistence",
      "pushup-body-line",
    ]);
  });

  it("counts a valid lunge with balanced knee flexion in a split stance", () => {
    const engine = createEngine();
    setStableCalibration(engine, "lunge", "front");
    const splitStance = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.8 },
      leftAnkle: { x: 0.3, y: 0.8 },
      rightKnee: { x: 0.55, y: 0.8 },
      rightAnkle: { x: 0.7, y: 0.8 },
    });
    engine.process(
      makeObservation({
        landmarks: splitStance,
        worldLandmarks: makeFrontSplitWorldLandmarks(),
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    engine.process(
      makeObservation({
        landmarks: splitStance,
        worldLandmarks: makeFrontSplitWorldLandmarks(),
        cameraView: "front",
        observedView: "front",
        timestampMs: 500,
        sequence: 1,
      }),
    );
    const counted = engine.process(
      makeObservation({
        worldLandmarks: makeFrontSplitWorldLandmarks(),
        cameraView: "front",
        observedView: "front",
        timestampMs: 1_200,
        sequence: 2,
      }),
    );
    expect(counted.validRep).toBe(true);
    expect(counted.repCount).toBe(1);
    expect(counted.feedback.measurementRuleIds).toEqual([
      "lunge-range",
      "rep-phase-timing",
      "rep-alignment-persistence",
      "lunge-split-stance",
      "lunge-knee-tracking",
    ]);

    const squatLike = createEngine();
    setStableCalibration(squatLike, "lunge", "front");
    const symmetric = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.65 },
      rightKnee: { x: 0.55, y: 0.65 },
      leftAnkle: { x: 0.6, y: 0.65 },
      rightAnkle: { x: 0.7, y: 0.65 },
    });
    squatLike.process(
      makeObservation({
        landmarks: symmetric,
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    squatLike.process(
      makeObservation({
        landmarks: symmetric,
        cameraView: "front",
        observedView: "front",
        timestampMs: 500,
        sequence: 1,
      }),
    );
    const rejected = squatLike.process(
      makeObservation({
        cameraView: "front",
        observedView: "front",
        timestampMs: 1_200,
        sequence: 2,
      }),
    );
    expect(rejected.validRep).toBe(false);
    expect(rejected.rejectedRep).toBe("alignment_not_stable");
  });

  it("retains front-view lunge depth through a torso-normalized world-space stance", () => {
    const engine = createEngine();
    setStableCalibration(engine, "lunge", "front");
    const projectedOverlap = makeLandmarks({
      leftAnkle: { x: 0.5, y: 0.9 },
      rightAnkle: { x: 0.5, y: 0.9 },
    });
    const worldLandmarks = makeLandmarks({
      leftShoulder: { x: -0.2, y: 0, z: 0 },
      rightShoulder: { x: 0.2, y: 0, z: 0 },
      leftHip: { x: -0.15, y: 0.5, z: 0 },
      rightHip: { x: 0.15, y: 0.5, z: 0 },
      leftAnkle: { x: 0, y: 1, z: -0.5 },
      rightAnkle: { x: 0, y: 1, z: 0.5 },
    });
    const result = engine.process(
      makeObservation({
        landmarks: projectedOverlap,
        cameraView: "front",
        observedView: "front",
        worldLandmarks,
        timestampMs: 1,
      }),
    );
    expect(result.metrics.stanceSeparation).toBeCloseTo(2);
  });

  it("rejects a lateral wide squat as a lunge when fore-aft depth is absent", () => {
    const engine = createEngine();
    setStableCalibration(engine, "lunge", "front");
    const wideSquat = makeLandmarks({
      leftAnkle: { x: 0.2, y: 0.9 },
      rightAnkle: { x: 0.8, y: 0.9 },
    });
    const worldWideSquat = makeLandmarks({
      leftShoulder: { x: -0.2, y: 0, z: 0 },
      rightShoulder: { x: 0.2, y: 0, z: 0 },
      leftHip: { x: -0.15, y: 0.5, z: 0 },
      rightHip: { x: 0.15, y: 0.5, z: 0 },
      leftAnkle: { x: -0.8, y: 1, z: 0 },
      rightAnkle: { x: 0.8, y: 1, z: 0 },
    });
    engine.process(
      makeObservation({
        landmarks: wideSquat,
        worldLandmarks: worldWideSquat,
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    const result = engine.process(
      makeObservation({
        landmarks: wideSquat,
        worldLandmarks: worldWideSquat,
        cameraView: "front",
        observedView: "front",
        timestampMs: 1_000,
        sequence: 1,
      }),
    );
    expect(result.metrics.stanceSeparation).toBeCloseTo(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measurementRuleId: "lunge-split-stance" }),
      ]),
    );
  });

  it("links a lunge cue only to the rule that triggered it", () => {
    const engine = createEngine();
    setStableCalibration(engine, "lunge", "front");
    const symmetric = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.65 },
      rightKnee: { x: 0.55, y: 0.65 },
      leftAnkle: { x: 0.6, y: 0.65 },
      rightAnkle: { x: 0.7, y: 0.65 },
    });
    const first = engine.process(
      makeObservation({
        landmarks: symmetric,
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    const persisted = engine.process(
      makeObservation({
        landmarks: symmetric,
        cameraView: "front",
        observedView: "front",
        timestampMs: 1_000,
        sequence: 1,
      }),
    );

    expect(first.issues).toHaveLength(0);
    expect(persisted.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "lunge_alignment",
          measurementRuleId: "lunge-split-stance",
        }),
      ]),
    );
    expect(persisted.feedback.measurementRuleIds).toEqual(["lunge-split-stance"]);
  });

  it("reports bilateral lunge knee tracking without inventing a lead side", () => {
    const engine = createEngine();
    setStableCalibration(engine, "lunge", "front");
    const bilateralTrackingFixture = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.8 },
      leftAnkle: { x: 0.6, y: 0.8 },
      rightKnee: { x: 0.55, y: 0.8 },
      rightAnkle: { x: 0.9, y: 0.96 },
    });

    engine.process(
      makeObservation({
        landmarks: bilateralTrackingFixture,
        worldLandmarks: makeFrontSplitWorldLandmarks(),
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    const persisted = engine.process(
      makeObservation({
        landmarks: bilateralTrackingFixture,
        worldLandmarks: makeFrontSplitWorldLandmarks(),
        cameraView: "front",
        observedView: "front",
        timestampMs: 1_000,
        sequence: 1,
      }),
    );

    expect(persisted.metrics.kneeAlignmentDeviation).toBeGreaterThan(
      MEASUREMENT_THRESHOLDS.exercise.kneeAlignmentDeviation,
    );
    expect(persisted.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          measurementRuleId: "lunge-knee-tracking",
          label: "Knee tracking",
        }),
      ]),
    );
    expect(persisted.feedback.title).toBe("Knee tracking");
    expect(JSON.stringify(persisted.feedback)).not.toMatch(/front/i);
  });

  it("counts a curl through full flexion while rejecting elbow flare", () => {
    const engine = createEngine();
    setStableCalibration(engine, "curl");
    const flexed = makeLandmarks({
      leftElbow: { x: 0.43, y: 0.6 },
      rightElbow: { x: 0.57, y: 0.6 },
      leftWrist: { x: 0.5, y: 0.52 },
      rightWrist: { x: 0.5, y: 0.52 },
    });
    engine.process(makeObservation({ landmarks: flexed, timestampMs: 0 }));
    engine.process(makeObservation({ landmarks: flexed, timestampMs: 500, sequence: 1 }));
    const counted = engine.process(makeObservation({ timestampMs: 1_200, sequence: 2 }));
    expect(counted.validRep).toBe(true);
    expect(counted.repCount).toBe(1);
    expect(counted.feedback.measurementRuleIds).toEqual(["curl-range", "rep-phase-timing"]);

    const driftEngine = createEngine();
    setStableCalibration(driftEngine, "curl", "front");
    const drifted = makeLandmarks({
      leftElbow: { x: 0.67, y: 0.6 },
      rightElbow: { x: 0.33, y: 0.6 },
      leftWrist: { x: 0.62, y: 0.42 },
      rightWrist: { x: 0.38, y: 0.42 },
    });
    driftEngine.process(
      makeObservation({ landmarks: drifted, cameraView: "front", timestampMs: 0 }),
    );
    const driftHold = driftEngine.process(
      makeObservation({
        landmarks: drifted,
        cameraView: "front",
        timestampMs: 500,
        sequence: 1,
      }),
    );
    const rejected = driftEngine.process(
      makeObservation({ cameraView: "front", timestampMs: 1_200, sequence: 2 }),
    );
    expect(rejected.validRep).toBe(false);
    expect(rejected.rejectedRep).toBe("alignment_not_stable");
    expect(driftHold.metrics.elbowFlare).toBeGreaterThan(0.5);
  });

  it("interrupts an active repetition when evidence drops", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat");
    const down = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.65 },
      rightKnee: { x: 0.55, y: 0.65 },
      leftAnkle: { x: 0.6, y: 0.65 },
      rightAnkle: { x: 0.7, y: 0.65 },
    });
    engine.process(makeObservation({ landmarks: down, timestampMs: 0 }));
    engine.process(
      makeObservation({ landmarks: lowConfidenceObservation().landmarks, timestampMs: 300 }),
    );
    const result = engine.process(makeObservation({ timestampMs: 700, sequence: 2 }));
    expect(result.repCount).toBe(0);
  });

  it("surfaces prolonged slouch only after its persistence window", () => {
    const engine = createEngine();
    setStableCalibration(engine, "desk");
    const slouched = makeLandmarks({
      leftShoulder: { x: 0.68 },
      rightShoulder: { x: 0.82 },
    });
    const first = engine.process(
      makeObservation({ landmarks: slouched, cameraView: "side", timestampMs: 0 }),
    );
    const persisted = engine.process(
      makeObservation({
        landmarks: slouched,
        cameraView: "side",
        timestampMs: 15_000,
        sequence: 1,
      }),
    );
    expect(first.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "prolonged_slouch" })]),
    );
    expect(persisted.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "prolonged_slouch" })]),
    );
    expect(persisted.feedback.title).toBe("Prolonged slouch");
  });

  it("checks squat knee tracking in a front view", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat", "front");
    const misaligned = makeLandmarks({ leftKnee: { x: 0.7 } });
    engine.process(makeObservation({ landmarks: misaligned, cameraView: "front", timestampMs: 0 }));
    const result = engine.process(
      makeObservation({
        landmarks: misaligned,
        cameraView: "front",
        timestampMs: 1_000,
        sequence: 1,
      }),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "squat_knee_alignment" })]),
    );
  });

  it("does not emit side-plane depth or front-plane curl cues from unsupported views", () => {
    const squat = createEngine();
    setStableCalibration(squat, "squat", "front");
    const partialSquat = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.78 },
      rightKnee: { x: 0.55, y: 0.78 },
      leftAnkle: { x: 0.57, y: 0.88 },
      rightAnkle: { x: 0.67, y: 0.88 },
    });
    for (const [sequence, timestampMs] of [0, 800, 1_600].entries()) {
      const result = squat.process(
        makeObservation({
          landmarks: partialSquat,
          cameraView: "front",
          timestampMs,
          sequence,
        }),
      );
      expect(result.issues.some((issue) => issue.code === "squat_depth")).toBe(false);
    }

    const curl = createEngine();
    setStableCalibration(curl, "curl", "side");
    const flared = makeLandmarks({ leftElbow: { x: 0.72 }, rightElbow: { x: 0.28 } });
    for (const [sequence, timestampMs] of [0, 800, 1_600].entries()) {
      const result = curl.process(makeObservation({ landmarks: flared, timestampMs, sequence }));
      expect(result.metrics.elbowFlare).toBeUndefined();
      expect(result.issues.some((issue) => issue.code === "curl_control")).toBe(false);
    }
  });

  it("checks the push-up body line in a side view", () => {
    const engine = createEngine();
    setStableCalibration(engine, "pushup");
    const sagging = makeLandmarks({
      leftHip: { x: 0.72 },
      rightHip: { x: 0.78 },
    });
    engine.process(makeObservation({ landmarks: sagging, timestampMs: 0 }));
    const result = engine.process(
      makeObservation({ landmarks: sagging, timestampMs: 1_000, sequence: 1 }),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "pushup_body_line" })]),
    );
  });

  it("resets repetition state when changing modes", () => {
    const engine = createEngine();
    setStableCalibration(engine, "squat");
    const down = makeLandmarks({
      leftKnee: { x: 0.45, y: 0.65 },
      rightKnee: { x: 0.55, y: 0.65 },
      leftAnkle: { x: 0.6, y: 0.65 },
      rightAnkle: { x: 0.7, y: 0.65 },
    });
    engine.process(makeObservation({ landmarks: down, timestampMs: 0 }));
    const counted = engine.process(makeObservation({ timestampMs: 1_000, sequence: 1 }));
    expect(counted.repCount).toBe(1);
    engine.setMode("desk");
    engine.setMode("squat");
    const reset = engine.process(makeObservation({ timestampMs: 2_000, sequence: 2 }));
    expect(reset.repCount).toBe(0);
  });
});

describe("session summaries", () => {
  it("summarizes evidence coverage and valid repetitions", () => {
    const tracker = new SessionTracker("squat", "fixture");
    tracker.start(1000);
    tracker.record({
      mode: "squat",
      timestampMs: 1000,
      status: "insufficient_evidence",
      confidence: {
        state: "insufficient",
        score: 0.2,
        required: [],
        missing: [],
        reasons: ["low_visibility"],
      },
      phase: "paused",
      issues: [],
      decisionRuleIds: ["capture-landmark-confidence"],
      feedback: { id: "paused", priority: 1, tone: "caution", title: "Paused", body: "Paused" },
      validRep: false,
      rejectedRep: "insufficient_evidence",
      repCount: 0,
      metrics: {},
    });
    tracker.record({
      mode: "squat",
      timestampMs: 1200,
      status: "valid",
      confidence: {
        state: "high",
        score: 0.95,
        required: [],
        missing: [],
        reasons: [],
      },
      phase: "concentric",
      issues: [],
      decisionRuleIds: ["squat-range", "rep-phase-timing"],
      feedback: { id: "rep", priority: 1, tone: "positive", title: "Rep", body: "Rep" },
      validRep: true,
      rejectedRep: null,
      repCount: 1,
      metrics: {},
    });
    const summary = tracker.end(1500);
    expect(summary.durationMs).toBe(500);
    expect(summary.analyzedMs).toBe(500);
    expect(summary.evidenceCoverage).toBe(0.6);
    expect(summary.validRepCount).toBe(1);
    expect(summary.rejectedRepCount).toBe(1);
    expect(summary.rejectedRepReasons).toEqual({ insufficient_evidence: 1 });
  });
});
