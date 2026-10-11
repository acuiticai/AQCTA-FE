import React, { useId } from "react";

/**
 * Trend glyph for a stat tile: a single series, 2px stroke, no axes and no
 * legend — the tile's own label names it. Purely decorative support for the
 * headline number, so it is hidden from assistive tech.
 *
 * tone: "brand" | "success" | "danger"
 */
export default function Sparkline({
  points = [],
  width = 84,
  height = 28,
  tone = "brand",
}) {
  const gradientId = useId();

  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  // 2px inset top and bottom so the stroke is never clipped by the viewBox.
  const y = (value) => 2 + (1 - (value - min) / span) * (height - 4);

  const line = points
    .map((value, index) => `${index === 0 ? "M" : "L"}${index * stepX} ${y(value)}`)
    .join(" ");

  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      className={`epc-sparkline epc-sparkline--${tone}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
