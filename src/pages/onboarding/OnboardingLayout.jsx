import React, { useEffect } from "react";
import useConfigLogo from "@/hooks/useConfigLogo";
import loginFrame from "@/assets/loginFrame.svg";
import "./onboarding.css";

const STEP_LABELS = ["Account", "Verify email", "Password", "Modules", "Pricing"];

import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";

const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

export function useOnboardingScroll() {
  useEffect(() => {
    document.documentElement.classList.add("onboarding-scroll");
    return () => {
      document.documentElement.classList.remove("onboarding-scroll");
    };
  }, []);
}

export function OnboardingStepper({ currentStep, totalSteps = 5 }) {
  const steps = STEP_LABELS.slice(0, totalSteps);

  return (
    <div className="onboarding-stepper" aria-label="Registration progress">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const itemClass = [
          "onboarding-stepper__item",
          isDone ? "onboarding-stepper__item--done" : "",
          isActive ? "onboarding-stepper__item--active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <React.Fragment key={label}>
            {index > 0 && (
              <div
                className={`onboarding-stepper__connector${
                  stepNum <= currentStep ? " onboarding-stepper__connector--done" : ""
                }`}
                aria-hidden
              />
            )}
            <div className={itemClass}>
              <div className="onboarding-stepper__circle">
                {isDone ? "✓" : stepNum}
              </div>
              <span className="onboarding-stepper__label">{label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function OnboardingShell({
  currentStep,
  title,
  subtitle,
  children,
  narrow = true,
  fullWidth = false,
  showStepper = true,
  totalSteps = 5,
  compact = false,
  headerAction = null,
  contentWidth = null,
  pageClassName = "",
}) {
  useOnboardingScroll();
  const logo = useConfigLogo();

  const innerClass = [
    "onboarding-page__inner",
    contentWidth === "invitation"
      ? "onboarding-page__inner--invitation"
      : narrow && !fullWidth
        ? "onboarding-page__inner--narrow"
        : "",
    fullWidth ? "onboarding-page__inner--full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[
        "onboarding-page",
        fullWidth ? "onboarding-page--full" : "",
        contentWidth === "invitation" ? "onboarding-page--invitation" : "",
        pageClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={innerClass}>
        <div
          className={[
            "onboarding-card",
            compact ? "onboarding-card--compact" : "",
            contentWidth === "invitation" ? "onboarding-card--invitation" : "",
            headerAction ? "onboarding-card--with-header-action" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {headerAction ? (
            <div className="onboarding-card__header-action">{headerAction}</div>
          ) : null}
          <img
            src={logo}
            alt="Logo"
            className="onboarding-logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = PLACEHOLDER_LOGO;
            }}
          />
          {showStepper && currentStep != null && (
            <OnboardingStepper currentStep={currentStep} totalSteps={totalSteps} />
          )}
          {title && <h1 className="onboarding-title">{title}</h1>}
          {subtitle && <p className="onboarding-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export default OnboardingShell;

export function OnboardingSplitLayout({
  currentStep,
  title,
  subtitle,
  children,
  showStepper = true,
  totalSteps = 5,
}) {
  useOnboardingScroll();
  const logo = useConfigLogo();

  return (
    <div className="login-page">
      <div className="login-page__left-column">
        <div className="login-page__left-column-wrapper">
          <img className="login-page__frame-image" src={loginFrame} alt="" />
        </div>
      </div>
      <div className="login-page__right-column">
        <div className="login-page__form-container login-page__form-container--onboarding">
          <img
            src={logo}
            alt="Logo"
            className="login-page__logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = PLACEHOLDER_LOGO;
            }}
          />
          {showStepper && currentStep != null && (
            <OnboardingStepper currentStep={currentStep} totalSteps={totalSteps} />
          )}
          {title && <h2 className="login-page__title">{title}</h2>}
          {subtitle && <p className="login-page__subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
