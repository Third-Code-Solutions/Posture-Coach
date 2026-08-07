"use client";

import { useEffect, useState } from "react";
import { hasLocalInferenceSupport, readBrowserCapabilities } from "../../src/vision";
import type { BrowserCapabilities, CameraRuntimeInfo } from "../../src/vision";

function ReadinessRow({ label, detail, ready }: { label: string; detail: string; ready: boolean }) {
  return (
    <div className="readiness-row">
      <span className={`readiness-state ${ready ? "is-ready" : "is-warning"}`}>
        {ready ? "Ready" : "Check"}
      </span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

export function DeviceReadiness({
  cameraRuntime,
  cameraMuted,
}: {
  cameraRuntime: CameraRuntimeInfo | null;
  cameraMuted: boolean;
}) {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);

  useEffect(() => {
    setCapabilities(readBrowserCapabilities());
  }, []);

  return (
    <details className="device-readiness">
      <summary>Device readiness</summary>
      {!capabilities ? (
        <p className="readiness-loading" role="status">
          Checking this browser locally…
        </p>
      ) : (
        <div className="readiness-list">
          <ReadinessRow
            label="Secure camera access"
            detail={
              capabilities.secureContext
                ? "HTTPS or localhost detected"
                : "Use HTTPS or localhost for camera access"
            }
            ready={capabilities.secureContext}
          />
          <ReadinessRow
            label="Camera API"
            detail={
              capabilities.cameraApi
                ? "Webcam permission can be requested"
                : "No camera API; use a local video or image"
            }
            ready={capabilities.cameraApi}
          />
          <ReadinessRow
            label="Local pose engine"
            detail={
              hasLocalInferenceSupport(capabilities)
                ? "Worker, ImageBitmap, and WebAssembly available"
                : "Browser lacks one local inference capability"
            }
            ready={hasLocalInferenceSupport(capabilities)}
          />
          <ReadinessRow
            label="Acceleration"
            detail={
              capabilities.webgl2
                ? "WebGL2 GPU path available"
                : capabilities.webgl
                  ? "WebGL GPU path available"
                  : "WASM CPU fallback will be used"
            }
            ready={capabilities.webgl2 || capabilities.webgl || capabilities.webAssembly}
          />
          {cameraRuntime && (
            <ReadinessRow
              label="Live frame"
              detail={
                cameraMuted
                  ? "Camera track is paused; keep the tab visible or reconnect"
                  : `${cameraRuntime.rawWidth}×${cameraRuntime.rawHeight} source, ${cameraRuntime.effectiveWidth}×${cameraRuntime.effectiveHeight} effective${cameraRuntime.rotatedLocally ? ", rotated locally" : ""}${cameraRuntime.frameRate ? `, ${Math.round(cameraRuntime.frameRate)} fps` : ""}`
              }
              ready={!cameraMuted && cameraRuntime.effectiveHeight >= cameraRuntime.effectiveWidth}
            />
          )}
        </div>
      )}
      <p className="readiness-footnote">
        No account, payment, or upload. Camera frames, landmarks, and summaries stay in this tab.
      </p>
    </details>
  );
}
