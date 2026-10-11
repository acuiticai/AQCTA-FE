import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import { AdminContext } from "@/context/AdminContext";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import { Loader } from "@/page-layouts/index";
import { OnboardingShell } from "./OnboardingLayout";
import { isSubscriptionAdjustment } from "@/utils/subscriptionAdjustment";
import { ModuleIcon } from "@/utils/moduleIcon";
import PlanPickerModal from "./PlanPickerModal";
import LogoutConfirmationDialog from "@/components/LogoutConfirmationDialog";
import { logoutUser } from "@/utils/generic";
import {
  cleanupNotifications,
  removeFCMToken,
} from "@/utils/initializeNotifications";
import { syncAdminInfoRoleFromServer } from "@/utils/sessionApiCache";

const getModuleSubIds = (mod) =>
  (mod?.subModules || []).map((sub) => String(sub.id));

const ModuleSelection = () => {
  const history = useHistory();
  const location = useLocation();
  const { state, dispatch } = useContext(AdminContext);
  const [modules, setModules] = useState([]);
  const [selected, setSelected] = useState([]);
  const [selectedSubModules, setSelectedSubModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [invitationReady, setInvitationReady] = useState(false);
  const planAutoOpenRef = useRef(false);

  const isAdjustment = isSubscriptionAdjustment(location);
  const isResubscribe =
    !isAdjustment &&
    state.adminInfo?.subscription?.subscriptionStatus === "Cancelled";
  const hasInvitationPlan =
    invitationReady ||
    Boolean(state.adminInfo?.subscription?.invitation?.hasPlan);

  useEffect(() => {
    if (!state?.adminInfo?.token) {
      history.replace("/login");
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const statusRes = await RegistrationServices.getSubscriptionStatus();
        if (cancelled) return;

        const freshSub = statusRes?.subscription;
        if (
          freshSub?.subscriptionStatus === "Active" &&
          !isAdjustment &&
          !isResubscribe
        ) {
          const withRole = await syncAdminInfoRoleFromServer(state.adminInfo);
          const updatedAdminInfo = {
            ...withRole,
            subscription: {
              ...(withRole.subscription || {}),
              ...freshSub,
              subscriptionStatus: "Active",
              onboardingCompleted: true,
            },
          };
          localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
          dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
          history.replace("/home");
          return;
        }

        const sub = freshSub || state.adminInfo?.subscription;
        if (sub?.subscriptionStatus === "Active" && !isAdjustment) {
          notifyError(
            "You already have an active subscription. Use Billing → Adjust plan to make changes.",
          );
          history.replace("/billing");
          return;
        }

        if (!isAdjustment && sub?.invitation?.hasPlan) {
          setInvitationReady(true);
        }

        if (freshSub) {
          const updatedAdminInfo = {
            ...state.adminInfo,
            subscription: {
              ...(state.adminInfo?.subscription || {}),
              ...freshSub,
            },
          };
          localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
          dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });
        }

        // Stay on module selection so invitees can pick (or change) modules
        // like self-service. After Continue, invitation users go to checkout.
        const res = await RegistrationServices.getModules();
        if (cancelled) return;

        const catalog = res.modules || [];
        setModules(catalog);

        let preselected =
          freshSub?.selectedModules ||
          state.adminInfo?.subscription?.selectedModules ||
          [];
        let preselectedSubs =
          freshSub?.selectedSubModules ||
          state.adminInfo?.subscription?.selectedSubModules ||
          [];

        // Admin may have suggested modules on the invitation — use as defaults
        // when the customer has not selected anything yet.
        if (!isAdjustment && !preselected.length) {
          const inviteModules = sub?.invitation?.modules || [];
          const inviteSubs = sub?.invitation?.subModules || [];
          if (inviteModules.length) {
            preselected = inviteModules;
            preselectedSubs = inviteSubs;
          }
        }

        if (isAdjustment) {
          if (!preselected.length) {
            preselected =
              freshSub?.subscribedModules ||
              state.adminInfo?.subscription?.subscribedModules ||
              [];
            preselectedSubs =
              freshSub?.subscribedSubModules ||
              state.adminInfo?.subscription?.subscribedSubModules ||
              [];
          } else if (!preselectedSubs.length) {
            preselectedSubs =
              state.adminInfo?.subscription?.subscribedSubModules || [];
          }
        }

        if (preselected.length) setSelected(preselected);
        if (preselectedSubs.length) {
          setSelectedSubModules(preselectedSubs.map(String));
        } else if (preselected.length) {
          const autoSubs = catalog
            .filter((mod) => preselected.includes(mod.key))
            .flatMap(getModuleSubIds);
          setSelectedSubModules(autoSubs);
        }
      } catch (err) {
        if (!cancelled) {
          notifyError(
            err?.response?.data?.message || "Failed to load modules.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [state?.adminInfo?.token, history, dispatch, isAdjustment]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("plan") !== "1") {
      planAutoOpenRef.current = false;
      return;
    }
    // Assigned invitation plan never auto-opens the self-service plan picker.
    if (!isAdjustment && state.adminInfo?.subscription?.invitation?.hasPlan) {
      return;
    }
    if (loading || selected.length === 0 || planAutoOpenRef.current) return;

    planAutoOpenRef.current = true;
    let cancelled = false;

    const persistAndOpenPlan = async () => {
      try {
        const result = await RegistrationServices.selectModules(selected, {
          adjustment: isAdjustment,
          subModules: selectedSubModules,
        });
        if (cancelled) return;

        const savedModules = result.selectedModules || selected;
        const savedSubModules = result.selectedSubModules || selectedSubModules;
        const updatedAdminInfo = {
          ...state.adminInfo,
          subscription: {
            ...(state.adminInfo?.subscription || {}),
            selectedModules: savedModules,
            selectedSubModules: savedSubModules,
            ...(isAdjustment
              ? {}
              : { selectedPlanId: null, billingInterval: null }),
          },
        };
        localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
        dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });

        if (
          !isAdjustment &&
          result.onboarding?.invitationToken &&
          (result.onboarding.hasInvitation ||
            result.onboarding.registrationMode === "invitation")
        ) {
          history.push(
            `/onboarding/invitation/${result.onboarding.invitationToken}`,
          );
          return;
        }

        setPlanModalOpen(true);
      } catch (err) {
        planAutoOpenRef.current = false;
        if (!cancelled) {
          notifyError(
            err?.response?.data?.message ||
              "Save module selection before viewing pricing.",
          );
        }
      }
    };

    persistAndOpenPlan();
    return () => {
      cancelled = true;
    };
  }, [
    loading,
    selected.length,
    selectedSubModules,
    location.search,
    isAdjustment,
    state.adminInfo,
    dispatch,
    selected,
    history,
  ]);

  const toggleModule = (key) => {
    const mod = modules.find((m) => m.key === key);
    const subIds = getModuleSubIds(mod);

    setSelected((prev) => {
      const isSelected = prev.includes(key);
      if (isSelected) {
        setSelectedSubModules((prevSubs) =>
          prevSubs.filter((id) => !subIds.includes(id)),
        );
        return prev.filter((k) => k !== key);
      }

      setSelectedSubModules((prevSubs) => [
        ...new Set([...prevSubs, ...subIds]),
      ]);
      return [...prev, key];
    });
  };

  const toggleSubModule = (moduleKey, subId) => {
    const id = String(subId);
    setSelectedSubModules((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];

      const mod = modules.find((m) => m.key === moduleKey);
      const modSubIds = getModuleSubIds(mod);
      const hasAny = modSubIds.some((subModuleId) =>
        next.includes(subModuleId),
      );

      setSelected((prevModules) => {
        const moduleSelected = prevModules.includes(moduleKey);
        if (hasAny && !moduleSelected) {
          return [...prevModules, moduleKey];
        }
        if (!hasAny && moduleSelected) {
          return prevModules.filter((k) => k !== moduleKey);
        }
        return prevModules;
      });

      return next;
    });
  };

  const validateSelection = () => {
    if (!selected.length) {
      notifyError("Select at least one module.");
      return false;
    }

    for (const mod of modules) {
      if (!selected.includes(mod.key)) continue;
      const subs = getModuleSubIds(mod);
      if (!subs.length) continue;
      const hasSelected = subs.some((id) => selectedSubModules.includes(id));
      if (!hasSelected) {
        notifyError(`Select at least one screen for ${mod.name}.`);
        return false;
      }
    }

    return true;
  };

  const handleLogoutClick = () => setLogoutDialogOpen(true);
  const handleLogoutCancel = () => setLogoutDialogOpen(false);
  const handleLogoutConfirm = async () => {
    try {
      if (state.adminInfo?.id) {
        await removeFCMToken(state.adminInfo.id, "web");
      }
    } catch (error) {
      console.warn("Failed to remove FCM token during logout:", error);
    }
    dispatch({ type: "USER_LOGOUT" });
    logoutUser();
    cleanupNotifications();
    setLogoutDialogOpen(false);
    history.replace("/login");
  };

  const continueButtonClass = isAdjustment
    ? "onboarding-module-actions__continue"
    : "onboarding-primary-btn onboarding-primary-btn--wide";

  const logoutButton = (
    <Button
      label="Logout"
      onClick={handleLogoutClick}
      secondary
      startIcon={<LogoutIcon sx={{ fontSize: "18px" }} />}
      className={`onboarding-module-actions__logout ${continueButtonClass}`}
    />
  );

  const handleContinue = async () => {
    if (!validateSelection()) return;

    setSubmitting(true);
    try {
      const result = await RegistrationServices.selectModules(selected, {
        adjustment: isAdjustment,
        subModules: selectedSubModules,
      });
      const savedModules = result.selectedModules || selected;
      const savedSubModules = result.selectedSubModules || selectedSubModules;
      const updatedAdminInfo = {
        ...state.adminInfo,
        subscription: {
          ...(state.adminInfo?.subscription || {}),
          selectedModules: savedModules,
          selectedSubModules: savedSubModules,
          ...(isAdjustment
            ? {}
            : { selectedPlanId: null, billingInterval: null }),
        },
      };
      localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));
      dispatch({ type: "UPDATE_ADMIN_INFO", payload: updatedAdminInfo });

      // Invitation with assigned plan: skip self-service pricing and open the
      // read-only invitation checkout. Otherwise continue with PlanPicker.
      if (
        !isAdjustment &&
        result.onboarding?.invitationToken &&
        (result.onboarding.hasInvitation ||
          result.onboarding.registrationMode === "invitation")
      ) {
        history.push(
          `/onboarding/invitation/${result.onboarding.invitationToken}`,
        );
        return;
      }

      setPlanModalOpen(true);
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save module selection.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const grid = (
    <>
      <div className="onboarding-module-grid">
        {modules.map((mod) => {
          const isSelected = selected.includes(mod.key);
          const isCurrent =
            isAdjustment &&
            (state.adminInfo?.subscription?.subscribedModules || []).includes(
              mod.key,
            );
          const subModules = mod.subModules || [];
          const selectedSubCount = subModules.filter((sub) =>
            selectedSubModules.includes(String(sub.id)),
          ).length;

          return (
            <div
              key={mod.key}
              className={`onboarding-module-card-wrap${
                isSelected ? " onboarding-module-card-wrap--selected" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => toggleModule(mod.key)}
                className={`onboarding-module-card${
                  isSelected ? " onboarding-module-card--selected" : ""
                }`}
              >
                <div className="onboarding-module-card__icon">
                  <ModuleIcon icon={mod.icon} moduleKey={mod.key} size={22} />
                </div>
                <div className="onboarding-module-card__name">{mod.name}</div>
                <div className="onboarding-module-card__desc">
                  {mod.description}
                </div>
                {isCurrent && (
                  <div className="onboarding-module-card__check">Current</div>
                )}
                {isSelected && !isCurrent && (
                  <div className="onboarding-module-card__check">Selected</div>
                )}
                {isSelected && isCurrent && (
                  <div className="onboarding-module-card__check">Selected</div>
                )}
              </button>

              {isSelected && subModules.length > 0 && (
                <div className="onboarding-submodule-list">
                  <div className="onboarding-submodule-list__title">
                    Active screens ({selectedSubCount}/{subModules.length})
                  </div>
                  {subModules.map((sub) => {
                    const subId = String(sub.id);
                    const subSelected = selectedSubModules.includes(subId);
                    return (
                      <label
                        key={subId}
                        className={`onboarding-submodule-item${
                          subSelected
                            ? " onboarding-submodule-item--selected"
                            : ""
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={subSelected}
                          onChange={() => toggleSubModule(mod.key, subId)}
                        />
                        <span>{sub.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="onboarding-actions onboarding-actions--center onboarding-actions--compact">
        <div className="onboarding-actions__continue-stack">
          <Button
            label={
              !isAdjustment && hasInvitationPlan
                ? "Continue to Pricing"
                : "Continue to Pricing"
            }
            onClick={handleContinue}
            loading={submitting}
            disabled={!selected.length}
            className={
              isAdjustment
                ? "onboarding-primary-btn onboarding-module-actions__continue"
                : continueButtonClass
            }
          />
          {isAdjustment ? (
            <Button
              label="Back to billing"
              onClick={() => history.push("/billing")}
              secondary
              className="onboarding-module-actions__back-stacked"
            />
          ) : null}
          {!isAdjustment ? logoutButton : null}
        </div>
      </div>
    </>
  );

  if (loading) {
    return (
      <>
        <OnboardingShell
          currentStep={4}
          totalSteps={5}
          narrow={false}
          fullWidth
          title={isAdjustment ? "Adjust your modules" : "Loading modules"}
          subtitle={
            isAdjustment
              ? "Add or remove ERP modules for your active subscription."
              : "Preparing your subscription options…"
          }
        >
          <div className="onboarding-loading" style={{ minHeight: 160 }}>
            <Loader color="var(--p-blue)" />
          </div>
          {!isAdjustment ? (
            <div className="onboarding-actions onboarding-actions--center onboarding-actions--compact">
              <div className="onboarding-actions__continue-stack">
                {logoutButton}
              </div>
            </div>
          ) : null}
        </OnboardingShell>
        <LogoutConfirmationDialog
          open={logoutDialogOpen}
          onClose={handleLogoutCancel}
          onConfirm={handleLogoutConfirm}
        />
      </>
    );
  }

  return (
    <>
      <OnboardingShell
        currentStep={4}
        totalSteps={5}
        narrow={false}
        fullWidth
        title={isAdjustment ? "Adjust your modules" : "Select your modules"}
        subtitle={
          isAdjustment
            ? "Choose modules and screens for your subscription. Only Customers (Sales) and Vendors (Purchase) are included automatically."
            : isResubscribe
              ? "Your subscription was cancelled. Select modules to subscribe again."
              : hasInvitationPlan
                ? "Choose the modules for your subscription, then continue to your assigned invitation plan. Suggested modules from your invite are pre-selected when available."
                : "Choose modules and screens for your subscription. Only Customers (Sales) and Vendors (Purchase) are included automatically."
        }
      >
        {grid}
        <PlanPickerModal
          open={planModalOpen}
          isAdjustment={isAdjustment}
          onClose={() => setPlanModalOpen(false)}
        />
      </OnboardingShell>
      <LogoutConfirmationDialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
};

export default ModuleSelection;
