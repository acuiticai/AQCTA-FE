// src/services/SalesOrderServices.js
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
};

const SalesOrderServices = {
  // Get all sales orders with filters
  getAllSalesOrders: async (params = {}, headers = {}) => {
    return requests.get("/sales-orders", { params, headers });
  },

  // Get single sales order by ID
  getSalesOrderById: async (id, headers = {}) => {
    return requests.get(`/sales-orders/${id}`, { headers });
  },

  // Create new sales order
  createSalesOrder: async (salesOrderData, headers = {}) => {
    return requests.post("/sales-orders", salesOrderData, { headers });
  },

  // Update sales order
  updateSalesOrder: async (id, salesOrderData, headers = {}) => {
    return requests.put(`/sales-orders/${id}`, salesOrderData, { headers });
  },

  // Delete sales order
  deleteSalesOrder: async (id, headers = {}) => {
    return requests.delete(`/sales-orders/${id}`, { headers });
  },

  // Get delivery methods from Settings
  getDeliveryMethods: async (businessId, headers = {}) => {
    return requests.post(
      `/items/Delivery Methods/get_all`,
      {
        business_id: businessId,
        FilterStatus: "active",
        FilterName: "",
      },
      { headers }
    );
  },

  // Get salespersons from Settings
  getSalespersons: async (businessId, headers = {}) => {
    return requests.get(`/staff-management/sales_staff/${businessId}`, { headers });
  },

  // Update sales order status
  updateSalesOrderStatus: async (id, status, headers = {}) => {
    return requests.put(
      `/sales-orders/${id}/status`,
      { status },
      { headers }
    );
  },

  // Convert sales order to invoice (returns data for pre-filling invoice form)
  convertToInvoice: async (id, headers = {}) => {
    return requests.post(
      `/sales-orders/${id}/convert-to-invoice`,
      {},
      { headers }
    );
  },

  // Instant invoice (quick-create invoice immediately)
  instantInvoice: async (id, headers = {}) => {
    return requests.post(
      `/sales-orders/${id}/instant-invoice`,
      {},
      { headers }
    );
  },

  // Send sales order email
  sendSalesOrderEmail: async (id, emailData, headers = {}) => {
    return requests.post(
      `/sales-orders/${id}/send-email`,
      emailData,
      { headers }
    );
  },

  // Fulfillment (Shipment)
  updateFulfillment: async (id, fulfillmentData, headers = {}) => {
    return requests.put(`/sales-orders/${id}/fulfillment`, fulfillmentData, {
      headers,
    });
  },
  completeFulfillment: async (id, data = {}, headers = {}) => {
    return requests.post(`/sales-orders/${id}/fulfillment/complete`, data, {
      headers,
    });
  },
};

export default SalesOrderServices;
