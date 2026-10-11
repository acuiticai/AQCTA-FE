import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AddStaffModal = ({ showModal, setShowModal, setSelectedUserData }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    if (showModal) {
      fetchSystemUsers();
    }
  }, [showModal]);

  const fetchSystemUsers = async () => {
    try {
      const response = await axios.post(`${Base_URL}/SystemUsers/get_all`);
      if (response.data?.status && Array.isArray(response.data.data)) {
        // console.log("System users:", response.data.data);
        setUsers(response.data.data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching system users:", error);
      setUsers([]);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUser(userId);

    const userData = users.find((user) => user._id === userId);
    if (userData) {
      const nameParts = userData.name ? userData.name.trim().split(" ") : [];
      setSelectedUserData({
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: userData.email || "",
        mobileNumber: userData.contact || "",
        image: userData.image || "",
        fullName: userData.name || "",
      });

      // Delay closing to ensure data is set before modal disappears
      setTimeout(() => setShowModal(false), 200);
    }
  };

  const handleCreateNewMember = () => {
    setSelectedUserData({
      firstName: "",
      lastName: "",
      email: "",
      mobileNumber: "",
      image: "",
      fullName: "",
    });
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        {/* Modal header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-medium">Select a System User</h3>
          <button onClick={() => setShowModal(false)} className="text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Modal content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Select a system user to autofill the staff details.
          </p>

          {/* Dropdown */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">
              System Users
            </label>
            <select
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700"
              value={selectedUser}
              onChange={(e) => handleSelectUser(e.target.value)}
            >
              <option value="" disabled>
                Select a System User
              </option>
              {users.length > 0 ? (
                users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} - {user.email}
                  </option>
                ))
              ) : (
                <option disabled>No users available</option>
              )}
            </select>
          </div>

          {/* Action buttons */}
          {selectedUser ? (
            <button
              className="w-full py-2.5 bg-lime-500 text-white rounded mb-2"
              onClick={() => setShowModal(false)}
            >
              Select User
            </button>
          ) : (
            <button
              className="w-full py-2.5 bg-lime-400  text-white rounded mb-2"
              onClick={handleCreateNewMember}
            >
              Create New Member
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddStaffModal;
