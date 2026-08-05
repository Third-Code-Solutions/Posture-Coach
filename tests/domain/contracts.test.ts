import { describe, expect, it } from "vitest";
import {
  type AnalysisMode,
  assessConfidence,
  CalibrationWindow,
  type CameraView,
  LandmarkSmoother,
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
    sampleCount: 18,
    completedAtMs: 1,
    baseline: {},
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
  });

  it("does not emit authoritative advice before calibration", () => {
    const engine = createEngine();
    engine.setCalibrationStable(false);
    const result = engine.process(makeObservation());
    expect(result.status).toBe("insufficient_evidence");
    expect(result.feedback.title).toBe("Calibrate first");
    expect(result.confidence.reasons).toContain("uncalibrated");
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
  });

  it("counts a valid lunge only when one leg leads in a split stance", () => {
    const engine = createEngine();
    setStableCalibration(engine, "lunge", "front");
    const splitStance = makeLandmarks({
      leftKnee: { x: 0.6, y: 0.9 },
      leftAnkle: { x: 0.75, y: 0.86 },
      rightKnee: { x: 0.55, y: 0.8 },
      rightAnkle: { x: 0.45, y: 0.96 },
    });
    engine.process(
      makeObservation({
        landmarks: splitStance,
        cameraView: "front",
        observedView: "front",
        timestampMs: 0,
      }),
    );
    engine.process(
      makeObservation({
        landmarks: splitStance,
        cameraView: "front",
        observedView: "front",
        timestampMs: 500,
        sequence: 1,
      }),
    );
    const counted = engine.process(
      makeObservation({
        cameraView: "front",
        observedView: "front",
        timestampMs: 1_200,
        sequence: 2,
      }),
    );
    expect(counted.validRep).toBe(true);
    expect(counted.repCount).toBe(1);

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

    const driftEngine = createEngine();
    setStableCalibration(driftEngine, "curl");
    const drifted = makeLandmarks({
      leftElbow: { x: 0.67, y: 0.6 },
      rightElbow: { x: 0.33, y: 0.6 },
      leftWrist: { x: 0.62, y: 0.42 },
      rightWrist: { x: 0.38, y: 0.42 },
    });
    driftEngine.process(makeObservation({ landmarks: drifted, timestampMs: 0 }));
    const driftHold = driftEngine.process(
      makeObservation({ landmarks: drifted, timestampMs: 500, sequence: 1 }),
    );
    const rejected = driftEngine.process(makeObservation({ timestampMs: 1_200, sequence: 2 }));
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
