import { describe, expect, it } from "vitest";
import { selectPoseDelegate } from "../../src/vision/delegate";

describe("selectPoseDelegate", () => {
  it("uses GPU when either WebGL context is available", () => {
    expect(selectPoseDelegate(true, false)).toBe("GPU");
    expect(selectPoseDelegate(false, true)).toBe("GPU");
  });

  it("uses CPU when WebGL is unavailable", () => {
    expect(selectPoseDelegate(false, false)).toBe("CPU");
  });
});
