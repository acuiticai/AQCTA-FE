import React from "react";

const ObjectRenderer = ({ data, className = "" }) => {
  if (!data || typeof data !== "object") {
    return <div className="text-gray-500 italic">No data to display</div>;
  }

  const renderBulletPoint = (item, index) => {
    if (typeof item === "string") {
      return (
        <li key={index} className="ml-4 mb-1">
          {item}
        </li>
      );
    }

    if (typeof item === "object" && item.text && item.variables) {
      let processedText = item.text;

      // Replace variables in the text
      Object.keys(item.variables).forEach((variable) => {
        const value = item.variables[variable];
        const placeholder = `{${variable}}`;
        processedText = processedText.replace(
          new RegExp(placeholder, "g"),
          value
        );
      });

      return (
        <li key={index} className="ml-4 mb-1">
          {processedText}
        </li>
      );
    }

    return null;
  };

  const renderSection = (heading, content, index) => {
    return (
      <div key={index} className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">
          {heading}
        </h3>
        <ul className="space-y-1">
          {Array.isArray(content)
            ? content.map((item, itemIndex) =>
                renderBulletPoint(item, itemIndex)
              )
            : renderBulletPoint(content, 0)}
        </ul>
      </div>
    );
  };

  return (
    <div className={`object-renderer ${className}`}>
      {Object.entries(data).map(([heading, content], index) =>
        renderSection(heading, content, index)
      )}
    </div>
  );
};

export default ObjectRenderer;
