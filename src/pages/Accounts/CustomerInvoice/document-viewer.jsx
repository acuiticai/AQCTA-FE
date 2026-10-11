"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  Alert,
} from "@mui/material";
import { Close as CloseIcon, Download, Print } from "@mui/icons-material";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import { formatInvoiceDownloadName } from "@/utils/generic";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";

const PDF_FETCH_TIMEOUT = 30000; // 30 seconds for fetching PDF via proxy
const MAX_RETRIES = 2; // 2 retries = 3 total attempts
const RETRY_DELAY_MS = 1500;

function getFriendlyErrorMessage(err) {
  const msg = (err?.message || "").toLowerCase();
  const code = err?.code || err?.response?.data?.code || "";
  const codeStr = String(code).toLowerCase();
  if (codeStr === "econnreset" || msg.includes("connection was reset") || msg.includes("econnreset")) {
    return ciText("Connection was reset. Please try again.");
  }
  if (codeStr === "etimedout" || codeStr === "econnaborted" || msg.includes("timeout")) {
    return ciText("Request timed out. Please try again.");
  }
  if (msg.includes("network error") || codeStr === "err_network") {
    return ciText("Network error. Please check your connection and try again.");
  }
  return (
    err?.response?.data?.message ||
    err?.message ||
    ciText("Failed to load document.")
  );
}

/** Fetch a URL with timeout; returns blob. */
function fetchWithTimeout(url, timeoutMs, signal) {
  const controller = signal || new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    credentials: "include",
    mode: "cors",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

const DocumentViewer = ({ open, onClose, documentUrl, contractNo, invoiceNumber, business_id }) => {
  useTranslation();
  const [loading, setLoading] = useState(true);
  const [fullUrl, setFullUrl] = useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [error, setError] = useState(null);
  const blobUrlRef = useRef(null);

  // Revoke blob URL on unmount or when it changes
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        window.URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const loadDocument = useCallback(async () => {
    if (!open || !documentUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFullUrl("");
    if (blobUrlRef.current) {
      window.URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPdfBlobUrl("");

    try {
      if (documentUrl.startsWith("http://") || documentUrl.startsWith("https://")) {
        setFullUrl(documentUrl);
        setLoading(false);
        return;
      }

      // S3 key: get PDF via backend proxy (same-origin, avoids CORS / "Failed to fetch")
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
          const blob = await CustomerInvoiceServices.getInvoiceDocumentPdfBlob(documentUrl, {
            timeout: PDF_FETCH_TIMEOUT,
          });
          const blobUrl = window.URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          setPdfBlobUrl(blobUrl);
          setLoading(false);
          return;
        } catch (err) {
          if (attempt === MAX_RETRIES) {
            setError(getFriendlyErrorMessage(err));
          }
        }
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [open, documentUrl]);

  useEffect(() => {
    loadDocument();
  }, [open, documentUrl]);

  // Once we have fullUrl, fetch PDF as blob and show via blob URL (avoids iframe "connection reset")
  const fetchPdfAsBlob = useCallback(async () => {
    if (!fullUrl || !fullUrl.startsWith("http")) return;
    setLoading(true);
    setError(null);
    if (blobUrlRef.current) {
      window.URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPdfBlobUrl("");

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
        const controller = new AbortController();
        const response = await fetchWithTimeout(fullUrl, PDF_FETCH_TIMEOUT, controller);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setPdfBlobUrl(blobUrl);
        setLoading(false);
        return;
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          setError(getFriendlyErrorMessage(err));
        }
      }
    }
    setLoading(false);
  }, [fullUrl]);

  useEffect(() => {
    if (!open) {
      if (blobUrlRef.current) {
        window.URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPdfBlobUrl("");
      return;
    }
    if (open && fullUrl && fullUrl.startsWith("http")) {
      fetchPdfAsBlob();
    }
    return () => {
      if (blobUrlRef.current) {
        window.URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [open, fullUrl]);

  const handleDownload = () => {
    const fileName = formatInvoiceDownloadName(invoiceNumber || contractNo);
    if (pdfBlobUrl) {
      const a = document.createElement("a");
      a.href = pdfBlobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (!fullUrl) return;
    fetch(fullUrl, { credentials: "include", mode: "cors" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch((e) => {
        console.error("Download error:", e);
        alert(ciText("Failed to download document. Please try again."));
      });
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
        <Typography variant="h6">
          {ciText("Document Viewer")}: {contractNo}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box className="flex flex-col justify-center items-center h-[600px]">
            <CircularProgress />
            <Typography variant="body2" className="mt-4 text-gray-600">
              {ciText("Loading document...")}
            </Typography>
          </Box>
        ) : error ? (
          <Box className="flex flex-col justify-center items-center h-[600px] p-4">
            <Alert severity="error" className="w-full mb-4">
              {error}
            </Alert>
            <Button
              variant="outlined"
              onClick={fullUrl ? fetchPdfAsBlob : loadDocument}
              className="mt-4"
            >
              {ciText("Retry")}
            </Button>
          </Box>
        ) : (pdfBlobUrl || fullUrl) ? (
          <iframe
            id="pdf-viewer"
            src={pdfBlobUrl ? `${pdfBlobUrl}#toolbar=0` : `${fullUrl}#toolbar=0`}
            width="100%"
            height="600px"
            style={{ border: "none" }}
            title={ciText("PDF Document Viewer")}
          />
        ) : (
          <Box className="flex justify-center items-center h-[600px]">
            <Typography variant="body2" className="text-gray-600">
              {ciText("No document URL provided")}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handlePrint}
          variant="outlined"
          startIcon={<Print />}
          disabled={loading}
        >
          {ciText("Print")}
        </Button>
        <Button
          onClick={handleDownload}
          variant="contained"
          color="primary"
          startIcon={<Download />}
          disabled={loading}
        >
          {ciText("Download")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentViewer;
