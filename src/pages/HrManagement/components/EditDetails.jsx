import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
} from "react";
import {
  Search,
  Building2,
  CalendarDays,
  Edit,
  Eye,
  Download,
  Plus,
  PenLine,
  Upload,
  FileText,
  Shield,
  X,
  RefreshCcw,
} from "lucide-react";
import Link from "react-router-dom/Link";
import { User, Award, Calendar, ChevronDown } from "lucide-react";
import axios from "axios";
import EmploymentRecordEditModal from "./StaffManagement/EmploymentRecordEditModal";
import EmploymentRecordPreviousRoleModal from "./StaffManagement/EmploymentRecordPreviousRoleModal";
import EmpoymentStatusModel from "./StaffManagement/EmpoymentStatusModel";
import { toast } from "react-toastify";
import ApplyLeaveForm from "./ApplyLeaveForm";
import NewClaimForm from "./NewClaimForm";
import { CheckIcon, XIcon } from "@heroicons/react/outline";
import { CustomDatePicker, CurrencyDropdown } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatStaffBranchLocationsCell } from "@/utils/staffBranchLocationsForm";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import CustomPagination from "@/components/CustomPagination";
import { Select } from "@windmill/react-ui";
import tickCircle from "../../../assets/img/icons/tick-circle.png";
import closeCircle from "../../../assets/img/icons/close-circle.png";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";
import useAsync from "@/hooks/useAsync";
import CurrencyServices from "@/services/CurrencyServices";
import PcbClaimsInputs from "@/pages/Payroll/components/PcbClaimsInputs";
import { AdminContext } from "@/context/AdminContext";

const TAB_CONFIG = [
  {
    label: "System User Account",
    description: "Manage login access, linked account details, and credentials.",
    icon: Shield,
  },
  {
    label: "Contact Information",
    description: "Personal details, addresses, and contact methods.",
    icon: User,
  },
  {
    label: "Employment Record",
    description: "Roles, departments, history, and employment changes.",
    icon: PenLine,
  },
  {
    label: "Leaves",
    description: "Track leave requests, approvals, and balances.",
    icon: Calendar,
  },
  {
    label: "Claims",
    description: "Review claims, statuses, and supporting documents.",
    icon: FileText,
  },
  {
    label: "Documents",
    description: "View uploaded staff files and related paperwork.",
    icon: Download,
  },
  {
    label: "Educational Certificates",
    description: "Manage qualifications, certificates, and completion details.",
    icon: Award,
  },
  {
    label: "Emergency Contact",
    description: "Store and update emergency contact information.",
    icon: Shield,
  },
  {
    label: "Events",
    description: "Browse staff events, milestones, and scheduled records.",
    icon: CalendarDays,
  },
  {
    label: "Bank Details",
    description: "Keep payroll-ready banking information organized.",
    icon: Building2,
  },
  {
    label: "Payroll",
    description: "Maintain salary, statutory, and tax profile settings.",
    icon: RefreshCcw,
  },
];

/** Scroll tab rail so the active tab aligns to the top (lg) / start (horizontal) of the visible rail, including last items. */
function scrollTabIntoRailStart(tabRail, tabEl, behavior = "smooth") {
  if (!tabRail || !tabEl) return;

  const railRect = tabRail.getBoundingClientRect();
  const tabRect = tabEl.getBoundingClientRect();

  let nextTop = tabRail.scrollTop + (tabRect.top - railRect.top);
  let nextLeft = tabRail.scrollLeft + (tabRect.left - railRect.left);

  const maxTop = Math.max(0, tabRail.scrollHeight - tabRail.clientHeight);
  const maxLeft = Math.max(0, tabRail.scrollWidth - tabRail.clientWidth);

  nextTop = Math.min(Math.max(0, nextTop), maxTop);
  nextLeft = Math.min(Math.max(0, nextLeft), maxLeft);

  tabRail.scrollTo({
    top: nextTop,
    left: nextLeft,
    behavior,
  });
}

const TabHeader = ({
  activeTab,
  setActiveTab,
  tabs,
  tabButtonRefs,
  tabRailRef,
  onTabSelect,
}) => {
  return (
    <aside className="w-full lg:w-[320px] lg:border-r lg:border-slate-200/80 lg:bg-slate-50/80 lg:max-h-none">
      <div className="p-4 md:p-5 lg:sticky lg:top-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div
            ref={tabRailRef}
            className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto lg:max-h-[calc(100dvh-7rem)] lg:overscroll-contain lg:pb-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab, index) => {
              const isActive = activeTab === index;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.label}
                  type="button"
                  ref={(el) => {
                    if (el) tabButtonRefs.current[index] = el;
                  }}
                  onClick={() => {
                    onTabSelect?.(index);
                    setActiveTab(index);
                  }}
                  className={`group flex min-w-[220px] w-full shrink-0 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all lg:min-w-0 ${
                    isActive
                      ? "border-[var(--p-blue)] bg-[rgba(242,144,16,0.08)] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isActive
                        ? "bg-[var(--p-blue)] text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-semibold ${
                        isActive ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {tab.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

const PayrollProfileTab = ({ id, staffFormData }) => {
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const [employee, setEmployee] = useState(null);
  const [businessId, setBusinessId] = useState("");
  const [fallbackBusinessId, setFallbackBusinessId] = useState("");
  const [payGroups, setPayGroups] = useState([]);
  const [payElements, setPayElements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    compensation: true,
    allowances: false,
    references: false,
    statutory: false,
    tax: false,
  });
  const toggleSection = (key) =>
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }));
  const [formData, setFormData] = useState({
    basicSalary: 0,
    payType: "monthly",
    payGroup: "",
    otEnabled: true,
    epfEnabled: true,
    socsoEnabled: true,
    eisEnabled: true,
    pcbEnabled: true,
    hrdfEnabled: false,
    epfCategory: "part_a",
    socsoCategory: "first_category",
    taxResidentStatus: "resident",
    maritalStatusForTax: "single",
    childrenForTaxRelief: {
      under18: 0,
      studying: 0,
      studyingDiploma: 0,
      disabled: 0,
      disabledStudying: 0,
    },
    individualDisability: false,
    spouseDisability: false,
    epfNumber: "",
    socsoNumber: "",
    taxFileNumber: "",
    eisNumber: "",
    allowances: [],
    pcbClaims: {
      tp1: {
        totalDeductionsAnnual: 0,
        zakatAnnual: 0,
        umrahAnnual: 0,
      },
      tp3: {
        previousPcbPaid: 0,
        previousEmploymentMonthsWorked: 0,
        previousEmploymentMonthlyGrossRemuneration: 0,
        previousEmploymentMonthlyTaxExemptAllowances: 0,
        previousEmploymentApprovedEpfContributionsAnnual: 0,
        previousEmploymentZakatAnnual: 0,
        previousEmploymentUmrahExemptionLevyAnnual: 0,
      },
    },
  });

  useEffect(() => {
    const fetchPayrollProfile = async () => {
      if (!id) {
        setIsLoading(false);
        setMessage("Employee ID is missing");
        return;
      }
      setIsLoading(true);
      try {
        const headers = {
          authorization: `Bearer ${adminInfo?.token || ""}`,
        };
        const { data: emp } = await axios.get(
          `${Base_URL}/staff-management/${id}`,
          {
            headers,
          },
        );
        setEmployee(emp);
        let biz =
          emp?.business?._id ||
          emp?.business ||
          emp?.business_id ||
          staffFormData?.business?._id ||
          staffFormData?.business ||
          staffFormData?.business_id ||
          "";

        if (!biz && adminInfo?.id) {
          try {
            const { data } = await axios.get(
              `${Base_URL}/admin/assigned/${adminInfo.id}`,
              { headers },
            );
            const firstAssigned = data?.businesses?.[0]?._id || "";
            if (firstAssigned) {
              biz = firstAssigned;
              setFallbackBusinessId(firstAssigned);
            }
          } catch (e) {
            console.error("Failed assigned business fallback:", e);
          }
        }
        setBusinessId(biz);

        if (!biz) {
          setMessage("Business ID is missing for this employee");
          setIsLoading(false);
          return;
        }

        const [profileRes, groupsRes, elementsRes] = await Promise.all([
          axios
            .get(`${Base_URL}/payroll/employee-profiles/by-employee/${id}`, {
              params: { business: biz },
            })
            .catch(() => ({ data: null })),
          axios
            .get(`${Base_URL}/payroll/pay-groups`, {
              params: { business: biz },
            })
            .catch(() => ({ data: [] })),
          axios
            .get(`${Base_URL}/payroll/pay-element-types`, {
              params: { business: biz, category: "earning" },
            })
            .catch(() => ({ data: [] })),
        ]);

        setPayGroups(groupsRes.data || []);
        setPayElements(
          elementsRes.data?.filter(
            (e) => e.subType !== "basic_salary" && e.subType !== "overtime",
          ) || [],
        );

        if (profileRes.data) {
          const p = profileRes.data;
          setFormData({
            basicSalary: p.basicSalary || 0,
            payType: p.payType || "monthly",
            payGroup: p.payGroup?._id || p.payGroup || "",
            otEnabled: p.otEnabled ?? true,
            epfEnabled: p.epfEnabled ?? true,
            socsoEnabled: p.socsoEnabled ?? true,
            eisEnabled: p.eisEnabled ?? true,
            pcbEnabled: p.pcbEnabled ?? true,
            hrdfEnabled: p.hrdfEnabled ?? false,
            epfCategory: p.epfCategory || "part_a",
            socsoCategory: p.socsoCategory || "first_category",
            taxResidentStatus: p.taxResidentStatus || "resident",
            maritalStatusForTax: p.maritalStatusForTax || "single",
            childrenForTaxRelief: p.childrenForTaxRelief || {
              under18: 0,
              studying: 0,
              studyingDiploma: 0,
              disabled: 0,
              disabledStudying: 0,
            },
            individualDisability: p.individualDisability ?? false,
            spouseDisability: p.spouseDisability ?? false,
            epfNumber: p.epfNumber || "",
            socsoNumber: p.socsoNumber || "",
            taxFileNumber: p.taxFileNumber || "",
            eisNumber: p.eisNumber || "",
            allowances: p.allowances || [],
            pcbClaims: {
              tp1: {
                totalDeductionsAnnual:
                  p?.pcbClaims?.tp1?.totalDeductionsAnnual ?? 0,
                zakatAnnual: p?.pcbClaims?.tp1?.zakatAnnual ?? 0,
                umrahAnnual: p?.pcbClaims?.tp1?.umrahAnnual ?? 0,
                deductions: p?.pcbClaims?.tp1?.deductions || {},
                rebates: p?.pcbClaims?.tp1?.rebates || {},
              },
              tp3: {
                previousPcbPaid: p?.pcbClaims?.tp3?.previousPcbPaid ?? 0,
                previousEmploymentMonthsWorked:
                  p?.pcbClaims?.tp3?.previousEmploymentMonthsWorked ?? 0,
                previousEmploymentMonthlyGrossRemuneration:
                  p?.pcbClaims?.tp3
                    ?.previousEmploymentMonthlyGrossRemuneration ?? 0,
                previousEmploymentMonthlyTaxExemptAllowances:
                  p?.pcbClaims?.tp3
                    ?.previousEmploymentMonthlyTaxExemptAllowances ?? 0,
                previousEmploymentApprovedEpfContributionsAnnual:
                  p?.pcbClaims?.tp3
                    ?.previousEmploymentApprovedEpfContributionsAnnual ?? 0,
                previousEmploymentZakatAnnual:
                  p?.pcbClaims?.tp3?.previousEmploymentZakatAnnual ?? 0,
                previousEmploymentUmrahExemptionLevyAnnual:
                  p?.pcbClaims?.tp3
                    ?.previousEmploymentUmrahExemptionLevyAnnual ?? 0,
              },
            },
          });
        } else {
          setMessage("");
        }
      } catch (error) {
        console.error("Error loading payroll profile:", error);
        setMessage("Failed to load payroll profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayrollProfile();
  }, [
    id,
    staffFormData?.business,
    staffFormData?.business_id,
    adminInfo?.id,
    adminInfo?.token,
  ]);

  const addAllowance = () => {
    setFormData((prev) => ({
      ...prev,
      allowances: [...prev.allowances, { payElementType: "", amount: 0 }],
    }));
  };

  const removeAllowance = (index) => {
    setFormData((prev) => ({
      ...prev,
      allowances: prev.allowances.filter((_, i) => i !== index),
    }));
  };

  const updateAllowance = (index, field, value) => {
    setFormData((prev) => {
      const next = [...prev.allowances];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return { ...prev, allowances: next };
    });
  };

  const blurAllowance = (index, field) => {
    if (field !== "amount") return;
    setFormData((prev) => {
      const next = [...prev.allowances];
      next[index] = {
        ...next[index],
        amount: parseFloat(next[index].amount) || 0,
      };
      return { ...prev, allowances: next };
    });
  };

  const clearZeroOnBackspace = (e, clearFn) => {
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      Number(e.target.value || 0) === 0
    ) {
      e.preventDefault();
      clearFn();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      let finalBiz =
        businessId ||
        fallbackBusinessId ||
        staffFormData?.business?._id ||
        staffFormData?.business ||
        staffFormData?.business_id ||
        "";
      if (!finalBiz && id) {
        const headers = {
          authorization: `Bearer ${adminInfo?.token || ""}`,
        };
        const { data: emp } = await axios.get(
          `${Base_URL}/staff-management/${id}`,
          {
            headers,
          },
        );
        finalBiz =
          emp?.business?._id ||
          emp?.business ||
          emp?.business_id ||
          fallbackBusinessId ||
          "";
        setBusinessId(finalBiz);
      }

      if (!id || !finalBiz) {
        notifyError("Business and employee IDs are required");
        setMessage("Business and employee IDs are required");
        return;
      }

      const payload = {
        ...formData,
        basicSalary: parseFloat(formData.basicSalary) || 0,
        allowances: (formData.allowances || []).map((a) => ({
          ...a,
          amount: parseFloat(a?.amount) || 0,
        })),
        childrenForTaxRelief: {
          ...(formData.childrenForTaxRelief || {}),
          under18: Number(formData.childrenForTaxRelief?.under18) || 0,
          studying: Number(formData.childrenForTaxRelief?.studying) || 0,
          studyingDiploma:
            Number(formData.childrenForTaxRelief?.studyingDiploma) || 0,
          disabled: Number(formData.childrenForTaxRelief?.disabled) || 0,
          disabledStudying:
            Number(formData.childrenForTaxRelief?.disabledStudying) || 0,
        },
        payGroup: formData.payGroup || null,
        business: finalBiz,
        employee: id,
      };

      await axios.post(`${Base_URL}/payroll/employee-profiles`, payload);
      notifySuccess("Payroll profile saved");
      setMessage("Payroll profile saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      const errMsg = error?.response?.data?.message || "Failed to save";
      notifyError(errMsg);
      setMessage(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading payroll profile...
      </div>
    );
  }

  return (
    <div className="p-6">
      <p className="text-sm text-gray-500 mb-6">
        {employee?.fullName || "Employee"}{" "}
        {employee?.employeeId ? `(${employee.employeeId})` : ""}
      </p>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded ${
            message.includes("success")
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-3">
        <div className="rounded-lg border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("compensation")}
            className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-semibold text-gray-800">
              Compensation
            </h2>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.compensation ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.compensation ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-gray-600 mb-2">
                  Basic Salary (RM)
                </label>
                <input
                  type="number"
                  value={formData.basicSalary ?? 0}
                  onKeyDown={(e) =>
                    clearZeroOnBackspace(e, () =>
                      setFormData((f) => ({ ...f, basicSalary: "" })),
                    )
                  }
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      basicSalary:
                        e.target.value === ""
                          ? ""
                          : parseFloat(e.target.value) || 0,
                    }))
                  }
                  onBlur={() =>
                    setFormData((f) => ({
                      ...f,
                      basicSalary: parseFloat(f.basicSalary) || 0,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-2">Pay Type</label>
                <select
                  value={formData.payType}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, payType: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                >
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-600 mb-2">Pay Group</label>
                <select
                  value={formData.payGroup}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, payGroup: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                >
                  <option value="">-- None --</option>
                  {payGroups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("allowances")}
            className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              Allowances
              {formData.allowances.length > 0 && (
                <span className="text-xs font-normal text-gray-400">
                  ({formData.allowances.length})
                </span>
              )}
            </h2>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.allowances ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.allowances ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="px-6 pb-6">
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={addAllowance}
                  className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: "var(--p-blue)" }}
                >
                  <Plus size={14} /> Add Allowance
                </button>
              </div>
              {formData.allowances.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No allowances assigned. Click "Add Allowance" to begin.
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.allowances.map((alw, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <select
                        value={
                          alw.payElementType?._id || alw.payElementType || ""
                        }
                        onChange={(e) =>
                          updateAllowance(i, "payElementType", e.target.value)
                        }
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                      >
                        <option value="">Select Pay Element</option>
                        {payElements.map((pe) => (
                          <option key={pe._id} value={pe._id}>
                            {pe.name} ({pe.code})
                          </option>
                        ))}
                      </select>
                      <div className="w-40">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={alw.amount ?? 0}
                          onKeyDown={(e) =>
                            clearZeroOnBackspace(e, () =>
                              updateAllowance(i, "amount", ""),
                            )
                          }
                          onChange={(e) =>
                            updateAllowance(
                              i,
                              "amount",
                              e.target.value === ""
                                ? ""
                                : parseFloat(e.target.value) || 0,
                            )
                          }
                          onBlur={() => blurAllowance(i, "amount")}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAllowance(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("references")}
            className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-semibold text-gray-800">
              Statutory Reference Numbers
            </h2>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.references ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.references ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="px-6 pb-6 grid grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-600 mb-2">EPF Number</label>
                <input
                  value={formData.epfNumber}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, epfNumber: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-2">SOCSO Number</label>
                <input
                  value={formData.socsoNumber}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, socsoNumber: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-2">
                  Tax File Number
                </label>
                <input
                  value={formData.taxFileNumber}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      taxFileNumber: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-2">EIS Number</label>
                <input
                  value={formData.eisNumber}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, eisNumber: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div className="col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                Bank details are managed under the <strong>Bank Details</strong>{" "}
                tab and will be automatically used for payroll.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("statutory")}
            className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-semibold text-gray-800">
              Statutory Contributions
            </h2>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.statutory ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.statutory ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  "otEnabled",
                  "epfEnabled",
                  "socsoEnabled",
                  "eisEnabled",
                  "pcbEnabled",
                  "hrdfEnabled",
                ].map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData[key]}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, [key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {key.replace("Enabled", "").toUpperCase()}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-gray-600 mb-2">
                    EPF Category
                  </label>
                  <select
                    value={formData.epfCategory}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        epfCategory: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                  >
                    <option value="part_a">Part A - Malaysian below 60</option>
                    <option value="part_b">
                      Part B - Non-Malaysian below 60
                    </option>
                    <option value="part_c">Part C - PR above 60</option>
                    <option value="part_d">
                      Part D - Non-Malaysian above 60
                    </option>
                    <option value="part_e">Part E - Malaysian above 60</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-2">
                    SOCSO Category
                  </label>
                  <select
                    value={formData.socsoCategory}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        socsoCategory: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                  >
                    <option value="first_category">
                      1st Category (Injury + Invalidity)
                    </option>
                    <option value="second_category">
                      2nd Category (Injury Only)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("tax")}
            className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-semibold text-gray-800">
              Tax (PCB) Settings
            </h2>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.tax ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.tax ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-600 mb-2">
                    Resident Status
                  </label>
                  <select
                    value={formData.taxResidentStatus}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        taxResidentStatus: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                  >
                    <option value="resident">Resident</option>
                    <option value="non_resident">Non-Resident</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-2">
                    Marital Status (for tax)
                  </label>
                  <select
                    value={formData.maritalStatusForTax}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        maritalStatusForTax: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                  >
                    <option value="single">Single</option>
                    <option value="married_spouse_no_income">
                      Married - Spouse No Income
                    </option>
                    <option value="married_spouse_has_income">
                      Married - Spouse Has Income
                    </option>
                  </select>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-gray-800 mt-4 mb-2">
                Children for Tax Relief (LHDN)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  { key: "under18", label: "Under 18 (RM2,000 each)" },
                  { key: "studying", label: "18+ Studying (RM2,000 each)" },
                  {
                    key: "studyingDiploma",
                    label: "Diploma+ / Degree (RM8,000 each)",
                  },
                  { key: "disabled", label: "Disabled Child (RM6,000 each)" },
                  {
                    key: "disabledStudying",
                    label: "Disabled + Studying (RM14,000 each)",
                  },
                ].map((c) => (
                  <div key={c.key}>
                    <label className="block text-gray-600 mb-2">
                      {c.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.childrenForTaxRelief?.[c.key] ?? 0}
                      onKeyDown={(e) =>
                        clearZeroOnBackspace(e, () =>
                          setFormData((f) => ({
                            ...f,
                            childrenForTaxRelief: {
                              ...f.childrenForTaxRelief,
                              [c.key]: "",
                            },
                          })),
                        )
                      }
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          childrenForTaxRelief: {
                            ...f.childrenForTaxRelief,
                            [c.key]:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value) || 0,
                          },
                        }))
                      }
                      onBlur={() =>
                        setFormData((f) => ({
                          ...f,
                          childrenForTaxRelief: {
                            ...f.childrenForTaxRelief,
                            [c.key]:
                              Number(f.childrenForTaxRelief?.[c.key]) || 0,
                          },
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.individualDisability}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        individualDisability: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Individual Disability
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.spouseDisability}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        spouseDisability: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Spouse Disability
                </label>
              </div>

              <PcbClaimsInputs formData={formData} setFormData={setFormData} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

import { LoadScript, Autocomplete } from "@react-google-maps/api";
import useGoogleMapsApiKey from "@/hooks/useGoogleMapsApiKey";

// Places Autocomplete component
const PlacesAutocomplete = ({ contactData, setContactData, plainTextOnly = false }) => {
  const [autocomplete, setAutocomplete] = useState(null);
  const inputRef = useRef(null);

  const onLoad = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  };

  const handleInputChange = (e) => {
    setContactData((prev) => ({
      ...prev,
      googleLocation: e.target.value,
    }));
  };

  if (plainTextOnly) {
    return (
      <InputField
        type="text"
        name="googleLocation"
        value={contactData.googleLocation || ""}
        onChange={handleInputChange}
        placeholder="Enter address manually"
      />
    );
  }

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();

      if (place.formatted_address) {
        // Create a copy of the current contactData to work with
        let updatedData = { ...contactData };

        // Set Google Location
        updatedData.googleLocation = place.formatted_address;

        // Extract address components
        const addressComponents = place.address_components || [];

        // Extract relevant address components
        for (const component of addressComponents) {
          const types = component.types;

          if (
            types.includes("street_number") ||
            types.includes("route") ||
            types.includes("subpremise") ||
            types.includes("premise")
          ) {
            if (types.includes("street_number")) {
              updatedData.streetNumber = component.long_name;
            }

            if (types.includes("route")) {
              if (updatedData.streetNumber) {
                updatedData.streetBlock = `${updatedData.streetNumber} ${component.long_name}`;
                delete updatedData.streetNumber;
              } else {
                updatedData.streetBlock = component.long_name;
              }
            }

            if (types.includes("subpremise") || types.includes("premise")) {
              updatedData.unitHouseInfo = component.long_name;
            }
          }

          if (types.includes("sublocality") || types.includes("neighborhood")) {
            updatedData.suburb = component.long_name;
          }

          if (types.includes("locality")) {
            updatedData.city = component.long_name;
          }

          if (types.includes("administrative_area_level_1")) {
            updatedData.state = component.long_name;
          }

          if (types.includes("postal_code")) {
            updatedData.postcode = component.long_name;
          }

          if (types.includes("country")) {
            updatedData.country = component.long_name;
          }
        }

        // Update state with extracted data all at once
        setContactData(updatedData);
      }
    }
  };

  // Sync the input value with contactData if it changes externally
  useEffect(() => {
    if (inputRef.current && contactData.googleLocation) {
      inputRef.current.value = contactData.googleLocation;
    }
  }, [contactData.googleLocation]);

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <InputField
        ref={inputRef}
        type="text"
        name="googleLocation"
        defaultValue={contactData.googleLocation || ""}
        onChange={handleInputChange}
        placeholder="Search for an address"
      />
    </Autocomplete>
  );
};

const ContactInfoTab = ({ formData, setFormData, id }) => {
  const [contactData, setContactData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const libraries = ["places"];
  const { googleMapsApiKey, loading: googleMapsKeyLoading } = useGoogleMapsApiKey();

  // console.log("FormData is: ",formData)

  // Initialize contact data from parent form data if available
  useEffect(() => {
    if (formData) {
      setContactData({ ...formData });
    } else if (formData && formData.email) {
      // If contactInfo doesn't exist but email does, initialize with that
      setContactData((prev) => ({
        ...prev,
        email: formData.email,
      }));
    }
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setContactData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!contactData.mobileNumber || contactData.mobileNumber.trim() === "") {
      newErrors.mobileNumber = "Mobile Number is required";
    }

    if (!contactData.email || contactData.email.trim() === "") {
      newErrors.email = "Email Address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!contactData.postcode || contactData.postcode.trim() === "") {
      newErrors.postcode = "Postcode is required";
    }

    if (!contactData.country || contactData.country.trim() === "") {
      newErrors.country = "Country is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!validateForm()) {
      return;
    }

    setIsUpdating(true);

    const dataToSubmit = {
      ...contactData,
      spokenLanguages:
        contactData.spokenLanguages?.map((lang) => lang.value) || [],
    };
    try {
      // Only needed if you're storing contactInfo in a separate API endpoint
      await axios.put(`${Base_URL}/staff-management/${id}`, dataToSubmit);

      // Update parent form data if needed
      if (setFormData) {
        setFormData((prev) => ({
          ...prev,
          ...contactData,
        }));
      }

      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000); // Clear success message after 3 seconds
      // Clear errors on successful update
      setErrors({});
    } catch (error) {
      console.error("Error updating contact info:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="py-8 px-4">
      <form onSubmit={handleUpdate}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              name="mobileNumber"
              value={contactData.mobileNumber || ""}
              onChange={handleChange}
              placeholder="Mobile Number"
              error={errors.mobileNumber}
              shouldShowError={!!errors.mobileNumber}
            />
          </div>
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">
              Email Address <span className="text-red-500">*</span>
            </label>
            <InputField
              type="email"
              name="email"
              value={contactData.email || ""}
              onChange={handleChange}
              placeholder="Email Address"
              error={errors.email}
              shouldShowError={!!errors.email}
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">
              Google Location
            </label>
            {!googleMapsKeyLoading && !googleMapsApiKey ? (
              <p className="mb-2 text-xs text-amber-700">
                Address search is unavailable. Add a Google Map API key in Configuration.
              </p>
            ) : null}
            {googleMapsApiKey ? (
              <LoadScript
                key={googleMapsApiKey}
                googleMapsApiKey={googleMapsApiKey}
                libraries={libraries}
              >
                <PlacesAutocomplete
                  contactData={contactData}
                  setContactData={setContactData}
                />
              </LoadScript>
            ) : (
              <PlacesAutocomplete
                contactData={contactData}
                setContactData={setContactData}
                plainTextOnly
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">
              Unit/House Info
            </label>
            <InputField
              type="text"
              name="unitHouseInfo"
              value={contactData.unitHouseInfo}
              onChange={handleChange}
              placeholder="Unit/House Info"
            />
          </div>
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">Street/Block</label>
            <InputField
              type="text"
              name="streetBlock"
              value={contactData.streetBlock || ""}
              onChange={handleChange}
              placeholder="Street/Block"
            />
          </div>
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">Suburb</label>
            <InputField
              type="text"
              name="suburb"
              value={contactData.suburb || ""}
              onChange={handleChange}
              placeholder="Suburb"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">City</label>
            <div className="relative">
              <DropdownBasic
                name="city"
                value={contactData.city || ""}
                onChange={(val) =>
                  handleChange({ target: { name: "city", value: val } })
                }
                options={[
                  {
                    value: "",
                    label: contactData.city ? contactData.city : "Select City",
                  },
                  { value: "New York", label: "New York" },
                  { value: "London", label: "London" },
                  { value: "Sydney", label: "Sydney" },
                  { value: "Tokyo", label: "Tokyo" },
                ]}
                placeholder="Select City"
              />
            </div>
          </div> */}
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">City</label>
            <InputField
              type="text"
              name="city"
              value={contactData.city || ""}
              onChange={handleChange}
              placeholder="City"
            />
          </div>
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">State</label>
            <InputField
              type="text"
              name="state"
              value={contactData.state || ""}
              onChange={handleChange}
              placeholder="State"
            />
          </div>
          {/* <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">State</label>
            <div className="relative">
              <DropdownBasic
                name="state"
                value={contactData.state || ""}
                onChange={(val) =>
                  handleChange({ target: { name: "state", value: val } })
                }
                options={[
                  {
                    value: "",
                    label: contactData.state
                      ? contactData.state
                      : "Select State",
                  },
                  { value: "New York", label: "New York" },
                  { value: "California", label: "California" },
                  { value: "Texas", label: "Texas" },
                  { value: "Florida", label: "Florida" },
                ]}
                placeholder="Select State"
              />
            </div>
          </div> */}
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">
              Postcode <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              name="postcode"
              value={contactData.postcode || ""}
              onChange={handleChange}
              placeholder="Postcode"
              error={errors.postcode}
              shouldShowError={!!errors.postcode}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">Country</label>
            <div className="relative">
              <DropdownBasic
                name="country"
                value={contactData.country || ""}
                onChange={(val) =>
                  handleChange({ target: { name: "country", value: val } })
                }
                options={[
                  {
                    value: "",
                    label: contactData.country
                      ? contactData.country
                      : "Select Country",
                  },
                  { value: "USA", label: "United States" },
                  { value: "UK", label: "United Kingdom" },
                  { value: "AUS", label: "Australia" },
                  { value: "CAN", label: "Canada" },
                ]}
                placeholder="Select Country"
              />
            </div>
          </div> */}
          <div className="space-y-2 relative">
            <label className="block text-gray-500 text-sm">
              Country <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              name="country"
              value={contactData.country || ""}
              onChange={handleChange}
              placeholder="Country"
              error={errors.country}
              shouldShowError={!!errors.country}
            />
          </div>
        </div>

        <div className="mt-10 flex justify-between items-center">
          {updateSuccess && (
            <div className="text-green-600 font-medium">
              Contact information updated successfully!
            </div>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              className="bg-[var(--p-blue)] hover:bg-[#9CBD33] text-white px-10 py-3 rounded-full font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              disabled={isUpdating}
            >
              {isUpdating ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const EmploymentHistory = ({ staffId, past_work }) => {
  const [pastWork, setPastWork] = useState(past_work || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);

  const handleAddNew = () => {
    setCurrentRecord(null); // New record
    setModalOpen(true);
  };

  const handleEditClick = (record) => {
    setCurrentRecord(record);
    setModalOpen(true);
  };

  const handleRecordUpdated = (updatedList) => {
    setPastWork(updatedList); // Directly update list in local state
    setModalOpen(false);
  };

  const getStatusClass = useCallback((status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-500";
      case "Inactive":
        return "bg-yellow-100 text-yellow-500";
      case "Terminated":
        return "bg-red-100 text-red-500";
      case "Resigned":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-500";
    }
  }, []);

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <PageHeader title="Employment History" />
        <button
          onClick={handleAddNew}
          className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors min-w-[200px]"
        >
          <Plus size={20} />
          <span>Add New History</span>
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Company
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Position
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Start Date
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                End Date
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {pastWork?.map((record, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-4 px-6">{record?.companyName || "-"}</td>
                <td className="py-4 px-6">{record?.position || "-"}</td>
                <td className="py-4 px-6">
                  {formatDate(record?.startDate) || "-"}
                </td>
                <td className="py-4 px-6">
                  {formatDate(record?.endDate) || "-"}
                </td>
                <td className="py-4 px-6">
                  <button
                    className="text-gray-600 hover:text-gray-800"
                    onClick={() => handleEditClick(record)}
                  >
                    <Edit size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pastWork.length == 0 && (
          <div className="h-[100px] flex justify-center items-center">
            No Employment History Found
          </div>
        )}
      </div>

      <EmploymentHistoryCreateOrUpdateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        recordData={currentRecord}
        staffId={staffId}
        onRecordUpdated={handleRecordUpdated}
      />
    </div>
  );
};

const EmploymentRecordTab = ({ id }) => {
  const staffId = id;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [statusUpdateModalOpen, setStatusUpdateModalOpen] = useState(false);
  const [previousRecordModalOpen, setPreviousRecordModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Fetch employment records on component mount
  useEffect(() => {
    if (staffId) {
      fetchEmploymentRecords();
    }
  }, [staffId]);

  const fetchEmploymentRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/staff-management/specific/${id}`,
      );

      console.log("URL IS: ", `${Base_URL}/staff-management/specific/${id}`);

      console.log("employement records", response.data.staffList);
      setRecords(response.data.staffList || []);
    } catch (error) {
      console.error("Error fetching employment records:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (record) => {
    setCurrentRecord(record);
    setModalOpen(true);
  };

  const handleUpdateStatus = (record) => {
    setCurrentRecord(record);
    setStatusUpdateModalOpen(true);
  };

  const handleViewPreviousRecord = (record) => {
    setCurrentRecord(record);
    setPreviousRecordModalOpen(true);
  };

  const handleAddNew = () => {
    setCurrentRecord(null); // Clear any previous record data
    setModalOpen(true);
  };

  const handleRecordUpdated = (updatedRecord) => {
    fetchEmploymentRecords(); // Refresh the records list
  };

  // Filter records based on search term
  // const filteredRecords = Array.isArray(records) ? records.filter((record) => {
  //   const searchLower = searchTerm.toLowerCase();
  //   return (
  //     (record.company && record.company.toLowerCase().includes(searchLower)) ||
  //     (record.position && record.position.toLowerCase().includes(searchLower)) ||
  //     (record.leaveGroup && record.leaveGroup.toLowerCase().includes(searchLower)) ||
  //     (record.claimGroup && record.claimGroup.toLowerCase().includes(searchLower))
  //   );
  // }) : [];

  const getStatusClass = useCallback((status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-500";
      case "Inactive":
        return "bg-yellow-100 text-yellow-500";
      case "Terminated":
        return "bg-red-100 text-red-500";
      case "Resigned":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-500";
    }
  }, []);

  const flattenedData = useMemo(() => {
    const result = [];

    records.forEach((record) => {
      // Add current record
      result.push({
        ...record,
        recordType: "current",
        originalRecord: record,
      });

      // Add previous roles
      if (record.previousRoles && record.previousRoles.length > 0) {
        record.previousRoles.reverse().forEach((previousRole) => {
          result.push({
            ...previousRole,
            _id: `${record._id}-prev-${Math.random()}`,
            recordType: "previous",
            originalRecord: record,
            shift: record.shift, // Keep shift from original record for previous roles
          });
        });
      }
    });

    return result;
  }, [records]);

  return (
    <>
      <div className="">
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm my-4">
          <DataTable
            noPagination={true}
            isCollapsible={true}
            searchValue={searchQuery}
            onSearch={(value) => setSearchQuery(value)}
            searchPlaceholder="Search employees..."
            title="Employment Record"
            headers={[
              "Company",
              "Position",
              "Department",
              "Branch Locations",
              "Joining Date",
              "End Date",
              "Probation Start Date",
              "Probation End Date",
              "Confirmation Date",
              "Employment Type",
              "Work Pass Type",
              "Visa Expiry Date",
              "Uniform Size",
              "Leave Group",
              "Claim Group",
              "Shift",
              "Reason For Leaving",
              "Status",
              "Action",
            ]}
            data={flattenedData}
            colWidths={{
              Company: "160px",
              Status: "120px",
              Action: "100px",
            }}
            headersToHide={[
              "Branch Locations",
              "Probation Start Date",
              "Probation End Date",
              "Confirmation Date",
              "Work Pass Type",
              "Visa Expiry Date",
              "Uniform Size",
              "Leave Group",
              "Claim Group",
              "Shift",
              "Reason For Leaving",
            ]}
            totalPages={1}
            currentPage={1}
            onPageChange={() => {}}
            recordsPerPage={2}
            onRecordsPerPageChange={() => {}}
            loading={loading}
            renderRow={(record) => {
              const isPreviousRole = record.recordType === "previous";

              return (
                record && (
                  <tr
                    key={record._id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      {record?.business?.name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {record?.position?.name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {record?.department?.name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {formatStaffBranchLocationsCell(record)}
                    </td>
                    <td className="py-3 px-4">
                      {formatDate(record?.joiningDate)}
                    </td>
                    <td className="py-3 px-4">
                      {record?.endDate ? formatDate(record?.endDate) : "-"}
                    </td>
                    <td className="py-3 px-4">
                      {formatDate(record?.probationStartDate)}
                    </td>
                    <td className="py-3 px-4">
                      {formatDate(record?.probationEndDate)}
                    </td>
                    <td className="py-3 px-4">
                      {formatDate(record?.confirmationDate)}
                    </td>
                    <td className="py-3 px-4">
                      {record?.employmentType || "-"}
                    </td>
                    <td className="py-3 px-4">{record?.workPassType || "-"}</td>
                    <td className="py-3 px-4">
                      {formatDate(record?.visaExpiryDate)}
                    </td>
                    <td className="py-3 px-4">{record?.uniformSize || "-"}</td>
                    <td className="py-3 px-4">
                      {record?.leaveGroup?.name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {record?.claimGroup?.name || "-"}
                    </td>
                    <td className="py-3 px-4">{record?.shift?.name || "-"}</td>
                    <td className="py-3 px-4">
                      {record?.reasonForLeaving || "-"}
                    </td>
                    <td className="py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full ${getStatusClass(
                          record?.status,
                        )}`}
                      >
                        {record?.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        className={`text-gray-600 hover:text-gray-800 focus:outline-none ${
                          isPreviousRole ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() =>
                          !isPreviousRole &&
                          handleEditClick(record.originalRecord || record)
                        }
                        disabled={isPreviousRole}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        className={`ml-2 text-gray-600 hover:text-gray-800 focus:outline-none ${
                          isPreviousRole ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() =>
                          !isPreviousRole &&
                          handleUpdateStatus(record.originalRecord || record)
                        }
                        disabled={isPreviousRole}
                      >
                        <RefreshCcw size={18} />
                      </button>
                    </td>
                  </tr>
                )
              );
            }}
          />
        </div>

        {/* <ApprovalLevels employeeId={staffId} /> */}

        <EmploymentRecordPreviousRoleModal
          isOpen={previousRecordModalOpen}
          onClose={() => setPreviousRecordModalOpen(false)}
          recordData={currentRecord}
        />

        <EmploymentRecordEditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          recordData={currentRecord}
          staffId={staffId}
          onRecordUpdated={handleRecordUpdated}
        />

        {/* handleUpdateStatus */}
        <EmpoymentStatusModel
          isOpen={statusUpdateModalOpen}
          onClose={() => setStatusUpdateModalOpen(false)}
          recordData={currentRecord}
          staffId={staffId}
          onRecordUpdated={handleRecordUpdated}
        />
      </div>
      {records.length > 0 && records[0].past_work && staffId && (
        <EmploymentHistory past_work={records[0].past_work} staffId={staffId} />
      )}
    </>
  );
};

const BankDetailsTab = ({ id, formData, setFormData }) => {
  const [contactData, setContactData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  useEffect(() => {
    if (formData) {
      setContactData({ ...formData });
    } else if (formData && formData.email) {
      // If contactInfo doesn't exist but email does, initialize with that
      setContactData((prev) => ({
        ...prev,
        email: formData.email,
      }));
    }
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setContactData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const bankDetails = contactData.bankDetails || {};

    if (
      !bankDetails.accountHolderName ||
      bankDetails.accountHolderName.trim() === ""
    ) {
      newErrors.accountHolderName = "Account Holder Name is required";
    }

    if (!bankDetails.bankName || bankDetails.bankName.trim() === "") {
      newErrors.bankName = "Bank Name is required";
    }

    if (!bankDetails.accountNumber || bankDetails.accountNumber.trim() === "") {
      newErrors.accountNumber = "Account Number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!validateForm()) {
      return;
    }

    setIsUpdating(true);

    const dataToSubmit = {
      ...contactData,
      spokenLanguages:
        contactData.spokenLanguages?.map((lang) => lang.value) || [],
    };
    try {
      // Only needed if you're storing contactInfo in a separate API endpoint
      await axios.put(`${Base_URL}/staff-management/${id}`, dataToSubmit);

      // Update parent form data if needed
      if (setFormData) {
        setFormData((prev) => ({
          ...prev,
          ...contactData,
        }));
      }

      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000); // Clear success message after 3 seconds
      // Clear errors on successful update
      setErrors({});
    } catch (error) {
      console.error("Error updating contact info:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6 rounded-lg">
      {/* <PageHeader title="Bank Details" /> */}
      <form onSubmit={handleUpdate}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-600 mb-2">
              Account Holder Name <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              name="accountHolderName"
              placeholder="Account Holder Name"
              value={contactData.bankDetails?.accountHolderName || ""}
              onChange={(e) => {
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    accountHolderName: e.target.value,
                  },
                }));
                // Clear error when user starts typing
                if (errors.accountHolderName) {
                  setErrors((prev) => ({
                    ...prev,
                    accountHolderName: "",
                  }));
                }
              }}
              error={errors.accountHolderName}
              shouldShowError={!!errors.accountHolderName}
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">
              Bank Name <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              name="bankName"
              placeholder="Bank Name"
              value={contactData.bankDetails?.bankName || ""}
              onChange={(e) => {
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    bankName: e.target.value,
                  },
                }));
                // Clear error when user starts typing
                if (errors.bankName) {
                  setErrors((prev) => ({
                    ...prev,
                    bankName: "",
                  }));
                }
              }}
              error={errors.bankName}
              shouldShowError={!!errors.bankName}
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">Bank Branch</label>
            <InputField
              type="text"
              name="bankBranch"
              placeholder="Bank Branch"
              value={contactData.bankDetails?.bankBranch || ""}
              onChange={(e) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    bankBranch: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">
              Account Number <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              name="accountNumber"
              placeholder="Account Number"
              value={contactData.bankDetails?.accountNumber || ""}
              onChange={(e) => {
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    accountNumber: e.target.value,
                  },
                }));
                // Clear error when user starts typing
                if (errors.accountNumber) {
                  setErrors((prev) => ({
                    ...prev,
                    accountNumber: "",
                  }));
                }
              }}
              error={errors.accountNumber}
              shouldShowError={!!errors.accountNumber}
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">Account Type</label>
            <DropdownBasic
              options={[
                { value: "Savings Account", label: "Savings Account" },
                { value: "Current Account", label: "Current Account" },
                { value: "Business Account", label: "Business Account" },
                { value: "Salary Account", label: "Salary Account" },
                { value: "Joint Account", label: "Joint Account" },
              ]}
              value={contactData.bankDetails?.accountType || ""}
              onChange={(selectedValue) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    accountType: selectedValue,
                  },
                }))
              }
              placeholder="Select Account Type"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">IFSC Code</label>
            <InputField
              type="text"
              name="ifscCode"
              placeholder="IFSC Code"
              value={contactData.bankDetails?.ifscCode || ""}
              onChange={(e) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    ifscCode: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">SWIFT Code</label>
            <InputField
              type="text"
              name="swiftCode"
              placeholder="SWIFT Code"
              value={contactData.bankDetails?.swiftCode || ""}
              onChange={(e) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    swiftCode: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">IBAN</label>
            <InputField
              type="text"
              name="iban"
              placeholder="IBAN"
              value={contactData.bankDetails?.iban || ""}
              onChange={(e) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: { ...prev.bankDetails, iban: e.target.value },
                }))
              }
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">Currency</label>
            <CurrencyDropdown
              businessId={contactData?.business?._id}
              value={contactData.bankDetails?.currency}
              onChange={(currencyData) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    currency: currencyData ? currencyData.value : "",
                  },
                }))
              }
              placeholder="Select Currency"
              isDisabled={!contactData?.business?._id}
              shouldShowError={false}
              error=""
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-2">Remarks</label>
            <InputField
              type="text"
              name="remarks"
              placeholder="Remarks"
              value={contactData.bankDetails?.remarks || ""}
              onChange={(e) =>
                setContactData((prev) => ({
                  ...prev,
                  bankDetails: { ...prev.bankDetails, remarks: e.target.value },
                }))
              }
            />
          </div>
        </div>
        <div className="mt-10 flex justify-between items-center">
          {updateSuccess && (
            <div className="text-green-600 font-medium">
              Contact information updated successfully!
            </div>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              className="bg-[var(--p-blue)] hover:bg-[#9CBD33] text-white px-10 py-3 rounded-full font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              disabled={isUpdating}
            >
              {isUpdating ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const AttendanceTab = () => {
  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <PageHeader title="Attendance" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            className="py-2 pl-10 pr-4 rounded-md bg-white border border-gray-200 shadow-sm w-64"
          />
          <Search className="absolute left-1 top-2.5 text-gray-400" size={18} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg">
        <DataTable
          headers={["Date", "IN", "Position", "Hours Worked", "Action"]}
          noPadding={true}
          noPagination={true}
          data={[
            {
              date: "02/25/2026",
              in: "09:00",
              position: "06:00",
              hoursWorked: "09:00",
            },
          ]}
          renderRow={(row) => (
            <tr
              key={row.date}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="py-4 px-6">{row.date}</td>
              <td className="py-4 px-6">{row.in}</td>
              <td className="py-4 px-6">{row.position}</td>
              <td className="py-4 px-6">{row.hoursWorked}</td>
              <td className="py-4 px-6">
                <button className="text-gray-600 hover:text-gray-800">
                  <Edit size={18} />
                </button>
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
};

// const ApprovalLevels = ({ employeeId }) => {
//   const [claimApprovalLevel, setClaimApprovalLevel] = useState(1)
//   const [leaveApprovalLevel, setLeaveApprovalLevel] = useState(1)
//   const [loading, setLoading] = useState(false)
//   const [updating, setUpdating] = useState(null)
//   const [showToast, setShowToast] = useState(false)
//   const [toastMessage, setToastMessage] = useState("")
//   const [toastType, setToastType] = useState("success")

//   const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

//   useEffect(() => {
//     if (employeeId) {
//       fetchEmployeeApprovalLevels()
//     }
//   }, [employeeId])

//   const showToastMessage = (message, type = "success") => {
//     setToastMessage(message)
//     setToastType(type)
//     setShowToast(true)
//     setTimeout(() => setShowToast(false), 3000)
//   }

//   const fetchEmployeeApprovalLevels = async () => {
//     setLoading(true)
//     try {
//       const response = await fetch(`${BASE_URL}/staff-management/getApprovalLevels/${employeeId}`, { credentials: "include" })
//       if (!response.ok) throw new Error("Failed to fetch approval levels")

//       const data = await response.json()
//       setClaimApprovalLevel(data.claimApprovalLevel)
//       setLeaveApprovalLevel(data.leaveApprovalLevel)
//     } catch (error) {
//       console.error("Error fetching employee approval levels:", error)
//       showToastMessage("Failed to fetch approval levels. Please try again.", "error")
//     } finally {
//       setLoading(false)
//     }
//   }

//   const updateClaimApprovalLevel = async (level) => {
//     setUpdating("claim")
//     try {
//       const response = await fetch(`${BASE_URL}/claims/employee/${employeeId}/claim-approval-level`, {
//         method: "PATCH",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ claimApprovalLevel: level }),
//         credentials: "include",
//       })

//       if (!response.ok) throw new Error("Failed to update claim approval level")

//       setClaimApprovalLevel(level)
//       showToastMessage("Claim approval level updated successfully.")
//     } catch (error) {
//       console.error("Error updating claim approval level:", error)
//       showToastMessage("Failed to update claim approval level. Please try again.", "error")
//     } finally {
//       setUpdating(null)
//     }
//   }

//   const updateLeaveApprovalLevel = async (level) => {
//     setUpdating("leave")
//     try {
//       const response = await fetch(`${BASE_URL}/leaves/${employeeId}/leave-approval-level`, {
//         method: "PATCH",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ leaveApprovalLevel: level }),
//         credentials: "include",
//       })

//       if (!response.ok) throw new Error("Failed to update leave approval level")

//       setLeaveApprovalLevel(level)
//       showToastMessage("Leave approval level updated successfully.")
//     } catch (error) {
//       console.error("Error updating leave approval level:", error)
//       showToastMessage("Failed to update leave approval level. Please try again.", "error")
//     } finally {
//       setUpdating(null)
//     }
//   }

//   const getApprovalLevelText = (level) => {
//     return `${level} Level${level > 1 ? "s" : ""}`
//   }

//   if (loading) {
//     return (
//       <div className="w-full py-4">
//         <div className="flex items-center gap-2 text-gray-500">
//           <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               strokeWidth={2}
//               d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
//             />
//           </svg>
//           <span className="text-sm">Loading approval levels...</span>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="w-full  py-4">
//   {/* Toast Notification */}
//   {showToast && (
//     <div
//       className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 ${
//         toastType === "success"
//           ? "bg-green-50 border-green-200 text-green-800"
//           : "bg-red-50 border-red-200 text-red-800"
//       }`}
//     >
//       <div className="flex items-center gap-2">
//         <span className="text-sm font-medium">{toastMessage}</span>
//         <button onClick={() => setShowToast(false)} className="text-gray-400 hover:text-gray-600">
//           ×
//         </button>
//       </div>
//     </div>
//   )}

//   {/* Section Wrapper */}
//   <div className="bg-p-gray-light border border-gray-200 rounded-xl shadow-sm p-6 mb-4">
//     <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Approval Settings</h3>

//     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//       {/* Claim Approval Level */}
//       <div className="flex flex-col">
//         <label className="text-sm font-medium text-gray-700 mb-2">Claim Approval Level</label>
//         <div className="flex items-center gap-3">
//           <select
//             value={claimApprovalLevel}
//             onChange={(e) => updateClaimApprovalLevel(Number(e.target.value))}
//             disabled={updating === "claim"}
//             className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
//           >
//             {[1, 2, 3].map((level) => (
//               <option key={level} value={level}>
//                 {getApprovalLevelText(level)}claimApprovalLevel
//               </option>
//             ))}
//           </select>
//           {updating === "claim" && (
//             <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
//               />
//             </svg>
//           )}
//         </div>
//       </div>

//       {/* Leave Approval Level */}
//       <div className="flex flex-col">
//         <label className="text-sm font-medium text-gray-700 mb-2">Leave Approval Level</label>
//         <div className="flex items-center gap-3">
//           <select
//             value={leaveApprovalLevel}
//             onChange={(e) => updateLeaveApprovalLevel(Number(e.target.value))}
//             disabled={updating === "leave"}
//             className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
//           >
//             {[1, 2, 3].map((level) => (
//               <option key={level} value={level}>
//                 {getApprovalLevelText(level)}
//               </option>
//             ))}
//           </select>
//           {updating === "leave" && (
//             <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
//               />
//             </svg>
//           )}
//         </div>
//       </div>
//     </div>
//   </div>
// </div>
//   )
// }

import { format } from "date-fns";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { Button, DataTable, PageHeader, Tooltip } from "@/page-layouts/index";
import { InputField } from "@/page-layouts/index";
import DropdownBasic from "@/components/DropdownBasic";

import EmploymentHistoryCreateOrUpdateModal from "./StaffManagement/EmploymentHistoryCreateModel";

const LeavesTab = ({ employeeId }) => {
  const [showModal, setShowModal] = useState(false);
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLeaveId, setCurrentLeaveId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  const shouldShowActions = (leave) => {
    const currentDate = new Date();
    const leaveStartDate = new Date(leave.startDate);

    currentDate.setHours(0, 0, 0, 0);
    leaveStartDate.setHours(0, 0, 0, 0);

    // Business rule 1: No actions if leave start date already passed
    if (leaveStartDate < currentDate) {
      console.log("passed", leaveStartDate, "current Date", currentDate);
      return false;
    }
    console.log("available", leaveStartDate, "current Date", currentDate);
    // Business rule 2: Actions allowed if status is Applied, Approved, or Rejected
    return ["Applied", "Approved", "Rejected"].includes(leave.status);
  };

  const getActionButtons = (leave) => {
    if (!shouldShowActions(leave)) {
      return (
        <span className="text-gray-400 text-sm italic text-center">
          No actions available
        </span>
      );
    }

    return (
      <div className="flex justify-center">
        {(leave.status === "Applied" || leave.status === "Rejected") && (
          <img
            src={tickCircle}
            alt="approve"
            onClick={() => handleApproveClick(leave._id)}
            className="w-6 h-6 mr-2 cursor-pointer"
            title="Approve Leave"
          />
        )}

        {(leave.status === "Applied" || leave.status === "Approved") && (
          <img
            src={closeCircle}
            alt="reject"
            onClick={() => handleRejectClick(leave._id)}
            className="w-6 h-6 cursor-pointer"
            title="Reject Leave"
          />
        )}
      </div>
    );
  };

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (formData, adminInfo) => {
    try {
      const res = await axios.post(`${Base_URL}/leaves`, formData);

      console.log("response", res.data);
      setShowModal(false);
      notifySuccess("Leave request submitted successfully!");
      fetchEmployeeLeaves();
      fetchEmployeeLeaves();
    } catch (err) {
      console.error("Error submitting leave request:", err);
      // Extract meaningful error message from server or fallback
      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Failed to submit leave request.";

      notifyError(errorMessage);
    }
  };

  const fetchEmployeeLeaves = async (page = 1, limit = recordsPerPage) => {
    try {
      const res = await axios.get(`${Base_URL}/leaves/${employeeId}`, {
        params: {
          page,
          limit,
        },
      });

      console.log("employee leaves", res.data.leaves);
      setEmployeeLeaves(res.data.leaves);
      setTotalResults(res.data.total);
    } catch (err) {
      console.error("Error submitting leave request:", err);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchEmployeeLeaves(page, recordsPerPage); // Make sure all filters are used inside fetchClaims
  };

  useEffect(() => {
    fetchEmployeeLeaves();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "Accepted":
        return "text-green-500 bg-green-50";
      case "Rejected":
        return "text-red-500 bg-red-50";
      default:
        return "text-yellow-500 bg-yellow-50";
    }
  };

  const updateLeaveStatus = async (id, status, rejectReason) => {
    try {
      // Uncomment for actual API call
      await axios.put(`${Base_URL}/leaves/${id}/status`, {
        status,
        rejectReason,
      });

      // Update state locally
      setEmployeeLeaves(
        employeeLeaves.map((leave) =>
          leave._id === id ? { ...leave, status } : leave,
        ),
      );
    } catch (err) {
      console.error("Error updating leave status:", err);
    }
  };

  const handleApproveClick = (leaveId) => {
    console.log("leave id", leaveId);
    setCurrentLeaveId(leaveId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (leaveId) => {
    console.log("leaveId", leaveId);
    setCurrentLeaveId(leaveId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateLeaveStatus(currentLeaveId, "Approved");
      setShowApproveModal(false);
      notifySuccess("Leave successfully approved!"); // Optional: show success toast
    } catch (error) {
      console.error("Error approving leave:", error);
      notifyError("Failed to approve leave."); // Optional: show error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;

    setIsSubmitting(true);
    try {
      await updateLeaveStatus(currentLeaveId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      notifySuccess("Leave successfully rejected!"); // Optional
    } catch (error) {
      console.error("Error rejecting leave:", error);
      notifyError("Failed to reject leave."); // Optional
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <PageHeader title="Leaves" />
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="py-2 pl-10 pr-4 rounded-md bg-white border border-gray-200 shadow-sm w-64"
            />
            <Search
              className="absolute left-1 top-2.5 text-gray-400"
              size={18}
            />
          </div>
          <button
            className="bg-[var(--p-blue)] w-max hover:bg-[var(--p-blue)] text-white px-6 py-2.5 rounded-md font-medium"
            onClick={handleOpenModal}
          >
            Apply Leave on Behalf
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Leave Type
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Start Date
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                End Date
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Remarks
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Status
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {employeeLeaves?.map((leave) => (
              <tr
                className="border-b border-gray-100 hover:bg-gray-50"
                key={leave?._id}
              >
                <td className="py-4 px-6">{leave.leaveType.name}</td>
                <td className="py-4 px-6">{formatDate(leave.startDate)}</td>
                <td className="py-4 px-6">{formatDate(leave.endDate)}</td>
                <td className="py-4 px-6">{leave?.remarks}</td>
                <td className="py-4 px-6">
                  <span
                    className={`px-3 py-1 rounded-full ${getStatusColor(
                      leave.status,
                    )}`}
                  >
                    {leave.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  {getActionButtons(leave)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center w-full p-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <span>Show</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setRecordsPerPage(newValue);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchEmployeeLeaves(1, newValue);
              }}
              className="w-20 h-8 text-sm"
            >
              {[5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </Select>
            <span>entries</span>
          </div>
          <CustomPagination
            totalResults={totalResults}
            resultsPerPage={recordsPerPage}
            currentPage={currentPage}
            onChange={handlePageChange}
          />
        </div>
      </div>

      {/* Modal for ApplyLeaveForm */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg max-w-6xl w-full max-h-screen overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
              onClick={handleCloseModal}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <ApplyLeaveForm
              employeeId={employeeId}
              onSubmit={handleSubmit}
              onCancel={handleCloseModal}
            />
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Leave Approved!</h2>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to approve leave?
            </p>

            <div className="flex justify-center mb-6">
              <div className="bg-[var(--p-blue)] bg-opacity-20 p-4 rounded-full">
                <svg
                  className="w-12 h-12 text-[var(--p-blue)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
            </div>

            <button
              onClick={handleApproveConfirm}
              disabled={isSubmitting}
              className="w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200"
            >
              {isSubmitting ? "Processing..." : "Approve"}
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Leave Rejected!</h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-4">
              Please add the reason below to reject the leave application.
            </p>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter your reason"
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                rows="4"
              ></textarea>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleRejectConfirm}
                disabled={isSubmitting || !rejectReason.trim()}
                className={`w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md transition duration-200 ${
                  !rejectReason.trim() || isSubmitting
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Reject Leave Request"}
                {/* {isSubmitting ? "Processing..." : "Reject & Send Email to User"} */}
              </button>

              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClaimsTab = ({ employeeId = "" }) => {
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const isSingleBusiness = isSingleAssignedBusiness();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentClaimId, setCurrentClaimId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeClaims();
    } else {
      fetchAllClaims();
    }
  }, [employeeId]);

  const fetchEmployeeClaims = async (page = 1, limit = recordsPerPage) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${Base_URL}/claims/employee/${employeeId}`,
        {
          params: {
            page,
            limit,
          },
        },
      );
      console.log("employee claims", response.data);
      setClaims(response.data.data || []);
      setTotalResults(response.data.total);
    } catch (error) {
      console.error("Error fetching employee claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllClaims = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/claims`);
      setClaims(response.data || []);
    } catch (error) {
      console.error("Error fetching all claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredClaims = claims.filter((claim) => {
    const searchString = searchTerm.toLowerCase();
    return (
      claim.company?.name?.toLowerCase().includes(searchString) ||
      claim.claimName?.toLowerCase().includes(searchString) ||
      claim.purpose?.toLowerCase().includes(searchString)
    );
  });

  console.log("filteredClaims", filteredClaims);

  const HandleOpenFile = async (documentId) => {
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      console.log("Error getting file:", error);
    }
  };

  // Approval and Rejection handlers
  const handleApproveClick = (claimId) => {
    console.log("claim id", claimId);
    setCurrentClaimId(claimId);
    setShowApproveModal(true);
  };

  const handleRejectClick = (claimId) => {
    console.log("claim id", claimId);
    setCurrentClaimId(claimId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateClaimStatus(currentClaimId, "Approved");
      setShowApproveModal(false);
      await fetchEmployeeClaims(employeeId); // Refresh claims data
    } catch (error) {
      console.error("Error approving claim:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      return; // Don't submit if reason is empty
    }

    setIsSubmitting(true);
    try {
      await updateClaimStatus(currentClaimId, "Rejected", rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      await fetchEmployeeClaims(employeeId); // Refresh claims data
    } catch (error) {
      console.error("Error rejecting claim:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateClaimStatus = async (claimId, status, remarks = "") => {
    try {
      const response = await axios.put(`${Base_URL}/claims/${claimId}/status`, {
        status,
        remarks,
      });
      console.log("Claim status updated:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error updating claim status:", error);
      throw error;
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchEmployeeClaims(page, recordsPerPage); // Make sure all filters are used inside fetchClaims
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <PageHeader title="Claims" />
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={handleSearchChange}
              className="py-2 pl-10 pr-4 rounded-md bg-white border border-gray-200 shadow-sm w-64"
            />
            <Search
              className="absolute left-1 top-2.5 text-gray-400"
              size={18}
            />
          </div>
          <button
            className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] w-max text-white px-6 py-2.5 rounded-md font-medium"
            onClick={() => setIsModalOpen(true)}
          >
            Apply Claim on Behalf
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {!isSingleBusiness && (
                <th className="text-left py-4 px-6 font-medium text-gray-600">
                  Company
                </th>
              )}
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Date
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Claim Type
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Claim Amount
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Currency
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Status
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Documents
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isSingleBusiness ? "7" : "8"} className="text-center py-4">
                  Loading claims...
                </td>
              </tr>
            ) : filteredClaims.length > 0 ? (
              filteredClaims.map((claim) => (
                <tr
                  key={claim._id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  {!isSingleBusiness && (
                    <td className="py-4 px-6">{claim.company?.name || "N/A"}</td>
                  )}
                  <td className="py-4 px-6">{formatDate(claim.receiptDate)}</td>
                  <td className="py-4 px-6">{claim.claimName || "N/A"}</td>
                  <td className="py-4 px-6">
                    {formatAmount(claim.claimableAmount)}
                  </td>
                  <td className="py-4 px-6">{claim.currency?.name || "N/A"}</td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-4 py-1 rounded-full text-sm ${
                        claim.status === "Approved"
                          ? "bg-green-100 text-green-600"
                          : claim.status === "Rejected"
                            ? "bg-red-100 text-red-600"
                            : "bg-yellow-100 text-yellow-600"
                      }`}
                    >
                      {claim.status || "Pending"}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {claim.supportingDocuments ? (
                      <span
                        className="cursor-pointer text-blue-600"
                        onClick={() =>
                          HandleOpenFile(claim.supportingDocuments.fileId)
                        }
                      >
                        {claim.supportingDocuments.name}
                      </span>
                    ) : (
                      "No documents"
                    )}
                  </td>
                  {claim?.status === "Pending" && (
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        <button
                          className="p-1 rounded-full bg-gray-100 hover:bg-green-100"
                          title="Approve"
                          onClick={() => handleApproveClick(claim._id)}
                        >
                          <CheckIcon className="h-5 w-5 text-gray-600 hover:text-green-600" />
                        </button>
                        <button
                          className="p-1 rounded-full bg-gray-100 hover:bg-red-100"
                          title="Reject"
                          onClick={() => handleRejectClick(claim._id)}
                        >
                          <XIcon className="h-5 w-5 text-gray-600 hover:text-red-600" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  No claims found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex justify-between items-center w-full p-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <span>Show</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setRecordsPerPage(newValue);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchEmployeeClaims(1, newValue);
              }}
              className="w-20 h-8 text-sm"
            >
              {[5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </Select>
            <span>entries</span>
          </div>
          <CustomPagination
            totalResults={totalResults}
            resultsPerPage={recordsPerPage}
            currentPage={currentPage}
            onChange={handlePageChange}
          />
        </div>
      </div>

      {/* Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Claim Approved!</h2>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to approve this claim?
            </p>

            <div className="flex justify-center mb-6">
              <div className="bg-[var(--p-blue)] bg-opacity-20 p-4 rounded-full">
                <svg
                  className="w-12 h-12 text-[var(--p-blue)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
            </div>

            <button
              onClick={handleApproveConfirm}
              disabled={isSubmitting}
              className="w-full bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white py-3 px-4 rounded-md transition duration-200"
            >
              {isSubmitting ? "Processing..." : "Approve"}
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Claim Rejected!</h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-4">
              Please add the reason below to reject the claim.
            </p>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter your reason"
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
                rows="4"
              ></textarea>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleRejectConfirm}
                disabled={isSubmitting || !rejectReason.trim()}
                className={`w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md transition duration-200 ${
                  !rejectReason.trim() || isSubmitting
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSubmitting ? "Processing..." : "Reject Claim Request"}
                {/* {isSubmitting ? "Processing..." : "Reject & Send Email to User"} */}
              </button>

              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-md transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for New Claim Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-4/5 h-5/6 flex flex-col">
            <div className="flex justify-between items-center border-b p-4">
              <h2 className="text-xl font-semibold">Apply Claim on Behalf</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <NewClaimForm
                employeeId={employeeId}
                onSuccess={() => {
                  setIsModalOpen(false);
                  if (employeeId) {
                    fetchEmployeeClaims(employeeId);
                  } else {
                    fetchAllClaims();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentsTab = ({ id }) => {
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const staffId = id;
  const [documents, setDocuments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);

  const [formData, setFormData] = useState({
    documentName: "",
    documentType: "",
    supportingDocuments: null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [adminInfo, setAdminInfo] = useState(null);
  const [staffData, setStaffData] = useState(null);

  console.log("documents", documents);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${Base_URL}/document-types`);
      setDocumentTypes(response.data);
    } catch (error) {
      console.error("Error fetching document types:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch documents
  useEffect(() => {
    fetchDocuments();
    fetchData();
    const storedAdminInfo = localStorage.getItem("adminInfo");
    if (storedAdminInfo) {
      try {
        const parsedAdminInfo = JSON.parse(storedAdminInfo);
        setAdminInfo(parsedAdminInfo);
        console.log("Admin info loaded:", parsedAdminInfo);
      } catch (error) {
        console.error("Error parsing admin info from localStorage:", error);
      }
    } else {
      console.log("No admin info found in localStorage");
    }
    const fetchStaffData = async () => {
      try {
        const response = await axios.get(`${Base_URL}/staff-management/${id}`);
        console.log("staff response", response);
        setStaffData(response.data);
      } catch (error) {
        console.error("Error fetching staff data:", error);
      }
    };

    fetchStaffData();
  }, [staffId]);

  const fetchDocuments = async (page = 1, limit = recordsPerPage) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${Base_URL}/staff/${staffId}/documents`,
        {
          params: {
            page,
            limit,
          },
        },
      );
      setDocuments(response.data.documents);
      setTotalResults(response.data.total);
    } catch (error) {
      console.error("Error fetching documents:", error);
      // toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchDocuments(page, recordsPerPage); // Make sure all filters are used inside fetchClaims
  };

  const notifySuccess = (message) => {
    console.log("Success:", message);
    // Replace with your actual notification implementation
  };

  const notifyError = (message) => {
    console.error("Error:", message);
    // Replace with your actual notification implementation
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Start upload process
      setUploading(true);
      setUploadSuccess(false);

      // Prepare form data for upload
      const formDataForUpload = new FormData();
      formDataForUpload.append("file_path", `Employees/${staffData.firstName}`);
      formDataForUpload.append("business_id", staffData.business._id);
      formDataForUpload.append("customer_id", adminInfo?.id);
      formDataForUpload.append("file_type", file.type);
      formDataForUpload.append("file_size", file.size);
      formDataForUpload.append("file", file);

      try {
        const response = await axios.post(
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        if (response.data.message === "File uploaded successfully") {
          notifySuccess(response.data.message || "File uploaded successfully!");
          const uploadedFile = response.data.file;

          // Update the form data with the uploaded document information
          setFormData({
            ...formData,
            supportingDocuments: {
              fileId: uploadedFile._id,
              name: uploadedFile.name,
              url: uploadedFile.url || "#",
              downloadUrl: uploadedFile.downloadUrl || "#",
              uploadedAt: new Date().toISOString(),
              size: file.size,
              type: file.type,
            },
          });

          // Show success message in UI
          setSuccessMessage(
            response.data.message || "File uploaded successfully!",
          );
          setUploadSuccess(true);

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setUploadSuccess(false);
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError("File upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    }
  };

  const HandleOpenFile = async (documentId) => {
    console.log("document_id", documentId);
    try {
      let Response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`,
      );
      console.log("document_id Response", Response);
      window.open(Response.data.data.url, "_blank");
    } catch (error) {
      notifyError("Error getting file");
      console.log("Error : ", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("supporting documents", formData.supportingDocuments);
    if (!formData.supportingDocuments) {
      // toast.error('Please select a file to upload');
      alert("please select document");
      return;
    }

    try {
      setIsLoading(true);

      console.log("formData", formData);

      const formDataToSend = {
        documentName: formData.documentName,
        documentType: formData.documentType,
        supportingDocuments: formData.supportingDocuments,
        uploadedBy: adminInfo.name,
      };

      // Upload with progress tracking
      await axios.post(
        `${Base_URL}/staff/${staffId}/documents`,
        formDataToSend,
        {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgress(percentCompleted);
          },
        },
      );

      // toast.success('Document uploaded successfully');
      resetForm();
      fetchDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
      // toast.error('Failed to upload document');
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadDocument = async (documentId, documentName) => {
    try {
      const response = await axios.get(
        `${Base_URL}/staff/${staffId}/documents/${documentId}/download`,
        {
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", documentName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading document:", error);
      // toast.error('Failed to download document');
    }
  };

  const resetForm = () => {
    setFormData({
      documentName: "",
      documentType: "",
      supportingDocuments: null,
    });
    setIsModalOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.documentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <PageHeader title="Documents" />
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 pl-10 pr-4 rounded-lg border border-gray-200 bg-white text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
            <Search
              className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-max"
          >
            <Plus size={20} />
            <span>Upload New</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-white">
              <th className="text-left p-4 font-medium text-gray-600">
                Document Name
              </th>
              <th className="text-left p-4 font-medium text-gray-600">
                Document Type
              </th>
              <th className="text-left p-4 font-medium text-gray-600">
                Uploaded By
              </th>
              <th className="text-left p-4 font-medium text-gray-600">
                Date/Time Uploaded
              </th>
              <th className="text-left p-4 font-medium text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !documents.length && (
              <tr>
                <td colSpan="5" className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && filteredDocuments.length === 0 && (
              <tr>
                <td colSpan="5" className="p-4 text-center">
                  No documents found
                </td>
              </tr>
            )}
            {filteredDocuments.map((doc) => (
              <tr key={doc._id} className="border-b hover:bg-gray-50 bg-white">
                <td className="p-4 text-gray-800">{doc.documentName}</td>
                <td className="p-4 text-gray-800">{doc.documentType}</td>
                <td className="p-4 text-gray-800">{doc.uploadedBy}</td>
                <td className="p-4 text-gray-800">
                  {formatDate(doc.uploadedAt)}
                </td>
                <td className="p-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        HandleOpenFile(doc.supportingDocuments.fileId)
                      }
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Eye size={18} />
                    </button>
                    {/* <button
                      onClick={() =>
                        handleDownloadDocument(doc._id, doc.documentName)
                      }
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Download size={18} />
                    </button> */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center w-full p-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <span>Show</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setRecordsPerPage(newValue);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchDocuments(1, newValue);
              }}
              className="w-20 h-8 text-sm"
            >
              {[5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </Select>
            <span>entries</span>
          </div>
          <CustomPagination
            totalResults={totalResults}
            resultsPerPage={recordsPerPage}
            currentPage={currentPage}
            onChange={handlePageChange}
          />
        </div>
      </div>

      {/* Upload Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Upload New Document</h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  name="documentName"
                  value={formData.documentName}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  required
                >
                  <option value="">Select Document Type</option>
                  {documentTypes.map((type) => (
                    <option key={type._id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload File
                </label>
                <div className="border border-dashed border-[var(--p-blue)] rounded-lg p-4 text-center cursor-pointer">
                  <input
                    type="file"
                    name="supportingDocuments"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex items-center justify-center"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="mr-2"
                    >
                      <path
                        d="M10.0003 13.3333V1.66666M10.0003 1.66666L5.83366 5.83332M10.0003 1.66666L14.167 5.83332"
                        stroke="var(--p-blue)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M1.66699 14.1667L2.22533 16.3583C2.27627 16.5793 2.38868 16.7841 2.55118 16.9485C2.71368 17.1129 2.91952 17.2308 3.14199 17.2883C3.54199 17.4 4.25033 17.5 5.00033 17.5H15.0003C15.7503 17.5 16.4587 17.4 16.8587 17.2883C17.0811 17.2308 17.287 17.1129 17.4495 16.9485C17.612 16.7841 17.7244 16.5793 17.7753 16.3583L18.3337 14.1667"
                        stroke="var(--p-blue)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[var(--p-blue)]">
                      {uploading
                        ? "Uploading..."
                        : "Upload Supporting Documents"}
                    </span>
                  </label>
                </div>
                {/* Display upload status */}
                {uploadSuccess && (
                  <div className="mt-2 text-sm text-green-600">
                    {successMessage}
                  </div>
                )}
                {/* Display uploaded document info if available */}
                {formData.supportingDocuments && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        {formData.supportingDocuments.name}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            HandleOpenFile(formData.supportingDocuments.fileId)
                          }
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        {/* <button 
                      type="button"
                      onClick={() => handleDownload(formData.supportingDocuments.fileId)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Download
                    </button> */}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mb-4">
                  <div className="bg-gray-200 rounded-full h-2.5 mb-1">
                    <div
                      className="bg-[var(--p-blue)] h-2.5 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 text-right">
                    {uploadProgress}% uploaded
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9CBA33] flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const EducationalCertificatesTab = ({ id }) => {
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const staffId = id;
  const [certificates, setCertificates] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCertificate, setEditingCertificate] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    institution: "",
    yearCompleted: "",
    certificateFile: null,
  });
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  console.log("total", totalResults);
  console.log("recordsPerPage", recordsPerPage);

  // Fetch certificates
  useEffect(() => {
    fetchCertificates();
  }, [staffId]);

  const fetchCertificates = async (page = 1, limit = recordsPerPage) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${Base_URL}/staff-management/certificates/${staffId}`,
        {
          params: {
            page,
            limit,
          },
        },
      );

      console.log("certificates", response.data);
      setCertificates(response.data.certificates);
      setTotalResults(response.data.total);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      // toast.error('Failed to load certificates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "certificateFile" && files && files[0]) {
      setFormData({
        ...formData,
        certificateFile: files[0],
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchCertificates(page, recordsPerPage); // Make sure all filters are used inside fetchClaims
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      const formDataToSend = {
        title: formData.title,
        institution: formData.institution,
        yearCompleted: formData.yearCompleted,
      };
      // formDataToSend.append('title', formData.title);
      // formDataToSend.append('institution', formData.institution);
      // formDataToSend.append('yearCompleted', formData.yearCompleted);

      // if (formData.certificateFile) {
      //   formDataToSend.append('certificateFile', formData.certificateFile);
      // }

      console.log("Form Data:", formDataToSend);

      if (editingCertificate) {
        // Update existing certificate
        await axios.put(
          `${Base_URL}/staff-management/certificates/${staffId}/${editingCertificate._id}`,
          formDataToSend,
        );
        // toast.success('Certificate updated successfully');
      } else {
        // Add new certificate
        await axios.post(
          `${Base_URL}/staff-management/certificates/${staffId}`,
          formDataToSend,
        );
        // toast.success('Certificate added successfully');
      }

      resetForm();
      fetchCertificates();
    } catch (error) {
      console.error("Error saving certificate:", error);
      // toast.error('Failed to save certificate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (certificate) => {
    setEditingCertificate(certificate);
    setFormData({
      title: certificate.title,
      institution: certificate.institution,
      yearCompleted: certificate.yearCompleted.toString(),
      certificateFile: null,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (certificateId) => {
    if (!window.confirm("Are you sure you want to delete this certificate?")) {
      return;
    }

    try {
      setIsLoading(true);
      await axios.delete(
        `${Base_URL}/certificates/staff/${staffId}/certificate/${certificateId}`,
      );
      // toast.success('Certificate deleted successfully');
      fetchCertificates();
    } catch (error) {
      console.error("Error deleting certificate:", error);
      // toast.error('Failed to delete certificate');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      institution: "",
      yearCompleted: "",
      certificateFile: null,
    });
    setEditingCertificate(null);
    setIsModalOpen(false);
  };

  const filteredCertificates = certificates.filter(
    (certificate) =>
      certificate.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      certificate.institution
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      certificate.yearCompleted.toString().includes(searchTerm),
  );

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <PageHeader title="Educational Certificates" />
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 pl-10 pr-4 rounded-lg border border-gray-200 bg-white text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
            <Search
              className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-max"
          >
            <Plus size={20} />
            <span>Upload New</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-white">
              <th className="text-left p-4 font-medium text-gray-600">Title</th>
              <th className="text-left p-4 font-medium text-gray-600">
                Institution
              </th>
              <th className="text-left p-4 font-medium text-gray-600">
                Year Completed
              </th>
              <th className="text-left p-4 font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan="4" className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && filteredCertificates.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-center">
                  No certificates found
                </td>
              </tr>
            )}
            {!isLoading &&
              filteredCertificates.map((certificate) => (
                <tr
                  key={certificate._id}
                  className="border-b hover:bg-gray-50 bg-white"
                >
                  <td className="p-4 text-gray-800">{certificate.title}</td>
                  <td className="p-4 text-gray-800">
                    {certificate.institution}
                  </td>
                  <td className="p-4 text-gray-800">
                    {certificate.yearCompleted}
                  </td>
                  <td className="p-4 flex items-center gap-3">
                    <button
                      onClick={() => handleEdit(certificate)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <PenLine size={18} />
                    </button>
                    {/* <button 
                    onClick={() => handleDelete(certificate._id)} 
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button> */}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center w-full p-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <span>Show</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setRecordsPerPage(newValue);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchCertificates(1, newValue);
              }}
              className="w-20 h-8 text-sm"
            >
              {[5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </Select>
            <span>entries</span>
          </div>
          <CustomPagination
            totalResults={totalResults}
            resultsPerPage={recordsPerPage}
            currentPage={currentPage}
            onChange={handlePageChange}
          />
        </div>
      </div>

      {/* Modal for adding/editing certificates */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingCertificate ? "Edit Certificate" : "Add New Certificate"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institution
                </label>
                <input
                  type="text"
                  name="institution"
                  value={formData.institution}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year Completed
                </label>
                <input
                  type="number"
                  name="yearCompleted"
                  value={formData.yearCompleted}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              {/* <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificate File
                </label>
                <input
                  type="file"
                  name="certificateFile"
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required={!editingCertificate}
                />
              </div> */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9CBA33]"
                >
                  {isLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const EmergencyContactTab = ({ id }) => {
  const staffId = id;
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [contacts, setContacts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    relation: "",
    phone: "",
    address: "",
  });
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  // Fetch emergency contacts
  useEffect(() => {
    fetchContacts();
  }, [staffId]);

  const fetchContacts = async (page = 1, limit = recordsPerPage) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${Base_URL}/staff-management/emergency-contacts/${staffId}`,
        {
          params: {
            page,
            limit,
          },
        },
      );
      setContacts(response.data.emergencyContacts);
      setTotalResults(response.data.total);
    } catch (error) {
      console.error("Error fetching emergency contacts:", error);
      // toast.error('Failed to load emergency contacts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts(currentPage, recordsPerPage);
  }, [staffId, currentPage, recordsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchContacts(page, recordsPerPage); // Make sure all filters are used inside fetchClaims
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      if (editingContact) {
        // Update existing contact
        await axios.put(
          `${Base_URL}/staff-management/emergency-contacts/${staffId}/${editingContact._id}`,
          formData,
        );
        // toast.success('Emergency contact updated successfully');
      } else {
        // Add new contact
        await axios.post(
          `${Base_URL}/staff-management/emergency-contacts/${staffId}`,
          formData,
        );
        // toast.success('Emergency contact added successfully');
      }

      resetForm();
      fetchContacts();
    } catch (error) {
      console.error("Error saving emergency contact:", error);
      // toast.error('Failed to save emergency contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      relation: contact.relation,
      phone: contact.phone,
      address: contact.address,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (contactId) => {
    if (
      !window.confirm("Are you sure you want to delete this emergency contact?")
    ) {
      return;
    }

    try {
      setIsLoading(true);
      await axios.delete(
        `/api/staff/${staffId}/emergency-contacts/${contactId}`,
      );
      // toast.success('Emergency contact deleted successfully');
      fetchContacts();
    } catch (error) {
      console.error("Error deleting emergency contact:", error);
      // toast.error('Failed to delete emergency contact');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      relation: "",
      phone: "",
      address: "",
    });
    setEditingContact(null);
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <PageHeader title="Emergency Contact" />
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 pl-10 pr-4 rounded-lg border border-gray-200 bg-white text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            />
            <Search
              className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-max"
          >
            <Plus size={20} />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-md shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-5 bg-gray-50 p-4">
          <div className="font-medium text-gray-600">Name</div>
          <div className="font-medium text-gray-600">Relation</div>
          <div className="font-medium text-gray-600">Phone</div>
          <div className="font-medium text-gray-600">Address</div>
          <div className="font-medium text-gray-600 text-right">Action</div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        )}

        {/* Empty State */}
        {!isLoading && contacts.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No emergency contacts found
          </div>
        )}

        {/* Table Rows */}
        {!isLoading &&
          contacts.map((contact) => (
            <div
              key={contact._id}
              className="grid grid-cols-5 p-4 border-t border-gray-100 items-center hover:bg-gray-50"
            >
              <div>{contact.name}</div>
              <div>{contact.relation}</div>
              <div>{contact.phone}</div>
              <div>{contact.address}</div>
              <div className="text-right flex justify-end gap-3">
                <button
                  onClick={() => handleEdit(contact)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <PenLine size={18} />
                </button>
                {/* <button
                  onClick={() => handleDelete(contact._id)}
                  className="text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={18} />
                </button> */}
              </div>
            </div>
          ))}
        <div className="flex justify-between items-center w-full p-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <span>Show</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                setRecordsPerPage(newValue);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchContacts(1, newValue);
              }}
              className="w-20 h-8 text-sm"
            >
              {[5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </Select>
            <span>entries</span>
          </div>
          <CustomPagination
            totalResults={totalResults}
            resultsPerPage={recordsPerPage}
            currentPage={currentPage}
            onChange={handlePageChange}
          />
        </div>
      </div>

      {/* Modal for adding/editing emergency contacts */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingContact
                ? "Edit Emergency Contact"
                : "Add New Emergency Contact"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relation
                </label>
                <input
                  type="text"
                  name="relation"
                  value={formData.relation}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="3"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9CBA33]"
                >
                  {isLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Events = ({ id }) => {
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const staffId = id;
  const [currentYear, setCurrentYear] = useState(
    new Date(new Date().getFullYear(), 0),
  );
  const [summaryData, setSummaryData] = useState({});
  const [loading, setLoading] = useState(false);
  const fetchEventPointsSummary = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/event/staff-points/${id}?year=${currentYear}`,
      );

      console.log("URL IS: ", `${Base_URL}/event/staff-points/${id}`);

      console.log("staff-points are", response.data);
      setSummaryData(response.data || {});
    } catch (error) {
      console.error("Error fetching employment records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("staffId is", staffId);
    if (staffId) {
      fetchEventPointsSummary();
    }
  }, [staffId, currentYear]);

  // const summaryData = {
  //   staffId: "683571ff2eafe5c4b8bff81",
  //   year: 2026,
  //   totalPointsObtained: 10,
  //   action: "/view-points/683571ff2eafe5c4b8bff810/points?year=2026",
  // }

  return (
    <div className="bg-white rounded-lg p-6 mb-6">
      {/* Action Button */}
      <div className="flex justify-end gap-3">
        <CustomDatePicker
          value={currentYear}
          onChange={(date) => setCurrentYear(date)}
          placeholder="Select year"
          style={{ width: "160px" }}
          yearOnly={true}
        />

        <Link
          to={`/view-points/${id}`}
          className="inline-flex items-center px-4 py-2 bg-[var(--p-blue)] hover:bg-[#9CBA33] text-white text-sm font-medium rounded-md transition-colors"
        >
          View Detailed Points
          <svg
            className="ml-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
      {/* <h2 className="text-xl font-semibold text-gray-900 mb-4">Staff Summary</h2> */}
      {loading && !Object.keys(summaryData).length && (
        <div className="p-4 text-center w-full">Loading...</div>
      )}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-2">
          {/* Staff ID Card */}
          {/* <div className="bg-gray-50 rounded-lg p-4 flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Staff ID</p>
            <p className="font-medium text-gray-900">{summaryData.staffId}</p>
          </div>
        </div> */}

          {/* Year Card */}
          <div className="bg-gray-50 rounded-lg p-4 flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Year</p>
              <p className="font-medium text-gray-900">{summaryData.year}</p>
            </div>
          </div>

          {/* Points Card */}
          <div className="bg-gray-50 rounded-lg p-4 flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Award className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Points</p>
              <p className="font-medium text-gray-900">
                {summaryData.totalPointsObtained?.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EditDetails = ({
  formData,
  setFormData,
  id,
  activeTab,
  setActiveTab,
  systemUserContent,
}) => {
  const tabs = TAB_CONFIG;
  const activeTabConfig = tabs[activeTab] || tabs[0];
  const ActiveTabIcon = activeTabConfig.icon;
  const editPanelRef = React.useRef(null);
  const tabButtonRefs = React.useRef({});
  const tabRailRef = React.useRef(null);
  const shouldScrollContentOnTabChangeRef = React.useRef(false);

  React.useLayoutEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollTabIntoRailStart(
          tabRailRef.current,
          tabButtonRefs.current[activeTab],
          "smooth"
        );
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeTab]);

  React.useEffect(() => {
    if (!shouldScrollContentOnTabChangeRef.current) return;

    const timer = window.setTimeout(() => {
      editPanelRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
      shouldScrollContentOnTabChangeRef.current = false;

      requestAnimationFrame(() => {
        scrollTabIntoRailStart(
          tabRailRef.current,
          tabButtonRefs.current[activeTab],
          "smooth"
        );
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeTab]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 0:
        return systemUserContent;
      case 1:
        return (
          <ContactInfoTab
            formData={formData}
            setFormData={setFormData}
            id={id}
          />
        );
      case 2:
        return <EmploymentRecordTab id={id} />;
      // case 2:
      //   return <AttendanceTab />;
      case 3:
        return <LeavesTab employeeId={id} />;
      case 4:
        return <ClaimsTab employeeId={id} />;
      case 5:
        return <DocumentsTab id={id} />;
      case 6:
        return <EducationalCertificatesTab id={id} />;
      case 7:
        return <EmergencyContactTab id={id} />;
      case 8:
        return <Events id={id} />;
      case 9:
        return (
          <BankDetailsTab
            id={id}
            formData={formData}
            setFormData={setFormData}
          />
        );
      case 10:
        return <PayrollProfileTab id={id} staffFormData={formData} />;
      default:
        return systemUserContent;
    }
  };

  return (
    <div className="container mx-auto mt-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col lg:flex-row">
          <TabHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={tabs}
            tabButtonRefs={tabButtonRefs}
            tabRailRef={tabRailRef}
            onTabSelect={() => {
              shouldScrollContentOnTabChangeRef.current = true;
            }}
          />

          <div
            ref={editPanelRef}
            className="min-w-0 flex-1 scroll-mt-28 bg-white lg:scroll-mt-32"
          >
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-white px-5 py-5 md:px-8">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(242,144,16,0.12)] text-[var(--p-blue)]">
                  <ActiveTabIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Staff Details
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                    {activeTabConfig.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    {activeTabConfig.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-2 md:p-4">{renderActiveTab()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditDetails;
