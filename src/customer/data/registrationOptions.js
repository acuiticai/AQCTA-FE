/**
 * Option sources for the registration wizard selects.
 *
 * These are the front-end defaults; each list is designed to be swapped for a
 * lookup call once the customer-onboarding endpoints land, without touching the
 * screens (the steps only read from here).
 */

export const REGISTRATION_STEPS = [
  { key: "company", title: "Company", caption: "Details" },
  { key: "address", title: "Address", caption: "Location" },
  { key: "contacts", title: "Contacts", caption: "People" },
  { key: "documents", title: "Documents", caption: "Files" },
];

/**
 * Must stay in step with `ADDRESS_LABEL_OPTIONS` in
 * `pages/Customer/components/BasicInformation.jsx` — a label the customer picks
 * here has to be one the admin customer record can display.
 */
export const ADDRESS_LABEL_OPTIONS = ["HQ", "Inspection", "Certification"];

/*
 * Country, state and city are no longer listed here: the address step reads
 * them from `@/utils/locationCascade` (country-state-city + MY city supplement),
 * the same source the admin form uses. Post code and GPS are free text there.
 */
