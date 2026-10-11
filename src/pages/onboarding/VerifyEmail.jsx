import React, { useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import LabelArea from "@/components/form/selectOption/LabelArea";
import { OTPInput } from "@/page-layouts/index";
import { AiOutlineExclamationCircle } from "react-icons/ai";
import { HiOutlineInformationCircle } from "react-icons/hi";
import { OnboardingSplitLayout } from "./OnboardingLayout";

const VerifyEmail = () => {
  const history = useHistory();
  const location = useLocation();
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const params = new URLSearchParams(location.search);
  const email = (params.get("email") || "").trim();

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!email) {
      notifyError("Email address is missing.");
      return;
    }
    if (otp.length !== 6) {
      notifyError("Please enter the 6-digit verification code.");
      return;
    }

    setVerifying(true);
    try {
      const res = await RegistrationServices.verifyEmail({ email, otp });
      const verifiedEmail = res.email || email;
      notifySuccess(res.message || "Email verified!");
      history.replace(
        `/set-password?email=${encodeURIComponent(verifiedEmail)}`,
      );
    } catch (err) {
      notifyError(err?.response?.data?.message || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      notifyError("Email address is missing.");
      return;
    }
    setResending(true);
    try {
      const res = await RegistrationServices.resendVerification(email);
      notifySuccess(res.message || "Verification code sent.");
      setOtp("");
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to resend verification code.",
      );
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <OnboardingSplitLayout
        currentStep={2}
        title="Verification unavailable"
        subtitle="We could not find your email address. Please register again to continue."
      >
        <div className="verify-email-state verify-email-state--error">
          <div className="verify-email-state__icon verify-email-state__icon--error">
            <AiOutlineExclamationCircle size={28} />
          </div>
          <p className="verify-email-state__message">
            Your verification link is incomplete or has expired.
          </p>
        </div>
        <div className="login-page__form-buttons verify-email-actions">
          <Button
            type="button"
            label="Register again"
            onClick={() => history.push("/register")}
            className="login-page__form-button-full"
          />
        </div>
        <p className="verify-email-footer">
          Already have an account?{" "}
          <Link to="/login" className="login-page__link">
            Sign in
          </Link>
        </p>
      </OnboardingSplitLayout>
    );
  }

  return (
    <OnboardingSplitLayout
      currentStep={2}
      title="Verify your email"
      subtitle={`Enter the 6-digit code we sent to ${email}.`}
    >
      <form onSubmit={handleVerify} className="login-page__form verify-email-form">
        <LabelArea
          color="#929296"
          label="Verification code"
          className="mb-2 verify-email-form__label"
        />
        <div className="login-page__otp-container">
          <OTPInput value={otp} onChange={setOtp} email={email} hideHint />
        </div>

        <div className="verify-email-resend">
          <span className="verify-email-resend__text">Didn&apos;t receive the code?</span>
          <button
            type="button"
            className="verify-email-resend__link"
            onClick={handleResend}
            disabled={resending || verifying}
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>

        <div className="login-page__form-buttons verify-email-actions">
          <Button
            type="submit"
            label="Verify & continue"
            loading={verifying}
            disabled={verifying || otp.length !== 6}
            className="login-page__form-button-full"
          />
        </div>
      </form>

      <div className="onboarding-info-box onboarding-info-box--neutral verify-email-tip" role="note">
        <HiOutlineInformationCircle
          className="verify-email-tip__icon"
          size={18}
          aria-hidden
        />
        <div className="verify-email-tip__text">
          <p>
            Check your spam or promotions folder if you don&apos;t see the email.
            Codes expire after <strong>10 minutes</strong>.
          </p>
        </div>
      </div>

      <p className="verify-email-footer">
        Wrong email?{" "}
        <Link to="/register" className="login-page__link">
          Register with a different address
        </Link>
      </p>
    </OnboardingSplitLayout>
  );
};

export default VerifyEmail;
