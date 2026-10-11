/**
 * Centralized localStorage helpers for Cliniko integration data.
 * All keys store a JSON object scoped by logged-in admin user id:
 *   { [adminId]: <value> }
 *
 * Nothing outside this file should read/write cliniko_* keys directly.
 */

const STORAGE_KEYS = {
  credentials: "cliniko_credentials",
  settings: "cliniko_settings",
  appointments: "cliniko_appointments",
  syncMap: "cliniko_sync_map",
};

/** @returns {string | null} */
export function getClinikoAdminId() {
  try {
    const raw = localStorage.getItem("adminInfo");
    if (!raw) return null;
    const info = JSON.parse(raw);
    const id = info?.id ?? info?._id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

/**
 * @template T
 * @param {string} key
 * @returns {T | null}
 */
function readScoped(key) {
  try {
    const adminId = getClinikoAdminId();
    if (!adminId) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const store = JSON.parse(raw);
    if (!store || typeof store !== "object") return null;
    return store[adminId] ?? null;
  } catch {
    return null;
  }
}

/**
 * @template T
 * @param {string} key
 * @param {T} value
 * @returns {boolean}
 */
function writeScoped(key, value) {
  try {
    const adminId = getClinikoAdminId();
    if (!adminId) return false;
    let store = {};
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") store = parsed;
    }
    store[adminId] = value;
    localStorage.setItem(key, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} key */
function clearScoped(key) {
  try {
    const adminId = getClinikoAdminId();
    if (!adminId) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const store = JSON.parse(raw);
    if (!store || typeof store !== "object") return;
    delete store[adminId];
    if (Object.keys(store).length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(store));
    }
  } catch {
    // ignore
  }
}

// --- Credentials: { apiKey, shard, businessName, connectedAt } ---

export function getClinikoCredentials() {
  return readScoped(STORAGE_KEYS.credentials);
}

/** @param {{ apiKey: string, shard: string, businessName?: string, connectedAt?: string }} creds */
export function setClinikoCredentials(creds) {
  return writeScoped(STORAGE_KEYS.credentials, {
    ...creds,
    connectedAt: creds.connectedAt || new Date().toISOString(),
  });
}

export function clearClinikoCredentials() {
  clearScoped(STORAGE_KEYS.credentials);
}

export function isClinikoConnected() {
  const creds = getClinikoCredentials();
  return !!(creds?.apiKey && creds?.shard);
}

// --- Settings: { syncAppointments, syncPatients, syncPractitioners, syncDirection, syncFrequency, lastSyncedAt? } ---

const DEFAULT_SETTINGS = {
  syncAppointments: true,
  syncPatients: false,
  syncPractitioners: false,
  syncDirection: "read-only",
  syncFrequency: "manual",
  lastSyncedAt: null,
};

export function getClinikoSettings() {
  const stored = readScoped(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

/** @param {Partial<typeof DEFAULT_SETTINGS>} settings */
export function setClinikoSettings(settings) {
  const current = getClinikoSettings();
  return writeScoped(STORAGE_KEYS.settings, { ...current, ...settings });
}

export function clearClinikoSettings() {
  clearScoped(STORAGE_KEYS.settings);
}

// --- Appointments: array of Cliniko appointment objects ---

export function getClinikoAppointments() {
  const data = readScoped(STORAGE_KEYS.appointments);
  return Array.isArray(data) ? data : [];
}

/** @param {object[]} appointments */
export function setClinikoAppointments(appointments) {
  return writeScoped(
    STORAGE_KEYS.appointments,
    Array.isArray(appointments) ? appointments : [],
  );
}

/** @param {string|number} clinikoId */
export function upsertClinikoAppointment(appointment) {
  const list = getClinikoAppointments();
  const id = String(appointment?.id ?? "");
  if (!id) return false;
  const idx = list.findIndex((a) => String(a?.id) === id);
  const next = [...list];
  if (idx >= 0) next[idx] = appointment;
  else next.push(appointment);
  return setClinikoAppointments(next);
}

export function clearClinikoAppointments() {
  clearScoped(STORAGE_KEYS.appointments);
}

// --- Sync map: array of { clinikoAppointmentId, flexaAppointmentId } ---

export function getClinikoSyncMap() {
  const data = readScoped(STORAGE_KEYS.syncMap);
  return Array.isArray(data) ? data : [];
}

/** @param {{ clinikoAppointmentId: string|number, flexaAppointmentId: string|number }[]} map */
export function setClinikoSyncMap(map) {
  return writeScoped(STORAGE_KEYS.syncMap, Array.isArray(map) ? map : []);
}

export function clearClinikoSyncMap() {
  clearScoped(STORAGE_KEYS.syncMap);
}

/** Clears all Cliniko localStorage data for the current admin user. */
export function clearAllClinikoData() {
  clearClinikoCredentials();
  clearClinikoSettings();
  clearClinikoAppointments();
  clearClinikoSyncMap();
}
