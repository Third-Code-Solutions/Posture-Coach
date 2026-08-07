"use client";

import { useEffect, useRef, useState } from "react";
import {
  GuidedSetupController,
  ScreenWakeLockController,
  type WakeLockState,
} from "../../src/browser-session";

export function useSessionAssistance(onGuidedSetupComplete: () => void) {
  const guidedSetupRef = useRef<GuidedSetupController | null>(null);
  const wakeLockRef = useRef<ScreenWakeLockController | null>(null);
  guidedSetupRef.current ??= new GuidedSetupController();
  wakeLockRef.current ??= new ScreenWakeLockController();
  const guidedSetup = guidedSetupRef.current;
  const wakeLock = wakeLockRef.current;
  const [guidedSnapshot, setGuidedSnapshot] = useState(() => guidedSetup.getSnapshot());
  const [wakeLockState, setWakeLockState] = useState<WakeLockState>(() => wakeLock.getState());
  const completionRef = useRef(onGuidedSetupComplete);
  completionRef.current = onGuidedSetupComplete;

  useEffect(() => {
    const unsubscribeGuidedSetup = guidedSetup.subscribe(setGuidedSnapshot);
    const unsubscribeWakeLock = wakeLock.subscribe(setWakeLockState);
    return () => {
      unsubscribeGuidedSetup();
      unsubscribeWakeLock();
      guidedSetup.stop();
      wakeLock.stop();
    };
  }, [guidedSetup, wakeLock]);

  return {
    guidedSetupEnabled: guidedSnapshot.enabled,
    guidedSetupSeconds: guidedSnapshot.secondsRemaining,
    wakeLockState,
    setGuidedSetupEnabled: (enabled: boolean) => guidedSetup.setEnabled(enabled),
    primeForCameraAction: () => guidedSetup.primeAudio(),
    startGuidedSetup: () => guidedSetup.start(() => completionRef.current()),
    cancelGuidedSetup: () => guidedSetup.cancel(),
    requestWakeLock: (isCurrentSession: () => boolean) => wakeLock.request(isCurrentSession),
    stop: () => {
      guidedSetup.stop();
      wakeLock.stop();
    },
  };
}
