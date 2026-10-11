import requests from "./httpService";
// ### Main CRUD Operations

// - `POST /history` - Create a new history record
// - `GET /history` - Get all history records with filtering
// - `GET /history/:id` - Get a specific history record
// - `PUT /history/:id` - Update a history record
// - `DELETE /history/:id` - Soft delete a history record

const HistoryServices = {
  // Create a new history record
  createHistory: async (body) => {
    return requests.post("/history", body);
  },
  // Get all history records with filtering
  getHistory: async (params) => {
    return requests.get("/history", { params });
  },
  // Get a specific history record
  getHistoryById: async (id) => {
    return requests.get(`/history/${id}`);
  },
  // Update a history record
  updateHistory: async (id, body) => {
    return requests.put(`/history/${id}`, body);
  },
  // Soft delete a history record
  deleteHistory: async (id) => {
    return requests.delete(`/history/${id}`);
  },
};

export default HistoryServices;
