import requests from "./httpService";

const FleetManagementServices = {
  getJobs: async (params = {}) => requests.get("jobs", { params }),
  getUnscheduledJobs: async (params = {}) => requests.get("jobs/unscheduled", { params }),
  getJob: async (id) => requests.get(`jobs/${id}`),
  getJobFromSalesOrder: async (salesOrderId) =>
    requests.get(`jobs/from-sales-order/${salesOrderId}`),
  getOrCreateJobFromSalesOrder: async (salesOrderId) =>
    requests.get(`jobs/from-sales-order/${salesOrderId}`, {
      params: { createIfMissing: true },
    }),
  createJob: async (body) => requests.post("jobs", body),
  createJobFromSchedule: async (body) => requests.post("jobs/from-schedule", body),
  updateJob: async (id, body) => requests.put(`jobs/${id}`, body),
  voidJob: async (id, body = {}) => requests.post(`jobs/${id}/void`, body),
  deleteJob: async (id) => requests.delete(`jobs/${id}`),

  getVehicles: async (params = {}) => requests.get("vehicles", { params }),
  createVehicle: async (body) => requests.post("vehicles", body),
  updateVehicle: async (id, body) => requests.put(`vehicles/${id}`, body),
  deleteVehicle: async (id, params = {}) => requests.delete(`vehicles/${id}`, { params }),
  getVehicleTypes: async (params = {}) => requests.get("vehicle-types", { params }),
  createVehicleType: async (body) => requests.post("vehicle-types", body),
  updateVehicleType: async (id, body) => requests.put(`vehicle-types/${id}`, body),
  deleteVehicleType: async (id, params = {}) => requests.delete(`vehicle-types/${id}`, { params }),

  getSchedule: async (date, params = {}) => requests.get("schedule", { params: { date, ...params } }),
  getFleetScheduleSettings: async (params = {}) => requests.get("fleet-schedule-settings", { params }),
  updateFleetScheduleSettings: async (body) => requests.put("fleet-schedule-settings", body),
  assignJob: async (body) => requests.post("assign-job", body),
  updateAssignment: async (id, body) => requests.put(`job-assignment/${id}`, body),
  deleteAssignment: async (id) => requests.delete(`job-assignment/${id}`),
  getBusinessStaff: async (businessId) =>
    requests.get("staff-management", { params: { business: businessId, limit: 1000 } }),
};

export default FleetManagementServices;
