import React from "react";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined"; // List Item Component
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
const ListItem = ({ text, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
        isSelected ? "bg-lime-400 text-white" : "hover:bg-gray-100"
      }`}
    >
      <span className="text-sm">{text}</span>
      <ChevronRightOutlinedIcon className="text-sm" />
    </div>
  );
};

// Main List Component
export const SettingsList = () => {
  const { activeSubTabList, selectedIndex, setSelectedIndex } =
    useDocumentConext();
  return (
    <div className="w-full max-w-md border rounded-lg overflow-hidden shadow-sm">
      {activeSubTabList.map((item, index) => (
        <React.Fragment key={index}>
          <ListItem
            text={item}
            isSelected={selectedIndex === index}
            onClick={() => setSelectedIndex(index)}
          />
          {index < activeSubTabList.length - 1 && (
            <div className="h-px bg-gray-200" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
