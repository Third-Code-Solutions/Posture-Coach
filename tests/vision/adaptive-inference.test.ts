import { describe, expect, it } from "vitest";
import { MEASUREMENT_THRESHOLDS } from "../../src/domain";
import { AdaptiveInferenceQualityController } from "../../src/vision";

function observeMany(
  controller: AdaptiveInferenceQualityController,
  count: number,
  latencyMs: number,
) {
  let result = controller.observe(latencyMs);
  for (let index = 1; index < count; index += 1) result = controller.observe(latencyMs);
  return result;
}

describe("adaptive local inference quality", () => {
  it("starts at the detail budget and ignores invalid samples", () => {
    const controller = new AdaptiveInferenceQualityController();
    expect(controller.current).toMatchObject({ id: "detail", maxDimension: 720 });
    expect(controller.observe(Number.NaN)).toMatchObject({ changed: false });
    expect(controller.observe(-1)).toMatchObject({ changed: false });
    expect(controller.current.id).toBe("detail");
  });

  it("downshifts only after sustained slow or critical latency", () => {
    const controller = new AdaptiveInferenceQualityController();
    const slow = MEASUREMENT_THRESHOLDS.inference.slowLatencyMs;
    expect(
      observeMany(controller, MEASUREMENT_THRESHOLDS.inference.slowSamplesToDownshift - 1, slow),
    ).toMatchObject({ changed: false, profile: { id: "detail" } });
    expect(controller.observe(slow)).toMatchObject({
      changed: true,
      profile: { id: "balanced", maxDimension: 576 },
    });

    observeMany(
      controller,
      MEASUREMENT_THRESHOLDS.inference.cooldownSamplesAfterChange,
      MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs,
    );
    expect(
      observeMany(
        controller,
        MEASUREMENT_THRESHOLDS.inference.criticalSamplesToDownshift,
        MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs,
      ),
    ).toMatchObject({ changed: true, profile: { id: "recovery", maxDimension: 480 } });
  });

  it("recovers one profile at a time after a sustained fast run", () => {
    const controller = new AdaptiveInferenceQualityController();
    const critical = MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs;
    const fast = MEASUREMENT_THRESHOLDS.inference.recoveryLatencyMs;
    observeMany(controller, MEASUREMENT_THRESHOLDS.inference.criticalSamplesToDownshift, critical);
    observeMany(controller, MEASUREMENT_THRESHOLDS.inference.cooldownSamplesAfterChange, critical);
    observeMany(controller, MEASUREMENT_THRESHOLDS.inference.criticalSamplesToDownshift, critical);
    expect(controller.current.id).toBe("recovery");

    observeMany(controller, MEASUREMENT_THRESHOLDS.inference.cooldownSamplesAfterChange, fast);
    expect(
      observeMany(controller, MEASUREMENT_THRESHOLDS.inference.fastSamplesToRecover, fast),
    ).toMatchObject({ changed: true, profile: { id: "balanced" } });

    observeMany(controller, MEASUREMENT_THRESHOLDS.inference.cooldownSamplesAfterChange, fast);
    expect(
      observeMany(controller, MEASUREMENT_THRESHOLDS.inference.fastSamplesToRecover, fast),
    ).toMatchObject({ changed: true, profile: { id: "detail" } });
  });

  it("resets streaks in the neutral band and resets sessions to detail", () => {
    const controller = new AdaptiveInferenceQualityController();
    const slow = MEASUREMENT_THRESHOLDS.inference.slowLatencyMs;
    observeMany(controller, 3, slow);
    controller.observe(250);
    expect(controller.observe(slow).changed).toBe(false);
    expect(controller.reset()).toMatchObject({ id: "detail", maxDimension: 720 });
  });

  it("clears incomplete worker-lifecycle streaks without changing the active profile", () => {
    const controller = new AdaptiveInferenceQualityController();
    const slow = MEASUREMENT_THRESHOLDS.inference.slowLatencyMs;
    observeMany(controller, 3, slow);
    expect(controller.clearSamples()).toMatchObject({ id: "detail" });
    expect(controller.observe(slow)).toMatchObject({ changed: false, profile: { id: "detail" } });

    observeMany(controller, 3, slow);
    expect(controller.current.id).toBe("balanced");
    expect(controller.clearSamples()).toMatchObject({ id: "balanced" });
  });
});
