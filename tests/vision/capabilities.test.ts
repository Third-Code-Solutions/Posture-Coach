import { describe, expect, it } from "vitest";
import { hasLocalInferenceSupport } from "../../src/vision/capabilities";

describe("browser capability gating", () => {
  it("requires worker, ImageBitmap, and WebAssembly for local inference", () => {
    const ready = {
      secureContext: true,
      cameraApi: true,
      worker: true,
      imageBitmap: true,
      webAssembly: true,
      webgl2: true,
      webgl: true,
      coarsePointer: false,
    };
    expect(hasLocalInferenceSupport(ready)).toBe(true);
    expect(hasLocalInferenceSupport({ ...ready, imageBitmap: false })).toBe(false);
    expect(hasLocalInferenceSupport({ ...ready, worker: false })).toBe(false);
    expect(hasLocalInferenceSupport({ ...ready, webgl2: false, webgl: false })).toBe(true);
  });
});
