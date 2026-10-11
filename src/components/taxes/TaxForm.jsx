import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useHistory } from "react-router-dom";
import { getTax, createTax, updateTax } from "../../services/taxServices";
import Header from "@/components/header/Header";
import AppLayout from "../../pages/Settings/app-layout";
import { notifyError } from "@/utils/toast";
import { useRouteModulePermissions } from "@/utils/permissionUtils";

const TaxForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const searchParams = new URLSearchParams(location.search);
  const organization = searchParams.get("organization");
  console.log("Organization:", organization);
  const history = useHistory();
  const isEditing = Boolean(id);
  const { canAdd, canUpdate } = useRouteModulePermissions();
  const canSubmit = isEditing ? canUpdate : canAdd;

  const [formData, setFormData] = useState({
    business: organization,
    name: "",
    rate: "",
    isCompoundTax: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEditing) {
      fetchTax();
    }
  }, [id]);

  const fetchTax = async () => {
    try {
      setLoading(true);
      const response = await getTax(id);
      setFormData({
        business: response.data.business,
        name: response.data.name,
        rate: response.data.rate,
        isCompoundTax: response.data.isCompoundTax || false,
      });
      setLoading(false);
    } catch (error) {
      console.error("Error fetching tax:", error);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t("accountsSettings.taxes.taxNameRequired");
    }

    if (!formData.rate) {
      newErrors.rate = t("accountsSettings.taxes.rateRequired");
    } else if (isNaN(formData.rate) || Number(formData.rate) < 0) {
      newErrors.rate = t("accountsSettings.taxes.rateInvalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (!validate()) return;

    try {
      setLoading(true);

      const taxData = {
        business: organization,
        name: formData.name,
        rate: Number(formData.rate),
        isCompoundTax: formData.isCompoundTax,
      };

      if (isEditing) {
        await updateTax(id, taxData);
      } else {
        await createTax(taxData);
      }

      setLoading(false);
      history.push(`/taxes?selectedOrg=${organization}`);
    } catch (error) {
      console.error("Error saving tax:", error);
      setLoading(false);

      if (error.response && error.response.data) {
        notifyError(error.response.data.message);
        setErrors(error.response.data.errors || {});
      }
    }
  };

  const handleCancel = () => {
    history.push(`/taxes?selectedOrg=${organization}`);
  };

  if (loading && isEditing) {
    return <div className="p-4 text-center">{t("accountsSettings.taxes.loading")}</div>;
  }

  return (
    <AppLayout>
      <Header title={t("accountsSettings.taxes.title")} />
      <div className="bg-white mt-10 rounded-lg shadow max-w-2xl mx-auto">
        <div className="flex items-center p-4 border-b">
          <button
            onClick={handleCancel}
            className="text-[var(--p-blue)] mr-3"
          ></button>
          <h1 className="text-xl font-semibold text-gray-800">
            {isEditing ? t("accountsSettings.taxes.editTax") : t("accountsSettings.taxes.newTax")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-mediummb-1">
              {t("accountsSettings.taxes.taxNameLabel")}<span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder={t("accountsSettings.taxes.enterTaxName")}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="rate" className="block text-sm font-medium mb-1">
              {t("accountsSettings.taxes.rateLabel")}<span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="rate"
                name="rate"
                value={formData.rate}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                  errors.rate ? "border-red-500" : "border-gray-300"
                }`}
                placeholder={t("accountsSettings.taxes.enterTaxRate")}
              />
            </div>
            {errors.rate && (
              <p className="mt-1 text-sm text-red-500">{errors.rate}</p>
            )}
          </div>
          {/* 
        <div className="mb-6">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="isCompoundTax"
              name="isCompoundTax"
              checked={formData.isCompoundTax}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-[var(--p-blue)] focus:ring-[var(--p-blue)] border-gray-300 rounded"
            />
            <div className="ml-2">
              <label htmlFor="isCompoundTax" className="text-sm font-medium text-gray-700">
                This tax is a compound tax.
              </label>
              <p className="text-sm text-gray-500">
                Select this option if you charge a second tax in addition to the primary tax.
              </p>
            </div>
          </div>
        </div> */}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              disabled={loading}
            >
              {t("accountsSettings.taxes.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:ring-offset-2"
              disabled={loading || !canSubmit}
            >
              {loading ? t("accountsSettings.taxes.saving") : isEditing ? t("accountsSettings.taxes.updateTax") : t("accountsSettings.taxes.saveTax")}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default TaxForm;
