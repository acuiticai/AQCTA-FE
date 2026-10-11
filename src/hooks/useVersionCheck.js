import { useState, useEffect, useCallback } from "react";

/**
 * Same source as VersionInfo.jsx: build-time version and deploy date.
 * Prefer CI-provided VITE_APP_* envs, but always fall back to build-time
 * constants injected from vite.config so production deployments are never "null".
 */
const CURRENT_VERSION =
  import.meta.env.VITE_APP_VERSION ?? __APP_VERSION__ ?? null;
const CURRENT_DEPLOY_DATE =
  import.meta.env.VITE_APP_DEPLOY_DATE ?? __APP_DEPLOY_DATE__ ?? null;

// Run version check in production as long as a deploy date was baked in at build time.
// CURRENT_DEPLOY_DATE always has a value (vite.config injects new Date().toISOString()
// at build time via __APP_DEPLOY_DATE__), so this is true on every production build
// without needing to manually set VITE_APP_VERSION in CI.
const VERSION_CHECK_ENABLED =
  import.meta.env.PROD && Boolean(CURRENT_DEPLOY_DATE);

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const VERSION_JSON_URL = "/version.json";

/**
 * Fetches the currently deployed app version and deploy date (same data as VersionInfo, but from server).
 * After a new deploy, this returns the new version/deployDate so we can show the update modal.
 */
async function fetchDeployedVersion() {
  try {
    const url = `${VERSION_JSON_URL}?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      version: data?.version ?? null,
      deployDate: data?.deployDate ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * True when the server has a different version or deploy date (new deployment).
 * Requires a real current version (no fallback) so we never trigger on localhost/dev.
 */
function hasNewDeployment(current, deployed) {
  if (!deployed || !current.version) return false;
  if (deployed.version && deployed.version !== current.version) return true;
  if (
    deployed.deployDate &&
    current.deployDate &&
    deployed.deployDate !== current.deployDate
  )
    return true;
  return false;
}

/**
 * Hook to detect when a new app version is deployed (same version/deployDate as VersionInfo).
 * Runs on mount (after short delay), on window focus, and every 5 min.
 * When user logs in or opens any page, App is mounted so the check runs.
 * @returns {{ showUpdateModal: boolean, newVersion: string | null, dismissUpdate: () => void }}
 */
export function useVersionCheck() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newVersion, setNewVersion] = useState(null);

  const checkVersion = useCallback(async () => {
    if (!VERSION_CHECK_ENABLED) return;
    const deployed = await fetchDeployedVersion();
    const current = {
      version: CURRENT_VERSION,
      deployDate: CURRENT_DEPLOY_DATE,
    };
    if (hasNewDeployment(current, deployed)) {
      setNewVersion(deployed.version ?? "new");
      setShowUpdateModal(true);
    }
  }, []);

  useEffect(() => {
    if (!VERSION_CHECK_ENABLED) return;
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL_MS);
    const onFocus = () => checkVersion();
    window.addEventListener("focus", onFocus);
    const t = setTimeout(checkVersion, 1500);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      clearTimeout(t);
    };
  }, [checkVersion]);

  const dismissUpdate = useCallback(() => {
    setShowUpdateModal(false);
    setNewVersion(null);
  }, []);

  return { showUpdateModal, newVersion, dismissUpdate };
}

export { CURRENT_VERSION, CURRENT_DEPLOY_DATE, VERSION_CHECK_ENABLED };
