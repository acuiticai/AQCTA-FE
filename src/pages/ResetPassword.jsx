import React, { useState, useRef, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Button } from "@windmill/react-ui";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

// Internal imports
import LabelArea from "@/components/form/selectOption/LabelArea";
import ImageLight from "@/assets/img/OtpVerification.png";
import ImageDark from "@/assets/img/OtpVerification.png";

const OtpVerification = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRefs = useRef([]);
  const history = useHistory();

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get("email");

  // Debugging
  useEffect(() => {
    console.log("📨 Received email in OTP Verification:", email);
  }, [email]);

  const handleChange = (value, index) => {
    if (/^[0-9]$/.test(value) || value === "") {
      const updatedOtp = [...otp];
      updatedOtp[index] = value;
      setOtp(updatedOtp);

      if (value && index < 5) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  // ✅ Verify OTP and navigate to Reset Password
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const enteredOtp = otp.join("");

    if (enteredOtp.length !== 6) {
      setErrorMessage("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${Base_URL}/otp/verify`, {
        email,
        otp: enteredOtp,
      });

      if (response.data.message === "OTP verified successfully!") {
        setSuccessMessage("OTP Verified Successfully!");

        // ✅ Navigate to Reset Password with email
        history.push(`/reset-password?email=${encodeURIComponent(email)}`);
      } else {
        setErrorMessage("Invalid OTP. Please try again.");
      }
    } catch (error) {
      setErrorMessage("An error occurred while verifying OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      setErrorMessage("Invalid email address.");
      return;
    }

    try {
      setResendLoading(true);
      const response = await axios.post(`${Base_URL}/otp/resend`, { email });

      if (response.data.message === "OTP resent successfully!") {
        setSuccessMessage("A new OTP has been sent to your email.");
      } else {
        setErrorMessage("Failed to resend OTP. Please try again.");
      }
    } catch (error) {
      setErrorMessage("An error occurred while resending OTP. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex items-center min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 h-full max-w-4xl mx-auto overflow-hidden bg-white rounded-lg shadow-xl dark:bg-gray-800">
        <div className="flex flex-col overflow-y-auto md:flex-row">
          <div className="h-32 md:h-auto md:w-1/2">
            <img aria-hidden="true" className="object-cover w-full h-full dark:hidden" src={ImageLight} alt="OTP Verification" />
            <img aria-hidden="true" className="hidden object-cover w-full h-full dark:block" src={ImageDark} alt="OTP Verification" />
          </div>

          <main className="flex items-center justify-center p-6 sm:p-12 md:w-1/2">
            <div className="w-full">
              <h1 className="mb-4 text-xl font-semibold text-gray-700 dark:text-gray-200">OTP Verification</h1>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Enter the 6-digit code sent to <strong>{email}</strong>.
              </p>

              {successMessage && <p className="text-green-600 text-sm mb-2">{successMessage}</p>}
              {errorMessage && <p className="text-red-600 text-sm mb-2">{errorMessage}</p>}

              <form onSubmit={handleVerifyOtp}>
                <LabelArea label="Enter OTP" />
                <div className="flex justify-between gap-2 mb-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleChange(e.target.value, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      ref={(el) => (inputRefs.current[index] = el)}
                      className="w-12 h-12 text-center text-xl font-semibold border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  ))}
                </div>

                <Button type="submit" block disabled={loading} className="mt-4 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md transition duration-300">
                  {loading ? "Verifying OTP..." : "Verify OTP"}
                </Button>
              </form>

              <p className="mt-4 text-center">
                <button onClick={handleResendOtp} disabled={resendLoading} className="text-sm font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
                  {resendLoading ? "Resending OTP..." : "Didn't receive the OTP? Resend"}
                </button>
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default OtpVerification;
