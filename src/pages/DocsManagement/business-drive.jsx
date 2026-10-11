import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FiGrid,
  FiList,
  FiSettings,
  FiX,
  FiMoreVertical,
  FiFolder,
  FiArrowLeft,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { FileIcon } from "./FileIcon";
import { FolderView } from "./FolderView";
import { FileView } from "./FileView";

const BusinessDrive = () => {
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });
  const [searchQuery, setSearchQuery] = useState("");
  const [folderHierarchy, setFolderHierarchy] = useState({});
  const [currentPath, setCurrentPath] = useState([]);
  const [viewMode, setViewMode] = useState("grid");

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
      if (current[folder] && current[folder]._folders) {
        current = current[folder]._folders;
      } else {
        return { _files: [], _folders: {} };
      }
    }
    return current;
  };

  const handleFolderClick = (folder) => {
    setCurrentPath([...currentPath, folder]);
  };

  const handleBackClick = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  const currentFolder = getCurrentFolderContent();

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{dm("myDrive", "My Drive")}</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder={dm("search", "Search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md"
            />
            {searchQuery && (
              <FiX
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>
          <FiGrid
            className={`text-xl cursor-pointer ${
              viewMode === "grid" ? "text-blue-500" : "text-gray-500"
            }`}
            onClick={() => setViewMode("grid")}
          />
          <FiList
            className={`text-xl cursor-pointer ${
              viewMode === "list" ? "text-blue-500" : "text-gray-500"
            }`}
            onClick={() => setViewMode("list")}
          />
          <FiSettings className="text-xl text-gray-500 cursor-pointer" />
        </div>
      </header>

      <div className="mb-4 flex items-center text-sm text-gray-600">
        <FiFolder className="mr-2" />
        <span className="font-medium">{dm("currentPath", "Current Path:")}</span>
        <span className="ml-2">/{currentPath.join("/")}</span>
      </div>

      {currentPath.length > 0 && (
        <button
          onClick={handleBackClick}
          className="mb-4 flex items-center px-4 py-2 bg-white rounded-md shadow-sm hover:bg-gray-50"
        >
          <FiArrowLeft className="mr-2" />
          {dm("back", "Back")}
        </button>
      )}

      <FolderView
        folders={Object.keys(currentFolder)}
        onFolderClick={handleFolderClick}
        viewMode={viewMode}
      />

      <FileView files={currentFolder._files || []} viewMode={viewMode} />
    </div>
  );
};

export default BusinessDrive;
