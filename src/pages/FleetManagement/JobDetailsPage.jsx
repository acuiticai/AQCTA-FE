import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Calendar, Loader2, MapPin, User } from "lucide-react";
import { PageHeader } from "@/page-layouts/index";
import { notifyError } from "@/utils/toast";
import FleetManagementServices from "@/services/FleetManagementServices";
import { formatDate, getConfig } from "@/components/formatAmount";
import {
  billingDocIdPrefix,
  jobBillingDocumentTitle,
} from "@/utils/fleetJobBillingLabels";
import {
  computeFleetJobLineSummary,
  fleetJobLineItemLabel,
  fleetJobLineSecondaryDescriptionOnly,
  fleetJobLineUnitRate,
} from "@/utils/fleetJobLineDisplay";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import { useContext } from "react";
import { AdminContext } from "@/context/AdminContext";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import { getModuleRoutePath } from "@/utils/moduleLabels";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

function assignmentDateDisplay(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return formatDate(d);
  return String(value);
}

/** Simple text-only status for a clean admin look */
function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-gray-100 text-gray-800",
    info: "bg-blue-50 text-blue-800",
    success: "bg-green-50 text-green-800",
    warn: "bg-amber-50 text-amber-900",
    danger: "bg-red-50 text-red-800",
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${t}`}>
      {children}
    </span>
  );
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "success";
  if (s === "cancelled") return "danger";
  if (s === "in_progress") return "warn";
  if (s === "assigned") return "info";
  if (s === "confirmed") return "info";
  return "neutral";
}

function priorityTone(p) {
  const x = String(p || "").toLowerCase();
  if (x === "high") return "danger";
  if (x === "medium") return "warn";
  return "neutral";
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 break-words">{children}</dd>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section
      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}
    >
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/80">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function jobDetailsMoneyFormatter(currencyCodeRaw) {
  const code = String(currencyCodeRaw || "").trim().toUpperCase();
  return (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    if (/^[A-Z]{3}$/.test(code)) {
      const loc = code === "MYR" ? "en-MY" : "en-US";
      const opts = { style: "currency", currency: code };
      if (code === "MYR") opts.currencyDisplay = "code";
      return new Intl.NumberFormat(loc, opts).format(x);
    }
    const dp =
      typeof getConfig().decimal_places === "number" ? getConfig().decimal_places : 2;
    return x.toFixed(dp);
  };
}

export default function JobDetailsPage() {
  const { state } = useContext(AdminContext);
  const roleModules = state?.adminInfo?.role?.modules || [];
  const { jobId } = useParams();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fleetTerms, setFleetTerms] = useState(DEFAULT_FLEET_TERMINOLOGY);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setJob(null);
    setMeta(null);
    try {
      const res = await FleetManagementServices.getJob(jobId);
      const j = res?.data ?? null;
      const m = res?.meta ?? null;
      setJob(j);
      setMeta(m);
      const bid = j?.businessId?._id || j?.businessId;
      if (bid) {
        try {
          const fleetRes = await FleetManagementServices.getFleetScheduleSettings({
            business: bid,
          });
          setFleetTerms(normalizeFleetTerminology(fleetRes?.data));
        } catch {
          setFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
        }
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || e?.message || "Could not load this job.");
      history.push("/jobs");
    } finally {
      setLoading(false);
    }
  }, [jobId, history]);

  useEffect(() => {
    load();
  }, [load]);

  const customerLabel = useMemo(() => {
    if (!job) return "—";
    return (
      job.customerId?.basicInformation?.customerDisplayName ||
      job.customerId?.basicInformation?.companyName ||
      "—"
    );
  }, [job]);

  const serviceAddressLine = useMemo(() => {
    if (!job?.serviceAddress) return "";
    const s = job.serviceAddress;
    return [s.street, s.area, s.city, s.zip].filter(Boolean).join(", ");
  }, [job]);

  const lineTableData = useMemo(() => {
    if (!job) return { rows: [], footerRows: [] };
    const rows = Array.isArray(job.lineItems) ? job.lineItems : [];
    if (!rows.length) return { rows: [], footerRows: [] };

    const fmt = jobDetailsMoneyFormatter(
      job.createdFromSalesOrderTotals?.currency || job.currency,
    );
    const lineRollup = computeFleetJobLineSummary(job, rows);
    const sumLineTax = rows.reduce((s, r) => s + (Number(r.tax) || 0), 0);
    const soTotals = job.createdFromSalesOrderTotals;
    const hasLinkedSo = !!(job.createdFrom?._id || job.createdFrom);

    let footerRows;
    if (soTotals != null && typeof soTotals === "object" && hasLinkedSo) {
      const od = Number(soTotals.discount) || 0;
      const ship = Number(soTotals.shippingCharges) || 0;
      const adj = Number(soTotals.adjustment) || 0;
      footerRows = [
        { key: "sub", label: "Subtotal", value: fmt(soTotals.subtotal), emphasis: false },
        ...(od > 0 ? [{ key: "odisc", label: "Order discount", value: fmt(-od), emphasis: false }] : []),
        ...(ship > 0 ? [{ key: "ship", label: "Shipping", value: fmt(ship), emphasis: false }] : []),
        ...(adj !== 0
          ? [{ key: "adj", label: "Adjustment", value: fmt(adj), emphasis: false }]
          : []),
        { key: "tax", label: "Tax", value: fmt(sumLineTax), emphasis: false },
        { key: "tot", label: "Total", value: fmt(soTotals.total), emphasis: true },
      ];
    } else {
      const ld = Number(lineRollup.discountTotal) || 0;
      footerRows = [
        {
          key: "sub",
          label: "Subtotal (ex tax)",
          value: fmt(lineRollup.subtotalExTax),
          emphasis: false,
        },
        ...(ld > 0 ? [{ key: "ldisc", label: "Discount (lines)", value: fmt(-ld), emphasis: false }] : []),
        { key: "tax", label: "Tax", value: fmt(lineRollup.taxTotal), emphasis: false },
        { key: "tot", label: "Total", value: fmt(lineRollup.grand), emphasis: true },
      ];
    }

    return { rows, footerRows };
  }, [job]);

  const woRef = job
    ? job.createdFrom?.salesOrderNumber
      ? job.createdFrom.salesOrderNumber
      : `${billingDocIdPrefix(job)}-${String(job._id || "")
          .replace(/[^a-f0-9]/gi, "")
          .slice(-4)
          .toUpperCase()}`
    : "";

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-600">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" aria-hidden />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!job) return null;

  const assign = meta?.assignment && typeof meta.assignment === "object" ? meta.assignment : null;
  const linkedSoId = job.createdFrom?._id || job.createdFrom;
  const canOpenSo =
    !!(linkedSoId && job.createdFrom?.salesOrderNumber) &&
    hasPathPermission(roleModules, getModuleRoutePath("saleOrder", "list"), PERMISSION_ACTION.VIEW_DETAILS);

  const primaryAddress = (() => {
    const addrs = job.customerId?.addresses;
    if (!Array.isArray(addrs) || !addrs.length) return "—";
    const a = addrs[0];
    const parts = [a.addressLine1, a.city, a.state, a.zipCode].filter(Boolean);
    return parts.join(", ") || "—";
  })();

  const hasNotes = [
    job.accountMemo,
    job.techNote,
    job.orderNote,
    job.siteNote,
    job.adminNote,
  ].some((x) => String(x || "").trim());

  const lineMoneyFmt = jobDetailsMoneyFormatter(
    job.createdFromSalesOrderTotals?.currency || job.currency,
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 text-gray-900">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 py-3">
          <PageHeader
            title={job.title || "Untitled job"}
            description={
              [
                `${jobBillingDocumentTitle(job)} · ${woRef}`,
                [
                  !isSingleAssignedBusiness() ? job.businessId?.name : null,
                  customerLabel,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ]
                .filter(Boolean)
                .join(" — ") || undefined
            }
            showBackButton
            onBackClick={() => history.push("/jobs")}
            backFallbackPath="/jobs"
            actionsContainerClassName="flex flex-wrap gap-2 justify-end min-w-0"
            renderActions={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => history.push("/scheduling")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 !shadow-none"
                >
                  <Calendar className="w-4 h-4 text-gray-500" aria-hidden />
                  Schedule
                </button>
                {canOpenSo ? (
                  <button
                    type="button"
                    onClick={() =>
                      history.push(
                        getModuleRoutePath("saleOrder", "view", { id: linkedSoId }),
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0C2E5A] px-4 py-2 text-sm font-medium text-white hover:opacity-95 !shadow-none"
                  >
                    Sales order
                  </button>
                ) : null}
              </div>
            }
          />
          <div className="flex flex-wrap gap-2 -mt-4 pb-1">
            <Pill tone={statusTone(job.status)}>
              {String(job.status || "—").replace(/_/g, " ")}
            </Pill>
            <Pill tone={priorityTone(job.priority)}>
              Priority: {job.priority || "—"}
            </Pill>
            <Pill tone="neutral">Order type: {String(job.orderType || "—").replace(/_/g, " ")}</Pill>
            {job.visitType?.trim() ? (
              <Pill tone="neutral">Visit: {job.visitType.trim()}</Pill>
            ) : null}
          </div>
        </div>
      </div>

      <main className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5 pb-12">
        <Panel title="Identifiers & timestamps">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Reference">{woRef}</Field>
            <Field label="Document type">{jobBillingDocumentTitle(job)}</Field>
            <Field label="Created">{job.createdAt ? formatDate(job.createdAt) : "—"}</Field>
            <Field label="Last updated">{job.updatedAt ? formatDate(job.updatedAt) : "—"}</Field>
          </dl>
          {job.description?.trim() ? (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{job.description}</p>
            </div>
          ) : null}
        </Panel>

        <Panel title={`Route (${fleetTerms.vehicleLabelSingular.toLowerCase()} & slot)`}>
          {assign ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Date">{assignmentDateDisplay(assign.date)}</Field>
              <Field label="Time">
                {(assign.startTime || "—") + " – " + (assign.endTime || "—")}
              </Field>
              <Field label="Route status">{String(assign.status || "—").replace(/_/g, " ")}</Field>
              <Field label="Appointment type">{assign.appointmentType || "—"}</Field>
              <Field label={fleetTerms.vehicleLabelSingular}>{assign.vehicleId?.name || "—"}</Field>
              <Field label="Assigned technician">
                {assign.technicianId?.fullName ||
                  assign.technicianId?.displayName ||
                  assign.technicianName ||
                  "—"}
              </Field>
            </dl>
          ) : (
            <p className="text-sm text-gray-600">No scheduled route for this job yet.</p>
          )}
        </Panel>

        <Panel title="Customer">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gray-100 text-gray-500 shrink-0">
              <User className="w-5 h-5" aria-hidden />
            </div>
            <dl className="grid grid-cols-1 gap-y-4 flex-1 min-w-0">
              <Field label="Name">{customerLabel}</Field>
              <Field label="Primary address">{primaryAddress}</Field>
            </dl>
          </div>
        </Panel>

        {serviceAddressLine ? (
          <Panel title="Service address">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gray-100 text-gray-500 shrink-0">
                <MapPin className="w-5 h-5" aria-hidden />
              </div>
              <p className="text-sm text-gray-800 leading-relaxed flex-1">{serviceAddressLine}</p>
            </div>
          </Panel>
        ) : null}

        {hasNotes ? (
          <Panel title="Notes">
            <div className="space-y-4">
              {[
                ["Account memo", job.accountMemo],
                ["Tech note", job.techNote],
                ["Order note", job.orderNote],
                ["Site note", job.siteNote],
                ["Admin note", job.adminNote],
              ].map(([lbl, txt]) =>
                txt?.trim() ? (
                  <div key={lbl}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{lbl}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap border-l-2 border-gray-200 pl-3">
                      {txt}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          </Panel>
        ) : null}

        <Panel title="Line items">
          {lineTableData.rows.length === 0 ? (
            <p className="text-sm text-gray-600">No line items.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="pb-2 pr-3 font-medium">Item</th>
                    <th className="pb-2 pr-3 font-medium min-w-[6rem]">Details</th>
                    <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Qty</th>
                    <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Rate</th>
                    <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Disc</th>
                    <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">Tax</th>
                    <th className="pb-2 font-medium text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineTableData.rows.map((row, idx) => {
                    const label = fleetJobLineItemLabel(row);
                    const detailOnly = fleetJobLineSecondaryDescriptionOnly(row);
                    const rate = fleetJobLineUnitRate(row);
                    const disc = Number(row.discount) || 0;
                    const taxAmt = Number(row.tax) || 0;
                    const tr = Number(row.taxRate) || 0;
                    const tn = String(row.taxName || "").trim();
                    const amt = Number(row.amount ?? row.total);

                    return (
                      <tr key={idx}>
                        <td className="py-2.5 pr-3 text-gray-900">{label}</td>
                        <td className="py-2.5 pr-3 text-gray-600 text-xs max-w-[220px] align-top">
                          {detailOnly || "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-gray-800 align-top">
                          {row.quantity != null && row.quantity !== "" ? row.quantity : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-gray-800 align-top">
                          {lineMoneyFmt(rate)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-gray-800 align-top whitespace-nowrap">
                          {disc > 0 ? `${disc}%` : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-gray-800 align-top">
                          <div className="tabular-nums text-sm">
                            {taxAmt > 0 ? lineMoneyFmt(taxAmt) : "—"}
                          </div>
                          {(tr > 0 || tn) && (taxAmt > 0 || tr > 0) ? (
                            <div className="text-[10px] leading-tight text-gray-500 mt-0.5">
                              {[tn, tr > 0 ? `${tr}%` : ""].filter(Boolean).join(" · ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-medium text-gray-900 align-top">
                          {Number.isFinite(amt) ? lineMoneyFmt(amt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {lineTableData.footerRows.map((fr) => (
                    <tr key={fr.key} className="border-t border-gray-100">
                      <td
                        colSpan={6}
                        className={`pt-2.5 pr-3 text-right text-sm text-gray-600 ${fr.emphasis ? "pt-3 font-semibold text-gray-800" : ""}`}
                      >
                        {fr.label}
                      </td>
                      <td
                        className={`pt-2.5 text-right text-sm tabular-nums ${fr.emphasis ? "pt-3 font-semibold text-gray-900" : "text-gray-900"}`}
                      >
                        {fr.value}
                      </td>
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}
