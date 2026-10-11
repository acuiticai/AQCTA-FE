"use client";

import { useState, useEffect } from "react";
import { usePurchaseContext } from "../../context/PurchaseContractContext";
import Select from "react-select";
import { countries } from "countries-list";
import DropdownWithAddNewFormSaleC from "@/components/DropdownWithAddNewFormSaleC";
import DropdownWithAddNewFormSaleCNOTextChange from "@/components/DropdownWithAddNewFormSaleCNOTextChange";
import axios from "axios";
import { FormInput, DropdownBasic } from "@/page-layouts";
import { formatAmount } from "@/components/formatAmount";
import worldPorts from "@/data/world-ports";
import { InputFieldWithLabel } from "@/page-layouts";
import {
  FiPackage,
  FiAward,
  FiBox,
  FiLayers,
  FiBarChart2,
  FiHash,
  FiDollarSign,
  FiPercent,
  FiMessageSquare,
  FiGlobe,
  FiMapPin,
  FiCalendar,
  FiFileText,
  FiTruck,
  FiCreditCard,
  FiInfo,
} from "react-icons/fi";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PurchaseProductSection = ({
  section,
  items = [],
  errors = {},
  onUpdate,
  onRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formulaText, setFormulaText] = useState("");
  const [calculationExample, setCalculationExample] = useState("");
  const [isQuantityMTSManuallySelected, setIsQuantityMTSManuallySelected] =
    useState(false);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loadingPaymentTerms, setLoadingPaymentTerms] = useState(false);

  const { selectedBusiness, commissionPerMTS } = usePurchaseContext();

  // Ensure section.commissionPerMTS is set from context if not already set
  useEffect(() => {
    if (!section.commissionPerMTS && commissionPerMTS) {
      onUpdate("commissionPerMTS", commissionPerMTS);
    }
    // eslint-disable-next-line
  }, [commissionPerMTS]);

  // Enhanced input change handler that can update multiple fields at once
  const handleInputChange = (name, value, additionalUpdates = {}) => {
    // Create a batch of updates
    const updates = { [name]: value, ...additionalUpdates };

    // Apply all updates at once
    Object.entries(updates).forEach(([key, val]) => {
      onUpdate(key, val);
    });

    // Special handling for fields that affect unit of container
    if (name === "quantityFCL" || name === "containerType") {
      updateUnitOfContainer(
        name === "quantityFCL" ? value : section.quantityFCL,
        name === "containerType" ? value : section.containerType
      );
    }
  };

  const customStyles = {
    control: (provided) => ({
      ...provided,
      borderRadius: "0.375rem",
      borderColor: "#E5E7EB",
      minHeight: "46px",
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
  };

  const fetchCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${selectedBusiness}`
      );
      if (response.status === 200) {
        setCurrencies(response.data.data || []);
      } else {
        console.error("Failed to fetch currencies");
      }
    } catch (error) {
      console.error("❌ Error fetching currencies:", error);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const fetchPaymentTerms = async () => {
    setLoadingPaymentTerms(true);
    try {
      const response = await axios.post(
        `${Base_URL}/items/Payment Terms/get_all`,
        {
          business_id: selectedBusiness,
          FilterStatus: "active",
        }
      );
      if (response.data.success) {
        setPaymentTerms(response.data.data || []);
      } else {
        console.error("Failed to fetch payment terms");
      }
    } catch (error) {
      console.error("❌ Error fetching payment terms:", error);
    } finally {
      setLoadingPaymentTerms(false);
    }
  };

  // Fetch detailed item information when an item is selected
  const fetchItemDetails = async (itemId) => {
    if (!itemId) return;

    setLoading(true);
    try {
      const selectedItem = items.find(
        (item) => item._id === itemId || item.name === itemId
      );

      if (selectedItem) {
        setSelectedItemDetails(selectedItem);

        // Automatically update item name in the title
        onUpdate("title", selectedItem.name); // ✅ Title will show item name
        onUpdate("item", selectedItem.name); // ✅ Also store item name as a field

        autoFillItemFields(selectedItem);
      }
    } catch (error) {
      console.error("❌ Error processing item details:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (selectedItemDetails) {
      // Update all dependent fields from selectedItemDetails
      autoFillItemFields(selectedItemDetails);
    }
  }, [selectedItemDetails]);

  // Auto-fill fields based on selected item
  const autoFillItemFields = (item) => {
    const updates = {};

    if (item._id) updates.itemId = item._id.toString();
    if (item.name) updates.title = item.name;
    if (item.grade) updates.grade = item.grade;
    if (item.remarks) updates.remarks = item.remarks;
    if (item.container_type) {
      updates.containerType = item.container_type;

      if (item.container_type === "20'GP") updates.fclSize = "20ft";
      else if (item.container_type === "40'HC") updates.fclSize = "40ft HC";
      else if (item.container_type.includes("40")) updates.fclSize = "40ft";
    }
    if (item.packing) updates.packing = item.packing;

    if (
      !section.quantityMTS &&
      item.quantity_MTS &&
      Array.isArray(item.quantity_MTS) &&
      item.quantity_MTS.length === 1
    ) {
      const numericValue = Number.parseFloat(
        item.quantity_MTS[0].replace(/[^0-9.]/g, "")
      );
      updates.quantityMTS = numericValue.toString();
    }

    if (
      item.No_of_Packages &&
      Array.isArray(item.No_of_Packages) &&
      item.No_of_Packages.length === 1
    ) {
      updates.No_of_Packages = item.No_of_Packages[0];

      const packageCount = Number.parseInt(
        item.No_of_Packages[0].split(" ")[0]
      );

      const weightMatch = item.packing?.match(/(\d+\.\d+)MTS/);
      if (weightMatch && weightMatch[1]) {
        const weightPerPallet = Number.parseFloat(weightMatch[1]);
        updates.containerWeight = (weightPerPallet * packageCount).toString();
      }
    }

    // Set default quantityFCL if empty
    if (!section.quantityFCL) {
      updates.quantityFCL = "1";
    }

    // Update section with all collected updates
    Object.entries(updates).forEach(([key, value]) => {
      onUpdate(key, value);
    });

    // After fields updated, update Unit of Container
    updateUnitOfContainer(
      updates.quantityFCL || section.quantityFCL || "1",
      updates.containerType || section.containerType
    );

    // Calculate formula & total quantity after a slight delay to ensure state updates
    setTimeout(() => {
      calculateFormula(
        updates.containerType || section.containerType,
        updates.packing || section.packing,
        updates.No_of_Packages || section.No_of_Packages
      );

      if (
        updates.containerWeight &&
        (updates.quantityFCL || section.quantityFCL)
      ) {
        calculateTotalQuantity(
          updates.quantityFCL || section.quantityFCL,
          updates.containerWeight
        );
      }
    }, 0);
  };

  // Calculate total quantity based on formula
  const calculateTotalQuantity = (
    fcl = section.quantityFCL,
    containerWeight = section.containerWeight
  ) => {
    // If a saved value exists, never override it with containerWeight
    if (section.quantityMTS) {
      return;
    }
    if (!fcl || !containerWeight || isQuantityMTSManuallySelected) {
      return;
    }

    const fclValue = Number.parseFloat(fcl);
    const containerWeightValue = Number.parseFloat(containerWeight);

    if (!isNaN(fclValue) && !isNaN(containerWeightValue)) {
      const totalQuantity = fclValue * containerWeightValue;
      onUpdate("quantityMTS", totalQuantity.toFixed(2));
    }
  };

  // Update unit of container directly based on FCL and container type
  const updateUnitOfContainer = (
    fcl = section.quantityFCL,
    containerType = section.containerType
  ) => {
    if (!containerType) return;

    const fclValue = fcl || "1";
    const unitOfContainer = `${fclValue}X${containerType}`;

    onUpdate("unitOfContainer", unitOfContainer);
  };

  // Calculate formula based on container type, packing, and number of packages
  const calculateFormula = (containerType, packing, No_of_Packages) => {
    if (!containerType || !packing || !No_of_Packages) {
      setFormulaText("");
      setCalculationExample("");
      return;
    }

    const formula =
      "Formula: Qty Per Mts X Units of Container = Total Quantity (MTS)";
    let example = "";

    // Extract the number from No_of_Packages (assuming format like "16 PALLET")
    const packagesNumber = Number.parseInt(No_of_Packages.split(" ")[0]);

    // Extract weight per pallet from packing string if available
    let mtsPerPallet = 1.26; // Default value
    const weightMatch = packing.match(/(\d+\.\d+)MTS/);
    if (weightMatch && weightMatch[1]) {
      mtsPerPallet = Number.parseFloat(weightMatch[1]);
    }

    // Get FCL quantity
    const fcl = section.quantityFCL || "1";

    if (containerType === "20'GP" && packing.includes("SHRINKWRAPPED")) {
      // Natural Rubber formula
      example = `Eg: Calculation for ${fcl}x20'GP = ${(
        mtsPerPallet * packagesNumber
      ).toFixed(2)}mts x ${fcl}'fcl = ${(
        mtsPerPallet *
        packagesNumber *
        Number(fcl)
      ).toFixed(2)}mts`;
    } else if (containerType === "40'HC" && packing.includes("WOODEN BOX")) {
      // Synthetic Rubber formula
      example = `Eg: Calculation for ${fcl}x40'HC = ${(
        mtsPerPallet * packagesNumber
      ).toFixed(2)}mts x ${fcl}'fcl = ${(
        mtsPerPallet *
        packagesNumber *
        Number(fcl)
      ).toFixed(2)}mts`;
    } else if (containerType === "40'HC" && packing.includes("SMALL BAGS")) {
      // Carbon Black Small Bags formula
      const totalMts = section.quantityMTS || 0;
      const mtsPerFcl = totalMts / Number(fcl);
      example = `Eg: Calculation for ${fcl}x40'HC = ${mtsPerFcl.toFixed(
        2
      )}mts x ${fcl}'fcl = ${totalMts.toFixed(2)}mts`;
    } else if (containerType === "40'HC" && packing.includes("JUMBO BAGS")) {
      // Carbon Black Jumbo Bags formula
      const totalMts = section.quantityMTS || 0;
      const mtsPerFcl = totalMts / Number(fcl);
      example = `Eg: Calculation for ${fcl}x40'HC = ${mtsPerFcl.toFixed(
        2
      )}mts x ${fcl}'fcl = ${totalMts.toFixed(2)}mts`;
    } else {
      // Generic formula for other combinations
      const containerWeight =
        section.containerWeight || (mtsPerPallet * packagesNumber).toFixed(2);
      example = `Eg: Calculation for ${fcl}x${containerType} = ${containerWeight}mts x ${fcl}'fcl = ${(
        Number.parseFloat(containerWeight) * Number(fcl)
      ).toFixed(2)}mts`;
    }

    setFormulaText(formula);
    setCalculationExample(example);
  };

  // Fetch item details for existing contract data
  const fetchExistingItemDetails = async () => {
    if (!section.itemId || !items || items.length === 0) return;

    const selectedItem = items.find((item) => item._id === section.itemId);
    if (selectedItem) {
      setSelectedItemDetails(selectedItem);

      // If we have container type and FCL but no unit of container, calculate it
      if (
        section.containerType &&
        section.quantityFCL &&
        !section.unitOfContainer
      ) {
        updateUnitOfContainer(section.quantityFCL, section.containerType);
      }

      // If we have packing, container type and No_of_Packages but no formula, calculate it
      if (
        section.containerType &&
        section.packing &&
        section.No_of_Packages &&
        !formulaText
      ) {
        calculateFormula(
          section.containerType,
          section.packing,
          section.No_of_Packages
        );
      }
    }
  };

  useEffect(() => {
    if (selectedBusiness) {
      fetchCurrencies();
      fetchPaymentTerms();
    }
  }, [selectedBusiness]);

  // Initial load - fetch item details for existing contract
  useEffect(() => {
    if (items.length > 0 && section.itemId) {
      fetchExistingItemDetails();
      // For existing contracts, assume quantityMTS was manually selected if it exists
      if (section.quantityMTS) {
        setIsQuantityMTSManuallySelected(true);
      }
    }
  }, [items, section.itemId]);

  // When item is selected
  useEffect(() => {
    if (section.itemId) {
      fetchItemDetails(section.itemId);
      // Reset manual selection flag when item changes
      setIsQuantityMTSManuallySelected(false);
    }
  }, [section.itemId]);

  // Calculate total value when price or quantity changes
  useEffect(() => {
    if (section.price && section.quantityMTS) {
      const price = Number(section.price);
      const qty = Number(section.quantityMTS.replace(/[^0-9.]/g, "")); // Remove non-numeric characters like "MTS"
      const fcl = section.quantityFCL;
      if (!isNaN(price) && !isNaN(qty)) {
        const total = price * qty * fcl;
        console.log("total", total);
        onUpdate("totalValue", parseFloat(total).toFixed(2));
        updateAmountInSelectedCurrency(
          parseFloat(total).toFixed(2),
          section.selectedCurrency,
          section.conversionRate
        );
      }
    }
  }, [section.price, section.quantityMTS, section.quantityFCL]);

  // Update amount in selected currency when currency or conversion rate changes
  useEffect(() => {
    if (
      section.totalValue &&
      section.selectedCurrency &&
      section.conversionRate
    ) {
      updateAmountInSelectedCurrency(
        section.totalValue,
        section.selectedCurrency,
        section.conversionRate
      );
    }
  }, [section.selectedCurrency, section.conversionRate]);

  // Calculate quantity MTS when FCL and container weight change
  useEffect(() => {
    calculateTotalQuantity();
  }, [
    section.quantityFCL,
    section.containerWeight,
    isQuantityMTSManuallySelected,
  ]);

  // Update unit of container when FCL changes
  useEffect(() => {
    if (section.quantityFCL && section.containerType) {
      updateUnitOfContainer();
    }
  }, [section.quantityFCL, section.containerType]);

  // Calculate and save totalQuantity when quantityMTS or quantityFCL changes
  useEffect(() => {
    if (section.quantityMTS && section.quantityFCL) {
      const quantityMTS = Number(section.quantityMTS) || 0;
      const quantityFCL = Number(section.quantityFCL) || 0;
      if (quantityMTS > 0 && quantityFCL > 0) {
        const calculatedTotal = (quantityMTS * quantityFCL).toFixed(2);
        // Only update if the calculated value is different from current value
        if (section.totalQuantity !== calculatedTotal) {
          onUpdate("totalQuantity", calculatedTotal);
        }
      }
    } else {
      // Clear totalQuantity if either field is empty (only if it's not already empty)
      if (section.totalQuantity && section.totalQuantity !== "") {
        onUpdate("totalQuantity", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.quantityMTS, section.quantityFCL]);

  // Recalculate formula when relevant fields change
  useEffect(() => {
    if (section.containerType && section.packing && section.No_of_Packages) {
      calculateFormula(
        section.containerType,
        section.packing,
        section.No_of_Packages
      );
    }
  }, [
    section.containerType,
    section.packing,
    section.No_of_Packages,
    section.quantityFCL,
  ]);

  useEffect(() => {
    const quantityOptions = getQuantityOptions();

    if (
      quantityOptions.length > 0 &&
      (!section.quantityMTS || section.quantityMTS === "0.00")
    ) {
      const defaultValue = quantityOptions[0].value;
      onUpdate("quantityMTS", defaultValue);
    }
  }, [selectedItemDetails]);

  useEffect(() => {
    // Calculate total agent commission when commission, quantityMTS, or quantityFCL changes
    const commission = Number(commissionPerMTS) || 0;
    const quantityMTS = Number(section.quantityMTS) || 0;
    const quantityFCL = Number(section.quantityFCL) || 0;
    const totalAgentCommission = commission * quantityMTS * quantityFCL;
    onUpdate(
      "totalAgentCommission",
      totalAgentCommission ? totalAgentCommission.toFixed(2) : ""
    );
    console.log(
      "commissionPerMTS:",
      commissionPerMTS,
      "quantityMTS:",
      section.quantityMTS,
      "quantityFCL:",
      section.quantityFCL,
      "totalAgentCommission:",
      section.totalAgentCommission
    );
  }, [commissionPerMTS, section.quantityMTS, section.quantityFCL]);

  const itemOptions = items.map((item) => ({
    value: item._id.toString(),
    label: `${item.name} (${item.grade}) - ${item.packing} - ${item.remarks}`,
  }));

  // Prepare currency dropdown options from fetched currencies
  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.symbol} (${currency.prefix})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  // Prepare payment terms dropdown options from fetched payment terms
  const paymentTermsOptions = paymentTerms.map((term) => ({
    value: term.name,
    label:
      term.depositPercentage !== undefined && term.depositPercentage !== null
        ? `${term.name} (${term.depositPercentage}% deposit)`
        : term.name,
  }));

  const handleCurrencyChange = (selectedOption) => {
    onUpdate("selectedCurrency", selectedOption);
    onUpdate(
      "conversionRate",
      currencyOptions.find((option) => option.value === selectedOption)
        .conversionRate
    );
    updateAmountInSelectedCurrency(
      section.totalValue,
      selectedOption,
      selectedOption.conversionRate
    );
  };

  const handlePaymentTermsChange = (selectedOption) => {
    const selectedPaymentTerm = paymentTerms.find(
      (term) => term.name === selectedOption
    );

    if (selectedPaymentTerm) {
      // Update the payment terms field
      onUpdate("paymentTerms", selectedOption);

      // Auto-update deposit percentage if available
      if (
        selectedPaymentTerm.depositPercentage !== undefined &&
        selectedPaymentTerm.depositPercentage !== null
      ) {
        onUpdate("deposit", selectedPaymentTerm.depositPercentage.toString());
      }
    } else {
      // If no matching payment term found, just update the field
      onUpdate("paymentTerms", selectedOption);
    }
  };

  const handleConversionRateChange = (value) => {
    const rate = Number.parseFloat(value);
    onUpdate("conversionRate", rate);
    updateAmountInSelectedCurrency(
      section.totalValue,
      section.selectedCurrency,
      rate
    );
  };

  const updateAmountInSelectedCurrency = (
    totalValue,
    selectedCurrency,
    conversionRate
  ) => {
    if (totalValue && conversionRate) {
      const amount = Number.parseFloat(totalValue) * conversionRate;
      onUpdate("amountInSelectedCurrency", amount.toFixed(2));
    }
  };

  // Prepare quantity options from selected item
  const getQuantityOptions = () => {
    let options = [];
    if (
      selectedItemDetails &&
      selectedItemDetails.quantity_MTS &&
      Array.isArray(selectedItemDetails.quantity_MTS)
    ) {
      options = selectedItemDetails.quantity_MTS.map((qty) => {
        const numericValue = Number.parseFloat(qty.replace(/[^0-9.]/g, ""));
        return {
          value: numericValue.toString(),
          label: qty,
        };
      });
    }

    // Ensure the saved section.quantityMTS appears as an option so the select shows it on initial edit
    if (section.quantityMTS) {
      const exists = options.some(
        (opt) =>
          Number(opt.value).toFixed(2) ===
          Number(section.quantityMTS).toFixed(2)
      );
      if (!exists) {
        options = [
          {
            value: section.quantityMTS.toString(),
            label: `${Number(section.quantityMTS).toFixed(2)} MTS`,
          },
          ...options,
        ];
      }
    }

    return options;
  };

  // Prepare packages options from selected item
  const getPackagesOptions = () => {
    if (
      selectedItemDetails &&
      selectedItemDetails.No_of_Packages &&
      Array.isArray(selectedItemDetails.No_of_Packages)
    ) {
      return selectedItemDetails.No_of_Packages.map((pkg) => ({
        value: pkg,
        label: pkg,
      }));
    }
    return [];
  };

  // Handle FCL quantity change with immediate unit of container update
  const handleFCLChange = (value) => {
    // Update FCL and immediately update unit of container
    handleInputChange("quantityFCL", value);

    // Also recalculate total quantity
    if (value && section.containerWeight) {
      calculateTotalQuantity(value, section.containerWeight);
    }
  };

  return (
    <div className="rounded-lg">
      {isExpanded && (
        <div className="space-y-3">
          <FormInput
            type="select"
            label="Item"
            name="item"
            required={true}
            placeholder="Select Item"
            options={itemOptions}
            value={section.itemId?.toString() || ""}
            onChange={(value) => handleInputChange("itemId", value)}
            error={errors.item || errors.title}
            shouldShowError={!!(errors.item || errors.title)}
            labelWidth="w-[180px]"
            icon={<FiPackage />}
          />

          {loading && (
            <div className="flex justify-center py-2">
              <div className="w-6 h-6 border-2 border-t-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Formula Display */}
          {/* {formulaText && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="font-medium text-blue-800">{formulaText}</p>
              {calculationExample && (
                <p className="text-blue-600 mt-1">{calculationExample}</p>
              )}
            </div>
          )} */}

          {/* Grade */}
          <FormInput
            type="text"
            label="Grade"
            disabled={true}
            name="grade"
            placeholder="Grade"
            value={section.grade || ""}
            onChange={(e) => handleInputChange("grade", e.target.value)}
            labelWidth="w-[180px]"
            icon={<FiAward />}
          />

          {/* Container Type */}
          <FormInput
            type="text"
            label="Container Type"
            disabled={true}
            name="containerType"
            placeholder="Container Type"
            value={section.containerType || ""}
            onChange={(e) => handleInputChange("containerType", e.target.value)}
            labelWidth="w-[180px]"
            icon={<FiBox />}
          />

          {/* Unit of Container - Read-only field that shows the combined value */}
          <FormInput
            type="text"
            label="Unit of Container"
            name="unitOfContainer"
            placeholder="Unit of Container"
            value={section.unitOfContainer || ""}
            disabled={true}
            labelWidth="w-[180px]"
            icon={<FiLayers />}
          />

          <InputFieldWithLabel
            type="select"
            label="Quantity (MTS)"
            name="quantityMTS"
            required={true}
            error={errors.quantityMTS}
            shouldShowError={!!errors.quantityMTS}
            icon={<FiBarChart2 />}
            Input={
              <DropdownBasic
                options={getQuantityOptions()}
                placeholder="Select Quantity"
                value={
                  getQuantityOptions().find(
                    (opt) =>
                      Number(opt.value).toFixed(2) ===
                      Number(section.quantityMTS).toFixed(2)
                  )?.value || ""
                }
                error={errors.quantityMTS}
                shouldShowError={!!errors.quantityMTS}
                onChange={(value) => {
                  handleInputChange("quantityMTS", value);
                  setIsQuantityMTSManuallySelected(true);
                }}
              />
            }
          />

          <FormInput
            type="number"
            label="Quantity (FCL)"
            name="quantityFCL"
            required={true}
            placeholder="Quantity (FCL)"
            value={section.quantityFCL || ""}
            onChange={(e) => handleFCLChange(e.target.value)}
            error={errors.quantityFCL}
            shouldShowError={!!errors.quantityFCL}
            labelWidth="w-[180px]"
            icon={<FiBarChart2 />}
          />

          <FormInput
            type="number"
            label="Total Quantity"
            name="totalQuantity"
            required={true}
            value={
              section.quantityMTS && section.quantityFCL
                ? (
                    Number(section.quantityMTS) * Number(section.quantityFCL)
                  ).toFixed(2)
                : ""
            }
            disabled
            error={errors.totalQuantity}
            shouldShowError={!!errors.totalQuantity}
            labelWidth="w-[180px]"
            icon={<FiBarChart2 />}
          />

          {/* <FormInput
            type="number"
            label="Container Weight"
            name="containerWeight"
            placeholder="Container Weight (Tons)"
            value={section.containerWeight || ""}
            onChange={(e) =>
              handleInputChange("containerWeight", e.target.value)
            }
            labelWidth="w-[180px]"
          /> */}

          {/* <FormInput
            type="select"
            label="FCL Size"
            name="fclSize"
            placeholder="FCL Size"
            options={[
              { label: "20ft", value: "20ft" },
              { label: "40ft", value: "40ft" },
              { label: "40ft HC", value: "40ft HC" },
            ]}
            value={section.fclSize || ""}
            onChange={(value) => handleInputChange("fclSize", value)}
            labelWidth="w-[180px]"
          /> */}

          {/* No. of Packages - Dropdown with options from selected item */}
          <FormInput
            type="select"
            label="No. of Packages"
            name="No_of_Packages"
            required={true}
            placeholder="Select Packages"
            options={getPackagesOptions()}
            value={section.No_of_Packages || ""}
            onChange={(value) => handleInputChange("No_of_Packages", value)}
            error={errors.No_of_Packages}
            shouldShowError={!!errors.No_of_Packages}
            labelWidth="w-[180px]"
            icon={<FiHash />}
          />

          <FormInput
            type="number"
            label="Price"
            name="price"
            required={true}
            placeholder="Price"
            min="0.01"
            step="0.01"
            value={section.price ? section.price : ""}
            onChange={(e) => {
              const value = e.target.value;
              // Only allow positive numbers greater than 0
              if (value === "" || (value && Number(value) > 0)) {
                handleInputChange("price", value);
              }
            }}
            error={errors.price}
            shouldShowError={!!errors.price}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />
          <FormInput
            type="number"
            label="Agent Commission (P/MTS)"
            name="commissionPerMTS"
            value={commissionPerMTS || ""}
            disabled
            labelWidth="w-[180px]"
            icon={<FiPercent />}
          />
          <FormInput
            type="number"
            label="Total Agent Commission"
            name="totalAgentCommission"
            value={section.totalAgentCommission || ""}
            disabled
            labelWidth="w-[180px]"
            icon={<FiPercent />}
          />

          <FormInput
            type="number"
            label="Additional Charges"
            name="additionalCharges"
            placeholder="Additional Charges (if any)"
            value={section.additionalCharges || ""}
            onChange={(e) =>
              handleInputChange("additionalCharges", e.target.value)
            }
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          {/* Payment Terms Dropdown */}
          <FormInput
            type="select"
            label="Payment Terms"
            required={true}
            labelWidth="w-[180px]"
            options={paymentTermsOptions}
            value={section.paymentTerms}
            onChange={(value) => handlePaymentTermsChange(value)}
            error={errors.paymentTerms}
            shouldShowError={!!errors.paymentTerms}
            placeholder={
              loadingPaymentTerms
                ? "Loading payment terms..."
                : "Select Payment Terms"
            }
            icon={<FiCreditCard />}
          />

          <FormInput
            type="number"
            label="Deposit %"
            name="deposit"
            placeholder="Deposit % (25%)"
            value={section.deposit || ""}
            onChange={(e) => handleInputChange("deposit", e.target.value)}
            labelWidth="w-[180px]"
            icon={<FiPercent />}
          />

          <FormInput
            type="number"
            label="Total Value (USD)"
            name="totalValue"
            required={true}
            value={section.totalValue || ""}
            disabled
            error={errors.totalValue}
            shouldShowError={!!errors.totalValue}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          <FormInput
            type="select"
            label="Select Currency"
            required={true}
            labelWidth="w-[180px]"
            options={currencyOptions}
            value={section.selectedCurrency}
            onChange={(value) => handleCurrencyChange(value)}
            error={errors.selectedCurrency}
            shouldShowError={!!errors.selectedCurrency}
            placeholder={
              loadingCurrencies ? "Loading currencies..." : "Select a currency"
            }
            icon={<FiDollarSign />}
          />

          <FormInput
            type="number"
            label="Conversion Rate"
            name="conversionRate"
            placeholder="1 USD = X Selected Currency"
            value={parseFloat(section.conversionRate) || ""}
            onChange={(e) => handleConversionRateChange(e.target.value)}
            labelWidth="w-[180px]"
            disabled={false}
            icon={<FiDollarSign />}
          />

          <FormInput
            type="text"
            label="Amount in Selected Currency"
            name="amountInSelectedCurrency"
            value={
              section.amountInSelectedCurrency
                ? `${formatAmount(section.amountInSelectedCurrency) || ""} ${
                    section.selectedCurrency?.value || ""
                  }`
                : ""
            }
            disabled
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          <FormInput
            type="text"
            label="Remarks"
            name="remarks"
            placeholder="Enter Remarks"
            value={section.remarks || ""}
            onChange={(e) => handleInputChange("remarks", e.target.value)}
            labelWidth="w-[180px]"
            icon={<FiMessageSquare />}
          />

          <FormInput
            type="number"
            label="Breakeven Value"
            name="breakEvenValue"
            placeholder="Enter Breakeven Value"
            value={section.breakEvenValue || ""}
            onChange={(e) =>
              handleInputChange("breakEvenValue", e.target.value)
            }
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          {/* Remove the input for commissionPerMTS, and instead use basicInfo.commissionPerMTS */}
          {/* <FormInput
            type="number"
            label="Agent Commission (P/MTS)"
            name="commissionPerMTS"
            placeholder="Enter Agent Commission per MTS"
            value={section.commissionPerMTS || ""}
            onChange={(e) => handleInputChange("commissionPerMTS", e.target.value)}
            labelWidth="w-[180px]"
          /> */}

          {/* <FormInput
            type="number"
            label="Agent Commission (P/MTS)"
            name="commissionPerMTS"
            value={basicInfo?.commissionPerMTS || ""}
            disabled
            labelWidth="w-[180px]"
          /> */}
          <FormInput
            type="select"
            label="Country of Origin"
            name="origin_country"
            required={true}
            placeholder="Select Country of Origin"
            options={Object.entries(countries).map(([code, country]) => ({
              value: country.name,
              label: country.name,
            }))}
            value={section.origin_country || ""}
            onChange={(value) => handleInputChange("origin_country", value)}
            error={errors.origin_country}
            shouldShowError={!!errors.origin_country}
            labelWidth="w-[180px]"
            icon={<FiGlobe />}
          />
          <FormInput
            type="select"
            label="Port of Loading"
            name="portOfLanding"
            required={true}
            placeholder="Port of Loading"
            options={[
              { label: "ANY PORT", value: "Any", key: "Any", first: true },
              // { label: "Any", value: "Any", key: "Any" },
              ...worldPorts.map((port) => ({
                label: `${port.name} (${port.country})`,
                value: port.id,
                key: port.id,
              })),
            ]}
            value={section.portOfLanding || ""}
            onChange={(value) => handleInputChange("portOfLanding", value)}
            error={errors.portOfLanding}
            shouldShowError={!!errors.portOfLanding}
            labelWidth="w-[180px]"
            icon={<FiMapPin />}
          />

          <FormInput
            type="select"
            label="Port of Destination"
            name="portOfDestination"
            required={true}
            placeholder="Port of Destination"
            options={[
              { label: "ANY PORT", value: "Any", key: "Any", first: true },
              ...worldPorts.map((port) => ({
                label: `${port.name} (${port.country})`,
                value: port.id,
                key: port.id,
              })),
            ]}
            value={section.portOfDestination || ""}
            onChange={(value) => handleInputChange("portOfDestination", value)}
            error={errors.portOfDestination}
            shouldShowError={!!errors.portOfDestination}
            labelWidth="w-[180px]"
            icon={<FiMapPin />}
          />

          <FormInput
            type="date"
            label="Estimated Time of Departure"
            name="estimatedDeparture"
            placeholder="Select Estimated Departure Date"
            value={section.estimatedDeparture || ""}
            onChange={(value) => handleInputChange("estimatedDeparture", value)}
            labelWidth="w-[180px]"
            icon={<FiCalendar />}
          />

          {/* Shipping Terms - Enhanced UI */}
          <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3 mb-2 shadow-sm">
            <FiTruck
              className="text-blue-500 text-2xl"
              title="Shipping Terms"
            />
            <div className="flex-1">
              <DropdownWithAddNewFormSaleC
                label={
                  <span className="font-semibold text-blue-700 flex items-center gap-1">
                    Shipping Terms{" "}
                    <FiInfo
                      className="text-blue-400"
                      title="Select or add shipping terms"
                    />
                  </span>
                }
                name="shippingTerms"
                fieldType="html"
                selectedValue={section.shippingTerms}
                onChange={(value) => onUpdate("shippingTerms", value)}
                fetchUrl={`${Base_URL}/items/Shipping Terms/get_all`}
                addUrl={`${Base_URL}/items/Shipping Terms/add`}
                businessId={selectedBusiness}
                placeholder="Select Shipping Terms"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseProductSection;
