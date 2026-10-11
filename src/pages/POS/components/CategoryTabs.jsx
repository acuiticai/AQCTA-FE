import React from "react";

const CategoryTabs = ({ categories, activeCategory, onSelect }) => {
  const allCategories = [{ _id: null, name: "All" }, ...categories];

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
      {allCategories.map((cat) => {
        const isActive =
          (cat._id === null && !activeCategory) ||
          cat._id === activeCategory;

        return (
          <button
            key={cat._id || "all"}
            type="button"
            onClick={() => onSelect(cat._id)}
            className={`
              inline-flex items-center justify-center px-3.5 h-8 text-[11.5px] rounded-full whitespace-nowrap font-semibold
              transition-all duration-150 shrink-0 active:scale-[0.97]
              ${
                isActive
                  ? "bg-[var(--p-blue)] text-white shadow-sm shadow-[var(--p-blue)]/20 ring-1 ring-[var(--p-blue)]/30"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
              }
            `}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(CategoryTabs);
