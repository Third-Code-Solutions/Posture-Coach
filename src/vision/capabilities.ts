import { probeWebglCapabilities } from "./delegate";

export interface BrowserCapabilities {
  secureContext: boolean;
  cameraApi: boolean;
  screenWakeLock: boolean;
  worker: boolean;
  workerCanvas2d: boolean;
  imageBitmap: boolean;
  webAssembly: boolean;
  webgl2: boolean;
  webgl: boolean;
  coarsePointer: boolean;
}

export function readBrowserCapabilities(): BrowserCapabilities {
  if (typeof window === "undefined") {
    return {
      secureContext: false,
      cameraApi: false,
      screenWakeLock: false,
      worker: false,
      workerCanvas2d: false,
      imageBitmap: false,
      webAssembly: false,
      webgl2: false,
      webgl: false,
      coarsePointer: false,
    };
  }
  const webgl = probeWebglCapabilities();
  const workerCanvas2d = supportsWorkerCanvas2d();
  return {
    secureContext:
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1",
    cameraApi: Boolean(navigator.mediaDevices?.getUserMedia),
    screenWakeLock: "wakeLock" in navigator,
    worker: typeof Worker !== "undefined",
    workerCanvas2d,
    imageBitmap: typeof createImageBitmap === "function",
    webAssembly: typeof WebAssembly !== "undefined",
    webgl2: webgl.webgl2Available,
    webgl: webgl.webglAvailable,
    coarsePointer:
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
  };
}

export function hasLocalInferenceSupport(capabilities: BrowserCapabilities): boolean {
  return capabilities.imageBitmap && capabilities.webAssembly;
}

export function hasWorkerInferenceSupport(capabilities: BrowserCapabilities): boolean {
  return capabilities.worker && capabilities.workerCanvas2d;
}

export function supportsWorkerCanvas2d(): boolean {
  try {
    return (
      typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null
    );
  } catch {
    return false;
  }
}
