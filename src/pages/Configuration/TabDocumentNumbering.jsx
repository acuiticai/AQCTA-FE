import { useState, useEffect, useContext, useCallback, Fragment } from "react";
import axios from "axios";
import {
  Save,
  Trash2,
  Building2,
  Hash,
  RefreshCw,
  AlertTriangle,
  Plus,
  Link2,
  Info,
  FileText,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  getDocumentSequences,
  saveDocumentSequence,
  deleteDocumentSequence,
  getCurrentMaxDocumentNumber,
} from "@/services/documentSequenceServices";
import ConfirmationModal from "@/pages/Purchase/Vendors/reusablecomponents/ConfirmationModal ";
import { getModuleLabel } from "@/utils/moduleLabels";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

// ─── Module-based document types with default prefixes ───────────────────────
const DOCUMENT_TYPES = [
  {
    value: "invoice",
    label: () => getModuleLabel("invoice", "Customer Invoice"),
    defaultPrefix: "INV",
  },
  {
    value: "quotation",
    label: () => getModuleLabel("quotation", "Quotation"),
    defaultPrefix: "QT",
  },
  {
    value: "payment_received",
    label: () => "Payment Received",
    defaultPrefix: "PR",
  },
  {
    value: "bill",
    label: () => getModuleLabel("vendorInvoice", "Vendor Invoice"),
    defaultPrefix: "BILL",
  },
  {
    value: "vendor_payment",
    label: () => "Vendor Payment",
    defaultPrefix: "VP",
  },
  {
    value: "sales_order",
    label: () => getModuleLabel("saleOrder", "Sale Order"),
    defaultPrefix: "SO",
  },
  {
    value: "purchase_order",
    label: () => getModuleLabel("purchaseOrder", "Purchase Order"),
    defaultPrefix: "PO",
  },
  {
    value: "recurring_invoice",
    label: () => getModuleLabel("recurringInvoice", "Recurring Invoice"),
    defaultPrefix: "RINV",
  },
  {
    value: "job",
    label: () => getModuleLabel("job", "Job"),
    defaultPrefix: "JOB",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPreview = (prefix, num, padding = 6) =>
  prefix
    ? `${prefix}-${String(num || 1).padStart(Number(padding) || 6, "0")}`
    : "—";

// ─── Toggle Switch ────────────────────────────────────────────────────────────
const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
      checked ? "bg-[#A6C437]" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
        checked ? "translate-x-4.5" : "translate-x-0.5"
      }`}
      style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
    />
  </button>
);

// ─── Business row in the branch table ────────────────────────────────────────
// sequence = the business-level (BL) sequence for this business, or undefined
// groupSeq  = the group-level (BGL) sequence (shared), or undefined
const BusinessRow = ({
  business,
  sequence,
  groupSeq,
  documentType,
  businessGroupId,
  onRefresh,
}) => {
  const docDef = DOCUMENT_TYPES.find((d) => d.value === documentType);
  const hasBL = !!sequence; // this business has its own BL sequence

  // Derive initial state from BL sequence or defaults
  const initState = () => ({
    isActive: sequence ? sequence.isActive : true,
    prefix: sequence ? sequence.prefix : (docDef?.defaultPrefix ?? ""),
    startingNumber: sequence
      ? (sequence.startingNumber ?? sequence.runningNumber ?? 1)
      : 1,
  });

  const [isActive, setIsActive] = useState(initState().isActive);
  const [prefix, setPrefix] = useState(initState().prefix);
  const [startingNumber, setStartingNumber] = useState(
    initState().startingNumber,
  );
  const [saving, setSaving] = useState(false);
  const [showEnableForm, setShowEnableForm] = useState(false); // "Enable Own Numbering" inline form

  // Reset local state whenever the sequence prop changes (BL created/deleted)
  useEffect(() => {
    const s = initState();
    setIsActive(s.isActive);
    setPrefix(s.prefix);
    setStartingNumber(s.startingNumber);
    setShowEnableForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType, sequence?._id]);

  const preview = formatPreview(prefix, startingNumber, 6);

  const handleSave = async () => {
    if (!prefix.trim()) {
      notifyError("Prefix is required");
      return;
    }
    setSaving(true);
    try {
      await saveDocumentSequence({
        documentType,
        level: "business",
        businessGroupId,
        businessId: business._id,
        prefix: prefix.trim().toUpperCase(),
        startingNumber,
        padding: 6,
        isActive,
      });
      notifySuccess(`Saved for ${business.name}`);
      onRefresh();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sequence?._id) return;
    if (
      !window.confirm(
        `Remove independent numbering for "${business.name}"? It will revert to Group Level.`,
      )
    )
      return;
    try {
      await deleteDocumentSequence(sequence._id);
      notifySuccess(`${business.name} reverted to Group Level`);
      onRefresh();
    } catch {
      notifyError("Failed to delete");
    }
  };

  // Inherited preview from group sequence
  const inheritedPreview = groupSeq
    ? formatPreview(groupSeq.prefix, groupSeq.runningNumber, groupSeq.padding)
    : "—";

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        {/* Business Name */}
        <td className="px-4 py-3 text-sm font-medium text-gray-800 min-w-[140px]">
          {business.name}
        </td>

        {/* Sequence Level badge */}
        <td className="px-4 py-3 text-center">
          {hasBL ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#A6C437]/15 text-green-800">
              Business Level
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Group Level
            </span>
          )}
        </td>

        {/* Prefix */}
        <td className="px-4 py-3 w-28">
          {hasBL ? (
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder={docDef?.defaultPrefix ?? ""}
              maxLength={10}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[#A6C437] disabled:bg-gray-100 disabled:text-gray-400"
              disabled={!isActive}
            />
          ) : (
            <span className="block px-2 py-1.5 text-sm font-mono text-gray-400 bg-gray-50 rounded-md border border-gray-200">
              {groupSeq?.prefix ?? "—"}
            </span>
          )}
        </td>

        {/* Starting Number */}
        <td className="px-4 py-3 w-28">
          {hasBL ? (
            <input
              type="number"
              value={startingNumber}
              min={1}
              onChange={(e) =>
                setStartingNumber(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437] disabled:bg-gray-100 disabled:text-gray-400"
              disabled={!isActive}
            />
          ) : (
            <span className="block px-2 py-1.5 text-sm text-gray-400 bg-gray-50 rounded-md border border-gray-200">
              {groupSeq?.startingNumber ?? 1}
            </span>
          )}
        </td>

        {/* Next Number Preview */}
        <td className="px-4 py-3">
          {hasBL ? (
            <span
              className={`inline-block font-mono text-xs px-2.5 py-1 rounded-md ${
                isActive
                  ? "bg-[#A6C437]/10 text-gray-800 font-semibold"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {isActive ? preview : "—"}
            </span>
          ) : (
            <span className="inline-block font-mono text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-500">
              {inheritedPreview}
            </span>
          )}
        </td>

        {/* Active toggle (only for BL) */}
        <td className="px-4 py-3 text-center w-16">
          {hasBL ? (
            <ToggleSwitch checked={isActive} onChange={setIsActive} />
          ) : (
            <span className="text-[11px] text-gray-400">Inherited</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-center w-32">
          {hasBL ? (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                title="Save"
                className="p-1.5 rounded-md text-[#A6C437] hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleDelete}
                title="Revert to Group Level"
                className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowEnableForm((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Own Numbering
            </button>
          )}
        </td>
      </tr>

      {/* Inline "Enable Own Numbering" form row */}
      {!hasBL && showEnableForm && (
        <tr className="bg-blue-50/50 border-b border-blue-100">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Prefix
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  placeholder={docDef?.defaultPrefix ?? ""}
                  maxLength={10}
                  className="w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Starting #
                </label>
                <input
                  type="number"
                  value={startingNumber}
                  min={1}
                  onChange={(e) =>
                    setStartingNumber(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                  className="w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#A6C437]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Preview
                </label>
                <div className="px-2 py-1.5 text-sm font-mono border border-gray-200 rounded-md bg-white text-gray-700">
                  {formatPreview(prefix, startingNumber, 6)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#A6C437] text-white rounded-md hover:bg-[#93ae2c] disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {saving ? "Saving…" : "Enable"}
                </button>
                <button
                  onClick={() => setShowEnableForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// Target document types that may inherit the source document number
const LINKABLE_DOC_TYPES_BY_SOURCE = {
  sales_order: [
    { value: "invoice", label: "Customer Invoice" },
    { value: "job", label: "Job" },
  ],
  quotation: [
    { value: "invoice", label: "Customer Invoice" },
    { value: "sales_order", label: "Sale Order" },
  ],
};

// Quotation linking UI disabled — backend still honours existing quotation inherit configs.
const SOURCE_DOC_TYPES_WITH_LINKING = new Set(["sales_order"]);

// ─── Group-level config form ─────────────────────────────────────────────────
const GroupLevelForm = ({
  documentType,
  businessGroupId,
  sequence,
  onRefresh,
  docLabel,
}) => {
  const docDef = DOCUMENT_TYPES.find((d) => d.value === documentType);

  const [prefix, setPrefix] = useState(
    sequence?.prefix ?? docDef?.defaultPrefix ?? "",
  );
  const [startingNumber, setStartingNumber] = useState(
    sequence?.startingNumber ?? sequence?.runningNumber ?? 1,
  );
  const [isActive, setIsActive] = useState(sequence?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // New: Linked document inheritance settings
  const [inheritSourceNumber, setInheritSourceNumber] = useState(
    sequence?.inheritSourceNumber || false,
  );
  const [linkedDocTypes, setLinkedDocTypes] = useState(
    sequence?.linkedDocTypes || [],
  );
  const [syncSamePrefixRunningNumber, setSyncSamePrefixRunningNumber] =
    useState(sequence?.syncSamePrefixRunningNumber || false);

  // Current-max state — shows what already exists in DB for this scope
  const [currentMax, setCurrentMax] = useState(null); // numeric
  const [currentFormatted, setCurrentFormatted] = useState(null); // e.g. "INV-000004"
  const [loadingMax, setLoadingMax] = useState(false);
  const [startingNumError, setStartingNumError] = useState("");

  // Sync when documentType or sequence changes
  useEffect(() => {
    setPrefix(sequence?.prefix ?? docDef?.defaultPrefix ?? "");
    setStartingNumber(sequence?.startingNumber ?? sequence?.runningNumber ?? 1);
    setIsActive(sequence?.isActive ?? true);
    setInheritSourceNumber(sequence?.inheritSourceNumber || false);
    setLinkedDocTypes(sequence?.linkedDocTypes || []);
    setSyncSamePrefixRunningNumber(
      sequence?.syncSamePrefixRunningNumber || false,
    );
    setStartingNumError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType, sequence?._id]);

  // Fetch actual max whenever prefix or scope changes (debounced 400 ms)
  useEffect(() => {
    if (!prefix.trim() || !businessGroupId || !documentType) {
      setCurrentMax(null);
      setCurrentFormatted(null);
      return;
    }
    setLoadingMax(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getCurrentMaxDocumentNumber(
          documentType,
          businessGroupId,
          prefix.trim().toUpperCase(),
        );
        setCurrentMax(res.data.actualMax);
        setCurrentFormatted(res.data.currentFormatted);
      } catch {
        setCurrentMax(null);
        setCurrentFormatted(null);
      } finally {
        setLoadingMax(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [prefix, documentType, businessGroupId]);

  // Validate starting number against actual max whenever either changes
  useEffect(() => {
    if (currentMax !== null && startingNumber <= currentMax) {
      setStartingNumError(
        `This number conflicts with existing records. Current highest is ${currentFormatted}. Enter ${currentMax + 1} or higher.`,
      );
    } else {
      setStartingNumError("");
    }
  }, [startingNumber, currentMax, currentFormatted]);

  const preview = formatPreview(prefix, startingNumber, 6);

  const handleSave = async () => {
    if (!prefix.trim()) {
      notifyError("Prefix is required");
      return;
    }
    if (startingNumError) {
      notifyError(startingNumError);
      return;
    }
    if (inheritSourceNumber && linkedDocTypes.length === 0) {
      notifyError("Select at least one linked document type.");
      return;
    }
    setSaving(true);
    try {
      await saveDocumentSequence({
        documentType,
        level: "business_group",
        businessGroupId,
        businessId: null,
        prefix: prefix.trim().toUpperCase(),
        startingNumber,
        padding: 6,
        isActive,
        inheritSourceNumber,
        linkedDocTypes,
        syncSamePrefixRunningNumber,
        applyPrefixToLinkedTypes: false,
      });
      notifySuccess(
        syncSamePrefixRunningNumber
          ? "Shared prefix and number updated for all document types"
          : "Numbering settings saved",
      );
      onRefresh();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const linkableOptions = LINKABLE_DOC_TYPES_BY_SOURCE[documentType] || [];

  const toggleLinkedDocType = (docType) => {
    setLinkedDocTypes((prev) =>
      prev.includes(docType)
        ? prev.filter((d) => d !== docType)
        : [...prev, docType],
    );
  };

  const handleInheritToggle = (enabled) => {
    setInheritSourceNumber(enabled);
    if (!enabled) {
      setLinkedDocTypes([]);
      return;
    }
    if (documentType === "sales_order" && !linkedDocTypes.includes("invoice")) {
      setLinkedDocTypes((prev) =>
        prev.includes("invoice") ? prev : [...prev, "invoice"],
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!sequence?._id) {
      setShowDeleteModal(false);
      return;
    }
    try {
      await deleteDocumentSequence(sequence._id);
      notifySuccess(
        "Group-level numbering rule deleted. Existing documents were not touched.",
      );
      onRefresh();
    } catch {
      notifyError("Failed to delete");
    } finally {
      setShowDeleteModal(false);
    }
  };

  const exampleSource = formatPreview(
    prefix || docDef?.defaultPrefix,
    startingNumber,
    6,
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 leading-relaxed">
        One shared counter for every business in this group. Numbers are
        assigned when documents are created.
      </p>

      {/* Current highest number info banner */}
      {prefix.trim() && (
        <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
          <Hash className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
          <span>
            {loadingMax ? (
              "Checking existing records…"
            ) : currentMax && currentMax > 0 ? (
              <>
                Current highest number in this Business Group:{" "}
                <strong className="font-mono">{currentFormatted}</strong>.{" "}
                Starting number must be <strong>{currentMax + 1}</strong> or
                higher to avoid conflicts.
              </>
            ) : (
              <>
                No existing records found for prefix{" "}
                <strong className="font-mono">
                  {prefix.trim().toUpperCase()}
                </strong>{" "}
                in this Business Group. You can start from any number.
              </>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Prefix */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Prefix
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder={docDef?.defaultPrefix ?? ""}
            maxLength={10}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#A6C437]/40 focus:border-[#A6C437]"
          />
        </div>
        {/* Starting Number */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Starting Number
          </label>
          <input
            type="number"
            value={startingNumber}
            min={1}
            onChange={(e) => {
              setStartingNumber(Math.max(1, parseInt(e.target.value) || 1));
            }}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]/40 focus:border-[#A6C437] ${
              startingNumError ? "border-red-400 bg-red-50" : "border-gray-300"
            }`}
          />
          {startingNumError && (
            <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {startingNumError}
            </p>
          )}
        </div>
        {/* Preview */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Preview
          </label>
          <div className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 font-mono text-sm text-gray-700">
            {prefix ? preview : <span className="text-gray-400">—</span>}
          </div>
        </div>
        {/* Active */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Active
          </label>
          <div className="flex items-center gap-2 py-2">
            <ToggleSwitch checked={isActive} onChange={setIsActive} />
            <span className="text-sm text-gray-600">
              {isActive ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={syncSamePrefixRunningNumber}
          onChange={(e) => setSyncSamePrefixRunningNumber(e.target.checked)}
          className="w-3.5 h-3.5 mt-0.5 accent-[#A6C437]"
        />
        <span>
          Apply prefix{" "}
          <strong className="font-mono">{prefix.trim().toUpperCase() || "—"}</strong>{" "}
          and this next number to all document types in the group. Starting numbers
          and linked-sequence rules on other types stay unchanged.
        </span>
      </label>

      {/* Linked Document Same Sequence — sales order only (quotation UI disabled) */}
      {documentType === "sales_order" && (
        <div className="mt-5 pt-5 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-[#A6C437] rounded-full"></div>
            <span className="text-sm font-semibold text-gray-800">
              Linked Document Same Sequence
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3 ml-3">
            Enable this to reuse the exact same document number for linked
            documents created from this {docLabel} (e.g. work order{" "}
            <span className="font-mono">MK-000001</span> becomes invoice and job{" "}
            <span className="font-mono">MK-000001</span>). No separate prefix
            setting is needed here.
          </p>

          <div className="ml-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inheritSourceNumber}
                onChange={(e) => handleInheritToggle(e.target.checked)}
                className="w-4 h-4 accent-[#A6C437]"
              />
              <span className="font-medium">
                Enable Linked Document Same Sequence
              </span>
            </label>

            {inheritSourceNumber && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <label className="block text-xs font-semibold text-blue-800 mb-2">
                  Allow these document types to inherit number from this{" "}
                  {docLabel}:
                </label>
                <div className="flex flex-wrap gap-2">
                  {linkableOptions.map((doc) => (
                    <label
                      key={doc.value}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border cursor-pointer transition-all ${
                        linkedDocTypes.includes(doc.value)
                          ? "bg-[#A6C437] border-[#A6C437] text-white font-medium"
                          : "bg-white border-blue-200 text-gray-700 hover:border-blue-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={linkedDocTypes.includes(doc.value)}
                        onChange={() => toggleLinkedDocType(doc.value)}
                        className="w-3 h-3 accent-white"
                      />
                      {doc.label}
                    </label>
                  ))}
                </div>
                {linkedDocTypes.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Select at least one document type above
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        {sequence?._id && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !!startingNumError}
          className="flex items-center gap-1.5 px-5 py-1.5 text-sm bg-[#A6C437] text-white rounded-lg hover:bg-[#93ae2c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? "Saving…" : sequence ? "Update" : "Save"}
        </button>
      </div>

      {sequence?._id && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
          message={`Are you sure you want to delete this numbering configuration?`}
        />
      )}
    </div>
  );
};

// ─── Main Tab Component ──────────────────────────────────────────────────────
const TabDocumentNumbering = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [businessGroups, setBusinessGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [selectedDocType, setSelectedDocType] = useState("invoice");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [loadingSeq, setLoadingSeq] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  // ── 1. Derive business groups from the user's assigned businesses ────────────
  // adminInfo.businesses = [{ _id, name }] set at login
  // Business/getALL populates businessGroup: { _id, companyName }
  useEffect(() => {
    (async () => {
      setLoadingGroups(true);
      try {
        const userBizIds = new Set(
          (adminInfo?.businesses || []).map((b) =>
            typeof b === "object" ? String(b._id) : String(b),
          ),
        );

        const res = await axios.post(
          `${BASE_URL}/Business/getALL`,
          {},
          { headers },
        );
        const allBiz = Array.isArray(res.data)
          ? res.data
          : res.data?.data || [];

        // Keep only active businesses assigned to this user
        const userBiz = allBiz.filter(
          (b) => b.status !== "Inactive" && userBizIds.has(String(b._id)),
        );

        // Derive unique business groups from those businesses
        const groupMap = new Map();
        userBiz.forEach((b) => {
          const grp = b.businessGroup;
          if (grp?._id) {
            groupMap.set(String(grp._id), {
              _id: String(grp._id),
              companyName: grp.companyName,
            });
          }
        });
        const groups = Array.from(groupMap.values());

        setBusinessGroups(groups);
        if (groups.length > 0) {
          setSelectedGroupId(groups[0]._id);
          setSelectedGroup(groups[0]);
        }
      } catch (err) {
        console.error("Error resolving business groups:", err);
      } finally {
        setLoadingGroups(false);
      }
    })();
  }, [adminInfo?.id]);

  // ── 2. Fetch businesses for the selected group (user-assigned only) ──────────
  useEffect(() => {
    if (!selectedGroupId) {
      setBusinesses([]);
      return;
    }
    (async () => {
      setLoadingBiz(true);
      try {
        const userBizIds = new Set(
          (adminInfo?.businesses || []).map((b) =>
            typeof b === "object" ? String(b._id) : String(b),
          ),
        );
        const res = await axios.post(
          `${BASE_URL}/Business/getALL`,
          { businessGroup: selectedGroupId },
          { headers },
        );
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setBusinesses(
          list.filter(
            (b) => b.status !== "Inactive" && userBizIds.has(String(b._id)),
          ),
        );
      } catch (err) {
        console.error("Error fetching businesses:", err);
        setBusinesses([]);
      } finally {
        setLoadingBiz(false);
      }
    })();
  }, [selectedGroupId]);

  // ── 3. Fetch sequences ──────────────────────────────────────────────────────
  const fetchSequences = useCallback(async () => {
    if (!selectedGroupId) return;
    setLoadingSeq(true);
    try {
      const res = await getDocumentSequences({
        businessGroupId: selectedGroupId,
        documentType: selectedDocType,
      });
      setSequences(res.data || []);
    } catch (err) {
      console.error("Error fetching sequences:", err);
    } finally {
      setLoadingSeq(false);
    }
  }, [selectedGroupId, selectedDocType]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getSeqForBusiness = (bizId) =>
    sequences.find(
      (s) =>
        s.level === "business" &&
        (s.businessId?._id === bizId || s.businessId === bizId),
    );

  const groupSeq = sequences.find((s) => s.level === "business_group");
  const hasAnyBL = sequences.some((s) => s.level === "business" && s.isActive);

  const handleGroupChange = (gId) => {
    setSelectedGroupId(gId);
    setSelectedGroup(businessGroups.find((g) => g._id === gId) ?? null);
    setBusinesses([]);
    setSequences([]);
  };

  const docLabel =
    DOCUMENT_TYPES.find((d) => d.value === selectedDocType)?.label?.() ?? "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Fragment>
      <div className="space-y-5">
        {/* ── Business Group Header Card ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Icon + name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-[#A6C437]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-[#A6C437]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Business Group
                </p>
                {selectedGroup ? (
                  <h2 className="text-lg font-bold text-gray-800 truncate">
                    {selectedGroup.companyName}
                  </h2>
                ) : (
                  <p className="text-sm text-gray-400">
                    {loadingGroups ? "Loading…" : "Select a business group"}
                  </p>
                )}
              </div>
            </div>

            {/* Dropdown — hidden when only one business group */}
            {!loadingGroups && businessGroups.length !== 1 && (
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]/40 focus:border-[#A6C437] bg-white"
              >
                <option value="">— Select Business Group —</option>
                {businessGroups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.companyName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Gate: require group selection ─────────────────────────────── */}
        {!selectedGroupId && !loadingGroups && businessGroups.length !== 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Please select a Business Group above to configure document
            numbering.
          </div>
        )}

        {selectedGroupId && (
          <>
            {/* ── Document Type Selector ─────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                Document Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {DOCUMENT_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    onClick={() => setSelectedDocType(dt.value)}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      selectedDocType === dt.value
                        ? "border-[#A6C437] bg-[#A6C437]/5 font-semibold text-gray-800 shadow-sm"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="inline-block font-mono text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mr-1.5 font-bold uppercase">
                      {dt.defaultPrefix}
                    </span>
                    {dt.label()}
                  </button>
                ))}
              </div>
            </div>

            {loadingSeq || loadingBiz ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400 shadow-sm">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" />
                Loading…
              </div>
            ) : (
              <>
                {/* ── Group Level Configuration ──────────────────────────── */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">
                        {docLabel} — Group Level Configuration
                      </span>
                    </div>
                    {selectedGroup && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {selectedGroup.companyName}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <GroupLevelForm
                      documentType={selectedDocType}
                      businessGroupId={selectedGroupId}
                      sequence={groupSeq}
                      onRefresh={fetchSequences}
                      docLabel={docLabel}
                    />
                  </div>
                </div>

                {/* ── Info Banner: mixed BL/BGL ──────────────────────────── */}
                {/* {hasAnyBL && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>
                      <strong>Some businesses have independent numbering.</strong>{" "}
                      Group Level sequence will not apply to them — each uses its own counter.
                    </span>
                  </div>
                )} */}

                {/* ── Business Level Configuration Table ────────────────── */}
                {/* <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">
                        {docLabel} — Business Level Configuration
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {businesses.length} business{businesses.length !== 1 ? "es" : ""}
                    </span>
                  </div>

                  {businesses.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-500">
                        No businesses found for this business group.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Please add businesses first before configuring document numbering.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/60">
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                              Business Name
                            </th>
                            <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                              Sequence Level
                            </th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide w-28">
                              Prefix
                            </th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide w-28">
                              Starting #
                            </th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                              Next Number
                            </th>
                            <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wide w-16">
                              Active
                            </th>
                            <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wide w-32">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {businesses.map((biz) => (
                            <BusinessRow
                              key={`${biz._id}-${selectedDocType}`}
                              business={biz}
                              sequence={getSeqForBusiness(biz._id)}
                              groupSeq={groupSeq}
                              documentType={selectedDocType}
                              businessGroupId={selectedGroupId}
                              onRefresh={fetchSequences}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div> */}

                {/* ── Active Configurations Summary ──────────────────────── */}
                {sequences.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                      Configured Sequences — {docLabel}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sequences.map((seq) => (
                        <div
                          key={seq._id}
                          className={`rounded-xl border p-3.5 ${
                            seq.isActive
                              ? "border-green-200 bg-green-50"
                              : "border-gray-200 bg-gray-50 opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <span className="font-mono text-sm font-bold text-gray-800">
                              {formatPreview(
                                seq.prefix,
                                seq.runningNumber,
                                seq.padding,
                              )}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                seq.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {seq.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-medium">
                            {seq.level === "business_group"
                              ? "Group Level"
                              : (seq.businessId?.name ?? "Business Level")}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            Next #{seq.runningNumber} · {seq.padding}-digit
                            padding
                          </p>
                          {seq.inheritSourceNumber && (
                            <p className="text-[11px] text-[#7a9a28] mt-1 flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              Linked sequence enabled
                              {seq.linkedDocTypes?.length > 0 &&
                                ` → ${seq.linkedDocTypes.join(", ")}`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Fragment>
  );
};

export default TabDocumentNumbering;
