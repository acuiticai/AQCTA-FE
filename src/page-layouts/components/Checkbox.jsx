export default function Checkbox({
  value,
  onChange,
  label,
  className = "",
  ...props
}) {
  return (
    <div className="col-span-2 flex items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-4 h-4 shrink-0 bg-gray-100 border-gray-300 rounded text-[var(--p-blue)] focus:ring-2 focus:ring-[var(--p-blue)] cursor-pointer ${className}`}
        {...props}
      />
      <span
        className={`text-gray-700 cursor-pointer ${
          props.disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        disabled={props.disabled}
        onClick={() => {
          if (!props.disabled) {
            onChange(!value);
          }
        }}
      >
        {label}
      </span>
    </div>
  );
}
