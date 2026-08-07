import { describe, expect, it } from "vitest";
import { GUIDED_SETUP_DELAY_MS, guidedSetupSecondsRemaining } from "../../src/domain";

describe("guided setup countdown", () => {
  it("starts at five seconds and never returns a negative interval", () => {
    const startedAt = 1_000;
    const deadline = startedAt + GUIDED_SETUP_DELAY_MS;

    expect(guidedSetupSecondsRemaining(deadline, startedAt)).toBe(5);
    expect(guidedSetupSecondsRemaining(deadline, deadline - 1)).toBe(1);
    expect(guidedSetupSecondsRemaining(deadline, deadline)).toBe(0);
    expect(guidedSetupSecondsRemaining(deadline, deadline + 1_000)).toBe(0);
  });

  it("fails closed for non-finite timing input", () => {
    expect(guidedSetupSecondsRemaining(Number.NaN, 0)).toBe(0);
    expect(guidedSetupSecondsRemaining(5_000, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
