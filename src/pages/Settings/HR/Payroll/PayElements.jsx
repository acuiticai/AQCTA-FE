import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineEdit, AiOutlineDelete } from "react-icons/ai";
import { Layers, Plus, Settings } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../../app-layout";
import CustomPagination from "@/components/CustomPagination";
import SettingsOrgBanner from "../../SettingsOrgBanner";
import { notifyError, notifySuccess } from "@/utils/toast";
import ConfirmationModal from "@/pages/Customer/reusablecomponents/ConfirmationModal ";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PayElements = () => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });

  const categoryLabels = {
    earning: tp("payElements.category.earning", "Earning"),
    deduction: tp("payElements.category.deduction", "Deduction"),
  };
  const subtypeLabels = {
    basic_salary: tp("payElements.subType.basic_salary", "Basic Salary"),
    fixed_allowance: tp("payElements.subType.fixed_allowance", "Fixed Allowance"),
    non_fixed_allowance: tp(
      "payElements.subType.non_fixed_allowance",
      "Non-Fixed Allowance",
    ),
    overtime: tp("payElements.subType.overtime", "Overtime"),
    bonus: tp("payElements.subType.bonus", "Bonus"),
    commission: tp("payElements.subType.commission", "Commission"),
    arrears: tp("payElements.subType.arrears", "Arrears"),
    directors_fee: tp("payElements.subType.directors_fee", "Director's Fee"),
    claims: tp("payElements.subType.claims", "Claims"),
    epf_employee: tp("payElements.subType.epf_employee", "EPF Employee"),
    epf_employer: tp("payElements.subType.epf_employer", "EPF Employer"),
    socso_employee: tp("payElements.subType.socso_employee", "SOCSO Employee"),
    socso_employer: tp("payElements.subType.socso_employer", "SOCSO Employer"),
    eis_employee: tp("payElements.subType.eis_employee", "EIS Employee"),
    eis_employer: tp("payElements.subType.eis_employer", "EIS Employer"),
    pcb: tp("payElements.subType.pcb", "PCB"),
    zakat: tp("payElements.subType.zakat", "Zakat"),
    hrdf: tp("payElements.subType.hrdf", "HRDF"),
    unpaid_leave: tp("payElements.subType.unpaid_leave", "Unpaid Leave"),
    advance: tp("payElements.subType.advance", "Advance"),
    loan: tp("payElements.subType.loan", "Loan"),
    late_penalty: tp("payElements.subType.late_penalty", "Late Penalty"),
    other: tp("payElements.subType.other", "Other"),
  };
  const calcLabels = {
    fixed: tp("payElements.calc.fixed", "Fixed Amount"),
    percentage_of_basic: tp("payElements.calc.percentage_of_basic", "% of Basic"),
    per_hour: tp("payElements.calc.per_hour", "Per Hour"),
    per_day: tp("payElements.calc.per_day", "Per Day"),
    per_ot_hour: tp("payElements.calc.per_ot_hour", "Per OT Hour"),
    manual: tp("payElements.calc.manual", "Manual"),
    statutory_table: tp("payElements.calc.statutory_table", "Statutory Table"),
  };
  const contributeLabels = {
    epf: tp("payElements.contribute.epf", "EPF"),
    socso: tp("payElements.contribute.socso", "SOCSO"),
    eis: tp("payElements.contribute.eis", "EIS"),
    pcb: tp("payElements.contribute.pcb", "PCB"),
    hrdf: tp("payElements.contribute.hrdf", "HRDF"),
  };

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [filterCategory, setFilterCategory] = useState("");
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
  }, [selectedOrg, filterCategory]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const params = { business: selectedOrg };
      if (filterCategory) params.category = filterCategory;
      const { data } = await axios.get(
        `${Base_URL}/payroll/pay-element-types`,
        { params },
      );
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
        "payElements.confirm.seedMessage",
        "Seed default pay elements for this business? This only works if none exist yet.",
      ),
      confirmText: tp("seed", "Seed"),
      onConfirm: async () => {
        try {
          await axios.post(
            `${Base_URL}/payroll/pay-element-types/seed-defaults`,
            { business: selectedOrg },
          );
          fetchItems();
          notifySuccess(
            tp(
              "payElements.toast.seedSuccess",
              "Default pay elements seeded successfully",
            ),
          );
        } catch (err) {
          notifyError(
            err.response?.data?.message ||
              tp("payElements.toast.seedFailed", "Failed to seed defaults"),
          );
        }
      },
    });
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    openConfirmModal({
      title: tp("payElements.confirm.deleteTitle", "Delete Pay Element"),
      message: tp(
        "payElements.confirm.deleteMessage",
        "Delete this pay element type?",
      ),
      confirmText: tp("delete", "Delete"),
      onConfirm: async () => {
        try {
          await axios.delete(`${Base_URL}/payroll/pay-element-types/${id}`);
          fetchItems();
          notifySuccess(
            tp("payElements.toast.deleteSuccess", "Pay element deleted"),
          );
        } catch (err) {
          console.error(err);
          notifyError(
            err.response?.data?.message ||
              tp(
                "payElements.toast.deleteFailed",
                "Failed to delete pay element",
              ),
          );
        }
      },
    });
  };

  const totalResults = items.length;
  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;
  const currentRecords = items.slice(indexOfFirst, indexOfLast);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, filterCategory]);

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--p-blue)]" />
            {tp("payElements.pageTitle", "Pay Element Types")}
          </h1>
        </div>

        <SettingsOrgBanner />

        {!selectedOrg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4 text-sm">
            {tp(
              "payElements.selectBusinessBanner",
              "Select a business to manage pay element types.",
            )}
          </div>
        )}

        <div className="mb-6 flex justify-between items-center">
          <div className="flex gap-2">
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
                {tp("payElements.addNew", "Add New")}
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {tp("payElements.filter", "Filter:")}
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
          >
            <option value="">
              {tp("payElements.allCategories", "All Categories")}
            </option>
            <option value="earning">
              {tp("payElements.earnings", "Earnings")}
            </option>
            <option value="deduction">
              {tp("payElements.deductions", "Deductions")}
            </option>
          </select>
        </div>

        <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-center">{tp("loading", "Loading...")}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table
                  className="w-full divide-y divide-gray-100"
                  style={{ minWidth: "900px" }}
                >
                  <thead className="bg-gradient-to-r from-gray-50 to-slate-50">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("code", "Code")}
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("name", "Name")}
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("payElements.table.category", "Category")}
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("payElements.table.subType", "Sub-Type")}
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("payElements.table.calculation", "Calculation")}
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("payElements.table.contributesTo", "Contributes To")}
                      </th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {tp("status", "Status")}
                      </th>
                      <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-gray-50 to-slate-50">
                        {tp("actions", "Actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-4 text-center text-sm text-gray-500"
                        >
                          {tp("payElements.empty", "No pay elements found")}
                        </td>
                      </tr>
                    ) : (
                      currentRecords.map((item) => (
                        <tr
                          key={item._id}
                          className="hover:bg-blue-50/40 transition-colors duration-150"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                            {item.code}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${item.category === "earning" ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 ring-1 ring-rose-200"}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${item.category === "earning" ? "bg-emerald-500" : "bg-rose-500"}`}
                              />
                              {categoryLabels[item.category]}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {subtypeLabels[item.subType] || item.subType}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {calcLabels[item.calculationMethod] ||
                              item.calculationMethod}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="whitespace-nowrap">
                              {[
                                item.contributesTo?.epf && contributeLabels.epf,
                                item.contributesTo?.socso &&
                                  contributeLabels.socso,
                                item.contributesTo?.eis && contributeLabels.eis,
                                item.contributesTo?.pcb && contributeLabels.pcb,
                                item.contributesTo?.hrdf &&
                                  contributeLabels.hrdf,
                              ]
                                .filter(Boolean)
                                .join(", ") || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${item.status ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 ring-1 ring-gray-200"}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${item.status ? "bg-emerald-500" : "bg-gray-400"}`}
                              />
                              {item.status
                                ? tp("active", "Active")
                                : tp("inactive", "Inactive")}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white">
                            <div className="flex gap-2 justify-end">
                              {canUpdate && (
                                <button
                                  onClick={() => {
                                    setEditItem(item);
                                    setShowModal(true);
                                  }}
                                  className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                                  title={tp("edit", "Edit")}
                                >
                                  <AiOutlineEdit size={18} />
                                </button>
                              )}
                              {canDelete && !item.isSystemDefined && (
                                <button
                                  onClick={() => handleDelete(item._id)}
                                  className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                                  title={tp("delete", "Delete")}
                                >
                                  <AiOutlineDelete size={18} />
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
              {totalResults > 0 && (
                <div className="px-4 py-3 border-t flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    {tp("show", "Show")}
                    <select
                      value={recordsPerPage}
                      onChange={(e) => {
                        setRecordsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    >
                      {[10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    {tp("entriesRange", "entries ({{from}}-{{to}} of {{total}})", {
                      from: indexOfFirst + 1,
                      to: Math.min(indexOfLast, totalResults),
                      total: totalResults,
                    })}
                  </div>
                  <CustomPagination
                    totalResults={totalResults}
                    resultsPerPage={recordsPerPage}
                    currentPage={currentPage}
                    onChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {showModal && (
          <PayElementModal
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

const PayElementModal = ({ item, selectedOrg, onClose, onSuccess, canSubmit = true }) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });

  const subtypeLabels = {
    basic_salary: tp("payElements.subType.basic_salary", "Basic Salary"),
    fixed_allowance: tp("payElements.subType.fixed_allowance", "Fixed Allowance"),
    non_fixed_allowance: tp(
      "payElements.subType.non_fixed_allowance",
      "Non-Fixed Allowance",
    ),
    overtime: tp("payElements.subType.overtime", "Overtime"),
    bonus: tp("payElements.subType.bonus", "Bonus"),
    commission: tp("payElements.subType.commission", "Commission"),
    arrears: tp("payElements.subType.arrears", "Arrears"),
    directors_fee: tp("payElements.subType.directors_fee", "Director's Fee"),
    claims: tp("payElements.subType.claims", "Claims"),
    epf_employee: tp("payElements.subType.epf_employee", "EPF Employee"),
    epf_employer: tp("payElements.subType.epf_employer", "EPF Employer"),
    socso_employee: tp("payElements.subType.socso_employee", "SOCSO Employee"),
    socso_employer: tp("payElements.subType.socso_employer", "SOCSO Employer"),
    eis_employee: tp("payElements.subType.eis_employee", "EIS Employee"),
    eis_employer: tp("payElements.subType.eis_employer", "EIS Employer"),
    pcb: tp("payElements.subType.pcb", "PCB"),
    zakat: tp("payElements.subType.zakat", "Zakat"),
    hrdf: tp("payElements.subType.hrdf", "HRDF"),
    unpaid_leave: tp("payElements.subType.unpaid_leave", "Unpaid Leave"),
    advance: tp("payElements.subType.advance", "Advance"),
    loan: tp("payElements.subType.loan", "Loan"),
    late_penalty: tp("payElements.subType.late_penalty", "Late Penalty"),
    other: tp("payElements.subType.other", "Other"),
  };
  const calcLabels = {
    fixed: tp("payElements.calc.fixed", "Fixed Amount"),
    percentage_of_basic: tp("payElements.calc.percentage_of_basic", "% of Basic"),
    per_hour: tp("payElements.calc.per_hour", "Per Hour"),
    per_day: tp("payElements.calc.per_day", "Per Day"),
    per_ot_hour: tp("payElements.calc.per_ot_hour", "Per OT Hour"),
    manual: tp("payElements.calc.manual", "Manual"),
    statutory_table: tp("payElements.calc.statutory_table", "Statutory Table"),
  };
  const contributeLabels = {
    epf: tp("payElements.contribute.epf", "EPF"),
    socso: tp("payElements.contribute.socso", "SOCSO"),
    eis: tp("payElements.contribute.eis", "EIS"),
    pcb: tp("payElements.contribute.pcb", "PCB"),
    hrdf: tp("payElements.contribute.hrdf", "HRDF"),
  };

  const isEdit = !!item;
  const [formData, setFormData] = useState({
    business: selectedOrg,
    name: item?.name || "",
    code: item?.code || "",
    category: item?.category || "earning",
    subType: item?.subType || "fixed_allowance",
    calculationMethod: item?.calculationMethod || "fixed",
    defaultAmount: item?.defaultAmount || 0,
    percentageValue: item?.percentageValue || 0,
    otSlot: item?.otSlot || "",
    contributesTo: item?.contributesTo || {
      epf: false,
      socso: false,
      eis: false,
      pcb: false,
      hrdf: false,
    },
    isTaxable: item?.isTaxable ?? true,
    status: item?.status ?? true,
    sortOrder: item?.sortOrder || 0,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otRates, setOtRates] = useState([]);

  // Fetch OT rates from payroll settings for the current year
  useEffect(() => {
    if (!selectedOrg) return;
    const fetchOtRates = async () => {
      try {
        const year = new Date().getFullYear();
        const { data } = await axios.get(
          `${Base_URL}/payroll/company-settings/${selectedOrg}/${year}`,
        );
        setOtRates(data.otRates || []);
      } catch {
        setOtRates([]);
      }
    };
    fetchOtRates();
  }, [selectedOrg]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith("contributesTo.")) {
      const key = name.split(".")[1];
      setFormData((f) => ({
        ...f,
        contributesTo: { ...f.contributesTo, [key]: checked },
      }));
    } else if (name === "subType" && value === "overtime") {
      setFormData((f) => ({
        ...f,
        subType: value,
        calculationMethod: "per_ot_hour",
      }));
    } else {
      setFormData((f) => ({
        ...f,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

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
      if (isEdit) {
        await axios.put(
          `${Base_URL}/payroll/pay-element-types/${item._id}`,
          formData,
        );
      } else {
        await axios.post(`${Base_URL}/payroll/pay-element-types`, formData);
      }
      onSuccess();
    } catch (err) {
      setErrors({
        form: err.response?.data?.message || tp("failedToSave", "Failed to save"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-bold tracking-tight">
            {isEdit
              ? tp("payElements.modal.editTitle", "Edit Pay Element")
              : tp("payElements.modal.addTitle", "Add Pay Element")}
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
                {tp("payElements.modal.code", "Code")} *
              </label>
              <input
                name="code"
                value={formData.code}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all ${errors.code ? "border-red-500" : "border-gray-300"}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payElements.modal.name", "Name")} *
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all ${errors.name ? "border-red-500" : "border-gray-300"}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payElements.modal.category", "Category")}
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
              >
                <option value="earning">
                  {tp("payElements.category.earning", "Earning")}
                </option>
                <option value="deduction">
                  {tp("payElements.category.deduction", "Deduction")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payElements.modal.subType", "Sub-Type")}
              </label>
              <select
                name="subType"
                value={formData.subType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
              >
                {Object.entries(subtypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payElements.modal.calculationMethod", "Calculation Method")}
              </label>
              <select
                name="calculationMethod"
                value={formData.calculationMethod}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
              >
                {Object.entries(calcLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payElements.modal.defaultAmount", "Default Amount (RM)")}
              </label>
              <input
                type="number"
                name="defaultAmount"
                value={formData.defaultAmount}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
              />
            </div>
          </div>

          {formData.subType === "overtime" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {tp("payElements.modal.otSlot", "OT Slot")}
              </label>
              <select
                name="otSlot"
                value={formData.otSlot}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
              >
                <option value="">
                  {tp("payElements.modal.selectOtSlot", "Select OT Slot")}
                </option>
                {otRates.length > 0
                  ? otRates.map((ot) => (
                      <option key={ot.slot} value={ot.slot}>
                        {ot.label} — {ot.multiplier}x ({ot.description})
                      </option>
                    ))
                  : [1, 2, 3, 4, 5, 6].map((s) => (
                      <option key={s} value={s}>
                        {tp("payElements.modal.slot", "Slot {{n}}", { n: s })}
                      </option>
                    ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {tp("payElements.modal.contributesTo", "Contributes To")}
            </label>
            <div className="flex gap-4 flex-wrap">
              {["epf", "socso", "eis", "pcb", "hrdf"].map((key) => (
                <label key={key} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    name={`contributesTo.${key}`}
                    checked={formData.contributesTo[key] || false}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  {contributeLabels[key]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isTaxable"
                checked={formData.isTaxable}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              {tp("payElements.modal.taxable", "Taxable")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="status"
                checked={formData.status}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              {tp("active", "Active")}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {tp("payElements.modal.sortOrder", "Sort Order")}
            </label>
            <input
              type="number"
              name="sortOrder"
              value={formData.sortOrder}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
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

export default PayElements;
