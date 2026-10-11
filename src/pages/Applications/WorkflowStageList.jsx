import React, { useMemo, useState } from "react";
import { Check, Circle, Lock } from "lucide-react";
import { ChevronDownIcon } from "@/customer/components/ui/icons";
import { STAGE_STATUS_TONE, isStageDone } from "./workflowStages";

const STAGE_TONE_STYLES = {
  done: "bg-emerald-100 text-emerald-700",
  busy: "bg-amber-100 text-amber-800",
  stop: "bg-red-100 text-red-700",
  idle: "bg-gray-100 text-gray-600",
  current: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
};

const DOT_STYLES = {
  done: "border-emerald-500 bg-emerald-500 text-white",
  busy: "border-amber-500 bg-amber-50 text-amber-700",
  stop: "border-red-500 bg-red-50 text-red-700",
  idle: "border-gray-300 bg-white text-gray-400",
  current:
    "border-amber-500 bg-amber-500 text-white shadow-[0_0_0_4px_rgba(245,158,11,0.18)]",
};

const LINE_STYLES = {
  done: "bg-emerald-400",
  busy: "bg-amber-300",
  stop: "bg-red-300",
  idle: "bg-gray-200",
  current: "bg-amber-400",
};

const isModifiedClick = (event) =>
  Boolean(
    event &&
      (event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button === 1),
  );

const openHrefInNewWindow = (href) => {
  if (!href) return;
  const opened = window.open(href, "_blank");
  if (opened) opened.opener = null;
};

const OpenControl = ({
  href,
  openInNewWindow,
  className,
  children,
  onClick,
}) => {
  if (href) {
    return (
      <a
        data-stage-open=""
        href={href}
        target={openInNewWindow ? "_blank" : undefined}
        rel={openInNewWindow ? "noopener noreferrer" : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(event);
        }}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
};

const makeOpenStage = ({ canOpen, href, openInNewWindow, onOpen, stageKey }) =>
  (event) => {
    /* The Open / Start control is a real link — let the browser handle it
       (including "Open in new tab / window"). */
    if (event?.target?.closest?.("a[data-stage-open]")) {
      event.stopPropagation();
      return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canOpen) return;
    if (href && (openInNewWindow || isModifiedClick(event))) {
      openHrefInNewWindow(href);
      return;
    }
    onOpen?.(stageKey);
  };

/**
 * Full certification / inspection workflow as a status list or vertical stepper.
 * Used on application view and project detail so both screens show the same steps.
 */
export default function WorkflowStageList({
  title = "Certification Workflow",
  subtitle,
  stages = [],
  currentKey,
  openableKeys,
  onOpen,
  /** Real URL for a stage so Open can be Ctrl/right-clicked into a new window. */
  hrefFor,
  /** When true, Open / Start always opens that URL in a new tab or window. */
  openInNewWindow = false,
  emptyMessage = "No certification workflow stages apply.",
  defaultExpanded = false,
  /** When false, the list stays open and the heading is not a toggle. */
  collapsible = true,
  /** "list" = compact cards (projects); "stepper" = chronological step rail. */
  variant = "list",
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || !collapsible);

  const displayStages = useMemo(() => {
    if (variant === "stepper") {
      /* Chronological: earliest work first so the rail reads as a process. */
      return [...stages];
    }
    const descending = [...stages].reverse();
    if (!currentKey) return descending;
    const idx = descending.findIndex((stage) => stage.key === currentKey);
    if (idx <= 0) return descending;
    const ordered = [...descending];
    const [current] = ordered.splice(idx, 1);
    ordered.unshift(current);
    return ordered;
  }, [stages, currentKey, variant]);

  if (!stages.length) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  const showBody = !collapsible || expanded;

  const header = collapsible ? (
    <button
      type="button"
      className="epc-card-head mb-0 flex w-full cursor-pointer items-start justify-between gap-3 border-0 bg-transparent p-0 text-left"
      onClick={() => setExpanded((open) => !open)}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
      title={expanded ? "Click to collapse" : "Click to expand"}
    >
      <div className="epc-card-head__text min-w-0">
        <h2 className="epc-card-head__title text-base font-semibold text-gray-900">
          {title}
        </h2>
        {expanded && subtitle ? (
          <p className="epc-card-head__subtitle mt-0.5 text-xs text-gray-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      <span
        className={`epc-card-head__action mt-0.5 shrink-0 text-gray-400 transition-transform ${
          expanded ? "rotate-0" : "-rotate-90"
        }`}
        aria-hidden
      >
        <ChevronDownIcon size={18} />
      </span>
    </button>
  ) : (
    <div className="mb-0 flex w-full items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
        {stages.length} step{stages.length === 1 ? "" : "s"}
      </span>
    </div>
  );

  if (variant === "stepper") {
    return (
      <div>
        {header}
        {showBody ? (
          <ol className="relative mt-5 m-0 list-none p-0">
            {displayStages.map((stage, index) => {
              const status = stage.status || "Not Started";
              const isCurrent = stage.key === currentKey;
              const tone = isCurrent
                ? "current"
                : STAGE_STATUS_TONE[status] || "idle";
              const canOpen =
                ((openableKeys instanceof Set
                  ? openableKeys.has(stage.key)
                  : Boolean(
                      openableKeys?.has?.(stage.key) ||
                        (Array.isArray(openableKeys) &&
                          openableKeys.includes(stage.key)),
                    )) ||
                  stage.key === currentKey);
              const done = isStageDone(status);
              const isLast = index === displayStages.length - 1;
              const href = canOpen ? hrefFor?.(stage) || undefined : undefined;
              const openStage = makeOpenStage({
                canOpen,
                href,
                openInNewWindow,
                onOpen,
                stageKey: stage.key,
              });

              return (
                <li
                  key={stage.key}
                  className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-6 last:pb-0"
                >
                  {!isLast ? (
                    <span
                      className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${
                        LINE_STYLES[tone] || LINE_STYLES.idle
                      }`}
                      aria-hidden
                    />
                  ) : null}
                  <div className="relative z-[1] flex justify-center pt-0.5">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                        DOT_STYLES[tone] || DOT_STYLES.idle
                      }`}
                      aria-hidden
                    >
                      {done ? (
                        <Check size={16} strokeWidth={2.5} />
                      ) : isCurrent ? (
                        index + 1
                      ) : tone === "idle" ? (
                        <Circle size={12} strokeWidth={2} />
                      ) : (
                        index + 1
                      )}
                    </span>
                  </div>
                  <div
                    role={canOpen ? "button" : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    onClick={openStage}
                    onKeyDown={(event) => {
                      if (!canOpen) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openStage();
                      }
                    }}
                    className={`rounded-xl border px-3.5 py-3 transition-colors ${
                      isCurrent && !done
                        ? "border-amber-400 bg-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]"
                        : isCurrent
                          ? "border-[rgba(var(--p-blue-rgb),0.35)] bg-[rgba(var(--p-blue-rgb),0.04)]"
                          : done
                            ? "border-emerald-200/80 bg-emerald-50/40"
                            : "border-gray-200 bg-white"
                    } ${
                      canOpen
                        ? isCurrent && !done
                          ? "cursor-pointer hover:border-amber-500 hover:bg-amber-50/90"
                          : "cursor-pointer hover:border-gray-300 hover:bg-gray-50/80"
                        : "cursor-default opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {stage.title}
                          </p>
                          {isCurrent && !done ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                              Do next
                            </span>
                          ) : null}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              STAGE_TONE_STYLES[tone] || STAGE_TONE_STYLES.idle
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        {stage.documentCode ? (
                          <p className="mt-1 text-xs text-gray-500">
                            {stage.documentCode}
                          </p>
                        ) : null}
                        {stage.description && !stage.note ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                            {stage.description}
                          </p>
                        ) : null}
                        {stage.date || stage.note ? (
                          <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-100 pt-2">
                            {stage.date ? (
                              <span className="text-xs font-medium text-gray-600">
                                {stage.date}
                              </span>
                            ) : null}
                            {stage.note ? (
                              <span className="text-xs text-gray-500">
                                {stage.note}
                              </span>
                            ) : null}
                          </div>
                        ) : status === "Not Started" ? (
                          <p className="mt-2 text-xs text-gray-400">
                            Not started yet
                          </p>
                        ) : null}
                      </div>
                      {canOpen ? (
                        <OpenControl
                          href={href}
                          openInNewWindow={openInNewWindow}
                          onClick={href ? undefined : openStage}
                          className={`shrink-0 self-center rounded-md px-2.5 py-1 text-xs font-medium ${
                            isCurrent && !done
                              ? "border border-amber-500 bg-amber-500 text-white"
                              : "border border-gray-300 bg-white text-gray-700"
                          }`}
                        >
                          {isCurrent && !done ? "Start" : "Open"}
                        </OpenControl>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 self-center text-[11px] text-gray-400">
                          <Lock size={11} />
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {header}
      {showBody ? (
        <ul className="mt-4 flex flex-col gap-2">
          {displayStages.map((stage) => {
            const status = stage.status || "Not Started";
            const tone =
              stage.key === currentKey
                ? "current"
                : STAGE_STATUS_TONE[status] || "idle";
            const canOpen =
              ((openableKeys instanceof Set
                ? openableKeys.has(stage.key)
                : openableKeys?.has?.(stage.key)) ||
                stage.key === currentKey);
            const href = canOpen ? hrefFor?.(stage) || undefined : undefined;
            const openStage = makeOpenStage({
              canOpen,
              href,
              openInNewWindow,
              onOpen,
              stageKey: stage.key,
            });

            return (
              <li key={stage.key}>
                <div
                  role={canOpen ? "button" : undefined}
                  tabIndex={canOpen ? 0 : undefined}
                  onClick={openStage}
                  onKeyDown={(event) => {
                    if (!canOpen) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openStage();
                    }
                  }}
                  className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                    stage.key === currentKey
                      ? "border-sky-300 bg-sky-50/60"
                      : "border-gray-200 bg-white"
                  } ${
                    canOpen
                      ? "cursor-pointer hover:border-gray-300 hover:bg-gray-50/80"
                      : "cursor-default"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                          tone === "done"
                            ? "bg-emerald-500"
                            : tone === "busy" || tone === "current"
                              ? "bg-amber-500"
                              : tone === "stop"
                                ? "bg-red-500"
                                : "bg-gray-300"
                        }`}
                        aria-hidden
                      />
                      <p className="truncate text-sm font-medium text-gray-900">
                        {stage.title}
                      </p>
                    </div>
                    {stage.documentCode ? (
                      <p className="mt-0.5 pl-[18px] text-xs text-gray-500">
                        {stage.documentCode}
                      </p>
                    ) : null}
                    {(stage.date || stage.note) && (
                      <div className="mt-1 pl-[18px] space-y-0.5">
                        {stage.date ? (
                          <p className="text-[11px] text-gray-500">{stage.date}</p>
                        ) : null}
                        {stage.note ? (
                          <p className="text-[11px] text-gray-400">{stage.note}</p>
                        ) : null}
                      </div>
                    )}
                    <div className="mt-1.5 pl-[18px]">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STAGE_TONE_STYLES[tone] || STAGE_TONE_STYLES.idle
                        }`}
                      >
                        {status}
                        {stage.key === currentKey && !isStageDone(status)
                          ? " · Current"
                          : ""}
                      </span>
                    </div>
                  </div>
                  {canOpen ? (
                    <OpenControl
                      href={href}
                      openInNewWindow={openInNewWindow}
                      onClick={href ? undefined : openStage}
                      className="shrink-0 self-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
                    >
                      Open
                    </OpenControl>
                  ) : (
                    <span className="shrink-0 self-center text-[11px] text-gray-400">
                      Locked
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
