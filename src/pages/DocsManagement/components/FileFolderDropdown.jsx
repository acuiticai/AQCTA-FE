import { useState, useEffect, useRef } from "react";
import {
  FiMoreVertical,
  FiDownload,
  FiEdit2,
  FiTrash,
  FiShare2,
  FiFolder,
  FiRefreshCw,
  FiInfo,
  FiClock,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";

const FileFolderDropdown = ({
  item,
  onRestore,
  type,
  onRename,
  onDelete,
  onDownload,
  onOpen,
  onShare,
  onVersion,
  onDetails,
  Settings,
  FixedFolders,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { t } = useTranslation();
  const dm = (key, defaultValue, options = {}) =>
    t(`docsManagement.${key}`, { defaultValue, ...options });

  const isFixedFolder =
    item.type === "folder" &&
    FixedFolders &&
    FixedFolders.some((folder) => folder.name === item.name);

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  const handleRename = (item) => {
    onRename(item);
    setIsOpen(false);
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2">
        <FiMoreVertical className="text-black-500 hover:text-gray-800 bold cursor-pointer" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 shadow-md rounded-lg z-50 overflow-auto"
        >
          {type !== "trash" && item.type === "folder" ? (
            <button
              onClick={() => {
                onOpen(item);
                setIsOpen(false);
              }}
              className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
            >
              <FiFolder className="mr-2" />
              {dm("open", "Open")}
            </button>
          ) : (
            type !== "trash" && (
              <button
                onClick={() => {
                  onDownload(item);
                  setIsOpen(false);
                }}
                className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
              >
                <FiDownload className="mr-2" />
                {dm("download", "Download")}
              </button>
            )
          )}
          {type !== "trash" && !isFixedFolder && (
            <button
              onClick={() => handleRename(item)}
              className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
            >
              <FiEdit2 className="mr-2" />
              {dm("rename", "Rename")}
            </button>
          )}
          {type === "trash" && (
            <button
              onClick={() => {
                onRestore(item);
                setIsOpen(false);
              }}
              className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
            >
              <FiRefreshCw className="mr-2" />
              {dm("restore", "Restore")}
            </button>
          )}

          {type !== "trash" && (
            <button
              onClick={() => {
                onShare(item);
                setIsOpen(false);
              }}
              className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
            >
              <FiShare2 className="mr-2" />
              {dm("share", "Share")}
            </button>
          )}
          {Settings?.versioning &&
            type !== "trash" &&
            item.type !== "folder" && (
              <button
                onClick={() => {
                  onVersion(item);
                  setIsOpen(false);
                }}
                className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
              >
                <FiClock className="mr-2" />
                {dm("versioning", "Versioning")}
              </button>
            )}
          {type !== "trash" && (
            <button
              onClick={() => {
                onDetails(item);
                setIsOpen(false);
              }}
              className="flex items-center px-4 py-1 w-full hover:bg-gray-100"
            >
              <FiInfo className="mr-2" />
              {dm("viewDetails", "View Details")}
            </button>
          )}
          {!isFixedFolder && (
            <button
              onClick={() => {
                onDelete(item);
                setIsOpen(false);
              }}
              className="flex items-center px-4 py-2 w-full text-red-600 hover:bg-red-100"
            >
              <FiTrash className="mr-2" />
              {type === "trash"
                ? dm("delete", "Delete")
                : dm("remove", "Remove")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileFolderDropdown;
