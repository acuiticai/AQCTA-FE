import React, { useContext, useState, useEffect } from "react";
import { Link, useHistory } from "react-router-dom";
import Cookies from "js-cookie";
import { AdminContext } from "@/context/AdminContext";
import AdminServices from "@/services/AdminServices";
import RegistrationServices from "@/services/RegistrationServices";
import TrustedDevicesServices from "@/services/TrustedDevicesServices";
import { notifyError } from "@/utils/toast";
import {
  generateDeviceFingerprint,
  getTrustedDevicesByFingerprint,
} from "@/utils/helpers/trustedDevices";
import { Loader } from "@/page-layouts/index";
import OtpServices from "@/services/OtpServices";
import {
  isUserAuthorizedForCurrentTenant,
  hostnameRequiresTenantCheck,
} from "@/utils/tenantHost";
import {
  writeSessionAssignedBusinesses,
  clearSessionAssignedBusinesses,
} from "@/utils/sessionAssignedBusinesses";
import { storeRefreshToken, clearStoredRefreshToken } from "@/utils/setupAxiosAuth";
import { resolvePostLoginPath } from "@/utils/subscriptionRedirect";
import { initializeNotifications } from "@/utils/initializeNotifications";
import { HiX } from "react-icons/hi";
import { FaUserCheck } from "react-icons/fa";

import "@/customer/styles/index.css";
import { CustomerBrandingProvider } from "@/customer/branding";
import SplitAuthLayout from "@/customer/components/layout/SplitAuthLayout";
import AuthHeader, {
  SecureNote,
} from "@/customer/components/layout/AuthHeader";
import Button from "@/customer/components/ui/Button";
import { PasswordField, TextField } from "@/customer/components/ui/Field";
import OtpInput, { isOtpComplete } from "@/customer/components/ui/OtpInput";

const OTP_LENGTH = 6;

const ADMIN_IDENTITY = {
  portalName: "AQCTA Admin Portal",
  secureNote: "Secure access to AQCTA admin services",
};

const ADMIN_PANEL_COPY = {
  eyebrow: "AQCTA",
  headline: "Operations built for assessment teams.",
  body: "Run applications, conformity assessments, and document workflows from one precise admin workspace — clear, fast, and audit-ready. CAB MDA/CAB-022.",
};

const Login = () => {
  const { dispatch } = useContext(AdminContext);
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [currentStep, setCurrentStep] = useState("credentials");
  const [initialTrustedDevicesListing, setInitialTrustedDevicesListing] =
    useState([]);
  const [trustedDevicesLoading, setTrustedDevicesLoading] = useState(false);
  const [showTrustedDevicesSlider, setShowTrustedDevicesSlider] =
    useState(false);
  const [selfRegistrationEnabled, setSelfRegistrationEnabled] = useState(false);

  useEffect(() => {
    RegistrationServices.isEnabled()
      .then((res) => setSelfRegistrationEnabled(!!res?.enabled))
      .catch(() => setSelfRegistrationEnabled(false));
  }, []);

  useEffect(() => {
    (async () => {
      const fingerprint = await generateDeviceFingerprint();
      if (fingerprint) {
        setTrustedDevicesLoading(true);
        const accounts = await getTrustedDevicesByFingerprint(fingerprint);
        console.debug("accounts", accounts);
        setInitialTrustedDevicesListing(accounts);
        setCurrentStep("credentials");
        setTrustedDevicesLoading(false);
      } else {
        setCurrentStep("credentials");
        setTrustedDevicesLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const enforceTenantAccessForSession = (sessionData) => {
      if (typeof window === "undefined") return true;
      if (!hostnameRequiresTenantCheck(window.location.hostname)) return true;
      return isUserAuthorizedForCurrentTenant(
        sessionData,
        window.location.hostname
      );
    };

    const adminInfo = localStorage.getItem("adminInfo");
    if (adminInfo) {
      const parsedAdminInfo = JSON.parse(adminInfo);
      if (!enforceTenantAccessForSession(parsedAdminInfo)) {
        localStorage.removeItem("adminInfo");
        localStorage.removeItem("businesses");
        clearSessionAssignedBusinesses();
        clearStoredRefreshToken();
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        Cookies.remove("token");
        notifyError("You are not authorized for this business group.");
        return;
      }
      const landing =
        resolvePostLoginPath(parsedAdminInfo) ||
        parsedAdminInfo?.role?.landing_page ||
        "/home";
      history.replace(landing);
    }
    const token = Cookies.get("token");
    if (token) {
      const parsedToken = JSON.parse(token);
      const landing = parsedToken?.role?.landing_page || "/home";
      history.replace(landing);
    }
    const localStorageToken = localStorage.getItem("token");
    if (localStorageToken) {
      const parsedLocalStorageToken = JSON.parse(localStorageToken);
      const landing = parsedLocalStorageToken?.role?.landing_page || "/home";
      history.replace(landing);
    }
    const sessionStorageToken = sessionStorage.getItem("token");
    if (sessionStorageToken) {
      const parsedSessionStorageToken = JSON.parse(sessionStorageToken);
      const landing = parsedSessionStorageToken?.role?.landing_page || "/home";
      history.replace(landing);
    }
  }, []);

  const [loginMeta, setLoginMeta] = useState({
    ip: "",
    country: "",
    city: "",
    region: "",
    timezone: "",
  });

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const baseUrl = import.meta.env.VITE_APP_API_BASE_URL || "";
        const url = `${baseUrl.replace(/\/$/, "")}/ip-info`;
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setLoginMeta({
            ip: data.ip,
            country: data.country,
            city: data.city,
            region: data.region,
            timezone: data.timezone,
          });
        }
      } catch (err) {
        console.error("IP fetch failed", err);
      }
    };
    fetchLocation();
  }, []);

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!password) nextErrors.password = "Password is required";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const res = await handleLogin(false, email, null, true);
      console.debug("res", res);
      if (res?.two_factor_auth) {
        await OtpServices.sendOTP(email, "Two Factor Authentication");
        setCurrentStep("otp");
      } else if (res) {
        handleLoginSuccess(res);
      }
    } catch (error) {
      console.debug("error", error);
      notifyError(
        error?.response?.data?.message || "Error processing password"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    if (!isOtpComplete(otp, OTP_LENGTH)) {
      setFieldErrors({ otp: `Enter all ${OTP_LENGTH} digits to continue` });
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const isValidOtp = await OtpServices.verifyOTP(email, otp);
      if (isValidOtp) {
        await handleLogin();

        try {
          const deviceData = {
            email,
            deviceId: null,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
            },
            lastUsed: new Date().toISOString(),
          };
          await TrustedDevicesServices.addTrustedDevice(deviceData);
        } catch (error) {
          console.error("Error adding trusted device:", error);
        }
      } else {
        notifyError(isValidOtp?.message || "Invalid OTP");
      }
    } catch (error) {
      console.debug("error", error);
      notifyError(error?.response?.data?.message || "Error verifying OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (res, trustedDeviceId) => {
    const { businesses, refreshToken: refreshTokenFromLogin, ...rest } = res;
    if (refreshTokenFromLogin) {
      storeRefreshToken(refreshTokenFromLogin);
    }
    localStorage.setItem("adminInfo", JSON.stringify(rest));
    localStorage.setItem("businesses", JSON.stringify(businesses));
    writeSessionAssignedBusinesses(Array.isArray(businesses) ? businesses : []);
    dispatch({ type: "USER_LOGIN", payload: res });

    if (trustedDeviceId) {
      try {
        await TrustedDevicesServices.updateTrustedDevice(trustedDeviceId, {
          lastUsed: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error adding trusted device:", error);
      }
    }

    let landing = resolvePostLoginPath(res);
    const targetPath = landing;

    const isEdge =
      /Edg\/|Edge\//i.test(navigator.userAgent) ||
      (typeof navigator !== "undefined" &&
        navigator.userAgent?.includes("Edg"));
    if (isEdge) {
      window.location.href = targetPath;
    } else {
      try {
        history.replace(targetPath);
        setTimeout(() => {
          if (window.location.pathname === "/login") {
            window.location.href = targetPath;
          }
        }, 100);
      } catch (error) {
        console.error("Navigation error:", error);
        window.location.href = targetPath;
      }
    }

    if (rest.id) {
      void initializeNotifications(rest.id, history).catch(() => {});
    }
  };

  const handleLogin = async (
    isTrustedDevice = false,
    loginEmail = null,
    trustedDeviceId = null,
    noLogin = false
  ) => {
    try {
      const loginData = {
        email: loginEmail || email,
        password,
        deviceId: null,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
        ip: loginMeta.ip,
        country: loginMeta.country,
        city: loginMeta.city,
        region: loginMeta.region,
        timezone: loginMeta.timezone,
        isTrustedDevice,
      };

      const res = await AdminServices.loginAdmin(loginData);

      console.debug({ res });

      if (!res) {
        notifyError("Invalid Email or Password!");
        return;
      }

      if (
        typeof window !== "undefined" &&
        hostnameRequiresTenantCheck(window.location.hostname) &&
        !isUserAuthorizedForCurrentTenant(res, window.location.hostname)
      ) {
        notifyError("You are not authorized for this business group.");
        return;
      }

      if (!noLogin && res) {
        return handleLoginSuccess(res, trustedDeviceId);
      } else {
        return res;
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || error?.message);
      throw error;
    }
  };

  const handleBack = () => {
    if (currentStep === "otp") {
      setCurrentStep("credentials");
      setOtp("");
      setFieldErrors({});
    }
  };

  const handleTrustedAccountLogin = async (account) => {
    setLoading(true);
    try {
      await handleLogin(true, account.user?.email, account._id);
    } catch (error) {
      notifyError(error?.message || "Error logging in with trusted device");
    } finally {
      setLoading(false);
    }
  };

  const setField = (field) => (event) => {
    const { value } = event.target;
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <CustomerBrandingProvider
      identityOverrides={ADMIN_IDENTITY}
      panelCopyOverrides={ADMIN_PANEL_COPY}
    >
      <SplitAuthLayout width="narrow" align="center" footer={<SecureNote />}>
        {currentStep === "credentials" && (
          <form onSubmit={handlePasswordSubmit} noValidate>
            <AuthHeader
              size="hero"
              title="Welcome back"
              subtitle="Sign in to AQCTA Admin to continue managing conformity assessment operations."
            />

            <div className="epc-form-stack">
              <TextField
                size="lg"
                type="email"
                label="Email"
                name="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={setField("email")}
                error={fieldErrors.email}
              />

              <PasswordField
                size="lg"
                label="Password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={setField("password")}
                error={fieldErrors.password}
              />

              <div className="epc-form-stack__submit">
                <Button type="submit" size="lg" block loading={loading}>
                  Login
                </Button>
              </div>
            </div>

            <div
              className="epc-auth-footnote"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {/* Admin can't self-register — hide Create an account
              {selfRegistrationEnabled ? (
                <span>
                  New to AQCTA?
                  <Link className="epc-link" to="/register">
                    Create an account
                  </Link>
                </span>
              ) : (
                <span />
              )}
              */}
              <span />
              <Link className="epc-link" to="/forgot-password">
                Forgot Password?
              </Link>
            </div>
          </form>
        )}

        {currentStep === "otp" && (
          <form onSubmit={handleOtpSubmit} noValidate>
            <AuthHeader
              size="display"
              airy
              title="Verify OTP"
              subtitle={`Enter the OTP sent to your ${email} account`}
            />

            <div className="epc-field">
              <span className="epc-field__label" id="epc-admin-otp-label">
                OTP
              </span>
              <div role="group" aria-labelledby="epc-admin-otp-label">
                <OtpInput
                  length={OTP_LENGTH}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    setFieldErrors((prev) => ({ ...prev, otp: undefined }));
                  }}
                />
              </div>
              {fieldErrors.otp && (
                <span className="epc-field__error">{fieldErrors.otp}</span>
              )}
            </div>

            <div className="epc-otp-submit epc-otp-submit--split">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                grow
                onClick={handleBack}
              >
                Back
              </Button>
              <Button type="submit" size="lg" grow loading={loading}>
                Verify OTP & Login
              </Button>
            </div>
          </form>
        )}
      </SplitAuthLayout>

      {trustedDevicesLoading && (
        <button
          type="button"
          onClick={() => setShowTrustedDevicesSlider(true)}
          className="login-page__trusted-devices-toggle"
          title="View trusted accounts"
        >
          <Loader size={24} color="#fff" />
        </button>
      )}

      {initialTrustedDevicesListing?.length > 0 && !trustedDevicesLoading && (
        <button
          type="button"
          onClick={() => setShowTrustedDevicesSlider(true)}
          className="login-page__trusted-devices-toggle"
          title="View trusted accounts"
        >
          <FaUserCheck size={24} />
          <span className="login-page__trusted-devices-badge">
            {initialTrustedDevicesListing.length}
          </span>
        </button>
      )}

      {initialTrustedDevicesListing?.length > 0 && (
        <>
          <div
            className={`login-page__slider-overlay ${
              showTrustedDevicesSlider
                ? "login-page__slider-overlay--active"
                : ""
            }`}
            onClick={() => setShowTrustedDevicesSlider(false)}
          />
          <div
            className={`login-page__trusted-devices-slider ${
              showTrustedDevicesSlider
                ? "login-page__trusted-devices-slider--active"
                : ""
            }`}
          >
            <div className="login-page__slider-header">
              <h3 className="login-page__slider-title">Trusted Accounts</h3>
              <button
                type="button"
                onClick={() => setShowTrustedDevicesSlider(false)}
                className="login-page__slider-close"
                aria-label="Close"
              >
                <HiX size={24} />
              </button>
            </div>
            <div className="login-page__slider-content">
              <p className="login-page__slider-subtitle">
                Select an account to continue
              </p>
              {loading && (
                <div className="login-page__slider-loader">
                  <Loader size={40} color="var(--p-blue)" />
                  <p className="login-page__slider-loader-text">
                    Logging in...
                  </p>
                </div>
              )}
              <div
                className={`login-page__trusted-accounts-list ${
                  loading ? "login-page__trusted-accounts-list--loading" : ""
                }`}
              >
                {initialTrustedDevicesListing.map((device, index) => {
                  const userName = device.user?.name || "User";
                  const userEmail = device.user?.email || "";
                  const userInitial = userName.charAt(0).toUpperCase();
                  const deviceLabel = device.deviceLabel || "Unknown Device";
                  const browser = device.browser || "Unknown Browser";
                  return (
                    <button
                      key={index}
                      onClick={async () => {
                        await handleTrustedAccountLogin(device);
                        setShowTrustedDevicesSlider(false);
                      }}
                      className="login-page__trusted-account-card"
                      disabled={loading}
                    >
                      <div className="login-page__user-avatar">
                        {device.user?.image ? (
                          <img
                            src={device.user.image}
                            alt={userName}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : null}
                        <div className="login-page__user-avatar-placeholder">
                          {userInitial}
                        </div>
                      </div>
                      <div className="login-page__user-details">
                        <p className="login-page__user-name-text">{userName}</p>
                        <p className="login-page__user-email-text">
                          {userEmail}
                        </p>
                        <p className="login-page__device-label-text">
                          {deviceLabel}
                        </p>
                        <p className="login-page__browser-text">{browser}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </CustomerBrandingProvider>
  );
};

export default Login;
