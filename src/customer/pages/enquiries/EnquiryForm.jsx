import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import PortalLayout from "../../layouts/PortalLayout";
import { DetailHeader } from "../../components/ui/DetailBlocks";
import { StepHeading, StepNote } from "../../components/wizard/ApplicationWizard";
import Button from "../../components/ui/Button";
import Combobox from "../../components/ui/Combobox";
import { FormGrid, TextField, TextareaField } from "../../components/ui/Field";
import InspectionEnquiryFields from "../../components/InspectionEnquiryFields";
import {
  ENQUIRING_FOR_OPTIONS,
  emptyInspectionEnquiryFields,
  includesInspectionOthers,
} from "../../data/enquiryOptions";
import { useAccount } from "../../context/AccountContext";
import { customerPath } from "../../routes/paths";
import CustomerEnquiryServices from "../../services/enquiryService";
import { isEmail, isFilled, validate } from "../../utils/validation";

/**
 * Create and edit share one screen — the only difference is whether an existing
 * enquiry seeds the fields and what the submit button says.
 */
export default function EnquiryForm() {
  const history = useHistory();
  const { id } = useParams();
  const account = useAccount();
  const isEdit = Boolean(id);

  const [values, setValues] = useState({
    contactName: account.name || "",
    email: account.email || "",
    phone: account.phone || "",
    companyName: "",
    enquiringFor: "",
    subject: "",
    message: "",
    ...emptyInspectionEnquiryFields(),
  });
  const [existingMeta, setExistingMeta] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await CustomerEnquiryServices.getMyEnquiryById(id);
        const row = res?.data?.data;
        if (!row) {
          if (!cancelled) setLoadError("Enquiry not found.");
          return;
        }
        if (!row.canEdit) {
          if (!cancelled) {
            setLoadError("Only Open enquiries can be edited.");
          }
          return;
        }
        if (!cancelled) {
          setExistingMeta(row);
          const message = String(row.message || row.enquiry || "");
          const lines = message.split(/\n/);
          const first = lines[0]?.trim() || "";
          const rest = lines.slice(1).join("\n").trim();
          setValues({
            contactName: row.contact?.name || account.name || "",
            email: row.contact?.email || account.email || "",
            phone: row.contact?.phone || account.phone || "",
            companyName: row.companyName || "",
            enquiringFor: row.enquiringFor || "",
            subject: first,
            message: rest || (first ? "" : message),
            mandatoryInspectionServices: row.mandatoryInspectionServices || [],
            mandatoryInspectionOthers: row.mandatoryInspectionOthers || "",
            thirdPartyInspectionServices: row.thirdPartyInspectionServices || [],
            thirdPartyInspectionOthers: row.thirdPartyInspectionOthers || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err?.response?.data?.message || "Failed to load enquiry.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, account.name, account.email, account.phone]);

  const setField = (field) => (next) => {
    const value = next?.target ? next.target.value : next;
    setValues((prev) => ({ ...prev, [field]: value }));
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
      contactName: [[isFilled, "Contact name is required"]],
      email: [
        [isFilled, "Email is required"],
        [isEmail, "Enter a valid email address"],
      ],
      phone: [[isFilled, "Phone is required"]],
      enquiringFor: [[isFilled, "Select what your enquiry is about"]],
      subject: [[isFilled, "Enter a short subject"]],
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

    const enquiryText = [values.subject.trim(), values.message.trim()]
      .filter(Boolean)
      .join("\n\n");

    const isInspection = values.enquiringFor === "Inspection";
    const payload = {
      name: values.contactName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      companyName: values.companyName?.trim() || "",
      enquiringFor: values.enquiringFor,
      enquiry: enquiryText,
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
    };

    const businessId = import.meta.env.VITE_APP_DEFAULT_BUSINESS_ID;
    if (businessId) {
      payload.business_id = businessId;
    }

    setSaving(true);
    setSubmitError("");
    try {
      if (isEdit) {
        await CustomerEnquiryServices.updateMyEnquiry(id, payload);
      } else {
        await CustomerEnquiryServices.createMyEnquiry(payload);
      }
      history.push(customerPath.enquiries);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message || "Failed to save enquiry. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "My Enquiries" }]}>
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Loading enquiry…</p>
        </div>
      </PortalLayout>
    );
  }

  if (isEdit && loadError) {
    return (
      <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "My Enquiries" }]}>
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Unable to edit</p>
          <p className="epc-placeholder__text">{loadError}</p>
          <Button onClick={() => history.push(customerPath.enquiries)}>
            Back to enquiries
          </Button>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "My Enquiries" }]}>
      <form onSubmit={handleSubmit} noValidate>
        <DetailHeader
          title={
            isEdit
              ? `Edit ${existingMeta?.id || "enquiry"}`
              : "Create New Enquiry"
          }
          subtitle={
            isEdit
              ? "Update your enquiry before AQCTA responds."
              : "Tell us what you need and our team will get back to you."
          }
          meta={
            isEdit && existingMeta?.submitted
              ? `Submitted ${existingMeta.submitted}`
              : undefined
          }
          onBack={() => history.push(customerPath.enquiries)}
        />

        <section className="epc-card-panel">
          <StepHeading
            title="Enquiry Details"
            subtitle="Provide the contact and the service you are enquiring about."
          />

          <FormGrid>
            <TextField
              label="Contact Name *"
              name="contactName"
              placeholder="Enter contact name"
              value={values.contactName}
              onChange={setField("contactName")}
              error={errors.contactName}
            />
            <TextField
              label="Email *"
              type="email"
              name="email"
              placeholder="name@company.com"
              value={values.email}
              onChange={setField("email")}
              error={errors.email}
              disabled={isEdit}
            />
            <TextField
              label="Phone *"
              type="tel"
              name="phone"
              placeholder="Enter phone number"
              value={values.phone}
              onChange={setField("phone")}
              error={errors.phone}
            />
            <TextField
              label="Company Name (Optional)"
              name="companyName"
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
            <TextField
              full
              label="Subject *"
              name="subject"
              placeholder="e.g. Certification requirements"
              value={values.subject}
              onChange={setField("subject")}
              error={errors.subject}
            />
            <TextareaField
              full
              rows={5}
              label="Enquiry (Optional)"
              name="message"
              placeholder="Tell us a little about what you are looking for"
              value={values.message}
              onChange={setField("message")}
            />
          </FormGrid>

          {submitError ? (
            <p className="epc-field__error" role="alert" style={{ marginTop: 12 }}>
              {submitError}
            </p>
          ) : null}

          <StepNote title="What happens next">
            AQCTA will review your enquiry and respond here. A responded
            enquiry can be taken forward into an application.
          </StepNote>
        </section>

        <footer className="epc-card-panel epc-wizard__foot">
          <Button
            variant="secondary"
            onClick={() => history.push(customerPath.enquiries)}
          >
            Cancel
          </Button>
          <div className="epc-wizard__foot-right">
            <Button type="submit" loading={saving}>
              {isEdit ? "Save Changes" : "Submit Enquiry"}
            </Button>
          </div>
        </footer>
      </form>
    </PortalLayout>
  );
}
