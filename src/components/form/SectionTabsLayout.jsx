import React, { useEffect, useRef } from "react";

/**
 * Shell used on Customer create (Other details) and Staff create — same tab chrome and content area.
 */
export default function SectionTabsLayout({
  tabs,
  activeIndex,
  onTabChange,
  children,
  footer = null,
  navAriaLabel = "Form sections",
  className = "",
  scrollActiveTabIntoView = true,
}) {
  const buttonRefs = useRef({});

  useEffect(() => {
    if (!scrollActiveTabIntoView) return;
    const el = buttonRefs.current[activeIndex];
    el?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeIndex, scrollActiveTabIntoView]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}
    >
      <div className="px-2 sm:px-4 py-3 bg-gray-50/80 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-600">
        <nav
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={navAriaLabel}
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeIndex === index;
            return (
              <button
                key={tab.key ?? tab.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                ref={(el) => {
                  if (el) buttonRefs.current[index] = el;
                }}
                onClick={() => onTabChange(index)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all border ${
                  isActive
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:bg-white/70 dark:hover:bg-gray-800/60 hover:text-gray-800"
                }`}
              >
                {Icon ? (
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-[var(--p-blue)]" : "opacity-70"
                    }`}
                  />
                ) : null}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-6 min-w-0 max-w-full bg-gradient-to-b from-white to-gray-50/30 dark:from-gray-800 dark:to-gray-900/20">
        {children}
        {footer}
      </div>
    </div>
  );
}
