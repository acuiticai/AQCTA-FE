import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ReminderContext = createContext();

export const useReminders = () => useContext(ReminderContext);

export const ReminderProvider = ({ children }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);

  const fetchReminders = async (businessId) => {
    try {
      setLoading(true);
      // Add businessId as a query parameter if provided
      const url = businessId 
        ? `${BASE_URL}/reminders?business=${businessId}`
        : `${BASE_URL}/reminders`;
      
      const response = await axios.get(url);
      setReminders(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load reminders');
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const addReminder = async (reminderData) => {
    try {
      const response = await axios.post(`${BASE_URL}/reminders`, reminderData);
      setReminders(prevReminders => [...prevReminders, response.data]);
      return response.data;
    } catch (err) {
      setError('Failed to add reminder');
      console.error('Error adding reminder:', err);
      throw err;
    }
  };

  const updateReminder = async (id, reminderData) => {
    try {
      const response = await axios.put(`${BASE_URL}/reminders/${id}`, reminderData);
      setReminders(prevReminders => 
        prevReminders.map(reminder => 
          reminder._id === id ? response.data : reminder
        )
      );
      return response.data;
    } catch (err) {
      setError('Failed to update reminder');
      console.error('Error updating reminder:', err);
      throw err;
    }
  };

  const deleteReminder = async (id) => {
    try {
      await axios.delete(`${BASE_URL}/reminders/${id}`);
      setReminders(prevReminders => 
        prevReminders.filter(reminder => reminder._id !== id)
      );
    } catch (err) {
      setError('Failed to delete reminder');
      console.error('Error deleting reminder:', err);
      throw err;
    }
  };

  const toggleReminderStatus = async (id) => {
    try {
      const reminder = reminders.find(r => r._id === id);
      if (!reminder) {
        throw new Error('Reminder not found');
      }
      
      const response = await axios.patch(`${BASE_URL}/reminders/${id}`, {
        isActive: !reminder.isActive
      });
      
      setReminders(prevReminders => 
        prevReminders.map(r => 
          r._id === id ? response.data : r
        )
      );
      return response.data;
    } catch (err) {
      setError('Failed to update reminder status');
      console.error('Error updating reminder status:', err);
      throw err;
    }
  };

  const openAddReminderForm = () => {
    setSelectedReminder(null);
    setIsFormOpen(true);
  };

  const openEditReminderForm = (reminder) => {
    // Create a deep copy of the reminder to avoid reference issues
    setSelectedReminder({...reminder});
    setIsFormOpen(true);
  };

  const closeReminderForm = () => {
    setIsFormOpen(false);
    setSelectedReminder(null);
  };

//   useEffect(() => {
//     fetchReminders();
//   }, []);

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
    closeReminderForm
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
};