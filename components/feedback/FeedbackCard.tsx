import type { FeedbackMessage } from "../../src/domain";

export function FeedbackCard({ feedback }: { feedback: FeedbackMessage }) {
  return (
    <section className={`feedback-card is-${feedback.tone}`} aria-live="polite" aria-atomic="true">
      <div className="feedback-icon" aria-hidden="true">
        {feedback.tone === "positive" ? "✓" : feedback.tone === "caution" ? "!" : "i"}
      </div>
      <div>
        <h3>{feedback.title}</h3>
        <p>{feedback.body}</p>
      </div>
    </section>
  );
}
