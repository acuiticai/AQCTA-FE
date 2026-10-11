import React, { useState, useEffect, useMemo, useContext } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { PageHeader, Form, useFormScreenExit } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import { fetchDefinitions } from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
import { persistCustomFieldValuesByBusiness } from "@/utils/customFieldPersistence";
import { injectCustomFieldsInFormFields } from "@/utils/customFieldPlacement";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EditCategoryScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const exitCategoriesScreen = useFormScreenExit("/categories");
  const { id } = useParams();
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
  const [customFieldValues, setCustomFieldValues] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading((prev) => ({ ...prev, form: true }));

      // Load businesses from localStorage
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const parsedBusinesses = JSON.parse(storedBusinesses);
        setBusinesses(parsedBusinesses);
      }

      // Fetch category data for editing
      if (id) {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(`${Base_URL}/categories/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const categoryData = response.data;

          if (/staff\s*man\s*hours?/i.test(String(categoryData?.name || ""))) {
            notifyError(
              t("category.systemLocked", {
                defaultValue:
                  "Staff Manhours is a system category and cannot be edited.",
              }),
            );
            history.push("/categories");
            return;
          }
          
          setFormData({
            business: categoryData.business?._id || categoryData.business || "",
            name: categoryData.name || "",
            description: categoryData.description || "",
          });
        } catch (err) {
          console.error("Error fetching category:", err);
          notifyError(
            t("category.loadFailed", {
              defaultValue: "Failed to load category data",
            }),
          );
          history.push("/categories");
        }
      }

      setIsLoading((prev) => ({ ...prev, form: false }));
    };

    fetchData();
  }, [id, history, t]);

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
    const businessValid = formData.business && (typeof formData.business === "string" ? formData.business.trim() !== "" : true);
    const newErrors = {
      business: !businessValid
        ? t("category.validation.selectBusiness", {
            defaultValue: "Please select a business.",
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
        t("common.fixValidationErrors", {
          defaultValue: "Please fix the validation errors before saving.",
        }),
      );
      return;
    }

    const businessId = String(
      typeof formData.business === "object" && formData.business?._id
        ? formData.business._id
        : formData.business || "",
    );
    if (businessId) {
      try {
        const defs = await fetchDefinitions(
          { businessId, module: "inventory", screen: "category" },
          headers,
        );
        if (defs.length) {
          const cfErr = validateCustomFieldValues(defs, customFieldValues);
          if (cfErr) {
            notifyError(cfErr);
            return;
          }
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.message ||
            t("Could not validate custom fields", {
              defaultValue: "Could not validate custom fields.",
            }),
        );
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const submitData = {
        business: formData.business,
        name: formData.name.trim(),
        description: formData.description?.trim() || "",
        status: "Active", // Always Active by default
        purpose: "inventory",
      };

      await axios.put(`${Base_URL}/categories/${id}`, submitData, {
        headers,
      });

      if (businessId) {
        try {
          await persistCustomFieldValuesByBusiness({
            headers,
            recordId: String(id),
            businessIds: [businessId],
            valuesByBusiness: { [businessId]: customFieldValues },
            module: "inventory",
            screen: "category",
          });
        } catch (cfErr) {
          notifyError(
            cfErr?.response?.data?.message ||
              t("category.customFieldsSaveFailed", {
                defaultValue:
                  "Category updated but custom fields failed to save.",
              }),
          );
          return;
        }
      }

      notifySuccess(
        t("category.updatedSuccess", {
          defaultValue: "Category updated successfully!",
        }),
      );
      history.push("/categories");
    } catch (err) {
      if (err.response?.status === 400) {
        notifyError(
          err.response?.data?.message ||
            t("item.validation.allFieldsRequired", {
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
            t("category.updateFailed", {
              defaultValue: "Failed to update category.",
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
        value: formData.business,
        onChange: (value) => handleDropdownChange("business", value),
        onBlur: () => handleBlur("business"),
        placeholder: t("Select Business"),
        disabled: isLoading.business || businesses.length === 1,
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
      <div className="p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const categoryBusinessId =
    typeof formData.business === "object" && formData.business !== null
      ? formData.business._id
      : formData.business;

  const renderCategoryCustomFields = ({ rowHeadroom = 0 } = {}) =>
    categoryBusinessId ? (
      rowHeadroom > 0 ? (
        <DynamicCustomFieldsForm
          businessId={String(categoryBusinessId)}
          module="inventory"
          screen="category"
          recordId={id}
          values={customFieldValues}
          onValuesChange={setCustomFieldValues}
          headers={headers}
          rowHeadroom={rowHeadroom}
        />
      ) : (
        <DynamicCustomFieldsForm
          businessId={String(categoryBusinessId)}
          module="inventory"
          screen="category"
          recordId={id}
          values={customFieldValues}
          onValuesChange={setCustomFieldValues}
          headers={headers}
        />
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
    <div className="py-6 px-6 min-h-screen">
      <PageHeader
        title={t("category.updateTitle")}
        showBackButton
        backFallbackPath="/categories"
      />
      <Form
        formFields={formFieldsWithCustomFields}
        handleSubmit={handleSubmit}
        handleCancel={exitCategoriesScreen}
        loading={loading}
        buttonColor={buttonColor}
        isOpen={true}
        saveButtonText={t("category.update")}
        cancelButtonText={t("Cancel")}
        labelAndFieldDirection="column"
        tightLabelInputSpacing={true}
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
        beforeFooter={
          renderInFooter ? renderCategoryCustomFields() : null
        }
      />
    </div>
  );
};

export default EditCategoryScreen;
