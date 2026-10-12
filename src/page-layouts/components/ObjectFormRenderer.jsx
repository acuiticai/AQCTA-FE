import React, { useState, useEffect } from "react";
import Checkbox from "./Checkbox";
import InputField from "./InputField";

const ObjectFormRenderer = ({
  data,
  className = "",
  value = {},
  onChange,
  ...props
}) => {
  const [selectedItems, setSelectedItems] = useState(value.selectedItems || {});
  const [variableValues, setVariableValues] = useState(
    value.variableValues || {}
  );
  const [selectedSections, setSelectedSections] = useState(
    value.selectedSections || {}
  );

  console.debug({ data });

  useEffect(() => {
    if (onChange) {
      onChange({
        selectedItems,
        variableValues,
        selectedSections,
        processedText: getProcessedText(),
      });
    }
  }, [selectedItems, variableValues, selectedSections]);

  const getProcessedText = () => {
    let result = "";

    Object.entries(data).forEach(([heading, content]) => {
      // Only process sections that are explicitly selected
      if (selectedSections[heading]) {
        if (Array.isArray(content)) {
          const selectedContent = content.filter(
            (item, index) => selectedItems[`${heading}_${index}`]
          );

          if (selectedContent.length > 0) {
            result += `<div class="mb-2 flex items-start space-x-2 gap-6"><h3 class="font-bold w-[150px]">${heading}</h3><ul>`;
            selectedContent.forEach((item) => {
              if (typeof item === "string") {
                result += `<li>${item}</li>`;
              } else if (typeof item === "object" && item.text) {
                let processedText = item.text;
                if (item.variables) {
                  Object.keys(item.variables).forEach((variable) => {
                    const value =
                      variableValues[`${heading}_${item.text}_${variable}`] ||
                      item.variables[variable];
                    const placeholder = `{${variable}}`;
                    processedText = processedText.replace(
                      new RegExp(placeholder, "g"),
                      value
                        ? `<span class="mr-2">${value}</span>`
                        : "<span class='mr-4'>_______</span>"
                    );
                  });
                }
                result += `<li>${processedText}</li>`;
              }
            });
            result += `</ul></div>`;
          }
        }
      }
    });

    return result;
  };

  const handleItemToggle = (heading, index, checked) => {
    const key = `${heading}_${index}`;
    setSelectedItems((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handleVariableChange = (heading, itemText, variable, value) => {
    const key = `${heading}_${itemText}_${variable}`;
    setVariableValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderTextWithInputs = (item, heading) => {
    if (typeof item === "string") {
      return <span className="text-xs">{item}</span>;
    }

    if (typeof item === "object" && item.text && item.variables) {
      // Split the text by variable placeholders and render with input fields
      let text = item.text;
      const parts = [];
      let lastIndex = 0;

      // Find all variable placeholders
      Object.keys(item.variables).forEach((variable) => {
        const placeholder = `{${variable}}`;
        const index = text.indexOf(placeholder);
        if (index !== -1) {
          // Add text before the placeholder
          if (index > lastIndex) {
            parts.push({
              type: "text",
              content: text.substring(lastIndex, index),
            });
          }

          // Add the input field
          const key = `${heading}_${item.text}_${variable}`;
          const currentValue = variableValues[key] || item.variables[variable];

          parts.push({
            type: "input",
            variable,
            key,
            value: currentValue,
          });

          lastIndex = index + placeholder.length;
        }
      });

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push({
          type: "text",
          content: text.substring(lastIndex),
        });
      }

      return (
        <span className="text-xs flex items-center !ml-[-5px] justify-start">
          {parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <span
                  key={index}
                  className="m-0 p-0 ml-[12px] whitespace-nowrap"
                >
                  {part.content}
                </span>
              );
            } else {
              return (
                <InputField
                  key={index}
                  type="text"
                  value={part.value}
                  onChange={(e) =>
                    handleVariableChange(
                      heading,
                      item.text,
                      part.variable,
                      e.target.value
                    )
                  }
                  className={`text-xs h-4 px-[8px] py-0 border border-gray-300 rounded  ${
                    !item?.fullWidthInput
                      ? "w-[95%] pl-2 ml-2"
                      : "w-full ml-[10px]"
                  }`}
                  // placeholder={part.variable}
                />
              );
            }
          })}
        </span>
      );
    }

    return <span className="text-xs">{item.text || item}</span>;
  };

  const handleSectionToggle = (heading, checked) => {
    setSelectedSections((prev) => ({
      ...prev,
      [heading]: checked,
    }));

    // If section is checked, check all items in that section
    // If section is unchecked, uncheck all items in that section
    if (data[heading] && Array.isArray(data[heading])) {
      const newSelectedItems = { ...selectedItems };
      data[heading].forEach((item, index) => {
        newSelectedItems[`${heading}_${index}`] = checked;
      });
      setSelectedItems(newSelectedItems);
    }
  };

  const renderBulletPoint = (item, index, heading) => {
    const isSelected = selectedItems[`${heading}_${index}`];

    if (typeof item === "string") {
      return (
        <div key={index} className="flex items-center space-x-2 mb-1">
          <Checkbox
            value={isSelected}
            onChange={(checked) => handleItemToggle(heading, index, checked)}
            className="w-4 h-4"
          />
          <span className="text-xs">{item}</span>
        </div>
      );
    }

    if (typeof item === "object" && item.text) {
      return (
        <div key={index} className="mb-1">
          <div className="flex items-center space-x-2 mb-1">
            <Checkbox
              value={isSelected}
              onChange={(checked) => handleItemToggle(heading, index, checked)}
              className="w-4 h-4"
            />
            {renderTextWithInputs(item, heading)}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderSection = (heading, content, index) => {
    const firstItem = Array.isArray(content) ? content[0] : content;
    const remainingItems = Array.isArray(content) ? content.slice(1) : [];

    console.debug({ firstItem, remainingItems, heading, content, index });
    return (
      <div key={index} className="mb-2">
        <div className="flex items-start space-x-2 mb-1 gap-4">
          <div className="flex items-center space-x-2 w-[200px] flex-shrink-0">
            <Checkbox
              value={selectedSections[heading]}
              onChange={(checked) => handleSectionToggle(heading, checked)}
              className="w-4 h-4"
            />
            <h3 className="text-sm font-bold text-gray-800 uppercase">
              {heading}
            </h3>
          </div>

          <div className="flex-1">
            {firstItem && (
              <div className="flex items-center space-x-2 mb-1">
                <Checkbox
                  value={selectedItems[`${heading}_0`]}
                  onChange={(checked) => handleItemToggle(heading, 0, checked)}
                  className="w-4 h-4"
                />
                {renderTextWithInputs(firstItem, heading)}
              </div>
            )}

            {remainingItems.length > 0 && (
              <div className="space-y-1">
                {Object.values(remainingItems).map((item, index) =>
                  renderBulletPoint(item, parseInt(index + 1), heading)
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!data || typeof data !== "object") {
    return <div className="text-gray-500 italic">No data to display</div>;
  }

  const processedText = getProcessedText();

  return (
    <div className={`object-form-renderer ${className} text-xs p-2`}>
      <div className="space-y-3">
        {Object.entries(data).map(([heading, content], index) =>
          renderSection(heading, content, index)
        )}
      </div>

      {processedText && (
        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Live Output Preview:
          </h4>
          <div className="bg-white p-3 rounded border">
            <div
              className="text-sm text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: processedText }}
            />
          </div>
          <div className="mt-2 text-xs text-blue-600">
            This is how your document requirements will appear in the final
            output.
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectFormRenderer;
