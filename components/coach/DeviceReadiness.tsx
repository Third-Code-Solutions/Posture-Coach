"use client";

import { useEffect, useState } from "react";
import {
  hasLocalInferenceSupport,
  hasWorkerInferenceSupport,
  readBrowserCapabilities,
} from "../../src/vision";
import type { BrowserCapabilities, CameraRuntimeInfo } from "../../src/vision";
import type { WakeLockState } from "../../src/browser-session";

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
  wakeLockState,
}: {
  cameraRuntime: CameraRuntimeInfo | null;
  cameraMuted: boolean;
  wakeLockState: WakeLockState;
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
                ? hasWorkerInferenceSupport(capabilities)
                  ? "Dedicated worker, ImageBitmap, and WebAssembly available"
                  : "Local WASM compatibility path available"
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
          <ReadinessRow
            label="Hands-free display"
            detail={
              !capabilities.screenWakeLock || wakeLockState === "unsupported"
                ? "Wake lock unavailable; increase the device sleep timeout"
                : wakeLockState === "active"
                  ? "Screen wake lock active for this live session"
                  : wakeLockState === "released"
                    ? "System released the wake lock; keep the screen awake manually"
                    : wakeLockState === "blocked"
                      ? "Battery or browser settings declined the wake lock"
                      : "Screen wake lock available when a live session starts"
            }
            ready={
              capabilities.screenWakeLock &&
              wakeLockState !== "unsupported" &&
              wakeLockState !== "released" &&
              wakeLockState !== "blocked"
            }
          />
          {cameraRuntime && (
            <ReadinessRow
              label="Live frame"
              detail={
                cameraMuted
                  ? "Camera track is paused; keep the tab visible or reconnect"
                  : `${cameraRuntime.facingMode === "environment" ? "Rear" : cameraRuntime.facingMode === "user" ? "Front" : "Selected"} camera, ${cameraRuntime.rawWidth}×${cameraRuntime.rawHeight} source, ${cameraRuntime.effectiveWidth}×${cameraRuntime.effectiveHeight} effective${cameraRuntime.rotatedLocally ? ", rotated locally" : ""}${cameraRuntime.frameRate ? `, ${Math.round(cameraRuntime.frameRate)} fps` : ""}`
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
