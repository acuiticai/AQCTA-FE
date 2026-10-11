import React from "react";
import ContractProgress from "./ContractProgress";
import ProfitabilityCard from "./ProfitabilityCard";

const ContractHeader = () => {
  return (
    <div className="bg-gray-100 p-6 rounded-lg shadow-md border">
      {/* Top Section: Contract Number & Progress */}
      <div className="flex justify-between items-start">
        {/* Left: Contract Number */}
        <h1 className="text-lg font-bold">Contract # PO24101107</h1>

        {/* Right: Step Progress */}
        <div className="w-2/3 flex justify-end">
        <ContractProgress currentStep={1} />  

        </div>
      </div>

      {/* Contract Details & Profitability Card in Bottom Section */}
      <div className="mt-6 flex justify-between items-start">
        {/* Left: Contract Details */}
        <div className="text-sm space-y-1 w-1/2">
          <p><strong>Date:</strong> December 7, 2022</p>
          <p><strong>Payment:</strong> 100% LC AT SIGHT</p>
          <p><strong>Shipping Terms:</strong> CFR Karachi, PAKISTAN</p>
          <p><strong>Packing:</strong> 1.26MTS SHRINKWRAPPED PER UNIT</p>
          <p><strong>ETD Port of Loading:</strong> EARLY - MID FEBRUARY 2024</p>
        </div>

        {/* Right: Profitability Card */}
        <div className="w-1/3 flex justify-end">
          <ProfitabilityCard />
        </div>
      </div>
    </div>
  );
};

export default ContractHeader;
