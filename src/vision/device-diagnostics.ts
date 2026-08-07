import { REQUIRED_LANDMARKS, type LandmarkSet } from "../domain/contracts";
import { wholeBodyFrameDeviation } from "../domain/geometry";
import { MEASUREMENT_THRESHOLDS } from "../domain/measurement-registry";
import type { InferenceQualityProfile } from "./adaptive-inference";
import {
  hasLocalInferenceSupport,
  type BrowserCapabilities,
  type PoseInferenceRoute,
} from "./capabilities";
import type { CameraFacingMode, CameraRuntimeInfo, FrameDimensions } from "./camera";

export const DEVICE_DIAGNOSTIC_LATENCY_SAMPLE_LIMIT = 180;

export type CameraPermissionOutcome = "not-tested" | "granted" | "denied" | "unavailable";
export type TestedCameraPermissionOutcome = Exclude<CameraPermissionOutcome, "not-tested">;
export type DeviceCheckStatus = "observed" | "check" | "not-tested";

export interface DeviceDiagnosticInferenceSnapshot {
  engineLabel: string | null;
  qualityProfile: InferenceQualityProfile | null;
  frameSize: FrameDimensions | null;
  totalResults: number;
  retainedLatencySamples: number;
  lastLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  maximumLatencyMs: number | null;
  backpressureSkips: number;
}

export interface DeviceDiagnosticsSnapshot {
  cameraPermission: CameraPermissionOutcome;
  cameraPermissionOutcomes: Record<TestedCameraPermissionOutcome, number>;
  cameraRequests: number;
  cameraStarts: number;
  cameraFacingsTested: CameraFacingMode[];
  cameraRuntimesByFacing: Partial<Record<CameraFacingMode, CameraRuntimeInfo>>;
  latestCamera: CameraRuntimeInfo | null;
  cameraCleanupConfirmed: boolean | null;
  fullBodyFraming: {
    samples: number;
    latestInFrame: boolean | null;
    observedInFrame: boolean;
  };
  inference: DeviceDiagnosticInferenceSnapshot;
}

export interface DeviceReportEnvironment {
  generatedAt: string;
  appUrl: string;
  userAgent: string;
  language: string;
  viewport: { width: number; height: number; pixelRatio: number };
  capabilities: BrowserCapabilities;
  inferenceRoute: PoseInferenceRoute;
}

export interface DeviceDiagnosticCheck {
  id:
    | "secure-context"
    | "camera-api"
    | "local-inference"
    | "camera-permission"
    | "portrait-frame"
    | "front-camera"
    | "rear-camera"
    | "live-pose"
    | "full-body-framing"
    | "latency"
    | "camera-cleanup";
  status: DeviceCheckStatus;
  detail: string;
}

export interface DeviceDiagnosticReport {
  schemaVersion: 1;
  product: "Third Code Posture";
  generatedAt: string;
  privacy: {
    localOnly: true;
    containsFrames: false;
    containsLandmarks: false;
    containsDeviceIdentifiers: false;
  };
  environment: Omit<DeviceReportEnvironment, "generatedAt">;
  session: DeviceDiagnosticsSnapshot;
  checks: DeviceDiagnosticCheck[];
  limitations: string[];
}

function boundedWholeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function boundedFrameRate(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : null;
}

function sanitizeCameraRuntime(runtime: CameraRuntimeInfo): CameraRuntimeInfo {
  return {
    rawWidth: boundedWholeNumber(runtime.rawWidth),
    rawHeight: boundedWholeNumber(runtime.rawHeight),
    effectiveWidth: boundedWholeNumber(runtime.effectiveWidth),
    effectiveHeight: boundedWholeNumber(runtime.effectiveHeight),
    rotatedLocally: runtime.rotatedLocally,
    facingMode:
      runtime.facingMode === "user" || runtime.facingMode === "environment"
        ? runtime.facingMode
        : null,
    frameRate: boundedFrameRate(runtime.frameRate),
  };
}

export function hasObservableFullBody(landmarks: LandmarkSet, poseConfidence: number): boolean {
  if (
    !Number.isFinite(poseConfidence) ||
    poseConfidence < MEASUREMENT_THRESHOLDS.confidence.minimumCalibrationViewPoseScore
  ) {
    return false;
  }
  const requiredLandmarksAreVisible = REQUIRED_LANDMARKS.standing.every((name) => {
    const point = landmarks[name];
    return (
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z) &&
      Number.isFinite(point.visibility) &&
      Number.isFinite(point.presence) &&
      Math.min(point.visibility, point.presence) >=
        MEASUREMENT_THRESHOLDS.confidence.minimumLandmarkScore
    );
  });
  return requiredLandmarksAreVisible && wholeBodyFrameDeviation(landmarks, "standing") === 0;
}

function percentile(sorted: readonly number[], quantile: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index] ?? null;
}

export class DeviceDiagnosticsRecorder {
  private cameraPermission: CameraPermissionOutcome = "not-tested";
  private readonly cameraPermissionOutcomes: Record<TestedCameraPermissionOutcome, number> = {
    granted: 0,
    denied: 0,
    unavailable: 0,
  };
  private cameraRequests = 0;
  private cameraStarts = 0;
  private readonly cameraFacings = new Set<CameraFacingMode>();
  private readonly cameraRuntimesByFacing: Partial<Record<CameraFacingMode, CameraRuntimeInfo>> =
    {};
  private latestCamera: CameraRuntimeInfo | null = null;
  private cameraCleanupConfirmed: boolean | null = null;
  private framingSamples = 0;
  private latestFullBodyInFrame: boolean | null = null;
  private fullBodyObservedInFrame = false;
  private readonly latencySamples: number[] = [];
  private engineLabel: string | null = null;
  private qualityProfile: InferenceQualityProfile | null = null;
  private frameSize: FrameDimensions | null = null;
  private totalResults = 0;
  private backpressureSkips = 0;

  recordCameraRequest(): void {
    this.cameraRequests += 1;
  }

  recordCameraPermission(outcome: TestedCameraPermissionOutcome): void {
    this.cameraPermission = outcome;
    this.cameraPermissionOutcomes[outcome] += 1;
    if (outcome === "granted") this.cameraStarts += 1;
  }

  recordCameraRuntime(runtime: CameraRuntimeInfo): void {
    const sanitized = sanitizeCameraRuntime(runtime);
    this.latestCamera = sanitized;
    if (sanitized.facingMode === "user" || sanitized.facingMode === "environment") {
      this.cameraFacings.add(sanitized.facingMode);
      this.cameraRuntimesByFacing[sanitized.facingMode] = sanitized;
    }
  }

  recordCameraCleanup(confirmed: boolean): void {
    this.cameraCleanupConfirmed = confirmed;
  }

  recordFullBodyFraming(inFrame: boolean): void {
    this.framingSamples += 1;
    this.latestFullBodyInFrame = inFrame;
    this.fullBodyObservedInFrame ||= inFrame;
  }

  recordLatency(latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;
    const rounded = Math.round(latencyMs);
    this.totalResults += 1;
    this.latencySamples.push(rounded);
    if (this.latencySamples.length > DEVICE_DIAGNOSTIC_LATENCY_SAMPLE_LIMIT) {
      this.latencySamples.splice(
        0,
        this.latencySamples.length - DEVICE_DIAGNOSTIC_LATENCY_SAMPLE_LIMIT,
      );
    }
  }

  recordEngineLabel(label: string): void {
    const normalized = label.trim();
    this.engineLabel = normalized.length > 0 ? normalized.slice(0, 160) : null;
  }

  recordInferenceProfile(profile: InferenceQualityProfile): void {
    this.qualityProfile = { ...profile };
  }

  recordInferenceFrameSize(frameSize: FrameDimensions): void {
    this.frameSize = {
      width: boundedWholeNumber(frameSize.width),
      height: boundedWholeNumber(frameSize.height),
    };
  }

  recordBackpressureSkip(): void {
    this.backpressureSkips += 1;
  }

  reset(): void {
    this.cameraPermission = "not-tested";
    this.cameraPermissionOutcomes.granted = 0;
    this.cameraPermissionOutcomes.denied = 0;
    this.cameraPermissionOutcomes.unavailable = 0;
    this.cameraRequests = 0;
    this.cameraStarts = 0;
    this.cameraFacings.clear();
    delete this.cameraRuntimesByFacing.user;
    delete this.cameraRuntimesByFacing.environment;
    this.latestCamera = null;
    this.cameraCleanupConfirmed = null;
    this.framingSamples = 0;
    this.latestFullBodyInFrame = null;
    this.fullBodyObservedInFrame = false;
    this.latencySamples.splice(0);
    this.engineLabel = null;
    this.qualityProfile = null;
    this.frameSize = null;
    this.totalResults = 0;
    this.backpressureSkips = 0;
  }

  snapshot(): DeviceDiagnosticsSnapshot {
    const sortedLatencies = [...this.latencySamples].sort((left, right) => left - right);
    return {
      cameraPermission: this.cameraPermission,
      cameraPermissionOutcomes: { ...this.cameraPermissionOutcomes },
      cameraRequests: this.cameraRequests,
      cameraStarts: this.cameraStarts,
      cameraFacingsTested: (["user", "environment"] as const).filter((facing) =>
        this.cameraFacings.has(facing),
      ),
      cameraRuntimesByFacing: {
        ...(this.cameraRuntimesByFacing.user
          ? { user: { ...this.cameraRuntimesByFacing.user } }
          : {}),
        ...(this.cameraRuntimesByFacing.environment
          ? { environment: { ...this.cameraRuntimesByFacing.environment } }
          : {}),
      },
      latestCamera: this.latestCamera ? { ...this.latestCamera } : null,
      cameraCleanupConfirmed: this.cameraCleanupConfirmed,
      fullBodyFraming: {
        samples: this.framingSamples,
        latestInFrame: this.latestFullBodyInFrame,
        observedInFrame: this.fullBodyObservedInFrame,
      },
      inference: {
        engineLabel: this.engineLabel,
        qualityProfile: this.qualityProfile ? { ...this.qualityProfile } : null,
        frameSize: this.frameSize ? { ...this.frameSize } : null,
        totalResults: this.totalResults,
        retainedLatencySamples: this.latencySamples.length,
        lastLatencyMs: this.latencySamples.at(-1) ?? null,
        p50LatencyMs: percentile(sortedLatencies, 0.5),
        p95LatencyMs: percentile(sortedLatencies, 0.95),
        maximumLatencyMs: sortedLatencies.at(-1) ?? null,
        backpressureSkips: this.backpressureSkips,
      },
    };
  }
}

function capabilityCheck(
  id: DeviceDiagnosticCheck["id"],
  observedValue: boolean,
  detail: string,
): DeviceDiagnosticCheck {
  return {
    id,
    status: observedValue ? "observed" : "check",
    detail,
  };
}

export function buildDeviceDiagnosticReport({
  snapshot,
  environment,
}: {
  snapshot: DeviceDiagnosticsSnapshot;
  environment: DeviceReportEnvironment;
}): DeviceDiagnosticReport {
  const camera = snapshot.latestCamera;
  const observedCameras = (["user", "environment"] as const)
    .map((facing) => snapshot.cameraRuntimesByFacing[facing])
    .filter((runtime): runtime is CameraRuntimeInfo => runtime !== undefined);
  if (observedCameras.length === 0 && camera) observedCameras.push(camera);
  const inference = snapshot.inference;
  const checks: DeviceDiagnosticCheck[] = [
    capabilityCheck(
      "secure-context",
      environment.capabilities.secureContext,
      "HTTPS or localhost is required.",
    ),
    capabilityCheck(
      "camera-api",
      environment.capabilities.cameraApi,
      "Camera API availability in this browser.",
    ),
    {
      id: "local-inference",
      status: !hasLocalInferenceSupport(environment.capabilities)
        ? "check"
        : inference.totalResults > 0
          ? "observed"
          : "not-tested",
      detail: !hasLocalInferenceSupport(environment.capabilities)
        ? "Browser lacks a complete local inference route."
        : inference.totalResults > 0
          ? `Selected local route: ${environment.inferenceRoute}${inference.engineLabel ? `; ${inference.engineLabel}` : ""}.`
          : `Local route ${environment.inferenceRoute} is available but was not exercised by a camera result.`,
    },
    {
      id: "camera-permission",
      status:
        snapshot.cameraPermission === "granted"
          ? "observed"
          : snapshot.cameraPermission === "not-tested"
            ? "not-tested"
            : "check",
      detail: `${snapshot.cameraRequests} camera request attempt${snapshot.cameraRequests === 1 ? "" : "s"}; latest outcome ${snapshot.cameraPermission}; granted ${snapshot.cameraPermissionOutcomes.granted}, denied ${snapshot.cameraPermissionOutcomes.denied}, unavailable ${snapshot.cameraPermissionOutcomes.unavailable}.`,
    },
    {
      id: "portrait-frame",
      status:
        observedCameras.length > 0
          ? observedCameras.every((runtime) => runtime.effectiveHeight >= runtime.effectiveWidth)
            ? "observed"
            : "check"
          : "not-tested",
      detail:
        observedCameras.length > 0
          ? observedCameras
              .map(
                (runtime) =>
                  `${runtime.facingMode === "environment" ? "Rear" : "Front"} ${runtime.effectiveWidth}×${runtime.effectiveHeight}${runtime.rotatedLocally ? " (rotated locally)" : ""}`,
              )
              .join("; ") + "."
          : "Start a camera to observe effective frame orientation.",
    },
    {
      id: "front-camera",
      status: snapshot.cameraFacingsTested.includes("user") ? "observed" : "not-tested",
      detail: "Front-facing camera observed in this tab.",
    },
    {
      id: "rear-camera",
      status: snapshot.cameraFacingsTested.includes("environment") ? "observed" : "not-tested",
      detail: "Rear-facing camera observed in this tab.",
    },
    {
      id: "live-pose",
      status: inference.totalResults > 0 ? "observed" : "not-tested",
      detail: `${inference.totalResults} local pose result${inference.totalResults === 1 ? "" : "s"} observed.`,
    },
    {
      id: "full-body-framing",
      status:
        snapshot.fullBodyFraming.samples === 0
          ? "not-tested"
          : snapshot.fullBodyFraming.observedInFrame
            ? "observed"
            : "check",
      detail:
        snapshot.fullBodyFraming.samples === 0
          ? "No camera pose framing sample was observed."
          : snapshot.fullBodyFraming.observedInFrame
            ? "Head and feet were observed inside the local frame at least once."
            : "Head-and-feet framing was not observed; step farther back and retry.",
    },
    {
      id: "latency",
      status:
        inference.p95LatencyMs === null
          ? "not-tested"
          : inference.p95LatencyMs < MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs
            ? "observed"
            : "check",
      detail:
        inference.p95LatencyMs === null
          ? "No local pipeline latency sample was observed."
          : `Recent-device p50 ${inference.p50LatencyMs}ms, p95 ${inference.p95LatencyMs}ms, max ${inference.maximumLatencyMs}ms.`,
    },
    {
      id: "camera-cleanup",
      status:
        snapshot.cameraCleanupConfirmed === null
          ? "not-tested"
          : snapshot.cameraCleanupConfirmed
            ? "observed"
            : "check",
      detail:
        snapshot.cameraCleanupConfirmed === null
          ? "Stop or switch a camera to test local track cleanup."
          : snapshot.cameraCleanupConfirmed
            ? "Camera tracks reported ended after stop or switch."
            : "A camera track did not report ended immediately after cleanup.",
    },
  ];

  const { generatedAt, ...reportEnvironment } = environment;
  return {
    schemaVersion: 1,
    product: "Third Code Posture",
    generatedAt,
    privacy: {
      localOnly: true,
      containsFrames: false,
      containsLandmarks: false,
      containsDeviceIdentifiers: false,
    },
    environment: reportEnvironment,
    session: snapshot,
    checks,
    limitations: [
      "This report is generated and downloaded locally; it is not uploaded by Third Code Posture.",
      "It records browser capabilities and aggregate runtime observations, not camera frames or body landmarks.",
      "A passing check is evidence for this named browser session only, not medical accuracy or universal device support.",
      "Camera field of view, lighting, thermal state, browser shell, and physical placement still affect results.",
    ],
  };
}
