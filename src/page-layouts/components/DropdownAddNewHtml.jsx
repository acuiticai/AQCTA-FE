"use client";

import { useState, useEffect, useContext, useRef } from "react";
import { Modal, Button, Input } from "@windmill/react-ui";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import InputFieldWithLabel from "./InputFieldWithLabel";
import InputLabel from "./InputLabel";

const DropdownWithAddNewHtml = ({
  label,
  name,
  placeholder = "Select or type an option",
  fetchUrl,
  addUrl,
  businessId,
  selectedValue,
  onChange,
  fieldType,
  onListUpdate,
  disabled = false,
  noLabel = false,
  inActive = false,
  // this is the value that will reset the dropdown selection, whenever it will change
  resetOn = "",
  error,
  shouldShowError = false,
}) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const buttonColor = useButtonColor();
  const dropdownRef = useRef(null);

  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newOption, setNewOption] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [inputValue, setInputValue] = useState(selectedValue || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");

  useEffect(() => {
    setInputValue("");
    setSelectedOption("");
    setShowEditor(false);
  }, [resetOn]);

  // ✅ Initialize editor visibility based on whether we have a selected value
  useEffect(() => {
    if (fieldType === "html" && selectedValue) {
      setShowEditor(true);
    }
  }, [fieldType, selectedValue]);

  // ✅ Fetch dropdown options from API
  useEffect(() => {
    if (!businessId) return;

    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        console.log("fetchUrl 1234 ", fetchUrl);
        const response = await axios.post(fetchUrl, {
          business_id: businessId,
          FilterStatus: "active",
        });

        if (response.data.success) {
          setOptions(response.data.data);
          onListUpdate?.(response.data.data);
        } else {
          throw new Error("Failed to fetch options");
        }
      } catch (err) {
        console.error("❌ Error fetching options:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [fetchUrl, businessId]);

  // ✅ Update input when selectedValue changes
  useEffect(() => {
    setInputValue(selectedValue || "");
  }, [selectedValue]);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ✅ Handle input change (close dropdown while typing)
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setShowDropdown(false); // Close dropdown when typing starts

    if (value.trim() === "") {
      setShowDropdown(true); // Reopen dropdown if the field is empty
    }

    onChange(value);
  };

  // ✅ Handle HTML editor content change
  const handleHtmlChange = (content) => {
    setInputValue(content);
    onChange(content);
  };

  // ✅ Handle selecting an option
  const handleSelectOption = (value) => {
    setInputValue(value);
    setSelectedOption(value);
    setShowDropdown(false);
    onChange(value);

    // Show editor if fieldType is html
    if (fieldType === "html") {
      setShowEditor(true);
    }
  };

  // ✅ Handle "Select Again" button click
  const handleSelectAgain = () => {
    setSelectedOption("");
    setShowEditor(false);
    setInputValue("");
    onChange("");
  };

  // ✅ Handle adding a new value to the database
  const handleAddNew = async () => {
    if (!newOption.trim()) {
      notifyError(`${label} cannot be empty!`);
      return;
    }

    const isDuplicate = options.some(
      (item) => item.name.toLowerCase() === newOption.toLowerCase()
    );
    if (isDuplicate) {
      notifyError(`"${newOption}" already exists!`);
      return;
    }

    if (!adminInfo || !adminInfo.token) {
      notifyError("Unauthorized: Missing Token");
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo.token}`,
    };

    try {
      const response = await axios.post(
        addUrl,
        { name: newOption, status: "active", business_id: businessId },
        { headers }
      );

      if (response.data.success || response.success) {
        notifySuccess(`"${newOption}" added successfully!`);

        // ✅ Update the dropdown with the new value
        const updatedOptions = [...options, { name: newOption }];
        setOptions(updatedOptions);
        onListUpdate?.(updatedOptions);
        setInputValue(newOption);
        onChange(newOption);

        // Show editor if fieldType is html
        if (fieldType === "html") {
          setShowEditor(true);
          setSelectedOption(newOption);
        }

        setIsAddingNew(false);
      } else {
        throw new Error("Failed to add new option");
      }
    } catch (err) {
      notifyError("Error adding new item");
      console.error("❌ Error:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="contents">
        {/* Dropdown for selection - only shown when editor is not visible */}
        {!showEditor && (
          <div className={`w-full`}>
            <InputFieldWithLabel
              type="text"
              name={name}
              label={label}
              placeholder={isLoading ? "Select options" : placeholder}
              value={selectedOption}
              noLabel={noLabel}
              onChange={handleInputChange}
              onFocus={() => setShowDropdown(true)}
              disabled={disabled || !businessId}
              error={error}
              shouldShowError={shouldShowError}
              inActive={inActive}
            />

            {/* Dropdown options */}
            {showDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                {options
                  .filter((option) =>
                    option.name.toLowerCase().includes(inputValue.toLowerCase())
                  )
                  .map((item, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-gray-200 cursor-pointer"
                      onClick={() => handleSelectOption(item.name)}
                    >
                      {item.name}
                    </div>
                  ))}

                {/* "Add New" option in dropdown */}
                <div
                  className="p-2 bg-green-100 hover:bg-green-200 text-green-700 cursor-pointer"
                  onClick={() => {
                    setIsAddingNew(true);
                    setShowDropdown(false);
                  }}
                >
                  ➕ Add New
                </div>
              </div>
            )}
          </div>
        )}

        {/* HTML Editor - only shown when an option is selected and fieldType is "html" */}
        {showEditor && fieldType === "html" && (
          <div>
            {!noLabel && (
              <InputLabel
                direction="row"
                label={label}
                required={true}
                error={error}
                type="text"
                className="block pb-4 pt-4"
              />
            )}
            <div
              className={`w-full p-3 rounded-md bg-gray-50 border text-gray-600 
            placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 w-[350px]`}
            >
              <div
                className={`border rounded ${
                  error && shouldShowError
                    ? "border-red-500"
                    : "border-gray-200"
                }`}
              >
                <ReactQuill
                  value={inputValue}
                  onChange={handleHtmlChange}
                  theme="snow"
                  modules={{
                    toolbar: [
                      [{ header: "1" }, { header: "2" }, { font: [] }],
                      [{ size: [] }],
                      ["bold", "italic", "underline", "strike", "blockquote"],
                      [
                        { list: "ordered" },
                        { list: "bullet" },
                        { indent: "-1" },
                        { indent: "+1" },
                      ],
                      ["link"],
                      ["clean"],
                    ],
                  }}
                  formats={[
                    "header",
                    "font",
                    "size",
                    "bold",
                    "italic",
                    "underline",
                    "strike",
                    "blockquote",
                    "list",
                    "bullet",
                    "indent",
                    "link",
                  ]}
                  placeholder={placeholder}
                />
                {inActive && (
                  <style jsx>{`
                    .ql-editor p {
                      color: var(--p-blue) !important;
                    }
                  `}</style>
                )}
              </div>
            </div>
            {error && shouldShowError && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
            {!inActive && (
              <div className="flex justify-between mt-2">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAgain}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Select Again
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(true)}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Add New
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add New Modal */}
      {isAddingNew && (
        <Modal
          isOpen={isAddingNew}
          onClose={() => setIsAddingNew(false)}
          className="w-[600px] mx-auto"
        >
          <div className="p-5 bg-white rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              Add New {label}
            </h2>

            {fieldType === "html" ? (
              <div>
                <input
                  type="text"
                  className="w-full mb-4 p-2 border border-gray-300 rounded-md"
                  placeholder={`Enter ${label} Name`}
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                />
                <div className="border rounded">
                  <ReactQuill
                    value={newOption}
                    onChange={(content) => setNewOption(content)}
                    theme="snow"
                    modules={{
                      toolbar: [
                        [{ header: "1" }, { header: "2" }, { font: [] }],
                        [{ size: [] }],
                        ["bold", "italic", "underline", "strike", "blockquote"],
                        [
                          { list: "ordered" },
                          { list: "bullet" },
                          { indent: "-1" },
                          { indent: "+1" },
                        ],
                        ["link"],
                        ["clean"],
                      ],
                    }}
                    formats={[
                      "header",
                      "font",
                      "size",
                      "bold",
                      "italic",
                      "underline",
                      "strike",
                      "blockquote",
                      "list",
                      "bullet",
                      "indent",
                      "link",
                    ]}
                    placeholder={`Enter ${label} Content`}
                  />
                </div>
              </div>
            ) : fieldType === "textarea" ? (
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                placeholder={`Enter ${label}`}
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
              />
            ) : (
              <Input
                className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                placeholder={`Enter ${label}`}
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
              />
            )}

            <div className="flex justify-end space-x-2 mt-4">
              <Button
                layout="outline"
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 text-gray-700 border-gray-400 rounded-xl text-sm hover:bg-gray-200 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddNew}
                className="px-4 py-2 text-white rounded-xl text-sm hover:bg-green-700 transition-all"
                style={{ backgroundColor: buttonColor }}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DropdownWithAddNewHtml;
