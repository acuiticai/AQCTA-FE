import React from "react";

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = ["Vendor Invoices", "Shipments", "Expenses", "Documents"];

  return (
    <div className="mt-6 border-b flex space-x-4">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`p-2 text-sm font-semibold ${activeTab === tab ? "border-b-2 border-green-500 text-green-600" : "text-gray-500"}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;
