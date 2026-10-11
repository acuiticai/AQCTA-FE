import React from "react";

/**
 * Chevron progress bar used by the registration wizard.
 *
 * Each chevron is a 129x48 clipped polygon; the outer element paints the 1px
 * border and the inner face is inset by 1px so completed steps keep their
 * red outline over the rose fill.
 *
 * steps:   [{ title, caption }]
 * current: zero-based index of the active step
 */
export default function StepChevrons({ steps, current = 0, onStepClick }) {
  return (
    <ol className="epc-steps" aria-label="Registration progress">
      {steps.map((step, index) => {
        const state =
          index < current ? "done" : index === current ? "active" : "idle";
        const interactive = typeof onStepClick === "function" && index < current;

        return (
          <li
            key={step.title}
            className={`epc-step epc-step--${state}`}
            aria-current={state === "active" ? "step" : undefined}
          >
            <div
              className="epc-step__face"
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onStepClick(index) : undefined}
              onKeyDown={
                interactive
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onStepClick(index);
                      }
                    }
                  : undefined
              }
              style={interactive ? { cursor: "pointer" } : undefined}
            >
              <span className="epc-step__title">{step.title}</span>
              <span className="epc-step__caption">{step.caption}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
