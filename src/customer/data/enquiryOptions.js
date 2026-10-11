/** Field sources for the enquiry form. */

import { ENQUIRING_FOR_OPTIONS as AQCTA_ENQUIRING_FOR } from "@/config/aqctaServices";

/** Demo: AQCTA medical CAB schemes only (Engineering Inspection hidden). */
export const ENQUIRING_FOR_OPTIONS = [...AQCTA_ENQUIRING_FOR];

export const ENQUIRY_CHANNEL_OPTIONS = ["Walk-in", "Domestic", "International"];

export const ENQUIRY_STATUS_OPTIONS = ["Spam", "Open", "Converted", "Closed"];

/**
 * Legacy engineering-inspection enquiry options (hidden from demo pickers;
 * kept so old Inspection rows still render).
 */
export const INSPECTION_OTHERS_VALUE = "Others (Please Specify)";

/** Section A. Mandatory Inspection Services */
export const MANDATORY_INSPECTION_SERVICE_OPTIONS = [
  "Review and verification of design drawing and stress calculations of steam boilers, unfired pressure vessels and pipelines",
  "Witnessing, inspection, verification and approval of new, used or in-services local or imported steam boilers, unfired pressure vessels and pipelines",
  "Witnessing, verification and approval of Welding Procedure Specification (WPS), WPQT and electrode approval performed by competent firms for steam boilers, unfired pressure vessels, gas pipelines and hoisting machines",
  INSPECTION_OTHERS_VALUE,
];

/** Section B. Third Party Inspection, Verification and Endorsement */
export const THIRD_PARTY_INSPECTION_SERVICE_OPTIONS = [
  "Inspection Before, During and After Construction",
  "Compliance Inspection on Imported and In-service Industrial Equipment and Machinery",
  "Condition monitoring and Plant Assessment",
  "Non-Destructive Evaluation (Witness and Verification of Test Report)",
  "Endorsement of Failure Investigation and Analysis Report",
  INSPECTION_OTHERS_VALUE,
];

export const includesInspectionOthers = (selected = []) => {
  if (!Array.isArray(selected)) return false;
  return selected.some((item) => {
    const value = String(item || "")
      .trim()
      .toLowerCase();
    return (
      value === String(INSPECTION_OTHERS_VALUE).toLowerCase() ||
      value.startsWith("others")
    );
  });
};

/** Empty Inspection-specific payload when type is not Inspection. */
export const emptyInspectionEnquiryFields = () => ({
  mandatoryInspectionServices: [],
  mandatoryInspectionOthers: "",
  thirdPartyInspectionServices: [],
  thirdPartyInspectionOthers: "",
});

/**
 * Dial codes offered by the phone field. Malaysia leads as the home market.
 * Labelled by ISO code rather than a flag emoji — Windows ships no flag font,
 * so the emoji would degrade to bare letters anyway.
 */
export const DIAL_CODES = [
  { code: "MY", dialCode: "+60", name: "Malaysia" },
  { code: "SG", dialCode: "+65", name: "Singapore" },
  { code: "ID", dialCode: "+62", name: "Indonesia" },
  { code: "TH", dialCode: "+66", name: "Thailand" },
  { code: "BN", dialCode: "+673", name: "Brunei" },
  { code: "VN", dialCode: "+84", name: "Vietnam" },
  { code: "PH", dialCode: "+63", name: "Philippines" },
  { code: "IN", dialCode: "+91", name: "India" },
  { code: "CN", dialCode: "+86", name: "China" },
  { code: "JP", dialCode: "+81", name: "Japan" },
  { code: "KR", dialCode: "+82", name: "South Korea" },
  { code: "AU", dialCode: "+61", name: "Australia" },
  { code: "GB", dialCode: "+44", name: "United Kingdom" },
  { code: "US", dialCode: "+1", name: "United States" },
  { code: "AE", dialCode: "+971", name: "United Arab Emirates" },
];

export const DEFAULT_DIAL_CODE = "+60";
