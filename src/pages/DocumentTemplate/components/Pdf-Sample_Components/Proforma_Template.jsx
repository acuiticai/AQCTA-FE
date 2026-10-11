import React, { useRef, useState } from "react";
import { Paper } from "@mui/material";
import { useReactToPrint } from "react-to-print";
import CustomToolbar from "./Toolbar";
import PaymentAccountInfo, {
  ItemListDocumentSection,
} from "../templates-subcomponents/PaymentSectionProforma";
import TermsAndConditions from "../templates-subcomponents/TermsAndCondition";
import {
  columns,
  shippingDetails,
  tableFooter,
  terms,
} from "../../data/data-index";
import DynamicTable from "../templates-subcomponents/TableDynamic";
import DynamicHeader from "../templates-subcomponents/DynamicHeader";

const ProformaInvoice = ({
  logo,
  tableFields,
  tableValues,
  documentType,
  headerData,
  termsEditorState,
  paymentEditorState,
  signees,
}) => {
  const [zoom, setZoom] = useState(90);
  const contactInfo = {
    tel: "",
    fax: "",
    address: "",
  };
  const tableColumns = tableFields.map((field) => field.name);

  const tableData = tableValues.map((row) =>
    tableFields.map((field) => row.values[field.id])
  );
  // Create a ref for the Paper component.
  const paperRef = useRef();

  // Define the print function using react-to-print.
  const handlePrint = useReactToPrint({
    content: () => paperRef.current,
    documentTitle: "ProformaInvoice",
    // Optional: you can add more options here (e.g., onAfterPrint callback)
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar (will be hidden in print thanks to .no-print CSS) */}
      <CustomToolbar zoom={zoom} onZoom={setZoom} onPrint={handlePrint} />

      {/* Document Preview */}
      <div
        style={{ scrollbarWidth: "none" }}
        className="flex-1 overflow-auto bg-gray-100 p-8"
      >
        <Paper
          ref={paperRef}
          elevation={2}
          className="mx-auto font-mono text-black"
          style={{
            width: `${9.5 * zoom}px`,
            minHeight: `${11 * zoom}px`,
            padding: "0.5in", // Reduced padding for less gap
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
          }}
        >
          <DynamicHeader
            brandLogo={logo}
            invoiceTitle={documentType}
            {...headerData}
          />

          {/* Table Section */}
          <DynamicTable
            columns={tableColumns}
            tableData={tableData}
            {...tableFooter}
          />

          {/* Bank Details */}
          <PaymentAccountInfo title="PLEASE MAKE THE PAYMENT TO BELOW ACCOUNT INFO" />

          {/* Terms and Conditions */}
          <TermsAndConditions terms={terms} />
          <TermsAndConditions sectionTitle="Remarks" />

          {/* Footer Section */}
          <div className="mx-5 mb-2">
            <ItemListDocumentSection details={shippingDetails} />
          </div>

          <div className="mb-3">
            <p className="text-sm">
              Its is hereby certified that this invoice shows the actual price
              of the goods described, that no other invoice has been or will be
              issued, and that all particulars are true and correct.
            </p>
          </div>

          {/* Computer Generated Note */}
          <div className="mt-3 w-full flex flex-col font-semibold items-center text-sm text-center">
            <p>This is a computer generated. No signature is required.</p>
            <p>{contactInfo.address}</p>
            <div className="flex">
              <span>Tel : {contactInfo.tel}</span>
              <span className="mx-4">Fax : {contactInfo.fax}</span>
            </div>
          </div>
        </Paper>
      </div>
    </div>
  );
};

export default ProformaInvoice;
