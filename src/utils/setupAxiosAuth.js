import axios from "axios";
import Cookies from "js-cookie";
import { clearSessionAssignedBusinesses } from "@/utils/sessionAssignedBusinesses";
import { clearSessionApiCache } from "@/utils/sessionApiCache";
import {
  patchAdminInfoSubscriptionStatus,
  getSubscriptionRedirectPath,
  isResubscribeRoute,
} from "@/utils/subscriptionRedirect";

const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";

const apiBaseURL = (import.meta.env.VITE_APP_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

export function storeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  try {
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  } catch (_) {
    /* ignore */
  }
}

export function getStoredRefreshToken() {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

export function clearStoredRefreshToken() {
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}

export function updateStoredAccessToken(newToken, newRefreshToken) {
  if (!newToken) return;
  try {
    const raw = localStorage.getItem("adminInfo");
    if (raw) {
      const adminInfo = JSON.parse(raw);
      adminInfo.token = newToken;
      localStorage.setItem("adminInfo", JSON.stringify(adminInfo));
    }
  } catch (_) {
    /* ignore parse errors */
  }
  if (newRefreshToken) {
    storeRefreshToken(newRefreshToken);
  }
}

export function clearAuthSession() {
  Cookies.remove("token");
  Cookies.remove("refreshToken");
  Cookies.remove("adminData");
  Cookies.remove("fcm_token");
  Cookies.remove("session_expired");
  Cookies.remove("adminInfo");
  localStorage.removeItem("adminInfo");
  localStorage.removeItem("businesses");
  clearSessionAssignedBusinesses();
  clearSessionApiCache();
  localStorage.removeItem("token");
  localStorage.removeItem("session_expired");
  localStorage.removeItem("fcm_token");
  sessionStorage.removeItem("token");
  clearStoredRefreshToken();
}

function isAuthEndpoint(url = "") {
  const normalized = String(url).toLowerCase();
  return (
    normalized.includes("/admin/login") ||
    normalized.includes("/admin/refresh-token") ||
    normalized.includes("/admin/logout")
  );
}

function shouldAttemptRefresh(error) {
  const status = error?.response?.status;
  if (status !== 401) return false;
  const url = error?.config?.url || "";
  if (isAuthEndpoint(url)) return false;
  if (error?.config?._retry) return false;
  return Boolean(
    localStorage.getItem("adminInfo") || getStoredRefreshToken(),
  );
}

function handleSubscriptionGateError(error) {
  const status = error?.response?.status;
  if (status !== 403) return false;

  const data = error?.response?.data || {};
  const code = data.code;
  if (
    code !== "SUBSCRIPTION_CANCELLED" &&
    code !== "SUBSCRIPTION_PENDING" &&
    code !== "SUBSCRIPTION_EXPIRED"
  ) {
    return false;
  }

  const path = window.location?.pathname || "";
  if (path === "/login" || path.startsWith("/onboarding/")) {
    return false;
  }
  // Expired tenants are allowed to stay on Billing to renew.
  if (code === "SUBSCRIPTION_EXPIRED" && isResubscribeRoute(path)) {
    patchAdminInfoSubscriptionStatus("Expired");
    return true;
  }

  if (code === "SUBSCRIPTION_CANCELLED") {
    patchAdminInfoSubscriptionStatus("Cancelled");
  } else if (code === "SUBSCRIPTION_PENDING") {
    patchAdminInfoSubscriptionStatus("Pending");
  } else if (code === "SUBSCRIPTION_EXPIRED") {
    patchAdminInfoSubscriptionStatus("Expired");
  }

  const redirectPath =
    data.redirectPath ||
    getSubscriptionRedirectPath(
      JSON.parse(localStorage.getItem("adminInfo") || "{}"),
    );

  const redirectBase = String(redirectPath || "").split("?")[0];
  if (
    typeof window !== "undefined" &&
    redirectBase &&
    !isResubscribeRoute(window.location.pathname) &&
    !window.location.pathname.startsWith(redirectBase)
  ) {
    window.location.href = redirectPath;
  }

  return true;
}

export function setupAxiosAuthInterceptor() {
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (handleSubscriptionGateError(error)) {
        return Promise.reject(error);
      }

      const originalRequest = error.config;
      if (!shouldAttemptRefresh(error)) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axios(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshUrl = apiBaseURL
          ? `${apiBaseURL}/admin/refresh-token`
          : "/admin/refresh-token";
        const storedRefresh = getStoredRefreshToken();
        const response = await axios.post(
          refreshUrl,
          storedRefresh ? { refreshToken: storedRefresh } : {},
          { withCredentials: true },
        );
        const newToken = response.data?.token;
        const newRefreshToken = response.data?.refreshToken;
        if (!newToken) {
          throw new Error("No token in refresh response");
        }

        updateStoredAccessToken(newToken, newRefreshToken);
        processQueue(null, newToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthSession();
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/login")
        ) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    },
  );
}
