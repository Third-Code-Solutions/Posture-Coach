import { GUIDED_SETUP_DELAY_MS, guidedSetupSecondsRemaining } from "../domain";
import { GeneratedCountdownAudio, type CountdownAudio } from "./countdown-audio";

export interface GuidedSetupSnapshot {
  readonly enabled: boolean;
  readonly secondsRemaining: number | null;
}

export interface GuidedSetupDependencies {
  readonly audio: CountdownAudio;
  readonly now: () => number;
  readonly setInterval: (callback: () => void, delayMs: number) => number;
  readonly clearInterval: (timer: number) => void;
}

const browserDependencies = (): GuidedSetupDependencies => ({
  audio: new GeneratedCountdownAudio(),
  now: () => performance.now(),
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: (timer) => window.clearInterval(timer),
});

export class GuidedSetupController {
  private readonly dependencies: GuidedSetupDependencies;
  private snapshot: GuidedSetupSnapshot = { enabled: true, secondsRemaining: null };
  private listeners = new Set<(snapshot: GuidedSetupSnapshot) => void>();
  private deadlineMs: number | null = null;
  private timer: number | null = null;
  private lastSecond: number | null = null;
  private completion: (() => void) | null = null;

  constructor(dependencies: GuidedSetupDependencies = browserDependencies()) {
    this.dependencies = dependencies;
  }

  getSnapshot(): GuidedSetupSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: GuidedSetupSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setEnabled(enabled: boolean): void {
    this.cancel();
    this.update({ enabled, secondsRemaining: null });
    if (!enabled) this.dependencies.audio.close();
  }

  primeAudio(): void {
    if (this.snapshot.enabled) this.dependencies.audio.prime();
  }

  start(onComplete: () => void): boolean {
    this.cancel();
    if (!this.snapshot.enabled) return false;
    const now = this.dependencies.now();
    this.deadlineMs = now + GUIDED_SETUP_DELAY_MS;
    this.lastSecond = guidedSetupSecondsRemaining(this.deadlineMs, now);
    this.completion = onComplete;
    this.update({ ...this.snapshot, secondsRemaining: this.lastSecond });
    this.dependencies.audio.play();
    this.timer = this.dependencies.setInterval(() => this.tick(), 100);
    return true;
  }

  cancel(): void {
    if (this.timer !== null) this.dependencies.clearInterval(this.timer);
    this.timer = null;
    this.deadlineMs = null;
    this.lastSecond = null;
    this.completion = null;
    if (this.snapshot.secondsRemaining !== null) {
      this.update({ ...this.snapshot, secondsRemaining: null });
    }
  }

  stop(): void {
    this.cancel();
    this.dependencies.audio.close();
  }

  private tick(): void {
    if (this.deadlineMs === null) return;
    const seconds = guidedSetupSecondsRemaining(this.deadlineMs, this.dependencies.now());
    if (seconds === this.lastSecond) return;
    this.lastSecond = seconds;
    if (seconds > 0) {
      this.update({ ...this.snapshot, secondsRemaining: seconds });
      this.dependencies.audio.play();
      return;
    }
    const completion = this.completion;
    this.cancel();
    this.dependencies.audio.play(true);
    completion?.();
  }

  private update(snapshot: GuidedSetupSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
