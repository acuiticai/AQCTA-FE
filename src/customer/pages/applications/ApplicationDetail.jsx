import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import PortalLayout from "../../layouts/PortalLayout";
import { Card, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import AcknowledgeNoticeDialog from "../../components/ui/AcknowledgeNoticeDialog";
import AcceptQuotationDialog from "../../components/ui/AcceptQuotationDialog";
import DocumentViewerModal from "../../components/ui/DocumentViewerModal";
import CustomerQuotationPreviewModal from "../../components/ui/CustomerQuotationPreviewModal";
import StatusPill from "../../components/ui/StatusPill";
import DataTable from "../../components/ui/DataTable";
import { TextareaField } from "../../components/ui/Field";
import {
  DefinitionList,
  DetailHeader,
  NotePanel,
  RowActions,
  SummaryTiles,
  Timeline,
} from "../../components/ui/DetailBlocks";
import {
  DownloadIcon,
  EyeIcon,
  UploadArrowIcon,
} from "../../components/ui/icons";
import { customerPath } from "../../routes/paths";
import { useAccount } from "../../context/AccountContext";
import CustomerApplicationServices from "../../services/applicationService";
import CustomerAuthServices from "../../services/authService";
import {
  downloadAxiosBlob,
  buildApplicationFormData,
  resolveDocumentDownloadTemplateKey,
} from "@/utils/certificationFormData";
import {
  APPLICATION_DOCUMENT_ACCEPT,
  getApplicationDocumentValidationError,
} from "@/utils/applicationDocumentFiles";
import { formatTimelineDate } from "../../../utils/applicationTimeline";
import { notifyError } from "@/utils/toast";
import { formatMultiValue } from "../../utils/productMultiFields";
import CustomerDocumentTypeServices from "../../services/documentTypeService";

const blobFromResponse = (res) =>
  new Blob([res.data], { type: "application/pdf" });

const outcomeLabel = (outcome) => {
  if (outcome === "accept") return "Accepted";
  if (outcome === "decline") return "Declined";
  return outcome || "";
};

const issuedDocStatus = (row) => {
  if (row?.needsAcknowledgement) return "Action Required";
  if (row?.acknowledgement) return "Confirmed";
  if (row?.needsDecision) return "Awaiting your decision";
  return row?.decision || outcomeLabel(row?.outcome) || "";
};

/** Flexa quotations are previewed in their own modal; everything else is a PDF. */
const isPdfIssuedDoc = (row) =>
  Boolean(row?.formKey) && row.formKey !== "FOR-01-07";

const issuedDocFileName = (row) => {
  if (row?.formKey === "FOR-01-24") return "Contract-Review-Notification.pdf";
  return `${String(row?.title || row?.formKey || "document").replace(
    /[^\w.\-]+/g,
    "_",
  )}.pdf`;
};

/** Supporting docs for the detail list — type label + editable name/description. */
const mapSupportingDocuments = (application, typeMetaById = new Map()) =>
  (application.documents || [])
    .filter((d) => d && !Array.isArray(d))
    .map((d, index) => {
      const attached = Boolean(d.attached || d.url || d.s3Key);
      const typeMeta =
        typeMetaById.get(String(d.documentTypeId || "")) || {};
      const templateKey = d.templateKey || typeMeta.templateKey || "";
      const templateFile = d.templateFile || typeMeta.templateFile || null;
      const hasTemplate = Boolean(
        d.hasTemplate ||
          typeMeta.hasTemplate ||
          templateKey ||
          templateFile?.url ||
          templateFile?.s3Key,
      );
      return {
        id: String(d.documentTypeId || d._id || `doc-${index}`),
        typeName: d.typeName || d.requirement || d.name || "Document",
        /** Admin-configured hint for this document type (not the user description). */
        typeHint: d.description || typeMeta.description || "",
        requirement: d.requirement || typeMeta.requirement || "",
        fileName: d.fileName || "",
        documentName: d.documentName || "",
        documentDescription: d.documentDescription || "",
        attached,
        url: d.url || "",
        documentTypeId: d.documentTypeId || "",
        templateKey,
        templateFile,
        hasTemplate,
        index,
      };
    });

async function uploadSupportingFile(file) {
  const res = await CustomerAuthServices.uploadFile(file);
  const url =
    res?.data?.url ||
    res?.data?.Location ||
    res?.data?.fileUrl ||
    res?.data?.data?.url ||
    "";
  const s3Key = res?.data?.s3Key || res?.data?.data?.s3Key || "";
  if (!url && !s3Key) {
    throw new Error("Upload did not return a file URL");
  }
  return {
    url,
    s3Key,
    fileName: file.name || "document",
    file_type: file.type || "",
    file_size: file.size || 0,
  };
}

const pick = (obj, ...keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "—";
};

const isPresentCommercial = (value) => {
  const s = value == null ? "" : String(value).trim();
  return s !== "" && s !== "—";
};

const REVIEW_ACTION_TITLES = {
  submitted: "Application submitted",
  resubmitted: "Application resubmitted",
  approved: "Approved",
  request_info: "Additional information requested",
  rejected: "Rejected",
  assigned: "Assigned for review",
  status_change: "Status updated",
};

const buildTimeline = (application) => {
  const history = Array.isArray(application.reviewHistory)
    ? application.reviewHistory
    : [];
  if (history.length) {
    const filtered = history
      .filter((entry) => entry && entry.action !== "assigned")
      .sort(
        (a, b) =>
          new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
      );
    return filtered.map((entry, index) => {
        const title =
          REVIEW_ACTION_TITLES[entry.action] ||
          entry.action ||
          "Update";
        return {
          date: formatTimelineDate(entry.at),
          title,
          note: entry.remarks || entry.toStatus || "",
          tone: index === 0 ? "current" : "done",
        };
      });
  }

  return [
    {
      date: application.submitted || application.updated || "—",
      title:
        application.status === "Draft"
          ? "Draft saved"
          : "Application submitted",
      note:
        application.status === "Draft"
          ? "You can continue editing this draft"
          : "Submission locked for review",
      tone: "done",
    },
    {
      date: application.updated || "—",
      title: application.commercialStage || application.stage || "In progress",
      note: `Current status: ${application.status}`,
      tone: "current",
    },
  ];
};

const buildResponseNote = (application, isInspection) => {
  const info = application.additionalInfoRequest;
  if (application.status === "Rejected") {
    return (
      application.rejectionReason ||
      [...(application.reviewHistory || [])]
        .reverse()
        .find((entry) => entry?.action === "rejected")?.remarks ||
      "Your application was rejected. Please review the reason, update your application, and resubmit."
    );
  }
  if (info && (info.remarks || info.requiredInfo)) {
    const parts = [];
    if (info.remarks) parts.push(info.remarks);
    if (info.requiredInfo) parts.push(`Required information: ${info.requiredInfo}`);
    return parts.join("\n\n");
  }
  if (application.status === "Approved") {
    return "Approved — commercial processing will follow";
  }
  if (application.status === "Draft") {
    return "This draft has not been submitted yet.";
  }
  if (application.status === "Action Required") {
    return "AQCTA has asked you to modify this application. Update the details and resubmit — this is not a rejection.";
  }
  return isInspection
    ? "Your application has been received. AQCTA will update progress here."
    : "Your application is under review.";
};

const buildDetailFromApplication = (application, typeMetaById = new Map()) => {
  const form = application.formData || {};
  const isInspection = application.type === "inspection";
  const reference = application.applicationNumber || application.id;
  const enquiry =
    application.enquiryNumber ||
    (application.enquiryId ? "Linked" : "None");
  const stage =
    application.commercialStage || application.stage || "—";
  const timeline = buildTimeline(application);
  const declaration = application.declarationAgreed
    ? "Agreed"
    : "Not agreed";
  const commercial = [
    isPresentCommercial(application.projectNumber)
      ? { label: "Project", value: application.projectNumber }
      : null,
    isPresentCommercial(application.jobNo)
      ? { label: "Job no.", value: application.jobNo }
      : null,
    isInspection && isPresentCommercial(application.reportNo)
      ? { label: "Report no.", value: application.reportNo }
      : !isInspection && isPresentCommercial(application.certificateNumber)
        ? { label: "Certificate no.", value: application.certificateNumber }
        : null,
    isPresentCommercial(application.quotationStatus)
      ? { label: "Quotation", value: application.quotationStatus }
      : null,
    isPresentCommercial(application.invoiceStatus)
      ? { label: "Invoice", value: application.invoiceStatus }
      : null,
  ].filter(Boolean);

  if (isInspection) {
    return {
      applicationType: application.service || "Engineering Inspection",
      reference,
      enquiry,
      enquiryQualified: application.enquiryId
        ? application.enquiryNumber
          ? `Enquiry ${application.enquiryNumber}`
          : "Linked enquiry"
        : "Direct application",
      submitted:
        application.status === "Draft"
          ? "Draft — not submitted"
          : `Submitted ${application.submitted}`,
      stage,
      stageNote: application.status,
      applicant: [
        { label: "Applicant Company", value: pick(form, "companyName") },
        {
          label: "Contact Person",
          value: [pick(form, "contactPerson"), pick(form, "telephone")]
            .filter((v) => v !== "—")
            .join(" · ") || "—",
        },
        { label: "Inspection Site", value: pick(form, "siteName", "siteAddress") },
        { label: "Street", value: pick(form, "siteStreet") },
        { label: "Block / Unit", value: pick(form, "siteBlock") },
        { label: "Site Telephone", value: pick(form, "siteTelephone") },
        { label: "Declaration", value: declaration },
      ],
      scope: [
        { label: "Project Name", value: pick(form, "projectName") },
        { label: "Project Description", value: pick(form, "projectDescription") },
        { label: "Inspection Category", value: pick(form, "inspectionCategory") },
        { label: "Requested Service", value: pick(form, "requestedService") },
        { label: "Standard Number", value: pick(form, "standardNumber") },
        { label: "Standard Title", value: pick(form, "standardTitle") },
        {
          label: "Additional standard(s) / notes",
          value: pick(form, "applicableStandards"),
        },
        {
          label: "Reference drawings / specs",
          value: pick(form, "referenceDrawings"),
        },
      ],
      references: [
        {
          label: "Purchase Order / Letter of Award",
          value: pick(form, "purchaseOrder"),
        },
        {
          label: "Quotation Reference",
          value: pick(form, "quotationReference"),
        },
      ],
      documents: mapSupportingDocuments(application, typeMetaById),
      commercial,
      timeline,
      response: buildResponseNote(application, true),
    };
  }

  return {
    applicationType: application.service || "Conformity Assessment",
    certificationType: pick(form, "certificationType"),
    reference,
    enquiry,
    enquiryQualified: application.enquiryId
      ? application.enquiryNumber
        ? `Enquiry ${application.enquiryNumber}`
        : "Linked enquiry"
      : "Direct application",
    submitted:
      application.status === "Draft"
        ? "Draft — not submitted"
        : `Submitted ${application.submitted}`,
    stage,
    stageNote: application.status,
    applicant: [
      { label: "Applicant Company", value: pick(form, "companyName") },
      {
        label: "Authorised Contact",
        value: pick(form, "contactPerson"),
      },
      {
        label: "Manufacturer / Factory",
        value: pick(form, "manufacturerName", "factoryAddress"),
      },
      { label: "Street", value: pick(form, "factoryStreet") },
      { label: "Block / Unit", value: pick(form, "factoryBlock") },
      { label: "Factory Contact", value: pick(form, "factoryContact") },
      { label: "Declaration", value: declaration },
    ],
    product: [
      { label: "Product", value: pick(form, "productName") },
      { label: "Standard Number", value: pick(form, "standardNumber") },
      { label: "Standard Title", value: pick(form, "standardTitle") },
      {
        label: "Type(s)",
        value: formatMultiValue(form.types) || pick(form, "type") || "—",
      },
      {
        label: "Model(s)",
        value: formatMultiValue(form.models) || pick(form, "model") || "—",
      },
      {
        label: "Rating(s)",
        value: formatMultiValue(form.ratings) || pick(form, "rating") || "—",
      },
      {
        label: "Size(s)",
        value: formatMultiValue(form.sizes) || pick(form, "size") || "—",
      },
      {
        label: "Trademark(s) / Brand name(s)",
        value: formatMultiValue(form.brands) || pick(form, "brand") || "—",
      },
      {
        label: "Class / Category",
        value: pick(form, "category", "categoryId"),
      },
      ...Object.entries(form.categoryFieldValues || {})
        .filter(([, value]) => {
          if (value === undefined || value === null) return false;
          if (Array.isArray(value)) return value.some((v) => String(v ?? "").trim());
          return String(value).trim() !== "";
        })
        .map(([key, value]) => {
          const def = (form.categoryProductFields || []).find((f) => f.key === key);
          return {
            label: def?.label || key,
            value: formatMultiValue(value) || String(value),
          };
        }),
    ],
    technical: [
      {
        label: "Components / Raw Materials",
        value: `${(application.technical?.components || []).length} listed`,
      },
      {
        label: "Test Equipment",
        value: `${(application.technical?.equipment || []).length} records`,
      },
      {
        label: "Process flows",
        value:
          (application.technical?.qcCheckpoints || []).length > 0
            ? (application.technical.qcCheckpoints || [])
                .map((cp) => cp.title)
                .filter(Boolean)
                .join(", ") ||
              `${(application.technical.qcCheckpoints || []).length} added`
            : "None added",
      },
    ],
    documents: mapSupportingDocuments(application, typeMetaById),
    commercial,
    timeline,
    response: buildResponseNote(application, false),
  };
};

/**
 * One detail screen for both services.
 *
 * The layout is identical — tiles, two content columns, a progress rail — so
 * the type only decides which cards fill the left column.
 */
export default function ApplicationDetail() {
  const history = useHistory();
  const { id } = useParams();
  const account = useAccount();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [responseRemark, setResponseRemark] = useState("");
  const [issuedDocs, setIssuedDocs] = useState([]);
  const [documentTypeMetaById, setDocumentTypeMetaById] = useState(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await CustomerApplicationServices.getMyApplicationById(id);
        const row = res?.data?.data;
        if (!cancelled) {
          if (!row) setLoadError("Application not found.");
          else {
            setApplication(row);
            setResponseRemark(row.customerResponseRemark || "");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err?.response?.data?.message || "Failed to load application.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Enrich supporting docs with template flags so Download Form can show
     even when older submissions omitted hasTemplate on the saved row. */
  useEffect(() => {
    let cancelled = false;
    const serviceType =
      application?.type === "inspection" ? "inspection" : "certification";
    if (!application?.type) return undefined;
    (async () => {
      try {
        const res = await CustomerDocumentTypeServices.getActiveTypes({
          serviceType,
        });
        const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (cancelled) return;
        const next = new Map();
        rows.forEach((type) => {
          if (!type?._id) return;
          next.set(String(type._id), {
            description: type.description || "",
            requirement: type.requirement || "",
            templateKey: type.templateKey || "",
            templateFile: type.templateFile || null,
            hasTemplate: Boolean(type.hasTemplate),
          });
        });
        setDocumentTypeMetaById(next);
      } catch {
        if (!cancelled) setDocumentTypeMetaById(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application?.type]);

  /* Issued documents are a separate, non-blocking call — the page still
     renders if AQCTA has not released anything yet. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res =
          await CustomerApplicationServices.getMyApplicationDocuments(id);
        if (!cancelled) {
          setIssuedDocs(Array.isArray(res?.data?.data) ? res.data.data : []);
        }
      } catch {
        if (!cancelled) setIssuedDocs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const [decidingQuote, setDecidingQuote] = useState("");
  /* Both accept and reject are confirmed — accepting cannot be undone, and a
     reject is final too, so neither should go through on a stray click. */
  const [pendingQuoteDecision, setPendingQuoteDecision] = useState(null);
  /* The factory audit notice asks the customer to confirm the visit. */
  const [ackRow, setAckRow] = useState(null);
  const [ackBusy, setAckBusy] = useState(false);
  /* Inline preview of an issued letter / quotation / notice. */
  const [viewingDoc, setViewingDoc] = useState(null);
  const [uploadingDocId, setUploadingDocId] = useState("");
  const [savingDocFieldsId, setSavingDocFieldsId] = useState("");
  const [downloadingDocId, setDownloadingDocId] = useState("");
  const fileInputRefs = useRef({});
  const nameDraftRefs = useRef({});
  const descDraftRefs = useRef({});
  const [downloadingKey, setDownloadingKey] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const downloadIssuedDoc = async (doc) => {
    if (!id || !isPdfIssuedDoc(doc) || downloadingKey) return;
    setDownloadingKey(doc.formKey);
    setDownloadError("");
    try {
      const res = await CustomerApplicationServices.getMyApplicationDocumentPdf(
        id,
        doc.formKey,
      );
      downloadAxiosBlob(res, issuedDocFileName(doc));
    } catch (err) {
      setDownloadError(
        err?.response?.data?.message ||
          "Could not download this document. Try previewing it instead.",
      );
    } finally {
      setDownloadingKey("");
    }
  };

  const openSupportingUpload = (docId) => {
    fileInputRefs.current[docId]?.click();
  };

  const findSupportingDocIndex = (docRow, docs) =>
    docs.findIndex(
      (d, i) =>
        (docRow.documentTypeId &&
          String(d?.documentTypeId) === String(docRow.documentTypeId)) ||
        i === docRow.index,
    );

  const persistSupportingDocuments = async (currentDocs) => {
    const res = await CustomerApplicationServices.updateMyApplication(id, {
      documents: currentDocs,
    });
    const updated = res?.data?.data;
    if (updated) setApplication(updated);
    else setApplication((prev) => ({ ...prev, documents: currentDocs }));
  };

  const handleSupportingFieldSave = async (docRow, patch) => {
    if (!application || !patch || typeof patch !== "object") return;

    const nextName =
      patch.documentName !== undefined
        ? String(patch.documentName || "").trim()
        : undefined;
    const nextDesc =
      patch.documentDescription !== undefined
        ? String(patch.documentDescription || "").trim()
        : undefined;

    const prevName = String(docRow.documentName || "").trim();
    const prevDesc = String(docRow.documentDescription || "").trim();
    const nameChanged = nextName !== undefined && nextName !== prevName;
    const descChanged = nextDesc !== undefined && nextDesc !== prevDesc;
    if (!nameChanged && !descChanged) return;

    const currentDocs = Array.isArray(application.documents)
      ? application.documents.map((d) => ({ ...d }))
      : [];
    const matchIndex = findSupportingDocIndex(docRow, currentDocs);
    if (matchIndex < 0) return;

    currentDocs[matchIndex] = {
      ...currentDocs[matchIndex],
      ...(nameChanged ? { documentName: nextName } : {}),
      ...(descChanged ? { documentDescription: nextDesc } : {}),
    };
    setSavingDocFieldsId(docRow.id);
    try {
      await persistSupportingDocuments(currentDocs);
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save document details.",
      );
      if (nameChanged && nameDraftRefs.current[docRow.id]) {
        nameDraftRefs.current[docRow.id].value = docRow.documentName || "";
      }
      if (descChanged && descDraftRefs.current[docRow.id]) {
        descDraftRefs.current[docRow.id].value =
          docRow.documentDescription || "";
      }
    } finally {
      setSavingDocFieldsId("");
    }
  };

  const handleSupportingDownloadForm = async (docRow) => {
    if (!application || !docRow?.documentTypeId || downloadingDocId) return;
    setDownloadingDocId(docRow.id);
    try {
      const templateKey = resolveDocumentDownloadTemplateKey(docRow);
      const res = await CustomerDocumentTypeServices.downloadForm({
        documentTypeId: docRow.documentTypeId,
        templateKey,
        applicationData: buildApplicationFormData(
          application.type || "certification",
          application.formData || {},
          application.documents || [],
        ),
      });
      downloadAxiosBlob(
        res,
        templateKey === "FOR-06-04"
          ? "Application-for-Engineering-Inspection.pdf"
          : docRow.templateFile?.fileName ||
              `${docRow.typeName || "document"}.pdf`,
      );
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to download form.",
      );
    } finally {
      setDownloadingDocId("");
    }
  };

  const handleSupportingUpload = async (docRow, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !application) return;

    const validationError = getApplicationDocumentValidationError(file);
    if (validationError) {
      notifyError(validationError);
      return;
    }

    setUploadingDocId(docRow.id);
    try {
      const uploaded = await uploadSupportingFile(file);
      const currentDocs = Array.isArray(application.documents)
        ? application.documents.map((d) => ({ ...d }))
        : [];
      const matchIndex = findSupportingDocIndex(docRow, currentDocs);
      if (matchIndex < 0) {
        throw new Error("Document row not found.");
      }
      const current = currentDocs[matchIndex] || {};
      const draftName = String(
        nameDraftRefs.current[docRow.id]?.value || "",
      ).trim();
      const draftDesc = String(
        descDraftRefs.current[docRow.id]?.value || "",
      ).trim();
      currentDocs[matchIndex] = {
        ...current,
        ...uploaded,
        documentName:
          draftName ||
          current.documentName ||
          String(file.name || "")
            .replace(/\.[^.]+$/, "")
            .trim() ||
          current.typeName ||
          "Document",
        documentDescription:
          draftDesc || current.documentDescription || "",
        attached: true,
      };
      await persistSupportingDocuments(currentDocs);
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload document.",
      );
    } finally {
      setUploadingDocId("");
    }
  };
  const requestQuotationDecision = (decision) => setPendingQuoteDecision(decision);

  const decideQuotation = async (decision, applicant = null) => {
    setPendingQuoteDecision(null);
    setDecidingQuote(decision);
    try {
      const payload = { decision };
      if (applicant) {
        payload.applicant = {
          name: applicant.name || "",
          position: applicant.position || "",
          signatureDataUrl: applicant.signatureDataUrl || "",
          companyChop: applicant.companyChop || "",
        };
      }
      const res = await CustomerApplicationServices.decideMyQuotation(id, payload);
      if (res?.data?.status) {
        const docs =
          await CustomerApplicationServices.getMyApplicationDocuments(id);
        setIssuedDocs(Array.isArray(docs?.data?.data) ? docs.data.data : []);
        const refreshed =
          await CustomerApplicationServices.getMyApplicationById(id);
        if (refreshed?.data?.data) setApplication(refreshed.data.data);
      }
    } catch (err) {
      setLoadError(
        err?.response?.data?.message || "Could not record your response.",
      );
    } finally {
      setDecidingQuote("");
    }
  };

  const contractReviewDoc = issuedDocs.find((d) => d.formKey === "FOR-01-24");

  const isInspection = application?.type === "inspection";
  const detail = useMemo(
    () =>
      application
        ? buildDetailFromApplication(application, documentTypeMetaById)
        : null,
    [application, documentTypeMetaById],
  );

  if (loading) {
    return (
      <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "Applications" }]}>
        <p className="epc-placeholder__text">Loading application…</p>
      </PortalLayout>
    );
  }

  if (!application || !detail) {
    return (
      <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "Applications" }]}>
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Application not found</p>
          <p className="epc-placeholder__text">
            {loadError || `${id} is not in your list.`}
          </p>
          <Button onClick={() => history.push(customerPath.applications)}>
            Back to applications
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const editState = {
    applicationId: application._id || application.id,
    responseRemark: responseRemark || "",
  };

  const goEdit = () =>
    history.push(
      `${customerPath.applications}/${application.type}/new`,
      editState,
    );

  const needsResubmit =
    application.status === "Action Required" ||
    application.status === "Rejected" ||
    application.canResubmit;
  const infoRequest = application.additionalInfoRequest;
  const isRejected = application.status === "Rejected";
  const rejectionReason =
    application.rejectionReason ||
    [...(application.reviewHistory || [])]
      .reverse()
      .find((e) => e?.action === "rejected")?.remarks ||
    "";

  const metaParts = [detail.reference];
  if (application.enquiryNumber) {
    metaParts.push(`Enquiry ${application.enquiryNumber}`);
  } else if (application.enquiryId) {
    metaParts.push("Linked to enquiry");
  } else {
    metaParts.push("Direct application");
  }

  const pendingAckDoc = issuedDocs.find((d) => d.needsAcknowledgement);
  const pendingQuoteDoc = issuedDocs.find((d) => d.needsDecision);

  return (
    <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "Applications" }]}>
      <DetailHeader
        title={`${detail.applicationType} Application Details`}
        subtitle={
          isInspection
            ? "Review the submitted inspection application, site information, references and AQCTA progress."
            : "Review the submitted certification application, supporting evidence and AQCTA review progress."
        }
        meta={metaParts.join(" · ")}
        onBack={() => history.push(customerPath.applications)}
        action={
          pendingAckDoc ? (
            <Button onClick={() => setAckRow(pendingAckDoc)}>
              Confirm receipt
            </Button>
          ) : pendingQuoteDoc ? (
            <Button
              disabled={Boolean(decidingQuote)}
              onClick={() => requestQuotationDecision("Accepted")}
            >
              {decidingQuote === "Accepted" ? "Accepting…" : "Accept quotation"}
            </Button>
          ) : application.canEdit ? (
            <Button onClick={goEdit}>
              {needsResubmit ? "Fix & Resubmit" : "Edit Application"}
            </Button>
          ) : null
        }
      />

      <SummaryTiles
        tiles={[
          {
            label: "Application Type",
            value: detail.applicationType,
            note: isInspection
              ? "Inspection application"
              : detail.certificationType,
          },
          { label: "Status", value: application.status, note: detail.submitted },
          { label: "Current Stage", value: detail.stage, note: detail.stageNote },
          {
            label: "Originating Enquiry",
            value: detail.enquiry,
            note: detail.enquiryQualified,
          },
        ]}
      />

      {downloadError ? (
        <p className="epc-field__error" role="alert">
          {downloadError}
        </p>
      ) : null}

      {pendingAckDoc ? (
        <Card>
          <CardHeader
            title="Confirm Factory Audit Notice"
            subtitle="AQCTA is waiting for you to confirm receipt of the visit notice"
            action={<StatusPill status="Action Required" />}
          />
          <NotePanel>
            <div>
              Please confirm that you have received the factory audit notice
              {pendingAckDoc.visitDate
                ? ` for the visit on ${pendingAckDoc.visitDate}${
                    pendingAckDoc.visitTime
                      ? ` at ${pendingAckDoc.visitTime}`
                      : ""
                  }`
                : ""}
              . You can sign in the portal or upload a signed copy.
            </div>
            <div style={{ marginTop: 8 }} className="epc-muted-small">
              Issued {formatTimelineDate(pendingAckDoc.issuedAt)}
              {pendingAckDoc.documentCode
                ? ` · ${pendingAckDoc.documentCode}`
                : ""}
            </div>
          </NotePanel>
          <div
            className="epc-wizard__foot-right"
            style={{ padding: "0 16px 16px", gap: 8 }}
          >
            <Button
              variant="secondary"
              onClick={() => setViewingDoc(pendingAckDoc)}
            >
              Preview notice
            </Button>
            <Button onClick={() => setAckRow(pendingAckDoc)}>
              Confirm receipt
            </Button>
          </div>
        </Card>
      ) : null}

      {pendingQuoteDoc && !pendingAckDoc ? (
        <Card>
          <CardHeader
            title="Quotation awaiting your decision"
            subtitle="Accepting this quotation starts your project"
            action={<StatusPill status="Awaiting your decision" />}
          />
          <NotePanel>
            <div>
              A quotation has been issued for this application
              {pendingQuoteDoc.reference
                ? ` (${pendingQuoteDoc.reference})`
                : ""}
              . Review it and accept or decline below.
            </div>
          </NotePanel>
          <div
            className="epc-wizard__foot-right"
            style={{ padding: "0 16px 16px", gap: 8 }}
          >
            <Button
              variant="secondary"
              onClick={() => setViewingDoc(pendingQuoteDoc)}
            >
              Preview quotation
            </Button>
            <Button
              disabled={Boolean(decidingQuote)}
              onClick={() => requestQuotationDecision("Accepted")}
            >
              {decidingQuote === "Accepted" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(decidingQuote)}
              onClick={() => requestQuotationDecision("Rejected")}
            >
              {decidingQuote === "Rejected" ? "Declining…" : "Decline"}
            </Button>
          </div>
        </Card>
      ) : null}

      {contractReviewDoc ? (
        <Card>
          <CardHeader
            title="Contract Review Notification"
            subtitle="AQCTA has completed contract review and emailed you this letter"
            action={
              outcomeLabel(contractReviewDoc.outcome) ? (
                <StatusPill status={outcomeLabel(contractReviewDoc.outcome)} />
              ) : null
            }
          />
          <NotePanel>
            <div>
              {contractReviewDoc.outcome === "accept"
                ? "Your application has been accepted for certification. The signed notification letter is available below — the same copy that was emailed to you."
                : contractReviewDoc.outcome === "decline"
                  ? contractReviewDoc.outcomeReason
                    ? `Your application was not accepted for certification. Reason: ${contractReviewDoc.outcomeReason}`
                    : "Your application was not accepted for certification. Please review the notification letter for details."
                  : "The Contract Review Notification for this application is ready to view."}
            </div>
            <div style={{ marginTop: 8 }} className="epc-muted-small">
              Issued {formatTimelineDate(contractReviewDoc.issuedAt)}
              {contractReviewDoc.documentCode
                ? ` · ${contractReviewDoc.documentCode}`
                : ""}
            </div>
          </NotePanel>
          <div
            className="epc-wizard__foot-right"
            style={{ padding: "0 16px 16px", gap: 8 }}
          >
            <Button
              variant="secondary"
              onClick={() => setViewingDoc(contractReviewDoc)}
            >
              Preview notification
            </Button>
            <Button
              loading={downloadingKey === contractReviewDoc.formKey}
              disabled={Boolean(downloadingKey)}
              onClick={() => downloadIssuedDoc(contractReviewDoc)}
            >
              {downloadingKey === contractReviewDoc.formKey
                ? "Downloading…"
                : "Download notification"}
            </Button>
          </div>
        </Card>
      ) : null}

      {isRejected ? (
        <Card>
          <CardHeader
            title="Application Rejected"
            subtitle="Please review the rejection reason, update your application, and resubmit"
            action={<StatusPill status="Rejected" />}
          />
          <NotePanel>
            <div>
              <strong>Rejection reason:</strong>
              <div style={{ marginTop: 6 }}>
                {rejectionReason ||
                  "No reason was provided. Contact AQCTA for clarification."}
              </div>
            </div>
          </NotePanel>
          <div style={{ padding: "0 16px 16px" }}>
            <TextareaField
              label="Your response (optional)"
              full
              rows={3}
              value={responseRemark}
              onChange={(e) => setResponseRemark(e.target.value)}
              placeholder="Briefly note what you fixed before resubmitting…"
            />
            <div className="epc-wizard__foot-right" style={{ marginTop: 12 }}>
              <Button onClick={goEdit}>Fix issues & resubmit</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {!isRejected && needsResubmit ? (
        <Card>
          <CardHeader
            title="Modification Requested"
            subtitle="AQCTA asked you to update this application — this is not a rejection. Same application number when you resubmit."
            action={<StatusPill status="Action Required" />}
          />
          <NotePanel>
            <div>
              {infoRequest?.remarks ||
                "Please update your application and provide the requested information."}
            </div>
            {infoRequest?.requiredInfo ? (
              <div style={{ marginTop: 12 }}>
                <strong>What to change / provide:</strong>
                <div style={{ marginTop: 4 }}>{infoRequest.requiredInfo}</div>
              </div>
            ) : null}
          </NotePanel>
          <div style={{ padding: "0 16px 16px" }}>
            <TextareaField
              label="Your response"
              full
              rows={4}
              value={responseRemark}
              onChange={(e) => setResponseRemark(e.target.value)}
              placeholder="Describe how you addressed the request (optional but recommended)"
            />
            <div className="epc-wizard__foot-right" style={{ marginTop: 12 }}>
              <Button onClick={goEdit}>Update & resubmit application</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="epc-detailgrid">
        <div className="epc-detailcol">
          <Card>
            <CardHeader
              title={
                isInspection
                  ? "Applicant & Inspection Site"
                  : "Applicant & Manufacturer"
              }
              subtitle={
                isInspection
                  ? "Applicant and site information provided for inspection"
                  : "Verified customer and factory information"
              }
            />
            <DefinitionList items={detail.applicant} />
          </Card>

          <Card>
            <CardHeader
              title={
                isInspection ? "Project & Inspection Scope" : "Product & Standard"
              }
              subtitle={
                isInspection
                  ? "Requested engineering inspection service"
                  : "Certification scope captured in the submitted application"
              }
            />
            <DefinitionList items={isInspection ? detail.scope : detail.product} />
          </Card>

          <Card>
            <CardHeader
              title={
                isInspection
                  ? "Technical & Commercial References"
                  : "Technical & Quality Summary"
              }
              subtitle={
                isInspection
                  ? "References linked to the inspection request"
                  : "Manufacturing controls and test evidence included with this submission"
              }
            />
            <DefinitionList
              items={isInspection ? detail.references : detail.technical}
            />
          </Card>
        </div>
        <div className="epc-detailcol">
          <Card>
            <CardHeader
              title={
                isInspection
                  ? "Application & Inspection Progress"
                  : "AQCTA Review Progress"
              }
              subtitle="Customer-visible activity"
              action={<StatusPill status={application.status} />}
            />
            <Timeline entries={detail.timeline} />
          </Card>

          <Card>
            <CardHeader title="AQCTA Response" subtitle="Latest customer-visible note" />
            <NotePanel>
              <div style={{ whiteSpace: "pre-wrap" }}>{detail.response}</div>
            </NotePanel>
          </Card>

          {detail.commercial.length > 0 ? (
            <Card>
              <CardHeader
                title="Commercial Links"
                subtitle="Project, quotation and invoice status when available"
              />
              <DefinitionList items={detail.commercial} />
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Application Actions"
              subtitle={
                isInspection
                  ? "Manage this inspection application"
                  : "Manage this application"
              }
            />
            <div className="epc-wizard__foot-right">
              {application.canEdit ? (
                <Button onClick={goEdit}>Edit Application</Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => history.push(customerPath.applications)}
              >
                Back to Applications
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <div className="epc-docpanel">
        <Card>
          <CardHeader
            title={
              isInspection
                ? "Supporting Documents"
                : "Documents & Authorisations"
            }
            subtitle={
              isInspection
                ? "Download forms where available, add a name and description, then upload each file"
                : "Download each AQCTA form where available, add a name and description, then upload the signed copy"
            }
            action={
              <span className="epc-muted-small">
                {detail.documents.length} document
                {detail.documents.length === 1 ? "" : "s"}
              </span>
            }
          />
          {detail.documents.length ? (
            <div className="epc-doccard-list">
              {detail.documents.map((row) => {
                const isUploading = uploadingDocId === row.id;
                const isSavingFields = savingDocFieldsId === row.id;
                const isDownloading = downloadingDocId === row.id;
                const showDownload = Boolean(row.hasTemplate);
                const busy =
                  Boolean(uploadingDocId) ||
                  Boolean(downloadingDocId) ||
                  isSavingFields;
                const reqClass =
                  row.requirement === "Required"
                    ? "epc-doclist__req--required"
                    : row.requirement === "Optional"
                      ? "epc-doclist__req--optional"
                      : row.requirement === "Conditional"
                        ? "epc-doclist__req--conditional"
                        : "";
                return (
                  <article className="epc-doccard" key={row.id}>
                    <div className="epc-doccard__head">
                      <div className="epc-doccard__titleblock">
                        <h3 className="epc-doccard__title">{row.typeName}</h3>
                        <div className="epc-doccard__meta">
                          {row.requirement ? (
                            <span className={`epc-doclist__req ${reqClass}`}>
                              {row.requirement}
                            </span>
                          ) : null}
                          <StatusPill
                            status={row.attached ? "Attached" : "Missing"}
                            tone={row.attached ? "success" : "danger"}
                          />
                        </div>
                        {row.typeHint ? (
                          <p className="epc-doccard__hint">{row.typeHint}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="epc-doccard__fields">
                      <label className="epc-doccard__field">
                        Name
                        <input
                          ref={(el) => {
                            nameDraftRefs.current[row.id] = el;
                          }}
                          className="epc-minitable__input"
                          type="text"
                          defaultValue={row.documentName || ""}
                          key={`${row.id}-name-${row.documentName || ""}-${row.attached ? "1" : "0"}`}
                          placeholder="Document name"
                          disabled={busy}
                          onBlur={(event) =>
                            handleSupportingFieldSave(row, {
                              documentName: event.target.value,
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </label>
                      <label className="epc-doccard__field">
                        Description
                        <input
                          ref={(el) => {
                            descDraftRefs.current[row.id] = el;
                          }}
                          className="epc-minitable__input"
                          type="text"
                          defaultValue={row.documentDescription || ""}
                          key={`${row.id}-desc-${row.documentDescription || ""}-${row.attached ? "1" : "0"}`}
                          placeholder="Short description"
                          disabled={busy}
                          onBlur={(event) =>
                            handleSupportingFieldSave(row, {
                              documentDescription: event.target.value,
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="epc-doccard__foot">
                      <div className="epc-doccard__file">
                        {row.attached && row.fileName ? (
                          <>
                            File:{" "}
                            {row.url ? (
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noreferrer"
                                className="epc-rowlink"
                              >
                                {row.fileName}
                              </a>
                            ) : (
                              row.fileName
                            )}
                          </>
                        ) : (
                          <span>No file uploaded yet</span>
                        )}
                      </div>
                      <div className="epc-doccard__actions">
                        {showDownload ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            loading={isDownloading}
                            disabled={busy}
                            onClick={() => handleSupportingDownloadForm(row)}
                          >
                            <DownloadIcon size={15} />
                            {isDownloading ? "Preparing…" : "Download Form"}
                          </Button>
                        ) : null}
                        {row.attached && row.url ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              window.open(
                                row.url,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          >
                            <EyeIcon size={15} />
                            View
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          loading={isUploading}
                          disabled={busy}
                          onClick={() => openSupportingUpload(row.id)}
                        >
                          <UploadArrowIcon size={15} />
                          {isUploading
                            ? "Uploading…"
                            : row.attached
                              ? "Replace"
                              : "Upload"}
                        </Button>
                        <input
                          ref={(el) => {
                            fileInputRefs.current[row.id] = el;
                          }}
                          type="file"
                          className="epc-visually-hidden"
                          accept={APPLICATION_DOCUMENT_ACCEPT}
                          onChange={(event) =>
                            handleSupportingUpload(row, event)
                          }
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="epc-placeholder__text">
              No supporting documents configured for this application.
            </p>
          )}
        </Card>

        {issuedDocs.length ? (
          <Card>
            <CardHeader
              title="Issued Documents"
              subtitle="Documents AQCTA has issued for this application — preview or download here"
            />
            <DataTable
              rowKey="formKey"
              rows={issuedDocs}
              columns={[
                {
                  key: "title",
                  header: "Document",
                  width: "34%",
                  render: (row) => (
                    <button
                      type="button"
                      className="epc-rowlink"
                      onClick={() => setViewingDoc(row)}
                    >
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: "documentCode",
                  header: "Reference",
                  width: "18%",
                },
                {
                  key: "issuedAt",
                  header: "Issued",
                  width: "14%",
                  render: (row) => formatTimelineDate(row.issuedAt),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "16%",
                  render: (row) => {
                    const status = issuedDocStatus(row);
                    return status ? <StatusPill status={status} /> : "—";
                  },
                },
                {
                  key: "actions",
                  header: "Actions",
                  width: "18%",
                  render: (row) => (
                    <div className="epc-quote-actions">
                      <RowActions
                        actions={[
                          {
                            icon: EyeIcon,
                            label: `Preview ${row.title}`,
                            onClick: () => setViewingDoc(row),
                          },
                          ...(isPdfIssuedDoc(row)
                            ? [
                                {
                                  icon: DownloadIcon,
                                  label:
                                    downloadingKey === row.formKey
                                      ? `Downloading ${row.title}`
                                      : `Download ${row.title}`,
                                  onClick: () => downloadIssuedDoc(row),
                                },
                              ]
                            : []),
                        ]}
                      />
                      {row.needsAcknowledgement ? (
                        <Button size="sm" onClick={() => setAckRow(row)}>
                          Confirm receipt
                        </Button>
                      ) : null}
                      {row.needsDecision ? (
                        <>
                          <Button
                            size="sm"
                            disabled={Boolean(decidingQuote)}
                            onClick={() =>
                              requestQuotationDecision("Accepted")
                            }
                          >
                            {decidingQuote === "Accepted"
                              ? "Accepting…"
                              : "Accept"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={Boolean(decidingQuote)}
                            onClick={() =>
                              requestQuotationDecision("Rejected")
                            }
                          >
                            {decidingQuote === "Rejected"
                              ? "Declining…"
                              : "Decline"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        ) : null}
      </div>


      <AcknowledgeNoticeDialog
        open={Boolean(ackRow)}
        notice={ackRow}
        busy={ackBusy}
        onCancel={() => setAckRow(null)}
        onSubmit={async (payload) => {
          setAckBusy(true);
          try {
            const res = await CustomerApplicationServices.acknowledgeAuditNotice(
              id,
              payload,
            );
            if (res?.data?.status) {
              setAckRow(null);
              const docs =
                await CustomerApplicationServices.getMyApplicationDocuments(id);
              setIssuedDocs(Array.isArray(docs?.data?.data) ? docs.data.data : []);
            }
          } catch (err) {
            setLoadError(
              err?.response?.data?.message ||
                "Your confirmation could not be recorded.",
            );
            setAckRow(null);
          } finally {
            setAckBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingQuoteDecision) && !isInspection}
        title={
          pendingQuoteDecision === "Accepted"
            ? "Accept this quotation?"
            : "Decline this quotation?"
        }
        body={
          pendingQuoteDecision === "Accepted"
            ? "This confirms the fees shown, starts your project, and raises the invoice. This cannot be undone."
            : "AQCTA will be notified so they can revise the quotation and send it back to you. No invoice is raised unless you accept."
        }
        confirmLabel={pendingQuoteDecision === "Accepted" ? "Accept quotation" : "Decline quotation"}
        tone={pendingQuoteDecision === "Accepted" ? "primary" : "danger"}
        onConfirm={() => decideQuotation(pendingQuoteDecision)}
        onCancel={() => setPendingQuoteDecision(null)}
      />

      <AcceptQuotationDialog
        open={Boolean(pendingQuoteDecision) && isInspection}
        decision={pendingQuoteDecision || "Accepted"}
        quotationRef={
          issuedDocs.find((d) => d.formKey === "FOR-06-03")?.reference || ""
        }
        defaultName={
          application?.formData?.contactPerson ||
          application?.formData?.authorisedContact ||
          account?.contactPerson ||
          account?.contacts?.[0]?.name ||
          account?.name ||
          ""
        }
        defaultPosition={
          application?.formData?.contactPosition ||
          application?.formData?.designation ||
          account?.contactPosition ||
          account?.contacts?.[0]?.position ||
          ""
        }
        defaultSignature={
          account?.eSignature ||
          account?.signatureDataUrl ||
          account?.signature ||
          ""
        }
        defaultCompanyChop={
          account?.companyChop || account?.companyStamp || ""
        }
        busy={Boolean(decidingQuote)}
        onCancel={() => setPendingQuoteDecision(null)}
        onSubmit={(applicant) =>
          decideQuotation(pendingQuoteDecision, applicant)
        }
      />

      <CustomerQuotationPreviewModal
        open={Boolean(viewingDoc && viewingDoc.formKey === "FOR-01-07")}
        quoteNumber={
          viewingDoc?.formKey === "FOR-01-07"
            ? viewingDoc.reference || ""
            : ""
        }
        title={
          viewingDoc?.formKey === "FOR-01-07"
            ? `Quotation ${viewingDoc.reference || ""}`.trim()
            : ""
        }
        subtitle={
          viewingDoc?.formKey === "FOR-01-07"
            ? [
                viewingDoc.documentCode,
                viewingDoc.issuedAt
                  ? `Issued ${formatTimelineDate(viewingDoc.issuedAt)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        onClose={() => setViewingDoc(null)}
      />

      <DocumentViewerModal
        open={Boolean(viewingDoc && viewingDoc.formKey !== "FOR-01-07")}
        title={viewingDoc?.title || "Document"}
        subtitle={
          viewingDoc
            ? [
                viewingDoc.documentCode,
                viewingDoc.issuedAt
                  ? `Issued ${formatTimelineDate(viewingDoc.issuedAt)}`
                  : "",
                outcomeLabel(viewingDoc.outcome),
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        fileName={
          viewingDoc
            ? `${String(viewingDoc.title || viewingDoc.formKey)
                .replace(/[^\w.\-]+/g, "_")}.pdf`
            : "document.pdf"
        }
        fetchPdf={
          viewingDoc && viewingDoc.formKey !== "FOR-01-07"
            ? async () => {
                const res =
                  await CustomerApplicationServices.getMyApplicationDocumentPdf(
                    id,
                    viewingDoc.formKey,
                  );
                return blobFromResponse(res);
              }
            : undefined
        }
        onClose={() => setViewingDoc(null)}
      />
    </PortalLayout>
  );
}
