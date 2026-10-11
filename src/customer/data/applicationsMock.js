/**
 * Filter option constants for the customer applications list.
 * List / detail / create now go through CustomerApplicationServices.
 */

import { APPLICATION_SERVICE_OPTIONS } from "@/config/aqctaServices";

export const APPLICATION_SERVICES = [...APPLICATION_SERVICE_OPTIONS];

export const APPLICATION_STATUSES = [
  "Draft",
  "Under Review",
  "Scheduled",
  "In Progress",
  "Certified",
  "Completed",
  "Action Required",
  "Resubmitted",
  "Approved",
  "Rejected",
];

/** @deprecated Mock list removed — screens fetch via CustomerApplicationServices. */
export const applications = [];

export const findApplication = () => null;
