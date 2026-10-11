import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * LHDN / MyInvois `BusinessDetails` (supplier identity + API) per business.
 */
const BusinessDetailsService = {
  getByBusinessId(businessId, headers) {
    return axios.get(
      `${Base_URL}/BusinessDetails/get_by_business_id/${businessId}`,
      { headers }
    );
  },
  add(payload, headers) {
    return axios.post(`${Base_URL}/BusinessDetails/add`, payload, { headers });
  },
  /**
   * Clears server-side e-invoice configuration. Tries common DELETE routes; returns
   * true if a row was removed, false if no endpoint matched (caller may save a reset).
   */
  async remove(recordId, businessId, headers) {
    if (recordId) {
      try {
        const r = await axios.delete(
          `${Base_URL}/BusinessDetails/${recordId}`,
          { headers }
        );
        if (r.status === 200 || r.status === 204) return true;
      } catch (e) {
        if (e?.response?.status !== 404) throw e;
      }
    }
    if (businessId) {
      try {
        const r = await axios.delete(
          `${Base_URL}/BusinessDetails/business/${businessId}`,
          { headers }
        );
        if (r.status === 200 || r.status === 204) return true;
      } catch (e) {
        if (e?.response?.status !== 404) throw e;
      }
    }
    return false;
  },
};

export default BusinessDetailsService;
