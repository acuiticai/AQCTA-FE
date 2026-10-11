import React, { useState } from "react";
import { Link, Redirect, useHistory, useLocation } from "react-router-dom";

import SplitAuthLayout from "../components/layout/SplitAuthLayout";
import AuthHeader, { SecureNote } from "../components/layout/AuthHeader";
import Button from "../components/ui/Button";
import { PasswordField } from "../components/ui/Field";
import { useAccount } from "../context/AccountContext";
import { customerPath } from "../routes/paths";
import CustomerAuthServices from "../services/authService";
import { isFilled, validate } from "../utils/validation";

export default function CustomerResetPassword() {
  const history = useHistory();
  const location = useLocation();
  const { isAuthenticated } = useAccount();

  const email = location.state?.email || "";
  const resetToken = location.state?.resetToken || "";

  const [values, setValues] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Redirect to={customerPath.dashboard} />;
  }

  if (!email || !resetToken) {
    return <Redirect to={customerPath.forgotPassword} />;
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
      password: [
        [isFilled, "Password is required"],
        [
          (value) => String(value).length >= 8,
          "Use at least 8 characters",
        ],
      ],
      confirmPassword: [
        [isFilled, "Confirm your password"],
        [
          (value, all) => value === all.password,
          "Passwords do not match",
        ],
      ],
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      await CustomerAuthServices.resetPassword({
        email,
        resetToken,
        password: values.password,
      });
      history.replace(customerPath.login, {
        passwordReset: true,
      });
    } catch (err) {
      const apiMessage =
        err?.response?.data?.message ||
        "Unable to reset password. Please try again.";
      const apiField = err?.response?.data?.field;
      if (apiField === "password") {
        setErrors((prev) => ({ ...prev, password: apiMessage }));
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
          title="Set a new password"
          subtitle={`Choose a new password for ${email}. You’ll use it the next time you sign in.`}
        />

        <div className="epc-form-stack">
          <PasswordField
            size="lg"
            label="New password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={values.password}
            onChange={setField("password")}
            error={errors.password}
          />

          <PasswordField
            size="lg"
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={values.confirmPassword}
            onChange={setField("confirmPassword")}
            error={errors.confirmPassword}
          />

          {submitError ? (
            <p className="epc-field__error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="epc-form-stack__submit">
            <Button type="submit" size="lg" block loading={submitting}>
              Reset password
            </Button>
          </div>
        </div>

        <div className="epc-auth-footnotes">
          <p className="epc-auth-footnote epc-auth-footnote--flush">
            <Link className="epc-link" to={customerPath.login}>
              Back to login
            </Link>
          </p>
        </div>
      </form>
    </SplitAuthLayout>
  );
}
