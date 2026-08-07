import { MEASUREMENT_RULE_BY_ID, type FeedbackMessage } from "../../src/domain";
import { evidenceForIds, POSTURE_EVIDENCE_SOURCE_BY_ID } from "../../src/knowledge";
import { IssueMeasurementDetails } from "../knowledge/MeasurementMethodology";

export function FeedbackCard({ feedback }: { feedback: FeedbackMessage }) {
  const evidence = evidenceForIds(feedback.evidenceIds);
  const measurementRules = (feedback.measurementRuleIds ?? []).map(
    (ruleId) => MEASUREMENT_RULE_BY_ID[ruleId],
  );
  const operationalOnly =
    measurementRules.length > 0 &&
    measurementRules.every((rule) => rule.provenance === "operational-only");
  return (
    <section className={`feedback-card is-${feedback.tone}`} aria-live="polite" aria-atomic="true">
      <div className="feedback-icon" aria-hidden="true">
        {feedback.tone === "positive" ? "✓" : feedback.tone === "caution" ? "!" : "i"}
      </div>
      <div>
        <h3>{feedback.title}</h3>
        <p>{feedback.body}</p>
        {measurementRules.length > 0 && (
          <p className="feedback-heuristic-note">
            {operationalOnly
              ? "Operational capture gate · not a posture finding"
              : "Unvalidated coaching heuristic · not a clinical cutoff"}
          </p>
        )}
        {(evidence.length > 0 || measurementRules.length > 0) && (
          <details className="feedback-evidence">
            <summary>
              {evidence.length > 0 && measurementRules.length > 0
                ? "Decision method + research · local"
                : evidence.length > 0
                  ? "Research basis · local cache"
                  : "Decision method · local registry"}
            </summary>
            {measurementRules.length > 0 && (
              <aside className="feedback-measurement-status">
                <strong>Measurement status · unvalidated</strong>
                <p>
                  {operationalOnly
                    ? "This is a capture or processing gate, not a posture finding or health assessment."
                    : "These are product heuristics for repeatable coaching, not validated clinical cutoffs or safety tests."}
                </p>
                <IssueMeasurementDetails measurementRuleIds={feedback.measurementRuleIds ?? []} />
              </aside>
            )}
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
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          referrerPolicy="no-referrer"
                        >
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
