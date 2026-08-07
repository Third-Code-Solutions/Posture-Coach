import type { PoseWorkerRequest, PoseWorkerResponse } from "./protocol";
import { probeWebglCapabilities } from "./delegate";
import type { PoseInferenceClient, PoseInferenceClientOptions } from "./inference-client";

export type WorkerFrameTransport = "bitmap" | "pixels";

export interface PoseWorkerClientOptions extends PoseInferenceClientOptions {
  frameTransport?: WorkerFrameTransport;
}

export class PoseWorkerClient implements PoseInferenceClient {
  private readonly worker: Worker;
  private readonly frameTransport: WorkerFrameTransport;
  private inFlight = false;
  private disposed = false;
  private frameCanvas: HTMLCanvasElement | null = null;

  constructor(options: PoseWorkerClientOptions) {
    this.frameTransport = options.frameTransport ?? "bitmap";
    this.worker = new Worker(new URL("./pose.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      if (event.data.type === "result" || event.data.type === "error") this.inFlight = false;
      options.onMessage(event.data);
    };
    this.worker.onerror = (event) => {
      this.inFlight = false;
      event.preventDefault();
      options.onMessage({
        type: "error",
        code: "transport",
        message: event.message || "Pose worker crashed.",
        recoverable: true,
      });
    };
    this.worker.onmessageerror = () => {
      this.inFlight = false;
      options.onMessage({
        type: "error",
        code: "transport",
        message: "Pose worker communication failed.",
        recoverable: true,
      });
    };
  }

  init(): void {
    const capabilities =
      this.frameTransport === "bitmap"
        ? probeWebglCapabilities()
        : { webgl2Available: false, webglAvailable: false };
    this.post({ type: "init", ...capabilities });
  }

  submit(frame: ImageBitmap, timestampMs: number, sequence: number): boolean {
    if (this.disposed || this.inFlight) {
      frame.close();
      return false;
    }
    this.inFlight = true;
    try {
      if (this.frameTransport === "bitmap") {
        this.post({ type: "infer", frame, timestampMs, sequence }, [frame]);
      } else {
        const image = this.readPixels(frame);
        this.post(
          {
            type: "infer-pixels",
            pixels: image.data,
            width: image.width,
            height: image.height,
            timestampMs,
            sequence,
          },
          [image.data.buffer],
        );
        frame.close();
      }
    } catch (error) {
      this.inFlight = false;
      throw error instanceof Error
        ? error
        : new Error("The browser could not transfer a local pose frame.");
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
      if (this.frameCanvas) {
        this.frameCanvas.width = 0;
        this.frameCanvas.height = 0;
        this.frameCanvas = null;
      }
      this.inFlight = false;
    }
  }

  private post(message: PoseWorkerRequest, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }

  private readPixels(frame: ImageBitmap): ImageData {
    if (frame.width <= 0 || frame.height <= 0) {
      throw new Error("Pose frame has no usable pixels.");
    }
    const canvas = this.frameCanvas ?? document.createElement("canvas");
    this.frameCanvas = canvas;
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width;
      canvas.height = frame.height;
    }
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) throw new Error("The browser could not create a pixel-transfer canvas.");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(frame, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }
}
