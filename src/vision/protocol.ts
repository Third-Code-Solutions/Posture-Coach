export interface RawPoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export type PoseWorkerRequest =
  | { type: "init"; webgl2Available: boolean; webglAvailable: boolean }
  | { type: "infer"; frame: ImageBitmap; timestampMs: number; sequence: number }
  | {
      type: "infer-pixels";
      pixels: Uint8ClampedArray<ArrayBuffer>;
      width: number;
      height: number;
      timestampMs: number;
      sequence: number;
    }
  | { type: "dispose" };

export type PoseWorkerResponse =
  | {
      type: "ready";
      model: "pose_landmarker_full" | "blazepose_tfjs_full";
      version: string;
    }
  | {
      type: "result";
      landmarks: RawPoseLandmark[];
      worldLandmarks: RawPoseLandmark[];
      timestampMs: number;
      sequence: number;
    }
  | {
      type: "error";
      code: "initialization" | "inference" | "transport" | "disposed";
      message: string;
      recoverable: boolean;
    };
