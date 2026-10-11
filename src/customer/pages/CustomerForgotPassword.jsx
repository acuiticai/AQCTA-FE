import React, { useState } from "react";
import { Link, Redirect, useHistory } from "react-router-dom";

import SplitAuthLayout from "../components/layout/SplitAuthLayout";
import AuthHeader, { SecureNote } from "../components/layout/AuthHeader";
import Button from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { useAccount } from "../context/AccountContext";
import { customerPath } from "../routes/paths";
import CustomerAuthServices from "../services/authService";
import { isEmail, isFilled, validate } from "../utils/validation";

export default function CustomerForgotPassword() {
  const history = useHistory();
  const { isAuthenticated } = useAccount();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Redirect to={customerPath.dashboard} />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const values = { email };
    const nextErrors = validate(values, {
      email: [
        [isFilled, "Email is required"],
        [isEmail, "Enter a valid email address"],
      ],
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const normalized = email.trim().toLowerCase();
      await CustomerAuthServices.forgotPassword({ email: normalized });
      history.push(customerPath.verifyOtp, {
        email: normalized,
        purpose: "forgot-password",
      });
    } catch (err) {
      const apiMessage =
        err?.response?.data?.message ||
        "Unable to send reset code. Please try again.";
      const apiField = err?.response?.data?.field;
      if (apiField === "email") {
        setErrors({ email: apiMessage });
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
          title="Forgot password?"
          subtitle="Enter the email linked to your AQCTA account and we’ll send a one-time code to reset your password."
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
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((prev) => ({ ...prev, email: undefined }));
              setSubmitError("");
            }}
            error={errors.email}
          />

          {submitError ? (
            <p className="epc-field__error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="epc-form-stack__submit">
            <Button type="submit" size="lg" block loading={submitting}>
              Send reset code
            </Button>
          </div>
        </div>

        <div className="epc-auth-footnotes">
          <p className="epc-auth-footnote epc-auth-footnote--flush">
            Remembered your password?
            <Link className="epc-link" to={customerPath.login}>
              Back to login
            </Link>
          </p>
        </div>
      </form>
    </SplitAuthLayout>
  );
}
