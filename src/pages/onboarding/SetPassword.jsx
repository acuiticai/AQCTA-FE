import React, { useContext, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import RegistrationServices from "@/services/RegistrationServices";
import AdminServices from "@/services/AdminServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import Button from "@/page-layouts/components/Button";
import LabelArea from "@/components/form/selectOption/LabelArea";
import InputArea from "@/components/form/input/InputArea";
import { AiOutlineLock } from "react-icons/ai";
import { writeSessionAssignedBusinesses } from "@/utils/sessionAssignedBusinesses";
import { storeRefreshToken } from "@/utils/setupAxiosAuth";
import { resolvePostLoginPath } from "@/utils/subscriptionRedirect";
import { OnboardingSplitLayout } from "./OnboardingLayout";

const SetPassword = () => {
  const history = useHistory();
  const location = useLocation();
  const { dispatch } = useContext(AdminContext);
  const [loading, setLoading] = useState(false);
  const params = new URLSearchParams(location.search);
  const emailFromQuery = params.get("email") || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      notifyError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      notifyError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      notifyError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await RegistrationServices.setPassword({
        email: emailTrimmed,
        password,
      });
      notifySuccess(res.message || "Password set successfully!");

      const loginRes = await AdminServices.loginAdmin({
        email: emailTrimmed,
        password,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
      });

      const { businesses, refreshToken: refreshTokenFromLogin, ...rest } = loginRes;
      if (refreshTokenFromLogin) {
        storeRefreshToken(refreshTokenFromLogin);
      }
      localStorage.setItem("adminInfo", JSON.stringify(rest));
      localStorage.setItem("businesses", JSON.stringify(businesses));
      writeSessionAssignedBusinesses(Array.isArray(businesses) ? businesses : []);
      dispatch({ type: "USER_LOGIN", payload: loginRes });

      history.replace(resolvePostLoginPath(loginRes));
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to set password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingSplitLayout
      currentStep={3}
      title="Set your password"
      subtitle="Create a password for your account."
    >
      <form onSubmit={onSubmit} className="login-page__form">
        <LabelArea color="#929296" label="Email" className="mb-2" />
        <InputArea
          required
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />

        <LabelArea color="#929296" label="Password" className="mb-2 mt-4" />
        <InputArea
          required
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          icon={<AiOutlineLock size={20} color="#9CA3AF" />}
        />

        <LabelArea color="#929296" label="Confirm Password" className="mb-2 mt-4" />
        <InputArea
          required
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
          icon={<AiOutlineLock size={20} color="#9CA3AF" />}
        />

        <div className="login-page__form-buttons">
          <Button
            type="submit"
            disabled={loading}
            label="Continue"
            loading={loading}
            className="login-page__form-button-full"
          />
        </div>
      </form>
    </OnboardingSplitLayout>
  );
};

export default SetPassword;
