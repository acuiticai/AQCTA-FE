import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import GradeAndQuantity from "./GradeAndQuantity";
import { ShippingDetails } from "./ShippingData";
import { PaymentDetails } from "./PaymentDetails";

function ContentTabs() {
  const { selectedIndex } = useDocumentConext();
  switch (selectedIndex) {
    case 0:
      return <GradeAndQuantity />;
    case 1:
      return <ShippingDetails />;
    case 2:
      return <PaymentDetails />;

    default:
      return <div className="p-4">Select an element to view properties</div>;
  }
}

export default ContentTabs;
