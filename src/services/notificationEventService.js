import requests from "@/services/httpService";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NotificationEventService = {
  // Get all notification events for a business
  getAllEvents: async (payload) => {
    return requests.post("/notification-events/get-all", payload);
  },

  // Get single notification event
  getEvent: async (id) => {
    return requests.get(`/notification-events/${id}`);
  },

  // Create notification event
  createEvent: async (payload) => {
    return requests.post("/notification-events/create", payload);
  },

  // Update notification event
  updateEvent: async (id, payload) => {
    return requests.put(`/notification-events/update/${id}`, payload);
  },

  // Toggle notification event status
  toggleEventStatus: async (id) => {
    return requests.put(`/notification-events/toggle-status/${id}`);
  },

  // Delete notification event
  deleteEvent: async (id) => {
    return requests.delete(`/notification-events/delete/${id}`);
  },

  // Get users and roles for event assignment
  getUsersAndRoles: async (businessId) => {
    return requests.get(`/notification-events/users-roles/${businessId}`);
  },

  // Test notification event (send a test notification)
  testEvent: async (eventName, businessId, customData = {}) => {
    return requests.post("/notification-events/test", {
      eventName,
      businessId,
      customData
    });
  }
};

export default NotificationEventService; 