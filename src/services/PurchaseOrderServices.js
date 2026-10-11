// src/services/PurchaseOrderServices.js
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const requests = {
  get: (url, config = {}) => axios.get(`${Base_URL}${url}`, config),
  post: (url, data, config = {}) =>
    axios.post(`${Base_URL}${url}`, data, config),
  put: (url, data, config = {}) => axios.put(`${Base_URL}${url}`, data, config),
  delete: (url, config = {}) => axios.delete(`${Base_URL}${url}`, config),
};

const PurchaseOrderServices = {
  // Get all purchase orders with filters
  getAllSalesOrders: async (params = {}, headers = {}) => {
    return requests.get("/purchase-orders", { params, headers });
  },
  getAllPurchaseOrders: async (params = {}, headers = {}) => {
    return requests.get("/purchase-orders", { params, headers });
  },

  // Get single purchase order by ID
  getSalesOrderById: async (id, headers = {}) => {
    return requests.get(`/purchase-orders/${id}`, { headers });
  },
  getPurchaseOrderById: async (id, headers = {}) => {
    return requests.get(`/purchase-orders/${id}`, { headers });
  },

  // Create new purchase order
  createSalesOrder: async (salesOrderData, headers = {}) => {
    return requests.post("/purchase-orders", salesOrderData, { headers });
  },
  createPurchaseOrder: async (purchaseOrderData, headers = {}) => {
    return requests.post("/purchase-orders", purchaseOrderData, { headers });
  },

  // Update purchase order
  updateSalesOrder: async (id, salesOrderData, headers = {}) => {
    return requests.put(`/purchase-orders/${id}`, salesOrderData, { headers });
  },
  updatePurchaseOrder: async (id, purchaseOrderData, headers = {}) => {
    return requests.put(`/purchase-orders/${id}`, purchaseOrderData, { headers });
  },

  // Delete purchase order
  deleteSalesOrder: async (id, headers = {}) => {
    return requests.delete(`/purchase-orders/${id}`, { headers });
  },
  deletePurchaseOrder: async (id, headers = {}) => {
    return requests.delete(`/purchase-orders/${id}`, { headers });
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

  // Get purchasers from Settings
  getPurchasers: async (businessId, headers = {}) => {
    return requests.post(
      `/items/Purchaser/get_all`,
      {
        business_id: businessId,
        FilterStatus: "active",
        FilterName: "",
      },
      { headers }
    );
  },
  getSalespersons: async (businessId, headers = {}) => {
    return requests.post(
      `/items/Purchaser/get_all`,
      {
        business_id: businessId,
        FilterStatus: "active",
        FilterName: "",
      },
      { headers }
    );
  },

  // Update purchase order status (supports action: submit|approve|reject|cancel)
  updateSalesOrderStatus: async (id, statusOrPayload, headers = {}) => {
    const body =
      typeof statusOrPayload === "string"
        ? { status: statusOrPayload }
        : statusOrPayload || {};
    return requests.put(`/purchase-orders/${id}/status`, body, { headers });
  },
  submitPurchaseOrder: async (id, headers = {}) => {
    return requests.put(
      `/purchase-orders/${id}/status`,
      { action: "submit" },
      { headers }
    );
  },
  approvePurchaseOrder: async (id, headers = {}) => {
    return requests.put(
      `/purchase-orders/${id}/status`,
      { action: "approve" },
      { headers }
    );
  },
  rejectPurchaseOrder: async (id, remark, headers = {}) => {
    return requests.put(
      `/purchase-orders/${id}/status`,
      { action: "reject", rejectionRemark: remark },
      { headers }
    );
  },
  cancelPurchaseOrder: async (id, reason, headers = {}) => {
    return requests.put(
      `/purchase-orders/${id}/status`,
      { action: "cancel", cancelReason: reason },
      { headers }
    );
  },

  // Convert purchase order to invoice (returns data for pre-filling invoice form)
  convertToInvoice: async (id, headers = {}) => {
    return requests.post(
      `/purchase-orders/${id}/convert-to-invoice`,
      {},
      { headers }
    );
  },

  /** Prefill vendor bill (AP) from PO; may set Draft → Issued on server */
  convertToBill: async (id, headers = {}) => {
    return requests.post(`/purchase-orders/${id}/convert-to-bill`, {}, { headers });
  },

  /** Read-only bill prefill for create vendor invoice page (?purchaseOrderId=) */
  getBillPrefill: async (id, headers = {}) => {
    return requests.get(`/purchase-orders/${id}/bill-prefill`, { headers });
  },

  // Instant invoice (quick-create customer invoice — legacy)
  instantInvoice: async (id, headers = {}) => {
    return requests.post(
      `/purchase-orders/${id}/instant-invoice`,
      {},
      { headers }
    );
  },

  // Send purchase order email
  sendSalesOrderEmail: async (id, emailData, headers = {}) => {
    return requests.post(
      `/purchase-orders/${id}/send-email`,
      emailData,
      { headers }
    );
  },

  // Fulfillment (Shipment)
  updateFulfillment: async (id, fulfillmentData, headers = {}) => {
    return requests.put(`/purchase-orders/${id}/fulfillment`, fulfillmentData, {
      headers,
    });
  },
  completeFulfillment: async (id, data = {}, headers = {}) => {
    return requests.post(`/purchase-orders/${id}/fulfillment/complete`, data, {
      headers,
    });
  },
};

export default PurchaseOrderServices;
