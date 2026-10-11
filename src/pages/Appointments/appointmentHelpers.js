export const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

export const formatDateShort = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
};

export const formatTimeShort = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

export const statusPillClass = (status) => {
  switch (String(status).toLowerCase()) {
    case "cancelled":
    case "no show":
    case "declined":
    case "rejected":
    case "cancelled by patient":
      return "bg-rose-100 text-rose-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "confirmed":
      return "bg-cyan-100 text-cyan-800";
    case "pending review":
      return "bg-amber-100 text-amber-800";
    case "pending approval":
    case "pending admin approval":
      return "bg-orange-100 text-orange-800";
    case "reschedule requested":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

export const displayRequestStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "rejected" || s === "declined") return "Declined";
  if (s === "cancelled_by_patient" || s === "cancelled by patient") {
    return "Cancelled by Patient";
  }
  if (s === "reschedule_requested" || s === "reschedule requested") {
    return "Reschedule Requested";
  }
  if (s === "pending_admin_approval" || s === "pending admin approval") {
    return "Pending Admin Approval";
  }
  if (s === "pending" || s === "pending approval") return "Pending Approval";
  if (s === "confirmed") return "Confirmed";
  return status || "Pending Approval";
};

/** Newest activity first — prefer updated/created, then appointment time. */
export function appointmentRecencyMs(row) {
  const db = row?.db || row?.raw || row || {};
  const candidates = [
    row?.updatedAt,
    row?.createdAt,
    db?.updatedAt,
    db?.createdAt,
    row?.startsAt,
    db?.startsAt,
    db?.starts_at,
  ];
  let newest = 0;
  for (const value of candidates) {
    const t = new Date(value).getTime();
    if (!Number.isNaN(t) && t > newest) newest = t;
  }
  return newest;
}

/**
 * Match an appointment/request row to a PCI assigned business by ERP business id.
 */
export function rowMatchesAssignedBusiness(row, flexaBusiness) {
  if (!flexaBusiness) return true;
  const flexaId = String(flexaBusiness._id || flexaBusiness.id || "");
  if (!flexaId) return false;

  const rowFlexaId = String(
    row?.flexaBusinessId ||
      row?.db?.flexaBusinessId ||
      row?.raw?.flexaBusinessId ||
      row?.businessId ||
      row?.db?.businessId ||
      "",
  );

  if (rowFlexaId && rowFlexaId === flexaId) {
    return true;
  }

  return false;
}

/**
 * Scope appointment rows to assigned PCI businesses (by flexaBusinessId).
 */
export function filterRowsForAssignedBusinesses(
  rows,
  assignedBusinesses,
  { selectedBusinessId = "" } = {},
) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (!Array.isArray(assignedBusinesses) || !assignedBusinesses.length) {
    return rows;
  }

  const match = (row, business) => rowMatchesAssignedBusiness(row, business);

  if (selectedBusinessId) {
    const selected = assignedBusinesses.find(
      (b) => String(b._id) === String(selectedBusinessId),
    );
    if (!selected) return [];
    return rows.filter((row) => match(row, selected));
  }

  return rows.filter((row) =>
    assignedBusinesses.some((b) => match(row, b)),
  );
}

export function mergeBookingRequestMeta(targetRow, requestJson) {
  if (!requestJson) return targetRow;
  const mapped = mapRequestRow(requestJson, 0);
  return {
    ...targetRow,
    preferredSlots:
      mapped.preferredSlots?.length > 0
        ? mapped.preferredSlots
        : targetRow.preferredSlots || [],
    preferredSlotsHistory: mapped.preferredSlotsHistory || [],
    confirmedSlot: mapped.confirmedSlot || targetRow.confirmedSlot || null,
    appointmentDate: mapped.appointmentDate || targetRow.appointmentDate || null,
    flexaRequestId: mapped.flexaRequestId || targetRow.flexaRequestId || null,
    wonderkidsotRequestId:
      mapped.appointmentId || targetRow.wonderkidsotRequestId || null,
    bookingRequestStatus: mapped.status || targetRow.bookingRequestStatus || null,
    isBookingRequest: true,
    // Cliniko visit status (e.g. Completed) takes precedence over booking request status.
    status: targetRow.status || mapped.status,
    raw: {
      ...(targetRow.raw || {}),
      bookingRequest: requestJson,
    },
    db: {
      ...(targetRow.db || {}),
      ...(mapped.db || {}),
      bookingRequest: requestJson,
      preferredSlots:
        mapped.preferredSlots?.length > 0
          ? mapped.preferredSlots
          : targetRow.db?.preferredSlots || [],
      confirmedSlot: mapped.confirmedSlot || targetRow.db?.confirmedSlot || null,
    },
  };
}

export function indexRequestsByClinikoId(requests = []) {
  const map = new Map();
  for (const req of requests) {
    const clinikoId = req?.clinikoAppointmentId || req?.clinikoId || null;
    if (clinikoId) map.set(String(clinikoId), req);
  }
  return map;
}

export function findLinkedBookingRequest(
  requests = [],
  { clinikoId, flexaRequestId, wonderkidsotRequestId } = {},
) {
  if (!Array.isArray(requests) || !requests.length) return null;
  if (clinikoId) {
    const byCliniko = requests.find(
      (req) =>
        String(req?.clinikoAppointmentId || req?.clinikoId || "") ===
        String(clinikoId),
    );
    if (byCliniko) return byCliniko;
  }
  if (flexaRequestId) {
    const byFlexa = requests.find(
      (req) =>
        String(req?.flexaRequestId || req?.id || "") === String(flexaRequestId),
    );
    if (byFlexa) return byFlexa;
  }
  if (wonderkidsotRequestId) {
    const byWk = requests.find(
      (req) =>
        String(req?.wonderkidsotRequestId || req?.requestId || "") ===
        String(wonderkidsotRequestId),
    );
    if (byWk) return byWk;
  }
  return null;
}

export function slotStartsEqual(a, b) {
  if (!a || !b) return false;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  return !Number.isNaN(left) && !Number.isNaN(right) && left === right;
}

/** Resolve the Cliniko appointment id used for confirm/complete/cancel API calls. */
export function resolveClinikoAppointmentId(row) {
  const db = row?.db || row?.raw || row || {};
  const bookingRequest = db?.bookingRequest || db?.raw?.bookingRequest || null;
  return (
    row?.clinikoId ||
    db?.clinikoId ||
    db?.clinikoAppointmentId ||
    row?.clinikoAppointmentId ||
    bookingRequest?.clinikoAppointmentId ||
    bookingRequest?.clinikoId ||
    (row?.isBookingRequest ? null : row?.id) ||
    null
  );
}

export function mapRequestRow(req, index) {
  const flexaBusinessId =
    req?.flexaBusinessId || req?.businessId || null;
  const clinikoBusinessId =
    req?.clinikoBusinessId || req?.raw?.clinikoBusinessId || null;
  return {
    id: req?.flexaRequestId || req?.id || `request-${index}`,
    clinikoId: req?.clinikoAppointmentId || req?.clinikoId || null,
    appointmentId: req?.wonderkidsotRequestId || req?.requestId || "—",
    patient: req?.patientName || "—",
    service: req?.appointmentTypeName || "—",
    practitioner: req?.practitionerName || "—",
    practitionerId: req?.practitionerId || null,
    appointmentTypeId: req?.appointmentTypeId || null,
    business:
      req?.clinikoBusinessName || req?.businessName || "Cliniko",
    flexaBusinessId,
    businessId: flexaBusinessId,
    clinikoBusinessId,
    startsAt: req?.startsAt || null,
    endsAt: req?.endsAt || null,
    appointmentDate: req?.appointmentDate || null,
    preferredSlots: req?.preferredSlots || [],
    preferredSlotsHistory: req?.preferredSlotsHistory || [],
    confirmedSlot: req?.confirmedSlot || null,
    createdAt: req?.createdAt || null,
    updatedAt: req?.updatedAt || null,
    status: displayRequestStatus(req?.status),
    rejectionReason: req?.rejectionReason || null,
    cancelledBy: req?.cancelledBy || null,
    cancelledAt: req?.cancelledAt || null,
    proposedSlots: req?.proposedSlots || [],
    rescheduleMessage: req?.rescheduleMessage || null,
    raw: req,
    db: req,
    isBookingRequest: true,
    flexaRequestId: req?.flexaRequestId || req?.id,
    clinikoAppointmentId:
      req?.clinikoAppointmentId || req?.clinikoId || null,
  };
}

export function mapAppointmentRow(appt, index) {
  const raw = appt?.raw || appt;
  const practitionerFromRaw =
    raw?.practitioner_name ||
    (typeof raw?.practitioner === "string"
      ? raw.practitioner
      : raw?.practitioner?.name);
  const serviceFromRaw =
    raw?.appointment_type_name ||
    (typeof raw?.appointment_type === "string"
      ? raw.appointment_type
      : raw?.appointment_type?.name);

  return {
    id: appt?.clinikoId || appt?.id || `local-${index}`,
    appointmentId: appt?.clinikoId || appt?.id || "—",
    patient: appt?.patientName || appt?.patient_name || "—",
    service:
      appt?.appointmentTypeName ||
      appt?.appointment_type_name ||
      serviceFromRaw ||
      "—",
    practitioner:
      appt?.practitionerName ||
      appt?.practitioner_name ||
      practitionerFromRaw ||
      "—",
    practitionerId: appt?.practitionerId || raw?.practitionerId || null,
    appointmentTypeId:
      appt?.appointmentTypeId || raw?.appointmentTypeId || null,
    startsAt: appt?.startsAt || appt?.starts_at || null,
    endsAt: appt?.endsAt || appt?.ends_at || null,
    createdAt: appt?.createdAt || null,
    updatedAt: appt?.updatedAt || appt?.clinikoUpdatedAt || null,
    business:
      appt?.clinikoBusinessName ||
      appt?.businessName ||
      appt?.business?.name ||
      "Cliniko",
    flexaBusinessId:
      appt?.flexaBusinessId || appt?.businessId || null,
    businessId: appt?.flexaBusinessId || appt?.businessId || null,
    clinikoBusinessId:
      appt?.clinikoBusinessId ||
      appt?.business?.id ||
      raw?.clinikoBusinessId ||
      null,
    status: appt?.status || "Pending Review",
    raw,
    db: appt,
  };
}

export function getRowDetails(row) {
  const db = row?.db || row?.raw || row || {};
  const bookingRequest = db?.bookingRequest || null;
  const resolvedClinikoId = resolveClinikoAppointmentId(row);
  return {
    appointmentId: row?.appointmentId || db?.clinikoId || db?.id || "—",
    patient: row?.patient || db?.patientName || db?.patient_name || "—",
    service:
      row?.service ||
      db?.appointmentTypeName ||
      db?.appointment_type_name ||
      "—",
    practitioner:
      row?.practitioner || db?.practitionerName || db?.practitioner_name || "—",
    business:
      row?.business ||
      db?.clinikoBusinessName ||
      db?.businessName ||
      db?.business?.name ||
      "—",
    flexaBusinessId:
      row?.flexaBusinessId || db?.flexaBusinessId || db?.businessId || null,
    businessId:
      row?.flexaBusinessId || db?.flexaBusinessId || db?.businessId || null,
    clinikoBusinessId:
      row?.clinikoBusinessId ||
      db?.clinikoBusinessId ||
      db?.business?.id ||
      null,
    practitionerId: db?.practitionerId || row?.practitionerId || null,
    appointmentTypeId: db?.appointmentTypeId || row?.appointmentTypeId || null,
    startsAt: row?.startsAt || db?.startsAt || db?.starts_at || null,
    endsAt: row?.endsAt || db?.endsAt || db?.ends_at || null,
    appointmentDate: row?.appointmentDate || db?.appointmentDate || null,
    preferredSlots:
      row?.preferredSlots?.length > 0
        ? row.preferredSlots
        : db?.preferredSlots?.length > 0
          ? db.preferredSlots
          : row?.startsAt || db?.startsAt
            ? [{ startsAt: row?.startsAt || db?.startsAt, endsAt: row?.endsAt || db?.endsAt }]
            : [],
    preferredSlotsHistory:
      row?.preferredSlotsHistory || db?.preferredSlotsHistory || [],
    confirmedSlot: row?.confirmedSlot || db?.confirmedSlot || null,
    status: row?.status || db?.status || "—",
    notes: db?.notes || row?.notes || "",
    rejectionReason: row?.rejectionReason || db?.rejectionReason || null,
    cancelledBy: row?.cancelledBy || db?.cancelledBy || null,
    cancelledAt: row?.cancelledAt || db?.cancelledAt || null,
    proposedSlots: row?.proposedSlots || db?.proposedSlots || [],
    rescheduleMessage: row?.rescheduleMessage || db?.rescheduleMessage || null,
    isBookingRequest: !!row?.isBookingRequest,
    flexaRequestId: row?.flexaRequestId || db?.flexaRequestId || db?.id,
    clinikoId: resolvedClinikoId,
    clinikoAppointmentId:
      row?.clinikoAppointmentId ||
      db?.clinikoAppointmentId ||
      bookingRequest?.clinikoAppointmentId ||
      resolvedClinikoId ||
      null,
    raw: row?.raw || db?.raw || db,
  };
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function durationMs(startsAt, endsAt) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 60 * 60 * 1000;
  }
  return end - start;
}

export function appointmentDetailPath(row) {
  const id = row?.isBookingRequest
    ? row.flexaRequestId || row.id
    : row?.id || row?.appointmentId;
  const type = row?.isBookingRequest ? "request" : "appointment";
  return `/appointments/${encodeURIComponent(String(id))}?type=${type}`;
}
