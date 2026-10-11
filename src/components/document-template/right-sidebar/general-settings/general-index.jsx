import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import BackgroundSettings from "./BackgroundSettings";
import TemplateSettingsForm from "./TemplatesSettings";

function GeneralTabs() {
  const { selectedIndex } = useDocumentConext();
  switch (selectedIndex) {
    case 0:
      return <TemplateSettingsForm />;
    case 1:
      return <BackgroundSettings />;

    default:
      return <div className="p-4">Select an element to view properties</div>;
  }
}

export default GeneralTabs;
