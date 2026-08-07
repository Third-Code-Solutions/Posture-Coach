import { describe, expect, it } from "vitest";
import { hasLocalInferenceSupport, hasWorkerInferenceSupport } from "../../src/vision/capabilities";

describe("browser capability gating", () => {
  it("keeps local inference available without worker Canvas2D", () => {
    const ready = {
      secureContext: true,
      cameraApi: true,
      worker: true,
      workerCanvas2d: true,
      imageBitmap: true,
      webAssembly: true,
      webgl2: true,
      webgl: true,
      coarsePointer: false,
    };
    expect(hasLocalInferenceSupport(ready)).toBe(true);
    expect(hasLocalInferenceSupport({ ...ready, imageBitmap: false })).toBe(false);
    expect(hasLocalInferenceSupport({ ...ready, worker: false })).toBe(true);
    expect(hasLocalInferenceSupport({ ...ready, webgl2: false, webgl: false })).toBe(true);
    expect(hasWorkerInferenceSupport(ready)).toBe(true);
    expect(hasWorkerInferenceSupport({ ...ready, workerCanvas2d: false })).toBe(false);
  });
});
