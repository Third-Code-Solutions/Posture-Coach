export interface ContainedPreviewGeometry {
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
}

export function getContainedPreviewGeometry(
  containerWidth: number,
  containerHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): ContainedPreviewGeometry {
  const safeContainerWidth = Math.max(0, containerWidth);
  const safeContainerHeight = Math.max(0, containerHeight);
  const safeSourceWidth = sourceWidth > 0 ? sourceWidth : safeContainerWidth;
  const safeSourceHeight = sourceHeight > 0 ? sourceHeight : safeContainerHeight;

  if (safeSourceWidth <= 0 || safeSourceHeight <= 0) {
    return {
      renderedWidth: safeContainerWidth,
      renderedHeight: safeContainerHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const scale = Math.min(
    safeContainerWidth / safeSourceWidth,
    safeContainerHeight / safeSourceHeight,
  );
  const renderedWidth = safeSourceWidth * scale;
  const renderedHeight = safeSourceHeight * scale;

  return {
    renderedWidth,
    renderedHeight,
    offsetX: (safeContainerWidth - renderedWidth) / 2,
    offsetY: (safeContainerHeight - renderedHeight) / 2,
  };
}

export function mapNormalizedPreviewPoint(
  x: number,
  y: number,
  geometry: ContainedPreviewGeometry,
  mirrored: boolean,
): { x: number; y: number } {
  return {
    x: (mirrored ? 1 - x : x) * geometry.renderedWidth + geometry.offsetX,
    y: y * geometry.renderedHeight + geometry.offsetY,
  };
}
