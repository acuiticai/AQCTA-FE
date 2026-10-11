import React, { useState } from "react";
import { X, UserPlus } from "lucide-react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { notifyError, notifySuccess } from "@/utils/toast";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Minimal modal to add a customer quickly (e.g. while creating an invoice or sales order).
 * Requires business to be selected. On success, returns the created customer so parent can select it.
 */
const QuickAddCustomerModal = ({
  isOpen,
  onClose,
  businessId,
  baseUrl,
  headers,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customerDisplayName: "",
    customerEmail: "",
    mobile: "",
  });
  const [errors, setErrors] = useState({});

  const validateEmailField = (value) => {
    const email = (value || "").trim();
    if (!email)
      return t("accounts.customerInvoices.quickAddCustomer.emailRequired");
    if (!EMAIL_REGEX.test(email))
      return t("accounts.customerInvoices.quickAddCustomer.invalidEmail");
    return "";
  };

  const validate = () => {
    const next = {};
    if (!formData.customerDisplayName?.trim()) {
      next.customerDisplayName = t(
        "accounts.customerInvoices.quickAddCustomer.displayNameRequired",
      );
    }
    const emailError = validateEmailField(formData.customerEmail);
    if (emailError) {
      next.customerEmail = emailError;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleEmailChange = (value) => {
    setFormData((prev) => ({ ...prev, customerEmail: value }));
    setErrors((prev) => {
      const next = { ...prev };
      const emailError = value.trim() ? validateEmailField(value) : "";
      if (emailError) next.customerEmail = emailError;
      else delete next.customerEmail;
      return next;
    });
  };

  const handleEmailBlur = () => {
    setErrors((prev) => {
      const next = { ...prev };
      const emailError = validateEmailField(formData.customerEmail);
      if (emailError) next.customerEmail = emailError;
      else delete next.customerEmail;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessId) {
      notifyError(
        t("accounts.customerInvoices.quickAddCustomer.selectBusinessFirst"),
      );
      return;
    }
    if (!validate()) return;

    setSaving(true);
    setErrors({});
    try {
      const displayName = formData.customerDisplayName?.trim() || "";
      // For Individual: show display name in customer list "Name" column (primaryContact)
      const nameParts = displayName.split(/\s+/);
      const firstName = nameParts[0] || displayName;
      const lastName = nameParts.slice(1).join(" ") || "";

      const payload = {
        business: businessId,
        basicInformation: {
          client_type: "Individual",
          customerDisplayName: displayName,
          primaryContact: {
            salutation: "",
            firstName,
            lastName,
          },
          customerEmail: formData.customerEmail?.trim() || undefined,
          customerPhone: formData.mobile?.trim()
            ? { workPhone: "", mobile: formData.mobile.trim() }
            : undefined,
        },
      };

      const response = await axios.post(`${baseUrl}/customers`, payload, {
        headers: headers || { "Content-Type": "application/json" },
      });

      const newCustomer = response?.data?.data;
      if (newCustomer && typeof onSuccess === "function") {
        onSuccess(newCustomer);
      }
      notifySuccess(
        t("accounts.customerInvoices.quickAddCustomer.addedSuccessfully"),
      );
      resetAndClose();
    } catch (err) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          t("accounts.customerInvoices.quickAddCustomer.addFailed");
        notifyError(message);
        if (err?.response?.data?.field) {
          setErrors((prev) => ({ ...prev, [err.response.data.field]: message }));
        }
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setFormData({
      customerDisplayName: "",
      customerEmail: "",
      mobile: "",
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={resetAndClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--p-blue)]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t("accounts.customerInvoices.quickAddCustomer.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)]"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("accounts.customerInvoices.quickAddCustomer.displayName")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customerDisplayName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  customerDisplayName: e.target.value,
                }))
              }
              placeholder={t(
                "accounts.customerInvoices.quickAddCustomer.namePlaceholder",
              )}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
            {errors.customerDisplayName && (
              <p className="mt-1 text-xs text-red-500">{errors.customerDisplayName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("common.email")} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="customer@example.com"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                errors.customerEmail ? "border-red-400" : "border-gray-300"
              }`}
            />
            {errors.customerEmail && (
              <p className="mt-1 text-xs text-red-500">{errors.customerEmail}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("common.phone")}
            </label>
            <input
              type="text"
              value={formData.mobile}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, mobile: e.target.value }))
              }
              placeholder={t("common.optional")}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[var(--p-blue)] rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--p-blue)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving
                ? t("accounts.customerInvoices.quickAddCustomer.adding")
                : t("accounts.customerInvoices.quickAddCustomer.addCustomer")}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default QuickAddCustomerModal;
