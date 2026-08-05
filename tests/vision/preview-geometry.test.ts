import { describe, expect, it } from "vitest";
import {
  getContainedPreviewGeometry,
  mapNormalizedPreviewPoint,
} from "../../components/overlay/preview-geometry";

describe("contained preview geometry", () => {
  it("keeps the full portrait source visible inside a phone preview", () => {
    const geometry = getContainedPreviewGeometry(320, 336, 720, 1280);

    expect(geometry.renderedWidth).toBeCloseTo(189);
    expect(geometry.renderedHeight).toBeCloseTo(336);
    expect(geometry.offsetX).toBeCloseTo(65.5);
    expect(geometry.offsetY).toBeCloseTo(0);
    expect(mapNormalizedPreviewPoint(0, 0, geometry, false)).toEqual({
      x: 65.5,
      y: 0,
    });
    expect(mapNormalizedPreviewPoint(1, 1, geometry, false)).toEqual({
      x: 254.5,
      y: 336,
    });
  });

  it("maps mirrored landscape landmarks into the contained frame", () => {
    const geometry = getContainedPreviewGeometry(680, 496, 1280, 720);
    const point = mapNormalizedPreviewPoint(0.2, 0.5, geometry, true);

    expect(geometry.renderedWidth).toBeCloseTo(680);
    expect(geometry.renderedHeight).toBeCloseTo(382.5);
    expect(geometry.offsetX).toBeCloseTo(0);
    expect(geometry.offsetY).toBeCloseTo(56.75);
    expect(point.x).toBeCloseTo(544);
    expect(point.y).toBeCloseTo(248);
  });
});
