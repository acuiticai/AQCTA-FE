import React from "react";

const Progress = React.forwardRef(
  ({ className = "", value = 0, max = 100, ...props }, ref) => {
    // Sanitize and validate the value
    const sanitizedValue = Math.max(0, Math.min(max, Number(value) || 0));
    const percentage = max > 0 ? (sanitizedValue / max) * 100 : 0;

    return (
      <div
        ref={ref}
        className={`relative h-4 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
        role="progressbar"
        aria-valuenow={sanitizedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`Progress: ${sanitizedValue} of ${max} (${percentage.toFixed(
          1
        )}%)`}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-[var(--p-blue)] transition-all duration-300 ease-in-out"
          style={{
            transform: `translateX(-${100 - percentage}%)`,
            willChange: "transform",
          }}
        />

        {/* Screen reader text */}
        <span className="sr-only">{`${percentage.toFixed(1)}% complete`}</span>
      </div>
    );
  }
);

Progress.displayName = "Progress";

export { Progress };
