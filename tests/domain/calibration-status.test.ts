import { describe, expect, it } from "vitest";
import { CalibrationWindow } from "../../src/domain";
import { makeLandmarks, makeObservation } from "./fixtures";

describe("calibration status", () => {
  it("reports a full-body blocker instead of looking frozen at zero samples", () => {
    const window = new CalibrationWindow("standing", "side", false, 4);
    const croppedFeet = makeLandmarks({
      leftHeel: { y: 1.08 },
      rightHeel: { y: 1.08 },
      leftFootIndex: { y: 1.1 },
      rightFootIndex: { y: 1.1 },
    });

    const update = window.addWithStatus(makeObservation({ landmarks: croppedFeet }));

    expect(update.accepted).toBe(false);
    expect(update.profile.sampleCount).toBe(0);
    expect(update.blocker?.code).toBe("full_body_out_of_frame");
  });

  it("keeps the same calibration window recoverable after a temporary view mismatch", () => {
    const window = new CalibrationWindow("standing", "front", false, 4);

    const blocked = window.addWithStatus(
      makeObservation({ cameraView: "front", observedView: "side" }),
    );
    expect(blocked.accepted).toBe(false);
    expect(blocked.blocker).toMatchObject({ code: "view_mismatch", observedView: "side" });

    let recovered = blocked;
    for (let index = 0; index < 4; index += 1) {
      recovered = window.addWithStatus(
        makeObservation({
          cameraView: "front",
          observedView: "front",
          timestampMs: 40 + index * 40,
          sequence: index + 1,
        }),
      );
    }

    expect(recovered.profile.stable).toBe(true);
    expect(recovered.blocker).toBeNull();
  });

  it("reports accepted sample progress before the baseline is ready", () => {
    const window = new CalibrationWindow("desk", "side", false, 4);

    const update = window.addWithStatus(makeObservation());

    expect(update.accepted).toBe(true);
    expect(update.profile.sampleCount).toBe(1);
    expect(update.blocker).toBeNull();
  });
});
