import React, { useState, useEffect, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import BasicInformation from "./components/BasicInformation";
import OtherDetailsWithTabs from "./components/OtherDetailsWithTabs";
import { notifySuccess, notifyError } from "@/utils/toast";
import { PageHeader } from "@/page-layouts";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NewVendorScreen = () => {
  const history = useHistory();
  const { id: vendorId } = useParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  console.log("vendorId", vendorId);

  const [formData, setFormData] = useState({
    basicInformation: {
      business: "",
      primaryContact: { salutation: "", firstName: "", lastName: "" },
      vendorType: "",
      companyName: "",
      vendorDisplayName: "",
      vendorEmail: "",
      vendorPhone: { workPhone: "", mobile: "" },
      currency: "",
    },
    companyInfo: {},
    keyContacts: [],
    bankInfo: {},
    documents: [],
  });

  const [businesses, setBusinesses] = useState([]);
  const submittingRef = useRef(false);

  // ✅ Fetch businesses from localStorage
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      try {
        setBusinesses(JSON.parse(storedBusinesses));
      } catch (error) {
        console.error("Error parsing businesses from localStorage:", error);
      }
    }
  }, []);

  // ✅ Fetch vendor details if editing
  useEffect(() => {
    if (vendorId) {
      setIsEditMode(true);
      fetchVendorData(vendorId);
    } else {
      setLoading(false);
    }
  }, [vendorId]);
  const fetchVendorData = async (id) => {
    try {
      const response = await axios.get(`${Base_URL}/vendors/${id}`);
      const vendorData = response.data?.data;

      if (!vendorData) {
        notifyError("Vendor data not found.");
        return;
      }

      console.log("Fetched Business:", vendorData.business); // Debugging

      setFormData({
        ...vendorData, // ✅ Spread entire vendor data
        basicInformation: {
          ...vendorData.basicInformation,
          business: vendorData.business || "", // ✅ Ensure business is correctly set
        },
        vendorFirstName:
          vendorData.basicInformation?.primaryContact?.firstName || "", // ✅ Extract and store first name
      });

      setLoading(false);
    } catch (error) {
      notifyError("Failed to load vendor details.");
      setLoading(false);
    }
  };
  const handleBasicInformationChange = (data) => {
    console.log("🔄 Business Updated in Parent Component:", data.business);
    console.log('🔄 Vendor BasicInformation onChange called with:', {
      region: data.region,
      regionCoordinates: data.regionCoordinates,
      allData: data
    })

    setFormData((prev) => ({
      ...prev,
      business: data.business || prev.business, // ✅ Ensure business updates
      basicInformation: { ...prev.basicInformation, ...data },
    }));
  };

  // ✅ Save Basic Information Separately
  const handleBasicInfoSave = async (dataFromForm) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      // Merge form data - use dataFromForm if provided, otherwise use formData
      const basicInfoData = dataFromForm ? { ...formData.basicInformation, ...dataFromForm } : formData.basicInformation
      const businessData = dataFromForm?.business || formData.business
      
      if (!businessData || businessData.toString().trim() === "") {
        notifyError("Please select a business.");
        submittingRef.current = false;
        return;
      }

      console.log('💾 Saving vendor with region data:', {
        region: basicInfoData.region,
        regionCoordinates: basicInfoData.regionCoordinates,
        fullBasicInfo: basicInfoData
      })

      const payload = {
        business: businessData, // ✅ Ensure updated business is sent
        basicInformation: { ...basicInfoData },
      };

      console.log("🚀 Saving Updated Business ID:", businessData);

      if (!vendorId) {
        const response = await axios.post(`${Base_URL}/vendors`, payload, {
          headers: { "Content-Type": "application/json" },
        });

        const newVendorId = response.data._id;
        notifySuccess("Vendor created successfully!");
        history.push(`/vendors`);
      } else {
        await axios.put(`${Base_URL}/vendors/${vendorId}`, payload, {
          headers: { "Content-Type": "application/json" },
        });

        notifySuccess("Basic Information updated successfully!");
        history.push("/vendors");
      }
    } catch (error) {
      const msg = error.response?.data?.message;
        if (error.response?.status === 409 || (msg && msg.toLowerCase().includes("already exists"))) {
          notifyError(msg || "Vendor already exists in selected businesses.");
        } else {
          notifyError(msg || "Failed to save Basic Information.");
        }
    } finally {
      submittingRef.current = false;
    }
  };

  // ✅ Save each tab individually
  // const handleTabSave = async (key, data) => {
  //   try {
  //     let updatedFormData = { ...formData, [key]: data };

  //     if (!vendorId) {
  //       const response = await axios.post(
  //         `${Base_URL}/vendors`,
  //         updatedFormData,
  //         {
  //           headers: { "Content-Type": "application/json" },
  //         }
  //       );

  //       const newVendorId = response.data._id;
  //       notifySuccess("Vendor created successfully!");
  //       history.push(`/vendors`);
  //       setFormData(updatedFormData);
  //     } else {
  //       await axios.put(
  //         `${Base_URL}/vendors/${vendorId}`,
  //         { [key]: data },
  //         {
  //           headers: { "Content-Type": "application/json" },
  //         }
  //       );

  //       notifySuccess(
  //         `${key.replace(/([A-Z])/g, " $1")} updated successfully!`
  //       );
  //     }
  //   } catch (error) {
  //     notifyError(`Failed to save ${key.replace(/([A-Z])/g, " $1")}.`);
  //   }
  // };
  const handleTabSave = async (key, data) => {
    try {
      let updatedFormData = { ...formData, [key]: data };

      if (!vendorId) {
        const response = await axios.post(
          `${Base_URL}/vendors`,
          updatedFormData,
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        const newVendorId = response.data._id;
        notifySuccess("Vendor created successfully!");
        history.push(`/vendors`);
        setFormData(updatedFormData);
      } else {
        await axios.put(
          `${Base_URL}/vendors/${vendorId}`,
          { [key]: data },
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        setFormData((prev) => ({ ...prev, [key]: data }));

        // ✅ Format key for success message
        const formattedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2");
        const capitalizedKey =
          formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

        notifySuccess(`${capitalizedKey} updated successfully!`);
      }
    } catch (error) {
      const formattedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2");
      const capitalizedKey =
        formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

      notifyError(`Failed to save ${capitalizedKey}.`);
    }
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <PageHeader
        title={isEditMode ? "Edit Vendor" : "New Vendor"}
        showBackButton
        backFallbackPath="/Vendors"
      />

      <BasicInformation
        onChange={handleBasicInformationChange}
        onSave={handleBasicInfoSave}
        businesses={businesses}
        initialData={{
          ...formData.basicInformation,
          business: formData.basicInformation?.business || "", // ✅ Ensures business is passed correctly
        }}
        isEditMode={isEditMode}
        className="mb-5"
      />

      {isEditMode && !loading && (
        <div className="mt-4">
          <OtherDetailsWithTabs
            initialData={{
              keyContacts: formData.keyContacts || [],
              addresses: formData.addresses || [],
            }}
            businessId={formData.basicInformation?.business}
            vendorId={vendorId}
            customerId={vendorId}
            onTabSave={handleTabSave}
            vendorFirstName={formData.vendorFirstName}
          />
        </div>
      )}
    </div>
  );
};

export default NewVendorScreen;

// import React, { useState, useEffect } from "react";
// import { useParams } from "react-router-dom";
// import axios from "axios";
// import BasicInformation from "./components/BasicInformation";
// import OtherDetailsWithTabs from "./components/OtherDetailsWithTabs";
// import { notifySuccess, notifyError } from "@/utils/toast";
// import { useHistory } from "react-router-dom"; // Import useHistory

// const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// const NewVendorScreen = () => {
//     const history = useHistory(); // Initialize history

//   const { id: vendorId } = useParams();
//   const [step, setStep] = useState(1);
//   const [isEdit, setIsEdit] = useState(false);

//   const [formData, setFormData] = useState({
//     basicInformation: {
//       business: "",
//       primaryContact: { salutation: "", firstName: "", lastName: "" },
//       vendorType: "",
//       companyName: "",
//       vendorDisplayName: "",
//       vendorEmail: "",
//       vendorPhone: { workPhone: "", mobile: "" },
//     },
//     otherDetails: {},
//     companyInfo: {},
//     salePerson: {},
//     financeAccount: {},
//     bankInfo: {},
//     documents: [],
//   });

//   const [businesses, setBusinesses] = useState([]);

//   // ✅ Fetch businesses from localStorage
//   useEffect(() => {
//     const storedBusinesses = localStorage.getItem("businesses");
//     if (storedBusinesses) {
//       try {
//         setBusinesses(JSON.parse(storedBusinesses));
//       } catch (error) {
//         console.error("Error parsing businesses from localStorage:", error);
//       }
//     }
//   }, []);

//   // ✅ Fetch vendor data for edit mode
//   useEffect(() => {
//     if (vendorId) {
//       setIsEdit(true);
//       fetchVendorData(vendorId);
//     }
//   }, [vendorId]);

//   const fetchVendorData = async (id) => {
//     try {
//       const response = await axios.get(`${Base_URL}/vendors/${id}`);
//       const vendorData = response.data?.data;

//       if (!vendorData) {
//         notifyError("Vendor data not found.");
//         return;
//       }

//       setFormData({
//         basicInformation: {
//           ...vendorData.basicInformation,
//           business: vendorData.business || "",
//         },
//         otherDetails: vendorData.otherDetails || {},
//         companyInfo: vendorData.companyInfo || {},
//         salePerson: vendorData.salePerson || {},
//         financeAccount: vendorData.financeAccount || {},
//         bankInfo: vendorData.bankInfo || {},
//         documents: vendorData.documents || [],
//       });
//     } catch (error) {
//       console.error("Error fetching vendor details:", error);
//       notifyError("Failed to load vendor details.");
//     }
//   };

//   // ✅ Handle Updates from `BasicInformation`
//   const handleBasicInformationChange = (data) => {
//     setFormData((prev) => ({
//       ...prev,
//       basicInformation: { ...prev.basicInformation, ...data },
//     }));
//   };

//   // ✅ Handle Updates from `OtherDetailsWithTabs`
//   const handleOtherDetailsChange = (data) => {
//     setFormData((prev) => {
//       const updatedData = {
//         ...prev,
//         ...data, // ✅ Merge at the top level
//         otherDetails: {
//           ...data.otherDetails, // ✅ Replace `otherDetails` instead of merging stale data
//         },
//       };
//       console.log("🔹 Updated Vendor Data:", updatedData);
//       return updatedData;
//     });
//   };

//   // ✅ Handle Submission
//   // const handleSubmit = async () => {
//   //   try {
//   //     const payload = { ...formData };
//   //     console.log("🚀 Final Payload Sent:", JSON.stringify(payload, null, 2));

//   //     if (!payload.basicInformation.business) {
//   //       notifyError("Business ID is required!");
//   //       return;
//   //     }

//   //     const url = vendorId ? `${Base_URL}/vendors/${vendorId}` : `${Base_URL}/vendors`;
//   //     const method = vendorId ? "put" : "post";

//   //     const response = await axios({
//   //       method,
//   //       url,
//   //       data: payload,
//   //       headers: { "Content-Type": "application/json" },
//   //     });

//   //     console.log("✅ Vendor saved successfully:", response.data);
//   //     notifySuccess("Vendor saved successfully!");
//   //   } catch (error) {
//   //     console.error("❌ Error saving vendor:", error);
//   //     notifyError(error.response?.data?.message || "Failed to save vendor.");
//   //   }
//   // };

//   const handleSubmit = async () => {
//     try {
//       const payload = { ...formData }; // ✅ Ensure latest updates are included

//       // console.log("🚀 Final Payload Sent:", JSON.stringify(payload, null, 2));

//       if (!payload.basicInformation.business) {
//         notifyError("Business ID is required!");
//         return;
//       }

//       const url = vendorId ? `${Base_URL}/vendors/${vendorId}` : `${Base_URL}/vendors`;
//       const method = vendorId ? "put" : "post"; // ✅ Use `vendorId` instead of `isEditMode`

//       const response = await axios({
//         method,
//         url,
//         data: payload,
//         headers: { "Content-Type": "application/json" },
//       });

//       console.log("✅ Vendor saved successfully:", response.data);
//       notifySuccess(`Vendor ${vendorId ? "updated" : "created"} successfully!`);
//       history.push("/Vendors");
//     } catch (error) {
//       console.error("❌ Error saving vendor:", error);
//       notifyError(error.response?.data?.message || "Failed to save vendor.");
//     }
//   };

//   return (
//     <div className="p-6 bg-white min-h-screen">
//       <h1 className="text-xl font-semibold mb-4">
//         {vendorId ? "Edit Vendor" : "New Vendor"}
//       </h1>

//       {step === 1 ? (
//         <>
//           <BasicInformation
//             onChange={handleBasicInformationChange}
//             businesses={businesses}
//             initialData={formData}
//           />
//           <div className="mt-6 flex justify-end">
//             <button
//               onClick={() => setStep(2)}
//               className="px-6 py-2 bg-green-600 text-white rounded-lg"
//             >
//               Next
//             </button>
//           </div>
//         </>
//       ) : (
//         <OtherDetailsWithTabs
//           onChange={handleOtherDetailsChange}
//           onSubmit={handleSubmit}
//           initialData={formData}
//         />
//       )}
//     </div>
//   );
// };

// export default NewVendorScreen;
