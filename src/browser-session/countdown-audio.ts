export interface CountdownAudio {
  prime(): void;
  play(complete?: boolean): void;
  close(): void;
}

export class GeneratedCountdownAudio implements CountdownAudio {
  private context: AudioContext | null = null;

  prime(): void {
    // Browser autoplay policy requires this call to originate from user activation.
    // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume
    if (typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
    } catch {
      // Visual countdown remains authoritative when audio is unavailable.
    }
  }

  play(complete = false): void {
    // Generated oscillator; no network or prerecorded audio asset.
    // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createOscillator
    const context = this.context;
    if (!context || context.state === "closed") return;
    try {
      const now = context.currentTime;
      const duration = complete ? 0.18 : 0.08;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(complete ? 880 : 560, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener(
        "ended",
        () => {
          oscillator.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
    } catch {
      // Power-saving/browser state can revoke audio after user activation.
    }
  }

  close(): void {
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }
}
