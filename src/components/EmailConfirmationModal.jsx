"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon, Email } from "@mui/icons-material";

const EmailConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  contractNo,
  customerName,
  isProcessing = false,
}) => {
  const [sendEmail, setSendEmail] = useState(false);

  const handleConfirm = () => {
    onConfirm(sendEmail);
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSendEmail(false);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isProcessing}
    >
      <DialogTitle className="flex justify-between items-center">
        <Box className="flex items-center">
          <Email className="mr-2 text-blue-600" />
          <Typography variant="h6">Contract Approval</Typography>
        </Box>
        {!isProcessing && (
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent>
        <Box className="py-4">
          <Typography variant="body1" className="mb-4">
            You are about to approve contract <strong>{contractNo}</strong> for{" "}
            <strong>{customerName}</strong>.
          </Typography>
          
          <Box className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <FormControlLabel
              control={
                <Checkbox
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={isProcessing}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" className="text-gray-700">
                  <strong>Send this contract automatically to User</strong>
                  <br />
                  <span className="text-sm text-gray-500">
                    If checked, the approved contract will be automatically sent to the User via email.
                    If unchecked, you can send it manually later.
                  </span>
                </Typography>
              }
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="px-6 pb-4">
        <Button
          onClick={handleClose}
          variant="outlined"
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={isProcessing}
          startIcon={isProcessing ? null : <Email />}
        >
          {isProcessing ? "Processing..." : "Approve Contract"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmailConfirmationModal;
