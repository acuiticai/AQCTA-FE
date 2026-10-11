import React, { useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

import PortalLayout from "../../layouts/PortalLayout";
import { DetailHeader } from "../../components/ui/DetailBlocks";
import { StepHeading } from "../../components/wizard/ApplicationWizard";
import Combobox from "../../components/ui/Combobox";
import {
  APPLICATION_TYPE_OPTIONS,
  schemeFromEnquiringFor,
} from "../../config/applicationTypes";
import { isAqctaScheme } from "@/config/aqctaServices";
import { customerPath } from "../../routes/paths";

/**
 * AQCTA scheme picker — same 4 options as Enquiring For.
 * Opens the certification wizard with scheme prefilled.
 */
export default function CreateApplication() {
  const history = useHistory();
  const location = useLocation();
  const fromEnquiry = location.state || {};

  const initialScheme = (() => {
    const from = String(fromEnquiry.enquiringFor || "").trim();
    if (isAqctaScheme(from)) return from;
    if (from) return schemeFromEnquiringFor(from);
    return "";
  })();

  const [scheme, setScheme] = useState(initialScheme);
  const [error, setError] = useState("");

  const openWizard = (next) => {
    setScheme(next);
    setError("");
    if (!next) return;
    history.push(`${customerPath.applications}/certification/new`, {
      enquiryId: fromEnquiry.enquiryId,
      scheme: next,
      profileSeed: {
        scheme: next,
        enquiringFor: next,
      },
    });
  };

  return (
    <PortalLayout
      crumbs={[
        { label: "Customer Portal" },
        { label: "Create Application" },
      ]}
    >
      <DetailHeader
        title="Create Application"
        subtitle="Choose the AQCTA scheme you want to apply for. You can start directly or continue from an eligible enquiry."
        onBack={() => history.push(customerPath.applications)}
      />

      <section className="epc-card-panel">
        <StepHeading
          title="Select AQCTA Scheme"
          subtitle="Same services as on aqcta.com — ISO 13485 / MDQMS, GDPMD, CoAWOV, and Technical Documentation CA."
        />

        <div className="epc-typepicker">
          <Combobox
            label="Application For *"
            name="scheme"
            placeholder="Select AQCTA scheme"
            searchPlaceholder="Search scheme…"
            options={APPLICATION_TYPE_OPTIONS}
            value={scheme}
            clearable={false}
            error={error}
            onChange={openWizard}
          />
          <p className="epc-typepicker__hint">
            You will be taken to the application stepper with the selected
            scheme prefilled.
          </p>
          {fromEnquiry.enquiryId && (
            <p className="epc-typepicker__hint">
              Continuing from enquiry <strong>{fromEnquiry.enquiryId}</strong>.
            </p>
          )}
        </div>
      </section>
    </PortalLayout>
  );
}
