import axios from "axios";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export function buildPositionApiPayload(item, businessId, options = {}) {
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
  };
}

export async function fetchPositionsByBusiness(
  businessId,
  headers,
  options = {}
) {
  if (!businessId) return [];
  const response = await axios.post(
    `${BASE_URL}/Positions/get_all`,
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

export async function addPosition(item, businessId, headers, options = {}) {
  const payload = buildPositionApiPayload(item, businessId, options);
  const response = await axios.post(`${BASE_URL}/Positions/add`, payload, {
    headers,
  });
  return response.data;
}

export async function updatePosition(
  positionId,
  item,
  businessId,
  headers,
  options = {}
) {
  const payload = buildPositionApiPayload(item, businessId, options);
  const response = await axios.put(
    `${BASE_URL}/Positions/update/${positionId}`,
    payload,
    { headers }
  );
  return response.data;
}
