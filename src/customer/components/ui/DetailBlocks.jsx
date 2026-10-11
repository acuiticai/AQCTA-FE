import React from "react";

import StatusPill from "./StatusPill";
import { ArrowLeftIcon } from "./icons";

/**
 * The pieces an application/enquiry detail page is assembled from. Kept in one
 * module because they only ever appear together and share the same rhythm.
 */

/** Back arrow + title + subtitle, with an action on the right. */
export function DetailHeader({ title, subtitle, meta, action, onBack }) {
  return (
    <header className="epc-detailhead">
      <div className="epc-detailhead__main">
        {onBack && (
          <button
            type="button"
            className="epc-iconbtn epc-iconbtn--boxed epc-detailhead__back"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeftIcon size={18} />
          </button>
        )}
        <div>
          <h1 className="epc-detailhead__title">{title}</h1>
          {subtitle && <p className="epc-detailhead__subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="epc-detailhead__side">
        {action}
        {meta && <p className="epc-detailhead__meta">{meta}</p>}
      </div>
    </header>
  );
}

/** The four summary tiles that open a detail page. */
export function SummaryTiles({ tiles = [] }) {
  return (
    <div className="epc-tiles">
      {tiles.map((tile) => (
        <article className="epc-tile" key={tile.label}>
          <span className="epc-tile__label">{tile.label}</span>
          <span className="epc-tile__value">{tile.value}</span>
          {tile.note && <span className="epc-tile__note">{tile.note}</span>}
        </article>
      ))}
    </div>
  );
}

/** Label/value rows inside a detail card. */
export function DefinitionList({ items = [] }) {
  return (
    <dl className="epc-deflist">
      {items.map((item) => (
        <div className="epc-deflist__row" key={item.label}>
          <dt className="epc-deflist__label">{item.label}</dt>
          <dd className="epc-deflist__value">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Customer-visible progress. `tone` colours the dot: done, current, pending.
 */
export function Timeline({ entries = [] }) {
  return (
    <ol className="epc-timeline">
      {entries.map((entry, index) => (
        <li
          className={`epc-timeline__item is-${entry.tone || "pending"}`}
          key={`${entry.title}-${entry.date}-${index}`}
        >
          <span className="epc-timeline__marker" aria-hidden="true" />
          <div className="epc-timeline__body">
            <span className="epc-timeline__date">{entry.date}</span>
            <span className="epc-timeline__title">{entry.title}</span>
            {entry.note && <span className="epc-timeline__note">{entry.note}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Tinted panel carrying the latest review note. */
export function NotePanel({ children }) {
  return <div className="epc-note">{children}</div>;
}

/** Status chip that sits beside a card title. */
export function CardStatus({ status }) {
  return <StatusPill status={status} />;
}

/** "Need help …" banner that closes a list page. */
export function HelpBanner({ title, body, actionLabel, onAction }) {
  return (
    <section className="epc-helpbanner">
      <div>
        <h2 className="epc-helpbanner__title">{title}</h2>
        <p className="epc-helpbanner__body">{body}</p>
      </div>
      <button type="button" className="epc-btn epc-btn--secondary" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  );
}

/** Small icon buttons in a table's Actions column. */
export function RowActions({ actions = [] }) {
  return (
    <div className="epc-rowactions">
      {actions.map(({ icon: Icon, label, tone, onClick }) => (
        <button
          key={label}
          type="button"
          className={`epc-rowaction${tone ? ` epc-rowaction--${tone}` : ""}`}
          aria-label={label}
          title={label}
          onClick={onClick}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
