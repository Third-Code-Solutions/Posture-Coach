import { describe, expect, it } from "vitest";
import {
  DEVICE_DIAGNOSTIC_LATENCY_SAMPLE_LIMIT,
  DeviceDiagnosticsRecorder,
  buildDeviceDiagnosticReport,
  hasObservableFullBody,
} from "../../src/vision/device-diagnostics";
import type { BrowserCapabilities } from "../../src/vision/capabilities";
import { makeLandmarks } from "../domain/fixtures";

const capabilities: BrowserCapabilities = {
  secureContext: true,
  cameraApi: true,
  worker: true,
  imageBitmap: true,
  webAssembly: true,
  webgl2: false,
  webgl: false,
  workerCanvas2d: false,
  screenWakeLock: true,
  coarsePointer: true,
};

describe("hasObservableFullBody", () => {
  it("requires a confident pose, visible head and feet, and frame margins", () => {
    expect(hasObservableFullBody(makeLandmarks(), 0.96)).toBe(true);
    expect(
      hasObservableFullBody(
        makeLandmarks({ leftFootIndex: { visibility: 0.2, presence: 0.2 } }),
        0.96,
      ),
    ).toBe(false);
    expect(hasObservableFullBody(makeLandmarks(), 0.2)).toBe(false);
    expect(hasObservableFullBody(makeLandmarks({ rightHeel: { y: 0.999 } }), 0.96)).toBe(false);
  });
});

describe("DeviceDiagnosticsRecorder", () => {
  it("keeps a bounded latency window and reports deterministic percentiles", () => {
    const recorder = new DeviceDiagnosticsRecorder();

    for (let latencyMs = 1; latencyMs <= 200; latencyMs += 1) {
      recorder.recordLatency(latencyMs);
    }
    recorder.recordLatency(Number.NaN);
    recorder.recordLatency(-1);

    expect(recorder.snapshot().inference).toEqual({
      engineLabel: null,
      qualityProfile: null,
      frameSize: null,
      totalResults: 200,
      retainedLatencySamples: DEVICE_DIAGNOSTIC_LATENCY_SAMPLE_LIMIT,
      lastLatencyMs: 200,
      p50LatencyMs: 110,
      p95LatencyMs: 191,
      maximumLatencyMs: 200,
      backpressureSkips: 0,
    });
  });

  it("records camera outcomes without retaining device identifiers or body data", () => {
    const recorder = new DeviceDiagnosticsRecorder();
    recorder.recordCameraRequest();
    recorder.recordCameraPermission("denied");
    recorder.recordCameraRequest();
    recorder.recordCameraPermission("granted");
    recorder.recordCameraRuntime({
      rawWidth: 320,
      rawHeight: 180,
      effectiveWidth: 180,
      effectiveHeight: 320,
      rotatedLocally: true,
      facingMode: "user",
      frameRate: 29.7,
    });
    recorder.recordCameraRuntime({
      rawWidth: 1920,
      rawHeight: 1080,
      effectiveWidth: 1080,
      effectiveHeight: 1920,
      rotatedLocally: true,
      facingMode: "environment",
      frameRate: 30,
    });
    recorder.recordFullBodyFraming(false);
    recorder.recordFullBodyFraming(true);
    recorder.recordEngineLabel("Pose Landmarker Full · GPU · local");
    recorder.recordInferenceProfile({ id: "detail", label: "Detail", maxDimension: 720 });
    recorder.recordInferenceFrameSize({ width: 405, height: 720 });
    recorder.recordBackpressureSkip();
    recorder.recordCameraCleanup(true);

    const snapshot = recorder.snapshot();
    expect(snapshot.cameraPermission).toBe("granted");
    expect(snapshot.cameraRequests).toBe(2);
    expect(snapshot.cameraStarts).toBe(1);
    expect(snapshot.cameraPermissionOutcomes).toEqual({
      granted: 1,
      denied: 1,
      unavailable: 0,
    });
    expect(snapshot.cameraFacingsTested).toEqual(["user", "environment"]);
    expect(snapshot.cameraRuntimesByFacing).toEqual({
      user: {
        rawWidth: 320,
        rawHeight: 180,
        effectiveWidth: 180,
        effectiveHeight: 320,
        rotatedLocally: true,
        facingMode: "user",
        frameRate: 29.7,
      },
      environment: {
        rawWidth: 1920,
        rawHeight: 1080,
        effectiveWidth: 1080,
        effectiveHeight: 1920,
        rotatedLocally: true,
        facingMode: "environment",
        frameRate: 30,
      },
    });
    expect(snapshot.latestCamera).toMatchObject({
      rawWidth: 1920,
      rawHeight: 1080,
      effectiveWidth: 1080,
      effectiveHeight: 1920,
      facingMode: "environment",
    });
    expect(snapshot.fullBodyFraming).toEqual({
      samples: 2,
      latestInFrame: true,
      observedInFrame: true,
    });
    expect(snapshot.cameraCleanupConfirmed).toBe(true);
    expect(snapshot.inference).toMatchObject({
      engineLabel: "Pose Landmarker Full · GPU · local",
      qualityProfile: { id: "detail", label: "Detail", maxDimension: 720 },
      frameSize: { width: 405, height: 720 },
    });
    expect(snapshot.inference.backpressureSkips).toBe(1);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /"deviceId":|"groupId":|"landmarks":|"visibility":/i,
    );
  });

  it("resets all retained diagnostics without touching external state", () => {
    const recorder = new DeviceDiagnosticsRecorder();
    recorder.recordCameraPermission("denied");
    recorder.recordLatency(42);
    recorder.recordBackpressureSkip();
    recorder.recordCameraCleanup(false);

    recorder.reset();

    expect(recorder.snapshot()).toEqual({
      cameraPermission: "not-tested",
      cameraRequests: 0,
      cameraStarts: 0,
      cameraPermissionOutcomes: { granted: 0, denied: 0, unavailable: 0 },
      cameraFacingsTested: [],
      cameraRuntimesByFacing: {},
      latestCamera: null,
      cameraCleanupConfirmed: null,
      fullBodyFraming: { samples: 0, latestInFrame: null, observedInFrame: false },
      inference: {
        engineLabel: null,
        qualityProfile: null,
        frameSize: null,
        totalResults: 0,
        retainedLatencySamples: 0,
        lastLatencyMs: null,
        p50LatencyMs: null,
        p95LatencyMs: null,
        maximumLatencyMs: null,
        backpressureSkips: 0,
      },
    });
  });
});

describe("buildDeviceDiagnosticReport", () => {
  it("builds an honest local-only report with explicit observed and untested checks", () => {
    const recorder = new DeviceDiagnosticsRecorder();
    recorder.recordCameraPermission("granted");
    recorder.recordCameraRuntime({
      rawWidth: 320,
      rawHeight: 180,
      effectiveWidth: 180,
      effectiveHeight: 320,
      rotatedLocally: true,
      facingMode: "user",
      frameRate: 30,
    });
    recorder.recordLatency(24);
    recorder.recordLatency(30);
    recorder.recordEngineLabel("BlazePose Full · CPU · local");
    recorder.recordInferenceProfile({ id: "detail", label: "Detail", maxDimension: 720 });
    recorder.recordInferenceFrameSize({ width: 405, height: 720 });
    recorder.recordFullBodyFraming(true);
    recorder.recordCameraCleanup(true);

    const report = buildDeviceDiagnosticReport({
      snapshot: recorder.snapshot(),
      environment: {
        generatedAt: "2026-08-08T12:00:00.000Z",
        appUrl: "https://thirdcode-posture.vercel.app/",
        userAgent: "Test Mobile Browser",
        language: "en-US",
        viewport: { width: 390, height: 844, pixelRatio: 3 },
        capabilities,
        inferenceRoute: "worker-pixels",
      },
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      product: "Third Code Posture",
      generatedAt: "2026-08-08T12:00:00.000Z",
      privacy: {
        localOnly: true,
        containsFrames: false,
        containsLandmarks: false,
        containsDeviceIdentifiers: false,
      },
      environment: {
        inferenceRoute: "worker-pixels",
      },
      session: {
        inference: {
          engineLabel: "BlazePose Full · CPU · local",
          qualityProfile: { id: "detail", label: "Detail", maxDimension: 720 },
          frameSize: { width: 405, height: 720 },
        },
      },
    });
    expect(report.checks.find((check) => check.id === "portrait-frame")?.status).toBe("observed");
    expect(report.checks.find((check) => check.id === "front-camera")?.status).toBe("observed");
    expect(report.checks.find((check) => check.id === "rear-camera")?.status).toBe("not-tested");
    expect(report.checks.find((check) => check.id === "camera-cleanup")?.status).toBe("observed");
    expect(report.checks.find((check) => check.id === "full-body-framing")?.status).toBe(
      "observed",
    );
    expect(JSON.stringify(report)).not.toMatch(
      /"deviceId":|"groupId":|"landmarks":|"visibility":/i,
    );
  });
});
