import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Public (no-auth) QR ordering services. The token in the URL resolves to the
// (business, table) pair on the server — we never include a business ID from
// the client, nor do we trust any price/quantity the client sends.
const QrOrderServices = {
  getContext: async (token, sessionId) =>
    axios.get(`${Base_URL}/public/pos/qr/${token}`, {
      params: sessionId ? { session: sessionId } : undefined,
    }),
  submitOrder: async (token, payload) =>
    axios.post(`${Base_URL}/public/pos/qr/${token}/orders/items`, payload),
  // guestSessionId scopes the status response to this device's own order so
  // two customers scanning the same table QR see their individual order.
  getOrderStatus: async (token, guestSessionId) =>
    axios.get(`${Base_URL}/public/pos/qr/${token}/order-status`, {
      params: guestSessionId ? { guestSessionId } : undefined,
    }),
  createRealtimeStream: (token, guestSessionId) =>
    new EventSource(
      `${Base_URL}/public/pos/qr/${token}/stream${guestSessionId ? `?guestSessionId=${encodeURIComponent(guestSessionId)}` : ""}`,
    ),
};

export default QrOrderServices;
