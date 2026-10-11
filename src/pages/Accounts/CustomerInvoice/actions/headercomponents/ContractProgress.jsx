import React from "react";
import ContractStep1 from "../iconsvg/icon1.svg";
import ContractStep2 from "../iconsvg/icon2.svg";
import ContractStep3 from "../iconsvg/icon3.svg";
import ContractStep4 from "../iconsvg/icon4.svg";

const ContractProgress = ({ currentStep }) => {
  const steps = [
    { label: "Contract Issuance", icon: ContractStep1 },
    { label: "Purchases", icon: ContractStep2 },
    { label: "Shipment Preparation", icon: ContractStep3 },
    { label: "Shipped on Board", icon: ContractStep4 },
  ];

  return (
    <div className="relative flex flex-col items-center w-full pt-10 pb-4">
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute top-[35px] left-[12.5%] w-[75%] h-[8px] bg-gray-300 -translate-y-1/2 rounded-full"></div>

        <div
          className="absolute top-[35px] left-[12.5%] h-[8px] bg-[var(--p-blue)] -translate-y-1/2 rounded-full transition-all duration-300"
          style={{
            width: `${(currentStep / (steps.length - 1)) * 75}%`,
          }}
        ></div>

        {steps.map((step, index) => (
          <div
            key={index}
            className="relative flex flex-col items-center w-1/4"
          >
            <div
              className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-all z-10 ${
                index <= currentStep
                  ? "bg-[var(--p-blue)] text-white border-2 border-[var(--p-blue)]"
                  : "bg-gray-300 text-gray-500 border-2 border-gray-400"
              }`}
            >
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center w-full mt-6">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center w-1/4">
            <div className="flex items-center justify-center h-8 w-8">
              <img
                src={step.icon}
                alt={`Step ${index + 1}`}
                className={`h-6 w-6 ${
                  index <= currentStep ? "" : "opacity-50"
                }`}
              />
            </div>
            <p
              className={`text-sm mt-2 font-semibold text-center ${
                index <= currentStep ? "text-[var(--p-blue)]" : "text-gray-500"
              }`}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractProgress;
