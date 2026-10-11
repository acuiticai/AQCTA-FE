import React from "react"
import FileTypeIcon from "./FileIcon"

const FilePreview = ({ file }) => {
  const fileType = file.name.split(".").pop()?.toLowerCase()

  if (fileType === "pdf") {
    return <iframe src={`${file.url}`} className="w-full h-[200px] border-t bg-gray-100" title={file.name} />
  }

  // For images and other previewable files
  if (["jpg", "jpeg", "png", "gif"].includes(fileType)) {
    return (
      <div
        className="h-[200px] bg-gray-100 border-t"
        style={{
          backgroundImage: `url(${file.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
    )
  }

  // For non-previewable files
  return (
    <div className="h-[200px] bg-gray-100 border-t flex items-center justify-center">
      <FileTypeIcon name={file.name} />
    </div>
  )
}

export default FilePreview

