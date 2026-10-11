import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useChequeReminders } from "../../context/ChequeReminderContext";
import { XIcon, ExternalLinkIcon } from "@heroicons/react/outline";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Link } from "react-router-dom";

const ChequeReminderForm = ({ organization, canAdd = false, canUpdate = false }) => {
  const { t } = useTranslation();
  const {
    selectedReminder,
    addReminder,
    updateReminder,
    closeReminderForm,
    fetchReminders,
  } = useChequeReminders();

  const defaultFormData = {
    business: organization,
    name: "",
    days: 7,
    timing: "before",
    type: "due",
    isActive: true,
    copyMe: false,
    ccEmails: "",
    bccEmails: "",
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const canSubmit = selectedReminder ? canUpdate : canAdd;

  const notificationEventsHref = organization
    ? `/notification-events?selectedOrg=${organization}`
    : "/notification-events";

  useEffect(() => {
    if (selectedReminder) {
      setFormData({
        ...defaultFormData,
        ...selectedReminder,
        ccEmails: selectedReminder.ccEmails || "",
        bccEmails: selectedReminder.bccEmails || "",
      });
    } else {
      setFormData({ ...defaultFormData, business: organization });
    }
  }, [selectedReminder, organization]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        business: organization,
        name: formData.name,
        days: Number(formData.days),
        timing: formData.timing,
        type: formData.type,
        isActive: formData.isActive,
        copyMe: formData.copyMe,
        ccEmails: formData.ccEmails,
        bccEmails: formData.bccEmails,
      };

      if (selectedReminder && selectedReminder._id) {
        await updateReminder(selectedReminder._id, payload);
        notifySuccess(t("accountsSettings.chequeReminders.reminderUpdated"));
      } else {
        await addReminder(payload);
        notifySuccess(t("accountsSettings.chequeReminders.reminderCreated"));
      }

      await fetchReminders(organization);
      closeReminderForm();
    } catch (error) {
      console.error("Error saving reminder:", error);
      notifyError(t("accountsSettings.chequeReminders.reminderSaveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="flex justify-between p-4 border-b">
        <h2 className="text-lg font-medium text-gray-700">
          {selectedReminder ? t("accountsSettings.chequeReminders.editReminder") : t("accountsSettings.chequeReminders.newReminder")}
        </h2>
        <button
          type="button"
          onClick={closeReminderForm}
          className="text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Close"
          disabled={isSubmitting}
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-300 rounded">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="name">
              {t("accountsSettings.chequeReminders.name")}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              placeholder="e.g. 7 days before due date"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="reminderType">
              {t("accountsSettings.chequeReminders.reminderType")}
            </label>
            <select
              id="reminderType"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              disabled={isSubmitting}
            >
              <option value="due">{t("accountsSettings.chequeReminders.dueDate")}</option>
              <option value="issue">{t("accountsSettings.chequeReminders.issueDate")}</option>
            </select>
          </div>

          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700" htmlFor="days">
                {t("accountsSettings.chequeReminders.remind")}
              </label>
              <input
                type="number"
                id="days"
                name="days"
                value={formData.days}
                onChange={handleChange}
                min="0"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                required
                disabled={isSubmitting}
              />
            </div>
            <span className="pt-7 text-sm text-gray-600">{t("accountsSettings.chequeReminders.days")}</span>
            <div className="w-36 pt-6">
              <select
                name="timing"
                value={formData.timing}
                onChange={handleChange}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                disabled={isSubmitting}
              >
                <option value="before">{t("accountsSettings.chequeReminders.before")}</option>
                <option value="after">{t("accountsSettings.chequeReminders.after")}</option>
              </select>
            </div>
            <span className="pt-7 text-sm text-gray-600">
              {formData.type === "due" ? t("accountsSettings.chequeReminders.dueDateLabel") : t("accountsSettings.chequeReminders.issueDateLabel")}
            </span>
          </div>

          <div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                id="enableReminder"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-4 w-4 text-[var(--p-blue)] rounded"
                disabled={isSubmitting}
              />
              <span className="ml-2 block text-sm text-gray-700">{t("accountsSettings.chequeReminders.enableReminder")}</span>
            </label>
          </div>

          <div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="copyMe"
                id="copyMeCheque"
                checked={formData.copyMe}
                onChange={handleChange}
                className="h-4 w-4 text-[var(--p-blue)] rounded"
                disabled={isSubmitting}
              />
              <span className="ml-2 block text-sm text-gray-700">
                {t("accountsSettings.chequeReminders.copyMeOnReminders")}
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="ccEmails">
              {t("accountsSettings.chequeReminders.extraRecipients")}
            </label>
            <input
              type="text"
              id="ccEmails"
              name="ccEmails"
              value={formData.ccEmails}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              placeholder="finance@example.com, accounts@example.com"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-sm text-gray-500">
              {t("accountsSettings.chequeReminders.extraRecipientsHelp")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="bccEmails">
              {t("accountsSettings.chequeReminders.bcc")}
            </label>
            <input
              type="text"
              id="bccEmails"
              name="bccEmails"
              value={formData.bccEmails}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              placeholder="optional@example.com"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-start space-x-3">
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--p-blue)] hover:bg-[#95b833] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--p-blue)]"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? t("accountsSettings.chequeReminders.saving") : t("accountsSettings.chequeReminders.save")}
          </button>
          <button
            type="button"
            onClick={closeReminderForm}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            disabled={isSubmitting}
          >
            {t("accountsSettings.chequeReminders.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChequeReminderForm;
