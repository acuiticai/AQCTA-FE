import React, { useRef, useState } from "react";

import { CloseIcon, UploadArrowIcon } from "./icons";

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Click-or-drop upload area with an inline list of the selected files.
 */
export default function FileDropzone({
  title = "Upload company documents",
  hint = "Multiple files supported",
  multiple = true,
  accept,
  files = [],
  onFilesChange,
  id = "epc-dropzone",
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    onFilesChange?.(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  };

  const removeAt = (index) => {
    onFilesChange?.(files.filter((_, position) => position !== index));
  };

  return (
    <div>
      <div
        className={`epc-dropzone${dragging ? " epc-dropzone--active" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <span className="epc-dropzone__icon" aria-hidden="true">
          <UploadArrowIcon />
        </span>
        <span className="epc-dropzone__title">{title}</span>
        <span className="epc-dropzone__hint">{hint}</span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="epc-visually-hidden"
          multiple={multiple}
          accept={accept}
          onChange={(event) => {
            addFiles(event.target.files);
            // Allow re-selecting the same file after a removal.
            event.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="epc-filelist">
          {files.map((file, index) => (
            <li className="epc-filelist__item" key={`${file.name}-${index}`}>
              <span className="epc-filelist__name">{file.name}</span>
              <span className="epc-filelist__meta">
                {formatSize(file.size)}
                <button
                  type="button"
                  className="epc-filelist__remove"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <CloseIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
