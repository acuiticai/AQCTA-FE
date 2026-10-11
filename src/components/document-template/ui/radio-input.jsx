// Reusable Radio Group Component
export const CustomRadioGroup = ({ label, options, value, onChange }) => (
  <div className="mb-6">
    <label className="block text-gray-700 mb-3">{label}</label>
    <div className="flex gap-6">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="radio"
              value={option}
              checked={value === option}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-full border-2 ${
                value === option ? "border-lime-500" : "border-gray-300"
              }`}
            >
              {value === option && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-lime-500" />
              )}
            </div>
          </div>
          <span>{option}</span>
        </label>
      ))}
    </div>
  </div>
);
