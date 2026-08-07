import { describe, expect, it } from "vitest";
import {
  getCameraConstraints,
  getInferenceFrameDimensions,
  getPortraitFallbackVideoConstraints,
  getPortraitVideoConstraints,
  isCompactCaptureViewport,
  isPortraitFrame,
  PORTRAIT_CAMERA_ASPECT_RATIO,
} from "../../src/vision/camera";

describe("camera capture constraints", () => {
  it("classifies compact phone viewports", () => {
    expect(isCompactCaptureViewport({ width: 390, height: 844 })).toBe(true);
  });

  it("requests the same portrait stream on phone and desktop viewports", () => {
    expect(isCompactCaptureViewport({ width: 1440, height: 900 })).toBe(false);
    const expected = {
      facingMode: { ideal: "user" },
      width: { ideal: 720, min: 480, max: 1080 },
      height: { ideal: 1280, min: 480, max: 1920 },
      aspectRatio: { ideal: PORTRAIT_CAMERA_ASPECT_RATIO },
      frameRate: { ideal: 30, max: 30 },
    };
    expect(getCameraConstraints({ width: 390, height: 844 })).toMatchObject({
      audio: false,
      video: expected,
    });
    expect(getCameraConstraints({ width: 1440, height: 900 })).toMatchObject({
      audio: false,
      video: expected,
    });
    expect(getPortraitVideoConstraints()).toEqual(expected);
  });

  it("recognizes portrait and square source frames", () => {
    expect(isPortraitFrame(720, 1280)).toBe(true);
    expect(isPortraitFrame(720, 720)).toBe(true);
    expect(isPortraitFrame(1280, 720)).toBe(false);
  });

  it("keeps a lower-resolution fallback portrait-first", () => {
    expect(getPortraitFallbackVideoConstraints()).toEqual({
      facingMode: { ideal: "user" },
      width: { ideal: 480 },
      height: { ideal: 854 },
      aspectRatio: { ideal: PORTRAIT_CAMERA_ASPECT_RATIO },
      frameRate: { ideal: 24, max: 30 },
    });
  });

  it("caps inference frames without changing their aspect ratio", () => {
    expect(getInferenceFrameDimensions(1920, 1080)).toEqual({ width: 720, height: 405 });
    expect(getInferenceFrameDimensions(720, 1280)).toEqual({ width: 405, height: 720 });
    expect(getInferenceFrameDimensions(320, 180)).toEqual({ width: 320, height: 180 });
    expect(getInferenceFrameDimensions(0, 180)).toEqual({ width: 0, height: 0 });
  });
});
