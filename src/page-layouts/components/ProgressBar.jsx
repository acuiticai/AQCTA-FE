import React from "react";
import StepIcon1 from "@/assets/img/progress-bar/icon1.svg";
import StepIcon2 from "@/assets/img/progress-bar/icon2.svg";
import StepIcon3 from "@/assets/img/progress-bar/icon3.svg";
import StepIcon4 from "@/assets/img/progress-bar/icon4.svg";
import StepIcon5 from "@/assets/img/progress-bar/icon5.svg";

const ProgressBar = ({ currentStep, stepsType = "shipment" }) => {
  let steps = [];
  if (stepsType === "shipment") {
    steps = [
      { value: "planning", label: "Planning", icon: StepIcon1 },
      { value: "pre-shipment", label: "Pre-Shipment", icon: StepIcon2 },
      {
        value: "in-transit-origin",
        label: (
          <span>
            In-Transit <br /> (Origin)
          </span>
        ),
        icon: StepIcon3,
      },
      {
        value: "in-transit-destination",
        label: (
          <span>
            In-Transit <br /> (Destination)
          </span>
        ),
        icon: StepIcon4,
      },
      { value: "post-shipment", label: "Post-Shipment", icon: StepIcon5 },
    ];
  }

  const stepNumber = steps.findIndex((step) => step.value === currentStep);

  return (
    <div className="relative flex flex-col items-center w-full pt-10 pb-4">
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute top-[22px] left-[10%] w-[80%] h-[8px] bg-gray-300 -translate-y-1/2 rounded-full"></div>

        <div
          className={`absolute top-[${
            stepsType === "shipment" ? "22px" : "35px"
          }] left-[10%] h-[8px] bg-[var(--p-blue)] -translate-y-1/2 rounded-full transition-all duration-300`}
          style={{
            width: `${(stepNumber / (steps.length - 1)) * 80}%`,
          }}
        ></div>

        {steps.map((step, index) => (
          <div
            key={index}
            className="relative flex flex-col items-center w-1/5"
          >
            <div
              className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-all z-10 ${
                index <= stepNumber
                  ? "bg-[var(--p-blue)] text-white border-2 border-[var(--p-blue)]"
                  : "bg-gray-300 text-gray-500 border-2 border-gray-400"
              }`}
            >
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-start w-full mt-6">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center w-1/5">
            <div className="flex items-center justify-center h-8 w-8">
              <img
                src={step.icon}
                alt={`Step ${index + 1}`}
                className="h-6 w-6"
                style={{
                  filter:
                    index <= stepNumber
                      ? "invert(77%) sepia(12%) saturate(1601%) hue-rotate(36deg) brightness(97%) contrast(89%)"
                      : "none",
                }}
              />
            </div>
            <p
              className={`text-sm mt-2 font-semibold text-center  ${
                index <= stepNumber ? "text-[var(--p-blue)]" : "text-gray-500"
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

export { ProgressBar };
