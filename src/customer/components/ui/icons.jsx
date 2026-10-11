import React from "react";

/**
 * Inline icon set for the customer portal. Kept local (rather than pulling from
 * the admin's icon packs) so the portal owns its own visual language and ships
 * nothing it does not use.
 *
 * Every icon takes `size` and spreads the rest onto the <svg>, so they compose
 * with `currentColor` and aria attributes like any other element.
 */

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const icon =
  (paths, viewBox = "0 0 24 24") =>
  ({ size = 18, strokeWidth, ...rest }) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      {...base}
      {...(strokeWidth ? { strokeWidth } : null)}
      {...rest}
    >
      {paths}
    </svg>
  );

/* Form controls ------------------------------------------------------------ */

export const EyeIcon = icon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.1" />
  </>,
);

export const EyeOffIcon = icon(
  <>
    <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4.1M6.4 7.7A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8" />
    <path d="M9.9 9.9a3.1 3.1 0 0 0 4.3 4.3" />
    <path d="M3.5 3.5 20.5 20.5" />
  </>,
);

export const ChevronDownIcon = icon(<path d="M6 9.5 12 15.5 18 9.5" />);
export const ChevronRightIcon = icon(<path d="M9.5 6 15.5 12 9.5 18" />);
export const ArrowRightIcon = icon(
  <>
    <path d="M4.5 12h15" />
    <path d="M13.5 6l6 6-6 6" />
  </>,
);
export const UploadArrowIcon = icon(
  <>
    <path d="M12 19.5V4.5" />
    <path d="M5.8 10.7 12 4.5l6.2 6.2" />
  </>,
);
export const PlusIcon = icon(<path d="M12 5.5v13M5.5 12h13" />);
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const ChevronLeftIcon = icon(<path d="M14.5 6 8.5 12l6 6" />);
export const ArrowLeftIcon = icon(
  <>
    <path d="M19.5 12h-15" />
    <path d="M10.5 6l-6 6 6 6" />
  </>,
);

/* Row actions */
export const PencilIcon = icon(
  <>
    <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z" />
    <path d="M14.5 6.5l3 3" />
  </>,
);
export const TrashIcon = icon(
  <>
    <path d="M4.5 6.5h15" />
    <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
  </>,
);
export const RefreshIcon = icon(
  <>
    <path d="M20 11.5a8 8 0 1 0-.7 4.5" />
    <path d="M20.5 5.5v6h-6" />
  </>,
);
export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const DownloadIcon = icon(
  <>
    <path d="M12 4.5v11" />
    <path d="M7.5 11 12 15.5 16.5 11" />
    <path d="M4.5 19.5h15" />
  </>,
);

/* Navigation --------------------------------------------------------------- */

export const GridIcon = icon(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </>,
);

export const ChatIcon = icon(
  <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.1-2.9-.4L4 20.5l1.5-3.7A6.7 6.7 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />,
);

export const FileIcon = icon(
  <>
    <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" />
    <path d="M13.5 3.5V9H19" />
  </>,
);

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </>,
);

export const CheckCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
  </>,
);

export const AwardIcon = icon(
  <>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M8.6 13.6 7.5 20.5l4.5-2.4 4.5 2.4-1.1-6.9" />
  </>,
);

export const ClipboardIcon = icon(
  <>
    <path d="M9 4.5H7.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2H15" />
    <rect x="9" y="2.8" width="6" height="3.6" rx="1.2" />
  </>,
);

export const InvoiceIcon = icon(
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M3.5 10h17" />
  </>,
);

export const WalletIcon = icon(
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M3.5 10h17M15.5 14.5h2" />
  </>,
);

export const DocumentIcon = icon(
  <>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </>,
);

export const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
  </>,
);

export const HelpIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.8 9.6a2.3 2.3 0 1 1 3 2.2c-.5.2-.8.7-.8 1.2v.5" />
    <path d="M12 16.6h.01" />
  </>,
);

export const LogoutIcon = icon(
  <>
    <path d="M9.5 12H20.5" />
    <path d="M16.5 8l4 4-4 4" />
    <path d="M13.5 19.5H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h6.5" />
  </>,
);

/* Chrome ------------------------------------------------------------------- */

export const BellIcon = icon(
  <>
    <path d="M18 9a6 6 0 1 0-12 0c0 4.5-1.5 6-1.5 6h15S18 13.5 18 9Z" />
    <path d="M10.3 18.5a2 2 0 0 0 3.4 0" />
  </>,
);

export const CalendarIcon = icon(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
);

export const FilterIcon = icon(
  <>
    <path d="M4 7.5h16M7.5 12h9M10.5 16.5h3" />
  </>,
);

export const TrendUpIcon = icon(
  <>
    <path d="M4.5 15.5 10 10l3.5 3.5L19.5 7" />
    <path d="M15 7h4.5v4.5" />
  </>,
);

export const AlertIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.8v4.6M12 16.2h.01" />
  </>,
);
