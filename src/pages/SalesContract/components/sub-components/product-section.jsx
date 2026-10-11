"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSalesContext } from "../../context/SalesContractContext";
import { InputFieldWithLabel } from "@/page-layouts";
import DropdownWithAddNewFormSaleC from "@/components/DropdownWithAddNewFormSaleC";
import DropdownWithAddNewFormSaleCNOTextChange from "@/components/DropdownWithAddNewFormSaleCNOTextChange";
import axios from "axios";
import { DropdownBasic } from "@/page-layouts";
import { formatAmount } from "@/components/formatAmount";
import {
  FiTruck,
  FiCreditCard,
  FiInfo,
  FiPackage,
  FiAward,
  FiBox,
  FiLayers,
  FiBarChart2,
  FiHash,
  FiDollarSign,
  FiPercent,
  FiMessageSquare,
  FiUser,
  FiFileText,
} from "react-icons/fi";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ProductSection = ({
  section,
  items = [],
  errors = {},
  onUpdate,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formulaText, setFormulaText] = useState("");
  const [calculationExample, setCalculationExample] = useState("");
  const [canFetchDetails, setCanFetchDetails] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loadingPaymentTerms, setLoadingPaymentTerms] = useState(false);
  const [forecastCostDescriptions, setForecastCostDescriptions] = useState([]);
  const [loadingForecastCostDesc, setLoadingForecastCostDesc] = useState(false);
  const [isQuantityMTSManuallySelected, setIsQuantityMTSManuallySelected] =
    useState(false);

  const { selectedBusiness, contractId, basicInfo } = useSalesContext();

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? "var(--p-blue)" : provided.borderColor,
      boxShadow: state.isFocused
        ? "0 0 0 2px var(--p-blue)"
        : provided.boxShadow,
      "&:hover": {
        borderColor: "var(--p-blue)",
      },
    }),
  };

  // Enhanced input change handler that can update multiple fields at once
  const handleInputChange = ({ name, value, additionalUpdates = {} }) => {
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

  const fetchForecastCostDescriptions = async () => {
    setLoadingForecastCostDesc(true);
    try {
      const response = await axios.post(
        `${Base_URL}/items/Forecast Cost Desc/get_all`,
        {
          business_id: selectedBusiness,
          FilterStatus: "active",
        }
      );
      if (response.data.success) {
        setForecastCostDescriptions(response.data.data || []);
      } else {
        console.error("Failed to fetch forecast cost descriptions");
      }
    } catch (error) {
      console.error("❌ Error fetching forecast cost descriptions:", error);
    } finally {
      setLoadingForecastCostDesc(false);
    }
  };

  // Fetch detailed item information when an item is selected
  const fetchItemDetails = async (itemId) => {
    if (!itemId) return;

    setLoading(true);
    try {
      // Match by _id or name
      console.log("Fetching item details for:", itemId);
      const selectedItem = items.find(
        (item) => item._id === itemId || item.name === itemId
      );
      console.log("Fetched item details:", selectedItem);
      if (selectedItem) {
        setSelectedItemDetails(selectedItem);
        onUpdate("title", selectedItem.name);
        onUpdate("item", selectedItem.name); // update item with name
        // Always call autoFillItemFields when item changes
        autoFillItemFields(selectedItem);
      }
    } catch (error) {
      console.error("❌ Error processing item details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill fields based on selected item
  const autoFillItemFields = (item) => {
    // Prepare all updates in a single batch
    const updates = {};

    // Update simple fields (strings and numbers)
    if (item._id) updates.itemId = item._id;
    if (item.name) updates.title = item.name;
    if (item.status) updates.status = item.status;
    if (item.price !== undefined) {
      // Don't auto-populate price - let it come from saved data
    }
    if (item.unit) updates.unit = item.unit;
    if (item.packing) updates.packing = item.packing;
    if (item.remarks) updates.remarks = item.remarks;
    if (item.forecasted_shipment_cost)
      updates.forecasted_shipment_cost = item.forecasted_shipment_cost;

    // Handle container type and related fields
    if (item.container_type) {
      updates.containerType = item.container_type;

      // Set FCL size based on container type
      if (item.container_type === "20'GP") {
        updates.fclSize = "20ft";
      } else if (item.container_type === "40'HC") {
        updates.fclSize = "40ft HC";
      } else if (item.container_type.includes("40")) {
        updates.fclSize = "40ft";
      }
    }

    // Handle array fields
    // Grade - if array with one item, select it
    if (item.grade) {
      updates.grade = item.grade;
    }

    // Quantity MTS - if array with one item, select it
    if (
      !section.quantityMTS &&
      item.quantity_MTS &&
      Array.isArray(item.quantity_MTS) &&
      item.quantity_MTS.length === 1
    ) {
      // Extract numeric value from string like "20.16MTS"
      const qtyString = item.quantity_MTS[0];
      const numericValue = Number.parseFloat(qtyString.replace(/[^0-9.]/g, ""));
      updates.quantityMTS = numericValue.toString();
    }

    // No. of Packages - if array with one item, select it
    if (
      item.No_of_Packages &&
      Array.isArray(item.No_of_Packages) &&
      item.No_of_Packages.length === 1
    ) {
      updates.No_of_Packages = item.No_of_Packages[0];

      // Extract the number from the package string (e.g., "16 PALLET" -> 16)
      const packageString = item.No_of_Packages[0];
      const packageCount = Number.parseInt(packageString.split(" ")[0]);

      // Calculate container weight based on packing and package count
      if (
        item.packing &&
        (item.packing.includes("SHRINKWRAPPED") ||
          item.packing.includes("WOODEN BOX"))
      ) {
        // Extract weight per pallet from packing string (e.g., "1.26MTS SHRINKWRAPPED PER PALLET")
        const weightMatch = item.packing.match(/(\d+\.\d+)MTS/);
        if (weightMatch && weightMatch[1]) {
          const weightPerPallet = Number.parseFloat(weightMatch[1]);
          updates.containerWeight = (weightPerPallet * packageCount).toString();
        }
      }
    }

    // Set a default quantityFCL value of 1 if not already set
    if (!section.quantityFCL) {
      updates.quantityFCL = "1";
    }

    // Apply all updates at once
    Object.entries(updates).forEach(([key, value]) => {
      onUpdate(key, value);
    });

    // Update unit of container after all other updates
    updateUnitOfContainer(
      updates.quantityFCL || section.quantityFCL || "1",
      updates.containerType || section.containerType
    );

    // Calculate formula and total quantity after all updates
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

  // Calculate total quantity based on quantityFCL * quantityMTS
  const calculateTotalQuantityFromFCLAndMTS = (
    fcl = section.quantityFCL,
    mts = section.quantityMTS
  ) => {
    if (!fcl || !mts) {
      return;
    }

    const fclValue = Number.parseFloat(fcl);
    const mtsValue = Number.parseFloat(mts);

    if (!isNaN(fclValue) && !isNaN(mtsValue)) {
      const totalQuantity = fclValue * mtsValue;
      onUpdate("totalQuantity", totalQuantity.toFixed(2));
    }
  };

  // Fetch commissionPerMTS from basic info
  const [commissionPerMTS, setCommissionPerMTS] = useState("");

  useEffect(() => {
    const fetchCommissionPerMTS = async () => {
      if (!contractId) return;
      try {
        const response = await axios.get(
          `${Base_URL}/sales-contracts/${contractId}`
        );
        const contract = response.data;
        if (contract?.basicInfo?.commissionPerMTS) {
          setCommissionPerMTS(contract.basicInfo.commissionPerMTS);
        }
      } catch (error) {
        console.error("Error fetching commissionPerMTS:", error);
      }
    };
    fetchCommissionPerMTS();
  }, [contractId]);

  useEffect(() => {
    // Calculate total agent commission
    const totalAgentCommission =
      Number(commissionPerMTS) *
      Number(section.quantityMTS || 0) *
      Number(section.quantityFCL || 0);
    onUpdate("totalAgentCommission", totalAgentCommission.toFixed(2));
  }, [
    commissionPerMTS,
    section.quantityMTS,
    section.quantityFCL,
    section.price,
  ]);

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

  //   const calculateFormula = (containerType, packing, No_of_Packages) => {
  //   if (!containerType || !packing || !No_of_Packages) {
  //     setFormulaText("")
  //     setCalculationExample("")
  //     return
  //   }

  //   const formula = "Formula: Weight per Package × No. of Packages × FCL = Total Quantity (MTS)"
  //   let example = ""

  //   const fcl = Number(section.quantityFCL || 1)
  //   const packagesNumber = parseInt(No_of_Packages.split(" ")[0]) || 0

  //   // Default weight per package (can be overridden)
  //   let weightPerPackage = 1.0

  //   const weightMatch = packing.match(/(\d+\.\d+)MTS/)
  //   if (weightMatch && weightMatch[1]) {
  //     weightPerPackage = parseFloat(weightMatch[1])
  //   }

  //   // Compute container weight if not already set
  //   const containerWeight = weightPerPackage * packagesNumber

  //   // Store the value
  //   onUpdate("containerWeight", containerWeight.toFixed(2))

  //   // Compute total
  //   const totalMts = containerWeight * fcl

  //   example = `Eg: (${weightPerPackage} × ${packagesNumber}) × ${fcl} = ${totalMts.toFixed(2)} MTS`

  //   setFormulaText(formula)
  //   setCalculationExample(example)
  // }

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
  // Single useEffect to handle item changes and prevent loops
  useEffect(() => {
    if (section.itemId && items.length > 0) {
      const selectedItem = items.find(
        (item) => item._id.toString() === section.itemId.toString()
      );

      if (
        selectedItem &&
        (!selectedItemDetails || selectedItemDetails._id !== selectedItem._id)
      ) {
        setSelectedItemDetails(selectedItem);
        autoFillItemFields(selectedItem);
      }
    }
  }, [section.itemId, items, selectedItemDetails]);

  useEffect(() => {
    if (selectedBusiness) {
      fetchCurrencies();
      fetchPaymentTerms();
      fetchForecastCostDescriptions();
    }
  }, [selectedBusiness]);

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

  // Calculate total quantity when FCL and MTS change
  useEffect(() => {
    calculateTotalQuantityFromFCLAndMTS();
  }, [section.quantityFCL, section.quantityMTS]);

  // Calculate forecast total cost when forecast cost or total quantity changes
  useEffect(() => {
    if (section.forecastCost && section.totalQuantity) {
      const forecastTotalCost =
        parseFloat(section.forecastCost) * parseFloat(section.totalQuantity);
      onUpdate("forecastTotalCost", forecastTotalCost.toFixed(2));
    } else {
      onUpdate("forecastTotalCost", "");
    }
  }, [section.forecastCost, section.totalQuantity]);

  // Calculate agent's commission per MTS when commission percentage or price changes
  useEffect(() => {
    // This effect is no longer needed as commissionPerMTS is fetched directly
  }, [commissionPerMTS, section.price]);

  // Update unit of container when FCL changes
  useEffect(() => {
    if (section.quantityFCL && section.containerType) {
      updateUnitOfContainer();
    }
  }, [section.quantityFCL, section.containerType]);

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

  // Extract item names for dropdown
  // const itemOptions =
  //   items && Array.isArray(items)
  //     ? items.map((item) => ({
  //       value: item._id,
  //       label: `${item.name} (${item.grade}) - ${item.packing} - ${item.remarks}`,
  //     }))
  //     : []
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

  // Prepare forecast cost description dropdown options
  const forecastCostDescOptions = forecastCostDescriptions.map((desc) => ({
    value: desc.name,
    label: desc.name,
  }));

  const handleCurrencyChange = (selectedOption) => {
    const conversionRate =
      currencyOptions?.find((option) => option.value === selectedOption)
        ?.conversionRate || 1;

    // Update both currency and conversion rate at once
    handleInputChange({
      name: "selectedCurrency",
      value: selectedOption,
      additionalUpdates: {
        conversionRate: conversionRate,
      },
    });
  };

  const handlePaymentTermsChange = (selectedOption) => {
    const selectedPaymentTerm = paymentTerms.find(
      (term) => term.name === selectedOption
    );

    if (selectedPaymentTerm) {
      // Update the payment terms field and auto-update deposit percentage if available
      const additionalUpdates = {};

      if (
        selectedPaymentTerm.depositPercentage !== undefined &&
        selectedPaymentTerm.depositPercentage !== null
      ) {
        additionalUpdates.deposit =
          selectedPaymentTerm.depositPercentage.toString();
      }

      handleInputChange({
        name: "paymentTerms",
        value: selectedOption,
        additionalUpdates: additionalUpdates,
      });
    } else {
      // If no matching payment term found, just update the field
      handleInputChange({
        name: "paymentTerms",
        value: selectedOption,
      });
    }
  };

  const handleForecastCostDescChange = (selectedOptions) => {
    // Handle multi-select: join all selected values with comma
    let valueToStore = "";

    if (Array.isArray(selectedOptions)) {
      // If multiple selections, join them with comma
      valueToStore = selectedOptions.join(", ");
    } else if (selectedOptions) {
      // If single selection
      valueToStore = selectedOptions;
    }

    handleInputChange({
      name: "forecastCostDescription",
      value: valueToStore,
    });
  };

  const handleConversionRateChange = (e) => {
    const rate = Number.parseFloat(e.target.value);
    onUpdate("conversionRate", rate);
  };

  const updateAmountInSelectedCurrency = (
    totalValue,
    selectedCurrency,
    conversionRate
  ) => {
    if (totalValue && conversionRate) {
      const amount =
        Number.parseFloat(totalValue) * Number.parseFloat(conversionRate);
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
        const numericValue = Number.parseFloat(
          qty.replace(/[^0-9.]/g, "")
        ).toFixed(2);
        return {
          value: numericValue,
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
            value: Number(section.quantityMTS).toFixed(2),
            label: `${Number(section.quantityMTS).toFixed(2)} MTS`,
          },
          ...options,
        ];
      }
    }

    return options;
  };

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

  // const getQuantityOptions = () => {
  //   if (
  //     selectedItemDetails &&
  //     Array.isArray(selectedItemDetails.quantity_MTS)
  //   ) {
  //     return selectedItemDetails.quantity_MTS.map((qty) => {
  //       const num = Number.parseFloat(qty.replace(/[^0-9.]/g, "")).toFixed(2);
  //       return {
  //         value: num,
  //         label: num,
  //       };
  //     });
  //   }
  //   return [];
  // };
  useEffect(() => {
    console.log("👀 Checking quantityMTS:", {
      sectionValue: section.quantityMTS,
      options: getQuantityOptions(),
    });
  }, [section.quantityMTS, selectedItemDetails]);

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
  const handleFCLChange = (e) => {
    const value = e.target.value;

    // Update FCL and immediately update unit of container
    handleInputChange({
      name: "quantityFCL",
      value: value,
    });

    // Also recalculate total quantity
    if (value && section.containerWeight) {
      calculateTotalQuantity(value, section.containerWeight);
    }
  };

  return (
    <div>
      {isExpanded && (
        <div className="space-y-3">
          <InputFieldWithLabel
            type="select"
            label={t("item.title")}
            name="item"
            required={true}
            error={errors.item || errors.title}
            shouldShowError={!!(errors.item || errors.title)}
            icon={<FiPackage />}
            Input={
              <DropdownBasic
                options={itemOptions}
                placeholder={t("sales.selectItem")}
                value={section.itemId?.toString() || ""}
                error={errors.item || errors.title}
                shouldShowError={!!(errors.item || errors.title)}
                // value={section.itemId || ""} // Use itemId as selected value
                // onChange={(value) => handleInputChange({ name: "itemId", value })}
                onChange={(value) => {
                  // When the item changes, clear Quantity (MTS) so it can auto-select for the new item
                  setIsQuantityMTSManuallySelected(false);
                  handleInputChange({
                    name: "itemId",
                    value: value,
                    additionalUpdates: { quantityMTS: "" },
                  });
                }}
              />
            }
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
              {calculationExample && <p className="text-blue-600 mt-1">{calculationExample}</p>}
            </div>
          )} */}

          {/* Grade */}
          <InputFieldWithLabel
            type="text"
            label={t("item.grade")}
            disabled={true}
            name="grade"
            placeholder={t("item.grade")}
            value={section.grade || ""}
            onChange={(e) =>
              handleInputChange({ name: "grade", value: e.target.value })
            }
            labelWidth="w-[180px]"
            icon={<FiAward />}
          />

          {/* Container Type */}
          <InputFieldWithLabel
            type="text"
            label={t("item.containerType")}
            disabled={true}
            name="containerType"
            placeholder={t("item.containerType")}
            value={section.containerType || ""}
            onChange={(e) =>
              handleInputChange({
                name: "containerType",
                value: e.target.value,
              })
            }
            labelWidth="w-[180px]"
            icon={<FiBox />}
          />

          {/* Unit of Container - Read-only field that shows the combined value */}
          <InputFieldWithLabel
            type="text"
            label={t("sales.unitOfContainer")}
            name="unitOfContainer"
            placeholder={t("sales.unitOfContainer")}
            value={section.unitOfContainer || ""}
            disabled={true}
            labelWidth="w-[180px]"
            icon={<FiLayers />}
          />

          {/* Quantity MTS - Dropdown with options from selected item */}
          <InputFieldWithLabel
            type="select"
            label={t("sales.quantityMTS")}
            name="quantityMTS"
            required={true}
            error={errors.quantityMTS}
            shouldShowError={!!errors.quantityMTS}
            icon={<FiBarChart2 />}
            Input={
              <DropdownBasic
                options={getQuantityOptions()}
                placeholder={t("item.selectQuantity")}
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
                  setIsQuantityMTSManuallySelected(true);
                  handleInputChange({ name: "quantityMTS", value });
                }}
              />
            }
          />

          <InputFieldWithLabel
            type="number"
            label={t("sales.quantityFCL")}
            name="quantityFCL"
            required={true}
            placeholder={t("sales.quantityFCL")}
            value={section.quantityFCL || ""}
            onChange={handleFCLChange}
            error={errors.quantityFCL}
            shouldShowError={!!errors.quantityFCL}
            labelWidth="w-[180px]"
            icon={<FiBarChart2 />}
          />

          <InputFieldWithLabel
            type="number"
            label={t("sales.totalQuantity")}
            name="totalQuantity"
            placeholder={t("sales.totalQuantity")}
            value={section.totalQuantity || ""}
            disabled={true}
            labelWidth="w-[180px]"
            icon={<FiBarChart2 />}
          />

          <InputFieldWithLabel
            type="text"
            label={t("item.packing")}
            name="packing"
            required={true}
            placeholder={t("item.packing")}
            value={section.packing || ""}
            onChange={(e) =>
              handleInputChange({ name: "packing", value: e.target.value })
            }
            error={errors.packing}
            shouldShowError={!!errors.packing}
            labelWidth="w-[180px]"
            icon={<FiBox />}
          />

          {/* No. of Packages - Dropdown with options from selected item */}
          <InputFieldWithLabel
            type="select"
            label={t("sales.noOfPackages")}
            name="No_of_Packages"
            icon={<FiHash />}
            Input={
              <DropdownBasic
                options={getPackagesOptions()}
                placeholder={t("sales.selectPackages")}
                value={section.No_of_Packages || ""}
                onChange={(value) =>
                  handleInputChange({ name: "No_of_Packages", value })
                }
              />
            }
          />

          <InputFieldWithLabel
            type="number"
            label={t("item.price")}
            name="price"
            required={true}
            placeholder={t("item.price")}
            min="0.01"
            step="0.01"
            value={section.price || ""}
            onChange={(e) => {
              const value = e.target.value;
              // Only allow positive numbers greater than 0
              if (value === "" || (value && Number(value) > 0)) {
                handleInputChange({
                  name: "price",
                  value: value || "",
                });
              }
            }}
            error={errors.price}
            shouldShowError={!!errors.price}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          {/* Remove the input for commissionPerMTS, and instead use basicInfo.commissionPerMTS or fetched commissionPerMTS */}
          <InputFieldWithLabel
            type="text"
            label={t("sales.agentCommissionPMTS")}
            name="commissionPerMTS"
            value={basicInfo?.commissionPerMTS || commissionPerMTS || ""}
            placeholder={t("sales.agentCommissionPerMTS")}
            disabled
            labelWidth="w-[180px]"
            icon={<FiPercent />}
          />
          <InputFieldWithLabel
            type="text"
            label={t("sales.totalAgentCommission")}
            name="totalAgentCommission"
            value={
              (basicInfo?.commissionPerMTS || commissionPerMTS) &&
              section.quantityMTS &&
              section.quantityFCL
                ? (
                    Number(basicInfo?.commissionPerMTS || commissionPerMTS) *
                    Number(section.quantityMTS) *
                    Number(section.quantityFCL)
                  ).toFixed(2)
                : ""
            }
            placeholder={t("sales.totalAgentCommission")}
            disabled
            labelWidth="w-[180px]"
            icon={<FiPercent />}
          />

          {/* New price fields for Profit Sharing type */}
          {section.contractType === "Profit Sharing" && (
            <>
              <InputFieldWithLabel
                type="number"
                label={t("sales.priceForFinalCustomer")}
                name="priceForFinalCustomer"
                required={true}
                placeholder={t("sales.priceForFinalCustomer")}
                min="0.01"
                step="0.01"
                value={section.priceForFinalCustomer || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow positive numbers greater than 0
                  if (value === "" || (value && Number(value) > 0)) {
                    handleInputChange({
                      name: "priceForFinalCustomer",
                      value: value || "",
                    });
                  }
                }}
                error={errors.priceForFinalCustomer}
                shouldShowError={!!errors.priceForFinalCustomer}
                labelWidth="w-[180px]"
                icon={<FiDollarSign />}
              />
            </>
          )}

          {/* Payment Terms Dropdown */}
          <InputFieldWithLabel
            type="custom"
            label={t("sales.paymentTerms")}
            required={true}
            error={errors.paymentTerms}
            shouldShowError={!!errors.paymentTerms}
            labelWidth="w-[180px]"
            icon={<FiCreditCard />}
            Input={
              <DropdownBasic
                options={paymentTermsOptions}
                value={section.paymentTerms}
                onChange={handlePaymentTermsChange}
                error={errors.paymentTerms}
                shouldShowError={!!errors.paymentTerms}
                placeholder={
                  loadingPaymentTerms
                    ? t("sales.loadingPaymentTerms")
                    : t("sales.selectPaymentTerms")
                }
              />
            }
          />

          <InputFieldWithLabel
            type="number"
            label={t("sales.depositPercent")}
            name="deposit"
            required={true}
            disabled
            placeholder={t("sales.depositPercentPlaceholder")}
            value={section.deposit || ""}
            onChange={(e) =>
              handleInputChange({
                name: "deposit",
                value: e.target.value,
              })
            }
            error={errors.deposit}
            shouldShowError={!!errors.deposit}
            labelWidth="w-[180px]"
            icon={<FiPercent />}
          />

          <InputFieldWithLabel
            type="text"
            label={t("sales.totalValueUSD")}
            name="totalValue"
            required={true}
            value={formatAmount(section.totalValue) || ""}
            placeholder={t("sales.totalValueUSD")}
            disabled
            error={errors.totalValue}
            shouldShowError={!!errors.totalValue}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />
          <InputFieldWithLabel
            type="custom"
            label={t("sales.selectCurrency")}
            required={true}
            error={errors.selectedCurrency}
            shouldShowError={!!errors.selectedCurrency}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
            Input={
              <DropdownBasic
                options={currencyOptions}
                value={section.selectedCurrency}
                onChange={handleCurrencyChange}
                error={errors.selectedCurrency}
                shouldShowError={!!errors.selectedCurrency}
                placeholder={
                  loadingCurrencies
                    ? t("sales.loadingCurrencies")
                    : t("sales.selectACurrency")
                }
              />
            }
          />

          <InputFieldWithLabel
            type="number"
            label={t("sales.conversionRate")}
            name="conversionRate"
            required={true}
            placeholder="1 USD = X Selected Currency"
            value={parseFloat(section.conversionRate) || ""}
            onChange={handleConversionRateChange}
            error={errors.conversionRate}
            shouldShowError={!!errors.conversionRate}
            labelWidth="w-[180px]"
            disabled={false}
            icon={<FiDollarSign />}
          />

          <InputFieldWithLabel
            type="text"
            label={t("sales.amountInSelectedCurrency")}
            name="amountInSelectedCurrency"
            required={true}
            value={
              section.amountInSelectedCurrency
                ? `${formatAmount(section.amountInSelectedCurrency) || ""} ${
                    section.selectedCurrency?.value || ""
                  }`
                : ""
            }
            disabled
            error={errors.amountInSelectedCurrency}
            shouldShowError={!!errors.amountInSelectedCurrency}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          <InputFieldWithLabel
            type="custom"
            label={t("sales.forecastCostDescription")}
            labelWidth="w-[180px]"
            icon={<FiFileText />}
            Input={
              <DropdownBasic
                options={forecastCostDescOptions}
                value={
                  section.forecastCostDescription
                    ? section.forecastCostDescription
                        .split(", ")
                        .map((desc) => desc.trim())
                    : []
                }
                onChange={handleForecastCostDescChange}
                placeholder={
                  loadingForecastCostDesc
                    ? t("sales.loadingForecastCostDesc")
                    : t("sales.selectForecastCostDescription")
                }
                isMulti={true}
              />
            }
          />

          <InputFieldWithLabel
            type="number"
            label={t("sales.forecastCostUSD")}
            name="forecastCost"
            placeholder={t("sales.enterForecastCost")}
            value={section.forecastCost ? parseFloat(section.forecastCost) : ""}
            onChange={(e) =>
              handleInputChange({ name: "forecastCost", value: e.target.value })
            }
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          <InputFieldWithLabel
            type="text"
            label={t("sales.forecastTotalCostUSD")}
            name="forecastTotalCost"
            placeholder={t("sales.calculatedForecastTotalCost")}
            value={
              section.totalQuantity && section.forecastCost
                ? (
                    parseFloat(section.totalQuantity) *
                    parseFloat(section.forecastCost)
                  ).toFixed(2)
                : ""
            }
            disabled={true}
            labelWidth="w-[180px]"
            icon={<FiDollarSign />}
          />

          <InputFieldWithLabel
            type="text"
            label={t("item.remarks")}
            name="remarks"
            placeholder={t("item.remarks")}
            value={section.remarks || ""}
            onChange={(e) =>
              handleInputChange({ name: "remarks", value: e.target.value })
            }
            labelWidth="w-[180px]"
            icon={<FiMessageSquare />}
          />

          {/* Shipping Terms - Enhanced UI */}
          <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3 mb-2 shadow-sm">
            <FiTruck
              className="text-blue-500 text-2xl"
              title={t("sales.shippingTerms")}
            />
            <div className="flex-1">
              <DropdownWithAddNewFormSaleC
                label={
                  <span className="font-semibold text-blue-700 flex items-center gap-1">
                    {t("sales.shippingTerms")} <span className="text-red-500">*</span>{" "}
                    <FiInfo
                      className="text-blue-400"
                      title={t("sales.selectOrAddShippingTerms")}
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
                placeholder={t("sales.selectShippingTerms")}
                error={errors.shippingTerms}
                shouldShowError={!!errors.shippingTerms}
              />
              {errors.shippingTerms && (
                <p className="text-red-500 text-sm p-2 mt-1">
                  {errors.shippingTerms}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProductSection;
