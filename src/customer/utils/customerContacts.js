/**
 * Normalise key contacts from admin customer records / portal profile.
 */

export const normalizeCustomerContact = (contact = {}) => ({
  name: String(contact.name || "").trim(),
  position: String(contact.position || contact.designation || "").trim(),
  phone: String(contact.phone || contact.contactNumber || "").trim(),
  mobile: String(contact.mobile || "").trim(),
  email: String(contact.email || "").trim(),
});

export const normalizeCustomerContacts = (contacts = []) =>
  (Array.isArray(contacts) ? contacts : [])
    .map(normalizeCustomerContact)
    .filter((contact) => contact.name);

export const contactTelephone = (contact = {}) =>
  contact.mobile || contact.phone || "";

export const contactOptionLabel = (contact = {}) => {
  const parts = [contact.name];
  const phone = contactTelephone(contact);
  if (contact.position) parts.push(contact.position);
  if (phone) parts.push(phone);
  return parts.filter(Boolean).join(" · ");
};

export const buildContactOptions = (contacts = []) =>
  normalizeCustomerContacts(contacts).map((contact, index) => ({
    value: String(index),
    label: contactOptionLabel(contact),
  }));

export const contactFieldsFromContact = (contact = {}) => ({
  contactPerson: contact.name || "",
  contactPosition: contact.position || "",
  email: contact.email || "",
  telephone: contactTelephone(contact),
  contactPhone: contactTelephone(contact),
  contactEmail: contact.email || "",
});

export const contact2FieldsFromContact = (contact = {}) => ({
  contact2Person: contact.name || "",
  contact2Position: contact.position || "",
  contact2Phone: contactTelephone(contact),
  contact2Email: contact.email || "",
});

export const findContactIndex = (contacts = [], person = "") => {
  const needle = String(person || "").trim().toLowerCase();
  if (!needle) return -1;
  return normalizeCustomerContacts(contacts).findIndex(
    (contact) => contact.name.toLowerCase() === needle,
  );
};

export const resolveSelectedContactIndex = ({
  contacts = [],
  selectedContactIndex,
  contactPerson,
} = {}) => {
  const list = normalizeCustomerContacts(contacts);
  if (!list.length) return "";

  const savedIndex = Number(selectedContactIndex);
  if (
    Number.isInteger(savedIndex) &&
    savedIndex >= 0 &&
    savedIndex < list.length
  ) {
    return String(savedIndex);
  }

  const matched = findContactIndex(list, contactPerson);
  if (matched >= 0) return String(matched);

  return "0";
};
