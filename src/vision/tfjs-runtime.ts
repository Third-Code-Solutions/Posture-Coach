import type { Pose } from "@tensorflow-models/pose-detection/dist/types";
import type { PoseDetector } from "@tensorflow-models/pose-detection/dist/pose_detector";
import type { RawPoseLandmark } from "./protocol";

export interface SerializedTfjsPose {
  landmarks: RawPoseLandmark[];
  worldLandmarks: RawPoseLandmark[];
}

export async function createTfjsPoseDetector(assetOrigin: string): Promise<PoseDetector> {
  const [tf, wasm, detectorModule] = await Promise.all([
    import("@tensorflow/tfjs-core"),
    import("@tensorflow/tfjs-backend-wasm"),
    import("@tensorflow-models/pose-detection/dist/blazepose_tfjs/detector"),
  ]);
  wasm.setWasmPaths(new URL("/tfjs-wasm/", assetOrigin).href);
  if (!(await tf.setBackend("wasm"))) {
    throw new Error("The local WASM pose runtime could not start.");
  }
  await tf.ready();
  return detectorModule.load({
    runtime: "tfjs",
    modelType: "full",
    enableSmoothing: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    detectorModelUrl: "/models/blazepose-tfjs/detector/model.json",
    landmarkModelUrl: "/models/blazepose-tfjs/landmark-full/model.json",
  });
}

function toLandmark(
  point: Pose["keypoints"][number],
  width: number,
  height: number,
  poseScore: number,
  world: boolean,
): RawPoseLandmark {
  const visibility = point.score ?? poseScore;
  return {
    x: world ? point.x : point.x / width,
    y: world ? point.y : point.y / height,
    z: world ? (point.z ?? 0) : (point.z ?? 0) / width,
    visibility,
    presence: visibility,
  };
}

export function serializeTfjsPose(
  pose: Pose | undefined,
  width: number,
  height: number,
): SerializedTfjsPose {
  const poseScore = pose?.score ?? 0;
  return {
    landmarks: pose
      ? pose.keypoints.map((point) => toLandmark(point, width, height, poseScore, false))
      : [],
    worldLandmarks: pose?.keypoints3D
      ? pose.keypoints3D.map((point) => toLandmark(point, width, height, poseScore, true))
      : [],
  };
}
