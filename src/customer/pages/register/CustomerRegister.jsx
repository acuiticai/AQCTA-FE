import React, { useState } from "react";
import { Link, Redirect, useHistory } from "react-router-dom";

import SplitAuthLayout from "../../components/layout/SplitAuthLayout";
import AuthHeader from "../../components/layout/AuthHeader";
import StepChevrons from "../../components/ui/StepChevrons";
import {
  RegistrationProvider,
  useRegistration,
} from "../../context/RegistrationContext";
import { useAccount } from "../../context/AccountContext";
import { customerPath } from "../../routes/paths";
import CustomerAuthServices from "../../services/authService";
import StepCompany from "./steps/StepCompany";
import StepAddress from "./steps/StepAddress";
import StepContacts from "./steps/StepContacts";
import StepDocuments from "./steps/StepDocuments";

const STEP_COPY = [
  {
    title: "Create your account",
    subtitle:
      "Start with your company details to create an AQCTA customer profile.",
  },
  {
    title: "Company address",
    subtitle:
      "Add the registered location and geographic details for your company.",
  },
  {
    title: "Contact persons",
    subtitle:
      "Add the primary customer contact. Additional contacts can be added later.",
  },
  {
    title: "Company documents",
    subtitle:
      "Attach supporting company documents now, or continue and upload them later.",
  },
];

async function uploadRegistrationFiles(files = []) {
  const uploaded = [];
  for (const file of files) {
    if (!file) continue;
    try {
      const res = await CustomerAuthServices.uploadFile(file);
      const url =
        res?.data?.url ||
        res?.data?.Location ||
        res?.data?.fileUrl ||
        res?.data?.data?.url ||
        "";
      const s3Key = res?.data?.s3Key || res?.data?.data?.s3Key || "";
      if (!url && !s3Key) continue;
      uploaded.push({
        url,
        s3Key,
        name: file.name || "document",
        file_type: file.type || "",
        file_size: file.size || 0,
      });
    } catch (err) {
      console.warn("[CustomerRegister] document upload skipped:", err?.message);
    }
  }
  return uploaded;
}

function RegisterWizard() {
  const { steps, step, goToStep, data } = useRegistration();
  const history = useHistory();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const copy = STEP_COPY[step];

  const handleCreateAccount = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const documentFiles = await uploadRegistrationFiles(
        data.documents?.files || [],
      );

      const payload = {
        company: {
          companyName: data.company.companyName.trim(),
          registrationNumber: data.company.registrationNumber.trim(),
          email: data.company.email.trim().toLowerCase(),
          website: data.company.website.trim(),
          password: data.company.password,
        },
        /*
         * Mapped explicitly, not spread. The draft also carries `countryCode`
         * and `stateCode` for the picker cascade, and the API contract is by
         * name: `CustomerPortal/controller.js` reads `address.state` (and maps
         * it to `basicInformation.stateProvince`), so the state has to go out
         * under `state`, not the draft's `stateProvince`.
         */
        address: {
          addressLabel: data.address.addressLabel,
          companyAddress: data.address.companyAddress,
          postCode: data.address.postCode,
          state: data.address.stateProvince,
          city: data.address.city,
          country: data.address.country,
          gpsCoordinates: data.address.gpsCoordinates,
        },
        contacts: data.contacts.map((contact) => ({
          name: contact.name,
          position: contact.position,
          phone: contact.phone,
          mobile: contact.mobile,
          email: contact.email,
        })),
        documents: {
          title: data.documents?.title || "",
          files: documentFiles,
          urls: documentFiles.map((f) => f.url).filter(Boolean),
        },
      };

      const businessId = import.meta.env.VITE_APP_DEFAULT_BUSINESS_ID;
      if (businessId) {
        payload.business_id = businessId;
      }

      await CustomerAuthServices.register(payload);
      history.push(customerPath.verifyOtp, {
        email: payload.company.email,
        purpose: "register",
      });
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message ||
          "Unable to create account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SplitAuthLayout
      width="wide"
      align="center"
      footer={
        <p className="epc-auth-footnote epc-auth-footnote--flush">
          Already have an account?
          <Link
            className="epc-link epc-link--underlined"
            to={customerPath.login}
          >
            Login
          </Link>
        </p>
      }
    >
      <AuthHeader
        tight
        eyebrow={`Step ${step + 1} of ${steps.length}`}
        title={copy.title}
        subtitle={copy.subtitle}
      />

      <StepChevrons steps={steps} current={step} onStepClick={goToStep} />

      {submitError ? (
        <p className="epc-field__error" role="alert" style={{ marginBottom: 12 }}>
          {submitError}
        </p>
      ) : null}

      {step === 0 && <StepCompany />}
      {step === 1 && <StepAddress />}
      {step === 2 && <StepContacts />}
      {step === 3 && (
        <StepDocuments onSubmit={handleCreateAccount} submitting={submitting} />
      )}
    </SplitAuthLayout>
  );
}

export default function CustomerRegister() {
  const { isAuthenticated } = useAccount();
  if (isAuthenticated) {
    return <Redirect to={customerPath.dashboard} />;
  }

  return (
    <RegistrationProvider>
      <RegisterWizard />
    </RegistrationProvider>
  );
}
