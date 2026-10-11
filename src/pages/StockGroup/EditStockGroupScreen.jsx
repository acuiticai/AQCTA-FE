import React, { useState, useEffect, useMemo, useContext } from "react";
import { useHistory, useParams } from "react-router-dom";
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

const EditStockGroupScreen = () => {
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

  const [relatedRecords, setRelatedRecords] = useState([]);
  const [formData, setFormData] = useState({
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
        setIsLoading((prev) => ({ ...prev, business: true, form: true }));

        const assigned = await syncAssignedBusinessesFromApi(Base_URL);
        setBusinesses(Array.isArray(assigned) ? assigned : []);

        // Fetch stock group data and related businesses
        const [stockRes, relatedRes] = await Promise.all([
          axios.get(`${Base_URL}/stock-groups/${id}`),
          axios.get(`${Base_URL}/stock-groups/${id}/related-businesses`),
        ]);
        if (stockRes.data && stockRes.data.data) {
          const stockGroupData = stockRes.data.data;
          const { businessIds = [], records = [] } = relatedRes.data || {};
          setRelatedRecords(records);
          const latestRecord = (records || []).reduce((best, r) => {
            if (!best) return r;
            const bestTs = new Date(best.updatedAt || best.createdAt || 0).getTime();
            const nextTs = new Date(r.updatedAt || r.createdAt || 0).getTime();
            return nextTs >= bestTs ? r : best;
          }, null);
          const source = latestRecord || stockGroupData;
          const businessValue = businessIds.length > 0
            ? businessIds
            : source.business?._id || source.business || stockGroupData.business?._id || stockGroupData.business || "";
          setFormData({
            business: businessValue,
            stockCode: source.stockCode || "",
            description: source.description || "",
            salesCode: source.salesCode || "",
            cashSalesCode: source.cashSalesCode || "",
            salesReturnCode: source.salesReturnCode || "",
            balanceSheetStock: source.balanceSheetStock || "",
            purchaseCode: source.purchaseCode || "",
            cashPurchaseCode: source.cashPurchaseCode || "",
            purchaseReturnCode: source.purchaseReturnCode || "",
          });
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        notifyError("Failed to fetch stock group data");
      } finally {
        setIsLoading((prev) => ({ ...prev, business: false, form: false }));
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

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

  const recordIdByBusiness = useMemo(() => {
    const m = {};
    (relatedRecords || []).forEach((r) => {
      const bid = String(r.business?._id || r.business || "");
      if (bid && r._id) m[bid] = String(r._id);
    });
    return m;
  }, [relatedRecords]);

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

  const shouldShowError = (field) => showErrors || touchedFields[field];

  // Validation effect
  useEffect(() => {
    const businessValid = Array.isArray(formData.business)
      ? formData.business.length > 0
      : formData.business &&
        (typeof formData.business === "string"
          ? formData.business.trim() !== ""
          : true);

    const newErrors = {
      business: !businessValid ? "Please select a business." : "",
      stockCode: !formData.stockCode?.trim() ? "Stock code is required." : "",
      description: "",
      salesCode: !formData.salesCode?.trim() ? "Sales code is required." : "",
      cashSalesCode: !formData.cashSalesCode?.trim() ? "Cash sales code is required." : "",
      salesReturnCode: !formData.salesReturnCode?.trim() ? "Sales return code is required." : "",
      balanceSheetStock: !formData.balanceSheetStock?.trim() ? "Balance sheet stock is required." : "",
      purchaseCode: !formData.purchaseCode?.trim() ? "Purchase code is required." : "",
      cashPurchaseCode: !formData.cashPurchaseCode?.trim() ? "Cash purchase code is required." : "",
      purchaseReturnCode: !formData.purchaseReturnCode?.trim() ? "Purchase return code is required." : "",
    };
    setErrors(newErrors);
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);

    const hasErrors = Object.values(errors).some((err) => err !== "");
    if (hasErrors) {
      notifyError("Please fix the validation errors before saving.");
      return;
    }

    const selectedForCf = getSelectedBusinessIds(formData.business);
    for (const bid of selectedForCf) {
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
      const businessData = formData.business;
      const newBusinessIds = Array.isArray(businessData)
        ? businessData.map((b) => (typeof b === "object" ? b?.value ?? b?._id : b)?.toString()).filter(Boolean)
        : businessData ? [businessData.toString()] : [];
      const prevBusinessIds = relatedRecords.map((r) => (r.business?._id || r.business)?.toString()).filter(Boolean);

      const toRemove = prevBusinessIds.filter((bid) => !newBusinessIds.includes(bid));
      const toAdd = newBusinessIds.filter((bid) => !prevBusinessIds.includes(bid));

      if (newBusinessIds.length === 0) {
        notifyError("At least one business must be selected.");
        setLoading(false);
        return;
      }

      // 1. Remove from businesses
      for (const businessId of toRemove) {
        const record = relatedRecords.find(
          (r) => (r.business?._id || r.business)?.toString() === businessId
        );
        if (record?._id) {
          await axios.delete(`${Base_URL}/stock-groups/${record._id}`);
        }
      }

      // 2. Add to new businesses
      if (toAdd.length > 0) {
        await axios.post(`${Base_URL}/stock-groups/multiple-businesses`, {
          businesses: toAdd,
          stockCode: formData.stockCode,
          description: formData.description,
          salesCode: formData.salesCode,
          cashSalesCode: formData.cashSalesCode,
          salesReturnCode: formData.salesReturnCode,
          balanceSheetStock: formData.balanceSheetStock,
          purchaseCode: formData.purchaseCode,
          cashPurchaseCode: formData.cashPurchaseCode,
          purchaseReturnCode: formData.purchaseReturnCode,
        }, { headers });
      }

      // 3. Update remaining records
      const updatePayload = {
        business: newBusinessIds[0],
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
      const recordsToUpdate = relatedRecords.filter(
        (r) => !toRemove.includes((r.business?._id || r.business)?.toString())
      );
      for (const rec of recordsToUpdate) {
        if (rec._id) {
          await axios.put(`${Base_URL}/stock-groups/${rec._id}`, {
            ...updatePayload,
            business: (rec.business?._id || rec.business),
          }, { headers });
        }
      }

      try {
        const rel = await axios.get(
          `${Base_URL}/stock-groups/${id}/related-businesses`,
          { headers },
        );
        const records = rel.data?.records || [];
        for (const bid of newBusinessIds) {
          const rec = records.find(
            (r) => String(r.business?._id || r.business) === String(bid),
          );
          if (!rec?._id) continue;
          await persistCustomFieldValuesByBusiness({
            headers,
            recordId: rec._id,
            businessIds: [String(bid)],
            valuesByBusiness: customFieldValuesByBusiness,
            module: "inventory",
            screen: "stock_group",
          });
        }
      } catch (cfErr) {
        notifyError(
          cfErr?.response?.data?.message ||
            "Stock group updated but custom fields failed to save.",
        );
        setLoading(false);
        return;
      }

      notifySuccess("Stock group updated successfully!");
      history.push("/stock-groups");
    } catch (err) {
      console.error("Error updating stock group:", err);
      const errorMessage = err.response?.data?.message || "Failed to update stock group";
      notifyError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formFields = [
    {
      label: "Business",
      name: "business",
      type: "select",
      required: true,
      value: formData.business,
      onChange: (value) => handleDropdownChange("business", value),
      onBlur: () => handleBlur("business"),
      options: businesses.map((business) => ({
        value: business._id,
        label: business.name,
      })),
      placeholder: isLoading.business ? "Loading businesses..." : "Select Business",
      disabled: isLoading.business || businesses.length === 1,
      isMulti: businesses.length > 1,
      error: errors.business && shouldShowError("business") ? errors.business : null,
      shouldShowError: shouldShowError("business"),
    },
    {
      label: "Stock Code",
      name: "stockCode",
      type: "text",
      required: true,
      placeholder: "Enter Stock Code",
      value: formData.stockCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("stockCode"),
      error: errors.stockCode && shouldShowError("stockCode") ? errors.stockCode : null,
      shouldShowError: shouldShowError("stockCode"),
    },
    {
      label: "Description",
      name: "description",
      type: "text",
      required: false,
      placeholder: "Enter Description",
      value: formData.description,
      onChange: handleInputChange,
      onBlur: () => handleBlur("description"),
      error: errors.description && shouldShowError("description") ? errors.description : null,
      shouldShowError: shouldShowError("description"),
    },
    {
      label: "Sales Code",
      name: "salesCode",
      type: "text",
      required: true,
      placeholder: "Enter Sales Code",
      value: formData.salesCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("salesCode"),
      error: errors.salesCode && shouldShowError("salesCode") ? errors.salesCode : null,
      shouldShowError: shouldShowError("salesCode"),
    },
    {
      label: "Cash Sales Code",
      name: "cashSalesCode",
      type: "text",
      required: true,
      placeholder: "Enter Cash Sales Code",
      value: formData.cashSalesCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("cashSalesCode"),
      error: errors.cashSalesCode && shouldShowError("cashSalesCode") ? errors.cashSalesCode : null,
      shouldShowError: shouldShowError("cashSalesCode"),
    },
    {
      label: "Sales Return Code",
      name: "salesReturnCode",
      type: "text",
      required: true,
      placeholder: "Enter Sales Return Code",
      value: formData.salesReturnCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("salesReturnCode"),
      error: errors.salesReturnCode && shouldShowError("salesReturnCode") ? errors.salesReturnCode : null,
      shouldShowError: shouldShowError("salesReturnCode"),
    },
    {
      label: "Balance Sheet Stock",
      name: "balanceSheetStock",
      type: "text",
      required: true,
      placeholder: "Enter Balance Sheet Stock",
      value: formData.balanceSheetStock,
      onChange: handleInputChange,
      onBlur: () => handleBlur("balanceSheetStock"),
      error: errors.balanceSheetStock && shouldShowError("balanceSheetStock") ? errors.balanceSheetStock : null,
      shouldShowError: shouldShowError("balanceSheetStock"),
    },
    {
      label: "Purchase Code",
      name: "purchaseCode",
      type: "text",
      required: true,
      placeholder: "Enter Purchase Code",
      value: formData.purchaseCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("purchaseCode"),
      error: errors.purchaseCode && shouldShowError("purchaseCode") ? errors.purchaseCode : null,
      shouldShowError: shouldShowError("purchaseCode"),
    },
    {
      label: "Cash Purchase Code",
      name: "cashPurchaseCode",
      type: "text",
      required: true,
      placeholder: "Enter Cash Purchase Code",
      value: formData.cashPurchaseCode,
      onChange: handleInputChange,
      onBlur: () => handleBlur("cashPurchaseCode"),
      error: errors.cashPurchaseCode && shouldShowError("cashPurchaseCode") ? errors.cashPurchaseCode : null,
      shouldShowError: shouldShowError("cashPurchaseCode"),
    },
    {
      label: "Purchase Return Code",
      name: "purchaseReturnCode",
      type: "text",
      required: true,
      placeholder: "Enter Purchase Return Code",
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
          key={`${selectedIds[0]}-${recordIdByBusiness[selectedIds[0]] || "new"}`}
          businessId={selectedIds[0]}
          module="inventory"
          screen="stock_group"
          recordId={recordIdByBusiness[selectedIds[0]] || undefined}
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
              key={`${bid}-${recordIdByBusiness[bid] || "new"}`}
              businessId={bid}
              module="inventory"
              screen="stock_group"
              recordId={recordIdByBusiness[bid] || undefined}
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
        title="Edit Stock Group"
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
        saveButtonText="Update"
        cancelButtonText="Cancel"
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

export default EditStockGroupScreen;
