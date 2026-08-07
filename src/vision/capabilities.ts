import { probeWebglCapabilities } from "./delegate";

export interface BrowserCapabilities {
  secureContext: boolean;
  cameraApi: boolean;
  worker: boolean;
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
      worker: false,
      imageBitmap: false,
      webAssembly: false,
      webgl2: false,
      webgl: false,
      coarsePointer: false,
    };
  }
  const webgl = probeWebglCapabilities();
  return {
    secureContext:
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1",
    cameraApi: Boolean(navigator.mediaDevices?.getUserMedia),
    worker: typeof Worker !== "undefined",
    imageBitmap: typeof createImageBitmap === "function",
    webAssembly: typeof WebAssembly !== "undefined",
    webgl2: webgl.webgl2Available,
    webgl: webgl.webglAvailable,
    coarsePointer:
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
  };
}

export function hasLocalInferenceSupport(capabilities: BrowserCapabilities): boolean {
  return capabilities.worker && capabilities.imageBitmap && capabilities.webAssembly;
}
