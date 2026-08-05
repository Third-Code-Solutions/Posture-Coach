import type { FeedbackMessage } from "../../src/domain";
import { evidenceForIds, POSTURE_EVIDENCE_SOURCE_BY_ID } from "../../src/knowledge";

export function FeedbackCard({ feedback }: { feedback: FeedbackMessage }) {
  const evidence = evidenceForIds(feedback.evidenceIds);
  return (
    <section className={`feedback-card is-${feedback.tone}`} aria-live="polite" aria-atomic="true">
      <div className="feedback-icon" aria-hidden="true">
        {feedback.tone === "positive" ? "✓" : feedback.tone === "caution" ? "!" : "i"}
      </div>
      <div>
        <h3>{feedback.title}</h3>
        <p>{feedback.body}</p>
        {evidence.length > 0 && (
          <details className="feedback-evidence">
            <summary>Research basis · local cache</summary>
            {evidence.map((entry) => (
              <div className="feedback-evidence-entry" key={entry.id}>
                <strong>{entry.title}</strong>
                <p>{entry.claim}</p>
                <p>
                  <strong>Try:</strong> {entry.actions.join(" ")}
                </p>
                <p>
                  <strong>Boundary:</strong> {entry.limitations}
                </p>
                <ul>
                  {entry.sourceIds.map((sourceId) => {
                    const source = POSTURE_EVIDENCE_SOURCE_BY_ID[sourceId];
                    return (
                      <li key={source.id}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                        <small>
                          {source.publisher} · {source.publishedOrUpdated}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </details>
        )}
      </div>
    </section>
  );
}
