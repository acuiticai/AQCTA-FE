import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash } from "react-icons/fi";
import ConfirmationModal from "../reusablecomponents/ConfirmationModal ";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const KeyContact = ({
  initialData = [],
  onChange,
  customerId,
  setValidationErrors,
}) => {
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
  const validateField = (index, field, value) => {
    const fieldId = `${index}_${field}`;

    // Required field check
    if (!value || value.trim() === "") {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    }

    // Email format validation
    if (field === "email") {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return "Invalid email format";
      }
    }

    // Phone number validation (Malaysian format)
    if (field === "contactNumber") {
      const malaysianPattern = /^[0-9]{7,15}$/;
      if (!malaysianPattern.test(value)) {
        return "Invalid Malaysian phone format";
      }
    }

    return "";
  };

  // Silent validation (doesn't show errors to user)
  const validateFormSilently = () => {
    const newErrors = {};
    let isValid = true;

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
      return;
    }

    if (!contactId) {
      const updatedContacts = contacts.filter((_, i) => i !== index);
      updateParent(updatedContacts);
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
        updateParent(updatedContacts);
      } else {
        console.error("❌ Failed to delete contact", await response.json());
      }
    } catch (error) {
      console.error("❌ Error in delete request:", error);
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <div>
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Name*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Contact Number*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Designation*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Email*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Department*
            </th>
            <th className="py-2 px-4 border border-gray-200 font-normal">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => (
            <tr key={index} className="border-t">
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                  onBlur={() => handleBlur(index, "name")}
                  placeholder="Enter Name"
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_name`] && touched[`${index}_name`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_name`] && touched[`${index}_name`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_name`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={contact.contactNumber}
                  onChange={(e) =>
                    handleChange(index, "contactNumber", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "contactNumber")}
                  placeholder="Enter Contact Number"
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_contactNumber`] &&
                    touched[`${index}_contactNumber`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_contactNumber`] &&
                  touched[`${index}_contactNumber`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_contactNumber`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={contact.designation}
                  onChange={(e) =>
                    handleChange(index, "designation", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "designation")}
                  placeholder="Enter Designation"
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_designation`] &&
                    touched[`${index}_designation`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_designation`] &&
                  touched[`${index}_designation`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_designation`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => handleChange(index, "email", e.target.value)}
                  onBlur={() => handleBlur(index, "email")}
                  placeholder="Enter Email"
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_email`] && touched[`${index}_email`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_email`] && touched[`${index}_email`] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[`${index}_email`]}
                  </p>
                )}
              </td>
              <td className="py-2 px-4 border border-gray-200">
                <input
                  type="text"
                  value={contact.department}
                  onChange={(e) =>
                    handleChange(index, "department", e.target.value)
                  }
                  onBlur={() => handleBlur(index, "department")}
                  placeholder="Enter Department"
                  className={`w-full border-gray-300 rounded p-2 ${
                    errors[`${index}_department`] &&
                    touched[`${index}_department`]
                      ? "border-red-500"
                      : ""
                  }`}
                />
                {errors[`${index}_department`] &&
                  touched[`${index}_department`] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[`${index}_department`]}
                    </p>
                  )}
              </td>
              <td className="py-2 px-4 border border-gray-200 text-center">
                <button
                  onClick={() => confirmDelete(index, contact._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiTrash />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan="6"
              className="py-2 px-4 text-green-500 hover:text-green-700 cursor-pointer text-left"
              onClick={addContact}
            >
              <div className="flex items-center space-x-2">
                <FiPlus />
                <span>Add Contact</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => removeContact(selectedContactIndex, selectedContactId)}
      />
    </div>
  );
};

export default KeyContact;

