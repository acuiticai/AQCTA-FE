import React, { useId } from "react";

import { contactOptionLabel } from "../../utils/customerContacts";
import { Field } from "./Field";
import { ChevronDownIcon, CloseIcon } from "./icons";

/**
 * Contact name input with optional saved-contact suggestions (datalist),
 * a clear control, and a caret when suggestions are available.
 */
export function ContactPersonField({
  label,
  name,
  value = "",
  error,
  hint,
  full = false,
  contacts = [],
  placeholder = "Contact person name",
  suggestPlaceholder = "Select or type contact name",
  datalistId: datalistIdProp,
  onChange,
  onClear,
}) {
  const generatedId = useId();
  const inputId = generatedId;
  const datalistId = datalistIdProp || `${inputId}-options`;
  const canSuggest = contacts.length > 0;
  const showClear = Boolean(String(value || "").trim());

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} full={full}>
      <span
        className={[
          "epc-field__control",
          canSuggest ? "epc-contact-person" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          id={inputId}
          name={name}
          className={[
            "epc-input",
            showClear ? "epc-input--has-clear" : "",
            canSuggest ? "epc-input--has-caret" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          value={value}
          placeholder={canSuggest ? suggestPlaceholder : placeholder}
          list={canSuggest ? datalistId : undefined}
          aria-invalid={error ? "true" : undefined}
          onChange={onChange}
        />
        {showClear && (
          <button
            type="button"
            className="epc-contact-person__clear"
            aria-label={`Clear ${label || "contact"}`}
            onClick={(event) => {
              event.preventDefault();
              onClear?.();
            }}
            tabIndex={-1}
          >
            <CloseIcon size={13} />
          </button>
        )}
        {canSuggest && (
          <span
            className={[
              "epc-select-caret",
              showClear ? "epc-select-caret--shifted" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          >
            <ChevronDownIcon />
          </span>
        )}
      </span>
      {canSuggest && (
        <datalist id={datalistId}>
          {contacts.map((contact, index) => (
            <option
              key={`${contact.name}-${index}`}
              value={contact.name}
              label={contactOptionLabel(contact)}
            />
          ))}
        </datalist>
      )}
    </Field>
  );
}
