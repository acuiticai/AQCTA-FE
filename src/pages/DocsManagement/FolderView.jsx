import React from "react"
import { FiFolder, FiMoreVertical } from "react-icons/fi"

export const FolderView = ({ folders, onFolderClick, viewMode }) => {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {folders.map((folder) => (
          <div
            key={folder}
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onFolderClick(folder)}
          >
            <div className="flex items-center justify-between mb-2">
              <FiFolder className="text-3xl text-blue-500" />
              <FiMoreVertical className="text-gray-500" />
            </div>
            <p className="text-sm font-medium truncate">{folder}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-8">
      {folders.map((folder) => (
        <div
          key={folder}
          className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-2"
          onClick={() => onFolderClick(folder)}
        >
          <div className="flex items-center">
            <FiFolder className="text-2xl text-blue-500 mr-3" />
            <p className="text-sm font-medium">{folder}</p>
          </div>
          <FiMoreVertical className="text-gray-500" />
        </div>
      ))}
    </div>
  )
}