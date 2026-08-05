export interface RawPoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export type PoseWorkerRequest =
  | { type: "init" }
  | { type: "infer"; frame: ImageBitmap; timestampMs: number; sequence: number }
  | { type: "dispose" };

export type PoseWorkerResponse =
  | { type: "ready"; model: "pose_landmarker_full"; version: string }
  | {
      type: "result";
      landmarks: RawPoseLandmark[];
      worldLandmarks: RawPoseLandmark[];
      timestampMs: number;
      sequence: number;
    }
  | {
      type: "error";
      code: "initialization" | "inference" | "disposed";
      message: string;
      recoverable: boolean;
    };
