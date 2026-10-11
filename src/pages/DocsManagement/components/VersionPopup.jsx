import React, { useState, useRef, useEffect, useContext } from "react";
import axios from "axios";
import { FiX, FiUpload, FiMoreVertical, FiDownload, FiTrash2, FiEye } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ManageVersionsPopup = ({ item, onClose, selectedBusiness }) => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [menuOpen, setMenuOpen] = useState(null);
  const dropdownRef = useRef(null);

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setMenuOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/documents/fileDetails/${item._id}/versions`);
      setVersions(response.data);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error("Error fetching versions:", error);
    }
  };

  const handleUploadNewVersion = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploadedBy", adminInfo.id);
      formData.append("item_id", item._id);
      formData.append("business_id", selectedBusiness);

      await axios.post(`${Base_URL}/documents/upload_version`, formData);

      fetchVersions(); // Refresh versions list
    } catch (error) {
      console.error("Error uploading new version:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (version) => {
    window.open(version.openUrl, "_blank"); // Open in new tab
  };

  const handleDownload = async (version) => {
    console.log(`Downloading ${version}`);
    window.open(version.downloadUrl, "_blank"); // Open in new tab
  };


 


 


  const handleDelete = async (version) => {
    try {
      await axios.delete(`${Base_URL}/documents/files/${version._id}`);
      fetchVersions();
    } catch (error) {
      console.error("Error deleting version:", error);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          width: "450px",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
            {dm("manageVersions", "Manage Versions")}
          </h2>
          <button onClick={onClose} style={{ color: "#555", cursor: "pointer" }}>
            <FiX size={20} />
          </button>
        </div>

        <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
          {dm(
            "versionsDescription",
            "Here are all the versions of current selected file. Older versions and new versions are here. You can upload a new version also from here."
          )}
        </p>

        {/* Upload new version */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "#007BFF",
            color: "white",
            padding: "8px 12px",
            borderRadius: "6px",
            cursor: "pointer",
            width: "100%",
            marginBottom: "10px",
          }}
        >
          <FiUpload /> {dm("uploadNewVersion", "Upload new version")}
          <input type="file" onChange={handleUploadNewVersion} style={{ display: "none" }} />
        </label>

        {/* Version List */}
        {loading ? (
          <p>{dm("loading", "Loading...")}</p>
        ) : (
          versions.map((version, index) => (
            <div key={version._id} style={{ borderBottom: "1px solid #ddd", padding: "10px 0", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: index === 0 ? "bold" : "normal" }}>
                    {index === 0
                      ? dm("currentVersion", "Current version")
                      : dm("versionNumber", "Version {{n}}", {
                          n: versions.length - index,
                        })}
                    : {version.name}
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "#666" }}>{new Date(version.uploadDate).toLocaleString()} - {version.uploadedBy.name}</p>
                </div>
                <div>
                  <FiMoreVertical style={{ cursor: "pointer" }} onClick={() => setMenuOpen(menuOpen === version._id ? null : version._id)} />
                  {menuOpen === version._id && (
                    <div ref={dropdownRef} style={{ position: "absolute", right: 0, background: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.2)", borderRadius: "6px", padding: "5px", zIndex: 10 }}>
                      <div onClick={() => handleOpen(version)} style={{ display: "flex", alignItems: "center", padding: "5px 10px", cursor: "pointer" }}>
                        <FiEye style={{ marginRight: "5px" }} /> {dm("open", "Open")}
                      </div>
                      <div onClick={() => handleDownload(version)} style={{ display: "flex", alignItems: "center", padding: "5px 10px", cursor: "pointer" }}>
                        <FiDownload style={{ marginRight: "5px" }} /> {dm("download", "Download")}
                      </div>
                      <div onClick={() => handleDelete(version)} style={{ display: "flex", alignItems: "center", padding: "5px 10px", cursor: "pointer", color: "red" }}>
                        <FiTrash2 style={{ marginRight: "5px" }} /> {dm("delete", "Delete")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ManageVersionsPopup;
