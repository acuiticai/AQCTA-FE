import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import { AiOutlineSave, AiOutlinePlus, AiOutlineDelete } from "react-icons/ai";
import {
  DollarSign,
  Shield,
  FileText,
  CreditCard,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { Page } from "@/page-layouts/index";
import { notifyError, notifySuccess } from "@/utils/toast";
import PcbClaimsInputs from "@/pages/Payroll/components/PcbClaimsInputs";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EmployeePayrollProfile = ({
  embedded = false,
  employeeIdProp = "",
} = {}) => {
  const { employeeId: paramEmployeeId, id: paramId } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);

  const resolvedEmployeeId =
    employeeIdProp ||
    paramEmployeeId ||
    paramId ||
    (() => {
      const path = window?.location?.pathname || "";
      const m =
        path.match(/\/staff\/([a-f0-9]{24})/i) ||
        path.match(/\/payroll\/employee\/([a-f0-9]{24})/i);
      return m?.[1] || "";
    })();

  const [profile, setProfile] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [payGroups, setPayGroups] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    compensation: true,
    allowances: false,
    references: false,
    statutory: false,
    tax: false,
  });

  const toggleSection = (key) =>
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }));

  // Statutory ID validation rules (matching backend)
  const statutoryValidation = {
    epfNumber: { regex: /^\d{5,8}$/, hint: "5-8 digits" },
    socsoNumber: { regex: /^[A-Z0-9]{8,15}$/i, hint: "8-15 alphanumeric" },
    taxFileNumber: {
      regex: /^(SG|OG|D|C|CS|TP)\s?\d{8,11}$/i,
      hint: "e.g. SG 10234567890",
    },
    eisNumber: { regex: /^[A-Z0-9]{8,15}$/i, hint: "8-15 alphanumeric" },
  };

  const getStatutoryError = (field) => {
    const val = formData[field];
    if (!val) return "";
    const rule = statutoryValidation[field];
    return rule && !rule.regex.test(val) ? rule.hint : "";
  };
  const [payElements, setPayElements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const businessRef = useRef("");

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
    epfNumber: "",
    socsoNumber: "",
    taxFileNumber: "",
    eisNumber: "",
    allowances: [],
  });

  useEffect(() => {
    if (resolvedEmployeeId) fetchData();
    else setIsLoading(false);
  }, [resolvedEmployeeId]);

  const fetchData = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const headers = { authorization: `Bearer ${state?.adminInfo?.token}` };
      const { data: emp } = await axios.get(
        `${Base_URL}/staff-management/${resolvedEmployeeId}`,
        { headers },
      );
      setEmployee(emp);

      const biz = emp?.business?._id || emp?.business || "";
      businessRef.current = biz;

      if (biz) {
        const [profileRes, groupsRes, elementsRes] = await Promise.all([
          axios
            .get(
              `${Base_URL}/payroll/employee-profiles/by-employee/${resolvedEmployeeId}`,
              {
                params: { business: biz },
              },
            )
            .catch(() => ({ data: null })),
          axios.get(`${Base_URL}/payroll/pay-groups`, {
            params: { business: biz },
          }),
          axios.get(`${Base_URL}/payroll/pay-element-types`, {
            params: { business: biz, category: "earning" },
          }),
        ]);

        setPayGroups(groupsRes.data || []);
        setPayElements(
          elementsRes.data?.filter(
            (e) => e.subType !== "basic_salary" && e.subType !== "overtime",
          ) || [],
        );

        if (profileRes.data) {
          setProfile(profileRes.data);
          setFormData({
            basicSalary: profileRes.data.basicSalary || 0,
            payType: profileRes.data.payType || "monthly",
            payGroup:
              profileRes.data.payGroup?._id || profileRes.data.payGroup || "",
            otEnabled: profileRes.data.otEnabled ?? true,
            epfEnabled: profileRes.data.epfEnabled ?? true,
            socsoEnabled: profileRes.data.socsoEnabled ?? true,
            eisEnabled: profileRes.data.eisEnabled ?? true,
            pcbEnabled: profileRes.data.pcbEnabled ?? true,
            hrdfEnabled: profileRes.data.hrdfEnabled ?? false,
            epfCategory: profileRes.data.epfCategory || "part_a",
            socsoCategory: profileRes.data.socsoCategory || "first_category",
            taxResidentStatus: profileRes.data.taxResidentStatus || "resident",
            maritalStatusForTax:
              profileRes.data.maritalStatusForTax || "single",
            childrenForTaxRelief: profileRes.data.childrenForTaxRelief || {
              under18: 0,
              studying: 0,
              studyingDiploma: 0,
              disabled: 0,
              disabledStudying: 0,
            },
            individualDisability: profileRes.data.individualDisability ?? false,
            spouseDisability: profileRes.data.spouseDisability ?? false,
            pcbClaims: {
              tp1: {
                totalDeductionsAnnual:
                  profileRes.data?.pcbClaims?.tp1?.totalDeductionsAnnual ?? 0,
                zakatAnnual: profileRes.data?.pcbClaims?.tp1?.zakatAnnual ?? 0,
                umrahAnnual: profileRes.data?.pcbClaims?.tp1?.umrahAnnual ?? 0,
                deductions: profileRes.data?.pcbClaims?.tp1?.deductions || {},
                rebates: profileRes.data?.pcbClaims?.tp1?.rebates || {},
              },
              tp3: {
                previousPcbPaid:
                  profileRes.data?.pcbClaims?.tp3?.previousPcbPaid ?? 0,
                previousEmploymentMonthsWorked:
                  profileRes.data?.pcbClaims?.tp3
                    ?.previousEmploymentMonthsWorked ?? 0,
                previousEmploymentMonthlyGrossRemuneration:
                  profileRes.data?.pcbClaims?.tp3
                    ?.previousEmploymentMonthlyGrossRemuneration ?? 0,
                previousEmploymentMonthlyTaxExemptAllowances:
                  profileRes.data?.pcbClaims?.tp3
                    ?.previousEmploymentMonthlyTaxExemptAllowances ?? 0,
                previousEmploymentApprovedEpfContributionsAnnual:
                  profileRes.data?.pcbClaims?.tp3
                    ?.previousEmploymentApprovedEpfContributionsAnnual ?? 0,
                previousEmploymentZakatAnnual:
                  profileRes.data?.pcbClaims?.tp3
                    ?.previousEmploymentZakatAnnual ?? 0,
                previousEmploymentUmrahExemptionLevyAnnual:
                  profileRes.data?.pcbClaims?.tp3
                    ?.previousEmploymentUmrahExemptionLevyAnnual ?? 0,
              },
            },
            epfNumber: profileRes.data.epfNumber || "",
            socsoNumber: profileRes.data.socsoNumber || "",
            taxFileNumber: profileRes.data.taxFileNumber || "",
            eisNumber: profileRes.data.eisNumber || "",
            allowances: profileRes.data.allowances || [],
          });
        }
      }
    } catch (err) {
      console.error("EmployeePayrollProfile fetchData error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate statutory IDs before saving
    const idErrors = ["epfNumber", "socsoNumber", "taxFileNumber", "eisNumber"]
      .map((f) => getStatutoryError(f))
      .filter(Boolean);
    if (idErrors.length > 0) {
      notifyError("Please fix statutory ID format errors before saving");
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      const headers = { authorization: `Bearer ${state?.adminInfo?.token}` };

      let empId = resolvedEmployeeId;
      let bizId = businessRef.current;

      if (!bizId && empId) {
        const { data: emp } = await axios.get(
          `${Base_URL}/staff-management/${empId}`,
          { headers },
        );
        bizId = emp?.business?._id || emp?.business || "";
        businessRef.current = bizId;
      }

      if (!bizId || !empId) {
        notifyError("Business and employee IDs are required");
        return;
      }

      await axios.post(`${Base_URL}/payroll/employee-profiles`, {
        ...formData,
        business: bizId,
        employee: empId,
      });
      notifySuccess("Payroll profile saved");
      setMessage("Payroll profile saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to save";
      setMessage(errMsg);
      notifyError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const addAllowance = () => {
    setFormData((f) => ({
      ...f,
      allowances: [...f.allowances, { payElementType: "", amount: 0 }],
    }));
  };

  const removeAllowance = (index) => {
    setFormData((f) => ({
      ...f,
      allowances: f.allowances.filter((_, i) => i !== index),
    }));
  };

  const updateAllowance = (index, field, value) => {
    setFormData((f) => {
      const alws = [...f.allowances];
      alws[index] = {
        ...alws[index],
        [field]: value,
      };
      return { ...f, allowances: alws };
    });
  };

  const blurAllowance = (index, field) => {
    if (field === "amount") {
      setFormData((f) => {
        const alws = [...f.allowances];
        alws[index] = {
          ...alws[index],
          amount: parseFloat(alws[index].amount) || 0,
        };
        return { ...f, allowances: alws };
      });
    }
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

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );

  const saveDisabled = isSaving || !resolvedEmployeeId;

  return (
    <Page
      header={{
        title: "Payroll",
        showBackButton: !embedded,
        onBackClick: embedded ? undefined : () => history.goBack(),
      }}
    >
      <div className="mt-8">
        <p className="text-sm text-gray-500 mb-6">
          {employee?.fullName || "Employee"}{" "}
          {employee?.employeeId ? `(${employee.employeeId})` : ""}
        </p>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded ${message.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {message}
          </div>
        )}

        <div className="space-y-3">
          {/* Compensation */}
          <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-400" />
            <button
              type="button"
              onClick={() => toggleSection("compensation")}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <DollarSign className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                </span>
                Compensation
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.compensation ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.compensation ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {formData.payType === "hourly"
                      ? "Hourly Rate (RM)"
                      : formData.payType === "daily"
                        ? "Daily Rate (RM)"
                        : "Basic Salary (RM)"}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Pay Type
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Pay Group
                  </label>
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

          {/* Allowances */}
          <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-violet-400" />
            <button
              type="button"
              onClick={() => toggleSection("allowances")}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Briefcase className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                </span>
                Allowances
                {formData.allowances.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    ({formData.allowances.length})
                  </span>
                )}
              </h3>
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
                    onClick={addAllowance}
                    className="flex items-center gap-1 text-sm font-medium"
                    style={{ color: "var(--p-blue)" }}
                  >
                    <AiOutlinePlus /> Add Allowance
                  </button>
                </div>
                {formData.allowances.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No allowances assigned. Click "Add Allowance" to begin.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {formData.allowances.map((alw, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap sm:flex-nowrap gap-3 items-center"
                      >
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
                        <div className="w-full sm:w-40">
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
                          onClick={() => removeAllowance(i)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <AiOutlineDelete size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statutory Reference Numbers */}
          <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-400" />
            <button
              type="button"
              onClick={() => toggleSection("references")}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <CreditCard className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                </span>
                Statutory Reference Numbers
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.references ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.references ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="px-4 sm:px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    EPF Number
                  </label>
                  <input
                    value={formData.epfNumber}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, epfNumber: e.target.value }))
                    }
                    placeholder="e.g. 12345678"
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 transition-all ${getStatutoryError("epfNumber") ? "border-red-400 focus:ring-red-400 focus:border-red-400" : "border-gray-300 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"}`}
                  />
                  {getStatutoryError("epfNumber") && (
                    <p className="text-xs text-red-500 mt-1">
                      {getStatutoryError("epfNumber")}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    SOCSO Number
                  </label>
                  <input
                    value={formData.socsoNumber}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        socsoNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. A12345678"
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 transition-all ${getStatutoryError("socsoNumber") ? "border-red-400 focus:ring-red-400 focus:border-red-400" : "border-gray-300 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"}`}
                  />
                  {getStatutoryError("socsoNumber") && (
                    <p className="text-xs text-red-500 mt-1">
                      {getStatutoryError("socsoNumber")}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    placeholder="e.g. SG 10234567890"
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 transition-all ${getStatutoryError("taxFileNumber") ? "border-red-400 focus:ring-red-400 focus:border-red-400" : "border-gray-300 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"}`}
                  />
                  {getStatutoryError("taxFileNumber") && (
                    <p className="text-xs text-red-500 mt-1">
                      {getStatutoryError("taxFileNumber")}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    EIS Number
                  </label>
                  <input
                    value={formData.eisNumber}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, eisNumber: e.target.value }))
                    }
                    placeholder="e.g. E12345678"
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 transition-all ${getStatutoryError("eisNumber") ? "border-red-400 focus:ring-red-400 focus:border-red-400" : "border-gray-300 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"}`}
                  />
                  {getStatutoryError("eisNumber") && (
                    <p className="text-xs text-red-500 mt-1">
                      {getStatutoryError("eisNumber")}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                Bank details are managed under the employee's{" "}
                <strong>Bank Details</strong> tab in Staff Management and will
                be automatically used for payroll.
              </div>
            </div>
          </div>

          {/* Statutory Contributions */}
          <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-green-400" />
            <button
              type="button"
              onClick={() => toggleSection("statutory")}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                </span>
                Statutory Contributions
              </h3>
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
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={formData[key]}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            [key]: e.target.checked,
                          }))
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      {key.replace("Enabled", "").toUpperCase()}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                      <option value="part_a">
                        Part A - Malaysian below 60
                      </option>
                      <option value="part_b">
                        Part B - Non-Malaysian below 60
                      </option>
                      <option value="part_c">Part C - PR above 60</option>
                      <option value="part_d">
                        Part D - Non-Malaysian above 60
                      </option>
                      <option value="part_e">
                        Part E - Malaysian above 60
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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

          {/* Tax (PCB) Settings */}
          <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-500 to-orange-400" />
            <button
              type="button"
              onClick={() => toggleSection("tax")}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5 text-[var(--p-blue)]" />
                </span>
                Tax (PCB) Settings
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedSections.tax ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedSections.tax ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                {/* Children for Tax Relief */}
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
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {c.label}
                      </label>
                      <input
                        type="number"
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
                        onChange={(e) => {
                          setFormData((f) => ({
                            ...f,
                            childrenForTaxRelief: {
                              ...f.childrenForTaxRelief,
                              [c.key]:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value) || 0,
                            },
                          }));
                        }}
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
                <PcbClaimsInputs
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              <AiOutlineSave /> {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default EmployeePayrollProfile;
