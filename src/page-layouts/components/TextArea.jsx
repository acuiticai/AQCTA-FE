import React from "react";

const TextArea = ({
  className,
  showErrorText = true,
  theme = "gray",
  inActive = false,
  ...inputProps
}) => {
  console.debug({ inputProps });

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

  const useIntrinsicHeight = inputProps.rows != null && inputProps.rows !== "";

  return (
    <div className="relative">
      <textarea
        {...inputProps}
        autoFocus={false}
        onWheel={handleWheel}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`w-full resize-none ${useIntrinsicHeight ? "min-h-0 h-auto" : "min-h-[80px]"} ${
          inputProps.error && inputProps.shouldShowError
            ? `border-2 border-red-500 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                theme === "invoice" ? "rounded-lg px-3 py-2.5 text-sm" : "rounded-xl px-4 py-2"
              }`
            : theme === "invoice"
            ? "border border-gray-300 bg-white text-sm rounded-lg px-3 py-2.5 shadow-none focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            : theme === "light"
            ? "border-2 border-gray-300 bg-transparent shadow focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] rounded-xl px-4 py-2"
            : "border-2 border-transparent bg-gray-100 focus:outline-none focus:border-[var(--p-blue)] focus:shadow-sm hover:border-[var(--p-blue)] transition-all rounded-xl px-4 py-2"
        } ${className} ${inActive && "pointer-events-none text-p-blue-dark"}`}
      />
      {inputProps.error && inputProps.shouldShowError && showErrorText && (
        <p className="text-red-500 text-xs mt-1">{inputProps.error}</p>
      )}
    </div>
  );
};

export default TextArea;
