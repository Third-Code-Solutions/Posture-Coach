"use client";

import { useMemo, useState } from "react";
import {
  EVIDENCE_CATEGORIES,
  EVIDENCE_CATEGORY_LABELS,
  POSTURE_EVIDENCE,
  POSTURE_EVIDENCE_CACHE_VERSION,
  POSTURE_EVIDENCE_SOURCE_BY_ID,
  type EvidenceCategoryFilter,
  type EvidenceLevel,
  findPostureEvidence,
} from "../../src/knowledge";

const CATEGORY_FILTERS: readonly EvidenceCategoryFilter[] = ["all", ...EVIDENCE_CATEGORIES];

const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  guideline: "Public guidance",
  "systematic-review": "Systematic review",
  "scoping-review": "Scoping review",
  "clinical-guidance": "Clinical guidance",
  "clinical-boundary": "Safety boundary",
  biomechanics: "Biomechanics",
};

function categoryLabel(category: EvidenceCategoryFilter): string {
  return category === "all" ? "All topics" : EVIDENCE_CATEGORY_LABELS[category];
}

export function PostureLibrary() {
  const [category, setCategory] = useState<EvidenceCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const results = useMemo(() => findPostureEvidence({ category, query }), [category, query]);
  const sourceCount = new Set(POSTURE_EVIDENCE.flatMap((entry) => entry.sourceIds)).size;
  const safetySource = POSTURE_EVIDENCE_SOURCE_BY_ID["nhs-back-pain"];

  return (
    <section id="posture-guide" className="knowledge-section" aria-labelledby="posture-guide-title">
      <div className="knowledge-heading">
        <div>
          <span className="eyebrow">Offline posture knowledge</span>
          <h2 id="posture-guide-title">Know what the camera can—and cannot—tell you.</h2>
        </div>
        <p>
          Browse practical, source-linked guidance without starting a camera. This guide teaches
          options, not diagnoses. No account, API key, or upload required.
        </p>
      </div>

      <aside className="knowledge-safety" aria-labelledby="knowledge-safety-title">
        <span className="knowledge-safety-mark" aria-hidden="true">
          !
        </span>
        <div>
          <span>Safety first</span>
          <h3 id="knowledge-safety-title">Stop if pain starts or worsens.</h3>
          <p>
            Camera cannot assess symptoms. If you have back pain with weakness or numbness in both
            legs, loss of feeling around the genitals or anus, bladder or bowel changes, chest pain,
            or pain after a serious accident, use local emergency care.{" "}
            <a
              href={safetySource.url}
              target="_blank"
              rel="noreferrer noopener"
              referrerPolicy="no-referrer"
            >
              NHS source
            </a>
          </p>
          <p>
            Seek urgent medical advice when back pain starts severely or worsens quickly, or comes
            with feeling hot, cold, shivery, or generally unwell. Arrange routine care when it
            persists, limits daily activity, concerns you, or your back changes shape.
          </p>
        </div>
      </aside>

      <div className="knowledge-facts" aria-label="Guide facts">
        <span>
          <strong>{POSTURE_EVIDENCE.length}</strong> reviewed topics
        </span>
        <span>
          <strong>{sourceCount}</strong> cited sources
        </span>
        <span>
          <strong>Local</strong> searchable cache
        </span>
        <span>
          <strong>{POSTURE_EVIDENCE_CACHE_VERSION}</strong> review date
        </span>
      </div>

      <aside className="knowledge-method-note" aria-labelledby="measurement-status-title">
        <div>
          <span>Measurement status</span>
          <h3 id="measurement-status-title">Educational heuristic</h3>
        </div>
        <p>
          Camera angles and timing thresholds are not clinical cutoffs. Calibration is your visual
          baseline; tracking confidence means landmarks are visible, not that posture is healthy.
        </p>
      </aside>

      <div className="knowledge-tools">
        <label className="knowledge-search">
          <span>Search posture guidance</span>
          <span className="knowledge-search-control">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="m16 16 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try neck, desk, shoulders, squat…"
              autoComplete="off"
            />
          </span>
        </label>

        <fieldset className="knowledge-filters">
          <legend>Filter topics</legend>
          <div className="knowledge-filter-list">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={filter === category ? "is-active" : ""}
                aria-pressed={filter === category}
                onClick={() => setCategory(filter)}
              >
                {categoryLabel(filter)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="knowledge-result-count" aria-live="polite" aria-atomic="true">
        {results.length === 0
          ? "No matching guidance. Try a broader word or another category."
          : `${results.length} ${results.length === 1 ? "topic" : "topics"} found`}
      </p>

      {results.length > 0 && (
        <div className="knowledge-grid" data-testid="posture-guide-results">
          {results.map((entry) => (
            <details className="knowledge-card" key={entry.id}>
              <summary>
                <span className="knowledge-card-meta">
                  <span>{EVIDENCE_CATEGORY_LABELS[entry.category]}</span>
                  <span>{EVIDENCE_LEVEL_LABELS[entry.evidenceLevel]}</span>
                </span>
                <strong>{entry.title}</strong>
                <span className="knowledge-card-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="knowledge-card-body">
                <div>
                  <h3>What you may notice</h3>
                  <p>{entry.signal}</p>
                </div>
                <div>
                  <h3>What evidence supports</h3>
                  <p>{entry.claim}</p>
                </div>
                <div>
                  <h3>Try this</h3>
                  <ul>
                    {entry.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
                <aside className="knowledge-boundary">
                  <strong>Camera limit</strong>
                  <p>{entry.limitations}</p>
                </aside>
                <div className="knowledge-sources">
                  <h3>Sources</h3>
                  <ul>
                    {entry.sourceIds.map((sourceId) => {
                      const source = POSTURE_EVIDENCE_SOURCE_BY_ID[sourceId];
                      return (
                        <li key={sourceId}>
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
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
