import React, { useState } from "react";

const tabs = [
  "Employment Record",
  "Attendance",
  "Leaves",
  "Claims",
  "Documents",
  "Educational Certificates",
  "Emergency Contact",
];

const StaffTabs = () => {
  const [activeTab, setActiveTab] = useState("Employment Record");

  return (
    <div className="border-b mt-6">
      <div className="flex space-x-6 px-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`pb-2 ${
              activeTab === tab ? "border-b-2 border-lime-500 font-semibold" : "text-gray-600"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StaffTabs;
