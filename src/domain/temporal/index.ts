import type { Landmark, LandmarkSet, LandmarkName } from "../contracts";

export class LandmarkSmoother {
  private previous: LandmarkSet | null = null;
  private previousTimestamp = -1;
  private readonly timeConstantMs: number;

  constructor(alphaAtReferenceFrame = 0.35, referenceIntervalMs = 33) {
    const boundedAlpha = Math.min(0.99, Math.max(0.01, alphaAtReferenceFrame));
    this.timeConstantMs = -referenceIntervalMs / Math.log(1 - boundedAlpha);
  }

  update(next: LandmarkSet, timestampMs: number): LandmarkSet {
    if (
      !this.previous ||
      timestampMs <= this.previousTimestamp ||
      timestampMs - this.previousTimestamp > 800
    ) {
      this.previous = structuredClone(next);
      this.previousTimestamp = timestampMs;
      return structuredClone(next);
    }
    const elapsedMs = timestampMs - this.previousTimestamp;
    const alpha = 1 - Math.exp(-elapsedMs / this.timeConstantMs);
    const output = {} as LandmarkSet;
    for (const name of Object.keys(next) as LandmarkName[]) {
      const current = next[name];
      const prior = this.previous[name];
      output[name] = this.mix(prior, current, alpha);
    }
    this.previous = output;
    this.previousTimestamp = timestampMs;
    return structuredClone(output);
  }

  reset(): void {
    this.previous = null;
    this.previousTimestamp = -1;
  }

  private mix(previous: Landmark, next: Landmark, alpha: number): Landmark {
    return {
      x: previous.x + (next.x - previous.x) * alpha,
      y: previous.y + (next.y - previous.y) * alpha,
      z: previous.z + (next.z - previous.z) * alpha,
      visibility: next.visibility,
      presence: next.presence,
    };
  }
}

export class PersistenceGate {
  private startedAt: number | null = null;
  private active = false;

  constructor(private readonly holdMs: number) {}

  update(condition: boolean, timestampMs: number): boolean {
    if (!condition) {
      this.startedAt = null;
      this.active = false;
      return false;
    }
    if (this.startedAt === null) this.startedAt = timestampMs;
    if (timestampMs - this.startedAt >= this.holdMs) this.active = true;
    return this.active;
  }

  reset(): void {
    this.startedAt = null;
    this.active = false;
  }
}
