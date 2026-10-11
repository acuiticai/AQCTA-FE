import React from "react";

import Combobox from "./ui/Combobox";
import { TextField } from "./ui/Field";
import {
  MANDATORY_INSPECTION_SERVICE_OPTIONS,
  THIRD_PARTY_INSPECTION_SERVICE_OPTIONS,
  includesInspectionOthers,
} from "../data/enquiryOptions";

/** Close the multi-select when Others is chosen so the specify field is visible. */
const closeWhenOthersSelected = (option) =>
  String(option?.value || "")
    .trim()
    .toLowerCase()
    .startsWith("others");

/**
 * AQCTA-FOR-06-01 Section A / B multi-selects for Inspection enquiries.
 * Same behaviour as admin EnquiryForm: multi-select + conditional Others text.
 */
export default function InspectionEnquiryFields({
  values,
  errors = {},
  onChange,
  full = true,
}) {
  const sectionA = values.mandatoryInspectionServices || [];
  const sectionB = values.thirdPartyInspectionServices || [];

  return (
    <>
      <Combobox
        full={full}
        multiple
        searchable={false}
        label="Mandatory Inspection Services *"
        name="mandatoryInspectionServices"
        placeholder="Select one or more"
        options={MANDATORY_INSPECTION_SERVICE_OPTIONS}
        value={sectionA}
        onChange={(next) => onChange("mandatoryInspectionServices", next)}
        shouldCloseAfterSelect={closeWhenOthersSelected}
        error={errors.mandatoryInspectionServices}
      />
      {includesInspectionOthers(sectionA) ? (
        <TextField
          full={full}
          label="Please specify (Others) *"
          name="mandatoryInspectionOthers"
          placeholder="Enter the other mandatory inspection service"
          value={values.mandatoryInspectionOthers || ""}
          autoFocus
          onChange={(event) =>
            onChange(
              "mandatoryInspectionOthers",
              event?.target ? event.target.value : event,
            )
          }
          error={errors.mandatoryInspectionOthers}
        />
      ) : null}

      <Combobox
        full={full}
        multiple
        searchable={false}
        label="Third Party Inspection, Verification and Endorsement"
        name="thirdPartyInspectionServices"
        placeholder="Select one or more"
        options={THIRD_PARTY_INSPECTION_SERVICE_OPTIONS}
        value={sectionB}
        onChange={(next) => onChange("thirdPartyInspectionServices", next)}
        shouldCloseAfterSelect={closeWhenOthersSelected}
        error={errors.thirdPartyInspectionServices}
      />
      {includesInspectionOthers(sectionB) ? (
        <TextField
          full={full}
          label="Please specify (Others) *"
          name="thirdPartyInspectionOthers"
          placeholder="Enter the other third party inspection service"
          value={values.thirdPartyInspectionOthers || ""}
          autoFocus
          onChange={(event) =>
            onChange(
              "thirdPartyInspectionOthers",
              event?.target ? event.target.value : event,
            )
          }
          error={errors.thirdPartyInspectionOthers}
        />
      ) : null}
    </>
  );
}
