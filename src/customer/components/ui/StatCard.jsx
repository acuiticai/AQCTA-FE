import React from "react";

import { IconTile } from "./Card";
import Sparkline from "./charts/Sparkline";

/**
 * Headline metric tile: icon + label, a hero number, a supporting note and a
 * trend glyph. The number is the message, so it wears a text token and the
 * sparkline carries the colour.
 */
export default function StatCard({
  icon,
  tone = "brand",
  label,
  value,
  note,
  noteTone = "muted",
  trend,
  trendTone = "success",
}) {
  return (
    <article className="epc-stat">
      <header className="epc-stat__head">
        <IconTile icon={icon} tone={tone} />
        <span className="epc-stat__label">{label}</span>
      </header>

      <div className="epc-stat__body">
        <span className="epc-stat__value">{value}</span>
        {trend && <Sparkline points={trend} tone={trendTone} />}
      </div>

      {note && <p className={`epc-stat__note epc-stat__note--${noteTone}`}>{note}</p>}
    </article>
  );
}
