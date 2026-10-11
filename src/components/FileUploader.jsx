import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  DataTable,
  TableRow,
  TableData,
  ActionButtons,
} from "@/page-layouts/index";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

const FileUploader = ({
  handleUpload = () => {},
  handleRemove = () => {},
  uploadedFiles = [],
  uploading = false,
  progress = 0,
  CustomComponent = null,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    accept: "*",
    multiple: true,
    maxFiles: 10,
  });

  return (
    <>
      {CustomComponent && CustomComponent}
      <div>
        <div
          {...getRootProps()}
          style={{
            border: "2px dashed #ccc",
            padding: "20px",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragActive ? "#f0f0f0" : "#fff",
          }}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop files here...</p>
          ) : (
            <p>Drag and drop files here, or click to select files</p>
          )}
        </div>

        <div style={{ marginTop: "16px" }}>
          <ul>
            <DataTable
              show={uploadedFiles.length > 0}
              data={uploadedFiles}
              title="Selected Files"
              colWidths={{
                Name: "400px",
                Size: "100px",
                Type: "100px",
                Action: "100px",
              }}
              noPagination={true}
              headers={["Name", "Size", "Type", "Action"]}
              renderRow={(row, index) => {
                return (
                  <TableRow key={index}>
                    <TableData>{row.name}</TableData>
                    <TableData>
                      {(row.size / (1024 * 1024)).toFixed(2)} MB
                    </TableData>
                    <TableData>
                      {row.type.split("/")[1].toUpperCase()}
                    </TableData>
                    <TableData>
                      <ActionButtons
                        items={[
                          {
                            action: ACTION_BUTTON_TYPES.DELETE,
                            onClick: () => handleRemove(index),
                          },
                        ]}
                      />
                    </TableData>
                  </TableRow>
                );
              }}
            />
          </ul>
        </div>
      </div>
    </>
  );
};

export default FileUploader;
