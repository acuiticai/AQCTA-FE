import React, { useState, useEffect, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  CheckCircle,
  Lock,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Building,
  DollarSign,
  Users,
  Wallet,
  FileText,
  AlertTriangle,
  Eye,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { AdminContext } from "@/context/AdminContext";
import { useDailyReportsPermissions } from "@/hooks/useDailyReportsPermissions";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
import { Page } from "@/page-layouts/index";
import { notifySuccess, notifyError } from "@/utils/toast";
import { formatDate, formatAmount } from "@/components/formatAmount";
import DailyReportsService from "@/services/dailyReportsService";
import axios from "axios";

export default function ViewShiftReport() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  const backTarget = location.state?.returnTo || "/daily-reports/";
  const { isSingleBusiness } = useSingleBusinessMode();
  const { canUpdate, canDelete } = useDailyReportsPermissions();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [collections, setCollections] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [staffAdvances, setStaffAdvances] = useState([]);
  const [lateTransactions, setLateTransactions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [advanceTypes, setAdvanceTypes] = useState([]);
  
  // Document Viewer Modal
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedTransactionDocuments, setSelectedTransactionDocuments] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  const handleOpenDocument = async (fileId) => {
    if (!fileId) return;
    try {
      const res = await axios.get(`${Base_URL}/documents/getFileWithAllData/${fileId}`, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo?.token}`,
        },
      });
      const fileData = res?.data?.data;
      const url = fileData?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        notifyError(t("dailyReports.messages.error.openDocument"));
      }
    } catch (error) {
      console.error("Failed to open document:", error);
      notifyError(error?.response?.data?.message || t("dailyReports.messages.error.failedOpenDocument"));
    }
  };

  const handleViewDocuments = (documents) => {
    if (!documents || documents.length === 0) {
      notifyError(t("dailyReports.messages.error.noDocuments"));
      return;
    }
    setSelectedTransactionDocuments(documents);
    setShowDocumentsModal(true);
  };

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await DailyReportsService.getShiftReportById(id);
      if (response?.success && response.data) {
        setReport(response.data.report);
        setCollections(response.data.collections || []);
        setSupplierPayments(response.data.supplierPayments || []);
        setStaffAdvances(response.data.staffAdvances || []);
        setLateTransactions(response.data.lateTransactions || []);
        
        // Fetch payment methods for balance calculations
        if (response.data.report?.business?._id || response.data.report?.business) {
          const businessId = response.data.report.business._id || response.data.report.business;
          try {
            const pmResponse = await DailyReportsService.getAllPaymentMethods(businessId);
            setPaymentMethods(pmResponse?.data || []);
            try {
              const atResponse = await DailyReportsService.getAllAdvanceTypes(businessId);
              setAdvanceTypes(atResponse?.data || []);
            } catch (atErr) {
              console.error("Error fetching advance types:", atErr);
              setAdvanceTypes([]);
            }
          } catch (error) {
            console.error("Error fetching payment methods:", error);
            setPaymentMethods([]);
            setAdvanceTypes([]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      notifyError(t("dailyReports.messages.error.loadReport"));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const response = await DailyReportsService.approveShiftReport(id);
      if (response?.success) {
        notifySuccess(t("dailyReports.messages.success.reportApprovedLocked"));
        fetchReport();
      } else {
        throw new Error(response?.message || t("dailyReports.messages.error.approveReport"));
      }
    } catch (error) {
      console.error("Error approving report:", error);
      notifyError(error.message || t("dailyReports.messages.error.approveReport"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const response = await DailyReportsService.deleteShiftReport(id);
      if (response?.success) {
        notifySuccess(t("dailyReports.messages.success.reportDeleted"));
        history.push(backTarget);
      } else {
        throw new Error(response?.message || t("dailyReports.messages.error.deleteReport"));
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      notifyError(error.message || t("dailyReports.messages.error.deleteReport"));
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleLock = async () => {
    setActionLoading(true);
    try {
      const response = await DailyReportsService.lockShiftReport(id);
      if (response?.success) {
        notifySuccess(t("dailyReports.messages.success.reportLocked"));
        fetchReport();
      } else {
        throw new Error(response?.message || t("dailyReports.messages.error.lockReport"));
      }
    } catch (error) {
      console.error("Error locking report:", error);
      notifyError(error.message || t("dailyReports.messages.error.lockReport"));
    } finally {
      setActionLoading(false);
    }
  };

  const pdfRef = useRef(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const resolveStaffAdvanceTypeLabel = (adv) => {
    if (!adv) return "-";
    const code =
      (adv.advanceTypeSnapshot && adv.advanceTypeSnapshot.code) || adv.advanceType || "";
    if (code && advanceTypes.length > 0) {
      const codeUp = String(code).toUpperCase();
      const match = advanceTypes.find(
        (at) =>
          at.code === code ||
          String(at._id) === String(code) ||
          (at.code && String(at.code).toUpperCase() === codeUp)
      );
      if (match?.name) return match.name;
    }
    if (adv.advanceTypeSnapshot?.name) return adv.advanceTypeSnapshot.name;
    return code || "-";
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // Format date for filename: DDMMYY format (e.g., 251124 for 25/11/2024)
      const dateParts = report.businessDate.split("-");
      const formattedDate = `${dateParts[2]}${dateParts[1]}${dateParts[0].slice(2)}`;
      
      // Get business name and shift name
      const businessName = report.business?.name || "BUSINESS";
      const shiftName = (
        report.shiftSnapshot?.name ||
        report.shiftId?.name ||
        (report.shiftNo != null ? `Shift ${report.shiftNo}` : "SHIFT")
      )
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
      const shiftStartTime = report.shiftSnapshot?.startTime || "N/A";
      const shiftEndTime = report.shiftSnapshot?.endTime || "N/A";
      const shiftTimeRange = `${shiftStartTime} - ${shiftEndTime}`;
      
      // Generate filename: "ABM (UTAMA) - MORNING (111225) (1).pdf"
      const cleanBusinessName = businessName.toUpperCase().replace(/[^A-Z0-9\s()]/g, "").trim();
      const fileName = `${cleanBusinessName} - ${shiftName} (${formattedDate}) (1).pdf`;

      // Calculate totals
      const cashSales = collections.filter(c => {
        const channelName = c.channelSnapshot?.name?.toUpperCase() || "";
        return !channelName.includes("GRAB") && 
               !channelName.includes("FOODPANDA") && 
               !channelName.includes("SHOPEE") && 
               !channelName.includes("MISI") && 
               !channelName.includes("TNG") &&
               !channelName.includes("QR");
      }).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

      const onlineSales = collections.filter(c => {
        const channelName = c.channelSnapshot?.name?.toUpperCase() || "";
        return channelName.includes("GRAB") || 
               channelName.includes("FOODPANDA") || 
               channelName.includes("SHOPEE") || 
               channelName.includes("MISI") || 
               channelName.includes("TNG") ||
               channelName.includes("QR");
      }).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

      const totalOnlineAndCash = onlineSales + cashSales;
      
      // Calculate totals including late transactions
      const pdfTotalCollected = collections.reduce(
        (sum, c) => sum + (parseFloat(c.amount) || 0),
        0
      );
      const pdfTotalSupplierPayments = supplierPayments.reduce(
        (sum, p) => sum + (parseFloat(p.amountPaid) || 0),
        0
      );
      const pdfTotalStaffAdvances = staffAdvances.reduce(
        (sum, a) => sum + (parseFloat(a.amount) || 0),
        0
      );
      
      // Calculate late transaction totals by type
      const pdfLateTransactionCollections = lateTransactions
        .filter(lt => lt.transactionType === "COLLECTION")
        .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
      const pdfLateTransactionSupplierPayments = lateTransactions
        .filter(lt => lt.transactionType === "SUPPLIER_PAYMENT")
        .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
      const pdfLateTransactionAdvances = lateTransactions
        .filter(lt => lt.transactionType === "ADVANCE")
        .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
      
      // Include late transactions in totals
      const pdfTotalCollectedWithLate = pdfTotalCollected + pdfLateTransactionCollections;
      const pdfTotalSupplierPaymentsWithLate = pdfTotalSupplierPayments + pdfLateTransactionSupplierPayments;
      const pdfTotalStaffAdvancesWithLate = pdfTotalStaffAdvances + pdfLateTransactionAdvances;
      const pdfTotalPaidOut = pdfTotalSupplierPaymentsWithLate + pdfTotalStaffAdvancesWithLate;
      
      const cashCount = parseFloat(report.cashSummary?.declaredCashOnHand || 0);
      const openingCash = parseFloat(report.cashSummary?.openingCash || 0);
      
      // Calculate Cash and Online Balances for PDF - using same logic as calculateBalances
      // Helper to get payment method type - matches calculateBalances logic
      const getPaymentMethodTypePDF = (paymentMethodId) => {
        if (!paymentMethodId) return "Cash"; // Default to Cash for backward compatibility
        
        // If it's already a populated object with type, use it
        if (typeof paymentMethodId === "object" && paymentMethodId.type) {
          return paymentMethodId.type;
        }
        
        // If it's a string ID or object with _id, look it up in paymentMethods array
        const pmId = typeof paymentMethodId === "object" ? paymentMethodId._id : paymentMethodId;
        const pm = paymentMethods.find(p => p._id === pmId || p._id?.toString() === pmId?.toString());
        return pm?.type || "Cash";
      };
      
      let pdfCashSales = 0;
      let pdfOnlineSales = 0;
      let pdfCashPayouts = 0;
      let pdfOnlinePayouts = 0;
      
      // Calculate from collections (including cents)
      collections.forEach((c) => {
        const pmType = getPaymentMethodTypePDF(c.paymentMethodId);
        const amount = parseFloat(c.amount || 0) + (parseFloat(c.cents || 0) / 100);
        if (pmType === "Cash") {
          pdfCashSales += amount;
        } else {
          pdfOnlineSales += amount;
        }
      });
      
      // Calculate from supplier payments (including cents)
      supplierPayments.forEach((p) => {
        const pmType = getPaymentMethodTypePDF(p.paymentMethodId);
        const amount = parseFloat(p.amountPaid || 0) + (parseFloat(p.cents || 0) / 100);
        if (pmType === "Cash") {
          pdfCashPayouts += amount;
        } else {
          pdfOnlinePayouts += amount;
        }
      });
      
      // Calculate from staff advances (including cents)
      staffAdvances.forEach((a) => {
        const pmType = getPaymentMethodTypePDF(a.paymentMethodId);
        const amount = parseFloat(a.amount || 0) + (parseFloat(a.cents || 0) / 100);
        if (pmType === "Cash") {
          pdfCashPayouts += amount;
        } else {
          pdfOnlinePayouts += amount;
        }
      });
      
      // Calculate from late transactions
      lateTransactions.forEach((lt) => {
        const pmType = getPaymentMethodTypePDF(lt.paymentMethodId);
        const amount = parseFloat(lt.amount || 0);
        
        if (lt.transactionType === "COLLECTION") {
          if (pmType === "Cash") {
            pdfCashSales += amount;
          } else {
            pdfOnlineSales += amount;
          }
        } else if (lt.transactionType === "SUPPLIER_PAYMENT" || lt.transactionType === "ADVANCE") {
          if (pmType === "Cash") {
            pdfCashPayouts += amount;
          } else {
            pdfOnlinePayouts += amount;
          }
        }
      });
      
      const pdfCashBalance = pdfCashSales - pdfCashPayouts;
      const pdfOnlineBalance = pdfOnlineSales - pdfOnlinePayouts;

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const primaryColor = [30, 58, 138]; // Deep blue for headers
      const accentColor = [59, 130, 246]; // Blue accent
      const lightBlue = [240, 249, 255]; // Very light blue for backgrounds
      const grayBorder = [229, 231, 235]; // Light gray for borders
      const darkGray = [31, 41, 55]; // Dark gray for text
      let yPos = 15;

      // Helper to add new page
      const addPageIfNeeded = (requiredSpace = 20) => {
        if (yPos + requiredSpace > pageHeight - 15) {
          pdf.addPage();
          yPos = 15;
          return true;
        }
        return false;
      };

      // Helper to format amount with 2 decimals
      const formatAmountPDF = (amount) => {
        return parseFloat(amount || 0).toFixed(2);
      };

      // Helper to draw styled box with border
      const drawStyledBox = (x, y, width, height, fillColor = null, borderColor = grayBorder) => {
        if (fillColor) {
          pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          pdf.rect(x, y, width, height, "F");
        }
        pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y, width, height, "S");
      };

      // Helper to draw table row with alternating background
      const drawTableRow = (x, y, width, height, isHeader = false, isAlternate = false) => {
        if (isHeader) {
          pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.rect(x, y, width, height, "F");
        } else if (isAlternate) {
          pdf.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
          pdf.rect(x, y, width, height, "F");
        }
        pdf.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
        pdf.setLineWidth(0.2);
        pdf.rect(x, y, width, height, "S");
      };

      // Helper to draw horizontal line
      const drawLine = (x1, y1, x2, y2, color = grayBorder, width = 0.3) => {
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(width);
        pdf.line(x1, y1, x2, y2);
      };

      // ========== HEADER SECTION ==========
      const headerBoxHeight = 32; // Increased to accommodate shift time
      drawStyledBox(margin, yPos, pageWidth - margin * 2, headerBoxHeight, primaryColor);
      
      // Business Name
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(businessName.toUpperCase(), margin + 5, yPos + 10);
      
      // Shift Info
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(240, 240, 240);
      pdf.text(`Shift: ${shiftName}`, margin + 5, yPos + 19);
      pdf.setFontSize(8);
      pdf.text(`Time: ${shiftTimeRange}`, margin + 5, yPos + 25);
      
      // Report Title (Top Right)
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("DAILY REPORT", pageWidth - margin - 5, yPos + 16, { align: "right" });
      
      yPos += headerBoxHeight + 10;

      // Report Details Section (Three Columns)
      const detailsBoxHeight = 32; // Increased height to accommodate shift time
      const detailsColWidth = (pageWidth - margin * 2 - 4) / 3;
      const detailsPadding = 5;
      
      // Report Details (Left)
      drawStyledBox(margin, yPos, detailsColWidth, detailsBoxHeight, lightBlue);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("REPORT DETAILS", margin + detailsPadding, yPos + 8);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      pdf.text(`Date: ${formatDate(report.businessDate)}`, margin + detailsPadding, yPos + 14);
      pdf.text(`Shift: ${shiftName}`, margin + detailsPadding, yPos + 19);
      pdf.text(`Time: ${shiftTimeRange}`, margin + detailsPadding, yPos + 24);
      pdf.text(`Closing: ${shiftEndTime}`, margin + detailsPadding, yPos + 29);

      // Shift Info (Middle)
      drawStyledBox(margin + detailsColWidth + 2, yPos, detailsColWidth, detailsBoxHeight, lightBlue);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("SHIFT INFO", margin + detailsColWidth + 2 + detailsPadding, yPos + 8);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      pdf.text(`Status: ${report.status}`, margin + detailsColWidth + 2 + detailsPadding, yPos + 14);
      if (report.openedBy) {
        const openedByName = (report.openedBy?.fullName || report.openedBy?.displayName || "N/A").substring(0, 20);
        pdf.text(`Opened: ${openedByName}`, margin + detailsColWidth + 2 + detailsPadding, yPos + 19);
      }
      if (report.closedBy) {
        const closedByName = (report.closedBy?.fullName || report.closedBy?.displayName || "N/A").substring(0, 20);
        pdf.text(`Closed: ${closedByName}`, margin + detailsColWidth + 2 + detailsPadding, yPos + 24);
      }

      // Cash Summary (Right)
      drawStyledBox(margin + detailsColWidth * 2 + 4, yPos, detailsColWidth, detailsBoxHeight, lightBlue);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("CASH SUMMARY", margin + detailsColWidth * 2 + 4 + detailsPadding, yPos + 8);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      pdf.text(`Opening: ${formatAmountPDF(openingCash)}`, margin + detailsColWidth * 2 + 4 + detailsPadding, yPos + 14);
      pdf.text(`Collected: ${formatAmountPDF(pdfTotalCollectedWithLate)}`, margin + detailsColWidth * 2 + 4 + detailsPadding, yPos + 19);
      pdf.text(`Paid Out: ${formatAmountPDF(pdfTotalPaidOut)}`, margin + detailsColWidth * 2 + 4 + detailsPadding, yPos + 24);

      yPos += detailsBoxHeight + 15;

      // ========== FINANCIAL SUMMARY DASHBOARD ==========
      addPageIfNeeded(30);
      const dashboardBoxHeight = 25;
      const dashboardBoxWidth = (pageWidth - margin * 2 - 6) / 3;
      const dashboardSpacing = 2;
      
      // Calculate key metrics
      const netCashFlow = pdfTotalCollectedWithLate - pdfTotalPaidOut;
      const cashSalesPercent = pdfTotalCollectedWithLate > 0 ? ((cashSales / pdfTotalCollectedWithLate) * 100).toFixed(1) : "0.0";
      const onlineSalesPercent = pdfTotalCollectedWithLate > 0 ? ((onlineSales / pdfTotalCollectedWithLate) * 100).toFixed(1) : "0.0";
      
      // Total Collections Box
      drawStyledBox(margin, yPos, dashboardBoxWidth, dashboardBoxHeight, [59, 130, 246]);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255);
      pdf.text("TOTAL COLLECTIONS", margin + 3, yPos + 6);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(pdfTotalCollectedWithLate), margin + dashboardBoxWidth / 2, yPos + 14, { align: "center" });
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Cash: ${cashSalesPercent}% | Online: ${onlineSalesPercent}%`, margin + dashboardBoxWidth / 2, yPos + 20, { align: "center" });
      
      // Total Payouts Box (Second position)
      drawStyledBox(margin + dashboardBoxWidth + dashboardSpacing, yPos, dashboardBoxWidth, dashboardBoxHeight, [220, 38, 38]);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255);
      pdf.text("TOTAL PAYOUTS", margin + dashboardBoxWidth + dashboardSpacing + 3, yPos + 6);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(pdfTotalPaidOut), margin + dashboardBoxWidth + dashboardSpacing + dashboardBoxWidth / 2, yPos + 14, { align: "center" });
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Suppliers: ${formatAmountPDF(pdfTotalSupplierPaymentsWithLate)} | Advances: ${formatAmountPDF(pdfTotalStaffAdvancesWithLate)}`, margin + dashboardBoxWidth + dashboardSpacing + dashboardBoxWidth / 2, yPos + 20, { align: "center" });
      
      // Net Cash Flow Box (Third position)
      drawStyledBox(margin + (dashboardBoxWidth + dashboardSpacing) * 2, yPos, dashboardBoxWidth, dashboardBoxHeight, netCashFlow >= 0 ? [34, 197, 94] : [220, 38, 38]);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255);
      pdf.text("NET CASH FLOW", margin + (dashboardBoxWidth + dashboardSpacing) * 2 + 3, yPos + 6);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(netCashFlow), margin + (dashboardBoxWidth + dashboardSpacing) * 2 + dashboardBoxWidth / 2, yPos + 14, { align: "center" });
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`In: ${formatAmountPDF(pdfTotalCollectedWithLate)} | Out: ${formatAmountPDF(pdfTotalPaidOut)}`, margin + (dashboardBoxWidth + dashboardSpacing) * 2 + dashboardBoxWidth / 2, yPos + 20, { align: "center" });
      
      yPos += dashboardBoxHeight + 12;

      // ========== BALANCE SUMMARY SECTION ==========
      addPageIfNeeded(35);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("BALANCE SUMMARY", margin, yPos);
      yPos += 8;
      
      const balanceBoxWidth = (pageWidth - margin * 2 - 6) / 2;
      const balanceBoxHeight = 50;
      
      // Cash Balance Box - Using primary orange color (#0C2E5A = RGB 242, 144, 16)
      const cashBalanceColor = [242, 144, 16]; // Primary orange color
      drawStyledBox(margin, yPos, balanceBoxWidth, balanceBoxHeight, cashBalanceColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("CASH BALANCE", margin + balanceBoxWidth / 2, yPos + 10, { align: "center" });
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255);
      pdf.text(`CASH SALES: ${formatAmountPDF(pdfCashSales)}`, margin + 5, yPos + 20);
      pdf.text(`CASH PAYOUTS: ${formatAmountPDF(pdfCashPayouts)}`, margin + 5, yPos + 30);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`CASH BALANCE: ${formatAmountPDF(pdfCashBalance)}`, margin + balanceBoxWidth / 2, yPos + 42, { align: "center" });
      
      // Online Balance Box
      const onlineBalanceColor = pdfOnlineBalance >= 0 ? [34, 197, 94] : [220, 38, 38];
      drawStyledBox(margin + balanceBoxWidth + 6, yPos, balanceBoxWidth, balanceBoxHeight, onlineBalanceColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("ONLINE BALANCE", margin + balanceBoxWidth + 6 + balanceBoxWidth / 2, yPos + 10, { align: "center" });
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255);
      pdf.text(`ONLINE SALES: ${formatAmountPDF(pdfOnlineSales)}`, margin + balanceBoxWidth + 11, yPos + 20);
      pdf.text(`ONLINE PAYOUTS: ${formatAmountPDF(pdfOnlinePayouts)}`, margin + balanceBoxWidth + 11, yPos + 30);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`ONLINE BALANCE: ${formatAmountPDF(pdfOnlineBalance)}`, margin + balanceBoxWidth + 6 + balanceBoxWidth / 2, yPos + 42, { align: "center" });
      
      yPos += balanceBoxHeight + 15;

      // ========== COLLECTIONS SECTION ==========
      addPageIfNeeded(40);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("COLLECTIONS", margin, yPos);
      yPos += 8;

      // Prepare collections data for autoTable (including late transactions)
      const collectionsHeaders = ["Channel / Source", "Payment Method", "Reference", "Amount"];
      const collectionsRows = collections.map((col) => {
        let paymentMethodName = col.paymentMethodSnapshot?.name || col.paymentMethodId?.name || "-";
        if (paymentMethodName && /^[0-9a-fA-F]{24}$/.test(paymentMethodName)) {
          paymentMethodName = "-";
        }
        const paymentMethodType = col.paymentMethodSnapshot?.type || col.paymentMethodId?.type || "";
        if (paymentMethodType) {
          paymentMethodName = `${paymentMethodName} (${paymentMethodType})`;
        }
        return [
          (col.channelSnapshot?.name || "Unknown").substring(0, 30),
          paymentMethodName.substring(0, 25),
          (col.referenceNo || "-").substring(0, 20),
          formatAmountPDF(col.amount || 0)
        ];
      });
      
      // Add late transaction collections
      lateTransactions
        .filter(lt => lt.transactionType === "COLLECTION")
        .forEach((lt) => {
          let paymentMethodName = lt.paymentMethodSnapshot?.name || lt.paymentMethodId?.name || "-";
          const paymentMethodType = lt.paymentMethodSnapshot?.type || lt.paymentMethodId?.type || "";
          if (paymentMethodType) {
            paymentMethodName = `${paymentMethodName} (${paymentMethodType})`;
          }
          collectionsRows.push([
            `${(lt.channelSnapshot?.name || "Unknown").substring(0, 25)} (Late)`,
            paymentMethodName.substring(0, 25),
            (lt.reason || "-").substring(0, 20),
            formatAmountPDF(lt.amount || 0)
          ]);
        });

      if (collectionsRows.length === 0) {
        collectionsRows.push(["No collections recorded", "", "", ""]);
      } else {
        // Add total row
        collectionsRows.push([
          { content: "TOTAL COLLECTIONS", colSpan: 3, styles: { fontStyle: "bold", fillColor: primaryColor, textColor: [255, 255, 255] } },
          { content: formatAmountPDF(pdfTotalCollectedWithLate), styles: { fontStyle: "bold", fillColor: primaryColor, textColor: [255, 255, 255], halign: "right" } }
        ]);
      }

      autoTable(pdf, {
        startY: yPos,
        head: [collectionsHeaders],
        body: collectionsRows,
        theme: "striped",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: darkGray
        },
        alternateRowStyles: {
          fillColor: lightBlue
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 50 },
          2: { cellWidth: 40 },
          3: { cellWidth: "auto", halign: "right" }
        },
        margin: { left: margin, right: margin },
        styles: {
          cellPadding: 3,
          lineColor: grayBorder,
          lineWidth: 0.2
        }
      });

      yPos = pdf.lastAutoTable.finalY + 10;

      // ========== CHANNEL-WISE BREAKDOWN ==========
      if (collections.length > 0) {
        addPageIfNeeded(30);
        const channelBreakdown = {};
        collections.forEach((col) => {
          const channelName = col.channelSnapshot?.name || "Unknown";
          if (!channelBreakdown[channelName]) {
            channelBreakdown[channelName] = 0;
          }
          channelBreakdown[channelName] += parseFloat(col.amount) || 0;
        });

        const channelEntries = Object.entries(channelBreakdown).sort((a, b) => b[1] - a[1]);
        
        if (channelEntries.length > 0) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text("Collections by Channel", margin, yPos);
          yPos += 8;

          const breakdownBoxHeight = Math.min(channelEntries.length * 6 + 10, 50);
          drawStyledBox(margin, yPos, pageWidth - margin * 2, breakdownBoxHeight, lightBlue);
          
          let breakdownY = yPos + 6;
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
          
          channelEntries.forEach(([channelName, amount]) => {
            const percentage = pdfTotalCollectedWithLate > 0 ? ((amount / pdfTotalCollectedWithLate) * 100).toFixed(1) : "0.0";
            pdf.text(`${channelName.substring(0, 30)}:`, margin + 5, breakdownY);
            pdf.setFont("helvetica", "bold");
            pdf.text(formatAmountPDF(amount), pageWidth - margin - 60, breakdownY, { align: "right" });
            pdf.setFont("helvetica", "normal");
            pdf.text(`(${percentage}%)`, pageWidth - margin - 5, breakdownY, { align: "right" });
            breakdownY += 6;
          });
          
          yPos += breakdownBoxHeight + 10;
        }
      }

      // ========== SUPPLIER PAYMENTS SECTION ==========
      addPageIfNeeded(40);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("SUPPLIER PAYMENTS", margin, yPos);
      yPos += 8;

      const supplierHeaders = ["Supplier Name", "Payment Method", "Amount"];
      const supplierRows = supplierPayments.map((payment) => {
        let paymentMethodName = payment.paymentMethodSnapshot?.name || payment.paymentMethodId?.name || "-";
        if (paymentMethodName && /^[0-9a-fA-F]{24}$/.test(paymentMethodName)) {
          paymentMethodName = "-";
        }
        const paymentMethodType = payment.paymentMethodSnapshot?.type || payment.paymentMethodId?.type || "";
        if (paymentMethodType) {
          paymentMethodName = `${paymentMethodName} (${paymentMethodType})`;
        }
        return [
          (payment.supplierNameSnapshot || "Unknown").substring(0, 35),
          paymentMethodName.substring(0, 30),
          formatAmountPDF(payment.amountPaid || 0)
        ];
      });
      
      // Add late transaction supplier payments
      lateTransactions
        .filter(lt => lt.transactionType === "SUPPLIER_PAYMENT")
        .forEach((lt) => {
          let paymentMethodName = lt.paymentMethodSnapshot?.name || lt.paymentMethodId?.name || "-";
          const paymentMethodType = lt.paymentMethodSnapshot?.type || lt.paymentMethodId?.type || "";
          if (paymentMethodType) {
            paymentMethodName = `${paymentMethodName} (${paymentMethodType})`;
          }
          supplierRows.push([
            `${(lt.supplierNameSnapshot || "Unknown Supplier").substring(0, 30)} (Late)`,
            paymentMethodName.substring(0, 30),
            formatAmountPDF(lt.amount || 0)
          ]);
        });

      if (supplierRows.length === 0) {
        supplierRows.push(["No supplier payments recorded", "", ""]);
      } else {
        supplierRows.push([
          { content: "TOTAL SUPPLIER PAYMENTS", colSpan: 2, styles: { fontStyle: "bold", fillColor: primaryColor, textColor: [255, 255, 255] } },
          { content: formatAmountPDF(pdfTotalSupplierPaymentsWithLate), styles: { fontStyle: "bold", fillColor: primaryColor, textColor: [255, 255, 255], halign: "right" } }
        ]);
      }

      autoTable(pdf, {
        startY: yPos,
        head: [supplierHeaders],
        body: supplierRows,
        theme: "striped",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: darkGray
        },
        alternateRowStyles: {
          fillColor: lightBlue
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 60 },
          2: { cellWidth: "auto", halign: "right" }
        },
        margin: { left: margin, right: margin },
        styles: {
          cellPadding: 3,
          lineColor: grayBorder,
          lineWidth: 0.2
        }
      });

      yPos = pdf.lastAutoTable.finalY + 10;

      // ========== STAFF ADVANCES SECTION ==========
      addPageIfNeeded(40);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text("STAFF ADVANCES", margin, yPos);
      yPos += 8;

      const refIdKeyPdfSa = (ref) => {
        if (ref == null || ref === "") return "";
        if (typeof ref === "object" && ref._id != null) return String(ref._id);
        return String(ref);
      };
      const pmLabelPdfSa = (adv) => {
        if (adv.paymentMethodSnapshot?.name) return adv.paymentMethodSnapshot.name;
        const pmId = adv.paymentMethodId;
        if (!pmId) return "Cash";
        if (typeof pmId === "object" && pmId.name) return pmId.name;
        const id = typeof pmId === "object" ? pmId._id : pmId;
        const pm = paymentMethods.find((p) => p._id === id || p._id?.toString() === id?.toString());
        return pm?.name || pm?.type || "-";
      };
      const staffAdvanceMergeKeyPdf = (adv) => {
        const emp = refIdKeyPdfSa(adv.employeeId);
        const pm = refIdKeyPdfSa(adv.paymentMethodId);
        if (pm !== "") return `${emp}::pm:${pm}`;
        const snap =
          (adv.paymentMethodSnapshot &&
            String(adv.paymentMethodSnapshot.code || adv.paymentMethodSnapshot.name || "").trim()) ||
          "";
        if (snap !== "") return `${emp}::snap:${snap}`;
        return `${emp}::row:${adv.id || refIdKeyPdfSa(adv._id)}`;
      };
      const groupedStaffAdvancesPdf = (() => {
        const map = new Map();
        for (const adv of staffAdvances) {
          const key = staffAdvanceMergeKeyPdf(adv);
          if (!map.has(key)) map.set(key, { representative: { ...adv }, items: [adv] });
          else map.get(key).items.push(adv);
        }
        return Array.from(map.values()).map(({ representative, items: groupItems }) => {
          const total = groupItems.reduce(
            (s, x) => s + (parseFloat(x.amount) || 0) + (parseFloat(x.cents || 0) / 100),
            0
          );
          return { ...representative, amount: total };
        });
      })();

      const advanceHeaders = ["Employee Name", "Payment Method", "Advance Type", "Amount"];
      const advanceRows = groupedStaffAdvancesPdf.map((adv) => {
        return [
          (adv.employeeNameSnapshot || "Unknown").substring(0, 30),
          String(pmLabelPdfSa(adv)).substring(0, 20),
          String(resolveStaffAdvanceTypeLabel(adv) || "Advance").substring(0, 24),
          formatAmountPDF(adv.amount || 0)
        ];
      });
      
      // Add late transaction advances
      lateTransactions
        .filter(lt => lt.transactionType === "ADVANCE")
        .forEach((lt) => {
          advanceRows.push([
            `${(lt.employeeNameSnapshot || "Unknown Employee").substring(0, 24)} (Late)`,
            String(lt.paymentMethodSnapshot?.name || pmLabelPdfSa(lt)).substring(0, 20),
            "Late Transaction",
            formatAmountPDF(lt.amount || 0)
          ]);
        });

      if (advanceRows.length === 0) {
        advanceRows.push(["No staff advances recorded", "", "", ""]);
      } else {
        advanceRows.push([
          { content: "TOTAL STAFF ADVANCES", colSpan: 3, styles: { fontStyle: "bold", fillColor: primaryColor, textColor: [255, 255, 255] } },
          { content: formatAmountPDF(pdfTotalStaffAdvancesWithLate), styles: { fontStyle: "bold", fillColor: primaryColor, textColor: [255, 255, 255], halign: "right" } }
        ]);
      }

      autoTable(pdf, {
        startY: yPos,
        head: [advanceHeaders],
        body: advanceRows,
        theme: "striped",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: darkGray
        },
        alternateRowStyles: {
          fillColor: lightBlue
        },
        columnStyles: {
          0: { cellWidth: 48 },
          1: { cellWidth: 32 },
          2: { cellWidth: 42 },
          3: { cellWidth: "auto", halign: "right" }
        },
        margin: { left: margin, right: margin },
        styles: {
          cellPadding: 3,
          lineColor: grayBorder,
          lineWidth: 0.2
        }
      });

      yPos = pdf.lastAutoTable.finalY + 10;

      // ========== LATE TRANSACTIONS SECTION ==========
      if (lateTransactions && lateTransactions.length > 0) {
        addPageIfNeeded(40);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text("LATE TRANSACTIONS", margin, yPos);
        yPos += 8;

        // Map transaction type code to display name
        const getTransactionTypeNamePDF = (code) => {
          const typeMap = {
            "COLLECTION": "Collection",
            "SUPPLIER_PAYMENT": "Supplier Payment",
            "ADVANCE": "Advance"
          };
          return typeMap[code] || code || "Unknown";
        };

        const lateHeaders = ["Transaction Type", "Supplier/Employee/Channel", "Payment Method", "Reason", "Amount"];
        const lateRows = lateTransactions.map((txn) => {
          const txnTime = txn.actualTxnAt ? new Date(txn.actualTxnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
          
          // Get supplier/employee/channel name based on transaction type
          let entityName = "-";
          if (txn.transactionType === "SUPPLIER_PAYMENT") {
            entityName = txn.supplierNameSnapshot || txn.supplierId?.name || "Unknown Supplier";
          } else if (txn.transactionType === "ADVANCE") {
            entityName = txn.employeeNameSnapshot || txn.employeeId?.fullName || txn.employeeId?.displayName || "Unknown Employee";
          } else {
            entityName = txn.channelSnapshot?.name || txn.channelId?.name || "Unknown Channel";
          }
          
          // Get payment method name and type
          let paymentMethodName = txn.paymentMethodSnapshot?.name || txn.paymentMethodId?.name || "-";
          const paymentMethodType = txn.paymentMethodSnapshot?.type || txn.paymentMethodId?.type || "";
          if (paymentMethodType) {
            paymentMethodName = `${paymentMethodName} (${paymentMethodType})`;
          }
          
          return [
            getTransactionTypeNamePDF(txn.transactionType).substring(0, 20),
            entityName.substring(0, 25),
            paymentMethodName.substring(0, 20),
            (txn.reason || "-").substring(0, 20),
            formatAmountPDF(txn.amount || 0)
          ];
        });

        autoTable(pdf, {
          startY: yPos,
          head: [lateHeaders],
          body: lateRows,
          theme: "striped",
          headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 8.5,
            textColor: darkGray
          },
          alternateRowStyles: {
            fillColor: lightBlue
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 45 },
            2: { cellWidth: 35 },
            3: { cellWidth: 40 },
            4: { cellWidth: "auto", halign: "right" }
          },
          margin: { left: margin, right: margin },
          styles: {
            cellPadding: 3,
            lineColor: grayBorder,
            lineWidth: 0.2
          }
        });

        yPos = pdf.lastAutoTable.finalY + 10;
      }

      // ========== SECTION DIVIDER ==========
      addPageIfNeeded(80);
      drawLine(margin, yPos, pageWidth - margin, yPos, primaryColor, 0.5);
      yPos += 5;

      // ========== SUMMARY & NOTES SECTION (Side by Side) ==========
      const boxSpacing = 6;
      const summaryBoxWidth = 100; // Increased width to ensure variance value fits on same row
      const summaryBoxX = pageWidth - margin - summaryBoxWidth;
      const summaryStartY = yPos;
      
      // Calculate summary content height - MUST match actual rendering below
      let summaryContentY = summaryStartY;
      summaryContentY += 10; // Header (summaryHeaderHeight)
      summaryContentY += 8;  // Initial spacing after header
      summaryContentY += 7;  // Subtotal (Collections)
      summaryContentY += 7;  // Staff Advances
      summaryContentY += 6;  // Supplier Payments
      summaryContentY += 6;  // Divider line spacing
      summaryContentY += 9;  // Net Cash Flow
      summaryContentY += 7;  // Opening Cash
      summaryContentY += 7;  // Declared Cash
      summaryContentY += 8;  // Bottom padding
      const calculatedSummaryHeight = summaryContentY - summaryStartY;
      
      // Calculate notes content height
      let notesContentHeight = 25;
      if (report.notes || report.remarks) {
        const notesBoxWidth = summaryBoxX - margin - boxSpacing;
        let notesY = 0;
        notesY += 10; // Header
        if (report.notes) {
          const notesLines = pdf.splitTextToSize(report.notes || "", notesBoxWidth - 10);
          notesY += notesLines.length * 5.5;
        }
        if (report.remarks) {
          notesY += 3;
          notesY += 5.5;
          const remarksLines = pdf.splitTextToSize(report.remarks || "", notesBoxWidth - 10);
          notesY += remarksLines.length * 5.5;
        }
        notesY += 5;
        notesContentHeight = Math.max(notesContentHeight, notesY);
      }
      
      const boxHeight = Math.max(calculatedSummaryHeight, notesContentHeight);
      
      // Draw Summary box with enhanced styling
      drawStyledBox(summaryBoxX, summaryStartY, summaryBoxWidth, boxHeight, lightBlue);
      
      // Summary Header with background
      const summaryHeaderHeight = 10;
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(summaryBoxX, summaryStartY, summaryBoxWidth, summaryHeaderHeight, "F");
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SUMMARY", summaryBoxX + summaryBoxWidth / 2, summaryStartY + 7, { align: "center" });
      
      let summaryY = summaryStartY + summaryHeaderHeight + 8;
      
      // Transaction Totals Section
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      
      // Collections
      pdf.text("Subtotal (Collections):", summaryBoxX + 5, summaryY);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(pdfTotalCollectedWithLate), summaryBoxX + summaryBoxWidth - 8, summaryY, { align: "right" });
      pdf.setFont("helvetica", "normal");
      summaryY += 7;
      
      // Staff Advances
      pdf.text("Staff Advances:", summaryBoxX + 5, summaryY);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(pdfTotalStaffAdvancesWithLate), summaryBoxX + summaryBoxWidth - 8, summaryY, { align: "right" });
      pdf.setFont("helvetica", "normal");
      summaryY += 7;
      
      // Supplier Payments
      pdf.text("Supplier Payments:", summaryBoxX + 5, summaryY);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(pdfTotalSupplierPaymentsWithLate), summaryBoxX + summaryBoxWidth - 8, summaryY, { align: "right" });
      pdf.setFont("helvetica", "normal");
      summaryY += 6;
      
      // Divider line
      drawLine(summaryBoxX + 4, summaryY, summaryBoxX + summaryBoxWidth - 4, summaryY, [200, 200, 200], 0.4);
      summaryY += 6;
      
      // Net Cash Flow - Highlighted
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      const netCashFlowColor = netCashFlow >= 0 ? [34, 197, 94] : [220, 38, 38];
      pdf.setTextColor(netCashFlowColor[0], netCashFlowColor[1], netCashFlowColor[2]);
      pdf.text("Net Cash Flow:", summaryBoxX + 5, summaryY);
      pdf.text(formatAmountPDF(netCashFlow), summaryBoxX + summaryBoxWidth - 8, summaryY, { align: "right" });
      summaryY += 9;
      
      // Cash Reconciliation Section
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      
      // Opening Cash
      pdf.text("Opening Cash:", summaryBoxX + 5, summaryY);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(openingCash), summaryBoxX + summaryBoxWidth - 8, summaryY, { align: "right" });
      pdf.setFont("helvetica", "normal");
      summaryY += 7;
      
      // Declared Cash
      pdf.text("Declared Cash:", summaryBoxX + 5, summaryY);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatAmountPDF(cashCount), summaryBoxX + summaryBoxWidth - 8, summaryY, { align: "right" });
      pdf.setFont("helvetica", "normal");
      summaryY += 7;

      // Draw Notes box (Left Side) with enhanced styling
      const notesBoxWidth = summaryBoxX - margin - boxSpacing;
      drawStyledBox(margin, summaryStartY, notesBoxWidth, boxHeight, lightBlue);
      
      // Notes Header with background
      const notesHeaderHeight = 10;
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(margin, summaryStartY, notesBoxWidth, notesHeaderHeight, "F");
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("NOTES & REMARKS", margin + notesBoxWidth / 2, summaryStartY + 7, { align: "center" });
      
      let notesY = summaryStartY + notesHeaderHeight + 8;
      
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      
      // Notes Section
      if (report.notes) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text("Notes:", margin + 5, notesY);
        notesY += 6;
        
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        const notesLines = pdf.splitTextToSize(report.notes || "", notesBoxWidth - 10);
        notesLines.forEach((line) => {
          if (notesY < summaryStartY + boxHeight - 8) {
            pdf.text(line, margin + 5, notesY);
            notesY += 5.5;
          }
        });
        if (report.remarks) {
          notesY += 4;
        }
      }
      
      // Remarks Section
      if (report.remarks) {
        if (report.notes) {
          // Add separator line if both exist
          drawLine(margin + 4, notesY - 2, margin + notesBoxWidth - 4, notesY - 2, [200, 200, 200], 0.3);
          notesY += 4;
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text("Remarks:", margin + 5, notesY);
        notesY += 6;
        
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        const remarksLines = pdf.splitTextToSize(report.remarks || "", notesBoxWidth - 10);
        remarksLines.forEach((line) => {
          if (notesY < summaryStartY + boxHeight - 8) {
            pdf.text(line, margin + 5, notesY);
            notesY += 5.5;
          }
        });
      }
      
      // If no notes or remarks, show placeholder
      if (!report.notes && !report.remarks) {
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(150, 150, 150);
        pdf.text("No notes or remarks recorded", margin + 5, notesY);
      }
      
      yPos = summaryStartY + boxHeight + 10;

      // ========== FOOTER ==========
      const totalPages = pdf.internal.getNumberOfPages();
      const reportId = report._id ? report._id.substring(0, 8).toUpperCase() : "N/A";
      const generatedBy = adminInfo?.fullName || adminInfo?.displayName || "System";
      
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        // Draw footer line
        pdf.setDrawColor(grayBorder[0], grayBorder[1], grayBorder[2]);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120, 120, 120);
        
        // Left side - Report ID
        pdf.text(`Report ID: ${reportId}`, margin, pageHeight - 8);
        pdf.text(`Status: ${report.status}`, margin, pageHeight - 4);
        
        // Center - Page info
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
        pdf.text(
          `Generated: ${new Date().toLocaleString()}`,
          pageWidth / 2,
          pageHeight - 4,
          { align: "center" }
        );
        
        // Right side - Generated by
        pdf.text(`Generated by: ${generatedBy.substring(0, 20)}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        pdf.text(`Business: ${businessName.substring(0, 20)}`, pageWidth - margin, pageHeight - 4, { align: "right" });
        
        pdf.setTextColor(60, 60, 60);
      }

      // Download PDF
      pdf.save(fileName);
      notifySuccess(t("dailyReports.messages.success.pdfDownloaded"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifyError(t("dailyReports.messages.error.generatePdf", { message: error.message }));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB", icon: Edit },
      SUBMITTED: { bg: "#3B82F6", text: "#FFFFFF", border: "#2563EB", icon: Clock },
      APPROVED: { bg: "#10B981", text: "#FFFFFF", border: "#059669", icon: CheckCircle },
      LOCKED: { bg: "#8B5CF6", text: "#FFFFFF", border: "#7C3AED", icon: Lock },
    };
    const config = statusConfig[status] || statusConfig.DRAFT;
    const Icon = config.icon;
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border" 
        style={{ 
          backgroundColor: config.bg,
          color: config.text,
          borderColor: config.border,
          borderWidth: '1px',
          textShadow: 'none',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          opacity: 1
        }}
      >
        <Icon className="w-4 h-4" style={{ flexShrink: 0, color: config.text }} />
        <span style={{ fontWeight: 600, letterSpacing: '0.025em', color: config.text }}>{status}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)]"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{t("dailyReports.view.notFound")}</p>
          <button
            onClick={() => history.push(backTarget)}
            className="mt-4 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 transition-colors"
          >
            {t("dailyReports.buttons.backToList")}
          </button>
        </div>
      </div>
    );
  }

  const totalCollected = collections.reduce(
    (sum, c) => sum + (parseFloat(c.amount) || 0),
    0
  );
  const totalSupplierPayments = supplierPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amountPaid) || 0),
    0
  );
  const totalStaffAdvances = staffAdvances.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );
  
  // Calculate late transaction totals by type
  const lateTransactionCollections = lateTransactions
    .filter(lt => lt.transactionType === "COLLECTION")
    .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
  const lateTransactionSupplierPayments = lateTransactions
    .filter(lt => lt.transactionType === "SUPPLIER_PAYMENT")
    .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
  const lateTransactionAdvances = lateTransactions
    .filter(lt => lt.transactionType === "ADVANCE")
    .reduce((sum, lt) => sum + (parseFloat(lt.amount) || 0), 0);
  
  // Include late transactions in totals
  const totalCollectedWithLate = totalCollected + lateTransactionCollections;
  const totalSupplierPaymentsWithLate = totalSupplierPayments + lateTransactionSupplierPayments;
  const totalStaffAdvancesWithLate = totalStaffAdvances + lateTransactionAdvances;
  const totalPaidOut = totalSupplierPaymentsWithLate + totalStaffAdvancesWithLate;

  // Calculate balances
  const calculateBalances = () => {
    let cashSales = 0;
    let cashPayouts = 0;
    let onlineSales = 0;
    let onlinePayouts = 0;

    // Helper to get payment method type - matches CreateShiftReport logic
    const getPaymentMethodType = (paymentMethodId) => {
      if (!paymentMethodId) return "Cash"; // Default to Cash for backward compatibility
      
      // If it's already a populated object with type, use it
      if (typeof paymentMethodId === "object" && paymentMethodId.type) {
        return paymentMethodId.type;
      }
      
      // If it's a string ID, look it up in paymentMethods array
      const pmId = typeof paymentMethodId === "object" ? paymentMethodId._id : paymentMethodId;
      const pm = paymentMethods.find(p => p._id === pmId || p._id?.toString() === pmId?.toString());
      return pm?.type || "Cash";
    };

    // Calculate from collections
    collections.forEach((c) => {
      const pmType = getPaymentMethodType(c.paymentMethodId);
      const amount = parseFloat(c.amount || 0);
      if (pmType === "Cash") {
        cashSales += amount;
      } else {
        onlineSales += amount;
      }
    });

    // Calculate from supplier payments
    supplierPayments.forEach((p) => {
      const pmType = getPaymentMethodType(p.paymentMethodId);
      const amount = parseFloat(p.amountPaid || 0);
      if (pmType === "Cash") {
        cashPayouts += amount;
      } else {
        onlinePayouts += amount;
      }
    });

    // Calculate from staff advances
    staffAdvances.forEach((a) => {
      const pmType = getPaymentMethodType(a.paymentMethodId);
      const amount = parseFloat(a.amount || 0);
      if (pmType === "Cash") {
        cashPayouts += amount;
      } else {
        onlinePayouts += amount;
      }
    });

    // Calculate from late transactions
    lateTransactions.forEach((lt) => {
      // For late transactions, prefer paymentMethodSnapshot if available
      let pmType = "Cash";
      if (lt.paymentMethodSnapshot && lt.paymentMethodSnapshot.type) {
        pmType = lt.paymentMethodSnapshot.type;
      } else {
        pmType = getPaymentMethodType(lt.paymentMethodId);
      }
      
      const amount = parseFloat(lt.amount || 0);
      
      if (lt.transactionType === "COLLECTION") {
        if (pmType === "Cash") {
          cashSales += amount;
        } else {
          onlineSales += amount;
        }
      } else if (lt.transactionType === "SUPPLIER_PAYMENT" || lt.transactionType === "ADVANCE") {
        if (pmType === "Cash") {
          cashPayouts += amount;
        } else {
          onlinePayouts += amount;
        }
      }
    });

    return {
      cashSales,
      cashPayouts,
      cashBalance: cashSales - cashPayouts,
      onlineSales,
      onlinePayouts,
      onlineBalance: onlineSales - onlinePayouts,
    };
  };

  const balances = calculateBalances();

  const refIdKeyStaff = (ref) => {
    if (ref == null || ref === "") return "";
    if (typeof ref === "object" && ref._id != null) return String(ref._id);
    return String(ref);
  };
  const staffAdvanceMergeKeyForItemView = (adv) => {
    const emp = refIdKeyStaff(adv.employeeId);
    const pm = refIdKeyStaff(adv.paymentMethodId);
    if (pm !== "") return `${emp}::pm:${pm}`;
    const snap =
      (adv.paymentMethodSnapshot &&
        String(adv.paymentMethodSnapshot.code || adv.paymentMethodSnapshot.name || "").trim()) ||
      "";
    if (snap !== "") return `${emp}::snap:${snap}`;
    return `${emp}::row:${adv.id || refIdKeyStaff(adv._id)}`;
  };
  const groupStaffAdvancesForView = (items) => {
    const map = new Map();
    for (const it of items) {
      const key = staffAdvanceMergeKeyForItemView(it);
      if (!map.has(key)) map.set(key, { representative: { ...it }, items: [it] });
      else map.get(key).items.push(it);
    }
    return Array.from(map.values()).map(({ representative, items: groupItems }) => {
      const total = groupItems.reduce(
        (s, x) => s + (parseFloat(x.amount) || 0) + (parseFloat(x.cents || 0) / 100),
        0
      );
      return {
        ...representative,
        amount: total,
        cents: 0,
        _sourceItems: groupItems,
      };
    });
  };
  const displayStaffAdvances = groupStaffAdvancesForView(staffAdvances);

  const staffAdvancePaymentMethodLabelView = (a) => {
    if (a.paymentMethodSnapshot?.name) return a.paymentMethodSnapshot.name;
    const pmId = a.paymentMethodId;
    if (!pmId) return "Cash";
    if (typeof pmId === "object" && pmId.name) return pmId.name;
    const id = typeof pmId === "object" ? pmId._id : pmId;
    const pm = paymentMethods.find((p) => p._id === id || p._id?.toString() === id?.toString());
    return pm?.name || pm?.type || "-";
  };
  
  // Calculate expected cash dynamically (matching CreateShiftReport)
  const openingCash = parseFloat(report.cashSummary?.openingCash || 0);
  const expectedCash = openingCash + totalCollectedWithLate - totalPaidOut;

  return (
    <Page
      header={{
        title: t("dailyReports.view.title"),
        showBackButton: true,
        onBackClick: () => history.push(backTarget),
        renderActions: [
          getStatusBadge(report.status),
          <button
            key="pdf"
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 shadow-sm hover:opacity-90 transition-colors"
            style={{ backgroundColor: "var(--p-blue)", minWidth: "auto" }}
          >
            <Download className="w-4 h-4 text-white" />
            <span className="text-white">{isGeneratingPDF ? t("dailyReports.buttons.generating") : t("dailyReports.buttons.downloadPdf")}</span>
          </button>,
          ...(canUpdate && (report.status === "DRAFT" || report.status === "SUBMITTED") ? [
            <button
              key="edit"
              onClick={() =>
                history.push(`/daily-reports/edit/${id}`, {
                  returnTo: backTarget,
                })
              }
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg shadow-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              <Edit className="w-4 h-4" />
              {t("dailyReports.buttons.edit")}
            </button>
          ] : []),
          ...(canDelete && report.status === "DRAFT" ? [
            <button
              key="delete"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg shadow-sm bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              {t("dailyReports.buttons.delete")}
            </button>
          ] : []),
          ...(report.status === "SUBMITTED" ? [
            <button
              key="approve"
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg shadow-sm bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              {actionLoading ? t("dailyReports.buttons.processing") : t("dailyReports.buttons.approveAndLock")}
            </button>
          ] : []),
        ],
      }}
      customClassName="print:bg-white"
    >

        {/* Print Header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-semibold text-center">{t("dailyReports.view.printHeader")}</h1>
          <p className="text-center text-sm text-gray-600">
            {[
              !isSingleBusiness ? report.business?.name : null,
              formatDate(report.businessDate),
              report.shiftSnapshot?.name || report.shiftId?.name
                ? `${report.shiftSnapshot?.name || report.shiftId?.name} Shift`
                : report.shiftNo === 1
                  ? "Morning Shift"
                  : report.shiftNo === 2
                    ? "Evening Shift"
                    : report.shiftNo != null
                      ? `Shift ${report.shiftNo}`
                      : "Shift",
            ]
              .filter(Boolean)
              .join(" - ")}
          </p>
        </div>

        {/* Report Info */}
        <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-[var(--p-blue)]" />
            {t("dailyReports.sections.reportInformation")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {!isSingleBusiness && (
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("dailyReports.fields.business")}</p>
              <p className="font-medium text-sm text-gray-800">{report.business?.name || t("dailyReports.common.na")}</p>
            </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("dailyReports.fields.date")}</p>
              <p className="font-medium text-sm text-gray-800">{formatDate(report.businessDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("dailyReports.fields.shift")}</p>
              <p className="font-medium text-sm text-gray-800">
                {report.shiftSnapshot?.name ||
                  report.shiftId?.name ||
                  (report.shiftNo === 1 ? t("dailyReports.common.morning") : report.shiftNo === 2 ? t("dailyReports.common.evening") : t("dailyReports.common.shiftFallback", { number: report.shiftNo }))}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t("dailyReports.fields.status")}</p>
              <p className="font-medium text-sm text-gray-800">{t(`dailyReports.status.${report.status}`, { defaultValue: report.status })}</p>
            </div>
            {report.openedBy && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Opened By</p>
                <p className="font-medium text-sm text-gray-800">
                  {report.openedBy?.fullName || report.openedBy?.displayName || "N/A"}
                </p>
              </div>
            )}
            {report.closedBy && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Closed By</p>
                <p className="font-medium text-sm text-gray-800">
                  {report.closedBy?.fullName || report.closedBy?.displayName || "N/A"}
                </p>
              </div>
            )}
            {report.approvedBy && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Approved By</p>
                <p className="font-medium text-sm text-gray-800">
                  {report.approvedBy?.name || "N/A"}
                </p>
              </div>
            )}
            {report.approvedAt && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Approved At</p>
                <p className="font-medium text-sm text-gray-800">
                  {new Date(report.approvedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cash Summary */}
        <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[var(--p-blue)]" />
            Cash Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Opening Cash</p>
              <p className="text-lg font-semibold text-gray-800">
                {formatAmount(report.cashSummary?.openingCash || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Collected</p>
              <p className="text-lg font-semibold text-gray-800">{formatAmount(totalCollectedWithLate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Paid Out</p>
              <p className="text-lg font-semibold text-gray-800">{formatAmount(totalPaidOut)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Expected Cash</p>
              <p className="text-lg font-semibold text-gray-800">
                {formatAmount(expectedCash)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Declared Cash</p>
              <p className="text-lg font-semibold text-gray-800">
                {formatAmount(report.cashSummary?.declaredCashOnHand || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Balance Summary */}
        <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none bg-gradient-to-r from-blue-50 to-green-50">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--p-blue)]" />
            Balance Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cash Balance */}
            <div className="bg-white rounded-lg p-6 border-2 border-green-200">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Cash Balance</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cash Sales:</span>
                  <span className="font-medium text-green-700">{formatAmount(balances.cashSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cash Payouts:</span>
                  <span className="font-medium text-red-700">{formatAmount(balances.cashPayouts)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800">Cash Balance:</span>
                    <span className={`text-lg font-bold ${
                      balances.cashBalance >= 0 ? "text-green-700" : "text-red-700"
                    }`}>
                      {formatAmount(balances.cashBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Online Balance */}
            <div className="bg-white rounded-lg p-6 border-2 border-blue-200">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Online Balance</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Online Sales:</span>
                  <span className="font-medium text-blue-700">{formatAmount(balances.onlineSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Online Payouts:</span>
                  <span className="font-medium text-red-700">{formatAmount(balances.onlinePayouts)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800">Online Balance:</span>
                    <span className={`text-lg font-bold ${
                      balances.onlineBalance >= 0 ? "text-blue-700" : "text-red-700"
                    }`}>
                      {formatAmount(balances.onlineBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collections Table */}
        {(collections.length > 0 || lateTransactionCollections > 0) && (
          <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Collections
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference / reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {collections.map((c, index) => (
                    <tr key={c._id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {c.channelSnapshot?.name || c.channelId?.name || "Unknown Channel"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {c.referenceNo || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {(c.documents || []).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleViewDocuments(c.documents)}
                            className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                          >
                            <Eye size={14} />
                            Docs ({c.documents.length})
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="font-semibold text-green-600">
                          {formatAmount(c.amount || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Late Transaction Collections */}
                  {lateTransactions
                    .filter(lt => lt.transactionType === "COLLECTION")
                    .map((lt, index) => (
                      <tr key={`late-collection-${lt._id || index}`} className="hover:bg-gray-50 bg-purple-50/30">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            {lt.channelSnapshot?.name || lt.channelId?.name || "Unknown Channel"}
                            <span className="text-xs text-purple-600 font-normal">(Late)</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {lt.reason || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {(lt.documents || []).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleViewDocuments(lt.documents)}
                              className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                            >
                              <Eye size={14} />
                              Docs ({lt.documents.length})
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {formatAmount(lt.amount || 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="bg-green-50">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-sm font-medium text-gray-700 text-right">
                      Collections Total:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 text-right">
                      {formatAmount(totalCollectedWithLate)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Supplier Payments Table */}
        {(supplierPayments.length > 0 || lateTransactionSupplierPayments > 0) && (
          <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-600" />
              Supplier Payments
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference / reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplierPayments.map((p, index) => (
                    <tr key={p._id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {p.supplierNameSnapshot || p.supplierId?.name || "Unknown Supplier"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {p.referenceNo || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {(p.documents || []).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleViewDocuments(p.documents)}
                            className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                          >
                            <Eye size={14} />
                            Docs ({p.documents.length})
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="font-semibold text-red-600">
                          {formatAmount(p.amountPaid || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Late Transaction Supplier Payments */}
                  {lateTransactions
                    .filter(lt => lt.transactionType === "SUPPLIER_PAYMENT")
                    .map((lt, index) => (
                      <tr key={`late-supplier-${lt._id || index}`} className="hover:bg-gray-50 bg-purple-50/30">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            {lt.supplierNameSnapshot || lt.supplierId?.name || "Unknown Supplier"}
                            <span className="text-xs text-purple-600 font-normal">(Late)</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {lt.reason || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {(lt.documents || []).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleViewDocuments(lt.documents)}
                              className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                            >
                              <Eye size={14} />
                              Docs ({lt.documents.length})
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {formatAmount(lt.amount || 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="bg-red-50">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-sm font-medium text-gray-700 text-right">
                      Supplier Payments Total:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                      {formatAmount(totalSupplierPaymentsWithLate)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Staff Advances Table */}
        {(staffAdvances.length > 0 || lateTransactionAdvances > 0) && (
          <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              Staff Advances
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Advance Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayStaffAdvances.map((a, index) => {
                    const advDocs = (a._sourceItems || [a]).flatMap((x) => x.documents || []);
                    const rowKey = (a._sourceItems || [a]).map((x) => x._id || x.id).join("-") || index;
                    return (
                    <tr key={rowKey} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {a.employeeNameSnapshot || a.employeeId?.fullName || "Unknown Employee"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {staffAdvancePaymentMethodLabelView(a)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {resolveStaffAdvanceTypeLabel(a)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {advDocs.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleViewDocuments(advDocs)}
                            className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                          >
                            <Eye size={14} />
                            Docs ({advDocs.length})
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="font-semibold text-amber-600">
                          {formatAmount(a.amount || 0)}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                  {/* Late Transaction Advances */}
                  {lateTransactions
                    .filter(lt => lt.transactionType === "ADVANCE")
                    .map((lt, index) => (
                      <tr key={`late-advance-${lt._id || index}`} className="hover:bg-gray-50 bg-purple-50/30">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            {lt.employeeNameSnapshot || lt.employeeId?.fullName || lt.employeeId?.displayName || "Unknown Employee"}
                            <span className="text-xs text-purple-600 font-normal">(Late)</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {staffAdvancePaymentMethodLabelView(lt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {lt.reason || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {(lt.documents || []).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleViewDocuments(lt.documents)}
                              className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                            >
                              <Eye size={14} />
                              Docs ({lt.documents.length})
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {formatAmount(lt.amount || 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="bg-amber-50">
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-sm font-medium text-gray-700 text-right">
                      Staff Advances Total:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-amber-600 text-right">
                      {formatAmount(totalStaffAdvancesWithLate)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Late Transactions Table */}
        {lateTransactions.length > 0 && (
          <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Late Transactions
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier/Employee/Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lateTransactions.map((t, index) => {
                    // Map transaction type code to display name
                    const getTransactionTypeName = (code) => {
                      const typeMap = {
                        "COLLECTION": "Collection",
                        "SUPPLIER_PAYMENT": "Supplier Payment",
                        "ADVANCE": "Advance"
                      };
                      return typeMap[code] || code || "Unknown";
                    };
                    
                    return (
                      <tr key={t._id || index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {getTransactionTypeName(t.transactionType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {t.transactionType === "SUPPLIER_PAYMENT" && (t.supplierNameSnapshot || t.supplierId?.name || "-")}
                          {t.transactionType === "ADVANCE" && (t.employeeNameSnapshot || t.employeeId?.fullName || t.employeeId?.displayName || "-")}
                          {t.transactionType === "COLLECTION" && (t.channelSnapshot?.name || t.channelId?.name || "-")}
                          {!t.transactionType && (t.channelSnapshot?.name || t.channelId?.name || "-")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {t.paymentMethodSnapshot?.name || t.paymentMethodId?.name || "-"}
                          {t.paymentMethodSnapshot?.type && (
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                              t.paymentMethodSnapshot.type === "Cash" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {t.paymentMethodSnapshot.type}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {t.reason || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {(t.documents || []).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleViewDocuments(t.documents)}
                              className="text-[var(--p-blue)] hover:underline flex items-center gap-1"
                            >
                              <Eye size={14} />
                              Docs ({t.documents.length})
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {formatAmount(t.amount || 0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Totals */}
        {(collections.length > 0 ||
          supplierPayments.length > 0 ||
          staffAdvances.length > 0 ||
          lateTransactions.length > 0) && (
          <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mb-6 print:shadow-none print:border print:rounded-none bg-gray-50">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[var(--p-blue)]" />
              Summary
            </h3>
            <div className="flex justify-around">
              <div>
                <div className="text-xs text-gray-500 mb-1">Collections Total</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatAmount(totalCollectedWithLate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Supplier Payments Total</div>
                <div className="text-lg font-semibold text-red-600">
                  {formatAmount(totalSupplierPaymentsWithLate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Staff Advances Total</div>
                <div className="text-lg font-semibold text-amber-600">
                  {formatAmount(totalStaffAdvancesWithLate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Net Total</div>
                <div className="text-lg font-semibold text-[var(--p-blue)]">
                  {formatAmount(totalCollectedWithLate - totalPaidOut)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {(report.notes || report.remarks) && (
          <div className="p-8 rounded-lg border shadow-sm font-sans text-[#303030] font-normal mt-6 print:shadow-none print:border print:rounded-none">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              Notes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg">{report.notes}</p>
                </div>
              )}
              {report.remarks && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Remarks</p>
                  <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg">{report.remarks}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Print Footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
          <div className="flex justify-between text-sm text-gray-500">
            <p>{t("dailyReports.view.printFooter.printedOn", { datetime: new Date().toLocaleString() })}</p>
            <p>{t("dailyReports.view.printFooter.reportId", { id: report._id })}</p>
          </div>
        </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 text-center mb-2">
              {t("dailyReports.view.deleteModal.title")}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              {t("dailyReports.view.deleteModal.message")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t("dailyReports.buttons.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
              >
                {deleteLoading ? t("dailyReports.buttons.deleting") : t("dailyReports.buttons.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showDocumentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{t("dailyReports.view.documentsModal.title")}</h2>
              <button
                onClick={() => {
                  setShowDocumentsModal(false);
                  setSelectedTransactionDocuments([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedTransactionDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">{t("dailyReports.view.documentsModal.empty")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedTransactionDocuments.map((doc, index) => (
                    <div
                      key={doc.fileId || index}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {doc.name || `${t("dailyReports.common.document")} ${index + 1}`}
                          </p>
                          {doc.size && (
                            <p className="text-xs text-gray-500">
                              {(doc.size / 1024).toFixed(2)} KB
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenDocument(doc.fileId)}
                          className="px-3 py-1.5 text-sm text-[var(--p-blue)] hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye size={16} />
                          {t("dailyReports.buttons.view")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}