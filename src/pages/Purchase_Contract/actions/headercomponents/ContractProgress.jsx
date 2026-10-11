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
        {/* Background Progress Bar */}
        <div className="absolute top-[35px] left-[12.5%] w-[75%] h-[8px] bg-gray-300 -translate-y-1/2 rounded-full shadow-inner"></div>

        {/* Animated Progress Bar */}
        <div
          className="absolute top-[35px] left-[12.5%] h-[8px] bg-gradient-to-r from-[var(--p-blue)] to-[#9BC02E] -translate-y-1/2 rounded-full transition-all duration-700 ease-out shadow-lg"
          style={{
            width: `${(currentStep / (steps.length - 1)) * 75}%`,
          }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine rounded-full"></div>
        </div>

        {/* Step Circles */}
        {steps.map((step, index) => (
          <div
            key={index}
            className="relative flex flex-col items-center w-1/4 group"
          >
            <div
              className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-all duration-500 z-10 relative ${
                index <= currentStep
                  ? "bg-gradient-to-br from-[var(--p-blue)] to-[#9BC02E] text-white border-2 border-[var(--p-blue)] shadow-lg scale-110 hover:scale-125 hover:shadow-xl hover:rotate-3"
                  : "bg-gray-300 text-gray-500 border-2 border-gray-400 hover:bg-gradient-to-br hover:from-blue-400 hover:to-blue-500 hover:text-white hover:border-blue-400 hover:scale-110 hover:shadow-lg hover:rotate-3"
              }`}
            >
              {index + 1}

              {/* Pulse animation for active steps */}
              {index <= currentStep && (
                <div className="absolute inset-0 rounded-full bg-[var(--p-blue)] animate-ping opacity-20"></div>
              )}

              {/* Enhanced hover glow effect */}
              <div
                className={`absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 blur-sm ${
                  index <= currentStep
                    ? "bg-[var(--p-blue)] group-hover:opacity-30"
                    : "bg-blue-400 group-hover:opacity-40"
                }`}
              ></div>

              {/* Hover ring effect */}
              <div
                className={`absolute -inset-1 rounded-full opacity-0 transition-all duration-300 ${
                  index <= currentStep
                    ? "bg-[var(--p-blue)] group-hover:opacity-20 group-hover:scale-110"
                    : "bg-blue-400 group-hover:opacity-30 group-hover:scale-110"
                }`}
              ></div>
            </div>

            {/* Connection line glow for completed steps */}
            {index < currentStep && (
              <div className="absolute top-[35px] left-1/2 w-[75%] h-[8px] bg-[var(--p-blue)] -translate-y-1/2 rounded-full opacity-20 blur-sm"></div>
            )}
          </div>
        ))}
      </div>

      {/* Icons and Labels */}
      <div className="flex justify-between items-center w-full mt-6">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center w-1/4 group">
            <div className="flex items-center justify-center h-8 w-8 relative">
              <img
                src={step.icon}
                alt={`Step ${index + 1}`}
                className={`h-6 w-6 transition-all duration-300 ${
                  index <= currentStep
                    ? "opacity-100 scale-110 drop-shadow-lg group-hover:scale-125 group-hover:rotate-6"
                    : "opacity-50 group-hover:opacity-100 group-hover:scale-125 group-hover:rotate-6 group-hover:drop-shadow-lg"
                }`}
              />

              {/* Icon glow effect for active steps */}
              {index <= currentStep && (
                <div className="absolute inset-0 bg-[var(--p-blue)] rounded-full opacity-20 blur-sm animate-pulse group-hover:opacity-40"></div>
              )}

              {/* Hover glow for inactive icons */}
              {index > currentStep && (
                <div className="absolute inset-0 bg-blue-400 rounded-full opacity-0 blur-sm group-hover:opacity-30 transition-opacity duration-300"></div>
              )}
            </div>

            <p
              className={`text-sm mt-2 font-semibold text-center transition-all duration-300 ${
                index <= currentStep
                  ? "text-[var(--p-blue)] drop-shadow-sm group-hover:text-[#9BC02E] group-hover:scale-105"
                  : "text-gray-500 group-hover:text-blue-600 group-hover:scale-105 group-hover:font-bold"
              }`}
            >
              {step.label}
            </p>

            {/* Progress indicator dot */}
            <div
              className={`w-2 h-2 rounded-full mt-1 transition-all duration-300 ${
                index <= currentStep
                  ? "bg-[var(--p-blue)] scale-125 group-hover:scale-150 group-hover:bg-[#9BC02E]"
                  : "bg-gray-300 group-hover:bg-blue-400 group-hover:scale-125"
              }`}
            ></div>

            {/* Hover tooltip effect */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-20">
              Step {index + 1}: {step.label}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-shine {
          animation: shine 2s ease-in-out infinite;
        }

        /* Enhanced pulse animation */
        @keyframes ping {
          75%,
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .animate-ping {
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        /* Smooth hover transitions */
        .group:hover .group-hover\\:scale-105 {
          transform: scale(1.05);
        }

        .group:hover .group-hover\\:scale-110 {
          transform: scale(1.1);
        }

        .group:hover .group-hover\\:scale-125 {
          transform: scale(1.25);
        }

        .group:hover .group-hover\\:scale-150 {
          transform: scale(1.5);
        }

        .group:hover .group-hover\\:rotate-3 {
          transform: rotate(3deg);
        }

        .group:hover .group-hover\\:rotate-6 {
          transform: rotate(6deg);
        }

        /* Drop shadow effects */
        .drop-shadow-lg {
          filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04))
            drop-shadow(0 4px 3px rgb(0 0 0 / 0.1));
        }

        .drop-shadow-sm {
          filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.05));
        }

        /* Enhanced hover effects */
        .group:hover .hover\\:shadow-xl {
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 10px 10px -5px rgb(0 0 0 / 0.04);
        }
      `}</style>
    </div>
  );
};

export default ContractProgress;
