import requests from "./httpService";

const WFHManagementServices = {
  // Business-wide WFH Settings
  getBusinessWFHAllowance: async (businessId) => {
    return requests.post("/wfh-allowance/get", {
      business_id: businessId,
    });
  },

  setBusinessWFHAllowance: async (data) => {
    return requests.post("/wfh-allowance/set", data);
  },

  updateBusinessWFHAllowance: async (id, data) => {
    return requests.put(`/wfh-allowance/update/${id}`, data);
  },

  deleteBusinessWFHAllowance: async (id) => {
    return requests.delete(`/wfh-allowance/delete/${id}`);
  },

  // Department-specific WFH Allowance (GET with query params)
  getDepartmentAllowances: async (businessId, departmentId) => {
    return requests.get(`/wfh-allowance/department/allowance/get?business_id=${businessId}&department_id=${departmentId}`, {});
  },

  setDepartmentAllowance: async (data) => {
    return requests.post("/wfh-allowance/department/allowance/set", data);
  },

  updateDepartmentAllowance: async (id, data) => {
    return requests.post("/wfh-allowance/department/allowance/set", {...data, id});
  },

  deleteDepartmentAllowance: async (id) => {
    return requests.delete(`/wfh-allowance/department/allowance/delete`, {data: { allowance_id: id }});
  },

  // Department-specific WFH Capacity (GET with query params)
  getDepartmentCapacities: async (businessId, departmentId) => {
    console.log("businessId, departmentId are: " , businessId, departmentId)
    return requests.get(`/wfh-allowance/department/capacity/get?business_id=${businessId}&department_id=${departmentId}`, {});
  },

  setDepartmentCapacity: async (data) => {
    return requests.post("/wfh-allowance/department/capacity/set", data);
  },

  updateDepartmentCapacity: async (id, data) => {
    return requests.post(`/wfh-allowance/department/capacity/set`, {...data, id});
  },

  deleteDepartmentCapacity: async (id) => {
    return requests.delete(`/wfh-allowance/department/capacity/delete/${id}`);
  },

  // Utility functions for getting effective settings
  getEffectiveWFHAllowance: async (businessId, departmentId) => {
    return requests.post("/wfh-allowance/effective/allowance", { 
      business_id: businessId, 
      department_id: departmentId 
    });
  },

  getEffectiveWFHCapacity: async (businessId, departmentId) => {
    return requests.post("/wfh-allowance/effective/capacity", { 
      business_id: businessId, 
      department_id: departmentId 
    });
  },

  // Bulk operations
  bulkUpdateDepartmentAllowances: async (data) => {
    return requests.post("/wfh-allowance/department/allowance/bulk-update", data);
  },

  bulkUpdateDepartmentCapacities: async (data) => {
    return requests.post("/wfh-allowance/department/capacity/bulk-update", data);
  },

  // Export/Import functionality
  exportWFHConfigurations: async (businessId) => {
    return requests.get(`/wfh-allowance/export/${businessId}`);
  },

  importWFHConfigurations: async (data) => {
    return requests.post("/wfh-allowance/import", data);
  },

  // Audit trail
  getWFHAuditTrail: async (businessId, filters = {}) => {
    return requests.post(`/wfh-allowance/audit-trail/${businessId}`, filters);
  },

  // Validation functions
  validateWFHAllowance: async (data) => {
    return requests.post("/wfh-allowance/validate", data);
  },

  validateDepartmentCapacity: async (data) => {
    return requests.post("/wfh-allowance/department/capacity/validate", data);
  },
};

export default WFHManagementServices;
