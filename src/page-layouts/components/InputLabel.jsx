const InputLabel = ({
  label,
  required = false,
  className = "",
  error = false,
  customLabelWidth = "w-1/4",
  direction = "row",
  labelOnTop = false,
  icon = null,
  compactLabelSpacing = false,
  ...props
}) => {
  const columnLabelLayout =
    direction === "column" || labelOnTop
      ? compactLabelSpacing
        ? "mb-0 w-full"
        : "mb-1 w-full"
      : "";
  return (
    <label
      className={`${customLabelWidth} text-sm font-medium text-gray-700 ${className} ${columnLabelLayout} ${
        error && direction === "row" ? "pt-[10px]" : ""
      } ${
        labelOnTop ? "pt-2" : ""
      } flex items-center gap-2`}
      {...props}
    >
      {icon && (
        <span className="text-lg text-gray-400 mr-1 flex-shrink-0">{icon}</span>
      )}
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );
};

export default InputLabel;
