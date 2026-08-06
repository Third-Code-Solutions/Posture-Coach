export interface CaptureViewport {
  width: number;
  height: number;
}

export const PORTRAIT_CAMERA_ASPECT_RATIO = 9 / 16;

export function isCompactCaptureViewport(viewport: CaptureViewport): boolean {
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : 0;
  const height = Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : 0;
  return Math.min(width, height) <= 700;
}

export function getPortraitVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: "user" },
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
export function getPortraitFallbackVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: "user" },
    width: { ideal: 480 },
    height: { ideal: 854 },
    aspectRatio: { ideal: PORTRAIT_CAMERA_ASPECT_RATIO },
    frameRate: { ideal: 24, max: 30 },
  };
}

export function getCameraConstraints(viewport: CaptureViewport): MediaStreamConstraints {
  void viewport;
  return {
    audio: false,
    video: getPortraitVideoConstraints(),
  };
}

export function isPortraitFrame(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height >= width;
}

export async function preferPortraitTrack(track: MediaStreamTrack): Promise<boolean> {
  try {
    await track.applyConstraints(getPortraitVideoConstraints());
    const settings = track.getSettings();
    return isPortraitFrame(settings.width ?? 0, settings.height ?? 0);
  } catch {
    // Some cameras expose fixed modes. The caller keeps the stream and applies
    // a local portrait transform when the device is compact and frames are
    // landscape.
    return false;
  }
}
