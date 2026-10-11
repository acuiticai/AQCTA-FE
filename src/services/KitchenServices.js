import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  patch: (url, data, config = {}) =>
    axios.patch(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
};

const KitchenServices = {
  // ── Sections ────────────────────────────────────────────────
  getSections: async (params = {}, headers = {}) =>
    requests.get("/kitchen/sections", { params, headers }),
  createSection: async (data, headers = {}) =>
    requests.post("/kitchen/sections", data, { headers }),
  updateSection: async (id, data, headers = {}) =>
    requests.put(`/kitchen/sections/${id}`, data, { headers }),
  deleteSection: async (id, headers = {}) =>
    requests.delete(`/kitchen/sections/${id}`, { headers }),

  // ── Tickets ─────────────────────────────────────────────────
  getTickets: async (params = {}, headers = {}) =>
    requests.get("/kitchen/tickets", { params, headers }),
  getTicket: async (id, headers = {}) =>
    requests.get(`/kitchen/tickets/${id}`, { headers }),
  updateTicketStatus: async (id, status, note, headers = {}) =>
    requests.put(
      `/kitchen/tickets/${id}/status`,
      { status, note },
      { headers }
    ),
  updateTicketPriority: async (id, priority, headers = {}) =>
    requests.put(
      `/kitchen/tickets/${id}/priority`,
      { priority },
      { headers }
    ),
  updateTicketItemStatus: async (id, itemId, status, headers = {}) =>
    requests.put(
      `/kitchen/tickets/${id}/items/${itemId}/status`,
      { status },
      { headers }
    ),
  createRealtimeStream: (businessId, token) => {
    const params = new URLSearchParams();
    if (businessId) params.set("business", String(businessId));
    if (token) params.set("token", String(token));
    return new EventSource(`${Base_URL}/pos/stream?${params.toString()}`);
  },

  // ── Item → Section routing ─────────────────────────────────
  getRoutingItems: async (params = {}, headers = {}) =>
    requests.get("/kitchen/items", { params, headers }),
  updateItemSection: async (itemId, kitchenSection, headers = {}) =>
    requests.patch(
      `/kitchen/items/${itemId}/section`,
      { kitchenSection },
      { headers }
    ),
  bulkUpdateItemSection: async (itemIds, kitchenSection, headers = {}) =>
    requests.patch(
      `/kitchen/items/bulk-section`,
      { itemIds, kitchenSection },
      { headers }
    ),
};

export default KitchenServices;
