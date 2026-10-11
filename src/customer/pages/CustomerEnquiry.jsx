import React, { useState } from "react";
import { Link } from "react-router-dom";

import SplitAuthLayout from "../components/layout/SplitAuthLayout";
import AuthHeader from "../components/layout/AuthHeader";
import Button from "../components/ui/Button";
import {
  FormGrid,
  PhoneField,
  TextField,
  TextareaField,
} from "../components/ui/Field";
import Combobox from "../components/ui/Combobox";
import InspectionEnquiryFields from "../components/InspectionEnquiryFields";
import {
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  ENQUIRING_FOR_OPTIONS,
  emptyInspectionEnquiryFields,
  includesInspectionOthers,
} from "../data/enquiryOptions";
import { customerPath } from "../routes/paths";
import CustomerEnquiryServices from "../services/enquiryService";
import { isEmail, isFilled, validate } from "../utils/validation";

const initialValues = {
  name: "",
  email: "",
  phone: { dialCode: DEFAULT_DIAL_CODE, number: "" },
  companyName: "",
  enquiringFor: "",
  enquiry: "",
  ...emptyInspectionEnquiryFields(),
};

/** Build E.164-style phone from dial code + national digits. */
const toE164Phone = (phone) => {
  const dial = String(phone?.dialCode || "").trim();
  const digits = String(phone?.number || "").replace(/[^\d]/g, "");
  if (!dial || !digits) return "";
  return `${dial}${digits}`;
};

/** 6–15 national digits, ignoring spaces, dashes and brackets. */
const isPhoneNumber = (value) => {
  const digits = String(value?.number || "").replace(/[^\d]/g, "");
  return Boolean(value?.dialCode) && digits.length >= 6 && digits.length <= 15;
};

export default function CustomerEnquiry() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = (field) => (event) => {
    const next = event?.target ? event.target.value : event;
    setValues((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError("");
  };

  const setInspectionField = (field, next) => {
    setValues((prev) => {
      const patch = { [field]: next };
      if (field === "mandatoryInspectionServices" && !includesInspectionOthers(next)) {
        patch.mandatoryInspectionOthers = "";
      }
      if (field === "thirdPartyInspectionServices" && !includesInspectionOthers(next)) {
        patch.thirdPartyInspectionOthers = "";
      }
      return { ...prev, ...patch };
    });
    setErrors((prev) => {
      const nextErrors = { ...prev, [field]: undefined };
      if (field === "mandatoryInspectionServices") {
        nextErrors.mandatoryInspectionOthers = undefined;
      }
      if (field === "thirdPartyInspectionServices") {
        nextErrors.thirdPartyInspectionOthers = undefined;
      }
      return nextErrors;
    });
    setSubmitError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const rules = {
      name: [[isFilled, "Name is required"]],
      email: [
        [isFilled, "Email is required"],
        [isEmail, "Enter a valid email address"],
      ],
      phone: [[isPhoneNumber, "Enter a valid phone number with country code"]],
      enquiringFor: [[isFilled, "Select what your enquiry is about"]],
    };

    if (values.enquiringFor === "Inspection") {
      rules.mandatoryInspectionServices = [
        [
          (v) => Array.isArray(v) && v.length > 0,
          "Select at least one Mandatory Inspection Service",
        ],
      ];
      if (includesInspectionOthers(values.mandatoryInspectionServices)) {
        rules.mandatoryInspectionOthers = [
          [isFilled, "Please specify the other Mandatory Inspection Service"],
        ];
      }
      if (includesInspectionOthers(values.thirdPartyInspectionServices)) {
        rules.thirdPartyInspectionOthers = [
          [isFilled, "Please specify the other Third Party Inspection service"],
        ];
      }
    }

    const nextErrors = validate(values, rules);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const isInspection = values.enquiringFor === "Inspection";
    const payload = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: toE164Phone(values.phone),
      companyName: values.companyName?.trim() || "",
      enquiringFor: values.enquiringFor,
      enquiry: values.enquiry?.trim() || "",
      mandatoryInspectionServices: isInspection
        ? values.mandatoryInspectionServices
        : [],
      mandatoryInspectionOthers: isInspection
        ? values.mandatoryInspectionOthers?.trim() || ""
        : "",
      thirdPartyInspectionServices: isInspection
        ? values.thirdPartyInspectionServices
        : [],
      thirdPartyInspectionOthers: isInspection
        ? values.thirdPartyInspectionOthers?.trim() || ""
        : "",
      // Enquiry Channel and Status are triage fields owned by the super user;
      // the public endpoint assigns their defaults. See Enquiries/controller.js.
    };

    const businessId = import.meta.env.VITE_APP_DEFAULT_BUSINESS_ID;
    if (businessId) {
      payload.business_id = businessId;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      await CustomerEnquiryServices.createEnquiry(payload);
      setSubmitted(true);
    } catch (err) {
      const apiMessage =
        err?.response?.data?.message || "Failed to submit enquiry. Please try again.";
      const apiField = err?.response?.data?.field;
      if (
        apiField === "email" ||
        /email already exists/i.test(String(apiMessage))
      ) {
        setErrors((prev) => ({ ...prev, email: apiMessage }));
      } else {
        setSubmitError(apiMessage);
      }
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
      {submitted ? (
        <div>
          <AuthHeader
            eyebrow="Enquiry received"
            title="Thanks for getting in touch"
            subtitle="Our team will review your enquiry and respond to the email address you provided."
          />
          <div className="epc-form-actions">
            <Button
              type="button"
              onClick={() => {
                setValues(initialValues);
                setErrors({});
                setSubmitError("");
                setSubmitted(false);
              }}
            >
              Submit another enquiry
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <AuthHeader
            eyebrow="Enquiry"
            title="Make an enquiry"
            subtitle="Tell us what you need and our team will get back to you. No account required."
          />

          <FormGrid>
            <TextField
              label="Name *"
              name="name"
              autoComplete="name"
              placeholder="Enter your full name"
              value={values.name}
              onChange={setField("name")}
              error={errors.name}
            />
            <TextField
              label="Email *"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={values.email}
              onChange={setField("email")}
              error={errors.email}
            />
            <PhoneField
              label="Phone *"
              name="phone"
              dialCodes={DIAL_CODES}
              value={values.phone}
              onChange={setField("phone")}
              error={errors.phone}
            />
            <TextField
              label="Company Name (Optional)"
              name="companyName"
              autoComplete="organization"
              placeholder="Enter company name"
              value={values.companyName}
              onChange={setField("companyName")}
            />
            <Combobox
              label="Enquiring For *"
              name="enquiringFor"
              placeholder="Select one"
              options={ENQUIRING_FOR_OPTIONS}
              value={values.enquiringFor}
              onChange={(next) => {
                setValues((prev) => ({
                  ...prev,
                  enquiringFor: next,
                  ...(next !== "Inspection" ? emptyInspectionEnquiryFields() : {}),
                }));
                setErrors((prev) => ({
                  ...prev,
                  enquiringFor: undefined,
                  mandatoryInspectionServices: undefined,
                  mandatoryInspectionOthers: undefined,
                  thirdPartyInspectionServices: undefined,
                  thirdPartyInspectionOthers: undefined,
                }));
              }}
              error={errors.enquiringFor}
            />
            {values.enquiringFor === "Inspection" ? (
              <InspectionEnquiryFields
                values={values}
                errors={errors}
                onChange={setInspectionField}
              />
            ) : null}
            <TextareaField
              full
              label="Enquiry (Optional)"
              name="enquiry"
              rows={4}
              placeholder="Tell us a little about what you are looking for"
              value={values.enquiry}
              onChange={setField("enquiry")}
            />
          </FormGrid>

          {submitError ? (
            <p className="epc-field__error" role="alert" style={{ marginTop: 12 }}>
              {submitError}
            </p>
          ) : null}

          <div className="epc-form-actions">
            <Button type="submit" block loading={submitting}>
              Submit enquiry
            </Button>
          </div>
        </form>
      )}
    </SplitAuthLayout>
  );
}
