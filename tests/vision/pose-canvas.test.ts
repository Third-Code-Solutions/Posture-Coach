import { describe, expect, it } from "vitest";
import { isOverlayLandmarkVisible } from "../../components/overlay/PoseCanvas";
import { MEASUREMENT_THRESHOLDS } from "../../src/domain";

describe("pose overlay confidence gate", () => {
  it("uses the shared registry boundary", () => {
    const threshold = MEASUREMENT_THRESHOLDS.confidence.minimumOverlayLandmarkScore;
    const landmark = { x: 0.5, y: 0.5, z: 0, visibility: threshold, presence: threshold };

    expect(isOverlayLandmarkVisible(landmark)).toBe(true);
    expect(isOverlayLandmarkVisible({ ...landmark, presence: threshold - 0.001 })).toBe(false);
  });
});
