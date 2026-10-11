import React, { useState } from "react";

/**
 * Single-series column chart.
 *
 * Magnitude is carried by bar height, so colour is free to mean one thing only:
 * which column is the current period. That keeps it to a single hue (a
 * recessive track, one fill step, one emphasis step) rather than a ramp that
 * would double-encode the value.
 *
 * Every bar has a hover tooltip; the columns are also a real focus order, so
 * the values are reachable by keyboard as well as pointer.
 *
 * data: [{ label, value, caption? }]
 */
export default function BarChart({
  data = [],
  highlightIndex,
  gridLines = 4,
  formatTooltip = (point) => `${point.value}`,
  valueLabel = "",
}) {
  const [active, setActive] = useState(null);

  if (!data.length) return null;

  const max = Math.max(...data.map((point) => point.value)) || 1;
  // Head-room so the tallest bar never touches the top gridline.
  const scaleMax = max * 1.15;

  return (
    <div className="epc-bars">
      <div className="epc-bars__plot">
        <div className="epc-bars__grid" aria-hidden="true">
          {Array.from({ length: gridLines }).map((_, index) => (
            <span key={index} className="epc-bars__gridline" />
          ))}
        </div>

        <ul className="epc-bars__cols">
          {data.map((point, index) => {
            const isHighlighted = index === highlightIndex;
            const isActive = active === index;
            return (
              <li
                key={point.label}
                className={[
                  "epc-bars__col",
                  isHighlighted ? "is-highlighted" : "",
                  isActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="epc-bars__hit"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  aria-label={`${point.label}: ${point.value} ${valueLabel}`.trim()}
                >
                  <span className="epc-bars__track">
                    <span
                      className="epc-bars__fill"
                      style={{
                        height: `${(point.value / scaleMax) * 100}%`,
                      }}
                    />
                  </span>
                </button>

                {isActive && (
                  <div className="epc-bars__tooltip" role="tooltip">
                    <span className="epc-bars__tooltip-title">
                      {point.caption || point.label}
                    </span>
                    <span className="epc-bars__tooltip-value">
                      {formatTooltip(point)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="epc-bars__axis" aria-hidden="true">
        {data.map((point) => (
          <li key={point.label}>{point.label}</li>
        ))}
      </ul>
    </div>
  );
}
