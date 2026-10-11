import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { FiTrash2, FiSlash } from "react-icons/fi";
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
import { formatSubscriptionCents } from "@/utils/subscriptionCurrency";
import "./subscriptionPlans.css";

const formatPlanOptionLabel = (plan) => {
  const name = plan.name || "Plan";
  const listCents = Number(plan.monthlyCents || 0);
  const discPct = Math.max(
    0,
    Number(plan.effectiveDiscountPercent ?? plan.discountPercent) || 0,
  );
  const discounted =
    discPct > 0
      ? Math.round(listCents * (1 - discPct / 100))
      : listCents;
  const priceLabel = formatSubscriptionCents(
    discounted,
    plan.currency || "usd",
  );
  if (discPct > 0 && discounted < listCents) {
    const duration = plan.discountDuration || "forever";
    const durationBit =
      duration === "once"
        ? "first payment"
        : duration === "repeating"
          ? `${Math.max(1, Number(plan.discountBillingCycles) || 1)} cycles`
          : "forever";
    return `${name} · ${priceLabel}/mo (${discPct}% off, ${durationBit})`;
  }
  if (listCents > 0) {
    return `${name} · ${priceLabel}/mo`;
  }
  return name;
};

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

const CreateInvitationModal = ({ isOpen, onClose, onCreated }) => {
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setNotes("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      notifyError("Email is required.");
      return;
    }
    setSubmitting(true);
    try {
      await OnboardingInvitationServices.create({
        email: email.trim(),
        notes: notes.trim(),
      });
      notifySuccess("Invitation created. Assign a plan to generate the link.");
      onCreated();
      onClose();
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to create invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBody className="text-left custom-modal px-2 pt-6 pb-4">
        <h2 className="text-xl font-medium mb-4">Create Invitation</h2>
        <label className="sp-label" htmlFor="co-create-email">
          Customer email *
        </label>
        <input
          id="co-create-email"
          type="email"
          className="sp-input w-full mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@company.com"
        />
        <label className="sp-label" htmlFor="co-create-notes">
          Note
        </label>
        <textarea
          id="co-create-notes"
          className="sp-input w-full"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional message shown on the invitation and in the email"
        />
      </ModalBody>
      <ModalFooter
        className="pb-8 px-8"
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
          {submitting ? "Creating…" : "Create Invitation"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const AssignPlanModal = ({
  isOpen,
  onClose,
  invitation,
  plans,
  modulesCatalog,
  onSaved,
}) => {
  const [planId, setPlanId] = useState("");
  const [selectedModules, setSelectedModules] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const planOptions = useMemo(
    () =>
      plans.map((plan) => ({
        value: String(plan.id || plan.code || plan._id),
        label: formatPlanOptionLabel(plan),
      })),
    [plans],
  );

  useEffect(() => {
    if (isOpen && invitation) {
      setPlanId(invitation.planId ? String(invitation.planId) : "");
      setSelectedModules(invitation.modules || []);
    }
  }, [isOpen, invitation]);

  const toggleModule = (key) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (!planId) {
      notifyError("Select a pricing plan.");
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
      notifySuccess("Plan assigned. You can now generate the invitation link.");
      onSaved();
      onClose();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to assign plan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen && Boolean(invitation)} onClose={onClose}>
      {invitation && (
        <>
          <ModalBody className="text-left custom-modal px-2 pt-6 pb-4">
            <h2 className="text-xl font-medium mb-4">Assign Plan</h2>

            {/* Business & Email info card */}
            <div
              style={{
                display: "flex",
                gap: 24,
                padding: "12px 16px",
                background: "#f8fafc",
                borderRadius: 10,
                border: "1px solid #f1f5f9",
                marginBottom: 20,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#9ca3af",
                  }}
                >
                  Email
                </span>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    wordBreak: "break-word",
                  }}
                >
                  {invitation.email}
                </p>
              </div>
              {invitation.businessName && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#9ca3af",
                    }}
                  >
                    Business
                  </span>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                    }}
                  >
                    {invitation.businessName}
                  </p>
                </div>
              )}
            </div>

            {/* Pricing plan */}
            <div style={{ marginBottom: 18 }}>
              <label
                className="sp-label"
                htmlFor="co-assign-plan"
                style={{ marginBottom: 6, display: "block" }}
              >
                Pricing plan *
              </label>
              <DropdownBasic
                options={planOptions}
                value={planId}
                onChange={(value) => setPlanId(value || "")}
                placeholder="Select a plan…"
                width="100%"
                isClearable={false}
                sortOptions={false}
              />
              {plans.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  No invitation pricing plans yet. Create a plan with channel
                  &quot;Invitation pricing&quot; on the Plans tab.
                </p>
              )}
            </div>

            {/* Billing cycle */}
            <div style={{ marginBottom: 18 }}>
              <span
                className="sp-label"
                style={{ display: "block", marginBottom: 6 }}
              >
                Billing cycle
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #f1f5f9",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#92400e",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                  }}
                >
                  Monthly
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Invitation plans are billed monthly only.
                </span>
              </div>
            </div>

            {/* Suggested modules */}
            <div>
              <label
                className="sp-label mb-2"
                style={{ display: "block", marginBottom: 6 }}
              >
                Suggested modules (optional)
              </label>
              {/* <p className="sp-coupon-list-desc mb-3">
            Pre-selected for the customer on module selection. They can still
            change these before checkout.
          </p> */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                  maxHeight: 220,
                  overflowY: "auto",
                  padding: 4,
                }}
              >
                {modulesCatalog.length === 0 ? (
                  <p className="text-sm text-gray-400">No modules available.</p>
                ) : (
                  modulesCatalog.map((mod) => {
                    const checked = selectedModules.includes(mod.key);
                    return (
                      <label
                        key={mod.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: checked
                            ? "1px solid #0C2E5A"
                            : "1px solid #e5e7eb",
                          background: checked ? "#fff8f0" : "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: checked ? "#0f172a" : "#334155",
                          cursor: "pointer",
                          transition:
                            "border-color 0.15s ease, background 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(mod.key)}
                          style={{ accentColor: "#0C2E5A" }}
                        />
                        <span>{mod.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter
            className="pb-8 px-8"
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
              {submitting ? "Saving…" : "Save Plan"}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
};

const SubscriptionInvitations = ({ embedded = false, onCreatePlan } = {}) => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [plans, setPlans] = useState([]);
  const [modulesCatalog, setModulesCatalog] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const limit = 20;

  const planNameById = useMemo(() => {
    const map = {};
    plans.forEach((p) => {
      const key = p.id || p.code || p._id;
      if (key) map[String(key)] = p.name;
      if (p._id) map[String(p._id)] = p.name;
    });
    return map;
  }, [plans]);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const res = await OnboardingInvitationServices.list({
        search,
        status,
        page,
        limit,
      });
      setInvitations(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load invitations.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  useEffect(() => {
    (async () => {
      try {
        const [plansRes, modulesRes] = await Promise.all([
          RegistrationServices.getPricingPlans({ channel: "invitation" }),
          RegistrationServices.getModules(),
        ]);
        setPlans(
          (plansRes.plans || plansRes.data || []).filter(
            (plan) => plan.active !== false,
          ),
        );
        setModulesCatalog(modulesRes.modules || []);
      } catch (_err) {
        /* non-fatal */
      }
    })();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadInvitations();
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
      notifyError("Could not copy link. Copy it manually.");
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

  const closeConfirm = () => {
    if (isSubmitting) return;
    setConfirmAction(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction?.invitation?.id) return;
    const { type, invitation } = confirmAction;
    setIsSubmitting(true);
    try {
      if (type === "inactive") {
        await OnboardingInvitationServices.deactivate(invitation.id);
        notifySuccess("Invitation link deactivated.");
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total],
  );

  const buildRowActions = (inv) => {
    const busy = busyId === inv.id;
    const canManage = ACTIVE_LINK_STATUSES.includes(inv.status);
    const items = [];

    if (canManage) {
      items.push({
        action: ACTION_BUTTON_TYPES.ASSIGN,
        tooltip: "Assign plan",
        fillColor: "blue-600",
        onClick: () => setAssignTarget(inv),
      });
    }

    if (inv.planId && canManage) {
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

    if (
      inv.invitationUrl &&
      isInvitationLinkUsable(inv)
    ) {
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
        tooltip: "Make inactive",
        fillColor: "orange-600",
        loading: busy,
        onClick: () => setConfirmAction({ type: "inactive", invitation: inv }),
      });
    }

    if (isInvitationLinkBlocked(inv)) {
      items.push({
        action: ACTION_BUTTON_TYPES.TOGGLE_ACTIVE,
        tooltip: "Activate link",
        fillColor: "emerald-600",
        loading: busy,
        onClick: () =>
          runAction(
            inv,
            (id) => OnboardingInvitationServices.reactivate(id),
            "Invitation link activated.",
          ),
      });
    }

    if (inv.status !== "Paid") {
      items.push({
        action: ACTION_BUTTON_TYPES.DELETE,
        tooltip: "Delete invitation",
        fillColor: "red-600",
        loading: busy && confirmAction?.invitation?.id === inv.id,
        onClick: () => setConfirmAction({ type: "delete", invitation: inv }),
      });
    }

    return items;
  };

  return (
    <div className={embedded ? "sp-catalog-panel" : "sp-page"}>
      {loading && !invitations.length ? (
        <div className="sp-loading">
          <Loader color="var(--p-blue)" />
        </div>
      ) : (
        <div className="sp-catalog-content">
          {!embedded ? (
            <PageHeader
              variant="large"
              title="Invitations"
              description="Review pending registrations, assign pricing plans, and manage invitation links."
              renderActions={
                <div className="sp-header__actions">
                  <button
                    type="button"
                    className="sp-btn sp-btn--ghost"
                    onClick={() => history.push("/subscription-catalog")}
                  >
                    Subscription Catalog
                  </button>
                  <button
                    type="button"
                    className="sp-btn sp-btn--primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    + Create Invitation
                  </button>
                </div>
              }
            />
          ) : (
            <div className="sp-panel-toolbar">
              <div>
                <h2 className="sp-panel-toolbar__title">Invitations</h2>
                <p className="sp-panel-toolbar__desc">
                  Assign invitation plans and modules, then send checkout links.
                  {plans.length === 0 ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="sp-text-link"
                        onClick={() =>
                          onCreatePlan
                            ? onCreatePlan()
                            : history.push("/subscription-catalog/create")
                        }
                      >
                        Create an invitation plan
                      </button>{" "}
                      first if you have none yet.
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className="sp-btn sp-btn--primary"
                onClick={() => setCreateOpen(true)}
              >
                + Create Invitation
              </button>
            </div>
          )}

          <form
            onSubmit={handleSearchSubmit}
            className="sp-form-card"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
              padding: "16px 18px",
            }}
          >
            <div
              className="sp-field"
              style={{ flex: "1 1 240px", minWidth: 220 }}
            >
              <label className="sp-label" htmlFor="co-search">
                Search
              </label>
              <input
                id="co-search"
                type="text"
                className="sp-input"
                placeholder="Email or business name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div
              className="sp-field"
              style={{ flex: "0 1 220px", minWidth: 180 }}
            >
              <label className="sp-label" htmlFor="co-status">
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

          {invitations.length === 0 ? (
            <div className="sp-empty">
              <p className="sp-empty__title">No invitations found</p>
              <p>
                Create an invitation for a customer email, or wait for pending
                self-registrations to appear here.
              </p>
              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="sp-btn sp-btn--primary"
                  onClick={() => setCreateOpen(true)}
                >
                  + Create Invitation
                </button>
              </div>
            </div>
          ) : (
            <div className="sp-table-card">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Plan</th>
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
                        {inv.planId ? (
                          <div>
                            <div className="sp-table__plan-name">
                              {planNameById[String(inv.planId)] || inv.planId}
                            </div>
                            <span className="sp-table__badge sp-table__badge--muted">
                              Monthly
                            </span>
                          </div>
                        ) : (
                          <span className="sp-table__badge sp-table__badge--muted">
                            Not assigned
                          </span>
                        )}
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

              {totalPages > 1 ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    padding: 16,
                  }}
                >
                  <button
                    type="button"
                    className="sp-btn sp-btn--ghost sp-btn--sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span style={{ alignSelf: "center", fontSize: 13 }}>
                    Page {page} of {totalPages} · {total} total
                  </span>
                  <button
                    type="button"
                    className="sp-btn sp-btn--ghost sp-btn--sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <CreateInvitationModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadInvitations}
      />
      <AssignPlanModal
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        invitation={assignTarget}
        plans={plans}
        modulesCatalog={modulesCatalog}
        onSaved={loadInvitations}
      />

      <Modal isOpen={Boolean(confirmAction)} onClose={closeConfirm}>
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
              : "Make invitation inactive?"}
          </h2>
          <p>
            {confirmAction?.type === "delete" ? (
              <>
                This permanently removes the invitation for{" "}
                <span className="text-red-500">
                  {confirmAction?.invitation?.email}
                </span>
                . The subscription link will stop working.
              </>
            ) : (
              <>
                Deactivate the link for{" "}
                <strong>{confirmAction?.invitation?.email}</strong>? The
                customer will no longer be able to open or pay with this link.
              </>
            )}
          </p>
        </ModalBody>
        <ModalFooter className="justify-center pb-10">
          <Button
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50"
            layout="outline"
            onClick={closeConfirm}
            disabled={isSubmitting}
          >
            Cancel
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
                <span className="font-serif ml-2 font-light">Processing…</span>
              </Button>
            ) : (
              <Button
                onClick={handleConfirmAction}
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                {confirmAction?.type === "delete"
                  ? "Yes, delete"
                  : "Yes, deactivate"}
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default SubscriptionInvitations;
