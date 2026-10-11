import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import React from "react";

import ProformaHeaderDetails from "../templates-custom-content/PerformaHeaderDetails";
import SalesHeaderDetails from "../templates-custom-content/SalesHeaderDetails";
import { InvoiceTitle } from "../templates-custom-content/CustomContent";
const customHeaderContent = {
  "Proforma Invoice": <ProformaHeaderDetails />,
  "Sales Contract": <SalesHeaderDetails />,
};
const TemplateHeader = () => {
  const {
    logo: brandLogo,
    headerData: { tagline },
    documentType,
  } = useDocumentConext();

  return (
    <>
      {/* Top Header Section */}
      <div className="w-full flex flex-col items-center text-center">
        {brandLogo && <img src={"/" + brandLogo.file.path} alt="brand logo" />}
        <span className="italic font-semibold">{tagline}</span>
        <div className="w-full">
          <InvoiceTitle />
        </div>
      </div>
      {customHeaderContent[documentType]}
    </>
  );
};

export default TemplateHeader;
