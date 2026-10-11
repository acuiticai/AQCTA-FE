// Reusable Input Component
export const CustomTextInput = ({ label, value, onChange, required }) => (
  <div className="mb-6">
    <label className="block text-lime-500 mb-2">
      {label} {required && <span className="text-lime-500">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-3 rounded-md bg-gray-50 border border-gray-300 focus:outline-none focus:border-lime-500"
      placeholder={`Enter ${label}`}
    />
  </div>
);

export const CustomInput = ({
  label,
  id,
  error,
  register,
  registerOptions = {},
  type = "text",
  required = false,
  ...props
}) => {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          id={id}
          {...register(id, registerOptions)}
          {...props}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
        />
      ) : (
        <input
          id={id}
          type={type}
          {...register(id, registerOptions)}
          {...props}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
    </div>
  );
};
