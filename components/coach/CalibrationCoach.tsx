import type {
  AnalysisMode,
  CalibrationBlocker,
  CalibrationProfile,
  CameraView,
} from "../../src/domain";
import { CALIBRATION_SAMPLE_TARGET, MODE_LABELS } from "../../src/domain";

interface CalibrationCoachProps {
  blocker: CalibrationBlocker | null;
  calibrating: boolean;
  calibration: CalibrationProfile;
  guidedSetupSeconds: number | null;
  mode: AnalysisMode;
  startDisabled?: boolean;
  view: CameraView;
  viewSupported: boolean;
  onCancel: () => void;
  onStart: () => void;
}

interface CalibrationCopy {
  title: string;
  body: string;
}

function selectedViewLabel(view: CameraView): string {
  if (view === "front") return "front-facing";
  if (view === "side") return "side profile";
  if (view === "three-quarter") return "three-quarter";
  return "selected";
}

export function calibrationBlockerCopy(
  blocker: CalibrationBlocker,
  mode: AnalysisMode,
  view: CameraView,
): CalibrationCopy {
  switch (blocker.code) {
    case "full_body_out_of_frame":
      return {
        title: "Show your full body",
        body: "Step farther back until your head, both heels, and both feet stay inside the guide.",
      };
    case "view_unclear":
      return {
        title: "Make the camera view clear",
        body: `Turn to the ${selectedViewLabel(view)} view and keep your shoulders and hips visible.`,
      };
    case "view_mismatch":
      return {
        title: "Match the selected view",
        body: `The pose looks ${selectedViewLabel(blocker.observedView ?? "unknown")}. Turn to ${selectedViewLabel(view)}, or change Camera view to match.`,
      };
    case "tracking_unstable":
      if (
        blocker.missingLandmarks?.some(
          (name) => name.endsWith("Ankle") || name.endsWith("Heel") || name.endsWith("FootIndex"),
        )
      ) {
        return {
          title: "Show your full body",
          body: "Step back until your head and both feet are visible, then hold still in even light.",
        };
      }
      return {
        title: "Help the camera find you",
        body:
          blocker.missingLandmarks && blocker.missingLandmarks.length > 0
            ? "Keep the required joints visible, improve the light, and avoid loose objects covering your outline."
            : "Hold still in even light while local tracking settles.",
      };
    case "start_position_unclear":
      return {
        title: "Return to the start position",
        body: `Settle into the relaxed starting position for ${MODE_LABELS[mode].toLowerCase()}, then hold it.`,
      };
    case "invalid_pose_geometry":
      return {
        title: "Move fully into the guide",
        body: "Keep one person visible with the torso and required joints separated clearly in the frame.",
      };
    case "hold_still":
      return {
        title: "Hold still a little longer",
        body: "The full sample window is visible, but it is still moving. Relax and keep the same position.",
      };
    case "context_changed":
      return {
        title: "Restart this baseline",
        body: "The mode, view, or mirror setting changed. Start calibration again with the current setup.",
      };
  }
}

function calibrationCopy({
  blocker,
  calibrating,
  calibration,
  guidedSetupSeconds,
  mode,
  view,
  viewSupported,
}: Omit<CalibrationCoachProps, "onCancel" | "onStart">): CalibrationCopy {
  if (!viewSupported) {
    return {
      title: "Choose a supported view",
      body: `${MODE_LABELS[mode]} cannot use this camera view. Select a supported view above.`,
    };
  }
  if (guidedSetupSeconds !== null) {
    return {
      title: `Get into position · ${guidedSetupSeconds}`,
      body: "Leave the controls, step into the guide, and settle naturally. No samples are taken yet.",
    };
  }
  if (calibration.stable) {
    return {
      title: "Calibration ready",
      body: "Your local baseline is set for this mode and camera view. Coaching can now begin.",
    };
  }
  if (calibrating && blocker) return calibrationBlockerCopy(blocker, mode, view);
  if (calibrating && calibration.sampleCount > 0) {
    return {
      title: `Hold still · ${calibration.sampleCount}/${CALIBRATION_SAMPLE_TARGET}`,
      body: "Good framing. Keep the same relaxed position while the remaining samples are collected.",
    };
  }
  if (calibrating) {
    return {
      title: "Finding your pose",
      body: "Keep one person centered in the guide while local tracking checks the frame.",
    };
  }
  return {
    title: "Set your baseline",
    body: "Start once your whole body is visible. Hold a relaxed position; calibration is not a posture grade.",
  };
}

export function CalibrationCoach(props: CalibrationCoachProps) {
  const copy = calibrationCopy(props);
  const progress = props.calibration.stable
    ? CALIBRATION_SAMPLE_TARGET
    : props.calibration.sampleCount;
  const actionLabel = props.startDisabled
    ? "Preparing video…"
    : props.calibrating
      ? "Cancel calibration"
      : props.guidedSetupSeconds !== null
        ? `Calibrate now · ${props.guidedSetupSeconds}s`
        : props.calibration.stable
          ? "Recalibrate"
          : "Start calibration";

  return (
    <section
      className={`calibration-coach ${props.calibration.stable ? "is-ready" : ""} ${props.calibrating ? "is-active" : ""}`}
      role="status"
      aria-label="Calibration coach"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="calibration-coach-heading">
        <span className="control-label">Baseline setup</span>
        <span className="calibration-count" aria-hidden="true">
          {progress}/{CALIBRATION_SAMPLE_TARGET}
        </span>
      </div>
      <strong className="calibration-title">{copy.title}</strong>
      <p>{copy.body}</p>
      <progress
        className="calibration-progress"
        aria-label="Calibration progress"
        aria-valuemax={CALIBRATION_SAMPLE_TARGET}
        aria-valuemin={0}
        aria-valuenow={progress}
        aria-valuetext={
          props.calibration.stable
            ? "Baseline ready"
            : `${progress} of ${CALIBRATION_SAMPLE_TARGET} stable frames accepted`
        }
        max={CALIBRATION_SAMPLE_TARGET}
        value={progress}
      >
        {progress}/{CALIBRATION_SAMPLE_TARGET}
      </progress>
      <div className="calibration-steps" aria-label="Calibration steps">
        <span
          className={props.calibrating || props.calibration.stable ? "is-complete" : "is-current"}
        >
          <b>1</b> Frame
        </span>
        <span
          className={
            props.calibration.stable ? "is-complete" : props.calibrating ? "is-current" : ""
          }
        >
          <b>2</b> Hold
        </span>
        <span className={props.calibration.stable ? "is-current" : ""}>
          <b>3</b> Coach
        </span>
      </div>
      <button
        className={props.calibrating ? "button-secondary" : "button-primary"}
        type="button"
        onClick={props.calibrating ? props.onCancel : props.onStart}
        disabled={!props.viewSupported || (!props.calibrating && props.startDisabled)}
      >
        {actionLabel}
      </button>
    </section>
  );
}
