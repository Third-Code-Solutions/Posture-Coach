import { MEASUREMENT_THRESHOLDS } from "../domain/measurement-registry";

export type InferenceQualityId = "detail" | "balanced" | "recovery";

export interface InferenceQualityProfile {
  id: InferenceQualityId;
  label: string;
  maxDimension: number;
}

export interface InferenceQualityObservation {
  profile: InferenceQualityProfile;
  changed: boolean;
}

export const INFERENCE_QUALITY_PROFILES: readonly InferenceQualityProfile[] = [
  {
    id: "detail",
    label: "Detail",
    maxDimension: MEASUREMENT_THRESHOLDS.inference.detailFrameDimension,
  },
  {
    id: "balanced",
    label: "Balanced",
    maxDimension: MEASUREMENT_THRESHOLDS.inference.balancedFrameDimension,
  },
  {
    id: "recovery",
    label: "Recovery",
    maxDimension: MEASUREMENT_THRESHOLDS.inference.recoveryFrameDimension,
  },
] as const;

export class AdaptiveInferenceQualityController {
  private profileIndex = 0;
  private slowSamples = 0;
  private criticalSamples = 0;
  private fastSamples = 0;
  private cooldownSamples = 0;

  get current(): InferenceQualityProfile {
    return INFERENCE_QUALITY_PROFILES[this.profileIndex] ?? INFERENCE_QUALITY_PROFILES[0];
  }

  observe(latencyMs: number): InferenceQualityObservation {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return this.snapshot(false);
    if (this.cooldownSamples > 0) {
      this.cooldownSamples -= 1;
      this.resetSampleRuns();
      return this.snapshot(false);
    }

    if (latencyMs >= MEASUREMENT_THRESHOLDS.inference.criticalLatencyMs) {
      this.criticalSamples += 1;
      this.slowSamples += 1;
      this.fastSamples = 0;
    } else if (latencyMs >= MEASUREMENT_THRESHOLDS.inference.slowLatencyMs) {
      this.criticalSamples = 0;
      this.slowSamples += 1;
      this.fastSamples = 0;
    } else if (latencyMs <= MEASUREMENT_THRESHOLDS.inference.recoveryLatencyMs) {
      this.criticalSamples = 0;
      this.slowSamples = 0;
      this.fastSamples += 1;
    } else {
      this.resetSampleRuns();
    }

    const shouldDownshift =
      this.profileIndex < INFERENCE_QUALITY_PROFILES.length - 1 &&
      (this.criticalSamples >= MEASUREMENT_THRESHOLDS.inference.criticalSamplesToDownshift ||
        this.slowSamples >= MEASUREMENT_THRESHOLDS.inference.slowSamplesToDownshift);
    if (shouldDownshift) return this.changeProfile(this.profileIndex + 1);

    const shouldRecover =
      this.profileIndex > 0 &&
      this.fastSamples >= MEASUREMENT_THRESHOLDS.inference.fastSamplesToRecover;
    if (shouldRecover) return this.changeProfile(this.profileIndex - 1);

    return this.snapshot(false);
  }

  reset(): InferenceQualityProfile {
    this.profileIndex = 0;
    this.cooldownSamples = 0;
    this.resetSampleRuns();
    return this.current;
  }

  clearSamples(): InferenceQualityProfile {
    this.cooldownSamples = 0;
    this.resetSampleRuns();
    return this.current;
  }

  private changeProfile(profileIndex: number): InferenceQualityObservation {
    this.profileIndex = profileIndex;
    this.cooldownSamples = MEASUREMENT_THRESHOLDS.inference.cooldownSamplesAfterChange;
    this.resetSampleRuns();
    return this.snapshot(true);
  }

  private resetSampleRuns(): void {
    this.slowSamples = 0;
    this.criticalSamples = 0;
    this.fastSamples = 0;
  }

  private snapshot(changed: boolean): InferenceQualityObservation {
    return { profile: this.current, changed };
  }
}
