import React, { useState, useRef, useEffect } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { Box, Typography, Button, TextField } from "@mui/material";
import axios from "axios";
import { notifySuccess, notifyError, notifyWarning } from "@/utils/toast";
import useConfigLogo from "@/hooks/useConfigLogo";
import Cookies from "js-cookie";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";

const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

const OtpVerification = () => {
  const history = useHistory();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef([]);
  const [timer, setTimer] = useState(30);
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
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get("email");

  useEffect(() => {
    setOtp(["", "", "", "", "", ""]);
    setTimer(30);
  }, [location.pathname, location.search]);

  // Handle input change for OTP
  const handleChange = (e, index) => {
    const value = e.target.value;
    if (/^[0-9]$/.test(value) || value === "") {
      const updatedOtp = [...otp];
      updatedOtp[index] = value;
      setOtp(updatedOtp);

      if (value && index < 5) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  // Handle backspace for OTP inputs
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  // Verify OTP Handler
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const enteredOtp = otp.join("");

    if (enteredOtp.length !== 6) {
      notifyError("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${Base_URL}/otp/verify`, {
        email,
        otp: enteredOtp,
      });

      if (response.data.message === "OTP verified successfully!") {
        notifySuccess("OTP Verified Successfully!");
        history.push(`/Reset?email=${encodeURIComponent(email)}`);
      } else {
        notifyError("Invalid OTP. Please try again.");
      }
    } catch (error) {
      notifyError("An error occurred while verifying OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Handler
  const handleResendOtp = async () => {
    if (!email) {
      notifyError("Invalid email address.");
      return;
    }

    try {
      setResendLoading(true);
      const response = await axios.post(`${Base_URL}/otp/resend`, { email });

      if (response.data.message === "OTP resent successfully!") {
        notifySuccess("A new OTP has been sent to your email.");
        setTimer(30); // Reset timer
      } else {
        notifyError("Failed to resend OTP. Please try again.");
      }
    } catch (error) {
      notifyError("An error occurred while resending OTP. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  // Countdown Timer for OTP Resend
  useEffect(() => {
    const countdown = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

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
          OTP Verification
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
          Enter the 6-digit code sent to <strong>{email}</strong>.
        </Typography>

        <form onSubmit={handleVerifyOtp}>
          {/* OTP Input Fields */}
          <Box
            sx={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            {otp.map((digit, index) => (
              <TextField
                key={index}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                inputRef={(el) => (inputRefs.current[index] = el)}
                sx={{
                  width: "50px",
                  textAlign: "center",
                  fontSize: "20px",
                  borderRadius: "8px",
                  "& .MuiOutlinedInput-root": {
                    textAlign: "center",
                    backgroundColor: "#f5f5f5",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                }}
              />
            ))}
          </Box>

          {/* Verify OTP Button */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
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
            // onClick={handleVerifyOtp}
          >
            {loading ? "Verifying OTP..." : "Verify OTP"}
          </Button>
        </form>

        {/* Resend OTP */}
        <Typography
          sx={{
            marginTop: "15px",
            fontSize: "0.85rem",
            color: "gray",
            textAlign: "center",
          }}
        >
          {timer > 0 ? (
            <>Resend OTP in 00:{timer.toString().padStart(2, "0")}</>
          ) : (
            <Button
              variant="text"
              onClick={handleResendOtp}
              disabled={resendLoading}
              sx={{ textTransform: "none", color: "#9bcd4b" }}
            >
              {resendLoading ? "Resending..." : "Resend OTP"}
            </Button>
          )}
        </Typography>

        <Typography sx={{ marginTop: "20px", textAlign: "center" }}>
          <Link
            to="/forgot-password"
            style={{
              fontSize: "14px",
              color: "#059669",
              textDecoration: "none",
            }}
          >
            Back to forgot password
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default OtpVerification;
