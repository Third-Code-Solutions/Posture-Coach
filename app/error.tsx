"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-shell">
      <span className="eyebrow">Third Code / posture lab</span>
      <h1>Session needs a fresh start.</h1>
      <p>
        Local camera processing stopped unexpectedly. No frame was uploaded. Reload this tab and
        reconnect your camera or choose a local file.
      </p>
      <div className="error-actions">
        <button className="button-primary" type="button" onClick={() => reset()}>
          Try again
        </button>
        <button className="button-secondary" type="button" onClick={() => window.location.reload()}>
          Reload tab
        </button>
      </div>
    </main>
  );
}
