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
    return true;
  } catch {
    // Some desktop webcams expose fixed landscape modes. The preview still
    // contains the complete source and the caller can continue without a crop.
    return false;
  }
}
