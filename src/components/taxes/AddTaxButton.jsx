import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { createTax } from "@/services/taxServices";
import { notifyError, notifySuccess } from "@/utils/toast";

/**
 * "Add Tax" trigger + modal, designed to be used inside dropdown footers.
 *
 * Props:
 * - businessId: current business/organization id (required to create tax)
 * - headers: auth headers for API (optional; if provided, axios will use them via interceptor/global config)
 * - disabled: disable trigger button
 * - displayMode: 'dropdown' | 'button' (default 'dropdown'); 'dropdown' renders compact button
 * - onAdded: callback(newTax) after successful create so parent can update list/select
 */
const AddTaxButton = ({
  businessId,
  headers, // kept for parity with AddPaymentTermButton; axios usually reads global auth config
  disabled = false,
  displayMode = "dropdown",
  onAdded,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isDropdown = displayMode === "dropdown";

  const resetForm = () => {
    setName("");
    setRate("");
    setErrors({});
    setSubmitting(false);
  };

  const handleOpen = () => {
    if (disabled || !businessId) return;
    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    resetForm();
  };

  const validate = () => {
    const nextErrors = {};
    if (!name.trim()) {
      nextErrors.name = t("accountsSettings.taxes.taxNameRequired");
    }
    if (rate === "" || rate === null) {
      nextErrors.rate = t("accountsSettings.taxes.rateRequired");
    } else if (isNaN(rate) || Number(rate) < 0) {
      nextErrors.rate = t("accountsSettings.taxes.rateInvalid");
    } else if (Number(rate) > 100) {
      nextErrors.rate = t("accountsSettings.taxes.rateExceed");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessId) {
      notifyError(t("accountsSettings.taxes.selectBusinessFirst"));
      return;
    }
    if (!validate()) return;

    try {
      setSubmitting(true);

      const taxData = {
        business: businessId,
        name: name.trim(),
        rate: Number(rate),
      };

      const response = await createTax(taxData, { headers });
      const newTax = response?.data || taxData;

      notifySuccess(t("accountsSettings.taxes.taxAdded"));
      if (onAdded) {
        onAdded(newTax);
      }
      handleClose();
    } catch (error) {
      console.error("Error creating tax:", error);
      if (error?.response?.data?.message) {
        notifyError(error.response.data.message);
      } else {
        notifyError(t("accountsSettings.taxes.taxAddFailed"));
      }
      setSubmitting(false);
    }
  };

  return (
    <>
      {isDropdown ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpen();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={disabled || !businessId || submitting}
          title={t("accountsSettings.taxes.addTax")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--p-blue)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--p-blue)] shadow-sm hover:bg-[var(--p-blue-dark)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-1 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 disabled:hover:text-gray-400"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span>{t("accountsSettings.taxes.addTax")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled || !businessId || submitting}
          title={t("accountsSettings.taxes.addTax")}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
          <span>{t("accountsSettings.taxes.addTax")}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[var(--p-blue)] bg-[#FFF8F0] px-5 py-4">
              <h3 className="text-lg font-semibold text-[#c96d08]">{t("accountsSettings.taxes.addTax")}</h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--p-blue-dark)]/10 hover:text-[#c96d08] disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4" role="form" aria-label="Add Tax Form">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("accountsSettings.taxes.taxNameLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder={t("accountsSettings.taxes.enterTaxName")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                  autoFocus
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("accountsSettings.taxes.rateLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={rate}
                  onChange={(e) => {
                    setRate(e.target.value);
                    if (errors.rate) {
                      setErrors((prev) => ({ ...prev, rate: undefined }));
                    }
                  }}
                  placeholder={t("accountsSettings.taxes.enterTaxRateRange")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)]"
                />
                {errors.rate && (
                  <p className="mt-1 text-xs text-red-500">{errors.rate}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("accountsSettings.taxes.cancel")}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit(e);
                  }}
                  disabled={submitting}
                  className="rounded-lg bg-[var(--p-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--p-blue-dark)] disabled:opacity-50"
                >
                  {submitting ? t("accountsSettings.taxes.adding") : t("accountsSettings.taxes.add")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddTaxButton;

