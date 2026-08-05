import { describe, expect, it } from "vitest";
import { type IssueCode } from "../../src/domain";
import {
  ISSUE_EVIDENCE_IDS,
  POSTURE_EVIDENCE,
  POSTURE_EVIDENCE_BY_ID,
  POSTURE_EVIDENCE_CACHE_VERSION,
  POSTURE_EVIDENCE_SOURCES,
  evidenceForIds,
} from "../../src/knowledge";

describe("offline posture evidence cache", () => {
  it("has a reviewed version and only direct HTTPS source links", () => {
    expect(POSTURE_EVIDENCE_CACHE_VERSION).toBe("2026-08-06");
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

  it("maps every live evaluator issue to cached evidence", () => {
    const issueCodes: IssueCode[] = [
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
    }
  });
});
