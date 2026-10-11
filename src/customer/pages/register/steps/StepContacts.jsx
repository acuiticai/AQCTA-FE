import React from "react";

import Button from "../../../components/ui/Button";
import { FormGrid, TextField } from "../../../components/ui/Field";
import { PlusIcon } from "../../../components/ui/icons";
import { useRegistration } from "../../../context/RegistrationContext";
import { isEmail, isFilled } from "../../../utils/validation";

export default function StepContacts() {
  const {
    data,
    errors,
    setErrors,
    updateContact,
    addContact,
    removeContact,
    goNext,
    goBack,
  } = useRegistration();
  const contacts = data.contacts;

  const setField = (index, field) => (event) => {
    updateContact(index, { [field]: event.target.value });
    setErrors((prev) => ({ ...prev, [`${index}.${field}`]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};
    contacts.forEach((contact, index) => {
      if (!isFilled(contact.name)) {
        nextErrors[`${index}.name`] = "Contact name is required";
      }
      if (!isFilled(contact.phone)) {
        nextErrors[`${index}.phone`] = "Phone number is required";
      }
      if (!isFilled(contact.email)) {
        nextErrors[`${index}.email`] = "Email is required";
      } else if (!isEmail(contact.email)) {
        nextErrors[`${index}.email`] = "Enter a valid email address";
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    goNext();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="epc-repeater">
        {contacts.map((contact, index) => (
          // Contacts are positional rows with no stable id until they are saved.
          <div className="epc-repeater__item" key={index}>
            {contacts.length > 1 && (
              <div className="epc-repeater__head">
                <span className="epc-repeater__title">
                  Contact {index + 1}
                </span>
                <button
                  type="button"
                  className="epc-repeater__remove"
                  onClick={() => removeContact(index)}
                >
                  Remove
                </button>
              </div>
            )}

            <FormGrid>
              <TextField
                label="Name *"
                name={`contact-${index}-name`}
                autoComplete="name"
                placeholder="Enter contact name"
                value={contact.name}
                onChange={setField(index, "name")}
                error={errors[`${index}.name`]}
              />
              <TextField
                label="Position (Optional)"
                name={`contact-${index}-position`}
                placeholder="Enter position"
                value={contact.position}
                onChange={setField(index, "position")}
              />
              <TextField
                label="Phone No. *"
                name={`contact-${index}-phone`}
                type="tel"
                inputMode="tel"
                placeholder="Enter phone number"
                value={contact.phone}
                onChange={setField(index, "phone")}
                error={errors[`${index}.phone`]}
              />
              <TextField
                label="Mobile No. (Optional)"
                name={`contact-${index}-mobile`}
                placeholder="Enter mobile number"
                value={contact.mobile}
                onChange={setField(index, "mobile")}
              />
              <TextField
                label="Email *"
                type="email"
                name={`contact-${index}-email`}
                placeholder="contact@company.com"
                value={contact.email}
                onChange={setField(index, "email")}
                error={errors[`${index}.email`]}
              />
            </FormGrid>
          </div>
        ))}
      </div>

      <div className="epc-add-row">
        <Button type="button" variant="ghost" onClick={addContact}>
          <PlusIcon />
          Add another contact
        </Button>
      </div>

      <div className="epc-form-actions epc-form-actions--end">
        <Button
          type="button"
          variant="secondary"
          className="epc-form-actions__back"
          onClick={goBack}
        >
          Back
        </Button>
        <Button type="submit" className="epc-form-actions__next">
          Continue
        </Button>
      </div>
    </form>
  );
}
