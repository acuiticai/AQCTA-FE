import requests from "./httpService";

const CalendarServices = {
  createCalendarEvent: async (body) => {
    return requests.post("calendar/events", body);
  },
  getCalendarEvents: async (params = {}) => {
    const queryParams = new URLSearchParams();

    // Pagination parameters
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);

    // Filter parameters
    if (params.priority && params.priority !== "all")
      queryParams.append("priority", params.priority);
    if (params.category && params.category !== "all")
      queryParams.append("category", params.category);
    if (params.search) queryParams.append("search", params.search);

    // Date range parameters
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    if (params.allowedModules)
      queryParams.append("allowedModules", params?.allowedModules);
    if (params.isStaff) queryParams.append("isStaff", params.isStaff);
    if (params.staffEmail) queryParams.append("staffEmail", params.staffEmail);

    const queryString = queryParams.toString();
    const url = queryString
      ? `calendar/events?${queryString}`
      : "calendar/events";

    return requests.get(url);
  },
  getCalendarEventById: async (id) => {
    return requests.get(`calendar/events/${id}`);
  },
  updateCalendarEvent: async (id, body) => {
    return requests.put(`calendar/events/${id}`, body);
  },
  deleteCalendarEvent: async (id) => {
    return requests.delete(`calendar/events/${id}`);
  },
  getCalendarEventsSummary: async () => {
    return requests.get("calendar/events/summary");
  },
  getUserCalendarEvents: async (userId) => {
    return requests.get(`calendar/events/user/${userId}`);
  },
  getHREvents: async (params = {}) => {
    const queryParams = new URLSearchParams();

    // Date range parameters
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    
    // Module filtering
    if (params.allowedModules) {
      queryParams.append("allowedModules", JSON.stringify(params.allowedModules));
    }
    
    // Staff filtering - explicitly pass isStaff (even if false)
    if (params.hasOwnProperty('isStaff')) {
      queryParams.append("isStaff", params.isStaff);
    }
    if (params.staffEmail) queryParams.append("staffEmail", params.staffEmail);

    const queryString = queryParams.toString();
    const url = queryString
      ? `calendar/events/hr-events?${queryString}`
      : "calendar/events/hr-events";

    return requests.get(url);
  },
};

export default CalendarServices;
