/**
 * Full-screen e-invoice details — layout aligned with InvoisPls
 * `/invoices/e-invoice/:code` (see demo.invoispls.my), themed with PCI CSS variables.
 */
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import EInvoiceServices from "@/services/EInvoiceServices";
import { formatCurrencyAmount } from "@/components/formatAmount";
import { redactPasswordsForDisplay } from "@/utils/sanitizeEInvoiceApiDisplay";

function formatDateTime(value, locale) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return String(value);
  }
}

export default function EInvoiceDetailsPage() {
  const { t, i18n } = useTranslation();
  const { code } = useParams();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eInvoiceDetails, setEInvoiceDetails] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await EInvoiceServices.getDetails(code);
        if (cancelled) return;
        if (data && data.status) {
          setEInvoiceDetails(data);

          const invoiceId = data?.data?.invoiceId;
          const hasUuid = Boolean(data?.data?.uuid);
          const lhdnStatus = (data?.data?.lhdn_status || "").toString();
          const shouldAutoSync =
            Boolean(invoiceId) &&
            hasUuid &&
            ["Submitted", "Pending"].includes(lhdnStatus);

          if (shouldAutoSync) {
            try {
              const { data: refreshed } = await EInvoiceServices.getStatus(invoiceId);
              if (cancelled) return;
              if (refreshed?.status && refreshed?.data) {
                setEInvoiceDetails((prev) => ({
                  ...(prev || {}),
                  ...(refreshed || {}),
                  data: {
                    ...(prev?.data || {}),
                    ...(refreshed?.data || {}),
                  },
                }));
              }
            } catch {
              // Silent best-effort sync on page load.
            }
          }
        } else
          setError(
            data?.message ||
              t("accounts.customerInvoices.eInvoiceDetails.fetchFailed"),
          );
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ||
            err.message ||
            t("accounts.customerInvoices.eInvoiceDetails.fetchError"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, t]);

  const goBack = () => history.push("/customer-invoices");

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="w-full  mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center min-h-[50vh]">
          <div
            className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-[var(--p-blue)] animate-spin"
            aria-hidden
          />
          <p className="text-sm text-gray-600 mt-4">
            {t("accounts.customerInvoices.eInvoiceDetails.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error && !eInvoiceDetails) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              type="button"
              onClick={goBack}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t("accounts.customerInvoices.eInvoiceDetails.title")}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {t("accounts.customerInvoices.eInvoiceDetails.subtitle")}
              </p>
            </div>
          </div>
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  const d = eInvoiceDetails?.data;
  const notAvailable = t("common.notAvailable", { defaultValue: "N/A" });
  const lhdn = d?.lhdn_status || "N/A";
  const statusLabel = t(
    `accounts.customerInvoices.eInvoiceDetails.statuses.${lhdn
      .toLowerCase()
      .replace(/\s+/g, "")}`,
    { defaultValue: lhdn },
  );
  const displayInvoiceRef =
    d?.invoiceNumber ||
    d?.code ||
    (typeof code === "string" ? code : "") ||
    notAvailable;
  const hasDistinctCode =
    d?.invoiceNumber &&
    d?.code &&
    String(d.invoiceNumber).trim() !== String(d.code).trim();

  const statusPillClass =
    lhdn === "Valid"
      ? "bg-green-100 text-green-800 border border-green-300"
      : lhdn === "Invalid"
        ? "bg-red-100 text-red-800 border border-red-300"
        : lhdn === "Pending"
          ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
          : lhdn === "Rejected"
            ? "bg-red-100 text-red-800 border border-red-300"
            : lhdn === "Submitted"
              ? "bg-[#E8F0FA] text-[var(--blue-700)] border border-[var(--blue-600)]"
              : "bg-gray-100 text-gray-800 border border-gray-300";

  return (
    <div className="bg-gradient-to-b from-slate-100/80 to-gray-50 min-h-screen pb-10">
      <div className="w-full  mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={goBack}
              className="p-2.5 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 rounded-xl transition-colors shrink-0"
              aria-label={t(
                "accounts.customerInvoices.eInvoiceDetails.backToInvoices",
              )}
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                MyInvois (LHDN)
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {t("accounts.customerInvoices.eInvoiceDetails.eInvoice")}
              </h1>
              <p className="text-sm text-gray-600 mt-1 font-mono">
                {displayInvoiceRef}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="status"
          >
            {error}
          </div>
        ) : null}

        {eInvoiceDetails?.error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {eInvoiceDetails.message}
          </div>
        ) : eInvoiceDetails ? (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-white to-slate-50/90 rounded-xl p-5 border border-gray-200/80 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--p-blue)] shrink-0" />
                  {t("common.status")}
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                  <span className="text-sm font-medium text-gray-700">
                    {t("accounts.customerInvoices.eInvoiceDetails.lhdnStatus")}:
                  </span>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm ${statusPillClass}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                {eInvoiceDetails.message ? (
                  <div className="rounded-lg p-3 border border-[var(--p-blue-light)] bg-[#FFF8F0]">
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold text-[var(--p-blue-dark)]">
                        {t("accounts.customerInvoices.eInvoiceDetails.message")}:{" "}
                      </span>
                      {eInvoiceDetails.message}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm ring-1 ring-black/5">
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--blue-600)] shrink-0" />
                  {t(
                    "accounts.customerInvoices.eInvoiceDetails.invoiceInformation",
                  )}
                </h3>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t(
                        "accounts.customerInvoices.eInvoiceDetails.invoiceReference",
                      )}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 break-all">
                      {d?.invoiceNumber || d?.code || notAvailable}
                    </span>
                  </div>
                  {hasDistinctCode ? (
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t(
                          "accounts.customerInvoices.eInvoiceDetails.alternateCode",
                        )}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 break-all">
                        {d?.code}
                      </span>
                    </div>
                  ) : null}
                  {d?.uuid ? (
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        UUID
                      </span>
                      <span className="text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded border border-gray-100">
                        {d.uuid}
                      </span>
                    </div>
                  ) : null}
                  {d?.submissionUid ? (
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t(
                          "accounts.customerInvoices.eInvoiceDetails.submissionUid",
                        )}
                      </span>
                      <span className="text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded border border-gray-100">
                        {d.submissionUid}
                      </span>
                    </div>
                  ) : null}
                  {d?.longID ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t("accounts.customerInvoices.eInvoiceDetails.longId")}
                      </span>
                      <span className="text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded border border-gray-100">
                        {d.longID}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm ring-1 ring-black/5">
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--p-blue)] shrink-0" />
                  {t("accounts.customerInvoices.eInvoiceDetails.timestamps")}
                </h3>
                <div className="space-y-3">
                  {d?.submitted_time ? (
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t(
                          "accounts.customerInvoices.eInvoiceDetails.submitted",
                        )}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDateTime(d.submitted_time, i18n.language)}
                      </span>
                    </div>
                  ) : null}
                  {d?.processed_time ? (
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t(
                          "accounts.customerInvoices.eInvoiceDetails.processedTime",
                        )}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDateTime(d.processed_time, i18n.language)}
                      </span>
                    </div>
                  ) : null}
                  {d?.createdAt ? (
                    <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t("common.created", { defaultValue: "Created" })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDateTime(d.createdAt, i18n.language)}
                      </span>
                    </div>
                  ) : null}
                  {d?.updatedAt ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t("common.updated", { defaultValue: "Updated" })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDateTime(d.updatedAt, i18n.language)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {(d?.subtotal != null ||
              d?.total != null ||
              (d?.items && d.items.length > 0)) && (
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm ring-1 ring-black/5">
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  {t(
                    "accounts.customerInvoices.eInvoiceDetails.amountsAndLines",
                  )}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {d.subtotal != null ? (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">
                        {t("documents.summary.subtotal", {
                          defaultValue: "Subtotal",
                        })}
                      </span>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrencyAmount(d.currency, d.subtotal)}
                      </p>
                    </div>
                  ) : null}
                  {d.tax != null && d.tax > 0 ? (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">
                        {t("common.tax")}
                      </span>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrencyAmount(d.currency, d.tax)}
                      </p>
                    </div>
                  ) : null}
                  {d.total != null ? (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">
                        {t("common.total")}
                      </span>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrencyAmount(d.currency, d.total)}
                      </p>
                    </div>
                  ) : null}
                </div>
                {Array.isArray(d.items) && d.items.length > 0 ? (
                  <div className="border-t border-gray-100 pt-3 max-h-48 overflow-auto">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {t(
                        "accounts.customerInvoices.eInvoiceDetails.lineItems",
                        { count: d.items.length },
                      )}
                    </p>
                    <ul className="space-y-2 text-sm">
                      {d.items.slice(0, 50).map((line, idx) => (
                        <li
                          key={line._id || line.item_id || idx}
                          className="flex justify-between gap-2 border-b border-gray-50 pb-1"
                        >
                          <span className="text-gray-800 truncate">
                            {line.item_name ||
                              line.title ||
                              t("common.item")}
                          </span>
                          <span className="text-gray-600 shrink-0">
                            {line.quantity != null ? `×${line.quantity} ` : ""}
                            {line.amount != null
                              ? Number(line.amount).toFixed(2)
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            {eInvoiceDetails.link ? (
              <div className="rounded-xl p-5 sm:p-6 border border-[var(--p-blue-light)] shadow-md bg-gradient-to-br from-white via-[#FFF8F0]/90 to-[#E8F0FA]/80 ring-1 ring-[var(--p-blue-light)]/40">
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--p-blue)] shrink-0" />
                  {t(
                    "accounts.customerInvoices.eInvoiceDetails.publicLink",
                  )}
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-8 mb-5">
                  <div className="flex flex-col items-center mx-auto sm:mx-0 sm:shrink-0">
                    <div className="bg-white p-4 rounded-xl border-2 border-white shadow-lg ring-1 ring-gray-200/80">
                      <QRCodeSVG
                        value={eInvoiceDetails.link}
                        size={200}
                        level="H"
                        includeMargin
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-3 text-center max-w-xs">
                      {t(
                        "accounts.customerInvoices.eInvoiceDetails.scanToOpen",
                      )}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 w-full border-t sm:border-t-0 sm:border-l border-[var(--p-blue-light)] pt-4 sm:pt-0 sm:pl-8">
                    <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                      {t(
                        "accounts.customerInvoices.eInvoiceDetails.openInBrowser",
                      )}
                    </p>
                    <a
                      href={eInvoiceDetails.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-2 font-medium text-sm break-all bg-white/90 px-4 py-3 rounded-lg border border-[var(--blue-600)] text-[var(--blue-700)] hover:bg-white transition-colors w-full shadow-sm"
                    >
                      <ExternalLink
                        size={16}
                        className="flex-shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <span className="text-left break-all">{eInvoiceDetails.link}</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            {(eInvoiceDetails.reason ||
              d?.reason ||
              eInvoiceDetails.error) && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-5 border border-red-200 shadow-sm">
                <h3 className="text-base font-bold text-red-800 mb-3">
                  {t(
                    "accounts.customerInvoices.eInvoiceDetails.errorReason",
                  )}
                </h3>
                <div className="bg-white rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-red-900 font-medium whitespace-pre-wrap">
                    {eInvoiceDetails.reason ||
                      d?.reason ||
                      eInvoiceDetails.error?.message ||
                      notAvailable}
                  </p>
                </div>
              </div>
            )}

            {d?.validationResults &&
              Array.isArray(d.validationResults) &&
              d.validationResults.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-5 border border-yellow-200 shadow-sm">
                  <h3 className="text-base font-bold text-yellow-800 mb-3">
                    {t(
                      "accounts.customerInvoices.eInvoiceDetails.validationResults",
                    )}
                  </h3>
                  <div className="bg-white rounded-lg p-4 border border-yellow-200 max-h-64 overflow-auto">
                    <pre className="text-xs text-yellow-900 font-mono whitespace-pre-wrap">
                      {JSON.stringify(d.validationResults, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

            {(d?.customerDetails || d?.businessDetails) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {d.customerDetails ? (
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm ring-1 ring-black/5">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      {t("accounts.customerInvoices.eInvoiceDetails.buyer")}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {t(
                            "accounts.customerInvoices.eInvoiceDetails.displayName",
                          )}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {d.customerDetails.basicInformation
                            ?.customerDisplayName || notAvailable}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Email
                        </span>
                        <span className="text-sm font-semibold text-gray-900 break-all">
                          {d.customerDetails.basicInformation
                            ?.customerEmail || notAvailable}
                        </span>
                      </div>
                      {d.customerDetails?.InvoisPlzData &&
                        (d.customerDetails.InvoisPlzData.tin ||
                          d.customerDetails.InvoisPlzData.addressLine1) ? (
                        <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {t(
                              "accounts.customerInvoices.eInvoiceDetails.lhdnBuyer",
                            )}
                          </span>
                          {d.customerDetails.InvoisPlzData.tin ? (
                            <span className="text-sm text-gray-800">
                              TIN: {d.customerDetails.InvoisPlzData.tin}
                            </span>
                          ) : null}
                          {d.customerDetails.InvoisPlzData.addressLine1 ? (
                            <span className="text-sm text-gray-800 break-words">
                              {d.customerDetails.InvoisPlzData.addressLine1}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {d.businessDetails ? (
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm ring-1 ring-black/5">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--p-blue-dark)] shrink-0" />
                      {t("accounts.customerInvoices.eInvoiceDetails.supplier")}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1 pb-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {t(
                            "accounts.customerInvoices.eInvoiceDetails.businessName",
                          )}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {d.businessDetails?.name ||
                            (Array.isArray(d.businessDetails) &&
                              d.businessDetails[0]?.name) ||
                            notAvailable}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {t(
                            "accounts.customerInvoices.eInvoiceDetails.referenceId",
                          )}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 break-all font-mono text-xs">
                          {d.businessDetails?.code ||
                            (Array.isArray(d.businessDetails) &&
                              d.businessDetails[0]?.code) ||
                            notAvailable}
                        </span>
                      </div>
                      {d.businessDetails?.email ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Email
                          </span>
                          <span className="text-sm font-semibold text-gray-900 break-all">
                            {d.businessDetails.email}
                          </span>
                        </div>
                      ) : null}
                      {d.businessDetails?.lhdnSupplier?.tin ? (
                        <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {t(
                              "accounts.customerInvoices.eInvoiceDetails.lhdnSupplier",
                            )}
                          </span>
                          <span className="text-sm text-gray-800">
                            TIN: {d.businessDetails.lhdnSupplier.tin}
                          </span>
                          {d.businessDetails.lhdnSupplier.addressLine1 ? (
                            <span className="text-sm text-gray-800 break-words">
                              {d.businessDetails.lhdnSupplier.addressLine1}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <details className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <summary className="text-sm font-bold text-gray-700 cursor-pointer hover:text-gray-900 p-4 flex items-center justify-between hover:bg-gray-100 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span>
                  {t(
                    "accounts.customerInvoices.eInvoiceDetails.viewFullResponse",
                  )}
                </span>
                <span className="text-gray-400 text-xs font-normal">
                  {t("common.expand", { defaultValue: "Expand" })}
                </span>
              </summary>
              <div className="p-4 bg-white border-t border-gray-200">
                <pre className="text-xs text-gray-800 font-mono overflow-auto max-h-96 bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    redactPasswordsForDisplay(eInvoiceDetails),
                    null,
                    2,
                  )}
                </pre>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}
