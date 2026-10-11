import { useEffect, useState, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { recurringInvoiceText as riText } from "@/utils/recurringInvoiceI18n";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import { format } from "date-fns";
import {
  Pencil,
  RefreshCw,
  Pause,
  Play,
  StopCircle,
  Building2,
  User,
  Calendar,
  Repeat,
  Hash,
  FileText,
  ExternalLink,
  CalendarClock,
  Receipt,
  MessageSquare,
  Sparkles,
  Mail,
  ArrowRight,
  Timer,
  Wallet,
  Info,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { PageHeader } from "@/page-layouts/index";
import { buildRecurringInvoicePrefillPayload } from "@/utils/recurringToCustomerInvoicePrefill";
import { hasDynamicPlaceholders } from "@/utils/dynamicPlaceholders";
import {
  buildInvoicePlaceholderOptions,
  resolveInvoicePlaceholderText,
} from "@/utils/invoicePlaceholderResolver";
import InvoiceTemplatePreviewEmbed from "@/components/InvoiceTemplatePreviewEmbed";
import {
  renderRecurringInvoiceTemplateHtml,
  resolveTemplateIdFromInvoiceTemplate,
  fetchAdminProfileSignatureUrl,
} from "@/utils/recurringInvoiceTemplatePreview";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PROFILE_STATUS_LABELS = {
  active: "Active",
  paused: "Paused",
  stopped: "Stopped",
  expired: "Expired",
};

function profileStatusLabel(status) {
  const key = (status || "").toLowerCase();
  const label = PROFILE_STATUS_LABELS[key];
  return label ? riText(label) : status || "—";
}

/**
 * Whole-day difference (UTC) between today and `target`. Negative when in the
 * past. Used for the "in N days" badge on the Next invoice card — server uses
 * UTC for the cron, so we floor both sides to UTC midnight to avoid off-by-one
 * around the user's local timezone boundaries.
 */
function daysUntil(target) {
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfTarget = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((startOfTarget - startOfToday) / 86_400_000);
}

function formatRelativeDay(diff) {
  if (diff == null) return "";
  if (diff === 0) return riText("Today");
  if (diff === 1) return riText("Tomorrow");
  if (diff === -1) return riText("Yesterday");
  if (diff > 1) return riText("In {{count}} days", { count: diff });
  return riText("{{count}} days ago", { count: Math.abs(diff) });
}

function previewNextDueDate(tpl, nextRunRaw) {
  if (!nextRunRaw) return null;
  const inv = tpl.invoice_date ? new Date(tpl.invoice_date) : null;
  const due = tpl.due_date ? new Date(tpl.due_date) : null;
  if (
    !inv ||
    !due ||
    Number.isNaN(inv.getTime()) ||
    Number.isNaN(due.getTime())
  ) {
    return null;
  }
  const delta = due.getTime() - inv.getTime();
  const run = new Date(nextRunRaw);
  if (Number.isNaN(run.getTime())) return null;
  return new Date(run.getTime() + delta);
}

function statusPill(status) {
  const s = (status || "").toLowerCase();
  const map = {
    active: "bg-green-100 text-green-800 border-green-200",
    paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
    stopped: "bg-gray-100 text-gray-800 border-gray-200",
    expired: "bg-red-100 text-red-800 border-red-200",
  };
  return map[s] || "bg-gray-100 text-gray-800 border-gray-200";
}

/** Paid vs unpaid for child customer invoices (matches list page semantics). */
function isChildInvoicePaid(inv) {
  const st = (inv.status || "").toLowerCase();
  if (st === "draft") return false;
  const rem = Number(inv.remaining);
  if (!Number.isNaN(rem) && rem <= 0) return true;
  return st === "paid" || st === "completed";
}

function paymentFilterPill(paid) {
  return paid
    ? "bg-green-100 text-green-800 border-green-200"
    : "bg-amber-50 text-amber-900 border-amber-200";
}

function formatLineDiscount(it) {
  const d = Number(it?.discount) || 0;
  return d > 0 ? `${d}%` : "—";
}

/** Line-level tax: name + rate; amount stays in the Amount column total. */
function formatLineTax(it) {
  const rate = Number(it?.taxRate) || 0;
  const name = (it?.taxName && String(it.taxName).trim()) || "";
  if (!name && !rate) return "—";
  if (name && rate) return `${name} (${rate}%)`;
  if (rate) return `${rate}%`;
  return name;
}

function mergeChildInvoices(profile) {
  const fromApi = Array.isArray(profile?.generated_invoices)
    ? [...profile.generated_invoices]
    : [];
  const map = new Map();
  for (const row of fromApi) {
    const id = row?._id != null ? String(row._id) : null;
    if (id) map.set(id, row);
  }
  const last = profile?.last_generated_invoice_id;
  if (last && typeof last === "object" && last._id) {
    const id = String(last._id);
    if (!map.has(id)) {
      map.set(id, {
        _id: last._id,
        invoice_number: last.invoice_number,
        status: last.status,
        invoice_date: last.invoice_date,
        due_date: last.due_date,
        grandTotal: last.grandTotal,
        currency: last.currency,
        remaining: last.remaining,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
    const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
    return db - da;
  });
}

export default function ViewRecurringInvoice() {
  const { i18n } = useTranslation();
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const routePerms = useRouteModulePermissions();
  const { canUpdate, canView, canViewDetails } = routePerms;
  const canSee = canView || canViewDetails;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [childFilter, setChildFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("details");
  const [nextPdfHtml, setNextPdfHtml] = useState("");
  const [nextPdfLoading, setNextPdfLoading] = useState(false);
  const [nextPdfError, setNextPdfError] = useState("");

  const allChildInvoices = useMemo(() => {
    if (!profile) return [];
    return mergeChildInvoices(profile);
  }, [profile]);

  const filteredChildInvoices = useMemo(() => {
    if (childFilter === "paid") {
      return allChildInvoices.filter((inv) => isChildInvoicePaid(inv));
    }
    if (childFilter === "unpaid") {
      return allChildInvoices.filter((inv) => !isChildInvoicePaid(inv));
    }
    return allChildInvoices;
  }, [allChildInvoices, childFilter]);

  const hasAnyDynamicPlaceholder = useMemo(() => {
    if (!profile) return false;
    const tpl = profile.invoice_template || {};
    return (
      hasDynamicPlaceholders(profile.subject) ||
      hasDynamicPlaceholders(tpl?.subject) ||
      hasDynamicPlaceholders(tpl?.customerNotes) ||
      hasDynamicPlaceholders(tpl?.termsAndConditions) ||
      hasDynamicPlaceholders(tpl?.billingAddress) ||
      hasDynamicPlaceholders(tpl?.shippingAddress) ||
      hasDynamicPlaceholders(tpl?.orderNumber) ||
      hasDynamicPlaceholders(tpl?.email?.subject) ||
      (Array.isArray(tpl?.items) &&
        tpl.items.some(
          (it) =>
            hasDynamicPlaceholders(it?.itemName) ||
            hasDynamicPlaceholders(it?.description) ||
            hasDynamicPlaceholders(it?.title),
        ))
    );
  }, [profile]);

  useEffect(() => {
    if (activeTab !== "next" || !profile) {
      return undefined;
    }
    const tid = resolveTemplateIdFromInvoiceTemplate(profile.invoice_template);
    if (!tid) {
      setNextPdfHtml("");
      setNextPdfError(
        riText(
          "No invoice document template is linked to this profile. Edit the recurring invoice and select a template.",
        ),
      );
      setNextPdfLoading(false);
      return undefined;
    }
    if (!adminInfo?.token) {
      return undefined;
    }

    let cancelled = false;
    setNextPdfLoading(true);
    setNextPdfError("");

    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/document-templates/${tid}`, {
          headers,
        });
        const html = res.data?.data?.htmlContent;
        if (!html) {
          throw new Error(riText("This template has no HTML content."));
        }
        if (cancelled) return;
        const loggedInAdminId = adminInfo?.id || adminInfo?._id;
        const signatureUrl = await fetchAdminProfileSignatureUrl(
          [loggedInAdminId, profile?.salesperson?.id],
          headers,
        );
        if (cancelled) return;
        const rendered = renderRecurringInvoiceTemplateHtml(html, profile, {
          signatureUrl,
        });
        setNextPdfHtml(rendered);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setNextPdfHtml("");
          setNextPdfError(
            e?.response?.data?.message ||
              e?.message ||
              riText("Could not load template preview."),
          );
        }
      } finally {
        if (!cancelled) setNextPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, profile, adminInfo?.token, adminInfo?.id, adminInfo?._id, id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/recurring-invoice/${id}`, {
        headers,
      });
      setProfile(res.data?.data || null);
    } catch (e) {
      console.error(e);
      notifyError(riText("Could not load recurring profile."));
      history.push("/recurring-Invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const patchStatus = async (next) => {
    try {
      await axios.patch(
        `${Base_URL}/recurring-invoice/${id}/status`,
        { profile_status: next },
        { headers },
      );
      notifySuccess(riText("Status updated."));
      load();
    } catch (e) {
      notifyError(e.response?.data?.message || riText("Update failed."));
    }
  };

  const openCustomerInvoiceFromProfile = () => {
    const payload = buildRecurringInvoicePrefillPayload(profile);
    if (!payload.customer || !payload.business) {
      notifyError(riText("This profile is missing customer or business data."));
      return;
    }
    history.push({
      pathname: "/create-customer-invoice",
      state: { recurringInvoicePrefill: payload },
    });
  };

  if (!canSee) {
    return (
      <div className="p-8 text-center text-gray-600">
        {riText("You do not have permission to view this page.")}
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">
          {loading ? riText("Loading…") : riText("Profile not found.")}
        </div>
      </div>
    );
  }

  const tpl = profile.invoice_template || {};
  const cust = profile.customer_id;
  const custName =
    cust?.basicInformation?.customerDisplayName ??
    cust?.basicInformation?.companyName ??
    profile.customer_name ??
    "—";
  const custPhone =
    cust?.basicInformation?.customerPhone?.mobile ||
    cust?.basicInformation?.customerPhone?.workPhone ||
    "";
  const custEmail =
    cust?.basicInformation?.customerEmail ||
    cust?.keyContacts?.[0]?.email ||
    "";
  const biz = profile.business_id;
  const bizName = biz?.name ?? "—";
  const items = Array.isArray(tpl.items) ? tpl.items : [];
  const repeatUnit =
    profile.repeat_unit === "day"
      ? riText("day(s)")
      : profile.repeat_unit === "week"
        ? riText("week(s)")
        : profile.repeat_unit === "year"
          ? riText("year(s)")
          : riText("month(s)");
  const repeatLabel = riText("Every {{interval}} {{unit}}", {
    interval: profile.repeat_interval,
    unit: repeatUnit,
  });
  const lastInv = profile.last_generated_invoice_id;
  const nextRunRaw = profile.next_invoice_date;
  const nextRun = nextRunRaw ? new Date(nextRunRaw) : null;
  /**
   * Mirror the Edit screen's summary panel formula so the View totals reconcile
   * with what the user saved (subtotal × % / 100, then total = subtotal − discount
   * + shipping + adjustment). Falls back to stored grand_total when the breakdown
   * can't be derived (no items / no subtotal).
   */
  const summaryItems = Array.isArray(tpl.items) ? tpl.items : [];
  const computedItemsSubtotal = summaryItems.reduce(
    (s, it) =>
      s + (Number(it.totalValue) || Number(it.total) || Number(it.amount) || 0),
    0,
  );
  const summarySubtotal = Number(tpl.subTotal) || computedItemsSubtotal || 0;
  const summaryDiscountPct = Math.min(
    100,
    Math.max(0, Number(tpl.discount) || 0),
  );
  const summaryShipping = Number(tpl.shippingCharges) || 0;
  const summaryAdjustment = Number(tpl.adjustment) || 0;
  const summaryDiscountAmount =
    summaryDiscountPct > 0
      ? (summarySubtotal * summaryDiscountPct) / 100
      : Number(tpl.discountAmount) || 0;
  const summaryTaxTotal =
    Number(tpl.taxTotal) ||
    summaryItems.reduce((s, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const disc = Number(it.discount) || 0;
      const taxRate = Number(it.taxRate) || 0;
      const lineSub = qty * price * (1 - disc / 100);
      return s + (lineSub * taxRate) / 100;
    }, 0);
  const summaryTotalDerived = Math.max(
    0,
    summarySubtotal -
      summaryDiscountAmount +
      summaryShipping +
      summaryAdjustment,
  );
  const grand =
    summarySubtotal > 0
      ? summaryTotalDerived
      : (profile.grand_total ?? tpl.grandTotal ?? 0);
  const curr = profile.currency || tpl.currency || "";

  /**
   * Same reference date + context as the next-invoice PDF / template preview,
   * built through the shared invoicePlaceholderResolver so the inline view
   * (Subject / Customer Notes badges) renders identical text to the iframe
   * preview, the PDF and the cron-generated child invoice.
   */
  const placeholderViewOpts = buildInvoicePlaceholderOptions({
    invoice: tpl,
    business: biz,
    referenceDate:
      nextRun && !Number.isNaN(nextRun.getTime()) ? nextRun : new Date(),
    contextOverrides: {
      customer_name:
        tpl.customer_name || profile.customer_name || custName || "",
      currency: curr || tpl.currency || profile.currency || "",
      grand_total: grand,
      amount: grand,
      invoice_number: tpl.invoice_number ?? profile.profile_number ?? "",
      business_name: biz?.name || "",
    },
  });
  const resolveViewText = (v) =>
    typeof v !== "string"
      ? ""
      : resolveInvoicePlaceholderText(v, placeholderViewOpts);

  const subjRaw =
    (profile.subject != null && String(profile.subject).trim()) ||
    (tpl.subject != null && String(tpl.subject).trim()) ||
    "";
  const subjDisplay = subjRaw ? resolveViewText(subjRaw) : "";
  const notesRaw =
    tpl.customerNotes != null && String(tpl.customerNotes).trim()
      ? String(tpl.customerNotes).trim()
      : "";
  const notesDisplay = notesRaw ? resolveViewText(notesRaw) : "";
  const willEmail = profile.creation_preference === "send";
  const nextDue = previewNextDueDate(tpl, nextRunRaw);
  let endsBlock = null;
  if (!profile.never_expire && profile.ends_on) {
    const e = new Date(profile.ends_on);
    const endUtc = new Date(
      Date.UTC(
        e.getUTCFullYear(),
        e.getUTCMonth(),
        e.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    if (nextRun && nextRun > endUtc) endsBlock = "past_end";
  }

  const paidCount = allChildInvoices.filter((i) =>
    isChildInvoicePaid(i),
  ).length;
  const unpaidCount = allChildInvoices.length - paidCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full  py-6 px-4 sm:px-6">
        <div className="mb-5">
          <PageHeader
            title={riText("Recurring invoice")}
            showBackButton
            backFallbackPath="/recurring-Invoice"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md border ${statusPill(
                    profile.profile_status,
                  )}`}
                >
                  {profileStatusLabel(profile.profile_status)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-gray-600 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-[var(--p-blue)]" />
                {profile.profile_number}
              </p>
              {profile.profile_name &&
                String(profile.profile_name).trim() !== "" && (
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {String(profile.profile_name).trim()}
                  </p>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canUpdate && (
                <button
                  type="button"
                  onClick={() =>
                    history.push(`/update-recurring-invoice/${id}`)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  {riText("Edit")}
                </button>
              )}
              {profile.profile_status === "active" && (
                <>
                  <button
                    type="button"
                    onClick={openCustomerInvoiceFromProfile}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {riText("Create invoice")}
                  </button>
                  <button
                    type="button"
                    onClick={() => patchStatus("paused")}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-amber-300 text-amber-900 rounded-lg bg-amber-50 hover:bg-amber-100"
                  >
                    <Pause className="w-4 h-4" />
                    {riText("Pause")}
                  </button>
                </>
              )}
              {profile.profile_status === "paused" && (
                <>
                  <button
                    type="button"
                    onClick={() => patchStatus("active")}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-emerald-300 text-emerald-900 rounded-lg bg-emerald-50 hover:bg-emerald-100"
                  >
                    <Play className="w-4 h-4" />
                    {riText("Resume")}
                  </button>
                  <button
                    type="button"
                    onClick={() => patchStatus("stopped")}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                  >
                    <StopCircle className="w-4 h-4" />
                    {riText("Stop")}
                  </button>
                </>
              )}
              {profile.profile_status === "stopped" && (
                <button
                  type="button"
                  onClick={() => patchStatus("active")}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-emerald-300 text-emerald-900 rounded-lg bg-emerald-50 hover:bg-emerald-100"
                >
                  <Play className="w-4 h-4" />
                  {riText("Reactivate")}
                </button>
              )}
            </div>
          </div>

          {/* Tabs: Show details / Next invoice preview */}
          <div className="border-b border-gray-200 bg-white">
            <nav
              className="flex gap-1 px-4 sm:px-6 -mb-px overflow-x-auto"
              aria-label={riText("Recurring invoice sections")}
            >
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-[var(--p-blue)] text-[var(--p-blue)]"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                <FileText className="w-4 h-4" />
                {riText("Show details")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("next")}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "next"
                    ? "border-[var(--p-blue)] text-[var(--p-blue)]"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {riText("Next invoice")}
              </button>
            </nav>
          </div>

          {/* Profile details: customer, schedule, line items, summary */}
          {activeTab === "details" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x lg:divide-gray-100 border-b border-gray-100 bg-[#f6f8fa]/30">
                <div className="lg:col-span-2 p-6 space-y-8">
                  <section>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {riText("Customer & business")}
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1 font-medium">
                          <User className="w-3.5 h-3.5 text-[var(--p-blue)]" />
                          {riText("Customer")}
                        </div>
                        <p className="text-base font-semibold text-gray-900">
                          {custName}
                        </p>
                        {(custPhone || custEmail) && (
                          <div className="mt-2 space-y-0.5 text-sm text-gray-600">
                            {custPhone ? (
                              <p className="tabular-nums">{custPhone}</p>
                            ) : null}
                            {custEmail ? (
                              <p className="break-all">{custEmail}</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-[var(--p-blue)]" />
                          {riText("Business")}
                        </div>
                        <p className="text-base font-semibold text-gray-900">
                          {bizName}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {riText("Schedule")}
                    </h2>
                    <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="px-4 py-3 text-gray-500 w-40">
                              <span className="inline-flex items-center gap-2">
                                <Repeat className="w-3.5 h-3.5" />
                                {riText("Repeat every")}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {repeatLabel}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-500">
                              <span className="inline-flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" />
                                {riText("Start on")}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {profile.start_on
                                ? format(
                                    new Date(profile.start_on),
                                    "dd MMM yyyy",
                                  )
                                : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-500">{riText("Ends on")}</td>
                            <td className="px-4 py-3 text-gray-900">
                              {profile.never_expire
                                ? riText("Never expires")
                                : profile.ends_on
                                  ? format(
                                      new Date(profile.ends_on),
                                      "dd MMM yyyy",
                                    )
                                  : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-500">
                              {riText("Next invoice date")}
                            </td>
                            <td className="px-4 py-3 font-medium text-[var(--p-blue)]">
                              {profile.next_invoice_date
                                ? format(
                                    new Date(profile.next_invoice_date),
                                    "dd MMM yyyy",
                                  )
                                : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-500">
                              {riText("On each run")}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {profile.creation_preference === "send"
                                ? riText("Email customer (pending after send)")
                                : riText("Draft only")}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-500">
                              {riText("Salesperson")}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {profile.salesperson?.name || "—"}
                            </td>
                          </tr>
                          {subjDisplay ? (
                            <tr>
                              <td className="px-4 py-3 text-gray-500">
                                <span className="inline-flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5" />
                                  {riText("Subject")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-900">
                                {subjDisplay}
                              </td>
                            </tr>
                          ) : null}
                          {notesDisplay ? (
                            <tr>
                              <td className="px-4 py-3 text-gray-500 align-top">
                                <span className="inline-flex items-center gap-2">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  {riText("Customer notes")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-900 whitespace-pre-wrap align-top">
                                {notesDisplay}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {riText("Items")}
                    </h2>
                    <div className="border border-gray-200/90 rounded-xl overflow-x-auto bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-[#f6f8fa] text-left text-gray-600">
                          <tr>
                            <th className="px-4 py-2 font-medium">
                              {riText("Description")}
                            </th>
                            <th className="px-4 py-2 font-medium text-right">
                              {riText("Qty")}
                            </th>
                            <th className="px-4 py-2 font-medium text-right">
                              {riText("Rate")}
                            </th>
                            <th className="px-4 py-2 font-medium text-right">
                              {riText("Discount")}
                            </th>
                            <th className="px-4 py-2 font-medium text-right">
                              {riText("Tax")}
                            </th>
                            <th className="px-4 py-2 font-medium text-right">
                              {riText("Amount")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-6 text-center text-gray-500"
                              >
                                {riText("No line items")}
                              </td>
                            </tr>
                          ) : (
                            items.map((it, i) => (
                              <tr key={i}>
                                <td className="px-4 py-2 text-gray-900">
                                  {(() => {
                                    const rawLabel = String(
                                      it.itemName || it.title || "",
                                    ).trim();
                                    const rawDesc = String(
                                      it.description || "",
                                    ).trim();
                                    const lineLabel = rawLabel
                                      ? resolveViewText(rawLabel)
                                      : "";
                                    const lineDesc = rawDesc
                                      ? resolveViewText(rawDesc)
                                      : "";
                                    const primary = lineLabel || lineDesc;
                                    const secondary =
                                      lineLabel &&
                                      lineDesc &&
                                      lineDesc.trim() !== lineLabel.trim()
                                        ? lineDesc
                                        : "";
                                    return (
                                      [primary, secondary]
                                        .filter(Boolean)
                                        .join(" · ") || "—"
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {it.quantity ?? "—"}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {curr ? `${curr} ` : ""}
                                  {formatAmount(it.unitPrice ?? 0)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                                  {formatLineDiscount(it)}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700">
                                  {formatLineTax(it)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums font-medium">
                                  {curr ? `${curr} ` : ""}
                                  {formatAmount(
                                    it.totalValue ??
                                      it.total ??
                                      (Number(it.quantity) || 0) *
                                        (Number(it.unitPrice) || 0),
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <div className="p-6 bg-gray-50/90 lg:min-h-[280px]">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    {riText("Summary")}
                  </h2>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{riText("Subtotal")}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrencyAmount(curr, summarySubtotal)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {riText("Discount")}
                        {summaryDiscountPct > 0
                          ? ` (${summaryDiscountPct}%)`
                          : ""}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrencyAmount(curr, summaryDiscountAmount)}
                      </span>
                    </div>

                    {summaryTaxTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{riText("Tax")}</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrencyAmount(curr, summaryTaxTotal)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{riText("Shipping Charges")}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrencyAmount(curr, summaryShipping)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{riText("Adjustment")}</span>
                      <span
                        className={`font-medium ${summaryAdjustment < 0 ? "text-red-600" : "text-gray-900"}`}
                      >
                        {summaryAdjustment >= 0 ? "+" : ""}
                        {formatCurrencyAmount(curr, Math.abs(summaryAdjustment))}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm pt-3 border-t border-gray-100">
                      <span className="text-gray-700 font-semibold">
                        {riText("Total ({{currency}})", { currency: curr })}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrencyAmount(curr, grand)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm pt-3 border-t border-gray-100">
                      <span className="text-gray-500">{riText("Invoices created")}</span>
                      <span className="font-medium text-gray-900">
                        {profile.invoices_generated_count ?? 0}
                      </span>
                    </div>
                    {lastInv && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">
                          {riText("Last created")}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            history.push(
                              `/view-customer-invoice/${lastInv._id}`,
                            )
                          }
                          className="inline-flex items-center gap-1 text-sm text-[var(--p-blue)] font-medium hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          {lastInv.invoice_number}
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      </div>
                    )}
                  </div>
                  {tpl.customerNotes ? (
                    <div className="mt-6">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        {riText("Notes")}
                      </h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {tpl.customerNotes}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Invoices generated from this profile */}
              <div className="px-6 py-5 border-t border-gray-100 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#f6f8fa] border border-gray-200/80 p-2.5 text-gray-700">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        {riText("Invoices from this profile")}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {allChildInvoices.length > 0
                          ? riText(
                              "{{total}} total · {{paid}} paid · {{unpaid}} unpaid",
                              {
                                total: allChildInvoices.length,
                                paid: paidCount,
                                unpaid: unpaidCount,
                              },
                            )
                          : riText("{{total}} total", {
                              total: allChildInvoices.length,
                            })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["all", "paid", "unpaid"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setChildFilter(key)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          childFilter === key
                            ? "bg-[var(--p-blue)] text-white border-[var(--p-blue)] shadow-sm"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {key === "all"
                          ? riText("All")
                          : key === "paid"
                            ? riText("Paid")
                            : riText("Unpaid")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f6f8fa] text-left text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">{riText("Invoice #")}</th>
                        <th className="px-4 py-2.5 font-medium">{riText("Date")}</th>
                        <th className="px-4 py-2.5 font-medium">{riText("Due")}</th>
                        <th className="px-4 py-2.5 font-medium">{riText("Status")}</th>
                        <th className="px-4 py-2.5 font-medium text-right">
                          {riText("Payment")}
                        </th>
                        <th className="px-4 py-2.5 font-medium text-right">
                          {riText("Amount")}
                        </th>
                        <th className="px-4 py-2.5 font-medium text-right w-24">
                          {" "}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredChildInvoices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-10 text-center text-gray-500"
                          >
                            {allChildInvoices.length === 0
                              ? riText(
                                  "No invoices linked to this profile yet.",
                                )
                              : childFilter === "paid"
                                ? riText("No paid invoices for this filter.")
                                : riText("No unpaid invoices for this filter.")}
                          </td>
                        </tr>
                      ) : (
                        filteredChildInvoices.map((inv) => {
                          const paid = isChildInvoicePaid(inv);
                          const invId = inv._id;
                          return (
                            <tr
                              key={invId || inv.invoice_number}
                              className="hover:bg-gray-50/80"
                            >
                              <td className="px-4 py-2.5 font-medium text-gray-900">
                                {inv.invoice_number || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">
                                {inv.invoice_date
                                  ? format(
                                      new Date(inv.invoice_date),
                                      "dd MMM yyyy",
                                    )
                                  : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">
                                {inv.due_date
                                  ? format(
                                      new Date(inv.due_date),
                                      "dd MMM yyyy",
                                    )
                                  : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-gray-800 capitalize">
                                  {(inv.status || "—").toString()}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span
                                  className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-md border ${paymentFilterPill(
                                    paid,
                                  )}`}
                                >
                                  {paid ? riText("Paid") : riText("Unpaid")}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">
                                {(inv.currency || curr) ? (
                                  <>
                                    <span className="text-gray-500 font-normal text-xs">
                                      {inv.currency || curr}
                                    </span>{" "}
                                    {formatAmount(inv.grandTotal ?? 0)}
                                  </>
                                ) : (
                                  formatAmount(inv.grandTotal ?? 0)
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {invId ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      history.push(
                                        `/view-customer-invoice/${invId}`,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--p-blue)] hover:underline"
                                  >
                                    {riText("View")}
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Next invoice tab: document template preview (EJS) + schedule summary */}
          {activeTab === "next" && (
            <>
              <div className="bg-white border-b border-gray-100">
                <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {riText("PDF template preview (next scheduled run)")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  {nextPdfLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[420px] rounded-xl border border-gray-200 bg-gray-50">
                      <div className="border-t-4 border-[var(--p-blue)] border-solid rounded-full animate-spin w-9 h-9 mb-3" />
                      <p className="text-sm text-gray-600">{riText("Loading template…")}</p>
                    </div>
                  )}
                  {!nextPdfLoading && nextPdfError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                      {nextPdfError}
                    </div>
                  )}
                  {!nextPdfLoading && !nextPdfError && nextPdfHtml && (
                    <div className="rounded-xl border border-gray-200 overflow-auto bg-gray-100 shadow-inner min-h-[75vh]">
                      <InvoiceTemplatePreviewEmbed html={nextPdfHtml} />
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule & delivery summary */}
              {(() => {
                const status = (profile.profile_status || "").toLowerCase();
                const isPaused = status === "paused";
                const isActive = status === "active";
                const scheduleEnded = endsBlock === "past_end";
                const hasNextRun =
                  nextRun && !Number.isNaN(nextRun.getTime());
                const willRun = isActive && !scheduleEnded && hasNextRun;
                const diff = willRun ? daysUntil(nextRun) : null;
                const relLabel = formatRelativeDay(diff);
                const statePill = scheduleEnded
                  ? {
                      cls: "bg-gray-100 text-gray-700 border-gray-200",
                      text: riText("Schedule ended"),
                    }
                  : isPaused
                    ? {
                        cls: "bg-amber-50 text-amber-800 border-amber-200",
                        text: riText("Paused"),
                      }
                    : isActive
                      ? {
                          cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
                          text: riText("Auto-generation active"),
                        }
                      : {
                          cls: "bg-gray-100 text-gray-700 border-gray-200",
                          text: riText("Inactive"),
                        };

                return (
                  <div className="px-6 py-6 border-t border-gray-100 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/30">
                    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-[#f6f8fa]">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 rounded-xl bg-[var(--p-blue)]/10 border border-[var(--p-blue)]/20 p-2.5 text-[var(--p-blue)]">
                            <CalendarClock className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base font-semibold text-gray-900 leading-tight">
                              {riText("Next invoice (automatic)")}
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {riText("Generated by the daily UTC scheduler.")}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${statePill.cls}`}
                        >
                          <span className="relative flex h-1.5 w-1.5">
                            {isActive && !scheduleEnded ? (
                              <>
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </>
                            ) : (
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                            )}
                          </span>
                          {statePill.text}
                        </span>
                      </div>

                      <div className="px-5 sm:px-6 py-5 space-y-5">
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {riText(
                            "When the schedule runs, a customer invoice is created from this profile with the same line items and totals. Dates follow the server schedule in {{utc}}, matching the daily job.",
                            { utc: riText("UTC") },
                          )}
                        </p>

                        {!willRun ? (
                          <div
                            className={`rounded-xl border px-4 py-3.5 text-sm leading-relaxed flex items-start gap-3 ${
                              isPaused
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-gray-200 bg-gray-50 text-gray-700"
                            }`}
                          >
                            <Info
                              className={`w-5 h-5 mt-0.5 shrink-0 ${
                                isPaused ? "text-amber-600" : "text-gray-500"
                              }`}
                            />
                            <div className="min-w-0">
                              {isPaused ? (
                                <>
                                  <p className="font-semibold">
                                    {riText("Recurrence is paused")}
                                  </p>
                                  <p className="mt-0.5 text-amber-900/90">
                                    {riText(
                                      "No invoice will be created until you resume.",
                                    )}
                                    {hasNextRun ? (
                                      <>
                                        {" "}
                                        {riText("Next run when active: {{date}}.", {
                                          date: format(nextRun, "dd MMM yyyy"),
                                        })}
                                      </>
                                    ) : null}
                                  </p>
                                </>
                              ) : scheduleEnded ? (
                                <>
                                  <p className="font-semibold">
                                    {riText("Schedule has ended")}
                                  </p>
                                  <p className="mt-0.5">
                                    {riText(
                                      "The end date has passed — no further automatic invoices are due.",
                                    )}
                                  </p>
                                </>
                              ) : !hasNextRun ? (
                                <p className="font-medium">
                                  {riText("No next invoice date scheduled.")}
                                </p>
                              ) : (
                                <p className="font-medium">
                                  {riText(
                                    "Automatic invoices are not created for this profile.",
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Date tiles + countdown */}
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                              <div className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-[var(--p-blue)]/40">
                                <div className="flex items-center gap-2 text-[var(--p-blue)]">
                                  <Calendar className="w-4 h-4" />
                                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                                    {riText("Invoice date")}
                                  </p>
                                </div>
                                <p className="mt-1.5 text-xl font-semibold text-gray-900 tabular-nums">
                                  {format(nextRun, "dd MMM yyyy")}
                                </p>
                                {relLabel ? (
                                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--p-blue)] bg-[var(--p-blue)]/10 border border-[var(--p-blue)]/20 px-2 py-0.5 rounded-full">
                                    <Timer className="w-3 h-3" />
                                    {relLabel}
                                  </p>
                                ) : null}
                              </div>

                              <div className="hidden lg:flex items-center justify-center text-gray-300">
                                <ArrowRight className="w-5 h-5" />
                              </div>

                              <div className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-[var(--p-blue)]/40">
                                <div className="flex items-center gap-2 text-gray-500">
                                  <CalendarClock className="w-4 h-4" />
                                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                                    {riText("Due date")}
                                  </p>
                                </div>
                                <p className="mt-1.5 text-xl font-semibold text-gray-900 tabular-nums">
                                  {nextDue
                                    ? format(nextDue, "dd MMM yyyy")
                                    : "—"}
                                </p>
                                {!nextDue ? (
                                  <p className="mt-1 text-[11px] text-amber-800">
                                    {riText(
                                      "Set template invoice and due dates on the profile to preview.",
                                    )}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[var(--p-blue)]/20 bg-gradient-to-r from-[var(--p-blue)]/[0.06] to-indigo-50/40 px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-white/80 border border-[var(--p-blue)]/15 p-2 text-[var(--p-blue)] shadow-sm">
                                  <Wallet className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    {riText("Amount")}
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    {riText("Final billed amount per run")}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                                  {curr ? (
                                    <>
                                      <span className="text-sm font-semibold text-gray-500 tracking-wide mr-1.5">
                                        {curr}
                                      </span>
                                      {formatAmount(grand)}
                                    </>
                                  ) : (
                                    formatAmount(grand)
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* On creation + Invoice number */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div
                                className={`rounded-xl border p-4 ${
                                  willEmail
                                    ? "border-emerald-200 bg-emerald-50/60"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`rounded-lg p-1.5 ${
                                      willEmail
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {willEmail ? (
                                      <Mail className="w-4 h-4" />
                                    ) : (
                                      <FileText className="w-4 h-4" />
                                    )}
                                  </div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    {riText("On creation")}
                                  </p>
                                </div>
                                {willEmail ? (
                                  <p className="mt-2 text-sm text-gray-800 leading-relaxed">
                                    <span className="font-semibold text-emerald-700">
                                      {riText("Email customer")}
                                    </span>{" "}
                                    {riText(
                                      "— invoice status {{status}} after send (same as {{action}} on customer invoices).",
                                      {
                                        status: riText("pending"),
                                        action: riText("Save and send"),
                                      },
                                    )}
                                  </p>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-800 leading-relaxed">
                                    <span className="font-semibold">
                                      {riText("Saved as draft")}
                                    </span>{" "}
                                    {riText(
                                      "— same behavior as {{action}} on customer invoices.",
                                      { action: riText("Save as draft") },
                                    )}
                                  </p>
                                )}
                              </div>

                              <div className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex items-center gap-2">
                                  <div className="rounded-lg p-1.5 bg-gray-100 text-gray-600">
                                    <Hash className="w-4 h-4" />
                                  </div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    {riText("Invoice number")}
                                  </p>
                                </div>
                                <p className="mt-2 text-sm text-gray-800 leading-relaxed">
                                  {riText(
                                    "Assigned automatically when the invoice is generated (sequence per business).",
                                  )}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
