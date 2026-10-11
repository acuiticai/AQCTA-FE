import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import { logoutUser } from "@/utils/generic";
import { OnboardingShell } from "./OnboardingLayout";

/**
 * Invitation-based onboarding — shown to a logged-in, pending user whose
 * admin hasn't assigned a pricing plan yet. Once the admin generates a link,
 * "Check again" (or the next login) routes the customer straight to
 * /onboarding/invitation/:token.
 */
const WaitingForInvitation = () => {
  const history = useHistory();
  const adminCtx = useContext(AdminContext);
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      const res = await RegistrationServices.getSubscriptionStatus();
      const invitation = res?.subscription?.invitation;
      if (invitation?.token && invitation.hasPlan) {
        history.replace(`/onboarding/invitation/${invitation.token}`);
        return;
      }
      notifySuccess("Still waiting — we'll let you know once your plan is ready.");
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to check invitation status.",
      );
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    adminCtx?.dispatch?.({ type: "USER_LOGOUT" });
    logoutUser();
    history.replace("/login");
  };

  return (
    <OnboardingShell
      showStepper={false}
      title="Waiting for your subscription invitation"
      subtitle="Our team is reviewing your account."
    >
      <p style={{ textAlign: "center", margin: "0 0 24px", color: "#4b5563" }}>
        Once an administrator assigns your pricing plan, we&apos;ll email you
        a secure link to complete checkout. You can also check back here.
      </p>
      <Button
        label={checking ? "Checking…" : "Check again"}
        onClick={handleCheckAgain}
        loading={checking}
        className="login-page__form-button-full"
      />
      <Button
        label="Log out"
        onClick={handleLogout}
        secondary
        className="login-page__form-button-full"
      />
    </OnboardingShell>
  );
};

export default WaitingForInvitation;
