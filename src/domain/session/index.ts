import type {
  AnalysisMode,
  EvaluationResult,
  IssueCode,
  RejectionReason,
  SessionSummary,
  SourceKind,
} from "../contracts";

const MAX_FRAME_GAP_MS = 2_000;

export class SessionTracker {
  private readonly mode: AnalysisMode;
  private readonly source: SourceKind | null;
  private startedAtMs: number | null = null;
  private lastResult: EvaluationResult | null = null;
  private endedAtMs: number | null = null;
  private analyzedMs = 0;
  private evidenceMs = 0;
  private validRepCount = 0;
  private rejectedRepCount = 0;
  private readonly rejectedRepReasons: Partial<Record<RejectionReason, number>> = {};
  private readonly issueDurationsMs: Partial<Record<IssueCode, number>> = {};

  constructor(mode: AnalysisMode, source: SourceKind | null) {
    this.mode = mode;
    this.source = source;
  }

  start(timestampMs: number): void {
    this.startedAtMs = timestampMs;
    this.endedAtMs = null;
    this.lastResult = null;
    this.analyzedMs = 0;
    this.evidenceMs = 0;
    this.validRepCount = 0;
    this.rejectedRepCount = 0;
    for (const key of Object.keys(this.rejectedRepReasons))
      delete this.rejectedRepReasons[key as RejectionReason];
    for (const key of Object.keys(this.issueDurationsMs))
      delete this.issueDurationsMs[key as IssueCode];
  }

  record(result: EvaluationResult): void {
    if (this.startedAtMs === null || this.endedAtMs !== null) return;
    if (result.validRep) this.validRepCount += 1;
    if (result.rejectedRep) {
      this.rejectedRepCount += 1;
      this.rejectedRepReasons[result.rejectedRep] =
        (this.rejectedRepReasons[result.rejectedRep] ?? 0) + 1;
    }
    if (this.lastResult) this.recordInterval(this.lastResult, result.timestampMs);
    this.lastResult = result;
  }

  end(timestampMs: number): SessionSummary {
    const endedAt = Math.max(timestampMs, this.startedAtMs ?? timestampMs);
    this.endedAtMs = endedAt;
    if (this.lastResult) this.recordInterval(this.lastResult, endedAt);
    this.lastResult = null;
    const durationMs = Math.max(0, endedAt - (this.startedAtMs ?? endedAt));
    return {
      mode: this.mode,
      source: this.source,
      durationMs,
      analyzedMs: Math.min(durationMs, this.analyzedMs),
      evidenceCoverage: this.analyzedMs ? this.evidenceMs / this.analyzedMs : 0,
      validRepCount: this.validRepCount,
      rejectedRepCount: this.rejectedRepCount,
      rejectedRepReasons: { ...this.rejectedRepReasons },
      issueDurationsMs: { ...this.issueDurationsMs },
      endedAtMs: endedAt,
    };
  }

  private recordInterval(result: EvaluationResult, timestampMs: number): void {
    const previousTimestamp = this.lastResult?.timestampMs ?? timestampMs;
    const gap = Math.min(MAX_FRAME_GAP_MS, Math.max(0, timestampMs - previousTimestamp));
    this.analyzedMs += gap;
    if (result.status === "valid") this.evidenceMs += gap;
    for (const issue of result.issues) {
      this.issueDurationsMs[issue.code] = (this.issueDurationsMs[issue.code] ?? 0) + gap;
    }
  }
}
