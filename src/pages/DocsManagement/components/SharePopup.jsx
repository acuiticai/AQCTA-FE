import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { FiX, FiSearch, FiUserPlus } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ROLE_VALUES = ["Full Access", "View Only", ""];
const SharePopup = ({ item, onClose, onShare, selectedBusiness }) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const roleLabels = {
    "Full Access": dm("fullAccess", "Full Access"),
    "View Only": dm("viewOnly", "View Only"),
    "": "",
  };
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [generalAccess, setGeneralAccess] = useState("No");
  const [temporaryUntil, setTemporaryUntil] = useState(null);
  const [loading, setLoading] = useState(false);
  const [Users, setUsers] = useState([]);
  const [SharedUser, setSharedUser] = useState([]);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  useEffect(() => {
    fetchData()
  }, [])


  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(
        `${Base_URL}/documents/${item.type}Details/${item._id}`,
      )
      console.log("Fetched folder structure:", response.data)
      setLoading(false)
      setSharedUser(response.data.sharedWith)
    } catch (error) {
      setLoading(false)
      console.error("Error fetching folder structure:", error)
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [selectedBusiness]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/admin/get_all_by_Business/${selectedBusiness}/${adminInfo.id}`
      );
      console.log("Fetched Users:", response.data);
      setLoading(false);
      setUsers(response.data);
    } catch (error) {
      setLoading(false);
      console.error("Error fetching users:", error);
    }
  };

  const filteredUsers = Users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (Users?.length > 0 && SharedUser?.length > 0) {
      const filteredUsers = Users.filter(
        (user) => SharedUser.some((shared) => shared?.user?._id === user?._id)
      );
      setSelectedUsers(filteredUsers.map(user => ({ ...user, role: "View Only", temporaryUntil: null })));
    }
  }, [Users, SharedUser]);


  const handleAddUser = (user) => {
    setSelectedUsers((prevSelectedUsers) => {
      // Check if the user is already added
      if (prevSelectedUsers.some((u) => u._id === user._id)) {
        return prevSelectedUsers; // Do nothing if already added
      }
      // Add new user to the list
      return [...prevSelectedUsers, { ...user, role: "View Only", temporaryUntil: null }];
    });
    console.log("Selected Users:", selectedUsers);
    setSearchQuery(""); // Clear search input after selecting user
  };


  const handleRoleChange = (_id, newRole) => {
    setSelectedUsers((prev) =>
      prev.map((user) => (user._id === _id ? { ...user, role: newRole } : user))
    );
  };

  const handleRemoveUser = (_id) => {
    console.log("Selected Users:", selectedUsers);
    console.log("_id:", _id);
    setSelectedUsers((prevSelectedUsers) => {
      const updatedUsers = prevSelectedUsers.filter((user) => user._id !== _id);

      // If general access is enabled, ensure remaining users follow the global temporary access time
      if (generalAccess === "Yes") {
        return updatedUsers.map((user) => ({ ...user, temporaryUntil }));
      }
      console.log("updatedUsers:", updatedUsers);
      return updatedUsers;
    });
  };


  const handleGeneralAccessChange = (e) => {
    const value = e.target.value;
    setGeneralAccess(value);

    if (value === "Yes") {
      // Set a global expiration time for all users
      setTemporaryUntil(new Date().toISOString().slice(0, 16)); // Default to now
      setSelectedUsers((prev) =>
        prev.map((user) => ({ ...user, temporaryUntil: new Date().toISOString().slice(0, 16) }))
      );
    } else {
      // Remove temporary access from all users
      setTemporaryUntil(null);
      setSelectedUsers((prev) =>
        prev.map((user) => ({ ...user, temporaryUntil: null }))
      );
    }
  };

  const handleTemporaryAccessChange = (e) => {
    const selectedDate = e.target.value;
    setTemporaryUntil(selectedDate);
    setSelectedUsers((prev) =>
      prev.map((user) => ({ ...user, temporaryUntil: selectedDate }))
    );
  };

  const handleConfirmShare = () => {
    console.log("Selected Users:", selectedUsers);
    onShare(item, selectedUsers, generalAccess);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", zIndex: 50
    }}>
      <div style={{
        background: "white", padding: "1.5rem", borderRadius: "8px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.2)", width: "400px"
      }}>
        {/* Header */}

        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "1rem"
        }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
            {dm("shareItem", "Share '{{name}}'", { name: item.name })}
          </h2>
          <button onClick={onClose} style={{ color: "#555", cursor: "pointer" }}>
            <FiX size={20} />
          </button>
        </div>

        {/* Search & Select Users */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <FiSearch style={{
              position: "absolute", left: "8px", color: "#888"
            }} />
            <input
              type="text"
              placeholder={dm("addPeople", "Add people...")}
              style={{
                width: "100%", padding: "8px 12px 8px 32px",
                border: "1px solid #ddd", borderRadius: "6px"
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchQuery && (
            <div style={{
              position: "absolute", background: "white",
              border: "1px solid #ddd", marginTop: "5px",
              width: "100%", borderRadius: "6px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              maxHeight: "150px", overflowY: "auto"
            }}>
              {filteredUsers.map((user) => (
                <div key={user.id}
                  style={{
                    display: "flex", alignItems: "center", padding: "10px",
                    cursor: "pointer", transition: "background 0.2s"
                  }}
                  onClick={() => handleAddUser(user)}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f3f3f3"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                >
                  <FiUserPlus style={{ color: "#007BFF", marginRight: "8px" }} />
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: "bold" }}>{user.name}</p>
                    <p style={{ fontSize: "12px", color: "#666" }}>{user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Users */}
        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>
            {dm("peopleWithAccess", "People with access")}
          </h3>
          {selectedUsers.length > 0 ? (
            selectedUsers.map((user) => (
              <div key={user.id} style={{
                display: "flex", flexDirection: "column",
                padding: "10px 0", borderBottom: "1px solid #ddd"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: "bold" }}>{user.name}</p>
                    <p style={{ fontSize: "12px", color: "#666" }}>{user.email}</p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user._id, e.target.value)}
                    style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "5px" }}
                  >
                    {ROLE_VALUES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role] || role}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => handleRemoveUser(user._id)} style={{ color: "#FF4D4D", cursor: "pointer" }}>
                    <FiX size={16} />
                  </button>
                </div>

              </div>
            ))
          ) : (
            <p style={{ fontSize: "14px", color: "#666" }}>
              {dm("noUsersSelected", "No users selected")}
            </p>
          )}
        </div>
        {selectedUsers.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid #ddd", paddingTop: "10px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>
                {dm("temporaryAccess", "Temporary access")}
              </h3>
              <select
                value={generalAccess}
                onChange={handleGeneralAccessChange}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px" }}
              >
                <option value="Yes">{dm("yes", "Yes")}</option>
                <option value="No">{dm("no", "No")}</option>
              </select>
            </div>
            {/* Show date-time input if temporary access is enabled */}
            {generalAccess === "Yes" && (
              <input
                type="datetime-local"
                value={temporaryUntil || ""}
                onChange={handleTemporaryAccessChange}
                style={{ marginTop: "5px", padding: "5px", border: "1px solid #ddd", borderRadius: "6px" }}
              />
            )}
          </>
        )}
        {/* Actions */}
        <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
          <button onClick={onClose} style={{ color: "#007BFF", fontWeight: "bold" }}>
            {dm("back", "Back")}
          </button>
          <button onClick={handleConfirmShare} style={{
            background: "#007BFF", color: "white",
            padding: "8px 16px", borderRadius: "6px", fontWeight: "bold"
          }}>
            {dm("done", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePopup;
