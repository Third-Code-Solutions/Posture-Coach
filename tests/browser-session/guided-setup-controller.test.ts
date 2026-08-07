import { describe, expect, it, vi } from "vitest";
import { GuidedSetupController, type GuidedSetupDependencies } from "../../src/browser-session";
import type { CountdownAudio } from "../../src/browser-session/countdown-audio";

class TestAudio implements CountdownAudio {
  events: string[] = [];
  prime(): void {
    this.events.push("prime");
  }
  play(complete = false): void {
    this.events.push(complete ? "complete" : "tick");
  }
  close(): void {
    this.events.push("close");
  }
}

function setup() {
  let now = 1_000;
  let tick: (() => void) | null = null;
  const audio = new TestAudio();
  const clearInterval = vi.fn();
  const dependencies: GuidedSetupDependencies = {
    audio,
    now: () => now,
    setInterval: (callback) => {
      tick = callback;
      return 7;
    },
    clearInterval,
  };
  return {
    audio,
    clearInterval,
    controller: new GuidedSetupController(dependencies),
    advanceTo(nextNow: number) {
      now = nextNow;
      if (!tick) throw new Error("Countdown timer was not started.");
      tick();
    },
  };
}

describe("GuidedSetupController", () => {
  it("runs five visual seconds before one completion callback", () => {
    const fixture = setup();
    const complete = vi.fn();
    const snapshots: Array<number | null> = [];
    fixture.controller.subscribe((snapshot) => snapshots.push(snapshot.secondsRemaining));

    expect(fixture.controller.start(complete)).toBe(true);
    expect(fixture.controller.getSnapshot().secondsRemaining).toBe(5);
    fixture.advanceTo(5_001);
    expect(fixture.controller.getSnapshot().secondsRemaining).toBe(1);
    fixture.advanceTo(6_000);

    expect(complete).toHaveBeenCalledOnce();
    expect(fixture.controller.getSnapshot().secondsRemaining).toBeNull();
    expect(snapshots).toEqual([5, 1, null]);
    expect(fixture.audio.events).toEqual(["tick", "tick", "complete"]);
    expect(fixture.clearInterval).toHaveBeenCalledWith(7);
  });

  it("cancels stale completion and closes audio on stop", () => {
    const fixture = setup();
    const complete = vi.fn();
    fixture.controller.primeAudio();
    fixture.controller.start(complete);
    fixture.controller.stop();
    fixture.advanceTo(10_000);

    expect(complete).not.toHaveBeenCalled();
    expect(fixture.controller.getSnapshot().secondsRemaining).toBeNull();
    expect(fixture.audio.events).toContain("close");
  });

  it("does not start when guided setup is disabled", () => {
    const fixture = setup();
    fixture.controller.setEnabled(false);
    expect(fixture.controller.start(vi.fn())).toBe(false);
    expect(fixture.controller.getSnapshot()).toEqual({ enabled: false, secondsRemaining: null });
  });
});
