import Rotate90DegreesCwOutlined from "@mui/icons-material/Rotate90DegreesCwOutlined";

// Margin Input Component
export const CustomMarginInput = ({ margins, onMarginChange }) => (
  <div className="mb-6">
    <label className="block text-gray-700 mb-2">
      Margin <span className="text-gray-500 text-sm">(In inches)</span>
    </label>
    <div className="grid grid-cols-4 gap-4">
      {Object.entries(margins).map(([key, value]) => (
        <div key={key}>
          <label className="block text-gray-600 text-sm mb-1 capitalize">
            {key}
          </label>
          <div className="relative">
            <input
              type="number"
              value={value}
              onChange={(e) => onMarginChange(key, e.target.value)}
              className="w-full p-3 rounded-md bg-gray-100 border border-gray-200 focus:outline-none focus:border-lime-500"
              step="0.1"
            />
          </div>
        </div>
      ))}
      <button
        className="mt-6 text-lime-500 hover:text-lime-600"
        onClick={() => onMarginChange("all", "0.7")}
      >
        <Rotate90DegreesCwOutlined className="w-5 h-5" />
      </button>
    </div>
  </div>
);
