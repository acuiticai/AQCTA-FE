import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
} from "@mui/material";
import { EmailOutlined } from "@mui/icons-material";
import axios from "axios";
import Cookies from "js-cookie";
import { useHistory } from "react-router-dom";
import { notifySuccess, notifyError, notifyWarning } from "@/utils/toast";
import useConfigLogo from "@/hooks/useConfigLogo";
import { Link } from "react-router-dom";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";

const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

const ForgotPassword = () => {
  const history = useHistory();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email) {
      notifyError("Please enter your email.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${Base_URL}/otp/send`,
        { email: email },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.message === "OTP sent successfully!") {
        notifySuccess("OTP sent successfully");
        history.push(`/OtpVerification?email=${encodeURIComponent(email)}`);
      } else {
        notifyError(
          response.data.message || "Failed to send OTP. Please try again."
        );
      }
    } catch (err) {
      notifyError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };
  const loginLinkStyle = {
    fontSize: "14px",
    color: "#059669",
    textDecoration: "none",
    marginTop: "24px",
    display: "inline-block",
  };
  const logo = useConfigLogo();
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <Box sx={{ marginBottom: "20px", textAlign: "left" }}>
          <img
            src={logo}
            alt="PCI Group"
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
            fontWeight: "bold",
            marginBottom: "10px",
            fontSize: "24px",
            textAlign: "left",
          }}
        >
          Forgot Password?
        </Typography>

        {/* Subtext */}
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.9rem",
            color: "rgba(0, 0, 0, 0.6)",
            textAlign: "left",
            marginBottom: "20px",
          }}
        >
          Don’t worry, we are here to help recover your password. Enter your
          email below to get OTP for your password recovery process.
        </Typography>

        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <Box sx={{ marginBottom: "20px" }}>
            <Typography
              sx={{
                marginBottom: "8px",
                fontSize: "0.85rem",
                fontWeight: "500",
                color: "grey",
                textAlign: "left",
              }}
            >
              Email
            </Typography>

            <TextField
              fullWidth
              type="email"
              placeholder="Enter your email"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                    <EmailOutlined sx={{ color: "#999999" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Submit Button */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "var(--p-blue)",
              color: "#fff",
              padding: "10px 0",
              fontSize: "1rem",
              borderRadius: "8px",
              textTransform: "none",
              "&:hover": {
                backgroundColor: "var(--p-blue)",
              },
              "&:active": {
                backgroundColor: "var(--p-blue)",
              },
            }}
          >
            {loading ? "Sending OTP..." : "Submit"}
          </Button>
        </form>
        <div style={{ textAlign: "center" }}>
          <Link to="/login" style={loginLinkStyle}>
            Login
          </Link>
        </div>
      </Box>
    </Box>
  );
};

export default ForgotPassword;
