import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import GeneralTabs from "./right-sidebar/general-settings/general-index";
import HeaderAndFooterTabs from "./right-sidebar/header-footer/header-footer-index";
import TableFieldsEditor from "./sections/TableFieldsEditor";
import ContentTabs from "./right-sidebar/content/content-index";

const RightSidebar = () => {
  const { activeTab } = useDocumentConext();
  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralTabs />;
      case "header-footer":
        return <HeaderAndFooterTabs />;
      case "content":
        return <ContentTabs />;
      case "table":
        return <TableFieldsEditor />;
      default:
        return <div className="p-4">Select an element to view properties</div>;
    }
  };

  return (
    <div
      style={{ scrollbarWidth: "none" }}
      className="bg-gray-100 border h-full overflow-y-auto"
    >
      {renderContent()}
    </div>
  );
};

export default RightSidebar;
