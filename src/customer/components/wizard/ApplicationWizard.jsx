import React from "react";

import { CustomerBrandingProvider } from "../../branding";
import PortalLayout from "../../layouts/PortalLayout";
import StepChevrons from "../ui/StepChevrons";
import Button from "../ui/Button";
import { ArrowLeftIcon } from "../ui/icons";

/**
 * Shell for a multi-step application form.
 *
 * Both application types — 5-step inspection, 7-step certification — render
 * through this: it owns the header, the chevron stepper, the card the step
 * renders into and the Back / Save Draft / Continue footer. A step component
 * only supplies its fields, so adding a service type is a config entry plus the
 * step bodies, never another wizard.
 */
export default function ApplicationWizard({
  title,
  subtitle,
  steps,
  current,
  reference,
  statusLabel = "Draft",
  onStepClick,
  onBack,
  onExit,
  onSaveDraft,
  onContinue,
  continueLabel,
  continueDisabled = false,
  submitting = false,
  /** "portal" wraps PortalLayout; "admin" renders bare for admin chrome */
  variant = "portal",
  children,
}) {
  const isLast = current === steps.length - 1;

  const body = (
    <>
      <header className="epc-detailhead epc-detailhead--wizard">
        <div className="epc-detailhead__main">
          <button
            type="button"
            className="epc-iconbtn epc-iconbtn--plain"
            aria-label="Back to applications"
            onClick={onExit}
          >
            <ArrowLeftIcon size={18} />
          </button>
          <div>
            <h1 className="epc-detailhead__title">{title}</h1>
            {subtitle && <p className="epc-detailhead__subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="epc-detailhead__side">
          <span className="epc-chip epc-chip--status">{statusLabel}</span>
          {reference && <p className="epc-detailhead__meta">{reference}</p>}
        </div>
      </header>

      <StepChevrons steps={steps} current={current} onStepClick={onStepClick} />

      <section className="epc-card-panel epc-wizard__body">{children}</section>

      <footer className="epc-card-panel epc-wizard__foot">
        <Button variant="secondary" onClick={onBack} disabled={current === 0}>
          Back
        </Button>
        <div className="epc-wizard__foot-right">
          <Button variant="secondary" onClick={onSaveDraft}>
            Save Draft
          </Button>
          <Button
            onClick={onContinue}
            loading={submitting}
            disabled={continueDisabled}
          >
            {continueLabel || (isLast ? "Submit Application" : "Continue")}
          </Button>
        </div>
      </footer>
    </>
  );

  if (variant === "admin") {
    return (
      <CustomerBrandingProvider className="epc-admin-wizard-root">
        <div className="epc-admin-wizard">{body}</div>
      </CustomerBrandingProvider>
    );
  }

  return (
    <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "Applications" }]}>
      {body}
    </PortalLayout>
  );
}

/** Section title + hint that opens each step's card. */
export function StepHeading({ title, subtitle }) {
  return (
    <header className="epc-stepheading">
      <h2 className="epc-stepheading__title">{title}</h2>
      {subtitle && <p className="epc-stepheading__subtitle">{subtitle}</p>}
    </header>
  );
}

/** Tinted explanatory panel used at the foot of several steps. */
export function StepNote({ title, children }) {
  return (
    <div className="epc-stepnote">
      {title && <p className="epc-stepnote__title">{title}</p>}
      <p className="epc-stepnote__body">{children}</p>
    </div>
  );
}
