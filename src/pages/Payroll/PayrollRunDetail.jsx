import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  AiOutlineCalculator,
  AiOutlineCheck,
  AiOutlineEye,
  AiOutlinePrinter,
  AiOutlineEdit,
} from "react-icons/ai";
import { FiDollarSign } from "react-icons/fi";
import { Download, Mail, Printer, Trash2, X } from "lucide-react";
import axios from "axios";
import ejs from "ejs";
import numberToWords from "number-to-words";
import { Page } from "@/page-layouts/index";
import { formatAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import ConfirmationModal from "@/pages/Customer/reusablecomponents/ConfirmationModal ";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const STATUS_STYLES = {
  draft:
    "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 ring-1 ring-gray-200",
  calculated:
    "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 ring-1 ring-blue-200",
  reviewed:
    "bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-700 ring-1 ring-amber-200",
  approved:
    "bg-gradient-to-r from-emerald-50 to-green-100 text-emerald-700 ring-1 ring-emerald-200",
  posted:
    "bg-gradient-to-r from-violet-50 to-purple-100 text-violet-700 ring-1 ring-violet-200",
  paid: "bg-gradient-to-r from-teal-50 to-emerald-100 text-teal-700 ring-1 ring-teal-200",
};
const STATUS_DOT = {
  draft: "bg-gray-400",
  calculated: "bg-blue-500",
  reviewed: "bg-amber-500",
  approved: "bg-emerald-500",
  posted: "bg-violet-500",
  paid: "bg-teal-500",
};

const PayrollRunDetail = () => {
  const { id } = useParams();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [run, setRun] = useState(null);
  const [lines, setLines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [deductionElements, setDeductionElements] = useState([]);
  const [earningElements, setEarningElements] = useState([]);
  const [editLine, setEditLine] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [showHrSyncModal, setShowHrSyncModal] = useState(false);
  const [hrSyncPreview, setHrSyncPreview] = useState(null);
  const [hrSyncLoading, setHrSyncLoading] = useState(false);
  const [hrSyncApplying, setHrSyncApplying] = useState(false);
  const [hrSyncOptions, setHrSyncOptions] = useState({
    includeUnpaidLeaves: true,
    includeOT: true,
    includeClaims: true,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirm");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmText, setConfirmText] = useState("Confirm");
  const confirmActionRef = useRef(null);

  const [downloadingId, setDownloadingId] = useState("");
  const [templateSelectionModal, setTemplateSelectionModal] = useState({
    isOpen: false,
    templates: [],
    payslipId: null,
    payslipData: null,
    businessDetails: null,
  });

  const activeBusinessId =
    (run?.business &&
      (typeof run.business === "object" ? run.business._id : run.business)) ||
    selectedBusiness;

  const openConfirmModal = ({
    title,
    message,
    confirmText = "Confirm",
    onConfirm,
  }) => {
    confirmActionRef.current = onConfirm;
    setConfirmTitle(title || "Confirm");
    setConfirmMessage(message || "");
    setConfirmText(confirmText);
    setConfirmOpen(true);
  };

  const handleConfirmModal = async () => {
    const fn = confirmActionRef.current;
    confirmActionRef.current = null;
    setConfirmOpen(false);
    if (typeof fn === "function") await fn();
  };

  useEffect(() => {
    const adminId = adminInfo?.id || adminInfo?._id;
    if (!adminId) return;

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    const fetchAssigned = async () => {
      try {
        const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`, {
          headers,
        });
        const list = res.data?.businesses || [];
        if (list.length > 0) setSelectedBusiness((prev) => prev || list[0]._id);
      } catch {
        // ignore
      }
    };

    fetchAssigned();
  }, [adminInfo?.id, adminInfo?._id, adminInfo?.token]);

  useEffect(() => {
    if (!activeBusinessId) return;
    const fetchDeductionElements = async () => {
      try {
        const { data } = await axios.get(
          `${Base_URL}/payroll/pay-element-types`,
          {
            params: { business: activeBusinessId, category: "deduction" },
          },
        );
        // Allow only active manual (non-statutory) deductions configured in Pay Elements.
        setDeductionElements(
          (data || []).filter(
            (e) =>
              e?.calculationMethod === "manual" &&
              (e?.status === "active" || e?.status === true) &&
              ![
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
              ].includes(e?.subType),
          ),
        );
      } catch {
        setDeductionElements([]);
      }
    };
    const fetchEarningElements = async () => {
      try {
        const { data } = await axios.get(
          `${Base_URL}/payroll/pay-element-types`,
          {
            params: { business: activeBusinessId, category: "earning" },
          },
        );
        // Allow only active manual earnings configured in Pay Elements.
        setEarningElements(
          (data || []).filter(
            (e) =>
              (e?.status === "active" || e?.status === true) &&
              e?.calculationMethod === "manual"
          ),
        );
      } catch {
        setEarningElements([]);
      }
    };
    fetchDeductionElements();
    fetchEarningElements();
  }, [activeBusinessId]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: runData } = await axios.get(
        `${Base_URL}/payroll/runs/${id}`,
      );
      setRun(runData);

      const runBusinessId =
        runData?.business &&
        (typeof runData.business === "object"
          ? runData.business._id
          : runData.business);

      if (runBusinessId) {
        setSelectedBusiness(runBusinessId);
        try {
          const { data: settingsData } = await axios.get(
            `${Base_URL}/payroll/company-settings/${runBusinessId}/${runData.year}`
          );
          setCompanySettings(settingsData);
        } catch (settingsErr) {
          console.warn("Failed to load company payroll settings:", settingsErr);
        }
      }

      const { data: linesData } = await axios.get(
        `${Base_URL}/payroll/runs/${id}/lines`,
        {
          params: runBusinessId ? { business: runBusinessId } : {},
        },
      );

      setLines(linesData);
    } catch (err) {
      console.error(err);
      notifyError(err.response?.data?.message || "Failed to load payroll run");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = async () => {
    openConfirmModal({
      title: "Calculate Payroll",
      message: "Calculate/recalculate payroll for all employees?",
      confirmText: "Calculate",
      onConfirm: async () => {
        try {
          await axios.post(
            `${Base_URL}/payroll/runs/${id}/calculate`,
            null,
            activeBusinessId
              ? { params: { business: activeBusinessId } }
              : undefined,
          );
          fetchData();
        } catch (err) {
          notifyError(err.response?.data?.message || "Calculation failed");
        }
      },
    });
  };

  const handleStatusChange = async (newStatus) => {
    const labels = {
      reviewed: "Mark as Reviewed",
      approved: "Approve",
      posted: "Post to Finance",
      paid: "Mark as Paid",
    };
    openConfirmModal({
      title: "Update Status",
      message: `${labels[newStatus] || newStatus}?`,
      confirmText: "Confirm",
      onConfirm: async () => {
        try {
          await axios.patch(
            `${Base_URL}/payroll/runs/${id}/status`,
            { status: newStatus },
            activeBusinessId
              ? { params: { business: activeBusinessId } }
              : undefined,
          );
          fetchData();
        } catch (err) {
          notifyError(err.response?.data?.message || "Status update failed");
        }
      },
    });
  };

  const formatCurrency = (amt) => `RM ${formatAmount(amt || 0)}`;

  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailingLineId, setEmailingLineId] = useState(null);
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkEmailing, setIsBulkEmailing] = useState(false);

  const handleBulkPrint = async () => {
    setIsBulkPrinting(true);
    try {
      const response = await axios.get(
        `${Base_URL}/payroll/reports/runs/${id}/bulk-payslips-pdf`,
        {
          responseType: "blob",
          params: activeBusinessId ? { business: activeBusinessId } : {},
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `All_Payslips_${run ? MONTH_NAMES[run.month] : ""}_${run?.year || ""}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notifySuccess("Bulk payslips PDF downloaded");
    } catch {
      notifyError("Failed to generate bulk payslips PDF");
    } finally {
      setIsBulkPrinting(false);
    }
  };

  const handleEmailAll = async () => {
    openConfirmModal({
      title: "Email Payslips",
      message:
        "Send payslip emails to all employees? Each will receive a PDF attachment.",
      confirmText: "Send",
      onConfirm: async () => {
        setIsEmailing(true);
        try {
          const { data } = await axios.post(
            `${Base_URL}/payroll/reports/runs/${id}/email-payslips`,
            null,
            activeBusinessId
              ? { params: { business: activeBusinessId } }
              : undefined,
          );
          notifySuccess(data.message || "Payslip emails sent");
        } catch (err) {
          notifyError(
            err.response?.data?.message || "Failed to email payslips",
          );
        } finally {
          setIsEmailing(false);
        }
      },
    });
  };

  const handleEmailPayslipLine = (line) => {
    const empName =
      line.employeeSnapshot?.fullName ||
      line.employee?.fullName ||
      "this employee";
    const email = line.employee?.email?.trim();
    if (!email) {
      notifyError(
        "This employee has no email on file. Update the staff profile first.",
      );
      return;
    }
    openConfirmModal({
      title: "Email Payslip",
      message: `Send payslip PDF to ${empName} at ${email}?`,
      confirmText: "Send",
      onConfirm: async () => {
        setEmailingLineId(line._id);
        try {
          const { data } = await axios.post(
            `${Base_URL}/payroll/reports/runs/${id}/email-payslip/${line._id}`,
            null,
            activeBusinessId
              ? { params: { business: activeBusinessId } }
              : undefined,
          );
          notifySuccess(data.message || "Payslip emailed");
        } catch (err) {
          notifyError(err.response?.data?.message || "Failed to email payslip");
        } finally {
          setEmailingLineId(null);
        }
      },
    });
  };

  const processPayslipDownload = async (payslipId, templateHtml, line, businessDetails) => {
    try {
      setDownloadingId(payslipId);
      const authHeaders = adminInfo?.token ? { Authorization: `Bearer ${adminInfo.token}` } : {};

      const earningsItems = [
        { label: "Basic Salary", amount: line.basicSalary || 0 },
        ...(line.earnings || []).map(e => ({ label: e.name || e.code, amount: e.amount || 0 })),
        ...(line.otEntries || []).map(e => ({ label: `${e.label} (${e.hours}h)`, amount: e.amount || 0 }))
      ].filter(e => e.amount > 0);

      const deductionItems = [
        { label: "EPF (Employee)", amount: line.statutory?.epfEmployee || 0 },
        { label: "SOCSO (Employee)", amount: line.statutory?.socsoEmployee || 0 },
        { label: "EIS (Employee)", amount: line.statutory?.eisEmployee || 0 },
        { label: "PCB (Tax)", amount: line.statutory?.pcb || 0 },
      ];
      if (line.unpaidLeaveDeduction > 0) {
        deductionItems.push({ label: `Unpaid Leave (${line.unpaidLeaveDays}d)`, amount: line.unpaidLeaveDeduction });
      }
      if (line.advanceAmount > 0) {
        deductionItems.push({ label: "Advance", amount: line.advanceAmount });
      }
      (line.deductions || []).forEach(d => {
        deductionItems.push({ label: d.name || d.code, amount: d.amount || 0 });
      });
      const filteredDeductions = deductionItems.filter(d => d.amount > 0);

      const ps = {
        companyName: businessDetails?.name || "Company",
        companyAddress: businessDetails?.address ? String(businessDetails.address) : "",
        companyLogo: businessDetails?.image || "",
        titleMonth: `${MONTH_NAMES[run?.month]} ${run?.year}`,
        employeeName: line.employeeSnapshot?.fullName || line.employee?.fullName || "",
        employeeId: line.employeeSnapshot?.employeeId || line.employee?.employeeId || "",
        payPeriod: `${MONTH_NAMES[run?.month]} ${run?.year}`,
        payDate: run?.payDate ? new Date(run.payDate).toLocaleDateString("en-MY") : "",
        currencySymbol: "RM",
        currencyCode: "MYR",
        earnings: earningsItems,
        deductions: filteredDeductions,
        grossEarnings: line.grossPay || 0,
        totalDeductions: line.totalDeductions || 0,
        netPay: line.netPay || 0,
        amountInWords: "",
        currentUrl: getPublicAppUrl(),
        bankName: line.employee?.bankDetails?.bankName || line.employeeSnapshot?.bankName || "-",
        accountTitle: line.employee?.bankDetails?.accountHolderName || line.employeeSnapshot?.fullName || line.employee?.fullName || "-",
        iban: line.employee?.bankDetails?.iban || line.employee?.bankDetails?.accountNumber || line.employeeSnapshot?.bankAccountNumber || "-"
      };

      const net = parseFloat(ps.netPay);
      if (!Number.isNaN(net) && net > 0) {
        const integerPart = Math.floor(net);
        const decimalPart = Math.round((net - integerPart) * 100);
        let words = numberToWords.toWords(integerPart, { and: true }).replace(/^\w/, (c) => c.toUpperCase());
        if (decimalPart > 0) {
          words += " And " + numberToWords.toWords(decimalPart, { and: true }).replace(/^\w/, (c) => c.toUpperCase()) + " Cents";
        }
        ps.amountInWords = `${ps.currencyCode} ${words} Only`;
      }

      const monthLabel = ps.payPeriod.replace(/\s+/g, "_");
      const empName = ps.employeeName.replace(/\s+/g, "_");
      const fileName = `Payslip_${empName}_${monthLabel}.pdf`;

      const renderedHtml = ejs.render(templateHtml, { payslip: ps }, { strict: false });

      const response = await axios.post(`${Base_URL}/html-to-pdf`, {
        html: renderedHtml,
        filename: fileName,
        waitUntil: "domcontentloaded",
        timeout: 10000,
        margin: { top: "0", bottom: "0", left: "0", right: "0" }
      }, {
        responseType: "blob",
        headers: authHeaders
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifySuccess("Payslip PDF downloaded successfully");
    } catch (error) {
      console.error("PDF generation failed:", error);
      notifyError("Failed to generate PDF from template");
    } finally {
      setDownloadingId("");
      setTemplateSelectionModal({ isOpen: false, templates: [], payslipId: null, payslipData: null, businessDetails: null });
    }
  };

  const handleDownloadPayslip = async (lineId, empName) => {
    setDownloadingId(lineId);
    try {
      const authHeaders = adminInfo?.token ? { Authorization: `Bearer ${adminInfo.token}` } : {};
      const line = lines.find((l) => l._id === lineId);
      if (!line) throw new Error("Payroll line not found");

      const businessId = activeBusinessId;
      const tOut = await axios.get(`${Base_URL}/business-templates/${businessId}`, { headers: authHeaders });
      const bOut = await axios.get(`${Base_URL}/business/${businessId}`, { headers: authHeaders });
      const businessDetails = bOut.data?.data || bOut.data;

      const assignments = tOut.data?.data || [];
      const activePayslipTemplates = assignments.filter(a => a.type === "payslip" && a.isActive && a.templateId);

      if (activePayslipTemplates.length === 0) {
        const dtOut = await axios.get(`${Base_URL}/document-templates`, { headers: authHeaders });
        const allDocs = dtOut.data?.data?.data || dtOut.data?.data || dtOut.data || [];
        const defaultTemplate = allDocs.find(t => t.name === "Standard Payslip" || t.type === "payslip");
        
        if (defaultTemplate) {
          const templateHtml = defaultTemplate.htmlContent || defaultTemplate.content;
          await processPayslipDownload(lineId, templateHtml, line, businessDetails);
          return;
        }

        notifyError("Please assign and enable a Payslip template for this business.");
        setDownloadingId("");
        return;
      }

      if (activePayslipTemplates.length === 1) {
        const templateHtml = activePayslipTemplates[0].templateId.htmlContent || activePayslipTemplates[0].templateId.content;
        await processPayslipDownload(lineId, templateHtml, line, businessDetails);
      } else {
        setTemplateSelectionModal({
          isOpen: true,
          templates: activePayslipTemplates,
          payslipId: lineId,
          payslipData: line,
          businessDetails
        });
        setDownloadingId("");
      }
    } catch (error) {
      console.error("Download Payslip Error:", error);
      notifyError(error.response?.data?.message || "Failed to download payslip");
      setDownloadingId("");
    }
  };

  const handleDeleteLine = async (line) => {
    openConfirmModal({
      title: "Delete Payroll Line",
      message: `Delete payroll line for ${line.employeeSnapshot?.fullName || line.employee?.fullName || "this employee"}?`,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await axios.delete(
            `${Base_URL}/payroll/runs/${id}/lines/${line._id}`,
            activeBusinessId
              ? { params: { business: activeBusinessId } }
              : undefined,
          );
          notifySuccess("Payroll line deleted");
          fetchData();
        } catch (err) {
          notifyError(
            err.response?.data?.message || "Failed to delete payroll line",
          );
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedLines.size === 0) return;
    const count = selectedLines.size;
    openConfirmModal({
      title: "Delete Selected Lines",
      message: `Delete ${count} selected payroll line${count > 1 ? "s" : ""}? This cannot be undone.`,
      confirmText: "Delete",
      onConfirm: async () => {
        setIsBulkDeleting(true);
        let failed = 0;
        for (const lineId of selectedLines) {
          try {
            await axios.delete(
              `${Base_URL}/payroll/runs/${id}/lines/${lineId}`,
              activeBusinessId
                ? { params: { business: activeBusinessId } }
                : undefined,
            );
          } catch {
            failed++;
          }
        }
        setIsBulkDeleting(false);
        setSelectedLines(new Set());
        if (failed > 0) notifyError(`${failed} line(s) could not be deleted.`);
        else notifySuccess(`${count} payroll line${count > 1 ? "s" : ""} deleted.`);
        fetchData();
      },
    });
  };

  const handleBulkEmail = () => {
    if (selectedLines.size === 0) return;
    const eligibleLines = lines.filter(
      (l) => selectedLines.has(l._id) && l.employee?.email?.trim(),
    );
    if (eligibleLines.length === 0) {
      notifyError("None of the selected employees have an email on file.");
      return;
    }
    const count = eligibleLines.length;
    openConfirmModal({
      title: "Email Selected Payslips",
      message: `Send payslip emails to ${count} employee${count > 1 ? "s" : ""}?`,
      confirmText: "Send",
      onConfirm: async () => {
        setIsBulkEmailing(true);
        let failed = 0;
        for (const line of eligibleLines) {
          try {
            await axios.post(
              `${Base_URL}/payroll/reports/runs/${id}/email-payslip/${line._id}`,
              null,
              activeBusinessId
                ? { params: { business: activeBusinessId } }
                : undefined,
            );
          } catch {
            failed++;
          }
        }
        setIsBulkEmailing(false);
        if (failed > 0) notifyError(`${failed} email(s) failed to send.`);
        else notifySuccess(`${count} payslip${count > 1 ? "s" : ""} emailed successfully.`);
      },
    });
  };

  const fetchHrSyncPreview = async (opts = hrSyncOptions) => {
    setHrSyncLoading(true);
    try {
      const { data } = await axios.get(
        `${Base_URL}/payroll/runs/${id}/hr-sync-preview`,
        {
          params: {
            ...(activeBusinessId ? { business: activeBusinessId } : {}),
            includeUnpaidLeaves: opts.includeUnpaidLeaves,
            includeOT: opts.includeOT,
            includeClaims: opts.includeClaims,
          },
        },
      );
      setHrSyncPreview(data);
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to preview HR sync");
      setHrSyncPreview(null);
    } finally {
      setHrSyncLoading(false);
    }
  };

  const handleOpenHrSync = async () => {
    setShowHrSyncModal(true);
    await fetchHrSyncPreview();
  };

  const handleApplyHrSync = async () => {
    setHrSyncApplying(true);
    try {
      const { data } = await axios.post(
        `${Base_URL}/payroll/runs/${id}/hr-sync-apply`,
        hrSyncOptions,
        { params: activeBusinessId ? { business: activeBusinessId } : {} },
      );
      notifySuccess(data.message || "HR sync applied");
      setShowHrSyncModal(false);
      await fetchData();
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to apply HR sync");
    } finally {
      setHrSyncApplying(false);
    }
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading payroll run...
      </div>
    );
  if (!run)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Payroll run not found
      </div>
    );

  return (
    <Page
      header={{
        title: `${MONTH_NAMES[run.month]} ${run.year} Payroll`,
        showBackButton: true,
        onBackClick: () => history.push("/payroll"),
      }}
      customClassName="print:bg-white"
    >
      <div className="mt-8">
        {/* Header Subline */}
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-gray-500">
              {new Date(run.periodStart).toLocaleDateString()} -{" "}
              {new Date(run.periodEnd).toLocaleDateString()}
            </p>
            {run.payGroup && (
              <p className="text-xs text-gray-400 mt-0.5">
                Pay Group: {run.payGroup?.name || run.payGroup}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium capitalize ${STATUS_STYLES[run.status]}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${STATUS_DOT[run.status]}`}
            />
            {run.status}
          </span>
        </div>

        {/* Workflow Progress */}
        <div className="mb-6 bg-white rounded-lg border shadow-sm p-4">
          <div className="flex items-center justify-between">
            {[
              "draft",
              "calculated",
              "reviewed",
              "approved",
              "posted",
              "paid",
            ].map((step, idx, arr) => {
              const currentIdx = arr.indexOf(run.status);
              const isDone = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        isDone
                          ? "bg-green-500 border-green-500 text-white"
                          : isCurrent
                            ? "border-[var(--p-blue)] text-[var(--p-blue)] bg-blue-50"
                            : "border-gray-300 text-gray-400 bg-white"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs mt-1 capitalize hidden sm:block ${isCurrent ? "font-semibold text-[var(--p-blue)]" : isDone ? "text-green-600" : "text-gray-400"}`}
                    >
                      {step}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${idx < currentIdx ? "bg-green-500" : "bg-gray-200"}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {["draft", "calculated"].includes(run.status) && (
            <button
              onClick={handleCalculate}
              className="text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              <AiOutlineCalculator />{" "}
              {run.status === "calculated" ? "Recalculate" : "Calculate"}
            </button>
          )}
          {["draft", "calculated"].includes(run.status) && (
            <button
              onClick={handleOpenHrSync}
              disabled={hrSyncLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {hrSyncLoading ? "Syncing..." : "Sync HR Inputs"}
            </button>
          )}
          {run.status === "calculated" && (
            <button
              onClick={() => handleStatusChange("reviewed")}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <AiOutlineEye /> Mark Reviewed
            </button>
          )}
          {run.status === "reviewed" && (
            <button
              onClick={() => handleStatusChange("approved")}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <AiOutlineCheck /> Approve
            </button>
          )}
          {run.status === "approved" && (
            <button
              onClick={() => handleStatusChange("posted")}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <FiDollarSign /> Post to Finance
            </button>
          )}
          {run.status === "posted" && (
            <button
              onClick={() => handleStatusChange("paid")}
              className="text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              <AiOutlineCheck /> Mark as Paid
            </button>
          )}
          {run.status !== "draft" && lines.length > 0 && (
            <>
              <button
                onClick={handleBulkPrint}
                disabled={isBulkPrinting}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />{" "}
                {isBulkPrinting ? "Generating..." : "Bulk Print PDF"}
              </button>
              <button
                onClick={handleEmailAll}
                disabled={isEmailing}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />{" "}
                {isEmailing ? "Sending..." : "Email All Payslips"}
              </button>
            </>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-200/80 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-gray-400 to-gray-300" />
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Employees
            </p>
            <p className="text-xl font-bold mt-1">{run.totalEmployees}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200/80 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-300" />
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Gross Pay
            </p>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {formatCurrency(run.totalGrossPay)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200/80 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-green-300" />
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Net Pay
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {formatCurrency(run.totalNetPay)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200/80 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-amber-300" />
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Employer Cost
            </p>
            <p className="text-xl font-bold text-orange-700 mt-1">
              {formatCurrency(run.totalEmployerCost)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200/80 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-500 to-red-300" />
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Total Deductions
            </p>
            <p className="text-xl font-bold text-rose-700 mt-1">
              {formatCurrency(run.totals?.totalDeductions)}
            </p>
          </div>
        </div>

        {/* Statutory Totals */}
        <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80">
            <h2 className="text-sm font-semibold text-gray-800 tracking-tight">
              Statutory Contributions Summary
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            <div>
              <p className="text-xs text-gray-500">EPF (Employee)</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.epfEmployee)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">EPF (Employer)</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.epfEmployer)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SOCSO (Employee)</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.socsoEmployee)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SOCSO (Employer)</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.socsoEmployer)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">EIS (Employee)</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.eisEmployee)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">EIS (Employer)</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.eisEmployer)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">PCB (Tax)</p>
              <p className="font-semibold">{formatCurrency(run.totals?.pcb)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">HRDF</p>
              <p className="font-semibold">
                {formatCurrency(run.totals?.hrdf)}
              </p>
            </div>
          </div>
        </div>

        {/* Employee Payroll Lines */}
        <div className="rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-800 tracking-tight">
              Employee Payroll Details
            </h2>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {lines.length} employees
            </span>
          </div>

          {/* Bulk Action Bar */}
          {selectedLines.size > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-medium text-blue-700">
                {selectedLines.size} selected
              </span>
              <button
                onClick={handleBulkEmail}
                disabled={isBulkEmailing || run.status === "draft"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {isBulkEmailing ? "Sending..." : "Email Selected"}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting || ["approved", "posted", "paid"].includes(run?.status)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isBulkDeleting ? "Deleting..." : "Delete Selected"}
              </button>
              <button
                onClick={() => setSelectedLines(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700 underline ml-auto"
              >
                Clear selection
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      checked={lines.length > 0 && selectedLines.size === lines.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedLines.size > 0 && selectedLines.size < lines.length;
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLines(new Set(lines.map((l) => l._id)));
                        } else {
                          setSelectedLines(new Set());
                        }
                      }}
                      title="Select all"
                    />
                  </th>
                  {[
                    "Employee",
                    "Basic",
                    "Allowances",
                    "OT",
                    "Gross Pay",
                    "EPF (EE)",
                    "SOCSO (EE)",
                    "EIS (EE)",
                    "PCB",
                    "Deductions",
                    "Net Pay",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No payroll lines
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr
                      key={line._id}
                      className={`hover:bg-blue-50/40 transition-colors duration-150 ${
                        selectedLines.has(line._id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          checked={selectedLines.has(line._id)}
                          onChange={(e) => {
                            const next = new Set(selectedLines);
                            if (e.target.checked) next.add(line._id);
                            else next.delete(line._id);
                            setSelectedLines(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="font-medium">
                          {line.employeeSnapshot?.fullName ||
                            line.employee?.fullName ||
                            "-"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {line.employeeSnapshot?.employeeId || ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {formatCurrency(line.basicSalary)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {formatCurrency(line.totalEarnings - line.basicSalary)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {formatCurrency(line.totalOT)}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium">
                        {formatCurrency(line.grossPay)}
                      </td>
                      <td className="px-3 py-3 text-sm text-red-600">
                        {formatCurrency(line.statutory?.epfEmployee)}
                      </td>
                      <td className="px-3 py-3 text-sm text-red-600">
                        {formatCurrency(line.statutory?.socsoEmployee)}
                      </td>
                      <td className="px-3 py-3 text-sm text-red-600">
                        {formatCurrency(line.statutory?.eisEmployee)}
                      </td>
                      <td className="px-3 py-3 text-sm text-red-600">
                        {formatCurrency(line.statutory?.pcb)}
                      </td>
                      <td className="px-3 py-3 text-sm text-red-600">
                        {formatCurrency(line.totalDeductions)}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-green-700">
                        {formatCurrency(line.netPay)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSelectedLine(line)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="View Payslip"
                          >
                            <AiOutlinePrinter size={16} />
                          </button>
                          <button
                            onClick={() => setEditLine(line)}
                            disabled={["approved", "posted", "paid"].includes(
                              run?.status,
                            )}
                            className="text-gray-600 hover:text-gray-900 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              ["approved", "posted", "paid"].includes(
                                run?.status,
                              )
                                ? "Cannot edit lines in an approved/posted/paid run"
                                : run?.status === "draft"
                                  ? "Adjust OT / Leaves / Deductions"
                                  : "Adjust OT / Leaves / Deductions (run will revert to draft)"
                            }
                          >
                            <AiOutlineEdit size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleDownloadPayslip(
                                line._id,
                                line.employeeSnapshot?.fullName,
                              )
                            }
                            disabled={downloadingId === line._id}
                            className="text-purple-600 hover:text-purple-900 p-1 disabled:opacity-50"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {run.status !== "draft" && (
                            <button
                              type="button"
                              onClick={() => handleEmailPayslipLine(line)}
                              disabled={
                                emailingLineId === line._id ||
                                !line.employee?.email?.trim()
                              }
                              className="text-orange-600 hover:text-orange-900 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={
                                line.employee?.email?.trim()
                                  ? "Email payslip to employee"
                                  : "No email on staff profile"
                              }
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteLine(line)}
                            disabled={["approved", "posted", "paid"].includes(
                              run?.status,
                            )}
                            className="text-red-600 hover:text-red-800 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              ["approved", "posted", "paid"].includes(
                                run?.status,
                              )
                                ? "Cannot delete lines from an approved/posted/paid run"
                                : "Delete Employee from Run"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedLine && (
          <PayslipModal
            line={selectedLine}
            run={run}
            onClose={() => setSelectedLine(null)}
            onDownload={handleDownloadPayslip}
            downloadingId={downloadingId}
          />
        )}
        {editLine && (
          <LineAdjustModal
            run={run}
            line={editLine}
            companySettings={companySettings}
            deductionElements={deductionElements}
            earningElements={earningElements}
            onClose={() => setEditLine(null)}
            onSave={async (payload) => {
              try {
                await axios.put(
                  `${Base_URL}/payroll/runs/${id}/lines/${editLine._id}`,
                  payload,
                  activeBusinessId
                    ? { params: { business: activeBusinessId } }
                    : undefined,
                );
                notifySuccess("Payroll line updated");
                setEditLine(null);
                fetchData();
              } catch (err) {
                notifyError(
                  err.response?.data?.message ||
                    "Failed to update payroll line",
                );
              }
            }}
          />
        )}
        {showHrSyncModal && (
          <HrSyncPreviewModal
            loading={hrSyncLoading}
            applying={hrSyncApplying}
            preview={hrSyncPreview}
            options={hrSyncOptions}
            onOptionsChange={async (next) => {
              setHrSyncOptions(next);
              await fetchHrSyncPreview(next);
            }}
            onClose={() => setShowHrSyncModal(false)}
            onApply={handleApplyHrSync}
            formatCurrency={formatCurrency}
          />
        )}
        {templateSelectionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-400/30 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Select Payslip Template</h2>
                <button
                  onClick={() => setTemplateSelectionModal({ isOpen: false, templates: [], payslipId: null, payslipData: null, businessDetails: null })}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {templateSelectionModal.templates.map((assignment) => (
                  <button
                    key={assignment._id}
                    onClick={() => processPayslipDownload(
                      templateSelectionModal.payslipId,
                      assignment.templateId.htmlContent || assignment.templateId.content,
                      templateSelectionModal.payslipData,
                      templateSelectionModal.businessDetails
                    )}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-medium text-slate-700">{assignment.templateId?.name || "Payslip Template"}</span>
                    {assignment.isDefault && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold uppercase">Default</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmModal}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText="Cancel"
      />
    </Page>
  );
};

const HrSyncPreviewModal = ({
  loading,
  applying,
  preview,
  options,
  onOptionsChange,
  onClose,
  onApply,
  formatCurrency,
}) => {
  const rows = preview?.rows || [];
  const changedRows = rows.filter((r) => r.flags?.hasChanges);

  const toggle = (key) => {
    const next = { ...options, [key]: !options[key] };
    onOptionsChange(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-bold tracking-tight">
            HR Input Sync Preview
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.includeUnpaidLeaves}
              onChange={() => toggle("includeUnpaidLeaves")}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Auto Unpaid Leave (Approved Leave records)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.includeOT}
              onChange={() => toggle("includeOT")}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Auto OT (Attendance + Shift + Public Holiday)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.includeClaims}
              onChange={() => toggle("includeClaims")}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Import Approved Claims as Earnings
          </label>
        </div>

        <div className="p-4 h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-gray-500 py-8">
              Preparing HR sync preview...
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No payroll lines found.
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {changedRows.length} of {rows.length} employees have suggested
                HR-driven changes.
              </p>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Employee</th>
                      <th className="px-3 py-2 text-left">
                        Unpaid Leave (Current → Suggested)
                      </th>
                      <th className="px-3 py-2 text-left">OT Suggested</th>
                      <th className="px-3 py-2 text-left">
                        Claims (Current → Suggested)
                      </th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.lineId} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{r.employeeName}</td>
                        <td className="px-3 py-2">
                          {r.current.unpaidLeaveDays} →{" "}
                          {r.suggested.unpaidLeaveDays}
                        </td>
                        <td className="px-3 py-2">
                          {(r.suggested.otEntries || []).length === 0
                            ? "-"
                            : r.suggested.otEntries
                                .map((ot) => `${ot.label}: ${ot.hours}h`)
                                .join(", ")}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(r.current.claimsAmount)} →{" "}
                          {formatCurrency(r.suggested.claimsAmount)}
                        </td>
                        <td className="px-3 py-2">
                          {r.flags?.hasChanges ? (
                            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                              Has Changes
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                              No Change
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-all"
          >
            Close
          </button>
          <button
            onClick={onApply}
            disabled={loading || applying || changedRows.length === 0}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--p-blue)" }}
          >
            {applying ? "Applying..." : "Apply to Payroll Lines"}
          </button>
        </div>
      </div>
    </div>
  );
};

const LineAdjustModal = ({
  run,
  line,
  companySettings,
  deductionElements,
  earningElements,
  onClose,
  onSave,
}) => {
  const snap = line.employeeSnapshot || {};
  const [basicSalary, setBasicSalary] = useState(line.basicSalary || 0);
  const [unpaidLeaveDays, setUnpaidLeaveDays] = useState(
    line.unpaidLeaveDays || 0,
  );
  const [advanceAmount, setAdvanceAmount] = useState(line.advanceAmount || 0);

  const [epfEmployee, setEpfEmployee] = useState(line.statutory?.epfEmployee || 0);
  const [socsoEmployee, setSocsoEmployee] = useState(line.statutory?.socsoEmployee || 0);
  const [eisEmployee, setEisEmployee] = useState(line.statutory?.eisEmployee || 0);
  const [pcb, setPcb] = useState(line.statutory?.pcb || 0);

  // Keep OT hours by slot (OT1..OT6). Server calculation will use company OT rates.
  const [otHours, setOtHours] = useState(() => {
    const init = {};
    for (let s = 1; s <= 6; s++) init[s] = 0;
    (line.otEntries || []).forEach((ot) => {
      if (ot?.slot >= 1 && ot?.slot <= 6) init[ot.slot] = ot.hours || 0;
    });
    return init;
  });

  const manualEarningSeed = (line.earnings || []).filter((e) => e?.isManualOverride);
  const [earnings, setEarnings] = useState(() =>
    manualEarningSeed.map((e) => ({
      payElementType: e.payElementType?._id || e.payElementType || "",
      code: e.code || "",
      name: e.name || "",
      amount: e.amount || 0,
    })),
  );

  const manualSeed = (line.deductions || []).filter((d) => d?.isManualOverride);
  const [deductions, setDeductions] = useState(() =>
    manualSeed.map((d) => ({
      payElementType: d.payElementType?._id || d.payElementType || "",
      code: d.code || "",
      name: d.name || "",
      amount: d.amount || 0,
    })),
  );
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amt) =>
    `RM ${(amt || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const addEarningRow = () => {
    setEarnings((prev) => [
      ...prev,
      { payElementType: "", code: "", name: "", amount: 0 },
    ]);
  };

  const updateEarningRow = (index, patch) => {
    setEarnings((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  };

  const removeEarningRow = (index) => {
    setEarnings((prev) => prev.filter((_, i) => i !== index));
  };

  const addDeductionRow = () => {
    setDeductions((prev) => [
      ...prev,
      { payElementType: "", code: "", name: "", amount: 0 },
    ]);
  };

  const updateDeductionRow = (index, patch) => {
    setDeductions((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  };

  const removeDeductionRow = (index) => {
    setDeductions((prev) => prev.filter((_, i) => i !== index));
  };

  // Live calculations for summary preview
  const monthSettings = companySettings?.monthlySettings?.find(
    (m) => m.month === run?.month,
  );
  const calendarDaysInMonth = new Date(run?.year, run?.month, 0).getDate();
  const workingDays =
    monthSettings?.totalWorkingDays ||
    companySettings?.defaultWorkingDaysPerMonth ||
    26;
  const workingHours =
    monthSettings?.totalWorkingHours ||
    companySettings?.defaultWorkingHoursPerDay ||
    8;

  const unpaidLeaveMethod = companySettings?.unpaidLeaveCalculation || "calendar_days";
  const totalDaysForUnpaidLeave =
    monthSettings?.totalDaysForUnpaidLeave ||
    (unpaidLeaveMethod === "working_days" ? workingDays : calendarDaysInMonth);
  const dailyRate = totalDaysForUnpaidLeave > 0 ? Number(basicSalary) / totalDaysForUnpaidLeave : 0;
  const unpaidLeaveDeductionCalculated = Number((Number(unpaidLeaveDays || 0) * dailyRate).toFixed(2));

  const otEntriesCalculated = Object.entries(otHours)
    .map(([slot, hours]) => {
      const otConfig = (companySettings?.otRates || []).find(c => c.slot === Number(slot)) || {};
      const multiplier = Number(otConfig.multiplier || 1.5);
      const hRate = (Number(basicSalary) || 0) / (workingDays * workingHours);
      const amt = Number((Number(hours) * hRate * multiplier).toFixed(2));
      return {
        slot: Number(slot),
        label: `OT${slot}`,
        hours: Number(hours) || 0,
        rate: Number(hRate.toFixed(4)),
        multiplier,
        amount: amt,
      };
    })
    .filter((e) => e.hours > 0);

  const totalOTCalculated = otEntriesCalculated.reduce((sum, ot) => sum + ot.amount, 0);

  const totalAllowancesCalculated = earnings
    .filter((e) => e.payElementType && (Number(e.amount) || 0) !== 0)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const grossPayCalculated = Number(basicSalary || 0) + totalAllowancesCalculated + totalOTCalculated;

  const manualDeductionsTotalCalculated = deductions
    .filter((d) => d.payElementType && (Number(d.amount) || 0) !== 0)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const totalDeductionsCalculated = Number((
    Number(epfEmployee || 0) +
    Number(socsoEmployee || 0) +
    Number(eisEmployee || 0) +
    Number(pcb || 0) +
    unpaidLeaveDeductionCalculated +
    Number(advanceAmount || 0) +
    manualDeductionsTotalCalculated
  ).toFixed(2));

  const netPayCalculated = Number((grossPayCalculated - totalDeductionsCalculated).toFixed(2));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const statutory = {
        ...(line.statutory || {}),
        epfEmployee: Number(epfEmployee) || 0,
        socsoEmployee: Number(socsoEmployee) || 0,
        eisEmployee: Number(eisEmployee) || 0,
        pcb: Number(pcb) || 0,
      };

      const status = "adjusted";

      await onSave({
        basicSalary: Number(basicSalary) || 0,
        unpaidLeaveDays: Number(unpaidLeaveDays) || 0,
        unpaidLeaveDeduction: unpaidLeaveDeductionCalculated,
        advanceAmount: Number(advanceAmount) || 0,
        otEntries: otEntriesCalculated,
        totalOT: totalOTCalculated,
        earnings: earnings
          .filter((e) => e.payElementType && (Number(e.amount) || 0) !== 0)
          .map((e) => ({
            payElementType: e.payElementType,
            code: e.code,
            name: e.name,
            category: "earning",
            amount: Number(e.amount) || 0,
            isManualOverride: true,
          })),
        totalEarnings: Number(basicSalary || 0) + totalAllowancesCalculated,
        deductions: deductions
          .filter((d) => d.payElementType && (Number(d.amount) || 0) !== 0)
          .map((d) => ({
            payElementType: d.payElementType,
            code: d.code,
            name: d.name,
            category: "deduction",
            amount: Number(d.amount) || 0,
            isManualOverride: true,
          })),
        totalDeductions: totalDeductionsCalculated,
        statutory,
        grossPay: grossPayCalculated,
        netPay: netPayCalculated,
        status,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white/95 backdrop-blur-sm z-10 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Adjust Payroll Line
            </h2>
            <p className="text-sm text-gray-500">
              {snap.fullName || line.employee?.fullName || "-"} •{" "}
              {MONTH_NAMES[run?.month]} {run?.year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {run?.status !== "draft" && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
              <strong>Note:</strong> This run is currently{" "}
              <span className="font-semibold capitalize">{run?.status}</span>.
              Saving adjustments will reset the run back to{" "}
              <strong>Draft</strong> status and a recalculation will be
              required.
            </div>
          )}

          {/* Section: Salary & Allowances */}
          <div>
            <h3 className="text-base font-semibold mb-3 pb-1 border-b border-gray-100 text-gray-800">
              Salary & Allowances (Earnings)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Basic Salary (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={basicSalary}
                  onChange={(e) =>
                    setBasicSalary(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setBasicSalary((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
            </div>

            {/* Manual Earnings List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Allowances / Other Earnings
                </label>
                <button
                  onClick={addEarningRow}
                  type="button"
                  className="text-lime-600 hover:text-lime-700 flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                  disabled={!earningElements.length}
                >
                  + Add Earning
                </button>
              </div>

              {earningElements.length === 0 ? (
                <div className="text-xs text-gray-400">
                  No earning pay elements configured for this business.
                </div>
              ) : (
                <div className="space-y-3">
                  {earnings.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      No additional allowances yet.
                    </div>
                  ) : (
                    earnings.map((e, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap sm:flex-nowrap gap-3 items-center"
                      >
                        <select
                          value={e.payElementType}
                          onChange={(evt) => {
                            const selected = earningElements.find(
                              (x) => x._id === evt.target.value,
                            );
                            updateEarningRow(i, {
                              payElementType: evt.target.value,
                              code: selected?.code || "",
                              name: selected?.name || "",
                            });
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        >
                          <option value="">Select earning type</option>
                          {earningElements.map((el) => (
                            <option key={el._id} value={el._id}>
                              {el.name} ({el.code})
                            </option>
                          ))}
                        </select>
                        <div className="w-full sm:w-36">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={e.amount}
                            onChange={(evt) =>
                              updateEarningRow(i, {
                                amount:
                                  evt.target.value === ""
                                    ? ""
                                    : Number(evt.target.value),
                              })
                            }
                            onBlur={() =>
                              updateEarningRow(i, {
                                amount: Number(e.amount) || 0,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEarningRow(i)}
                          className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section: Attendance & Advances */}
          <div>
            <h3 className="text-base font-semibold mb-3 pb-1 border-b border-gray-100 text-gray-800">
              Attendance & Advances
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Unpaid Leave Days
                </label>
                <input
                  type="number"
                  min="0"
                  value={unpaidLeaveDays}
                  onChange={(e) =>
                    setUnpaidLeaveDays(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setUnpaidLeaveDays((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Advance Amount (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceAmount}
                  onChange={(e) =>
                    setAdvanceAmount(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setAdvanceAmount((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section: Employee Statutory Contributions */}
          <div>
            <h3 className="text-base font-semibold mb-3 pb-1 border-b border-gray-100 text-gray-800">
              Employee Statutory Contributions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">
                  EPF (EE) (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={epfEmployee}
                  onChange={(e) =>
                    setEpfEmployee(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setEpfEmployee((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">
                  SOCSO (EE) (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={socsoEmployee}
                  onChange={(e) =>
                    setSocsoEmployee(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setSocsoEmployee((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">
                  EIS (EE) (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={eisEmployee}
                  onChange={(e) =>
                    setEisEmployee(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setEisEmployee((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-medium">
                  PCB (Tax) (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pcb}
                  onChange={(e) =>
                    setPcb(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  onBlur={() => setPcb((v) => Number(v) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section: Overtime */}
          <div>
            <h3 className="text-base font-semibold mb-3 pb-1 border-b border-gray-100 text-gray-800">
              Overtime (OT1..OT6 hours)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, idx) => {
                const slot = idx + 1;
                return (
                  <div
                    key={slot}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                  >
                    <label className="block text-xs text-gray-600 mb-1 font-medium">
                      OT{slot}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={otHours[slot] ?? 0}
                      onChange={(e) =>
                        setOtHours((prev) => ({
                          ...prev,
                          [slot]:
                            e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      onBlur={() =>
                        setOtHours((prev) => ({
                          ...prev,
                          [slot]: Number(prev[slot]) || 0,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Deductions */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-base font-semibold">Manual Deductions</h3>
              <button
                onClick={addDeductionRow}
                type="button"
                className="text-lime-600 hover:text-lime-700 flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                disabled={!deductionElements.length}
              >
                + Add Deduction
              </button>
            </div>

            {deductionElements.length === 0 ? (
              <div className="text-sm text-gray-500">
                No manual deduction pay elements configured for this business
                (late penalties / other).
              </div>
            ) : (
              <div className="space-y-3">
                {deductions.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No manual deductions yet.
                  </div>
                ) : (
                  deductions.map((d, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap sm:flex-nowrap gap-3 items-center"
                    >
                      <select
                        value={d.payElementType}
                        onChange={(e) => {
                          const selected = deductionElements.find(
                            (x) => x._id === e.target.value,
                          );
                          updateDeductionRow(i, {
                            payElementType: e.target.value,
                            code: selected?.code || "",
                            name: selected?.name || "",
                          });
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                      >
                        <option value="">Select deduction</option>
                        {deductionElements.map((el) => (
                          <option key={el._id} value={el._id}>
                            {el.name} ({el.code})
                          </option>
                        ))}
                      </select>
                      <div className="w-full sm:w-36">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={d.amount}
                          onChange={(e) =>
                            updateDeductionRow(i, {
                              amount:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          onBlur={() =>
                            updateDeductionRow(i, {
                              amount: Number(d.amount) || 0,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDeductionRow(i)}
                        className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Section: Live Adjustment Summary Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-6 shadow-sm">
            <h3 className="text-sm font-semibold mb-3 text-slate-800 tracking-tight">
              Adjustment Summary Preview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Basic Salary</span>
                <span className="font-semibold text-gray-800">{formatCurrency(Number(basicSalary) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Allowances</span>
                <span className="font-semibold text-gray-800">{formatCurrency(totalAllowancesCalculated)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Overtime (OT)</span>
                <span className="font-semibold text-gray-800">{formatCurrency(totalOTCalculated)}</span>
              </div>
              <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                <span className="text-blue-600 block text-xs font-semibold">Gross Pay</span>
                <span className="font-bold text-blue-900">{formatCurrency(grossPayCalculated)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">EPF (Employee)</span>
                <span className="font-semibold text-red-600">-{formatCurrency(Number(epfEmployee) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">SOCSO (Employee)</span>
                <span className="font-semibold text-red-600">-{formatCurrency(Number(socsoEmployee) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">EIS (Employee)</span>
                <span className="font-semibold text-red-600">-{formatCurrency(Number(eisEmployee) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">PCB (Tax)</span>
                <span className="font-semibold text-red-600">-{formatCurrency(Number(pcb) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Unpaid Leave Deduct.</span>
                <span className="font-semibold text-red-600">-{formatCurrency(unpaidLeaveDeductionCalculated)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Advance Amount</span>
                <span className="font-semibold text-red-600">-{formatCurrency(Number(advanceAmount) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Other Deductions</span>
                <span className="font-semibold text-red-600">-{formatCurrency(manualDeductionsTotalCalculated)}</span>
              </div>
              <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                <span className="text-emerald-600 block text-xs font-semibold">Net Pay</span>
                <span className="font-bold text-emerald-900">{formatCurrency(netPayCalculated)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-white rounded-lg disabled:opacity-50 font-medium text-sm"
              style={{ backgroundColor: "var(--p-blue)" }}
            >
              {isSaving ? "Saving..." : "Save Adjustments"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PayslipModal = ({ line, run, onClose, onDownload, downloadingId }) => {
  const formatCurrency = (amt) =>
    `RM ${(amt || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const snap = line.employeeSnapshot || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto border border-gray-200/50">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-bold tracking-tight">
            Payslip - {MONTH_NAMES[run.month]} {run.year}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>
        <div className="p-6 space-y-6" id="payslip-content">
          {/* Employee Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Employee Name</p>
              <p className="font-medium">{snap.fullName}</p>
            </div>
            <div>
              <p className="text-gray-500">Employee ID</p>
              <p className="font-medium">{snap.employeeId || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">NRIC/Passport</p>
              <p className="font-medium">{snap.nric || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Department</p>
              <p className="font-medium">{snap.department || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Position</p>
              <p className="font-medium">{snap.position || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Bank Account</p>
              <p className="font-medium">
                {snap.bankName
                  ? `${snap.bankName} - ${snap.bankAccountNumber}`
                  : "-"}
              </p>
            </div>
          </div>

          <hr />

          {/* Earnings */}
          <div>
            <h3 className="font-semibold text-green-700 mb-2">Earnings</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Basic Salary</span>
                <span>{formatCurrency(line.basicSalary)}</span>
              </div>
              {line.earnings?.map((e, i) => (
                <div key={i} className="flex justify-between">
                  <span>{e.name || e.code}</span>
                  <span>{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {line.otEntries?.map((ot, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {ot.label} ({ot.hours}h x {ot.multiplier}x)
                  </span>
                  <span>{formatCurrency(ot.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-1 mt-2">
                <span>Gross Pay</span>
                <span>{formatCurrency(line.grossPay)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="font-semibold text-red-700 mb-2">Deductions</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>EPF (Employee)</span>
                <span>-{formatCurrency(line.statutory?.epfEmployee)}</span>
              </div>
              <div className="flex justify-between">
                <span>SOCSO (Employee)</span>
                <span>-{formatCurrency(line.statutory?.socsoEmployee)}</span>
              </div>
              <div className="flex justify-between">
                <span>EIS (Employee)</span>
                <span>-{formatCurrency(line.statutory?.eisEmployee)}</span>
              </div>
              <div className="flex justify-between">
                <span>PCB (Tax)</span>
                <span>-{formatCurrency(line.statutory?.pcb)}</span>
              </div>
              {line.unpaidLeaveDeduction > 0 && (
                <div className="flex justify-between">
                  <span>Unpaid Leave ({line.unpaidLeaveDays} days)</span>
                  <span>-{formatCurrency(line.unpaidLeaveDeduction)}</span>
                </div>
              )}
              {line.advanceAmount > 0 && (
                <div className="flex justify-between">
                  <span>Advance</span>
                  <span>-{formatCurrency(line.advanceAmount)}</span>
                </div>
              )}
              {line.deductions?.map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span>{d.name || d.code}</span>
                  <span>-{formatCurrency(d.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-1 mt-2">
                <span>Total Deductions</span>
                <span>-{formatCurrency(line.totalDeductions)}</span>
              </div>
            </div>
          </div>

          <hr />

          {/* Net Pay */}
          <div className="flex justify-between text-lg font-bold">
            <span>Net Pay</span>
            <span className="text-green-700">
              {formatCurrency(line.netPay)}
            </span>
          </div>

          {/* Employer Contributions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-600 mb-2 text-sm">
              Employer Contributions
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>EPF (Employer)</span>
                <span>{formatCurrency(line.statutory?.epfEmployer)}</span>
              </div>
              <div className="flex justify-between">
                <span>SOCSO (Employer)</span>
                <span>{formatCurrency(line.statutory?.socsoEmployer)}</span>
              </div>
              <div className="flex justify-between">
                <span>EIS (Employer)</span>
                <span>{formatCurrency(line.statutory?.eisEmployer)}</span>
              </div>
              {line.statutory?.hrdf > 0 && (
                <div className="flex justify-between">
                  <span>HRDF</span>
                  <span>{formatCurrency(line.statutory?.hrdf)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1 mt-2">
                <span>Total Employer Cost</span>
                <span>{formatCurrency(line.employerCost)}</span>
              </div>
            </div>
          </div>

          {/* YTD */}
          {line.ytd && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-700 mb-2 text-sm">
                Year-to-Date
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-800">
                <div>Gross Pay: {formatCurrency(line.ytd.grossPay)}</div>
                <div>Net Pay: {formatCurrency(line.ytd.netPay)}</div>
                <div>EPF (EE): {formatCurrency(line.ytd.epfEmployee)}</div>
                <div>EPF (ER): {formatCurrency(line.ytd.epfEmployer)}</div>
                <div>PCB: {formatCurrency(line.ytd.pcb)}</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-all"
          >
            Close
          </button>
          <button
            onClick={() => onDownload(line._id, snap.fullName)}
            disabled={downloadingId === line._id}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {downloadingId === line._id ? "Downloading..." : "Download PDF"}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <AiOutlinePrinter /> Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollRunDetail;
