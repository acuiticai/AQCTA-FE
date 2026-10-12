import React, { useState, useEffect, useMemo, useContext } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { Form, useFormScreenExit } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { fetchDefinitions } from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { persistCustomFieldValuesByBusiness } from "@/utils/customFieldPersistence";
import { injectCustomFieldsInFormFields } from "@/utils/customFieldPlacement";
import { CustomerBrandingProvider } from "@/customer/branding";
import { DetailHeader } from "@/customer/components/ui/DetailBlocks";
import "@/customer/styles/index.css";

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

const NewCategoryScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const exitCategoriesScreen = useFormScreenExit("/categories");
  const buttonColor = useButtonColor();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminInfo?.token}`,
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [formData, setFormData] = useState({
    business: "",
    name: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    business: false,
    name: false,
  });
  const [errors, setErrors] = useState({
    business: "",
    name: "",
  });
  const [isLoading, setIsLoading] = useState({
    business: false,
    form: false,
  });
  const [customFieldValuesByBusiness, setCustomFieldValuesByBusiness] =
    useState({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading((prev) => ({ ...prev, form: true }));

      // Load businesses from localStorage
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const parsedBusinesses = JSON.parse(storedBusinesses);
        setBusinesses(parsedBusinesses);
        
        // Auto-select business if only one exists
        if (parsedBusinesses.length === 1) {
          setFormData((prev) => ({
            ...prev,
            business: parsedBusinesses[0]._id,
          }));
        }
      }

      setIsLoading((prev) => ({ ...prev, form: false }));
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

  const handleDropdownChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const shouldShowError = (field) => showErrors || touchedFields[field];

  // Validation effect
  useEffect(() => {
    const ids = getSelectedBusinessIds(formData.business);
    const businessValid = ids.length > 0;
    const newErrors = {
      business: !businessValid
        ? t("category.validation.selectAtLeastOneBusiness", {
            defaultValue: "Please select at least one business.",
          })
        : "",
      name: !formData.name?.trim()
        ? t("category.validation.nameRequired", {
            defaultValue: "Category name is required.",
          })
        : "",
    };
    setErrors(newErrors);
  }, [formData, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);

    const hasErrors = Object.values(errors).some((err) => err !== "");
    if (hasErrors) {
      notifyError(
        t("category.validation.fixErrors", {
          defaultValue: "Please fix the validation errors before saving.",
        }),
      );
      return;
    }

    const businessIds = getSelectedBusinessIds(formData.business);
    for (const bid of businessIds) {
      try {
        const defs = await fetchDefinitions(
          { businessId: bid, module: "inventory", screen: "category" },
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
          e?.response?.data?.message ||
            t("Could not validate custom fields"),
        );
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const name = formData.name.trim();
      const description = formData.description?.trim() || "";
      let created = 0;
      let skipped = 0;

      for (const bid of businessIds) {
        try {
          const submitData = {
            business: bid,
            name,
            description,
            status: "Active",
            purpose: "inventory",
          };
          const res = await axios.post(`${Base_URL}/categories`, submitData, {
            headers,
          });
          const catId = res.data?.data?._id;
          if (catId) {
            await persistCustomFieldValuesByBusiness({
              headers,
              recordId: String(catId),
              businessIds: [bid],
              valuesByBusiness: customFieldValuesByBusiness,
              module: "inventory",
              screen: "category",
            });
            created += 1;
          }
        } catch (err) {
          if (err.response?.status === 409) {
            skipped += 1;
          } else {
            throw err;
          }
        }
      }

      if (created === 0) {
        notifyError(
          skipped > 0
            ? t("category.alreadyExistsAll", {
                defaultValue:
                  "Category already exists in all selected businesses.",
              })
            : t("category.createFailed", {
                defaultValue: "Failed to create category.",
              }),
        );
        return;
      }
      notifySuccess(
        businessIds.length > 1
          ? skipped
            ? t("category.createdInBusinessesWithSkipped", {
                created,
                skipped,
                defaultValue:
                  "Category created in {{created}} business(es); {{skipped}} skipped (duplicate).",
              })
            : t("category.createdInBusinesses", {
                created,
                defaultValue:
                  "Category created in {{created}} business(es).",
              })
          : t("category.createdSuccess", {
              defaultValue: "Category created successfully!",
            }),
      );
      history.push("/categories");
    } catch (err) {
      if (err.response?.status === 400) {
        notifyError(
          err.response?.data?.message ||
            t("category.validation.allFieldsRequired", {
              defaultValue: "All required fields must be filled!",
            }),
        );
      } else if (err.response?.status === 409) {
        notifyError(
          err.response?.data?.message ||
            t("category.alreadyExists", {
              defaultValue: "Category already exists!",
            }),
        );
      } else {
        notifyError(
          err.response?.data?.message ||
            t("category.saveFailed", {
              defaultValue: "Failed to save category.",
            }),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Build form fields array with proper ordering
  const formFields = useMemo(() => {
    const fields = [
      {
        label: t("Business"),
        name: "business",
        type: "select",
        required: true,
        value:
          businesses.length === 1
            ? Array.isArray(formData.business)
              ? formData.business?.[0] ?? ""
              : formData.business ?? ""
            : formData.business,
        onChange: (value) => {
          if (businesses.length === 1) {
            handleDropdownChange("business", value ? [value] : []);
            return;
          }
          handleDropdownChange("business", value);
        },
        onBlur: () => handleBlur("business"),
        placeholder: t("Select Business"),
        disabled: isLoading.business || businesses.length === 1,
        isMulti: businesses.length > 1,
        options: businesses.map((b) => ({
          value: b._id,
          label: b.name,
          key: b._id,
        })),
        error: errors.business && shouldShowError("business") ? errors.business : null,
        shouldShowError: shouldShowError("business"),
      },
      {
        label: t("category.name"),
        name: "name",
        type: "text",
        required: true,
        placeholder: t("category.namePlaceholder", {
          defaultValue: "Enter Category Name",
        }),
        value: formData.name,
        onChange: handleInputChange,
        onBlur: () => handleBlur("name"),
        error: errors.name && shouldShowError("name") ? errors.name : null,
        shouldShowError: shouldShowError("name"),
      },
      {
        label: t("category.description"),
        name: "description",
        type: "textarea",
        required: false,
        fullWidth: true,
        placeholder: t("category.descriptionPlaceholder"),
        value: formData.description,
        onChange: handleInputChange,
      },
    ];

    return fields;
  }, [
    formData,
    businesses,
    isLoading.business,
    errors,
    showErrors,
    touchedFields,
    t,
  ]);

  if (isLoading.form) {
    return (
      <CustomerBrandingProvider className="epc-admin-wizard-root">
        <div className="epc-admin-wizard flex items-center justify-center min-h-[40vh]">
          <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </CustomerBrandingProvider>
    );
  }

  const selectedIds = getSelectedBusinessIds(formData.business);
  const renderCategoryCustomFields = ({ rowHeadroom = 0 } = {}) =>
    selectedIds.length > 0 ? (
      selectedIds.length === 1 && rowHeadroom > 0 ? (
        <DynamicCustomFieldsForm
          businessId={selectedIds[0]}
          module="inventory"
          screen="category"
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
              screen="category"
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
      screen: "category",
      customFieldComponent: renderCategoryCustomFields,
    });

  return (
    <CustomerBrandingProvider className="epc-admin-wizard-root">
      <div className="epc-admin-wizard">
        <DetailHeader
          title={t("category.new")}
          subtitle={t("category.newSubtitle", {
            defaultValue:
              "Create a category to group items for inventory and sales.",
          })}
          onBack={exitCategoriesScreen}
        />
        <Form
          formFields={formFieldsWithCustomFields}
          handleSubmit={handleSubmit}
          handleCancel={exitCategoriesScreen}
          isSubmitting={loading}
          buttonColor={buttonColor}
          isOpen={true}
          saveButtonText={t("Save")}
          cancelButtonText={t("Cancel")}
          labelAndFieldDirection="column"
          tightLabelInputSpacing={true}
          customLabelWidth="w-full"
          fieldsPerRow={2}
          fieldsStackSpacingClassName="space-y-4"
          fieldsRowGapClassName="gap-4"
          cardLayout
          cardTitle={t("category.categoryDetails", {
            defaultValue: "Category Details",
          })}
          cardSubtitle={t("category.categoryDetailsSubtitle", {
            defaultValue:
              "Provide the business, name, and an optional description for this category.",
          })}
          cardNote={{
            title: t("category.whatHappensNext", {
              defaultValue: "What happens next",
            }),
            body: t("category.whatHappensNextCreate", {
              defaultValue:
                "After you save, this category can be assigned when creating or editing items.",
            }),
          }}
          fieldTheme="invoice"
          fieldAppearance="document"
          beforeFooter={
            renderInFooter ? renderCategoryCustomFields() : null
          }
        />
      </div>
    </CustomerBrandingProvider>
  );
};

export default NewCategoryScreen;
