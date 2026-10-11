import axios from "axios";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export function buildDepartmentApiPayload(item, businessId, options = {}) {
  const manager = item?.manager;
  const hasManager = manager && manager._id;
  const privateStaffIds = Array.isArray(item.privateStaffIds)
    ? item.privateStaffIds
    : Array.isArray(options.privateStaffIds)
      ? options.privateStaffIds
      : [];
  return {
    name: item.name,
    code: item.code,
    status: item.status || "Active",
    isPrivate:
      typeof item.isPrivate === "boolean"
        ? item.isPrivate
        : Boolean(options.isPrivate),
    privateStaffIds,
    business_id: businessId,
    manager: hasManager
      ? { _id: manager._id, displayName: manager.displayName || "" }
      : { _id: "", displayName: "" },
  };
}

export async function fetchDepartmentsByBusiness(
  businessId,
  headers,
  options = {}
) {
  if (!businessId) return [];
  const response = await axios.post(
    `${BASE_URL}/Departments/get_all`,
    {
      business_id: businessId,
      FilterStatus: "",
      FilterName: "",
      includePrivateForStaff: Boolean(options.includePrivateForStaff),
      staff_id: options.staffId || "",
    },
    { headers }
  );
  return response.data?.data || [];
}

export async function addDepartment(item, businessId, headers, options = {}) {
  const payload = buildDepartmentApiPayload(item, businessId, options);
  const response = await axios.post(`${BASE_URL}/Departments/add`, payload, {
    headers,
  });
  return response.data;
}

export async function updateDepartment(
  departmentId,
  item,
  businessId,
  headers,
  options = {}
) {
  const payload = buildDepartmentApiPayload(item, businessId, options);
  const response = await axios.put(
    `${BASE_URL}/Departments/update/${departmentId}`,
    payload,
    { headers }
  );
  return response.data;
}

export async function fetchStaffForDepartmentManager(businessId, token) {
  if (!businessId) return [];
  const response = await axios.post(
    `${BASE_URL}/staff-management/selected-fields`,
    {
      fields: ["_id", "displayName"],
      filter: { business: businessId },
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data?.staff || [];
}
