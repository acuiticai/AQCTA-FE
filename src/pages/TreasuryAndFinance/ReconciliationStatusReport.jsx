import React, { useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { FiDownload, FiFileText } from "react-icons/fi";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { PageHeader, BackButton } from "@/page-layouts/index";
import { formatAmount, formatDate } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";

/**
 * Works down from the balance in the books to the balance at the bank. Uncleared
 * items are listed individually rather than only totalled, because that is the
 * detail an auditor asks for when the two figures disagree.
 */
const ReconciliationStatusReport = () => {
  const { accountId, id } = useParams();
  const history = useHistory();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await BankReconciliationServices.getStatusReport(id);
      setData(res);
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Unable to build the status report"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const report = data?.report;
  const reconciliation = data?.reconciliation;
  const account = reconciliation?.bankAccount;
  const currency = report?.currency || "";

  const accountLabel = account
    ? `${account.accountName}${account.accountNumber ? ` · ${account.accountNumber}` : ""}`
    : "";

  /**
   * Export filenames are built from the ISO date rather than the configured
   * display format. Several of those formats contain slashes, and all of them
   * vary per business, so deriving a filename from them produced a different —
   * and occasionally filesystem-hostile — name depending on who exported it.
   * Anything Windows rejects is stripped as a backstop.
   */
  const exportName = (extension) => {
    const iso = new Date(reconciliation.endDate).toISOString().slice(0, 10);
    const accountName = (accountLabel || "account").split("·")[0].trim();
    return `reconciliation-status-${accountName}-${iso}.${extension}`
      .replace(/[<>:"/\\|?*]/g, "") // characters Windows refuses in a filename
      .replace(/\s+/g, "-");
  };

  /**
   * jsPDF and SheetJS both write the file synchronously via a blob download. If
   * that throws — an oversized report, a blocked download — the click otherwise
   * appears to do nothing at all, which reads as a broken button.
   */
  const runExport = (fn, label) => {
    try {
      fn();
    } catch (error) {
      console.error(`${label} export failed:`, error);
      notifyError(`Could not generate the ${label} file. Please try again.`);
    }
  };

  const exportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Bank Reconciliation Status Report", 14, 18);
    doc.setFontSize(10);
    doc.text(accountLabel, 14, 25);
    doc.text(
      `Period: ${formatDate(reconciliation.startDate)} to ${formatDate(
        reconciliation.endDate
      )}`,
      14,
      31
    );

    const body = [
      ["Balance as per books", `${currency} ${formatAmount(report.bookBalance)}`],
      [
        `Add: withdrawals not yet cleared (${report.unclearedWithdrawals.length})`,
        `${currency} ${formatAmount(report.withdrawalsTotal)}`,
      ],
      [
        `Less: deposits not yet credited (${report.unclearedDeposits.length})`,
        `${currency} ${formatAmount(report.depositsTotal)}`,
      ],
      ["Balance as per bank statement", `${currency} ${formatAmount(report.bankBalance)}`],
    ];

    doc.autoTable({
      startY: 38,
      head: [["Description", "Amount"]],
      body,
      theme: "grid",
      // Brand primary, --p-blue in custom.css (it is orange, despite the name).
      headStyles: { fillColor: [242, 144, 16] },
      columnStyles: { 1: { halign: "right" } },
    });

    const detail = (title, rows) => {
      if (!rows.length) return;
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 8,
        head: [[title, "Date", "Reference", "Age (days)", "Amount"]],
        body: rows.map((r) => [
          r.description || "",
          formatDate(r.date),
          r.reference || "",
          r.ageDays != null ? String(r.ageDays) : "",
          formatAmount(r.amount),
        ]),
        theme: "striped",
        headStyles: { fillColor: [109, 110, 115] }, // --p-gray
        styles: { fontSize: 8 },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
      });
    };

    detail("Uncleared withdrawals", report.unclearedWithdrawals);
    detail("Uncleared deposits", report.unclearedDeposits);

    doc.save(exportName("pdf"));
  };

  const exportExcel = () => {
    if (!report) return;

    const summary = [
      ["Bank Reconciliation Status Report"],
      ["Account", accountLabel],
      [
        "Period",
        `${formatDate(reconciliation.startDate)} to ${formatDate(reconciliation.endDate)}`,
      ],
      [],
      ["Description", `Amount (${currency})`],
      ["Balance as per books", report.bookBalance],
      ["Add: withdrawals not yet cleared", report.withdrawalsTotal],
      ["Less: deposits not yet credited", report.depositsTotal],
      ["Balance as per bank statement", report.bankBalance],
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(summary),
      "Summary"
    );

    const detailRows = (rows, label) =>
      rows.map((r) => ({
        Type: label,
        Date: formatDate(r.date),
        Description: r.description || "",
        Reference: r.reference || "",
        "Age (days)": r.ageDays != null ? r.ageDays : "",
        Amount: r.amount,
      }));

    const details = [
      ...detailRows(report.unclearedWithdrawals, "Uncleared withdrawal"),
      ...detailRows(report.unclearedDeposits, "Uncleared deposit"),
    ];

    if (details.length) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(details),
        "Uncleared Items"
      );
    }

    XLSX.writeFile(workbook, exportName("xlsx"));
  };

  if (loading) {
    return (
      <div className="py-6 px-6 text-center text-gray-400">Building report...</div>
    );
  }

  if (!report) {
    return (
      <div className="py-6 px-6 text-center text-gray-500">
        This report could not be built.
      </div>
    );
  }

  const Line = ({ label, value, sub, strong }) => (
    <div
      className={`flex items-start justify-between py-3 border-b last:border-0 ${
        strong ? "font-semibold text-gray-900" : "text-gray-700"
      }`}
    >
      <div>
        <span className="text-sm">{label}</span>
        {sub && <span className="block text-xs text-gray-400">{sub}</span>}
      </div>
      <span className="text-sm whitespace-nowrap">
        {currency} {formatAmount(value)}
      </span>
    </div>
  );

  return (
    <div className="py-6 px-4 sm:px-6 min-h-screen">
      <BackButton
        onClick={() =>
          history.push(`/bank-management/${accountId}/reconciliations`)
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Reconciliation Status Report"
          description={`${accountLabel} · as of ${formatDate(report.asOf)}`}
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => runExport(exportPdf, "PDF")}
            className="flex items-center gap-2 h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            <FiFileText size={16} /> PDF
          </button>
          <button
            type="button"
            onClick={() => runExport(exportExcel, "Excel")}
            className="flex items-center gap-2 h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            <FiDownload size={16} /> Excel
          </button>
        </div>
      </div>

      <div className="mt-8 bg-[#F9F9FA] rounded-lg p-6 max-w-3xl">
        <Line label="Balance as per PCI books" value={report.bookBalance} strong />
        <Line
          label="Add: withdrawals recorded but not yet cleared by the bank"
          sub={`${report.unclearedWithdrawals.length} item(s) — typically unpresented cheques`}
          value={report.withdrawalsTotal}
        />
        <Line
          label="Less: deposits recorded but not yet credited by the bank"
          sub={`${report.unclearedDeposits.length} item(s)`}
          value={report.depositsTotal}
        />
        <Line
          label="Balance as per bank statement"
          value={report.bankBalance}
          strong
        />
      </div>

      {[
        { title: "Uncleared withdrawals", rows: report.unclearedWithdrawals },
        { title: "Uncleared deposits", rows: report.unclearedDeposits },
      ].map(
        ({ title, rows }) =>
          rows.length > 0 && (
            <div key={title} className="mt-8 max-w-3xl overflow-x-auto">
              <p className="mb-2 text-sm font-medium text-gray-700">{title}</p>
              <table className="bg-white text-sm border-collapse table-auto w-full min-w-[560px]">
                <thead>
                  <tr
                    className="bg-gray-100 text-gray-600"
                    style={{ backgroundColor: "#F2F2F2" }}
                  >
                    {["Date", "Description", "Reference", "Age", "Amount"].map((header) => (
                      <th
                        key={header}
                        className="py-2 px-4 font-medium"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: "400",
                          textAlign: "left",
                          fontSize: "12px",
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontSize: "12px" }}>
                  {rows.map((row) => (
                    <tr key={row._id} className="border-t border-gray-100">
                      <td className="py-3 px-4">{formatDate(row.date)}</td>
                      <td className="py-3 px-4">{row.description}</td>
                      <td className="py-3 px-4 text-gray-400">{row.reference}</td>
                      <td className="py-3 px-4">
                        {row.ageDays != null ? (
                          <span
                            className={
                              row.ageDays > 60
                                ? "text-amber-600 font-medium"
                                : "text-gray-500"
                            }
                          >
                            {row.ageDays}d
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {currency} {formatAmount(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
};

export default ReconciliationStatusReport;
