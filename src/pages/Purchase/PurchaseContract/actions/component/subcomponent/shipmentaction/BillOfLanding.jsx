import React from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useHistory } from "react-router-dom";
import ShipmentDetails from "./sections/ShipmentDetails";
import CustomerDetails from "./sections/CustomerDetails";
import CargoDetails from "./sections/CargoDetails";
import TermsAndConditions from "./sections/TermsAndConditions";
import AdditionalInformation from "./sections/AdditionalInformation";

const BillOfLanding = () => {
  const history = useHistory();

  return (
    <div className="p-6 bg-white min-h-screen">
      <button
        onClick={() => history.goBack()}
        className="flex items-center text-gray-600 hover:text-gray-800 transition mb-4"
      >
        <FiArrowLeft className="mr-2" /> Back
      </button>

      <h1 className="text-xl font-semibold mb-4">
        RFQ # <span className="font-bold">321651</span>
      </h1>

      <div className="space-y-6">
        <ShipmentDetails />
        <CustomerDetails />
        <CargoDetails />
        <TermsAndConditions />
        <AdditionalInformation />
      </div>

      <div className="flex justify-end items-center mt-6 space-x-4">
        <button
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl"
          onClick={() => history.goBack()}
        >
          Cancel
        </button>
        <button className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-xl">
          Save Shipment
        </button>
      </div>
    </div>
  );
};

export default BillOfLanding;
