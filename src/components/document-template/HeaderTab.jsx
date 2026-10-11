import React from "react";
import { actionButtons, tabs } from "@/data/data-document-templates";
import { Link } from "react-router-dom";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";

// Custom Tab Button Component
const TabButton = ({ isActive, onClick, children, Icon, className = "" }) => (
  <button
    onClick={onClick}
    className={`flex items-center text-sm px-4 py-2 space-x-2 rounded-[5px] transition-all duration-200 ${
      isActive
        ? "bg-[#a6d328] text-white shadow-sm"
        : "text-black hover:bg-white/10"
    } ${className}`}
  >
    {Icon && <Icon className="w-5 h-5" />}
    <span>{children}</span>
  </button>
);

// Main Header Component
const HeaderTab = () => {
  const {
    activeTab,
    setActiveTab,
    saveTemplate,
    handleSubmit,
    contractDetails,
  } = useDocumentConext();

  return (
    <div className="w-full bg-white p-3 text-sm ">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              Icon={tab.icon}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <button className="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-300 bg-white/90 rounded-lg transition-colors">
              <Link to={contractDetails ? "/sales" : "/document-templates"}>
                Cancel
              </Link>
            </button>
            {!contractDetails && (
              <button
                className="px-4 py-2 text-white bg-[#a6d328] border-2 border-white rounded-xl hover:bg-[#8BB021] transition-colors"
                onClick={handleSubmit(saveTemplate)}
              >
                Save
              </button>
            )}{" "}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderTab;
