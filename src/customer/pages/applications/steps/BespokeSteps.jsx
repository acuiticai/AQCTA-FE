import React, { useRef, useState } from "react";

import { StepHeading, StepNote } from "../../../components/wizard/ApplicationWizard";
import Button from "../../../components/ui/Button";
import StatusPill from "../../../components/ui/StatusPill";
import { FormGrid, TextField } from "../../../components/ui/Field";
import {
  UploadArrowIcon,
  PlusIcon,
  TrashIcon,
  CloseIcon,
  DownloadIcon,
} from "../../../components/ui/icons";
import CustomerAuthServices from "../../../services/authService";
import {
  APPLICATION_DOCUMENT_ACCEPT,
  getApplicationDocumentValidationError,
} from "@/utils/applicationDocumentFiles";
import { isInspectionApplicationForm } from "@/utils/certificationFormData";

function newRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const APPROVAL_OPTIONS = [
  "Authority",
  "Certificate",
  "Letter of Approval",
  "Other",
];

function emptyComponent() {
  return {
    id: newRowId(),
    item: "",
    modelBrand: "",
    specification: "",
    manufacturer: "",
    approval: "",
    approvalOther: "",
  };
}

function formatApprovalDisplay(row = {}) {
  const approval = String(row.approval || "").trim();
  if (!approval) return "";
  if (approval === "Other") {
    const other = String(row.approvalOther || "").trim();
    return other ? `Other (${other})` : "Other";
  }
  return approval;
}

function emptyEquipment() {
  return {
    id: newRowId(),
    equipment: "",
    serialNo: "",
    workingRange: "",
    calibration: "",
  };
}

function emptyCheckpoint() {
  return {
    id: newRowId(),
    title: "",
    description: "",
    documents: [],
  };
}

/**
 * Editable multi-row schedule table (Items / Equipment).
 */
function EditableScheduleTable({
  title,
  columns,
  rows = [],
  onChange,
  addLabel = "Add row",
  emptyHint = "No rows yet. Add the first entry.",
}) {
  const updateCell = (rowId, key, value, extra = {}) => {
    onChange?.(
      rows.map((row) =>
        row.id === rowId ? { ...row, [key]: value, ...extra } : row,
      ),
    );
  };

  const removeRow = (rowId) => {
    onChange?.(rows.filter((row) => row.id !== rowId));
  };

  const addRow = () => {
    const blank = {};
    columns.forEach((col) => {
      blank[col.key] = "";
      if (col.otherKey) blank[col.otherKey] = "";
    });
    onChange?.([...rows, { id: newRowId(), ...blank }]);
  };

  const renderCell = (row, col) => {
    if (col.type === "select") {
      const selected = row[col.key] || "";
      const showOther =
        Boolean(col.otherKey) && selected === (col.otherValue || "Other");
      return (
        <div className="epc-minitable__cellstack">
          <select
            className="epc-minitable__input"
            value={selected}
            aria-label={col.label}
            onChange={(event) => {
              const next = event.target.value;
              const extra = {};
              if (col.otherKey && next !== (col.otherValue || "Other")) {
                extra[col.otherKey] = "";
              }
              updateCell(row.id, col.key, next, extra);
            }}
          >
            <option value="">{col.placeholder || `Select ${col.label}`}</option>
            {(col.options || []).map((opt) => {
              const value = typeof opt === "string" ? opt : opt.value;
              const label = typeof opt === "string" ? opt : opt.label;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
          {showOther ? (
            <input
              className="epc-minitable__input"
              type="text"
              value={row[col.otherKey] || ""}
              placeholder={col.otherPlaceholder || "Please specify"}
              aria-label={`${col.label} — specify other`}
              onChange={(event) =>
                updateCell(row.id, col.otherKey, event.target.value)
              }
            />
          ) : null}
        </div>
      );
    }

    return (
      <input
        className="epc-minitable__input"
        type="text"
        value={row[col.key] || ""}
        placeholder={col.placeholder || col.label}
        aria-label={col.label}
        onChange={(event) =>
          updateCell(row.id, col.key, event.target.value)
        }
      />
    );
  };

  return (
    <div className="epc-scheduletable">
      {title ? <h3 className="epc-scheduletable__title">{title}</h3> : null}
      <div className="epc-scheduletable__scroll">
        <table className="epc-minitable epc-minitable--editable">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th className="epc-minitable__actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1}>
                  <p className="epc-scheduletable__empty">{emptyHint}</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td key={col.key}>{renderCell(row, col)}</td>
                  ))}
                  <td className="epc-minitable__actions">
                    <button
                      type="button"
                      className="epc-iconbtn epc-iconbtn--plain"
                      aria-label="Remove row"
                      onClick={() => removeRow(row.id)}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="epc-scheduletable__foot">
        <Button variant="secondary" type="button" onClick={addRow}>
          <PlusIcon size={15} />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

async function uploadTechnicalFile(file, label = "document") {
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
    id: newRowId(),
    flowName: String(file.name || label)
      .replace(/\.[^.]+$/, "")
      .trim() || label,
    name: file.name || label,
    url,
    s3Key,
    file_type: file.type || "",
    file_size: file.size || 0,
  };
}

/* Certification — Technical & Quality -------------------------------------- */

const COMPONENT_COLUMNS = [
  { key: "item", label: "Item", placeholder: "e.g. Main enclosure" },
  {
    key: "modelBrand",
    label: "Model/Brand",
    placeholder: "e.g. Brand X / Model 100",
  },
  {
    key: "specification",
    label: "Technical Data (Specification)",
    placeholder: "e.g. IP54 steel",
  },
  { key: "manufacturer", label: "Manufacturer", placeholder: "Manufacturer name" },
  {
    key: "approval",
    label: "Approval",
    type: "select",
    placeholder: "Select approval",
    options: APPROVAL_OPTIONS,
    otherKey: "approvalOther",
    otherValue: "Other",
    otherPlaceholder: "If Other, please specify",
  },
];

const EQUIPMENT_COLUMNS = [
  { key: "equipment", label: "Equipment", placeholder: "e.g. Multimeter" },
  { key: "serialNo", label: "Serial No.", placeholder: "Serial number" },
  { key: "workingRange", label: "Working Range", placeholder: "e.g. 0–1000V" },
  { key: "calibration", label: "Calibration", placeholder: "e.g. Annual" },
];

/**
 * Interactive technical schedules: Items, Equipment, and process flows.
 */
export function CertificationTechnicalStep({ data, onChange }) {
  const qcFileRefs = useRef({});
  const [qcUploadingId, setQcUploadingId] = useState("");
  const [qcUploadError, setQcUploadError] = useState("");

  const components = Array.isArray(data?.components) ? data.components : [];
  const equipment = Array.isArray(data?.equipment) ? data.equipment : [];
  const processFlows = Array.isArray(data?.processFlows) ? data.processFlows : [];
  const qcCheckpoints = Array.isArray(data?.qcCheckpoints)
    ? data.qcCheckpoints
    : [];

  const patch = (partial) => {
    onChange?.({
      components,
      equipment,
      processFlows,
      qcCheckpoints,
      ...partial,
    });
  };

  const addCheckpoint = () => {
    patch({ qcCheckpoints: [...qcCheckpoints, emptyCheckpoint()] });
  };

  const updateCheckpoint = (id, key, value) => {
    patch({
      qcCheckpoints: qcCheckpoints.map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      ),
    });
  };

  const removeCheckpoint = (id) => {
    patch({ qcCheckpoints: qcCheckpoints.filter((row) => row.id !== id) });
  };

  const handleQcUploadClick = (checkpointId) => {
    qcFileRefs.current[checkpointId]?.click();
  };

  const handleQcFilesSelected = async (checkpointId, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const invalidFile = files.find(
      (file) => getApplicationDocumentValidationError(file),
    );
    if (invalidFile) {
      setQcUploadError(getApplicationDocumentValidationError(invalidFile));
      return;
    }

    setQcUploadingId(checkpointId);
    setQcUploadError("");
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadTechnicalFile(file, "Process flow document"));
      }
      patch({
        qcCheckpoints: qcCheckpoints.map((row) =>
          row.id === checkpointId
            ? {
                ...row,
                documents: [...(row.documents || []), ...uploaded],
              }
            : row,
        ),
      });
    } catch (err) {
      setQcUploadError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload process flow document.",
      );
    } finally {
      setQcUploadingId("");
    }
  };

  const removeQcDocument = (checkpointId, docId) => {
    patch({
      qcCheckpoints: qcCheckpoints.map((row) =>
        row.id === checkpointId
          ? {
              ...row,
              documents: (row.documents || []).filter((d) => d.id !== docId),
            }
          : row,
      ),
    });
  };

  return (
    <>
      <StepHeading
        title="Complete the technical schedules required for certification."
        subtitle="Components, test equipment and manufacturing controls recorded for this product."
      />

      <EditableScheduleTable
        title="Items / Components"
        columns={COMPONENT_COLUMNS}
        rows={components}
        addLabel="Add Item"
        emptyHint="No items yet. Add each component used in this product."
        onChange={(next) => patch({ components: next })}
      />

      <EditableScheduleTable
        title="Test Equipment"
        columns={EQUIPMENT_COLUMNS}
        rows={equipment}
        addLabel="Add Equipment"
        emptyHint="No equipment yet. Add test / calibration equipment records."
        onChange={(next) => patch({ equipment: next })}
      />

      <div className="epc-stepnote epc-techqc">
        <p className="epc-stepnote__title">
          Manufacturing Process &amp; Quality Control
        </p>
        <p className="epc-stepnote__body">
          Add each process flow and attach supporting documents for this
          product.
        </p>

        <div className="epc-uploadrow">
          <Button variant="secondary" type="button" onClick={addCheckpoint}>
            <PlusIcon size={15} />
            {qcCheckpoints.length === 0 ? "Process Flow" : "Another Process Flow"}
          </Button>
          <span className="epc-uploadrow__note">
            {qcCheckpoints.length} process flow
            {qcCheckpoints.length === 1 ? "" : "s"}
          </span>
        </div>

        {qcCheckpoints.length > 0 ? (
          <div className="epc-qclist">
            {qcCheckpoints.map((cp, index) => {
              const docs = Array.isArray(cp.documents) ? cp.documents : [];
              const isUploading = qcUploadingId === cp.id;
              return (
                <div className="epc-qclist__item" key={cp.id}>
                  <div className="epc-repeater__head">
                    <span className="epc-repeater__title">
                      Process Flow {index + 1}
                    </span>
                    <button
                      type="button"
                      className="epc-repeater__remove"
                      onClick={() => removeCheckpoint(cp.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <FormGrid>
                    <TextField
                      label="Process flow title *"
                      name={`qc-title-${cp.id}`}
                      placeholder="e.g. Assembly line flow"
                      value={cp.title || ""}
                      onChange={(event) =>
                        updateCheckpoint(cp.id, "title", event.target.value)
                      }
                    />
                    <TextField
                      label="Description"
                      name={`qc-desc-${cp.id}`}
                      placeholder="What is checked at this stage?"
                      value={cp.description || ""}
                      onChange={(event) =>
                        updateCheckpoint(
                          cp.id,
                          "description",
                          event.target.value,
                        )
                      }
                    />
                  </FormGrid>

                  <div className="epc-qcdocs">
                    <div className="epc-uploadrow">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => handleQcUploadClick(cp.id)}
                        loading={isUploading}
                        disabled={isUploading}
                      >
                        <UploadArrowIcon size={15} />
                        {isUploading ? "Uploading…" : "Upload Document"}
                      </Button>
                      <span className="epc-uploadrow__note">
                        {docs.length} document{docs.length === 1 ? "" : "s"}{" "}
                        attached
                      </span>
                      <input
                        ref={(el) => {
                          qcFileRefs.current[cp.id] = el;
                        }}
                        type="file"
                        className="epc-visually-hidden"
                        accept={APPLICATION_DOCUMENT_ACCEPT}
                        multiple
                        onChange={(event) =>
                          handleQcFilesSelected(cp.id, event)
                        }
                      />
                    </div>

                    {docs.length > 0 ? (
                      <ul className="epc-flowlist epc-flowlist--compact">
                        {docs.map((doc) => (
                          <li className="epc-flowlist__item" key={doc.id}>
                            <div className="epc-flowlist__meta">
                              <span className="epc-flowlist__name">
                                {doc.name || "Document"}
                              </span>
                              {doc.url ? (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="epc-rowlink"
                                >
                                  View
                                </a>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="epc-iconbtn epc-iconbtn--plain"
                              aria-label={`Remove ${doc.name || "document"}`}
                              onClick={() => removeQcDocument(cp.id, doc.id)}
                            >
                              <CloseIcon size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        {qcUploadError ? (
          <p className="epc-field__error" role="alert">
            {qcUploadError}
          </p>
        ) : null}
      </div>
    </>
  );
}

export {
  emptyComponent,
  emptyEquipment,
  emptyCheckpoint,
  newRowId,
  formatApprovalDisplay,
};

/* Certification — Documents & Authorisations ------------------------------- */

async function uploadSupportingDocument(file) {
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

/**
 * Dynamic supporting documents from admin document types.
 * User uploads a file per type and can set a custom document name.
 */
export function CertificationDocumentsStep({
  documents = [],
  onChange,
  loading = false,
  loadError = "",
  onDownloadForm,
}) {
  const fileRefs = useRef({});
  const [uploadingId, setUploadingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const updateRow = (documentTypeId, patch) => {
    onChange?.(
      documents.map((doc) =>
        String(doc.documentTypeId) === String(documentTypeId)
          ? { ...doc, ...patch }
          : doc,
      ),
    );
  };

  const handleUploadClick = (documentTypeId) => {
    fileRefs.current[documentTypeId]?.click();
  };

  const handleFileSelected = async (documentTypeId, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = getApplicationDocumentValidationError(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadingId(String(documentTypeId));
    setUploadError("");
    try {
      const uploaded = await uploadSupportingDocument(file);
      const current = documents.find(
        (d) => String(d.documentTypeId) === String(documentTypeId),
      );
      updateRow(documentTypeId, {
        ...uploaded,
        documentName:
          current?.documentName ||
          String(file.name || "")
            .replace(/\.[^.]+$/, "")
            .trim() ||
          current?.typeName ||
          "Document",
        attached: true,
      });
    } catch (err) {
      setUploadError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload document.",
      );
    } finally {
      setUploadingId("");
    }
  };

  const clearFile = (documentTypeId) => {
    updateRow(documentTypeId, {
      attached: false,
      url: "",
      s3Key: "",
      fileName: "",
      file_type: "",
      file_size: 0,
    });
  };

  const handleDownloadForm = async (doc) => {
    if (!onDownloadForm) return;
    const key = String(doc.documentTypeId || doc.name);
    setDownloadingId(key);
    setDownloadError("");
    try {
      await onDownloadForm(doc);
    } catch (err) {
      setDownloadError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to download form.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  if (loading) {
    return (
      <>
        <StepHeading
          title="Supporting Documents"
          subtitle="Loading required document types…"
        />
        <p className="epc-placeholder__text">Loading document types…</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <StepHeading
          title="Supporting Documents"
          subtitle="Upload certification evidence and required authorisations."
        />
        <p className="epc-field__error" role="alert">
          {loadError}
        </p>
      </>
    );
  }

  if (!documents.length) {
    return (
      <>
        <StepHeading
          title="Supporting Documents"
          subtitle="Upload certification evidence and required authorisations."
        />
        <p className="epc-placeholder__text">
          No supporting document types are configured yet. Ask AQCTA to
          add them in Application Document Types.
        </p>
      </>
    );
  }

  return (
    <>
      <StepHeading
        title="Supporting Documents"
        subtitle="Download each required AQCTA form, sign it manually, then upload the signed copy."
      />

      <div className="epc-doccard-list">
        {documents.map((doc) => {
          const key = String(doc.documentTypeId || doc.name);
          const isUploading = uploadingId === key;
          const isDownloading = downloadingId === key;
          const showDownload = Boolean(doc.hasTemplate && onDownloadForm);
          const reqClass =
            doc.requirement === "Required"
              ? "epc-doclist__req--required"
              : doc.requirement === "Optional"
                ? "epc-doclist__req--optional"
                : doc.requirement === "Conditional"
                  ? "epc-doclist__req--conditional"
                  : "";
          return (
            <article className="epc-doccard" key={key}>
              <div className="epc-doccard__head">
                <div className="epc-doccard__titleblock">
                  <h3 className="epc-doccard__title">
                    {doc.typeName || doc.name}
                  </h3>
                  <div className="epc-doccard__meta">
                    <span className={`epc-doclist__req ${reqClass}`}>
                      {doc.requirement}
                    </span>
                    <StatusPill
                      status={doc.attached ? "Attached" : "Missing"}
                      tone={doc.attached ? "success" : "danger"}
                    />
                  </div>
                  {doc.description ? (
                    <p className="epc-doccard__hint">{doc.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="epc-doccard__fields">
                <label className="epc-doccard__field">
                  Name
                  <input
                    className="epc-minitable__input"
                    type="text"
                    value={doc.documentName || ""}
                    placeholder="Document name"
                    onChange={(event) =>
                      updateRow(doc.documentTypeId, {
                        documentName: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="epc-doccard__field">
                  Description
                  <input
                    className="epc-minitable__input"
                    type="text"
                    value={doc.documentDescription || ""}
                    placeholder="Short description"
                    onChange={(event) =>
                      updateRow(doc.documentTypeId, {
                        documentDescription: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="epc-doccard__foot">
                <div className="epc-doccard__file">
                  {doc.attached && doc.fileName ? (
                    <>
                      File: {doc.fileName}
                      {doc.url ? (
                        <>
                          {" · "}
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="epc-rowlink"
                          >
                            View
                          </a>
                        </>
                      ) : null}
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
                      disabled={isDownloading || isUploading}
                      onClick={() => handleDownloadForm(doc)}
                    >
                      <DownloadIcon size={15} />
                      {isDownloading ? "Preparing…" : "Download Form"}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    loading={isUploading}
                    disabled={isUploading || isDownloading}
                    onClick={() => handleUploadClick(doc.documentTypeId)}
                  >
                    <UploadArrowIcon size={15} />
                    {isUploading
                      ? "Uploading…"
                      : doc.attached
                        ? "Replace"
                        : "Upload"}
                  </Button>
                  {doc.attached ? (
                    <button
                      type="button"
                      className="epc-repeater__remove"
                      onClick={() => clearFile(doc.documentTypeId)}
                    >
                      Remove
                    </button>
                  ) : null}
                  <input
                    ref={(el) => {
                      fileRefs.current[key] = el;
                    }}
                    type="file"
                    className="epc-visually-hidden"
                    accept={APPLICATION_DOCUMENT_ACCEPT}
                    onChange={(event) =>
                      handleFileSelected(doc.documentTypeId, event)
                    }
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {uploadError ? (
        <p className="epc-field__error" role="alert">
          {uploadError}
        </p>
      ) : null}

      {downloadError ? (
        <p className="epc-field__error" role="alert">
          {downloadError}
        </p>
      ) : null}

      <StepNote title="How to complete these documents">
        For AQCTA declaration forms, download the pre-filled PDF, sign it
        manually, then upload the signed copy here. Other document types can be
        uploaded directly.
      </StepNote>
    </>
  );
}

/* Inspection — Technical & Commercial References --------------------------- */

/**
 * Document uploads from Application Document Types (serviceType: inspection).
 * Reference text + file upload per configured type, plus commercial references.
 */
export function InspectionTechnicalStep({
  documents = [],
  values,
  onChange,
  onDocumentsChange,
  loading = false,
  loadError = "",
  onDownloadForm,
}) {
  const fileRefs = useRef({});
  const [uploadingId, setUploadingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const updateRow = (documentTypeId, patch) => {
    onDocumentsChange?.(
      documents.map((row) =>
        String(row.documentTypeId) === String(documentTypeId)
          ? { ...row, ...patch }
          : row,
      ),
    );
  };

  const handleUploadClick = (documentTypeId) => {
    fileRefs.current[String(documentTypeId)]?.click();
  };

  const handleFileSelected = async (documentTypeId, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = getApplicationDocumentValidationError(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadingId(String(documentTypeId));
    setUploadError("");
    try {
      const uploaded = await uploadSupportingDocument(file);
      const current = documents.find(
        (d) => String(d.documentTypeId) === String(documentTypeId),
      );
      updateRow(documentTypeId, {
        ...uploaded,
        documentName:
          current?.documentName ||
          String(file.name || "")
            .replace(/\.[^.]+$/, "")
            .trim() ||
          current?.typeName ||
          "Reference",
        attached: true,
      });
    } catch (err) {
      setUploadError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload reference file.",
      );
    } finally {
      setUploadingId("");
    }
  };

  const clearFile = (documentTypeId) => {
    updateRow(documentTypeId, {
      attached: false,
      url: "",
      s3Key: "",
      fileName: "",
      file_type: "",
      file_size: 0,
    });
  };

  const handleDownloadForm = async (doc) => {
    if (!onDownloadForm) return;
    const key = String(doc.documentTypeId || doc.name);
    setDownloadingId(key);
    setDownloadError("");
    try {
      await onDownloadForm(doc);
    } catch (err) {
      setDownloadError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to download document.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <>
      <StepHeading
        title="Supporting Documents"
        subtitle="Download Form = pre-filled AQCTA-FOR-06-04 from application data. Upload = attach the signed/completed file for each type."
      />

      {loading ? (
        <p className="epc-placeholder__text">Loading document types…</p>
      ) : null}

      {loadError ? (
        <p className="epc-field__error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && !documents.length ? (
        <p className="epc-placeholder__text">
          No inspection document types are configured yet. Ask AQCTA to
          add them in Application Documents (Global Settings).
        </p>
      ) : null}

      {!loading && !loadError && documents.length > 0 ? (
        <div className="epc-scheduletable__scroll">
          <table className="epc-minitable epc-minitable--editable">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Download Form / Upload</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((row) => {
                const key = String(row.documentTypeId || row.name);
                const isUploading = uploadingId === key;
                const isDownloading = downloadingId === key;
                const showDownload = Boolean(
                  (row.hasTemplate || isInspectionApplicationForm(row)) &&
                    onDownloadForm,
                );
                const isAppForm = isInspectionApplicationForm(row);
                return (
                  <tr key={key}>
                    <td>
                      <input
                        className="epc-minitable__input"
                        type="text"
                        value={row.documentName || ""}
                        placeholder="e.g. GA Drawing Rev 3"
                        aria-label="Reference"
                        onChange={(event) =>
                          updateRow(row.documentTypeId, {
                            documentName: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <div>{row.typeName || row.name || "—"}</div>
                      {isAppForm ? (
                        <div className="epc-doclist__hint">
                          AQCTA-FOR-06-04
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="epc-docactions">
                        {showDownload ? (
                          <div className="epc-docactions__row">
                            <span className="epc-docactions__label">
                              Download Form
                            </span>
                            <button
                              type="button"
                              className="epc-rowlink"
                              title={
                                isAppForm
                                  ? "Download pre-filled AQCTA-FOR-06-04 with application data"
                                  : "Download form template"
                              }
                              onClick={() => handleDownloadForm(row)}
                              disabled={isDownloading || isUploading}
                            >
                              <DownloadIcon size={14} />{" "}
                              {isDownloading
                                ? "Preparing…"
                                : isAppForm
                                  ? "Pre-filled PDF"
                                  : "Form PDF"}
                            </button>
                          </div>
                        ) : null}
                        <div className="epc-docactions__row">
                          <span className="epc-docactions__label">Upload</span>
                          {row.attached && row.fileName ? (
                            <span className="epc-docactions__upload">
                              {row.url ? (
                                <a
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="epc-rowlink"
                                  title="View uploaded file"
                                >
                                  {row.fileName}
                                </a>
                              ) : (
                                <span className="epc-doclist__filename">
                                  {row.fileName}
                                </span>
                              )}
                              {" · "}
                              <button
                                type="button"
                                className="epc-rowlink"
                                onClick={() =>
                                  handleUploadClick(row.documentTypeId)
                                }
                                disabled={isUploading || isDownloading}
                              >
                                {isUploading ? "Uploading…" : "Replace"}
                              </button>
                              {" · "}
                              <button
                                type="button"
                                className="epc-rowlink"
                                onClick={() => clearFile(row.documentTypeId)}
                              >
                                Remove
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="epc-rowlink"
                              onClick={() =>
                                handleUploadClick(row.documentTypeId)
                              }
                              disabled={isUploading || isDownloading}
                            >
                              <UploadArrowIcon size={14} />{" "}
                              {isUploading
                                ? "Uploading…"
                                : isAppForm
                                  ? "Upload signed copy"
                                  : "Upload file"}
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        ref={(el) => {
                          fileRefs.current[key] = el;
                        }}
                        type="file"
                        className="epc-visually-hidden"
                        accept={APPLICATION_DOCUMENT_ACCEPT}
                        onChange={(event) =>
                          handleFileSelected(row.documentTypeId, event)
                        }
                      />
                    </td>
                    <td>
                      <StatusPill
                        status={row.attached ? "Attached" : "Missing"}
                        tone={row.attached ? "success" : "danger"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {uploadError ? (
        <p className="epc-field__error" role="alert">
          {uploadError}
        </p>
      ) : null}

      {downloadError ? (
        <p className="epc-field__error" role="alert">
          {downloadError}
        </p>
      ) : null}

      <StepNote title="Download Form vs Upload">
        For <strong>Application for Engineering Inspection</strong>, use{" "}
        <strong>Download Form → Pre-filled PDF</strong> to get AQCTA-FOR-06-04
        with wizard data filled in. Sign that PDF, then use{" "}
        <strong>Upload signed copy</strong> on the same row. Other types only
        need an upload (drawings, specs, standards, etc.).
      </StepNote>

      <div className="epc-stepnote">
        <p className="epc-stepnote__title">Commercial References</p>
        <p className="epc-stepnote__body">
          Link the customer commercial documents where applicable.
        </p>
      </div>

      <FormGrid>
        <TextField
          label="Purchase Order / Letter of Award"
          name="purchaseOrder"
          placeholder="e.g. PO-2026-4481"
          value={values.purchaseOrder || ""}
          onChange={(event) => onChange?.("purchaseOrder", event.target.value)}
        />
        <TextField
          label="Quotation Reference"
          name="quotationReference"
          placeholder="e.g. QT-2026-081"
          value={values.quotationReference || ""}
          onChange={(event) =>
            onChange?.("quotationReference", event.target.value)
          }
        />
        <TextField
          label="Enclosed sum (RM)"
          name="paymentAmount"
          placeholder="e.g. 12500.00"
          value={values.paymentAmount || ""}
          onChange={(event) => onChange?.("paymentAmount", event.target.value)}
        />
      </FormGrid>

      <StepNote>
        Commercial references are recorded for traceability and billing linkage;
        they do not replace the technical inspection scope.
      </StepNote>
    </>
  );
}

/* Shared — Review & Submit ------------------------------------------------- */

function ReviewFieldList({ fields = [] }) {
  if (!fields.length) {
    return <p className="epc-reviewsection__empty">No details provided.</p>;
  }
  return (
    <dl className="epc-reviewfields">
      {fields.map((field) => (
        <div className="epc-reviewfields__row" key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewTable({ columns = [], rows = [] }) {
  if (!rows.length) {
    return <p className="epc-reviewsection__empty">No rows added.</p>;
  }
  return (
    <div className="epc-scheduletable__scroll">
      <table className="epc-minitable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col}>{col.label || col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((col) => {
                const key = col.key || col;
                return <td key={key}>{row[key] || "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewMediaGrid({ items = [] }) {
  if (!items.length) {
    return <p className="epc-reviewsection__empty">No process flows attached.</p>;
  }
  return (
    <ul className="epc-reviewmedia">
      {items.map((item) => {
        const label = item.flowName || item.name || "Process flow";
        const isImage = String(item.file_type || "").startsWith("image/");
        return (
          <li className="epc-reviewmedia__item" key={item.id || item.url || label}>
            {item.url && isImage ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="epc-reviewmedia__thumb"
              >
                <img src={item.url} alt={label} />
              </a>
            ) : (
              <div className="epc-reviewmedia__file">{item.name || "File"}</div>
            )}
            <div className="epc-reviewmedia__meta">
              <p className="epc-reviewmedia__name">{label}</p>
              {item.name && item.flowName ? (
                <p className="epc-reviewmedia__filemeta">{item.name}</p>
              ) : null}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="epc-rowlink"
                >
                  View
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewCheckpoints({ checkpoints = [] }) {
  if (!checkpoints.length) {
    return <p className="epc-reviewsection__empty">No process flows added.</p>;
  }
  return (
    <div className="epc-reviewqc">
      {checkpoints.map((cp, index) => (
        <div className="epc-reviewqc__item" key={cp.id || index}>
          <p className="epc-reviewqc__title">
            {cp.title || `Process Flow ${index + 1}`}
          </p>
          {cp.description ? (
            <p className="epc-reviewqc__desc">{cp.description}</p>
          ) : null}
          {(cp.documents || []).length > 0 ? (
            <ul className="epc-reviewdocs epc-reviewdocs--nested">
              {(cp.documents || []).map((doc) => (
                <li key={doc.id || doc.url || doc.name}>
                  <span>{doc.name || "Document"}</span>
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="epc-rowlink"
                    >
                      View
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="epc-reviewsection__empty">No documents on this process flow.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewDocuments({ documents = [] }) {
  if (!documents.length) {
    return <p className="epc-reviewsection__empty">No items added.</p>;
  }
  return (
    <ul className="epc-reviewdocs">
      {documents.map((doc) => (
        <li
          key={
            doc.referenceTypeId ||
            doc.documentTypeId ||
            doc.typeName ||
            doc.name
          }
        >
          <div>
            <p className="epc-reviewdocs__type">{doc.typeName || doc.name}</p>
            <p className="epc-reviewdocs__meta">
              {doc.requirement}
              {doc.attached ? " · Attached" : " · Missing"}
            </p>
            {doc.documentName ? (
              <p className="epc-reviewdocs__meta">Name: {doc.documentName}</p>
            ) : null}
            {doc.documentDescription ? (
              <p className="epc-reviewdocs__meta">
                Description: {doc.documentDescription}
              </p>
            ) : null}
            {doc.attached && doc.fileName ? (
              <p className="epc-reviewdocs__meta">File: {doc.fileName}</p>
            ) : null}
          </div>
          <div className="epc-reviewdocs__side">
            <StatusPill
              status={doc.attached ? "Attached" : "Missing"}
              tone={doc.attached ? "success" : "danger"}
            />
            {doc.attached && doc.url ? (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="epc-rowlink"
              >
                View
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Full application review — summary fields, tables, images and documents.
 * `sections` drives rich content; legacy `summary` still works as field rows.
 */
export function ReviewStep({
  summary = [],
  sections = [],
  declaration,
  agreed,
  onAgree,
  onEdit,
}) {
  const blocks =
    sections.length > 0
      ? sections
      : summary.map((entry) => ({
          title: entry.label,
          step: entry.step,
          fields: [{ label: entry.label, value: entry.value }],
        }));

  return (
    <>
      <StepHeading
        title="Application Review"
        subtitle="Confirm the submitted information, uploads and formal declaration."
      />

      <div className="epc-reviewsections">
        {blocks.map((section) => (
          <section
            className="epc-reviewsection"
            key={`${section.title}-${section.step}`}
          >
            <header className="epc-reviewsection__head">
              <h3 className="epc-reviewsection__title">{section.title}</h3>
              {typeof section.step === "number" ? (
                <button
                  type="button"
                  className="epc-rowlink"
                  onClick={() => onEdit?.(section.step)}
                >
                  Edit
                </button>
              ) : null}
            </header>

            {section.fields ? <ReviewFieldList fields={section.fields} /> : null}
            {section.table ? (
              <ReviewTable
                columns={section.table.columns}
                rows={section.table.rows}
              />
            ) : null}
            {section.media ? <ReviewMediaGrid items={section.media} /> : null}
            {section.checkpoints ? (
              <ReviewCheckpoints checkpoints={section.checkpoints} />
            ) : null}
            {section.documents ? (
              <ReviewDocuments documents={section.documents} />
            ) : null}
            {section.body ? (
              <p className="epc-reviewsection__body">{section.body}</p>
            ) : null}
          </section>
        ))}
      </div>

      <div className="epc-declaration">
        <p className="epc-declaration__title">Declaration &amp; Undertaking</p>
        <p className="epc-declaration__body">{declaration}</p>
        <label className="epc-declaration__agree epc-checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => onAgree?.(event.target.checked)}
          />
          <span className="epc-checkbox__box" aria-hidden="true" />
          I agree to the declaration and undertaking.
        </label>
      </div>
    </>
  );
}
