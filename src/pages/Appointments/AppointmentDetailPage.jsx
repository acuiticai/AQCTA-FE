import { useCallback, useEffect, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import {
  Calendar,
  Edit,
  CalendarClock,
  XCircle,
  Building2,
  Stethoscope,
  CheckCircle2,
  Clock3,
  Check,
  Loader2,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { CustomModal, Loader, PageHeader } from "@/page-layouts";
import ClinikoServices from "@/services/ClinikoServices";
import ClinikoAppointmentActionsModal from "@/pages/FleetManagement/ClinikoAppointmentActionsModal";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  formatDateTime,
  formatDateShort,
  formatTimeShort,
  statusPillClass,
  mapRequestRow,
  mapAppointmentRow,
  getRowDetails,
  mergeBookingRequestMeta,
  findLinkedBookingRequest,
  slotStartsEqual,
  resolveClinikoAppointmentId,
  durationMs,
} from "./appointmentHelpers";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

function statusIcon(status) {
  switch (String(status).toLowerCase()) {
    case "cancelled":
    case "no show":
    case "declined":
    case "rejected":
    case "cancelled by patient":
      return XCircle;
    case "completed":
      return CheckCircle2;
    case "confirmed":
      return Check;
    default:
      return Clock3;
  }
}

function DeclineBookingModal({
  open,
  row,
  mode,
  onModeChange,
  reason,
  onReasonChange,
  slots,
  onSlotsChange,
  onClose,
  onConfirm,
  loading,
}) {
  const details = row ? getRowDetails(row) : null;
  const isReschedule = mode === "reschedule";
  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 90), "yyyy-MM-dd");

  const [preferredDate, setPreferredDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState(null);

  const canFetchSlots = Boolean(
    details?.flexaBusinessId &&
    details?.clinikoBusinessId &&
    details?.practitionerId &&
    details?.appointmentTypeId,
  );

  useEffect(() => {
    if (!open) {
      setPreferredDate("");
      setAvailableSlots([]);
      setSlotError(null);
      setLoadingSlots(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isReschedule || !preferredDate || !canFetchSlots) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSlotError(null);
    ClinikoServices.getAvailableTimes({
      businessId: details.flexaBusinessId,
      clinikoBusinessId: details.clinikoBusinessId,
      practitionerId: details.practitionerId,
      appointmentTypeId: details.appointmentTypeId,
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
    isReschedule,
    preferredDate,
    canFetchSlots,
    details?.flexaBusinessId,
    details?.clinikoBusinessId,
    details?.practitionerId,
    details?.appointmentTypeId,
  ]);

  if (!open || !row || !details) return null;

  const lengthMs = durationMs(details.startsAt, details.endsAt);

  const toggleSlot = (slot) => {
    const startsAt = slot.startsAt;
    const endsAt =
      slot.endsAt ||
      new Date(new Date(startsAt).getTime() + lengthMs).toISOString();
    const exists = (slots || []).some(
      (s) => new Date(s.startsAt).getTime() === new Date(startsAt).getTime(),
    );
    if (exists) {
      onSlotsChange(
        (slots || []).filter(
          (s) =>
            new Date(s.startsAt).getTime() !== new Date(startsAt).getTime(),
        ),
      );
      return;
    }
    onSlotsChange([...(slots || []), { startsAt, endsAt }]);
  };

  const removeSelected = (startsAt) => {
    onSlotsChange(
      (slots || []).filter(
        (s) => new Date(s.startsAt).getTime() !== new Date(startsAt).getTime(),
      ),
    );
  };

  const canSubmit = isReschedule
    ? (slots || []).some((s) => s?.startsAt)
    : true;

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={isReschedule ? "Propose new times" : "Decline this booking?"}
      width="600px"
      zIndex={10000}
      showActions
      actions={[
        {
          label: "Keep booking",
          secondary: true,
          onClick: onClose,
          disabled: loading,
        },
        {
          label: loading
            ? isReschedule
              ? "Sending…"
              : "Declining…"
            : isReschedule
              ? "Send reschedule options"
              : "Decline booking",
          failure: !isReschedule,
          onClick: onConfirm,
          disabled: loading || !canSubmit,
        },
      ]}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          Choose how to handle the booking for{" "}
          <span className="font-semibold text-gray-900">{details.patient}</span>
          {details.service !== "—" ? (
            <>
              {" "}
              ({details.service}
              {details.startsAt ? ` · ${formatDateTime(details.startsAt)}` : ""}
              )
            </>
          ) : null}
          .
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => onModeChange("decline")}
            className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
              !isReschedule
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="font-semibold block">Decline booking</span>
            <span className="text-xs opacity-80">
              Reject this request and notify the family
            </span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onModeChange("reschedule")}
            className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
              isReschedule
                ? "border-violet-300 bg-violet-50 text-violet-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="font-semibold block">Request reschedule</span>
            <span className="text-xs opacity-80">
              Propose open times for{" "}
              {details.practitioner || "this practitioner"}
            </span>
          </button>
        </div>

        {isReschedule ? (
          <>
            {!canFetchSlots ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Missing practitioner, service, or location on this request —
                cannot load Cliniko availability.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {details.practitioner || "Practitioner"}
                      </p>
                      {details.service !== "—" ? (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {details.service}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                        Pick a day, then choose open Cliniko slots to send to
                        the family.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <label
                      htmlFor="reschedule-date"
                      className="block text-sm font-semibold text-gray-800 mb-1.5"
                    >
                      1. Choose a date
                    </label>
                    <input
                      id="reschedule-date"
                      type="date"
                      min={minDate}
                      max={maxDate}
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full max-w-xs rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/25"
                      disabled={loading}
                    />
                  </div>
                </div>

                {preferredDate ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">
                        2. Available times on{" "}
                        {format(
                          new Date(`${preferredDate}T12:00:00`),
                          "EEE, d MMM yyyy",
                        )}
                      </p>
                      {!loadingSlots && availableSlots.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {availableSlots.length} open
                        </span>
                      ) : null}
                    </div>

                    {loadingSlots && (
                      <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
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
                        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-5 text-center">
                          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Clock3 className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-semibold text-amber-950">
                            No open slots on this day
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
                            Try another date for{" "}
                            {details.practitioner || "this practitioner"}.
                          </p>
                        </div>
                      )}

                    {!loadingSlots && availableSlots.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableSlots.map((slot) => {
                          const active = (slots || []).some(
                            (s) =>
                              new Date(s.startsAt).getTime() ===
                              new Date(slot.startsAt).getTime(),
                          );
                          return (
                            <button
                              key={slot.startsAt}
                              type="button"
                              disabled={loading}
                              onClick={() => toggleSlot(slot)}
                              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                                active
                                  ? "border-violet-400 bg-violet-100 text-violet-950 ring-2 ring-violet-200"
                                  : "border-gray-200 bg-white text-gray-800 hover:border-violet-200 hover:bg-violet-50/50"
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

                {(slots || []).length > 0 && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 space-y-2">
                    <p className="text-sm font-semibold text-violet-950">
                      Selected for family ({slots.length})
                    </p>
                    <ul className="space-y-1.5">
                      {slots.map((slot) => (
                        <li
                          key={slot.startsAt}
                          className="flex items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-gray-900">
                            {formatDateTime(slot.startsAt)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelected(slot.startsAt)}
                            disabled={loading}
                            className="text-rose-600 hover:underline text-xs font-semibold shrink-0"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="pt-1">
              <label
                htmlFor="reschedule-message"
                className="block text-sm font-semibold text-gray-800 mb-1.5"
              >
                Message for the family{" "}
                <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="reschedule-message"
                rows={3}
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="e.g. That slot is full — please choose one of these alternatives."
                className="box-border w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/25 resize-y min-h-[88px]"
                disabled={loading}
              />
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="decline-reason"
              className="block text-sm font-semibold text-gray-800 mb-1.5"
            >
              Message for the family{" "}
              <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. That time is no longer available — please choose another slot."
              className="box-border w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/25 resize-y min-h-[88px]"
              disabled={loading}
            />
          </div>
        )}
      </div>
    </CustomModal>
  );
}

const emptyDeclineModal = {
  open: false,
  mode: "decline",
  reason: "",
  slots: [],
};

function ApproveBookingModal({
  open,
  row,
  selectedSlotIndex,
  onSelectSlot,
  onClose,
  onConfirm,
  loading,
  slotError,
}) {
  const details = row ? getRowDetails(row) : null;
  const preferredSlots = details?.preferredSlots || [];

  if (!open || !row || !details) return null;

  const canSubmit =
    preferredSlots.length <= 1 ||
    (Number.isInteger(selectedSlotIndex) && selectedSlotIndex >= 0);

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title="Confirm booking"
      width="560px"
      zIndex={10000}
      showActions
      actions={[
        {
          label: "Cancel",
          secondary: true,
          onClick: onClose,
          disabled: loading,
        },
        {
          label: loading ? "Confirming…" : "Confirm in Cliniko",
          onClick: onConfirm,
          disabled: loading || !canSubmit,
        },
      ]}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          Choose one of the patient&apos;s preferred time slots to create the
          Cliniko appointment for{" "}
          <span className="font-semibold text-gray-900">{details.patient}</span>
          .
        </p>

        {slotError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {slotError}
          </div>
        ) : null}

        {preferredSlots.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No preferred slots found on this request.
          </div>
        ) : (
          <ul className="space-y-2">
            {preferredSlots.map((slot, index) => {
              const active = selectedSlotIndex === index;
              return (
                <li key={`${slot.startsAt}-${index}`}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelectSlot(index)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      active
                        ? "border-emerald-400 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200"
                        : "border-gray-200 bg-white text-gray-800 hover:border-emerald-200 hover:bg-emerald-50/40"
                    }`}
                  >
                    <span className="font-semibold block">
                      Option {index + 1}
                    </span>
                    <span className="mt-0.5 block text-gray-600">
                      {formatDateTime(slot.startsAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-gray-500">
          Availability is checked with Cliniko immediately before the
          appointment is created. If the selected slot is no longer open, choose
          another option or request a reschedule.
        </p>
      </div>
    </CustomModal>
  );
}

export default function AppointmentDetailPage() {
  const history = useHistory();
  const location = useLocation();
  const { appointmentId } = useParams();
  const queryType = new URLSearchParams(location.search).get("type");

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [declineModal, setDeclineModal] = useState(emptyDeclineModal);
  const [approveModal, setApproveModal] = useState({
    open: false,
    selectedSlotIndex: 0,
    slotError: null,
  });
  const [actionModal, setActionModal] = useState({
    open: false,
    mode: "edit",
  });

  const loadAppointment = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    try {
      const decodedId = decodeURIComponent(appointmentId);
      const preferRequest = queryType === "request";

      const [apptRes, requestRes] = await Promise.all([
        ClinikoServices.listAppointments({ limit: 500 }),
        ClinikoServices.listAppointmentRequests({ status: "all" }).catch(
          () => ({ requests: [] }),
        ),
      ]);
      const allRequests = requestRes?.requests || [];

      const request =
        findLinkedBookingRequest(allRequests, {
          flexaRequestId: decodedId,
          wonderkidsotRequestId: decodedId,
          clinikoId: decodedId,
        }) ||
        allRequests.find(
          (r) =>
            String(r.flexaRequestId) === String(decodedId) ||
            String(r.id) === String(decodedId) ||
            String(r.wonderkidsotRequestId) === String(decodedId) ||
            String(r.requestId) === String(decodedId),
        );

      if (request && (preferRequest || queryType !== "appointment")) {
        const linkedAppt = (apptRes?.appointments || []).find(
          (a) =>
            String(a.clinikoId || a.id) ===
            String(request.clinikoAppointmentId || request.clinikoId || ""),
        );
        if (linkedAppt) {
          const apptRow = mapAppointmentRow(linkedAppt, 0);
          setRow(mergeBookingRequestMeta(apptRow, request));
          return;
        }
        setRow(mapRequestRow(request, 0));
        return;
      }

      const appt = (apptRes?.appointments || []).find(
        (a) =>
          String(a.clinikoId) === String(decodedId) ||
          String(a.id) === String(decodedId),
      );
      if (appt) {
        const linkedRequest = findLinkedBookingRequest(allRequests, {
          clinikoId: appt.clinikoId || appt.id,
        });
        const apptRow = mapAppointmentRow(appt, 0);
        setRow(
          linkedRequest
            ? mergeBookingRequestMeta(apptRow, linkedRequest)
            : apptRow,
        );
        return;
      }

      if (request) {
        const linkedAppt = (apptRes?.appointments || []).find(
          (a) =>
            String(a.clinikoId || a.id) ===
            String(request.clinikoAppointmentId || request.clinikoId || ""),
        );
        if (linkedAppt) {
          const apptRow = mapAppointmentRow(linkedAppt, 0);
          setRow(mergeBookingRequestMeta(apptRow, request));
          return;
        }
        setRow(mapRequestRow(request, 0));
        return;
      }

      setRow(null);
      notifyError("Appointment not found");
    } catch (err) {
      setRow(null);
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load appointment",
      );
    } finally {
      setLoading(false);
    }
  }, [appointmentId, queryType]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const openApprove = () => {
    const details = getRowDetails(row);
    const preferredSlots = details?.preferredSlots || [];
    setApproveModal({
      open: true,
      selectedSlotIndex: preferredSlots.length === 1 ? 0 : null,
      slotError: null,
    });
  };

  const closeApprove = () => {
    if (actionLoading) return;
    setApproveModal({ open: false, selectedSlotIndex: 0, slotError: null });
  };

  const handleApprove = async () => {
    const details = getRowDetails(row);
    const preferredSlots = details?.preferredSlots || [];
    if (preferredSlots.length > 1 && !approveModal.open) {
      openApprove();
      return;
    }
    await confirmApprove();
  };

  const confirmApprove = async () => {
    const requestId = row?.flexaRequestId || row?.id;
    const businessId = row?.flexaBusinessId || row?.businessId;
    const details = getRowDetails(row);
    const preferredSlots = details?.preferredSlots || [];
    if (!requestId) return;

    const slotIndex =
      preferredSlots.length <= 1 ? 0 : approveModal.selectedSlotIndex;
    if (
      preferredSlots.length > 1 &&
      (!Number.isInteger(slotIndex) || slotIndex < 0)
    ) {
      notifyError("Select one of the patient's preferred time slots");
      return;
    }

    const selectedSlot = preferredSlots[slotIndex];
    setActionLoading(true);
    setApproveModal((prev) => ({ ...prev, slotError: null }));
    try {
      await ClinikoServices.approveAppointmentRequest(requestId, {
        businessId,
        slotIndex,
        startsAt: selectedSlot?.startsAt,
        endsAt: selectedSlot?.endsAt,
      });
      notifySuccess("Booking accepted and added to the schedule");
      setApproveModal({ open: false, selectedSlotIndex: 0, slotError: null });
      await loadAppointment();
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || "Approval failed";
      if (err?.response?.status === 409) {
        setApproveModal((prev) => ({
          ...prev,
          open: true,
          slotError: message,
        }));
      } else {
        notifyError(message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openDecline = () => {
    setDeclineModal({
      open: true,
      mode: "decline",
      reason: "",
      slots: [],
    });
  };

  const closeDecline = () => {
    if (actionLoading) return;
    setDeclineModal(emptyDeclineModal);
  };

  const confirmDecline = async () => {
    const requestId = row?.flexaRequestId || row?.id;
    if (!requestId) return;

    if (declineModal.mode === "reschedule") {
      const details = getRowDetails(row);
      const lengthMs = durationMs(details.startsAt, details.endsAt);
      const proposedSlots = (declineModal.slots || [])
        .filter((slot) => slot?.startsAt)
        .map((slot) => ({
          startsAt: new Date(slot.startsAt).toISOString(),
          endsAt: new Date(
            slot.endsAt || new Date(slot.startsAt).getTime() + lengthMs,
          ).toISOString(),
        }));

      if (proposedSlots.length === 0) {
        notifyError("Select at least one available time for this practitioner");
        return;
      }
      if (
        proposedSlots.some((slot) =>
          Number.isNaN(new Date(slot.startsAt).getTime()),
        )
      ) {
        notifyError("One or more proposed times are invalid");
        return;
      }

      setActionLoading(true);
      try {
        await ClinikoServices.requestAppointmentReschedule(requestId, {
          proposedSlots,
          message: declineModal.reason.trim(),
          businessId:
            details.flexaBusinessId || row?.flexaBusinessId || row?.businessId,
        });
        notifySuccess("Reschedule options sent to the patient");
        setDeclineModal(emptyDeclineModal);
        await loadAppointment();
      } catch (err) {
        notifyError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to request reschedule",
        );
      } finally {
        setActionLoading(false);
      }
      return;
    }

    setActionLoading(true);
    try {
      await ClinikoServices.rejectAppointmentRequest(requestId, {
        reason: declineModal.reason.trim(),
        businessId: row?.flexaBusinessId || row?.businessId,
      });
      notifySuccess("Booking declined. The family has been notified.");
      setDeclineModal(emptyDeclineModal);
      await loadAppointment();
    } catch (err) {
      notifyError(
        err?.response?.data?.message || err?.message || "Decline failed",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openAction = (mode) => {
    setActionModal({ open: true, mode });
  };

  if (loading) {
    return <Loader fullContainer color="var(--p-blue)" />;
  }

  if (!row) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <PageHeader
          title="Appointment details"
          showBackButton
          onBackClick={() => history.push("/appointments")}
          backFallbackPath="/appointments"
        />
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-base font-semibold text-gray-900">
            Appointment not found
          </p>
          <p className="mt-2 text-sm text-gray-500">
            It may have been removed or the link is invalid.
          </p>
          <button
            type="button"
            onClick={() => history.push("/appointments")}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--p-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            Back to appointments
          </button>
        </div>
      </div>
    );
  }

  const details = getRowDetails(row);
  const StatusIcon = statusIcon(details.status);
  const isCancelled =
    details.status === "Cancelled" || details.status === "No Show";
  const isCancelledByPatient = details.status === "Cancelled by Patient";
  const isDeclined =
    details.status === "Declined" || details.status === "Rejected";
  const isCompleted = details.status === "Completed";
  const isPendingApproval =
    details.isBookingRequest &&
    (details.status === "Pending Approval" ||
      details.status === "Pending Admin Approval");
  const isRescheduleRequested =
    details.isBookingRequest && details.status === "Reschedule Requested";
  const isPendingReview =
    !details.isBookingRequest && details.status === "Pending Review";
  const isConfirmed = details.status === "Confirmed";
  const preferredSlots = details.preferredSlots || [];
  const hasPreferredSlots = preferredSlots.length > 0;
  const confirmedStartsAt =
    details.confirmedSlot?.startsAt || (isConfirmed ? details.startsAt : null);
  const actionClinikoId = resolveClinikoAppointmentId(row);
  const canManageClinikoAppointment = Boolean(actionClinikoId);
  const canReschedule =
    !isCancelled &&
    !isCancelledByPatient &&
    !isCompleted &&
    !details.isBookingRequest;
  const canCancel =
    !isCancelled &&
    !isCancelledByPatient &&
    !isCompleted &&
    !details.isBookingRequest;

  const hasActions =
    isPendingApproval ||
    isPendingReview ||
    isConfirmed ||
    canReschedule ||
    canCancel ||
    (!details.isBookingRequest &&
      !isCancelled &&
      !isCancelledByPatient &&
      !isCompleted);

  const actionBtnBase =
    "inline-flex w-full items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const infoTiles = [
    {
      label: "Date",
      value: formatDateShort(details.startsAt),
      Icon: Calendar,
    },
    {
      label: isConfirmed ? "Confirmed time" : "Time",
      value: details.endsAt
        ? `${formatTimeShort(details.startsAt)} – ${formatTimeShort(details.endsAt)}`
        : formatTimeShort(details.startsAt),
      Icon: Clock3,
    },
    {
      label: "Practitioner",
      value: details.practitioner,
      Icon: Stethoscope,
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Location",
            value: details.business,
            Icon: Building2,
          },
        ]
      : []),
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-14">
      <PageHeader
        title="Appointment details"
        description="Review booking information and take action"
        showBackButton
        onBackClick={() => history.push("/appointments")}
        backFallbackPath="/appointments"
      />

      <div className="mt-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 sm:px-8 py-6 sm:py-7 bg-gradient-to-br from-slate-50 via-white to-orange-50/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Patient
              </p>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-gray-900 break-words">
                {details.patient}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
                {details.service}
                {details.practitioner !== "—"
                  ? ` with ${details.practitioner}`
                  : ""}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                {details.isBookingRequest
                  ? "WonderKidsOT booking request"
                  : "Scheduled Cliniko visit"}
              </p>
            </div>
            <span
              className={`inline-flex self-start items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold shrink-0 ${statusPillClass(
                details.status,
              )}`}
            >
              <StatusIcon className="w-4 h-4" />
              {details.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-t border-gray-100">
          {infoTiles.map(({ label, value, Icon }, index) => (
            <div
              key={label}
              className={`px-5 sm:px-6 py-5 ${
                index > 0 ? "border-t border-gray-100 sm:border-t-0" : ""
              } ${index % 2 === 1 ? "sm:border-l sm:border-gray-100" : ""} ${
                index >= 2 ? "sm:border-t sm:border-gray-100 xl:border-t-0" : ""
              } ${index === 2 || index === 3 ? "xl:border-l xl:border-gray-100" : ""}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-gray-400" />
                {label}
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900 break-words leading-relaxed">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 sm:px-7 py-6">
            <h3 className="text-base font-semibold text-gray-900">Notes</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words min-h-[72px]">
              {details.notes?.trim()
                ? details.notes
                : "No notes added for this appointment."}
            </p>
          </section>

          {hasPreferredSlots && (
            <section
              className={`rounded-2xl border shadow-sm px-5 sm:px-7 py-6 space-y-4 ${
                isPendingApproval
                  ? "border-orange-200 bg-orange-50/70"
                  : "border-slate-200 bg-slate-50/70"
              }`}
            >
              <h3
                className={`text-base font-semibold ${
                  isPendingApproval ? "text-orange-950" : "text-slate-900"
                }`}
              >
                Patient preferred times
                {preferredSlots.length > 1
                  ? ` (${preferredSlots.length} options)`
                  : ""}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  isPendingApproval ? "text-orange-900" : "text-slate-700"
                }`}
              >
                {isPendingApproval
                  ? "Select one slot when confirming. These are preferences only no Cliniko appointment exists until you accept."
                  : isConfirmed
                    ? "The patient submitted these preferred times. The confirmed visit is highlighted below."
                    : "Preferred times submitted by the patient for this booking request."}
              </p>
              <ul className="space-y-2.5">
                {preferredSlots.map((slot, index) => {
                  const isConfirmedSlot = slotStartsEqual(
                    slot.startsAt,
                    confirmedStartsAt,
                  );
                  return (
                    <li
                      key={`${slot.startsAt}-${index}`}
                      className={`rounded-xl border px-4 py-3.5 text-sm font-medium ${
                        isConfirmedSlot
                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                          : isPendingApproval
                            ? "bg-white border-orange-100 text-orange-950"
                            : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      Option {index + 1}: {formatDateTime(slot.startsAt)}
                      {slot.endsAt ? ` – ${formatTimeShort(slot.endsAt)}` : ""}
                      {isConfirmedSlot ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          Confirmed
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {isRescheduleRequested && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/70 shadow-sm px-5 sm:px-7 py-6 space-y-4">
              <h3 className="text-base font-semibold text-violet-950">
                Proposed alternatives
              </h3>
              {details.rescheduleMessage?.trim() && (
                <p className="text-sm leading-relaxed text-violet-900 whitespace-pre-wrap">
                  {details.rescheduleMessage}
                </p>
              )}
              <ul className="space-y-2.5">
                {(details.proposedSlots || []).map((slot, index) => (
                  <li
                    key={`${slot.startsAt}-${index}`}
                    className="rounded-xl bg-white border border-violet-100 px-4 py-3.5 text-sm font-medium text-violet-950"
                  >
                    Option {index + 1}: {formatDateTime(slot.startsAt)}
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-relaxed text-violet-700">
                Waiting for the patient to accept, decline, or propose another
                time.
              </p>
            </section>
          )}

          {isDeclined && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/70 shadow-sm px-5 sm:px-7 py-6">
              <h3 className="text-base font-semibold text-rose-950">
                Decline reason
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-rose-900 whitespace-pre-wrap break-words">
                {details.rejectionReason?.trim()
                  ? details.rejectionReason
                  : "No reason was provided."}
              </p>
            </section>
          )}

          {isCancelledByPatient && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/70 shadow-sm px-5 sm:px-7 py-6">
              <h3 className="text-base font-semibold text-rose-950">
                Cancelled by patient
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-rose-900">
                The family cancelled this booking request
                {details.cancelledAt
                  ? ` on ${formatDateTime(details.cancelledAt)}`
                  : ""}
                . No further action is needed from the clinic.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 sm:px-7 py-6">
            <h3 className="text-base font-semibold text-gray-900">
              Reference details
            </h3>
            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {details.isBookingRequest
                    ? "WonderKids request ID"
                    : "Cliniko appointment ID"}
                </dt>
                <dd className="mt-1.5 text-sm font-medium text-gray-900 break-all">
                  {details.appointmentId}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type
                </dt>
                <dd className="mt-1.5 text-sm font-medium text-gray-900">
                  {details.isBookingRequest
                    ? "New booking request"
                    : "Scheduled visit"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Patient
                </dt>
                <dd className="mt-1.5 text-sm font-medium text-gray-900 break-words">
                  {details.patient}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Service
                </dt>
                <dd className="mt-1.5 text-sm font-medium text-gray-900 break-words">
                  {details.service}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="lg:col-span-1">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 sm:px-6 py-6 lg:sticky lg:top-6">
            <h3 className="text-base font-semibold text-gray-900">
              Manage appointment
            </h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              {isPendingApproval
                ? "Accept to confirm in Cliniko, or decline to reject or propose new times."
                : isRescheduleRequested
                  ? "Alternative times have been sent. Actions unlock once the patient responds."
                  : isPendingReview
                    ? "Confirm the visit so the family knows the appointment is approved."
                    : hasActions
                      ? "Update this appointment status or details."
                      : "No actions available for this appointment."}
            </p>

            {hasActions ? (
              <div className="mt-5 flex flex-col gap-3">
                {isPendingApproval && (
                  <>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className={`${actionBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
                    >
                      <Check className="w-4 h-4" />
                      Accept booking
                    </button>
                    <button
                      type="button"
                      onClick={openDecline}
                      disabled={actionLoading}
                      className={`${actionBtnBase} bg-white text-rose-700 border border-rose-200 hover:bg-rose-50`}
                    >
                      <XCircle className="w-4 h-4" />
                      Decline booking
                    </button>
                  </>
                )}

                {isPendingReview && canManageClinikoAppointment && (
                  <button
                    type="button"
                    onClick={() => openAction("confirm")}
                    disabled={actionLoading}
                    className={`${actionBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
                  >
                    <Check className="w-4 h-4" />
                    Confirm visit
                  </button>
                )}

                {(isPendingReview ||
                  (isConfirmed && canManageClinikoAppointment)) && (
                  <button
                    type="button"
                    onClick={() => openAction("complete")}
                    disabled={actionLoading || !canManageClinikoAppointment}
                    className={`${actionBtnBase} bg-teal-600 text-white hover:bg-teal-700`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as completed
                  </button>
                )}

                {canReschedule && canManageClinikoAppointment && (
                  <button
                    type="button"
                    onClick={() => openAction("reschedule")}
                    disabled={actionLoading}
                    className={`${actionBtnBase} bg-white text-blue-700 border border-blue-200 hover:bg-blue-50`}
                  >
                    <CalendarClock className="w-4 h-4" />
                    Reschedule
                  </button>
                )}

                {!details.isBookingRequest &&
                  !isCancelled &&
                  !isCancelledByPatient &&
                  !isCompleted && (
                    <button
                      type="button"
                      onClick={() => openAction("edit")}
                      disabled={actionLoading}
                      className={`${actionBtnBase} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50`}
                    >
                      <Edit className="w-4 h-4" />
                      Edit notes
                    </button>
                  )}

                {canCancel && (
                  <button
                    type="button"
                    onClick={() => openAction("cancel")}
                    disabled={actionLoading}
                    className={`${actionBtnBase} bg-white text-rose-700 border border-rose-200 hover:bg-rose-50`}
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel appointment
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                Nothing to do right now.
              </div>
            )}
          </section>
        </div>
      </div>

      <ApproveBookingModal
        open={approveModal.open}
        row={row}
        selectedSlotIndex={approveModal.selectedSlotIndex}
        onSelectSlot={(index) =>
          setApproveModal((prev) => ({
            ...prev,
            selectedSlotIndex: index,
            slotError: null,
          }))
        }
        onClose={closeApprove}
        onConfirm={confirmApprove}
        loading={actionLoading}
        slotError={approveModal.slotError}
      />

      <DeclineBookingModal
        open={declineModal.open}
        row={row}
        mode={declineModal.mode}
        onModeChange={(mode) => setDeclineModal((prev) => ({ ...prev, mode }))}
        reason={declineModal.reason}
        onReasonChange={(reason) =>
          setDeclineModal((prev) => ({ ...prev, reason }))
        }
        slots={declineModal.slots}
        onSlotsChange={(slots) =>
          setDeclineModal((prev) => ({ ...prev, slots }))
        }
        onClose={closeDecline}
        onConfirm={confirmDecline}
        loading={actionLoading}
      />

      <ClinikoAppointmentActionsModal
        open={actionModal.open}
        mode={actionModal.mode}
        jobRow={{
          clinikoId: actionClinikoId,
          _clinikoRaw: row?.raw,
          _appointment: row?.db || row?.raw,
          source: "cliniko",
        }}
        appointmentContext={{
          flexaBusinessId: details.flexaBusinessId,
          businessId: details.flexaBusinessId,
          clinikoBusinessId: details.clinikoBusinessId,
          practitionerId: details.practitionerId,
          appointmentTypeId: details.appointmentTypeId,
          practitioner: details.practitioner,
          service: details.service,
          startsAt: details.startsAt,
          endsAt: details.endsAt,
        }}
        onClose={() => setActionModal({ open: false, mode: "edit" })}
        onSuccess={async () => {
          setActionModal({ open: false, mode: "edit" });
          await loadAppointment();
        }}
      />
    </div>
  );
}
