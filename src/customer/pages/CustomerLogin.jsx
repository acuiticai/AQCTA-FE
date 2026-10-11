import React, { useState } from "react";
import { Link, Redirect, useHistory, useLocation } from "react-router-dom";

import SplitAuthLayout from "../components/layout/SplitAuthLayout";
import AuthHeader, { SecureNote } from "../components/layout/AuthHeader";
import Button from "../components/ui/Button";
import { PasswordField, TextField } from "../components/ui/Field";
import { useAccount } from "../context/AccountContext";
import { customerPath } from "../routes/paths";
import CustomerAuthServices from "../services/authService";
import { isEmail, isFilled, validate } from "../utils/validation";

export default function CustomerLogin() {
  const history = useHistory();
  const location = useLocation();
  const { isAuthenticated, signIn } = useAccount();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordResetNotice = Boolean(location.state?.passwordReset);

  const redirectAfterLogin =
    location.state?.from?.pathname
      ? `${location.state.from.pathname}${location.state.from.search || ""}`
      : customerPath.dashboard;

  if (isAuthenticated) {
    return <Redirect to={redirectAfterLogin} />;
  }

  const setField = (field) => (event) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      email: [
        [isFilled, "Email is required"],
        [isEmail, "Enter a valid email address"],
      ],
      password: [[isFilled, "Password is required"]],
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const email = values.email.trim().toLowerCase();
      const res = await CustomerAuthServices.login({
        email,
        password: values.password,
      });
      const session = res?.data?.data || res?.data;

      // Registration still uses OTP; login returns a session directly.
      if (session?.requiresOtp) {
        history.push(customerPath.verifyOtp, {
          email,
          purpose: "login",
          from: location.state?.from,
        });
        return;
      }

      if (!session?.token) {
        setSubmitError("Sign-in succeeded but no session was returned.");
        return;
      }

      signIn(session);
      history.replace(redirectAfterLogin);
    } catch (err) {
      const apiMessage =
        err?.response?.data?.message ||
        "Unable to sign in. Please check your details and try again.";
      const apiField = err?.response?.data?.field;
      if (apiField === "email" || apiField === "password") {
        setErrors((prev) => ({ ...prev, [apiField]: apiMessage }));
      } else {
        setSubmitError(apiMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SplitAuthLayout width="narrow" align="center" footer={<SecureNote />}>
      <form onSubmit={handleSubmit} noValidate>
        <AuthHeader
          size="hero"
          title="Welcome back"
          subtitle="Sign in to AQCTA to continue managing your conformity assessment journey."
        />

        <div className="epc-form-stack">
          <TextField
            size="lg"
            type="email"
            label="Email"
            name="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={setField("email")}
            error={errors.email}
          />

          <PasswordField
            size="lg"
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            value={values.password}
            onChange={setField("password")}
            error={errors.password}
          />

          <div
            className="epc-auth-footnote"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: -4,
            }}
          >
            <Link className="epc-link" to={customerPath.forgotPassword}>
              Forgot Password?
            </Link>
          </div>

          {passwordResetNotice ? (
            <p className="epc-field__hint" role="status">
              Password updated. Sign in with your new password.
            </p>
          ) : null}

          {submitError ? (
            <p className="epc-field__error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="epc-form-stack__submit">
            <Button type="submit" size="lg" block loading={submitting}>
              Login
            </Button>
          </div>
        </div>

        <div className="epc-auth-footnotes">
          <p className="epc-auth-footnote epc-auth-footnote--flush">
            New to AQCTA?
            <Link className="epc-link" to={customerPath.register}>
              Register
            </Link>
          </p>
          <p className="epc-auth-footnote epc-auth-footnote--flush">
            Looking to enquire?
            <Link className="epc-link" to={customerPath.enquiry}>
              Submit an enquiry
            </Link>
          </p>
        </div>
      </form>
    </SplitAuthLayout>
  );
}
