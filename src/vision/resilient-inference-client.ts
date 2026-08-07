import type { PoseInferenceClient, PoseInferenceClientOptions } from "./inference-client";
import type { PoseWorkerResponse } from "./protocol";

export type PoseInferenceClientFactory = (
  options: PoseInferenceClientOptions,
) => PoseInferenceClient;

interface PendingFrame {
  frame: ImageBitmap;
  timestampMs: number;
  sequence: number;
}

type SubmissionOutcome = "accepted" | "rejected" | "recovered" | "failed";

export class ResilientPoseInferenceClient implements PoseInferenceClient {
  private active: PoseInferenceClient;
  private activeGeneration = 0;
  private activeIsFallback = false;
  private ready = false;
  private initialized = false;
  private disposed = false;
  private pending: PendingFrame | null = null;
  private retryFrameAfterFallback = false;

  constructor(
    private readonly options: PoseInferenceClientOptions,
    private readonly primaryFactory: PoseInferenceClientFactory,
    private readonly fallbackFactory: PoseInferenceClientFactory,
    private readonly onFrameRetryRequired?: () => void,
  ) {
    try {
      this.active = this.createClient(this.primaryFactory, false);
    } catch {
      this.active = this.createClient(this.fallbackFactory, true);
    }
  }

  init(): void {
    if (this.disposed || this.initialized) return;
    this.initialized = true;
    try {
      this.active.init();
    } catch (error) {
      if (this.activeIsFallback) {
        this.emitInitializationError(error);
      } else {
        this.switchToFallback(error);
      }
    }
  }

  submit(frame: ImageBitmap, timestampMs: number, sequence: number): boolean {
    if (this.disposed || this.pending || (this.ready && !this.active.canAcceptFrame())) {
      frame.close();
      return false;
    }
    if (!this.ready) {
      this.pending = { frame, timestampMs, sequence };
      return true;
    }
    const outcome = this.submitToActive(frame, timestampMs, sequence);
    return outcome === "accepted" || outcome === "recovered";
  }

  canAcceptFrame(): boolean {
    if (this.disposed) return false;
    return this.ready ? this.active.canAcceptFrame() : this.pending === null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending?.frame.close();
    this.pending = null;
    this.active.dispose();
    this.ready = false;
    this.retryFrameAfterFallback = false;
  }

  private createClient(
    factory: PoseInferenceClientFactory,
    fallback: boolean,
  ): PoseInferenceClient {
    const generation = this.activeGeneration + 1;
    this.activeGeneration = generation;
    this.activeIsFallback = fallback;
    return factory({
      onMessage: (message) => this.handleMessage(message, generation, fallback),
    });
  }

  private handleMessage(message: PoseWorkerResponse, generation: number, fallback: boolean): void {
    if (this.disposed || generation !== this.activeGeneration) return;
    if (message.type === "ready") {
      const shouldRequestRetry = this.retryFrameAfterFallback && this.pending === null;
      this.retryFrameAfterFallback = false;
      this.ready = true;
      this.options.onMessage(message);
      this.flushPendingFrame();
      if (shouldRequestRetry) this.onFrameRetryRequired?.();
      return;
    }
    if (message.type === "error" && !fallback) {
      const shouldFallback =
        !this.ready ||
        message.code === "transport" ||
        (message.code === "inference" && message.recoverable);
      if (shouldFallback) {
        if (this.ready) this.retryFrameAfterFallback = true;
        this.switchToFallback(new Error(message.message));
        return;
      }
    }
    this.options.onMessage(message);
  }

  private switchToFallback(primaryError: unknown): void {
    this.active.dispose();
    this.ready = false;
    try {
      this.active = this.createClient(this.fallbackFactory, true);
      this.active.init();
    } catch (fallbackError) {
      this.pending?.frame.close();
      this.pending = null;
      this.emitInitializationError(fallbackError, primaryError);
    }
  }

  private flushPendingFrame(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    const outcome = this.submitToActive(pending.frame, pending.timestampMs, pending.sequence);
    if (outcome === "rejected") {
      this.options.onMessage({
        type: "error",
        code: "inference",
        message: "The local pose runtime could not accept its first frame.",
        recoverable: true,
      });
    }
  }

  private submitToActive(
    frame: ImageBitmap,
    timestampMs: number,
    sequence: number,
  ): SubmissionOutcome {
    try {
      return this.active.submit(frame, timestampMs, sequence) ? "accepted" : "rejected";
    } catch (error) {
      if (!this.activeIsFallback) {
        this.pending = { frame, timestampMs, sequence };
        this.switchToFallback(error);
        return "recovered";
      }
      frame.close();
      this.options.onMessage({
        type: "error",
        code: "inference",
        message:
          error instanceof Error
            ? error.message
            : "The local fallback could not accept a pose frame.",
        recoverable: true,
      });
      return "failed";
    }
  }

  private emitInitializationError(error: unknown, primaryError?: unknown): void {
    const fallbackMessage = error instanceof Error ? error.message : "Local fallback failed.";
    const primaryMessage =
      primaryError instanceof Error ? ` Worker failure: ${primaryError.message}` : "";
    this.options.onMessage({
      type: "error",
      code: "initialization",
      message: `${fallbackMessage}${primaryMessage}`,
      recoverable: true,
    });
  }
}
