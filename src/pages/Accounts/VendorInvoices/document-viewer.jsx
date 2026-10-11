"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Typography,
} from "@mui/material";
import { Close as CloseIcon, Download, Print } from "@mui/icons-material";

const DocumentViewer = ({ open, onClose, documentUrl, contractNo }) => {
  const [loading, setLoading] = useState(true);
  const [fullUrl, setFullUrl] = useState("");

  useEffect(() => {
    if (open && documentUrl) {
      setFullUrl(`${documentUrl}`);
      // Simulate loading time for PDF
      const timer = setTimeout(() => {
        setLoading(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [open, documentUrl]);

  const handleDownload = async () => {
    try {
      const response = await fetch(fullUrl, { credentials: "include" });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contractNo || "document"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading document:", error);
    }
  };

  const handlePrint = () => {
    const iframe = document.getElementById("pdf-viewer");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        style: { maxHeight: "90vh" },
      }}
    >
      <DialogTitle className="flex justify-between items-center">
        <Typography variant="h6">Document Viewer: {contractNo}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box className="flex justify-center items-center h-[600px]">
            <CircularProgress />
          </Box>
        ) : (
          <iframe
            id="pdf-viewer"
            src={`${fullUrl}#toolbar=0`}
            width="100%"
            height="600px"
            style={{ border: "none" }}
            title="PDF Document Viewer"
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handlePrint}
          variant="outlined"
          startIcon={<Print />}
          disabled={loading}
        >
          Print
        </Button>
        <Button
          onClick={handleDownload}
          variant="contained"
          color="primary"
          startIcon={<Download />}
          disabled={loading}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentViewer;
