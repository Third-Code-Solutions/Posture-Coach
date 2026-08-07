import { describe, expect, it } from "vitest";
import { type AnalysisMode, type IssueCode } from "../../src/domain";
import {
  EVIDENCE_CATEGORIES,
  EVIDENCE_CATEGORY_LABELS,
  ISSUE_EVIDENCE_IDS,
  ISSUE_MEASUREMENT_STATUS,
  MODE_GUIDE_EVIDENCE_IDS,
  POSTURE_EVIDENCE,
  POSTURE_EVIDENCE_BY_ID,
  POSTURE_EVIDENCE_CACHE_VERSION,
  POSTURE_EVIDENCE_SOURCES,
  evidenceForIds,
  findPostureEvidence,
} from "../../src/knowledge";

describe("offline posture evidence cache", () => {
  it("has a reviewed version and only direct HTTPS source links", () => {
    expect(POSTURE_EVIDENCE_CACHE_VERSION).toBe("2026-08-07");
    expect(POSTURE_EVIDENCE_SOURCES.length).toBeGreaterThanOrEqual(20);
    expect(POSTURE_EVIDENCE_SOURCES.every((source) => source.url.startsWith("https://"))).toBe(
      true,
    );
    expect(
      POSTURE_EVIDENCE_SOURCES.every(
        (source) => source.id && source.title && source.publisher && source.publishedOrUpdated,
      ),
    ).toBe(true);
  });

  it("keeps every cached claim source-backed and addressable", () => {
    expect(POSTURE_EVIDENCE.length).toBeGreaterThanOrEqual(16);
    for (const entry of POSTURE_EVIDENCE) {
      expect(POSTURE_EVIDENCE_BY_ID[entry.id]).toBe(entry);
      expect(entry.claim.length).toBeGreaterThan(40);
      expect(entry.limitations.length).toBeGreaterThan(30);
      expect(entry.actions.length).toBeGreaterThan(0);
      for (const sourceId of entry.sourceIds) {
        expect(POSTURE_EVIDENCE_SOURCES.some((source) => source.id === sourceId)).toBe(true);
      }
    }
  });

  it("covers every guide category", () => {
    expect(EVIDENCE_CATEGORIES).toEqual(Object.keys(EVIDENCE_CATEGORY_LABELS));
    for (const category of EVIDENCE_CATEGORIES) {
      expect(POSTURE_EVIDENCE.some((entry) => entry.category === category)).toBe(true);
    }
  });

  it("searches every guidance field with all query terms", () => {
    expect(findPostureEvidence()).toHaveLength(POSTURE_EVIDENCE.length);
    expect(findPostureEvidence({ category: "desk" }).map((entry) => entry.id)).toContain(
      "desk-setup",
    );
    expect(
      findPostureEvidence({ query: "  CAMERA   PERFECT " }).map((entry) => entry.id),
    ).toContain("neutral-posture");
    expect(
      findPostureEvidence({ category: "exercise", query: "knee tracking" }).map(
        (entry) => entry.id,
      ),
    ).toEqual(["dynamic-knee-valgus", "squat-mode-guide"]);
    expect(findPostureEvidence({ category: "desk", query: "scoliosis" })).toEqual([]);
    expect(
      findPostureEvidence({ query: "bladder bowel emergency" }).map((entry) => entry.id),
    ).toEqual(["when-to-seek-care"]);
    expect(findPostureEvidence({ query: "product heuristics" }).map((entry) => entry.id)).toContain(
      "calibration-and-confidence",
    );
  });

  it("maps every live evaluator issue to cached evidence", () => {
    const issueCodes: IssueCode[] = [
      "standing_head_alignment",
      "standing_trunk_alignment",
      "standing_lateral_asymmetry",
      "head_forward",
      "neck_inclination",
      "shoulder_imbalance",
      "torso_inclination",
      "prolonged_slouch",
      "squat_depth",
      "squat_knee_alignment",
      "plank_alignment",
      "pushup_body_line",
      "pushup_depth",
      "lunge_alignment",
      "curl_control",
      "positioning",
    ];
    for (const issueCode of issueCodes) {
      expect(ISSUE_EVIDENCE_IDS[issueCode].length).toBeGreaterThan(0);
      expect(evidenceForIds(ISSUE_EVIDENCE_IDS[issueCode]).length).toBe(
        ISSUE_EVIDENCE_IDS[issueCode].length,
      );
      expect(ISSUE_MEASUREMENT_STATUS[issueCode].validationStatus).toBe("unvalidated");
      expect(ISSUE_MEASUREMENT_STATUS[issueCode].note.length).toBeGreaterThan(40);
    }
    expect(ISSUE_MEASUREMENT_STATUS.positioning.thresholdProvenance).toBe("operational-only");
    expect(ISSUE_MEASUREMENT_STATUS.squat_depth.thresholdProvenance).toBe("product-heuristic");
  });

  it("provides a mode-specific guide for every coaching mode", () => {
    const modes: AnalysisMode[] = ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"];
    for (const mode of modes) {
      expect(MODE_GUIDE_EVIDENCE_IDS[mode].length).toBeGreaterThan(0);
      expect(evidenceForIds(MODE_GUIDE_EVIDENCE_IDS[mode])).toHaveLength(
        MODE_GUIDE_EVIDENCE_IDS[mode].length,
      );
    }
    expect(ISSUE_EVIDENCE_IDS.plank_alignment).toEqual(["plank-mode-guide"]);
    expect(ISSUE_EVIDENCE_IDS.curl_control).toEqual(["curl-mode-guide"]);
  });
});
