import { useState } from "react";
import { CustomModal, Button } from "@/page-layouts/index";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { notifyError, notifySuccess } from "@/utils/toast";
import FileUploader from "@/components/FileUploader";

const FileUploadModal = ({
  open,
  onClose,
  onConfirm,
  title = "Upload Files",
  width = "600px",
  accept = "*",
  multiple = true,
  maxFiles = null,
  disabled = false,
  CustomComponent = null,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (files) => {
    if (maxFiles && uploadedFiles.length + files.length > maxFiles) {
      alert(`You can only upload a maximum of ${maxFiles} files.`);
      return;
    }

    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const handleRemoveFile = (indexToRemove) => {
    setUploadedFiles(
      uploadedFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(uploadedFiles);
      setUploadedFiles([]); // Reset files after confirmation
      onClose();
      notifySuccess("Files uploaded successfully");
    } catch (error) {
      notifyError(error.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUploadedFiles([]); // Reset files when closing
    onClose();
  };

  return (
    <CustomModal
      open={open}
      onClose={handleClose}
      title={title}
      onConfirm={handleConfirm}
      width={width}
      loading={loading}
      disabled={disabled || !uploadedFiles.length}
    >
      <Box sx={{ p: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Custom Component Section */}

        {/* File Uploader Component */}
        <FileUploader
          handleUpload={handleFileUpload}
          CustomComponent={CustomComponent}
          handleRemove={handleRemoveFile}
          uploadedFiles={uploadedFiles}
          uploading={loading}
          progress={0}
        />
      </Box>
    </CustomModal>
  );
};

export { FileUploadModal };
