import type { PoseWorkerRequest, PoseWorkerResponse } from "./protocol";

export interface PoseWorkerClientOptions {
  onMessage: (message: PoseWorkerResponse) => void;
}

export class PoseWorkerClient {
  private readonly worker: Worker;
  private inFlight = false;
  private disposed = false;

  constructor(options: PoseWorkerClientOptions) {
    this.worker = new Worker(new URL("./pose.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      if (event.data.type === "result" || event.data.type === "error") this.inFlight = false;
      options.onMessage(event.data);
    };
    this.worker.onerror = (event) => {
      this.inFlight = false;
      options.onMessage({
        type: "error",
        code: "inference",
        message: event.message || "Pose worker crashed.",
        recoverable: false,
      });
    };
    this.worker.onmessageerror = () => {
      this.inFlight = false;
      options.onMessage({
        type: "error",
        code: "inference",
        message: "Pose worker communication failed.",
        recoverable: false,
      });
    };
  }

  init(): void {
    this.post({ type: "init" });
  }

  submit(frame: ImageBitmap, timestampMs: number, sequence: number): boolean {
    if (this.disposed || this.inFlight) {
      frame.close();
      return false;
    }
    this.inFlight = true;
    try {
      this.post({ type: "infer", frame, timestampMs, sequence }, [frame]);
    } catch {
      this.inFlight = false;
      frame.close();
      return false;
    }
    return true;
  }

  canAcceptFrame(): boolean {
    return !this.disposed && !this.inFlight;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.post({ type: "dispose" });
    } catch {
      // Termination below is the authoritative cleanup path.
    } finally {
      this.worker.terminate();
      this.inFlight = false;
    }
  }

  private post(message: PoseWorkerRequest, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }
}
