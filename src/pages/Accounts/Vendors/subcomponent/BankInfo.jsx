import React, { useState, useEffect } from "react";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";

const BankInfo = ({ onChange, initialData = {} }) => {
  const [formData, setFormData] = useState({
    bankDetails: {
      bankName: "",
      bankAddress: "",
      bankCode: "",
      branchCity: "",
      branchCode: "",
    },
    bankAccountDetails: { // ✅ Fixed Key to Match Database Schema
      accountName: "",
      accountNumber: "",
      swiftCode: "",
    },
  });

  // ✅ Load initial data when it changes
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData((prev) => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          ...(initialData.bankDetails || {}),
        },
        bankAccountDetails: { // ✅ Ensures Values Merge Correctly
          ...prev.bankAccountDetails,
          ...(initialData.bankAccountDetails || {}),
        },
      }));
    }
  }, [initialData]);

  // ✅ Handle Nested Changes in `bankDetails` and `bankAccountDetails`
  const handleNestedChange = (parentField, childField, value) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [parentField]: {
          ...(prev[parentField] || {}),
          [childField]: value,
        },
      };

      onChange && onChange(updatedData); // ✅ Notify Parent Component
      return updatedData;
    });
  };

  return (
    <div className="space-y-6">
      {/* Debugging Data */}
      {/* <h3>🛠 Debugging Data (Live Update):</h3>
      <pre>{JSON.stringify(formData, null, 2)}</pre> */}

      {/* Bank Details Section */}
      <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
      <FormRow label="Bank Name">
        <InputField
          placeholder="Bank Name"
          value={formData.bankDetails.bankName}
          onChange={(e) =>
            handleNestedChange("bankDetails", "bankName", e.target.value)
          }
        />
      </FormRow>
      <FormRow label="Bank Address">
        <InputField
          placeholder="Bank Address"
          value={formData.bankDetails.bankAddress}
          onChange={(e) =>
            handleNestedChange("bankDetails", "bankAddress", e.target.value)
          }
        />
      </FormRow>
      <FormRow label="Bank Code (If any)">
        <InputField
          placeholder="Bank Code"
          value={formData.bankDetails.bankCode}
          onChange={(e) =>
            handleNestedChange("bankDetails", "bankCode", e.target.value)
          }
        />
      </FormRow>
      <FormRow label="Branch City">
        <InputField
          placeholder="Branch City"
          value={formData.bankDetails.branchCity}
          onChange={(e) =>
            handleNestedChange("bankDetails", "branchCity", e.target.value)
          }
        />
      </FormRow>
      <FormRow label="Branch Code">
        <InputField
          placeholder="Branch Code"
          value={formData.bankDetails.branchCode}
          onChange={(e) =>
            handleNestedChange("bankDetails", "branchCode", e.target.value)
          }
        />
      </FormRow>

      {/* Bank Account Details Section */}
      <h3 className="text-lg font-semibold mb-4">Bank Account Details</h3>
      <FormRow label="Account Name">
        <InputField
          placeholder="Account Name"
          value={formData.bankAccountDetails.accountName}
          onChange={(e) =>
            handleNestedChange("bankAccountDetails", "accountName", e.target.value)
          }
        />
      </FormRow>
      <FormRow label="Account Number">
        <InputField
          placeholder="Account Number"
          value={formData.bankAccountDetails.accountNumber}
          onChange={(e) =>
            handleNestedChange("bankAccountDetails", "accountNumber", e.target.value)
          }
        />
      </FormRow>
      <FormRow label="Swift Code">
        <InputField
          placeholder="Swift Code"
          value={formData.bankAccountDetails.swiftCode}
          onChange={(e) =>
            handleNestedChange("bankAccountDetails", "swiftCode", e.target.value)
          }
        />
      </FormRow>
    </div>
  );
};

export default BankInfo;
