import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ChevronDown } from "lucide-react";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Terms & Conditions picker + editor — same UX as Customer Invoice create.
 *
 * @param {object} props
 * @param {string} props.businessId
 * @param {object} props.headers
 * @param {object|null} props.businessData
 * @param {Array} props.termsAndConditionsList
 * @param {(list: Array) => void} props.onTermsListChange
 * @param {string} props.termsAndConditions
 * @param {(value: string) => void} props.onTermsContentChange
 * @param {string} [props.footerNote] — shown under textarea (invoice vs quotation copy)
 */
export default function DocumentTermsAndConditionsSection({
  businessId,
  headers = {},
  businessData,
  termsAndConditionsList = [],
  onTermsListChange,
  termsAndConditions = "",
  onTermsContentChange,
  footerNote = "Terms appear on the invoice preview and PDF. Edit above if needed.",
}) {
  const [termsDropdownOpen, setTermsDropdownOpen] = useState(false);
  const termsDropdownRef = useRef(null);
  const [addTermsModalOpen, setAddTermsModalOpen] = useState(false);
  const [newTermName, setNewTermName] = useState("");
  const [newTermContent, setNewTermContent] = useState("");
  const [savingNewTerm, setSavingNewTerm] = useState(false);

  const selectedTermsValue = useMemo(() => {
    const content = termsAndConditions || "";
    if (businessData?.termsAndConditions && content === businessData.termsAndConditions) {
      return "__default__";
    }
    const fromSettings = termsAndConditionsList.find((t) => (t.content || "") === content);
    if (fromSettings) return `item_${fromSettings._id}`;
    const tIdx = (businessData?.termsTemplates || []).findIndex((t) => (t.content || "") === content);
    if (tIdx >= 0) return `tpl_${tIdx}`;
    return "";
  }, [termsAndConditions, businessData, termsAndConditionsList]);

  const selectedTermsLabel = useMemo(() => {
    if (!selectedTermsValue) return null;
    if (selectedTermsValue === "__default__") return "Default";
    if (selectedTermsValue.startsWith("item_")) {
      const id = selectedTermsValue.replace("item_", "");
      const t = termsAndConditionsList.find((x) => x._id === id);
      return t?.name || "Terms";
    }
    if (selectedTermsValue.startsWith("tpl_")) {
      const idx = Number.parseInt(selectedTermsValue.replace("tpl_", ""), 10);
      const t = (businessData?.termsTemplates || [])[idx];
      return t?.name || `Terms ${idx + 1}`;
    }
    return null;
  }, [selectedTermsValue, termsAndConditionsList, businessData?.termsTemplates]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (termsDropdownRef.current && !termsDropdownRef.current.contains(e.target)) {
        setTermsDropdownOpen(false);
      }
    };
    if (termsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [termsDropdownOpen]);

  const handleTermsSelect = useCallback(
    (v) => {
      setTermsDropdownOpen(false);
      if (v === "") {
        onTermsContentChange("");
        return;
      }
      if (v === "__default__" && businessData?.termsAndConditions) {
        onTermsContentChange(businessData.termsAndConditions);
        return;
      }
      if (v.startsWith("item_")) {
        const id = v.replace("item_", "");
        const item = termsAndConditionsList.find((t) => t._id === id);
        if (item) onTermsContentChange(item.content || "");
        return;
      }
      if (v.startsWith("tpl_")) {
        const idx = Number.parseInt(v.replace("tpl_", ""), 10);
        const templates = businessData?.termsTemplates || [];
        if (Number.isFinite(idx) && templates[idx]) {
          onTermsContentChange(templates[idx].content || "");
        }
      }
      if (v === "__add_new__") {
        setAddTermsModalOpen(true);
      }
    },
    [businessData, termsAndConditionsList, onTermsContentChange],
  );

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <label className="block text-sm font-semibold text-gray-900 mb-3">Terms & Conditions</label>
        <div className="flex gap-2 mb-3 items-center">
          <div className="flex-1 relative" ref={termsDropdownRef}>
            <button
              type="button"
              onClick={() => setTermsDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] bg-white text-left"
            >
              <span className={selectedTermsValue ? "text-gray-900" : "text-gray-500"}>
                {selectedTermsLabel ?? "Select terms and Conditions"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${termsDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {termsDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-60 overflow-auto">
                {businessData?.termsAndConditions ? (
                  <button
                    type="button"
                    onClick={() => handleTermsSelect("__default__")}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === "__default__" ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                  >
                    Default
                  </button>
                ) : null}
                {termsAndConditionsList.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => handleTermsSelect(`item_${t._id}`)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `item_${t._id}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                  >
                    {t.name || "Terms"}
                  </button>
                ))}
                {(businessData?.termsTemplates || []).map((t, i) => (
                  <button
                    key={`tpl-${i}`}
                    type="button"
                    onClick={() => handleTermsSelect(`tpl_${i}`)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selectedTermsValue === `tpl_${i}` ? "bg-blue-50 text-[var(--p-blue)]" : "text-gray-900"}`}
                  >
                    {t.name || `Terms ${i + 1}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleTermsSelect("__add_new__")}
                  className="w-full px-3 py-2 text-left text-sm text-[var(--p-blue)] hover:bg-blue-50 border-t border-gray-100 mt-1"
                >
                  Add new
                </button>
              </div>
            )}
          </div>
        </div>
        {termsAndConditions ? (
          <>
            <textarea
              name="termsAndConditions"
              value={termsAndConditions || ""}
              onChange={(e) => onTermsContentChange(e.target.value)}
              rows={4}
              placeholder="Terms content (editable after selection)"
              className="w-full min-h-[6rem] px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
            />
            <p className="mt-2 text-xs text-gray-500">{footerNote}</p>
          </>
        ) : null}
      </div>

      {addTermsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !savingNewTerm && setAddTermsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add new Terms & Conditions</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder="e.g. Standard, Net 30"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={newTermContent}
                  onChange={(e) => setNewTermContent(e.target.value)}
                  rows={6}
                  placeholder="Enter terms and conditions text..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] resize-y"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddTermsModalOpen(false);
                  setNewTermName("");
                  setNewTermContent("");
                }}
                disabled={savingNewTerm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newTermName.trim() || !businessId) return;
                  setSavingNewTerm(true);
                  try {
                    await axios.post(
                      `${Base_URL}/items/Terms and Conditions/add`,
                      {
                        name: newTermName.trim(),
                        content: newTermContent.trim(),
                        status: "active",
                        business_id: businessId,
                      },
                      { headers },
                    );
                    const res = await axios.post(
                      `${Base_URL}/items/Terms and Conditions/get_all`,
                      {
                        business_id: businessId,
                        FilterStatus: "active",
                        FilterName: "",
                      },
                      { headers },
                    );
                    const list = res.data?.success ? res.data.data || [] : [];
                    onTermsListChange(list);
                    onTermsContentChange(newTermContent.trim());
                    setAddTermsModalOpen(false);
                    setNewTermName("");
                    setNewTermContent("");
                    notifySuccess("Success");
                  } catch (err) {
                    console.error("Error saving terms:", err);
                    notifyError(err.response?.data?.message || "Failed to save terms.");
                  } finally {
                    setSavingNewTerm(false);
                  }
                }}
                disabled={savingNewTerm || !newTermName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingNewTerm ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
