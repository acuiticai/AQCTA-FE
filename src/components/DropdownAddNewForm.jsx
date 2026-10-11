import React, { useState, useEffect, useContext } from "react";
import DropdownBasic from "@/components/DropdownBasic";
import { Modal, Button, Input } from "@windmill/react-ui";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";

const DropdownAddNewForm = ({
  label,
  placeholder = "Select an option",
  fetchUrl,
  addUrl,
  businessId,
  selectedValue = "",
  onChange,
  className = "",
}) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const buttonColor = useButtonColor();

  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    if (!businessId) return;

    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post(fetchUrl, {
          business_id: businessId,
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
        { name: newOption, status: "active", business_id: businessId },
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

  // Spinner component
  const Spinner = () => (
    <div className="flex items-center justify-center py-2">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
    </div>
  );

  return (
    <div className={className}>
      {isLoading ? (
        <Spinner />
      ) : (
        <DropdownBasic
          value={selectedValue}
          onChange={(selected) => {
            if (selected === "add_new") {
              setIsModalOpen(true);
            } else {
              onChange(selected);
            }
          }}
          options={[
            ...options.map((item) => ({
              value: item.name,
              label: item.name,
            })),
            { value: "add_new", label: "➕ Add New" },
          ]}
          placeholder={placeholder}
          disabled={!businessId}
          className={className}
        />
      )}

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
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--p-blue)] shadow-sm"
            placeholder={`Enter ${label} Name`}
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
          />

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              layout="outline"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md text-sm hover:bg-gray-200 transition-all"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNew}
              className="px-4 py-2 text-white rounded-md text-sm hover:bg-opacity-80 transition-all"
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

export default DropdownAddNewForm;
