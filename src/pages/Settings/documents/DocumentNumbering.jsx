import { useState, useEffect, useContext, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { Plus, Trash2, Edit2, Save, X, Eye } from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import { AdminContext } from "@/context/AdminContext";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  getDocumentSequences,
  saveDocumentSequence,
  updateDocumentSequence,
  deleteDocumentSequence,
  previewDocumentSequence,
} from "@/services/documentSequenceServices";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const buildDocumentTypes = (getModuleLabel) => [
  { value: "invoice", label: () => getModuleLabel("invoice", "Invoice") },
  { value: "quotation", label: () => getModuleLabel("quotation", "Quotation") },
  { value: "purchase_order", label: () => getModuleLabel("purchaseOrder", "Purchase Order") },
  { value: "sales_order", label: () => getModuleLabel("saleOrder", "Sale Order") },
  { value: "bill", label: () => getModuleLabel("vendorInvoice", "Vendor Invoice") },
  { value: "recurring_invoice", label: () => getModuleLabel("recurringInvoice", "Recurring Invoice") },
  { value: "job", label: () => getModuleLabel("job", "Job") },
  { value: "payment_received", label: () => "Payment Received" },
  { value: "vendor_payment", label: () => "Vendor Payment" },
];

const LEVEL_OPTIONS = [
  { value: "business_group", label: "Business Group Level" },
  { value: "business", label: "Business Level" },
];

const formatDocumentNumber = (prefix, number, padding) => {
  if (!prefix) return "-";
  return `${prefix}-${String(number || 1).padStart(Number(padding) || 6, "0")}`;
};

// ─── Branch Row ───────────────────────────────────────────────────────────────
const BranchRow = ({ branch, sequence, onSave, onDelete, canUpdate, canDelete }) => {
  const [prefix, setPrefix] = useState(sequence?.prefix || "");
  const [startingNumber, setStartingNumber] = useState(
    sequence?.runningNumber || 1
  );
  const [padding, setPadding] = useState(sequence?.padding || 6);
  const [enabled, setEnabled] = useState(sequence ? sequence.isActive : false);
  const [saving, setSaving] = useState(false);

  const preview = formatDocumentNumber(prefix, startingNumber, padding);

  const handleSave = async () => {
    if (!canUpdate) return;
    if (!prefix) {
      notifyError("Prefix is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(branch, { prefix, startingNumber, padding, enabled });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    if (sequence?._id) {
      await onDelete(sequence._id);
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      {/* Enable */}
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={!canUpdate}
          className="w-4 h-4 accent-[#A6C437] cursor-pointer disabled:cursor-not-allowed"
        />
      </td>
      {/* Branch Name */}
      <td className="px-4 py-3 text-sm font-medium text-gray-800">
        {branch.name}
      </td>
      {/* Prefix */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          placeholder="e.g. INV"
          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
          disabled={!enabled || !canUpdate}
        />
      </td>
      {/* Starting Number */}
      <td className="px-4 py-3">
        <input
          type="number"
          value={startingNumber}
          min={1}
          onChange={(e) => setStartingNumber(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
          disabled={!enabled || !canUpdate}
        />
      </td>
      {/* Padding */}
      <td className="px-4 py-3">
        <select
          value={padding}
          onChange={(e) => setPadding(parseInt(e.target.value))}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
          disabled={!enabled || !canUpdate}
        >
          {[4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n} digits
            </option>
          ))}
        </select>
      </td>
      {/* Preview */}
      <td className="px-4 py-3">
        <span className="inline-block bg-gray-100 text-gray-700 font-mono text-xs px-2 py-1 rounded">
          {enabled ? preview : "—"}
        </span>
      </td>
      {/* Actions */}
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          {canUpdate && (
            <button
              onClick={handleSave}
              disabled={saving || !enabled}
              title="Save"
              className="text-[#A6C437] hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="text-xs">...</span>
              ) : (
                <Save className="w-4 h-4" />
              )}
            </button>
          )}
          {canDelete && sequence?._id && (
            <button
              onClick={handleDelete}
              title="Delete"
              className="text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// Linked document types that can inherit numbers FROM this document type
const LINKABLE_DOC_TYPES = [
  { value: "invoice", label: "Invoice" },
  { value: "job", label: "Job" },
  { value: "payment_received", label: "Payment Received" },
  { value: "vendor_payment", label: "Vendor Payment" },
];

// ─── Group Level Form ─────────────────────────────────────────────────────────
const GroupLevelForm = ({
  documentType,
  businessGroupId,
  existingSequence,
  onSave,
  onDelete,
  getModuleLabel,
  canUpdate,
  canDelete,
}) => {
  const [prefix, setPrefix] = useState(existingSequence?.prefix || "");
  const [startingNumber, setStartingNumber] = useState(
    existingSequence?.runningNumber || 1
  );
  const [padding, setPadding] = useState(existingSequence?.padding || 6);
  const [isActive, setIsActive] = useState(
    existingSequence ? existingSequence.isActive : true
  );
  const [saving, setSaving] = useState(false);

  // New: Linked document inheritance settings
  const [inheritSourceNumber, setInheritSourceNumber] = useState(
    existingSequence?.inheritSourceNumber || false
  );
  const [linkedDocTypes, setLinkedDocTypes] = useState(
    existingSequence?.linkedDocTypes || []
  );

  const preview = formatDocumentNumber(prefix, startingNumber, padding);

  const handleSave = async () => {
    if (!canUpdate) return;
    if (!prefix) {
      notifyError("Prefix is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        prefix,
        startingNumber,
        padding,
        isActive,
        inheritSourceNumber,
        linkedDocTypes,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleLinkedDocType = (docType) => {
    if (!canUpdate) return;
    setLinkedDocTypes((prev) =>
      prev.includes(docType)
        ? prev.filter((d) => d !== docType)
        : [...prev, docType]
    );
  };

  return (
    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Prefix
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="e.g. INV"
            readOnly={!canUpdate}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Starting Number
          </label>
          <input
            type="number"
            value={startingNumber}
            min={1}
            onChange={(e) =>
              setStartingNumber(Math.max(1, parseInt(e.target.value) || 1))
            }
            readOnly={!canUpdate}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Padding (digits)
          </label>
          <select
            value={padding}
            onChange={(e) => setPadding(parseInt(e.target.value))}
            disabled={!canUpdate}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
          >
            {[4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} digits
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Preview
          </label>
          <span className="inline-block bg-white border border-gray-200 text-gray-700 font-mono text-sm px-3 py-2 rounded w-full">
            {prefix ? preview : "—"}
          </span>
        </div>
      </div>

      {/* Linked Document Same Sequence Options */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <label className="flex items-center gap-2 text-sm text-gray-700 font-medium mb-2">
          <input
            type="checkbox"
            checked={inheritSourceNumber}
            onChange={(e) => {
              if (!canUpdate) return;
              setInheritSourceNumber(e.target.checked);
              if (!e.target.checked) setLinkedDocTypes([]);
            }}
            disabled={!canUpdate}
            className="w-4 h-4 accent-[#A6C437] disabled:cursor-not-allowed"
          />
          Linked Document Same Sequence
        </label>
        <p className="text-xs text-gray-500 mb-3">
          When enabled, linked documents created from this document will reuse the same number.
          For example, an Invoice created from a Sales Order will use the Sales Order's number.
        </p>

        {inheritSourceNumber && (
          <div className="bg-gray-50 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Allow these document types to inherit number from this:
            </label>
            <div className="flex flex-wrap gap-2">
              {LINKABLE_DOC_TYPES.map((doc) => (
                <label
                  key={doc.value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
                    linkedDocTypes.includes(doc.value)
                      ? "bg-[#A6C437]/10 border-[#A6C437] text-gray-800"
                      : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={linkedDocTypes.includes(doc.value)}
                    onChange={() => toggleLinkedDocType(doc.value)}
                    className="w-3 h-3 accent-[#A6C437]"
                  />
                  {doc.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={!canUpdate}
            className="w-4 h-4 accent-[#A6C437] disabled:cursor-not-allowed"
          />
          Active
        </label>
        <div className="flex gap-2">
          {canDelete && existingSequence?._id && (
            <button
              onClick={() => onDelete(existingSequence._id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 border border-red-300 rounded hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          {canUpdate && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-4 py-1.5 text-sm bg-[#A6C437] text-white rounded hover:bg-[#93ae2c] disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : existingSequence ? "Update" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const DocumentNumbering = () => {
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const { getModuleLabel } = useModuleLabels();
  const DOCUMENT_TYPES = buildDocumentTypes(getModuleLabel);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const location = useLocation();

  const [businessId, setBusinessId] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [sequences, setSequences] = useState([]);

  const [selectedDocType, setSelectedDocType] = useState("invoice");
  const [selectedLevel, setSelectedLevel] = useState("business");
  const [loading, setLoading] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // ── Read selectedOrg from URL ──
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const org = params.get("selectedOrg");
    if (org) setBusinessId(org);
  }, [location.search]);

  // ── Fetch business info (to get businessGroupId + siblings) ──
  useEffect(() => {
    if (!businessId) return;

    const fetchBusiness = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/Business/${businessId}`, {
          headers,
        });
        setBusinessInfo(res.data);

        // Fetch all businesses in the same group
        if (res.data?.businessGroup) {
          const groupRes = await axios.post(
            `${BASE_URL}/Business/getALL`,
            { businessGroup: res.data.businessGroup },
            { headers }
          );
          const list = Array.isArray(groupRes.data)
            ? groupRes.data
            : groupRes.data?.data || [];
          setBranches(list.filter((b) => b.status !== "Inactive"));
        }
      } catch (err) {
        console.error("Error fetching business info:", err);
      }
    };

    fetchBusiness();
  }, [businessId]);

  // ── Fetch sequences ──
  const fetchSequences = useCallback(async () => {
    if (!businessInfo) return;
    setLoading(true);
    try {
      const params = {
        businessGroupId: businessInfo.businessGroup,
        documentType: selectedDocType,
      };
      const res = await getDocumentSequences(params);
      setSequences(res.data || []);
    } catch (err) {
      console.error("Error fetching sequences:", err);
    } finally {
      setLoading(false);
    }
  }, [businessInfo, selectedDocType]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  // ── Helpers ──
  const getSequenceForBranch = (branchId) =>
    sequences.find(
      (s) => s.businessId?._id === branchId || s.businessId === branchId
    );

  const getGroupLevelSequence = () =>
    sequences.find((s) => s.level === "business_group");

  // ── Save branch-level sequence ──
  const handleSaveBranch = async (branch, data) => {
    if (!canUpdate) return;
    try {
      await saveDocumentSequence({
        documentType: selectedDocType,
        level: "business",
        businessGroupId: businessInfo.businessGroup,
        businessId: branch._id,
        prefix: data.prefix,
        startingNumber: data.startingNumber,
        padding: data.padding,
        isActive: data.enabled,
      });
      notifySuccess(`Sequence saved for ${branch.name}`);
      fetchSequences();
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save sequence"
      );
    }
  };

  // ── Save group-level sequence ──
  const handleSaveGroup = async (data) => {
    if (!canUpdate) return;
    try {
      await saveDocumentSequence({
        documentType: selectedDocType,
        level: "business_group",
        businessGroupId: businessInfo.businessGroup,
        businessId: null,
        prefix: data.prefix,
        startingNumber: data.startingNumber,
        padding: data.padding,
        isActive: data.isActive,
        inheritSourceNumber: data.inheritSourceNumber || false,
        linkedDocTypes: data.linkedDocTypes || [],
      });
      notifySuccess("Group-level sequence saved");
      fetchSequences();
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save sequence"
      );
    }
  };

  // ── Delete sequence ──
  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (!window.confirm("Delete this sequence configuration?")) return;
    try {
      await deleteDocumentSequence(id);
      notifySuccess("Sequence deleted");
      fetchSequences();
    } catch (err) {
      notifyError("Failed to delete sequence");
    }
  };

  return (
    <>
      <Header />
      <AppLayout>
        <div className="p-6 min-h-screen bg-gray-50">
          <div className="max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-gray-800">
                Document Numbering
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Configure automatic numbering for financial documents
              </p>
            </div>

            {!businessId && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
                Please select an organization from Settings to configure
                document numbering.
              </div>
            )}

            {businessId && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Controls */}
                <div className="p-5 border-b border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Document Type */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Document Type
                      </label>
                      <select
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
                      >
                        {DOCUMENT_TYPES.map((dt) => (
                          <option key={dt.value} value={dt.value}>
                            {typeof dt.label === "function" ? dt.label() : dt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Apply At Level */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Apply Sequence At
                      </label>
                      <div className="flex gap-3 mt-1">
                        {LEVEL_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="level"
                              value={opt.value}
                              checked={selectedLevel === opt.value}
                              onChange={() => setSelectedLevel(opt.value)}
                              className="accent-[#A6C437]"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {loading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      Loading...
                    </div>
                  ) : (
                    <>
                      {/* ── Business Group Level ── */}
                      {selectedLevel === "business_group" && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">
                            This sequence will be shared across all branches in
                            the business group.
                          </p>
                          <GroupLevelForm
                            documentType={selectedDocType}
                            businessGroupId={businessInfo?.businessGroup}
                            existingSequence={getGroupLevelSequence()}
                            onSave={handleSaveGroup}
                            onDelete={handleDelete}
                            getModuleLabel={getModuleLabel}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                          />
                        </div>
                      )}

                      {/* ── Business Level ── */}
                      {selectedLevel === "business" && (
                        <div>
                          <p className="text-sm text-gray-600 mb-3">
                            Configure a separate sequence for each branch.
                            Enable the checkbox to activate a branch's
                            numbering.
                          </p>
                          {branches.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              No branches found for this business group.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                      Enable
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                      Branch Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                      Prefix
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                      Starting #
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                      Padding
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                      Preview
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {branches.map((branch) => (
                                    <BranchRow
                                      key={branch._id}
                                      branch={branch}
                                      sequence={getSequenceForBranch(
                                        branch._id
                                      )}
                                      onSave={handleSaveBranch}
                                      onDelete={handleDelete}
                                      canUpdate={canUpdate}
                                      canDelete={canDelete}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Existing sequences summary */}
                {sequences.length > 0 && (
                  <div className="border-t border-gray-100 p-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                      Configured Sequences for{" "}
                      {
                        (() => {
                          const label = DOCUMENT_TYPES.find(
                            (d) => d.value === selectedDocType
                          )?.label;
                          return typeof label === "function" ? label() : label;
                        })()
                      }
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sequences.map((seq) => (
                        <div
                          key={seq._id}
                          className={`border rounded-lg p-3 ${
                            seq.isActive
                              ? "border-green-200 bg-green-50"
                              : "border-gray-200 bg-gray-50 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-800">
                              {formatDocumentNumber(
                                seq.prefix,
                                seq.runningNumber,
                                seq.padding
                              )}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                seq.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {seq.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {seq.level === "business_group"
                              ? "Group Level"
                              : seq.businessId?.name || "Branch Level"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Next: #{seq.runningNumber} · Padding: {seq.padding}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </>
  );
};

export default DocumentNumbering;
