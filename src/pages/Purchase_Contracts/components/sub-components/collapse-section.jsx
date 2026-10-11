import { useState } from "react";
import { FiChevronDown, FiX } from "react-icons/fi";

const CollapsibleSection = ({ title, children }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div>
      <div
        className="flex justify-between items-center border-b pb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-sm font-semibold flex items-center space-x-2">
          <FiChevronDown
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
          <span>{title}</span>
        </h2>
        <button className="text-red-500 hover:text-red-700">
          <FiX size={18} />
        </button>
      </div>
      {isExpanded && children}
    </div>
  );
};

export default CollapsibleSection;
