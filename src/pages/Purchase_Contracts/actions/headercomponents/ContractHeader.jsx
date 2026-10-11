import React from "react";
import ContractProgress from "./ContractProgress";
import ProfitabilityCard from "./ProfitabilityCard";
import moment from "moment";
import { formatAmount } from "@/components/formatAmount";
import DOMPurify from 'dompurify';

const ContractHeader = ({ Data }) => {
  return (
    <div className="bg-gray-100 p-6 rounded-lg shadow-md border">
      {/* Top Section: Contract Number & Progress */}
      <div className="flex justify-between items-start">
        {/* Left: Contract Number */}
        <h1 className="text-lg font-bold">Contract # {Data?.contractNo || "N/A"}</h1>

        {/* Right: Step Progress */}
        <div className="w-2/3 flex justify-end">
          <ContractProgress currentStep={0} />
        </div>
      </div>

      {/* Contract Details & Profitability Card in Bottom Section */}
      <div className="mt-6 flex flex-wrap justify-between items-start">
        {/* Left: Contract Details */}
        <div className="text-sm space-y-1 w-full sm:w-1/2">
          <p>
            <strong>Date:</strong> {moment(Data?.createdAt).format("MMMM DD, YYYY")}
          </p>
          <p>
            <strong>Payment:</strong>{" "}
            <span
              style={{ whiteSpace: "pre-wrap" }} // ✅ Preserves spaces, newlines, and formatting
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(Data.productInfo?.[0]?.paymentTerms || "N/A")
              }}
            />
          </p>

          <p>
            <strong>Shipping Terms:</strong>{" "}
            <span
              style={{ whiteSpace: "pre-wrap" }} // ✅ Ensures no whitespace removal
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(Data.productInfo?.[0]?.shippingTerms || "N/A") }}
            />
          </p>

          <p>
            <strong>Packing:</strong> {Data.productInfo?.[0]?.packing || "N/A"}
          </p>
          <p>
            <strong>ETD Port of Loading:</strong> {moment(Data.productInfo?.[0]?.ETD_Port_of_Loading).format("MMM YYYY") || "N/A"}
          </p>
        </div>

        {/* Right: Profitability Card */}
        <div className="w-full sm:w-1/3 flex justify-end">
          <ProfitabilityCard Data={Data} />
        </div>
      </div>
    </div>
  );
};

export default ContractHeader;
