import { deriveClinikoAppointmentStatus } from "@/utils/cliniko/clinikoAppointmentStatus";

/**
 * Normalizes Cliniko appointment records into job-list row shape
 * so they can be merged with PCI fleet jobs in the same table.
 */

const STATUS_TO_JOB = {
  Cancelled: "cancelled",
  "No Show": "cancelled",
  Completed: "completed",
  Confirmed: "confirmed",
  "Pending Review": "pending",
};

/** @param {object} appt Raw Cliniko individual_appointment */
export function clinikoAppointmentToJobRow(appt) {
  const id = appt?.id ?? appt?.links?.self?.split("/").pop();
  const patientName =
    appt?.patient_name ||
    appt?.patient?.name ||
    appt?.patient?.links?.self?.split("/").pop() ||
    "Cliniko patient";

  const derived = deriveClinikoAppointmentStatus(appt);
  const startsAt = appt?.starts_at || appt?.appointment_start || null;

  return {
    _id: `cliniko-${id}`,
    source: "cliniko",
    clinikoId: String(id),
    title:
      appt?.appointment_type?.name ||
      appt?.appointment_type_name ||
      "Cliniko appointment",
    description: appt?.notes || "",
    status: STATUS_TO_JOB[derived] || "scheduled",
    priority: "medium",
    orderType: "appointment",
    createdAt: startsAt || appt?.created_at || new Date().toISOString(),
    businessId: { name: appt?.business?.name || "Cliniko" },
    customerId: {
      basicInformation: { customerDisplayName: patientName },
    },
    _clinikoRaw: appt,
  };
}

/** @param {object[]} clinikoAppointments */
export function mapClinikoAppointmentsToJobRows(clinikoAppointments) {
  if (!Array.isArray(clinikoAppointments)) return [];
  return clinikoAppointments.map(clinikoAppointmentToJobRow);
}

/** @param {object} row */
export function isClinikoJobRow(row) {
  return row?.source === "cliniko" || String(row?._id || "").startsWith("cliniko-");
}
