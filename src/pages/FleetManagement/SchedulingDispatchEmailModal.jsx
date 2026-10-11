import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  X,
  Send,
  Eye,
  Paperclip,
  FileText,
  Info,
  Loader2,
} from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import SalesOrderServices from "@/services/SalesOrderServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { getWorkOrderPdfFile, getWorkOrderNumberLabel } from "@/utils/workOrderPdf";
import {
  jobBillingDocumentTitle,
  jobBillingDocumentTitleLower,
} from "@/utils/fleetJobBillingLabels";
import { useEmailDefaults } from "@/hooks/useEmailDefaults";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ script: "sub" }, { script: "super" }],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["blockquote", "code-block"],
    ["link", "image"],
    ["clean"],
  ],
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "script",
  "color",
  "background",
  "list",
  "bullet",
  "indent",
  "align",
  "blockquote",
  "code-block",
  "link",
  "image",
];

function splitEmails(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,\s;]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function pickCustomerEmail(job) {
  const c = job?.customerId;
  if (typeof c !== "object" || !c) return "";
  return (
    c?.basicInformation?.customerEmail?.trim() ||
    c?.basicInformation?.email?.trim() ||
    ""
  );
}

/**
 * In-scheduling “Email” modal: rich body + work order PDF attached by default, sends via sales order email API.
 */
export default function SchedulingDispatchEmailModal({
  open,
  onClose,
  job,
  assignment = null,
  dayYmd = null,
  scheduleCurrency = "USD",
  businessId = "",
  /** Full business doc (e.g. from assigned list) so PDF can embed `image` logo. */
  businessRecord = null,
  customerDisplayName = "Customer",
  adminInfo = null,
}) {
  const emailDefaults = useEmailDefaults({ adminEmail: adminInfo?.email });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p>Hello,</p><p>Please see the attached document for your reference.</p><p>Thank you.</p>");

  const [defaultAttachment, setDefaultAttachment] = useState(null);
  /** @type {[{ fileId: string, name: string, s3Key: string, size: number, type: string }]} */
  const [extraAttachments, setExtraAttachments] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const [uploadingDefault, setUploadingDefault] = useState(false);
  const [sending, setSending] = useState(false);

  const soId = job?.createdFrom?._id || job?.createdFrom;
  const salesOrderNumber = job?.createdFrom?.salesOrderNumber;
  const docLabel = jobBillingDocumentTitleLower(job);
  const docLabelTitle = jobBillingDocumentTitle(job);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: adminInfo?.token ? `Bearer ${adminInfo.token}` : undefined,
    }),
    [adminInfo?.token],
  );

  const resetWhenOpened = useCallback(() => {
    const wo = getWorkOrderNumberLabel(job);
    const safeCustomer = (customerDisplayName && String(customerDisplayName).trim()) || "Customer";
    const woPart = wo === "—" ? docLabelTitle : `${docLabelTitle} ${wo}`;
    setFrom(emailDefaults.from);
    setTo(pickCustomerEmail(job));
    setCc("");
    setBcc("");
    setSubject(`${safeCustomer} - ${woPart}`.replace(/\s+/g, " ").trim());
    setBodyHtml(`<p>Hello,</p><p>Please see the attached ${docLabel} for your reference.</p><p>Thank you.</p>`);
    setDefaultAttachment(null);
    setExtraAttachments([]);
    setShowPreview(false);
  }, [emailDefaults.from, customerDisplayName, job, docLabel, docLabelTitle]);

  useEffect(() => {
    if (!open || !job || emailDefaults.loading) return;
    resetWhenOpened();
  }, [open, job, emailDefaults.loading, resetWhenOpened]);

  useEffect(() => {
    if (!open || !job) return;
    if (!soId) return;
    if (!businessId) {
      setDefaultAttachment({ error: "Select a business before sending email." });
      return;
    }

    let cancelled = false;
    (async () => {
      setUploadingDefault(true);
      setDefaultAttachment({ loading: true });
      try {
        const file = await getWorkOrderPdfFile({
          job,
          assignment: assignment || undefined,
          dayYmd: dayYmd || undefined,
          scheduleCurrency,
          business: businessRecord || undefined,
        });
        if (!file) {
          if (!cancelled) setDefaultAttachment({ error: `Could not build ${docLabel} PDF.` });
          return;
        }
        const formData = new FormData();
        formData.append("file_path", `EmailAttachments/WorkOrder/${getWorkOrderNumberLabel(job) || "order"}`);
        formData.append("business_id", String(businessId));
        const customerId = job.customerId?._id || job.customerId;
        if (customerId) formData.append("customer_id", String(customerId));
        formData.append("file_type", file.type);
        formData.append("file_size", String(file.size));
        formData.append("file", file);

        const res = await axios.post(`${Base_URL}/documents/uploadDocument`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (cancelled) return;
        if (res.data?.message === "File uploaded successfully" && res.data?.file) {
          const f = res.data.file;
          setDefaultAttachment({
            fileId: f._id,
            name: f.name || file.name,
            s3Key: f.s3Key,
            size: file.size,
            type: "application/pdf",
          });
        } else {
          setDefaultAttachment({ error: res.data?.message || "Upload failed" });
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setDefaultAttachment({ error: e.response?.data?.message || e.message || "Upload failed" });
        }
      } finally {
        if (!cancelled) setUploadingDefault(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, job, soId, businessId, assignment, dayYmd, scheduleCurrency, businessRecord, docLabel]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onAttachMore = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!e.target) return;
      e.target.value = "";
      if (!file) return;
      if (!businessId) {
        notifyError("Select a business first.");
        return;
      }
      if (!soId) {
        notifyError("This schedule item is not linked to an order yet.");
        return;
      }
      const allowed = [
        "image/jpeg",
        "image/png",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!allowed.includes(file.type)) {
        notifyError("Use JPEG, PNG, PDF, DOC, DOCX, XLS, or XLSX.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        notifyError("File must be under 10MB.");
        return;
      }
      try {
        const formData = new FormData();
        formData.append("file_path", `EmailAttachments/${salesOrderNumber || "dispatch"}`);
        formData.append("business_id", String(businessId));
        const customerId = job.customerId?._id || job.customerId;
        if (customerId) formData.append("customer_id", String(customerId));
        formData.append("file_type", file.type);
        formData.append("file_size", String(file.size));
        formData.append("file", file);
        const res = await axios.post(`${Base_URL}/documents/uploadDocument`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.data?.message === "File uploaded successfully" && res.data?.file) {
          const f = res.data.file;
          setExtraAttachments((prev) => [
            ...prev,
            {
              fileId: f._id,
              name: f.name || file.name,
              s3Key: f.s3Key,
              size: file.size,
              type: file.type,
            },
          ]);
          notifySuccess("File attached.");
        } else {
          notifyError(res.data?.message || "Upload failed");
        }
      } catch (err) {
        console.error(err);
        notifyError(err.response?.data?.message || err.message || "Upload failed");
      }
    },
    [businessId, soId, job, salesOrderNumber],
  );

  const removeDefaultAttachment = useCallback(() => {
    setDefaultAttachment({ removed: true });
  }, []);

  const removeExtra = useCallback((id) => {
    setExtraAttachments((prev) => prev.filter((d) => d.fileId !== id));
  }, []);

  const onSend = useCallback(async () => {
    if (!soId) {
      notifyError("This schedule item is not linked to an order yet.");
      return;
    }
    const toList = splitEmails(to);
    if (!toList.length) {
      notifyError("Add at least one recipient in To.");
      return;
    }
    for (const em of toList) {
      if (!EMAIL_REGEX.test(em)) {
        notifyError(`Invalid email: ${em}`);
        return;
      }
    }
    if (uploadingDefault) {
      notifyError(`Still preparing the ${docLabel} PDF…`);
      return;
    }

    const defaultForSend =
      !defaultAttachment?.removed && !defaultAttachment?.error && !defaultAttachment?.loading && defaultAttachment?.s3Key
        ? [
            {
              s3Key: defaultAttachment.s3Key,
              name: defaultAttachment.name,
            },
          ]
        : [];

    const additionalDocuments = [
      ...defaultForSend,
      ...extraAttachments.map((d) => ({ s3Key: d.s3Key, name: d.name })),
    ];

    if (!additionalDocuments.length) {
      notifyError(`Add at least one attachment (${docLabel} PDF or a file) before sending.`);
      return;
    }

    setSending(true);
    try {
      const payload = {
        from: from.trim(),
        to: toList.join(","),
        cc: splitEmails(cc).length ? splitEmails(cc).join(",") : undefined,
        bcc: splitEmails(bcc).length ? splitEmails(bcc).join(",") : undefined,
        subject: subject.trim() || `${docLabelTitle} ${getWorkOrderNumberLabel(job)}`,
        email_html: bodyHtml || "<p></p>",
        AttachInvoice: false,
        additionalDocuments,
      };
      const res = await SalesOrderServices.sendSalesOrderEmail(soId, payload, headers);
      if (res.data?.success) {
        const apiMsg = String(res.data?.message || "").trim();
        const normalizedMsg = apiMsg
          ? apiMsg.replace(/sales\s*order/gi, "schedule dispatch")
          : "Schedule dispatch email sent.";
        notifySuccess(normalizedMsg);
        onClose?.();
      } else {
        const apiErr = String(res.data?.message || "").trim();
        const normalizedErr = apiErr
          ? apiErr.replace(/sales\s*order/gi, "schedule dispatch")
          : "Failed to send schedule dispatch email.";
        notifyError(normalizedErr);
      }
    } catch (err) {
      console.error(err);
      notifyError(err.response?.data?.message || err.message || "Failed to send email.");
    } finally {
      setSending(false);
    }
  }, [
    soId,
    to,
    cc,
    bcc,
    from,
    subject,
    bodyHtml,
    defaultAttachment,
    uploadingDefault,
    extraAttachments,
    headers,
    job,
    onClose,
  ]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scheduling-dispatch-email-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[min(96vh,900px)] flex flex-col rounded-lg bg-white shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 bg-slate-100 shrink-0">
          <h2 id="scheduling-dispatch-email-title" className="text-sm font-bold text-slate-900">
            Email Editor
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-slate-200 flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            disabled={sending || !soId}
            onClick={onSend}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#3b6fb8] text-white text-xs font-semibold px-3 py-1.5 shadow-sm hover:bg-[#335f9c] disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-1.5 hover:bg-slate-300"
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? "Edit" : "Preview"}
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-1.5 hover:bg-slate-300 cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            Attach
            <input type="file" className="hidden" onChange={onAttachMore} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
          </label>
        </div>

        <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
          {!soId && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              This schedule item is not linked to an order yet, so dispatch email cannot be sent from here.
            </p>
          )}

          <div className="grid grid-cols-[72px_1fr] items-center gap-y-1.5 text-xs">
            <span className="text-slate-600">From</span>
            <input
              type="email"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 w-full text-slate-900"
            />
            <span className="text-slate-600">To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com (comma separated)"
              className="border border-slate-300 rounded px-2 py-1.5 w-full text-slate-900"
            />
            <span className="text-slate-600">Cc</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 w-full text-slate-900"
            />
            <span className="text-slate-600">Bcc</span>
            <input
              type="text"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 w-full text-slate-900"
            />
            <span className="text-slate-600">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 w-full text-slate-900"
            />
          </div>

          <div>
            <div className="text-xs text-slate-600 mb-1">Attachments</div>
            <div className="space-y-1.5 min-h-[2rem]">
              {defaultAttachment?.loading || uploadingDefault ? (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {`Preparing ${docLabel} PDF…`}
                </div>
              ) : defaultAttachment?.error ? (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{defaultAttachment.error}</div>
              ) : defaultAttachment?.removed ? (
                <p className="text-xs text-slate-500">{docLabelTitle} PDF removed.</p>
              ) : defaultAttachment?.s3Key ? (
                <div className="inline-flex items-center gap-1.5 max-w-full rounded border border-sky-200 bg-sky-50 pl-1.5 pr-1 py-0.5 text-xs text-sky-900">
                  <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{defaultAttachment.name}</span>
                  <button
                    type="button"
                    onClick={removeDefaultAttachment}
                    className="p-0.5 rounded hover:bg-sky-200 text-slate-700"
                    title="Remove"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}

              {extraAttachments.map((d) => (
                <div
                  key={d.fileId}
                  className="inline-flex items-center gap-1.5 max-w-full rounded border border-slate-200 bg-slate-50 pl-1.5 pr-1 py-0.5 text-xs"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => removeExtra(d.fileId)}
                    className="p-0.5 rounded hover:bg-slate-200"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-1 border-t border-slate-100 min-h-[200px] max-h-[45vh]">
            {showPreview ? (
              <div className="h-full overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
                <div className="rounded border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1">
                    <div><span className="font-semibold">From:</span> {(from || "").trim() || "—"}</div>
                    <div><span className="font-semibold">To:</span> {splitEmails(to).join(", ") || "—"}</div>
                    {splitEmails(cc).length > 0 && <div><span className="font-semibold">Cc:</span> {splitEmails(cc).join(", ")}</div>}
                    {splitEmails(bcc).length > 0 && <div><span className="font-semibold">Bcc:</span> {splitEmails(bcc).join(", ")}</div>}
                    <div><span className="font-semibold">Subject:</span> {(subject || "").trim() || "—"}</div>
                  </div>
                  <div className="p-3 text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: bodyHtml || "<p></p>" }} />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col scheduling-dispatch-quill [&_.quill]:flex [&_.quill]:flex-col [&_.quill]:min-h-0 [&_.quill]:flex-1 [&_.ql-container]:!min-h-[200px] [&_.ql-container]:!max-h-[40vh] [&_.ql-container]:overflow-y-auto">
                <ReactQuill
                  theme="snow"
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  modules={quillModules}
                  formats={quillFormats}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
