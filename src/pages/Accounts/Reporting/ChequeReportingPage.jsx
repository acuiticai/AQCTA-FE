import React from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/page-layouts";
import { makeChequeReportsT } from "@/utils/chequeI18n";
import ChequeReports from "./ChequeReports";

/** Standalone cheque reports screen at `/cheque_reporting` (module-driven nav). */
const ChequeReportingPage = () => {
  const { t } = useTranslation();
  const cr = makeChequeReportsT(t);

  return (
    <div className="p-6 bg-white min-h-screen dark:bg-gray-900">
      <PageHeader
        variant="large"
        title={cr("title", "Cheque reports")}
        description={cr(
          "description",
          "Upcoming, vendor-wise, bank-wise, cleared, bounced, and pending liability reports",
        )}
      />
      <div className="mt-6">
        <ChequeReports />
      </div>
    </div>
  );
};

export default ChequeReportingPage;
