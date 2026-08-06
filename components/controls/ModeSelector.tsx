import { useRef } from "react";
import type { AnalysisMode } from "../../src/domain";
import { MODE_DESCRIPTIONS, MODE_LABELS } from "../../src/domain";

const MODES: AnalysisMode[] = ["standing", "desk", "squat", "plank", "pushup", "lunge", "curl"];

export function ModeSelector({
  mode,
  onChange,
}: {
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const moveTo = (index: number) => {
    const nextMode = MODES[index];
    onChange(nextMode);
    requestAnimationFrame(() => buttonRefs.current[index]?.focus());
  };

  return (
    <div>
      <span className="control-label" id="mode-label">
        Practice mode
      </span>
      <div className="mode-list" role="listbox" aria-labelledby="mode-label">
        {MODES.map((item, index) => (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={item === mode}
            tabIndex={item === mode ? 0 : -1}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            className={`mode-button ${item === mode ? "is-active" : ""}`}
            title={MODE_DESCRIPTIONS[item]}
            onClick={() => onChange(item)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                event.preventDefault();
                moveTo((index + 1) % MODES.length);
              } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                event.preventDefault();
                moveTo((index - 1 + MODES.length) % MODES.length);
              } else if (event.key === "Home") {
                event.preventDefault();
                moveTo(0);
              } else if (event.key === "End") {
                event.preventDefault();
                moveTo(MODES.length - 1);
              }
            }}
          >
            <span>{MODE_LABELS[item]}</span>
            <span className="mode-arrow" aria-hidden="true">
              {item === mode ? "•" : "→"}
            </span>
          </button>
        ))}
      </div>
      <p className="mode-description">{MODE_DESCRIPTIONS[mode]}</p>
    </div>
  );
}
