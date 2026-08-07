import {
  MEASUREMENT_REGISTRY_VERSION,
  MEASUREMENT_RULE_BY_ID,
  MEASUREMENT_RULES,
  MODE_LABELS,
  type MeasurementRule,
  type MeasurementRuleCategory,
  type MeasurementRuleId,
} from "../../src/domain";

const CATEGORY_LABELS: Record<MeasurementRuleCategory, string> = {
  framing: "Capture gates",
  posture: "Posture cues",
  movement: "Movement cues",
};

const CATEGORY_DESCRIPTIONS: Record<MeasurementRuleCategory, string> = {
  framing: "Operational checks that pause coaching when framing no longer matches calibration.",
  posture: "Sustained, view-specific visual differences used for standing and desk coaching.",
  movement: "View-specific range and alignment rules used for exercise feedback and rep quality.",
};

const CATEGORIES: readonly MeasurementRuleCategory[] = ["framing", "posture", "movement"];

function modeList(rule: MeasurementRule): string {
  if (rule.modes.length === 7) return "All modes";
  return rule.modes.map((mode) => MODE_LABELS[mode]).join(" · ");
}

function viewList(rule: MeasurementRule): string {
  return rule.views.map((view) => (view === "three-quarter" ? "3/4" : view)).join(" · ");
}

function persistenceLabel(rule: MeasurementRule): string {
  if (rule.persistenceMs === 0) return "immediate";
  if (rule.id === "rep-alignment-persistence") {
    return `${rule.persistenceMs / 1_000}s rep-rejection window`;
  }
  return `${rule.persistenceMs / 1_000}s live-cue persistence`;
}

function MeasurementRuleCard({
  rule,
  compact = false,
}: {
  rule: MeasurementRule;
  compact?: boolean;
}) {
  const revision = rule.history.at(-1);
  return (
    <article className={`measurement-rule-card${compact ? " is-compact" : ""}`}>
      <div className="measurement-rule-meta">
        <span>{modeList(rule)}</span>
        <span>{viewList(rule)}</span>
      </div>
      <h4>{rule.label}</h4>
      <p className="measurement-rule-value">{rule.threshold.display}</p>
      <dl>
        <div>
          <dt>Metric</dt>
          <dd>{rule.metric}</dd>
        </div>
        {!compact && (
          <>
            <div>
              <dt>Why</dt>
              <dd>{rule.rationale}</dd>
            </div>
            <div>
              <dt>Boundary</dt>
              <dd>{rule.limitation}</dd>
            </div>
          </>
        )}
      </dl>
      <small>
        {rule.provenance === "operational-only" ? "Operational gate" : "Unvalidated heuristic"}
        {` · ${persistenceLabel(rule)}`}
        {revision ? ` · ${revision.version}` : ""}
      </small>
    </article>
  );
}

export function IssueMeasurementDetails({
  measurementRuleIds,
}: {
  measurementRuleIds: readonly MeasurementRuleId[];
}) {
  const rules = measurementRuleIds.map((ruleId) => MEASUREMENT_RULE_BY_ID[ruleId]);
  if (rules.length === 0) return null;

  return (
    <details className="feedback-measurement-rules">
      <summary>
        How this cue was measured · {rules.length} {rules.length === 1 ? "rule" : "rules"}
      </summary>
      <div className="feedback-measurement-rule-list">
        {rules.map((rule) => (
          <MeasurementRuleCard compact key={rule.id} rule={rule} />
        ))}
      </div>
    </details>
  );
}

export function MeasurementMethodology() {
  return (
    <details className="measurement-register">
      <summary>
        <span>
          <span>Live decision register</span>
          <strong>{MEASUREMENT_RULES.length} auditable measurement rules</strong>
        </span>
        <span className="measurement-register-action" aria-hidden="true">
          Inspect method +
        </span>
      </summary>
      <div className="measurement-register-body">
        <div className="measurement-register-intro">
          <div>
            <span>Registry {MEASUREMENT_REGISTRY_VERSION}</span>
            <h3>
              Every measurable gate, correction, and rep decision has a named metric, view,
              threshold, rationale, and history.
            </h3>
          </div>
          <p>
            Values below reproduce the shipped evaluator. They support consistent educational
            coaching; none are validated clinical cutoffs. Adaptive rules use your visual
            calibration baseline and never infer pain, injury, or diagnosis.
          </p>
        </div>

        {CATEGORIES.map((category) => {
          const rules = MEASUREMENT_RULES.filter((rule) => rule.category === category);
          return (
            <section className="measurement-rule-group" key={category}>
              <div className="measurement-rule-group-heading">
                <h3>{CATEGORY_LABELS[category]}</h3>
                <p>{CATEGORY_DESCRIPTIONS[category]}</p>
              </div>
              <div className="measurement-rule-grid">
                {rules.map((rule) => (
                  <MeasurementRuleCard key={rule.id} rule={rule} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </details>
  );
}
