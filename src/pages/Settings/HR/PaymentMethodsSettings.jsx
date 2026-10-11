"use client";

import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { DataTable, ActionButtons, Loader } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;



const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  status: "Active",
  type: "Cash",
  // Settlement (provider) config — only meaningful for Online methods.
  settlementMode: "direct",
  clearingAccount: "",
  settlementBankAccount: "",
  feePercent: "",
  feeFixed: "",
  settlementDays: 1,
  feeCategory: "Merchant Fees",
};

const AddEditModal = ({
  isOpen,
  onClose,
  item,
  onSubmit,
  canSubmit,
  clearingAccounts = [],
  bankAccounts = [],
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (item) {
      const s = item.settlement || {};
      setFormData({
        name: item.name || "",
        code: item.code || "",
        description: item.description || "",
        status: item.status || "Active",
        type: item.type || "Cash",
        settlementMode: s.mode || "direct",
        clearingAccount: s.clearingAccount || "",
        settlementBankAccount: s.bankAccount || "",
        feePercent: s.feePercent != null ? String(s.feePercent) : "",
        feeFixed: s.feeFixed != null ? String(s.feeFixed) : "",
        settlementDays: s.settlementDays != null ? s.settlementDays : 1,
        feeCategory: s.feeCategory || "Merchant Fees",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setValidationErrors({});
  }, [item, isOpen]);

  const isOnline = formData.type === "Online";
  const throughClearing = isOnline && formData.settlementMode === "clearing";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name) errors.name = t("accountsSettings.paymentMethods.nameRequired", "Name is required.");
    if (!formData.code) errors.code = t("accountsSettings.paymentMethods.codeRequired", "Code is required.");
    if (!formData.type) errors.type = t("accountsSettings.paymentMethods.typeRequired", "Type is required.");
    if (throughClearing && !formData.clearingAccount) {
      errors.clearingAccount = t(
        "accountsSettings.paymentMethods.clearingRequired",
        "Choose a clearing account for this provider."
      );
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Build the settlement object the API expects. Cash and direct-online
    // methods always post direct.
    const settlement = {
      mode: throughClearing ? "clearing" : "direct",
      clearingAccount: throughClearing ? formData.clearingAccount : null,
      bankAccount: throughClearing ? formData.settlementBankAccount || null : null,
      feePercent: Number(formData.feePercent) || 0,
      feeFixed: Number(formData.feeFixed) || 0,
      settlementDays: Number(formData.settlementDays) || 0,
      feeCategory: (formData.feeCategory || "Merchant Fees").trim(),
    };

    const { settlementMode, clearingAccount, settlementBankAccount, feePercent, feeFixed, settlementDays, feeCategory, ...core } = formData;
    onSubmit({ ...core, settlement });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 m-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{item ? t("accountsSettings.paymentMethods.editModal", "Edit Payment Method") : t("accountsSettings.paymentMethods.addModal", "Add New Payment Method")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.name")}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.name ? "border-red-500" : "border-gray-300"
                }`}
              />
              {validationErrors.name && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.code")}</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder={t("accountsSettings.paymentMethods.codePlaceholder", "e.g., CASH, BANK_TRANSFER, CHECK")}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.code ? "border-red-500" : "border-gray-300"
                }`}
              />
              {validationErrors.code && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accountsSettings.paymentMethods.type")} <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                  validationErrors.type ? "border-red-500" : "border-gray-300"
                }`}
                required
              >
                <option value="Cash">{t("accountsSettings.paymentMethods.typeCash", "Cash")}</option>
                <option value="Online">{t("accountsSettings.paymentMethods.typeOnline", "Online (Credit Cards, Debit Cards, Bank Transfer, QR, etc.)")}</option>
              </select>
              {validationErrors.type && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.type}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {t("accountsSettings.paymentMethods.typeHelp", "Cash: Physical cash transactions. Online: All non-cash payment methods.")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("accountsSettings.paymentMethods.descriptionOptional", "Description (Optional)")}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
              />
            </div>

            {isOnline && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={throughClearing}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        settlementMode: e.target.checked ? "clearing" : "direct",
                      }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">
                      {t(
                        "accountsSettings.paymentMethods.settleThroughClearing",
                        "Settle through a clearing account"
                      )}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {t(
                        "accountsSettings.paymentMethods.settleHelp",
                        "For card/QR providers that hold the money and pay out a net batch later. Sales post to the clearing account; a settlement books the net to the bank and the fee."
                      )}
                    </span>
                  </span>
                </label>

                {throughClearing && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t("accountsSettings.paymentMethods.clearingAccount", "Clearing account")}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="clearingAccount"
                        value={formData.clearingAccount}
                        onChange={handleChange}
                        className={`w-full p-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${
                          validationErrors.clearingAccount ? "border-red-500" : "border-gray-300"
                        }`}
                      >
                        <option value="">
                          {t("accountsSettings.paymentMethods.selectAccount", "Select an account")}
                        </option>
                        {clearingAccounts.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.accountName}
                            {a.currencyType ? ` (${a.currencyType})` : ""}
                          </option>
                        ))}
                      </select>
                      {clearingAccounts.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          {t(
                            "accountsSettings.paymentMethods.noClearing",
                            "No clearing accounts yet — create a bank account with category ‘Clearing’ first."
                          )}
                        </p>
                      )}
                      {validationErrors.clearingAccount && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.clearingAccount}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t("accountsSettings.paymentMethods.settlesInto", "Settles into (bank account)")}
                      </label>
                      <select
                        name="settlementBankAccount"
                        value={formData.settlementBankAccount}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                      >
                        <option value="">
                          {t("accountsSettings.paymentMethods.chooseAtSettlement", "Choose at settlement time")}
                        </option>
                        {bankAccounts.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.accountName}
                            {a.currencyType ? ` (${a.currencyType})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {t("accountsSettings.paymentMethods.feePercent", "Fee %")}
                        </label>
                        <input
                          type="number"
                          name="feePercent"
                          step="0.01"
                          min="0"
                          value={formData.feePercent}
                          onChange={handleChange}
                          placeholder="0"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {t("accountsSettings.paymentMethods.feeFixed", "Fixed fee")}
                        </label>
                        <input
                          type="number"
                          name="feeFixed"
                          step="0.01"
                          min="0"
                          value={formData.feeFixed}
                          onChange={handleChange}
                          placeholder="0"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {t("accountsSettings.paymentMethods.settlementDays", "Payout T+")}
                        </label>
                        <input
                          type="number"
                          name="settlementDays"
                          min="0"
                          value={formData.settlementDays}
                          onChange={handleChange}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437]"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {t(
                        "accountsSettings.paymentMethods.feeAdvisory",
                        "Fees are optional — the real fee is taken from the actual net each settlement banks. These only flag an unexpected fee."
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {item ? t("accountsSettings.paymentMethods.updateBtn", "Update Payment Method") : t("accountsSettings.paymentMethods.addBtn", "Add Payment Method")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("accountsSettings.paymentMethods.deleteConfirmTitle", "Are you sure?")}</h2>
        <p className="text-sm text-gray-600">
          {t(
            "accountsSettings.paymentMethods.deleteConfirmText",
            "Do you really want to delete this payment method? This action cannot be undone."
          )}
        </p>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentMethodsSettings = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchItems(organization, searchTerm, statusFilter);
    }
  }, [organization, isOrgLoaded, searchTerm, statusFilter]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchAccounts(organization);
    }
    // eslint-disable-next-line
  }, [organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const handleAddNew = () => {
    if (!canAdd) return;
    setEditItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    if (!canUpdate) return;
    setEditItem(item);
    setModalOpen(true);
  };

  const handleSubmit = async (formData) => {
    if ((editItem && !canUpdate) || (!editItem && !canAdd)) return;
    try {
      const payload = {
        business_id: organization,
        ...formData,
      };

      if (editItem) {
        await axios.put(
          `${BASE_URL}/daily-reports/payment-methods/update/${editItem._id}`,
          payload,
          { headers }
        );
        notifySuccess(t("accountsSettings.paymentMethods.updateSuccess", "Payment method updated successfully"));
      } else {
        await axios.post(`${BASE_URL}/daily-reports/payment-methods/add`, payload, { headers });
        notifySuccess(t("accountsSettings.paymentMethods.createSuccess", "Payment method created successfully"));
      }

      fetchItems(organization);
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save payment method", err?.response?.data?.message);
      notifyError(err?.response?.data?.message || t("accountsSettings.paymentMethods.errorOccurred", "An error occurred"));
    }
  };

  const fetchItems = async (selectedOrg, search = "", status = "") => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: status,
        FilterName: search,
      };
      const response = await axios.post(
        `${BASE_URL}/daily-reports/payment-methods/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(t("accountsSettings.paymentMethods.loadFailed", "Failed to load payment methods"));
      notifyError(t("accountsSettings.paymentMethods.loadFailed", "Failed to load payment methods"));
    } finally {
      setLoading(false);
    }
  };

  // Accounts for the settlement config: clearing accounts to hold provider
  // takings, bank accounts they settle into.
  const fetchAccounts = async (selectedOrg) => {
    if (!selectedOrg) return;
    try {
      const response = await axios.get(
        `${BASE_URL}/bank-management/accounts?business=${selectedOrg}&limit=500`,
        { headers }
      );
      setAccounts(response?.data?.accounts || []);
    } catch (err) {
      // Non-fatal: the config still opens, the account pickers are just empty.
      console.error("Failed to load accounts for settlement config", err?.response?.data?.message);
    }
  };

  const clearingAccounts = accounts.filter(
    (a) => (a.accountCategory || "bank") === "clearing"
  );
  const bankAccounts = accounts.filter(
    (a) => (a.accountCategory || "bank") === "bank"
  );

  const handleDelete = (_id) => {
    if (!canDelete) return;
    setDeleteItemId(_id);
    setDeleteModalOpen(true);
  };

  const handleDeleteClick = async () => {
    if (!deleteItemId) return;
    if (!canDelete) return;

    try {
      await axios.delete(`${BASE_URL}/daily-reports/payment-methods/delete/${deleteItemId}`, {
        headers,
      });
      notifySuccess(t("accountsSettings.paymentMethods.deleteSuccess", "Payment method deleted successfully"));
      fetchItems(organization);
    } catch (err) {
      notifyError(t("accountsSettings.paymentMethods.deleteFailed", "Failed to delete payment method"));
      setError(t("accountsSettings.paymentMethods.deleteFailed", "Failed to delete payment method"));
    } finally {
      setDeleteModalOpen(false);
      setDeleteItemId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!canUpdate) return;
    try {
      const payload = {
        name: item.name,
        code: item.code,
        description: item.description,
        status: item.status === "Active" ? "Inactive" : "Active",
        type: item.type || "Cash",
      };
      await axios.put(
        `${BASE_URL}/daily-reports/payment-methods/update/${item._id}`,
        payload,
        { headers }
      );
      notifySuccess(t("accountsSettings.paymentMethods.statusUpdated", "Payment method status updated"));
      fetchItems(organization);
    } catch (err) {
      notifyError(t("accountsSettings.paymentMethods.statusFailed", "Failed to update payment method status"));
      setError(t("accountsSettings.paymentMethods.statusFailed", "Failed to update payment method status"));
    }
  };

  const handleSeedMalaysianMethods = async () => {
    if (!organization || !canAdd) return;

    try {
      setSeeding(true);
      const payload = {
        business_id: organization,
      };

      const response = await axios.post(
        `${BASE_URL}/daily-reports/payment-methods/seed-malaysian`,
        payload,
        { headers }
      );

      notifySuccess(response?.data?.message || t("accountsSettings.paymentMethods.seedSuccess", "Malaysian payment methods seeded successfully"));
      await fetchItems(organization);
    } catch (err) {
      notifyError(err?.response?.data?.message || t("accountsSettings.paymentMethods.seedFailed", "Failed to seed Malaysian payment methods"));
    } finally {
      setSeeding(false);
    }
  };

  const filters = [
    {
      value: statusFilter || "",
      onChange: (value) => {
        setStatusFilter(value || "");
        setCurrentPage(1);
      },
      placeholder: t("accountsSettings.paymentMethods.selectStatus", "Select Status"),
      options: [
        { value: "", label: t("accountsSettings.paymentMethods.allStatuses", "All Statuses") },
        { value: "Active", label: t("common.active") },
        { value: "Inactive", label: t("common.inactive") },
      ],
    },
  ];

  const paginatedItems = items.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  return (
    <>
      {!isOrgLoaded && !organization ? (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <Loader fullContainer={true} />
        </div>
      ) : error ? (
        <div>Error: {error}</div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex justify-between items-center w-full mb-6">
            <div className="text-lg font-semibold text-gray-700 flex items-center">
              {t("accountsSettings.paymentMethods.activeTitle", "Active payment methods")}
            </div>
            <div className="flex space-x-4">
              {canAdd && (
                <button
                  onClick={handleSeedMalaysianMethods}
                  disabled={seeding}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {seeding ? t("accountsSettings.paymentMethods.seeding", "Seeding...") : t("accountsSettings.paymentMethods.seedMalaysian", "Seed Malaysian Methods")}
                </button>
              )}
              {canAdd && (
                <button
                  onClick={handleAddNew}
                  className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {t("accountsSettings.paymentMethods.addNew", "Add New")}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              loading={loading}
              searchValue={searchTerm}
              onSearch={(value) => {
                setSearchTerm(value ? value.trim() : "");
                setCurrentPage(1);
              }}
              searchPlaceholder={t("accountsSettings.paymentMethods.searchPlaceholder", "Search payment methods...")}
              filters={filters}
              totalRecords={items.length}
              recordsPerPage={recordsPerPage}
              onRecordsPerPageChange={(perPage) => {
                setRecordsPerPage(perPage);
                setCurrentPage(1);
              }}
              totalPages={Math.ceil(items.length / recordsPerPage)}
              currentPage={currentPage}
              onPageChange={(page) => setCurrentPage(page)}
              emptyMessage={t("No data available")}
              headers={[
                t("common.name"),
                t("common.code"),
                t("accountsSettings.paymentMethods.type"),
                t("common.description"),
                t("common.status"),
                t("common.actions"),
              ]}
              data={paginatedItems}
              renderRow={(item) => (
                <tr key={item._id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{item.name}</td>
                  <td className="px-4 py-2 text-sm">{item.code}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      item.type === "Cash" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {(item.type || "Cash") === "Cash"
                        ? t("accountsSettings.paymentMethods.typeCash", "Cash")
                        : t("accountsSettings.channels.typeOnlineShort", "Online")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">{item.description || "-"}</td>
                  <td className="px-4 py-2 text-sm">
                    <ToggleSwitch
                      isOn={item.status === "Active"}
                      handleToggle={() => handleToggleStatus(item)}
                      disabled={!canUpdate}
                    />
                  </td>
                  <td className="px-4 py-2 text-sm font-medium">
                    <div className="flex space-x-2 items-center">
                      <ActionButtons
                        rbac={{
                          canUpdate,
                          canDelete,
                        }}
                        items={[
                          {
                            tooltip: t("common.edit"),
                            action: ACTION_BUTTON_TYPES.EDIT,
                            onClick: () => handleEdit(item),
                          },
                          {
                            tooltip: t("common.delete"),
                            action: ACTION_BUTTON_TYPES.DELETE,
                            onClick: () => handleDelete(item._id),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>
        </div>
      )}
      <AddEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editItem}
        onSubmit={handleSubmit}
        canSubmit={editItem ? canUpdate : canAdd}
        clearingAccounts={clearingAccounts}
        bankAccounts={bankAccounts}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteClick}
      />
    </>
  );
};

export default PaymentMethodsSettings;
