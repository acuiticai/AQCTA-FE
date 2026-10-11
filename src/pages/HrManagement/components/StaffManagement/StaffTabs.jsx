import React from "react";

const tabs = ["Personal Info", "Employment Details", "Contact Information", "Job Details"];

const StaffTabs = ({ activeTab, setActiveTab }) => {
  return (
    <div className="border-b border-gray-200 flex px-4">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`py-2 px-4 ${
            activeTab === tab ? "text-lime-500 border-b-2 border-lime-500" : "text-gray-600"
          }`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default StaffTabs;
