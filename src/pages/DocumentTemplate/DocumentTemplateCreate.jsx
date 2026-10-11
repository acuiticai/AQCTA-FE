import { LabelManagementProvider } from "./context/LabelContext";
import { DocumentTemplateProvider } from "./DocumentContext";
import CreateDocTemplate from "@/components/document-template/CreateDocTemplate";

const DocumentTemplateCreate = () => {
  return (
    <LabelManagementProvider>
      <DocumentTemplateProvider>
        <CreateDocTemplate />
      </DocumentTemplateProvider>
    </LabelManagementProvider>
  );
};
export default DocumentTemplateCreate;
