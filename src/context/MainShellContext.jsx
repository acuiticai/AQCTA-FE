import { createContext, useContext } from "react";

/**
 * When true, page content is already inside the main app Layout
 * (sidebar + header). Nested AppLayout / Header wrappers should no-op.
 */
export const MainShellContext = createContext(false);

export function useMainShell() {
  return useContext(MainShellContext);
}
