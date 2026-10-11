import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../../app-layout";
import YearPicker from "@/pages/Payroll/components/YearPicker";
import SettingsOrgBanner from "../../SettingsOrgBanner";
import ConfirmationModal from "@/pages/Customer/reusablecomponents/ConfirmationModal ";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  Settings,
  Clock,
  Calendar,
  Save,
  ChevronDown,
  Play,
  Minus,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
} from "lucide-react";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import PayrollBankAccountSection from "./PayrollBankAccountSection";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TIMEZONE_OPTIONS = [
  "Asia/Kuala_Lumpur",
  "Asia/Singapore",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Manila",
  "Asia/Bangkok",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const MONTH_FALLBACKS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DEFAULT_OT_RATES = [
  { slot: 1, label: "OT1", multiplier: 1.5, description: "Normal day OT" },
  {
    slot: 2,
    label: "OT2",
    multiplier: 1.0,
    description: "Rest day OT (normal hours)",
  },
  {
    slot: 3,
    label: "OT3",
    multiplier: 2.0,
    description: "Rest day OT (excess hours)",
  },
  {
    slot: 4,
    label: "OT4",
    multiplier: 2.0,
    description: "Public holiday OT (normal hours)",
  },
  {
    slot: 5,
    label: "OT5",
    multiplier: 2.0,
    description: "Public holiday OT (excess hours)",
  },
  {
    slot: 6,
    label: "OT6",
    multiplier: 3.0,
    description: "Public holiday OT (rest day)",
  },
];

const OT_DESC_KEYS = [
  "companySettings.defaultOt.ot1.desc",
  "companySettings.defaultOt.ot2.desc",
  "companySettings.defaultOt.ot3.desc",
  "companySettings.defaultOt.ot4.desc",
  "companySettings.defaultOt.ot5.desc",
  "companySettings.defaultOt.ot6.desc",
];

const getDefaultOtRates = (tp) =>
  DEFAULT_OT_RATES.map((ot, i) => ({
    ...ot,
    description: tp(OT_DESC_KEYS[i], ot.description),
  }));

const getDayOrdinal = (day, tp) => {
  const n = Number(day) || 28;
  if (n === 1) return tp("companySettings.ordinal.st", "st");
  if (n === 2) return tp("companySettings.ordinal.nd", "nd");
  if (n === 3) return tp("companySettings.ordinal.rd", "rd");
  return tp("companySettings.ordinal.th", "th");
};

const DeductionFormModal = ({
  deductionForm,
  setDeductionForm,
  deductionSaving,
  saveDeduction,
  isDeductionActive,
}) => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <h4 className="text-base font-semibold text-gray-800">
            {deductionForm._id
              ? tp("companySettings.modal.editDeduction", "Edit Deduction")
              : tp("companySettings.modal.newDeduction", "New Deduction")}
          </h4>
          <button
            onClick={() => setDeductionForm(null)}
            className="p-2 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition-colors"
            aria-label={tp("close", "Close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {tp("code", "Code")}
            </label>
            <input
              value={deductionForm.code}
              onChange={(e) =>
                setDeductionForm((f) => ({
                  ...f,
                  code: e.target.value.toUpperCase(),
                }))
              }
              placeholder={tp(
                "companySettings.placeholder.code",
                "e.g. LOAN_DED",
              )}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {tp("name", "Name")}
            </label>
            <input
              value={deductionForm.name}
              onChange={(e) =>
                setDeductionForm((f) => ({
                  ...f,
                  name: e.target.value,
                }))
              }
              placeholder={tp(
                "companySettings.placeholder.name",
                "e.g. Loan Deduction",
              )}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {tp("companySettings.label.subType", "Sub Type")}
            </label>
            <select
              value={deductionForm.subType || "other"}
              onChange={(e) =>
                setDeductionForm((f) => ({
                  ...f,
                  subType: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            >
              <option value="late_penalty">
                {tp("companySettings.option.latePenalty", "Late Penalty")}
              </option>
              <option value="advance">
                {tp("companySettings.option.advance", "Advance")}
              </option>
              <option value="loan">
                {tp("companySettings.option.loan", "Loan")}
              </option>
              <option value="other">
                {tp("companySettings.option.other", "Other")}
              </option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {tp("defaultAmountRm", "Default Amount (RM)")}
            </label>
            <input
              type="number"
              step="0.01"
              value={deductionForm.defaultAmount ?? ""}
              onFocus={(e) => {
                if (Number(e.target.value) === 0) {
                  setDeductionForm((f) => ({
                    ...f,
                    defaultAmount: "",
                  }));
                }
              }}
              onChange={(e) =>
                setDeductionForm((f) => ({
                  ...f,
                  defaultAmount:
                    e.target.value === "" ? "" : parseFloat(e.target.value),
                }))
              }
              onBlur={() =>
                setDeductionForm((f) => ({
                  ...f,
                  defaultAmount: parseFloat(f.defaultAmount) || 0,
                }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {tp("sortOrder", "Sort Order")}
            </label>
            <input
              type="number"
              value={deductionForm.sortOrder ?? 100}
              onFocus={(e) => {
                if (Number(e.target.value) === 0) {
                  setDeductionForm((f) => ({ ...f, sortOrder: "" }));
                }
              }}
              onChange={(e) =>
                setDeductionForm((f) => ({
                  ...f,
                  sortOrder:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              onBlur={() =>
                setDeductionForm((f) => ({
                  ...f,
                  sortOrder: Number(f.sortOrder) || 100,
                }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDeductionActive(deductionForm.status)}
                onChange={(e) =>
                  setDeductionForm((f) => ({
                    ...f,
                    status: e.target.checked ? "active" : "inactive",
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">
                {tp("active", "Active")}
              </span>
            </label>
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <button
            onClick={() => setDeductionForm(null)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {tp("cancel", "Cancel")}
          </button>
          <button
            onClick={saveDeduction}
            disabled={deductionSaving}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            {deductionSaving
              ? tp("saving", "Saving...")
              : deductionForm._id
                ? tp("update", "Update")
                : tp("create", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
};

const PayrollSettings = () => {
  const { t } = useTranslation();
  const tp = (key, fallback, options) =>
    t(`settingsPage.payroll.${key}`, { defaultValue: fallback, ...options });

  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const location = useLocation();
  const selectedOrg = new URLSearchParams(location.search).get("selectedOrg");
  const [year, setYear] = useState(new Date().getFullYear());

  const getDefaultFormData = () => ({
    business: selectedOrg,
    year,
    defaultWorkingDaysPerMonth: 26,
    defaultWorkingHoursPerDay: 8,
    unpaidLeaveCalculation: "calendar_days",
    otRates: getDefaultOtRates(tp),
    payDay: 28,
    autoRunEnabled: false,
    autoRunTime: "09:00",
    autoRunTimezone: "Asia/Kuala_Lumpur",
    payrollMonthMode: "current_month",
    payrollReminderEnabled: false,
    payrollReminderDaysBefore: 3,
    payrollReminderTime: "09:00",
  });

  const [formData, setFormData] = useState(getDefaultFormData());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSuccess, setMessageSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    general: true,
    autoRun: false,
    reminder: false,
    overtime: false,
    monthly: false,
    deductions: false,
  });
  const toggleSection = (key) =>
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }));

  // Manual Deductions CRUD state
  const [manualDeductions, setManualDeductions] = useState([]);
  const [deductionForm, setDeductionForm] = useState(null); // null=closed, object=editing/adding
  const [deductionSaving, setDeductionSaving] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [autoCalculatingWorkingDays, setAutoCalculatingWorkingDays] =
    useState(false);
  const [
    suggestedCurrentMonthWorkingDays,
    setSuggestedCurrentMonthWorkingDays,
  ] = useState(null);
  const [isLoadingSuggestedWorkingDays, setIsLoadingSuggestedWorkingDays] =
    useState(false);
  const [deleteDeductionId, setDeleteDeductionId] = useState("");

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthLabel = tp(
    `companySettings.months.${MONTH_KEYS[currentMonth - 1]}`,
    MONTH_FALLBACKS[currentMonth - 1],
  );

  const normalizeDeductionStatus = (status) => {
    if (status === "active" || status === true) return "active";
    if (status === "inactive" || status === false) return "inactive";
    return "active";
  };

  const isDeductionActive = (status) =>
    normalizeDeductionStatus(status) === "active";

  const deductionSubTypeLabel = (subType) => {
    if (!subType) return "";
    const map = {
      late_penalty: tp("companySettings.option.latePenalty", "Late Penalty"),
      advance: tp("companySettings.option.advance", "Advance"),
      loan: tp("companySettings.option.loan", "Loan"),
      other: tp("companySettings.option.other", "Other"),
    };
    return (
      map[subType] ||
      tp(`payElements.subType.${subType}`, subType.replace(/_/g, " "))
    );
  };

  const calcMethodLabel = (method) => {
    if (!method) return "";
    return tp(`payElements.calc.${method}`, method.replace(/_/g, " "));
  };

  const fetchManualDeductions = async () => {
    if (!selectedOrg) return;
    try {
      const { data } = await axios.get(
        `${Base_URL}/payroll/pay-element-types`,
        {
          params: { business: selectedOrg, category: "deduction" },
        },
      );
      // Show only manual (non-statutory) deduction elements
      const EXCLUDED_SUB_TYPES = [
        "epf_employee",
        "epf_employer",
        "socso_employee",
        "socso_employer",
        "eis_employee",
        "eis_employer",
        "pcb",
        "hrdf",
        "zakat",
        "unpaid_leave",
      ];
      setManualDeductions(
        (data || [])
          .filter((e) => !EXCLUDED_SUB_TYPES.includes(e?.subType))
          .map((e) => ({
            ...e,
            status: normalizeDeductionStatus(e?.status),
          })),
      );
    } catch {
      setManualDeductions([]);
    }
  };

  const saveDeduction = async () => {
    if ((deductionForm?._id && !canUpdate) || (!deductionForm?._id && !canAdd))
      return;
    if (!deductionForm?.name || !deductionForm?.code)
      return notifyError(
        tp(
          "companySettings.toast.nameCodeRequired",
          "Name and Code are required",
        ),
      );
    setDeductionSaving(true);
    try {
      if (deductionForm._id) {
        await axios.put(
          `${Base_URL}/payroll/pay-element-types/${deductionForm._id}`,
          {
            ...deductionForm,
            business: selectedOrg,
            status: normalizeDeductionStatus(deductionForm.status),
          },
        );
        notifySuccess(
          tp("companySettings.toast.deductionUpdated", "Deduction updated"),
        );
      } else {
        await axios.post(`${Base_URL}/payroll/pay-element-types`, {
          ...deductionForm,
          business: selectedOrg,
          category: "deduction",
          calculationMethod: "manual",
          status: normalizeDeductionStatus(deductionForm.status),
        });
        notifySuccess(
          tp("companySettings.toast.deductionCreated", "Deduction created"),
        );
      }
      setDeductionForm(null);
      fetchManualDeductions();
    } catch (err) {
      notifyError(
        err.response?.data?.message ||
          tp(
            "companySettings.toast.deductionSaveFail",
            "Failed to save deduction",
          ),
      );
    } finally {
      setDeductionSaving(false);
    }
  };

  const deleteDeduction = async (id) => {
    if (!canDelete) return;
    try {
      await axios.delete(`${Base_URL}/payroll/pay-element-types/${id}`);
      notifySuccess(
        tp("companySettings.toast.deductionDeleted", "Deduction deleted"),
      );
      fetchManualDeductions();
    } catch (err) {
      notifyError(
        err.response?.data?.message ||
          tp(
            "companySettings.toast.deductionDeleteFail",
            "Failed to delete deduction",
          ),
      );
    }
  };

  const seedManualDeductions = async () => {
    if (!canAdd) return;
    setSeedingDefaults(true);
    try {
      const { data } = await axios.post(
        `${Base_URL}/payroll/pay-element-types/seed-defaults`,
        { business: selectedOrg },
      );
      notifySuccess(
        data?.message ||
          tp(
            "companySettings.toast.seedSuccess",
            "Default pay elements seeded",
          ),
      );
      fetchManualDeductions();
    } catch (err) {
      notifyError(
        err.response?.data?.message ||
          tp("companySettings.toast.seedFail", "Failed to seed defaults"),
      );
    } finally {
      setSeedingDefaults(false);
    }
  };

  useEffect(() => {
    if (selectedOrg) {
      fetchSettings();
      fetchManualDeductions();
    } else setIsLoading(false);
  }, [selectedOrg, year]);

  const countWorkingDaysInMonth = (calcYear, month, holidaySet) => {
    const daysInMonth = new Date(calcYear, month, 0).getDate();
    let totalWorkingDays = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dt = new Date(Date.UTC(calcYear, month - 1, day));
      const dayOfWeek = dt.getUTCDay();
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPublicHoliday = holidaySet.has(key);

      if (!isWeekend && !isPublicHoliday) totalWorkingDays += 1;
    }

    return totalWorkingDays;
  };

  useEffect(() => {
    const fetchSuggestedWorkingDays = async () => {
      if (!selectedOrg) {
        setSuggestedCurrentMonthWorkingDays(null);
        return;
      }

      setIsLoadingSuggestedWorkingDays(true);
      try {
        const { data } = await axios.post(
          `${Base_URL}/PublicHolidays/get_all`,
          {
            business_id: selectedOrg,
            year,
          },
        );

        const activeHolidays = (data?.data || []).filter(
          (h) => String(h?.status || "").toLowerCase() === "active",
        );
        const holidaySet = new Set(
          activeHolidays
            .map((h) => {
              const d = new Date(h.date);
              if (Number.isNaN(d.getTime())) return "";
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            })
            .filter(Boolean),
        );

        setSuggestedCurrentMonthWorkingDays(
          countWorkingDaysInMonth(year, currentMonth, holidaySet),
        );
      } catch {
        setSuggestedCurrentMonthWorkingDays(null);
      } finally {
        setIsLoadingSuggestedWorkingDays(false);
      }
    };

    fetchSuggestedWorkingDays();
  }, [selectedOrg, year]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(
        `${Base_URL}/payroll/company-settings/${selectedOrg}/${year}`,
      );
      // Strip MongoDB internal fields so they don't leak across years
      const { _id, __v, createdAt, updatedAt, ...cleanData } = data;
      const defaults = getDefaultFormData();
      setFormData({
        ...defaults,
        ...cleanData,
        otRates:
          Array.isArray(cleanData.otRates) && cleanData.otRates.length > 0
            ? cleanData.otRates
            : defaults.otRates,
      });
    } catch {
      setFormData(getDefaultFormData());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canUpdate) return;
    setIsSaving(true);
    setMessage("");
    setMessageSuccess(false);
    try {
      await axios.post(`${Base_URL}/payroll/company-settings`, {
        ...formData,
        business: selectedOrg,
        year,
      });
      setMessage(
        tp(
          "companySettings.toast.saveSuccessInline",
          "Settings saved successfully!",
        ),
      );
      setMessageSuccess(true);
      notifySuccess(
        tp(
          "companySettings.toast.saveSuccessNotify",
          "Company payroll settings saved",
        ),
      );
      setTimeout(() => {
        setMessage("");
        setMessageSuccess(false);
      }, 3000);
    } catch (err) {
      const failMsg =
        err.response?.data?.message ||
        tp("companySettings.toast.saveFail", "Failed to save settings");
      setMessage(failMsg);
      setMessageSuccess(false);
      notifyError(failMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const updateOtRate = (index, field, value) => {
    setFormData((f) => {
      const rates = [...f.otRates];
      rates[index] = {
        ...rates[index],
        [field]:
          field === "multiplier"
            ? value === ""
              ? ""
              : parseFloat(value)
            : value,
      };
      return { ...f, otRates: rates };
    });
  };

  const blurOtRate = (index, field) => {
    if (field === "multiplier") {
      setFormData((f) => {
        const rates = [...f.otRates];
        rates[index] = {
          ...rates[index],
          multiplier: parseFloat(rates[index].multiplier) || 1,
        };
        return { ...f, otRates: rates };
      });
    }
  };

  const calculateBusinessWorkingDays = async () => {
    if (!selectedOrg) return;

    setAutoCalculatingWorkingDays(true);
    try {
      const { data } = await axios.post(`${Base_URL}/PublicHolidays/get_all`, {
        business_id: selectedOrg,
        year,
      });

      const activeHolidays = (data?.data || []).filter(
        (h) => String(h?.status || "").toLowerCase() === "active",
      );

      const holidaySet = new Set(
        activeHolidays
          .map((h) => {
            const d = new Date(h.date);
            if (Number.isNaN(d.getTime())) return "";
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          })
          .filter(Boolean),
      );

      setFormData((f) => {
        const existingMap = new Map(
          (f.monthlySettings || []).map((ms) => [ms.month, ms]),
        );

        const monthlySettings = Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const totalWorkingDays = countWorkingDaysInMonth(
            year,
            month,
            holidaySet,
          );

          return {
            ...(existingMap.get(month) || {}),
            month,
            totalWorkingDays,
          };
        });

        return { ...f, monthlySettings };
      });

      notifySuccess(
        tp(
          "companySettings.toast.autoCalcSuccess",
          "Working days auto-calculated (weekdays minus active public holidays)",
        ),
      );
    } catch (err) {
      notifyError(
        err.response?.data?.message ||
          tp(
            "companySettings.toast.autoCalcFail",
            "Failed to auto-calculate working days from public holidays",
          ),
      );
    } finally {
      setAutoCalculatingWorkingDays(false);
    }
  };

  if (!selectedOrg) {
    return (
      <AppLayout>
        <Header />
        <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-xl font-semibold text-gray-900">
              {tp("companySettings.pageTitle", "Payroll Settings")}
            </h1>
          </div>
          <SettingsOrgBanner />
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
            {tp(
              "companySettings.selectBusinessBanner",
              "Select a business to configure payroll settings.",
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  const payDay = formData.payDay || 28;
  const payDayOrdinal = getDayOrdinal(payDay, tp);

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            {tp("companySettings.pageTitle", "Payroll Settings")}
          </h1>
          <div className="flex items-center gap-3">
            <label className="block text-sm font-medium text-gray-700 mb-0">
              {tp("year", "Year:")}
            </label>
            <YearPicker
              value={year}
              onChange={(yr) =>
                setYear(yr ? Number(yr) : new Date().getFullYear())
              }
              allowAll={false}
              inputClassName="h-[40px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap select-none"
              popupAlign="right"
            />
          </div>
        </div>
        <SettingsOrgBanner />

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${messageSuccess ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}
          >
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-sm text-gray-500">
            {tp("loading", "Loading...")}
          </div>
        ) : (
          <div className="space-y-6">
          <fieldset disabled={!canUpdate} className="space-y-6 border-0 p-0 m-0 min-w-0">
            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-400" />
              <button
                type="button"
                onClick={() => toggleSection("general")}
                className="w-full flex items-center justify-between text-left mb-4"
              >
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Settings className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                  </span>
                  {tp("companySettings.section.general", "General Settings")}
                </h3>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.general ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.general ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {tp(
                        "companySettings.label.workingDaysPerMonth",
                        "Working Days / Month",
                      )}
                    </label>
                    <input
                      type="number"
                      value={formData.defaultWorkingDaysPerMonth}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          defaultWorkingDaysPerMonth:
                            e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      onBlur={() =>
                        setFormData((f) => ({
                          ...f,
                          defaultWorkingDaysPerMonth:
                            Number(f.defaultWorkingDaysPerMonth) || 26,
                        }))
                      }
                      className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        {isLoadingSuggestedWorkingDays
                          ? tp(
                              "companySettings.hint.calculatingSuggestion",
                              "Calculating suggestion...",
                            )
                          : suggestedCurrentMonthWorkingDays == null
                            ? tp(
                                "companySettings.hint.suggestionUnavailable",
                                "Suggestion unavailable",
                              )
                            : tp(
                                "companySettings.hint.suggestedForMonth",
                                "Suggested for {{month}} {{year}}: {{n}} working days (after public holidays)",
                                {
                                  month: currentMonthLabel,
                                  year,
                                  n: suggestedCurrentMonthWorkingDays,
                                },
                              )}
                      </p>
                      {suggestedCurrentMonthWorkingDays != null && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((f) => ({
                              ...f,
                              defaultWorkingDaysPerMonth:
                                suggestedCurrentMonthWorkingDays,
                            }))
                          }
                          className="text-xs font-medium text-[var(--p-blue)] hover:underline whitespace-nowrap"
                        >
                          {tp(
                            "companySettings.useSuggestion",
                            "Use suggestion",
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {tp(
                        "companySettings.label.workingHoursPerDay",
                        "Working Hours / Day",
                      )}
                    </label>
                    <input
                      type="number"
                      value={formData.defaultWorkingHoursPerDay}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          defaultWorkingHoursPerDay:
                            e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      onBlur={() =>
                        setFormData((f) => ({
                          ...f,
                          defaultWorkingHoursPerDay:
                            Number(f.defaultWorkingHoursPerDay) || 8,
                        }))
                      }
                      className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {tp(
                        "companySettings.label.unpaidLeaveCalculation",
                        "Unpaid Leave Calculation",
                      )}
                    </label>
                    <select
                      value={formData.unpaidLeaveCalculation}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          unpaidLeaveCalculation: e.target.value,
                        }))
                      }
                      className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all appearance-none"
                    >
                      <option value="calendar_days">
                        {tp(
                          "companySettings.option.calendarDays",
                          "Calendar Days (total days in month)",
                        )}
                      </option>
                      <option value="working_days">
                        {tp(
                          "companySettings.option.workingDays",
                          "Working Days (26 or configured)",
                        )}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto Payroll Run Section */}
            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-green-400" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Play className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                  </span>
                  {tp(
                    "companySettings.section.autoPayrollRun",
                    "Auto Payroll Run",
                  )}
                </h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.autoRunEnabled === true}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          autoRunEnabled: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-gray-700">
                      {tp("companySettings.enableAutoRun", "Enable Auto Run")}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSection("autoRun")}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={tp(
                      "companySettings.aria.toggleAutoPayrollRun",
                      "Toggle Auto Payroll Run section",
                    )}
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-200 ${expandedSections.autoRun ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.autoRun ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0"}`}
              >
                {formData.autoRunEnabled ? (
                  <div className="space-y-4">
                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
                      {tp(
                        "companySettings.autoRun.enabledHint",
                        "Payroll will automatically be created as a draft on pay day ({{day}}{{ordinal}} of each month) at the specified time.",
                        { day: payDay, ordinal: payDayOrdinal },
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {tp(
                            "companySettings.label.payDay",
                            "Pay Day (day of month)",
                          )}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.payDay}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              payDay:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            }))
                          }
                          onBlur={() =>
                            setFormData((f) => ({
                              ...f,
                              payDay: Number(f.payDay) || 28,
                            }))
                          }
                          className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {tp("companySettings.label.runTime", "Run Time")}
                        </label>
                        <input
                          type="time"
                          value={formData.autoRunTime || "09:00"}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              autoRunTime: e.target.value,
                            }))
                          }
                          className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {tp("companySettings.label.timezone", "Timezone")}
                        </label>
                        <select
                          value={
                            formData.autoRunTimezone || "Asia/Kuala_Lumpur"
                          }
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              autoRunTimezone: e.target.value,
                            }))
                          }
                          className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all appearance-none"
                        >
                          {TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {tp(
                            "companySettings.label.payrollMonth",
                            "Payroll Month",
                          )}
                        </label>
                        <select
                          value={formData.payrollMonthMode || "current_month"}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              payrollMonthMode: e.target.value,
                            }))
                          }
                          className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all appearance-none"
                        >
                          <option value="current_month">
                            {tp(
                              "companySettings.option.currentMonth",
                              "Current Month (pay day falls within the salary month)",
                            )}
                          </option>
                          <option value="previous_month">
                            {tp(
                              "companySettings.option.previousMonth",
                              "Previous Month (salary paid in the following month)",
                            )}
                          </option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {formData.payrollMonthMode === "previous_month"
                        ? tp(
                            "companySettings.example.previousMonth",
                            "Example: On pay day {{day}}th of February, the system will create payroll for January.",
                            { day: payDay },
                          )
                        : tp(
                            "companySettings.example.currentMonth",
                            "Example: On pay day {{day}}th of January, the system will create payroll for January.",
                            { day: payDay },
                          )}
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-sm">
                    {tp(
                      "companySettings.autoRun.disabledHint",
                      "Auto payroll run is disabled. Payroll runs must be created manually from the dashboard.",
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-sky-400" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                    <Calendar className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                  </span>
                  {tp(
                    "companySettings.section.reminderAlerts",
                    "Payroll Reminder Alerts",
                  )}
                </h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.payrollReminderEnabled === true}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          payrollReminderEnabled: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-gray-700">
                      {tp("companySettings.enableAlerts", "Enable Alerts")}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSection("reminder")}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={tp(
                      "companySettings.aria.toggleReminder",
                      "Toggle Payroll Reminder Alerts section",
                    )}
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-200 ${expandedSections.reminder ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.reminder ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
              >
                {formData.payrollReminderEnabled ? (
                  <div className="space-y-4">
                    <div className="px-4 py-3 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-lg text-sm">
                      {tp(
                        "companySettings.reminder.enabledHint",
                        "The system will send the `PAYROLL_REMINDER` notification/email event starting {{n}} day(s) before pay day at {{time}} using the selected timezone ({{tz}}).",
                        {
                          n: Number(formData.payrollReminderDaysBefore || 0),
                          time: formData.payrollReminderTime || "09:00",
                          tz:
                            formData.autoRunTimezone || "Asia/Kuala_Lumpur",
                        },
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {tp(
                            "companySettings.label.startReminder",
                            "Start Reminder (days before pay day)",
                          )}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="31"
                          value={formData.payrollReminderDaysBefore ?? 3}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              payrollReminderDaysBefore:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            }))
                          }
                          onBlur={() =>
                            setFormData((f) => ({
                              ...f,
                              payrollReminderDaysBefore:
                                Number(f.payrollReminderDaysBefore) || 3,
                            }))
                          }
                          className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {tp(
                            "companySettings.label.reminderTime",
                            "Reminder Time",
                          )}
                        </label>
                        <input
                          type="time"
                          value={formData.payrollReminderTime || "09:00"}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              payrollReminderTime: e.target.value,
                            }))
                          }
                          className="w-full h-[42px] px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {tp(
                        "companySettings.reminder.helper",
                        "Recipients, notification text, and email template are managed from Notification Events using the event code PAYROLL_REMINDER.",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-sm">
                    {tp(
                      "companySettings.reminder.disabledHint",
                      "Payroll reminder alerts are disabled.",
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-500 to-orange-400" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Clock className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                  </span>
                  {tp(
                    "companySettings.section.overtimeRates",
                    "Overtime Rates",
                  )}
                </h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.otEnabled !== false}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          otEnabled: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-gray-700">
                      {tp(
                        "companySettings.enableOvertime",
                        "Enable Overtime",
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSection("overtime")}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={tp(
                      "companySettings.aria.toggleOvertime",
                      "Toggle Overtime Rates section",
                    )}
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-200 ${expandedSections.overtime ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.overtime ? "max-h-[1800px] opacity-100" : "max-h-0 opacity-0"}`}
              >
                {formData.otEnabled === false && (
                  <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                    {tp(
                      "companySettings.ot.disabledBanner",
                      "Overtime is disabled globally. No OT will be calculated for any employee regardless of their individual OT settings.",
                    )}
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          {tp("companySettings.table.slot", "Slot")}
                        </th>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          {tp("companySettings.table.label", "Label")}
                        </th>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          {tp("companySettings.table.multiplier", "Multiplier")}
                        </th>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          {tp(
                            "companySettings.table.description",
                            "Description",
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(formData.otRates || []).map((ot, i) => (
                        <tr
                          key={ot.slot}
                          className="hover:bg-blue-50/40 transition-colors duration-150"
                        >
                          <td className="px-6 py-3 font-mono text-sm text-gray-600">
                            {ot.slot}
                          </td>
                          <td className="px-6 py-3">
                            <input
                              value={ot.label}
                              onChange={(e) =>
                                updateOtRate(i, "label", e.target.value)
                              }
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="number"
                              step="0.5"
                              value={ot.multiplier}
                              onChange={(e) =>
                                updateOtRate(i, "multiplier", e.target.value)
                              }
                              onBlur={() => blurOtRate(i, "multiplier")}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              value={ot.description}
                              onChange={(e) =>
                                updateOtRate(i, "description", e.target.value)
                              }
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-400" />
              <button
                type="button"
                className="w-full flex items-center justify-between"
                onClick={() => toggleSection("monthly")}
              >
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Calendar className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                  </span>
                  {tp(
                    "companySettings.section.perMonthOverrides",
                    "Per-Month Overrides",
                  )}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>
                    {tp(
                      "companySettings.monthly.subtitle",
                      "Override working days/hours for specific months",
                    )}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${expandedSections.monthly ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              {expandedSections.monthly && (
                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {tp(
                        "companySettings.monthly.autoCalcRule",
                        "Auto-calc rule: Mon-Fri working days minus active public holidays.",
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={calculateBusinessWorkingDays}
                      disabled={autoCalculatingWorkingDays}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${autoCalculatingWorkingDays ? "animate-spin" : ""}`}
                      />
                      {autoCalculatingWorkingDays
                        ? tp("companySettings.calculating", "Calculating...")
                        : tp(
                            "companySettings.autoCalculateWorkingDays",
                            "Auto-Calculate Working Days",
                          )}
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("companySettings.table.month", "Month")}
                          </th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp(
                              "companySettings.table.workingDays",
                              "Working Days",
                            )}
                          </th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp(
                              "companySettings.table.workingHoursPerDay",
                              "Working Hours/Day",
                            )}
                          </th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp(
                              "companySettings.table.unpaidLeaveDivisor",
                              "Unpaid Leave Divisor",
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = i + 1;
                          const existing =
                            (formData.monthlySettings || []).find(
                              (ms) => ms.month === m,
                            ) || {};
                          const updateMonth = (field, val) => {
                            setFormData((f) => {
                              const arr = [...(f.monthlySettings || [])];
                              const idx = arr.findIndex((ms) => ms.month === m);
                              if (idx >= 0) {
                                arr[idx] = {
                                  ...arr[idx],
                                  [field]: val || undefined,
                                };
                              } else if (val) {
                                arr.push({ month: m, [field]: val });
                              }
                              return { ...f, monthlySettings: arr };
                            });
                          };
                          return (
                            <tr
                              key={m}
                              className="hover:bg-blue-50/40 transition-colors duration-150"
                            >
                              <td className="px-4 py-2 font-medium text-gray-700">
                                {tp(
                                  `companySettings.months.${MONTH_KEYS[i]}`,
                                  MONTH_FALLBACKS[i],
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="31"
                                  placeholder={String(
                                    formData.defaultWorkingDaysPerMonth || 26,
                                  )}
                                  value={existing.totalWorkingDays ?? ""}
                                  onChange={(e) =>
                                    updateMonth(
                                      "totalWorkingDays",
                                      e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  placeholder={String(
                                    formData.defaultWorkingHoursPerDay || 8,
                                  )}
                                  value={existing.totalWorkingHours ?? ""}
                                  onChange={(e) =>
                                    updateMonth(
                                      "totalWorkingHours",
                                      e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="31"
                                  placeholder={tp(
                                    "companySettings.placeholder.auto",
                                    "Auto",
                                  )}
                                  value={existing.totalDaysForUnpaidLeave ?? ""}
                                  onChange={(e) =>
                                    updateMonth(
                                      "totalDaysForUnpaidLeave",
                                      e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 px-4 py-2">
                      {tp(
                        "companySettings.monthly.footerHint",
                        "Leave blank to use the defaults above. Overrides apply only to months with values entered.",
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

            {/* Manual Deductions Management */}
            <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 to-pink-400" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <Minus className="w-4.5 h-4.5 text-red-500" />
                  </span>
                  {tp(
                    "companySettings.section.manualDeductions",
                    "Manual Deduction Options",
                  )}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {canAdd && (
                      <button
                        onClick={seedManualDeductions}
                        disabled={seedingDefaults}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${seedingDefaults ? "animate-spin" : ""}`}
                        />
                        {tp("seedDefaults", "Seed Defaults")}
                      </button>
                    )}
                    {canAdd && (
                      <button
                        onClick={() =>
                          setDeductionForm({
                            name: "",
                            code: "",
                            subType: "other",
                            defaultAmount: 0,
                            sortOrder: 100,
                            status: "active",
                          })
                        }
                        className="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1.5"
                        style={{ backgroundColor: "var(--p-blue)" }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {tp(
                          "companySettings.addDeduction",
                          "Add Deduction",
                        )}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSection("deductions")}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={tp(
                      "companySettings.aria.toggleDeductions",
                      "Toggle Manual Deduction Options section",
                    )}
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-200 ${expandedSections.deductions ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.deductions ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
              >
                <p className="text-xs text-gray-500 mb-4">
                  {tp(
                    "companySettings.deductions.helper",
                    "Configure manual deduction types that appear in the payroll adjustment dropdown. Statutory deductions (EPF, SOCSO, EIS, PCB) are managed separately.",
                  )}
                </p>

                {manualDeductions.length === 0 ? (
                  <div className="px-4 py-6 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg text-sm text-center">
                    {tp(
                      "companySettings.deductions.empty",
                      'No manual deduction types configured. Click "Seed Defaults" to create standard deduction types, or add custom ones.',
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("code", "Code")}
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("name", "Name")}
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("companySettings.table.subType", "Sub Type")}
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("companySettings.table.method", "Method")}
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp(
                              "companySettings.table.defaultAmt",
                              "Default Amt",
                            )}
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("status", "Status")}
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            {tp("actions", "Actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {manualDeductions.map((d) => (
                          <tr
                            key={d._id}
                            className="hover:bg-blue-50/40 transition-colors duration-150"
                          >
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                              {d.code}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-800 font-medium">
                              {d.name}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">
                              {deductionSubTypeLabel(d.subType)}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">
                              {calcMethodLabel(d.calculationMethod)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-600">
                              {d.defaultAmount
                                ? tp("companySettings.rmAmount", "RM {{amount}}", {
                                    amount: d.defaultAmount,
                                  })
                                : tp("emDash", "—")}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${isDeductionActive(d.status) ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {isDeductionActive(d.status)
                                  ? tp("active", "Active")
                                  : tp("inactive", "Inactive")}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canUpdate && (
                                  <button
                                    onClick={() =>
                                      setDeductionForm({
                                        ...d,
                                        status: normalizeDeductionStatus(
                                          d?.status,
                                        ),
                                      })
                                    }
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title={tp("edit", "Edit")}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDelete && !d.isSystemDefined && (
                                  <button
                                    onClick={() => setDeleteDeductionId(d._id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title={tp("delete", "Delete")}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Payroll bank account / reconciliation wiring */}
            <div className="mt-4">
              <PayrollBankAccountSection business={selectedOrg} />
            </div>

            {/* Add / Edit Deduction modal */}
            {deductionForm && (
              <DeductionFormModal
                deductionForm={deductionForm}
                setDeductionForm={setDeductionForm}
                deductionSaving={deductionSaving}
                saveDeduction={saveDeduction}
                isDeductionActive={isDeductionActive}
              />
            )}

            {canUpdate && (
              <div className="flex justify-end items-center mt-6 space-x-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  style={{ backgroundColor: "var(--p-blue)" }}
                >
                  <Save className="w-4 h-4" />
                  {isSaving
                    ? tp("saving", "Saving...")
                    : tp("companySettings.saveSettings", "Save Settings")}
                </button>
              </div>
            )}

            <ConfirmationModal
              isOpen={!!deleteDeductionId}
              onClose={() => setDeleteDeductionId("")}
              onConfirm={async () => {
                const id = deleteDeductionId;
                setDeleteDeductionId("");
                if (id) await deleteDeduction(id);
              }}
              title={tp(
                "companySettings.confirm.deleteTitle",
                "Delete Deduction",
              )}
              message={tp(
                "companySettings.confirm.deleteMessage",
                "Delete this deduction type?",
              )}
              confirmText={tp("delete", "Delete")}
              cancelText={tp("cancel", "Cancel")}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PayrollSettings;
