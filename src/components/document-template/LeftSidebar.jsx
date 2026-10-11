import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import { SettingsList } from "./leftsidebar/List";
import { useEffect } from "react";

// Component for the left sidebar content
const settingsItems = ["Template Properties", "Background"];
const headerAndFooter = ["Header", "Footer"];
const tableItems = ["Labels", "Layout"];
const otherItems = ["Document Summary", "Annexure"];
const contentItems = [
  "Grade & Quantity",
  "Shipping Details",
  "Payment Details",
];

const LeftSidebar = () => {
  const { activeTab, setActiveSubTabList } = useDocumentConext();

  // Use useEffect to perform side-effects after the render phase
  useEffect(() => {
    switch (activeTab) {
      case "general":
        setActiveSubTabList(settingsItems);
        break;
      case "header-footer":
        setActiveSubTabList(headerAndFooter);
        break;
      case "content":
        setActiveSubTabList(contentItems);
        break;
      case "table":
        setActiveSubTabList(tableItems);
        break;
      case "other":
        setActiveSubTabList(otherItems);
        break;
    }
  }, [activeTab, setActiveSubTabList]); // Run whenever activeTab changes

  return (
    <div className="bg-gray-50 border-r h-full overflow-y-auto">
      <SettingsList />
    </div>
  );
};

export default LeftSidebar;
