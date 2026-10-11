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
  Grid,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Close as CloseIcon,
  Download,
  Print,
  Visibility,
} from "@mui/icons-material";
import PurchaseDocumentPreviewEmbed from "./PurchaseDocumentPreviewEmbed";
import request from "@/services/httpService";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const DocumentComparisonViewer = ({
  open,
  onClose,
  documentUrl,
  contractNo,
  contractId,
  templateId,
  onApprove,
  onRequestAmendment,
  onReject,
}) => {
  const [loading, setLoading] = useState(true);
  const [fullUrl, setFullUrl] = useState("");
  const [initialDocuments, setInitialDocuments] = useState([]);
  const [fetchingInitialDocs, setFetchingInitialDocs] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedInitialDoc, setSelectedInitialDoc] = useState(null);

  // Generate preview document
  const generatePreview = async () => {
    if (!contractId || !templateId) return;

    try {
      setLoading(true);
      const response = await request.post(
        "/purchase-contracts/documentDetails",
        {
          templateId: templateId,
          contractId: contractId,
          preview: true,
        }
      );

      if (response.data && response.data.document_url) {
        setFullUrl(response.data.document_url);
        // Simulate loading time for PDF
        setTimeout(() => {
          setLoading(false);
        }, 1500);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      setLoading(false);
    }
  };

  // Fetch initial documents from contract; if none present, try documents service by contractNo
  const fetchInitialDocuments = async () => {
    if (!contractId) return;
    console.log("fetching initial documents for contract", contractId);
    try {
      setFetchingInitialDocs(true);

      // 1) Try from contract.initialDocuments
      const response = await request.get(`/purchase-contracts/${contractId}`);
      const contract = response?.data ?? response;

      let docs = Array.isArray(contract?.initialDocuments)
        ? contract.initialDocuments
        : [];

      // 2) If empty, try documents service by contractNo (works for both sales and purchase)
      if ((!docs || docs.length === 0) && contract?.contractNo) {
        try {
          // Use documents service by contractNo - this searches by file_path containing the contract number
          // Works for both sales and purchase contracts since file_path includes contract number
          const filesRes = await request.get(
            `/documents/get_all_by_sales/${contract.contractNo}`
          );
          const files = filesRes?.data ?? filesRes;
          if (Array.isArray(files)) {
            docs = files.map((f) => ({
              name: f.name,
              url: f.url,
              type: f.type,
              size: f.size || 0,
              uploadedAt: f.uploadDate || new Date().toISOString(),
            }));
          }
        } catch (err) {
          console.error("Fallback fetch from documents service failed:", err);
        }
      }

      if (docs && docs.length > 0) {
        setInitialDocuments(docs);
        setSelectedInitialDoc(docs[0]);
      } else {
        setInitialDocuments([]);
        setSelectedInitialDoc(null);
      }
    } catch (error) {
      console.error("Error fetching initial documents:", error);
    } finally {
      setFetchingInitialDocs(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchInitialDocuments();
      // Auto-generate preview so it appears on the right immediately
      generatePreview();
    }
  }, [open, documentUrl, contractId]);

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url, { credentials: "include" });
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading document:", error);
    }
  };

  const handlePrint = (iframeId) => {
    const iframe = document.getElementById(iframeId);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const renderInitialDocumentViewer = () => (
    <Paper
      elevation={2}
      sx={{ height: "600px", display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", p: 2 }}>
        <Typography variant="h6" color="primary">
          Initial Contract Documents ({initialDocuments.length})
        </Typography>
        {initialDocuments.length > 1 && (
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {initialDocuments.map((doc, index) => (
              <Tab key={index} label={doc.name || `Document ${index + 1}`} />
            ))}
          </Tabs>
        )}
      </Box>

      <Box sx={{ flex: 1, p: 1 }}>
        {fetchingInitialDocs ? (
          <Box className="flex justify-center items-center h-full">
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading initial documents...</Typography>
          </Box>
        ) : selectedInitialDoc ? (
          <div className="h-full">
            <iframe
              id="initial-doc-viewer"
              src={`${selectedInitialDoc.url}#toolbar=0`}
              width="100%"
              height="100%"
              style={{ border: "none" }}
              title="Initial Document Viewer"
            />
          </div>
        ) : (
          <Box className="flex justify-center items-center h-full flex-col">
            <Typography variant="h6" color="textSecondary" sx={{ mb: 2 }}>
              📄 No Initial Documents
            </Typography>
            <Typography color="textSecondary" sx={{ textAlign: "center" }}>
              No documents were uploaded during contract creation.
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ textAlign: "center", mt: 1 }}
            >
              Compare with the generated contract preview on the right.
            </Typography>
          </Box>
        )}
      </Box>

      {selectedInitialDoc && (
        <Box sx={{ p: 1, borderTop: 1, borderColor: "divider" }}>
          <Button
            size="small"
            onClick={() =>
              handleDownload(selectedInitialDoc.url, selectedInitialDoc.name)
            }
            startIcon={<Download />}
          >
            Download
          </Button>
          <Button
            size="small"
            onClick={() => handlePrint("initial-doc-viewer")}
            startIcon={<Print />}
            sx={{ ml: 1 }}
          >
            Print
          </Button>
        </Box>
      )}
    </Paper>
  );

  const renderDocumentPreview = () => (
    <Paper
      elevation={2}
      sx={{ height: "600px", display: "flex", flexDirection: "column" }}
    >
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" color="secondary">
          Generated Contract Preview
        </Typography>
      </Box>
      <Box sx={{ flex: 1, p: 1 }}>
        <PurchaseDocumentPreviewEmbed
          templateId={templateId}
          contractId={contractId}
          business_id={undefined}
        />
      </Box>
    </Paper>
  );

  // Update selected document when tab changes
  useEffect(() => {
    if (initialDocuments.length > 0 && activeTab < initialDocuments.length) {
      setSelectedInitialDoc(initialDocuments[activeTab]);
    }
  }, [activeTab, initialDocuments]);

  const hasInitialDocuments = initialDocuments.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        style: { maxHeight: "95vh", height: "95vh" },
      }}
    >
      <DialogTitle className="flex justify-between items-center">
        <Typography variant="h6">
          Contract Document Comparison: {contractNo}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2 }}>
        <Grid container spacing={2} sx={{ height: "100%" }}>
          <Grid item xs={6}>
            {renderInitialDocumentViewer()}
          </Grid>
          <Grid item xs={6}>
            {renderDocumentPreview()}
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, p: 2, bgcolor: "info.light", borderRadius: 1 }}>
          <Typography variant="body2" color="info.contrastText">
            💡 <strong>Document Comparison:</strong>
            {hasInitialDocuments
              ? " Review the initial contract documents (left) with the generated contract preview (right) to ensure accuracy before final approval."
              : " The left panel shows initial documents (none uploaded for this contract). The right panel shows the generated contract preview."}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onReject} color="error" variant="outlined">
          Reject
        </Button>
        <Button onClick={onRequestAmendment} color="warning" variant="outlined">
          Request Amendment
        </Button>
        <Button onClick={onApprove} color="primary" variant="contained">
          Approve
        </Button>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentComparisonViewer;
