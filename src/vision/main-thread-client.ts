import type { PoseDetector } from "@tensorflow-models/pose-detection/dist/pose_detector";
import { MEASUREMENT_THRESHOLDS } from "../domain/measurement-registry";
import type { PoseInferenceClient, PoseInferenceClientOptions } from "./inference-client";
import { createTfjsPoseDetector, serializeTfjsPose } from "./tfjs-runtime";
import { warmTfjsPoseDetector } from "./warmup";

const MAIN_THREAD_RUNTIME_REVISION = "2026-08-07-webkit-compatibility";

export class PoseMainThreadClient implements PoseInferenceClient {
  private detector: PoseDetector | null = null;
  private initializationPromise: Promise<PoseDetector> | null = null;
  private inFlight = false;
  private disposed = false;
  private readyEmitted = false;

  constructor(private readonly options: PoseInferenceClientOptions) {}

  init(): void {
    void this.ensureDetector()
      .then(() => this.emitReady())
      .catch((error) => {
        if (this.disposed) return;
        this.options.onMessage({
          type: "error",
          code: "initialization",
          message: error instanceof Error ? error.message : "Unable to load local pose model.",
          recoverable: true,
        });
      });
  }

  submit(frame: ImageBitmap, timestampMs: number, sequence: number): boolean {
    if (this.disposed || this.inFlight) {
      frame.close();
      return false;
    }
    this.inFlight = true;
    void this.infer(frame, timestampMs, sequence);
    return true;
  }

  canAcceptFrame(): boolean {
    return !this.disposed && !this.inFlight;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detector?.dispose();
    this.detector = null;
    this.inFlight = false;
  }

  private async ensureDetector(): Promise<PoseDetector> {
    if (this.detector) return this.detector;
    if (!this.initializationPromise) {
      this.initializationPromise = createTfjsPoseDetector(window.location.origin)
        .then(async (detector) => {
          if (this.disposed) {
            detector.dispose();
            throw new Error("Pose runtime was disposed during initialization.");
          }
          await warmTfjsPoseDetector(detector);
          if (this.disposed) {
            detector.dispose();
            throw new Error("Pose runtime was disposed during warm-up.");
          }
          this.detector = detector;
          return detector;
        })
        .finally(() => {
          this.initializationPromise = null;
        });
    }
    return this.initializationPromise;
  }

  private emitReady(): void {
    if (this.disposed || this.readyEmitted) return;
    this.readyEmitted = true;
    this.options.onMessage({
      type: "ready",
      model: "blazepose_tfjs_full",
      version: `BlazePose Full / TFJS WASM (CPU; ${MAIN_THREAD_RUNTIME_REVISION})`,
    });
  }

  private async infer(frame: ImageBitmap, timestampMs: number, sequence: number): Promise<void> {
    try {
      const detector = await this.ensureDetector();
      this.emitReady();
      if (this.disposed) return;
      const poses = await detector.estimatePoses(
        frame,
        { maxPoses: MEASUREMENT_THRESHOLDS.inference.maximumPoseCount, flipHorizontal: false },
        timestampMs,
      );
      if (this.disposed) return;
      const serialized = serializeTfjsPose(poses[0], frame.width, frame.height);
      this.options.onMessage({
        type: "result",
        ...serialized,
        timestampMs,
        sequence,
      });
    } catch (error) {
      if (!this.disposed) {
        this.options.onMessage({
          type: "error",
          code: "inference",
          message: error instanceof Error ? error.message : "Pose inference failed.",
          recoverable: true,
        });
      }
    } finally {
      frame.close();
      this.inFlight = false;
    }
  }
}
