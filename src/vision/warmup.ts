import type { PoseDetector } from "@tensorflow-models/pose-detection/dist/pose_detector";
import { MEASUREMENT_THRESHOLDS } from "../domain/measurement-registry";

export const POSE_WARMUP_FRAME = { width: 180, height: 320 } as const;

export function createOpaquePoseWarmupFrame(): ImageData {
  const { width, height } = POSE_WARMUP_FRAME;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 3; offset < pixels.length; offset += 4) pixels[offset] = 255;
  return new ImageData(pixels, width, height);
}

export async function warmTfjsPoseDetector(detector: PoseDetector): Promise<boolean> {
  try {
    await detector.estimatePoses(
      createOpaquePoseWarmupFrame(),
      {
        maxPoses: MEASUREMENT_THRESHOLDS.inference.maximumPoseCount,
        flipHorizontal: false,
      },
      0,
    );
    return true;
  } catch {
    // Warm-up is an optimization. Real frames remain the compatibility path.
    return false;
  }
}
