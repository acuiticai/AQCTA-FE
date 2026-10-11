import { useEffect, useRef, useState, useContext, useMemo } from "react";
import { useHistory, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FileText,
  File,
  Paperclip,
  RefreshCw,
  Send,
  ThumbsDown,
  X,
  ShoppingCart,
  Eye,
  Download,
} from "lucide-react";
import { FiMoreVertical } from "react-icons/fi";
import QuotationServices from "@/services/QuotationServices";
import ApplicationServices from "@/services/ApplicationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { QuotationTemplateRenderer } from "@/pages/Accounts/CustomerInvoice/components/InvoiceRenderer";
import {
  formatInvoiceLineTaxColumnDisplay,
  isQuotationDocumentTemplateType,
  normalizeDocumentTemplateType,
} from "@/utils/invoiceContractMapper";
import { formatInvoiceDownloadName } from "@/utils/generic";
import { formatDate, getCurrencyDisplay } from "@/components/formatAmount";
import { fetchAddressTypeConfig } from "@/utils/addressTypeUtils";
import { getModuleRoutePath } from "@/utils/moduleLabels";
import SalesOrderServices from "@/services/SalesOrderServices";
import { CustomModal, PageHeader } from "@/page-layouts/index";

const INVOICEABLE_SO_STATUSES = new Set(["Draft", "Confirmed", "Partially Invoiced"]);

/** Merge multiple `/sales-orders/:id/convert-to-invoice` payloads into one draft (Zoho-style multi-SO bill). */
function mergeSalesOrderConvertPayloads(dataPayloads) {
  if (!dataPayloads?.length) return { merged: null, singleSalesOrderId: null };
  const list = dataPayloads.filter(Boolean);
  if (list.length === 0) return { merged: null, singleSalesOrderId: null };
  if (list.length === 1) {
    const one = list[0];
    const sid = one.salesOrderId?._id || one.salesOrderId;
    return { merged: one, singleSalesOrderId: sid ? String(sid) : null };
  }
  const base = { ...list[0] };
  const items = [];
  let rowId = 1;
  for (const p of list) {
    for (const it of p.items || []) {
      items.push({ ...it, id: rowId++ });
    }
  }
  const sumNum = (key) =>
    list.reduce((s, p) => {
      const v =
        p[key] !== undefined && p[key] !== null && p[key] !== ""
          ? Number(p[key])
          : 0;
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
  base.items = items;
  base.subtotal = sumNum("subtotal");
  base.taxTotal = sumNum("taxTotal");
  base.shippingCharges = sumNum("shippingCharges");
  base.adjustment = sumNum("adjustment");
  base.discountAmount = sumNum("discountAmount");
  const total = list.reduce((s, p) => {
    const raw =
      p.grandTotal !== undefined && p.grandTotal !== null && p.grandTotal !== ""
        ? p.grandTotal
        : p.total;
    const v = Number(raw);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  base.grandTotal = total;
  base.total = total;
  const refs = list.map((p) => p.orderNumber).filter(Boolean);
  base.orderNumber = refs.length ? refs.join(" · ") : base.orderNumber || "";
  delete base.salesOrderId;
  return { merged: base, singleSalesOrderId: null };
}

const statusStyles = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
  invoiced: "bg-violet-50 text-violet-800 border-violet-200",
};

const invoiceStatusStyles = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  generated: "bg-blue-50 text-blue-700 border-blue-200",
};

const formatDisplayValue = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => formatDisplayValue(item))
      .filter((item) => item);
    return normalized.length > 0 ? normalized.join(", ") : "";
  }
  if (typeof value === "object") {
    const preferred = [
      value.mobile,
      value.workPhone,
      value.phone,
      value.primary,
      value.value,
    ].find(Boolean);
    if (preferred) return formatDisplayValue(preferred);
    const compact = Object.values(value)
      .filter((entry) => typeof entry === "string" || typeof entry === "number")
      .map((entry) => String(entry).trim())
      .filter(Boolean);
    return compact.length > 0 ? compact.join(", ") : "";
  }
  return "";
};

function StatusBadge({ status, t }) {
  const normalized = QuotationServices.normalizeStatus(status);
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${
        statusStyles[normalized] || statusStyles.draft
      }`}
    >
      {t(`accounts.quotations.statuses.${normalized}`, {
        defaultValue: QuotationServices.getStatusLabel(normalized),
      })}
    </span>
  );
}

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function QuotationViewer() {
  const { t } = useTranslation();
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const headers = adminInfo?.token
    ? { authorization: `Bearer ${adminInfo.token}` }
    : undefined;
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isConvertConfirmOpen, setIsConvertConfirmOpen] = useState(false);
  const [isAlreadyConvertedModalOpen, setIsAlreadyConvertedModalOpen] =
    useState(false);
  const [isLinkedInvoicesModalOpen, setIsLinkedInvoicesModalOpen] =
    useState(false);
  const [isConvertSoConfirmOpen, setIsConvertSoConfirmOpen] = useState(false);
  const [isLinkedSalesOrdersModalOpen, setIsLinkedSalesOrdersModalOpen] =
    useState(false);
  const [viewMode, setViewMode] = useState("details");
  const [templateData, setTemplateData] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [letterheadPdfUrl, setLetterheadPdfUrl] = useState(null);
  const [letterheadPdfError, setLetterheadPdfError] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef(null);
  const templateContainerRef = useRef(null);
  const letterheadBlobRef = useRef(null);
  const [currenciesList, setCurrenciesList] = useState([]);
  const [addressTypeConfig, setAddressTypeConfig] = useState({
    billingLabel: t("common.billing", { defaultValue: "Billing" }),
    shippingLabel: t("common.shipping", { defaultValue: "Shipping" }),
  });
  const [isInvoiceSoMergeModalOpen, setIsInvoiceSoMergeModalOpen] = useState(false);
  const [selectedSoIdsForInvoice, setSelectedSoIdsForInvoice] = useState([]);
  const [invoiceMergeLoading, setInvoiceMergeLoading] = useState(false);
  const [pciConfirmAction, setPciConfirmAction] = useState(null); // "revise" | "accept"
  const [pciActionLoading, setPciActionLoading] = useState(false);

  const invoiceableSalesOrders = useMemo(() => {
    if (!quotation) return [];
    const convertedSalesOrderId =
      quotation.convertedSalesOrderId?._id || quotation.convertedSalesOrderId;
    const linkedSalesOrders = Array.isArray(quotation.linkedSalesOrders)
      ? quotation.linkedSalesOrders
      : [];
    const entries =
      linkedSalesOrders.length > 0
        ? linkedSalesOrders
        : convertedSalesOrderId
          ? [{ _id: convertedSalesOrderId }]
          : [];
    return entries.filter(
      (so) => so?._id && INVOICEABLE_SO_STATUSES.has(String(so?.status || "")),
    );
  }, [quotation]);

  const businessIdForCurrencies =
    quotation?.business_id?._id ||
    (typeof quotation?.business_id === "string" ? quotation.business_id : "") ||
    "";

  useEffect(() => {
    if (!businessIdForCurrencies) {
      setCurrenciesList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: businessIdForCurrencies },
        });
        if (!cancelled) setCurrenciesList(res.data?.data || []);
      } catch {
        if (!cancelled) setCurrenciesList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessIdForCurrencies]);

  useEffect(() => {
    const loadAddressTypes = async () => {
      const config = await fetchAddressTypeConfig(
        businessIdForCurrencies,
        headers || {},
      );
      setAddressTypeConfig({
        ...config,
        billingLabel:
          config?.billingLabel === "Billing"
            ? t("common.billing", { defaultValue: "Billing" })
            : config?.billingLabel,
        shippingLabel:
          config?.shippingLabel === "Shipping"
            ? t("common.shipping", { defaultValue: "Shipping" })
            : config?.shippingLabel,
      });
    };
    loadAddressTypes();
  }, [businessIdForCurrencies, t]);

  const currencyDisplayLabel = useMemo(() => {
    if (!quotation) return "";
    const resolved = getCurrencyDisplay(quotation.currency, currenciesList);
    if (resolved && resolved !== "—") return resolved;
    const base = currenciesList.find((x) => x.is_base);
    return base?.symbol || base?.code || base?.name || "";
  }, [quotation, currenciesList]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const response = await QuotationServices.getQuotationById(id);
      setQuotation(response.data?.data || null);
    } catch (error) {
      notifyError(
        error.response?.data?.message ||
          t("accounts.quotations.messages.loadFailed", {
            defaultValue: "Failed to load quotation",
          }),
      );
      history.push("/quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target)) {
        setIsMoreActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isInspectionQuotation =
    String(quotation?.module || "").trim() === "engineering_inspection";

  // Inspection quotes use the controlled AQCTA-FOR-06-03 PDF (not Flexa Document Templates).
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    const loadLetterhead = async () => {
      if (!quotation?._id || !isInspectionQuotation) {
        setLetterheadPdfUrl(null);
        setLetterheadPdfError("");
        letterheadBlobRef.current = null;
        return;
      }
      setTemplateLoading(true);
      setTemplateData(null);
      setLetterheadPdfError("");
      try {
        const res = await QuotationServices.getPciLetterheadPdf(
          quotation._id,
          headers ? { headers } : undefined,
        );
        const blob = new Blob([res.data], { type: "application/pdf" });
        letterheadBlobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setLetterheadPdfUrl(objectUrl);
        /* Letterhead endpoint refreshes Finance line items from costing — reload. */
        try {
          const refreshed = await QuotationServices.getQuotationById(quotation._id);
          if (!cancelled && refreshed?.data?.data) {
            setQuotation(refreshed.data.data);
          }
        } catch (refreshErr) {
          console.warn("Inspection quotation refresh after PDF:", refreshErr);
        }
      } catch (err) {
        console.warn("Inspection quotation letterhead PDF:", err);
        letterheadBlobRef.current = null;
        if (!cancelled) {
          setLetterheadPdfUrl(null);
          let message = t("accounts.quotations.viewer.letterheadUnavailable", {
            defaultValue:
              "Inspection quotation PDF (AQCTA-FOR-06-03) is not available yet.",
          });
          const data = err?.response?.data;
          if (data instanceof Blob) {
            try {
              const text = await data.text();
              const parsed = JSON.parse(text);
              if (parsed?.message) message = parsed.message;
            } catch {
              /* keep default */
            }
          } else if (data?.message) {
            message = data.message;
          }
          setLetterheadPdfError(message);
        }
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    };

    loadLetterhead();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?._id, isInspectionQuotation]);

  // Resolve Flexa quotation DocumentTemplate (certification / manual quotes).
  useEffect(() => {
    const loadTemplate = async () => {
      if (!quotation || isInspectionQuotation) return;
      const businessId =
        quotation.business_id?._id ||
        (typeof quotation.business_id === "string" ? quotation.business_id : "") ||
        quotation.business?._id ||
        (typeof quotation.business === "string" ? quotation.business : "");
      setTemplateLoading(true);
      try {
        let chosen = null;
        const savedTemplateId =
          quotation.templateId?._id ||
          quotation.templateId ||
          (typeof quotation.templateId === "object" ? quotation.templateId?.id : "");

        if (savedTemplateId && businessId) {
          const config = headers ? { headers } : undefined;
          try {
            const res = await axios.get(
              `${Base_URL}/document-templates/${savedTemplateId}`,
              config,
            );
            const t = res?.data?.data || res?.data;
            if (t && (t.htmlContent || t._id)) {
              chosen = t;
            }
          } catch (err) {
            console.warn("Quotation saved template fetch:", err);
          }
        }
        if (!chosen && businessId) {
          const config = headers ? { headers } : undefined;
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
          } catch (err) {
            console.warn("Quotation template assignments fetch:", err);
          }
        }
        if (!chosen) {
          try {
            const config = headers ? { headers } : undefined;
            const res = await axios.get(`${Base_URL}/document-templates`, config);
            const all = res?.data?.data || res?.data || [];
            chosen = all.find(
              (t) => normalizeDocumentTemplateType(t?.type) === "quotation",
            );
          } catch (err) {
            console.warn("Quotation template global fetch:", err);
          }
        }
        if (chosen && !chosen.htmlContent && (chosen._id || chosen.id)) {
          try {
            const config = headers ? { headers } : undefined;
            const res = await axios.get(
              `${Base_URL}/document-templates/${chosen._id || chosen.id}`,
              config,
            );
            chosen = res?.data?.data || res?.data || chosen;
          } catch (err) {
            console.warn("Quotation template detail fetch:", err);
          }
        }
        setTemplateData(chosen || null);
      } finally {
        setTemplateLoading(false);
      }
    };
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?._id, quotation?.templateId?._id, quotation?.templateId, isInspectionQuotation]);

  const handleDownloadQuotationPdf = async () => {
    if (isInspectionQuotation) {
      setViewMode("pdf");
      setIsGeneratingPdf(true);
      try {
        let blob = letterheadBlobRef.current;
        if (!blob) {
          const res = await QuotationServices.getPciLetterheadPdf(
            quotation._id,
            headers ? { headers } : undefined,
          );
          blob = new Blob([res.data], { type: "application/pdf" });
          letterheadBlobRef.current = blob;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = formatInvoiceDownloadName(
          quotation.quote_number || "Inspection-Quotation",
        );
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        notifyError(
          err?.response?.data?.message ||
            t("accounts.quotations.viewer.letterheadUnavailable", {
              defaultValue:
                "Inspection quotation PDF (AQCTA-FOR-06-03) is not available yet.",
            }),
        );
      } finally {
        setIsGeneratingPdf(false);
      }
      return;
    }

    if (!templateData) {
      notifyError(
        t("accounts.quotations.viewer.noTemplate", {
          defaultValue:
            "No quotation template assigned. Please assign a quotation template first.",
        }),
      );
      return;
    }
    setViewMode("pdf");
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 150));
    const root = templateContainerRef.current;
    if (!root) {
      notifyError(
        t("accounts.quotations.viewer.contentNotFound", {
          defaultValue: "Could not find quotation content to download.",
        }),
      );
      return;
    }
    setIsGeneratingPdf(true);
    const PAGE_PT_WIDTH = 595;
    const PAGE_PT_HEIGHT = 842;
    const CAPTURE_PX_WIDTH = 794;
    const base = (Base_URL || "").replace(/\/$/, "");
    let wrap = null;
    try {
      const targetPage = root.querySelector(".tpl-doc-page") || root;
      const clone = targetPage.cloneNode(true);
      wrap = document.createElement("div");
      wrap.style.cssText = `position:fixed;left:-9999px;top:0;width:${CAPTURE_PX_WIDTH}px;background:#ffffff;`;
      wrap.appendChild(clone);
      clone.style.width = CAPTURE_PX_WIDTH + "px";
      clone.style.maxWidth = CAPTURE_PX_WIDTH + "px";
      clone.style.boxShadow = "none";
      clone.style.border = "0";
      document.body.appendChild(wrap);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 200));

      const imgs = clone.querySelectorAll("img[src]");
      await Promise.all(
        Array.from(imgs).map((img) => {
          const src = (img.getAttribute("src") || "").trim();
          if (!src || src.startsWith("data:")) return Promise.resolve();
          const isHttp = src.startsWith("http://") || src.startsWith("https://");
          const proxyUrl = isHttp
            ? `${base}/proxy-image?url=${encodeURIComponent(src.replace(/&amp;/g, "&"))}`
            : `${base}/proxy-image?url=${encodeURIComponent(base + (src.startsWith("/") ? src : "/" + src))}`;
          if (!isHttp && !src.startsWith("/")) return Promise.resolve();
          return fetch(proxyUrl, { credentials: "include" })
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
              if (!blob) return;
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const dataUrl = reader.result;
                  if (typeof dataUrl === "string") img.setAttribute("src", dataUrl);
                  resolve();
                };
                reader.onerror = () => resolve();
                reader.readAsDataURL(blob);
              });
            })
            .catch(() => {});
        }),
      );

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      document.body.removeChild(wrap);
      wrap = null;

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const marginTop = 28;
      const marginBottom = 28;
      const contentHeight = PAGE_PT_HEIGHT - marginTop - marginBottom;
      const imgWidth = PAGE_PT_WIDTH;
      const imgHeight = (canvas.height * PAGE_PT_WIDTH) / canvas.width;

      if (imgHeight <= contentHeight) {
        pdf.addImage(imgData, "JPEG", 0, marginTop, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight - contentHeight;
        let position = marginTop - PAGE_PT_HEIGHT;
        pdf.addImage(imgData, "JPEG", 0, marginTop, imgWidth, imgHeight);
        while (heightLeft > 0) {
          pdf.addPage("a4", "portrait");
          pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
          heightLeft -= PAGE_PT_HEIGHT - marginBottom;
          position -= PAGE_PT_HEIGHT;
        }
      }

      const fileName = formatInvoiceDownloadName(
        quotation?.quote_number ||
          t("accounts.quotations.singular", { defaultValue: "Quotation" }),
      );
      const blob = pdf.output("blob");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      notifySuccess(
        t("documents.messages.pdfDownloaded", {
          defaultValue: "PDF downloaded successfully!",
        }),
      );
    } catch (error) {
      console.error("Quotation PDF download error:", error);
      notifyError(
        t("documents.messages.pdfGenerationFailed", {
          defaultValue: "Failed to generate PDF",
        }),
      );
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      setIsGeneratingPdf(false);
    }
  };

  const updateStatus = async (status) => {
    try {
      setActionLoading(true);
      await QuotationServices.updateQuotationStatus(id, status);
      notifySuccess(
        t("accounts.quotations.messages.statusUpdated", {
          defaultValue: "Quotation status updated",
        }),
      );
      fetchQuotation();
    } catch (error) {
      notifyError(
        error.response?.data?.message ||
          t("accounts.quotations.messages.statusUpdateFailed", {
            defaultValue: "Failed to update status",
          }),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const pciWorkflow = quotation?.pciWorkflow || null;
  const canPciRevise = Boolean(pciWorkflow?.canRevise && pciWorkflow?.applicationId);
  const canPciAcceptOnBehalf = Boolean(
    pciWorkflow?.canAcceptOnBehalf && pciWorkflow?.applicationId,
  );

  const handlePciRevise = async () => {
    if (!pciWorkflow?.applicationId || pciActionLoading) return;
    setPciActionLoading(true);
    try {
      const res = await ApplicationServices.reviseQuotation(
        pciWorkflow.applicationId,
        {},
        headers ? { headers } : {},
      );
      if (!res?.data?.status) {
        notifyError(res?.data?.message || "Could not open quotation for revision.");
        return;
      }
      notifySuccess(
        res.data.message ||
          "Costing unlocked. Edit the costing sheet and re-approve to resend.",
      );
      setPciConfirmAction(null);
      history.push(
        `/applications/actions/${pciWorkflow.applicationId}?stage=costing`,
      );
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not open quotation for revision.",
      );
    } finally {
      setPciActionLoading(false);
    }
  };

  const handlePciAcceptOnBehalf = async () => {
    if (!pciWorkflow?.applicationId || pciActionLoading) return;
    setPciActionLoading(true);
    try {
      const res = await ApplicationServices.decideQuotation(
        pciWorkflow.applicationId,
        { decision: "Accepted" },
        headers ? { headers } : {},
      );
      if (!res?.data?.status) {
        notifyError(res?.data?.message || "Could not accept this quotation.");
        return;
      }
      notifySuccess(
        res.data.message || "Quotation accepted on behalf of the customer.",
      );
      setPciConfirmAction(null);
      await fetchQuotation();
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not accept this quotation.",
      );
    } finally {
      setPciActionLoading(false);
    }
  };

  const handleNavigateCreateInvoiceFromQuote = () => {
    history.push({
      pathname: "/create-customer-invoice",
      // Pass the full object so the invoice form can prefill without an extra API call.
      state: { fromQuotationData: quotation },
    });
  };

  const handleOpenAttachment = async (documentId) => {
    if (!documentId) return;
    try {
      const response = await axios.get(`${Base_URL}/documents/getFileWithAllData/${documentId}`);
      const url = response.data?.data?.url;
      if (url) window.open(url, "_blank");
      else
        notifyError(
          t("documents.messages.resolveUrlFailed", {
            defaultValue: "Could not resolve file URL.",
          }),
        );
    } catch {
      notifyError(
        t("documents.messages.openFailed", { defaultValue: "Could not open file." }),
      );
    }
  };

  const handleNavigateCreateSaleOrderFromQuote = () => {
    setIsConvertSoConfirmOpen(false);
    history.push({
      pathname: getModuleRoutePath("saleOrder", "create"),
      state: { fromQuotationData: quotation },
    });
  };

  const toggleSoIdForInvoiceMerge = (soId) => {
    const sid = String(soId);
    setSelectedSoIdsForInvoice((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  };

  const handleConfirmInvoiceFromQuoteMergeModal = async () => {
    if (!quotation) return;
    if (selectedSoIdsForInvoice.length === 0) {
      setIsInvoiceSoMergeModalOpen(false);
      setIsConvertConfirmOpen(true);
      return;
    }
    setInvoiceMergeLoading(true);
    try {
      const payloads = await Promise.all(
        selectedSoIdsForInvoice.map(async (soId) => {
          const res = await SalesOrderServices.convertToInvoice(soId, headers);
          if (!res.data?.success) {
            throw new Error(
              res.data?.message ||
                t("accounts.quotations.messages.orderLinesLoadFailed", {
                  defaultValue: "Could not load sale order billing lines",
                }),
            );
          }
          return res.data.data;
        }),
      );
      const { merged, singleSalesOrderId } = mergeSalesOrderConvertPayloads(payloads);
      if (!merged?.items?.length) {
        notifyError(
          t("accounts.quotations.messages.noBillableLines", {
            defaultValue: "No billable lines found on the selected sale order(s).",
          }),
        );
        return;
      }
      setIsInvoiceSoMergeModalOpen(false);
      history.push({
        pathname: "/create-customer-invoice",
        state: {
          fromQuotationData: quotation,
          salesOrderData: merged,
          ...(singleSalesOrderId ? { salesOrderId: singleSalesOrderId } : {}),
        },
      });
    } catch (err) {
      notifyError(
        err?.message ||
          t("accounts.quotations.messages.prepareInvoiceFailed", {
            defaultValue: "Could not prepare invoice from the selected sale order(s).",
          }),
      );
    } finally {
      setInvoiceMergeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {t("accounts.quotations.loading", { defaultValue: "Loading quotation..." })}
          </p>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-6 text-gray-600">
        {t("accounts.quotations.messages.notFound", {
          defaultValue: "Quotation not found.",
        })}
      </div>
    );
  }

  const normalizedStatus = QuotationServices.normalizeStatus(quotation.status);
  const convertedInvoiceId =
    quotation.convertedInvoiceId?._id || quotation.convertedInvoiceId;
  const linkedInvoices = Array.isArray(quotation.linkedInvoices)
    ? quotation.linkedInvoices
    : [];
  const linkedInvoiceEntries =
    linkedInvoices.length > 0 ? linkedInvoices : [{ _id: convertedInvoiceId }];
  const hasLinkedInvoices = linkedInvoices.length > 0 || Boolean(convertedInvoiceId);
  const convertedSalesOrderId =
    quotation.convertedSalesOrderId?._id || quotation.convertedSalesOrderId;
  const linkedSalesOrders = Array.isArray(quotation.linkedSalesOrders)
    ? quotation.linkedSalesOrders
    : [];
  const linkedSalesOrderEntries =
    linkedSalesOrders.length > 0
      ? linkedSalesOrders
      : convertedSalesOrderId
        ? [{ _id: convertedSalesOrderId }]
        : [];
  const hasLinkedSalesOrders =
    linkedSalesOrders.length > 0 || Boolean(convertedSalesOrderId);
  const isQuotationInvoiced =
    normalizedStatus === "invoiced" || hasLinkedInvoices;
  const isPciQuotation =
    ["product_certification", "engineering_inspection"].includes(
      String(quotation.module || "").trim(),
    ) || Boolean(pciWorkflow);
  const canInitiateConversion = !["rejected", "expired"].includes(normalizedStatus);
  /* Certification / inspection invoices are raised only when the customer
     accepts — not from Convert to Invoice. */
  const canInitiateInvoiceConversion = canInitiateConversion && !isPciQuotation;
  const canConvertToSalesOrder =
    normalizedStatus === "accepted" && !isQuotationInvoiced;
  const customerBasicInfo = quotation.customer_id?.basicInformation || {};
  const customerCompanyInfo = quotation.customer_id?.companyInfo || {};
  const customerNameValue =
    quotation.customer_name ||
    customerBasicInfo.customerDisplayName ||
    customerBasicInfo.companyName ||
    "";
  const customerEmailValue = quotation.customer_email || customerBasicInfo.customerEmail || "";
  const customerPhoneValue =
    customerBasicInfo.customerPhone ||
    customerBasicInfo.mobile ||
    customerBasicInfo.phone ||
    "";
  const customerTaxNumberValue =
    customerBasicInfo.taxNumber ||
    customerCompanyInfo.taxNumber ||
    customerCompanyInfo.taxNo ||
    "";
  const customerBillingAddressValue =
    quotation.billingAddress || customerCompanyInfo.billingAddress || "";
  const customerShippingAddressValue =
    quotation.shippingAddress || customerCompanyInfo.shippingAddress || "";
  const business = quotation.business_id || {};
  const businessNameValue = business.name || "";
  const businessEmailValue = business.email || business.businessEmail || "";
  const businessPhoneValue = business.phone || business.contactNumber || "";
  const customerNameDisplay = formatDisplayValue(customerNameValue);
  const customerPhoneDisplay = formatDisplayValue(customerPhoneValue);
  const customerEmailDisplay = formatDisplayValue(customerEmailValue);
  const customerTaxNumberDisplay = formatDisplayValue(customerTaxNumberValue);
  const customerBillingAddressDisplay = formatDisplayValue(customerBillingAddressValue);
  const customerShippingAddressDisplay = formatDisplayValue(customerShippingAddressValue);
  const businessNameDisplay = formatDisplayValue(businessNameValue);
  const businessPhoneDisplay = formatDisplayValue(businessPhoneValue);
  const businessEmailDisplay = formatDisplayValue(businessEmailValue);
  const quoteNumberDisplay = formatDisplayValue(quotation.quote_number);
  const quoteDateDisplay = quotation.quote_date ? formatDate(quotation.quote_date) : "";
  const expiryDateDisplay = quotation.expiry_date ? formatDate(quotation.expiry_date) : "";
  const currencyDisplay = currencyDisplayLabel;
  const totalDisplay =
    quotation.grandTotal != null
      ? QuotationServices.formatCurrency(
          quotation.grandTotal,
          quotation.currency,
          currenciesList,
        )
      : "";
  const hasCustomerInfo =
    customerNameDisplay ||
    customerEmailDisplay ||
    customerPhoneDisplay ||
    customerTaxNumberDisplay ||
    customerBillingAddressDisplay ||
    customerShippingAddressDisplay;
  const hasBusinessInfo = businessNameDisplay || businessPhoneDisplay || businessEmailDisplay;
  const hasQuotationInfo =
    quoteNumberDisplay ||
    quotation.status ||
    quoteDateDisplay ||
    expiryDateDisplay ||
    currencyDisplay ||
    totalDisplay;

  const openConvertToInvoice = () => {
    // We already guard visibility in the UI, but we can do a secondary check here
    if (hasLinkedInvoices) {
      setIsAlreadyConvertedModalOpen(true);
    } else if (invoiceableSalesOrders.length > 0) {
      setSelectedSoIdsForInvoice([]);
      setIsInvoiceSoMergeModalOpen(true);
    } else {
      setIsConvertConfirmOpen(true);
    }
  };

  const pageHeaderSubtitle =
    customerNameDisplay ||
    quotation.customer_name ||
    t("accounts.quotations.viewer.customerQuotation", {
      defaultValue: "Customer quotation",
    });

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-gray-50 to-white">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <PageHeader
            title={
              quotation.quote_number ||
              t("accounts.quotations.singular", { defaultValue: "Quotation" })
            }
            description={pageHeaderSubtitle}
            showBackButton
            backFallbackPath="/quotations"
            actionsContainerClassName="flex flex-wrap gap-2 justify-end min-w-0 max-w-full"
            renderActions={
              <>
                <StatusBadge status={quotation.status} t={t} />

                {canPciAcceptOnBehalf ? (
                  <button
                    type="button"
                    disabled={actionLoading || pciActionLoading}
                    onClick={() => setPciConfirmAction("accept")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle size={18} />
                    Accept on behalf
                  </button>
                ) : null}

                {canPciRevise ? (
                  <button
                    type="button"
                    disabled={actionLoading || pciActionLoading}
                    onClick={() => setPciConfirmAction("revise")}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--p-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--p-blue-dark)] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw size={18} />
                    Revise &amp; resend
                  </button>
                ) : null}

                {/* Primary Action */}
                {canInitiateInvoiceConversion && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => openConvertToInvoice()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--p-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--p-blue-dark)] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileText size={18} />
                    {t("accounts.quotations.actions.convertToInvoice", {
                      defaultValue: "Convert to Invoice",
                    })}
                  </button>
                )}

                {canConvertToSalesOrder && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setIsConvertSoConfirmOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShoppingCart size={18} />
                    {t("accounts.quotations.actions.convertToOrder", {
                      defaultValue: "Convert to Order",
                    })}
                  </button>
                )}

                {/* Secondary Action */}
                <button
                  type="button"
                  onClick={() => handleDownloadQuotationPdf()}
                  disabled={
                    isGeneratingPdf ||
                    templateLoading ||
                    (isInspectionQuotation ? !letterheadPdfUrl : !templateData)
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={18} className="text-gray-500" />
                  {isGeneratingPdf
                    ? t("documents.generating", { defaultValue: "Generating..." })
                    : t("documents.downloadPdf", { defaultValue: "Download PDF" })}
                </button>

                {/* More Actions Dropdown */}
                <div className="relative" ref={moreActionsRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreActionsOpen(!isMoreActionsOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300"
                  >
                    <FiMoreVertical size={20} />
                  </button>

                  {isMoreActionsOpen && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-56 origin-top-right rounded-xl border border-gray-200 bg-white p-1 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        {t("accounts.quotations.viewer.workflowActions", {
                          defaultValue: "Workflow Actions",
                        })}
                      </div>
                      {!["rejected", "expired"].includes(normalizedStatus) && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              updateStatus("sent");
                              setIsMoreActionsOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Send size={16} className="text-gray-400" />
                            {t("accounts.quotations.actions.markSent", {
                              defaultValue: "Mark as Sent",
                            })}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading || pciActionLoading}
                            onClick={() => {
                              setIsMoreActionsOpen(false);
                              if (canPciAcceptOnBehalf) {
                                setPciConfirmAction("accept");
                                return;
                              }
                              updateStatus("accepted");
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-green-700 hover:bg-green-50 transition-colors"
                          >
                            <CheckCircle size={16} />
                            {canPciAcceptOnBehalf
                              ? "Accept on behalf of customer"
                              : t("accounts.quotations.actions.accept", {
                                  defaultValue: "Accept Quotation",
                                })}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              updateStatus("rejected");
                              setIsMoreActionsOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 transition-colors"
                          >
                            <ThumbsDown size={16} />
                            {t("accounts.quotations.actions.reject", {
                              defaultValue: "Reject Quotation",
                            })}
                          </button>
                        </>
                      )}
                      {canPciRevise ? (
                        <button
                          type="button"
                          disabled={actionLoading || pciActionLoading}
                          onClick={() => {
                            setIsMoreActionsOpen(false);
                            setPciConfirmAction("revise");
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--p-blue)] hover:bg-blue-50 transition-colors"
                        >
                          <RefreshCw size={16} />
                          Revise &amp; resend
                        </button>
                      ) : null}

                      <div className="my-1 border-t border-gray-100" />
                      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        {t("accounts.quotations.viewer.linkedRecords", {
                          defaultValue: "Linked Records",
                        })}
                      </div>
                      {hasLinkedInvoices && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsLinkedInvoicesModalOpen(true);
                            setIsMoreActionsOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--p-blue)] hover:bg-blue-50 transition-colors"
                        >
                          <ExternalLink size={16} />
                          {t("accounts.quotations.viewer.viewLinkedInvoices", {
                            defaultValue: "View Linked Invoices",
                          })}
                        </button>
                      )}
                      {hasLinkedSalesOrders && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsLinkedSalesOrdersModalOpen(true);
                            setIsMoreActionsOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          <ExternalLink size={16} />
                          {t("accounts.quotations.viewer.viewLinkedOrders", {
                            defaultValue: "View Linked Orders",
                          })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            }
          />
        </div>
      </div>

      {(canPciRevise || canPciAcceptOnBehalf) && pciWorkflow ? (
        <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
          {canPciRevise ? (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <p>
                The customer rejected this quotation
                {pciWorkflow.applicationNumber
                  ? ` (${pciWorkflow.applicationNumber})`
                  : ""}
                . Revise the costing sheet and re-approve to resend. An invoice
                is raised only after they accept.
              </p>
              <button
                type="button"
                disabled={pciActionLoading}
                onClick={() => setPciConfirmAction("revise")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--p-blue)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--p-blue-dark)] disabled:opacity-60"
              >
                <RefreshCw size={16} />
                Revise &amp; resend
              </button>
            </div>
          ) : null}
          {canPciAcceptOnBehalf ? (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Waiting for the customer to accept or decline
                {pciWorkflow.applicationNumber
                  ? ` (${pciWorkflow.applicationNumber})`
                  : ""}
                . You can also record acceptance on their behalf if they
                confirmed outside the portal.
              </p>
              <button
                type="button"
                disabled={pciActionLoading}
                onClick={() => setPciConfirmAction("accept")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle size={16} />
                Accept on behalf
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setViewMode("details")}
            className={`px-4 py-3 text-sm font-medium transition-all relative ${
              viewMode === "details"
                ? "text-[var(--p-blue)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <File size={16} />
              {t("common.details", { defaultValue: "Details" })}
            </div>
            {viewMode === "details" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--p-blue)] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setViewMode("pdf")}
            className={`px-4 py-3 text-sm font-medium transition-all relative ${
              viewMode === "pdf"
                ? "text-[var(--p-blue)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Eye size={16} />
              {t("documents.pdfPreview", { defaultValue: "PDF Preview" })}
            </div>
            {viewMode === "pdf" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--p-blue)] rounded-full" />
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-1 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t("accounts.quotations.fields.quoteDate", { defaultValue: "Quote Date" })}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {formatDate(quotation.quote_date)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t("accounts.quotations.fields.expiryDate", {
                  defaultValue: "Expiry Date",
                })}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {formatDate(quotation.expiry_date)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t("accounts.quotations.viewer.invoicesLinked", {
                  defaultValue: "Invoices Linked",
                })}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {hasLinkedInvoices ? linkedInvoiceEntries.filter((e) => e?._id).length : 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t("accounts.quotations.viewer.ordersLinked", {
                  defaultValue: "Orders Linked",
                })}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {hasLinkedSalesOrders ? linkedSalesOrderEntries.filter((e) => e?._id).length : 0}
              </p>
            </div>
          </div>
        </div>

        {viewMode === "pdf" ? (
          <div
            className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            ref={templateContainerRef}
          >
            {templateLoading ? (
              <div className="p-10 text-center text-sm text-gray-500">
                {t("accounts.quotations.viewer.loadingTemplate", {
                  defaultValue: "Loading quotation template...",
                })}
              </div>
            ) : isInspectionQuotation ? (
              letterheadPdfUrl ? (
                <iframe
                  title={t("accounts.quotations.viewer.inspectionPdfTitle", {
                    defaultValue: "Inspection Quotation PDF",
                  })}
                  src={letterheadPdfUrl}
                  className="w-full border-0 bg-slate-100"
                  style={{ minHeight: "80vh", height: "900px" }}
                />
              ) : (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-gray-800">
                    {letterheadPdfError ||
                      t("accounts.quotations.viewer.letterheadUnavailable", {
                        defaultValue:
                          "Inspection quotation PDF (AQCTA-FOR-06-03) is not available yet.",
                      })}
                  </p>
                </div>
              )
            ) : !templateData ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-gray-800">
                  {t("accounts.quotations.viewer.noBusinessTemplate", {
                    defaultValue: "No quotation template assigned for this business.",
                  })}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {t("accounts.quotations.viewer.assignTemplateHelp", {
                    defaultValue:
                      "Go to Document Templates and assign a quotation template to enable PDF view.",
                  })}
                </p>
              </div>
            ) : (
              <QuotationTemplateRenderer
                quotation={quotation}
                template={templateData}
              />
            )}
          </div>
        ) : null}

        <div
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          style={viewMode === "pdf" ? { display: "none" } : undefined}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
              <h2 className="text-sm font-semibold text-gray-900">
                {t("accounts.quotations.viewer.customerInformation", {
                  defaultValue: "Customer Information",
                })}
              </h2>
              {hasCustomerInfo ? (
                <div className="mt-4 space-y-3 text-sm">
                  {customerNameDisplay ? (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {t("accounts.quotations.fields.customerName", {
                          defaultValue: "Customer Name",
                        })}
                      </p>
                      <p className="mt-1 font-medium text-gray-900">{customerNameDisplay}</p>
                    </div>
                  ) : null}
                  {customerEmailDisplay || customerPhoneDisplay ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {customerEmailDisplay ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {t("common.email", { defaultValue: "Email" })}
                          </p>
                          <p className="mt-1 text-gray-800 break-words">{customerEmailDisplay}</p>
                        </div>
                      ) : null}
                      {customerPhoneDisplay ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {t("common.phone", { defaultValue: "Phone" })}
                          </p>
                          <p className="mt-1 text-gray-800">{customerPhoneDisplay}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {customerTaxNumberDisplay ? (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {t("accounts.quotations.fields.taxNumber", {
                          defaultValue: "Tax Number",
                        })}
                      </p>
                      <p className="mt-1 text-gray-800">{customerTaxNumberDisplay}</p>
                    </div>
                  ) : null}
                  {customerBillingAddressDisplay ? (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {t("accounts.quotations.fields.address", {
                          defaultValue: "{{type}} Address",
                          type: addressTypeConfig.billingLabel,
                        })}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-gray-800">
                        {customerBillingAddressDisplay}
                      </p>
                    </div>
                  ) : null}
                  {customerShippingAddressDisplay ? (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {t("accounts.quotations.fields.address", {
                          defaultValue: "{{type}} Address",
                          type: addressTypeConfig.shippingLabel,
                        })}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-gray-800">
                        {customerShippingAddressDisplay}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  {t("accounts.quotations.viewer.noCustomerDetails", {
                    defaultValue: "No customer details available.",
                  })}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  {t("accounts.quotations.viewer.businessInformation", {
                    defaultValue: "Business Information",
                  })}
                </h2>
                {hasBusinessInfo ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                    {businessNameDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("accounts.quotations.fields.businessName", {
                            defaultValue: "Business Name",
                          })}
                        </p>
                        <p className="mt-1 font-medium text-gray-900">{businessNameDisplay}</p>
                      </div>
                    ) : null}
                    {businessPhoneDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("common.phone", { defaultValue: "Phone" })}
                        </p>
                        <p className="mt-1 text-gray-800">{businessPhoneDisplay}</p>
                      </div>
                    ) : null}
                    {businessEmailDisplay ? (
                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("common.email", { defaultValue: "Email" })}
                        </p>
                        <p className="mt-1 text-gray-800 break-words">{businessEmailDisplay}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    {t("accounts.quotations.viewer.noBusinessDetails", {
                      defaultValue: "No business details available.",
                    })}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  {t("accounts.quotations.viewer.quotationInformation", {
                    defaultValue: "Quotation Information",
                  })}
                </h2>
                {hasQuotationInfo ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                    {quoteNumberDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("accounts.quotations.fields.quoteNumber", {
                            defaultValue: "Quote Number",
                          })}
                        </p>
                        <p className="mt-1 font-medium text-gray-900">{quoteNumberDisplay}</p>
                      </div>
                    ) : null}
                    {quotation.status ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("common.status", { defaultValue: "Status" })}
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={quotation.status} t={t} />
                        </div>
                      </div>
                    ) : null}
                    {quoteDateDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("accounts.quotations.fields.quoteDate", {
                            defaultValue: "Quote Date",
                          })}
                        </p>
                        <p className="mt-1 text-gray-800">{quoteDateDisplay}</p>
                      </div>
                    ) : null}
                    {expiryDateDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("accounts.quotations.fields.expiryDate", {
                            defaultValue: "Expiry Date",
                          })}
                        </p>
                        <p className="mt-1 text-gray-800">{expiryDateDisplay}</p>
                      </div>
                    ) : null}
                    {currencyDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("common.currency", { defaultValue: "Currency" })}
                        </p>
                        <p className="mt-1 text-gray-800">{currencyDisplay}</p>
                      </div>
                    ) : null}
                    {totalDisplay ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {t("common.total", { defaultValue: "Total" })}
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">{totalDisplay}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <p className="mt-3 text-sm text-gray-500">
                      {t("accounts.quotations.viewer.noQuotationDetails", {
                        defaultValue: "No quotation details available.",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {viewMode === "pdf" ? null : hasLinkedInvoices ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {t("accounts.quotations.viewer.linkedInvoices", {
                    defaultValue: "Linked Invoices",
                  })}
                </p>
                <p className="text-xs text-gray-500">
                  {linkedInvoices.length > 0
                    ? t("accounts.quotations.viewer.linkedInvoiceCount", {
                        defaultValue: "{{count}} invoice(s) linked to this quotation",
                        count: linkedInvoices.length,
                      })
                    : t("accounts.quotations.viewer.oneLinkedInvoice", {
                        defaultValue: "1 invoice linked to this quotation",
                      })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkedInvoicesModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-[var(--p-blue)] hover:bg-gray-50"
              >
                {t("common.viewAll", { defaultValue: "View All" })}
                <ExternalLink size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {linkedInvoiceEntries.map((invoice) => {
                const invoiceId = invoice?._id || invoice;
                const invoiceStatus = String(invoice?.status || "draft").toLowerCase();
                return (
                  <Link
                    key={invoiceId}
                    to={`/view-customer-invoice/${invoiceId}`}
                    className="group rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-[var(--p-blue)] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--p-blue)] group-hover:underline">
                          {invoice?.invoice_number ||
                            t("documents.viewInvoice", { defaultValue: "View Invoice" })}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(invoice?.invoice_date || invoice?.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                          invoiceStatusStyles[invoiceStatus] || invoiceStatusStyles.draft
                        }`}
                      >
                        {t(`documents.statuses.${invoiceStatus}`, {
                          defaultValue: invoiceStatus,
                        })}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">
                      {QuotationServices.formatCurrency(
                        invoice?.grandTotal || 0,
                        invoice?.currency || quotation.currency,
                        currenciesList,
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm"
          style={viewMode === "pdf" ? { display: "none" } : undefined}
        >
          <div className="flex items-center gap-2 mb-4">
            <Paperclip size={20} className="text-gray-600 shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t("documents.attachments", { defaultValue: "Attachments" })}
            </h2>
          </div>
          {(quotation.supportingDocuments || []).length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              {t("accounts.quotations.viewer.noAttachments", {
                defaultValue: "No attachments available for this quotation.",
              })}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md overflow-hidden">
              {(quotation.supportingDocuments || []).map((doc) => (
                <li
                  key={doc.fileId || doc.name}
                  className="px-3 py-2.5 flex items-center justify-between gap-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <File size={16} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 truncate">
                      {doc.name || t("documents.file", { defaultValue: "File" })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAttachment(doc.fileId)}
                    className="text-[var(--p-blue)] hover:underline text-sm whitespace-nowrap"
                  >
                    {t("common.open", { defaultValue: "Open" })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6 shadow-sm"
          style={viewMode === "pdf" ? { display: "none" } : undefined}
        >
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("documents.lineItems", { defaultValue: "Line Items" })}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  {t("documents.productOrService", { defaultValue: "Product / Service" })}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  {t("documents.quantityShort", { defaultValue: "Qty" })}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  {t("documents.rate", { defaultValue: "Rate" })}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  {t("documents.discount", { defaultValue: "Discount" })}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  {t("documents.tax", { defaultValue: "Tax" })}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  {t("common.amount", { defaultValue: "Amount" })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(quotation.items || []).map((item) => (
                <tr key={item._id || item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {item.title || item.itemName || item.description || "-"}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-500">{item.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity || 0}</td>
                  <td className="px-4 py-3 text-right">
                    {QuotationServices.formatCurrency(
                      item.unitPrice,
                      quotation.currency,
                      currenciesList,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{item.discount || 0}%</td>
                  <td className="px-4 py-3 text-right">
                    {formatInvoiceLineTaxColumnDisplay(item)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {QuotationServices.formatCurrency(
                      item.totalValue || item.amount,
                      quotation.currency,
                      currenciesList,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          style={viewMode === "pdf" ? { display: "none" } : undefined}
        >
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 space-y-5">
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">
                {t("documents.notes", { defaultValue: "Notes" })}
              </p>
              <p className="text-gray-800 whitespace-pre-line">
                {quotation.customerNotes || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">
                {t("documents.termsAndConditions", { defaultValue: "Terms & Conditions" })}
              </p>
              <p className="text-gray-800 whitespace-pre-line">
                {quotation.termsAndConditions || "-"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">
              {t("accounts.quotations.viewer.summary", { defaultValue: "Order Summary" })}
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">
                  {t("documents.subtotal", { defaultValue: "Subtotal" })}
                </span>
                <span className="font-semibold text-gray-900">
                  {QuotationServices.formatCurrency(
                    quotation.subTotal,
                    quotation.currency,
                    currenciesList,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">
                  {t("documents.taxTotal", { defaultValue: "Tax Total" })}
                </span>
                <span className="font-semibold text-gray-900">
                  {QuotationServices.formatCurrency(
                    quotation.taxTotal,
                    quotation.currency,
                    currenciesList,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">
                  {t("documents.discount", { defaultValue: "Discount" })}
                </span>
                <span className="font-semibold text-red-600">
                  -{QuotationServices.formatCurrency(
                    quotation.discountAmount,
                    quotation.currency,
                    currenciesList,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">
                  {t("documents.shipping", { defaultValue: "Shipping" })}
                </span>
                <span className="font-semibold text-gray-900">
                  {QuotationServices.formatCurrency(
                    quotation.shippingCharges,
                    quotation.currency,
                    currenciesList,
                  )}
                </span>
              </div>
              <div className="pt-4 mt-2 border-t border-dashed border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 text-base uppercase">
                    {t("documents.totalAmount", { defaultValue: "Total Amount" })}
                  </span>
                  <span className="font-black text-2xl text-[var(--p-blue)]">
                    {QuotationServices.formatCurrency(
                      quotation.grandTotal,
                      quotation.currency,
                      currenciesList,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isInvoiceSoMergeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {t("accounts.quotations.modals.invoiceFromQuotation.title", {
                  defaultValue: "Invoice from quotation",
                })}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsInvoiceSoMergeModalOpen(false);
                  setSelectedSoIdsForInvoice([]);
                }}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-gray-700">
              <p>
                {t("accounts.quotations.modals.invoiceFromQuotation.description", {
                  defaultValue:
                    "This quotation has open sale order(s) created from it for this customer. Select one or more orders to pull remaining billable lines into the new invoice, or continue with quotation lines only.",
                })}
              </p>
              {selectedSoIdsForInvoice.length > 1 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {t("accounts.quotations.modals.invoiceFromQuotation.multipleHelp", {
                    defaultValue:
                      "Multiple orders selected: lines are merged into one invoice. Only a single sale order can be linked for automatic quantity tracking — merged lines from several orders are billed without tying the draft to every order.",
                  })}
                </p>
              ) : null}
              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("accounts.quotations.modals.invoiceFromQuotation.orders", {
                    defaultValue: "Sale orders from this quotation",
                  })}
                </div>
                <ul className="max-h-52 divide-y divide-gray-100 overflow-y-auto">
                  {invoiceableSalesOrders.map((so) => {
                    const sid = String(so._id);
                    const checked = selectedSoIdsForInvoice.includes(sid);
                    return (
                      <li key={sid}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                            checked={checked}
                            onChange={() => toggleSoIdForInvoiceMerge(sid)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-gray-900">
                              {so.salesOrderNumber ||
                                t("documents.saleOrder", { defaultValue: "Sale order" })}
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="capitalize">
                                {so.status
                                  ? t(
                                      `documents.statuses.${String(so.status)
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]/g, "")}`,
                                      { defaultValue: so.status },
                                    )
                                  : "—"}
                              </span>
                              <span>·</span>
                              <span>{formatDate(so.salesOrderDate || so.createdAt)}</span>
                              <span>·</span>
                              <span>
                                {QuotationServices.formatCurrency(
                                  so.total || 0,
                                  so.currency || quotation.currency,
                                  currenciesList,
                                )}
                              </span>
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsInvoiceSoMergeModalOpen(false);
                  setSelectedSoIdsForInvoice([]);
                }}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                disabled={invoiceMergeLoading}
                onClick={() => {
                  setSelectedSoIdsForInvoice([]);
                  setIsInvoiceSoMergeModalOpen(false);
                  setIsConvertConfirmOpen(true);
                }}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("accounts.quotations.modals.invoiceFromQuotation.useQuoteLines", {
                  defaultValue: "Use quotation lines only",
                })}
              </button>
              <button
                type="button"
                disabled={invoiceMergeLoading || selectedSoIdsForInvoice.length === 0}
                onClick={handleConfirmInvoiceFromQuoteMergeModal}
                className="rounded-md bg-[var(--p-blue)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {invoiceMergeLoading
                  ? t("common.preparing", { defaultValue: "Preparing…" })
                  : t("accounts.quotations.modals.invoiceFromQuotation.continueSelected", {
                      defaultValue: "Continue with selected",
                    })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isConvertConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {t("accounts.quotations.modals.convertInvoice.title", {
                  defaultValue: "Convert Quotation to Invoice",
                })}
              </h3>
              <button
                type="button"
                onClick={() => setIsConvertConfirmOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700">
              {t("accounts.quotations.modals.convertInvoice.description", {
                defaultValue: "Open a new invoice draft from quotation {{number}}?",
                number: quotation.quote_number,
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsConvertConfirmOpen(false)}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConvertConfirmOpen(false);
                  handleNavigateCreateInvoiceFromQuote();
                }}
                className="rounded-md bg-[var(--p-blue)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {t("common.continue", { defaultValue: "Continue" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAlreadyConvertedModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h3 className="text-base font-semibold text-gray-900">
                  {t("accounts.quotations.modals.alreadyLinked.title", {
                    defaultValue: "Invoice Already Linked",
                  })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAlreadyConvertedModalOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700">
              {t("accounts.quotations.modals.alreadyLinked.description", {
                defaultValue:
                  "This quotation already has linked invoice(s). You can open an existing invoice, or continue to create another invoice from this quotation.",
              })}
            </div>
            <div className="max-h-56 overflow-y-auto px-5 pb-2">
              <div className="space-y-2">
                {linkedInvoiceEntries.map((inv) => {
                  const invId = inv?._id || inv;
                  return (
                    <button
                      key={invId}
                      type="button"
                      onClick={() => {
                        setIsAlreadyConvertedModalOpen(false);
                        history.push(`/view-customer-invoice/${invId}`);
                      }}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-[var(--p-blue)]">
                        {inv?.invoice_number ||
                          t("documents.viewLinkedInvoice", {
                            defaultValue: "View linked invoice",
                          })}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {t(
                          `documents.statuses.${String(inv?.status || "pending")
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "")}`,
                          { defaultValue: inv?.status || "pending" },
                        )}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsAlreadyConvertedModalOpen(false);
                  handleNavigateCreateInvoiceFromQuote();
                }}
                className="rounded-md bg-[var(--p-blue)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {t("accounts.quotations.actions.convertAnyway", {
                  defaultValue: "Convert Anyway",
                })}
              </button>
              <button
                type="button"
                onClick={() => setIsAlreadyConvertedModalOpen(false)}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLinkedInvoicesModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {t("accounts.quotations.modals.linkedInvoices.title", {
                  defaultValue: "Linked Invoices - {{number}}",
                  number: quotation.quote_number,
                })}
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkedInvoicesModalOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-[#f6f8fa] text-left text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">
                        {t("documents.invoiceNumberShort", { defaultValue: "Invoice #" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("common.date", { defaultValue: "Date" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("common.status", { defaultValue: "Status" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t("common.amount", { defaultValue: "Amount" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t("common.action", { defaultValue: "Action" })}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {linkedInvoiceEntries.map((inv) => {
                      const invId = inv?._id || inv;
                      const invStatus = String(inv?.status || "draft").toLowerCase();
                      return (
                        <tr key={invId} className="hover:bg-gray-50/80">
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            {inv?.invoice_number || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {formatDate(inv?.invoice_date || inv?.createdAt)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-md border capitalize ${
                                invoiceStatusStyles[invStatus] ||
                                invoiceStatusStyles.draft
                              }`}
                            >
                              {t(`documents.statuses.${invStatus}`, {
                                defaultValue: invStatus,
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                            {QuotationServices.formatCurrency(
                              inv?.grandTotal || 0,
                              inv?.currency || quotation.currency,
                              currenciesList,
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setIsLinkedInvoicesModalOpen(false);
                                history.push(`/view-customer-invoice/${invId}`);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--p-blue)] hover:underline"
                            >
                              {t("common.view", { defaultValue: "View" })}
                              <ExternalLink size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsLinkedInvoicesModalOpen(false)}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isConvertSoConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {t("accounts.quotations.modals.convertOrder.title", {
                  defaultValue: "Convert to Sale Order",
                })}
              </h3>
              <button
                type="button"
                onClick={() => setIsConvertSoConfirmOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700">
              {t("accounts.quotations.modals.convertOrder.description", {
                defaultValue:
                  "Create a draft sale order from {{number}} with the same lines, pricing, taxes, and terms. You will complete delivery method, salesperson, and PDF template on the next screen (same flow as creating a sale order from scratch).",
                number: quotation.quote_number,
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsConvertSoConfirmOpen(false)}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleNavigateCreateSaleOrderFromQuote}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {t("common.continue", { defaultValue: "Continue" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLinkedSalesOrdersModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {t("accounts.quotations.modals.linkedOrders.title", {
                  defaultValue: "Linked Sale Orders - {{number}}",
                  number: quotation.quote_number,
                })}
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkedSalesOrdersModalOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-[#f6f8fa] text-left text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">
                        {t("documents.saleOrderNumberShort", { defaultValue: "SO #" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("common.date", { defaultValue: "Date" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("common.status", { defaultValue: "Status" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t("common.amount", { defaultValue: "Amount" })}
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t("common.action", { defaultValue: "Action" })}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {linkedSalesOrderEntries
                      .filter((so) => so?._id)
                      .map((so) => {
                        const soId = so._id;
                        return (
                          <tr key={soId} className="hover:bg-gray-50/80">
                            <td className="px-4 py-2.5 font-medium text-gray-900">
                              {so?.salesOrderNumber || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">
                              {formatDate(so?.salesOrderDate || so?.createdAt)}
                            </td>
                            <td className="px-4 py-2.5 capitalize text-gray-800">
                              {so?.status
                                ? t(
                                    `documents.statuses.${String(so.status)
                                      .toLowerCase()
                                      .replace(/[^a-z0-9]/g, "")}`,
                                    { defaultValue: so.status },
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                              {QuotationServices.formatCurrency(
                                so?.total || 0,
                                so?.currency || quotation.currency,
                                currenciesList,
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsLinkedSalesOrdersModalOpen(false);
                                  history.push(`/sales-orders/view/${soId}`);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                {t("common.view", { defaultValue: "View" })}
                                <ExternalLink size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsLinkedSalesOrdersModalOpen(false)}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CustomModal
        open={pciConfirmAction === "revise"}
        onClose={() => !pciActionLoading && setPciConfirmAction(null)}
        title="Revise & resend quotation"
        width="480px"
        loading={pciActionLoading}
        confirmText="Revise & resend"
        savingText="Opening…"
        onConfirm={handlePciRevise}
      >
        <p className="text-sm text-gray-700 leading-relaxed">
          Reopen the costing sheet so you can revise fees and resend the
          quotation to the customer? The same quotation number is kept. No
          invoice will be raised until they accept.
        </p>
      </CustomModal>

      <CustomModal
        open={pciConfirmAction === "accept"}
        onClose={() => !pciActionLoading && setPciConfirmAction(null)}
        title="Accept on behalf of customer"
        width="480px"
        loading={pciActionLoading}
        confirmText="Accept quotation"
        savingText="Accepting…"
        onConfirm={handlePciAcceptOnBehalf}
      >
        <p className="text-sm text-gray-700 leading-relaxed">
          Record acceptance of{" "}
          <span className="font-semibold">
            {quotation?.quote_number || "this quotation"}
          </span>{" "}
          on the customer&apos;s behalf? This opens the project and raises the
          invoice the same way as if they accepted in the portal.
        </p>
      </CustomModal>
    </div>
  );
}
