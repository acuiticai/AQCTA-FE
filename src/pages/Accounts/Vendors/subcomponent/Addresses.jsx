import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Addresses = ({
  initialData = [],
  onChange,
  customerId,
  businessId,
  setValidationErrors,
}) => {
  const [addresses, setAddresses] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [
          {
            addressType: "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            state: "",
            zipCode: "",
            country: "",
            phone: "",
          },
        ]
  );
  const [addressTypeOptions, setAddressTypeOptions] = useState([
    { value: "", label: "Select Address Type" },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      setAddresses(initialData);
      // Initialize touched state as false for all fields
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_addressType`] = false;
        initialTouched[`${index}_addressLine1`] = false;
        initialTouched[`${index}_city`] = false;
        initialTouched[`${index}_state`] = false;
        initialTouched[`${index}_zipCode`] = false;
        initialTouched[`${index}_country`] = false;
      });
      setTouched(initialTouched);
    }
    // Run silent validation initially
    validateFormSilently();
  }, [initialData]);

  // Validate a field without showing errors
  const validateField = (index, field, value) => {
    // All fields are optional, so no validation needed
    return "";
  };

  // Check if there's at least one valid address with data
  const hasValidAddress = () => {
    if (!addresses || addresses.length === 0) {
      return true; // Addresses are optional
    }
    
    // Check if at least one address has some data
    return addresses.some(address => {
      return address.addressLine1 && address.addressLine1.trim() !== "";
    });
  };

  // Silent validation (doesn't show errors to user)
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    // Addresses are optional, so always valid
    isValid = true;

    setErrors(newErrors);

    // Update parent validation state without showing errors
    setValidationErrors({
      addresses: !isValid,
    });

    return isValid;
  };

  // Validate only touched fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Addresses are optional, so always valid
    isValid = true;

    setErrors(newErrors);

    // Update parent validation state
    setValidationErrors({
      addresses: !isValid,
    });

    return isValid;
  };

  const updateParent = (updatedAddresses) => {
    setAddresses(updatedAddresses);
    onChange && onChange(updatedAddresses);
    validateForm();
  };

  useEffect(() => {
    validateForm();
  }, [addresses, touched]);

  const handleChange = (index, field, value) => {
    if (
      field === "addressType" &&
      value &&
      addresses.some((address, i) => i !== index && address.addressType === value)
    ) {
      notifyError("Duplicate address type is not allowed for this vendor.");
      return;
    }
    const updatedAddresses = addresses.map((address, i) =>
      i === index ? { ...address, [field]: value } : address
    );

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedAddresses);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const addAddress = () => {
    const newAddress = {
      addressType: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      phone: "",
    };
    const newAddresses = [...addresses, newAddress];

    // Initialize touched state for new address
    const newIndex = addresses.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_addressType`]: false,
      [`${newIndex}_addressLine1`]: false,
      [`${newIndex}_city`]: false,
      [`${newIndex}_state`]: false,
      [`${newIndex}_zipCode`]: false,
      [`${newIndex}_country`]: false,
    }));

    updateParent(newAddresses);
  };

  const confirmDelete = (index, addressId) => {
    const address = addresses[index];

    if (
      !address.addressType &&
      !address.addressLine1 &&
      !address.addressLine2 &&
      !address.city &&
      !address.state &&
      !address.zipCode &&
      !address.country &&
      !address.phone
    ) {
      removeAddress(index, addressId, false);
    } else {
      setSelectedAddressIndex(index);
      setSelectedAddressId(addressId);
      setIsModalOpen(true);
    }
  };

  const removeAddress = async (index, addressId, showMessage = true) => {
    if (!customerId) {
      console.error("❌ Error: Vendor ID is missing");
      return;
    }

    if (!addressId) {
      const updatedAddresses = addresses.filter((_, i) => i !== index);
      // Ensure at least one empty address row remains
      const finalAddresses = updatedAddresses.length === 0 
        ? [{ addressType: "", addressLine1: "", addressLine2: "", city: "", state: "", zipCode: "", country: "", phone: "" }]
        : updatedAddresses;
      updateParent(finalAddresses);
      if (showMessage) {
        notifySuccess("Address removed successfully!");
      }
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/vendors/${customerId}/addresses/${addressId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        const updatedAddresses = addresses.filter((_, i) => i !== index);
        // Ensure at least one empty address row remains
        const finalAddresses = updatedAddresses.length === 0 
          ? [{ addressType: "", addressLine1: "", addressLine2: "", city: "", state: "", zipCode: "", country: "", phone: "" }]
          : updatedAddresses;
        updateParent(finalAddresses);
        if (showMessage) {
          notifySuccess("Address deleted successfully!");
        }
      } else {
        console.error("❌ Failed to delete address", await response.json());
      }
    } catch (error) {
      console.error("❌ Error in delete request:", error);
    } finally {
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    const fetchAddressTypes = async () => {
      if (!businessId) return;
      try {
        const response = await fetch(`${Base_URL}/items/Address Types/get_all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            business_id: businessId,
            FilterStatus: "active",
            FilterName: "",
          }),
        });
        const result = await response.json();
        const dynamicOptions = (result?.data || [])
          .map((type) => ({ value: type.name, label: type.name }))
          .filter((opt) => opt.value);
        if (dynamicOptions.length > 0) {
          setAddressTypeOptions([
            { value: "", label: "Select Address Type" },
            ...dynamicOptions,
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch address types", error);
      }
    };
    fetchAddressTypes();
  }, [businessId]);

  return (
    <div>
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Address Type
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Address Line 1
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Address Line 2
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              City
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              State
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Zip Code
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Country
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Phone
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {addresses.map((address, index) => (
            <tr key={index} className="border-t">
              <td className="py-2 px-4 border border-gray-200">
                <select
                  value={address.addressType}
                  onChange={(e) => handleChange(index, "addressType", e.target.value)}
                  onBlur={() => handleBlur(index, "addressType")}
                  className="w-full border-gray-300 rounded p-2"
                >
                  {addressTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={address.addressLine1}
                  onChange={(e) => handleChange(index, "addressLine1", e.target.value)}
                  onBlur={() => handleBlur(index, "addressLine1")}
                  placeholder="Enter Address Line 1"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={address.addressLine2}
                  onChange={(e) => handleChange(index, "addressLine2", e.target.value)}
                  onBlur={() => handleBlur(index, "addressLine2")}
                  placeholder="Enter Address Line 2"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => handleChange(index, "city", e.target.value)}
                  onBlur={() => handleBlur(index, "city")}
                  placeholder="Enter City"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={address.state}
                  onChange={(e) => handleChange(index, "state", e.target.value)}
                  onBlur={() => handleBlur(index, "state")}
                  placeholder="Enter State"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={address.zipCode}
                  onChange={(e) => handleChange(index, "zipCode", e.target.value)}
                  onBlur={() => handleBlur(index, "zipCode")}
                  placeholder="Enter Zip Code"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={address.country}
                  onChange={(e) => handleChange(index, "country", e.target.value)}
                  onBlur={() => handleBlur(index, "country")}
                  placeholder="Enter Country"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="tel"
                  value={address.phone}
                  onChange={(e) => {
                    const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                    handleChange(index, "phone", phoneValue);
                  }}
                  onBlur={() => handleBlur(index, "phone")}
                  placeholder="Enter Phone"
                  className="w-full border-gray-300 rounded p-2"
                />
              </td>
              <td className="py-2 px-4 border border-gray-200 text-center">
                <button
                  onClick={() => confirmDelete(index, address._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiTrash />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan="9"
              className="py-2 px-4 text-green-500 hover:text-green-700 cursor-pointer text-left"
              onClick={addAddress}
            >
              <div className="flex items-center space-x-2">
                <FiPlus />
                <span>Add Address</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => removeAddress(selectedAddressIndex, selectedAddressId)}
      />
    </div>
  );
};

export default Addresses;
