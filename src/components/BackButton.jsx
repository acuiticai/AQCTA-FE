import { useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

/**
 * Shared exit behavior for create/edit screens (used by BackButton and useFormScreenExit).
 * Order: explicit `state.from` → browser back → fallback list path.
 */
export function defaultNavigateBack(history, location, fallbackPath = "/") {
  if (location.state?.from) {
    history.push(location.state.from);
    return;
  }

  const stackLength =
    typeof window !== "undefined" ? window.history.length : history.length;
  if (stackLength > 1) {
    history.goBack();
    return;
  }

  const currentFullPath = `${location.pathname}${location.search}`;
  const target =
    fallbackPath && fallbackPath !== currentFullPath ? fallbackPath : "/";

  history.push(target);
}

/**
 * Returns the same navigation used by BackButton when `onClick` is omitted.
 * Use for Form `handleCancel` so Cancel matches Back.
 */
export function useFormScreenExit(fallbackPath = "/") {
  const history = useHistory();
  const location = useLocation();
  return useCallback(
    () => defaultNavigateBack(history, location, fallbackPath),
    [history, location.pathname, location.search, location.state, fallbackPath]
  );
}

/**
 * Reusable BackButton component.
 * - Defaults to defaultNavigateBack (state.from, goBack, then fallbackPath)
 * - Allows custom onClick when a screen needs custom behavior
 */
function BackButton({
  onClick,
  fallbackPath = "/",
  style,
  className = "",
  /** Inline with PageHeader title — smaller icon, no block margin/padding. */
  compact = false,
}) {
  const history = useHistory();
  const location = useLocation();

  const handleBackClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (onClick) {
      onClick();
      return;
    }

    defaultNavigateBack(history, location, fallbackPath);
  };

  return (
    <button
      className={`flex items-center text-gray-600 hover:text-gray-800 transition ${
        compact
          ? "p-0 mb-0 leading-none shrink-0"
          : "text-sm mb-4 hover:bg-gray-100 px-2 py-2 rounded-md"
      } ${className}`}
      onClick={handleBackClick}
      type="button"
      style={style}
    >
      <FiArrowLeft className={compact ? "h-5 w-5" : "h-6 w-6"} />
    </button>
  );
}

export default BackButton;
