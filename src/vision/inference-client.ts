import type { PoseWorkerResponse } from "./protocol";

export interface PoseInferenceClientOptions {
  onMessage: (message: PoseWorkerResponse) => void;
}

export interface PoseInferenceClient {
  init(): void;
  submit(frame: ImageBitmap, timestampMs: number, sequence: number): boolean;
  canAcceptFrame(): boolean;
  dispose(): void;
}
