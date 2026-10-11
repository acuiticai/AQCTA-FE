import InputLabel from "./InputLabel";
import InputField from "./InputField";
const InputFieldWithLabel = ({
  label,
  Input,
  required = false,
  direction = "row",
  labelOnTop = false,
  type = "text",
  shouldShowError = false,
  customLabelWidth = "w-1/4",
  /** Passed through to InputLabel (e.g. "mb-2" to match invoice Phone/Fax labels). */
  labelClassName = "",
  /** With direction column, shrinks flex gap and label margin (e.g. document custom fields). */
  tightLabelInputSpacing = false,
  noLabel = false,
  description,
  width = "w-full",
  icon = null,
  ...props
}) => {
  const disabled =
    props.disabled || (props.options && props.options.length === 0);

  const hasError = props.error && shouldShowError;

  const gapClass =
    direction === "column"
      ? tightLabelInputSpacing
        ? "gap-2"
        : "gap-3"
      : "gap-6";

  return label && !noLabel ? (
    <div
      className={`col-span-12 flex ${width} ${gapClass} ${
        direction === "column" ? "flex-col items-start p-[2px]" : "flex-row"
      } ${
        hasError
          ? "items-start"
          : labelOnTop
          ? "item-start"
          : direction === "column"
          ? "items-start"
          : "items-center"
      } min-h-[48px]`}
    >
      <InputLabel
        label={label}
        direction={direction}
        required={required}
        error={hasError}
        customLabelWidth={customLabelWidth}
        labelOnTop={labelOnTop}
        icon={icon}
        className={labelClassName}
        compactLabelSpacing={tightLabelInputSpacing}
      />
      <div className={"w-full min-w-0 max-w-full"} style={{ marginTop: 0 }}>
        {Input || (
          <InputField
            type={type}
            shouldShowError={shouldShowError}
            {...props}
          />
        )}
        {/* Custom Input skips InputField error UI — show it here */}
        {Input && hasError ? (
          <p className="text-red-500 text-sm mt-1">{props.error}</p>
        ) : null}
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  ) : (
    <div className={"w-full"} style={{ marginTop: 0 }}>
      {Input || (
        <InputField type={type} shouldShowError={shouldShowError} {...props} />
      )}
      {Input && hasError ? (
        <p className="text-red-500 text-sm mt-1">{props.error}</p>
      ) : null}
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
};

export default InputFieldWithLabel;
