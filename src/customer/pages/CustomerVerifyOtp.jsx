import React, { useState } from "react";
import { Redirect, useHistory, useLocation } from "react-router-dom";

import CenteredAuthLayout from "../components/layout/CenteredAuthLayout";
import AuthHeader, { SecureNote } from "../components/layout/AuthHeader";
import Button from "../components/ui/Button";
import OtpInput, { isOtpComplete } from "../components/ui/OtpInput";
import { useAccount } from "../context/AccountContext";
import { customerPath } from "../routes/paths";
import CustomerAuthServices from "../services/authService";

const OTP_LENGTH = 6;

const resolvePurpose = (raw) => {
  if (raw === "register" || raw === "forgot-password") return raw;
  return "login";
};

const fallbackPathForPurpose = (purpose) => {
  if (purpose === "register") return customerPath.register;
  if (purpose === "forgot-password") return customerPath.forgotPassword;
  return customerPath.login;
};

export default function CustomerVerifyOtp() {
  const history = useHistory();
  const location = useLocation();
  const { isAuthenticated, signIn } = useAccount();

  const email = location.state?.email || "";
  const purpose = resolvePurpose(location.state?.purpose);
  const redirectAfterAuth =
    location.state?.from?.pathname
      ? `${location.state.from.pathname}${location.state.from.search || ""}`
      : customerPath.dashboard;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if (isAuthenticated) {
    return <Redirect to={redirectAfterAuth} />;
  }

  if (!email) {
    return <Redirect to={fallbackPathForPurpose(purpose)} />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isOtpComplete(code, OTP_LENGTH)) {
      setError(`Enter all ${OTP_LENGTH} digits to continue`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await CustomerAuthServices.verifyOtp({
        email,
        otp: code,
        purpose,
      });
      const payload = res?.data?.data || res?.data;

      if (purpose === "forgot-password") {
        if (!payload?.resetToken) {
          setError("Verification succeeded but no reset token was returned.");
          return;
        }
        history.replace(customerPath.resetPassword, {
          email,
          resetToken: payload.resetToken,
        });
        return;
      }

      if (!payload?.token) {
        setError("Verification succeeded but no session was returned.");
        return;
      }
      signIn(payload);
      history.replace(redirectAfterAuth);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Invalid or expired OTP. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setCode("");
    setError("");
    setResending(true);
    try {
      await CustomerAuthServices.resendOtp({ email, purpose });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not resend OTP. Please try again.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <CenteredAuthLayout footer={<SecureNote />}>
      <form onSubmit={handleSubmit} noValidate>
        <AuthHeader
          size="display"
          airy
          title={
            purpose === "forgot-password" ? "Verify reset code" : "Verify OTP"
          }
          subtitle={`Enter OTP sent to your ${email} account`}
        />

        <div className="epc-field">
          <span className="epc-field__label" id="epc-otp-label">
            OTP
          </span>
          <div role="group" aria-labelledby="epc-otp-label">
            <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} />
          </div>
          {error && <span className="epc-field__error">{error}</span>}
        </div>

        <div className="epc-otp-submit">
          <Button type="submit" size="lg" block loading={submitting}>
            Verify OTP
          </Button>
        </div>

        <p className="epc-auth-footnote">
          Haven&apos;t Received any code yet?
          <button
            type="button"
            className="epc-link epc-link--underlined epc-link-button"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </form>
    </CenteredAuthLayout>
  );
}
