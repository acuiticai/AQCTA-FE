import React, { useState, useEffect } from "react";
import axios from "axios";
import DropdownBasic from "./DropdownBasic";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CurrencyDropdown = ({
  businessId,
  value = "",
  onChange,
  placeholder = "Select Currency",
  className = "",
  style = {},
  error = "",
  shouldShowError = false,
  isDisabled = false,
  size = "md",
  width = "200px",
  showConversionRate = false,
  ...props
}) => {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState("");

  // Fetch currencies from API
  useEffect(() => {
    const fetchCurrencies = async () => {
      if (!businessId) {
        setCurrencies([]);
        return;
      }

      setLoading(true);
      setErrorState("");

      try {
        const response = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${businessId}`
        );

        const currencyData = response.data.data || [];

        // Transform currency data to match dropdown format
        const formattedCurrencies = currencyData.map((currency) => ({
          value: currency._id, // Use the ID as the value
          label: showConversionRate
            ? `${currency.symbol} (${currency.prefix}) - Rate: ${currency.conversion_rate_to_base}`
            : `${currency.symbol} (${currency.prefix})`,
          conversionRate: currency.conversion_rate_to_base,
          originalData: currency,
        }));

        setCurrencies(formattedCurrencies);
      } catch (err) {
        console.error("Error fetching currencies:", err);
        setErrorState("Failed to load currencies");
        setCurrencies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrencies();
  }, [businessId, showConversionRate]);

  const handleCurrencyChange = (selectedValue) => {
    if (onChange) {
      const selectedCurrency = currencies.find((c) => c.value === selectedValue);
      onChange({
        value: selectedValue,
        label: selectedCurrency?.label || "",
        conversionRate: selectedCurrency?.conversionRate,
        originalData: selectedCurrency?.originalData,
      });
    }
  };

  return (
    <DropdownBasic
      options={currencies}
      value={value}
      onChange={handleCurrencyChange}
      placeholder={loading ? "Loading currencies..." : placeholder}
      className={className}
      style={{ ...style, border: "none", boxShadow: "none", outline: "none" }}
      error={error || errorState}
      shouldShowError={shouldShowError}
      isDisabled={isDisabled || loading}
      size={size}
      width={width}
      isLoading={loading}
      noOptionsMessage={() => "No currencies available"}
      {...props}
    />
  );
};

export default CurrencyDropdown;
