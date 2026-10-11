import { FiChevronDown, FiX } from "react-icons/fi";
function HeaderSection({ isExpanded, setIsExpanded, title, onRemove }) {
  return (
    <div
      className="flex justify-between items-center p-4 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        <FiChevronDown
          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
        <span className="font-medium">{title}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-red-500 hover:text-red-700"
      >
        <FiX size={18} />
      </button>
    </div>
  );
}

export default HeaderSection;
