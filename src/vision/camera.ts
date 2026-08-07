import { MEASUREMENT_THRESHOLDS } from "../domain/measurement-registry";

export interface CaptureViewport {
  width: number;
  height: number;
}

export type CameraFacingMode = "user" | "environment";

export const PORTRAIT_CAMERA_ASPECT_RATIO = 9 / 16;
export const MAX_INFERENCE_FRAME_DIMENSION = MEASUREMENT_THRESHOLDS.inference.detailFrameDimension;

export interface FrameDimensions {
  width: number;
  height: number;
}

export interface CameraRuntimeInfo {
  rawWidth: number;
  rawHeight: number;
  effectiveWidth: number;
  effectiveHeight: number;
  rotatedLocally: boolean;
  facingMode: string | null;
  frameRate: number | null;
}

export function isCompactCaptureViewport(viewport: CaptureViewport): boolean {
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : 0;
  const height = Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : 0;
  return Math.min(width, height) <= 700;
}

export function getPortraitVideoConstraints(
  facingMode: CameraFacingMode = "user",
): MediaTrackConstraints {
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: 720, min: 480, max: 1080 },
    height: { ideal: 1280, min: 480, max: 1920 },
    aspectRatio: { ideal: PORTRAIT_CAMERA_ASPECT_RATIO },
    frameRate: { ideal: 30, max: 30 },
  };
}

/**
 * Lower-pressure portrait constraints for mobile browsers that reject the
 * preferred resolution. The app still applies a local rotation when the
 * browser returns landscape frames, so this fallback must keep portrait as an
 * explicit preference instead of dropping to an unconstrained stream.
 */
export function getPortraitFallbackVideoConstraints(
  facingMode: CameraFacingMode = "user",
): MediaTrackConstraints {
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: 480 },
    height: { ideal: 854 },
    aspectRatio: { ideal: PORTRAIT_CAMERA_ASPECT_RATIO },
    frameRate: { ideal: 24, max: 30 },
  };
}

export function getCameraConstraints(
  viewport: CaptureViewport,
  facingMode: CameraFacingMode = "user",
): MediaStreamConstraints {
  void viewport;
  return {
    audio: false,
    video: getPortraitVideoConstraints(facingMode),
  };
}

export function isPortraitFrame(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height >= width;
}

export function getInferenceFrameDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_INFERENCE_FRAME_DIMENSION,
): FrameDimensions {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maxDimension) ||
    maxDimension <= 0
  ) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function preferPortraitTrack(
  track: MediaStreamTrack,
  facingMode: CameraFacingMode = "user",
): Promise<boolean> {
  try {
    await track.applyConstraints(getPortraitVideoConstraints(facingMode));
    const settings = track.getSettings();
    return isPortraitFrame(settings.width ?? 0, settings.height ?? 0);
  } catch {
    // Some cameras expose fixed modes. The caller keeps the stream and applies
    // a local portrait transform when the device is compact and frames are
    // landscape.
    return false;
  }
}
