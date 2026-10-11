import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import { DetailRow } from "./CustomContent";
import { useLabelManagement } from "@/pages/DocumentTemplate/context/LabelContext";

function SalesHeaderDetails() {
  const {
    headerData: { date, buyerInfo, poNo },
    contractDetails,
  } = useDocumentConext();
  const { getLabel } = useLabelManagement();

  return (
    <div>
      <DetailRow
        section="headerData"
        fieldId="date"
        value={contractDetails?.createdAt || date}
        bold={true}
      />
      <div className="flex justify-between items-center mt-2">
        <DetailRow
          section="headerData"
          fieldId="buyer"
          value={contractDetails?.basicInfo?.buyerCompanyName || buyerInfo}
          bold={true}
        />
        <DetailRow
          section="headerData"
          fieldId="poNo"
          value={poNo || "SC-20"}
          bold={true}
        />
      </div>
    </div>
  );
}

export default SalesHeaderDetails;
