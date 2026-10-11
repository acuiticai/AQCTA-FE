import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";
import { notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const cellInputClass =
  "w-full min-w-[120px] border-0 rounded-none p-2 bg-transparent text-gray-900 placeholder:text-gray-400 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:bg-gray-50";

const emptyContact = () => ({
  name: "",
  position: "",
  phone: "",
  mobile: "",
  fax: "",
  email: "",
});

/** Map legacy contact fields → PCI Contact Persons shape. */
export const normalizeKeyContact = (contact = {}) => ({
  _id: contact._id,
  id: contact.id,
  name: contact.name || "",
  position: contact.position || contact.designation || "",
  phone: contact.phone || contact.contactNumber || "",
  mobile: contact.mobile || "",
  fax: contact.fax || "",
  email: contact.email || "",
});

const contactHasAnyValue = (contact) =>
  Boolean(
    [contact?.name, contact?.position, contact?.phone, contact?.mobile, contact?.fax, contact?.email]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .some(Boolean)
  );

const KeyContact = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      return initialData.map(normalizeKeyContact);
    }
    return [emptyContact()];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContactIndex, setSelectedContactIndex] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      const normalized = initialData.map(normalizeKeyContact);
      setContacts(normalized);
      const initialTouched = {};
      normalized.forEach((_, index) => {
        ["name", "position", "phone", "mobile", "fax", "email"].forEach((field) => {
          initialTouched[`${index}_${field}`] = false;
        });
      });
      setTouched(initialTouched);
    }
    validateFormSilently();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const contactFieldLabels = {
    name: t("customer.contacts.name"),
    position: t("customer.contacts.position"),
    phone: t("customer.contacts.phone"),
    mobile: t("customer.contacts.mobile"),
    fax: t("customer.contacts.fax"),
    email: t("customer.contacts.email"),
  };

  const validatePhoneLike = (value) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const plusOccurrences = (trimmed.match(/\+/g) || []).length;
    if (plusOccurrences > 1 || (plusOccurrences === 1 && trimmed[0] !== "+")) {
      return t("customer.validation.invalidPhone");
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return t("customer.validation.invalidPhone");
    }
    return "";
  };

  const validateField = (index, field, value, contact) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    const rowHasData = contactHasAnyValue(contact);

    // Only Name is required, and only when the row has any data
    if (field === "name") {
      if (rowHasData && !trimmed) {
        return t("customer.validation.fieldRequired", {
          field: contactFieldLabels.name,
        });
      }
      return "";
    }

    if (!trimmed) return "";

    if (field === "email") {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmed)) {
        return t("customer.validation.invalidEmail");
      }
      return "";
    }

    if (field === "phone" || field === "mobile" || field === "fax") {
      return validatePhoneLike(trimmed);
    }

    return "";
  };

  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    contacts.forEach((contact, index) => {
      ["name", "position", "phone", "mobile", "fax", "email"].forEach((field) => {
        const error = validateField(index, field, contact[field], contact);
        if (error) {
          newErrors[`${index}_${field}`] = error;
          isValid = false;
        }
      });
    });

    setErrors(newErrors);
    setValidationErrors?.({ keyContacts: !isValid });
    return isValid;
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    contacts.forEach((contact, index) => {
      ["name", "position", "phone", "mobile", "fax", "email"].forEach((field) => {
        const fieldId = `${index}_${field}`;
        const error = validateField(index, field, contact[field], contact);

        if (touched[fieldId] && error) {
          newErrors[fieldId] = error;
        }
        if (error) {
          isValid = false;
        }
      });
    });

    setErrors(newErrors);
    setValidationErrors?.({ keyContacts: !isValid });
    return isValid;
  };

  const notifyParent = (updatedContacts) => {
    const forSave = updatedContacts
      .filter(contactHasAnyValue)
      .map(({ _id, id, name, position, phone, mobile, fax, email }) => ({
        ...(_id ? { _id } : {}),
        ...(id ? { id } : {}),
        name: name?.trim() || "",
        position: position?.trim() || "",
        phone: phone?.trim() || "",
        mobile: mobile?.trim() || "",
        fax: fax?.trim() || "",
        email: email?.trim() || "",
      }));
    onChange?.(forSave);
  };

  const updateParent = (updatedContacts) => {
    setContacts(updatedContacts);
    notifyParent(updatedContacts);
    validateForm();
  };

  useEffect(() => {
    validateForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, touched]);

  const handleChange = (index, field, value) => {
    const updatedContacts = contacts.map((contact, i) =>
      i === index ? { ...contact, [field]: value } : contact
    );

    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));

    updateParent(updatedContacts);
  };

  const handleBlur = (index, field) => {
    setTouched((prev) => ({
      ...prev,
      [`${index}_${field}`]: true,
    }));
    validateForm();
  };

  const addContact = () => {
    const newContacts = [...contacts, emptyContact()];
    const newIndex = contacts.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_name`]: false,
      [`${newIndex}_position`]: false,
      [`${newIndex}_phone`]: false,
      [`${newIndex}_mobile`]: false,
      [`${newIndex}_fax`]: false,
      [`${newIndex}_email`]: false,
    }));
    updateParent(newContacts);
  };

  const contactRowIsDeletable = (contact) => {
    if (contact?._id || contact?.id) return true;
    if (contacts.length > 1) return true;
    return contactHasAnyValue(contact);
  };

  const confirmDelete = (index, contactId) => {
    const contact = contacts[index];
    const id = contact?._id ?? contact?.id ?? contactId;

    if (!contactHasAnyValue(contact)) {
      removeContact(index, id, false);
    } else {
      setSelectedContactIndex(index);
      setSelectedContactId(id);
      setIsModalOpen(true);
    }
  };

  const removeContact = async (index, contactId, showMessage = true) => {
    if (!contactId) {
      const updatedContacts = contacts.filter((_, i) => i !== index);
      const finalContacts =
        updatedContacts.length === 0 ? [emptyContact()] : updatedContacts;
      updateParent(finalContacts);
      if (showMessage) {
        notifySuccess(t("customer.contacts.removedSuccess"));
      }
      return;
    }

    if (!customerId) {
      console.error("❌ Error: Customer ID is missing");
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/customers/${customerId}/keyContacts/${String(contactId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        const updatedContacts = contacts.filter((_, i) => i !== index);
        const finalContacts =
          updatedContacts.length === 0 ? [emptyContact()] : updatedContacts;
        updateParent(finalContacts);
        if (showMessage) {
          notifySuccess(t("customer.contacts.deletedSuccess"));
        }
      } else {
        console.error("❌ Failed to delete contact", await response.json());
      }
    } catch (error) {
      console.error("❌ Error in delete request:", error);
    } finally {
      setIsModalOpen(false);
    }
  };

  const sanitizePhoneInput = (raw) =>
    raw.replace(/[^0-9+\s\-()]/g, "");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse border border-gray-200">
        <thead>
          <tr className="text-left">
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.name")}
              <span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.position")}
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.phone")}
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.mobile")}
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.email")}
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800 w-[72px] text-center">
              {t("customer.contacts.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => (
            <tr
              key={contact._id || contact.id || `contact-${index}`}
              className="bg-white"
            >
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                  onBlur={() => handleBlur(index, "name")}
                  placeholder={t("customer.contacts.enterName")}
                  className={cellInputClass}
                  autoComplete="name"
                />
                {errors[`${index}_name`] && touched[`${index}_name`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_name`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="text"
                  value={contact.position}
                  onChange={(e) =>
                    handleChange(index, "position", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "position")}
                  placeholder={t("customer.contacts.enterPosition")}
                  className={cellInputClass}
                />
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) =>
                    handleChange(index, "phone", sanitizePhoneInput(e.target.value))
                  }
                  onBlur={() => handleBlur(index, "phone")}
                  placeholder={t("customer.contacts.enterPhone")}
                  className={cellInputClass}
                />
                {errors[`${index}_phone`] && touched[`${index}_phone`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_phone`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="tel"
                  value={contact.mobile}
                  onChange={(e) =>
                    handleChange(
                      index,
                      "mobile",
                      sanitizePhoneInput(e.target.value)
                    )
                  }
                  onBlur={() => handleBlur(index, "mobile")}
                  placeholder={t("customer.contacts.enterMobile")}
                  className={cellInputClass}
                />
                {errors[`${index}_mobile`] && touched[`${index}_mobile`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_mobile`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => handleChange(index, "email", e.target.value)}
                  onBlur={() => handleBlur(index, "email")}
                  placeholder={t("customer.contacts.enterEmail")}
                  className={cellInputClass}
                />
                {errors[`${index}_email`] && touched[`${index}_email`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_email`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 text-center align-middle">
                {contactRowIsDeletable(contact) ? (
                  <button
                    type="button"
                    onClick={() =>
                      confirmDelete(index, contact._id ?? contact.id)
                    }
                    className="inline-flex text-red-500 hover:text-red-700"
                    aria-label={t("customer.contacts.removeContact")}
                  >
                    <FiTrash />
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan={6}
              className="py-2 px-4 border-b border-gray-200 text-left"
            >
              <button
                type="button"
                onClick={addContact}
                className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium cursor-pointer bg-transparent border-0 p-0"
              >
                <FiPlus className="shrink-0" />
                <span>{t("customer.shared.addMore")}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedContactIndex(null);
          setSelectedContactId(null);
        }}
        onConfirm={() => {
          const indexToRemove = selectedContactIndex;
          const idToRemove = selectedContactId;
          setIsModalOpen(false);
          setSelectedContactIndex(null);
          setSelectedContactId(null);
          removeContact(indexToRemove, idToRemove);
        }}
      />
    </div>
  );
};

export default KeyContact;
