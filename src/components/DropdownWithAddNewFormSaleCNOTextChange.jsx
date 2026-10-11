import React, { useState, useEffect, useContext } from "react";
import { Modal, Button, Input } from "@windmill/react-ui";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { InputFieldWithLabel, DropdownBasic } from "@/page-layouts";

const DropdownWithAddNewFormSaleC = ({
  label,
  name,
  placeholder = "Select an option",
  fetchUrl,
  addUrl,
  businessId, // ✅ Supports business-specific filtering
  selectedValue,
  onChange,
  disabled = false,
  labelWidth = "w-40",
}) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const buttonColor = useButtonColor();

  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    if (!businessId) return; // ✅ Ensures we fetch only when businessId is provided

    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post(fetchUrl, {
          business_id: businessId, // ✅ Fetch only relevant business data
          FilterStatus: "active",
        });
        if (response.data.success) {
          setOptions(response.data.data);
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
        { name: newOption, status: "active", business_id: businessId }, // ✅ Save under the correct business
        { headers }
      );

      if (response.data.success) {
        notifySuccess(`"${newOption}" added successfully!`);

        const updatedOptions = [...options, { name: newOption }];
        setOptions(updatedOptions);
        onChange(newOption);

        setNewOption("");
        setIsModalOpen(false);
      } else {
        throw new Error("Failed to add new option");
      }
    } catch (err) {
      notifyError("Error adding new item");
      console.error("❌ Error:", err);
    }
  };

  return (
    <div className="flex items-center">
      <InputFieldWithLabel
        label={label}
        name={name}
        placeholder={placeholder}
        options={options}
        onChange={onChange}
        Input={
          <DropdownBasic
            name={name}
            onChange={(value) => {
              if (value === "add_new") {
                setIsModalOpen(true);
              } else {
                onChange(value);
              }
            }}
            value={selectedValue}
            disabled={disabled || !businessId} // ✅ Disable if no business is selected
            placeholder={placeholder}
            options={[
              ...options.map((item) => ({
                value: item.name,
                label: item.name,
              })),
              { value: "add_new", label: "➕ Add New" },
            ]}
          />
        }
      />
      {/* Modal for Adding New Option */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="w-[350px] mx-auto"
      >
        <div className="p-5 bg-white rounded-lg shadow-lg">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
            Add New {label}
          </h2>

          <Input
            className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] shadow-sm"
            placeholder={`Enter ${label}`}
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
          />

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              layout="outline"
              onClick={() => setIsModalOpen(false)}
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
    </div>
  );
};

export default DropdownWithAddNewFormSaleC;
