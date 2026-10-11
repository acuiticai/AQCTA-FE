import React, { useState, useEffect, useMemo, useContext } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import {
  PageHeader,
  DropdownBasic,
  Form,
  useFormScreenExit,
} from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { fetchDefinitions } from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { persistCustomFieldValuesByBusiness } from "@/utils/customFieldPersistence";
import { injectCustomFieldsInFormFields } from "@/utils/customFieldPlacement";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function getSelectedBusinessIds(business) {
  if (!business) return [];
  if (Array.isArray(business)) {
    return business
      .map((b) => (typeof b === "object" && b !== null ? b._id ?? b.value : b))
      .filter(Boolean)
      .map(String);
  }
  return [String(business)].filter((id) => id && id !== "undefined");
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center w-full py-2">
    <div className="w-6 h-6 border-2 border-t-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
  </div>
);

const NewStockGroupScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const exitStockGroupsScreen = useFormScreenExit("/stock-groups");
  const { id } = useParams();
  const buttonColor = useButtonColor();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [formData, setFormData] = useState({
    business: [],
    stockCode: "",
    description: "",
    salesCode: "",
    cashSalesCode: "",
    salesReturnCode: "",
    balanceSheetStock: "",
    purchaseCode: "",
    cashPurchaseCode: "",
    purchaseReturnCode: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    business: false,
    stockCode: false,
    description: false,
    salesCode: false,
    cashSalesCode: false,
    salesReturnCode: false,
    balanceSheetStock: false,
    purchaseCode: false,
    cashPurchaseCode: false,
    purchaseReturnCode: false,
  });
  const [errors, setErrors] = useState({
    business: "",
    stockCode: "",
    description: "",
    salesCode: "",
    cashSalesCode: "",
    salesReturnCode: "",
    balanceSheetStock: "",
    purchaseCode: "",
    cashPurchaseCode: "",
    purchaseReturnCode: "",
  });
  const [isLoading, setIsLoading] = useState({
    business: false,
    form: false,
  });
  const [customFieldValuesByBusiness, setCustomFieldValuesByBusiness] =
    useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading((prev) => ({ ...prev, business: true }));
        const assigned = await syncAssignedBusinessesFromApi(Base_URL);
        setBusinesses(Array.isArray(assigned) ? assigned : []);
      } catch (err) {
        console.error("Error fetching businesses:", err);
        notifyError(t("item.loadDataFailed"));
      } finally {
        setIsLoading((prev) => ({ ...prev, business: false }));
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const ids = new Set(getSelectedBusinessIds(formData.business));
    setCustomFieldValuesByBusiness((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!ids.has(k)) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [formData.business]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDropdownChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBlur = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const tWithFallback = (key, fallback) => {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
  };

  const fieldLabelMap = {
    business: tWithFallback("Business", "Business"),
    stockCode: tWithFallback("stock.group.code", "Stock code"),
    salesCode: tWithFallback("stock.group.salesCode", "Sales code"),
    cashSalesCode: tWithFallback("stock.group.cashSalesCode", "Cash sales code"),
    salesReturnCode: tWithFallback("stock.group.salesReturnCode", "Sales return code"),
    balanceSheetStock: tWithFallback("stock.group.balanceSheetStock", "Balance sheet stock"),
    purchaseCode: tWithFallback("stock.group.purchaseCode", "Purchase code"),
    cashPurchaseCode: tWithFallback("stock.group.cashPurchaseCode", "Cash purchase code"),
    purchaseReturnCode: tWithFallback("stock.group.purchaseReturnCode", "Purchase return code"),
  };

  const shouldShowError = (field) => showErrors || touchedFields[field];

  // Validation effect
  useEffect(() => {
    const businessValid =
      formData.business &&
      (Array.isArray(formData.business) ? formData.business.length > 0 : true);

    const newErrors = {
      business: !businessValid ? tWithFallback("item.validation.selectAtLeastOneBusiness", "Please select at least one business.") : "",
      stockCode: !formData.stockCode?.trim() ? tWithFallback("stock.group.enterCode", "Stock code is required.") : "",
      description: "",
      salesCode: !formData.salesCode?.trim() ? tWithFallback("stock.group.enterSalesCode", "Sales code is required.") : "",
      cashSalesCode: !formData.cashSalesCode?.trim() ? tWithFallback("stock.group.enterCashSalesCode", "Cash sales code is required.") : "",
      salesReturnCode: !formData.salesReturnCode?.trim() ? tWithFallback("stock.group.enterSalesReturnCode", "Sales return code is required.") : "",
      balanceSheetStock: !formData.balanceSheetStock?.trim() ? tWithFallback("stock.group.enterBalanceSheetStock", "Balance sheet stock is required.") : "",
      purchaseCode: !formData.purchaseCode?.trim() ? tWithFallback("stock.group.enterPurchaseCode", "Purchase code is required.") : "",
      cashPurchaseCode: !formData.cashPurchaseCode?.trim() ? tWithFallback("stock.group.enterCashPurchaseCode", "Cash purchase code is required.") : "",
      purchaseReturnCode: !formData.purchaseReturnCode?.trim() ? tWithFallback("stock.group.enterPurchaseReturnCode", "Purchase return code is required.") : "",
    };
    setErrors(newErrors);
  }, [formData, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);

    const hasErrors = Object.values(errors).some((err) => err !== "");
    if (hasErrors) {
      notifyError("Please complete all required fields before proceeding.");
      return;
    }

    const selectedIds = getSelectedBusinessIds(formData.business);
    for (const bid of selectedIds) {
      try {
        const defs = await fetchDefinitions(
          { businessId: bid, module: "inventory", screen: "stock_group" },
          headers,
        );
        if (!defs.length) continue;
        const cfErr = validateCustomFieldValues(
          defs,
          customFieldValuesByBusiness[bid] || {},
        );
        if (cfErr) {
          notifyError(cfErr);
          return;
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.message || "Could not validate custom fields.",
        );
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      // Use the bulk endpoint for multiple businesses
      const stockGroupData = {
        businesses: formData.business,
        stockCode: formData.stockCode,
        description: formData.description,
        salesCode: formData.salesCode,
        cashSalesCode: formData.cashSalesCode,
        salesReturnCode: formData.salesReturnCode,
        balanceSheetStock: formData.balanceSheetStock,
        purchaseCode: formData.purchaseCode,
        cashPurchaseCode: formData.cashPurchaseCode,
        purchaseReturnCode: formData.purchaseReturnCode,
      };

      const response = await axios.post(
        `${Base_URL}/stock-groups/multiple-businesses`,
        stockGroupData,
        { headers },
      );

      if (response.status === 201) {
        const saved = response.data?.data;
        if (Array.isArray(saved) && saved.length) {
          try {
            for (const doc of saved) {
              const bid = String(doc.business?._id || doc.business || "");
              const rid = doc._id;
              if (!bid || !rid) continue;
              await persistCustomFieldValuesByBusiness({
                headers,
                recordId: rid,
                businessIds: [bid],
                valuesByBusiness: customFieldValuesByBusiness,
                module: "inventory",
                screen: "stock_group",
              });
            }
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                "Stock group saved but custom fields failed to save.",
            );
            setLoading(false);
            return;
          }
        }
        notifySuccess(response.data.message);
        history.push("/stock-groups");
      } else {
        notifyError(t("stock.group.saveFailed"));
      }
    } catch (err) {
      console.error("Error creating stock group:", err);
      const errorMessage = err.response?.data?.message || t("stock.group.saveFailed");
      notifyError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formFields = [
    {
      label: t("Business"),
      name: "business",
      type: "select",
      required: true,
      isMulti: true,
      value: formData.business,
      onChange: (value) => handleDropdownChange("business", value),
      onBlur: () => handleBlur("business"),
      options: businesses.map((business) => ({
        value: business._id,
        label: business.name,
      })),
      placeholder: isLoading.business ? t("common.loading") : t("stock.group.selectBusinesses"),
      disabled: isLoading.business,
      error: errors.business && shouldShowError("business") ? errors.business : null,
      shouldShowError: shouldShowError("business"),
    },
    {
      label: t("stock.group.code"),
      name: "stockCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterCode"),
      value: formData.stockCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("stockCode"),
      error: errors.stockCode && shouldShowError("stockCode") ? errors.stockCode : null,
      shouldShowError: shouldShowError("stockCode"),
    },
    {
      label: t("stock.group.description"),
      name: "description",
      type: "text",
      required: false,
      placeholder: t("stock.group.enterDescription"),
      value: formData.description,
      onChange: handleInputChange,
      onBlur: () => handleBlur("description"),
      error: errors.description && shouldShowError("description") ? errors.description : null,
      shouldShowError: shouldShowError("description"),
    },
    {
      label: t("stock.group.salesCode"),
      name: "salesCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterSalesCode"),
      value: formData.salesCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("salesCode"),
      error: errors.salesCode && shouldShowError("salesCode") ? errors.salesCode : null,
      shouldShowError: shouldShowError("salesCode"),
    },
    {
      label: t("stock.group.cashSalesCode"),
      name: "cashSalesCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterCashSalesCode"),
      value: formData.cashSalesCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("cashSalesCode"),
      error: errors.cashSalesCode && shouldShowError("cashSalesCode") ? errors.cashSalesCode : null,
      shouldShowError: shouldShowError("cashSalesCode"),
    },
    {
      label: t("stock.group.salesReturnCode"),
      name: "salesReturnCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterSalesReturnCode"),
      value: formData.salesReturnCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("salesReturnCode"),
      error: errors.salesReturnCode && shouldShowError("salesReturnCode") ? errors.salesReturnCode : null,
      shouldShowError: shouldShowError("salesReturnCode"),
    },
    {
      label: t("stock.group.balanceSheetStock"),
      name: "balanceSheetStock",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterBalanceSheetStock"),
      value: formData.balanceSheetStock,
      onChange: handleInputChange,
      onBlur: () => handleBlur("balanceSheetStock"),
      error: errors.balanceSheetStock && shouldShowError("balanceSheetStock") ? errors.balanceSheetStock : null,
      shouldShowError: shouldShowError("balanceSheetStock"),
    },
    {
      label: t("stock.group.purchaseCode"),
      name: "purchaseCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterPurchaseCode"),
      value: formData.purchaseCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("purchaseCode"),
      error: errors.purchaseCode && shouldShowError("purchaseCode") ? errors.purchaseCode : null,
      shouldShowError: shouldShowError("purchaseCode"),
    },
    {
      label: t("stock.group.cashPurchaseCode"),
      name: "cashPurchaseCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterCashPurchaseCode"),
      value: formData.cashPurchaseCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("cashPurchaseCode"),
      error: errors.cashPurchaseCode && shouldShowError("cashPurchaseCode") ? errors.cashPurchaseCode : null,
      shouldShowError: shouldShowError("cashPurchaseCode"),
    },
    {
      label: t("stock.group.purchaseReturnCode"),
      name: "purchaseReturnCode",
      type: "text",
      required: true,
      placeholder: t("stock.group.enterPurchaseReturnCode"),
      value: formData.purchaseReturnCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("purchaseReturnCode"),
      error: errors.purchaseReturnCode && shouldShowError("purchaseReturnCode") ? errors.purchaseReturnCode : null,
      shouldShowError: shouldShowError("purchaseReturnCode"),
    },
  ];

  if (isLoading.form) {
    return (
      <div className="p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedIds = getSelectedBusinessIds(formData.business);
  const renderStockGroupCustomFields = ({ rowHeadroom = 0 } = {}) =>
    selectedIds.length > 0 ? (
      selectedIds.length === 1 && rowHeadroom > 0 ? (
        <DynamicCustomFieldsForm
          businessId={selectedIds[0]}
          module="inventory"
          screen="stock_group"
          values={customFieldValuesByBusiness[selectedIds[0]] || {}}
          onValuesChange={(v) =>
            setCustomFieldValuesByBusiness((prev) => ({
              ...prev,
              [selectedIds[0]]: v,
            }))
          }
          headers={headers}
          rowHeadroom={rowHeadroom}
        />
      ) : (
        <div className="space-y-4">
          {selectedIds.map((bid) => (
            <DynamicCustomFieldsForm
              key={bid}
              businessId={bid}
              module="inventory"
              screen="stock_group"
              values={customFieldValuesByBusiness[bid] || {}}
              onValuesChange={(v) =>
                setCustomFieldValuesByBusiness((prev) => ({
                  ...prev,
                  [bid]: v,
                }))
              }
              headers={headers}
            />
          ))}
        </div>
      )
    ) : null;

  const { formFieldsWithCustomFields, renderInFooter } =
    injectCustomFieldsInFormFields({
      formFields,
      module: "inventory",
      screen: "stock_group",
      customFieldComponent: renderStockGroupCustomFields,
    });

  return (
    <div className="py-6 px-6 min-h-screen">
      <PageHeader
        title={t("stock.group.new")}
        showBackButton
        backFallbackPath="/stock-groups"
      />
      <Form
        formFields={formFieldsWithCustomFields}
        handleSubmit={handleSubmit}
        handleCancel={exitStockGroupsScreen}
        loading={loading}
        buttonColor={buttonColor}
        isOpen={true}
        saveButtonText={t("Save")}
        cancelButtonText={t("Cancel")}
        noDefaultValidation={true}
        labelAndFieldDirection="column"
        tightLabelInputSpacing={true}
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
        beforeFooter={
          renderInFooter ? renderStockGroupCustomFields() : null
        }
      />
    </div>
  );
};

export default NewStockGroupScreen;
