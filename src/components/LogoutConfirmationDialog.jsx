import React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import LogoutIcon from "@mui/icons-material/Logout";

export default function LogoutConfirmationDialog({
  open,
  onClose,
  onConfirm,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
      PaperProps={{
        sx: {
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          minWidth: "380px",
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: "rgba(0, 0, 0, 0.3)",
        },
      }}
    >
      <Box
        sx={{
          background: "var(--p-blue)",
          padding: "24px",
          color: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Box
          sx={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ExitToAppIcon sx={{ fontSize: "28px", color: "white" }} />
        </Box>
        <DialogTitle
          id="logout-dialog-title"
          sx={{
            padding: 0,
            fontSize: "20px",
            fontWeight: 600,
            color: "white",
            textAlign: "center",
          }}
        >
          Logout Confirmation
        </DialogTitle>
      </Box>

      <DialogContent
        sx={{
          padding: "28px 24px",
          textAlign: "center",
        }}
      >
        <DialogContentText
          id="logout-dialog-description"
          sx={{
            color: "#333",
            fontSize: "15px",
            lineHeight: "1.8",
            marginBottom: "12px",
            fontWeight: 500,
          }}
        >
          Are you sure you want to log out from your account?
        </DialogContentText>
        <Typography
          variant="caption"
          sx={{
            color: "#666",
            fontSize: "13px",
            display: "block",
            lineHeight: "1.6",
          }}
        >
          You&apos;ll need to sign in again to access your account.
        </Typography>
      </DialogContent>

      <DialogActions
        sx={{
          padding: "16px 24px 24px",
          gap: "12px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Button
          onClick={onClose}
          sx={{
            padding: "10px 28px",
            borderRadius: "6px",
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--p-blue)",
            backgroundColor: "var(--header-hover-bg, #f3f4f6)",
            border: "1px solid var(--p-blue-light-2, #e5e7eb)",
            cursor: "pointer",
            transition: "background 0.2s ease",
            "&:hover": {
              backgroundColor: "var(--blue-100, #e5e7eb)",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          sx={{
            padding: "10px 28px",
            borderRadius: "6px",
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--buttons-text-color, white)",
            background: "var(--p-blue)",
            border: "none",
            cursor: "pointer",
            transition: "background 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            "&:hover": {
              background: "var(--p-blue-dark)",
            },
          }}
          autoFocus
          endIcon={<LogoutIcon sx={{ fontSize: "16px" }} />}
        >
          Logout
        </Button>
      </DialogActions>
    </Dialog>
  );
}
