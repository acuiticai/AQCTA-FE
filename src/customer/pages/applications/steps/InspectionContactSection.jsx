import React, { useMemo } from "react";

import { ContactPersonField } from "../../../components/ui/ContactPersonField";
import { FormGrid, TextField } from "../../../components/ui/Field";
import {
  contactFieldsFromContact,
  findContactIndex,
  normalizeCustomerContacts,
} from "../../../utils/customerContacts";

const CONTACT_DATALIST_ID = "inspection-contact-person-options";

/**
 * Inspection applicant contact block — pick a saved customer contact or enter
 * details manually for this application.
 */
export default function InspectionContactSection({
  values = {},
  errors = {},
  onChange,
}) {
  const contacts = useMemo(
    () => normalizeCustomerContacts(values.customerContacts),
    [values.customerContacts],
  );
  const canSuggest = contacts.length > 0;

  const handleContactPersonChange = (event) => {
    const name = event.target.value;
    const index = findContactIndex(contacts, name);
    if (index >= 0) {
      onChange?.({
        contactPerson: name,
        selectedContactIndex: index,
        ...contactFieldsFromContact(contacts[index]),
      });
      return;
    }
    onChange?.({
      contactPerson: name,
      selectedContactIndex: "",
    });
  };

  const handleContactPersonClear = () => {
    onChange?.({
      contactPerson: "",
      selectedContactIndex: "",
      email: "",
      telephone: "",
    });
  };

  const setField = (name) => (event) => {
    onChange?.({ [name]: event.target.value });
  };

  return (
    <div className="epc-authcontacts">
      <header className="epc-authcontacts__head">
        <h3 className="epc-authcontacts__title">Contact Person</h3>
        <p className="epc-authcontacts__subtitle">
          {canSuggest
            ? "Select a saved contact or enter contact details manually."
            : "Enter the primary contact for this inspection application."}
        </p>
      </header>

      <FormGrid>
        <ContactPersonField
          name="contactPerson"
          label="Contact Person *"
          value={values.contactPerson || ""}
          error={errors.contactPerson}
          contacts={contacts}
          datalistId={CONTACT_DATALIST_ID}
          onChange={handleContactPersonChange}
          onClear={handleContactPersonClear}
        />

        <TextField
          name="email"
          label="Email *"
          type="email"
          value={values.email || ""}
          error={errors.email}
          onChange={setField("email")}
        />
        <TextField
          name="telephone"
          label="Tel. *"
          type="tel"
          value={values.telephone || ""}
          error={errors.telephone}
          onChange={setField("telephone")}
        />
        <TextField
          name="contactPosition"
          label="Designation"
          value={values.contactPosition || ""}
          error={errors.contactPosition}
          onChange={setField("contactPosition")}
        />
      </FormGrid>
    </div>
  );
}
