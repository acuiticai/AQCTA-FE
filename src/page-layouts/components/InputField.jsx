import React, { useState } from "react";

const InputField = ({
  className,
  showErrorText = true,
  theme = "gray",
  inActive = false,
  autoPopulate = false,
  infoTooltip = null,
  ...inputProps
}) => {
  console.debug({ inputProps });
  const [showTooltip, setShowTooltip] = useState(false);

  // Prevent mouse wheel from changing number input values
  const handleWheel = (e) => {
    if (inputProps.type === "number") {
      e.target.blur(); // Remove focus to prevent scroll changes
    }
  };

  const handleFocus = (e) => {
    if (inputProps.type === "number") {
      // Add event listener when input is focused
      const preventScroll = (event) => {
        event.preventDefault();
      };
      e.target.addEventListener("wheel", preventScroll, { passive: false });

      // Store the listener so we can remove it later
      e.target._preventScroll = preventScroll;
    }

    // Call original onFocus if provided
    if (inputProps.onFocus) {
      inputProps.onFocus(e);
    }
  };

  const handleBlur = (e) => {
    if (inputProps.type === "number" && e.target._preventScroll) {
      // Remove event listener when input loses focus
      e.target.removeEventListener("wheel", e.target._preventScroll);
      delete e.target._preventScroll;
    }

    // Call original onBlur if provided
    if (inputProps.onBlur) {
      inputProps.onBlur(e);
    }
  };

  // Handle keyboard navigation for month inputs to prevent going below min
  const handleKeyDown = (e) => {
    // For month inputs with min attribute, prevent navigation below minimum
    if (inputProps.type === "month" && inputProps.min) {
      const currentValue = e.target.value;
      const minValue = inputProps.min;

      // If there's a current value, check if arrow keys would go below min
      if (currentValue) {
        // Arrow down or Page Down - going to previous month/year
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          const currentDate = new Date(currentValue + "-01");
          const minDate = new Date(minValue + "-01");

          // If current value is already at or very close to min, prevent going down
          if (currentDate <= minDate) {
            e.preventDefault();
            // Reset to min value if already at or below
            if (e.target.value < minValue) {
              e.target.value = minValue;
              if (inputProps.onChange) {
                inputProps.onChange({
                  target: { name: inputProps.name, value: minValue },
                });
              }
            }
            return;
          }

          // Check if going down one month would go below min
          const nextMonth = new Date(currentDate);
          nextMonth.setMonth(nextMonth.getMonth() - 1);

          if (nextMonth < minDate) {
            e.preventDefault();
            return;
          }
        }
      } else {
        // If no value and trying to go down, prevent it
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          e.preventDefault();
          return;
        }
      }
    }

    // Call original onKeyDown if provided
    if (inputProps.onKeyDown) {
      inputProps.onKeyDown(e);
    }
  };

  // Handle input change for month inputs to validate against min
  const handleInput = (e) => {
    // For month inputs with min attribute, validate the value
    if (inputProps.type === "month" && inputProps.min) {
      const newValue = e.target.value;
      const minValue = inputProps.min;

      // If the new value is below min, reset to min
      if (newValue && newValue < minValue) {
        e.target.value = minValue;
        if (inputProps.onChange) {
          inputProps.onChange({
            target: { name: inputProps.name, value: minValue },
          });
        }
        return;
      }
    }

    // Call original onInput if provided
    if (inputProps.onInput) {
      inputProps.onInput(e);
    }
  };

  const isInvoiceTheme = theme === "invoice";
  const showError = inputProps.error && inputProps.shouldShowError;

  const baseInputClasses = isInvoiceTheme
    ? "border border-gray-300 bg-white text-sm py-2.5 px-3 rounded-lg shadow-none focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
    : `border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 rounded-[12px] shadow-sm px-[16px] py-[8px] ${
        theme === "light" ? "transparent" : "bg-gray-100"
      }`;

  const coreClasses = showError
    ? `${baseInputClasses} border-red-500 focus:ring-red-500 focus:border-red-500`
    : baseInputClasses;

  return (
    <div className="relative">
      <input
        {...inputProps}
        autoFocus={false}
        onWheel={handleWheel}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className={`w-full ${coreClasses} ${className} ${
          inActive &&
          "pointer-events-none text-p-blue-dark placeholder:text-p-blue-light-2"
        }`}
      />

      {/* Info Tooltip */}
      {infoTooltip && (
        <div className="absolute top-2 right-2">
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <svg
              className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>

            {/* Tooltip Content */}
            {showTooltip && (
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-50">
                <div className="whitespace-pre-wrap">{infoTooltip}</div>
                {/* Tooltip Arrow */}
                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {inputProps.error && inputProps.shouldShowError && showErrorText && (
        <p className=" text-red-500 text-sm p-2">{inputProps.error}</p>
      )}
    </div>
  );
};

export default InputField;
