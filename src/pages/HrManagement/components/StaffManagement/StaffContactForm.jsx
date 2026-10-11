import React, { useEffect, useState } from "react";

const StaffContactForm = ({ staffData, handleNestedUpdate }) => {
  const [address, setAddress] = useState({
    unit: "",
    street: "",
    suburb: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
  });

  // ✅ Load existing address data
  useEffect(() => {
    if (staffData?.address) {
      setAddress(staffData.address);
    }
  }, [staffData]);

  // ✅ Handle address field changes
  const handleAddressChange = (field, value) => {
    setAddress((prev) => ({
      ...prev,
      [field]: value,
    }));
    handleNestedUpdate("address", field, value);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-gray-700 font-semibold text-lg mb-4">
        Contact Information
      </h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Address Fields */}
        {["unit", "street", "suburb", "city", "state", "postcode", "country"].map((field) => (
          <div key={field}>
            <label className="block text-sm text-gray-600 mb-1">
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50"
              placeholder={field}
              value={address[field] || ""}
              onChange={(e) => handleAddressChange(field, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffContactForm;

