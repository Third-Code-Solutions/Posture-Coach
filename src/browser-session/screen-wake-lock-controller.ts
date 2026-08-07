export type WakeLockState = "idle" | "active" | "released" | "blocked" | "unsupported";

export interface ScreenWakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}

export interface ScreenWakeLockManagerLike {
  request(type: "screen"): Promise<ScreenWakeLockSentinelLike>;
}

export interface ScreenWakeLockDependencies {
  readonly getManager: () => ScreenWakeLockManagerLike | undefined;
  readonly isVisible: () => boolean;
}

const browserDependencies = (): ScreenWakeLockDependencies => ({
  getManager: () =>
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { wakeLock?: ScreenWakeLockManagerLike }).wakeLock,
  isVisible: () => typeof document !== "undefined" && document.visibilityState === "visible",
});

export class ScreenWakeLockController {
  private readonly dependencies: ScreenWakeLockDependencies;
  private state: WakeLockState = "idle";
  private listeners = new Set<(state: WakeLockState) => void>();
  private sentinel: ScreenWakeLockSentinelLike | null = null;
  private releaseListener: (() => void) | null = null;
  private requestSequence = 0;

  constructor(dependencies: ScreenWakeLockDependencies = browserDependencies()) {
    this.dependencies = dependencies;
  }

  getState(): WakeLockState {
    return this.state;
  }

  subscribe(listener: (state: WakeLockState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request(isCurrentSession: () => boolean): Promise<void> {
    // Wake locks are advisory, visible-document only, and may be system-released:
    // https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
    // https://w3c.github.io/screen-wake-lock/
    const requestSequence = ++this.requestSequence;
    const manager = this.dependencies.getManager();
    if (!manager) {
      if (isCurrentSession()) this.update("unsupported");
      return;
    }
    try {
      const sentinel = await manager.request("screen");
      if (
        requestSequence !== this.requestSequence ||
        !isCurrentSession() ||
        !this.dependencies.isVisible()
      ) {
        if (!sentinel.released) await sentinel.release();
        return;
      }
      this.releaseCurrent("idle");
      const handleRelease = () => {
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        this.releaseListener = null;
        this.update("released");
      };
      this.sentinel = sentinel;
      this.releaseListener = handleRelease;
      sentinel.addEventListener("release", handleRelease, { once: true });
      this.update("active");
    } catch {
      if (requestSequence === this.requestSequence && isCurrentSession()) this.update("blocked");
    }
  }

  stop(): void {
    this.requestSequence += 1;
    this.releaseCurrent("idle");
  }

  private releaseCurrent(nextState: WakeLockState): void {
    const sentinel = this.sentinel;
    const listener = this.releaseListener;
    this.sentinel = null;
    this.releaseListener = null;
    if (sentinel && listener) sentinel.removeEventListener("release", listener);
    if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    this.update(nextState);
  }

  private update(state: WakeLockState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
