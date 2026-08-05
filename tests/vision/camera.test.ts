import { describe, expect, it } from "vitest";
import { getCameraConstraints, isCompactCaptureViewport } from "../../src/vision/camera";

describe("camera capture constraints", () => {
  it("requests portrait-friendly capture on compact phone viewports", () => {
    expect(isCompactCaptureViewport({ width: 390, height: 844 })).toBe(true);
    expect(getCameraConstraints({ width: 390, height: 844 })).toMatchObject({
      audio: false,
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 720, min: 480 },
        height: { ideal: 1280, min: 480 },
        aspectRatio: { ideal: 9 / 16 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
  });

  it("keeps a landscape-friendly request for large desktop viewports", () => {
    expect(isCompactCaptureViewport({ width: 1440, height: 900 })).toBe(false);
    expect(getCameraConstraints({ width: 1440, height: 900 })).toMatchObject({
      video: {
        width: { ideal: 1280, min: 480 },
        height: { ideal: 720, min: 480 },
        aspectRatio: { ideal: 16 / 9 },
      },
    });
  });
});
