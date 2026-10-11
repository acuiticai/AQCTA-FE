import jsPDF from "jspdf";
import { formatDate, formatCurrencyAmount } from "@/components/formatAmount";

/**
 * Client-side payment receipt PDF — same data as Customer Payments / invoice payment rows.
 */
export function downloadCustomerPaymentReceiptPdf({
  invoice,
  payment,
  paymentIndex = 0,
}) {
  const invNo =
    invoice?.invoice_number ||
    payment?.invoice_number ||
    "—";
  const customerName =
    invoice?.customer_name ||
    payment?.customer_id?.basicInformation?.customerDisplayName ||
    payment?.customer_id?.basicInformation?.companyName ||
    "—";
  const currency =
    payment?.currency ||
    payment?.paymentCurrency ||
    invoice?.currency ||
    "USD";
  const amountRaw =
    payment?.allocatedAmount ??
    payment?.amount ??
    payment?.amountInInvoiceCurrency ??
    0;
  const amountLabel = formatCurrencyAmount(currency, Number(amountRaw) || 0);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Receipt", margin, y);
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const rows = [
    ["Payment #", payment?.paymentNumber || `(${paymentIndex + 1})`],
    ["Invoice #", invNo],
    ["Customer", customerName],
    [
      "Payment date",
      payment?.paymentDate ? formatDate(payment.paymentDate) : "—",
    ],
    ["Payment mode", payment?.paymentMode || "—"],
    ["Amount", amountLabel],
    ["Reference", payment?.reference || "—"],
  ];

  const dep = payment?.depositTo;
  if (dep && typeof dep === "object") {
    rows.push(["Deposited to", dep.accountName || "—"]);
    if (dep.bankName) rows.push(["Bank", dep.bankName]);
  } else if (typeof dep === "string" && dep) {
    rows.push(["Deposited to", dep]);
  }

  rows.forEach(([label, value]) => {
    const labelText = `${label}:`;
    doc.setFont("helvetica", "bold");
    doc.text(labelText, margin, y);
    doc.setFont("helvetica", "normal");
    const valueX = margin + 140;
    const lines = doc.splitTextToSize(String(value || "—"), 380);
    doc.text(lines, valueX, y);
    y += Math.max(18, lines.length * 14);
  });

  if (payment?.notes) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(String(payment.notes), 500);
    doc.text(noteLines, margin, y);
  }

  const safeFile =
    (payment?.paymentNumber || `payment-${payment?._id || paymentIndex}`)
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, "_") || "receipt";
  doc.save(`Payment-Receipt-${safeFile}.pdf`);
}

/**
 * Client-side vendor payment voucher — used when HTML template rendering is unavailable.
 */
export function downloadVendorPaymentReceiptPdf({
  invoice,
  payment,
  paymentIndex = 0,
}) {
  const invNo =
    invoice?.invoice_number || payment?.invoice_number || "—";
  const vendorName =
    payment?.vendor_id?.basicInformation?.vendorDisplayName ||
    payment?.vendor_id?.basicInformation?.companyName ||
    invoice?.vendor?.basicInformation?.vendorDisplayName ||
    invoice?.vendor?.basicInformation?.companyName ||
    "—";
  const currency =
    payment?.currency || invoice?.currency || "USD";

  const payNo =
    (payment?.paymentNumber || payment?.vendorPaymentNumber || "")
      .toString()
      .trim() || "";

  const amountRaw = payment?.amount ?? 0;
  const amountLabel = formatCurrencyAmount(currency, Number(amountRaw) || 0);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Payment receipt (vendor)", margin, y);
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const rows = [
    ["Vendor payment #", payNo || `(${paymentIndex + 1})`],
    ["Invoice #", invNo],
    ["Vendor / payee", vendorName],
    [
      "Payment date",
      payment?.paymentDate || payment?.date
        ? formatDate(payment.paymentDate || payment.date)
        : "—",
    ],
    ["Payment mode", payment?.paymentMode || "Bank Transfer"],
    ["Amount", amountLabel],
    ["Reference", payment?.reference || "—"],
  ];

  const dep = payment?.bankAccount;
  if (dep && typeof dep === "object") {
    rows.push(["Paid from account", dep.accountName || "—"]);
    if (dep.bankName) rows.push(["Bank", dep.bankName]);
  }

  rows.forEach(([label, value]) => {
    const labelText = `${label}:`;
    doc.setFont("helvetica", "bold");
    doc.text(labelText, margin, y);
    doc.setFont("helvetica", "normal");
    const valueX = margin + 180;
    const lines = doc.splitTextToSize(String(value || "—"), 340);
    doc.text(lines, valueX, y);
    y += Math.max(18, lines.length * 14);
  });

  if (payment?.notes) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(String(payment.notes), 500);
    doc.text(noteLines, margin, y);
  }

  const safeFile =
    (payNo || payment?._id || `payment-${paymentIndex}`)
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, "_") || "receipt";
  doc.save(`Vendor-Payment-${safeFile}.pdf`);
}
