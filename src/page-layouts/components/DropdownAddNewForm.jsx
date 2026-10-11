import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { CustomModal, DropdownBasic, FormInput } from "@/page-layouts/index";
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
  addHandle,
  businessId,
  business_ids, // Add support for multiple business IDs
  selectedValue = "",
  currentValue = "", // Add support for current item value
  onListUpdate,
  isMulti = false,
  onChange,
  className = "",
  required = false,
  error = "",
  shouldShowError = false,
  fetchMethod = "post",
}) => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const buttonColor = useButtonColor();

  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    if (!businessId && !business_ids) return;

    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        // Use business_ids if available, otherwise fall back to businessId
        const businessParam = business_ids && Array.isArray(business_ids) ? 
          { business_ids } : 
          { business_id: businessId };

        const response = await axios[fetchMethod](fetchUrl, {
          ...businessParam,
          FilterStatus: "active",
        });
        if (response.data.success) {
          // Deduplicate records by name to avoid showing same item multiple times
          let uniqueOptions = response.data.data;
          if (business_ids && Array.isArray(business_ids) && business_ids.length > 1) {
            const nameGroups = {};
            
            // Group records by name
            response.data.data.forEach(record => {
              if (!nameGroups[record.name]) {
                nameGroups[record.name] = [];
              }
              nameGroups[record.name].push(record);
            });
            
            // For each group, select the best record (prefer Active status, then most recent)
            uniqueOptions = Object.values(nameGroups).map(group => {
              if (group.length === 1) {
                return group[0]; // Only one record with this name
              }
              
              // Multiple records with same name - select the best one
              let bestRecord = group[0];
              
              // First priority: prefer Active status
              const activeRecords = group.filter(r => r.status === 'Active');
              if (activeRecords.length > 0) {
                bestRecord = activeRecords[0];
              }
              
              // Second priority: prefer most recent update
              group.forEach(record => {
                if (record.updatedAt && bestRecord.updatedAt) {
                  if (new Date(record.updatedAt) > new Date(bestRecord.updatedAt)) {
                    bestRecord = record;
                  }
                }
              });
              
              return bestRecord;
            });
            
            console.log(`Frontend deduplication: ${response.data.data.length} -> ${uniqueOptions.length} unique options`);
          }
          
          // Ensure currentValue is included in options if it exists and is not already present
          if (currentValue && currentValue.trim !== undefined) {
            // Handle both single values and arrays
            const valuesToCheck = Array.isArray(currentValue) ? currentValue : [currentValue];
            
            valuesToCheck.forEach(value => {
              if (value && value.trim !== undefined && value.trim() !== "") {
                const valueExists = uniqueOptions.some(option => 
                  option.name === value || option.value === value
                );
                
                if (!valueExists) {
                  // Add currentValue as a temporary option so it shows up in the dropdown
                  uniqueOptions.unshift({
                    name: value,
                    value: value,
                    _id: `temp_${Date.now()}_${Math.random()}`,
                    status: "Active",
                    isCurrentValue: true, // Flag to identify this as the current value
                    business_id: business_ids && Array.isArray(business_ids) ? business_ids[0] : businessId
                  });
                  console.log(`Added currentValue "${value}" to options`);
                }
              }
            });
          }
          
          setOptions(uniqueOptions);
          onListUpdate?.(uniqueOptions);
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
  }, [fetchUrl, businessId, business_ids]);

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
      let response;
      if (addHandle) {
        response = await addHandle(newOption);
      } else {
        // If multiple businesses are selected, add to all of them
        if (business_ids && Array.isArray(business_ids) && business_ids.length > 1) {
          const addPromises = business_ids.map(businessId =>
            axios.post(
              addUrl,
              { name: newOption, status: "active", business_id: businessId },
              { headers }
            )
          );
          
          const responses = await Promise.all(addPromises);
          response = responses[0]; // Use first response for success check
          
          if (responses.every(r => r.data.success)) {
            notifySuccess(`"${newOption}" added to all ${business_ids.length} businesses successfully!`);
          } else {
            notifySuccess(`"${newOption}" added to some businesses. Some may have failed.`);
          }
        } else {
          // Single business - use existing logic
          const businessIdToUse = business_ids && Array.isArray(business_ids) ? business_ids[0] : businessId;
          response = await axios.post(
            addUrl,
            { name: newOption, status: "active", business_id: businessIdToUse },
            { headers }
          );
        }
      }
      
      console.debug("response", response);
      if (addHandle || response.data.success) {
        if (!business_ids || !Array.isArray(business_ids) || business_ids.length <= 1) {
          notifySuccess(`"${newOption}" added successfully!`);
        }

        const updatedOptions = [...options, { name: newOption }];
        setOptions(updatedOptions);
        onListUpdate?.(updatedOptions);
        onChange(newOption, response.data);
        setNewOption("");
        setIsModalOpen(false);
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
    <div className={`${className} dropdown-add-modal-wrapper`}>
      <DropdownBasic
        value={selectedValue}
        onChange={(selected) => {
          const option = options.find((item) => item.name === selected);

          if (isMulti) {
            console.log("selected,", selected);
            if (selected?.at?.(-1) === "add_new") {
              setIsModalOpen(true);
            } else {
              onChange(selected, option);
            }
          } else {
            if (selected === "add_new") {
              setIsModalOpen(true);
            } else {
              onChange(selected, option);
            }
          }
        }}
        options={[
          ...options.map((item) => ({
            value: item.name,
            label: item.name,
            ...item,
          })),
          {
            value: "add_new",
            label: `➕ ${t("Add New")}`,
            last: true,
            is_disabled: true,
          },
        ]}
        placeholder={placeholder}
        isMulti={isMulti}
        disabled={(!businessId && !business_ids) || isLoading}
        className={className}
        error={error}
        shouldShowError={shouldShowError}
      />

      {/* Modal for Adding New Option */}
      <CustomModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        width="350px"
        className="mx-auto dropdown-add-modal"
        title={`${t("Add New")} ${label}`}
        actions={[
          {
            label: t("Cancel"),
            onClick: () => setIsModalOpen(false),
          },
          {
            label: t("Save"),
            onClick: () => handleAddNew(),
          },
        ]}
      >
        <FormInput
          className="mt-4"
          inputProps={{
            value: newOption,
            onChange: (e) => setNewOption(e.target.value),
          }}
          direction="column"
          label={`Enter ${label} ${t("category.name")}`}
          required
        />
      </CustomModal>
    </div>
  );
};

export default DropdownAddNewForm;
