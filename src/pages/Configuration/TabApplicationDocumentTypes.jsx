import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Building, FileText, Inbox, Eye, Upload, Trash2 } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  SummaryCards,
  CustomModal,
  ToggleSwitch,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import ApplicationDocumentTypeServices from "@/services/applicationDocumentTypeService";
import { downloadAxiosBlob } from "@/utils/certificationFormData";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import useButtonColor from "@/hooks/useButtonColor";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import {
  APPLICATION_DOCUMENT_ACCEPT,
  getApplicationDocumentValidationError,
} from "@/utils/applicationDocumentFiles";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EMPTY_FORM = {
  name: "",
  description: "",
  requirement: "Required",
  serviceType: "certification",
  status: "Active",
  sortOrder: 0,
  business: "",
};

const REQUIREMENT_STYLES = {
  Required: "bg-red-100 text-red-800",
  Conditional: "bg-amber-100 text-amber-800",
  Optional: "bg-gray-100 text-gray-800",
};

const TABLE_COL_WIDTHS = {
  Name: "38%",
  Requirement: "110px",
  Service: "120px",
  Order: "70px",
  Status: "130px",
  Actions: "140px",
};

const hasCustomTemplateFile = (row) => {
  const file = row?.templateFile;
  return Boolean(file?.s3Key || file?.url);
};

const uploadFileToS3 = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("file_name", file.name);
  const res = await axios.post(`${Base_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const s3Key = res.data?.s3Key || "";
  const url = res.data?.url || "";
  if (!s3Key && !url) {
    throw new Error(res.data?.message || "Upload did not return a file");
  }
  return {
    url,
    s3Key,
    fileName: file.name,
    file_type: file.type || "",
    file_size: file.size || 0,
  };
};

/**
 * Global Settings → Application Document Types
 * Layout matches admin list pages (e.g. /enquiries).
 */
export default function TabApplicationDocumentTypes() {
  const buttonColor = useButtonColor();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    required: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [removeExistingTemplate, setRemoveExistingTemplate] = useState(false);
  const [removeDocModalOpen, setRemoveDocModalOpen] = useState(false);
  const [rowToRemoveDoc, setRowToRemoveDoc] = useState(null);
  const [removeDocLoading, setRemoveDocLoading] = useState(false);
  const [modalViewLoading, setModalViewLoading] = useState(false);
  const fileInputRef = useRef(null);
  const modalFileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const headers = [
    "Name",
    "Requirement",
    "Service",
    "Order",
    "Status",
    "Actions",
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list || []);
      if (list?.length === 1) {
        setBusinessId(String(list[0]._id || list[0].id || ""));
      } else if (list?.length) {
        setBusinessId(String(list[0]._id || list[0].id || ""));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStats = async () => {
    if (!businessId) {
      setStats({ total: 0, active: 0, inactive: 0, required: 0 });
      return;
    }
    try {
      const res = await axios.get(`${Base_URL}/application-document-types`, {
        params: {
          businessIds: JSON.stringify([businessId]),
          serviceType: "all",
          limit: 200,
        },
      });
      const all = Array.isArray(res?.data?.data) ? res.data.data : [];
      setStats({
        total: all.length,
        active: all.filter((r) => r.status === "Active").length,
        inactive: all.filter((r) => r.status === "Inactive").length,
        required: all.filter((r) => r.requirement === "Required").length,
      });
    } catch {
      /* keep prior stats */
    }
  };

  const load = async () => {
    if (!businessId) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/application-document-types`, {
        params: {
          businessIds: JSON.stringify([businessId]),
          serviceType: serviceFilter || "all",
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchTerm || undefined,
          page: currentPage,
          limit: recordsPerPage,
        },
      });
      setRows(Array.isArray(res?.data?.data) ? res.data.data : []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      notifyError(
        err?.response?.data?.message || "Failed to load document types"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, serviceFilter, statusFilter, currentPage, recordsPerPage]);

  useEffect(() => {
    if (!businessId) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      load();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setPendingFile(null);
    setRemoveExistingTemplate(false);
    setForm({ ...EMPTY_FORM, business: businessId });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    if (!canUpdate) return;
    setEditing(row);
    setErrors({});
    setPendingFile(null);
    setRemoveExistingTemplate(false);
    setForm({
      name: row.name || "",
      description: row.description || "",
      requirement: row.requirement || "Required",
      serviceType: row.serviceType || "certification",
      status: row.status || "Active",
      sortOrder: row.sortOrder ?? 0,
      business: String(row.business || businessId),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setPendingFile(null);
    setRemoveExistingTemplate(false);
    setModalViewLoading(false);
    setErrors({});
  };

  const handleRemoveDocumentInModal = () => {
    if (pendingFile) {
      setPendingFile(null);
      return;
    }
    if (editing && hasCustomTemplateFile(editing)) {
      setRemoveExistingTemplate(true);
    }
  };

  const handleModalFileSelected = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      setPendingFile(null);
      return;
    }
    const validationError = getApplicationDocumentValidationError(file);
    if (validationError) {
      notifyError(validationError);
      setPendingFile(null);
      return;
    }
    setPendingFile(file);
    setRemoveExistingTemplate(false);
  };

  const handleModalViewDocument = async () => {
    if (pendingFile) {
      const url = URL.createObjectURL(pendingFile);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    if (!editing?.hasTemplate) return;
    setModalViewLoading(true);
    try {
      await handleDownload(editing);
    } finally {
      setModalViewLoading(false);
    }
  };

  const getModalDocumentLabel = () => {
    if (pendingFile) return pendingFile.name;
    if (removeExistingTemplate) return "Document will be removed on save";
    if (hasCustomTemplateFile(editing)) {
      return editing.templateFile.fileName;
    }
    if (editing?.hasTemplate) {
      return editing.templateFile?.fileName || `${editing.name || "Document"} (built-in form)`;
    }
    return null;
  };

  const canManageModalDocument = !editing?.isLocked;
  const modalHasViewableDocument =
    Boolean(pendingFile) ||
    (!removeExistingTemplate &&
      Boolean(editing?.hasTemplate || hasCustomTemplateFile(editing)));
  const modalCanRemoveDocument =
    canManageModalDocument &&
    (Boolean(pendingFile) ||
      (Boolean(editing) &&
        hasCustomTemplateFile(editing) &&
        !removeExistingTemplate));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.form) {
      setErrors((prev) => ({ ...prev, [name]: "", form: "" }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrors({ name: "Document type name is required" });
      return;
    }
    if (!form.business) {
      setErrors({ form: "Business is required" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: String(form.description || "").trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (
        editing?._id &&
        removeExistingTemplate &&
        !pendingFile &&
        hasCustomTemplateFile(editing)
      ) {
        payload.templateFile = null;
      }
      let saved = editing;
      if (editing?._id) {
        const res = await axios.put(
          `${Base_URL}/application-document-types/${editing._id}`,
          payload
        );
        saved = res?.data?.data || editing;
        notifySuccess("Document type updated");
      } else {
        const res = await axios.post(
          `${Base_URL}/application-document-types`,
          payload
        );
        saved = res?.data?.data;
        notifySuccess("Document type created");
      }

      if (pendingFile && saved?._id && !saved.isLocked) {
        const templateFile = await uploadFileToS3(pendingFile);
        await axios.put(
          `${Base_URL}/application-document-types/${saved._id}`,
          { templateFile }
        );
      }

      setModalOpen(false);
      setEditing(null);
      setPendingFile(null);
      setRemoveExistingTemplate(false);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      setErrors({
        form: err?.response?.data?.message || "Failed to save document type",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    if (!canUpdate) return;
    const next = row.status === "Active" ? "Inactive" : "Active";
    try {
      await axios.patch(
        `${Base_URL}/application-document-types/${row._id}/status`,
        { status: next }
      );
      notifySuccess(`Marked ${next}`);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to update status");
    }
  };

  const canDeleteRow = (row) => canDelete && !row?.isLocked;
  const canUploadTemplate = (row) => canUpdate && Boolean(row) && !row.isLocked;

  const handleDownload = async (row) => {
    if (!row?.hasTemplate) return;
    setDownloadingId(String(row._id));
    try {
      const res = await ApplicationDocumentTypeServices.downloadForm({
        documentTypeId: row._id,
        templateKey: row.templateKey,
      });
      const fallback =
        row.templateFile?.fileName || `${row.name || "document"}.pdf`;
      downloadAxiosBlob(res, fallback);
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to download document"
      );
    } finally {
      setDownloadingId("");
    }
  };

  const handleUploadClick = (row) => {
    if (!canUploadTemplate(row)) return;
    uploadTargetRef.current = row;
    fileInputRef.current?.click();
  };

  const openRemoveDocModal = (row) => {
    if (!canUploadTemplate(row) || !hasCustomTemplateFile(row)) return;
    setRowToRemoveDoc(row);
    setRemoveDocModalOpen(true);
  };

  const closeRemoveDocModal = () => {
    if (removeDocLoading) return;
    setRemoveDocModalOpen(false);
    setRowToRemoveDoc(null);
  };

  const confirmRemoveDocument = async () => {
    if (!rowToRemoveDoc?._id) return;
    setRemoveDocLoading(true);
    try {
      await axios.put(
        `${Base_URL}/application-document-types/${rowToRemoveDoc._id}`,
        { templateFile: null }
      );
      notifySuccess("Document removed");
      setRemoveDocModalOpen(false);
      setRowToRemoveDoc(null);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to remove document"
      );
    } finally {
      setRemoveDocLoading(false);
    }
  };

  const handleTemplateFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const row = uploadTargetRef.current;
    uploadTargetRef.current = null;
    if (!file || !row?._id) return;

    const validationError = getApplicationDocumentValidationError(file);
    if (validationError) {
      notifyError(validationError);
      return;
    }

    setUploadingId(String(row._id));
    try {
      const templateFile = await uploadFileToS3(file);
      await axios.put(
        `${Base_URL}/application-document-types/${row._id}`,
        { templateFile }
      );
      notifySuccess("Document uploaded");
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload document"
      );
    } finally {
      setUploadingId("");
    }
  };

  const openDeleteModal = (row) => {
    if (!canDeleteRow(row)) return;
    setRowToDelete(row);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setRowToDelete(null);
  };

  const confirmDelete = async () => {
    if (!rowToDelete?._id) return;
    try {
      setDeleteLoading(true);
      await axios.delete(
        `${Base_URL}/application-document-types/${rowToDelete._id}`
      );
      notifySuccess("Document type deleted");
      setDeleteModalOpen(false);
      setRowToDelete(null);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setServiceFilter("all");
    setStatusFilter("all");
    setBusinessId(
      businesses.length === 1
        ? String(businesses[0]._id || businesses[0].id || "")
        : businessId
    );
    setCurrentPage(1);
  };

  const filters = useMemo(
    () => [
      {
        isClearButton: true,
        buttonProps: { onClick: clearAllFilters },
      },
      ...(!isSingleAssignedBusiness()
        ? [
            {
              label: "Business",
              value: businessId,
              onChange: (value) => {
                setBusinessId(value);
                setCurrentPage(1);
              },
              options: businesses.map((b) => ({
                value: String(b._id || b.id || ""),
                label: b.name || b.businessName || "Business",
              })),
              placeholder: "Select Business",
              icon: Building,
            },
          ]
        : []),
      {
        label: "Service",
        value: serviceFilter,
        onChange: (value) => {
          setServiceFilter(value);
          setCurrentPage(1);
        },
        options: [
          { value: "all", label: "All Services" },
          { value: "certification", label: "Certification" },
          { value: "inspection", label: "Inspection" },
        ],
        placeholder: "Select Service",
        icon: Inbox,
      },
      {
        label: "Status",
        value: statusFilter,
        onChange: (value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        },
        options: [
          { value: "all", label: "All Status" },
          { value: "Active", label: "Active" },
          { value: "Inactive", label: "Inactive" },
        ],
        placeholder: "Select Status",
        icon: FileText,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessId, businesses, serviceFilter, statusFilter]
  );

  const summaryCardsData = [
    {
      title: "Total Types",
      value: stats.total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Active",
      value: stats.active || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Inactive",
      value: stats.inactive || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Required",
      value: stats.required || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
  ];

  const serviceLabel = (value) => {
    if (value === "certification") return "Certification";
    if (value === "inspection") return "Inspection";
    return value || "-";
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Application Document Types
            </h2>
            <p className="text-gray-600 mt-2">
              Configure supporting documents shown on customer certification /
              inspection applications.
            </p>
          </div>
          {canAdd ? (
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                style={{ backgroundColor: buttonColor }}
              >
                Add Document Type
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <SummaryCards cards={summaryCardsData} columnsCount={4} />

      <DataTable
        onSearch={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        searchValue={searchTerm}
        searchPlaceholder="Search by document type name…"
        filters={filters}
        headers={headers}
        headersToHide={[]}
        colWidths={TABLE_COL_WIDTHS}
        skipDynamicColumnWidths
        headersWithoutCellTooltip={["Name", "Actions"]}
        data={rows}
        totalRecords={total}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={setCurrentPage}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          setCurrentPage(1);
        }}
        emptyMessage="No document types found"
        isCollapsible={false}
        renderRow={(row) => (
          <tr key={row._id} className="border-b">
            <td className="py-2 px-4 min-w-0 align-middle">
              <div
                className="font-medium text-gray-900 whitespace-normal break-words leading-snug"
                title={row.name || ""}
              >
                {row.name || "-"}
              </div>
              {row.description ? (
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {row.description}
                </div>
              ) : null}
              {row.templateFile?.fileName ? (
                <div
                  className="text-xs text-blue-600 mt-0.5 truncate"
                  title={row.templateFile.fileName}
                >
                  File: {row.templateFile.fileName}
                </div>
              ) : null}
            </td>
            <td className="py-2 px-4 whitespace-nowrap">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  REQUIREMENT_STYLES[row.requirement] ||
                  "bg-gray-100 text-gray-800"
                }`}
              >
                {row.requirement || "-"}
              </span>
            </td>
            <td className="py-2 px-4 whitespace-nowrap">
              {serviceLabel(row.serviceType)}
            </td>
            <td className="py-2 px-4 whitespace-nowrap">{row.sortOrder ?? 0}</td>
            <td className="py-2 px-4 whitespace-nowrap">
              {canUpdate ? (
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    isOn={row.status === "Active"}
                    handleToggle={() => handleToggleStatus(row)}
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-600">
                    {row.status || "-"}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-600">
                  {row.status || "-"}
                </span>
              )}
            </td>
            <td className="py-2 px-4 whitespace-nowrap">
              <ActionButtons
                maxVisibleActions={2}
                items={[
                  ...(canUpdate
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.EDIT,
                          title: "Edit",
                          onClick: () => openEdit(row),
                        },
                      ]
                    : []),
                  ...(row.hasTemplate
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.DOWNLOAD,
                          title:
                            downloadingId === String(row._id)
                              ? "Downloading…"
                              : "Download document",
                          onClick: () => handleDownload(row),
                          disabled:
                            downloadingId === String(row._id) ||
                            uploadingId === String(row._id),
                          loading: downloadingId === String(row._id),
                        },
                      ]
                    : canUploadTemplate(row)
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.UPLOAD,
                            title: "Upload document",
                            onClick: () => handleUploadClick(row),
                            disabled:
                              downloadingId === String(row._id) ||
                              uploadingId === String(row._id) ||
                              removeDocLoading,
                            loading: uploadingId === String(row._id),
                          },
                        ]
                      : []),
                  ...(canUploadTemplate(row) && row.hasTemplate
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.UPLOAD,
                          title: "Replace document",
                          onClick: () => handleUploadClick(row),
                          disabled:
                            downloadingId === String(row._id) ||
                            uploadingId === String(row._id) ||
                            removeDocLoading,
                          loading: uploadingId === String(row._id),
                        },
                      ]
                    : []),
                  ...(canUploadTemplate(row) && hasCustomTemplateFile(row)
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.REMOVE_FILE,
                          title: "Remove document",
                          onClick: () => openRemoveDocModal(row),
                          disabled:
                            downloadingId === String(row._id) ||
                            uploadingId === String(row._id) ||
                            removeDocLoading,
                          loading:
                            removeDocLoading &&
                            rowToRemoveDoc?._id === row._id,
                        },
                      ]
                    : []),
                  ...(canDeleteRow(row)
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.DELETE,
                          title: "Delete",
                          onClick: () => openDeleteModal(row),
                        },
                      ]
                    : []),
                ]}
              />
            </td>
          </tr>
        )}
      />

      <CustomModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Document Type" : "Add Document Type"}
        width="560px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeModal,
            disabled: saving,
          },
          {
            label: saving ? "Saving…" : "Save",
            primary: true,
            onClick: handleSave,
            disabled: saving,
            style: { backgroundColor: buttonColor },
          },
        ]}
      >
        <div className="space-y-4 text-sm">
          {errors.form ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
              {errors.form}
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)] ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter document type name"
            />
            {errors.name ? (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document file
            </label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              {getModalDocumentLabel() ? (
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      removeExistingTemplate ? "text-amber-600" : "text-gray-700"
                    }`}
                    title={getModalDocumentLabel()}
                  >
                    {getModalDocumentLabel()}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {modalHasViewableDocument ? (
                      <button
                        type="button"
                        onClick={handleModalViewDocument}
                        disabled={modalViewLoading || saving}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {modalViewLoading ? "Opening…" : "View"}
                      </button>
                    ) : null}
                    {modalCanRemoveDocument ? (
                      <button
                        type="button"
                        onClick={handleRemoveDocumentInModal}
                        disabled={saving}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {canManageModalDocument
                    ? "No document uploaded yet."
                    : "No custom document uploaded."}
                </p>
              )}

              {canManageModalDocument ? (
                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {pendingFile ||
                  (editing &&
                    (hasCustomTemplateFile(editing) || editing.hasTemplate) &&
                    !removeExistingTemplate)
                    ? "Replace file"
                    : "Upload file"}
                </button>
              ) : editing?.hasTemplate ? (
                <p className="text-xs text-gray-500">
                  Built-in certification form. You can view it but cannot replace
                  or remove it here.
                </p>
              ) : null}

              {!getModalDocumentLabel() && canManageModalDocument ? (
                <p className="text-xs text-gray-500">
                  Optional. Customers can download this file when creating an
                  application.
                </p>
              ) : null}
            </div>
            <input
              ref={modalFileInputRef}
              type="file"
              accept={APPLICATION_DOCUMENT_ACCEPT}
              onChange={handleModalFileSelected}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              value={form.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
              placeholder="Optional help text for the customer portal"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requirement
              </label>
              <select
                name="requirement"
                value={form.requirement}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="Required">Required</option>
                <option value="Conditional">Conditional</option>
                <option value="Optional">Optional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service
              </label>
              <select
                name="serviceType"
                value={form.serviceType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="certification">Certification</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort order
              </label>
              <input
                type="number"
                name="sortOrder"
                value={form.sortOrder}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="flex items-center gap-2 mt-2">
                <ToggleSwitch
                  isOn={form.status === "Active"}
                  handleToggle={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: prev.status === "Active" ? "Inactive" : "Active",
                    }))
                  }
                />
                <span className="text-sm text-gray-700">
                  {form.status === "Active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        open={removeDocModalOpen}
        onClose={closeRemoveDocModal}
        title="Remove Document"
        width="440px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeRemoveDocModal,
            disabled: removeDocLoading,
          },
          {
            label: removeDocLoading ? "Removing…" : "Remove",
            failure: true,
            disabled: removeDocLoading,
            onClick: confirmRemoveDocument,
          },
        ]}
      >
        {rowToRemoveDoc ? (
          <p className="text-sm text-gray-700">
            Remove the uploaded document for{" "}
            <span className="font-semibold">
              {rowToRemoveDoc.name || "-"}
            </span>
            ? The document type will stay; only the file will be deleted.
          </p>
        ) : null}
      </CustomModal>

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Document Type"
        width="440px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: closeDeleteModal,
            disabled: deleteLoading,
          },
          {
            label: deleteLoading ? "Deleting…" : "Delete",
            failure: true,
            disabled: deleteLoading,
            onClick: confirmDelete,
          },
        ]}
      >
        {rowToDelete ? (
          <p className="text-sm text-gray-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{rowToDelete.name || "-"}</span>?
            This action cannot be undone.
          </p>
        ) : null}
      </CustomModal>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={APPLICATION_DOCUMENT_ACCEPT}
        onChange={handleTemplateFileSelected}
      />
    </div>
  );
}
