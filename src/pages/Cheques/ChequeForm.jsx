import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import {
  Page,
  PageHeader,
  InputFieldWithLabel,
  FooterButtons,
  Loader,
  DropdownBasic,
  Button,
  TextArea,
} from "@/page-layouts";
import { useFormScreenExit } from "@/page-layouts";
import CustomDatePicker from "@/components/CustomDatePicker";
import { formatDateToYMD } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import {
  makeChequeT,
  translateChequeStatus,
  CHEQUE_STATUS_KEY,
} from "@/utils/chequeI18n";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import {
  CHEQUE_STATUS_OPTIONS,
  issueDateAllowsBankOutcome,
} from "./ChequeStatusModal";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function toDateInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Normalize API amount (Decimal128 / string / number) for controlled inputs. */
function amountToFormString(val) {
  if (val == null || val === "") return "";
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    if (val.$numberDecimal != null) return String(val.$numberDecimal);
    if (typeof val.toString === "function") {
      const s = String(val.toString()).trim();
      if (s && s !== "[object Object]" && /^-?\d/.test(s)) return s;
    }
  }
  return "";
}

/** Populated Mongoose ref `{ _id, ... }` or raw id → string for selects / query params. */
function refIdToString(val) {
  if (val == null || val === "") return "";
  if (typeof val === "object" && val !== null && val._id != null)
    return String(val._id);
  return String(val);
}

function looksLikeMongoObjectId(s) {
  return typeof s === "string" && /^[a-fA-F0-9]{24}$/.test(s.trim());
}

function parseYmdLocal(ymd) {
  if (!ymd || typeof ymd !== "string") return null;
  const p = ymd.split("-").map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function validateChequeDates({ issueDate, dueDate }, cq) {
  if (dueDate) {
    const due = parseYmdLocal(dueDate);
    if (due && startOfLocalDay(due) < startOfLocalDay(new Date())) {
      return cq(
        "form.validation.dueDateBeforeToday",
        "Due date cannot be before today.",
      );
    }
  }
  if (issueDate && dueDate) {
    const i = parseYmdLocal(issueDate);
    const du = parseYmdLocal(dueDate);
    if (i && du && startOfLocalDay(du) < startOfLocalDay(i)) {
      return cq(
        "form.validation.dueDateBeforeIssue",
        "Due date cannot be before issue date.",
      );
    }
  }
  return null;
}

/** Same pattern as HR Staff / System users / Campaigns: `POST /api/upload` (multipart) → S3, store `s3Key` as storageKey. */
async function uploadAttachmentViaSystemUpload(file, token) {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("file_name", file.name);
  const res = await axios.post(`${Base_URL}/upload`, fd, {
    headers: {
      authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    withCredentials: true,
  });
  const s3Key = res.data?.s3Key;
  if (!s3Key) {
    throw new Error(res.data?.message || "Upload did not return storage key");
  }
  return {
    storageKey: s3Key,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size || 0,
    uploadedAt: new Date().toISOString(),
  };
}

function normalizeFormStatus(s) {
  return s === "Pending" ? "Draft" : s;
}

const emptyForm = (businessId) => ({
  business_id: businessId || "",
  chequeNumber: "",
  vendorId: "",
  bankAccountId: "",
  amount: "",
  currency: "MYR",
  issueDate: "",
  dueDate: "",
  status: "Draft",
  statusReason: "",
  clearedDate: null,
  replacementChequeId: "",
  relatedInvoices: [],
  paymentPurpose: "",
  attachments: [],
});

/** Full-width field stack: label + control (fixes squashed selects in CSS grid). */
function FieldStack({ label, required, children, hint, loading }) {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  return (
    <div className="w-full min-w-0 flex flex-col gap-1.5">
      <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </span>
      <div className="w-full min-w-0 relative min-h-[42px]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/90 dark:bg-gray-900/80 py-3 px-4 min-h-[42px]">
            <Loader color="var(--p-blue)" />
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {cq("form.loadingEllipsis", "Loading…")}
            </span>
          </div>
        ) : (
          children
        )}
      </div>
      {hint ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const ChequeForm = () => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const { id } = useParams();
  const history = useHistory();
  const location = useLocation();
  const isEdit = location.pathname.includes("/edit");
  const exitList = useFormScreenExit("/Cheques");

  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (typeof localStorage !== "undefined" && localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(null);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [invoiceOptions, setInvoiceOptions] = useState([]);
  const [invoiceSeedOptions, setInvoiceSeedOptions] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [originalStatus, setOriginalStatus] = useState("Draft");
  const prevVendorIdRef = useRef(undefined);

  const replacesChequeId = useMemo(() => {
    const q = new URLSearchParams(location.search);
    return q.get("replaces") || "";
  }, [location.search]);
  const replaceReason = location.state?.replaceReason || "";

  const title = useMemo(() => {
    if (!id && replacesChequeId)
      return cq("form.titleReplacement", "Replacement cheque");
    if (!id) return cq("form.titleNew", "New cheque");
    if (isEdit) return cq("form.titleEdit", "Edit cheque");
    return cq("form.titleCheque", "Cheque");
  }, [id, isEdit, replacesChequeId, t]);

  useEffect(() => {
    const loadBiz = async () => {
      if (!adminInfo?.id) {
        setBusinessesLoading(false);
        return;
      }
      setBusinessesLoading(true);
      try {
        const res = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          {
            headers: { authorization: `Bearer ${adminInfo.token}` },
          },
        );
        const list = res.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) {
          setForm((f) => ({ ...f, business_id: list[0]._id }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setBusinessesLoading(false);
      }
    };
    loadBiz();
  }, [adminInfo?.id, adminInfo?.token]);

  useEffect(() => {
    if (!replacesChequeId || id || !adminInfo?.token) return;
    let cancelled = false;
    const loadOriginal = async () => {
      try {
        const res = await axios.get(`${Base_URL}/cheques/${replacesChequeId}`, {
          headers: { authorization: `Bearer ${adminInfo.token}` },
          withCredentials: true,
        });
        const c = res.data?.data;
        if (!c || cancelled) return;
        setForm((f) => ({
          ...f,
          business_id: refIdToString(c.business_id) || f.business_id,
          vendorId: refIdToString(c.vendorId),
          bankAccountId: refIdToString(c.bankAccountId),
          currency: c.currency || "MYR",
          relatedInvoices: (c.relatedInvoices || [])
            .map((inv) => refIdToString(inv))
            .filter(Boolean),
          paymentPurpose: c.paymentPurpose
            ? `${c.paymentPurpose} (replacement for ${c.chequeNumber || ""})`.trim()
            : `Replacement for ${c.chequeNumber || ""}`,
        }));
        const bizId = refIdToString(c.business_id);
        const vendId = refIdToString(c.vendorId);
        if (bizId) loadVendors(bizId, vendId);
      } catch (e) {
        console.error(e);
      }
    };
    loadOriginal();
    return () => {
      cancelled = true;
    };
  }, [replacesChequeId, id, adminInfo?.token]);

  useEffect(() => {
    if (!id) setInvoiceSeedOptions([]);
  }, [id]);

  const loadVendors = async (businessId, keepVendorId = "") => {
    if (!businessId || !adminInfo?.token) {
      setVendorOptions([]);
      setLoadingVendors(false);
      return;
    }
    setLoadingVendors(true);
    try {
      const params = { business_id: businessId };
      // Keep currently selected vendor on edit even if Inactive
      if (keepVendorId) params.include_vendor_id = keepVendorId;
      const res = await axios.get(`${Base_URL}/cheques/vendors-for-business`, {
        params,
        headers: { authorization: `Bearer ${adminInfo.token}` },
        withCredentials: true,
      });
      const list = res.data?.data || [];
      const isActiveVendor = (v) =>
        String(v?.status ?? "Active").toLowerCase() === "active";
      const keepId = keepVendorId ? String(keepVendorId) : "";
      const filtered = list.filter(
        (v) =>
          isActiveVendor(v) || (keepId && String(v._id) === keepId),
      );
      setVendorOptions(
        filtered.map((v) => ({
          value: v._id,
          label:
            v.basicInformation?.vendorDisplayName ||
            v.basicInformation?.companyName ||
            v._id,
        })),
      );
    } catch (e) {
      console.error(e);
      setVendorOptions([]);
    } finally {
      setLoadingVendors(false);
    }
  };

  const loadBanks = async (businessId) => {
    if (!businessId || !adminInfo?.token) {
      setBankOptions([]);
      setLoadingBanks(false);
      return;
    }
    setLoadingBanks(true);
    try {
      const res = await axios.get(`${Base_URL}/bank-management/accounts`, {
        params: {
          business: businessId,
          limit: 500,
          page: 1,
          includeInactive: "true",
        },
        headers: { authorization: `Bearer ${adminInfo.token}` },
        withCredentials: true,
      });
      const raw = res.data?.accounts || [];
      setBankOptions(
        raw.map((a) => ({
          value: a._id,
          label:
            [a.accountName, a.accountNumber, a.bankName]
              .filter(Boolean)
              .join(" · ") || a._id,
        })),
      );
    } catch (e) {
      console.error(e);
      setBankOptions([]);
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadUnpaidVendorInvoices = async (businessId, vendorId) => {
    if (!businessId || !vendorId || !adminInfo?.token) {
      setInvoiceOptions([]);
      setLoadingInvoices(false);
      return;
    }
    setLoadingInvoices(true);
    try {
      const res = await axios.get(
        `${Base_URL}/cheques/unpaid-vendor-invoices`,
        {
          params: { business_id: businessId, vendor_id: vendorId },
          headers: { authorization: `Bearer ${adminInfo.token}` },
          withCredentials: true,
        },
      );
      const blocked = new Set(
        (res.data?.alreadyLinkedInvoiceIds || []).map(String),
      );
      const list = (res.data?.data || []).filter(
        (inv) => !blocked.has(String(inv._id)),
      );
      setInvoiceOptions(
        list.map((inv) => {
          const num = inv.invoice_number || inv.invoiceNumber || inv._id;
          return {
            value: String(inv._id),
            label: `${num} · ${Number(inv.remaining).toFixed(2)} ${inv.currency || "MYR"} · ${String(inv.status || "").trim()}`,
          };
        }),
      );
    } catch (e) {
      console.error(e);
      setInvoiceOptions([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    const prev = prevVendorIdRef.current;
    /** Edit/new form starts with vendorId ""; when cheque API fills vendorId, that is not a user “change vendor” — do not wipe relatedInvoices. */
    const isInitialVendorHydration =
      !!form.vendorId && (prev === undefined || prev === "");
    if (
      !isInitialVendorHydration &&
      prev !== undefined &&
      prev !== form.vendorId
    ) {
      setForm((f) => ({ ...f, relatedInvoices: [] }));
      setInvoiceSeedOptions([]);
    }
    prevVendorIdRef.current = form.vendorId;
  }, [form.vendorId]);

  useEffect(() => {
    if (form.business_id) {
      loadVendors(form.business_id, form.vendorId);
      loadBanks(form.business_id);
    } else {
      setVendorOptions([]);
      setBankOptions([]);
      setInvoiceOptions([]);
      setLoadingVendors(false);
      setLoadingBanks(false);
      setLoadingInvoices(false);
    }
    // Reload when business changes; vendorId only needed so edit keeps selected Inactive vendor once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.business_id, adminInfo?.token]);

  useEffect(() => {
    if (form.business_id && form.vendorId) {
      loadUnpaidVendorInvoices(form.business_id, form.vendorId);
    } else {
      setInvoiceOptions([]);
    }
  }, [form.business_id, form.vendorId, adminInfo?.token]);

  useEffect(() => {
    if (!id || !adminInfo?.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${Base_URL}/cheques/${id}`, {
          headers: { authorization: `Bearer ${adminInfo.token}` },
          withCredentials: true,
        });
        const c = res.data?.data;
        if (cancelled || !c) return;
        const atts = Array.isArray(c.attachments) ? c.attachments : [];
        const relIds = Array.isArray(c.relatedInvoices)
          ? c.relatedInvoices
              .map((x) => {
                if (x != null && typeof x === "object" && x._id != null)
                  return String(x._id);
                if (x != null && x !== "") return String(x).trim();
                return "";
              })
              .filter(Boolean)
          : [];
        const legacyRel =
          c.relatedInvoice != null ? String(c.relatedInvoice).trim() : "";
        if (
          legacyRel &&
          looksLikeMongoObjectId(legacyRel) &&
          !relIds.includes(legacyRel)
        ) {
          relIds.push(legacyRel);
        }
        const relObjs = Array.isArray(c.relatedInvoices)
          ? c.relatedInvoices.filter((x) => x && typeof x === "object" && x._id)
          : [];
        const seeds = relObjs.map((inv) => {
          const num = inv.invoiceNumber || inv.invoice_number || inv._id;
          const rem =
            inv.remainingAmount != null
              ? Number(inv.remainingAmount)
              : Number(inv.total ?? 0);
          return {
            value: String(inv._id),
            label: `${num} · ${Number.isFinite(rem) ? rem.toFixed(2) : "0.00"} ${inv.currency || "MYR"}`,
          };
        });
        setInvoiceSeedOptions(seeds);
        const loadedStatus = normalizeFormStatus(c.status || "Draft");
        setOriginalStatus(loadedStatus);
        setForm({
          business_id: refIdToString(c.business_id),
          chequeNumber: c.chequeNumber || "",
          vendorId: refIdToString(c.vendorId),
          bankAccountId: refIdToString(c.bankAccountId),
          amount: amountToFormString(c.amount),
          currency: c.currency || "MYR",
          issueDate: toDateInput(c.issueDate),
          dueDate: toDateInput(c.dueDate),
          status: loadedStatus,
          statusReason: "",
          clearedDate: c.clearedDate ? new Date(c.clearedDate) : new Date(),
          replacementChequeId: "",
          relatedInvoices: relIds.map(String),
          paymentPurpose: c.paymentPurpose || "",
          attachments: atts.map((a) => ({
            documentType: "additional_document",
            fileName: a.fileName,
            storageKey: a.storageKey,
            mimeType: a.mimeType,
            size: a.size,
            uploadedAt: a.uploadedAt,
          })),
        });
        const bizId = refIdToString(c.business_id);
        const vendId = refIdToString(c.vendorId);
        if (bizId) loadVendors(bizId, vendId);
      } catch (e) {
        notifyError(
          e.response?.data?.error ||
            cq("form.toasts.loadFailed", "Failed to load cheque"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, adminInfo?.token]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const removeAttachment = (index) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((_, i) => i !== index),
    }));
  };

  const fetchAttachmentUrls = async (storageKey, fileName) => {
    const headers = { authorization: `Bearer ${adminInfo.token}` };
    if (id) {
      try {
        const res = await axios.get(`${Base_URL}/cheques/${id}/attachment-url`, {
          params: { storageKey },
          headers,
          withCredentials: true,
        });
        return res.data?.data || res.data;
      } catch (e) {
        if (e.response?.status !== 403) throw e;
      }
    }
    const res = await axios.get(`${Base_URL}/upload/signed-url`, {
      params: { storageKey, fileName },
      headers,
      withCredentials: true,
    });
    return res.data?.data || res.data;
  };

  const handleOpenAttachment = async (attachment) => {
    const storageKey = attachment?.storageKey;
    if (!storageKey || !adminInfo?.token) return;
    const busyKey = `open:${storageKey}`;
    setAttachmentBusy(busyKey);
    try {
      const { openUrl } = await fetchAttachmentUrls(storageKey, attachment.fileName);
      if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
      else notifyError(cq("form.toasts.noFileUrl", "No file URL returned"));
    } catch (e) {
      notifyError(
        e.response?.data?.error ||
          cq("form.toasts.openFileFailed", "Could not open file"),
      );
    } finally {
      setAttachmentBusy(null);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    const storageKey = attachment?.storageKey;
    if (!storageKey || !adminInfo?.token) return;
    const busyKey = `dl:${storageKey}`;
    setAttachmentBusy(busyKey);
    try {
      const { downloadUrl, openUrl } = await fetchAttachmentUrls(
        storageKey,
        attachment.fileName,
      );
      const url = downloadUrl || openUrl;
      if (!url) {
        notifyError(cq("form.toasts.noDownloadUrl", "No download URL returned"));
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", attachment.fileName || "document");
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      notifyError(
        e.response?.data?.error ||
          cq("form.toasts.downloadFileFailed", "Could not download file"),
      );
    } finally {
      setAttachmentBusy(null);
    }
  };

  const onFilesChosen = async (e) => {
    const files = e.target?.files;
    if (!files?.length || !adminInfo?.token) return;
    setUploadBusy(true);
    try {
      const added = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        // eslint-disable-next-line no-await-in-loop
        const meta = await uploadAttachmentViaSystemUpload(
          file,
          adminInfo.token,
        );
        added.push({ documentType: "additional_document", ...meta });
      }
      setForm((f) => ({ ...f, attachments: [...f.attachments, ...added] }));
      notifySuccess(
        added.length === 1
          ? cq("form.toasts.fileUploaded", "File uploaded")
          : cq("form.toasts.filesUploaded", "{{count}} files uploaded", {
              count: added.length,
            }),
      );
    } catch (err) {
      const fallbackNoKey = cq(
        "form.toasts.uploadNoStorageKey",
        "Upload did not return storage key",
      );
      notifyError(
        err.response?.data?.error ||
          (err.message === "Upload did not return storage key"
            ? fallbackNoKey
            : err.message) ||
          cq("form.toasts.uploadFailed", "Upload failed"),
      );
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  };

  const buildPayload = () => {
    const payload = {
      business_id: form.business_id,
      chequeNumber: form.chequeNumber.trim(),
      vendorId: form.vendorId || null,
      bankAccountId: form.bankAccountId || null,
      amount: form.amount,
      currency: form.currency.trim() || "MYR",
      issueDate: form.issueDate || null,
      dueDate: form.dueDate || null,
      relatedInvoices: Array.isArray(form.relatedInvoices)
        ? form.relatedInvoices
        : [],
      paymentPurpose: form.paymentPurpose,
      replacesChequeId: replacesChequeId || undefined,
      attachments: form.attachments,
    };
    if (!id) {
      payload.status = replacesChequeId ? "Draft" : form.status;
      if (
        !replacesChequeId &&
        ["Bounced", "Cancelled", "Replaced"].includes(form.status) &&
        form.statusReason.trim()
      ) {
        payload.reason = form.statusReason.trim();
      }
      if (form.status === "Cleared" && form.clearedDate) {
        payload.clearedDate = new Date(form.clearedDate).toISOString();
      }
    }
    return payload;
  };

  const statusMeta = useMemo(
    () => CHEQUE_STATUS_OPTIONS.find((o) => o.value === form.status),
    [form.status],
  );

  const needsStatusReason =
    form.status === "Bounced" ||
    form.status === "Cancelled" ||
    form.status === "Replaced";
  const needsReplacementId = form.status === "Replaced";
  const needsClearedDate = form.status === "Cleared";
  const bankOutcomeBlocked =
    (form.status === "Cleared" || form.status === "Bounced") &&
    !issueDateAllowsBankOutcome(form.issueDate);

  const createStatusOptions = useMemo(
    () =>
      CHEQUE_STATUS_OPTIONS.filter((o) => o.value !== "Replaced").map((o) => ({
        value: o.value,
        label: translateChequeStatus(t, o.value),
      })),
    [t],
  );

  const editStatusOptions = useMemo(
    () =>
      CHEQUE_STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: translateChequeStatus(t, o.value),
      })),
    [t],
  );

  const validateStatusFields = () => {
    if (replacesChequeId && !id) return true;
    if (needsStatusReason && !form.statusReason.trim()) {
      notifyError(
        form.status === "Bounced"
          ? cq(
              "form.validation.bounceReasonRequired",
              "Please enter a bounce reason.",
            )
          : form.status === "Replaced"
            ? cq(
                "form.validation.replacementReasonRequired",
                "Please enter a replacement reason.",
              )
            : cq(
                "form.validation.cancellationReasonRequired",
                "Please enter a cancellation reason.",
              ),
      );
      return false;
    }
    if (needsReplacementId && !form.replacementChequeId.trim()) {
      notifyError(
        cq(
          "form.validation.replacementChequeIdRequired",
          "Please enter the replacement cheque ID.",
        ),
      );
      return false;
    }
    if (bankOutcomeBlocked) {
      notifyError(
        cq(
          "form.validation.bankOutcomeTooEarly",
          "Cannot mark as Cleared or Bounced before the issue date has passed.",
        ),
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_id) {
      notifyError(cq("form.validation.selectBusiness", "Select a business"));
      return;
    }
    if (!form.chequeNumber.trim()) {
      notifyError(
        cq("form.validation.chequeNumberRequired", "Cheque number is required"),
      );
      return;
    }
    if (!form.bankAccountId) {
      notifyError(
        cq("form.validation.bankAccountRequired", "Bank account is required"),
      );
      return;
    }
    if (!form.issueDate) {
      notifyError(
        cq("form.validation.issueDateRequired", "Issue date is required"),
      );
      return;
    }
    if (!form.dueDate) {
      notifyError(
        cq("form.validation.dueDateRequired", "Due date is required"),
      );
      return;
    }
    if (form.amount === "" || form.amount == null) {
      notifyError(cq("form.validation.amountRequired", "Amount is required"));
      return;
    }
    const dateErr = validateChequeDates(
      {
        issueDate: form.issueDate,
        dueDate: form.dueDate,
      },
      cq,
    );
    if (dateErr) {
      notifyError(dateErr);
      return;
    }
    if (!validateStatusFields()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const url = id ? `${Base_URL}/cheques/${id}` : `${Base_URL}/cheques`;
      const method = id ? "put" : "post";
      const res = await axios[method](url, payload, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
        withCredentials: true,
      });
      const newId = res.data?.data?._id || id;

      if (id && form.status !== originalStatus) {
        const statusBody = { status: form.status };
        if (needsStatusReason) statusBody.reason = form.statusReason.trim();
        if (needsReplacementId) {
          statusBody.replacementChequeId = form.replacementChequeId.trim();
        }
        if (needsClearedDate && form.clearedDate) {
          statusBody.clearedDate = new Date(form.clearedDate).toISOString();
        }
        await axios.patch(`${Base_URL}/cheques/${id}/status`, statusBody, {
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          },
          withCredentials: true,
        });
      }

      if (!id && replacesChequeId && newId) {
        try {
          await axios.patch(
            `${Base_URL}/cheques/${replacesChequeId}/status`,
            {
              status: "Replaced",
              reason: replaceReason || "Replaced with new cheque",
              replacementChequeId: newId,
            },
            {
              headers: {
                "Content-Type": "application/json",
                authorization: `Bearer ${adminInfo.token}`,
              },
              withCredentials: true,
            },
          );
          notifySuccess(
            cq(
              "form.toasts.replacementCreated",
              "Replacement cheque created and original marked as replaced",
            ),
          );
        } catch (linkErr) {
          notifySuccess(
            cq(
              "form.toasts.createdButOriginalNotReplaced",
              "Cheque created, but original could not be marked replaced",
            ),
          );
          console.error(linkErr);
        }
      } else {
        notifySuccess(
          id
            ? cq("form.toasts.updated", "Cheque updated")
            : cq("form.toasts.created", "Cheque created"),
        );
      }
      history.push(newId ? `/Cheques/${newId}` : "/Cheques");
    } catch (err) {
      notifyError(
        err.response?.data?.error ||
          err.message ||
          cq("form.toasts.saveFailed", "Save failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const businessSelectOptions = businesses.map((b) => ({
    value: b._id,
    label: b.name,
  }));

  const selectProps = {
    appearance: "document",
    documentNeutralFocus: true,
    width: "100%",
    className: "w-full min-w-0",
  };

  /** Full list: used to resolve multi-select chips (labels) for linked + unpaid rows. */
  const invoiceOptionsFull = useMemo(() => {
    const m = new Map();
    invoiceSeedOptions.forEach((o) => m.set(String(o.value), o));
    invoiceOptions.forEach((o) => m.set(String(o.value), o));
    (form.relatedInvoices || []).forEach((rid) => {
      const sid = String(rid);
      if (!m.has(sid)) {
        m.set(sid, {
          value: sid,
          label: cq(
            "form.linkedInvoiceFallback",
            "Linked invoice ({{idPrefix}}…)",
            { idPrefix: sid.slice(0, 8) },
          ),
        });
      }
    });
    return Array.from(m.values());
  }, [invoiceSeedOptions, invoiceOptions, form.relatedInvoices, t]);

  /** Menu only: invoices already linked to this cheque are omitted so they are not pickable again. */
  const invoiceOptionsMenu = useMemo(() => {
    const selected = new Set((form.relatedInvoices || []).map(String));
    return invoiceOptionsFull.filter((o) => !selected.has(String(o.value)));
  }, [invoiceOptionsFull, form.relatedInvoices]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  return (
    <Page>
      <div className="w-full mx-auto mt-4">
        <PageHeader
          title={title}
          showBackButton
          backFallbackPath="/cheque_dashboard"
          showAddButton={false}
        />

        <div className="mt-4 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 min-w-0">
              {!isSingleAssignedBusiness() && (
              <FieldStack
                label={cq("fields.business", "Business")}
                required
                loading={businessesLoading}
              >
                <div className="rounded-xl border border-slate-200 bg-white dark:bg-gray-950 dark:border-gray-600 p-0.5">
                  <DropdownBasic
                    {...selectProps}
                    placeholder={cq(
                      "form.placeholders.selectBusiness",
                      "Select business",
                    )}
                    options={businessSelectOptions}
                    value={form.business_id}
                    onChange={(v) => setField("business_id", v)}
                    isClearable={businesses.length > 1}
                  />
                </div>
              </FieldStack>
              )}

              <FieldStack label={cq("fields.chequeNumber", "Cheque number")} required>
                <InputFieldWithLabel
                  noLabel
                  direction="column"
                  required
                  value={form.chequeNumber}
                  onChange={(e) => setField("chequeNumber", e.target.value)}
                  placeholder={cq(
                    "form.placeholders.chequeNumber",
                    "e.g. CHQ-000123",
                  )}
                />
              </FieldStack>

              {replacesChequeId && !id ? (
                <div className="md:col-span-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                  {cq(
                    "form.replacementBanner",
                    "Creating a replacement cheque. The original will be marked Replaced when you save.",
                  )}
                </div>
              ) : null}

              <FieldStack
                label={cq("fields.bankAccount", "Bank account")}
                required
                loading={!!form.business_id && loadingBanks}
              >
                <div className="rounded-xl border border-slate-200 bg-white dark:bg-gray-950 dark:border-gray-600 p-0.5">
                  <DropdownBasic
                    {...selectProps}
                    placeholder={
                      !form.business_id
                        ? cq(
                            "form.placeholders.selectBusinessFirst",
                            "Select a business first",
                          )
                        : cq(
                            "form.placeholders.selectBankAccount",
                            "Select bank account",
                          )
                    }
                    options={bankOptions}
                    value={form.bankAccountId}
                    onChange={(v) => setField("bankAccountId", v)}
                    isClearable
                    isDisabled={!form.business_id}
                  />
                </div>
              </FieldStack>

              <FieldStack
                label={cq("fields.vendorOptional", "Vendor (optional)")}
                loading={!!form.business_id && loadingVendors}
              >
                <div className="rounded-xl border border-slate-200 bg-white dark:bg-gray-950 dark:border-gray-600 p-0.5">
                  <DropdownBasic
                    {...selectProps}
                    placeholder={
                      !form.business_id
                        ? cq(
                            "form.placeholders.selectBusinessFirst",
                            "Select a business first",
                          )
                        : cq(
                            "form.placeholders.selectVendorOptional",
                            "Select vendor (optional)",
                          )
                    }
                    options={vendorOptions}
                    value={form.vendorId}
                    onChange={(v) => setField("vendorId", v)}
                    isClearable
                    isDisabled={!form.business_id}
                  />
                </div>
              </FieldStack>

              <FieldStack label={cq("fields.amount", "Amount")} required>
                <InputFieldWithLabel
                  noLabel
                  direction="column"
                  required
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  placeholder={cq("form.placeholders.amount", "0.00")}
                />
              </FieldStack>

              <FieldStack label={cq("fields.currency", "Currency")}>
                <InputFieldWithLabel
                  noLabel
                  direction="column"
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  placeholder={cq("form.placeholders.currency", "MYR")}
                />
              </FieldStack>

              <FieldStack label={cq("fields.issueDate", "Issue date")} required>
                <CustomDatePicker
                  value={form.issueDate || null}
                  onChange={(date) =>
                    setField("issueDate", date ? formatDateToYMD(date) : "")
                  }
                />
              </FieldStack>

              <FieldStack label={cq("fields.dueDate", "Due date")} required>
                <CustomDatePicker
                  value={form.dueDate || null}
                  onChange={(date) =>
                    setField("dueDate", date ? formatDateToYMD(date) : "")
                  }
                />
              </FieldStack>

              {!replacesChequeId || id ? (
                <>
                  <FieldStack
                    label={cq("fields.status", "Status")}
                    hint={
                      id
                        ? cq(
                            "form.hints.statusEdit",
                            "Select a new status to change it when you save. Due Soon is usually set automatically.",
                          )
                        : cq(
                            "form.hints.statusCreate",
                            "Initial status when the cheque is created.",
                          )
                    }
                  >
                    <div className="rounded-xl border border-slate-200 bg-white dark:bg-gray-950 dark:border-gray-600 p-0.5">
                      <DropdownBasic
                        {...selectProps}
                        placeholder={cq(
                          "form.placeholders.selectStatus",
                          "Select status",
                        )}
                        options={id ? editStatusOptions : createStatusOptions}
                        value={form.status}
                        onChange={(v) => setField("status", v)}
                        sortOptions={false}
                      />
                    </div>
                    {statusMeta?.description ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {CHEQUE_STATUS_KEY[form.status]
                          ? cq(
                              `statuses.descriptions.${CHEQUE_STATUS_KEY[form.status]}`,
                              statusMeta.description,
                            )
                          : statusMeta.description}
                      </p>
                    ) : null}
                  </FieldStack>

                  {bankOutcomeBlocked ? (
                    <div className="md:col-span-2 text-sm text-red-600">
                      {cq(
                        "form.bankOutcomeBlocked",
                        "Issue date must be today or earlier before marking as Cleared or Bounced.",
                      )}
                    </div>
                  ) : null}

                  {needsStatusReason ? (
                    <div className="md:col-span-2 min-w-0">
                      <FieldStack
                        label={
                          form.status === "Bounced"
                            ? cq("fields.bounceReason", "Bounce reason")
                            : form.status === "Replaced"
                              ? cq(
                                  "fields.replacementReason",
                                  "Replacement reason",
                                )
                              : cq(
                                  "fields.cancellationReason",
                                  "Cancellation reason",
                                )
                        }
                        required
                      >
                        <TextArea
                          value={form.statusReason}
                          onChange={(e) =>
                            setField("statusReason", e.target.value)
                          }
                          placeholder={
                            form.status === "Bounced"
                              ? cq(
                                  "form.placeholders.bounceReason",
                                  "Why was this cheque bounced?",
                                )
                              : form.status === "Replaced"
                                ? cq(
                                    "form.placeholders.replacementReason",
                                    "Why is this cheque being replaced?",
                                  )
                                : cq(
                                    "form.placeholders.cancellationReason",
                                    "Why was this cheque cancelled?",
                                  )
                          }
                          rows={3}
                        />
                      </FieldStack>
                    </div>
                  ) : null}

                  {needsReplacementId ? (
                    <div className="md:col-span-2 min-w-0">
                      <FieldStack
                        label={cq(
                          "fields.replacementChequeId",
                          "Replacement cheque ID",
                        )}
                        required
                      >
                        <InputFieldWithLabel
                          noLabel
                          direction="column"
                          required
                          value={form.replacementChequeId}
                          onChange={(e) =>
                            setField("replacementChequeId", e.target.value)
                          }
                          placeholder={cq(
                            "form.placeholders.replacementChequeId",
                            "ID of the new replacement cheque",
                          )}
                        />
                      </FieldStack>
                    </div>
                  ) : null}

                  {needsClearedDate && !bankOutcomeBlocked ? (
                    <FieldStack
                      label={cq("fields.clearedDateTime", "Cleared date & time")}
                    >
                      <CustomDatePicker
                        value={form.clearedDate}
                        onChange={(date) => setField("clearedDate", date)}
                        showTimeSelect
                        clearable={false}
                      />
                    </FieldStack>
                  ) : null}
                </>
              ) : null}

              <div className="md:col-span-2 min-w-0">
                <FieldStack
                  label={cq(
                    "fields.relatedVendorInvoicesOptional",
                    "Related vendor invoices (optional)",
                  )}
                  loading={
                    !!form.business_id && !!form.vendorId && loadingInvoices
                  }
                  hint={cq(
                    "form.hints.relatedInvoices",
                    "Unpaid vendor bills for this vendor. Invoices already tied to any cheque (same business & vendor) are omitted from the list. On this screen, invoices linked to this cheque only appear as tags — remove a tag if you need to change the link.",
                  )}
                >
                  <div className="rounded-xl border border-slate-200 bg-white dark:bg-gray-950 dark:border-gray-600 p-0.5">
                    <DropdownBasic
                      {...selectProps}
                      isMulti
                      placeholder={
                        !form.business_id
                          ? cq(
                              "form.placeholders.selectBusinessFirst",
                              "Select a business first",
                            )
                          : !form.vendorId
                            ? cq(
                                "form.placeholders.selectVendorFirst",
                                "Select a vendor first",
                              )
                            : cq(
                                "form.placeholders.searchVendorInvoices",
                                "Search or select vendor invoices…",
                              )
                      }
                      options={invoiceOptionsMenu}
                      multiValueSourceOptions={invoiceOptionsFull}
                      value={form.relatedInvoices}
                      onChange={(v) => setField("relatedInvoices", v)}
                      isClearable
                      isDisabled={!form.business_id || !form.vendorId}
                    />
                  </div>
                </FieldStack>
              </div>

              <div className="md:col-span-2 min-w-0">
                <FieldStack label={cq("fields.paymentPurpose", "Payment purpose")}>
                  <textarea
                    rows={4}
                    value={form.paymentPurpose}
                    onChange={(e) => setField("paymentPurpose", e.target.value)}
                    placeholder={cq(
                      "form.placeholders.paymentPurpose",
                      "What this cheque pays for…",
                    )}
                    className="w-full min-w-0 border border-slate-300 rounded-xl shadow-sm px-4 py-3 text-sm bg-white dark:bg-gray-950 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  />
                </FieldStack>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 dark:bg-gray-800/50 dark:border-gray-700 p-5 md:p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {cq("form.attachmentsTitle", "Attachments (optional)")}
                </h3>
                <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">
                  {cq(
                    "form.attachmentsHint",
                    "Upload one or more supporting files (images, PDFs, etc.).",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 min-w-0">
                <label className="inline-flex shrink-0">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={uploadBusy || !adminInfo?.token}
                    onChange={onFilesChosen}
                  />
                  <span className="cursor-pointer inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[var(--p-blue)] text-white text-sm font-medium shadow-sm hover:opacity-95 disabled:opacity-50 min-h-[42px]">
                    {uploadBusy
                      ? cq("form.uploading", "Uploading…")
                      : cq("form.chooseFiles", "Choose files")}
                  </span>
                </label>
              </div>
              {form.attachments.length > 0 && (
                <ul className="space-y-3 text-sm">
                  {form.attachments.map((a, idx) => {
                    const sk = a.storageKey;
                    const displayName =
                      a.fileName || cq("form.documentFallback", "Document");
                    const busyOpen = attachmentBusy === `open:${sk}`;
                    const busyDl = attachmentBusy === `dl:${sk}`;
                    return (
                      <li
                        key={`${sk}-${idx}`}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800 dark:text-gray-100">
                            {displayName}
                          </p>
                          {a.mimeType || a.size ? (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-500">
                              {[
                                a.mimeType,
                                a.size
                                  ? cq("form.fileSizeKb", "{{size}} KB", {
                                      size: Math.round(a.size / 1024),
                                    })
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!sk || busyOpen || busyDl}
                            onClick={() => handleOpenAttachment(a)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                          >
                            {busyOpen ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {cq("form.view", "View")}
                          </button>
                          <button
                            type="button"
                            disabled={!sk || busyOpen || busyDl}
                            onClick={() => handleDownloadAttachment(a)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--p-blue)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                          >
                            {busyDl ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Download className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {cq("form.download", "Download")}
                          </button>
                          <Button
                            type="button"
                            secondary
                            className="h-9"
                            onClick={() => removeAttachment(idx)}
                          >
                            {cq("form.remove", "Remove")}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-gray-800">
              <FooterButtons
                onCancel={exitList}
                loading={saving}
                disableSubmission={saving}
                saveButtonText={cq("form.save", "Save")}
              />
            </div>
          </form>
        </div>
      </div>
    </Page>
  );
};

export default ChequeForm;
