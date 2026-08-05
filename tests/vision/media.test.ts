import { describe, expect, it } from "vitest";
import { getLocalMediaKind } from "../../src/vision/media";

describe("getLocalMediaKind", () => {
  it("accepts video and image MIME types", () => {
    expect(getLocalMediaKind({ name: "clip.mp4", type: "video/mp4" })).toBe("video");
    expect(getLocalMediaKind({ name: "pose.png", type: "image/png" })).toBe("image");
  });

  it("falls back to a supported extension when the browser omits the MIME type", () => {
    expect(getLocalMediaKind({ name: "pose.jpeg", type: "" })).toBe("image");
    expect(getLocalMediaKind({ name: "clip.webm", type: "application/octet-stream" })).toBe(
      "video",
    );
  });

  it("rejects unsupported files", () => {
    expect(getLocalMediaKind({ name: "notes.txt", type: "text/plain" })).toBeNull();
  });
});
