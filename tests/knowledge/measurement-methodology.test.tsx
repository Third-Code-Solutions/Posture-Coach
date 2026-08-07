import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackCard } from "../../components/feedback/FeedbackCard";
import { IssueMeasurementDetails } from "../../components/knowledge/MeasurementMethodology";

describe("live measurement traceability", () => {
  it("renders only the exact rule carried by a live cue", () => {
    const html = renderToStaticMarkup(
      <IssueMeasurementDetails measurementRuleIds={["lunge-split-stance"]} />,
    );

    expect(html).toContain("Lunge split stance");
    expect(html).toContain("0.9s live-cue persistence");
    expect(html).not.toContain("Lunge selected range");
    expect(html).not.toContain("Lunge knee tracking");
  });

  it("distinguishes an operational capture gate from a coaching heuristic", () => {
    const operational = renderToStaticMarkup(
      <FeedbackCard
        feedback={{
          id: "framing-drift",
          priority: 112,
          tone: "guide",
          title: "Return to your calibrated distance",
          body: "Return to the calibrated frame.",
          issueCode: "positioning",
          measurementRuleIds: ["framing-torso-distance"],
          evidenceIds: [],
        }}
      />,
    );
    const heuristic = renderToStaticMarkup(
      <FeedbackCard
        feedback={{
          id: "split-stance",
          priority: 85,
          tone: "caution",
          title: "Split stance",
          body: "Try a wider split stance.",
          issueCode: "lunge_alignment",
          measurementRuleIds: ["lunge-split-stance"],
          evidenceIds: [],
        }}
      />,
    );

    expect(operational).toContain("Operational capture gate · not a posture finding");
    expect(operational).not.toContain("Unvalidated coaching heuristic");
    expect(operational).toContain("Calibrated camera distance");
    expect(heuristic).toContain("Unvalidated coaching heuristic · not a clinical cutoff");
    expect(heuristic).toContain("Lunge split stance");
  });
});
