import React, { useEffect, useState } from "react";
import { FiCheck, FiCopy, FiMail, FiUserPlus } from "react-icons/fi";
import { Button, Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import OnboardingInvitationServices from "@/services/OnboardingInvitationServices";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatSubscriptionCents } from "@/utils/subscriptionCurrency";
import "./subscriptionPlans.css";

/**
 * Create + assign plan/modules + generate invitation link from a specific invitation plan.
 * Email is optional (off by default).
 */
const InviteFromPlanModal = ({ isOpen, onClose, plan, onCreated }) => {
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendEmailToo, setSendEmailToo] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [modulesCatalog, setModulesCatalog] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setEmail("");
    setNotes("");
    setSendEmailToo(false);
    setSelectedModules([]);
    setResult(null);
    setCopied(false);
    setSubmitting(false);

    (async () => {
      try {
        const modulesRes = await RegistrationServices.getModules();
        setModulesCatalog(modulesRes.modules || []);
      } catch (_err) {
        setModulesCatalog([]);
      }
    })();
  }, [isOpen, plan]);

  const planId = String(plan?.id || plan?.code || plan?._id || "");
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

  const toggleModule = (key) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const handleCopyLink = async () => {
    if (!result?.invitationUrl) return;
    try {
      await navigator.clipboard.writeText(result.invitationUrl);
      setCopied(true);
      notifySuccess("Invitation link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      notifyError("Could not copy link.");
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      notifyError("Customer email is required.");
      return;
    }
    if (!planId) {
      notifyError("Plan is missing.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await OnboardingInvitationServices.create({
        email: email.trim(),
        notes: notes.trim(),
      });
      const invitationId = String(
        created?.invitation?.id ||
          created?.invitation?._id ||
          created?.id ||
          created?._id ||
          "",
      );
      if (!invitationId) {
        throw new Error("Invitation was created but no id was returned.");
      }

      await OnboardingInvitationServices.assignPlan(invitationId, {
        planId,
        billingInterval: "monthly",
        userCount: null,
        modules: selectedModules,
      });

      const linkRes = await OnboardingInvitationServices.generateLink(
        invitationId,
      );
      const invitationUrl =
        linkRes?.invitation?.invitationUrl || linkRes?.invitationUrl || "";

      let emailed = false;
      if (sendEmailToo && invitationUrl) {
        try {
          await OnboardingInvitationServices.sendEmail(invitationId);
          emailed = true;
        } catch (_emailErr) {
          notifyError(
            "Invitation created, but email failed to send. You can copy the link instead.",
          );
        }
      }

      setResult({
        invitationId,
        email: email.trim(),
        invitationUrl,
        emailed,
        moduleCount: selectedModules.length,
      });
      notifySuccess(
        emailed
          ? "Invitation created and email sent."
          : "Invitation created. You can edit modules, then send email when ready.",
      );
      onCreated?.({ invitationId, plan });
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen && Boolean(plan)} onClose={onClose}>
      {plan ? (
        <div className="sp-invite-modal">
          <ModalBody className="sp-invite-modal__body px-2 pt-6 pb-4">
            {result ? (
              <div className="sp-invite-success">
                <div
                  className={
                    result.emailed
                      ? "sp-invite-success__icon sp-invite-success__icon--mail"
                      : "sp-invite-success__icon"
                  }
                  aria-hidden
                >
                  {result.emailed ? <FiMail size={26} /> : <FiCheck size={28} />}
                </div>
                <h2 className="sp-invite-modal__title">
                  {result.emailed ? "Invitation emailed" : "Invitation created"}
                </h2>
                <p className="sp-invite-modal__plan">
                  For <strong>{plan.name}</strong>
                  {priceLabel ? ` · ${priceLabel}/mo` : ""}
                </p>

                <div className="sp-invite-success__card">
                  <span className="sp-invite-success__label">Customer</span>
                  <strong className="sp-invite-success__value">
                    {result.email}
                  </strong>
                  <span
                    className={
                      result.emailed
                        ? "sp-invite-success__chip sp-invite-success__chip--mail"
                        : "sp-invite-success__chip"
                    }
                  >
                    {result.emailed ? "Email sent" : "Not emailed yet"}
                  </span>
                </div>

                {result.invitationUrl ? (
                  <div className="sp-field">
                    <label className="sp-label" htmlFor="sp-invite-url">
                      Checkout link
                    </label>
                    <div className="sp-invite-link-row">
                      <input
                        id="sp-invite-url"
                        className="sp-input"
                        readOnly
                        value={result.invitationUrl}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        className="sp-invite-copy-btn"
                        onClick={handleCopyLink}
                      >
                        {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="sp-invite-modal__hint">
                      {result.emailed
                        ? "The customer also received this link by email."
                        : "Share this link, or send email later from the invitations page."}
                    </p>
                  </div>
                ) : (
                  <p className="sp-invite-modal__hint">
                    Invitation saved. Open plan invitations to manage the link.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="sp-invite-modal__hero">
                  <div
                    className={
                      sendEmailToo
                        ? "sp-invite-modal__hero-icon sp-invite-modal__hero-icon--mail"
                        : "sp-invite-modal__hero-icon"
                    }
                    aria-hidden
                  >
                    {sendEmailToo ? (
                      <FiMail size={18} />
                    ) : (
                      <FiUserPlus size={18} />
                    )}
                  </div>
                  <div>
                    <h2 className="sp-invite-modal__title">Invite customer</h2>
                    <p className="sp-invite-modal__plan">
                      {sendEmailToo
                        ? "Creates the invitation and emails the checkout link."
                        : "Creates the invitation without sending email."}
                    </p>
                  </div>
                </div>

                <div className="sp-invite-plan-chip">
                  <span className="sp-invite-plan-chip__name">{plan.name}</span>
                  <span className="sp-invite-plan-chip__price">
                    {priceLabel ? `${priceLabel}/mo` : "Monthly"}
                  </span>
                </div>

                <div className="sp-invite-modal__fields">
                  <div className="sp-field">
                    <label className="sp-label" htmlFor="sp-invite-email">
                      Customer email
                    </label>
                    <input
                      id="sp-invite-email"
                      type="email"
                      className="sp-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="customer@company.com"
                      autoFocus
                    />
                  </div>

                  <div className="sp-field">
                    <label className="sp-label" htmlFor="sp-invite-notes">
                      Personal note
                    </label>
                    <textarea
                      id="sp-invite-notes"
                      className="sp-input sp-invite-modal__textarea"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional note for the email"
                    />
                  </div>

                  <div className="sp-field">
                    <label className="sp-label">
                      Suggested modules
                    </label>
                    <div className="sp-invite-modules">
                      {modulesCatalog.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No modules available.
                        </p>
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
                  </div>

                  <label className="sp-invite-toggle">
                    <input
                      type="checkbox"
                      checked={sendEmailToo}
                      onChange={(e) => setSendEmailToo(e.target.checked)}
                    />
                    <span className="sp-invite-toggle__ui" aria-hidden />
                    <span className="sp-invite-toggle__copy">
                      <strong>Send email now</strong>
                      <small>
                        {sendEmailToo ? "Email with link" : "Link only"}
                      </small>
                    </span>
                  </label>
                </div>
              </>
            )}
          </ModalBody>

          <ModalFooter className="sp-invite-modal__footer px-2">
            {result ? (
              <>
                <Button
                  layout="outline"
                  onClick={onClose}
                  className="sp-invite-modal__btn"
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopyLink}
                  disabled={!result.invitationUrl}
                  className="bg-p-blue hover:bg-p-blue-dark sp-invite-modal__btn"
                >
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  layout="outline"
                  onClick={onClose}
                  disabled={submitting}
                  className="sp-invite-modal__btn"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !email.trim()}
                  className="bg-p-blue hover:bg-p-blue-dark sp-invite-modal__btn"
                >
                  {submitting
                    ? sendEmailToo
                      ? "Sending…"
                      : "Creating…"
                    : sendEmailToo
                      ? "Create & send email"
                      : "Create invitation"}
                </Button>
              </>
            )}
          </ModalFooter>
        </div>
      ) : null}
    </Modal>
  );
};

export default InviteFromPlanModal;
