import React, { useState, useEffect } from "react";
import { AlertCircle, Check, Loader, ChevronLeft } from "lucide-react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { useHistory } from "react-router-dom";
import arrowLeft from "../../../assets/img/icons/arrow-left.png";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BankAccountMapping = () => {
  const { canAdd, canUpdate } = useSettingsCrudPermissions();
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
  const history = useHistory();

  const [formData, setFormData] = useState({
    transactionDate: [],
    transactionDescription: [],
    reference: [],
    depositAmount: [],
    withdrawalAmount: [],
  });

  const [inputValues, setInputValues] = useState({
    transactionDate: "",
    transactionDescription: "",
    reference: "",
    depositAmount: "",
    withdrawalAmount: "",
  });

  const [mappingId, setMappingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    fetchMapping();
  }, []);

  const fetchMapping = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${Base_URL}/bank-mappings`, {
        credentials: "include",
      });
      const data = await response.json();

      // If we have at least one mapping, use the first one
      if (data && data.length > 0) {
        const mapping = data[0];
        setMappingId(mapping._id);

        setFormData({
          transactionDate: Array.isArray(mapping.transactionDate)
            ? mapping.transactionDate
            : [],
          transactionDescription: Array.isArray(mapping.transactionDescription)
            ? mapping.transactionDescription
            : [],
          reference: Array.isArray(mapping.reference) ? mapping.reference : [],
          depositAmount: Array.isArray(mapping.depositAmount)
            ? mapping.depositAmount
            : [],
          withdrawalAmount: Array.isArray(mapping.withdrawalAmount)
            ? mapping.withdrawalAmount
            : [],
        });
      }

      setIsLoading(false);
    } catch (err) {
      setError("Failed to fetch mapping configuration");
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    if (!canUpdate) return;
    const { name, value } = e.target;
    setInputValues({
      ...inputValues,
      [name]: value,
    });
  };

  const handleKeyDown = (e, field) => {
    if (!canUpdate) return;
    if (e.key === "Enter" && inputValues[field].trim()) {
      e.preventDefault();
      setFormData({
        ...formData,
        [field]: [...formData[field], inputValues[field].trim()],
      });
      setInputValues({
        ...inputValues,
        [field]: "",
      });
    }
  };

  const removeTag = (field, index) => {
    if (!canUpdate) return;
    const newArray = [...formData[field]];
    newArray.splice(index, 1);
    setFormData({
      ...formData,
      [field]: newArray,
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (mappingId ? !canUpdate : !canAdd) return;
    setSaveStatus("saving");

    try {
      const options = {
        method: mappingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include",
      };

      const url = mappingId
        ? `${Base_URL}/bank-mappings/${mappingId}`
        : `${Base_URL}/bank-mappings`;

      const response = await fetch(url, { ...options, credentials: "include" });
      const data = await response.json();

      if (!mappingId && data._id) {
        setMappingId(data._id);
      }

      notifySuccess("Mapping saved successfully!");
      setSaveStatus("success");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    } catch (err) {
      setError("Failed to save mapping");
      setSaveStatus("error");
      notifyError("Failed to save mapping");
      // Clear error message after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  const resetForm = () => {
    setFormData({
      transactionDate: [],
      transactionDescription: [],
      reference: [],
      depositAmount: [],
      withdrawalAmount: [],
    });
    setInputValues({
      transactionDate: "",
      transactionDescription: "",
      reference: "",
      depositAmount: "",
      withdrawalAmount: "",
    });
  };

  const handleBack = () => {
    history.goBack();
  };

  return (
    <AppLayout>
      <Header title="Bank Account Mapping" />
      <div className="w-full bg-white max-h-[90vh] overflow-y-auto pb-[120px]">
        {/* Back button */}
        <div className="px-8 py-4">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <img src={arrowLeft} alt="arrow-left" className="mr-2 w-6 h-6" />
            <span>Back</span>
          </button>
        </div>
        <div className="container mx-auto px-8 py-2 w-full">
          <h1 className="text-md font-bold text-gray-800 mb-8">
            Bank Account Mapping
          </h1>
          <SettingsOrgBanner />

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded flex items-center">
              <AlertCircle className="mr-2" size={20} />
              <p>{error}</p>
            </div>
          )}

          {saveStatus === "success" && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded flex items-center">
              <Check className="mr-2" size={20} />
              <p>Mapping saved successfully!</p>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-lg shadow-md p-8 flex justify-center items-center">
              <Loader className="animate-spin mr-2" size={24} />
              <span className="ml-3">Loading...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Transaction Date */}
              <div className="flex items-start">
                <div className="w-1/4 pt-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Transaction Date
                  </label>
                </div>
                <div className="w-3/4">
                  <div className="relative">
                    <input
                      type="text"
                      name="transactionDate"
                      value={inputValues.transactionDate}
                      onChange={handleInputChange}
                      onKeyDown={(e) => handleKeyDown(e, "transactionDate")}
                      placeholder="Transaction Date"
                      readOnly={!canUpdate}
                      className="w-full px-4 py-2 bg-gray-100 border  rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.transactionDate.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-[var(--p-blue)] px-3 py-1 rounded-full"
                      >
                        <span className="text-sm text-white">{tag}</span>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => removeTag("transactionDate", index)}
                            className="ml-2 text-black hover:text-white"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction Description */}
              <div className="flex items-start">
                <div className="w-1/4 pt-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Transaction Description
                  </label>
                </div>
                <div className="w-3/4">
                  <div className="relative">
                    <input
                      type="text"
                      name="transactionDescription"
                      value={inputValues.transactionDescription}
                      onChange={handleInputChange}
                      onKeyDown={(e) =>
                        handleKeyDown(e, "transactionDescription")
                      }
                      placeholder="Transaction Description"
                      readOnly={!canUpdate}
                      className="w-full px-4 py-2 bg-gray-100 border  rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.transactionDescription.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-[var(--p-blue)] px-3 py-1 rounded-full"
                      >
                        <span className="text-sm text-white">{tag}</span>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() =>
                              removeTag("transactionDescription", index)
                            }
                            className="ml-2 text-black hover:text-white"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-start">
                <div className="w-1/4 pt-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Reference
                  </label>
                </div>
                <div className="w-3/4">
                  <div className="relative">
                    <input
                      type="text"
                      name="reference"
                      value={inputValues.reference}
                      onChange={handleInputChange}
                      onKeyDown={(e) => handleKeyDown(e, "reference")}
                      placeholder="Reference"
                      readOnly={!canUpdate}
                      className="w-full px-4 py-2 bg-gray-100 border  rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.reference.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-[var(--p-blue)] px-3 py-1 rounded-full"
                      >
                        <span className="text-sm text-white">{tag}</span>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => removeTag("reference", index)}
                            className="ml-2 text-black hover:text-white"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Deposit Amount */}
              <div className="flex items-start">
                <div className="w-1/4 pt-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Deposit Amount
                  </label>
                </div>
                <div className="w-3/4">
                  <div className="relative">
                    <input
                      type="text"
                      name="depositAmount"
                      value={inputValues.depositAmount}
                      onChange={handleInputChange}
                      onKeyDown={(e) => handleKeyDown(e, "depositAmount")}
                      placeholder="Deposit Amount"
                      readOnly={!canUpdate}
                      className="w-full px-4 py-2 bg-gray-100 border  rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.depositAmount.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-[var(--p-blue)] px-3 py-1 rounded-full"
                      >
                        <span className="text-sm text-white">{tag}</span>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => removeTag("depositAmount", index)}
                            className="ml-2 text-black hover:text-white"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Withdrawal Amount */}
              <div className="flex items-start">
                <div className="w-1/4 pt-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Withdrawal Amount
                  </label>
                </div>
                <div className="w-3/4">
                  <div className="relative">
                    <input
                      type="text"
                      name="withdrawalAmount"
                      value={inputValues.withdrawalAmount}
                      onChange={handleInputChange}
                      onKeyDown={(e) => handleKeyDown(e, "withdrawalAmount")}
                      placeholder="Withdrawal Amount"
                      readOnly={!canUpdate}
                      className="w-full px-4 py-2 bg-gray-100 border  rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.withdrawalAmount.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-[var(--p-blue)] px-3 py-1 rounded-full"
                      >
                        <span className="text-sm text-white">{tag}</span>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => removeTag("withdrawalAmount", index)}
                            className="ml-2 text-black hover:text-white"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8">
                <button
                  type="button"
                  onClick={() => history.goBack()}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition duration-200"
                >
                  Cancel
                </button>
                {(mappingId ? canUpdate : canAdd) && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9eba33] font-medium transition duration-200"
                    disabled={saveStatus === "saving"}
                  >
                    {saveStatus === "saving" ? (
                      <span className="flex items-center">
                        <Loader className="animate-spin mr-2" size={16} />
                        Saving...
                      </span>
                    ) : (
                      "Save"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default BankAccountMapping;
