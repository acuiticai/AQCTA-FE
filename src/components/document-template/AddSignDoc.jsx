import HeaderTab from "./HeaderTab";
import LeftSidebar from "./LeftSidebar";
import MainEditor from "./SignContractPage";
import RightSidebar from "./RightSidebar";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";

function CreateDocTemplate() {
  const {
    documentType,
    templateName,
    logo,
    tableFields,
    tableValues,
    termsEditorState,
    paymentEditorState,
    signees,
    headerData,
    contractDetails,
  } = useDocumentConext();
  return (
    <div className="flex flex-col h-screen">
      {/* Header remains at the top */}
      {!contractDetails && (
        <HeaderTab />
      )}

      {/* Main content area: left sidebar, main editor, right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: smaller width */}
        <div className="flex-none basis-[15%] min-w-[150px] overflow-auto">
          {!contractDetails && (
            <LeftSidebar />
          )}
        </div>

        {/* Main Editor: fills remaining space */}
        <div
          style={{ scrollbarWidth: "none" }}
          className="flex-auto overflow-x-auto"
        >
          <MainEditor
            documentType={documentType}
            templateName={templateName}
            logo={logo}
            tableFields={tableFields}
            tableValues={tableValues}
            termsEditorState={termsEditorState}
            paymentEditorState={paymentEditorState}
            signees={signees}
            headerData={headerData}
          />
        </div>

        {/* Right Sidebar: wider */}
        <div className="flex-none basis-[25%] min-w-[200px] overflow-auto">
          {!contractDetails && (
            <RightSidebar />
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateDocTemplate;
