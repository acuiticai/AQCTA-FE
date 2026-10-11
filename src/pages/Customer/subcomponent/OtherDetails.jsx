import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import FormRow from "../reusablecomponents/FormRow";
import InputField from "../reusablecomponents/InputField";
import SelectField from "../reusablecomponents/SelectField";


const OtherDetails = ({ initialData = {}, onChange }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    currency: "",
    taxRate: "",
    openingBalance: "",
    paymentTerms: "",
    priceList: "",
    enablePortal: "",
    portalLanguage: "",
  });

  // Populate formData with initial data
  useEffect(() => {
    if (initialData) {
      // console.log("otherdetail",initialData.taxRate)
      setFormData({
        currency: initialData.currency || "",
        taxRate: initialData.taxRate || "",
        openingBalance: initialData.openingBalance || "",
        paymentTerms: initialData.paymentTerms || "",
        priceList: initialData.priceList || "",
        enablePortal: initialData.enablePortal || "",
        portalLanguage: initialData.portalLanguage || "",
      });
    }
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      onChange && onChange(updated); // Notify parent of changes
      return updated;
    });
  };

  return (
    <div className="space-y-4">
      <FormRow label={t("customer.currency")}>
        <InputField
          placeholder={t("customer.currency")}
          value={formData.currency}
          onChange={(e) => handleChange("currency", e.target.value)}
        />
      </FormRow>
      <FormRow label={t("customer.otherDetails.taxRate")}>
        <SelectField
          options={[
            { label: "10%", value: "10%" },
            { label: "12%", value: "12%" },
            { label: "22%", value: "22%" },
            { label: "24%", value: "24%" },
          ]}
          value={formData.taxRate}
          onChange={(e) => handleChange("taxRate", e.target.value)}
          defaultValue={t("customer.otherDetails.selectTax")}
        />
      </FormRow>
      <FormRow label={t("customer.otherDetails.openingBalance")}>
        <InputField
          placeholder={t("customer.currency")}
          type="number"
          value={formData.openingBalance}
          onChange={(e) => handleChange("openingBalance", e.target.value)}
        />
      </FormRow>
      <FormRow label={t("customer.otherDetails.paymentTerms")}>
        <SelectField
          options={[
            {
              label: t("customer.otherDetails.dueOnReceipt"),
              value: "due_on_receipt",
            },
            {
              label: t("customer.otherDetails.cashInAdvance"),
              value: "cash_in_advance",
            },
            {
              label: t("customer.otherDetails.cashOnDelivery"),
              value: "cash_on_delivery",
            },
          ]}
          value={formData.paymentTerms}
          onChange={(e) => handleChange("paymentTerms", e.target.value)}
          defaultValue="formData.paymentTerms"
        />
      </FormRow>
      <FormRow label={t("customer.otherDetails.priceList")}>
        <SelectField
          options={[
            {
              label: t("customer.otherDetails.defaultPriceList"),
              value: "default",
            },
            {
              label: t("customer.otherDetails.customPriceList"),
              value: "custom",
            },
          ]}
          value={formData.priceList}
          onChange={(e) => handleChange("priceList", e.target.value)}
          defaultValue="default"
        />
      </FormRow>
      <FormRow label={t("customer.otherDetails.enablePortal")}>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={formData.enablePortal}
            onChange={(e) => handleChange("enablePortal", e.target.checked)}
            className="form-checkbox h-5 w-5 text-green-600 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-600">
            {t("customer.otherDetails.allowPortalAccess")}
          </span>
        </div>
      </FormRow>
      <FormRow label={t("customer.otherDetails.portalLanguage")}>
        <SelectField
          options={[
            { label: t("customer.otherDetails.english"), value: "english" },
            { label: t("customer.otherDetails.malay"), value: "Malay" },
            { label: t("customer.otherDetails.spanish"), value: "spanish" },
          ]}
          value={formData.portalLanguage}
          onChange={(e) => handleChange("portalLanguage", e.target.value)}
          defaultValue="english"
        />
      </FormRow>
    </div>
  );
};

export default OtherDetails;
