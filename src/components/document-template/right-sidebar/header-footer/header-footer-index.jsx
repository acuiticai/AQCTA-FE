import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import FooterRightBar from "./Footer";
import HeaderRightBar from "./Header";

function HeaderAndFooterTabs() {
  const { selectedIndex } = useDocumentConext();

  switch (selectedIndex) {
    case 0:
      return <HeaderRightBar />;
    case 1:
      return <FooterRightBar />;

    default:
      return <div className="p-4">Select an element to view properties</div>;
  }
}

export default HeaderAndFooterTabs;
