import React from "react";
import { X, Truck, User, Calendar, MapPin, ClipboardList, Clock, Tag } from "lucide-react";

const DEFAULT_VIEW_CURRENCY = "MYR";

function intlCurrencyOptionsForCode(code) {
  const c =
    String(code || DEFAULT_VIEW_CURRENCY)
      .trim()
      .toUpperCase() || DEFAULT_VIEW_CURRENCY;
  const o = { style: "currency", currency: c };
  if (c === "MYR") o.currencyDisplay = "code";
  return o;
}

function formatMoney(n, currency = DEFAULT_VIEW_CURRENCY) {
  const code =
    String(currency || DEFAULT_VIEW_CURRENCY)
      .trim()
      .toUpperCase() || DEFAULT_VIEW_CURRENCY;
  const x = Number(n);
  const loc = code === "MYR" ? "en-MY" : "en-US";
  const opts = intlCurrencyOptionsForCode(code);
  if (!Number.isFinite(x)) {
    return new Intl.NumberFormat(loc, opts).format(0);
  }
  return new Intl.NumberFormat(loc, opts).format(x);
}

function customerName(job) {
  const c = job?.customerId;
  if (!c) return "Customer";
  return (
    c?.basicInformation?.customerDisplayName ||
    c?.basicInformation?.companyName ||
    "Customer"
  );
}

function formatAddressLines(addr) {
  if (!addr) return [];
  const lines = [];
  if (addr.addressLine1) lines.push(addr.addressLine1);
  if (addr.addressLine2) lines.push(addr.addressLine2);
  const cityLine = [addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines.length ? lines : ["—"];
}

function pickBillingShipping(addresses) {
  const list = Array.isArray(addresses) ? addresses : [];
  const norm = (t) => String(t || "").toLowerCase();
  const billing =
    list.find((a) => norm(a.addressType) === "billing") ||
    list.find((a) => norm(a.addressType).includes("bill"));
  const shipping =
    list.find((a) => norm(a.addressType) === "shipping") ||
    list.find((a) => norm(a.addressType).includes("ship")) ||
    list.find((a) => !a.addressType || norm(a.addressType) === "service");
  return { billing, shipping };
}

function assignmentStatusLabel(status) {
  if (status === "in_progress") return "On the job";
  if (status === "confirmed") return "Confirmed";
  if (status === "waiting") return "Waiting";
  if (status === "cancelled") return "Cancelled";
  if (!status) return "Scheduled";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function formatDayPretty(ymd) {
  if (!ymd) return "—";
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(ymd).slice(0, 10);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function formatTime12(timeStr) {
  const [h, m] = String(timeStr || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const am = h < 12;
  let hr = h % 12;
  if (hr === 0) hr = 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `${hr}:${pad(m)} ${am ? "AM" : "PM"}`;
}

export default function ScheduledJobViewModal({ isOpen, onClose, assignment, vehicle, dayYmd }) {
  if (!isOpen || !assignment) return null;

  const job = assignment.jobId;
  const lineCurrency = (() => {
    const c = job?.currency;
    if (c != null && /^[A-Za-z]{3}$/.test(String(c).trim())) {
      return String(c).trim().toUpperCase();
    }
    return DEFAULT_VIEW_CURRENCY;
  })();
  const customer = job?.customerId;
  const bi = customer?.basicInformation || {};
  const email = bi.customerEmail || "—";
  const phone =
    bi.customerPhone?.mobile ||
    bi.customerPhone?.workPhone ||
    bi.customerPhone?.homePhone ||
    "—";
  const { billing, shipping } = pickBillingShipping(customer?.addresses);
  const sa = job?.serviceAddress || {};
  const serviceLines = [
    [sa.street, sa.city, sa.area, sa.zip].filter(Boolean).join(", ") || "—",
  ];

  const lineItems = Array.isArray(job?.lineItems) ? job.lineItems : [];
  const techs = Array.isArray(job?.technicianNames) ? job.technicianNames : [];

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/55 p-3 sm:p-6 overflow-y-auto backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl text-sm text-slate-800"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1a3a5c] via-[#1e4a7a] to-sky-900 px-5 py-5 text-white">
          <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/90">
                Scheduled job
              </div>
              <h2 className="mt-1 text-xl font-bold tracking-tight truncate">
                {job?.title || "Work order"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-100/95">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  {formatDayPretty(dayYmd)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  {formatTime12(assignment.startTime)} – {formatTime12(assignment.endTime)}
                </span>
                {vehicle?.name ? (
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5 shrink-0 opacity-90" />
                    {vehicle.name}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-white/90 hover:bg-white/15"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {assignmentStatusLabel(assignment.status)}
            </span>
            {job?.visitType ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium capitalize">
                <Tag className="inline h-3 w-3 mr-1 -mt-0.5 opacity-80" />
                {String(job.visitType).replace(/_/g, " ")}
              </span>
            ) : null}
            {job?.priority ? (
              <span className="rounded-full bg-amber-400/25 px-3 py-1 text-xs font-medium text-amber-50">
                Priority: {job.priority}
              </span>
            ) : null}
          </div>
        </div>

        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-5 py-4 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <User className="h-4 w-4 text-sky-600" />
              Customer
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{customerName(job)}</div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
              <div>
                <span className="font-medium text-slate-500">Email</span> {email}
              </div>
              <div>
                <span className="font-medium text-slate-500">Phone</span> {phone}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-slate-500">Billing address</div>
                <div className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                  {billing ? formatAddressLines(billing).map((ln, i) => <div key={i}>{ln}</div>) : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-bold uppercase text-slate-500">Shipping address</div>
                <div className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                  {shipping ? formatAddressLines(shipping).map((ln, i) => <div key={i}>{ln}</div>) : "—"}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Service address on job
            </div>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{serviceLines[0]}</p>
          </section>

          {[
            { k: "techNote", label: "Tech note" },
            { k: "accountMemo", label: "Account memo" },
            { k: "orderNote", label: "Order note" },
            { k: "siteNote", label: "Site note" },
            { k: "adminNote", label: "Admin note" },
          ]
            .map(({ k, label }) => ({ k, label, v: (job && job[k] ? String(job[k]) : "").trim() }))
            .filter((x) => x.v)
            .map(({ k, label, v }) => (
              <section key={k} className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                <div className="text-xs font-bold uppercase text-sky-800">{label}</div>
                <p className="mt-2 text-xs text-slate-800 whitespace-pre-wrap">{v}</p>
              </section>
            ))}

          {techs.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase text-slate-500">Technicians</div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {techs.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <ClipboardList className="h-4 w-4 text-violet-600" />
              Line items
            </div>
            {lineItems.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No line items on this job.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Item</th>
                      <th className="px-3 py-2 font-semibold text-right">Qty</th>
                      <th className="px-3 py-2 font-semibold text-right">Rate</th>
                      <th className="px-3 py-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((row, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-800">
                          {row.itemName || row.description || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.quantity ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatMoney(row.rate ?? row.price, lineCurrency)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatMoney(row.amount ?? row.total, lineCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <div className="text-right">
                <div className="text-[11px] uppercase text-slate-500">Total</div>
                <div className="text-lg font-bold text-slate-900">
                  {formatMoney(
                    lineItems.reduce((s, r) => s + (Number(r.amount ?? r.total) || 0), 0) ||
                      job?.grandTotal ||
                      job?.totalAmount,
                    lineCurrency,
                  )}
                </div>
              </div>
            </div>
          </section>

          {job?.description ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs font-bold uppercase text-slate-500">Description</div>
              <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{job.description}</p>
            </section>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1a3a5c] px-5 py-2 text-xs font-semibold text-white hover:bg-[#15324f]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
