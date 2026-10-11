import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { FiFolder } from "react-icons/fi";
import { notifySuccess, notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import useButtonColor from "@/hooks/useButtonColor";
import FileTypeIcon from "./FileIcon";
import SharePopup from "./components/SharePopup";
import VersionPopup from "./components/VersionPopup";
import FilePreview from "./FileView";
import FileFolderDropdown from "./components/FileFolderDropdown";
import DetailsView from "./components/DetailsView";
import { useHistory } from "react-router-dom";
import SearchFilter from "./SearchBar";
import Header from "./components/Header";
import Directory from "./components/Directory";
import DeleteModal from "./components/DeleteModal";
import RenameModal from "./components/RenameModal";
import Reset from "../Reset";
import { useTranslation } from "react-i18next";
import {
  getSoleAssignedBusinessId,
  readAssignedBusinessesFallback,
} from "@/utils/sessionAssignedBusinesses";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// ;

const DocsManagement = () => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [RenameType, setRenameType] = useState("");
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [shareItem, setShareItem] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false); // Added state for details panel
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null);
  const [FixedFolders, setFixedFolders] = useState([]);
  const [Settings, setSettings] = useState({
    keep_in_trash: 30,
    business_id: selectedBusiness,
    versioning: false,
  });
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const handleShare = (item) => {
    setShareItem(item);
    setShowShareModal(true);
  };

  const createFixedFoldersIfNotExist = async () => {
    try {
      if (!FixedFolders || FixedFolders.length === 0) return;

      // Step 1: Find all existing folder names
      const existingFolderNames = new Set();

      const findAllFolderNames = (folders) => {
        folders.forEach((folder) => {
          if (folder.type === "folder") {
            existingFolderNames.add(folder.name);
            if (folder.items && folder.items.length > 0) {
              findAllFolderNames(folder.items);
            }
          }
        });
      };

      findAllFolderNames(folderStructure);

      // Step 2: Create any fixed folders that don't exist
      const foldersToCreate = FixedFolders.filter(
        (folder) => !existingFolderNames.has(folder.name)
      );

      if (foldersToCreate.length === 0) return;

      setLoading(true);

      // Step 3: Create each missing folder
      for (const folder of foldersToCreate) {
        await axios.post(`${Base_URL}/documents/folders`, {
          name: folder.name,
          path: `/${folder.name}`,
          createdBy: adminInfo?.id,
          business_id: selectedBusiness,
          parentId: null, // All fixed folders will be created at the root level
        });
      }

      // Step 4: Refresh folder structure after creating all folders
      await fetchFolderStructure(selectedBusiness);
      setLoading(false);

      // Notify user
      if (foldersToCreate.length > 0) {
        notifySuccess(
          dm("createdSystemFolders", "Created {{count}} required system folder(s)", {
            count: foldersToCreate.length,
          })
        );
      }
    } catch (error) {
      setLoading(false);
      console.error("Error creating fixed folders:", error);
      notifyError(
        dm("failedCreateSystemFolders", "Failed to create required system folders")
      );
    }
  };

  // Call this function in useEffect after fetchSettings and fetchFixedFolders
  useEffect(() => {
    if (FixedFolders && FixedFolders.length > 0 && folderStructure.length > 0) {
      createFixedFoldersIfNotExist();
    }
  }, [FixedFolders, folderStructure.length]);

  const handleVersion = (item) => {
    setShareItem(item);
    setShowVersionModal(true);
  };

  const confirmDetails = (item) => {
    // Updated confirmDetails function
    setSelectedItemDetails(item);
    setShowDetailsPanel(true); // Show details panel instead of modal
  };

  const Loader = () => (
    <div className="flex justify-center items-center py-10">
      <div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
    </div>
  );

  useEffect(() => {
    fetchFolderStructure(selectedBusiness);
  }, []); // Removed selectedBusiness from dependencies

  const fetchFolderStructure = async (business_id) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/documents/structure/${business_id}/${adminInfo.id}`
      );
      console.log("Fetched folder structure:", response.data);
      setLoading(false);
      setFolderStructure([...response.data]); // Ensure state update triggers re-render
    } catch (error) {
      setLoading(false);
      console.error("Error fetching folder structure:", error);
    }
  };

  const handleFolderClick = (folder) => {
    const updatedFolder = findFolderById(folderStructure, folder._id);

    if (updatedFolder) {
      setSearchQuery(""); // ✅ Reset search
      setActiveFilters(null); // ✅ Reset filters
      setCurrentFolder(updatedFolder);
    }
  };

  const Reset = () => {
    setSearchQuery("");
    setShowFilterPopup(false);
    setActiveFilters(null);
    // setCurrentFolder(updatedFolder);
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
    if (!currentFolder || !currentFolder.parent) {
      console.log("Already at the root folder.");
      setCurrentFolder(null);
      return;
    }

    // Find the parent folder in the current structure
    const parentFolder = findFolderById(folderStructure, currentFolder.parent);

    if (parentFolder) {
      setCurrentFolder(parentFolder);
    } else {
      console.log("Parent folder not found, going back to root.");
      setCurrentFolder(null);
    }
  };
  // const handleRename = (item) => {
  //   setRenameType("folders");
  //   setSelectedItem(item);
  //   setNewItemName(item.name); // Pre-fill with current name
  //   setShowRenameModal(true); // Open the modal
  // };

  // const handleRenameFile = (item) => {
  //   setRenameType("files");
  //   setSelectedItem(item);
  //   setNewItemName(item.name);
  //   setShowRenameModal(true);
  // };
  const handleRename = (item) => {
    setRenameType("folders");
    setSelectedItem(item);
    setNewItemName(item.name);
    setShowRenameModal(true);
  };

  const handleRenameFile = (item) => {
    setRenameType("files");
    setSelectedItem(item);

    // 🟢 Strip the extension for file renaming input
    const nameWithoutExt = item.name.includes(".")
      ? item.name.substring(0, item.name.lastIndexOf("."))
      : item.name;

    setNewItemName(nameWithoutExt);
    setShowRenameModal(true);
  };

  const confirmRename = () => {
    if (
      !selectedItem ||
      !newItemName.trim() ||
      newItemName === selectedItem.name
    )
      return;

    // Check if the new name matches any fixed folder name
    if (
      FixedFolders &&
      FixedFolders.some((folder) => folder.name === newItemName)
    ) {
      notifyError(
        dm("cannotRenameStaticFolder", "Cannot rename to match a static folder name")
      );
      return;
    }

    // Check if the name already exists in the current path
    if (RenameType === "folders") {
      // Assuming you have access to the folders at the current level through folderStructure
      // Get the current level folders, excluding the one being renamed
      const foldersInCurrentPath = folderStructure.filter(
        (item) => item.type === "folder" && item._id !== selectedItem._id
      );

      if (foldersInCurrentPath.some((folder) => folder.name === newItemName)) {
        notifyError(
          dm(
            "folderNameExists",
            "A folder with this name already exists in the current path"
          )
        );
        return;
      }
    } else if (RenameType === "files") {
      // Similar check for files
      const filesInCurrentPath = folderStructure.filter(
        (item) => item.type === "file" && item._id !== selectedItem._id
      );

      if (filesInCurrentPath.some((file) => file.name === newItemName)) {
        notifyError(
          dm(
            "fileNameExists",
            "A file with this name already exists in the current path"
          )
        );
        return;
      }
    }

    setLoading(true);

    axios
      .put(`${Base_URL}/documents/${RenameType}/rename/${selectedItem._id}`, {
        newName: newItemName,
      })
      .then(() => {
        setLoading(false);
        fetchFolderStructure(selectedBusiness);
        setShowRenameModal(false); // Close the modal after renaming
        notifySuccess(
          dm("renamedSuccessfully", "{{type}} renamed successfully", {
            type:
              selectedItem.type === "folder"
                ? dm("folderType", "Folder")
                : dm("fileTypeLabel", "File"),
          })
        );
      })
      .catch((error) => {
        setLoading(false);
        console.error("Error renaming:", error);
        notifyError(
          dm("failedToRename", "Failed to rename: {{message}}", {
            message: error.response?.data?.message || error.message,
          })
        );
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

  const handleRestore = (item) => {
    axios
      .put(`${Base_URL}/documents/${RenameType}/restore/${item._id}`)
      .then(() => {
        fetchFolderStructure(selectedBusiness);
      })
      .catch((error) => {
        console.error("Error restoring item:", error);
      });
  };

  const handlePermanentDelete = (item) => {
    axios
      .delete(`${Base_URL}/documents/${RenameType}/${item._id}`)
      .then(() => {
        fetchFolderStructure(selectedBusiness);
      })
      .catch((error) => {
        console.error("Error permanently deleting item:", error);
      });
  };

  const confirmDelete = () => {
    if (!selectedItem) return;
    setLoading(true);

    axios
      .put(
        `${Base_URL}/documents/${RenameType}/move-to-trash/${selectedItem._id}`
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
    console.log("item", item);
    window.open(item.downloadUrl);
  };

  const confirmShare = async (item, selectedUsers, generalAccess) => {
    try {
      const payload = {
        users: selectedUsers.map((user) => ({
          userId: user._id,
          role: user.role,
          temporaryUntil: user.temporaryUntil,
        })),
      };

      await axios.post(
        `${Base_URL}/documents/share/${item._id}/${item.type}`,
        payload
      );
      notifySuccess(
        item.type === "folder"
          ? dm(
              "accessSharedFolder",
              "Access given to folder and its contents successfully!"
            )
          : dm("accessSharedFile", "Access given to file successfully!")
      );
      // onClose()
    } catch (error) {
      console.error(`Error sharing ${item.type}:`, error);
      notifyError(
        dm("failedShareAccess", "Failed to share access. Please try again.")
      );
    }
  };

  useEffect(() => {
    if (currentFolder) {
      const updatedFolder = findFolderById(folderStructure, currentFolder._id);
      if (updatedFolder) {
        setCurrentFolder(updatedFolder);
      }
    }
  }, [folderStructure, currentFolder, findFolderById]); // Added currentFolder and findFolderById to dependencies

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
      setTimeout(() => {
        fetchFolderStructure(selectedBusiness);
      }, 500); // Give API time before fetching
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

    // Check if folder name matches any fixed folder name
    if (
      FixedFolders &&
      FixedFolders.some((folder) => folder.name === newFolderName)
    ) {
      notifyError(
        dm(
          "cannotCreateStaticFolder",
          "Cannot create a folder with the same name as a static folder"
        )
      );
      return;
    }

    // Check if folder name exists in the current path
    // Assuming folderStructure contains current path items
    const foldersInCurrentPath = folderStructure.filter(
      (item) => item.type === "folder"
    );

    if (foldersInCurrentPath.some((folder) => folder.name === newFolderName)) {
      notifyError(
        dm(
          "folderNameExists",
          "A folder with this name already exists in the current path"
        )
      );
      return;
    }

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
      notifySuccess(dm("folderCreatedSuccessfully", "Folder created successfully"));

      setTimeout(() => {
        fetchFolderStructure(selectedBusiness);
      }, 500); // Give API time before fetching
    } catch (error) {
      setLoading(false);
      console.error("Error creating folder:", error);
      notifyError(
        dm("failedCreateFolder", "Failed to create folder: {{message}}", {
          message: error.response?.data?.message || error.message,
        })
      );
    }
  };

  // const handleCreateFolder = async () => {
  //   if (!newFolderName) return
  //   setLoading(true)
  //   try {
  //     await axios.post(`${Base_URL}/documents/folders`, {
  //       name: newFolderName,
  //       path: `/${newFolderName}`,
  //       createdBy: adminInfo?.id,
  //       business_id: selectedBusiness,
  //       parentId: currentFolder ? currentFolder._id : null,
  //     })

  //     console.log("📌 Folder Created Successfully!")
  //     setNewFolderName("")
  //     setLoading(false)
  //     setShowNewFolderInput(false)

  //     setTimeout(() => { fetchFolderStructure(selectedBusiness) }, 500) // Give API time before fetching
  //   } catch (error) {
  //     setLoading(false)
  //     console.error("Error creating folder:", error)
  //   }
  // }
  const handleBusinessChange = (value) => {
    setSelectedBusinesses(value);
    // setFolderStructure([]);
    // setFixedFolders([])
    setCurrentFolder(null);
    // setActiveFilters(null)
    fetchFolderStructure(value);
  };

  useEffect(() => {
    fetchSettings();
    fetchFixedFolders();
  }, [selectedBusiness]);

  const fetchFixedFolders = async () => {
    try {
      let payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      let response = await axios.post(
        `${Base_URL}/items/Fixed Folders/get_all`,
        payload,
        { headers }
      );
      console.log("response.data setFixedFolders", response?.data?.data);
      setFixedFolders(response?.data?.data);
    } catch (error) {
      console.error("Failed to fetch general settings:", error);
    }
  };
  const fetchSettings = async () => {
    try {
      let payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      let response = await axios.post(
        `${Base_URL}/items/documentgenerals/get_all`,
        payload,
        { headers }
      );
      console.log("response.data documentgenerals", response?.data?.data?.[0]);
      setSettings(response?.data?.data?.[0]);
    } catch (error) {
      console.error("Failed to fetch general settings:", error);
    }
  };
  const renderGridView = (items) => (
    <div>
      {items.filter((item) => item.type === "folder").length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "600",
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
                        whiteSpace: "nowrap",
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
                      Settings={Settings}
                      FixedFolders={FixedFolders}
                      onOpen={handleFolderClick}
                      onDetails={confirmDetails}
                      onVersion={handleVersion}
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
              fontSize: "14px",
              fontWeight: "500",
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
                        FixedFolders={FixedFolders}
                        Settings={Settings}
                        onDetails={confirmDetails}
                        onShare={handleShare}
                        onVersion={handleVersion}
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
                onDetails={confirmDetails}
                Settings={Settings}
                FixedFolders={FixedFolders}
                onShare={handleShare}
                onVersion={handleVersion}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  useEffect(() => {
    renderContent(folderStructure);
  }, [folderStructure]);

  const renderContent = (items) => {
    console.log("📌 Rendering Content:", items);
    if (loading) {
      return <Loader />;
    }

    if (items.length === 0) {
      return (
        <p className="text-center text-gray-500">
          {dm("noItemsFound", "No items found")}
        </p>
      );
    }

    return viewMode === "grid" ? renderGridView(items) : renderListView(items);
  };

  useEffect(() => {
    if (currentFolder) {
      const updatedFolder = folderStructure.find(
        (folder) => folder._id === currentFolder._id
      );
      if (updatedFolder) {
        setCurrentFolder(updatedFolder); // Updates current folder with new files
      }
    }
  }, [folderStructure, currentFolder, findFolderById]); // Added currentFolder and findFolderById to dependencies

  const getCurrentFolderItems = () => {
    const isSearchActive = !!searchQuery?.trim() || !!activeFilters;
    const items = currentFolder ? currentFolder.items || [] : folderStructure;

    // ✅ CASE 1: No filters or search — show normally (folders at root or contents inside folder)
    if (!activeFilters && !searchQuery) {
      return items; // shows all in current folder (folders + files)
    }
    if (!isSearchActive) {
      // ✅ Normal folder browsing: show actual children (folders + files)
      return items;
    }

    // ✅ CASE 2: Filter or search applied — do recursive search
    const searchInFolder = (items, query, filters) => {
      let results = [];

      for (const item of items) {
        const matches = matchesFilters(item, query, filters);

        if (matches) {
          results.push(item); // Include matching folder or file
        }

        if (item.type === "folder" && item.items?.length > 0) {
          const childResults = searchInFolder(item.items, query, filters);
          results = results.concat(childResults);
        }
      }

      return results;
    };

    const matchesFilters = (item, query, filters) => {
      let matches = true;

      if (filters?.name) {
        matches =
          matches &&
          item?.name.toLowerCase().includes(filters?.name.toLowerCase());
      }
      if (filters?.createdByMe) {
        matches = matches && item.createdBy === adminInfo.id;
      }
      if (filters?.sharedTo && item.sharedWith) {
        matches =
          matches &&
          item.sharedWith.some((share) =>
            share.userId.includes(filters?.sharedTo)
          );
      }
      if (filters?.file_type) {
        const ext = item?.name.split(".").pop().toLowerCase();
        matches = matches && ext === filters?.file_type;
      }
      if (filters?.hasSalesContract) {
        matches = matches && item.sales_contract != null;
      }
      if (filters?.hasPurchaseContract) {
        matches = matches && item.purchase_contract != null;
      }
      if (filters?.hasVendor) {
        matches = matches && item.vendor_id != null;
      }
      if (filters?.hasCustomer) {
        matches = matches && item.customer_id != null;
      }
      if (filters?.deletedOnly) {
        matches = matches && item.status === "deleted";
      }
      if (filters?.dateCreated && filters?.dateCreated !== "Any time") {
        const created = new Date(item.createdAt || item.datetime_created);
        const now = new Date();
        switch (filters?.dateCreated) {
          case "Today":
            matches = created.toDateString() === now.toDateString();
            break;
          case "Last 7 days":
            matches = now - created <= 7 * 24 * 60 * 60 * 1000;
            break;
          case "Last 30 days":
            matches = now - created <= 30 * 24 * 60 * 60 * 1000;
            break;
        }
      }

      return matches;
    };

    return searchInFolder(items, searchQuery, activeFilters);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <Header
        title={dm("myDrive", "My Drive")}
        businesses={businesses}
        selectedBusiness={selectedBusiness}
        onBusinessChange={handleBusinessChange}
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value); // Keep it in sync with search bar
          setActiveFilters((prev) => ({
            ...prev,
            name: value,
          }));
          if (value === "") {
            Reset();
          }
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={() => fetchFolderStructure(selectedBusiness)}
        onUpload={handleFileUpload}
        onNewFolder={() => setShowNewFolderInput(true)}
        buttonColor={buttonColor}
        showFilterPopup={showFilterPopup}
        setShowFilterPopup={setShowFilterPopup}
      />

      <Directory
        currentFolder={currentFolder}
        handleBackClick={handleBackClick}
        showNewFolderInput={showNewFolderInput}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleCreateFolder={handleCreateFolder}
        setShowNewFolderInput={setShowNewFolderInput}
        renderContent={renderContent}
        getCurrentFolderItems={getCurrentFolderItems}
      />

      <SearchFilter
        isOpen={showFilterPopup}
        onClose={() => setShowFilterPopup(false)}
        onreset={() => {
          Reset();
        }}
        onApplyFilters={(filters) => {
          setActiveFilters(filters);
          if (
            filters.createdByMe === false &&
            filters.dateCreated === "Any time" &&
            filters.deletedOnly === false &&
            filters.file_type === "" &&
            filters.hasCustomer === false &&
            filters.hasPurchaseContract === false &&
            filters.name === "" &&
            filters.hasSalesContract === false &&
            filters.hasVendor === false &&
            filters.sharedTo === ""
          ) {
            Reset();
          }

          console.log("Applied filters:", filters);
          setShowFilterPopup(false);
          // setFolderStructure(getCurrentFolderItems()); // Update folderStructure with filtered items
        }}
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

      {showShareModal && (
        <SharePopup
          item={shareItem}
          selectedBusiness={selectedBusiness}
          onClose={() => setShowShareModal(false)}
          onShare={confirmShare}
          onDetails={confirmDetails}
        />
      )}
      {showVersionModal && (
        <VersionPopup
          item={shareItem}
          selectedBusiness={selectedBusiness}
          onClose={() => setShowVersionModal(false)}
          onShare={confirmShare}
          onDetails={confirmDetails}
        />
      )}
      {showDetailsPanel &&
        selectedItemDetails && ( // Replaced showDetailsModal with showDetailsPanel
          <DetailsView
            item={selectedItemDetails}
            onClose={() => setShowDetailsPanel(false)}
          />
        )}
    </div>
  );
};
export default DocsManagement;
