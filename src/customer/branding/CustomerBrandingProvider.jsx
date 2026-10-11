import React, { createContext, useContext, useMemo } from "react";

import brandConfig, { brandTokens } from "./brand.config";

const CustomerBrandingContext = createContext(brandConfig);

/**
 * Converts the flat token map into inline CSS custom properties.
 * `bg` -> `--epc-bg`, so tokens stay readable in both JS and CSS.
 */
export function tokensToCssVars(tokens) {
  return Object.entries(tokens).reduce((vars, [key, value]) => {
    vars[`--epc-${key}`] = value;
    return vars;
  }, {});
}

/**
 * Wraps every customer-portal screen. Publishes the branding tokens on the
 * portal root element rather than on `:root`, so the admin application keeps
 * its own theme untouched even when both are mounted in the same document.
 */
export default function CustomerBrandingProvider({
  children,
  tokenOverrides,
  identityOverrides,
  panelCopyOverrides,
  className = "",
}) {
  const value = useMemo(
    () => ({
      ...brandConfig,
      identity: { ...brandConfig.identity, ...(identityOverrides || {}) },
      panelCopy: { ...brandConfig.panelCopy, ...(panelCopyOverrides || {}) },
      tokens: { ...brandTokens, ...(tokenOverrides || {}) },
    }),
    [tokenOverrides, identityOverrides, panelCopyOverrides],
  );

  const style = useMemo(() => tokensToCssVars(value.tokens), [value.tokens]);

  return (
    <CustomerBrandingContext.Provider value={value}>
      <div className={`epc-root ${className}`.trim()} style={style}>
        {children}
      </div>
    </CustomerBrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(CustomerBrandingContext);
}
