import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiCreditCard, FiMail, FiSlash, FiTag, FiTrash2 } from "react-icons/fi";
import { Button, Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import OnboardingInvitationServices from "@/services/OnboardingInvitationServices";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import {
  Loader,
  PageHeader,
  ActionButtons,
  DropdownBasic,
} from "@/page-layouts/index";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  formatSubscriptionCents,
  getSubscriptionCurrencyDisplayCode,
} from "@/utils/subscriptionCurrency";
import InviteFromPlanModal from "./InviteFromPlanModal";
import SpTablePagination from "./SpTablePagination";
import "./subscriptionPlans.css";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Pending", label: "Pending" },
  { value: "Ready", label: "Ready" },
  { value: "Sent", label: "Sent" },
  { value: "Paid", label: "Paid" },
  { value: "Expired", label: "Expired" },
  { value: "Inactive", label: "Inactive" },
  { value: "Cancelled", label: "Cancelled" },
];

const STATUS_BADGE_CLASS = {
  Draft: "sp-table__badge sp-table__badge--muted",
  Pending: "sp-table__badge",
  Ready: "sp-table__badge",
  Sent: "sp-table__badge",
  Paid: "sp-stripe-ok",
  Expired: "sp-stripe-missing",
  Inactive: "sp-stripe-missing",
  Cancelled: "sp-stripe-missing",
};

const ACTIVE_LINK_STATUSES = ["Draft", "Pending", "Ready", "Sent"];

/** Modules can be edited until email is sent or invitation is used/closed. */
const canEditModules = (inv) =>
  ["Draft", "Pending", "Ready"].includes(inv.status);

const isInvitationLinkUsable = (inv) =>
  ["Ready", "Sent"].includes(inv.status) &&
  !(inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now());

const isInvitationLinkBlocked = (inv) =>
  ["Inactive", "Expired", "Cancelled"].includes(inv.status) ||
  (["Ready", "Sent"].includes(inv.status) &&
    inv.expiresAt &&
    new Date(inv.expiresAt).getTime() < Date.now());

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const AssignModulesModal = ({
  isOpen,
  onClose,
  invitation,
  plan,
  modulesCatalog,
  onSaved,
}) => {
  const [selectedModules, setSelectedModules] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const planId = String(plan?.id || plan?.code || plan?._id || "");

  useEffect(() => {
    if (isOpen && invitation) {
      setSelectedModules(invitation.modules || []);
      setSubmitting(false);
    }
  }, [isOpen, invitation]);

  const toggleModule = (key) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (!invitation?.id || !planId) {
      notifyError("Plan or invitation is missing.");
      return;
    }
    if (!canEditModules(invitation)) {
      notifyError(
        "Modules cannot be edited after the email is sent or the invitation is used.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await OnboardingInvitationServices.assignPlan(invitation.id, {
        planId,
        billingInterval: "monthly",
        userCount: null,
        modules: selectedModules,
      });
      notifySuccess("Modules saved for this invitation.");
      onSaved();
      onClose();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save modules.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen && Boolean(invitation)} onClose={onClose}>
      {invitation ? (
        <>
          <ModalBody className="text-left custom-modal px-2 pt-6 pb-4">
            <h2 className="text-xl font-medium mb-1">Edit modules</h2>
            <p className="text-sm text-gray-500 mb-4">
              Update suggested modules for <strong>{invitation.email}</strong>.
              Editing is locked after the email is sent or the invitation is
              used.
            </p>

            <div className="sp-invite-modules">
              {modulesCatalog.length === 0 ? (
                <p className="text-sm text-gray-400">No modules available.</p>
              ) : (
                modulesCatalog.map((mod) => {
                  const checked = selectedModules.includes(mod.key);
                  return (
                    <label
                      key={mod.key}
                      className={
                        checked
                          ? "sp-invite-module sp-invite-module--on"
                          : "sp-invite-module"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModule(mod.key)}
                      />
                      <span>{mod.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </ModalBody>
          <ModalFooter
            className="pb-8 px-2"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Button
              layout="outline"
              onClick={onClose}
              disabled={submitting}
              style={{ width: "100%", height: 42 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-p-blue hover:bg-p-blue-dark"
              style={{ width: "100%", height: 42 }}
            >
              {submitting ? "Saving…" : "Save modules"}
            </Button>
          </ModalFooter>
        </>
      ) : null}
    </Modal>
  );
};

const PlanInvitationsPage = () => {
  const { planId: routePlanId } = useParams();
  const [planLoading, setPlanLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [modulesCatalog, setModulesCatalog] = useState([]);
  const [moduleNames, setModuleNames] = useState({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planFilterIds = useMemo(() => {
    if (!plan) return routePlanId || "";
    return [
      ...new Set([plan.id, plan.code, plan._id].filter(Boolean).map(String)),
    ].join(",");
  }, [plan, routePlanId]);

  const priceLabel = plan
    ? formatSubscriptionCents(
        Math.round(
          Number(plan.monthlyCents || 0) *
            (1 -
              Math.max(
                0,
                Number(plan.effectiveDiscountPercent ?? plan.discountPercent) ||
                  0,
              ) /
                100),
        ),
        plan.currency || "usd",
      )
    : "";

  const loadPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const res = await RegistrationServices.getPricingPlans({
        channel: "invitation",
      });
      const plans = res.plans || res.data || [];
      const match = plans.find((p) =>
        [p._id, p.id, p.code].filter(Boolean).map(String).includes(String(routePlanId)),
      );
      if (!match) {
        notifyError("Invitation plan not found.");
        setPlan(null);
        return;
      }
      setPlan(match);
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load plan.");
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }, [routePlanId]);

  const loadInvitations = useCallback(async () => {
    if (!planFilterIds) return;
    setLoading(true);
    try {
      const res = await OnboardingInvitationServices.list({
        planId: planFilterIds,
        search: submittedSearch,
        status,
        page,
        limit: entriesPerPage,
      });
      setInvitations(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load invitations.",
      );
      setInvitations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [planFilterIds, submittedSearch, status, page, entriesPerPage]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    (async () => {
      try {
        const modulesRes = await RegistrationServices.getModules();
        const mods = modulesRes.modules || [];
        setModulesCatalog(mods);
        const map = {};
        mods.forEach((m) => {
          if (m.key) map[m.key] = m.name || m.key;
        });
        setModuleNames(map);
      } catch (_err) {
        /* non-fatal */
      }
    })();
  }, []);

  useEffect(() => {
    if (plan) loadInvitations();
  }, [plan, loadInvitations]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  };

  const handleCopyLink = async (invitation) => {
    if (!invitation.invitationUrl) {
      notifyError("Generate a link first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(invitation.invitationUrl);
      notifySuccess("Invitation link copied.");
    } catch (_err) {
      notifyError("Could not copy link.");
    }
  };

  const runAction = async (invitation, actionFn, successMessage) => {
    setBusyId(invitation.id);
    try {
      await actionFn(invitation.id);
      notifySuccess(successMessage);
      loadInvitations();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction?.invitation?.id) return;
    const { type, invitation } = confirmAction;
    setIsSubmitting(true);
    try {
      if (type === "inactive") {
        await OnboardingInvitationServices.deactivate(invitation.id);
        notifySuccess("Invitation deactivated.");
      } else if (type === "delete") {
        await OnboardingInvitationServices.remove(invitation.id);
        notifySuccess("Invitation deleted.");
      }
      setConfirmAction(null);
      loadInvitations();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatModules = (mods = []) => {
    if (!mods.length) return "—";
    return mods.map((key) => moduleNames[key] || key).join(", ");
  };

  const buildRowActions = (inv) => {
    const busy = busyId === inv.id;
    const canManage = ACTIVE_LINK_STATUSES.includes(inv.status);
    const items = [];

    if (canEditModules(inv)) {
      items.push({
        action: ACTION_BUTTON_TYPES.ASSIGN,
        tooltip: "Edit modules",
        fillColor: "blue-600",
        onClick: () => setAssignTarget(inv),
      });
    }

    if (canManage) {
      items.push({
        action: ACTION_BUTTON_TYPES.GENERATE_LINK,
        tooltip: "Generate link",
        fillColor: "emerald-600",
        loading: busy,
        onClick: () =>
          runAction(
            inv,
            (id) => OnboardingInvitationServices.generateLink(id),
            "Invitation link generated.",
          ),
      });
    }

    if (inv.invitationUrl && isInvitationLinkUsable(inv)) {
      items.push({
        action: ACTION_BUTTON_TYPES.COPY_LINK,
        tooltip: "Copy link",
        fillColor: "violet-600",
        onClick: () => handleCopyLink(inv),
      });
    }

    if (inv.invitationUrl && inv.status === "Ready") {
      items.push({
        action: ACTION_BUTTON_TYPES.SEND_EMAIL,
        tooltip: "Send email",
        fillColor: "amber-600",
        loading: busy,
        onClick: () =>
          runAction(
            inv,
            (id) => OnboardingInvitationServices.sendEmail(id),
            "Invitation email sent.",
          ),
      });
    }

    if (inv.invitationUrl && inv.status === "Sent") {
      items.push({
        action: ACTION_BUTTON_TYPES.SEND_EMAIL,
        tooltip: "Resend email",
        fillColor: "amber-600",
        loading: busy,
        onClick: () =>
          runAction(
            inv,
            (id) => OnboardingInvitationServices.resend(id),
            "Invitation email resent.",
          ),
      });
    }

    if (canManage && inv.status !== "Inactive") {
      items.push({
        action: ACTION_BUTTON_TYPES.DEACTIVATE,
        tooltip: "Deactivate",
        fillColor: "orange-600",
        loading: busy,
        onClick: () => setConfirmAction({ type: "inactive", invitation: inv }),
      });
    }

    if (isInvitationLinkBlocked(inv)) {
      items.push({
        action: ACTION_BUTTON_TYPES.TOGGLE_ACTIVE,
        tooltip: "Reactivate",
        fillColor: "emerald-600",
        loading: busy,
        onClick: () =>
          runAction(
            inv,
            (id) => OnboardingInvitationServices.reactivate(id),
            "Invitation reactivated.",
          ),
      });
    }

    if (inv.status !== "Paid") {
      items.push({
        action: ACTION_BUTTON_TYPES.DELETE,
        tooltip: "Delete",
        fillColor: "red-600",
        onClick: () => setConfirmAction({ type: "delete", invitation: inv }),
      });
    }

    return items;
  };

  if (planLoading) {
    return (
      <div className="sp-plan-inv-page sp-plan-inv-page--center">
        <div className="sp-loading">
          <Loader color="var(--p-blue)" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="sp-plan-inv-page">
        <div className="sp-plan-inv-header">
          <PageHeader
            title="Plan not found"
            description="This invitation plan may have been removed."
            showBackButton
            backFallbackPath="/subscription-catalog"
          />
        </div>
        <div className="sp-empty">
          <p className="sp-empty__title">Nothing to show</p>
          <p>
            Go back to the subscription catalog and open an invitation plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-plan-inv-page">
      <div className="sp-plan-inv-header">
        <PageHeader
          title={plan.name}
          description={
            [
              "Plan invitations",
              priceLabel ? `${priceLabel}/mo` : null,
              getSubscriptionCurrencyDisplayCode(plan.currency),
            ]
              .filter(Boolean)
              .join(" · ")
          }
          showBackButton
          backFallbackPath="/subscription-catalog"
          actionsContainerClassName="flex flex-wrap gap-2 justify-end min-w-0 max-w-full"
          renderActions={
            <>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  plan.active === false
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {plan.active === false ? "Inactive" : "Active"}
              </span>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--p-blue)" }}
              >
                + Invite customer
              </button>
            </>
          }
        />
      </div>

      <div className="sp-plan-inv-body">
        <div className="sp-plan-inv-summary">
          <div className="sp-plan-inv-summary__item sp-plan-inv-summary__item--invites">
            <div className="sp-plan-inv-summary__icon" aria-hidden>
              <FiMail size={18} />
            </div>
            <div className="sp-plan-inv-summary__copy">
              <span className="sp-plan-inv-summary__label">Invitations</span>
              <strong>{loading && !invitations.length ? "…" : total}</strong>
            </div>
          </div>
          <div className="sp-plan-inv-summary__item sp-plan-inv-summary__item--channel">
            <div className="sp-plan-inv-summary__icon" aria-hidden>
              <FiTag size={18} />
            </div>
            <div className="sp-plan-inv-summary__copy">
              <span className="sp-plan-inv-summary__label">Channel</span>
              <strong>Invitation pricing</strong>
            </div>
          </div>
          <div className="sp-plan-inv-summary__item sp-plan-inv-summary__item--billing">
            <div className="sp-plan-inv-summary__icon" aria-hidden>
              <FiCreditCard size={18} />
            </div>
            <div className="sp-plan-inv-summary__copy">
              <span className="sp-plan-inv-summary__label">Billing</span>
              <strong>{priceLabel ? `${priceLabel}/mo` : "Monthly"}</strong>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="sp-form-card sp-plan-inv-filters"
        >
          <div className="sp-field" style={{ flex: "1 1 240px", minWidth: 220 }}>
            <label className="sp-label" htmlFor="plan-inv-search">
              Search
            </label>
            <input
              id="plan-inv-search"
              type="text"
              className="sp-input"
              placeholder="Email or business name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sp-field" style={{ flex: "0 1 220px", minWidth: 180 }}>
            <label className="sp-label" htmlFor="plan-inv-status">
              Status
            </label>
            <DropdownBasic
              options={STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(value) => {
                setStatus(value || "");
                setPage(1);
              }}
              placeholder="All statuses"
              width="100%"
              appearance="filterPill"
              isClearable
              sortOptions={false}
            />
          </div>
          <button type="submit" className="sp-btn sp-btn--primary sp-btn--sm">
            Search
          </button>
        </form>

        {loading && !invitations.length ? (
          <div className="sp-loading" style={{ minHeight: 160 }}>
            <Loader color="var(--p-blue)" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="sp-empty sp-plan-inv-empty">
            <p className="sp-empty__title">No invitations yet</p>
            <p>
              Invite a customer to this plan, assign modules, then send their
              checkout link when ready.
            </p>
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                className="sp-btn sp-btn--primary"
                onClick={() => setInviteOpen(true)}
              >
                + Invite customer
              </button>
            </div>
          </div>
        ) : (
          <div className="sp-table-card sp-plan-inv-table">
            <div className="sp-plan-inv-table__scroll">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Modules</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <div className="sp-table__plan-name">{inv.email}</div>
                        <p className="sp-coupon-list-desc">
                          {inv.businessName || "No business name"}
                          {inv.hasAccount ? " · Account linked" : ""}
                        </p>
                      </td>
                      <td>
                        <span className="sp-table__modules">
                          {formatModules(inv.modules)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            STATUS_BADGE_CLASS[inv.status] || "sp-table__badge"
                          }
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td>{formatDate(inv.sentAt)}</td>
                      <td>{formatDate(inv.expiresAt)}</td>
                      <td>
                        <ActionButtons
                          items={buildRowActions(inv)}
                          maxVisibleActions={6}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SpTablePagination
              currentPage={page}
              totalRecords={total}
              recordsPerPage={entriesPerPage}
              onPageChange={setPage}
              onRecordsPerPageChange={(num) => {
                setEntriesPerPage(num);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      <InviteFromPlanModal
        isOpen={inviteOpen}
        plan={plan}
        onClose={() => setInviteOpen(false)}
        onCreated={() => {
          setInviteOpen(false);
          setPage(1);
          loadInvitations();
        }}
      />

      <AssignModulesModal
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        invitation={assignTarget}
        plan={plan}
        modulesCatalog={modulesCatalog}
        onSaved={loadInvitations}
      />

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => !isSubmitting && setConfirmAction(null)}
      >
        <ModalBody className="text-center custom-modal px-8 pt-6 pb-4">
          <span
            className={`flex justify-center text-3xl mb-6 ${
              confirmAction?.type === "delete"
                ? "text-red-500"
                : "text-amber-500"
            }`}
          >
            {confirmAction?.type === "delete" ? <FiTrash2 /> : <FiSlash />}
          </span>
          <h2 className="text-xl font-medium mb-2">
            {confirmAction?.type === "delete"
              ? "Delete invitation?"
              : "Deactivate invitation?"}
          </h2>
          <p>
            {confirmAction?.type === "delete"
              ? `Permanently remove the invitation for ${confirmAction?.invitation?.email}.`
              : `Deactivate the link for ${confirmAction?.invitation?.email}?`}
          </p>
        </ModalBody>
        <ModalFooter className="justify-center pb-10">
          <Button
            layout="outline"
            onClick={() => setConfirmAction(null)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          {isSubmitting ? (
            <Button disabled className="bg-p-blue">
              <img src={spinnerLoadingImage} alt="" width={20} height={10} />
            </Button>
          ) : (
            <Button
              onClick={handleConfirmAction}
              className="bg-p-blue hover:bg-p-blue-dark"
            >
              {confirmAction?.type === "delete"
                ? "Yes, delete"
                : "Yes, deactivate"}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default PlanInvitationsPage;
