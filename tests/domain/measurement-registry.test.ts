import { describe, expect, it } from "vitest";
import {
  ISSUE_CODES,
  MEASUREMENT_REGISTRY_VERSION,
  MEASUREMENT_RULES,
  MEASUREMENT_RULE_BY_ID,
  MEASUREMENT_THRESHOLDS,
  SUPPORTED_VIEWS,
  issuePersistenceMs,
  measurementRulesForIssue,
} from "../../src/domain";

describe("auditable measurement registry", () => {
  it("versions every shipped live measurement rule", () => {
    expect(MEASUREMENT_REGISTRY_VERSION).toBe("2026-08-07.1");
    expect(MEASUREMENT_RULES).toHaveLength(28);
    expect(new Set(MEASUREMENT_RULES.map((rule) => rule.id)).size).toBe(MEASUREMENT_RULES.length);

    for (const rule of MEASUREMENT_RULES) {
      expect(MEASUREMENT_RULE_BY_ID[rule.id]).toBe(rule);
      expect(rule.metric.length).toBeGreaterThan(20);
      expect(rule.threshold.display.length).toBeGreaterThan(8);
      expect(rule.threshold.values.length).toBeGreaterThan(0);
      expect(rule.threshold.values.every(Number.isFinite)).toBe(true);
      expect(rule.rationale.length).toBeGreaterThan(40);
      expect(rule.limitation.length).toBeGreaterThan(30);
      expect(rule.history.length).toBeGreaterThan(0);
      expect(rule.issueCodes.length).toBeLessThanOrEqual(1);
      expect(rule.history.at(-1)).toMatchObject({
        version: MEASUREMENT_REGISTRY_VERSION,
        date: "2026-08-07",
      });
      expect(rule.views).not.toContain("unknown");
      for (const mode of rule.modes) {
        expect(rule.views.some((view) => SUPPORTED_VIEWS[mode].includes(view))).toBe(true);
      }
    }
  });

  it("covers every issue code with one or more view-specific rules", () => {
    for (const issueCode of ISSUE_CODES) {
      const rules = measurementRulesForIssue(issueCode);
      expect(rules.length).toBeGreaterThan(0);
      expect(
        rules.every((rule) =>
          (rule.issueCodes as readonly (typeof ISSUE_CODES)[number][]).includes(issueCode),
        ),
      ).toBe(true);
    }
    expect(measurementRulesForIssue("positioning")).toHaveLength(2);
    expect(measurementRulesForIssue("lunge_alignment")).toHaveLength(3);
  });

  it("keeps operational gates separate from coaching heuristics", () => {
    expect(
      measurementRulesForIssue("positioning").every(
        (rule) => rule.provenance === "operational-only",
      ),
    ).toBe(true);
    expect(
      MEASUREMENT_RULES.filter((rule) => rule.provenance === "operational-only").every(
        (rule) => rule.category === "framing",
      ),
    ).toBe(true);
    expect(
      MEASUREMENT_RULES.filter((rule) => rule.provenance !== "operational-only").every(
        (rule) => rule.provenance === "product-heuristic",
      ),
    ).toBe(true);
    expect(MEASUREMENT_RULES.every((rule) => rule.validationStatus === "unvalidated")).toBe(true);
  });

  it("keeps evaluator timing and confidence gates in the same registry", () => {
    expect(MEASUREMENT_THRESHOLDS.inference.maximumPoseCount).toBe(1);
    expect(issuePersistenceMs("positioning")).toBe(0);
    expect(issuePersistenceMs("standing_head_alignment")).toBe(650);
    expect(issuePersistenceMs("head_forward")).toBe(900);
    expect(issuePersistenceMs("prolonged_slouch")).toBe(15_000);
    expect(MEASUREMENT_THRESHOLDS.confidence).toEqual({
      modelPoseDetectionScore: 0.55,
      modelPosePresenceScore: 0.55,
      modelTrackingScore: 0.55,
      minimumImagePoseScore: 0.45,
      minimumOverlayLandmarkScore: 0.45,
      minimumCalibrationViewPoseScore: 0.6,
      minimumLandmarkScore: 0.58,
      minimumPoseScore: 0.5,
      highConfidenceScore: 0.82,
      minimumObservedViewConfidence: 0.4,
      mixedEvidenceCoverage: 0.45,
      highEvidenceCoverage: 0.75,
    });
    expect(MEASUREMENT_THRESHOLDS.calibration.sampleTarget).toBe(12);
    expect(MEASUREMENT_THRESHOLDS.temporal.minimumRepDwellMs).toBe(250);
    expect(MEASUREMENT_THRESHOLDS.temporal.smootherResetGapMs).toBe(800);
  });

  it("derives adaptive rule values from evaluator constants", () => {
    expect(MEASUREMENT_RULE_BY_ID["squat-range"].threshold.values).toEqual([
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.minimum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.maximum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.squat.offset,
    ]);
    expect(MEASUREMENT_RULE_BY_ID["lunge-split-stance"].threshold.values).toEqual([
      MEASUREMENT_THRESHOLDS.exercise.minimumLungeStanceRatio,
      MEASUREMENT_THRESHOLDS.exercise.calibratedLungeStanceMultiplier,
    ]);
    expect(MEASUREMENT_RULE_BY_ID["lunge-range"].threshold.values).toEqual([
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.minimum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.maximum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.lunge.offset,
    ]);
    for (const ruleId of ["plank-body-line", "pushup-body-line"] as const) {
      expect(MEASUREMENT_RULE_BY_ID[ruleId].threshold.values).toEqual([
        MEASUREMENT_THRESHOLDS.exercise.minimumBodyLineToleranceDegrees,
        MEASUREMENT_THRESHOLDS.exercise.calibratedBodyLineMarginDegrees,
        MEASUREMENT_THRESHOLDS.exercise.defaultBodyLineToleranceDegrees,
      ]);
    }
    expect(MEASUREMENT_RULE_BY_ID["pushup-range"].threshold.values).toEqual([
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.minimum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.maximum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.pushup.offset,
    ]);
    expect(MEASUREMENT_RULE_BY_ID["curl-elbow-flare"].threshold.values).toEqual([
      MEASUREMENT_THRESHOLDS.exercise.minimumCurlFlareRatio,
      MEASUREMENT_THRESHOLDS.exercise.fallbackCurlFlareBaseline,
      MEASUREMENT_THRESHOLDS.exercise.calibratedCurlFlareMargin,
    ]);
    expect(MEASUREMENT_RULE_BY_ID["curl-range"].threshold.values).toEqual([
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.minimum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.maximum,
      MEASUREMENT_THRESHOLDS.exercise.calibratedDown.curl.offset,
    ]);
  });
});
