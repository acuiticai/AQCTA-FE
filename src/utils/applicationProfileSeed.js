import {
  contactFieldsFromContact,
  normalizeCustomerContacts,
} from "@/customer/utils/customerContacts";

/**
 * Prefill shape shared by customer portal and admin application wizards.
 * Mirrors CustomerPortal buildCustomerProfile + ApplicationWizardPage profileSeed.
 */

export const profileSeed = (profile = {}, account = {}) => {
  const contacts = normalizeCustomerContacts(
    Array.isArray(profile.contacts)
      ? profile.contacts
      : Array.isArray(account.contacts)
        ? account.contacts
        : [],
  );
  const primary = contacts[0] || {};
  const secondary = contacts[1] || null;
  const secondaryIndex = secondary
    ? contacts.findIndex((contact) => contact.name === secondary.name)
    : -1;
  const primaryFields = contactFieldsFromContact(primary);

  const companyName =
    profile.companyName || account.companyName || account.name || "";
  const email =
    profile.companyEmail || profile.email || account.email || "";
  const phone =
    profile.phone ||
    primary.mobile ||
    primary.phone ||
    account.phone ||
    "";

  return {
    companyName,
    registrationNumber:
      profile.registrationNumber || account.registrationNumber || "",
    companyEmail: email,
    website: profile.website || account.website || "",
    companyAddress:
      profile.companyAddress || account.companyAddress || account.address || "",
    companyStreet: profile.streetAddress || account.streetAddress || "",
    companyBlock: profile.block || account.block || "",
    companyGpsCoordinates:
      profile.gpsCoordinates || account.gpsCoordinates || "",
    customerContacts: contacts,
    selectedContactIndex: contacts.length ? 0 : "",
    contactPerson:
      primaryFields.contactPerson ||
      profile.contactPerson ||
      account.contactPerson ||
      companyName,
    contactPosition:
      primaryFields.contactPosition ||
      profile.contactPosition ||
      account.contactPosition ||
      "",
    contactPhone:
      primaryFields.contactPhone ||
      profile.contactPhone ||
      account.contactPhone ||
      phone,
    contactEmail:
      primaryFields.contactEmail ||
      profile.contactEmail ||
      account.contactEmail ||
      email,
    showSecondContact: Boolean(secondary),
    selectedContact2Index: secondaryIndex >= 0 ? String(secondaryIndex) : "",
    contact2Person: secondary?.name || "",
    contact2Position: secondary?.position || "",
    contact2Phone: secondary?.mobile || secondary?.phone || "",
    contact2Email: secondary?.email || "",
    /** Inspection wizard aliases */
    email: primaryFields.email || email,
    telephone: primaryFields.telephone || phone,
  };
};

const formatAddress = (basic = {}) => {
  const parts = [
    basic.addressLine1 || basic.street || basic.address,
    basic.addressLine2,
    basic.city,
    basic.state || basic.stateProvince,
    basic.postcode || basic.postalCode || basic.zip,
    basic.country,
  ]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return parts.join(", ");
};

const mapKeyContacts = (keyContacts = []) =>
  (Array.isArray(keyContacts) ? keyContacts : [])
    .filter((c) => c && String(c.name || "").trim())
    .map((c) => ({
      name: String(c.name || "").trim(),
      position: String(c.position || c.designation || "").trim(),
      phone: String(c.phone || c.contactNumber || "").trim(),
      mobile: String(c.mobile || "").trim(),
      email: String(c.email || "").trim(),
    }));

/** Map admin New_Customer document → profileSeed input. */
export const nCustomerToProfile = (customer = {}) => {
  const basic = customer.basicInformation || {};
  const companyInfo = customer.companyInfo || {};
  const contacts = mapKeyContacts(customer.keyContacts);

  return {
    companyName:
      basic.companyName || basic.customerDisplayName || "",
    registrationNumber:
      basic.companyRegistrationNumber ||
      companyInfo.registrationNumber ||
      customer.eInvoiceInfo?.registrationNumber ||
      "",
    website: basic.website || companyInfo.companyWebsite || "",
    companyEmail: basic.customerEmail || "",
    companyAddress:
      formatAddress(basic) || companyInfo.registeredAddress || "",
    streetAddress: basic.street || basic.addressLine1 || basic.streetAddress || "",
    block: basic.block || basic.addressLine2 || "",
    gpsCoordinates: basic.gpsCoordinates || "",
    phone:
      basic.customerPhone?.mobile ||
      basic.customerPhone?.workPhone ||
      contacts[0]?.mobile ||
      contacts[0]?.phone ||
      "",
    contacts,
  };
};

export const customerLabel = (customer = {}) => {
  const basic = customer.basicInformation || {};
  return (
    basic.customerDisplayName ||
    basic.companyName ||
    basic.customerEmail ||
    "Customer"
  );
};

/**
 * Map enquiry fields onto application wizard values.
 * Only fills what the enquiry actually has — remaining fields stay for the form.
 */
export const enquiryToApplicationFormSeed = (enquiry = {}) => {
  const companyName = String(enquiry.companyName || "").trim();
  const name = String(enquiry.name || "").trim();
  const email = String(enquiry.email || "").trim();
  const phone = String(enquiry.phone || "").trim();
  const notes = String(enquiry.enquiry || "").trim();

  const serviceParts = [
    ...(Array.isArray(enquiry.mandatoryInspectionServices)
      ? enquiry.mandatoryInspectionServices
      : []),
    enquiry.mandatoryInspectionOthers,
    ...(Array.isArray(enquiry.thirdPartyInspectionServices)
      ? enquiry.thirdPartyInspectionServices
      : []),
    enquiry.thirdPartyInspectionOthers,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  const projectDescription = [notes, serviceParts.length ? `Requested services:\n${serviceParts.join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const seed = {};
  if (companyName) seed.companyName = companyName;
  if (email) {
    seed.companyEmail = email;
    seed.email = email;
    seed.contactEmail = email;
  }
  if (phone) {
    seed.contactPhone = phone;
    seed.telephone = phone;
    seed.siteTelephone = phone;
  }
  if (name) seed.contactPerson = name;
  if (companyName || name) seed.siteName = companyName || name;
  if (projectDescription) seed.projectDescription = projectDescription;

  const scheme = String(enquiry.enquiringFor || "").trim();
  if (scheme && scheme !== "Inspection") {
    seed.scheme = scheme === "Certification" ? "ISO 13485 / MDQMS" : scheme;
    seed.enquiringFor = seed.scheme;
  }

  return seed;
};

/** Merge customer profile seed with enquiry overrides (enquiry fills gaps / contact fields). */
export const mergeApplicationSeeds = (customerSeed = {}, enquirySeed = {}) => {
  const merged = { ...customerSeed };
  Object.entries(enquirySeed || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (!merged[key] || String(merged[key]).trim() === "") {
      merged[key] = value;
      return;
    }
    // Prefer enquiry contact/company identity when both exist
    if (
      [
        "companyName",
        "companyEmail",
        "email",
        "contactPerson",
        "contactEmail",
        "contactPhone",
        "telephone",
        "projectDescription",
      ].includes(key)
    ) {
      merged[key] = value;
    }
  });
  return merged;
};
