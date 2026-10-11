import React, { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Calendar, Check, Clock3, Loader2, Stethoscope } from "lucide-react";
import { CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import ClinikoServices from "@/services/ClinikoServices";
import {
  durationMs,
  formatDateTime,
  formatTimeShort,
} from "@/pages/Appointments/appointmentHelpers";

/** Cliniko cancellation reasons — PATCH /individual_appointments/{id}/cancel */
const CANCELLATION_REASONS = [
  { value: 10, label: "Feeling better" },
  { value: 20, label: "Condition worse" },
  { value: 30, label: "Sick" },
  { value: 40, label: "Away" },
  { value: 50, label: "Other" },
  { value: 60, label: "Work" },
];

function extractLinkId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value?.id || value?.links?.self?.split("/").pop() || null;
}

function resolveAppointmentContext(jobRow, appointmentContext) {
  const appt = jobRow?._appointment || jobRow?._clinikoRaw || {};
  const flexaBusinessId =
    appointmentContext?.flexaBusinessId ||
    appointmentContext?.businessId ||
    appt.flexaBusinessId ||
    appt.businessId ||
    null;
  const clinikoBusinessId =
    appointmentContext?.clinikoBusinessId ||
    appt.clinikoBusinessId ||
    appt.business?.id ||
    null;
  return {
    flexaBusinessId,
    businessId: flexaBusinessId,
    clinikoBusinessId,
    practitionerId:
      appointmentContext?.practitionerId ||
      appt.practitionerId ||
      extractLinkId(appt.practitioner) ||
      null,
    appointmentTypeId:
      appointmentContext?.appointmentTypeId ||
      appt.appointmentTypeId ||
      extractLinkId(appt.appointment_type) ||
      null,
    practitioner:
      appointmentContext?.practitioner ||
      appt.practitionerName ||
      appt.practitioner_name ||
      appt.practitioner?.name ||
      "Practitioner",
    service:
      appointmentContext?.service ||
      appt.appointmentTypeName ||
      appt.appointment_type_name ||
      "—",
    startsAt:
      appointmentContext?.startsAt || appt.startsAt || appt.starts_at || null,
    endsAt: appointmentContext?.endsAt || appt.endsAt || appt.ends_at || null,
  };
}

/**
 * Confirm / complete / edit / reschedule / cancel — persisted via PCI BE (DB + Cliniko).
 */
const ClinikoAppointmentActionsModal = ({
  open,
  onClose,
  jobRow,
  appointmentContext = null,
  mode = "edit", // "confirm" | "complete" | "edit" | "reschedule" | "cancel"
  onSuccess,
}) => {
  const raw = jobRow?._clinikoRaw || jobRow?._appointment || {};
  const clinikoId =
    jobRow?.clinikoId ||
    raw?.clinikoId ||
    raw?.clinikoAppointmentId ||
    raw?.id ||
    null;
  const context = useMemo(
    () => resolveAppointmentContext(jobRow, appointmentContext),
    [jobRow, appointmentContext],
  );

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 90), "yyyy-MM-dd");

  const toLocalInput = (value) => {
    const d = value ? new Date(value) : new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const toDateInput = (value) => {
    const d = value ? new Date(value) : new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [startsAt, setStartsAt] = useState(() =>
    toLocalInput(context.startsAt || raw?.starts_at || raw?.startsAt),
  );
  const [preferredDate, setPreferredDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState(null);
  const [notes, setNotes] = useState(raw?.notes || "");
  const [cancellationReason, setCancellationReason] = useState(50);
  const [cancellationNote, setCancellationNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canFetchSlots = Boolean(
    context.flexaBusinessId &&
      context.clinikoBusinessId &&
      context.practitionerId &&
      context.appointmentTypeId,
  );

  useEffect(() => {
    if (!open) return;
    setStartsAt(toLocalInput(context.startsAt || raw?.starts_at || raw?.startsAt));
    setPreferredDate(toDateInput(context.startsAt || raw?.starts_at || raw?.startsAt));
    setSelectedSlot(null);
    setAvailableSlots([]);
    setSlotError(null);
    setLoadingSlots(false);
    setNotes(raw?.notes || "");
    setCancellationReason(50);
    setCancellationNote("");
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, clinikoId]);

  useEffect(() => {
    if (!open || mode !== "reschedule" || !preferredDate || !canFetchSlots) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSlotError(null);
    setSelectedSlot(null);

    ClinikoServices.getAvailableTimes({
      businessId: context.flexaBusinessId,
      clinikoBusinessId: context.clinikoBusinessId,
      practitionerId: context.practitionerId,
      appointmentTypeId: context.appointmentTypeId,
      date: preferredDate,
    })
      .then((res) => {
        if (cancelled) return;
        setAvailableSlots(Array.isArray(res?.slots) ? res.slots : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setAvailableSlots([]);
        setSlotError(
          err?.response?.data?.message ||
            err?.message ||
            "Could not load available times",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    mode,
    preferredDate,
    canFetchSlots,
    context.flexaBusinessId,
    context.clinikoBusinessId,
    context.practitionerId,
    context.appointmentTypeId,
  ]);

  const visitLengthMs = durationMs(context.startsAt, context.endsAt);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!clinikoId) {
      notifyError("Appointment id missing");
      return;
    }

    setSubmitting(true);
    try {
      const businessId = context.flexaBusinessId || context.businessId;
      if (mode === "cancel") {
        await ClinikoServices.cancelAppointment(clinikoId, {
          reason: cancellationReason,
          note: cancellationNote.trim() || undefined,
          businessId,
        });
        notifySuccess("Appointment cancelled");
      } else if (mode === "confirm") {
        await ClinikoServices.confirmAppointment(clinikoId, businessId);
        notifySuccess("Visit confirmed");
      } else if (mode === "complete") {
        await ClinikoServices.completeAppointment(clinikoId, businessId);
        notifySuccess("Appointment marked as completed");
      } else if (mode === "reschedule") {
        let nextStartsAt;
        let nextEndsAt;

        if (canFetchSlots) {
          if (!selectedSlot?.startsAt) {
            notifyError("Select an available time for this practitioner");
            setSubmitting(false);
            return;
          }
          nextStartsAt = new Date(selectedSlot.startsAt).toISOString();
          nextEndsAt = selectedSlot.endsAt
            ? new Date(selectedSlot.endsAt).toISOString()
            : new Date(
                new Date(selectedSlot.startsAt).getTime() + visitLengthMs,
              ).toISOString();
        } else {
          nextStartsAt = new Date(startsAt).toISOString();
          nextEndsAt = new Date(
            new Date(startsAt).getTime() + visitLengthMs,
          ).toISOString();
        }

        await ClinikoServices.rescheduleAppointment(clinikoId, {
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          businessId,
        });
        notifySuccess("Appointment rescheduled");
      } else {
        await ClinikoServices.updateNotes(clinikoId, notes, businessId);
        notifySuccess("Notes updated");
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Action failed";
      if (err?.response?.data?.code === "CLINIKO_RATE_LIMIT") {
        notifyError("Cliniko rate limit reached, try again shortly");
      } else {
        notifyError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const titles = {
    confirm: "Confirm visit",
    complete: "Mark as completed",
    edit: "Edit notes",
    reschedule: "Reschedule appointment",
    cancel: "Cancel appointment",
  };

  const isConfirmLike = mode === "confirm" || mode === "complete";
  const canSubmitReschedule = canFetchSlots ? Boolean(selectedSlot?.startsAt) : Boolean(startsAt);

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={titles[mode] || titles.edit}
      width={mode === "reschedule" && canFetchSlots ? "600px" : "440px"}
      showActions={false}
    >
      {isConfirmLike ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {mode === "confirm" &&
              "Confirm this visit so the family knows the appointment is approved."}
            {mode === "complete" &&
              "Mark this appointment as completed when the patient has attended."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--p-blue)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? "Saving…"
                : mode === "confirm"
                  ? "Confirm visit"
                  : "Mark completed"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700"
            >
              Keep appointment
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "cancel" && (
            <>
              <p className="text-sm text-gray-600">
                Choose a cancellation reason and add an optional note. This
                follows the same process as cancelling in your practice system.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation reason
                </label>
                <select
                  value={cancellationReason}
                  onChange={(e) =>
                    setCancellationReason(Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                >
                  {CANCELLATION_REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note for the family (optional)
                </label>
                <textarea
                  value={cancellationNote}
                  onChange={(e) => setCancellationNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Add a short message if needed..."
                />
              </div>
            </>
          )}

          {mode === "reschedule" && canFetchSlots && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 overflow-hidden">
              <div className="flex items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {context.practitioner}
                  </p>
                  {context.service !== "—" ? (
                    <p className="mt-0.5 text-xs text-gray-500">{context.service}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 p-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Choose a new date and time. The visit length stays the same as
                  the original appointment.
                </p>

                <div>
                  <label
                    htmlFor="cliniko-reschedule-date"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800"
                  >
                    <Calendar className="h-4 w-4 text-gray-400" />
                    Date
                  </label>
                  <input
                    id="cliniko-reschedule-date"
                    type="date"
                    min={minDate}
                    max={maxDate}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/25"
                    disabled={submitting}
                    required
                  />
                </div>

                {preferredDate ? (
                  <div>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">
                        Available times
                        <span className="ml-1.5 font-normal text-gray-500">
                          ·{" "}
                          {format(
                            new Date(`${preferredDate}T12:00:00`),
                            "EEE, d MMM yyyy",
                          )}
                        </span>
                      </p>
                      {!loadingSlots && availableSlots.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                          {availableSlots.length} open
                        </span>
                      ) : null}
                    </div>

                    {loadingSlots && (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        Loading open slots…
                      </div>
                    )}

                    {slotError && !loadingSlots && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {slotError}
                      </div>
                    )}

                    {!loadingSlots &&
                      !slotError &&
                      availableSlots.length === 0 && (
                        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-6 text-center">
                          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Clock3 className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-semibold text-amber-950">
                            No open slots on this day
                          </p>
                          <p className="mt-1 text-xs text-amber-800/90">
                            Try another date for {context.practitioner}.
                          </p>
                        </div>
                      )}

                    {!loadingSlots && availableSlots.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot) => {
                          const active =
                            selectedSlot?.startsAt &&
                            new Date(selectedSlot.startsAt).getTime() ===
                              new Date(slot.startsAt).getTime();
                          return (
                            <button
                              key={slot.startsAt}
                              type="button"
                              disabled={submitting}
                              onClick={() => setSelectedSlot(slot)}
                              className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-all ${
                                active
                                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                                  : "border-gray-200 bg-white text-gray-800 hover:border-blue-200 hover:bg-blue-50"
                              }`}
                            >
                              {formatTimeShort(slot.startsAt)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                {selectedSlot?.startsAt && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        New appointment time
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900">
                        {formatDateTime(selectedSlot.startsAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "reschedule" && !canFetchSlots && (
            <div>
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Practitioner availability could not be loaded — pick a date and
                time manually.
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New date and time
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                The visit length will stay the same as the original appointment.
              </p>
            </div>
          )}

          {mode === "edit" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={
                submitting || (mode === "reschedule" && !canSubmitReschedule)
              }
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl text-white disabled:opacity-50 ${
                mode === "cancel"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-[var(--p-blue)] hover:opacity-90"
              }`}
            >
              {submitting
                ? "Saving…"
                : mode === "cancel"
                  ? "Cancel appointment"
                  : mode === "reschedule"
                    ? "Confirm reschedule"
                    : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              {mode === "cancel" ? "Keep appointment" : "Close"}
            </button>
          </div>
        </form>
      )}
    </CustomModal>
  );
};

export default ClinikoAppointmentActionsModal;
