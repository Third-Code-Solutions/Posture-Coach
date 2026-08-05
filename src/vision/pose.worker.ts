import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./protocol";

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
let landmarkerPromise: Promise<void> | null = null;
let disposed = false;
let activeDelegate: "GPU" | "CPU" = "CPU";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
  postMessage: (message: PoseWorkerResponse) => void;
};

async function createLandmarker(): Promise<void> {
  if (landmarker || disposed) return;
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      const options = {
        runningMode: "VIDEO" as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
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
      } catch {
        created = await PoseLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_full.task",
            delegate: "CPU",
          },
        });
        activeDelegate = "CPU";
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

workerScope.onmessage = async (event) => {
  const request = event.data;
  if (request.type === "dispose") {
    disposed = true;
    landmarker?.close();
    landmarker = null;
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
      await createLandmarker();
      workerScope.postMessage({
        type: "ready",
        model: "pose_landmarker_full",
        version: `@mediapipe/tasks-vision@1.0.1 (${activeDelegate}; ${LOCAL_WORKER_RUNTIME_REVISION})`,
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
    if (!landmarker) throw new Error("Pose landmarker is unavailable.");
    const result = landmarker.detectForVideo(request.frame, request.timestampMs);
    request.frame.close();
    emitResult(result, request.timestampMs, request.sequence);
    result.close();
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
