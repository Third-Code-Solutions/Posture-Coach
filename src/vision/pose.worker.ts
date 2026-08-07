import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { PoseDetector } from "@tensorflow-models/pose-detection/dist/pose_detector";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./protocol";
import { MEASUREMENT_THRESHOLDS } from "../domain/measurement-registry";
import { selectPoseDelegate, type PoseDelegate } from "./delegate";
import { createTfjsPoseDetector, serializeTfjsPose } from "./tfjs-runtime";

const nativeFetch = globalThis.fetch.bind(globalThis);
const LOCAL_WORKER_RUNTIME_REVISION = "2026-08-06-portrait-realtime";

function isTelemetryRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : "url" in input ? input.url : input.href;
  return url.startsWith("https://odml.pa.googleapis.com/");
}

// MediaPipe's bundled runtime attempts optional ODML telemetry. Keep the worker
// local-only: model and WASM requests still use the app origin; telemetry gets a
// local no-content response and never reaches the network.
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  isTelemetryRequest(input)
    ? Promise.resolve(new Response(null, { status: 204 }))
    : nativeFetch(input, init)) as typeof fetch;

let landmarker: PoseLandmarker | null = null;
let cpuDetector: PoseDetector | null = null;
let landmarkerPromise: Promise<void> | null = null;
let disposed = false;
let activeDelegate: "GPU" | "CPU" = "CPU";
let selectedDelegate: PoseDelegate = "CPU";
let activeModel: "pose_landmarker_full" | "blazepose_tfjs_full" = "pose_landmarker_full";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
  postMessage: (message: PoseWorkerResponse) => void;
};

async function createLandmarker(): Promise<void> {
  if (landmarker || cpuDetector || disposed) return;
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      if (selectedDelegate === "CPU") {
        const created = await createCpuDetector();
        if (disposed) {
          created.dispose();
          return;
        }
        cpuDetector = created;
        activeDelegate = "CPU";
        activeModel = "blazepose_tfjs_full";
        return;
      }

      const vision = await FilesetResolver.forVisionTasks("/wasm");
      const options = {
        runningMode: "VIDEO" as const,
        numPoses: MEASUREMENT_THRESHOLDS.inference.maximumPoseCount,
        minPoseDetectionConfidence: MEASUREMENT_THRESHOLDS.confidence.modelPoseDetectionScore,
        minPosePresenceConfidence: MEASUREMENT_THRESHOLDS.confidence.modelPosePresenceScore,
        minTrackingConfidence: MEASUREMENT_THRESHOLDS.confidence.modelTrackingScore,
        outputSegmentationMasks: false,
      };
      let created: PoseLandmarker;
      try {
        created = await PoseLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_full.task",
            delegate: "GPU",
          },
        });
        activeDelegate = "GPU";
        activeModel = "pose_landmarker_full";
      } catch {
        // A context can disappear between the page probe and graph startup.
        // MediaPipe's CPU delegate still uploads frames through WebGL, so use
        // the independent local WASM runtime for a real no-WebGL fallback.
        const fallback = await createCpuDetector();
        if (disposed) {
          fallback.dispose();
          return;
        }
        cpuDetector = fallback;
        activeDelegate = "CPU";
        activeModel = "blazepose_tfjs_full";
        return;
      }
      if (disposed) {
        created.close();
        return;
      }
      landmarker = created;
    })().finally(() => {
      landmarkerPromise = null;
    });
  }
  await landmarkerPromise;
}

async function createCpuDetector(): Promise<PoseDetector> {
  return createTfjsPoseDetector(self.location.origin);
}

function emitResult(result: PoseLandmarkerResult, timestampMs: number, sequence: number): void {
  const landmarks = result.landmarks[0] ?? [];
  const worldLandmarks = result.worldLandmarks[0] ?? [];
  workerScope.postMessage({
    type: "result",
    landmarks: landmarks.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z,
      visibility: point.visibility,
    })),
    worldLandmarks: worldLandmarks.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z,
      visibility: point.visibility,
    })),
    timestampMs,
    sequence,
  });
}

function emitCpuResult(
  pose: Parameters<typeof serializeTfjsPose>[0],
  width: number,
  height: number,
  timestampMs: number,
  sequence: number,
): void {
  const serialized = serializeTfjsPose(pose, width, height);
  workerScope.postMessage({
    type: "result",
    ...serialized,
    timestampMs,
    sequence,
  });
}

workerScope.onmessage = async (event) => {
  const request = event.data;
  if (request.type === "dispose") {
    disposed = true;
    landmarker?.close();
    cpuDetector?.dispose();
    landmarker = null;
    cpuDetector = null;
    return;
  }
  if (disposed) {
    workerScope.postMessage({
      type: "error",
      code: "disposed",
      message: "Pose worker is disposed.",
      recoverable: false,
    });
    return;
  }
  if (request.type === "init") {
    try {
      selectedDelegate = selectPoseDelegate(request.webgl2Available, request.webglAvailable);
      await createLandmarker();
      workerScope.postMessage({
        type: "ready",
        model: activeModel,
        version:
          activeModel === "blazepose_tfjs_full"
            ? `BlazePose Full / TFJS WASM (${activeDelegate}; ${LOCAL_WORKER_RUNTIME_REVISION})`
            : `@mediapipe/tasks-vision@1.0.1 (${activeDelegate}; ${LOCAL_WORKER_RUNTIME_REVISION})`,
      });
    } catch (error) {
      workerScope.postMessage({
        type: "error",
        code: "initialization",
        message: error instanceof Error ? error.message : "Unable to load local pose model.",
        recoverable: true,
      });
    }
    return;
  }
  try {
    await createLandmarker();
    const width = request.frame.width;
    const height = request.frame.height;
    if (cpuDetector) {
      const poses = await cpuDetector.estimatePoses(
        request.frame,
        { maxPoses: MEASUREMENT_THRESHOLDS.inference.maximumPoseCount, flipHorizontal: false },
        request.timestampMs,
      );
      emitCpuResult(poses[0], width, height, request.timestampMs, request.sequence);
    } else {
      if (!landmarker) throw new Error("Pose landmarker is unavailable.");
      const result = landmarker.detectForVideo(request.frame, request.timestampMs);
      emitResult(result, request.timestampMs, request.sequence);
      result.close();
    }
    request.frame.close();
  } catch (error) {
    request.frame.close();
    workerScope.postMessage({
      type: "error",
      code: "inference",
      message: error instanceof Error ? error.message : "Pose inference failed.",
      recoverable: true,
    });
  }
};
