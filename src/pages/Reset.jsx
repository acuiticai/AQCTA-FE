import React, { useState, useEffect } from "react";
import {
  Grid,
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
} from "@mui/material";
import Cookies from "js-cookie";
import { Lock } from "@mui/icons-material";
import { Link, useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { notifySuccess, notifyError, notifyWarning } from "@/utils/toast";
import useConfigLogo from "@/hooks/useConfigLogo";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";

const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

const Reset = () => {
  const history = useHistory();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get("email");
  useEffect(() => {
    // Check if the user is already logged in
    const adminInfo = localStorage.getItem("adminInfo");
    if (adminInfo) {
      const parsedAdminInfo = JSON.parse(adminInfo);
      const landing = parsedAdminInfo?.role?.landing_page;
      history.replace(landing);
    }
    // Check if the user has a valid token in cookies 
    const token = Cookies.get("token");
    if (token) {
      const parsedToken = JSON.parse(token);
      const landing = parsedToken?.role?.landing_page;
      history.replace(landing);
    }
    // Check if the user has a valid token in localStorage
    const localStorageToken = localStorage.getItem("token");
    if (localStorageToken) {
      const parsedLocalStorageToken = JSON.parse(localStorageToken);
      const landing = parsedLocalStorageToken?.role?.landing_page;
      history.replace(landing);
    }
    // Check if the user has a valid token in sessionStorage
    const sessionStorageToken = sessionStorage.getItem("token");
    if (sessionStorageToken) {
      const parsedSessionStorageToken = JSON.parse(sessionStorageToken);
      const landing = parsedSessionStorageToken?.role?.landing_page;
      history.replace(landing);
    }
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Debugging email
  useEffect(() => {
    console.log("📨 Email received for password reset:", email);
  }, [email]);

  // Handle password reset
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // Validations
    if (!newPassword || !confirmPassword) {
      notifyWarning("⚠️ Both password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      notifyWarning("⚠️ Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      notifyWarning("⚠️ Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${Base_URL}/otp/resetPassword`, {
        email,
        password: newPassword,
      });

      if (response.data.message === "Password reset successfully!") {
        notifySuccess("Password reset successfully! Redirecting to login...");
        history.push("/login");
      } else {
        notifyError(response.data.message || "❌ Failed to reset password.");
      }
    } catch (err) {
      notifyError(err.response?.data?.message || "❌ Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const logo = useConfigLogo();

  return (
    <Grid
      container
      sx={{
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f9fafb",
      }}
    >
      <Box
        sx={{
          width: "90%",
          maxWidth: "500px",
          padding: "30px",
          borderRadius: "15px",
          backgroundColor: "#fff",
          border: "0.5px solid #f0f0f0",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Logo */}
        <Box sx={{ marginBottom: "20px", textAlign: "left" }}>
          <img
            src={logo}
            alt="Company Logo"
            width="150"
            height="auto"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = PLACEHOLDER_LOGO;
            }}
          />
        </Box>

        {/* Heading */}
        <Typography
          variant="h4"
          sx={{
            textAlign: "left",
            marginBottom: "10px",
            fontWeight: "bold",
          }}
        >
          Reset Password
        </Typography>

        <Typography
          variant="body2"
          sx={{
            textAlign: "left",
            marginBottom: "20px",
            color: "rgba(0, 0, 0, 0.6)",
          }}
        >
          Your OTP has been verified, Please enter your password below.
        </Typography>

        <form onSubmit={handleSubmit}>
          {/* New Password Field */}
          <Box sx={{ marginBottom: "15px" }}>
            <Typography
              sx={{
                marginBottom: "10px",
                fontSize: "0.85rem",
                fontWeight: "500",
                color: "grey",
                textAlign: "left",
              }}
            >
              Password
            </Typography>
            <TextField
              fullWidth
              type="password"
              placeholder="Enter password"
              variant="outlined"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#f5f5f5",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  border: "none",
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: "grey" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Confirm Password Field */}
          <Box sx={{ marginBottom: "15px" }}>
            <Typography
              sx={{
                marginBottom: "10px",
                fontSize: "0.85rem",
                fontWeight: "500",
                color: "grey",
                textAlign: "left",
              }}
            >
              Confirm Password
            </Typography>
            <TextField
              fullWidth
              type="password"
              placeholder="Confirm Password"
              variant="outlined"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#f5f5f5",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  border: "none",
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: "grey" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Error Message */}
          {errorMessage && (
            <Typography
              variant="body2"
              color="error"
              sx={{ marginBottom: "15px", fontSize: "0.85rem" }}
            >
              {errorMessage}
            </Typography>
          )}

          {/* Submit Button */}
          <Button
            fullWidth
            variant="contained"
            type="submit"
            disabled={loading}
            sx={{
              backgroundColor: "#9bcd4b",
              color: "#fff",
              padding: "10px 0",
              fontSize: "1rem",
              textTransform: "none",
              "&:hover": {
                backgroundColor: "#83b541",
              },
            }}
          >
            {loading ? "Resetting Password..." : "Reset Password"}
          </Button>
        </form>

        <Typography sx={{ marginTop: "20px", textAlign: "center" }}>
          <Link
            to="/login"
            style={{
              fontSize: "14px",
              color: "#059669",
              textDecoration: "none",
            }}
          >
            Back to login
          </Link>
        </Typography>
      </Box>
    </Grid>
  );
};

export default Reset;
