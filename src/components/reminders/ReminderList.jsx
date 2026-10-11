import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon, PencilIcon } from "@heroicons/react/outline";
import { useReminders } from "../../context/ReminderContext";
import { notifyError, notifySuccess } from "@/utils/toast";

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  reminderName,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 transform transition-all">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t("accountsSettings.reminders.deleteReminder")}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {t("accountsSettings.reminders.deleteConfirm", { name: reminderName })}
          </p>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {t("accountsSettings.reminders.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {t("accountsSettings.reminders.delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReminderList = ({
  organization,
  canAdd = false,
  canUpdate = false,
  canDelete = false,
}) => {
  const { t } = useTranslation();
  const {
    reminders,
    loading,
    error,
    toggleReminderStatus,
    openEditReminderForm,
    deleteReminder,
    openAddReminderForm,
    fetchReminders,
  } = useReminders();
  // State for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    reminderId: null,
    reminderName: "",
  });

  // Fetch reminders when component mounts or organization changes
  useEffect(() => {
    // Only fetch if organization is provided
    if (organization) {
      fetchReminders(organization);
    }
  }, [organization]); // Remove fetchReminders from dependencies to avoid infinite loop

  // Open confirmation modal before delete
  const handleDeleteReminder = (id, name) => {
    setDeleteModal({
      isOpen: true,
      reminderId: id,
      reminderName: name,
    });
  };

  // Handle confirmation to delete
  const confirmDelete = () => {
    deleteReminder(deleteModal.reminderId);
    closeDeleteModal();
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      reminderId: null,
      reminderName: "",
    });
  };
  // Handler for adding new reminder with organization context
  const handleAddReminder = () => {
    openAddReminderForm(organization);
  };

  if (loading)
    return <div className="text-center py-4">{t("accountsSettings.reminders.loading")}</div>;
  if (error)
    return <div className="text-center py-4 text-red-500">{error}</div>;

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="grid grid-cols-4 bg-gray-50 p-4 text-sm font-medium text-gray-500 rounded-t-lg">
          <div>{t("accountsSettings.reminders.name")}</div>
          <div>{t("accountsSettings.reminders.schedule")}</div>
          <div>{t("accountsSettings.reminders.status", "STATUS")}</div>
          <div>{t("accountsSettings.reminders.actions", "ACTIONS")}</div>
        </div>

        <div className="divide-y divide-gray-200">
          {reminders.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              {t("accountsSettings.reminders.noReminders")}
            </div>
          )}

          {reminders.filter((r) => r.type === "expected").length > 0 && (
            <div className="py-3 px-4 font-medium bg-gray-50">
              {t("accountsSettings.reminders.basedOnExpectedDate")}
            </div>
          )}

          {reminders
            .filter((r) => r.type === "expected")
            .map((reminder) => (
              <div
                key={reminder._id}
                className="grid grid-cols-4 p-4 items-center"
              >
                <div className="">{reminder.name}</div>
                <div>
                  {t("accountsSettings.reminders.remindDays", { days: reminder.days, timing: reminder.timing })}
                </div>
                <div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={reminder.isActive}
                      onChange={() => toggleReminderStatus(reminder._id)}
                      disabled={!canUpdate}
                    />
                    <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--p-blue)]"></div>
                  </label>
                </div>
                <div className="flex space-x-2">
                  {canUpdate && (
                    <button
                      onClick={() => openEditReminderForm(reminder)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      aria-label="Edit reminder"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() =>
                        handleDeleteReminder(reminder._id, reminder.name)
                      }
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Delete reminder"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

          {reminders.filter((r) => r.type === "due").length > 0 && (
            <div className="py-3 px-4 font-medium bg-gray-50">
              {t("accountsSettings.reminders.basedOnDueDate")}
            </div>
          )}

          {reminders
            .filter((r) => r.type === "due")
            .map((reminder) => (
              <div
                key={reminder._id}
                className="grid grid-cols-4 p-4 items-center"
              >
                <div className="">{reminder.name}</div>
                <div>
                  {reminder.copyMe
                    ? t("accountsSettings.reminders.remindCustomerCopyDue", { days: reminder.days, timing: reminder.timing })
                    : t("accountsSettings.reminders.remindDaysDue", { days: reminder.days, timing: reminder.timing })}
                </div>
                <div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={reminder.isActive}
                      onChange={() => toggleReminderStatus(reminder._id)}
                      disabled={!canUpdate}
                    />
                    <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--p-blue)]"></div>
                  </label>
                </div>
                <div className="flex space-x-2">
                  {canUpdate && (
                    <button
                      onClick={() => openEditReminderForm(reminder)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      aria-label="Edit reminder"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() =>
                        handleDeleteReminder(reminder._id, reminder.name)
                      }
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Delete reminder"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          {canAdd && (
            <button
              onClick={handleAddReminder}
              className="flex items-center text-[var(--p-blue)] font-medium hover:text-[#95b833] transition-colors"
            >
              <span className="mr-2 text-xl leading-none">+</span> {t("accountsSettings.reminders.newReminder")}
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        reminderName={deleteModal.reminderName}
      />
    </>
  );
};

export default ReminderList;
