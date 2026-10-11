const FormField = ({
  label,
  type,
  name,
  placeholder,
  options = [],
  value,
  onChange,
  disabled = false,
  labelWidth = "w-40",
  customInput,
}) => {
  const inputClasses = `w-full p-3 rounded-md focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
    disabled ? "bg-gray-100" : "bg-gray-50"
  } border text-gray-600 placeholder-gray-400`;

  console.log("drop down");

  return (
    <div className="flex items-center">
      {label && (
        <label className={`text-sm text-gray-600 ${labelWidth}`}>
          {label} <span className="text-red-500">*</span>
        </label>
      )}
      <div className="flex-1">
        {type === "custom" ? (
          customInput
        ) : type === "select" ? (
          <select
            name={name}
            className={`${inputClasses} focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]`}
            onChange={onChange}
            value={value}
            disabled={disabled}
          >
            <option value="">{placeholder}</option>
            {options.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={inputClasses}
          />
        )}
      </div>
    </div>
  );
};

export default FormField;
