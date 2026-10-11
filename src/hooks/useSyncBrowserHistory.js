import { useEffect, useLayoutEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";

/**
 * Keep React Router in sync when the browser URL changes but the router
 * context lags (browser Back/Forward, especially Edge).
 * Used in AppShell for public auth routes and in Layout for app routes.
 */
export function useSyncBrowserHistory() {
  const history = useHistory();
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const browserPath = `${window.location.pathname}${window.location.search}`;
    const routerPath = `${history.location.pathname}${history.location.search}`;
    if (browserPath !== routerPath) {
      history.replace(browserPath);
    }
  }, [history, location.pathname, location.search]);

  useEffect(() => {
    const onPopState = () => {
      if (typeof window === "undefined") return;
      const browserPath = `${window.location.pathname}${window.location.search}`;
      const routerPath = `${history.location.pathname}${history.location.search}`;
      if (browserPath !== routerPath) {
        history.replace(browserPath);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [history]);
}

export default useSyncBrowserHistory;
