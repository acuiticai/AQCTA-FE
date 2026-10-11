/**
 * Filter / status options for the customer portal enquiry screens.
 * Values match the backend Enquiry model (Spam is never shown to customers).
 */

export const ENQUIRY_TYPE_OPTIONS = ["Inspection", "Certification"];

export const ENQUIRY_STATUSES = ["Open", "Converted", "Closed"];

export const DATE_RANGE_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

/** @deprecated Mock list removed — screens fetch via CustomerEnquiryServices. */
export const enquiries = [];

export const findEnquiry = () => null;
