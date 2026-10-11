import React from "react";

const ACCENT_COLOR = "var(--p-blue)";
const ACCENT_LIGHT = "color-mix(in srgb, var(--p-blue) 12%, transparent)";

/**
 * Clears all caches (Cache API, optional storage) and performs a hard reload.
 * Unregisters service workers so the next load fetches fresh assets.
 */
export function clearCachesAndReload() {
  const unregisterWorkers = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
  };

  const clearCaches = () => {
    if ("caches" in window) {
      return caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      });
    }
    return Promise.resolve();
  };

  unregisterWorkers();
  clearCaches().then(() => {
    // Force reload without using cache
    window.location.reload();
  });
}

const VersionUpdateModal = ({ isOpen, onLater, newVersion }) => {
  if (!isOpen) return null;

  const handleReload = () => {
    clearCachesAndReload();
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-update-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onLater}
        onKeyDown={(e) => e.key === "Escape" && onLater()}
        role="button"
        tabIndex={0}
        aria-label="Close"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          {/* Icon circle - accent color */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: ACCENT_LIGHT }}
          >
            <svg
              className="h-6 w-6"
              style={{ color: ACCENT_COLOR }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="version-update-title"
              className="text-lg font-semibold text-gray-900"
            >
              New version available
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              A new version of the app is available. Please reload and clear
              cache to get the latest updates.
            </p>
            {newVersion && (
              <p className="mt-2 text-sm font-medium text-gray-700">
                New version: {newVersion}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onLater}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: ACCENT_COLOR }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleReload}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT_COLOR }}
          >
            Reload & clear cache
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionUpdateModal;
