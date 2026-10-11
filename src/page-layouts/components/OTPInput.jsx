import React, { useState, useRef, useEffect } from "react";

const OTPInput = ({ value = "", onChange, email, hideHint = false }) => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const inputRefs = useRef([]);

  useEffect(() => {
    // Initialize refs array
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  useEffect(() => {
    // Update OTP array when value prop changes
    if (value) {
      const otpArray = value.split("").slice(0, 6);
      setOtp([...otpArray, ...new Array(6 - otpArray.length).fill("")]);
    }
  }, [value]);

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Call parent onChange with complete OTP string
    const otpString = newOtp.join("");
    onChange(otpString);

    // Move to next input if value is entered
    if (element.value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const otpArray = pastedData
      .split("")
      .map((char) => (isNaN(char) ? "" : char));
    const newOtp = [...otpArray, ...new Array(6 - otpArray.length).fill("")];
    setOtp(newOtp);
    onChange(newOtp.join(""));

    // Focus the next empty input or the last input
    const nextEmptyIndex = newOtp.findIndex((val) => !val);
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    inputRefs.current[focusIndex].focus();
  };

  return (
    <div className="otp-input">
      {!hideHint && (
        <p className="otp-input__hint">
          Enter the 6-digit code sent to {email}.
        </p>
      )}
      <div className="otp-input__digits" role="group" aria-label="Verification code">
        {otp.map((digit, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            ref={(el) => (inputRefs.current[index] = el)}
            onChange={(e) => handleChange(e.target, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            className="otp-input__digit"
            aria-label={`Digit ${index + 1} of 6`}
          />
        ))}
      </div>
    </div>
  );
};

export default OTPInput;
