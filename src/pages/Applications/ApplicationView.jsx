import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Paperclip,
} from "lucide-react";
import { notifyError } from "@/utils/toast";
import { DropdownBasic, Loader } from "@/page-layouts";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import ApplicationServices, {
  APPLICATION_STATUS_OPTIONS,
} from "@/services/ApplicationServices";
import { useApplicationStatusChange } from "./useApplicationStatusChange";
import { formatTimelineDate } from "@/utils/applicationTimeline";
import {
  applicationPhaseStages,
  currentWorkflowStage,
  applicationActionsPath,
} from "./workflowStages";
import WorkflowStageList from "./WorkflowStageList";
import ApplicationDocumentTypeServices from "@/services/applicationDocumentTypeService";
import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import EpcSurface from "@/components/Epc/EpcSurface";
import { formatMultiValue } from "@/customer/utils/productMultiFields";
import {
  buildInspectionFormData,
  downloadAxiosBlob,
  isInspectionApplicationForm,
  resolveDocumentDownloadTemplateKey,
} from "@/utils/certificationFormData";

const INSPECTION_APP_FORM_NAME = "Application for Engineering Inspection";
const INSPECTION_APP_FORM_KEY = "FOR-06-04";

const isInspectionAppFormDoc = (d = {}) => isInspectionApplicationForm(d);

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-800",
  "Under Review": "bg-amber-100 text-amber-800",
  Scheduled: "bg-blue-100 text-blue-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  Certified: "bg-green-100 text-green-800",
  Completed: "bg-emerald-100 text-emerald-800",
  "Action Required": "bg-red-100 text-red-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
  Resubmitted: "bg-blue-100 text-blue-800",
  Attached: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-800",
};

const REVIEW_ACTION_TITLES = {
  assigned: "Assigned",
  approved: "Approved",
  request_info: "Additional information requested",
  rejected: "Rejected",
  submitted: "Application submitted",
  resubmitted: "Resubmitted",
  status_change: "Status changed",
  /* Internal workflow-stage steps — never shown to the customer. The remark
     names the stage, so these titles stay generic. */
  stage_form_submitted: "Submitted for approval",
  stage_form_returned: "Rejected and returned to preparer",
  /* Slugs written before the stages were generalised. */
  contract_review_submitted: "Contract review submitted for approval",
  contract_review_returned: "Contract review returned to preparer",
};

const pick = (obj, ...keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "—";
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
      STATUS_STYLES[status] || "bg-gray-100 text-gray-800"
    }`}
  >
    {status || "—"}
  </span>
);

const Card = ({ children, className = "" }) => (
  <section
    className={`rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
  >
    {children}
  </section>
);

const CardHeader = ({ title, subtitle, action, icon: Icon }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3">
      {Icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(var(--p-blue-rgb),0.08)] text-[var(--p-blue)]">
          <Icon size={16} strokeWidth={2} />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

const DefinitionList = ({ items = [] }) => (
  <dl className="flex flex-col gap-0 divide-y divide-gray-100">
    {items.map((item) => (
      <div
        key={item.label}
        className="grid grid-cols-[minmax(120px,0.42fr)_minmax(0,1fr)] gap-4 items-start py-2.5 first:pt-0 last:pb-0"
      >
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {item.label}
        </dt>
        <dd className="m-0 text-sm text-gray-900 break-words">
          {item.value || "—"}
        </dd>
      </div>
    ))}
  </dl>
);

const SummaryTiles = ({ tiles = [] }) => (
  <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
      {tiles.map((tile, index) => (
        <article
          key={tile.label}
          className={`flex flex-col gap-1.5 px-5 py-4 ${
            index > 0 ? "sm:border-l sm:border-gray-100" : ""
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
            {tile.label}
          </span>
          <span className="text-lg font-bold leading-snug text-gray-900">
            {tile.value}
          </span>
          {tile.note ? (
            <span className="text-xs text-gray-400">{tile.note}</span>
          ) : null}
        </article>
      ))}
    </div>
  </div>
);

const Timeline = ({ entries = [] }) => (
  <ol className="m-0 flex list-none flex-col gap-4 p-0">
    {entries.map((entry) => {
      const tone =
        entry.tone === "done"
          ? "bg-emerald-500"
          : entry.tone === "current"
            ? "bg-[var(--p-blue)]"
            : "bg-gray-300";
      return (
        <li
          key={`${entry.title}-${entry.date}`}
          className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3"
        >
          <span
            className={`mt-1.5 h-2.5 w-2.5 rounded-full ${tone}`}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-gray-400">{entry.date}</span>
            <span className="text-sm font-semibold text-gray-900">
              {entry.title}
            </span>
            {entry.note ? (
              <span className="text-xs text-gray-500">{entry.note}</span>
            ) : null}
          </div>
        </li>
      );
    })}
  </ol>
);

const NotePanel = ({ children }) => (
  <div className="rounded-lg bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-gray-800">
    {children}
  </div>
);

const fileExtensionLabel = (name = "") => {
  const parts = String(name).split(".");
  if (parts.length < 2) return "FILE";
  return parts.pop().toUpperCase().slice(0, 4);
};

const AttachmentsPanel = ({
  rows = [],
  showStatus = true,
  onDownloadForm,
  downloadingKey = "",
}) => {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-10 text-center">
        <Paperclip className="mb-2 text-gray-300" size={22} />
        <p className="text-sm font-medium text-gray-600">No files attached</p>
        <p className="mt-1 text-xs text-gray-400">
          Supporting documents for this application will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((row) => {
        const rowKey =
          row.id ||
          `${row.name}-${row.category}-${row.url || row.fileName || row.templateKey || ""}`;
        const isDownloading = downloadingKey === rowKey;
        const label = row.fileName || row.name || "Attachment";
        const ext = fileExtensionLabel(label);

        return (
          <li
            key={rowKey}
            className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/60 px-3.5 py-3 transition-colors hover:border-gray-300"
          >
            <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-[var(--p-blue)] shadow-sm">
              <FileText size={16} strokeWidth={2} />
              <span className="mt-0.5 text-[9px] font-bold tracking-wide text-gray-400">
                {ext}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-semibold text-gray-900 hover:text-[var(--p-blue)] hover:underline"
                    >
                      {row.name}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {row.name}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[row.category, row.documentCode].filter(Boolean).join(" · ") ||
                      "Document"}
                  </p>
                  {row.fileName && row.fileName !== row.name ? (
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">
                      {row.fileName}
                    </p>
                  ) : null}
                </div>
                {showStatus ? (
                  <StatusBadge status={row.status} />
                ) : row.url || row.attached ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Attached
                  </span>
                ) : row.downloadable ? (
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                    Available
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-[var(--p-blue)] hover:bg-gray-50"
                  >
                    <ExternalLink size={12} />
                    View
                  </a>
                ) : null}
                {row.downloadable && onDownloadForm ? (
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => onDownloadForm(row, rowKey)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-[var(--p-blue)] hover:bg-gray-50 disabled:opacity-60"
                    title="Download pre-filled AQCTA-FOR-06-04 with application data"
                  >
                    <Download size={12} />
                    {isDownloading ? "Preparing…" : "Download Form"}
                  </button>
                ) : null}
                {!row.url && !row.downloadable ? (
                  <span className="text-xs text-gray-400">No action available</span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const DocTable = ({
  rows = [],
  showStatus = true,
  onDownloadForm,
  downloadingKey = "",
}) => {
  if (!rows.length) {
    return <p className="text-sm text-gray-500">No files attached.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500">
            <th className="pb-2 pr-3 font-medium">Document</th>
            <th className="pb-2 pr-3 font-medium">Name</th>
            <th className="pb-2 pr-3 font-medium">Description</th>
            <th className="pb-2 pr-3 font-medium">Category</th>
            {showStatus ? (
              <th className="pb-2 pr-3 font-medium">Status</th>
            ) : (
              <th className="pb-2 pr-3 font-medium" />
            )}
            <th className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowKey =
              row.id ||
              `${row.name}-${row.category}-${row.url || row.fileName || row.templateKey || ""}`;
            const isDownloading = downloadingKey === rowKey;
            const name = String(row.documentName || "").trim();
            const description = String(row.description || "").trim();
            return (
              <tr
                key={rowKey}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="py-2.5 pr-3 text-gray-900">
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--p-blue)] hover:underline"
                    >
                      {row.name}
                    </a>
                  ) : (
                    row.name
                  )}
                  {row.fileName && row.fileName !== row.name ? (
                    <div className="mt-0.5 text-xs text-gray-400">
                      {row.fileName}
                    </div>
                  ) : null}
                  {row.documentCode ? (
                    <div className="mt-0.5 text-xs text-gray-400">
                      {row.documentCode}
                    </div>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 text-gray-700">
                  {name || <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="py-2.5 pr-3 text-gray-700">
                  {description || (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-gray-600">{row.category}</td>
                <td className="py-2.5 pr-3">
                  {showStatus ? (
                    <StatusBadge status={row.status} />
                  ) : row.url || row.attached ? (
                    <span className="text-xs font-medium text-[var(--p-blue)]">
                      Attached
                    </span>
                  ) : row.downloadable ? (
                    <span className="text-xs font-medium text-emerald-700">
                      Available
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-[var(--p-blue)] hover:bg-gray-50"
                      >
                        View
                      </a>
                    ) : null}
                    {row.downloadable && onDownloadForm ? (
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => onDownloadForm(row, rowKey)}
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-[var(--p-blue)] hover:bg-gray-50 disabled:opacity-60"
                        title="Download pre-filled AQCTA-FOR-06-04 with application data"
                      >
                        {isDownloading ? "Preparing…" : "Download Form"}
                      </button>
                    ) : null}
                    {!row.url && !row.downloadable ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const buildTimeline = (row) => {
  const history = Array.isArray(row.reviewHistory) ? [...row.reviewHistory] : [];
  if (history.length > 0) {
    history.sort(
      (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
    );
    return history.map((entry, idx) => {
      const action = String(entry.action || "").toLowerCase();
      let title = REVIEW_ACTION_TITLES[action] || entry.action || "Update";
      if (action === "status_change" && (entry.fromStatus || entry.toStatus)) {
        title = `Status: ${entry.fromStatus || "—"} → ${entry.toStatus || "—"}`;
      }
      const noteParts = [entry.remarks, entry.byName].filter(Boolean);
      return {
        date: formatTimelineDate(entry.at),
        title,
        note: noteParts.join(" · ") || undefined,
        tone: idx === 0 ? "current" : "done",
      };
    });
  }
  return [
    {
      date: formatTimelineDate(row.submittedAt || row.createdAt || row.updatedAt),
      title: row.status === "Draft" ? "Draft saved" : "Application submitted",
      note:
        row.status === "Draft"
          ? "Customer can continue editing this draft"
          : "Submission locked for review",
      tone: "done",
    },
    {
      date: formatTimelineDate(row.updatedAt),
      title: row.stage || "In progress",
      note: `Current status: ${row.status}`,
      tone: "current",
    },
  ];
};

const buildResponseText = (row, isInspection) => {
  const air = row.additionalInfoRequest;
  if (air && (air.remarks || air.requiredInfo)) {
    const parts = [];
    if (air.remarks) parts.push(air.remarks);
    if (air.requiredInfo) parts.push(`Required information: ${air.requiredInfo}`);
    return parts.join("\n\n");
  }
  if (row.status === "Rejected") {
    return (
      row.rejectionReason ||
      (() => {
        const hist = Array.isArray(row.reviewHistory) ? row.reviewHistory : [];
        const reject = [...hist]
          .reverse()
          .find((e) => String(e.action || "").toLowerCase() === "rejected");
        return reject?.remarks || "Application rejected.";
      })()
    );
  }
  if (row.status === "Approved") {
    return "Approved — eligible for Costing";
  }
  if (row.status === "Draft") {
    return "This draft has not been submitted yet.";
  }
  return isInspection
    ? "Application received. Update status from the actions panel as review progresses."
    : "Application is under review. Update status from the actions panel as work progresses.";
};

const buildDetail = (row) => {
  const form = row.formData || {};
  const technical = row.technical || {};
  const isInspection = row.type === "inspection";
  const reference = row.applicationNumber || row._id;
  const enquiryNote = row.enquiryId ? "Linked enquiry" : "Direct application";
  const submittedLabel =
    row.status === "Draft"
      ? "Draft — not submitted"
      : row.submittedAt
        ? `Submitted ${formatDate(row.submittedAt)}`
        : "Submitted";

  const timeline = buildTimeline(row);
  const response = buildResponseText(row, isInspection);
  const declarationItem = {
    label: "Declaration",
    value: row.declarationAgreed ? "Agreed" : "Not agreed",
  };
  const enquiryTile = {
    label: "Originating Enquiry",
    value: row.enquiryNumber || "None",
    note: enquiryNote,
  };

  if (isInspection) {
    const legacyAttachments = (technical.references || [])
      .filter(
        (d) =>
          d &&
          !Array.isArray(d) &&
          (d.attached || d.url || d.s3Key),
      )
      .map((d) => ({
        id: `legacy-${d.documentName || d.fileName || d.name || Math.random()}`,
        name:
          d.documentName ||
          d.reference ||
          d.fileName ||
          d.typeName ||
          d.name ||
          "Attachment",
        category: d.typeName || d.requirement || "Reference",
        fileName: d.fileName || "",
        url: d.url || "",
        status: "Attached",
        attached: true,
      }));

    const documentAttachments = (row.documents || [])
      .filter((d) => d && !Array.isArray(d))
      .map((d, index) => {
        const attached = Boolean(d.attached || d.url || d.s3Key);
        const isAppForm = isInspectionAppFormDoc(d);
        return {
          id: String(
            d.documentTypeId || d._id || `doc-${index}-${d.typeName || d.name}`,
          ),
          name:
            d.documentName ||
            d.fileName ||
            d.typeName ||
            d.name ||
            "Attachment",
          category: d.typeName || d.requirement || "Document",
          fileName: d.fileName || "",
          url: d.url || "",
          status: attached ? "Attached" : isAppForm ? "Available" : "Pending",
          attached,
          downloadable: isAppForm,
          templateKey: isAppForm
            ? d.templateKey || INSPECTION_APP_FORM_KEY
            : d.templateKey || "",
          documentTypeId: d.documentTypeId || "",
          documentCode: "",
        };
      });

    const hasAppForm = documentAttachments.some((d) => d.downloadable);
    const attachments = [
      ...(hasAppForm
        ? []
        : [
            {
              id: "for-06-04",
              name: INSPECTION_APP_FORM_NAME,
              category: "Application Form",
              fileName: "",
              url: "",
              status: "Available",
              attached: false,
              downloadable: true,
              templateKey: INSPECTION_APP_FORM_KEY,
              documentTypeId: "",
              documentCode: "",
            },
          ]),
      ...(documentAttachments.length > 0
        ? documentAttachments
        : legacyAttachments),
    ];

    /* Prefer showing attached uploads + the application form; if the only
       rows are pending checklist items without files, still keep the form. */
    const visibleAttachments = attachments.filter(
      (d) => d.attached || d.url || d.downloadable,
    );

    return {
      isInspection: true,
      title: `${row.service || "Factory Assessment"} Application Details`,
      subtitle:
        "Review the submitted inspection application, site information, references and AQCTA progress.",
      reference,
      enquiryNote,
      tiles: [
        {
          label: "Application Type",
          value: row.service || "Engineering Inspection",
          note: "Inspection application",
        },
        {
          label: "Status",
          value: row.status,
          note: submittedLabel,
        },
        {
          label: "Current Stage",
          value: row.stage || "—",
          note: row.status,
        },
        enquiryTile,
      ],
      applicant: [
        { label: "Applicant Company", value: pick(form, "companyName") },
        {
          label: "Registration No.",
          value: pick(form, "registrationNumber"),
        },
        {
          label: "Contact Person",
          value:
            [pick(form, "contactPerson"), pick(form, "telephone")]
              .filter((v) => v !== "—")
              .join(" · ") || "—",
        },
        {
          label: "Applicant Email",
          value: pick(form, "email", "companyEmail"),
        },
        {
          label: "Inspection Site",
          value: pick(form, "siteName", "siteAddress"),
        },
        { label: "Site Address", value: pick(form, "siteAddress") },
        { label: "Street", value: pick(form, "siteStreet") },
        { label: "Block / Unit", value: pick(form, "siteBlock") },
        { label: "Site Telephone", value: pick(form, "siteTelephone") },
        declarationItem,
      ],
      scope: [
        { label: "Project Name", value: pick(form, "projectName") },
        {
          label: "Project Description",
          value: pick(form, "projectDescription"),
        },
        {
          label: "Inspection Category",
          value: pick(form, "inspectionCategory"),
        },
        {
          label: "Requested Service",
          value: pick(form, "requestedService"),
        },
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
        {
          label: "Technical references",
          value:
            visibleAttachments.filter((d) => d.attached || d.url).length > 0
              ? `${visibleAttachments.filter((d) => d.attached || d.url).length} linked`
              : "None attached",
        },
      ],
      documents: visibleAttachments,
      timeline,
      response,
    };
  }

  const documents = (Array.isArray(row.documents) ? row.documents : []).map(
    (d) => {
      const typeName = d.typeName || d.requirement || d.name || "Document";
      return {
        name: typeName,
        documentName: String(d.documentName || "").trim(),
        description: String(d.documentDescription || "").trim(),
        category: d.requirement || "Document",
        status: d.attached || d.url || d.s3Key ? "Attached" : "Pending",
        fileName: d.fileName || "",
        url: d.url || "",
      };
    },
  );

  const processFlowTitles = (technical.qcCheckpoints || [])
    .map((cp) => cp.title)
    .filter(Boolean);

  return {
    isInspection: false,
    title: `${row.service || "Conformity Assessment"} Application Details`,
    subtitle:
      "Review the submitted certification application, supporting evidence and AQCTA review progress.",
    reference,
    enquiryNote,
    certificationType: pick(form, "certificationType"),
    tiles: [
      {
        label: "Application Type",
        value: row.service || "Conformity Assessment",
        note: pick(form, "certificationType"),
      },
      {
        label: "Status",
        value: row.status,
        note: submittedLabel,
      },
      {
        label: "Current Stage",
        value: row.stage || "—",
        note: row.status,
      },
      enquiryTile,
    ],
    applicant: [
      { label: "Applicant Company", value: pick(form, "companyName") },
      {
        label: "Registration No.",
        value: pick(form, "registrationNumber"),
      },
      { label: "Authorised Contact", value: pick(form, "contactPerson") },
      {
        label: "Contact Details",
        value:
          [pick(form, "contactPhone"), pick(form, "contactEmail")]
            .filter((v) => v !== "—")
            .join(" · ") || "—",
      },
      {
        label: "Manufacturer / Factory",
        value: pick(form, "manufacturerName", "factoryAddress"),
      },
      { label: "Factory Address", value: pick(form, "factoryAddress") },
      { label: "Street", value: pick(form, "factoryStreet") },
      { label: "Block / Unit", value: pick(form, "factoryBlock") },
      { label: "Factory Contact", value: pick(form, "factoryContact") },
      {
        label: "Factory Phone / Email",
        value:
          [pick(form, "factoryPhone"), pick(form, "factoryEmail")]
            .filter((v) => v !== "—")
            .join(" · ") || "—",
      },
      declarationItem,
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
      { label: "Purpose", value: pick(form, "purpose") || pick(row, "purpose") },
      {
        label: "Certification Type",
        value: pick(form, "certificationType"),
      },
    ],
    technical: [
      {
        label: "Components / Raw Materials",
        value: `${(technical.components || []).length} listed`,
      },
      {
        label: "Test Equipment",
        value: `${(technical.equipment || []).length} records`,
      },
      {
        label: "Process flows",
        value:
          processFlowTitles.length > 0
            ? processFlowTitles.join(", ")
            : `${(technical.qcCheckpoints || []).length} added`,
      },
    ],
    processFlows: technical.qcCheckpoints || [],
    documents,
    timeline,
    response,
  };
};

/** Latest reviewHistory entry that mentions this workflow stage title. */
const findStageActivity = (stage, reviewHistory = []) => {
  const title = String(stage?.title || "").trim().toLowerCase();
  if (!title) return null;
  const matches = (Array.isArray(reviewHistory) ? reviewHistory : [])
    .filter((entry) => {
      const remarks = String(entry?.remarks || "").toLowerCase();
      return remarks.includes(title);
    })
    .sort(
      (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
    );
  return matches[0] || null;
};

const ApplicationView = () => {
  const { id } = useParams();
  const history = useHistory();
  const checkTokenExpired = useCheckTokenExpired();
  const { state } = useContext(AdminContext);
  const routePerms = useRouteModulePermissions();
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingDocKey, setDownloadingDocKey] = useState("");

  const load = async () => {
    if (!id || !adminInfo?.token) return;
    setLoading(true);
    try {
      const response = await ApplicationServices.getApplicationById(id, {
        headers: authHeaders,
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        setRow(response.data.data);
      } else {
        notifyError(response.data?.message || "Application not found");
        setRow(null);
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to load application",
      );
      setRow(null);
    } finally {
      setLoading(false);
    }
  };

  const {
    handleStatusChange: changeApplicationStatus,
    statusUpdatingId,
    statusModals,
  } = useApplicationStatusChange({
    authHeaders,
    checkTokenExpired,
    onSuccess: load,
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adminInfo?.token]);

  const detail = useMemo(() => (row ? buildDetail(row) : null), [row]);

  const fetchInspectionApplicationPdf = useCallback(async () => {
    if (!row) throw new Error("Application not loaded");
    const appFormDoc = (row.documents || []).find((d) =>
      isInspectionAppFormDoc(d),
    );
    const res = await ApplicationDocumentTypeServices.downloadForm(
      {
        documentTypeId: appFormDoc?.documentTypeId || undefined,
        templateKey:
          resolveDocumentDownloadTemplateKey(appFormDoc || {}) ||
          INSPECTION_APP_FORM_KEY,
        applicationData: buildInspectionFormData(
          row.formData || {},
          row.documents || [],
        ),
      },
      { headers: authHeaders },
    );
    return new Blob([res.data], { type: "application/pdf" });
  }, [row, authHeaders]);

  const fetchContractReviewNotificationPdf = useCallback(async () => {
    if (!row?._id) throw new Error("Application not loaded");
    const res = await ApplicationServices.getApplicationFormPdf(
      row._id,
      "FOR-01-24",
      { headers: authHeaders, withCredentials: true },
    );
    return new Blob([res.data], { type: "application/pdf" });
  }, [row, authHeaders]);

  const handleDownloadInspectionForm = async (doc, rowKey) => {
    if (!row) return;
    setDownloadingDocKey(rowKey);
    try {
      const res = await ApplicationDocumentTypeServices.downloadForm(
        {
          documentTypeId: doc.documentTypeId || undefined,
          templateKey:
            resolveDocumentDownloadTemplateKey(doc) || INSPECTION_APP_FORM_KEY,
          applicationData: buildInspectionFormData(
            row.formData || {},
            row.documents || [],
          ),
        },
        { headers: authHeaders },
      );
      downloadAxiosBlob(
        res,
        "Application-for-Engineering-Inspection.pdf",
      );
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to download application form.",
      );
    } finally {
      setDownloadingDocKey("");
    }
  };

  const statusUpdating = Boolean(statusUpdatingId && row?._id === statusUpdatingId);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  if (!row || !detail) {
    return (
      <div className="p-8">
        <p className="mb-4 text-gray-700">Application not found.</p>
        <button
          type="button"
          className="text-[var(--p-blue)] hover:underline"
          onClick={() => history.push("/applications")}
        >
          Back to Applications
        </button>
      </div>
    );
  }

  const isInspection = detail.isInspection;

  const workflowStages = row
    ? applicationPhaseStages(row).map((stage) => {
        const status = stage.statusFrom(row);
        const activity = findStageActivity(stage, row.reviewHistory);
        const noteParts = [];
        if (activity?.byName) noteParts.push(activity.byName);
        if (activity?.remarks) noteParts.push(activity.remarks);
        return {
          key: stage.key,
          title: stage.title,
          documentCode: stage.documentCode,
          description: stage.description,
          status,
          date: activity?.at
            ? formatTimelineDate(activity.at)
            : status !== "Not Started"
              ? formatTimelineDate(row.updatedAt)
              : undefined,
          note: noteParts.length ? noteParts.join(" · ") : undefined,
        };
      })
    : [];

  const openableStageKeys = new Set(
    (row?.workflow || []).map((stage) => stage.key),
  );

  const currentStageKey = currentWorkflowStage(row?.workflow)?.key || null;

  const stageHref = (stageKey) => applicationActionsPath(row._id, stageKey);

  const openWorkflowStage = (stageKey) => {
    const href = stageHref(stageKey);
    if (!href) return;
    const opened = window.open(href, "_blank");
    if (opened) opened.opener = null;
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f6f9]">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8">
        {/* Application dossier header */}
        <header className="mb-6 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="h-1.5 w-full bg-[var(--p-blue)]" />
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                className="mt-0.5 rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
                onClick={() => history.push("/applications")}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  Application view
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
                  {detail.reference}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  {row.service || detail.title}
                  {detail.enquiryNote ? ` · ${detail.enquiryNote}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-400">{detail.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={row.status} />
              {routePerms.canUpdate ? (
                <DropdownBasic
                  options={APPLICATION_STATUS_OPTIONS.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={row.status || "Draft"}
                  onChange={(val) => {
                    if (val) changeApplicationStatus(row, val);
                  }}
                  isDisabled={statusUpdating}
                  isClearable={false}
                  sortOptions={false}
                  className="min-w-[180px]"
                />
              ) : null}
            </div>
          </div>
        </header>

        <SummaryTiles tiles={detail.tiles} />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* Left column — application content */}
          <div className="flex min-w-0 flex-col gap-5">
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
                  isInspection
                    ? "Project & Inspection Scope"
                    : "Product & Standard"
                }
                subtitle={
                  isInspection
                    ? "Requested engineering inspection service"
                    : "Certification scope captured in the submitted application"
                }
              />
              <DefinitionList
                items={isInspection ? detail.scope : detail.product}
              />
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
              {!isInspection && detail.processFlows?.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {detail.processFlows.map((flow, index) => {
                    const docs = Array.isArray(flow.documents) ? flow.documents : [];
                    return (
                      <div
                        key={flow.id || index}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {flow.title || `Process Flow ${index + 1}`}
                        </p>
                        {flow.description ? (
                          <p className="mt-1 text-sm text-gray-600">
                            {flow.description}
                          </p>
                        ) : null}
                        {docs.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {docs.map((doc) => (
                              <li
                                key={doc.id || doc.url || doc.name}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className="text-gray-700">
                                  {doc.name || "Document"}
                                </span>
                                {doc.url ? (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-[var(--p-blue)] hover:underline"
                                  >
                                    View
                                  </a>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-gray-500">
                            No documents attached
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                icon={Paperclip}
                title={
                  isInspection ? "Attachments" : "Documents & Authorisations"
                }
                subtitle={
                  isInspection
                    ? "Uploaded supporting files submitted with this inspection"
                    : "Submitted supporting evidence"
                }
                action={
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                    {detail.documents?.length || 0} file
                    {(detail.documents?.length || 0) === 1 ? "" : "s"}
                  </span>
                }
              />
              {isInspection ? (
                <AttachmentsPanel
                  rows={detail.documents}
                  showStatus={false}
                  onDownloadForm={handleDownloadInspectionForm}
                  downloadingKey={downloadingDocKey}
                />
              ) : (
                <DocTable
                  rows={detail.documents}
                  showStatus
                  downloadingKey={downloadingDocKey}
                />
              )}
            </Card>
          </div>

          {/* Right column — progress / workflow / actions */}
          <div className="flex min-w-0 flex-col gap-5">
            {workflowStages.length > 0 ? (
              <Card>
                <WorkflowStageList
                  title={
                    isInspection
                      ? "Inspection Workflow"
                      : "Certification Workflow"
                  }
                  subtitle="Step-by-step progress for this application"
                  stages={workflowStages}
                  currentKey={currentStageKey}
                  openableKeys={openableStageKeys}
                  onOpen={openWorkflowStage}
                  hrefFor={(stage) => stageHref(stage.key)}
                  openInNewWindow
                  variant="stepper"
                  collapsible={false}
                  emptyMessage={
                    isInspection
                      ? "No inspection workflow stages apply to this application."
                      : "No AQCTA scheme workflow stages apply to this application."
                  }
                />
              </Card>
            ) : null}

            <Card>
              <CardHeader
                title={
                  isInspection
                    ? "Application & Inspection Progress"
                    : "AQCTA Review Progress"
                }
                subtitle="Full activity log (admin)"
                action={<StatusBadge status={row.status} />}
              />
              <Timeline entries={detail.timeline} />
            </Card>

            <Card>
              <CardHeader
                title="AQCTA Response"
                subtitle="Latest review note"
              />
              <NotePanel>
                <span className="whitespace-pre-wrap">{detail.response}</span>
              </NotePanel>
            </Card>

            <Card>
              <CardHeader
                title="Application Actions"
                subtitle={
                  isInspection
                    ? "Manage this inspection application"
                    : "Manage this certification application"
                }
              />
              <div className="flex flex-wrap gap-2">
                {routePerms.canUpdate ? (
                  <DropdownBasic
                    options={APPLICATION_STATUS_OPTIONS.map((s) => ({
                      value: s,
                      label: `Update: ${s}`,
                    }))}
                    value={row.status || "Draft"}
                    onChange={(val) => {
                      if (val) changeApplicationStatus(row, val);
                    }}
                    isDisabled={statusUpdating}
                    isClearable={false}
                    sortOptions={false}
                    className="min-w-[180px]"
                    placeholder="Update status"
                  />
                ) : null}
                {row.status !== "Draft" && currentStageKey ? (
                  <a
                    href={stageHref(currentStageKey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-[var(--p-blue)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Continue:{" "}
                    {workflowStages.find((s) => s.key === currentStageKey)
                      ?.title || "Current stage"}
                  </a>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => history.push("/applications")}
                >
                  Back to Applications
                </button>
              </div>
            </Card>
          </div>
        </div>

        {isInspection ? (
          <Card className="mt-5">
            <CardHeader
              icon={FileText}
              title="Documents"
              subtitle="Generated application form, exactly as it is issued."
            />
            <EpcSurface>
              <DocumentPreview
                title={INSPECTION_APP_FORM_NAME}
                documentCode=""
                audience="internal"
                defaultOpen
                available
                note="Filled from this application’s applicant, site, project and commercial details."
                fileName={`AQCTA-FOR-06-04-${
                  row.applicationNumber || row._id || "application"
                }.pdf`}
                fetchPdf={fetchInspectionApplicationPdf}
                refreshToken={[
                  row.updatedAt,
                  row.formData?.companyName,
                  row.formData?.projectName,
                  row.formData?.siteName,
                  row.formData?.quotationReference,
                  (row.documents || []).length,
                ]}
              />
            </EpcSurface>
          </Card>
        ) : ["Accepted", "Declined"].includes(row.contractReviewStatus) ? (
          <Card className="mt-5">
            <CardHeader
              icon={FileText}
              title="Contract Review Notification"
              subtitle="The same letter that was emailed to the customer (AQCTA-FOR-01-24)."
            />
            <EpcSurface>
              <DocumentPreview
                title="Contract Review Notification"
                documentCode=""
                audience="customer"
                defaultOpen
                available
                note="Byte-identical to the copy sent to the customer. Use Download to save the PDF."
                fileName={`Contract-Review-Notification-${
                  row.applicationNumber || row._id || "application"
                }.pdf`}
                fetchPdf={fetchContractReviewNotificationPdf}
                refreshToken={[row.updatedAt, row.contractReviewStatus]}
              />
            </EpcSurface>
          </Card>
        ) : null}
      </div>
      {statusModals}
    </div>
  );
};

export default ApplicationView;
