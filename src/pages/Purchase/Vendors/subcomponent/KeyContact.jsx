import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";
import { notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const cellInputClass =
  "w-full min-w-[120px] border-0 rounded-none p-2 bg-transparent text-gray-900 placeholder:text-gray-400 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:bg-gray-50";

const KeyContact = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState(
    Array.isArray(initialData) && initialData.length > 0
      ? initialData
      : [
          {
            name: "",
            contactNumber: "",
            designation: "",
            email: "",
            department: "",
          },
        ]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContactIndex, setSelectedContactIndex] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (Array.isArray(initialData) && initialData.length > 0) {
      setContacts(initialData);
      // Initialize touched state as false for all fields
      const initialTouched = {};
      initialData.forEach((_, index) => {
        initialTouched[`${index}_name`] = false;
        initialTouched[`${index}_contactNumber`] = false;
        initialTouched[`${index}_designation`] = false;
        initialTouched[`${index}_email`] = false;
        initialTouched[`${index}_department`] = false;
      });
      setTouched(initialTouched);
    }
    // Run silent validation initially
    validateFormSilently();
  }, [initialData]);

  // Validate a field without showing errors
  const contactFieldLabels = {
    name: t("customer.contacts.name"),
    contactNumber: t("customer.contacts.contactNumber"),
    designation: t("customer.contacts.designation"),
    email: t("customer.contacts.email"),
    department: t("customer.contacts.department"),
  };

  const validateField = (index, field, value) => {
    const fieldId = `${index}_${field}`;

    if (!value || value.trim() === "") {
      if (field === "contactNumber") {
        return t("customer.contacts.contactNumberRequired");
      }
      return t("customer.validation.fieldRequired", {
        field: contactFieldLabels[field] || field,
      });
    }

    if (field === "email") {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return t("customer.validation.invalidEmail");
      }
    }

    if (field === "contactNumber") {
      if (!value || typeof value !== "string") return t("customer.contacts.contactNumberRequired");
      const trimmed = value.trim();
      const plusOccurrences = (trimmed.match(/\+/g) || []).length;
      if (plusOccurrences > 1) {
        return t("customer.validation.invalidPhone");
      }
      if (plusOccurrences === 1 && trimmed[0] !== "+") {
        return t("customer.validation.invalidPhone");
      }
      const digitsOnly = trimmed.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return t("customer.validation.invalidPhone");
      }
    }

    return "";
  };

  // Check if there's at least one valid contact with data
  const hasValidContact = () => {
    if (!contacts || contacts.length === 0) {
      return false;
    }
    
    // Check if at least one contact has required fields (name and contactNumber)
    return contacts.some(contact => {
      const hasName = contact.name && contact.name.trim() !== "";
      const hasContactNumber = contact.contactNumber && contact.contactNumber.trim() !== "";
      return hasName && hasContactNumber;
    });
  };

  // Silent validation (doesn't show errors to user)
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

    // Check if there's at least one valid contact
    if (!hasValidContact()) {
      isValid = false;
    }

    contacts.forEach((contact, index) => {
      ["name", "contactNumber", "designation", "email", "department"].forEach(
        (field) => {
          const error = validateField(index, field, contact[field]);
          if (error) {
            newErrors[`${index}_${field}`] = error;
            isValid = false;
          }
        }
      );
    });

    setErrors(newErrors);

    // Update parent validation state without showing errors
    setValidationErrors({
      keyContacts: !isValid,
    });

    return isValid;
  };

  // Validate only touched fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Check if there's at least one valid contact
    if (!hasValidContact()) {
      isValid = false;
    }

    // Check all fields for form validity
    contacts.forEach((contact, index) => {
      ["name", "contactNumber", "designation", "email", "department"].forEach(
        (field) => {
          const fieldId = `${index}_${field}`;
          const error = validateField(index, field, contact[field]);

          // Add error to display only if field was touched
          if (touched[fieldId] && error) {
            newErrors[fieldId] = error;
          }

          // Track overall validity regardless of touched state
          if (error) {
            isValid = false;
          }
        }
      );
    });

    setErrors(newErrors);

    // Update parent validation state
    setValidationErrors({
      keyContacts: !isValid,
    });

    return isValid;
  };

  const updateParent = (updatedContacts) => {
    setContacts(updatedContacts);
    onChange && onChange(updatedContacts);
    validateForm();
  };

  useEffect(() => {
    validateForm();
  }, [contacts, touched]);

  const handleChange = (index, field, value) => {
    const updatedContacts = contacts.map((contact, i) =>
      i === index ? { ...contact, [field]: value } : contact
    );

    // Mark field as touched
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
    const newContact = {
      name: "",
      contactNumber: "",
      designation: "",
      email: "",
      department: "",
    };
    const newContacts = [...contacts, newContact];

    // Initialize touched state for new contact
    const newIndex = contacts.length;
    setTouched((prev) => ({
      ...prev,
      [`${newIndex}_name`]: false,
      [`${newIndex}_contactNumber`]: false,
      [`${newIndex}_designation`]: false,
      [`${newIndex}_email`]: false,
      [`${newIndex}_department`]: false,
    }));

    updateParent(newContacts);
  };

  const contactRowIsDeletable = (contact) => {
    if (contact?._id || contact?.id) return true;
    if (contacts.length > 1) return true;
    return Boolean(
      (contact?.name && contact.name.trim()) ||
        (contact?.contactNumber && contact.contactNumber.trim()) ||
        (contact?.designation && contact.designation.trim()) ||
        (contact?.email && contact.email.trim()) ||
        (contact?.department && contact.department.trim())
    );
  };

  const confirmDelete = (index, contactId) => {
    const contact = contacts[index];

    if (
      !contact.name &&
      !contact.contactNumber &&
      !contact.designation &&
      !contact.email &&
      !contact.department
    ) {
      removeContact(index, contactId, false);
    } else {
      setSelectedContactIndex(index);
      setSelectedContactId(contactId);
      setIsModalOpen(true);
    }
  };

  const removeContact = async (index, contactId, showMessage = true) => {
    if (!customerId) {
      console.error("❌ Error: Vendor ID is missing");
      setIsModalOpen(false);
      setSelectedContactIndex(null);
      setSelectedContactId(null);
      return;
    }

    if (!contactId) {
      const updatedContacts = contacts.filter((_, i) => i !== index);
      // Ensure at least one empty contact row remains
      const finalContacts = updatedContacts.length === 0 
        ? [{ name: "", contactNumber: "", designation: "", email: "", department: "" }]
        : updatedContacts;
      updateParent(finalContacts);
      setIsModalOpen(false);
      setSelectedContactIndex(null);
      setSelectedContactId(null);
      if (showMessage) {
        notifySuccess(t("customer.contacts.removedSuccess"));
      }
      return;
    }

    try {
      const response = await fetch(
        `${Base_URL}/vendors/${customerId}/keyContacts/${contactId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        const updatedContacts = contacts.filter((_, i) => i !== index);
        // Ensure at least one empty contact row remains
        const finalContacts = updatedContacts.length === 0 
          ? [{ name: "", contactNumber: "", designation: "", email: "", department: "" }]
          : updatedContacts;
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
      setSelectedContactIndex(null);
      setSelectedContactId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse border border-gray-200">
        <thead>
          <tr className="text-left">
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.name")}<span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.contactNumber")}<span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.designation")}<span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.email")}<span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800">
              {t("customer.contacts.department")}<span className="text-red-500">*</span>
            </th>
            <th className="py-2 px-4 bg-gray-100 border-b-2 border-gray-200 font-normal text-sm text-gray-800 w-[72px] text-center">
              {t("customer.contacts.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => (
            <tr key={contact._id || contact.id || `contact-${index}`} className="bg-white">
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                  onBlur={() => handleBlur(index, "name")}
                  placeholder={t("customer.contacts.enterName")}
                  className={cellInputClass}
                />
                {errors[`${index}_name`] && touched[`${index}_name`] && (
                  <p className="text-red-500 text-xs mt-1">{errors[`${index}_name`]}</p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="tel"
                  value={contact.contactNumber}
                  onChange={(e) => {
                    const phoneValue = e.target.value.replace(/[^0-9+\s\-()]/g, "");
                    handleChange(index, "contactNumber", phoneValue);
                  }}
                  onBlur={() => handleBlur(index, "contactNumber")}
                  placeholder={t("customer.contacts.enterContactNumber")}
                  className={cellInputClass}
                />
                {errors[`${index}_contactNumber`] && touched[`${index}_contactNumber`] && (
                  <p className="text-red-500 text-xs mt-1">{errors[`${index}_contactNumber`]}</p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="text"
                  value={contact.designation}
                  onChange={(e) => handleChange(index, "designation", e.target.value)}
                  onBlur={() => handleBlur(index, "designation")}
                  placeholder={t("customer.contacts.enterDesignation")}
                  className={cellInputClass}
                />
                {errors[`${index}_designation`] && touched[`${index}_designation`] && (
                  <p className="text-red-500 text-xs mt-1">{errors[`${index}_designation`]}</p>
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
                  <p className="text-red-500 text-xs mt-1">{errors[`${index}_email`]}</p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 align-top">
                <input
                  type="text"
                  value={contact.department}
                  onChange={(e) => handleChange(index, "department", e.target.value)}
                  onBlur={() => handleBlur(index, "department")}
                  placeholder={t("customer.contacts.enterDepartment")}
                  className={cellInputClass}
                />
                {errors[`${index}_department`] && touched[`${index}_department`] && (
                  <p className="text-red-500 text-xs mt-1">{errors[`${index}_department`]}</p>
                )}
              </td>
              <td className="py-2 px-4 border-b border-gray-200 text-center align-middle">
                {contactRowIsDeletable(contact) ? (
                  <button
                    type="button"
                    onClick={() => confirmDelete(index, contact._id ?? contact.id)}
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
            <td colSpan={6} className="py-2 px-4 border-b border-gray-200 text-left">
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
        message={t("customer.shared.confirmDeleteItem")}
      />
    </div>
  );
};

export default KeyContact;

