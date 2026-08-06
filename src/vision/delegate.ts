export type PoseDelegate = "GPU" | "CPU";

export interface WebglCapabilities {
  webgl2Available: boolean;
  webglAvailable: boolean;
}

export function selectPoseDelegate(
  webgl2Available: boolean,
  webglAvailable: boolean,
): PoseDelegate {
  return webgl2Available || webglAvailable ? "GPU" : "CPU";
}

export function probeWebglCapabilities(): WebglCapabilities {
  try {
    const canvas = (
      typeof document !== "undefined"
        ? document.createElement("canvas")
        : typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(1, 1)
          : null
    ) as { getContext: (contextId: "webgl2" | "webgl") => unknown } | null;
    if (!canvas) return { webgl2Available: false, webglAvailable: false };
    return {
      webgl2Available: canvas.getContext("webgl2") !== null,
      webglAvailable: canvas.getContext("webgl") !== null,
    };
  } catch {
    return { webgl2Available: false, webglAvailable: false };
  }
}
