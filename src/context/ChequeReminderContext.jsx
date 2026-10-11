import React, { createContext, useState, useContext } from "react";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ChequeReminderContext = createContext();

export const useChequeReminders = () => useContext(ChequeReminderContext);

export const ChequeReminderProvider = ({ children }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);

  const fetchReminders = async (businessId) => {
    try {
      setLoading(true);
      const url = businessId
        ? `${BASE_URL}/cheque-reminders?business=${businessId}`
        : `${BASE_URL}/cheque-reminders`;
      const response = await axios.get(url);
      setReminders(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load cheque reminders");
      console.error("Error fetching cheque reminders:", err);
    } finally {
      setLoading(false);
    }
  };

  const addReminder = async (reminderData) => {
    const response = await axios.post(
      `${BASE_URL}/cheque-reminders`,
      reminderData
    );
    setReminders((prev) => [...prev, response.data]);
    return response.data;
  };

  const updateReminder = async (id, reminderData) => {
    const response = await axios.put(
      `${BASE_URL}/cheque-reminders/${id}`,
      reminderData
    );
    setReminders((prev) =>
      prev.map((r) => (r._id === id ? response.data : r))
    );
    return response.data;
  };

  const deleteReminder = async (id) => {
    await axios.delete(`${BASE_URL}/cheque-reminders/${id}`);
    setReminders((prev) => prev.filter((r) => r._id !== id));
  };

  const toggleReminderStatus = async (id) => {
    const reminder = reminders.find((r) => r._id === id);
    if (!reminder) throw new Error("Reminder not found");
    const response = await axios.patch(`${BASE_URL}/cheque-reminders/${id}`, {
      isActive: !reminder.isActive,
    });
    setReminders((prev) =>
      prev.map((r) => (r._id === id ? response.data : r))
    );
    return response.data;
  };

  const openAddReminderForm = () => {
    setSelectedReminder(null);
    setIsFormOpen(true);
  };

  const openEditReminderForm = (reminder) => {
    setSelectedReminder({ ...reminder });
    setIsFormOpen(true);
  };

  const closeReminderForm = () => {
    setIsFormOpen(false);
    setSelectedReminder(null);
  };

  const value = {
    reminders,
    loading,
    error,
    isFormOpen,
    selectedReminder,
    fetchReminders,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminderStatus,
    openAddReminderForm,
    openEditReminderForm,
    closeReminderForm,
  };

  return (
    <ChequeReminderContext.Provider value={value}>
      {children}
    </ChequeReminderContext.Provider>
  );
};
