import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useReminders } from "../../context/ReminderContext";
import RichTextEditor from "./EmailTemplate";
import { XIcon } from "@heroicons/react/outline";
import { notifyError, notifySuccess } from "@/utils/toast";

const ReminderForm = ({ organization, canAdd = false, canUpdate = false }) => {
  const { t } = useTranslation();
  const {
    selectedReminder,
    addReminder,
    updateReminder,
    closeReminderForm,
    fetchReminders,
  } = useReminders();

  const defaultFormData = {
    business: organization,
    name: "",
    days: 7,
    timing: "after",
    type: "due",
    isActive: true,
    copyMe: false,
    fromEmail: "",
    ccEmails: "",
    bccEmails: "",
    subject: "Payment of %Balance% is outstanding for %InvoiceNumber%",
    emailContent: `<p>Dear %CustomerName%,</p>
<p>This is to remind you about the payment details for the below invoice.</p>
<p>--------------------------------------------------------------</p>
<p>Invoice# : %InvoiceNumber%</p>
<p>Due Date : %DueDate%</p>
<p>Overdue By : %OverdueDays%</p>
<p>Amount : %Balance%</p>
<p>--------------------------------------------------------------</p>
<p>View your invoice and take the easy way out by making an online payment.</p>
<p>If you have already paid, please accept our apologies and kindly ignore this payment reminder.</p>
<p>Regards,</p>
<p>%UserName%</p>
<p>%CompanyName%</p>`,
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const canSubmit = selectedReminder ? canUpdate : canAdd;

  // Set form data when selectedReminder changes
  useEffect(() => {
    if (selectedReminder) {
      // Make a deep copy to avoid reference issues
      setFormData({
        ...defaultFormData, // Start with defaults
        ...selectedReminder, // Override with selected reminder data
        // Ensure these fields are strings even if they're null in the database
        fromEmail: selectedReminder.fromEmail || "",
        ccEmails: selectedReminder.ccEmails || "",
        bccEmails: selectedReminder.bccEmails || "",
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [selectedReminder]);

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
      if (selectedReminder && selectedReminder._id) {
        await updateReminder(selectedReminder._id, formData);
        notifySuccess(t("accountsSettings.reminders.reminderUpdated"));
      } else {
        await addReminder(formData);
        notifySuccess(t("accountsSettings.reminders.reminderCreated"));
      }

      // Refresh reminders list to show updated data
      await fetchReminders();

      // Close form and redirect to list
      closeReminderForm();
    } catch (error) {
      console.error("Error saving reminder:", error);
      notifyError(t("accountsSettings.reminders.reminderSaveFailed"));
      //   setSubmitError('Failed to save reminder. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="flex justify-between p-4 border-b">
        <h2 className="text-lg font-medium text-gray-700">
          {selectedReminder ? t("accountsSettings.reminders.editReminder") : t("accountsSettings.reminders.newReminder")}
        </h2>
        <button
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
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="name"
            >
              {t("accountsSettings.reminders.name")}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              placeholder="Reminder # 4"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="reminderType"
            >
              {t("accountsSettings.reminders.reminderType")}
            </label>
            <select
              id="reminderType"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              disabled={isSubmitting}
            >
              <option value="due">{t("accountsSettings.reminders.dueDate")}</option>
              <option value="expected">{t("accountsSettings.reminders.expectedPaymentDate")}</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <div className="w-1/6">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="days"
              >
                {t("accountsSettings.reminders.remind")}
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
            <div className="pt-6">{t("accountsSettings.reminders.days")}</div>
            <div className="w-1/3 pt-6">
              <select
                name="timing"
                value={formData.timing}
                onChange={handleChange}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                disabled={isSubmitting}
              >
                <option value="after">{t("accountsSettings.reminders.after")}</option>
                <option value="before">{t("accountsSettings.reminders.before")}</option>
              </select>
            </div>
            <div className="pt-6">
              {formData.type === "due" ? t("accountsSettings.reminders.dueDateLabel") : t("accountsSettings.reminders.expectedPaymentDateLabel")}
            </div>
          </div>

          <div>
            <div className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                id="enableReminder"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-4 w-4 text-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] rounded"
                disabled={isSubmitting}
              />
              <label
                htmlFor="enableReminder"
                className="ml-2 block text-sm text-gray-700"
              >
                {t("accountsSettings.reminders.enableReminder")}
              </label>
            </div>
          </div>

          {formData.type === "due" && (
            <div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="copyMe"
                  id="copyMe"
                  checked={formData.copyMe}
                  onChange={handleChange}
                  className="h-4 w-4 text-[var(--p-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] rounded"
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="copyMe"
                  className="ml-2 block text-sm text-gray-700"
                >
                  {t("accountsSettings.reminders.copyMeOnReminders")}
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t("accountsSettings.reminders.remindLabel")}
            </label>
            <div className="mt-1 relative">
              <input
                type="text"
                value="me (accounts@jomsmart.com)"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                readOnly
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="fromEmail"
            >
              {t("accountsSettings.reminders.from")}
            </label>
            <div className="mt-1">
              <input
                type="email"
                id="fromEmail"
                name="fromEmail"
                value={formData.fromEmail}
                onChange={handleChange}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                placeholder="your@email.com"
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {t("accountsSettings.reminders.fromHelp")}
            </p>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="ccEmails"
            >
              {t("accountsSettings.reminders.cc")}
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="ccEmails"
                name="ccEmails"
                value={formData.ccEmails}
                onChange={handleChange}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                placeholder="email1@example.com, email2@example.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="bccEmails"
            >
              {t("accountsSettings.reminders.bcc")}
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="bccEmails"
                name="bccEmails"
                value={formData.bccEmails}
                onChange={handleChange}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                placeholder="email1@example.com, email2@example.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="subject"
            >
              {t("accountsSettings.reminders.subject")}
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("accountsSettings.reminders.emailContent")}
            </label>
            <RichTextEditor
              content={formData.emailContent}
              onChange={(content) =>
                setFormData((prev) => ({ ...prev, emailContent: content }))
              }
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
            {isSubmitting ? t("accountsSettings.reminders.saving") : t("accountsSettings.reminders.save")}
          </button>
          <button
            type="button"
            onClick={closeReminderForm}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--p-blue)]"
            disabled={isSubmitting}
          >
            {t("accountsSettings.reminders.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReminderForm;
