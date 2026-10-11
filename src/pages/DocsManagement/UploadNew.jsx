import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  FiDownload,
  FiEye,
  FiFile,
  FiUpload,
  FiFolderPlus,
} from "react-icons/fi";

const FileTypeIcon = ({ name }) => {
  const getTypeFromName = (filename) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const typeMap = {
      pdf: { bg: "bg-red-100", text: "text-red-600", label: "PDF" },
      svg: { bg: "bg-pink-100", text: "text-pink-600", label: "SVG" },
      docx: { bg: "bg-blue-100", text: "text-blue-600", label: "DOC" },
      doc: { bg: "bg-blue-100", text: "text-blue-600", label: "DOC" },
      xls: { bg: "bg-green-100", text: "text-green-600", label: "XLS" },
      xlsx: { bg: "bg-green-100", text: "text-green-600", label: "XLS" },
      ppt: { bg: "bg-orange-100", text: "text-orange-600", label: "PPT" },
      pptx: { bg: "bg-orange-100", text: "text-orange-600", label: "PPT" },
      zip: { bg: "bg-emerald-100", text: "text-emerald-600", label: "ZIP" },
      txt: { bg: "bg-gray-100", text: "text-gray-600", label: "TXT" },
      gif: { bg: "bg-purple-100", text: "text-purple-600", label: "GIF" },
      mp3: { bg: "bg-indigo-100", text: "text-indigo-600", label: "MP3" },
      psd: { bg: "bg-violet-100", text: "text-violet-600", label: "PSD" },
    };
    return (
      typeMap[ext] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        label: "FILE",
      }
    );
  };

  const typeStyle = getTypeFromName(name);

  return (
    <div
      className={`w-10 h-10 ${typeStyle.bg} ${typeStyle.text} rounded flex items-center justify-center font-medium text-sm`}
    >
      {typeStyle.label}
    </div>
  );
};

const PreviewModal = ({ file, onClose }) => {
  if (!file) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{file.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX className="text-xl" />
          </button>
        </div>
        <div className="flex-grow overflow-auto">
          {file.name.toLowerCase().endsWith(".pdf") ? (
            <iframe
              src={file.url}
              className="w-full h-full"
              title={file.name}
            />
          ) : (
            <img
              src={file.url || "/placeholder.svg"}
              alt={file.name}
              className="max-w-full max-h-full mx-auto"
            />
          )}
        </div>
      </div>
    </div>
  );
};

const FilePreview = ({ file, onView }) => {
  const fileType = file.name.split(".").pop()?.toLowerCase();

  const getThumbnail = () => {
    if (["jpg", "jpeg", "png", "gif"].includes(fileType)) {
      return file.url;
    } else if (fileType === "pdf") {
      return `https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-01-24%20at%203.31.03%E2%80%AFPM-0dY6LCTmFU5AczFZOrEmSiLfh6U318.png`; // Replace with an actual PDF thumbnail
    } else {
      return null;
    }
  };

  const thumbnail = getThumbnail();

  return (
    <div
      className="relative h-[200px] bg-gray-100 border-t flex items-center justify-center cursor-pointer"
      onClick={() => onView(file)}
    >
      {thumbnail ? (
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={file.name}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <FiFile className="text-4xl text-gray-400" />
      )}
    </div>
  );
};

const BusinessDrive = () => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const [searchQuery, setSearchQuery] = useState("");
  const [folderHierarchy, setFolderHierarchy] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [previewFile, setPreviewFile] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  useEffect(() => {
    fetchFilesAndFolders();
  }, []);

  const fetchFilesAndFolders = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/documents/files`
      );
      setFolderHierarchy(response.data);
    } catch (error) {
      console.error("Error fetching files and folders:", error);
    }
  };

  const getCurrentFolderContent = () => {
    let current = folderHierarchy;
    for (const folder of currentPath) {
      const foundFolder = current.find(
        (item) => item.name === folder && item.type === "folder"
      );
      if (foundFolder) {
        current = foundFolder.items;
      } else {
        return [];
      }
    }
    return current;
  };

  const handleFolderClick = (folderName) => {
    setCurrentPath([...currentPath, folderName]);
  };

  const handleBackClick = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  const handleDownload = (file) => {
    window.open(file.url, "_blank");
  };

  const handleView = (file) => {
    setPreviewFile(file);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", currentPath.join("/"));
    formData.append("uploadedBy", "CurrentUser"); // Replace with actual user info

    try {
      await axios.post(`${Base_URL}/documents/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      fetchFilesAndFolders(); // Refresh the file list
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName) return;

    try {
      await axios.post(`${Base_URL}/documents/createFolder`, {
        folderName: newFolderName,
        parentFolder: currentPath.join("/"),
      });
      setNewFolderName("");
      setShowNewFolderInput(false);
      fetchFilesAndFolders(); // Refresh the folder list
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const renderGridView = (items) => (
    <div>
      {items.filter((item) => item.type === "folder").length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">{dm("folders", "Folders")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items
              .filter((item) => item.type === "folder")
              .map((folder) => (
                <div
                  key={folder.name}
                  className="flex flex-col items-center justify-center p-4 bg-white rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleFolderClick(folder.name)}
                >
                  <FiFolder className="text-4xl text-blue-500 mb-2" />
                  <span className="text-sm font-medium text-gray-700 text-center">
                    {folder.name}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {items.filter((item) => item.type === "file").length > 0 && (
        <div>
          <h2 className="text-[14px] font-medium text-gray-700 mb-4">{dm("files", "Files")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {items
              .filter((item) => item.type === "file")
              .map((file) => (
                <div
                  key={file.name}
                  className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <FilePreview file={file} onView={handleView} />
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileTypeIcon name={file.name} />
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FiDownload />
                    </button>
                  </div>
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
          key={item.name}
          className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow mb-2 cursor-pointer"
        >
          <div className="flex items-center">
            {item.type === "folder" ? (
              <FiFolder className="text-2xl text-gray-400 mr-3" />
            ) : (
              <FileTypeIcon name={item.name} />
            )}
            <p className="ml-3 text-sm font-medium">{item.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {item.type === "file" && (
              <>
                <button
                  onClick={() => handleDownload(item)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <FiDownload />
                </button>
                <button
                  onClick={() => handleView(item)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <FiEye />
                </button>
              </>
            )}
            <FiMoreVertical className="text-gray-400 cursor-pointer" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    const currentFolder = getCurrentFolderContent();

    if (currentFolder.length === 0) {
      return <p className="text-center text-gray-500">{dm("thisFolderIsEmpty", "This folder is empty")}</p>;
    }

    const items = currentFolder.map((item) => ({
      ...item,
      type: item.type === "folder" ? "folder" : "file",
    }));

    return viewMode === "grid" ? renderGridView(items) : renderListView(items);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">{dm("myDrive", "My Drive")}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-l-lg text-sm text-gray-700">
                  {dm("organization", "Organization: {{name}}", { name: "Syslab Technologies" })}
                  <FiChevronDown className="text-gray-400" />
                </button>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={dm("search", "Search")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-100 rounded-r-lg border-l border-gray-200 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`p-2 rounded-lg ${
                    viewMode === "grid"
                      ? "bg-green-100 text-green-600"
                      : "text-gray-400 hover:bg-gray-100"
                  }`}
                  onClick={() => setViewMode("grid")}
                >
                  <FiGrid className="text-xl" />
                </button>
                <button
                  className={`p-2 rounded-lg ${
                    viewMode === "list"
                      ? "bg-green-100 text-green-600"
                      : "text-gray-400 hover:bg-gray-100"
                  }`}
                  onClick={() => setViewMode("list")}
                >
                  <FiList className="text-xl" />
                </button>
                <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                  <FiRefreshCw className="text-xl" />
                </button>
                <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                  <FiX className="text-xl" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {currentPath.length > 0 && (
          <button
            onClick={handleBackClick}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-white rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <FiArrowLeft className="text-gray-400" />
            {dm("back", "Back")}
          </button>
        )}

        <div className="mb-6 flex items-center gap-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <FiUpload />
              <span>{dm("uploadFile", "Upload File")}</span>
            </div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <button
            onClick={() => setShowNewFolderInput(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <FiFolderPlus />
            <span>{dm("newFolder", "New Folder")}</span>
          </button>
        </div>

        {showNewFolderInput && (
          <div className="mb-6 flex items-center gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={dm("enterFolderName", "Enter folder name")}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleCreateFolder}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {dm("create", "Create")}
            </button>
            <button
              onClick={() => setShowNewFolderInput(false)}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {dm("cancel", "Cancel")}
            </button>
          </div>
        )}

        {renderContent()}
      </main>

      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};

export default BusinessDrive;
