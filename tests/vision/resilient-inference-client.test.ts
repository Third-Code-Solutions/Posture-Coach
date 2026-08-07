import { describe, expect, it, vi } from "vitest";
import type {
  PoseInferenceClient,
  PoseInferenceClientOptions,
} from "../../src/vision/inference-client";
import { ResilientPoseInferenceClient } from "../../src/vision/resilient-inference-client";
import type { PoseWorkerResponse } from "../../src/vision/protocol";

class FakeInferenceClient implements PoseInferenceClient {
  readonly submitted: Array<{ frame: ImageBitmap; timestampMs: number; sequence: number }> = [];
  disposed = false;
  submitError: Error | null = null;

  constructor(private readonly options: PoseInferenceClientOptions) {}

  init(): void {}

  submit(frame: ImageBitmap, timestampMs: number, sequence: number): boolean {
    if (this.submitError) throw this.submitError;
    this.submitted.push({ frame, timestampMs, sequence });
    return true;
  }

  canAcceptFrame(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    this.disposed = true;
  }

  emit(message: PoseWorkerResponse): void {
    this.options.onMessage(message);
  }
}

function fakeFrame(): ImageBitmap {
  return { close: vi.fn() } as unknown as ImageBitmap;
}

const ready: PoseWorkerResponse = {
  type: "ready",
  model: "blazepose_tfjs_full",
  version: "test worker",
};

describe("ResilientPoseInferenceClient", () => {
  it("keeps one first frame until the primary worker is ready", () => {
    let primary!: FakeInferenceClient;
    const messages: PoseWorkerResponse[] = [];
    const client = new ResilientPoseInferenceClient(
      { onMessage: (message) => messages.push(message) },
      (options) => (primary = new FakeInferenceClient(options)),
      (options) => new FakeInferenceClient(options),
    );
    const frame = fakeFrame();

    client.init();
    expect(client.submit(frame, 100, 7)).toBe(true);
    expect(client.canAcceptFrame()).toBe(false);
    expect(primary.submitted).toHaveLength(0);

    primary.emit(ready);

    expect(primary.submitted).toEqual([{ frame, timestampMs: 100, sequence: 7 }]);
    expect(messages).toEqual([ready]);
  });

  it("preserves the queued frame when worker initialization falls back", () => {
    let primary!: FakeInferenceClient;
    let fallback!: FakeInferenceClient;
    const messages: PoseWorkerResponse[] = [];
    const client = new ResilientPoseInferenceClient(
      { onMessage: (message) => messages.push(message) },
      (options) => (primary = new FakeInferenceClient(options)),
      (options) => (fallback = new FakeInferenceClient(options)),
    );
    const frame = fakeFrame();

    client.init();
    client.submit(frame, 200, 8);
    primary.emit({
      type: "error",
      code: "initialization",
      message: "worker unavailable",
      recoverable: true,
    });

    expect(primary.disposed).toBe(true);
    expect(messages).toEqual([]);
    fallback.emit(ready);
    expect(fallback.submitted).toEqual([{ frame, timestampMs: 200, sequence: 8 }]);
    expect(messages).toEqual([ready]);
  });

  it("closes a queued frame when disposed before initialization completes", () => {
    const client = new ResilientPoseInferenceClient(
      { onMessage: vi.fn() },
      (options) => new FakeInferenceClient(options),
      (options) => new FakeInferenceClient(options),
    );
    const frame = fakeFrame();

    client.init();
    client.submit(frame, 300, 9);
    client.dispose();

    expect(frame.close).toHaveBeenCalledOnce();
    expect(client.canAcceptFrame()).toBe(false);
  });

  it("preserves the current frame when a ready worker throws during transport", () => {
    let primary!: FakeInferenceClient;
    let fallback!: FakeInferenceClient;
    const messages: PoseWorkerResponse[] = [];
    const client = new ResilientPoseInferenceClient(
      { onMessage: (message) => messages.push(message) },
      (options) => (primary = new FakeInferenceClient(options)),
      (options) => (fallback = new FakeInferenceClient(options)),
    );
    const frame = fakeFrame();

    client.init();
    primary.emit(ready);
    primary.submitError = new Error("pixel readback failed");

    expect(client.submit(frame, 400, 10)).toBe(true);
    expect(primary.disposed).toBe(true);
    expect(frame.close).not.toHaveBeenCalled();

    fallback.emit(ready);
    expect(fallback.submitted).toEqual([{ frame, timestampMs: 400, sequence: 10 }]);
    expect(messages).toEqual([ready, ready]);
  });

  it.each(["transport", "inference"] as const)(
    "switches a ready worker to fallback after an asynchronous %s error",
    (errorCode) => {
      let primary!: FakeInferenceClient;
      let fallback!: FakeInferenceClient;
      const messages: PoseWorkerResponse[] = [];
      const client = new ResilientPoseInferenceClient(
        { onMessage: (message) => messages.push(message) },
        (options) => (primary = new FakeInferenceClient(options)),
        (options) => (fallback = new FakeInferenceClient(options)),
      );
      const nextFrame = fakeFrame();

      client.init();
      primary.emit(ready);
      primary.emit({
        type: "error",
        code: errorCode,
        message: "worker channel failed",
        recoverable: true,
      });

      expect(primary.disposed).toBe(true);
      expect(messages).toEqual([ready]);
      expect(client.submit(nextFrame, 500, 11)).toBe(true);
      fallback.emit(ready);
      expect(fallback.submitted).toEqual([{ frame: nextFrame, timestampMs: 500, sequence: 11 }]);
      expect(messages).toEqual([ready, ready]);
    },
  );

  it.each(["transport", "inference"] as const)(
    "requests one source replay when an asynchronous %s error has no next frame",
    (errorCode) => {
      let primary!: FakeInferenceClient;
      let fallback!: FakeInferenceClient;
      const retryFrame = vi.fn();
      const client = new ResilientPoseInferenceClient(
        { onMessage: vi.fn() },
        (options) => (primary = new FakeInferenceClient(options)),
        (options) => (fallback = new FakeInferenceClient(options)),
        retryFrame,
      );

      client.init();
      primary.emit(ready);
      primary.emit({
        type: "error",
        code: errorCode,
        message: "worker channel failed",
        recoverable: true,
      });

      expect(retryFrame).not.toHaveBeenCalled();
      fallback.emit(ready);
      expect(retryFrame).toHaveBeenCalledOnce();
    },
  );

  it("forwards a non-recoverable primary inference error without changing routes", () => {
    let primary!: FakeInferenceClient;
    const messages: PoseWorkerResponse[] = [];
    const client = new ResilientPoseInferenceClient(
      { onMessage: (message) => messages.push(message) },
      (options) => (primary = new FakeInferenceClient(options)),
      (options) => new FakeInferenceClient(options),
    );

    client.init();
    primary.emit(ready);
    const error: PoseWorkerResponse = {
      type: "error",
      code: "inference",
      message: "fatal model failure",
      recoverable: false,
    };
    primary.emit(error);

    expect(primary.disposed).toBe(false);
    expect(messages).toEqual([ready, error]);
  });

  it("does not start another fallback when the final fallback reports an error", () => {
    let primary!: FakeInferenceClient;
    let fallback!: FakeInferenceClient;
    const messages: PoseWorkerResponse[] = [];
    const retryFrame = vi.fn();
    const client = new ResilientPoseInferenceClient(
      { onMessage: (message) => messages.push(message) },
      (options) => (primary = new FakeInferenceClient(options)),
      (options) => (fallback = new FakeInferenceClient(options)),
      retryFrame,
    );

    client.init();
    primary.emit(ready);
    primary.emit({
      type: "error",
      code: "transport",
      message: "worker channel failed",
      recoverable: true,
    });
    fallback.emit(ready);
    const error: PoseWorkerResponse = {
      type: "error",
      code: "inference",
      message: "fallback model failed",
      recoverable: true,
    };
    fallback.emit(error);

    expect(fallback.disposed).toBe(false);
    expect(retryFrame).toHaveBeenCalledOnce();
    expect(messages).toEqual([ready, ready, error]);
  });
});
