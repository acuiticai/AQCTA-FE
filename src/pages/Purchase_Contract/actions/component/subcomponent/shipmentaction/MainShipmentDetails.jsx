import React from "react";
import ProgressBar from "./component/ProgressBar";
import DetailsCard from "./component/DetailCard";
import DocumentsTable from "./component/DocumentTables";
import Header from "./component/Header";

const MainShipmentDetails = () => {
  const shipmentDetails = {
    "Shipping Line": "123456",
    "Booking Confirmation Number": "365461",
    "Bill of Lading (BL) Number": "ABCD123456",
    "CTR & Seal Number": "CTS123",
    "Container Size": "20FT",
    "Total Gross Weight": "24,000 kg",
    "Total Net Weight": "20,950 kg",
  };

  const portDetails = {
    "Origin Port": "Port Klang, Malaysia",
    "Origin Vessel Name": "MMSI-735059381",
    "Origin ETD": "DEC 24",
    "Transshipment Port": "Port, Singapore",
    "Transshipment Vessel Port Name": "SSIM-735059381",
    "Transshipment ETA/ETD": "Jan 25",
    "Port of Discharge (POD)": "Karachi Seaport, Pakistan",
    "POD ETA": "Feb 25",
  };

  const freightDetails = {
    "Freight Amount (USD)": "$121209.00",
    "Warehousing Fee": "-$2323.00",
    "Insurance Fee": "-$2323.00",
    "Miscellaneous Charges": "$123872.00",
  };

  const documents = [
    {
      name: "ABC Document",
      type: "Bill of Lading",
      dateTime: "22-12-2024 / 10:44 AM",
      status: "Draft",
      highlight: true,
    },
    {
      name: "ABC Document",
      type: "Packing List",
      dateTime: "22-12-2024 / 10:44 AM",
      status: "Approved",
    },
    {
      name: "ABC Document",
      type: "Certificate of Origin",
      dateTime: "22-12-2024 / 10:44 AM",
      status: "Sent",
    },
  ];

  return (
    <div className="p-6 bg-white min-h-screen">
      <Header />

      <div className="bg-[#F2F5F9] rounded-xl p-6 shadow-md mt-6">
        <div className="flex justify-between items-start">
          <div className="text-lg font-bold">
            Shipment ID: <span className="text-[#303030]">239823984</span>
          </div>
          <div className="flex justify-end w-[600px]">
            <ProgressBar currentStep={1} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mt-6">
          <div>
            <p className="text-sm text-gray-500">Purchase Contract #</p>
            <p className="text-[#303030] font-semibold">PO2165-2156</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Vendor Name</p>
            <p className="text-[#303030] font-semibold">
              Aditya Purchase Corp.
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Purchase Contract #</p>
            <p className="text-[#303030] font-semibold">S5463-N2118</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Customer Name</p>
            <p className="text-[#303030] font-semibold">Akram Chemicals</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6 items-stretch">
        <DetailsCard title="Shipment Details" details={shipmentDetails} />
        <DetailsCard title="Ports and Vessel Details" details={portDetails} />
        <DetailsCard title="Freight Details" details={freightDetails} />
      </div>

      <DocumentsTable documents={documents} />
    </div>
  );
};

export default MainShipmentDetails;
