import React, { useMemo } from "react";
import { getAllCurrencies } from "@/utils/currency";
import { DropdownBasic } from "@/page-layouts/index";

export const toCurrencyCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const SubscriptionCurrencySelect = ({
  value,
  onChange,
  placeholder = "Select currency",
  width = "220px",
  isDisabled = false,
}) => {
  const options = useMemo(
    () =>
      getAllCurrencies().map((currency) => ({
        value: toCurrencyCode(currency.cc),
        label:
          String(currency.cc).toUpperCase() === "MYR"
            ? `${currency.name} (RM)`
            : `${currency.name} (${currency.cc})`,
      })),
    [],
  );

  return (
    <DropdownBasic
      options={options}
      value={toCurrencyCode(value)}
      onChange={(selected) => onChange(toCurrencyCode(selected))}
      placeholder={placeholder}
      isDisabled={isDisabled}
      width={width}
      isClearable={false}
    />
  );
};

export default SubscriptionCurrencySelect;
