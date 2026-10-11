import axios from "axios";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export function buildBranchApiPayload(item, businessId, options = {}) {
  const privateStaffIds = Array.isArray(item.privateStaffIds)
    ? item.privateStaffIds
    : Array.isArray(options.privateStaffIds)
      ? options.privateStaffIds
      : [];
  return {
    name: item.name,
    status: item.status || "Active",
    isPrivate:
      typeof item.isPrivate === "boolean"
        ? item.isPrivate
        : Boolean(options.isPrivate),
    privateStaffIds,
    areaName: item.areaName || "",
    attendanceRadiusMeters:
      item.attendanceRadiusMeters === "" || item.attendanceRadiusMeters == null
        ? 200
        : Number(item.attendanceRadiusMeters),
    googleLocation: {
      lat: item.googleLocation?.lat ?? "",
      lng: item.googleLocation?.lng ?? "",
      placeId: item.googleLocation?.placeId || "",
      formattedAddress: item.googleLocation?.formattedAddress || "",
      city: item.googleLocation?.city || "",
      state: item.googleLocation?.state || "",
      country: item.googleLocation?.country || "",
      postalCode: item.googleLocation?.postalCode || "",
    },
    business_id: businessId,
  };
}

export async function fetchBranchesByBusiness(
  businessId,
  headers,
  options = {}
) {
  if (!businessId) return [];
  const response = await axios.post(
    `${BASE_URL}/branches/get_all`,
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

export async function addBranchLocation(item, businessId, headers, options = {}) {
  const payload = buildBranchApiPayload(item, businessId, options);
  const response = await axios.post(`${BASE_URL}/branches/add`, payload, {
    headers,
  });
  return response.data;
}

export async function updateBranchLocation(
  branchId,
  item,
  businessId,
  headers,
  options = {}
) {
  const payload = buildBranchApiPayload(item, businessId, options);
  const response = await axios.put(
    `${BASE_URL}/branches/update/${branchId}`,
    payload,
    { headers }
  );
  return response.data;
}
