import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  clearCustomerSession,
  getCustomerAccount,
  setCustomerSession,
} from "../utils/session";

/**
 * The signed-in customer portal session.
 * Persists token + account in localStorage so refresh keeps the portal open.
 */
const AccountContext = createContext(null);

function normalizeAccount(account) {
  if (!account) return null;
  const name = account.name || "Customer";
  return {
    ...account,
    name,
    email: account.email || "",
    initials:
      account.initials ||
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") ||
      "PC",
    unreadNotifications: account.unreadNotifications ?? 0,
  };
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(() =>
    normalizeAccount(getCustomerAccount()),
  );

  const signIn = useCallback((session) => {
    const next = normalizeAccount(session?.account || session);
    setCustomerSession({
      token: session?.token,
      account: next,
    });
    setAccount(next);
  }, []);

  const signOut = useCallback(() => {
    clearCustomerSession();
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({
      account,
      isAuthenticated: Boolean(account),
      signIn,
      signOut,
    }),
    [account, signIn, signOut],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used inside an AccountProvider");
  }
  // Back-compat: screens that read fields directly from useAccount().
  // Memoize so callers don't get a new object every render (that would
  // retrigger effects that list `account` as a dependency).
  return useMemo(() => {
    if (context.account) {
      return { ...context.account, ...context };
    }
    return context;
  }, [context]);
}

export default AccountContext;
