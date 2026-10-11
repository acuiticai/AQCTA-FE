import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ExternalLink } from "lucide-react";

import { AdminContext } from "@/context/AdminContext";
import QuotationServices from "@/services/QuotationServices";
import { QuotationTemplateRenderer } from "@/pages/Accounts/CustomerInvoice/components/InvoiceRenderer";
import {
  isQuotationDocumentTemplateType,
  normalizeDocumentTemplateType,
} from "@/utils/invoiceContractMapper";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Same Flexa DocumentTemplate PDF preview as `/quotations/view/:id`.
 * Resolve by Sales Quotation id and/or quote number (e.g. QT-2026-0005).
 */
const FlexaQuotationPreview = ({
  quotationId = "",
  quoteNumber = "",
  className = "",
}) => {
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const headers = useMemo(
    () =>
      adminInfo?.token
        ? { authorization: `Bearer ${adminInfo.token}` }
        : undefined,
    [adminInfo?.token],
  );

  const [quotation, setQuotation] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setQuotation(null);
      try {
        let found = null;
        const id = String(quotationId || "").trim();
        const ref = String(quoteNumber || "").trim();

        if (id) {
          try {
            const res = await QuotationServices.getQuotationById(id);
            found = res?.data?.data || null;
          } catch {
            found = null;
          }
        }

        if (!found && ref) {
          const res = await QuotationServices.getAllQuotations({
            search: ref,
            limit: 20,
            page: 1,
          });
          const rows = res?.data?.data || res?.data?.quotations || [];
          found =
            rows.find(
              (q) =>
                String(q.quote_number || "").trim().toLowerCase() ===
                ref.toLowerCase(),
            ) ||
            rows[0] ||
            null;
        }

        if (!cancelled) {
          if (!found) {
            setError(
              ref
                ? `No Flexa quotation found for ${ref}.`
                : "No Flexa quotation linked yet.",
            );
          }
          setQuotation(found);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message || "Failed to load Flexa quotation.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotationId, quoteNumber]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!quotation) {
        setTemplateData(null);
        return;
      }
      const businessId =
        quotation.business_id?._id ||
        (typeof quotation.business_id === "string"
          ? quotation.business_id
          : "") ||
        quotation.business?._id ||
        (typeof quotation.business === "string" ? quotation.business : "");

      setTemplateLoading(true);
      try {
        let chosen = null;
        const config = headers ? { headers } : undefined;
        const savedTemplateId =
          quotation.templateId?._id ||
          quotation.templateId ||
          (typeof quotation.templateId === "object"
            ? quotation.templateId?.id
            : "");

        if (savedTemplateId && businessId) {
          try {
            const res = await axios.get(
              `${Base_URL}/document-templates/${savedTemplateId}`,
              config,
            );
            const t = res?.data?.data || res?.data;
            if (t && (t.htmlContent || t._id)) chosen = t;
          } catch {
            /* fall through */
          }
        }
        if (!chosen && businessId) {
          try {
            const res = await axios.get(
              `${Base_URL}/business-templates/${businessId}`,
              config,
            );
            const assignments = res?.data?.data || [];
            const match =
              assignments.find(
                (a) =>
                  a?.isActive &&
                  a?.isDefault &&
                  isQuotationDocumentTemplateType(a.type, a.templateId?.type),
              ) ||
              assignments.find(
                (a) =>
                  a?.isActive &&
                  isQuotationDocumentTemplateType(a.type, a.templateId?.type),
              );
            if (match?.templateId) chosen = match.templateId;
          } catch {
            /* fall through */
          }
        }
        if (!chosen) {
          try {
            const res = await axios.get(
              `${Base_URL}/document-templates`,
              config,
            );
            const all = res?.data?.data || res?.data || [];
            chosen = all.find(
              (t) => normalizeDocumentTemplateType(t?.type) === "quotation",
            );
          } catch {
            /* fall through */
          }
        }
        if (chosen && !chosen.htmlContent && (chosen._id || chosen.id)) {
          try {
            const res = await axios.get(
              `${Base_URL}/document-templates/${chosen._id || chosen.id}`,
              config,
            );
            chosen = res?.data?.data || res?.data || chosen;
          } catch {
            /* keep chosen */
          }
        }
        if (!cancelled) setTemplateData(chosen || null);
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotation, headers]);

  const viewId = quotation?._id || quotationId;

  if (loading) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 ${className}`}>
        Loading Flexa quotation preview…
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 ${className}`}>
        {error || "Quotation not available yet."}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">
            {quotation.quote_number}
          </span>
          {" · "}
          Flexa Quotation DocumentTemplate
        </p>
        {viewId ? (
          <Link
            to={`/quotations/view/${viewId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Open full view
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {templateLoading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading quotation template…
          </div>
        ) : !templateData ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-800">
              No quotation template assigned for this business.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Assign a quotation Document Template to enable this preview.
            </p>
          </div>
        ) : (
          <QuotationTemplateRenderer
            quotation={quotation}
            template={templateData}
          />
        )}
      </div>
    </div>
  );
};

export default FlexaQuotationPreview;
