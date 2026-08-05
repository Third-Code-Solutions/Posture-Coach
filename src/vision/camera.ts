export interface CaptureViewport {
  width: number;
  height: number;
}

export function isCompactCaptureViewport(viewport: CaptureViewport): boolean {
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : 0;
  const height = Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : 0;
  return Math.min(width, height) <= 700;
}

export function getCameraConstraints(viewport: CaptureViewport): MediaStreamConstraints {
  const compact = isCompactCaptureViewport(viewport);
  return {
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: compact ? 720 : 1280, min: 480 },
      height: { ideal: compact ? 1280 : 720, min: 480 },
      aspectRatio: { ideal: compact ? 9 / 16 : 16 / 9 },
      frameRate: { ideal: 24, max: 30 },
    },
  };
}
