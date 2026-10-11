import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import ContractHeader from "./headercomponents/ContractHeader";
import TabNavigation from "./headercomponents/TabNavigation";
import InvoicesTable from "./headercomponents/InvoicesTable";
import ShipmentsTable from "./component/subcomponent/ShipmentsTable";
import ExpensesTable from "./component/ExpensesTable";
import DocumentsTable from "./component/DocumentsTable";

const ContractDetails = () => {
  const [activeTab, setActiveTab] = useState("Vendor Invoices");
  const history = useHistory();

  return (
    <div className="p-6 bg-white min-h-screen">
      <button
        className="flex items-center text-gray-600 mb-4"
        onClick={() => history.goBack()}
      >
        <FiArrowLeft className="mr-2" /> Back
      </button>

      <ContractHeader />

      <div className="mt-6">
        <div className="flex border-b border-gray-200">
          {["Vendor Invoices", "Shipments", "Expenses", "Documents"].map(
            (tab) => (
              <button
                key={tab}
                className={`p-3 px-5 cursor-pointer border-b-4 border-transparent transition-all duration-200 ${
                  activeTab === tab
                    ? "border-[var(--p-blue)] text-[var(--p-blue)] font-bold"
                    : "text-gray-600"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            )
          )}
        </div>

        <div className="mt-6">
          {activeTab === "Vendor Invoices" && <InvoicesTable />}
          {activeTab === "Shipments" && <ShipmentsTable />}
          {activeTab === "Expenses" && <ExpensesTable />}
          {activeTab === "Documents" && <DocumentsTable />}
        </div>
      </div>
    </div>
  );
};

export default ContractDetails;
