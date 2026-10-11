import { useState, useEffect } from "react";
import FormField from "./form-fields";
import HeaderSection from "./header-section";
import Select from "react-select";
import { countries } from "countries-list";
import DropdownWithAddNewFormSaleC from "@/components/DropdownWithAddNewFormSaleC";
import DropdownWithAddNewFormSaleCNOTextChange from "@/components/DropdownWithAddNewFormSaleCNOTextChange";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ProductSection = ({
  selectedBusiness,
  section,
  items = [],
  onUpdate,
  onRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  console.log(onUpdate);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onUpdate(name, value);
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

  useEffect(() => {
    if (selectedBusiness) {
      fetchCurrencies();
    }
  }, [selectedBusiness]);

  useEffect(() => {
    if (section.price && section.quantityMTS) {
      const price = Number(section.price);
      const qty = Number(section.quantityMTS);
      if (!isNaN(price) && !isNaN(qty)) {
        const total = price * qty;
        onUpdate("totalValue", total.toFixed(2));
        updateAmountInSelectedCurrency(
          total.toFixed(2),
          section.selectedCurrency,
          section.conversionRate
        );
      }
    }
  }, [
    section.price,
    section.quantityMTS,
    section.selectedCurrency,
    section.conversionRate,
  ]);

  // Extract item names for dropdown
  const itemOptions =
    items && Array.isArray(items) ? items.map((item) => item.name) : [];

  // Prepare currency dropdown options from fetched currencies
  const currencyOptions = currencies.map((currency) => ({
    value: currency.symbol,
    label: `${currency.name} (${currency.symbol})`,
    conversionRate: currency.conversion_rate_to_base,
  }));

  const handleCurrencyChange = (selectedOption) => {
    onUpdate("selectedCurrency", selectedOption);
    onUpdate("conversionRate", selectedOption.conversionRate);
    updateAmountInSelectedCurrency(
      section.totalValue,
      selectedOption,
      selectedOption.conversionRate
    );
  };

  const handleConversionRateChange = (e) => {
    const rate = Number.parseFloat(e.target.value);
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

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* <HeaderSection isExpanded={isExpanded} setIsExpanded={setIsExpanded} title={section.title} onRemove={onRemove} /> */}
      {isExpanded && (
        <div className="p-4 border-t space-y-3">
          {/* <div className="space-y-3">
            <h3 className="text-sm text-gray-600">Purchase Contract (If Any)</h3>
            <FormField
              type="select"
              name="purchaseContract"
              placeholder="Purchase Contract No"
              options={["Contract 1", "Contract 2"]}
              value={section.purchaseContract || ""}
              onChange={handleInputChange}
              labelWidth="w-[180px]"
            />
          </div> */}
          <FormField
            type="select"
            label="Item"
            name="item"
            placeholder="Item"
            options={itemOptions}
            value={section.item || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="number"
            label="Quantity (MTS)"
            name="quantityMTS"
            placeholder="Quantity (MTS)"
            value={section.quantityMTS || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="number"
            label="Quantity (FCL)"
            name="quantityFCL"
            placeholder="Quantity (FCL)"
            value={section.quantityFCL || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="number"
            label="Container Weight"
            name="containerWeight"
            placeholder="Container Weight (Tons)"
            value={section.containerWeight || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="select"
            label="FCL Size"
            name="fclSize"
            placeholder="FCL Size"
            options={["20ft", "40ft", "40ft HC"]}
            value={section.fclSize || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="select"
            label="To Issue"
            name="toIssue"
            placeholder="To Issue"
            options={["Option 1", "Option 2"]}
            value={section.toIssue || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="number"
            label="Price"
            name="price"
            placeholder="Price"
            value={section.price || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />

          <FormField
            type="number"
            label="Deposit %"
            name="deposit"
            placeholder="Deposit % (25%)"
            value={section.deposit || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          />
          <FormField
            type="number"
            label="Total Value (USD)"
            name="totalValue"
            value={section.totalValue || ""}
            disabled
            labelWidth="w-[180px]"
          />

          <FormField
            type="custom"
            label="Select Currency"
            labelWidth="w-[180px]"
            customInput={
              <Select
                options={currencyOptions}
                value={section.selectedCurrency}
                onChange={handleCurrencyChange}
                className="flex-grow"
                placeholder={
                  loadingCurrencies
                    ? "Loading currencies..."
                    : "Select a currency"
                }
              />
            }
          />

          <FormField
            type="number"
            label="Conversion Rate"
            name="conversionRate"
            placeholder="1 USD = X Selected Currency"
            value={section.conversionRate || ""}
            onChange={handleConversionRateChange}
            labelWidth="w-[180px]"
          />

          <FormField
            type="text"
            label="Amount in Selected Currency"
            name="amountInSelectedCurrency"
            value={
              section.amountInSelectedCurrency
                ? `${section.amountInSelectedCurrency || ""} ${
                    section.selectedCurrency?.value || ""
                  }`
                : ""
            }
            disabled
            labelWidth="w-[180px]"
          />

          {/* <FormField
            type="select"
            label="Type of Product"
            name="productType"
            placeholder="Type of Product"
            options={["Type 1", "Type 2"]}
            value={section.productType || ""}
            onChange={handleInputChange}
            labelWidth="w-[180px]"
          /> */}

          <DropdownWithAddNewFormSaleCNOTextChange
            label="Packing"
            name="packing"
            selectedValue={section.packing}
            onChange={(value) => onUpdate("packing", value)}
            fetchUrl={`${Base_URL}/items/Packing/get_all`}
            addUrl={`${Base_URL}/items/Packing/add`}
            businessId={selectedBusiness} // ✅ Pass selected business
            placeholder="Select Packing"
          />

          <DropdownWithAddNewFormSaleCNOTextChange
            label="Type of Product"
            name="productType"
            selectedValue={section.productType}
            onChange={(value) => onUpdate("productType", value)}
            fetchUrl={`${Base_URL}/items/Product Type/get_all`}
            addUrl={`${Base_URL}/items/Product Type/add`}
            businessId={selectedBusiness} // ✅ Pass selected business
            placeholder="Select Type of Product"
          />
          <DropdownWithAddNewFormSaleC
            label="Shipping Terms"
            name="shippingTerms"
            fieldType="html"
            selectedValue={section.shippingTerms}
            onChange={(value) => onUpdate("shippingTerms", value)}
            fetchUrl={`${Base_URL}/items/Shipping Terms/get_all`}
            addUrl={`${Base_URL}/items/Shipping Terms/add`}
            businessId={selectedBusiness} // ✅ Pass selected business
            placeholder="Select Shipping Terms"
          />

          <DropdownWithAddNewFormSaleC
            label="Delivery Terms"
            name="shippingTerms"
            fieldType="html"
            placeholder="Enter Delivery Terms"
            fetchUrl={`${Base_URL}/items/Delivery Terms/get_all`}
            addUrl={`${Base_URL}/items/Delivery Terms/add`}
            businessId={selectedBusiness}
            selectedValue={section.shippingTerms}
            onChange={(value) => onUpdate("shippingTerms", value)}
          />

          <DropdownWithAddNewFormSaleC
            label="Payment Terms"
            name="paymentTerms"
            fieldType="html"
            placeholder="Enter Payment Terms"
            fetchUrl={`${Base_URL}/items/Payment Terms/get_all`}
            addUrl={`${Base_URL}/items/Payment Terms/add`}
            businessId={selectedBusiness}
            selectedValue={section.paymentTerms}
            onChange={(value) => onUpdate("paymentTerms", value)}
          />
        </div>
      )}
    </div>
  );
};

export default ProductSection;
