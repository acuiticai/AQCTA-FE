import React, { useContext } from "react";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import Button from "@/page-layouts/components/Button";
import { logoutUser } from "@/utils/generic";
import { OnboardingShell } from "./OnboardingLayout";

/**
 * Invitation-based onboarding — Scenario A confirmation page.
 * Shown once a customer finishes module selection but no admin has assigned
 * a pricing plan yet. Mirrors the exact copy from the feature spec.
 */
const RegistrationSubmitted = () => {
  const history = useHistory();
  const adminCtx = useContext(AdminContext);

  const handleLogout = () => {
    adminCtx?.dispatch?.({ type: "USER_LOGOUT" });
    logoutUser();
    history.replace("/login");
  };

  return (
    <OnboardingShell
      showStepper={false}
      title="Registration completed successfully"
      subtitle="Your request has been submitted."
    >
      <div className="onboarding-status-icon onboarding-status-icon--success">
        ✓
      </div>
      <p style={{ textAlign: "center", margin: "0 0 24px", color: "#4b5563" }}>
        Our team will review your account and send you a subscription link
        shortly. You&apos;ll receive an email once it&apos;s ready — you can
        also log in again anytime to check your status.
      </p>
      <Button
        label="Log out"
        onClick={handleLogout}
        className="login-page__form-button-full"
      />
    </OnboardingShell>
  );
};

export default RegistrationSubmitted;
