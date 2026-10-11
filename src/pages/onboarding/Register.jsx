import React, { useState, useEffect } from "react";
import { Link, useHistory, useLocation, Redirect } from "react-router-dom";
import RegistrationServices from "@/services/RegistrationServices";
import OnboardingInvitationServices from "@/services/OnboardingInvitationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  getStoredInvitationToken,
  setStoredInvitationToken,
} from "@/utils/invitationToken";
import PhoneInput, {
  isValidPhoneNumber,
  getCountryCallingCode,
  parsePhoneNumber,
} from "react-phone-number-input";
import enPhoneLabels from "react-phone-number-input/locale/en.json";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import Button from "@/page-layouts/components/Button";
import LabelArea from "@/components/form/selectOption/LabelArea";
import InputArea from "@/components/form/input/InputArea";
import loginFrame from "@/assets/loginFrame.svg";
import useConfigLogo from "@/hooks/useConfigLogo";
import {
  AiOutlineMail,
  AiOutlineBank,
  AiOutlineUser,
} from "react-icons/ai";
import {
  OnboardingStepper,
  useOnboardingScroll,
} from "./OnboardingLayout";

import { BRANDING_PLACEHOLDER_LOGO } from "@/utils/brandingLogo";

const PLACEHOLDER_LOGO = BRANDING_PLACEHOLDER_LOGO;

const PHONE_COUNTRY = "MY";
const DEFAULT_PHONE_VALUE = `+${getCountryCallingCode(PHONE_COUNTRY)}`;

const getSubmitContactNo = (value) => {
  if (!value) return "";
  const parsed = parsePhoneNumber(value);
  if (!parsed?.nationalNumber) return "";
  return value.trim();
};

const Register = () => {
  const history = useHistory();
  const location = useLocation();
  useOnboardingScroll();
  const logo = useConfigLogo();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [contactNo, setContactNo] = useState(undefined);
  const [companyName, setCompanyName] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [invitationToken, setInvitationToken] = useState(null);

  useEffect(() => {
    RegistrationServices.isEnabled()
      .then((res) => setEnabled(!!res?.enabled))
      .catch(() => setEnabled(false));
  }, []);

  // Invitation-based onboarding (Scenario B): a customer opened
  // /onboarding/invitation/:token without an account yet and was sent here
  // to register first. Capture the token so it can be attached at signup and
  // carried through the rest of the wizard.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenFromQuery = params.get("invitation");
    const token = tokenFromQuery || getStoredInvitationToken();
    if (!token) return;
    setStoredInvitationToken(token);
    setInvitationToken(token);
    OnboardingInvitationServices.getByToken(token)
      .then((res) => {
        if (res?.email) setUserEmail(res.email);
        if (res?.businessName) setCompanyName(res.businessName);
      })
      .catch(() => {
        /* invalid/expired token — user can still register normally */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhoneChange = (value) => {
    setContactNo(value);
  };

  const handlePhoneFocus = () => {
    setPhoneFocused(true);
  };

  const handlePhoneBlur = () => {
    setPhoneFocused(false);
    if (!getSubmitContactNo(contactNo)) {
      setContactNo(undefined);
    }
  };

  const phoneValue = phoneFocused
    ? contactNo
    : getSubmitContactNo(contactNo)
      ? contactNo
      : DEFAULT_PHONE_VALUE;

  const onSubmit = async (e) => {
    e.preventDefault();
    const fullNameTrimmed = fullName.trim();
    const userEmailTrimmed = userEmail.trim();
    const contactTrimmed = getSubmitContactNo(contactNo);
    const companyTrimmed = companyName.trim();
    if (!fullNameTrimmed || !userEmailTrimmed || !companyTrimmed) {
      notifyError("Full name, email, and company name are required.");
      return;
    }
    if (contactTrimmed && !isValidPhoneNumber(contactTrimmed)) {
      notifyError("Please enter a valid phone number.");
      setCurrentStep(1);
      return;
    }
    setLoading(true);
    try {
      const res = await RegistrationServices.register({
        fullName: fullNameTrimmed,
        userEmail: userEmailTrimmed,
        contactNo: contactTrimmed,
        companyName: companyTrimmed,
        invitationToken: invitationToken || undefined,
      });
      notifySuccess(res.message || "Registration successful!");
      history.push(
        `/verify-email?email=${encodeURIComponent(userEmailTrimmed)}&pending=1`,
      );
    } catch (err) {
      notifyError(err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  if (enabled === false) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="login-page">
      <div className="login-page__left-column">
        <div className="login-page__left-column-wrapper">
            <img
              className="login-page__frame-image"
              src={loginFrame}
              alt="Register Frame"
            />
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
              <OnboardingStepper currentStep={1} />
              <h2 className="login-page__title">
                {currentStep === 2 ? "Company registration" : "Create your account"}
              </h2>
              <p className="login-page__subtitle">
                {currentStep === 1
                  ? "Enter your details to get started with PCI"
                  : "Set up your company details to continue"}
              </p>

              <form onSubmit={onSubmit} className="login-page__form">
                {currentStep === 1 && (
                  <>
                    <LabelArea color="#929296" label="Full Name" className="mb-2" />
                    <InputArea
                      required
                      label="Full Name"
                      name="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      icon={<AiOutlineUser size={20} color="#9CA3AF" />}
                    />

                    <LabelArea
                      color="#929296"
                      label="Email"
                      className="mb-2 mt-4"
                    />
                    <InputArea
                      required
                      label="Email"
                      name="userEmail"
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="Enter your email"
                      icon={<AiOutlineMail size={20} color="#9CA3AF" />}
                    />

                    <LabelArea
                      color="#929296"
                      label="Contact Number (Optional)"
                      className="mb-2 mt-4"
                    />
                    <PhoneInput
                      international
                      defaultCountry={PHONE_COUNTRY}
                      labels={enPhoneLabels}
                      flags={flags}
                      addInternationalOption={false}
                      value={phoneValue}
                      onChange={handlePhoneChange}
                      onFocus={handlePhoneFocus}
                      onBlur={handlePhoneBlur}
                      placeholder="Enter phone number"
                      className="registration-phone-input"
                      numberInputProps={{
                        name: "contactNo",
                        autoComplete: "tel",
                        "aria-label": "Contact number",
                      }}
                    />
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <LabelArea
                      color="#929296"
                      label="Company Name"
                      className="mb-2"
                    />
                    <InputArea
                      required
                      label="Company Name"
                      name="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter your company name"
                      icon={<AiOutlineBank size={20} color="#9CA3AF" />}
                    />
                  </>
                )}

                <div className="login-page__form-buttons">
                  {currentStep === 1 ? (
                    <Button
                      type="button"
                      disabled={
                        !fullName.trim() || !userEmail.trim() || enabled === null
                      }
                      label="Next"
                      onClick={() => setCurrentStep(2)}
                      className="login-page__form-button-full"
                    />
                  ) : (
                    <>
                      <Button
                        type="button"
                        label="Back"
                        onClick={() => setCurrentStep(1)}
                        className="login-page__form-button"
                      />
                      <Button
                        type="submit"
                        disabled={loading || enabled === null}
                        label="Continue"
                        loading={loading}
                        className="login-page__form-button"
                      />
                    </>
                  )}
                </div>
              </form>

              <p className="login-page__forgot-password">
                Already have an account?{" "}
                <Link to="/login" className="login-page__link">
                  Sign in
                </Link>
              </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
