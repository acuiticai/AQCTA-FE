/** Same marker WonderKidsOT clinic uses when confirming in Cliniko notes. */
export const CLINIKO_CONFIRMED_MARKER = "[Confirmed by clinic]";

/**
 * Derive appointment lifecycle status from a raw Cliniko individual_appointment.
 * Mirrors WonderKidsOT `deriveAppointmentStatus` so both apps stay in sync via Cliniko.
 *
 * @param {object} appointment
 * @returns {"Cancelled"|"No Show"|"Completed"|"Confirmed"|"Pending Review"}
 */
export function deriveClinikoAppointmentStatus(appointment) {
  if (appointment?.cancelled_at || appointment?.cancellation_reason) {
    return "Cancelled";
  }
  if (appointment?.did_not_arrive) {
    return "No Show";
  }
  if (appointment?.patient_arrived || appointment?.arrived_at) {
    return "Completed";
  }
  if (String(appointment?.notes || "").includes(CLINIKO_CONFIRMED_MARKER)) {
    return "Confirmed";
  }
  return "Pending Review";
}

/**
 * @param {string} existingNotes
 * @returns {string}
 */
export function withConfirmedMarker(existingNotes = "") {
  const notes = String(existingNotes || "");
  if (notes.includes(CLINIKO_CONFIRMED_MARKER)) return notes;
  return `${CLINIKO_CONFIRMED_MARKER} ${notes}`.trim();
}
