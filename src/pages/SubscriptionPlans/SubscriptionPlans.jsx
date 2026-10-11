import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiTrash2 } from "react-icons/fi";
import { Button, Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { Loader, PageHeader, ActionButtons } from "@/page-layouts/index";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import "./subscriptionPlans.css";
import {
  formatSubscriptionCents,
  getSubscriptionCurrencyDisplayCode,
} from "@/utils/subscriptionCurrency";
import InviteFromPlanModal from "./InviteFromPlanModal";
import SpTablePagination from "./SpTablePagination";

const formatPlanPrice = (cents, currency = "myr") =>
  formatSubscriptionCents(cents, currency);

const formatUserLimit = (plan) => {
  if (plan.userLimitLabel) return plan.userLimitLabel;
  if (plan.pricingChannel === "invitation") {
    if (plan.unlimitedMaxUsers || plan.maxUsers == null) {
      return "Unlimited users";
    }
    const max = Math.max(1, Number(plan.maxUsers) || 1);
    return `Up to ${max} user${max === 1 ? "" : "s"}`;
  }
  if (plan.unlimitedMaxUsers || plan.maxUsers == null) {
    const min = Math.max(1, Number(plan.minUsers) || 1);
    return `${min}+ users`;
  }
  const min = Math.max(1, Number(plan.minUsers) || Number(plan.maxUsers) || 0);
  const max = Math.max(min, Number(plan.maxUsers) || min);
  if (!max) return "—";
  if (min === max) return `${max} user${max === 1 ? "" : "s"}`;
  return `${min} to ${max} users`;
};

const SubscriptionPlans = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDays, setTrialDays] = useState(30);
  const [trialSaving, setTrialSaving] = useState(false);
  const [invitePlan, setInvitePlan] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const [plansRes, settingsRes] = await Promise.all([
        RegistrationServices.getPricingPlans(),
        RegistrationServices.getSubscriptionSettings().catch(() => null),
      ]);
      setPlans(plansRes.plans || []);
      if (settingsRes?.settings) {
        setTrialEnabled(settingsRes.settings.trialEnabled === true);
        setTrialDays(settingsRes.settings.trialDays || 30);
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load pricing plans.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(plans.length / entriesPerPage)),
    [plans.length, entriesPerPage],
  );

  const pagedPlans = useMemo(() => {
    const start = (currentPage - 1) * entriesPerPage;
    return plans.slice(start, start + entriesPerPage);
  }, [plans, currentPage, entriesPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSaveTrialSettings = async () => {
    const days = Math.round(Number(trialDays));
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      notifyError("Trial days must be between 1 and 365.");
      return;
    }
    setTrialSaving(true);
    try {
      const res = await RegistrationServices.updateSubscriptionSettings({
        trialEnabled,
        trialDays: days,
      });
      setTrialEnabled(res.settings?.trialEnabled === true);
      setTrialDays(res.settings?.trialDays || days);
      notifySuccess(
        trialEnabled
          ? `Free trial enabled (${days} days).`
          : "Free trial disabled.",
      );
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save trial settings.",
      );
    } finally {
      setTrialSaving(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPlanToDelete(null);
  };

  const handleDelete = (plan) => {
    setPlanToDelete(plan);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!planToDelete?._id) return;
    try {
      setIsSubmitting(true);
      await RegistrationServices.deletePricingPlan(planToDelete._id);
      notifySuccess("Plan deleted.");
      setPlans((prev) => prev.filter((p) => p._id !== planToDelete._id));
      closeModal();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="sp-page">
        <div className="sp-loading">
          <Loader color="var(--p-blue)" />
        </div>
      </div>
    );
  }

  return (
    <div className="sp-page">
      <PageHeader
        variant="large"
        title="Subscription Catalog"
        description="Manage pricing plans and invite customers from invitation plans."
        renderActions={
          <div className="sp-header__actions">
            <button
              type="button"
              className="sp-btn sp-btn--ghost"
              onClick={() => history.push("/subscription-catalog/coupons")}
            >
              Coupons
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--primary"
              onClick={() => history.push("/subscription-catalog/create")}
            >
              + Create Plan
            </button>
          </div>
        }
      />

      <div className="sp-form-card sp-trial-settings">
        <div className="sp-trial-settings__top">
          <div>
            <h2 className="sp-trial-settings__title">Free trial</h2>
            <p className="sp-trial-settings__desc">
              New self-service signups get full access during the trial period.
            </p>
          </div>
          <label className="sp-checkbox sp-trial-settings__enable">
            <input
              type="checkbox"
              checked={trialEnabled}
              onChange={(e) => setTrialEnabled(e.target.checked)}
            />
            Enable
          </label>
        </div>
        <div className="sp-trial-settings__row">
          <div className="sp-field sp-trial-settings__days">
            <label className="sp-label" htmlFor="sp-trial-days">
              Trial days
            </label>
            <input
              id="sp-trial-days"
              type="number"
              className="sp-input"
              min={1}
              max={365}
              value={trialDays}
              disabled={!trialEnabled}
              onChange={(e) => setTrialDays(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="sp-btn sp-btn--primary sp-btn--sm"
            onClick={handleSaveTrialSettings}
            disabled={trialSaving}
          >
            {trialSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="sp-empty">
          <p className="sp-empty__title">No pricing plans yet</p>
          <p>Create your first plan to start offering subscriptions.</p>
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              className="sp-btn sp-btn--primary"
              onClick={() => history.push("/subscription-catalog/create")}
            >
              + Create Plan
            </button>
          </div>
        </div>
      ) : (
        <div className="sp-table-card">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Channel</th>
                <th>Type</th>
                <th>Monthly</th>
                <th>Users</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedPlans.map((plan) => {
                const isInvitation =
                  plan.pricingChannel === "invitation" && plan.active !== false;
                return (
                  <tr key={plan._id}>
                    <td>
                      <div className="sp-table__plan-name">
                        {plan.name}
                        {plan.badge ? (
                          <span className="sp-table__badge">{plan.badge}</span>
                        ) : null}
                      </div>
                      {plan.description ? (
                        <p className="sp-coupon-list-desc">{plan.description}</p>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={
                          plan.pricingChannel === "invitation"
                            ? "sp-table__badge"
                            : "sp-table__badge sp-table__badge--muted"
                        }
                      >
                        {plan.pricingChannel === "invitation"
                          ? "Invitation"
                          : "Self-service"}
                      </span>
                    </td>
                    <td>
                      {plan.pricingChannel === "invitation"
                        ? "Fixed"
                        : plan.planType === "core"
                          ? "Core"
                          : "Tier"}
                    </td>
                    <td>
                      {formatPlanPrice(plan.monthlyCents, plan.currency)}
                      {(plan.effectiveDiscountPercent ?? plan.discountPercent) >
                      0 ? (
                        <span
                          className="sp-table__badge sp-table__badge--muted"
                          style={{ marginLeft: 6 }}
                        >
                          {(plan.effectiveDiscountPercent ??
                            plan.discountPercent)}
                          % off
                        </span>
                      ) : null}
                    </td>
                    <td>{formatUserLimit(plan)}</td>
                    <td>{getSubscriptionCurrencyDisplayCode(plan.currency)}</td>
                    <td>
                      <span
                        className={
                          plan.active ? "sp-stripe-ok" : "sp-stripe-missing"
                        }
                      >
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <ActionButtons
                        items={[
                          ...(isInvitation
                            ? [
                                {
                                  action: ACTION_BUTTON_TYPES.ADD_COUNT,
                                  tooltip: "Invite customer",
                                  fillColor: "amber-600",
                                  onClick: () => setInvitePlan(plan),
                                },
                                {
                                  action: ACTION_BUTTON_TYPES.VIEW,
                                  tooltip: "View invitations",
                                  fillColor: "blue-600",
                                  onClick: () =>
                                    history.push(
                                      `/subscription-catalog/${plan._id || plan.id}/invitations`,
                                    ),
                                },
                              ]
                            : []),
                          {
                            action: ACTION_BUTTON_TYPES.EDIT,
                            tooltip: "Edit plan",
                            onClick: () =>
                              history.push(
                                `/subscription-catalog/edit/${plan._id}`,
                              ),
                          },
                          {
                            action: ACTION_BUTTON_TYPES.DELETE,
                            tooltip: "Delete plan",
                            loading:
                              isSubmitting && planToDelete?._id === plan._id,
                            onClick: () => handleDelete(plan),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <SpTablePagination
            currentPage={currentPage}
            totalRecords={plans.length}
            recordsPerPage={entriesPerPage}
            onPageChange={setCurrentPage}
            onRecordsPerPageChange={(num) => {
              setEntriesPerPage(num);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      <InviteFromPlanModal
        isOpen={Boolean(invitePlan)}
        plan={invitePlan}
        onClose={() => setInvitePlan(null)}
        onCreated={() => {
          const id = invitePlan?._id || invitePlan?.id;
          setInvitePlan(null);
          if (id) {
            history.push(`/subscription-catalog/${id}/invitations`);
          }
        }}
      />

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalBody className="text-center custom-modal px-8 pt-6 pb-4">
          <span className="flex justify-center text-3xl mb-6 text-red-500">
            <FiTrash2 />
          </span>
          <h2 className="text-xl font-medium mb-2">
            {t("DeleteModalH2")}{" "}
            <span className="text-red-500">
              {planToDelete?.name || "pricing plan"}
            </span>
            ?
          </h2>
          <p>{t("DeleteModalPtag")}</p>
        </ModalBody>
        <ModalFooter className="justify-center pb-10">
          <Button
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50"
            layout="outline"
            onClick={closeModal}
          >
            {t("modalKeepBtn")}
          </Button>
          <div className="flex justify-end">
            {isSubmitting ? (
              <Button
                disabled
                type="button"
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                <img
                  src={spinnerLoadingImage}
                  alt="Loading"
                  width={20}
                  height={10}
                />
                <span className="font-serif ml-2 font-light">
                  {t("processing")}
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleDeleteItem}
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                {t("modalDeletBtn")}
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default SubscriptionPlans;
