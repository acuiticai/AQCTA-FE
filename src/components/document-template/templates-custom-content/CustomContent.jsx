import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import { useLabelManagement } from "@/pages/DocumentTemplate/context/LabelContext";
import { LabelEditor } from "../right-sidebar/content/LabelsUpdate";
import React, { useEffect } from "react";

// Title Component
export const InvoiceTitle = () => {
  const {
    documentType,
    headerData: { invoiceNumber },
    contractDetails,
  } = useDocumentConext();
  const { getLabel, updateLabel } = useLabelManagement();

  const handleLabelUpdate = (newLabel) => {
    updateLabel("headerData", "Proforma Invoice", newLabel);
  };

  useEffect(() => {
    if (contractDetails?.basicInfo?.typeOfSaleContract)
      updateLabel(
        "headerData",
        "documentType",
        contractDetails?.basicInfo?.typeOfSaleContract
      );
  }, [contractDetails]);

  return (
    <div className="flex font-bold text-[14px] items-baseline gap-x-5 mt-1">
      <div className="flex items-center">
        <LabelEditor
          section="headerData"
          fieldId="documentType"
          currentLabel={getLabel("headerData", "documentType")}
          onUpdate={handleLabelUpdate}
        />
        <span>:</span>
        <span className="ml-5">{contractDetails?.contractNo}</span>
      </div>
      <p>{invoiceNumber}</p>
    </div>
  );
};

// Updated Buyer Info Component
export const BuyerInfo = () => {
  const {
    headerData: { buyerInfo },
  } = useDocumentConext();
  const { getLabel, updateLabel } = useLabelManagement();

  const handleLabelUpdate = (newLabel) => {
    updateLabel("headerData", "buyer", newLabel);
  };

  return (
    <div className="flex gap-2 items-center  text-[12px] font-bold mb-3">
      <LabelEditor
        section="headerData"
        fieldId="buyer"
        currentLabel={getLabel("headerData", "buyer")}
        onUpdate={handleLabelUpdate}
      />
      <span>:</span>
      <p className="w-72 uppercase ">{buyerInfo}</p>
    </div>
  );
};

// Contract Details Component
export const ContractDetails = () => {
  const {
    headerData: { contractNo, poNo, intermediate },
  } = useDocumentConext();

  return (
    <div className="flex flex-col w-max">
      <DetailRow fieldId="contractNo" value={contractNo} />
      <DetailRow fieldId="poNo" value={poNo} />
      <DetailRow fieldId="intermediate" value={intermediate} />
    </div>
  );
};

// Date and Terms Component
export const DateAndTerms = () => {
  const {
    headerData: { date, terms },
  } = useDocumentConext();

  return (
    <div className="grid grid-cols-2 gap-x-8 text-[12px] mb-3">
      <div className="space-y-1">
        <DetailRow fieldId="date" value={date} width="w-24" />
        <DetailRow fieldId="terms" value={terms} width="w-24" />
      </div>
    </div>
  );
};

// Enhanced DetailRow Component
export const DetailRow = ({
  fieldId,
  value,
  width = "w-32",
  bold = false,
  section = "headerData",
}) => {
  const { getLabel, updateLabel } = useLabelManagement();

  const handleLabelUpdate = (newLabel) => {
    updateLabel(section, fieldId, newLabel);
  };

  return (
    <div className="flex items-center">
      <div className={`flex justify-between ${width}`}>
        <LabelEditor
          section={section}
          fieldId={fieldId}
          currentLabel={getLabel(section, fieldId)}
          onUpdate={handleLabelUpdate}
        />
        <span className="font-bold">:</span>
      </div>
      <span
        className={`${bold ? "font-bold" : ""} w-72 uppercase text-[12px] ml-2`}
      >
        {value}
      </span>
    </div>
  );
};
