export default function LabelValue({
  label,
  value,
  className,
  inActive,
  theme,
  ...inputProps
}) {
  return (
    <div
      className={`w-full ${
        inputProps.error && inputProps.shouldShowError
          ? "border-[2px] border-red-500 outline-none"
          : "border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
      }  rounded-[12px] shadow-sm px-[16px] py-[8px] ${
        theme === "light" ? "transparent" : "bg-gray-100"
      } ${className} ${inActive && "pointer-events-none text-p-blue-dark"}`}
    >
      {value}
    </div>
  );
}
