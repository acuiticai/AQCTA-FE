import React, { useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import { Loader } from "@/page-layouts/index";
import { syncAdminInfoRoleFromServer } from "@/utils/sessionApiCache";
import { OnboardingShell } from "./OnboardingLayout";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 20;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PaymentSuccess = () => {
  const history = useHistory();
  const location = useLocation();
  const { state, dispatch } = useContext(AdminContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = new URLSearchParams(location.search);
  const sessionId =
    params.get("orderid") ||
    params.get("order_id") ||
    params.get("session_id");
  const isDummy = params.get("dummy") === "1";
  const isTrial = params.get("trial") === "1";

  // Fiuu may leave tokenization fields on the success URL (or a proxy).
  // Prefer backend return handler; this is a safety net so the token is not lost.
  const tokenizationFromUrl = (() => {
    const token = params.get("token");
    const extraPRaw = params.get("extraP");
    let extraP = extraPRaw;
    if (typeof extraPRaw === "string" && extraPRaw.trim().startsWith("{")) {
      try {
        extraP = JSON.parse(extraPRaw);
      } catch (_e) {
        /* keep raw string — backend parseExtraP handles JSON strings */
      }
    }
    const cclast4 = params.get("cclast4") || params.get("ccLast4");
    const ccbrand = params.get("ccbrand") || params.get("ccBrand");
    const CustID = params.get("CustID") || params.get("custID");
    if (!token && !extraP && !cclast4 && !ccbrand && !CustID) return null;
    return { token, extraP, cclast4, ccbrand, CustID };
  })();

  useEffect(() => {
    if (!state?.adminInfo?.token) {
      history.replace("/login");
      return;
    }

    const finishOnboarding = async (subscriptionPatch = {}) => {
      const withRole = await syncAdminInfoRoleFromServer(state.adminInfo);
      const updatedAdminInfo = {
        ...withRole,
        subscription: {
          ...(withRole.subscription || {}),
          isSelfRegistered: true,
          subscriptionStatus: "Active",
          onboardingCompleted: true,
          ...subscriptionPatch,
        },
      };
      localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
      dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
      history.replace("/home");
    };

    if (isDummy || isTrial) {
      RegistrationServices.getSubscriptionStatus()
        .then((statusRes) =>
          finishOnboarding({
            subscribedModules:
              statusRes.subscription?.subscribedModules ||
              state.adminInfo?.subscription?.selectedModules ||
              [],
            subscribedSubModules:
              statusRes.subscription?.subscribedSubModules ||
              state.adminInfo?.subscription?.selectedSubModules ||
              [],
            selectedPlanId: statusRes.subscription?.selectedPlanId,
            billingInterval: statusRes.subscription?.billingInterval,
          }),
        )
        .then(() => {
          notifySuccess(
            isTrial
              ? "Trial started. Welcome to PCI."
              : "Demo onboarding completed. Welcome to PCI.",
          );
        })
        .catch((err) => {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load your permissions.",
          );
          notifyError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load your permissions.",
          );
        })
        .finally(() => setLoading(false));
      return;
    }

    if (!sessionId) {
      setError("Missing payment session.");
      setLoading(false);
      return;
    }

    const confirmPaymentSuccess = async () => {
      // Poll verify: upgrades (ADJ*) stay Active before payment is applied, so
      // we must wait for this order's activationApplied — not subscriptionStatus.
      // First call also ships any Fiuu token left on the success URL to backend.
      let sessionStatus = null;
      let tokenization = tokenizationFromUrl;
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        sessionStatus = await RegistrationServices.verifyPayment(
          sessionId,
          attempt === 0 && tokenization ? tokenization : {},
        );
        if (attempt === 0 && tokenization) {
          tokenization = null;
          // Drop payment token from the address bar after first capture attempt.
          const clean = new URLSearchParams();
          clean.set("orderid", sessionId);
          if (params.get("fiuu_status")) {
            clean.set("fiuu_status", params.get("fiuu_status"));
          }
          history.replace(
            `${location.pathname}?${clean.toString()}`,
          );
        }
        if (
          sessionStatus.paymentStatus === "paid" &&
          sessionStatus.activated
        ) {
          break;
        }
        if (attempt < MAX_POLL_ATTEMPTS - 1) {
          await sleep(POLL_INTERVAL_MS);
        }
      }

      if (sessionStatus?.paymentStatus !== "paid") {
        throw new Error("Payment not completed.");
      }

      if (!sessionStatus.activated) {
        throw new Error(
          "Your payment was received. Plan activation is still processing — please open the app again in a moment.",
        );
      }

      const statusRes = await RegistrationServices.getSubscriptionStatus();
      return {
        subscribedModules:
          sessionStatus.subscribedModules ||
          statusRes.subscription?.subscribedModules ||
          [],
        subscribedSubModules:
          statusRes.subscription?.subscribedSubModules ||
          state.adminInfo?.subscription?.selectedSubModules ||
          [],
        selectedPlanId:
          statusRes.subscription?.subscribedPlanId ||
          statusRes.subscription?.selectedPlanId,
        billingInterval:
          statusRes.subscription?.subscribedBillingInterval ||
          statusRes.subscription?.billingInterval,
      };
    };

    confirmPaymentSuccess()
      .then(async (subscriptionPatch) => {
        notifySuccess("Subscription activated! Welcome to PCI.");
        await finishOnboarding(subscriptionPatch);
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Payment verification failed.";
        setError(message);
        notifyError(message);
      })
      .finally(() => setLoading(false));
  }, [
    sessionId,
    isDummy,
    isTrial,
    state?.adminInfo?.token,
    history,
    dispatch,
    state.adminInfo,
  ]);

  if (loading) {
    return (
      <OnboardingShell
        showStepper={false}
        title="Activating your subscription"
        subtitle="Please wait while we confirm your payment…"
      >
        <div className="onboarding-loading" style={{ minHeight: 160 }}>
          <Loader color="var(--p-blue)" />
        </div>
      </OnboardingShell>
    );
  }

  if (error) {
    return (
      <OnboardingShell
        showStepper={false}
        title="Payment verification issue"
        subtitle={error}
      >
        <div className="onboarding-status-icon onboarding-status-icon--error">
          !
        </div>
        <Button
          label="Back to login"
          onClick={() => history.push("/login")}
          className="login-page__form-button-full"
        />
        <Button
          label="Back to pricing"
          onClick={() => history.push("/onboarding/pricing")}
          className="login-page__form-button-full"
        />
      </OnboardingShell>
    );
  }

  return null;
};

export default PaymentSuccess;
