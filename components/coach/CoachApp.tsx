"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackCard } from "../feedback/FeedbackCard";
import { ModeSelector } from "../controls/ModeSelector";
import { DeviceReadiness } from "./DeviceReadiness";
import { PoseCanvas } from "../overlay/PoseCanvas";
import {
  AnalysisMode,
  CameraView,
  CALIBRATION_SAMPLE_TARGET,
  CalibrationProfile,
  CalibrationWindow,
  EvaluationResult,
  FeedbackMessage,
  FrameObservation,
  MODE_LABELS,
  PostureEngine,
  RejectionReason,
  SessionSummary,
  SessionTracker,
  LandmarkSmoother,
  createCalibrationProfile,
  isObservedViewCompatible,
  isViewSupported,
  MIN_OBSERVED_VIEW_CONFIDENCE,
} from "../../src/domain";
import {
  type CameraFacingMode,
  type CameraRuntimeInfo,
  createObservation,
  getCameraConstraints,
  getInferenceFrameDimensions,
  getPortraitFallbackVideoConstraints,
  hasWorkerInferenceSupport,
  getLocalMediaKind,
  isCompactCaptureViewport,
  isPortraitFrame,
  preferPortraitTrack,
  PoseInferenceClient,
  PoseMainThreadClient,
  PoseWorkerClient,
  PoseWorkerResponse,
  readBrowserCapabilities,
} from "../../src/vision";
import { evidenceIdsForIssue } from "../../src/knowledge";

type SourceState = "idle" | "requesting" | "active" | "loading" | "complete" | "error";
type SourceKind = "camera" | "upload" | "image";
type VideoSourceToken = { kind: "camera"; stream: MediaStream } | { kind: "upload"; url: string };
type ImageSourceToken = { kind: "image"; url: string };
type SourceToken = VideoSourceToken | ImageSourceToken;
type ImageStatus = "loading" | "ready" | "no-pose";

const initialFeedback: FeedbackMessage = {
  id: "calibrate",
  priority: 100,
  tone: "guide",
  title: "Calibrate before coaching",
  body: "Choose a source, get your full body in a portrait frame, settle into a comfortable position, then hold still for a moment. Advice stays paused until the evidence is steady.",
};

function imageFeedback(status: ImageStatus | null): FeedbackMessage {
  if (status === "ready") {
    return {
      id: "image-ready",
      priority: 60,
      tone: "positive",
      title: "Pose found in this image",
      body: "The landmark overlay is local to this tab. Still images show pose evidence only; use a webcam or video for movement coaching.",
    };
  }
  if (status === "no-pose") {
    return {
      id: "image-no-pose",
      priority: 100,
      tone: "guide",
      title: "No clear pose found",
      body: "Try a brighter image with one full body visible. The image stayed on this device and was not uploaded.",
    };
  }
  return {
    id: "image-loading",
    priority: 80,
    tone: "guide",
    title: "Analyzing this image",
    body: "Pose landmarks are being detected locally. The image stays in this tab and is not uploaded.",
  };
}

const iconShield = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6l8-3Z" />
    <path d="m8.8 12 2.1 2.1 4.5-4.5" />
  </svg>
);

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function confidenceLabel(result: EvaluationResult | null): string {
  if (!result) return "Waiting";
  if (result.status !== "valid") return "Paused";
  return result.confidence.state === "high" ? "Clear" : "Usable";
}

function cameraGuidance(mode: AnalysisMode, view: CameraView): string {
  if (view === "unknown") {
    return "Choose side or front view, place the camera at about hip height, and keep your full body visible.";
  }
  if ((mode === "plank" || mode === "pushup") && view !== "side") {
    return "Side profile required: place the camera at hip height, far enough back to keep your full body and hands or feet visible.";
  }
  if (view === "three-quarter") {
    if (mode === "standing") {
      return "Portrait three-quarter view: turn slightly toward the camera, keep your head and both feet visible with a little margin, and stand relaxed.";
    }
    return "Three-quarter view: turn slightly toward the camera, place it at hip or shoulder height, and keep both shoulders, hips, and the active joints visible.";
  }
  if (mode === "standing") {
    return view === "side"
      ? "Portrait side profile: place the phone at hip height, far enough back to show your head and both feet with a little margin, then stand relaxed."
      : "Portrait front view: place the phone level at hip height, far enough back to show your head and both feet, and let your arms hang naturally.";
  }
  if (mode === "desk") {
    return view === "side"
      ? "Side profile: place the camera at shoulder height, about one arm-length away, with your ear, shoulder, hip, and knee visible."
      : "Front view: place the camera at shoulder height and keep both shoulders and hips visible without cropping.";
  }
  return view === "side"
    ? "Side profile: place the camera at hip height, far enough back to keep your full body and hands or feet visible."
    : "Front view: place the camera at hip height and keep both sides of your body visible with even light.";
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
    };
    const handleLoadedMetadata = () => {
      cleanup();
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
      } else {
        reject(new Error("Video metadata did not include a usable frame size."));
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video metadata could not be loaded."));
    };
    video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function unsupportedViewFeedback(mode: AnalysisMode, view: CameraView): FeedbackMessage {
  const requiredView =
    mode === "plank" || mode === "pushup" ? "side profile" : "a front, side, or three-quarter view";
  return {
    id: `unsupported-view-${mode}-${view}`,
    priority: 100,
    tone: "guide",
    title: "Set your view",
    body: `${MODE_LABELS[mode]} needs ${requiredView}. Choose a supported camera view before calibrating.`,
    evidenceIds: evidenceIdsForIssue("positioning"),
  };
}

function summaryQuality(summary: SessionSummary): { label: string; body: string } {
  const percentage = Math.round(summary.evidenceCoverage * 100);
  if (summary.evidenceCoverage >= 0.75) {
    return {
      label: "Steady evidence",
      body: `${percentage}% of analyzed frames met the evidence gate. Use that signal to guide practice, not to make a clinical judgment.`,
    };
  }
  if (summary.evidenceCoverage >= 0.45) {
    return {
      label: "Mixed evidence",
      body: `${percentage}% of analyzed frames met the evidence gate. Improve lighting, distance, or camera angle before relying on cues.`,
    };
  }
  return {
    label: "Paused evidence",
    body: `${percentage}% of analyzed frames met the evidence gate. The session stayed cautious because the pose was not consistently visible.`,
  };
}

const REJECTION_LABELS: Record<RejectionReason, string> = {
  insufficient_evidence: "insufficient evidence",
  range_not_reached: "range not reached",
  alignment_not_stable: "alignment not stable",
  phase_interrupted: "phase interrupted",
  unsupported_view: "unsupported view",
};

function rejectionReasonsCopy(summary: SessionSummary): string | null {
  const entries = Object.entries(summary.rejectedRepReasons) as Array<[RejectionReason, number]>;
  if (entries.length === 0) return null;
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => `${REJECTION_LABELS[reason]}: ${count}`)
    .join(" · ");
}

export function CoachApp() {
  const [mode, setMode] = useState<AnalysisMode>("standing");
  const [view, setView] = useState<CameraView>("side");
  const [mirrored, setMirrored] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<CameraFacingMode>("user");
  const [sourceState, setSourceState] = useState<SourceState>("idle");
  const [sourceKind, setSourceKind] = useState<SourceKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workerLabel, setWorkerLabel] = useState("Local pose engine ready on demand");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [landmarks, setLandmarks] = useState<FrameObservation["landmarks"] | null>(null);
  const [calibration, setCalibration] = useState<CalibrationProfile>(() =>
    createCalibrationProfile("standing", "side", true),
  );
  const [calibrating, setCalibrating] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [imageStatus, setImageStatus] = useState<ImageStatus | null>(null);
  const [portraitCapture, setPortraitCapture] = useState<boolean | null>(null);
  const [portraitTransformActive, setPortraitTransformActive] = useState(false);
  const [cameraRuntime, setCameraRuntime] = useState<CameraRuntimeInfo | null>(null);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [trackingLatencyMs, setTrackingLatencyMs] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const workerRef = useRef<PoseInferenceClient | null>(null);
  const engineRef = useRef(new PostureEngine());
  const calibrationRef = useRef<CalibrationWindow | null>(null);
  const animationRef = useRef<number | null>(null);
  const videoFrameCallbackRef = useRef<number | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const portraitPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const portraitTransformRef = useRef(false);
  const cameraTrackSettingsRef = useRef<MediaTrackSettings | null>(null);
  const directBitmapSupportRef = useRef<{ video: boolean | null; image: boolean | null }>({
    video: null,
    image: null,
  });
  const frameCaptureFailureRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastSubmittedTimestampRef = useRef(-1);
  const sequenceRef = useRef(0);
  const sessionStartedRef = useRef<number | null>(null);
  const sourceKindRef = useRef<SourceKind | null>(null);
  const viewRef = useRef<CameraView>(view);
  const mirroredRef = useRef(mirrored);
  const cameraFacingRef = useRef<CameraFacingMode>(cameraFacing);
  const modeRef = useRef<AnalysisMode>(mode);
  const calibratingRef = useRef(false);
  const calibrationStableRef = useRef(false);
  const processingRef = useRef(false);
  const frameCaptureInFlightRef = useRef(false);
  const visualSmootherRef = useRef(new LandmarkSmoother(0.72));
  const sessionTrackerRef = useRef<SessionTracker | null>(null);
  const sourceEpochRef = useRef(0);
  const cameraRequestSequenceRef = useRef(0);
  const pendingCameraRequestRef = useRef<number | null>(null);
  const cameraTrackCleanupRef = useRef<(() => void) | null>(null);
  const sourceTokenRef = useRef<SourceToken | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!sessionStartedRef.current) return;
    const interval = window.setInterval(() => {
      setSessionSeconds(
        Math.max(0, (performance.now() - (sessionStartedRef.current ?? performance.now())) / 1000),
      );
    }, 250);
    return () => window.clearInterval(interval);
  }, [sourceState]);

  useEffect(() => {
    const stopHiddenSession = () => {
      if (
        pendingCameraRequestRef.current !== null ||
        sourceKindRef.current ||
        streamRef.current ||
        processingRef.current
      ) {
        cleanupSession(true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopHiddenSession();
    };
    window.addEventListener("pagehide", stopHiddenSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", stopHiddenSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cleanupSession(false);
    };
    // The refs intentionally make cleanup independent of render state.
  }, []);

  const handleWorkerMessage = (message: PoseWorkerResponse) => {
    if (message.type === "ready") {
      const delegate = message.version.match(/\b(GPU|CPU)\b/)?.[1];
      const model =
        message.model === "blazepose_tfjs_full" ? "BlazePose Full" : "Pose Landmarker Full";
      setWorkerLabel(`${model}${delegate ? ` · ${delegate}` : ""} · local`);
      return;
    }
    if (message.type === "error") {
      cleanupSession(false);
      setWorkerLabel("Local pose engine unavailable");
      setError(`${message.message} Nothing was sent off this device.`);
      setSourceState("error");
      return;
    }
    const observation = createObservation({
      rawLandmarks: message.landmarks,
      rawWorldLandmarks: message.worldLandmarks,
      timestampMs: message.timestampMs,
      sequence: message.sequence,
      source: sourceKindRef.current ?? "camera",
      cameraView: viewRef.current,
      mirroredPreview: mirroredRef.current,
    });
    const isImage = sourceKindRef.current === "image";
    setLandmarks(
      isImage
        ? observation.landmarks
        : visualSmootherRef.current.update(observation.landmarks, observation.timestampMs),
    );
    if (!isImage) {
      setTrackingLatencyMs(Math.max(0, Math.round(performance.now() - message.timestampMs)));
    }
    if (isImage) {
      processingRef.current = false;
      setImageStatus(
        message.landmarks.length > 0 && observation.poseConfidence >= 0.45 ? "ready" : "no-pose",
      );
      return;
    }
    if (calibratingRef.current && calibrationRef.current) {
      if (
        observation.poseConfidence >= 0.6 &&
        (observation.observedView === "unknown" ||
          observation.viewConfidence < MIN_OBSERVED_VIEW_CONFIDENCE)
      ) {
        calibratingRef.current = false;
        calibrationStableRef.current = false;
        calibrationRef.current.reset();
        setCalibrating(false);
        setCalibration(
          createCalibrationProfile(modeRef.current, viewRef.current, mirroredRef.current),
        );
        setError(
          "I could not confirm the camera view. Move the camera to a clearer front, side, or three-quarter angle before calibrating.",
        );
        return;
      }
      if (
        observation.viewConfidence >= MIN_OBSERVED_VIEW_CONFIDENCE &&
        !isObservedViewCompatible(modeRef.current, viewRef.current, observation.observedView)
      ) {
        calibratingRef.current = false;
        calibrationStableRef.current = false;
        calibrationRef.current.reset();
        setCalibrating(false);
        setCalibration(
          createCalibrationProfile(modeRef.current, viewRef.current, mirroredRef.current),
        );
        setError(
          `The observed pose looks ${observation.observedView}, not ${viewRef.current}. Choose the matching camera view before calibrating.`,
        );
        return;
      }
      const profile = calibrationRef.current.add(observation);
      setCalibration(profile);
      if (profile.stable) {
        calibratingRef.current = false;
        calibrationStableRef.current = true;
        setCalibrating(false);
        engineRef.current.setCalibrationProfile(profile);
        engineRef.current.setCalibrationStable(true);
      }
      return;
    }
    if (!calibrationStableRef.current) return;
    const nextResult = engineRef.current.process(observation);
    sessionTrackerRef.current?.record(nextResult);
    setResult(nextResult);
  };

  const ensureWorker = () => {
    if (workerRef.current) return workerRef.current;
    const sourceEpoch = sourceEpochRef.current;
    const Client = hasWorkerInferenceSupport(readBrowserCapabilities())
      ? PoseWorkerClient
      : PoseMainThreadClient;
    const worker: PoseInferenceClient = new Client({
      onMessage: (message) => {
        if (sourceEpoch !== sourceEpochRef.current) return;
        handleWorkerMessage(message);
      },
    });
    workerRef.current = worker;
    try {
      worker.init();
    } catch (error) {
      worker.dispose();
      workerRef.current = null;
      throw error;
    }
    return worker;
  };

  function invalidateInferenceContext(): void {
    sourceEpochRef.current += 1;
    workerRef.current?.dispose();
    workerRef.current = null;
    lastVideoTimeRef.current = -1;
    lastSubmittedTimestampRef.current = -1;
    frameCaptureInFlightRef.current = false;
    frameCaptureFailureRef.current = false;
    visualSmootherRef.current.reset();
    setTrackingLatencyMs(null);
    if (processingRef.current) ensureWorker();
  }

  const shouldUsePortraitTransform = (): boolean => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const coarsePointer =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    return (
      isCompactCaptureViewport(viewport) ||
      (coarsePointer && Math.max(viewport.width, viewport.height) <= 1200)
    );
  };

  const updateVideoPresentation = (video: HTMLVideoElement): void => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width <= 0 || height <= 0) return;
    const rotateLandscapeCamera =
      sourceKindRef.current === "camera" &&
      !isPortraitFrame(width, height) &&
      shouldUsePortraitTransform();
    portraitTransformRef.current = rotateLandscapeCamera;
    setPortraitTransformActive(rotateLandscapeCamera);
    const effectiveWidth = rotateLandscapeCamera ? height : width;
    const effectiveHeight = rotateLandscapeCamera ? width : height;
    setSourceSize({ width: effectiveWidth, height: effectiveHeight });
    setPortraitCapture(isPortraitFrame(effectiveWidth, effectiveHeight));
    if (sourceKindRef.current === "camera") {
      const settings = cameraTrackSettingsRef.current;
      setCameraRuntime({
        rawWidth: width,
        rawHeight: height,
        effectiveWidth,
        effectiveHeight,
        rotatedLocally: rotateLandscapeCamera,
        facingMode: settings?.facingMode ?? cameraFacingRef.current,
        frameRate: settings?.frameRate ?? null,
      });
    }
    if (rotateLandscapeCamera) {
      const canvas = portraitPreviewCanvasRef.current;
      if (canvas && (canvas.width !== effectiveWidth || canvas.height !== effectiveHeight)) {
        canvas.width = effectiveWidth;
        canvas.height = effectiveHeight;
      }
    }
  };

  const drawPortraitFrame = (video: HTMLVideoElement): HTMLCanvasElement => {
    if (!portraitTransformRef.current || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error("The browser did not provide a usable landscape camera frame.");
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = portraitPreviewCanvasRef.current;
    if (!canvas) throw new Error("The portrait camera canvas is unavailable.");
    const targetWidth = height;
    const targetHeight = width;
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The browser could not create a portrait camera canvas.");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.translate(targetWidth / 2, targetHeight / 2);
    context.rotate(Math.PI / 2);
    context.drawImage(video, -width / 2, -height / 2, width, height);
    return canvas;
  };

  const capturePortraitBitmap = async (video: HTMLVideoElement): Promise<ImageBitmap> => {
    if (typeof createImageBitmap !== "function") {
      throw new Error("ImageBitmap capture is unavailable in this browser.");
    }
    const canvas = drawPortraitFrame(video);
    const dimensions = getInferenceFrameDimensions(canvas.width, canvas.height);
    try {
      return await createImageBitmap(canvas, {
        resizeWidth: dimensions.width,
        resizeHeight: dimensions.height,
        resizeQuality: "high",
      });
    } catch {
      // Older Safari builds may not implement resize options. Keep local
      // capture working at source resolution when that option is unavailable.
      return createImageBitmap(canvas);
    }
  };

  const captureBitmap = async (
    source: HTMLVideoElement | HTMLImageElement,
    width: number,
    height: number,
    kind: "video" | "image",
  ): Promise<ImageBitmap> => {
    const dimensions = getInferenceFrameDimensions(width, height);
    if (typeof createImageBitmap === "function" && directBitmapSupportRef.current[kind] !== false) {
      try {
        const frame = await createImageBitmap(source, {
          resizeWidth: dimensions.width,
          resizeHeight: dimensions.height,
          resizeQuality: "high",
        });
        directBitmapSupportRef.current[kind] = true;
        return frame;
      } catch {
        // Safari and some embedded browsers expose createImageBitmap but do
        // not accept a live HTML video element. Use a canvas copy below.
        directBitmapSupportRef.current[kind] = false;
      }
    }
    if (typeof createImageBitmap !== "function") {
      throw new Error("ImageBitmap capture is unavailable in this browser.");
    }
    if (width <= 0 || height <= 0) {
      throw new Error("The browser did not provide a usable video frame size.");
    }
    let canvas = frameCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      frameCanvasRef.current = canvas;
    }
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
    }
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The browser could not create a camera frame canvas.");
    context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
    return createImageBitmap(canvas);
  };

  const processFrame = async (mediaTime?: number) => {
    const video = videoRef.current;
    const worker = workerRef.current;
    const sourceEpoch = sourceEpochRef.current;
    if (!video || !worker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!worker.canAcceptFrame() || frameCaptureInFlightRef.current) return;
    const currentTime =
      typeof mediaTime === "number" && Number.isFinite(mediaTime) ? mediaTime : video.currentTime;
    if (currentTime <= lastVideoTimeRef.current) return;
    frameCaptureInFlightRef.current = true;
    try {
      const frame = portraitTransformRef.current
        ? await capturePortraitBitmap(video)
        : await captureBitmap(video, video.videoWidth, video.videoHeight, "video");
      if (
        !processingRef.current ||
        workerRef.current !== worker ||
        sourceEpoch !== sourceEpochRef.current
      ) {
        frame.close();
        return;
      }
      lastVideoTimeRef.current = currentTime;
      const timestampMs = Math.max(performance.now(), lastSubmittedTimestampRef.current + 0.1);
      lastSubmittedTimestampRef.current = timestampMs;
      worker.submit(frame, timestampMs, sequenceRef.current++);
    } catch {
      // A frame may disappear during source changes. Cleanup owns the error state.
      if (
        processingRef.current &&
        sourceEpoch === sourceEpochRef.current &&
        !frameCaptureFailureRef.current
      ) {
        frameCaptureFailureRef.current = true;
        cleanupSession(false);
        setSourceState("error");
        setError(
          "This browser could not capture a live frame for local tracking. Update the browser or choose a local video file.",
        );
      }
    } finally {
      if (sourceEpoch === sourceEpochRef.current && workerRef.current === worker) {
        frameCaptureInFlightRef.current = false;
      }
    }
  };

  const stopFrameLoop = () => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    const video = videoRef.current;
    if (videoFrameCallbackRef.current !== null && video?.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(videoFrameCallbackRef.current);
      videoFrameCallbackRef.current = null;
    }
  };

  const scheduleFrameLoop = () => {
    const video = videoRef.current;
    if (!processingRef.current || !video) return;
    if (video.requestVideoFrameCallback) {
      videoFrameCallbackRef.current = video.requestVideoFrameCallback((_now, metadata) => {
        videoFrameCallbackRef.current = null;
        if (!processingRef.current) return;
        void processFrame(metadata.mediaTime);
        scheduleFrameLoop();
      });
      return;
    }
    animationRef.current = window.requestAnimationFrame(() => {
      animationRef.current = null;
      if (!processingRef.current) return;
      void processFrame();
      scheduleFrameLoop();
    });
  };

  const startLoop = () => {
    stopFrameLoop();
    scheduleFrameLoop();
  };

  const isCurrentVideoSource = (video: HTMLVideoElement, token: VideoSourceToken): boolean => {
    if (videoRef.current !== video || sourceTokenRef.current !== token) return false;
    if (token.kind === "camera") {
      return sourceKindRef.current === "camera" && video.srcObject === token.stream;
    }
    return (
      sourceKindRef.current === "upload" &&
      objectUrlRef.current === token.url &&
      video.src === token.url
    );
  };

  const isCurrentImageSource = (image: HTMLImageElement, token: ImageSourceToken): boolean =>
    imageRef.current === image &&
    sourceTokenRef.current === token &&
    sourceKindRef.current === "image" &&
    objectUrlRef.current === token.url &&
    image.src === token.url;

  const handleVideoReady = async (token: VideoSourceToken) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await waitForVideoMetadata(video);
      await video.play();
      if (!isCurrentVideoSource(video, token)) return;
      updateVideoPresentation(video);
      if (portraitTransformRef.current) drawPortraitFrame(video);
      video.onresize = () => {
        if (videoRef.current !== video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
        updateVideoPresentation(video);
      };
      processingRef.current = true;
      setSourceState("active");
      setWorkerLabel("Loading local pose engine…");
      ensureWorker();
      if (!sessionStartedRef.current) {
        const startedAt = performance.now();
        sessionStartedRef.current = startedAt;
        sessionTrackerRef.current = new SessionTracker(modeRef.current, sourceKindRef.current);
        sessionTrackerRef.current.start(startedAt);
        setSessionSummary(null);
      }
      startLoop();
    } catch {
      if (!isCurrentVideoSource(video, token)) return;
      cleanupSession(false);
      setSourceState("error");
      setError(
        "The browser could not play this video. Try another file or check browser permissions.",
      );
    }
  };

  const handleImageReady = async (token: ImageSourceToken) => {
    const image = imageRef.current;
    if (!image) return;
    try {
      await image.decode();
      if (
        !isCurrentImageSource(image, token) ||
        image.naturalWidth <= 0 ||
        image.naturalHeight <= 0
      ) {
        return;
      }
      setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
      setSourceState("active");
      setWorkerLabel("Loading local pose engine…");
      setImageStatus("loading");
      setSessionSummary(null);
      const worker = ensureWorker();
      const frame = await captureBitmap(image, image.naturalWidth, image.naturalHeight, "image");
      if (!isCurrentImageSource(image, token) || workerRef.current !== worker) {
        frame.close();
        return;
      }
      processingRef.current = true;
      if (!worker.submit(frame, Math.max(0, performance.now()), sequenceRef.current++)) {
        throw new Error("Pose worker is unavailable.");
      }
    } catch {
      if (!isCurrentImageSource(image, token)) return;
      cleanupSession(false);
      setSourceState("error");
      setError("This image could not be decoded by the browser. Nothing was retained.");
    }
  };

  const startCamera = async (requestedFacing = cameraFacingRef.current) => {
    setError(null);
    cleanupSession(false);
    cameraFacingRef.current = requestedFacing;
    setCameraFacing(requestedFacing);
    const requestedMirror = requestedFacing === "user";
    setMirrored(requestedMirror);
    mirroredRef.current = requestedMirror;
    setCalibration(createCalibrationProfile(modeRef.current, viewRef.current, requestedMirror));
    if (!navigator.mediaDevices?.getUserMedia) {
      setSourceState("error");
      setError(
        "Camera access is not available in this browser. You can still choose a local video file.",
      );
      return;
    }
    setSourceState("requesting");
    const requestId = cameraRequestSequenceRef.current + 1;
    cameraRequestSequenceRef.current = requestId;
    pendingCameraRequestRef.current = requestId;
    const sourceEpoch = sourceEpochRef.current;
    try {
      if (shouldUsePortraitTransform()) {
        const orientation = window.screen?.orientation as
          | (ScreenOrientation & {
              lock?: (orientation: "portrait") => Promise<void>;
            })
          | undefined;
        if (orientation?.lock) {
          try {
            await orientation.lock("portrait");
          } catch {
            // iOS Safari may reject orientation lock outside fullscreen. The
            // local portrait compositor below remains the reliable fallback.
          }
        }
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          getCameraConstraints(
            { width: window.innerWidth, height: window.innerHeight },
            requestedFacing,
          ),
        );
      } catch (caught) {
        if (!(caught instanceof DOMException) || caught.name !== "OverconstrainedError") {
          throw caught;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: getPortraitFallbackVideoConstraints(requestedFacing),
          });
        } catch (fallbackCaught) {
          if (
            !(fallbackCaught instanceof DOMException) ||
            fallbackCaught.name !== "OverconstrainedError"
          ) {
            throw fallbackCaught;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: requestedFacing } },
          });
        }
      }
      if (
        pendingCameraRequestRef.current !== requestId ||
        sourceEpoch !== sourceEpochRef.current ||
        document.visibilityState === "hidden"
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      sourceKindRef.current = "camera";
      setCameraMuted(false);
      const sourceToken: VideoSourceToken = { kind: "camera", stream };
      sourceTokenRef.current = sourceToken;
      setSourceKind("camera");
      const handleTrackEnded = () => {
        if (streamRef.current !== stream) return;
        cleanupSession(true);
        setSourceState("error");
        setError("The camera stopped. You can reconnect it or continue with a local video file.");
      };
      const handleTrackMuted = () => {
        if (streamRef.current !== stream) return;
        setCameraMuted(true);
        setError(
          "The camera feed is temporarily paused. Keep this tab visible or reconnect the camera.",
        );
      };
      const handleTrackUnmuted = () => {
        if (streamRef.current !== stream) return;
        setCameraMuted(false);
        setError((current) =>
          current?.startsWith("The camera feed is temporarily paused") ? null : current,
        );
      };
      const detachTrackListeners = () => {
        stream.getTracks().forEach((track) => {
          track.removeEventListener("ended", handleTrackEnded);
          track.removeEventListener("mute", handleTrackMuted);
          track.removeEventListener("unmute", handleTrackUnmuted);
        });
      };
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", handleTrackEnded);
        track.addEventListener("mute", handleTrackMuted);
        track.addEventListener("unmute", handleTrackUnmuted);
      });
      cameraTrackCleanupRef.current = detachTrackListeners;
      const video = videoRef.current;
      if (!video) throw new Error("Preview is not ready.");
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await preferPortraitTrack(videoTrack, requestedFacing);
        const settings = videoTrack.getSettings();
        cameraTrackSettingsRef.current = settings;
        const actualFacing: CameraFacingMode =
          settings.facingMode === "environment"
            ? "environment"
            : settings.facingMode === "user"
              ? "user"
              : requestedFacing;
        cameraFacingRef.current = actualFacing;
        setCameraFacing(actualFacing);
        const actualMirror = actualFacing === "user";
        mirroredRef.current = actualMirror;
        setMirrored(actualMirror);
        setCalibration(createCalibrationProfile(modeRef.current, viewRef.current, actualMirror));
      }
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      await handleVideoReady(sourceToken);
    } catch (caught) {
      if (pendingCameraRequestRef.current !== requestId || sourceEpoch !== sourceEpochRef.current)
        return;
      cleanupSession(false);
      setSourceState("error");
      const name = caught instanceof DOMException ? caught.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission was declined. You can continue with a local video file."
          : "No usable camera was found. Check the device, then try again or choose a local video file.",
      );
    } finally {
      if (pendingCameraRequestRef.current === requestId) pendingCameraRequestRef.current = null;
    }
  };

  const changeCameraFacing = (nextFacing: CameraFacingMode) => {
    if (cameraFacingRef.current === nextFacing) return;
    cameraFacingRef.current = nextFacing;
    setCameraFacing(nextFacing);
    if (sourceKindRef.current === "camera") void startCamera(nextFacing);
  };

  const chooseUpload = () => fileInputRef.current?.click();

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    const mediaKind = getLocalMediaKind(file);
    if (!mediaKind) {
      cleanupSession(false);
      setSourceState("error");
      setError(
        "Choose a browser-playable video or image. The file stays in this tab and is not uploaded.",
      );
      return;
    }
    cleanupSession(false);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setMirrored(false);
    mirroredRef.current = false;
    setCalibration(createCalibrationProfile(modeRef.current, viewRef.current, false));
    setSourceState("loading");
    const video = videoRef.current;
    const image = imageRef.current;
    if (mediaKind === "image") {
      const sourceToken: ImageSourceToken = { kind: "image", url };
      sourceTokenRef.current = sourceToken;
      sourceKindRef.current = "image";
      setSourceKind("image");
      setImageStatus("loading");
      if (!image) {
        cleanupSession(false);
        setSourceState("error");
        setError("The local image preview is unavailable. Choose another image file.");
        return;
      }
      image.onload = () => {
        if (imageRef.current === image && sourceTokenRef.current === sourceToken) {
          void handleImageReady(sourceToken);
        }
      };
      image.onerror = () => {
        if (imageRef.current !== image || sourceTokenRef.current !== sourceToken) return;
        cleanupSession(false);
        setSourceState("error");
        setError("This image could not be decoded by the browser. Nothing was retained.");
      };
      image.src = url;
      return;
    }
    const sourceToken: VideoSourceToken = { kind: "upload", url };
    sourceTokenRef.current = sourceToken;
    sourceKindRef.current = "upload";
    setSourceKind("upload");
    if (!video) {
      cleanupSession(false);
      setSourceState("error");
      setError("The local preview is unavailable. Choose another video file.");
      return;
    }
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (videoRef.current === video && sourceTokenRef.current === sourceToken) {
        void handleVideoReady(sourceToken);
      }
    };
    video.onended = () => {
      if (videoRef.current === video && sourceTokenRef.current === sourceToken) {
        finishSession("complete");
      }
    };
    video.onerror = () => {
      if (videoRef.current !== video || sourceTokenRef.current !== sourceToken) return;
      cleanupSession(false);
      setSourceState("error");
      setError("This video could not be decoded by the browser. Nothing was retained.");
    };
    video.load();
  };

  function finishSession(nextState: "idle" | "complete" = "idle") {
    sourceEpochRef.current += 1;
    processingRef.current = false;
    frameCaptureInFlightRef.current = false;
    calibratingRef.current = false;
    setCalibrating(false);
    stopFrameLoop();
    workerRef.current?.dispose();
    workerRef.current = null;
    const tracker = sessionTrackerRef.current;
    if (tracker && sessionStartedRef.current !== null) {
      const summary = tracker.end(performance.now());
      setSessionSummary(summary);
      setSessionSeconds(summary.durationMs / 1000);
      sessionTrackerRef.current = null;
    }
    setResult(null);
    sessionStartedRef.current = null;
    if (nextState === "complete") {
      releaseMediaSource();
      setSourceState("complete");
    }
  }

  function releaseMediaSource() {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.onloadedmetadata = null;
      video.onended = null;
      video.onerror = null;
      video.onresize = null;
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }
    const image = imageRef.current;
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    sourceTokenRef.current = null;
    sourceKindRef.current = null;
    cameraTrackSettingsRef.current = null;
    setSourceKind(null);
    setLandmarks(null);
    setImageStatus(null);
    setSourceSize({ width: 0, height: 0 });
    setPortraitCapture(null);
    portraitTransformRef.current = false;
    setPortraitTransformActive(false);
    setCameraRuntime(null);
    setCameraMuted(false);
    const portraitCanvas = portraitPreviewCanvasRef.current;
    if (portraitCanvas) {
      const context = portraitCanvas.getContext("2d");
      context?.clearRect(0, 0, portraitCanvas.width, portraitCanvas.height);
    }
    setTrackingLatencyMs(null);
  }

  const beginCalibration = () => {
    setError(null);
    if (sourceState !== "active") {
      setError("Start the camera or choose a video before calibrating.");
      return;
    }
    if (!isViewSupported(mode, view)) {
      setError(unsupportedViewFeedback(mode, view).body);
      setResult(null);
      return;
    }
    invalidateInferenceContext();
    const window = new CalibrationWindow(mode, view, mirrored);
    calibrationRef.current = window;
    calibratingRef.current = true;
    calibrationStableRef.current = false;
    engineRef.current.setMode(mode);
    engineRef.current.setCalibrationStable(false);
    setCalibration(createCalibrationProfile(mode, view, mirrored));
    setCalibrating(true);
    setResult(null);
  };

  const changeMode = (nextMode: AnalysisMode) => {
    rotateSession(nextMode);
    invalidateInferenceContext();
    modeRef.current = nextMode;
    setMode(nextMode);
    engineRef.current.setMode(nextMode);
    engineRef.current.setCalibrationStable(false);
    calibratingRef.current = false;
    calibrationStableRef.current = false;
    calibrationRef.current?.reset();
    setCalibration(createCalibrationProfile(nextMode, viewRef.current, mirroredRef.current));
    setCalibrating(false);
    setResult(null);
  };

  function rotateSession(nextMode: AnalysisMode) {
    const tracker = sessionTrackerRef.current;
    if (tracker && sessionStartedRef.current !== null) {
      tracker.end(performance.now());
    }
    sessionTrackerRef.current = null;
    sessionStartedRef.current = null;
    setSessionSeconds(0);
    setSessionSummary(null);
    if (sourceKindRef.current && (sourceState === "active" || sourceState === "loading")) {
      const startedAt = performance.now();
      const nextTracker = new SessionTracker(nextMode, sourceKindRef.current);
      nextTracker.start(startedAt);
      sessionTrackerRef.current = nextTracker;
      sessionStartedRef.current = startedAt;
    }
  }

  const changeView = (nextView: CameraView) => {
    invalidateInferenceContext();
    viewRef.current = nextView;
    setView(nextView);
    engineRef.current.setCalibrationStable(false);
    calibratingRef.current = false;
    calibrationStableRef.current = false;
    calibrationRef.current?.reset();
    setCalibration(createCalibrationProfile(modeRef.current, nextView, mirroredRef.current));
    setCalibrating(false);
    setResult(null);
  };

  const toggleMirror = () => {
    const next = !mirroredRef.current;
    invalidateInferenceContext();
    mirroredRef.current = next;
    setMirrored(next);
    engineRef.current.setCalibrationStable(false);
    calibratingRef.current = false;
    calibrationStableRef.current = false;
    calibrationRef.current?.reset();
    setCalibration(createCalibrationProfile(modeRef.current, viewRef.current, next));
    setCalibrating(false);
    setResult(null);
  };

  function cleanupSession(resetSource = true) {
    finishSession("idle");
    calibratingRef.current = false;
    calibrationStableRef.current = false;
    calibrationRef.current = null;
    engineRef.current.reset();
    stopFrameLoop();
    cameraTrackCleanupRef.current?.();
    cameraTrackCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    pendingCameraRequestRef.current = null;
    streamRef.current = null;
    releaseMediaSource();
    lastVideoTimeRef.current = -1;
    lastSubmittedTimestampRef.current = -1;
    frameCaptureInFlightRef.current = false;
    frameCaptureFailureRef.current = false;
    sequenceRef.current = 0;
    visualSmootherRef.current.reset();
    setTrackingLatencyMs(null);
    setResult(null);
    setCalibration(createCalibrationProfile(modeRef.current, viewRef.current, mirroredRef.current));
    if (resetSource) {
      setSourceKind(null);
      setSourceState("idle");
      setSessionSeconds(0);
      setLandmarks(null);
    }
  }

  const viewSupported = isViewSupported(mode, view);
  const displayedResult = sourceState === "active" && sourceKind !== "image" ? result : null;
  const feedback =
    sourceKind === "image"
      ? imageFeedback(imageStatus)
      : (displayedResult?.feedback ??
        (viewSupported ? initialFeedback : unsupportedViewFeedback(mode, view)));
  const evidenceLabel =
    sourceKind === "image"
      ? imageStatus === "ready"
        ? "Pose found"
        : imageStatus === "no-pose"
          ? "No pose"
          : "Analyzing"
      : confidenceLabel(displayedResult);
  const phaseLabel = sourceKind === "image" ? "Still frame" : (displayedResult?.phase ?? "—");
  const repCount = sourceKind === "image" ? "—" : String(displayedResult?.repCount ?? 0);
  const statusLabel =
    sourceKind === "image"
      ? imageStatus === "ready"
        ? "Image ready"
        : imageStatus === "no-pose"
          ? "No pose"
          : "Analyzing"
      : sourceState === "active"
        ? !viewSupported
          ? "Set your view"
          : calibration.stable
            ? "Coaching"
            : "Calibrate"
        : sourceState === "complete"
          ? "Complete"
          : sourceState === "error"
            ? "Needs attention"
            : "Ready";
  const previewVisible =
    sourceState === "active" ||
    sourceState === "loading" ||
    (sourceState === "complete" && Boolean(sourceKind));
  const videoVisible = previewVisible && sourceKind !== "image";
  const imageVisible = previewVisible && sourceKind === "image";
  const summaryCopy = sessionSummary ? summaryQuality(sessionSummary) : null;

  return (
    <main className="page-shell">
      <a className="skip-link" href="#workspace-title">
        Skip to posture studio
      </a>
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true">
            TC
          </span>
          <span className="wordmark-name">
            Third Code <span>Posture</span>
          </span>
        </div>
        <div className="privacy-pill">
          {iconShield}
          <span>Local inference</span>
          <span className="privacy-dot" aria-hidden="true" />
        </div>
      </header>

      <section className="hero-grid" aria-labelledby="page-title">
        <div className="hero-copy">
          <span className="eyebrow">Third Code / posture lab</span>
          <h1 id="page-title">
            Posture practice, with <em>signal.</em>
          </h1>
          <p className="hero-lede">
            Third Code Posture is a quiet, browser-local coach for relaxed standing, desk posture,
            and movement practice. Clear cues, visible evidence, no account, no cloud upload.
          </p>
          <div className="trust-row" aria-label="Product guarantees">
            <span className="trust-note">{iconShield} No frames leave this tab</span>
            <span className="trust-note">No diagnosis</span>
            <span className="trust-note">No paid API</span>
          </div>
          <div className="steps-panel" aria-label="How it works">
            <span className="steps-title">Three quiet steps</span>
            <span className="step-row">
              <span className="step-number">01</span>Choose a camera, video, or image
            </span>
            <span className="step-row">
              <span className="step-number">02</span>Set the view and inspect the overlay
            </span>
            <span className="step-row">
              <span className="step-number">03</span>Move with one cue at a time
            </span>
          </div>
        </div>

        <section className="workspace-card" aria-labelledby="workspace-title">
          <div className="workspace-header">
            <div>
              <h2 id="workspace-title">Posture studio</h2>
              <p>
                {MODE_LABELS[mode]} / {workerLabel}
              </p>
            </div>
            <span
              className={`status-pill ${sourceState === "active" && (sourceKind !== "image" || imageStatus === "ready") ? "is-ready" : ""}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="workspace-grid">
            <div className="preview-wrap">
              <video
                ref={videoRef}
                className={`preview-video ${videoVisible && !portraitTransformActive ? "is-visible" : ""} ${mirrored ? "is-mirrored" : ""} ${portraitTransformActive ? "is-portrait-source-hidden" : ""}`}
                aria-label="Local posture preview"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={portraitPreviewCanvasRef}
                className={`portrait-preview-canvas ${videoVisible && portraitTransformActive ? "is-visible" : ""} ${mirrored ? "is-mirrored" : ""}`}
                aria-label="Portrait camera preview"
              />
              {/* The object URL is local and only known after the user selects a file. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                className={`preview-image ${imageVisible ? "is-visible" : ""} ${mirrored ? "is-mirrored" : ""}`}
                alt="Uploaded local posture image"
              />
              {previewVisible && sourceKind !== "image" && (
                <div className="full-body-guide" aria-hidden="true">
                  <span className="full-body-guide-label">HEAD + FEET IN FRAME</span>
                  <span className="full-body-guide-head" />
                  <span className="full-body-guide-feet" />
                </div>
              )}
              <PoseCanvas
                landmarks={landmarks}
                mirrored={mirrored}
                sourceWidth={sourceSize.width}
                sourceHeight={sourceSize.height}
              />
              {!previewVisible && (
                <div className="preview-empty">
                  <div className="preview-empty-content">
                    <strong>Start when you&apos;re ready.</strong>
                    <span>
                      Center one person in frame, keep your full body visible, and use even light.
                      Keep the camera upright and step back until your head and feet stay inside the
                      frame.
                    </span>
                  </div>
                </div>
              )}
              <div className="preview-meta">
                <span>
                  {sourceKind
                    ? sourceState === "complete"
                      ? `${sourceKind} · session complete`
                      : sourceKind === "image"
                        ? imageStatus === "ready"
                          ? "image · pose found locally"
                          : imageStatus === "no-pose"
                            ? "image · no pose found"
                            : "image · analyzing on device"
                        : sourceKind === "camera"
                          ? cameraMuted
                            ? "camera · paused · processing on device"
                            : portraitTransformActive
                              ? "camera · portrait · rotated locally · processing on device"
                              : portraitCapture === false
                                ? "camera · landscape · processing on device"
                                : portraitCapture === true
                                  ? "camera · portrait · processing on device"
                                  : "camera · portrait request · processing on device"
                          : `${sourceKind} · processing on device`
                    : "preview idle"}
                </span>
                <span>
                  {sourceKind !== null && sourceKind !== "image" && trackingLatencyMs !== null
                    ? `${trackingLatencyMs}ms live`
                    : formatTime(sessionSeconds)}
                </span>
              </div>
            </div>

            <aside className="controls-panel" aria-label="Coach controls">
              <ModeSelector mode={mode} onChange={changeMode} />
              <div>
                <label className="control-label" htmlFor="view-select">
                  Camera view
                </label>
                <select
                  id="view-select"
                  className="select-control"
                  value={view}
                  onChange={(event) => changeView(event.target.value as CameraView)}
                >
                  <option value="side">Side profile</option>
                  <option value="front">Front-facing</option>
                  <option value="three-quarter">Three-quarter</option>
                  <option value="unknown">I’m not sure yet</option>
                </select>
                <p className="positioning-note">{cameraGuidance(mode, view)}</p>
                <p className="positioning-note mobile-capture-note">
                  Portrait capture: keep the camera upright, place it on a stable surface, and step
                  back until your head and feet stay inside the frame.
                </p>
                <p className="positioning-note portrait-capture-note">
                  {sourceKind === "camera" && portraitTransformActive
                    ? "This device returned landscape frames, so Third Code rotates the preview and tracking source locally into portrait without cropping. No frame leaves this device."
                    : sourceKind === "camera" && portraitCapture === false
                      ? "This camera provides landscape frames here. The full frame remains visible without cropping; use a portrait-capable camera for upright full-body guidance."
                      : "Portrait-first camera request: keep the full body inside the guide area for complete landmark tracking."}
                </p>
              </div>
              <div>
                <label className="control-label" htmlFor="camera-facing-select">
                  Camera lens
                </label>
                <select
                  id="camera-facing-select"
                  className="select-control"
                  value={cameraFacing}
                  disabled={sourceState === "requesting"}
                  onChange={(event) => changeCameraFacing(event.target.value as CameraFacingMode)}
                >
                  <option value="user">Front camera</option>
                  <option value="environment">Rear camera</option>
                </select>
                <p className="positioning-note">
                  {cameraFacing === "environment"
                    ? "Rear camera usually gives a wider full-body view. Switching releases the previous camera first."
                    : "Front camera keeps setup visible while you step back into the full-body guide."}
                </p>
              </div>
              <label className="calibration-row">
                <input
                  className="hidden-input"
                  type="checkbox"
                  checked={mirrored}
                  onChange={toggleMirror}
                />
                <span className="calibration-icon" aria-hidden="true">
                  ↔
                </span>
                <span>
                  <strong>Mirror preview</strong>
                  {mirrored ? " On; landmark labels stay anatomical" : " Off"}
                </span>
              </label>
              <div className="calibration-row" aria-live="polite">
                <span className="calibration-icon" aria-hidden="true">
                  {calibrating ? "…" : calibration.stable ? "✓" : "○"}
                </span>
                <span>
                  <strong>
                    {calibrating
                      ? `Calibrating ${calibration.sampleCount}/${CALIBRATION_SAMPLE_TARGET}`
                      : calibration.stable
                        ? "Calibration ready"
                        : "Calibration needed"}
                  </strong>
                  {calibrating
                    ? mode === "standing"
                      ? " Stand naturally; do not force alignment"
                      : " Hold a relaxed position"
                    : " View-specific baseline"}
                </span>
              </div>
              {!viewSupported && (
                <p className="positioning-note" role="status">
                  Choose a supported view before calibrating.
                </p>
              )}
              <div className="source-actions">
                {(sourceState === "active" || sourceState === "loading") &&
                sourceKind !== "image" ? (
                  <button className="button-primary" type="button" onClick={beginCalibration}>
                    {calibrating
                      ? "Calibrating…"
                      : calibration.stable
                        ? "Recalibrate"
                        : "Calibrate"}
                  </button>
                ) : (
                  <button
                    className="button-primary"
                    type="button"
                    onClick={() => void startCamera()}
                    disabled={sourceState === "requesting"}
                  >
                    {sourceState === "requesting" ? "Requesting…" : "Use webcam"}
                  </button>
                )}
                <button className="button-secondary" type="button" onClick={chooseUpload}>
                  {sourceState === "active" ? "Switch source" : "Choose video or image"}
                </button>
                <input
                  ref={fileInputRef}
                  className="hidden-input"
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleUpload}
                  aria-label="Choose a local video or image file"
                />
                {sourceState !== "idle" && (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => cleanupSession(true)}
                  >
                    Stop session
                  </button>
                )}
              </div>
              <DeviceReadiness cameraRuntime={cameraRuntime} cameraMuted={cameraMuted} />
            </aside>
          </div>

          {error && (
            <p className="error-note" role="alert">
              {error}
            </p>
          )}
          <div className="result-strip" aria-label="Session status">
            <div className="result-cell">
              <span className="result-label">Current cue</span>
              <span className="result-value">{feedback.title}</span>
            </div>
            <div className="result-cell">
              <span className="result-label">Evidence</span>
              <span className="result-value">{evidenceLabel}</span>
            </div>
            <div className="result-cell">
              <span className="result-label">Phase</span>
              <span className="result-value">{phaseLabel}</span>
            </div>
            <div className="result-cell">
              <span className="result-label">Reps</span>
              <span className="result-value is-positive">{repCount}</span>
            </div>
          </div>
          <FeedbackCard feedback={feedback} />
          {sessionSummary && summaryCopy && (
            <section className="session-summary" aria-labelledby="summary-title">
              <div className="session-summary-heading">
                <div>
                  <span className="result-label">Session summary</span>
                  <h3 id="summary-title">{summaryCopy.label}</h3>
                </div>
                <span className="summary-mode">{MODE_LABELS[sessionSummary.mode]}</span>
              </div>
              <div className="summary-grid">
                <div>
                  <span className="result-label">Duration</span>
                  <strong>{formatTime(sessionSummary.durationMs / 1000)}</strong>
                </div>
                <div>
                  <span className="result-label">Evidence coverage</span>
                  <strong>{Math.round(sessionSummary.evidenceCoverage * 100)}%</strong>
                </div>
                <div>
                  <span className="result-label">Valid reps</span>
                  <strong>{sessionSummary.validRepCount}</strong>
                </div>
              </div>
              <p>{summaryCopy.body}</p>
              {rejectionReasonsCopy(sessionSummary) && (
                <p>
                  <strong>Rejected reps:</strong> {rejectionReasonsCopy(sessionSummary)}
                </p>
              )}
            </section>
          )}
        </section>
      </section>

      <footer className="footer-note">
        <p>
          <strong>Third Code Posture / Educational coaching only.</strong> This tool does not
          diagnose conditions or promise clinical accuracy. Stop if you feel pain and seek qualified
          professional help for injury or rehabilitation.
        </p>
        <p>Frames, landmarks, and summaries stay in memory and reset when you refresh.</p>
      </footer>
    </main>
  );
}
