import React, { useState } from "react";
import { TrendingUp as TrendingUpIcon, ArrowLeft } from "lucide-react";
import { useHistory } from "react-router-dom";
import { PageHeader } from "@/page-layouts";
import ProfitabilityReport from "./ProfitabilityReport";

const Reporting = () => {
  const history = useHistory();
  const [selectedReportType, setSelectedReportType] = useState("");
  const [step, setStep] = useState(1); // 1: Select Report Type, 2: Show Report

  // Report types
  const reportTypes = [
    {
      id: "profitability",
      name: "Profitability Analysis",
      description: "Analyze profit margins and ROI for sales contracts",
      icon: TrendingUpIcon,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    // {
    //   id: "revenue",
    //   name: "Revenue Reports",
    //   description: "Track revenue trends and customer performance",
    //   icon: BarChart3,
    //   color: "text-blue-600",
    //   bgColor: "bg-blue-100",
    // },
    // {
    //   id: "expenses",
    //   name: "Expense Analysis",
    //   description: "Monitor expenses and cost breakdowns",
    //   icon: PieChart,
    //   color: "text-purple-600",
    //   bgColor: "bg-purple-100",
    // },
  ];

  // Step handlers
  const handleReportTypeSelect = (reportType) => {
    setSelectedReportType(reportType);
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedReportType("");
    } else {
      history.goBack();
    }
  };

  // Render report type selection
  const renderReportTypeSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Report Type
        </h2>
        <p className="text-gray-600">
          Choose the type of report you want to generate
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => {
          const IconComponent = report.icon;
          return (
            <button
              key={report.id}
              onClick={() => handleReportTypeSelect(report.id)}
              className="p-6 bg-white rounded-xl border border-gray-200 hover:border-[var(--p-blue)] hover:shadow-lg transition-all duration-200 text-left group"
            >
              <div className="flex items-center mb-4">
                <div
                  className={`w-12 h-12 ${report.bgColor} rounded-lg flex items-center justify-center mr-4`}
                >
                  <IconComponent className={`w-6 h-6 ${report.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[var(--p-blue)]">
                  {report.name}
                </h3>
              </div>
              <p className="text-gray-600 text-sm">{report.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Render selected report
  const renderSelectedReport = () => {
    switch (selectedReportType) {
      case "profitability":
        return <ProfitabilityReport onBack={handleBack} />;
      case "revenue":
        return <RevenueReport onBack={handleBack} />;
      case "expenses":
        return <ExpenseReport onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Back Button */}
      <div className="mb-6">
        <button
          className="flex items-center text-gray-600 hover:text-gray-800"
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </button>
      </div>

      {/* Page Header */}
      <PageHeader
        title="Reports"
        subtitle={
          step === 1
            ? "Select a report type to get started"
            : `Generating ${
                reportTypes.find((r) => r.id === selectedReportType)?.name
              }`
        }
      />

      {/* Content */}
      {step === 1 && renderReportTypeSelection()}
      {step === 2 && renderSelectedReport()}
    </div>
  );
};

export default Reporting;
