import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import {
  FiGrid,
  FiList,
  FiMoreVertical,
  FiFolder,
  FiArrowLeft,
  FiRefreshCw,
  FiX,
  FiSearch,
  FiChevronDown,
  FiUpload,
  FiFolderPlus,
} from "react-icons/fi";
import { AdminContext } from "@/context/AdminContext";
import useButtonColor from "@/hooks/useButtonColor";
import FileTypeIcon from "./FileIcon";
import FilePreview from "./FileView";
import FileFolderDropdown from "./components/FileFolderDropdown";
import searchIcon01 from "../../assets/img/icons/searchIcon01.svg";
import searchIcon02 from "../../assets/img/icons/searchIcon02.svg";
import arrowDownIcon from "../../assets/img/icons/arrow-circle-down.svg";
import Information from "@/assets/information.svg";
import { useHistory } from "react-router-dom";
import Header from "./components/Header";
import Directory from "./components/Directory";
import DeleteModal from "./components/DeleteModal";
import RenameModal from "./components/RenameModal";
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
  const buttonColor = useButtonColor();
  const history = useHistory();
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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [RenameType, setRenameType] = useState("");
  const [loading, setLoading] = useState(false);
  const Loader = () => (
    <div className="flex justify-center items-center py-10">
      <div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
    </div>
  );

  useEffect(() => {
    fetchRecentFiles();
  }, [selectedBusiness]);

  const fetchRecentFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/documents/recent/${selectedBusiness}/${adminInfo.id}`
      );
      console.log("Fetched folder structure:", response.data);
      setLoading(false);
      setFolderStructure(response.data); // Updated to store categorized data
    } catch (error) {
      setLoading(false);
      console.error("Error fetching folder structure:", error);
    }
  };

  const handleFolderClick = (folder) => {
    // Find the latest version of the folder in the updated folder structure
    const updatedFolder = findFolderById(folderStructure, folder._id);

    if (updatedFolder) {
      setCurrentFolder(updatedFolder);
    }
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
  const handleRename = (item) => {
    setRenameType("folders");
    setSelectedItem(item);
    setNewItemName(item.name); // Pre-fill with current name
    setShowRenameModal(true); // Open the modal
  };

  const handleRenameFile = (item) => {
    setRenameType("files");
    setSelectedItem(item);
    setNewItemName(item.name);
    setShowRenameModal(true);
  };

  const confirmRename = () => {
    if (
      !selectedItem ||
      !newItemName.trim() ||
      newItemName === selectedItem.name
    )
      return;
    setLoading(true);

    axios
      .put(
        `${Base_URL}/documents/${RenameType}/rename/${selectedItem._id}`,
        { newName: newItemName }
      )
      .then(() => {
        setLoading(false);
        fetchRecentFiles(selectedBusiness);
        setShowRenameModal(false); // Close the modal after renaming
      })
      .catch((error) => {
        setLoading(false);
        console.error("Error renaming:", error);
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
      .put(
        `${Base_URL}/documents/${RenameType}/move-to-trash/${selectedItem._id}`
      )
      .then(() => {
        fetchRecentFiles(selectedBusiness);
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

  const handleBusinessChange = (value) => {
    setSelectedBusinesses(value);
  };

  const renderGridView = (items) => (
    <div>
      {items.filter((item) => item.type === "folder").length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
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
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      onOpen={handleFolderClick}
                      onShare={handleShare}
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
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "black",
              marginBottom: "1rem",
            }}
          ></h2>
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
                    onClick={() => window.open(file.url, "_blank")}
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
                        onRename={handleRenameFile}
                        onDelete={handleDeleteFile}
                        onDownload={handleDownload}
                        onOpen={handleFolderClick}
                        onShare={handleShare}
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
              : window.open(item.url, "_blank")
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
                onRename={
                  item.type === "folder" ? handleRename : handleRenameFile
                }
                onDelete={
                  item.type === "folder" ? handleDelete : handleDeleteFile
                }
                onDownload={handleDownload}
                onOpen={handleFolderClick}
                onShare={handleShare}
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

  useEffect(() => {
    renderRecentFiles(folderStructure);
  }, [folderStructure]);

  const renderRecentFiles = (recentFiles) => {
    if (loading) {
      return <Loader />;
    }

    if (!recentFiles || Object.keys(recentFiles).length === 0) {
      return <p className="text-center text-gray-500">{dm("noRecentFilesFound", "No recent files found")}</p>;
    }

    const sections = [
      { title: dm("today", "Today"), key: "today" },
      { title: dm("yesterday", "Yesterday"), key: "yesterday" },
      { title: dm("past7Days", "Past 7 Days"), key: "past7Days" },
      { title: dm("past30Days", "Past 30 Days"), key: "past30Days" },
      { title: dm("older", "Older"), key: "older" },
    ];

    return (
      <div>
        {sections.map(({ title, key }) => {
          const files = recentFiles[key] || [];

          if (files.length === 0) return null;

          return (
            <div key={key} style={{ marginBottom: "2rem" }}>
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: "600",
                  color: "#1A202C",
                  marginBottom: "1rem",
                }}
              >
                {title}
              </h2>
              {viewMode === "grid"
                ? renderGridView(files)
                : renderListView(files)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <Header
        title={dm("recent", "Recent")}
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
        renderContent={renderRecentFiles}
      />

      <DeleteModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        selectedItem={selectedItem}
        confirmDelete={confirmDelete}
      />

      <RenameModal
        showRenameModal={showRenameModal}
        setShowRenameModal={setShowRenameModal}
        newItemName={newItemName}
        setNewItemName={setNewItemName}
        confirmRename={confirmRename}
      />
    </div>
  );
};
export default BusinessDrive;
