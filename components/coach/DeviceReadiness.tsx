"use client";

import { useEffect, useState } from "react";
import {
  hasLocalInferenceSupport,
  readBrowserCapabilities,
  selectPoseInferenceRoute,
} from "../../src/vision";
import type { BrowserCapabilities, CameraRuntimeInfo, FrameDimensions } from "../../src/vision";
import type { DeviceDiagnosticReport } from "../../src/vision";
import type { InferenceQualityProfile } from "../../src/vision";
import type { WakeLockState } from "../../src/browser-session";
import { MEASUREMENT_THRESHOLDS } from "../../src/domain";

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
  cameraSessionActive,
  cameraMuted,
  inferenceFrameSize,
  inferenceQuality,
  trackingLatencyMs,
  wakeLockState,
  createDeviceReport,
  resetDeviceReport,
}: {
  cameraRuntime: CameraRuntimeInfo | null;
  cameraSessionActive: boolean;
  cameraMuted: boolean;
  inferenceFrameSize: FrameDimensions | null;
  inferenceQuality: InferenceQualityProfile;
  trackingLatencyMs: number | null;
  wakeLockState: WakeLockState;
  createDeviceReport: () => DeviceDiagnosticReport;
  resetDeviceReport: () => void;
}) {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    setCapabilities(readBrowserCapabilities());
  }, []);

  const downloadDeviceReport = () => {
    try {
      const report = createDeviceReport();
      const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `third-code-posture-device-report-${report.generatedAt.replaceAll(":", "-").replaceAll(".", "-")}.json`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setReportStatus("Device report downloaded locally. Nothing was uploaded.");
    } catch {
      setReportStatus("The browser could not download the report. Try again after reloading.");
    }
  };

  const resetReport = () => {
    resetDeviceReport();
    setReportStatus("Device check reset. Start the camera to collect a new local sample.");
  };

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
                ? selectPoseInferenceRoute(capabilities) === "worker-bitmap"
                  ? "Dedicated worker, ImageBitmap, and WebAssembly available"
                  : selectPoseInferenceRoute(capabilities) === "worker-pixels"
                    ? "Dedicated worker, transferable pixel bridge, and WebAssembly available"
                    : "Local main-thread WASM compatibility path available"
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
            label="Adaptive inference"
            detail={`${inferenceQuality.label} profile, up to ${inferenceQuality.maxDimension}px local input${inferenceFrameSize ? `, current ${inferenceFrameSize.width}×${inferenceFrameSize.height}` : ""}${trackingLatencyMs === null ? "; adjusts only after sustained latency" : `, ${trackingLatencyMs}ms last local pipeline`}`}
            ready={
              trackingLatencyMs === null ||
              trackingLatencyMs < MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs
            }
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
      <section className="device-report" aria-labelledby="device-report-title">
        <h3 id="device-report-title">Physical phone check</h3>
        <p>
          Start the front camera, wait for live tracking, keep your head and feet visible, switch to
          the rear camera, then stop. Download the local report after the run.
        </p>
        <div className="device-report-actions">
          <button
            className="button-secondary"
            type="button"
            onClick={downloadDeviceReport}
            disabled={cameraSessionActive}
            title={
              cameraSessionActive
                ? "Stop the active camera before downloading this report."
                : undefined
            }
          >
            Download device report
          </button>
          <button
            className="device-report-reset"
            type="button"
            onClick={resetReport}
            disabled={cameraSessionActive}
            title={
              cameraSessionActive
                ? "Stop the active camera before resetting this check."
                : undefined
            }
          >
            Reset check
          </button>
        </div>
        {reportStatus && (
          <p className="device-report-status" role="status" aria-live="polite">
            {reportStatus}
          </p>
        )}
      </section>
      <p className="readiness-footnote">
        No account, payment, or upload. Camera frames, landmarks, and summaries stay in this tab.
      </p>
    </details>
  );
}
