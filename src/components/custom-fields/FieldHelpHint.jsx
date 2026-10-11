import React from "react";

/** Hover tooltip (?) matching the compact navy “speech bubble” pattern used on core forms. */
export default function FieldHelpHint({ text }) {
  const t = text?.trim();
  if (!t) return null;

  return (
    <span className="relative inline-flex items-center group align-middle">
      <span
        className="inline-flex h-4 w-4 shrink-0 cursor-default items-center justify-center rounded-full border border-gray-400 text-[10px] font-semibold leading-none text-gray-500"
        aria-label={`Help: ${t}`}
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-[70] mb-1.5 w-max max-w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-[#1e293b] px-3 py-2 text-left text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100"
      >
        {t}
        <span
          className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-[#1e293b]"
          aria-hidden
        />
      </span>
    </span>
  );
}
