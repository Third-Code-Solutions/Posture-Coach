import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionAssistance } from "../../components/coach/useSessionAssistance";
import type { ScreenWakeLockSentinelLike } from "../../src/browser-session";

class TestSentinel extends EventTarget implements ScreenWakeLockSentinelLike {
  released = false;
  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event("release"));
  }
}

describe("useSessionAssistance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it("cancels guided setup and releases wake lock on React unmount", async () => {
    const sentinel = new TestSentinel();
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request: async () => sentinel },
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    const completed = vi.fn();
    let assistance: ReturnType<typeof useSessionAssistance> | null = null;

    function Harness() {
      assistance = useSessionAssistance(completed);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    if (!assistance) throw new Error("Session assistance did not mount.");
    const mountedAssistance = assistance as ReturnType<typeof useSessionAssistance>;
    await act(async () => {
      mountedAssistance.startGuidedSetup();
      await mountedAssistance.requestWakeLock(() => true);
    });
    expect(sentinel.released).toBe(false);

    await act(async () => root.unmount());
    await vi.advanceTimersByTimeAsync(10_000);

    expect(sentinel.released).toBe(true);
    expect(completed).not.toHaveBeenCalled();
  });
});
