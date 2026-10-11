import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { REGISTRATION_STEPS } from "../data/registrationOptions";

const emptyContact = () => ({
  name: "",
  position: "",
  phone: "",
  mobile: "",
  email: "",
});

const initialState = {
  company: {
    companyName: "",
    registrationNumber: "",
    email: "",
    website: "",
    password: "",
  },
  address: {
    addressLabel: "",
    // The pickers bind to the ISO codes; the names are what gets submitted.
    // Both are kept so the country/state/city cascade can resolve either way.
    countryCode: "",
    country: "",
    stateCode: "",
    stateProvince: "",
    city: "",
    companyAddress: "",
    postCode: "",
    gpsCoordinates: "",
  },
  contacts: [emptyContact()],
  documents: {
    title: "",
    files: [],
  },
};

const RegistrationContext = createContext(null);

/**
 * Holds the four-step customer registration draft.
 *
 * Deliberately local state rather than Redux: the admin store is persisted to
 * disk and shared with the authenticated app, and none of this belongs there.
 */
export function RegistrationProvider({ children }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initialState);
  const [errors, setErrors] = useState({});

  const updateSection = useCallback((section, patch) => {
    setData((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }, []);

  const setContacts = useCallback((updater) => {
    setData((prev) => ({
      ...prev,
      contacts:
        typeof updater === "function" ? updater(prev.contacts) : updater,
    }));
  }, []);

  const updateContact = useCallback((index, patch) => {
    setData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact, position) =>
        position === index ? { ...contact, ...patch } : contact,
      ),
    }));
  }, []);

  const addContact = useCallback(() => {
    setData((prev) => ({ ...prev, contacts: [...prev.contacts, emptyContact()] }));
  }, []);

  const removeContact = useCallback((index) => {
    setData((prev) => ({
      ...prev,
      contacts:
        prev.contacts.length > 1
          ? prev.contacts.filter((_, position) => position !== index)
          : prev.contacts,
    }));
  }, []);

  const goNext = useCallback(() => {
    setErrors({});
    setStep((prev) => Math.min(REGISTRATION_STEPS.length - 1, prev + 1));
  }, []);

  const goBack = useCallback(() => {
    setErrors({});
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback((index) => {
    setErrors({});
    setStep(Math.max(0, Math.min(REGISTRATION_STEPS.length - 1, index)));
  }, []);

  const reset = useCallback(() => {
    setData(initialState);
    setErrors({});
    setStep(0);
  }, []);

  const value = useMemo(
    () => ({
      steps: REGISTRATION_STEPS,
      step,
      data,
      errors,
      setErrors,
      updateSection,
      setContacts,
      updateContact,
      addContact,
      removeContact,
      goNext,
      goBack,
      goToStep,
      reset,
    }),
    [
      step,
      data,
      errors,
      updateSection,
      setContacts,
      updateContact,
      addContact,
      removeContact,
      goNext,
      goBack,
      goToStep,
      reset,
    ],
  );

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error("useRegistration must be used inside a RegistrationProvider");
  }
  return context;
}
