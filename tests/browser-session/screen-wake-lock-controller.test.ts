import { describe, expect, it, vi } from "vitest";
import {
  ScreenWakeLockController,
  type ScreenWakeLockManagerLike,
  type ScreenWakeLockSentinelLike,
} from "../../src/browser-session";

class TestSentinel extends EventTarget implements ScreenWakeLockSentinelLike {
  released = false;
  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event("release"));
  }
}

describe("ScreenWakeLockController", () => {
  it("reports browser system release", async () => {
    const sentinel = new TestSentinel();
    const manager: ScreenWakeLockManagerLike = { request: vi.fn(async () => sentinel) };
    const controller = new ScreenWakeLockController({
      getManager: () => manager,
      isVisible: () => true,
    });
    await controller.request(() => true);
    expect(controller.getState()).toBe("active");

    await sentinel.release();
    expect(controller.getState()).toBe("released");
  });

  it("reports rejected requests without blocking coaching", async () => {
    const manager: ScreenWakeLockManagerLike = {
      request: vi.fn(async () => {
        throw new DOMException("Battery policy", "NotAllowedError");
      }),
    };
    const controller = new ScreenWakeLockController({
      getManager: () => manager,
      isVisible: () => true,
    });
    await controller.request(() => true);
    expect(controller.getState()).toBe("blocked");
  });

  it("releases a delayed sentinel after its session becomes stale", async () => {
    const sentinel = new TestSentinel();
    let resolveRequest!: (value: ScreenWakeLockSentinelLike) => void;
    const manager: ScreenWakeLockManagerLike = {
      request: () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    };
    const controller = new ScreenWakeLockController({
      getManager: () => manager,
      isVisible: () => true,
    });
    const request = controller.request(() => true);
    controller.stop();
    resolveRequest(sentinel);
    await request;

    expect(sentinel.released).toBe(true);
    expect(controller.getState()).toBe("idle");
  });

  it("releases active lock when session stops", async () => {
    const sentinel = new TestSentinel();
    const controller = new ScreenWakeLockController({
      getManager: () => ({ request: async () => sentinel }),
      isVisible: () => true,
    });
    await controller.request(() => true);
    controller.stop();
    await Promise.resolve();

    expect(sentinel.released).toBe(true);
    expect(controller.getState()).toBe("idle");
  });

  it("reports unsupported browsers", async () => {
    const controller = new ScreenWakeLockController({
      getManager: () => undefined,
      isVisible: () => true,
    });
    await controller.request(() => true);
    expect(controller.getState()).toBe("unsupported");
  });
});
