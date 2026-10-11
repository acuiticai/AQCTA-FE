import requests from "./httpService";

/** Resolve PCI business id from explicit arg, URL, or session. */
export function resolveClinikoBusinessId(explicitId) {
  if (explicitId) return String(explicitId);
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("selectedOrg");
  if (fromUrl) return fromUrl;
  const fromSession = sessionStorage.getItem("settingsSelectedOrg");
  if (fromSession) return fromSession;
  return null;
}

function withBusinessQuery(params = {}, businessId) {
  const id = resolveClinikoBusinessId(businessId ?? params?.businessId);
  if (!id) return params;
  return { ...params, businessId: id };
}

function withBusinessBody(payload = {}, businessId) {
  const id = resolveClinikoBusinessId(businessId ?? payload?.businessId);
  if (!id) return payload;
  return { ...payload, businessId: id, flexaBusinessId: id };
}

function scopedPath(path, businessId) {
  const id = resolveClinikoBusinessId(businessId);
  if (!id) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}businessId=${encodeURIComponent(id)}`;
}

/**
 * Cliniko integration — credentials & appointments live on the server (DB).
 * Pass businessId (PCI business) on scoped calls, or set ?selectedOrg= in Settings.
 */
const ClinikoServices = {
  /** Pre-save API key test */
  testConnection(payload) {
    return requests.post("/cliniko/test-connection", payload);
  },

  getConnection(businessId) {
    return requests.get("/cliniko/connection", {
      params: withBusinessQuery({}, businessId),
    });
  },

  /** @param {{ apiKey: string, shard?: string, businessName?: string, businessId?: string }} payload */
  saveConnection(payload) {
    return requests.post("/cliniko/connection", withBusinessBody(payload));
  },

  /** @param {{ syncAppointments?: boolean, silentSyncEnabled?: boolean, silentSyncIntervalMinutes?: number, businessId?: string }} payload */
  updateSettings(payload = {}) {
    const { businessId, ...body } = payload;
    return requests.patch(scopedPath("/cliniko/connection/settings", businessId), body);
  },

  disconnect(businessId) {
    return requests.delete(scopedPath("/cliniko/connection", businessId));
  },

  /**
   * Sync from Cliniko into DB.
   * @param {{ fromDate?: string, full?: boolean, businessId?: string }} [payload]
   */
  sync(payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(scopedPath("/cliniko/sync", businessId), body);
  },

  /** List appointments from DB — optional businessId filters to one PCI business */
  listAppointments(params = {}) {
    return requests.get("/cliniko/appointments", {
      params: withBusinessQuery(params),
    });
  },

  /**
   * Delete PCI-local appointments + booking requests for scoped business(es).
   */
  clearLocalAppointments(businessId) {
    return requests.delete(scopedPath("/cliniko/appointments/local", businessId));
  },

  /** List practitioners from DB */
  listPractitioners(params = {}) {
    return requests.get("/cliniko/practitioners", {
      params: withBusinessQuery(params),
    });
  },

  /** Practitioner profile with availability from Cliniko */
  getPractitionerDetails(id, businessId) {
    return requests.get(`/cliniko/practitioners/${id}`, {
      params: withBusinessQuery({}, businessId),
    });
  },

  /**
   * Available Cliniko slots for a practitioner + appointment type on a date.
   * @param {{ businessId: string, clinikoBusinessId?: string, practitionerId: string, appointmentTypeId: string, date: string }} params
   */
  getAvailableTimes(params = {}) {
    return requests.get("/cliniko/available-times", {
      params: withBusinessQuery(params),
    });
  },

  /** Sync practitioners from Cliniko into DB */
  syncPractitioners(payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(scopedPath("/cliniko/practitioners/sync", businessId), body);
  },

  listAppointmentRequests(params = {}) {
    return requests.get("/cliniko/appointment-requests", {
      params: withBusinessQuery(params),
    });
  },

  approveAppointmentRequest(id, payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(
      scopedPath(`/cliniko/appointment-requests/${id}/approve`, businessId),
      body,
    );
  },

  rejectAppointmentRequest(id, payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(
      scopedPath(`/cliniko/appointment-requests/${id}/reject`, businessId),
      body,
    );
  },

  /** @param {{ proposedSlots: Array<{startsAt: string, endsAt: string}>, message?: string, businessId?: string }} payload */
  requestAppointmentReschedule(id, payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(
      scopedPath(`/cliniko/appointment-requests/${id}/request-reschedule`, businessId),
      body,
    );
  },

  confirmAppointment(id, businessId) {
    return requests.post(
      scopedPath(`/cliniko/appointments/${id}/confirm`, businessId),
      withBusinessBody({}, businessId),
    );
  },

  completeAppointment(id, businessId) {
    return requests.post(
      scopedPath(`/cliniko/appointments/${id}/complete`, businessId),
      withBusinessBody({}, businessId),
    );
  },

  /** @param {{ startsAt: string, endsAt?: string, businessId?: string }} payload */
  rescheduleAppointment(id, payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(
      scopedPath(`/cliniko/appointments/${id}/reschedule`, businessId),
      withBusinessBody(body, businessId),
    );
  },

  /** @param {{ reason?: number, note?: string, businessId?: string }} payload */
  cancelAppointment(id, payload = {}) {
    const { businessId, ...body } = payload;
    return requests.post(
      scopedPath(`/cliniko/appointments/${id}/cancel`, businessId),
      withBusinessBody(body, businessId),
    );
  },

  updateNotes(id, notes, businessId) {
    return requests.patch(
      scopedPath(`/cliniko/appointments/${id}/notes`, businessId),
      withBusinessBody({ notes }, businessId),
    );
  },
};

export default ClinikoServices;
