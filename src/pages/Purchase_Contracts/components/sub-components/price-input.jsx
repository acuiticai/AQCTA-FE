const PriceInput = ({ label, disabled, labelWidth = "w-40", placeholder }) => {
  return (
    <div className="flex items-center">
      <label className={`text-sm text-gray-600 ${labelWidth}`}>{label}</label>
      <div className="flex-1">
        <div className="flex items-center bg-gray-50 border rounded-md">
          <span className="pl-3 text-gray-500">USD</span>
          <input
            type="text"
            disabled={disabled}
            placeholder={placeholder}
            className="w-full p-3 bg-transparent focus:outline-none text-gray-600 disabled:text-gray-400"
          />
        </div>
      </div>
    </div>
  );
};
export default PriceInput;
