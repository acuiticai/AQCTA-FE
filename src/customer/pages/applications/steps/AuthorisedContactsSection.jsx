import React, { useMemo } from "react";

import Button from "../../../components/ui/Button";
import { ContactPersonField } from "../../../components/ui/ContactPersonField";
import { FormGrid, TextField } from "../../../components/ui/Field";
import { PlusIcon } from "../../../components/ui/icons";
import {
  contact2FieldsFromContact,
  contactFieldsFromContact,
  findContactIndex,
  normalizeCustomerContacts,
} from "../../../utils/customerContacts";

const CONTACT1_DATALIST_ID = "certification-contact-person-1-options";
const CONTACT2_DATALIST_ID = "certification-contact-person-2-options";

/**
 * Authorised Contact Persons block on the certification Applicant step.
 * Contacts can be picked from saved customer contacts or entered manually;
 * all contact fields remain editable after selection.
 */
export default function AuthorisedContactsSection({
  values = {},
  errors = {},
  onChange,
}) {
  const showSecond = Boolean(values.showSecondContact);
  const contacts = useMemo(
    () => normalizeCustomerContacts(values.customerContacts),
    [values.customerContacts],
  );
  const canSuggest = contacts.length > 0;

  const contact2Options = useMemo(() => {
    const primary = String(values.contactPerson || "").trim().toLowerCase();
    if (!primary) return contacts;
    return contacts.filter(
      (contact) => contact.name.toLowerCase() !== primary,
    );
  }, [contacts, values.contactPerson]);

  const set = (name) => (event) => {
    onChange?.(name, event?.target ? event.target.value : event);
  };

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
      contactPosition: "",
      contactPhone: "",
      contactEmail: "",
    });
  };

  const handleContact2PersonChange = (event) => {
    const name = event.target.value;
    const index = findContactIndex(contacts, name);
    if (index >= 0) {
      onChange?.({
        contact2Person: name,
        selectedContact2Index: index,
        ...contact2FieldsFromContact(contacts[index]),
      });
      return;
    }
    onChange?.({
      contact2Person: name,
      selectedContact2Index: "",
    });
  };

  const handleContact2PersonClear = () => {
    onChange?.({
      contact2Person: "",
      selectedContact2Index: "",
      contact2Position: "",
      contact2Phone: "",
      contact2Email: "",
    });
  };

  return (
    <div className="epc-authcontacts">
      <header className="epc-authcontacts__head">
        <h3 className="epc-authcontacts__title">Authorised Contact Persons</h3>
        <p className="epc-authcontacts__subtitle">
          {canSuggest
            ? "Select a saved contact or enter authorised contact details manually."
            : "Enter the authorised contacts who will receive certification correspondence."}
        </p>
      </header>

      <FormGrid>
        <ContactPersonField
          name="contactPerson"
          label="Contact Person 1 *"
          value={values.contactPerson || ""}
          error={errors.contactPerson}
          contacts={contacts}
          datalistId={CONTACT1_DATALIST_ID}
          onChange={handleContactPersonChange}
          onClear={handleContactPersonClear}
        />
        <TextField
          name="contactPosition"
          label="Position *"
          value={values.contactPosition || ""}
          error={errors.contactPosition}
          onChange={set("contactPosition")}
        />
        <TextField
          name="contactPhone"
          label="Phone / Mobile *"
          type="tel"
          value={values.contactPhone || ""}
          error={errors.contactPhone}
          onChange={set("contactPhone")}
        />
        <TextField
          name="contactEmail"
          label="Email *"
          type="email"
          value={values.contactEmail || ""}
          error={errors.contactEmail}
          onChange={set("contactEmail")}
        />
      </FormGrid>

      {showSecond ? (
        <div className="epc-authcontacts__second">
          <div className="epc-repeater__head">
            <span className="epc-repeater__title">Second authorised contact</span>
            <button
              type="button"
              className="epc-repeater__remove"
              onClick={() => {
                onChange?.({
                  showSecondContact: false,
                  contact2Person: "",
                  contact2Position: "",
                  contact2Phone: "",
                  contact2Email: "",
                  selectedContact2Index: "",
                });
              }}
            >
              Remove
            </button>
          </div>
          <FormGrid>
            <ContactPersonField
              name="contact2Person"
              label="Contact Person 2"
              value={values.contact2Person || ""}
              contacts={contact2Options}
              datalistId={CONTACT2_DATALIST_ID}
              onChange={handleContact2PersonChange}
              onClear={handleContact2PersonClear}
            />
            <TextField
              name="contact2Position"
              label="Position"
              value={values.contact2Position || ""}
              onChange={set("contact2Position")}
            />
            <TextField
              name="contact2Phone"
              label="Phone / Mobile"
              type="tel"
              value={values.contact2Phone || ""}
              onChange={set("contact2Phone")}
            />
            <TextField
              name="contact2Email"
              label="Email"
              type="email"
              value={values.contact2Email || ""}
              error={errors.contact2Email}
              onChange={set("contact2Email")}
            />
          </FormGrid>
        </div>
      ) : (
        <div className="epc-authcontacts__add">
          <div>
            <p className="epc-authcontacts__add-title">Second authorised contact</p>
            <p className="epc-authcontacts__add-body">
              Add another authorised representative for certification correspondence.
            </p>
          </div>
          <Button
            variant="secondary"
            type="button"
            onClick={() => onChange?.("showSecondContact", true)}
          >
            <PlusIcon size={15} />
            Add Contact
          </Button>
        </div>
      )}
    </div>
  );
}
