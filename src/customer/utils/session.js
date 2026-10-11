const CUSTOMER_TOKEN_KEY = "customerToken";
const CUSTOMER_ACCOUNT_KEY = "customerAccount";

export function getCustomerToken() {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getCustomerAccount() {
  try {
    const raw = localStorage.getItem(CUSTOMER_ACCOUNT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCustomerSession({ token, account }) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token || "");
  localStorage.setItem(CUSTOMER_ACCOUNT_KEY, JSON.stringify(account || {}));
}

export function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_ACCOUNT_KEY);
}

export function isCustomerAuthenticated() {
  return Boolean(getCustomerToken() && getCustomerAccount());
}
