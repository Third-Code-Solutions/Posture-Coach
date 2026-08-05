import type {
  AnalysisMode,
  ConfidenceAssessment,
  FrameObservation,
  Landmark,
  LandmarkName,
} from "../contracts";
import {
  isObservedViewCompatible,
  isViewSupported,
  MIN_OBSERVED_VIEW_CONFIDENCE,
  REQUIRED_LANDMARKS,
} from "../contracts";
import { averageVisibility } from "../geometry";

const MIN_LANDMARK_SCORE = 0.58;
const MIN_POSE_SCORE = 0.5;

function isFiniteLandmark(landmark: Landmark | undefined): landmark is Landmark {
  if (!landmark) return false;
  return (
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y) &&
    Number.isFinite(landmark.z) &&
    Number.isFinite(landmark.visibility) &&
    Number.isFinite(landmark.presence)
  );
}

export function assessConfidence(
  observation: FrameObservation,
  mode: AnalysisMode,
): ConfidenceAssessment {
  const required = REQUIRED_LANDMARKS[mode];
  const missing: LandmarkName[] = [];
  const usable = required.map((name) => observation.landmarks[name]).filter(isFiniteLandmark);
  for (const name of required) {
    const landmark = observation.landmarks[name];
    if (
      !isFiniteLandmark(landmark) ||
      Math.min(landmark.visibility, landmark.presence) < MIN_LANDMARK_SCORE
    ) {
      missing.push(name);
    }
  }

  const poseConfidence = Number.isFinite(observation.poseConfidence)
    ? Math.max(0, Math.min(1, observation.poseConfidence))
    : 0;
  const score = Math.min(poseConfidence, averageVisibility(usable));
  const reasons: Array<ConfidenceAssessment["reasons"][number]> = [];
  if (missing.length > 0) reasons.push("missing_landmarks", "low_visibility");
  if (poseConfidence < MIN_POSE_SCORE) reasons.push("unstable_tracking");
  if (!isViewSupported(mode, observation.cameraView)) reasons.push("unsupported_view");
  const viewIsUnverified =
    observation.viewConfidence < MIN_OBSERVED_VIEW_CONFIDENCE ||
    observation.observedView === "unknown";
  const viewMismatches =
    !viewIsUnverified &&
    !isObservedViewCompatible(mode, observation.cameraView, observation.observedView);
  if (viewMismatches) reasons.push("observed_view_mismatch");
  else if (viewIsUnverified && isViewSupported(mode, observation.cameraView))
    reasons.push("unverified_view");
  if (observation.mirroredPreview && observation.cameraView === "unknown")
    reasons.push("mirror_unresolved");

  let state: ConfidenceAssessment["state"] = "high";
  if (!isViewSupported(mode, observation.cameraView)) state = "unsupported";
  else if (viewMismatches) state = "unsupported";
  else if (missing.length > 0 || score < MIN_LANDMARK_SCORE) state = "insufficient";
  else if (viewIsUnverified) state = "insufficient";
  else if (score < 0.82) state = "usable";

  return { state, score, required, missing, reasons: [...new Set(reasons)] };
}
