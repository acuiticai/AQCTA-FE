import React, { useState, useEffect, useMemo, useContext } from "react";
import { useTranslation } from "react-i18next";
import DropdownBasic from "@/components/DropdownBasic";
import axios from "axios";
import DropdownWithAddNew from "@/components/DropdownWithAddNew";
import { Form, useFormScreenExit } from "@/page-layouts/index";
import { notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { fetchDefinitions } from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const getSelectedBusinessIds = (business) => {
  if (!business) return [];
  if (Array.isArray(business)) {
    return business
      .map((b) =>
        typeof b === "object" && b !== null ? b._id ?? b.value ?? b.id : b,
      )
      .filter(Boolean)
      .map(String);
  }
  if (typeof business === "object" && business !== null) {
    const id = business._id ?? business.value ?? business.id;
    return id ? [String(id)] : [];
  }
  return [String(business)].filter((id) => id && id !== "undefined");
};

const BasicInformation = ({
  onChange,
  businesses = [],
  initialData = {},
  isEditMode = false,
  onSave,
  vendorId,
}) => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const requestHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const exitVendorsScreen = useFormScreenExit("/Vendors");
  const [displayNameSuggestions, setDisplayNameSuggestions] = useState([]);
  const [vendorTypes, setVendorTypes] = useState([]);
  const [currenciesByBusiness, setCurrenciesByBusiness] = useState({});
  const [chartAccounts, setChartAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState({
    vendorType: false,
    currencies: false,
    accounts: false,
  });
  const [isSaveDisabled, setIsSaveDisabled] = useState(true);
  const [customFieldValuesByBusiness, setCustomFieldValuesByBusiness] =
    useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    business: false,
    primaryContact: { salutation: false, firstName: false, lastName: false },
    vendorType: false,
    vendorCategory: false,
    internalBusiness: false,
    companyName: false,
    vendorDisplayName: false,
    vendorEmail: false,
    vendorPhone: { workPhone: false, mobile: false },
    currency: false,
    companyRegistrationNumber: false,
    companyTIN: false,
    accountCode: false,
  });

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Validate international phone numbers (E.164-ish). Allows leading "+", spaces, dashes, and parentheses.
  // Valid if it contains 7–15 digits total and at most one leading "+".
  const validatePhoneNumber = (phone) => {
    if (!phone || typeof phone !== "string") return false;
    const trimmed = phone.trim();
    const plusOccurrences = (trimmed.match(/\+/g) || []).length;
    if (plusOccurrences > 1) return false;
    if (plusOccurrences === 1 && trimmed[0] !== "+") return false;
    const digitsOnly = trimmed.replace(/\D/g, "");
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  };

  const fetchCurrenciesForBusinesses = async (businessIds) => {
    if (!businessIds?.length) {
      setCurrenciesByBusiness({});
      return;
    }

    setIsLoading((prev) => ({ ...prev, currencies: true }));
    try {
      const results = await Promise.all(
        businessIds.map(async (id) => {
          const response = await axios.get(
            `${Base_URL}/finance/currencies?business_id=${id}`
          );
          return { id, data: response.data.data || [] };
        })
      );
      const next = {};
      results.forEach(({ id, data }) => {
        next[id] = data;
      });
      setCurrenciesByBusiness(next);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      setCurrenciesByBusiness({});
    } finally {
      setIsLoading((prev) => ({ ...prev, currencies: false }));
    }
  };

  const fetchChartAccountsForBusinesses = async (businessIds) => {
    if (!businessIds?.length) {
      setChartAccounts([]);
      return;
    }

    setIsLoading((prev) => ({ ...prev, accounts: true }));
    try {
      const idsParam = businessIds.join(",");
      const response = await axios.get(
        `${Base_URL}/accounts?businessIds=${encodeURIComponent(idsParam)}&limit=2000`
      );
      setChartAccounts(response.data.accounts || []);
    } catch (error) {
      console.error("Error fetching chart of accounts:", error);
      setChartAccounts([]);
    } finally {
      setIsLoading((prev) => ({ ...prev, accounts: false }));
    }
  };

  const [errors, setErrors] = useState({
    business: "",
    primaryContact: { salutation: "", firstName: "", lastName: "" },
    vendorType: "",
    vendorCategory: "",
    internalBusiness: "",
    companyName: "",
    vendorDisplayName: "",
    vendorEmail: "",
    vendorPhone: { workPhone: "", mobile: "" },
    currency: "",
    companyRegistrationNumber: "",
    companyTIN: "",
    accountCode: "",
  });

  // Business is always stored as an array of id strings (single- vs multi-select is UI only).
  const initialBusinessValue = [];

  const [formData, setFormData] = useState({
    business: initialBusinessValue,
    primaryContact: { salutation: "", firstName: "", lastName: "" },
    vendorType: "Individual",
    vendorCategory: "Internal",
    internalBusiness: null,
    companyName: "",
    vendorDisplayName: "",
    vendorEmail: "",
    vendorPhone: { workPhone: "", mobile: "" },
    currency: "",
    companyRegistrationNumber: "",
    companyTIN: "",
    accountCode: "",
    region: "",
    regionCoordinates: { lat: null, lng: null },
    riderDetails: {
      icNumber: "",
      bikeRegistrationNumber: "",
    },
  });

  // Generate Display Name Suggestions
  useEffect(() => {
    const { salutation, firstName, lastName } = formData.primaryContact;
    const { companyName } = formData;

    let suggestions = [];

    if (firstName) {
      suggestions.push(`${salutation ? salutation + " " : ""}${firstName}`);
    }
    if (firstName && lastName) {
      suggestions.push(`${firstName} ${lastName}`);
      suggestions.push(`${lastName} ${firstName}`);
    }
    if (companyName) {
      suggestions.push(companyName);
    }

    // Remove duplicates and empty strings
    const uniqueSuggestions = [
      ...new Set(suggestions.filter((s) => s && s.trim() !== "")),
    ];
    setDisplayNameSuggestions(uniqueSuggestions);
  }, [formData.primaryContact, formData.companyName]);

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

  // ✅ Fetch Vendor Types only when business changes
  useEffect(() => {
    // Check if business is empty based on mode
    const isBusinessEmpty =
      !formData.business ||
      formData.business === "" ||
      (Array.isArray(formData.business) && formData.business.length === 0);

    if (isBusinessEmpty) return;

    const fetchVendorTypes = async () => {
      setIsLoading((prev) => ({ ...prev, vendorType: true }));
      try {
        const businessId = getSelectedBusinessIds(formData.business)[0] || null;

        console.log("🔍 Fetching Vendor Types for Business ID:", businessId);

        const response = await axios.post(
          `${Base_URL}/items/Vendor Type/get_all`,
          {
            business_id: businessId,
            FilterStatus: "active",
          }
        );

        if (response.data.success) {
          setVendorTypes(response.data.data);
        } else {
          throw new Error("Failed to fetch vendor types");
        }
      } catch (err) {
        console.error("❌ Error fetching vendor types:", err);
      } finally {
        setIsLoading((prev) => ({ ...prev, vendorType: false }));
      }
    };

    fetchVendorTypes();
  }, [formData.business, isEditMode]);

  // Auto-select first Vendor Type when options load (create mode only)
  useEffect(() => {
    if (isEditMode || !vendorTypes.length) return;
    const firstType = vendorTypes[0]?.name;
    if (firstType) {
      setFormData((prev) => {
        if (prev.vendorType === firstType) return prev;
        const next = { ...prev, vendorType: firstType };
        onChange(next);
        return next;
      });
    }
  }, [vendorTypes.length, isEditMode]);

  // Populate form with initial data when editing
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      let businessValue;
      if (Array.isArray(initialData.business)) {
        businessValue = initialData.business;
      } else if (initialData.business?._id || initialData.business) {
        const id =
          typeof initialData.business === "object"
            ? initialData.business._id ?? initialData.business.value ?? initialData.business.id
            : initialData.business;
        businessValue = [id];
      } else {
        businessValue = [];
      }

      const businessIdsNormalized = getSelectedBusinessIds(businessValue);

      setFormData((prev) => ({
        ...prev,
        business: businessIdsNormalized,
        primaryContact: {
          salutation: initialData.primaryContact?.salutation || "",
          firstName: initialData.primaryContact?.firstName || "",
          lastName: initialData.primaryContact?.lastName || "",
        },
        vendorType: initialData.vendorType || "Individual",
        vendorCategory: initialData.vendorCategory || "Internal",
        internalBusiness: initialData.internalBusiness || null,
        companyName: initialData.companyName || "",
        vendorDisplayName: initialData.vendorDisplayName || "",
        vendorEmail: initialData.vendorEmail || "",
        vendorPhone: {
          workPhone: initialData.vendorPhone?.workPhone || "",
          mobile: initialData.vendorPhone?.mobile || "",
        },
        currency:
          (initialData.currency && typeof initialData.currency === "object"
            ? initialData.currency._id
            : initialData.currency) || "",
        companyRegistrationNumber: initialData.companyRegistrationNumber || "",
        companyTIN: initialData.companyTIN || "",
        accountCode:
          (initialData.accountCode &&
          typeof initialData.accountCode === "object"
            ? initialData.accountCode._id
            : initialData.accountCode) || "",
        region: initialData.region || "",
        regionCoordinates: initialData.regionCoordinates || {
          lat: null,
          lng: null,
        },
        riderDetails: {
          icNumber: initialData?.riderDetails?.icNumber || "",
          bikeRegistrationNumber:
            initialData?.riderDetails?.bikeRegistrationNumber || "",
        },
      }));
    }
  }, [initialData, isEditMode]);

  // Auto-select when only one business exists (create mode; edit uses loaded vendor data).
  useEffect(() => {
    if (businesses.length !== 1 || isEditMode) return;
    if (Array.isArray(formData.business) && formData.business.length > 0) {
      return;
    }
    const bid = String(businesses[0]._id);
    setFormData((prev) => ({
      ...prev,
      business: [bid],
    }));
  }, [businesses, isEditMode, formData.business]);

  // Currencies + chart accounts for all selected businesses (merged in dropdowns below)
  useEffect(() => {
    const ids = getSelectedBusinessIds(formData.business);
    fetchCurrenciesForBusinesses(ids);
    fetchChartAccountsForBusinesses(ids);
  }, [formData.business, isEditMode]);


  // Validate form and update errors
  useEffect(() => {
    const businessSelected = Array.isArray(formData.business)
      ? formData.business.length > 0
      : Boolean(formData.business);

    // Only validate fields that have been touched or when showErrors is true
    let newErrors = {
      business:
        (showErrors || touchedFields.business) && !businessSelected
          ? t("vendor.validation.businessRequired")
          : "",
      primaryContact: {
        salutation:
          (showErrors || touchedFields.primaryContact?.salutation) &&
          !formData.primaryContact?.salutation
            ? t("vendor.validation.salutationRequired")
            : "",
        firstName:
          (showErrors || touchedFields.primaryContact?.firstName) &&
          !formData.primaryContact?.firstName?.trim()
            ? t("vendor.validation.firstNameRequired")
            : "",
        lastName:
          (showErrors || touchedFields.primaryContact?.lastName) &&
          !formData.primaryContact?.lastName?.trim()
            ? t("vendor.validation.lastNameRequired")
            : "",
      },
      vendorType: "",
      vendorCategory: "",
      internalBusiness: "",
      companyName: "",
      vendorDisplayName:
        (showErrors || touchedFields.vendorDisplayName) &&
        !formData.vendorDisplayName
          ? t("vendor.validation.displayNameRequired")
          : "",
      vendorEmail: !formData.vendorEmail?.trim()
        ? t("vendor.validation.emailRequired")
        : !validateEmail(formData.vendorEmail)
          ? t("vendor.validation.invalidEmail")
          : "",
      vendorPhone: {
        workPhone:
          formData.vendorPhone.workPhone &&
          !validatePhoneNumber(formData.vendorPhone.workPhone)
            ? t("vendor.validation.invalidPhone")
            : "",
        mobile:
          formData.vendorPhone.mobile &&
          !validatePhoneNumber(formData.vendorPhone.mobile)
            ? t("vendor.validation.invalidPhone")
            : "",
      },
      currency: "",
      companyRegistrationNumber: "",
      companyTIN: "",
      accountCode: "",
    };

    setErrors(newErrors);

    // Check if any errors exist. Vendor Type and Vendor Category are optional.
    const hasErrors =
      newErrors.business !== "" ||
      newErrors.primaryContact.salutation !== "" ||
      newErrors.primaryContact.firstName !== "" ||
      newErrors.primaryContact.lastName !== "" ||
      newErrors.vendorDisplayName !== "" ||
      newErrors.vendorEmail !== "";

    // Required fields: Business, Primary Contact, Vendor Display Name, Email.
    const requiredFieldsFilled =
      businessSelected &&
      formData.primaryContact?.salutation &&
      formData.primaryContact?.firstName?.trim() !== "" &&
      formData.primaryContact?.lastName?.trim() !== "" &&
      formData.vendorDisplayName &&
      formData.vendorDisplayName.trim() !== "" &&
      formData.vendorEmail?.trim() !== "" &&
      validateEmail(formData.vendorEmail);

    setIsSaveDisabled(hasErrors || !requiredFieldsFilled);
  }, [formData, showErrors, touchedFields, t]);

  // Handle input changes
  const handleChange = (field, value) => {
    // Mark field as touched when user interacts with it
    if (!touchedFields[field]) {
      setTouchedFields((prev) => ({
        ...prev,
        [field]: true,
      }));
    }

    setFormData((prev) => {
      const updatedData = { ...prev, [field]: value };

      if (field === "business") {
        updatedData.currency = "";
        updatedData.accountCode = "";
      }
      // Hide/clear company-only fields for Individual vendor type.
      if (field === "vendorType" && value === "Individual") {
        updatedData.companyName = "";
        updatedData.companyRegistrationNumber = "";
        updatedData.companyTIN = "";
      }

      onChange(updatedData);
      return updatedData;
    });
  };

  // Handle nested input changes
  const handleNestedChange = (parentField, childField, value) => {
    // Mark nested field as touched when user interacts with it
    if (
      !touchedFields[parentField] ||
      !touchedFields[parentField][childField]
    ) {
      setTouchedFields((prev) => ({
        ...prev,
        [parentField]: {
          ...prev[parentField],
          [childField]: true,
        },
      }));
    }

    setFormData((prev) => {
      const updatedParent = { ...prev[parentField], [childField]: value };
      const updatedData = { ...prev, [parentField]: updatedParent };
      onChange(updatedData);
      return updatedData;
    });
  };

  const handleRiderDetailsChange = (field, value) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        riderDetails: {
          ...(prev.riderDetails || {}),
          [field]: value,
        },
      };
      onChange(updatedData);
      return updatedData;
    });
  };

  // Handle blur events to mark field as touched
  const handleBlur = (field) => {
    setTouchedFields((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  // Handle nested blur events
  const handleNestedBlur = (parentField, childField) => {
    setTouchedFields((prev) => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [childField]: true,
      },
    }));
  };

  // Function to determine if error should be shown for a field
  const shouldShowError = (field) => {
    return showErrors || touchedFields[field];
  };

  // Function to determine if nested error should be shown
  const shouldShowNestedError = (parentField, childField) => {
    return (
      showErrors ||
      (touchedFields[parentField] && touchedFields[parentField][childField])
    );
  };

  // Function to get input class based on error state
  const getInputClass = (errorCondition, shouldShow) => {
    return `w-full border ${
      errorCondition && shouldShow ? "border-red-500" : "border-gray-300"
    } rounded-md p-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]`;
  };

  const handleSave = async () => {
    setShowErrors(true);
    if (isSaveDisabled) {
      notifyError(t("common.fixValidationErrors"));
      return;
    }
    const selectedBusinessIds = getSelectedBusinessIds(formData.business);
    for (const bid of selectedBusinessIds) {
      try {
        const defs = await fetchDefinitions(
          { businessId: bid, module: "purchase", screen: "customer" },
          requestHeaders,
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
          e?.response?.data?.message || t("vendor.validation.couldNotValidateCustomFields"),
        );
        return;
      }
    }
    await onSave(formData, { customFieldValuesByBusiness });
  };

  const mergedCurrencyOptions = useMemo(() => {
    const selectedIds = getSelectedBusinessIds(formData.business);
    const seen = new Map();
    selectedIds.forEach((bid) => {
      const bname =
        businesses.find((x) => String(x._id) === String(bid))?.name || "";
      (currenciesByBusiness[bid] || []).forEach((c) => {
        const id = (c._id || "").toString();
        if (!id || seen.has(id)) return;
        const label =
          selectedIds.length > 1
            ? `${c.symbol} (${c.prefix}) · ${bname}`
            : `${c.symbol} (${c.prefix})`;
        seen.set(id, { value: c._id, label });
      });
    });
    return Array.from(seen.values());
  }, [formData.business, currenciesByBusiness, businesses]);

  const mergedAccountOptions = useMemo(() => {
    const selectedIds = getSelectedBusinessIds(formData.business);
    const seen = new Map();
    chartAccounts.forEach((account) => {
      const id = (account._id || "").toString();
      if (!id || seen.has(id)) return;
      const b = businesses.find(
        (x) => String(x._id) === String(account.business)
      );
      const label =
        selectedIds.length > 1 && b?.name
          ? `${account.code || "N/A"} - ${account.accountName} · ${b.name}`
          : `${account.code || "N/A"} - ${account.accountName}`;
      seen.set(id, { value: account._id, label });
    });
    return Array.from(seen.values());
  }, [formData.business, chartAccounts, businesses]);

  useEffect(() => {
    const curIds = new Set(mergedCurrencyOptions.map((o) => String(o.value)));
    const acctIds = new Set(mergedAccountOptions.map((o) => String(o.value)));
    setFormData((prev) => {
      const curInvalid =
        prev.currency &&
        curIds.size > 0 &&
        !curIds.has(String(prev.currency));
      const acctInvalid =
        prev.accountCode &&
        acctIds.size > 0 &&
        !acctIds.has(String(prev.accountCode));
      if (!curInvalid && !acctInvalid) return prev;
      return {
        ...prev,
        currency: curInvalid ? "" : prev.currency,
        accountCode: acctInvalid ? "" : prev.accountCode,
      };
    });
  }, [mergedCurrencyOptions, mergedAccountOptions]);

  const selectedIds = getSelectedBusinessIds(formData.business);

  /* Purchase module stores vendor master fields under screen `customer` (see CUSTOM_FIELD_SCREENS_BY_MODULE).
     Always use rowHeadroom=0 and a full-width raw-custom row so all definitions share one grid-cols-2 layout
     aligned with IC / Account Code / Bike (no split between parent row + nested col-span-2 block). */
  const renderVendorCustomFields = () =>
    selectedIds.length > 0 ? (
      selectedIds.length === 1 ? (
        <DynamicCustomFieldsForm
          key={`${selectedIds[0]}-${vendorId || "new"}`}
          businessId={selectedIds[0]}
          module="purchase"
          screen="customer"
          recordId={vendorId || undefined}
          values={customFieldValuesByBusiness[selectedIds[0]] || {}}
          onValuesChange={(v) =>
            setCustomFieldValuesByBusiness((prev) => ({
              ...prev,
              [selectedIds[0]]: v,
            }))
          }
          headers={requestHeaders}
          rowHeadroom={0}
          columns={2}
          fieldsRowGapClassName="gap-4"
          fieldsStackSpacingClassName="space-y-4"
        />
      ) : (
        <div className="w-full space-y-4">
          {selectedIds.map((bid) => {
            const bname =
              businesses.find((x) => String(x._id) === String(bid))?.name ||
              t("vendor.business");
            return (
              <DynamicCustomFieldsForm
                key={`${bid}-${vendorId || "new"}`}
                businessId={bid}
                module="purchase"
                screen="customer"
                recordId={vendorId || undefined}
                values={customFieldValuesByBusiness[bid] || {}}
                onValuesChange={(v) =>
                  setCustomFieldValuesByBusiness((prev) => ({
                    ...prev,
                    [bid]: v,
                  }))
                }
                headers={requestHeaders}
                rowHeadroom={0}
                columns={2}
                fieldsRowGapClassName="gap-4"
                fieldsStackSpacingClassName="space-y-4"
                caption={
                  selectedIds.length > 1 ? t("vendor.fieldsForBusiness", { name: bname }) : undefined
                }
              />
            );
          })}
        </div>
      )
    ) : null;

  const formFields = [
    {
      name: "business",
      type: "select",
      label: t("vendor.business"),
      tightLabelInputSpacing: true,
      required: true,
      options: businesses.map((business) => ({
        value: String(business._id),
        label: business.name,
      })),
      placeholder: t("vendor.selectBusinesses"),
      // DropdownBasic (react-select) expects STRING when isMulti=false.
      // This screen stores `formData.business` as ARRAY in create mode, so we derive the right value for display.
      value:
        businesses.length === 1
          ? Array.isArray(formData.business)
            ? formData.business?.[0] ?? ""
            : formData.business ?? ""
          : formData.business,
      error: errors.business,
      shouldShowError: shouldShowError("business"),
      disabled: false, // Keep enabled even when only 1 business is assigned
      isMulti: businesses.length > 1, // Multi-select when multiple businesses (create + edit)
      onChange: (value) => {
        if (businesses.length === 1) {
          // Keep internal state shape consistent: array of IDs.
          handleChange("business", value ? [value] : []);
          return;
        }
        handleChange("business", value);
      },
      onBlur: () => handleBlur("business"),
    },
    {
      name: "primaryContact",
      type: "multi-field",
      label: t("vendor.primaryContact"),
      required: true,
      /** Salutation, first name, and last name in one row (responsive: stack on small screens). */
      rowLayout: [3],
      fields: [
        {
          name: "salutation",
          type: "select",
        
          options: [
            { value: "Mr", label: "Mr" },
            { value: "Mrs", label: "Mrs" },
            { value: "Ms", label: "Ms" },
            { value: "Dr", label: "Dr" },
          ],
          placeholder: "",
          error: errors.primaryContact.salutation,
          shouldShowError: shouldShowError("primaryContact.salutation"),
          value: formData.primaryContact.salutation,
          onChange: (value) =>
            handleNestedChange("primaryContact", "salutation", value),
          onBlur: () => handleNestedBlur("primaryContact", "salutation"),
          required: true,
        },
        {
          name: "firstName",
          type: "text",
          error: errors.primaryContact.firstName,
          shouldShowError: shouldShowError("primaryContact.firstName"),
          value: formData.primaryContact.firstName,
          placeholder: t("vendor.enterFirstName"),
          onChange: (e) =>
            handleNestedChange("primaryContact", "firstName", e.target.value),
          onBlur: () => handleNestedBlur("primaryContact", "firstName"),
          required: true,
        },
        {
          name: "lastName",
          type: "text",
          error: errors.primaryContact.lastName,
          shouldShowError: shouldShowError("primaryContact.lastName"),
          value: formData.primaryContact.lastName,
          placeholder: t("vendor.enterLastName"),
          onChange: (e) =>
            handleNestedChange("primaryContact", "lastName", e.target.value),
          onBlur: () => handleNestedBlur("primaryContact", "lastName"),
          required: true,
        },
      ],
    },
    {
      name: "vendorType",
      type: "select",
      label: t("vendor.vendorType"),
      required: false,
      options: vendorTypes.length > 0
        ? vendorTypes.map((type) => ({
            value: type.name,
            label: type.name,
          }))
        : [
            { value: "Individual", label: t("vendor.individual") },
            { value: "Company", label: t("vendor.company") },
          ],
      placeholder: t("vendor.selectVendorType"),
      error: errors.vendorType,
      shouldShowError: shouldShowError("vendorType"),
      value: formData.vendorType,
      onChange: (value) => handleChange("vendorType", value),
      onBlur: () => handleBlur("vendorType"),
    },
    {
      name: "vendorDisplayName",
      type: "select",
      label: t("vendor.vendorDisplayName"),
      required: true,
      options: (() => {
        const allOptions = [];
        // Add current value if it exists and is not empty
        if (
          formData.vendorDisplayName &&
          formData.vendorDisplayName.trim() !== ""
        ) {
          allOptions.push({
            value: formData.vendorDisplayName,
            label: formData.vendorDisplayName,
          });
        }
        // Add suggestions, excluding duplicates
        displayNameSuggestions.forEach((name) => {
          if (
            name &&
            name.trim() !== "" &&
            !allOptions.find((opt) => opt.value === name)
          ) {
            allOptions.push({
              value: name,
              label: name,
            });
          }
        });
        return allOptions;
      })(),
      placeholder: t("vendor.selectVendorDisplayName"),
      value: formData.vendorDisplayName,
      error: errors.vendorDisplayName,
      shouldShowError: shouldShowError("vendorDisplayName"),
      onChange: (value) => handleChange("vendorDisplayName", value),
    },
    {
      name: "vendorCategory",
      type: "select",
      label: t("vendor.vendorCategory"),
      required: false,
      options: [
        { value: "Internal", label: t("vendor.internal") },
        { value: "External", label: t("vendor.external") },
      ],
      placeholder: t("vendor.selectVendorCategory"),
      error: errors.vendorCategory,
      shouldShowError: shouldShowError("vendorCategory"),
      value: formData.vendorCategory,
      onChange: (value) => handleChange("vendorCategory", value),
      onBlur: () => handleBlur("vendorCategory"),
    },
    {
      name: "companyName",
      type: "text",
      label: t("vendor.companyName"),
      show: formData.vendorType === "Company",
      error: errors.companyName,
      shouldShowError: shouldShowError("companyName"),
      placeholder: t("vendor.enterCompanyName"),
      value: formData.companyName,
      onChange: (e) => handleChange("companyName", e.target.value),
      onBlur: () => handleBlur("companyName"),
      required: false,
    },
    {
      name: "companyRegistrationNumber",
      type: "text",
      label: t("vendor.companyRegistrationNumber"),
      show: formData.vendorType === "Company",
      error: errors.companyRegistrationNumber,
      shouldShowError: shouldShowError("companyRegistrationNumber"),
      placeholder: t("vendor.enterCompanyRegistrationNumber"),
      value: formData.companyRegistrationNumber,
      onChange: (e) => handleChange("companyRegistrationNumber", e.target.value),
      onBlur: () => handleBlur("companyRegistrationNumber"),
      required: false,
    },
    {
      name: "companyTIN",
      type: "text",
      label: t("vendor.companyTIN"),
      show: formData.vendorType === "Company",
      error: errors.companyTIN,
      shouldShowError: shouldShowError("companyTIN"),
      placeholder: t("vendor.enterCompanyTIN"),
      value: formData.companyTIN,
      onChange: (e) => handleChange("companyTIN", e.target.value),
      onBlur: () => handleBlur("companyTIN"),
      required: false,
    },
    {
      name: "vendorEmail",
      type: "email",
      label: t("vendor.vendorEmail"),
      error: errors.vendorEmail,
      shouldShowError: shouldShowError("vendorEmail"),
      placeholder: t("vendor.enterVendorEmail"),
      value: formData.vendorEmail,
      onChange: (e) => handleChange("vendorEmail", e.target.value),
      onBlur: () => handleBlur("vendorEmail"),
      required: true,
      disabled: false,
    },
    {
      name: "vendorPhone",
      type: "multi-field",
      label: t("vendor.vendorPhone"),
      required: false,
      rowLayout: [2],
      fields: [
        {
          name: "workPhone",
          type: "tel",
          required: false,
          placeholder: t("vendor.workPhone"),
          value: formData.vendorPhone.workPhone,
          onChange: (e) => {
            const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
            handleNestedChange("vendorPhone", "workPhone", phoneValue);
          },
          onBlur: () => handleNestedBlur("vendorPhone", "workPhone"),
          error: errors.vendorPhone.workPhone,
          shouldShowError: shouldShowNestedError(
            "vendorPhone",
            "workPhone",
          ),
          inputMode: "tel",
          pattern: "[0-9+s-()]*",
        },
        {
          name: "mobile",
          type: "tel",
          required: false,
          placeholder: t("vendor.mobilePhone"),
          value: formData.vendorPhone.mobile,
          onChange: (e) => {
            const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
            handleNestedChange("vendorPhone", "mobile", phoneValue);
          },
          onBlur: () => handleNestedBlur("vendorPhone", "mobile"),
          error: errors.vendorPhone.mobile,
          shouldShowError: shouldShowNestedError("vendorPhone", "mobile"),
          inputMode: "tel",
          pattern: "[0-9+s-()]*",
        },
      ],
    },
    {
      name: "currency",
      type: "select",
      label: t("vendor.currency"),
      options: mergedCurrencyOptions,
      placeholder: isLoading.currencies
        ? t("vendor.loadingCurrencies")
        : selectedIds.length === 0
          ? t("vendor.selectBusinessFirst")
          : t("vendor.selectCurrency"),
      error: errors.currency,
      shouldShowError: shouldShowError("currency"),
      value: formData.currency,
      onChange: (value) => handleChange("currency", value),
      onBlur: () => handleBlur("currency"),
      disabled: isLoading.currencies || selectedIds.length === 0,
      required: false,
    },
    {
      name: "riderDetails.icNumber",
      type: "text",
      label: t("vendor.icNumber"),
      placeholder: t("vendor.enterIcNumber"),
      value: formData?.riderDetails?.icNumber || "",
      onChange: (e) =>
        handleRiderDetailsChange("icNumber", e.target.value),
      required: false,
    },
    {
      name: "accountCode",
      type: "select",
      label: t("vendor.accountCode"),
      options: mergedAccountOptions,
      placeholder: isLoading.accounts
        ? t("vendor.loadingAccounts")
        : selectedIds.length === 0
          ? t("vendor.selectBusinessFirst")
          : t("vendor.selectAccountCode"),
      error: errors.accountCode,
      shouldShowError: shouldShowError("accountCode"),
      value: formData.accountCode,
      onChange: (value) => handleChange("accountCode", value),
      onBlur: () => handleBlur("accountCode"),
      disabled: isLoading.accounts || selectedIds.length === 0,
      required: false,
    },
    {
      name: "riderDetails.bikeRegistrationNumber",
      type: "text",
      label: t("vendor.bikeRegistrationNumber"),
      placeholder: t("vendor.enterBikeRegistrationNumber"),
      value: formData?.riderDetails?.bikeRegistrationNumber || "",
      onChange: (e) =>
        handleRiderDetailsChange("bikeRegistrationNumber", e.target.value),
      required: false,
      /** Half row (single business): pairs with empty cell; multi-business: full width. */
      fullWidth: selectedIds.length > 1,
    },
    {
      type: "raw-custom",
      name: "__vendor_custom_fields_anchor__",
      show: selectedIds.length > 0,
      /** Own Form row so inner grid-cols-2 lines up with fields above (IC | Account, etc.). */
      fullWidth: true,
      mergeIntoParentGrid: false,
      component: () => renderVendorCustomFields(),
    },
  ];

  return (
    <div className="space-y-4 ">
      <Form
        title=""
        saveButtonText={t("vendor.saveBasicInfo")}
        formFields={formFields}
        handleSubmit={handleSave}
        handleCancel={exitVendorsScreen}
        isOpen={true}
        labelAndFieldDirection="column"
        tightLabelInputSpacing={true}
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
        beforeFooter={null}
      />
    </div>
  );
};

export default BasicInformation;
