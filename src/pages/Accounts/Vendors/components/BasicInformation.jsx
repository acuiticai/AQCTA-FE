// import React, { useState, useEffect } from "react";
// import { FiChevronDown, FiChevronUp } from "react-icons/fi";
// import DropdownBasic from "@/components/DropdownBasic"; // Replace with your Dropdown component path

// const BasicInformation = ({ onChange, businesses = [], initialData = {} }) => {
//   const [isOpen, setIsOpen] = useState(true);
//   const [formData, setFormData] = useState({
//     business: "",
//     primaryContact: { salutation: "", firstName: "", lastName: "" },
//     vendorType: "",
//     companyName: "",
//     vendorDisplayName: "",
//     vendorEmail: "",
//     vendorPhone: { workPhone: "", mobile: "" },
//   });

//   useEffect(() => {
//     if (initialData && Object.keys(initialData).length > 0) {
//       const existingVendorDisplayName =
//         initialData.basicInformation?.vendorDisplayName || "";

//       setFormData({
//         business: initialData.basicInformation?.business || "",
//         primaryContact: {
//           salutation:
//             initialData.basicInformation?.primaryContact?.salutation || "",
//           firstName:
//             initialData.basicInformation?.primaryContact?.firstName || "",
//           lastName:
//             initialData.basicInformation?.primaryContact?.lastName || "",
//         },
//         vendorType: initialData.basicInformation?.vendorType || "",
//         companyName: initialData.basicInformation?.companyName || "",
//         vendorDisplayName: existingVendorDisplayName,
//         vendorEmail: initialData.basicInformation?.vendorEmail || "",
//         vendorPhone: {
//           workPhone: initialData.basicInformation?.vendorPhone?.workPhone || "",
//           mobile: initialData.basicInformation?.vendorPhone?.mobile || "",
//         },
//       });

//       // ✅ Ensure old vendor name is preloaded in suggestions & persists
//       setSuggestions((prev) => {
//         const updatedSuggestions = [...prev];

//         if (
//           existingVendorDisplayName &&
//           !updatedSuggestions.some((s) => s.value === existingVendorDisplayName)
//         ) {
//           updatedSuggestions.push({
//             value: existingVendorDisplayName,
//             label: existingVendorDisplayName,
//           });
//         }

//         return updatedSuggestions;
//       });
//     }
//   }, [initialData]);

//   const [errors, setErrors] = useState({});
//   const [suggestions, setSuggestions] = useState([]); // Suggestions for Vendor Display Name

//   // Handle changes for top-level fields
//   const handleChange = (field, value) => {
//     setFormData((prev) => {
//       const updatedFormData = { ...prev, [field]: value };

//       console.log(`🛠️ Updating Field: ${field} ➝`, value); // Debugging log

//       onChange(updatedFormData); // Notify parent component
//       return updatedFormData;
//     });
//   };

//   // Handle changes for nested fields
//   const handleNestedChange = (parentField, childField, value) => {
//     setFormData((prev) => {
//       const updatedParentField = {
//         ...prev[parentField],
//         [childField]: value,
//       };
//       const updatedFormData = { ...prev, [parentField]: updatedParentField };

//       // Dynamically update Vendor Display Name
//       if (parentField === "primaryContact") {
//         updateVendorDisplayName(updatedFormData);
//       }

//       onChange(updatedFormData);
//       return updatedFormData;
//     });
//   };

//   // Update vendor display name dynamically based on company name or primary contact
//   const updateVendorDisplayName = (data) => {
//     const { primaryContact, companyName, vendorDisplayName } = data;
//     const salutation = primaryContact.salutation
//       ? `${primaryContact.salutation} `
//       : "";
//     const firstName = primaryContact.firstName || "";
//     const lastName = primaryContact.lastName || "";

//     // ✅ Generate meaningful display names
//     const nameOnly = firstName ? `${salutation}${firstName}`.trim() : "";
//     const fullName = lastName ? `${nameOnly} ${lastName}`.trim() : nameOnly;

//     // 🔥 New suggestions list ensuring unique values
//     const newSuggestions = [];

//     if (vendorDisplayName && !newSuggestions.includes(vendorDisplayName)) {
//       newSuggestions.push(vendorDisplayName);
//     }
//     if (nameOnly && !newSuggestions.includes(nameOnly)) {
//       newSuggestions.push(nameOnly);
//     }
//     if (fullName && !newSuggestions.includes(fullName)) {
//       newSuggestions.push(fullName);
//     }
//     if (companyName && !newSuggestions.includes(companyName)) {
//       newSuggestions.push(companyName);
//     }

//     // ✅ Convert to Dropdown format: { value, label }
//     setSuggestions(newSuggestions.map((s) => ({ value: s, label: s })));
//   };

//   // Validate required fields
//   const validateField = (field) => {
//     const updatedErrors = { ...errors };

//     if (field === "business" && !formData.business) {
//       updatedErrors.business = "Business is required.";
//     } else {
//       delete updatedErrors.business;
//     }

//     if (field === "vendorPhone" && !formData.vendorPhone.workPhone) {
//       updatedErrors.vendorPhone = "Work Phone is required.";
//     } else {
//       delete updatedErrors.vendorPhone;
//     }

//     setErrors(updatedErrors);
//   };

//   return (
//     <div className="bg-[#EDFCF9] rounded-lg shadow-md p-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <h2 className="text-lg font-semibold">Basic Information</h2>
//         <button
//           onClick={() => setIsOpen(!isOpen)}
//           className="text-gray-600 hover:text-gray-800 focus:outline-none"
//         >
//           {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
//         </button>
//       </div>

//       {/* Collapsible Section */}
//       {isOpen && (
//         <div className="mt-4 space-y-6">
//           {/* Business Dropdown */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Business</label>
//             <div className="col-span-9">
//               <DropdownBasic
//                 value={formData.business}
//                 onChange={(selectedValue) => {

//                   setFormData((prev) => ({
//                     ...prev,
//                     business: selectedValue, // ✅ Ensure correct update
//                   }));

//                   onChange({
//                     ...formData,
//                     business: selectedValue, // ✅ Notify parent component
//                   });
//                 }}
//                 options={businesses.map((business) => ({
//                   value: business._id, // Ensure Business ID is used
//                   label: business.name,
//                 }))}
//                 placeholder="Select a Business"
//               />

//               {errors.business && (
//                 <p className="text-red-500 text-sm">{errors.business}</p>
//               )}
//             </div>
//           </div>

//           {/* Primary Contact */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Primary Contact</label>
//             <div className="col-span-3">
//               <select
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.primaryContact.salutation}
//                 onChange={(e) =>
//                   handleNestedChange(
//                     "primaryContact",
//                     "salutation",
//                     e.target.value
//                   )
//                 }
//               >
//                 <option value="">Salutation</option>
//                 <option value="Mr">Mr</option>
//                 <option value="Mrs">Mrs</option>
//               </select>
//             </div>
//             <div className="col-span-3">
//               <input
//                 type="text"
//                 placeholder="First Name"
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.primaryContact.firstName}
//                 onChange={(e) =>
//                   handleNestedChange(
//                     "primaryContact",
//                     "firstName",
//                     e.target.value
//                   )
//                 }
//               />
//             </div>
//             <div className="col-span-3">
//               <input
//                 type="text"
//                 placeholder="Last Name"
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.primaryContact.lastName}
//                 onChange={(e) =>
//                   handleNestedChange(
//                     "primaryContact",
//                     "lastName",
//                     e.target.value
//                   )
//                 }
//               />
//             </div>
//           </div>

//           {/* Vendor Type */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Vendor Type</label>
//             <div className="col-span-9">
//               <select
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.vendorType}
//                 onChange={(e) => handleChange("vendorType", e.target.value)}
//               >
//                 <option value="">Vendor Type</option>
//                 <option value="Supplier">Supplier</option>
//                 <option value="Manufacturer">Manufacturer</option>
//                 <option value="Distributor">Distributor</option>
//               </select>
//             </div>
//           </div>

//           {/* Company Name */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Company Name</label>
//             <div className="col-span-9">
//               <input
//                 type="text"
//                 placeholder="Company Name"
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.companyName}
//                 onChange={(e) => handleChange("companyName", e.target.value)}
//               />
//             </div>
//           </div>

//           {/* Vendor Display Name */}
//           {/* Vendor Display Name Dropdown */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">
//               Vendor Display Name
//             </label>
//             <div className="col-span-9">
//               <DropdownBasic
//                 value={formData.vendorDisplayName}
//                 onChange={(selectedValue) =>
//                   handleChange("vendorDisplayName", selectedValue)
//                 }
//                 options={suggestions} // ✅ Suggestions persist
//                 placeholder="Vendor Display Name"
//               />
//             </div>
//           </div>

//           {/* Vendor Email */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Vendor Email</label>
//             <div className="col-span-9">
//               <input
//                 type="email"
//                 placeholder="Vendor Email"
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.vendorEmail}
//                 onChange={(e) => handleChange("vendorEmail", e.target.value)}
//               />
//             </div>
//           </div>

//           {/* Vendor Phone */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Work Phone</label>
//             <div className="col-span-9">
//               <input
//                 type="text"
//                 placeholder="Work Phone"
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.vendorPhone.workPhone}
//                 onChange={(e) =>
//                   handleNestedChange("vendorPhone", "workPhone", e.target.value)
//                 }
//               />
//               {errors.vendorPhone && (
//                 <p className="text-red-500 text-sm">{errors.vendorPhone}</p>
//               )}
//             </div>
//           </div>

//           {/* Mobile Phone */}
//           <div className="grid grid-cols-12 gap-4">
//             <label className="col-span-3 text-gray-600">Mobile Phone</label>
//             <div className="col-span-9">
//               <input
//                 type="text"
//                 placeholder="Mobile Phone"
//                 className="w-full border border-gray-300 rounded-md p-2 bg-gray-50"
//                 value={formData.vendorPhone.mobile}
//                 onChange={(e) =>
//                   handleNestedChange("vendorPhone", "mobile", e.target.value)
//                 }
//               />
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default BasicInformation;

import React, { useState, useEffect } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import DropdownBasic from "@/components/DropdownBasic"; // Import the Dropdown component
import { useHistory } from "react-router-dom";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BasicInformation = ({
  onChange,
  businesses = [],
  initialData = {},
  isEditMode = false,
  onSave,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const history = useHistory();
  const [displayNameSuggestions, setDisplayNameSuggestions] = useState([]);
  const [vendorTypes, setVendorTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [isLoading, setIsLoading] = useState({
    vendorType: false,
    currencies: false,
  });
  const [isSaveDisabled, setIsSaveDisabled] = useState(true); // ✅ Initially disabled
  const [showErrors, setShowErrors] = useState(false);
  console.log("in basic info");
  console.log("currencies state:", currencies);
  console.log("formData.currency:", formData.currency);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^(?:\+60|0)[0-9]{9,10}$/;

    return phoneRegex.test(phone);
  };

  // Fetch currencies for selected business
  const fetchCurrencies = async (businessId) => {
    console.log("fetchCurrencies called with businessId:", businessId);
    if (!businessId) {
      setCurrencies([]);
      return;
    }

    setIsLoading((prev) => ({ ...prev, currencies: true }));
    try {
      const response = await axios.get(
        `${Base_URL}/finance/currencies?business_id=${businessId}`
      );
      console.log("Currencies response:", response.data);
      setCurrencies(response.data.data || []);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      setCurrencies([]);
    } finally {
      setIsLoading((prev) => ({ ...prev, currencies: false }));
    }
  };

  const [errors, setErrors] = useState({
    vendorEmail: "",
    workPhone: "",
    mobilePhone: "",
  });

  const [formData, setFormData] = useState({
    business: "",
    primaryContact: { salutation: "", firstName: "", lastName: "" },
    vendorType: "Individual",
    companyName: "",
    vendorDisplayName: "",
    vendorEmail: "",
    vendorPhone: { workPhone: "", mobile: "" },
    currency: "",
  });

  // ✅ Fetch Vendor Types only when business changes
  useEffect(() => {
    if (!formData.business) return;

    const fetchVendorTypes = async () => {
      setIsLoading((prev) => ({ ...prev, vendorType: true }));
      try {
        console.log(
          "🔍 Fetching Vendor Types for Business ID:",
          formData.business
        );
        const response = await axios.post(
          `${Base_URL}/items/Vendor Type/get_all`,
          {
            business_id: formData.business,
            FilterStatus: "active",
          }
        );

        if (response.data.success) {
          setVendorTypes(response.data.data);
        } else {
          throw new Error("Failed to fetch vendor types");
        }
      } catch (err) {
        console.error("❌ Error fetching vendor types:", err);
      } finally {
        setIsLoading((prev) => ({ ...prev, vendorType: false }));
      }
    };

    fetchVendorTypes();
  }, [formData.business]);

  // ✅ Generate Display Name Suggestions
  useEffect(() => {
    const { salutation, firstName, lastName } = formData.primaryContact;
    const { companyName } = formData;

    let suggestions = [];

    if (firstName) {
      suggestions.push(`${salutation ? salutation + " " : ""}${firstName}`);
    }
    if (firstName && lastName) {
      suggestions.push(`${firstName} ${lastName}`);
      suggestions.push(`${lastName} ${firstName}`);
    }
    if (companyName) {
      suggestions.push(companyName);
    }

    setDisplayNameSuggestions(suggestions);
  }, [formData.primaryContact, formData.companyName]);

  // ✅ Populate form with initial data when editing
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData((prev) => ({
        ...prev,
        business: initialData.business || "",
        primaryContact: {
          salutation: initialData.primaryContact?.salutation || "",
          firstName: initialData.primaryContact?.firstName || "",
          lastName: initialData.primaryContact?.lastName || "",
        },
        vendorType: initialData.vendorType || "Individual",
        companyName: initialData.companyName || "",
        vendorDisplayName: initialData.vendorDisplayName || "",
        vendorEmail: initialData.vendorEmail || "",
        vendorPhone: {
          workPhone: initialData.vendorPhone?.workPhone || "",
          mobile: initialData.vendorPhone?.mobile || "",
        },
        currency:
          (initialData.currency && typeof initialData.currency === "object"
            ? initialData.currency._id
            : initialData.currency) || "",
      }));
    }
  }, [initialData]);

  // ✅ Auto-select business if only one exists
  useEffect(() => {
    if (businesses.length === 1 && !formData.business) {
      setFormData((prev) => ({
        ...prev,
        business: businesses[0]._id,
      }));
    }
  }, [businesses]);

  // Fetch currencies when business changes
  useEffect(() => {
    if (formData.business) {
      fetchCurrencies(formData.business);
    }
  }, [formData.business]);

  // ✅ Form Validation & Save Button Enable/Disable Logic
  // useEffect(() => {
  //   let isValid = true;

  //   if (!validateEmail(formData.vendorEmail)) {
  //     isValid = false;
  //   }

  //   setErrors((prevErrors) => ({
  //     ...prevErrors,
  //     vendorEmail: validateEmail(formData.vendorEmail)
  //       ? ""
  //       : "Invalid email format",
  //   }));

  //   setIsSaveDisabled(!isValid);
  // }, [formData.vendorEmail]);
  useEffect(() => {
    let isValid = true;
    const requiredMissing = {
      business: !formData.business,
      vendorDisplayName: !formData.vendorDisplayName?.trim(),
      firstName: !formData.primaryContact?.firstName?.trim(),
      lastName: !formData.primaryContact?.lastName?.trim(),
    };
    let newErrors = {
      business: requiredMissing.business ? "Business is required" : "",
      vendorDisplayName: requiredMissing.vendorDisplayName
        ? "Vendor display name is required"
        : "",
      firstName: requiredMissing.firstName ? "First name is required" : "",
      lastName: requiredMissing.lastName ? "Last name is required" : "",
      vendorEmail: !formData.vendorEmail?.trim()
        ? "Email is required"
        : !validateEmail(formData.vendorEmail)
          ? "Invalid email format"
          : "",
      workPhone: formData.vendorPhone.workPhone
        ? validatePhoneNumber(formData.vendorPhone.workPhone)
          ? ""
          : "Invalid phone number"
        : "",
      mobilePhone: formData.vendorPhone.mobile
        ? validatePhoneNumber(formData.vendorPhone.mobile)
          ? ""
          : "Invalid phone number"
        : "",
    };

    setErrors(newErrors);

    // Disable save for required fields: business, display name, primary contact, email.
    if (
      newErrors.business ||
      newErrors.vendorDisplayName ||
      newErrors.firstName ||
      newErrors.lastName ||
      newErrors.vendorEmail
    ) {
      isValid = false;
    }

    setIsSaveDisabled(!isValid);
  }, [
    formData.business,
    formData.vendorDisplayName,
    formData.primaryContact?.firstName,
    formData.primaryContact?.lastName,
    formData.vendorEmail,
    formData.vendorPhone?.workPhone,
    formData.vendorPhone?.mobile,
  ]);

  // ✅ Handle input changes
  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updatedData = { ...prev, [field]: value };

      // Clear currency when business changes
      if (field === "business") {
        updatedData.currency = "";
      }
      // Hide/clear company-only field for individual vendors.
      if (field === "vendorType" && value === "Individual") {
        updatedData.companyName = "";
      }

      onChange(updatedData);
      return updatedData;
    });
  };

  // ✅ Handle nested input changes
  const handleNestedChange = (parentField, childField, value) => {
    setFormData((prev) => {
      const updatedParent = { ...prev[parentField], [childField]: value };
      const updatedData = { ...prev, [parentField]: updatedParent };
      onChange(updatedData);
      return updatedData;
    });
  };

  return (
    <div className="bg-[#EDFCF9] rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-600 hover:text-gray-800 focus:outline-none"
        >
          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </button>
      </div>

      {isOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowErrors(true);
            if (isSaveDisabled) return;
            onSave(formData);
          }}
          className="mt-4 space-y-6"
        >
          {/* ✅ Business Dropdown */}
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">Business</label>
            <div className="col-span-9">
              <DropdownBasic
                value={
                  Array.isArray(formData.business)
                    ? formData.business?.[0] ?? ""
                    : formData.business
                } // ✅ Controlled value (always a string for <select/>)
                onChange={(selectedValue) => {
                  console.log("🔄 Changing Business to:", selectedValue);
                  handleChange("business", selectedValue);
                }}
                options={businesses.map((business) => ({
                  value: business._id,
                  label: business.name,
                }))}
                placeholder="Select a Business"
                disabled={false} // Keep enabled even when only 1 business exists
              />
              {showErrors && errors.business && (
                <p className="text-red-500 text-sm">{errors.business}</p>
              )}
            </div>
          </div>

          {/* ✅ Primary Contact */}
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">Primary Contact</label>
            <div className="col-span-3">
              <select
                className={`w-full border ${
                  showErrors && errors.firstName ? "border-red-500" : "border-gray-300"
                } rounded-md p-2 bg-gray-50 focus:outline-none`}
                value={formData.primaryContact.salutation}
                onChange={(e) =>
                  handleNestedChange(
                    "primaryContact",
                    "salutation",
                    e.target.value
                  )
                }
              >
                <option value="">Salutation</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
              </select>
            </div>
            <div className="col-span-3">
              <input
                type="text"
                placeholder="First Name"
                className={`w-full border ${
                  showErrors && errors.firstName ? "border-red-500" : "border-gray-300"
                } rounded-md p-2 bg-gray-50 focus:outline-none`}
                value={formData.primaryContact.firstName}
                onChange={(e) =>
                  handleNestedChange(
                    "primaryContact",
                    "firstName",
                    e.target.value
                  )
                }
              />
              {showErrors && errors.firstName && (
                <p className="text-red-500 text-sm">{errors.firstName}</p>
              )}
            </div>
            <div className="col-span-3">
              <input
                type="text"
                placeholder="Last Name"
                className={`w-full border ${
                  showErrors && errors.lastName ? "border-red-500" : "border-gray-300"
                } rounded-md p-2 bg-gray-50 focus:outline-none`}
                value={formData.primaryContact.lastName}
                onChange={(e) =>
                  handleNestedChange(
                    "primaryContact",
                    "lastName",
                    e.target.value
                  )
                }
              />
              {showErrors && errors.lastName && (
                <p className="text-red-500 text-sm">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* ✅ Vendor Type: default "Individual", hidden from UI */}

          {/* ✅ Company Name (Company vendors only) */}
          {formData.vendorType === "Company" && (
            <div className="grid grid-cols-12 gap-4">
              <label className="col-span-3 text-gray-600">Company Name</label>
              <div className="col-span-9">
                <input
                  type="text"
                  placeholder="Company Name"
                  className="w-full border border-gray-300 rounded-md p-2 bg-gray-50 focus:outline-none"
                  value={formData.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ✅ Vendor Display Name */}
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">
              Vendor Display Name
            </label>
            <div className="col-span-9">
              <DropdownBasic
                value={formData.vendorDisplayName}
                onChange={(selectedValue) =>
                  handleChange("vendorDisplayName", selectedValue)
                }
                options={displayNameSuggestions.map((name) => ({
                  value: name,
                  label: name,
                }))}
                placeholder="Vendor Display Name"
              />
              {showErrors && errors.vendorDisplayName && (
                <p className="text-red-500 text-sm">{errors.vendorDisplayName}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">Vendor Email</label>
            <div className="col-span-9">
              <input
                type="email"
                placeholder="Vendor Email"
                className={`w-full border ${
                  showErrors && errors.vendorEmail ? "border-red-500" : "border-gray-300"
                } rounded-md p-2 bg-gray-50 focus:outline-none`}
                value={formData.vendorEmail}
                onChange={(e) => handleChange("vendorEmail", e.target.value)}
              />
              {showErrors && errors.vendorEmail && (
                <p className="text-red-500 text-sm">{errors.vendorEmail}</p>
              )}
            </div>
          </div>

          {/* ✅ Vendor Phone Numbers */}
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">Work Phone</label>
            <div className="col-span-9">
              <input
                type="text"
                placeholder="Work Phone"
                className={`w-full border ${
                  errors.workPhone ? "border-red-500" : "border-gray-300"
                } rounded-md p-2 bg-gray-50 focus:outline-none`}
                value={formData.vendorPhone.workPhone}
                onChange={(e) =>
                  handleNestedChange("vendorPhone", "workPhone", e.target.value)
                }
              />
              {formData.vendorPhone.workPhone && errors.workPhone && (
                <p className="text-red-500 text-sm">{errors.workPhone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">Mobile Phone</label>
            <div className="col-span-9">
              <input
                type="text"
                placeholder="Mobile Phone"
                className={`w-full border ${
                  errors.mobilePhone ? "border-red-500" : "border-gray-300"
                } rounded-md p-2 bg-gray-50 focus:outline-none`}
                value={formData.vendorPhone.mobile}
                onChange={(e) =>
                  handleNestedChange("vendorPhone", "mobile", e.target.value)
                }
              />
              {errors.mobilePhone && (
                <p className="text-red-500 text-sm">{errors.mobilePhone}</p>
              )}
            </div>
          </div>

          {/* Currency Field */}
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-3 text-gray-600">Currency</label>
            <div className="col-span-9">
              <DropdownBasic
                value={formData.currency}
                onChange={(selectedValue) =>
                  handleChange("currency", selectedValue)
                }
                placeholder={
                  isLoading.currencies
                    ? "Loading currencies..."
                    : "Select Currency"
                }
                disabled={isLoading.currencies || !formData.business}
                options={currencies.map((currency) => ({
                  value: currency._id,
                  label: `${currency.symbol} (${currency.prefix})`,
                }))}
              />
              {/* Debug info */}
              <div className="text-xs text-gray-500 mt-1">
                Debug: currencies={currencies.length}, business=
                {formData.business}, currency={formData.currency}
              </div>
            </div>
          </div>

          {/* ✅ Save Button Always Visible */}
          <div className="mt-4 text-right space-x-3">
            <button
              onClick={() => history.goBack()}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400 transition"
            >
              Cancel
            </button>

            <button
              // onClick={() => onSave(formData)}
              type="submit"
              disabled={isSaveDisabled}
              className={`px-4 py-2 rounded-xl ${
                isSaveDisabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[var(--p-blue)] hover:bg-[#9AC82D] text-white"
              }`}
            >
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BasicInformation;
