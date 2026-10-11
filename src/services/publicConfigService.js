import axios from "axios";

const baseURL = import.meta.env.VITE_APP_API_BASE_URL;

let cachedConfig = null;
let loadPromise = null;
let loadError = null;

const normalizeConfig = (data) => {
  const emailUser = String(data?.EMAIL_USER || "").trim();
  const emailFromName = String(data?.EMAIL_FROM_NAME || "").trim();
  const emailCcRaw = String(data?.EMAIL_CC || "").trim();
  const emailCc = emailCcRaw || emailUser;

  return {
    emailUser,
    emailFromName,
    emailCc,
    EMAIL_USER: emailUser,
    EMAIL_FROM_NAME: emailFromName,
    EMAIL_CC: emailCc,
  };
};

const fetchPublicConfig = async () => {
  const url = baseURL
    ? `${String(baseURL).replace(/\/$/, "")}/public-config`
    : "/api/public-config";

  const response = await axios.get(url, {
    validateStatus: (status) => status >= 200 && status < 600,
  });

  if (response.status !== 200 || !response.data) {
    const message =
      response.data?.message ||
      `Failed to load email configuration (HTTP ${response.status})`;
    throw new Error(message);
  }

  return normalizeConfig(response.data);
};

/**
 * Load and cache public email config from the backend.
 * Subsequent calls return the same cached promise/result.
 */
export const ensurePublicEmailConfigLoaded = async () => {
  if (cachedConfig) return cachedConfig;
  if (loadPromise) return loadPromise;

  loadPromise = fetchPublicConfig()
    .then((config) => {
      if (!config.emailUser) {
        throw new Error(
          "Email sender address is not configured on the server (EMAIL_USER).",
        );
      }
      cachedConfig = config;
      loadError = null;
      return config;
    })
    .catch((error) => {
      loadError = error;
      loadPromise = null;
      throw error;
    });

  return loadPromise;
};

export const getCachedPublicEmailConfig = () => cachedConfig;

export const getPublicEmailConfigLoadError = () => loadError;

export const clearPublicEmailConfigCache = () => {
  cachedConfig = null;
  loadPromise = null;
  loadError = null;
};
