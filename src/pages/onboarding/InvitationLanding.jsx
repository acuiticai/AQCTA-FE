import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import OnboardingInvitationServices from "@/services/OnboardingInvitationServices";
import RegistrationServices from "@/services/RegistrationServices";
import SubscriptionCouponServices from "@/services/SubscriptionCouponServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import { Loader } from "@/page-layouts/index";
import {
  setStoredInvitationToken,
  clearStoredInvitationToken,
} from "@/utils/invitationToken";
import { logoutUser } from "@/utils/generic";
import { OnboardingShell } from "./OnboardingLayout";
import ConfirmChangeDialog from "./ConfirmChangeDialog";
import { redirectToFiuuPayment } from "@/utils/fiuuPaymentRedirect";

const formatMoney = (cents, currency = "usd") => {
  if (cents == null) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(Number(cents) / 100);
  } catch (_err) {
    return `$${(Number(cents) / 100).toFixed(2)}`;
  }
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

/**
 * Invitation checkout — shown after the customer selects modules
 * (same ModuleSelection step as self-service). Guests are sent to register;
 * logged-in users without modules are sent to /onboarding/modules first.
 */
const InvitationLanding = () => {
  const { token } = useParams();
  const history = useHistory();
  const location = useLocation();
  const adminCtx = useContext(AdminContext);
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [moduleNames, setModuleNames] = useState({});
  const [selectedModules, setSelectedModules] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isLoggedIn = Boolean(adminCtx?.state?.adminInfo?.token);
  const loggedInEmail = adminCtx?.state?.adminInfo?.email || "";

  const goToLogin = () => {
    clearStoredInvitationToken();
    try {
      adminCtx?.dispatch?.({ type: "USER_LOGOUT" });
    } catch (_err) {
      /* ignore */
    }
    logoutUser();
    history.replace("/login");
  };

  const handleLogoutAndContinue = () => {
    setLoggingOut(true);
    setEmailMismatch(false);
    setStoredInvitationToken(token);
    try {
      adminCtx?.dispatch?.({ type: "USER_LOGOUT" });
    } catch (_err) {
      /* ignore */
    }
    logoutUser();
    history.replace(`/onboarding/invitation/${token}`);
  };

  const handleWrongAccountCancel = () => {
    if (window.history.length > 1) {
      history.goBack();
      return;
    }
    history.replace("/home");
  };

  useEffect(() => {
    if (token) setStoredInvitationToken(token);
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("cancelled") !== "1") return;
    notifySuccess("Checkout cancelled. You can try again when ready.");
    history.replace(`/onboarding/invitation/${token}`);
  }, [location.search, token, history]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [invitationRes, modulesRes] = await Promise.all([
          OnboardingInvitationServices.getByToken(token),
          RegistrationServices.getModules().catch(() => ({ modules: [] })),
        ]);
        if (cancelled) return;

        const map = {};
        (modulesRes.modules || []).forEach((m) => {
          map[m.key] = m.name;
        });
        setModuleNames(map);
        setInvitation(invitationRes);

        const adminToken = adminCtx?.state?.adminInfo?.token;

        // Already paid / used — never show checkout UI again.
        if (
          invitationRes?.status === "Paid" ||
          invitationRes?.paymentStatus === "paid"
        ) {
          clearStoredInvitationToken();
          const subStatus =
            adminCtx?.state?.adminInfo?.subscription?.subscriptionStatus;
          if (adminToken && subStatus === "Active") {
            history.replace("/home");
            return;
          }
          setError(
            "This invitation has already been used. Sign in to access your account.",
          );
          setInvitation(null);
          return;
        }

        if (!adminToken) {
          setEmailMismatch(false);
          return;
        }

        // Block wrong-account users before modules / checkout / subscription sync.
        const inviteEmail = normalizeEmail(invitationRes?.email);
        const currentEmail = normalizeEmail(
          adminCtx?.state?.adminInfo?.email,
        );
        if (inviteEmail && currentEmail && inviteEmail !== currentEmail) {
          setEmailMismatch(true);
          return;
        }

        setEmailMismatch(false);

        const statusRes =
          await RegistrationServices.getSubscriptionStatus().catch(() => null);
        if (cancelled) return;

        const sub = statusRes?.subscription;
        // Active ERP access — never show invitation checkout / charge again.
        if (
          sub?.subscriptionStatus === "Active" &&
          sub?.isPlanActive !== false
        ) {
          clearStoredInvitationToken();
          const updatedAdminInfo = {
            ...adminCtx.state.adminInfo,
            subscription: {
              ...(adminCtx.state.adminInfo?.subscription || {}),
              ...sub,
            },
          };
          localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
          adminCtx.dispatch?.({
            type: "UPDATE_ADMIN_INFO",
            payload: updatedAdminInfo,
          });
          notifySuccess(
            "Your subscription is already active. No payment needed.",
          );
          history.replace("/home");
          return;
        }

        const bgModules = sub?.selectedModules || [];
        if (!bgModules.length) {
          history.replace("/onboarding/modules");
          return;
        }

        setSelectedModules(bgModules);
        setCompanyName(sub?.companyName || "");

        const updatedAdminInfo = {
          ...adminCtx.state.adminInfo,
          subscription: {
            ...(adminCtx.state.adminInfo?.subscription || {}),
            ...(sub || {}),
          },
        };
        localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
        adminCtx.dispatch?.({
          type: "UPDATE_ADMIN_INFO",
          payload: updatedAdminInfo,
        });
      } catch (err) {
        if (!cancelled) {
          const code = err?.response?.data?.code;
          if (
            code === "INVITATION_PAID" ||
            code === "SUBSCRIPTION_ALREADY_ACTIVE"
          ) {
            clearStoredInvitationToken();
            const subStatus =
              adminCtx?.state?.adminInfo?.subscription?.subscriptionStatus;
            if (
              adminCtx?.state?.adminInfo?.token &&
              subStatus === "Active"
            ) {
              history.replace("/home");
              return;
            }
          }
          setError(
            err?.response?.data?.message || "This invitation link is invalid.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, history, adminCtx?.state?.adminInfo?.token]);

  const handleContinue = async () => {
    if (emailMismatch) return;

    if (!isLoggedIn) {
      setStoredInvitationToken(token);
      history.push(`/register?invitation=${token}`);
      return;
    }

    if (!selectedModules.length) {
      history.replace("/onboarding/modules");
      return;
    }

    setCouponCode("");
    setAppliedCoupon(null);
    setCouponError("");
    setCheckoutStarted(false);
    setConfirmDialogOpen(true);
  };

  const selectedPlan = useMemo(() => {
    if (!invitation?.plan) return null;
    return {
      id: invitation.plan.id,
      name: invitation.plan.name,
      total: invitation.plan.priceCents,
    };
  }, [invitation]);

  const recurringTotalCents = invitation?.plan?.priceCents ?? null;
  const currency = invitation?.plan?.currency || "usd";
  const checkoutQuote = invitation?.quote || null;

  const handleApplyCoupon = async () => {
    const code = String(couponCode || "").trim();
    if (!code || !selectedPlan) return;
    setCouponApplying(true);
    setCouponError("");
    try {
      const amount =
        typeof recurringTotalCents === "number"
          ? recurringTotalCents
          : selectedPlan.total;
      const res = await SubscriptionCouponServices.validate({
        couponCode: code,
        planId: selectedPlan.id,
        amount,
        userId:
          adminCtx?.state?.adminInfo?._id || adminCtx?.state?.adminInfo?.id,
      });
      setAppliedCoupon({
        couponId: res.couponId,
        couponCode: res.couponCode,
        discount: res.discount,
        discountType: res.discountType,
        discountValue: res.discountValue,
        duration: res.duration || "once",
        billingCycles: res.billingCycles ?? null,
        durationLabel: res.durationLabel || null,
        finalAmount: res.finalAmount,
        originalAmount: res.originalAmount ?? amount,
      });
      setCouponCode(res.couponCode || code);
      notifySuccess("Promo code applied successfully.");
    } catch (err) {
      setAppliedCoupon(null);
      const errorCode = err?.response?.data?.code;
      const serverMessage = err?.response?.data?.message;
      if (
        ["NOT_FOUND", "EXPIRED", "INACTIVE", "NOT_STARTED"].includes(errorCode)
      ) {
        setCouponError("Invalid or expired promo code.");
      } else if (errorCode === "SESSION_EXPIRED") {
        setCouponError("Your session has expired. Please log in again.");
      } else if (serverMessage) {
        setCouponError(
          serverMessage.replace(/coupon/gi, (m) =>
            m[0] === "C" ? "Promo code" : "promo code",
          ),
        );
      } else if (!err?.response) {
        setCouponError(
          "Could not reach the server. Please check your connection and try again.",
        );
      } else {
        setCouponError("Failed to apply promo code.");
      }
    } finally {
      setCouponApplying(false);
    }
  };

  const handleClearCoupon = () => {
    if (checkoutStarted) return;
    setAppliedCoupon(null);
    setCouponError("");
    setCouponCode("");
  };

  const handleConfirmedCheckout = async () => {
    setSubmitting(true);
    setCheckoutStarted(true);
    try {
      const result = await OnboardingInvitationServices.createCheckout(
        token,
        appliedCoupon?.couponCode || undefined,
      );
      if (redirectToFiuuPayment(result)) {
        return;
      }
      notifyError("Failed to start checkout.");
      setCheckoutStarted(false);
    } catch (err) {
      setCheckoutStarted(false);
      const redirectPath = err?.response?.data?.redirectPath;
      const code = err?.response?.data?.code;
      if (code === "SUBSCRIPTION_ALREADY_ACTIVE") {
        setConfirmDialogOpen(false);
        clearStoredInvitationToken();
        notifySuccess(
          err?.response?.data?.message ||
            "Your subscription is already active. No payment needed.",
        );
        history.replace(redirectPath || "/home");
        return;
      }
      if (
        redirectPath === "/onboarding/modules" ||
        code === "MODULES_REQUIRED"
      ) {
        setConfirmDialogOpen(false);
        history.replace("/onboarding/modules");
        return;
      }
      notifyError(
        err?.response?.data?.message || "Failed to proceed to payment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const shellProps = {
    showStepper: false,
    compact: true,
    contentWidth: "invitation",
  };

  if (loading) {
    return (
      <OnboardingShell {...shellProps} title="Preparing your plan…">
        <div className="onboarding-loading" style={{ minHeight: 160 }}>
          <Loader color="var(--p-blue)" />
        </div>
      </OnboardingShell>
    );
  }

  if (error || !invitation) {
    return (
      <OnboardingShell
        {...shellProps}
        title="Invitation unavailable"
        subtitle={error}
      >
        <Button
          label="Back to login"
          onClick={goToLogin}
          className="login-page__form-button-full"
        />
      </OnboardingShell>
    );
  }

  if (emailMismatch && isLoggedIn) {
    const invitationEmail = invitation.email || "";
    return (
      <OnboardingShell {...shellProps} title="Wrong Account">
        <div className="onboarding-wrong-account">
          <p className="onboarding-wrong-account__description">
            This invitation was sent to <strong>{invitationEmail}</strong>, but
            you are currently signed in as <strong>{loggedInEmail}</strong>.
          </p>
          <p className="onboarding-wrong-account__hint">
            Please sign out and log in with the invited account to continue.
          </p>
          <div className="onboarding-wrong-account__actions">
            <Button
              label={loggingOut ? "Signing out…" : "Log Out & Continue"}
              onClick={handleLogoutAndContinue}
              loading={loggingOut}
              className="login-page__form-button-full"
            />
            <Button
              label="Cancel"
              onClick={handleWrongAccountCancel}
              secondary
              disabled={loggingOut}
              className="login-page__form-button-full"
            />
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (!invitation.plan) {
    return (
      <OnboardingShell
        {...shellProps}
        title="Almost there"
        subtitle="Your plan hasn't been assigned yet — please check back shortly."
      >
        <Button
          label="Back to login"
          onClick={goToLogin}
          className="login-page__form-button-full"
        />
      </OnboardingShell>
    );
  }

  const displayModules =
    selectedModules.length > 0 ? selectedModules : invitation.modules || [];
  const moduleLabels = displayModules.map((key) => moduleNames[key] || key);
  const intervalLabel =
    invitation.billingInterval === "yearly" ? "year" : "month";
  const businessDisplayName =
    invitation.businessName ||
    companyName ||
    adminCtx?.state?.adminInfo?.subscription?.companyName ||
    "";

  return (
    <OnboardingShell
      {...shellProps}
      title="You're invited"
      subtitle="Review your plan, then continue to secure checkout."
    >
      <div className="onboarding-invitation">
        {/* ── Dark hero banner ──────────────────────────────────── */}
        <div className="onboarding-invitation__hero-dark">
          <div className="onboarding-invitation__hero-left">
            <span className="onboarding-invitation__eyebrow-dark">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ verticalAlign: "middle", marginRight: 4 }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              ASSIGNED PLAN
            </span>
            <h2 className="onboarding-invitation__plan-name-dark">
              {invitation.plan.name}
            </h2>
            <p className="onboarding-invitation__billing-dark">
              Billed {intervalLabel === "year" ? "yearly" : "monthly"}
            </p>
          </div>
          <div className="onboarding-invitation__hero-price">
            {(() => {
              const plan = invitation.plan || {};
              const listCents = Number(plan.listPriceCents || 0);
              const priceCents = Number(plan.priceCents || 0);
              const discPct = Number(plan.discountPercent || 0);
              const discAmount = Number(
                plan.discountAmountCents || Math.max(0, listCents - priceCents),
              );
              const hasDiscount =
                discPct > 0 && listCents > priceCents && priceCents >= 0;
              const duration = String(plan.discountDuration || "forever");
              const cycles = Math.max(
                1,
                Number(plan.discountBillingCycles) || 1,
              );
              const durationNote =
                duration === "once"
                  ? "first payment only"
                  : duration === "repeating"
                    ? `first ${cycles} billing cycle${cycles === 1 ? "" : "s"}`
                    : `every ${intervalLabel}`;
              return (
                <div className="onboarding-invitation__price-stack">
                  {hasDiscount ? (
                    <span className="onboarding-invitation__discount-badge">
                      {discPct}% off
                    </span>
                  ) : null}
                  {hasDiscount ? (
                    <span className="onboarding-invitation__price-was">
                      {formatMoney(listCents, plan.currency)}
                    </span>
                  ) : null}
                  <div className="onboarding-invitation__price-row">
                    <span className="onboarding-invitation__price-dark">
                      {formatMoney(priceCents, plan.currency)}
                    </span>
                    <span className="onboarding-invitation__price-unit-dark">
                      / {intervalLabel}
                    </span>
                  </div>
                  {hasDiscount ? (
                    <span className="onboarding-invitation__discount-note">
                      Save {formatMoney(discAmount, plan.currency)} (
                      {durationNote})
                    </span>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Info cells ─────────────────────────────────────────── */}
        <div className="onboarding-invitation__cells">
          <div className="onboarding-invitation__cell">
            <div className="onboarding-invitation__cell-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="onboarding-invitation__cell-body">
              <span className="onboarding-invitation__cell-label">
                Business
              </span>
              <span className="onboarding-invitation__cell-value">
                {businessDisplayName || ""}
              </span>
            </div>
          </div>

          <div className="onboarding-invitation__cell">
            <div className="onboarding-invitation__cell-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="22,4 12,13 2,4" />
              </svg>
            </div>
            <div className="onboarding-invitation__cell-body">
              <span className="onboarding-invitation__cell-label">Email</span>
              <span className="onboarding-invitation__cell-value">
                {invitation.email || ""}
              </span>
            </div>
          </div>

          {String(invitation.notes || "").trim() ? (
            <div className="onboarding-invitation__cell onboarding-invitation__cell--wide">
              <div className="onboarding-invitation__cell-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div className="onboarding-invitation__cell-body">
                <span className="onboarding-invitation__cell-label">Note</span>
                <span className="onboarding-invitation__cell-value onboarding-invitation__note-value">
                  {String(invitation.notes).trim()}
                </span>
              </div>
            </div>
          ) : null}

          <div className="onboarding-invitation__cell onboarding-invitation__cell--wide">
            <div className="onboarding-invitation__cell-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div
              className="onboarding-invitation__cell-body"
              style={{ flex: 1 }}
            >
              <div className="onboarding-invitation__modules-head">
                <span className="onboarding-invitation__cell-label">
                  Modules
                </span>
                {isLoggedIn && (
                  <button
                    type="button"
                    className="onboarding-invitation__change-modules"
                    onClick={() => history.push("/onboarding/modules")}
                  >
                    Change
                  </button>
                )}
              </div>
              {moduleLabels.length ? (
                <div className="onboarding-invitation__chips">
                  {moduleLabels.map((label) => (
                    <span key={label} className="onboarding-invitation__chip">
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="onboarding-invitation__cell-value" />
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="onboarding-invitation__footer">
          <Button
            label={
              submitting ? (
                "Redirecting…"
              ) : isLoggedIn ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Continue to payment
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              ) : (
                "Create account to continue"
              )
            }
            onClick={handleContinue}
            loading={submitting}
            className="login-page__form-button-full"
          />
          {!isLoggedIn ? (
            <p className="onboarding-invitation__login-hint">
              Already registered? <a href="/login">Log in</a> to continue.
            </p>
          ) : (
            <p className="onboarding-invitation__login-hint">
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: "middle", opacity: 0.9 }}
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span>
                  Plan is fixed by your invite. Modules can still be changed
                  above.
                </span>
              </span>
            </p>
          )}
        </div>
      </div>

      {confirmDialogOpen && selectedPlan ? (
        <ConfirmChangeDialog
          preview={null}
          selectedPlan={selectedPlan}
          recurringTotalCents={recurringTotalCents}
          billingInterval="monthly"
          currency={currency}
          quote={checkoutQuote}
          isAdjustment={false}
          isModuleOnlyChange={false}
          couponCode={couponCode}
          onCouponCodeChange={(value) => {
            setCouponCode(value);
            setCouponError("");
          }}
          appliedCoupon={appliedCoupon}
          couponError={couponError}
          couponApplying={couponApplying}
          onApplyCoupon={handleApplyCoupon}
          onClearCoupon={handleClearCoupon}
          checkoutStarted={checkoutStarted}
          onConfirm={handleConfirmedCheckout}
          onCancel={() => {
            if (checkoutStarted) return;
            setConfirmDialogOpen(false);
          }}
        />
      ) : null}
    </OnboardingShell>
  );
};

export default InvitationLanding;
