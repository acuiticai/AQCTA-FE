import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { FiFolder } from "react-icons/fi";
import { AdminContext } from "@/context/AdminContext";
import useButtonColor from "@/hooks/useButtonColor";
import FileTypeIcon from "./FileIcon";
import FilePreview from "./FileView";
import FileFolderDropdown from "./components/FileFolderDropdown";
import { useHistory } from "react-router-dom";
import RenameModal from "./components/RenameModal";
import DeleteModal from "./components/DeleteModal";
import Directory from "./components/Directory";
import Header from "./components/Header";
import RestoreModal from "./components/RestoreModal";
import { useTranslation } from "react-i18next";
import {
  getSoleAssignedBusinessId,
  readAssignedBusinessesFallback,
} from "@/utils/sessionAssignedBusinesses";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BusinessDrive = () => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const history = useHistory();
  const buttonColor = useButtonColor();
  const [searchQuery, setSearchQuery] = useState("");
  const [folderStructure, setFolderStructure] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  console.log("adminInfo", adminInfo.businesses);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [businesses, setBusinesses] = useState(
    () => readAssignedBusinessesFallback() || adminInfo?.businesses || []
  );
  const [selectedBusiness, setSelectedBusinesses] = useState(
    () =>
      getSoleAssignedBusinessId() ||
      adminInfo?.businesses?.[0]?._id ||
      null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [ShowFolderClick, setShowFolderClick] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [RenameType, setRenameType] = useState("");
  const [loading, setLoading] = useState(false);
  const Loader = () => (
    <div className="flex justify-center items-center py-10">
      <div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
    </div>
  );

  useEffect(() => {
    fetchFolderStructure();
  }, [selectedBusiness]);

  const fetchFolderStructure = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `${Base_URL}/documents/trash/${selectedBusiness}/${adminInfo.id}`
      );
      console.log("Fetched folder structure:", response.data);
      setLoading(false);
      setFolderStructure([...response.data]); // Ensure state update triggers re-render
    } catch (error) {
      setLoading(false);
      console.error("Error fetching folder structure:", error);
    }
  };

  const handleFolderClick = (item) => {
    console.log("handleFolderClick", item);
    setRenameType("folders");
    setSelectedItem(item);
    setShowRestoreModal(true);
  };

  const handleFileClick = (item) => {
    setRenameType("files");
    setSelectedItem(item);
    setShowRestoreModal(true);
  };

  // Helper function to find folder by ID recursively
  const findFolderById = (folders, folderId) => {
    for (const folder of folders) {
      if (folder._id === folderId) {
        return folder;
      }
      if (folder.items && folder.items.length > 0) {
        const found = findFolderById(folder.items, folderId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleBackClick = () => {
    setCurrentFolder(null);
  };
  const handleRestore = (item) => {
    setRenameType("folders");
    setSelectedItem(item);
    setShowRestoreModal(true);
  };

  const handleRestoreFile = (item) => {
    setRenameType("files");
    setSelectedItem(item);
    setShowRestoreModal(true);
  };

  const confirmRestore = (item) => {
    axios
      .put(
        `${Base_URL}/documents/${RenameType}/restore/${selectedItem._id}`
      )
      .then(() => {
        fetchFolderStructure(selectedBusiness);
        setShowRestoreModal(false);
        setShowFolderClick(false);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error restoring item:", error);
      });
  };

  const handleDelete = (item) => {
    setRenameType("folders");
    setSelectedItem(item);
    setShowDeleteModal(true); // Open the modal
  };
  const handleDeleteFile = (item) => {
    setRenameType("files");
    setSelectedItem(item);
    setShowDeleteModal(true); // Open the modal
  };

  const confirmDelete = () => {
    if (!selectedItem) return;
    setLoading(true);

    axios
      .delete(
        `${Base_URL}/documents/${RenameType}/${selectedItem._id}`
      )
      .then(() => {
        fetchFolderStructure(selectedBusiness);
        setShowDeleteModal(false);
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        console.error("Error moving item to trash:", error);
      });
  };

  const handleDownload = (item) => {
    window.open(item.url, "_blank");
  };

  const handleShare = (item) => {
    alert(dm("sharingItem", "Sharing: {{name}}", { name: item.name }));
  };

  useEffect(() => {
    if (currentFolder) {
      const updatedFolder = findFolderById(folderStructure, currentFolder._id);
      if (updatedFolder) {
        setCurrentFolder(updatedFolder);
      }
    }
  }, [folderStructure]); // Runs when `folderStructure` updates

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", currentFolder ? currentFolder._id : "root");
    formData.append("uploadedBy", adminInfo?.id);
    formData.append("business_id", selectedBusiness);
    try {
      await axios.post(`${Base_URL}/documents/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLoading(false);
      console.log("📌 File Uploaded Successfully!");
      setTimeout(fetchFolderStructure, 500); // Give API time before fetching
    } catch (error) {
      setLoading(false);
      console.error(
        "Error uploading file:",
        error.response ? error.response.data : error.message
      );
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    setLoading(true);
    try {
      await axios.post(`${Base_URL}/documents/folders`, {
        name: newFolderName,
        path: `/${newFolderName}`,
        createdBy: adminInfo?.id,
        business_id: selectedBusiness,
        parentId: currentFolder ? currentFolder._id : null,
      });

      console.log("📌 Folder Created Successfully!");
      setNewFolderName("");
      setLoading(false);
      setShowNewFolderInput(false);

      setTimeout(fetchFolderStructure, 500);
    } catch (error) {
      setLoading(false);
      console.error("Error creating folder:", error);
    }
  };
  const handleBusinessChange = (value) => {
    setSelectedBusinesses(value);
  };

  const renderGridView = (items) => (
    <div>
      {items.filter((item) => item.type === "folder").length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "black",
              marginBottom: "1rem",
            }}
          >
            {dm("folders", "Folders")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {items
              .filter((item) => item.type === "folder")
              .map((folder) => (
                <div
                  key={folder._id}
                  onClick={() => handleFolderClick(folder)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.4rem",
                    background: "#F9F9F9",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#F3F3F3")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#F9F9F9")
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <FiFolder
                      style={{ fontSize: "1.25rem", color: "#A0AEC0" }}
                    />
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "black",
                      }}
                    >
                      {folder.name}
                    </span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <FileFolderDropdown
                      item={folder}
                      type="trash"
                      onRestore={handleRestore}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {items.filter((item) => item.type === "file").length > 0 && (
        <div>
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "black",
              marginBottom: "1rem",
            }}
          >
            {dm("files", "Files")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {items
              .filter((item) => item.type === "file")
              .map((file) => (
                <div
                  key={file._id}
                  style={{
                    background: "#F9F9F9",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    transition: "box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0px 4px 10px rgba(0,0,0,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow = "none")
                  }
                >
                  <div
                    onClick={() => handleFileClick(file)}
                    style={{
                      padding: "1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      <FileTypeIcon name={file.name} />
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#4A5568",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "110px",
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <FileFolderDropdown
                        item={file}
                        type="trash"
                        onRestore={handleRestoreFile}
                        onDelete={handleDeleteFile}
                      />
                    </div>
                  </div>
                  <FilePreview file={file} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderListView = (items) => (
    <div>
      {items.map((item) => (
        <div
          key={item._id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem",
            background: "#F9F9F9",
            borderRadius: "0.5rem",
            boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
            transition: "box-shadow 0.2s",
            marginBottom: "0.5rem",
            cursor: "pointer",
          }}
          onClick={() =>
            item.type === "folder"
              ? handleFolderClick(item)
              : handleFileClick(item)
          }
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow = "0px 4px 10px rgba(0,0,0,0.15)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.boxShadow = "0px 1px 3px rgba(0,0,0,0.1)")
          }
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {item.type === "folder" ? (
              <FiFolder
                style={{
                  fontSize: "24px",
                  color: "#A0AEC0",
                  marginRight: "0.75rem",
                }}
              />
            ) : (
              <FileTypeIcon name={item.name} />
            )}
            <p
              style={{
                marginLeft: "0.75rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "#4A5568",
              }}
            >
              {item.name}
            </p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <FileFolderDropdown
                item={item}
                type="trash"
                onRestore={
                  item.type === "folder" ? handleRestore : handleRestoreFile
                }
                onDelete={
                  item.type === "folder" ? handleDelete : handleDeleteFile
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  useEffect(() => {
    if (currentFolder) {
      const updatedFolder = folderStructure.find(
        (folder) => folder._id === currentFolder._id
      );
      if (updatedFolder) {
        setCurrentFolder(updatedFolder); // Updates current folder with new files
      }
    }
  }, [folderStructure]); // Runs when folderStructure updates

  const getCurrentFolderItems = () => {
    let items = currentFolder ? currentFolder.items || [] : folderStructure;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(query));
    }

    return items;
  };

  useEffect(() => {
    renderContent(folderStructure);
  }, [folderStructure]);

  const renderContent = (FolderStructure) => {
    console.log("📌 Rendering Content:", FolderStructure);
    if (loading) {
      return <Loader />;
    }
    const items = getCurrentFolderItems();

    if (items.length === 0) {
      return <p className="text-center text-gray-500">{dm("thisFolderIsEmpty", "This folder is empty")}</p>;
    }

    return viewMode === "grid" ? renderGridView(items) : renderListView(items);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <Header
        title={dm("trash", "Trash")}
        businesses={businesses}
        selectedBusiness={selectedBusiness}
        onBusinessChange={handleBusinessChange}
        searchQuery={searchQuery}
        onSearchChange={(value) => setSearchQuery(value)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        buttonColor={buttonColor}
      />
      <Directory
        currentFolder={currentFolder}
        handleBackClick={handleBackClick}
        showNewFolderInput={showNewFolderInput}
        newFolderName={newFolderName}
        getCurrentFolderItems={() => folderStructure}
        renderContent={renderContent}
      />

      <DeleteModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        selectedItem={selectedItem}
        confirmDelete={confirmDelete}
      />

      <RestoreModal
        showRestoreModal={showRestoreModal}
        setShowRestoreModal={setShowRestoreModal}
        selectedItem={selectedItem}
        confirmRestore={confirmRestore}
      />
    </div>
  );
};
export default BusinessDrive;
