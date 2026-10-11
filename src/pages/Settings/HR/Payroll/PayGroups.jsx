import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Plus, Trash2, Edit, Settings } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../../app-layout";
import SettingsOrgBanner from "../../SettingsOrgBanner";
import { notifyError, notifySuccess } from "@/utils/toast";
import ConfirmationModal from "@/pages/Customer/reusablecomponents/ConfirmationModal ";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PayGroups = () => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });

  const freqLabels = {
    monthly: tp("payGroups.freq.monthly", "Monthly"),
    semi_monthly: tp("payGroups.freq.semi_monthly", "Semi-Monthly"),
    bi_weekly: tp("payGroups.freq.bi_weekly", "Bi-Weekly"),
    weekly: tp("payGroups.freq.weekly", "Weekly"),
  };

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const location = useLocation();
  const selectedOrg = new URLSearchParams(location.search).get("selectedOrg");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const confirmActionRef = useRef(null);

  const openConfirmModal = ({
    title,
    message,
    confirmText: confirmBtnText,
    onConfirm,
  }) => {
    confirmActionRef.current = onConfirm;
    setConfirmTitle(title || tp("confirm", "Confirm"));
    setConfirmMessage(message || "");
    setConfirmText(confirmBtnText || tp("confirm", "Confirm"));
    setConfirmOpen(true);
  };

  const handleConfirmModal = async () => {
    const fn = confirmActionRef.current;
    confirmActionRef.current = null;
    setConfirmOpen(false);
    if (typeof fn === "function") await fn();
  };

  useEffect(() => {
    if (selectedOrg) fetchItems();
    else {
      setItems([]);
      setIsLoading(false);
    }
  }, [selectedOrg]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`${Base_URL}/payroll/pay-groups`, {
        params: { business: selectedOrg },
      });
      setItems(data);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!selectedOrg || !canAdd) return;
    openConfirmModal({
      title: tp("seedDefaults", "Seed Defaults"),
      message: tp(
        "payGroups.confirm.seedMessage",
        "Seed default pay groups for this business? This only works if none exist yet.",
      ),
      confirmText: tp("seed", "Seed"),
      onConfirm: async () => {
        try {
          await axios.post(`${Base_URL}/payroll/pay-groups/seed-defaults`, {
            business: selectedOrg,
          });
          fetchItems();
          notifySuccess(
            tp(
              "payGroups.toast.seedSuccess",
              "Default pay groups seeded successfully",
            ),
          );
        } catch (err) {
          notifyError(
            err.response?.data?.message ||
              tp("payGroups.toast.seedFailed", "Failed to seed defaults"),
          );
        }
      },
    });
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    openConfirmModal({
      title: tp("payGroups.confirm.deleteTitle", "Delete Pay Group"),
      message: tp(
        "payGroups.confirm.deleteMessage",
        "Delete this pay group?",
      ),
      confirmText: tp("delete", "Delete"),
      onConfirm: async () => {
        try {
          await axios.delete(`${Base_URL}/payroll/pay-groups/${id}`);
          fetchItems();
          notifySuccess(tp("payGroups.toast.deleteSuccess", "Pay group deleted"));
        } catch (err) {
          console.error(err);
          notifyError(
            err.response?.data?.message ||
              tp("payGroups.toast.deleteFailed", "Failed to delete pay group"),
          );
        }
      },
    });
  };

  const tableHeaders = [
    { key: "code", label: tp("code", "Code") },
    { key: "name", label: tp("name", "Name") },
    { key: "frequency", label: tp("payGroups.table.frequency", "Frequency") },
    {
      key: "description",
      label: tp("payGroups.table.description", "Description"),
    },
    { key: "branches", label: tp("payGroups.table.branches", "Branches") },
    {
      key: "departments",
      label: tp("payGroups.table.departments", "Departments"),
    },
    { key: "actions", label: tp("actions", "Actions") },
  ];

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--p-blue)]" />
            {tp("payGroups.pageTitle", "Pay Groups")}
          </h1>
          <div className="flex gap-2 flex-wrap">
            {canAdd && (
              <button
                onClick={handleSeedDefaults}
                disabled={!selectedOrg}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 flex items-center"
              >
                <Settings className="mr-2 w-4 h-4" />{" "}
                {tp("seedDefaults", "Seed Defaults")}
              </button>
            )}
            {canAdd && (
              <button
                onClick={() => {
                  setEditItem(null);
                  setShowModal(true);
                }}
                disabled={!selectedOrg}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 flex items-center"
                style={{ backgroundColor: "var(--p-blue)" }}
              >
                <Plus className="mr-2 w-4 h-4" />{" "}
                {tp("payGroups.addPayGroup", "Add Pay Group")}
              </button>
            )}
          </div>
        </div>
        <SettingsOrgBanner />
        {!selectedOrg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4 text-sm">
            {tp(
              "payGroups.selectBusinessBanner",
              "Select a business to manage pay groups.",
            )}
          </div>
        )}
        <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-center">{tp("loading", "Loading...")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full divide-y divide-gray-100">
                <thead className="bg-gradient-to-r from-gray-50 to-slate-50">
                  <tr>
                    {tableHeaders.map((h) => (
                      <th
                        key={h.key}
                        className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500"
                      >
                        {tp("payGroups.empty", "No pay groups found")}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item._id}
                        className="hover:bg-blue-50/40 transition-colors duration-150"
                      >
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {item.code}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {item.name}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {freqLabels[item.frequency] || item.frequency}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.description || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.branches?.map((b) => b.name).join(", ") || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.departments?.map((d) => d.name).join(", ") ||
                            "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            {canUpdate && (
                              <button
                                onClick={() => {
                                  setEditItem(item);
                                  setShowModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title={tp("edit", "Edit")}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(item._id)}
                                className="text-red-600 hover:text-red-900"
                                title={tp("delete", "Delete")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <PayGroupModal
            item={editItem}
            selectedOrg={selectedOrg}
            canSubmit={editItem ? canUpdate : canAdd}
            onClose={() => {
              setShowModal(false);
              setEditItem(null);
            }}
            onSuccess={() => {
              setShowModal(false);
              setEditItem(null);
              fetchItems();
            }}
          />
        )}
        <ConfirmationModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirmModal}
          title={confirmTitle}
          message={confirmMessage}
          confirmText={confirmText}
          cancelText={tp("cancel", "Cancel")}
        />
      </div>
    </AppLayout>
  );
};

const PayGroupModal = ({ item, selectedOrg, onClose, onSuccess, canSubmit = true }) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });

  const freqLabels = {
    monthly: tp("payGroups.freq.monthly", "Monthly"),
    semi_monthly: tp("payGroups.freq.semi_monthly", "Semi-Monthly"),
    bi_weekly: tp("payGroups.freq.bi_weekly", "Bi-Weekly"),
    weekly: tp("payGroups.freq.weekly", "Weekly"),
  };

  const isEdit = !!item;
  const [formData, setFormData] = useState({
    business: selectedOrg,
    name: item?.name || "",
    code: item?.code || "",
    frequency: item?.frequency || "monthly",
    description: item?.description || "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const errs = {};
    if (!formData.name) errs.name = tp("required", "Required");
    if (!formData.code) errs.code = tp("required", "Required");
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit)
        await axios.put(`${Base_URL}/payroll/pay-groups/${item._id}`, formData);
      else await axios.post(`${Base_URL}/payroll/pay-groups`, formData);
      onSuccess();
    } catch (err) {
      setErrors({
        form: err.response?.data?.message || tp("failedToSave", "Failed to save"),
      });
      notifyError(
        err.response?.data?.message || tp("failedToSave", "Failed to save"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-bold tracking-tight">
            {isEdit
              ? tp("payGroups.modal.editTitle", "Edit Pay Group")
              : tp("payGroups.modal.addTitle", "Add Pay Group")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.form && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
              {errors.form}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payGroups.modal.code", "Code")} *
              </label>
              <input
                name="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, code: e.target.value }))
                }
                className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all ${errors.code ? "border-red-500" : "border-gray-300"}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payGroups.modal.name", "Name")} *
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, name: e.target.value }))
                }
                className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all ${errors.name ? "border-red-500" : "border-gray-300"}`}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {tp("payGroups.modal.frequency", "Frequency")}
            </label>
            <select
              value={formData.frequency}
              onChange={(e) =>
                setFormData((f) => ({ ...f, frequency: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
            >
              {Object.entries(freqLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {tp("payGroups.modal.description", "Description")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((f) => ({ ...f, description: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
              rows={2}
            />
          </div>
          <div className="flex justify-end items-center mt-6 space-x-4 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              {tp("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              {isSubmitting
                ? tp("saving", "Saving...")
                : isEdit
                  ? tp("update", "Update")
                  : tp("save", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayGroups;
