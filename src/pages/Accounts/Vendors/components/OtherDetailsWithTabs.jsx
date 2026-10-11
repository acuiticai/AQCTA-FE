// import React, { useState, useEffect } from "react";
// import OtherDetails from "../subcomponent/OtherDetails";
// import CompanyInfo from "../subcomponent/CompanyInfo";
// import SalePerson from "../subcomponent/SalesPerson";
// import FinanceAccount from "../subcomponent/FinanceAccount";
// import BankInfo from "../subcomponent/BankInfo";

// const OtherDetailsWithTabs = ({ onChange, onSubmit, initialData = {} }) => {
//   const [activeTabIndex, setActiveTabIndex] = useState(0);
//   const [formData, setFormData] = useState({
//     otherDetails: initialData.otherDetails || {},
//     companyInfo: initialData.companyInfo || {},
//     salePerson: initialData.salePerson || {},
//     financeAccount: initialData.financeAccount || {},
//     bankInfo: initialData.bankInfo || {},
//   });

//   // ✅ Load initialData ONCE
//   useEffect(() => {
//     if (initialData && Object.keys(initialData).length > 0) {
//       setFormData((prev) => ({
//         ...prev,
//         otherDetails: initialData.otherDetails || prev.otherDetails,
//         companyInfo: initialData.companyInfo || prev.companyInfo,
//         salePerson: initialData.salePerson || prev.salePerson,
//         financeAccount: initialData.financeAccount || prev.financeAccount,
//         bankInfo: initialData.bankInfo || prev.bankInfo,
//       }));
//     }
//   }, [initialData]); // 🔥 Runs only when initialData changes

//   // ✅ Ensure Form Data is Updated for All Tabs
//   const handleTabChange = (key, data) => {
//     setFormData((prev) => {
//       const updated = {
//         ...prev,
//         [key]: { ...prev[key], ...data }, // ✅ Merge updates properly
//       };
//       onChange(updated); // ✅ Notify Parent (`NewVendorScreen`)
//       return updated;
//     });
//   };

//   // 🏷️ Define Tabs with their Components
//   const tabs = [
//     { name: "Other Details", component: OtherDetails, key: "otherDetails" },
//     { name: "Company Info", component: CompanyInfo, key: "companyInfo" },
//     { name: "Sale Person", component: SalePerson, key: "salePerson" },
//     { name: "Finance Account", component: FinanceAccount, key: "financeAccount" },
//     { name: "Bank Info", component: BankInfo, key: "bankInfo" },
//   ];

//   const ActiveComponent = tabs[activeTabIndex].component;

//   return (
//     <div className="bg-white rounded-lg p-6 shadow-md">
//       {/* Tabs Navigation */}
//       <div className="border-b border-gray-300 mb-6">
//         <nav className="flex text-sm">
//           {tabs.map((tab, index) => (
//             <button
//               key={tab.name}
//               onClick={() => setActiveTabIndex(index)}
//               className={`px-4 py-2 font-medium transition-all ${
//                 activeTabIndex === index
//                   ? "text-black border-b-4 border-green-600"
//                   : "text-gray-400"
//               }`}
//             >
//               {tab.name}
//             </button>
//           ))}
//         </nav>
//       </div>

//       {/* Active Tab Component */}
//       <ActiveComponent
//         onChange={(data) => handleTabChange(tabs[activeTabIndex].key, data)}
//         initialData={formData[tabs[activeTabIndex].key] || {}} // ✅ Pass correct initialData
//       />

//       {/* Footer Buttons */}
//       <div className="mt-6 flex justify-between">
//         {/* Back Button */}
//         <button
//           onClick={() => setActiveTabIndex((prev) => Math.max(prev - 1, 0))}
//           disabled={activeTabIndex === 0}
//           className={`px-6 py-2 border rounded-lg ${
//             activeTabIndex === 0 ? "text-gray-400" : "text-gray-600 border-gray-300"
//           }`}
//         >
//           Back
//         </button>

//         {/* Next or Submit Button */}
//         {activeTabIndex === tabs.length - 1 ? (
//           <button
//             onClick={() => onSubmit(formData)}
//             className="px-6 py-2 bg-green-600 text-white rounded-lg"
//           >
//             Submit
//           </button>
//         ) : (
//           <button
//             onClick={() => setActiveTabIndex((prev) => Math.min(prev + 1, tabs.length - 1))}
//             className="px-6 py-2 bg-green-600 text-white rounded-lg"
//           >
//             Next
//           </button>
//         )}
//       </div>
//     </div>
//   );
// };

// export default OtherDetailsWithTabs;
// import React, { useState, useEffect } from "react";
// import OtherDetails from "../subcomponent/OtherDetails";
// import CompanyInfo from "../subcomponent/CompanyInfo";
// import SalePerson from "../subcomponent/SalesPerson";
// import FinanceAccount from "../subcomponent/FinanceAccount";
// import BankInfo from "../subcomponent/BankInfo";
// import DocumentUpload from "../subcomponent/DocumentUpload";

// const OtherDetailsWithTabs = ({ initialData = {}, onTabSave,  businessId,customerId,vendorFirstName
// }) => {
//   const [activeTabIndex, setActiveTabIndex] = useState(0);
//   const [formData, setFormData] = useState({
//     otherDetails: initialData.otherDetails || {},
//     companyInfo: initialData.companyInfo || {},
//     salePerson: initialData.salePerson || {},
//     financeAccount: initialData.financeAccount || {},
//     bankInfo: initialData.bankInfo || {},
//     // documents: initialData.documents || [],
//   });

//   const tabs = [
//     { name: "Other Details", component: OtherDetails, key: "otherDetails" },
//     { name: "Company Info", component: CompanyInfo, key: "companyInfo" },
//     { name: "Sale Person", component: SalePerson, key: "salePerson" },
//     { name: "Finance Account", component: FinanceAccount, key: "financeAccount" },
//     { name: "Bank Info", component: BankInfo, key: "bankInfo" },
//     { name: "Document", component: DocumentUpload, key: "DocumentUpload" }, // ✅ Document Upload Tab
//   ];

//   useEffect(() => {
//     if (initialData && Object.keys(initialData).length > 0) {
//       setFormData({
//         otherDetails: initialData.otherDetails || {},
//         companyInfo: initialData.companyInfo || {},
//         salePerson: initialData.salePerson || {},
//         financeAccount: initialData.financeAccount || {},
//         bankInfo: initialData.bankInfo || {},
//         // documents: initialData.documents || [],
//       });
//     }
//   }, [initialData]);

//   const handleTabChange = (key, data) => {
//     setFormData((prev) => ({
//       ...prev,
//       [key]: data,
//     }));
//   };

//   const ActiveComponent = tabs[activeTabIndex].component;

//   return (
//     <div className="bg-white rounded-lg p-6 shadow-md">
//       {/* Tabs Navigation */}
//       <div className="border-b border-gray-300 mb-6">
//         <nav className="flex text-sm">
//           {tabs.map((tab, index) => (
//             <button
//               key={tab.name}
//               onClick={() => setActiveTabIndex(index)}
//               className={`px-4 py-2 font-medium transition-all ${
//                 activeTabIndex === index ? "text-black border-b-4 border-green-600" : "text-gray-400"
//               }`}
//             >
//               {tab.name}
//             </button>
//           ))}
//         </nav>
//       </div>

//       {/* Render Active Tab Component */}
//       <ActiveComponent
//         initialData={formData[tabs[activeTabIndex].key]}
//         onChange={(data) => handleTabChange(tabs[activeTabIndex].key, data)}
//         businessId={businessId}
//         customerId={customerId}
//         vendorFirstName={vendorFirstName}
//       />

//       {/* Save Button for Each Tab */}
//       {tabs[activeTabIndex].key !== "DocumentUpload" && (
//         <div className="mt-6 flex justify-end space-x-3">
//           <button
//             onClick={() => history.goBack()}
//             className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={() =>
//               onTabSave(
//                 tabs[activeTabIndex].key,
//                 formData[tabs[activeTabIndex].key]
//               )
//             }
//             className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-xl"
//           >
//             Save {tabs[activeTabIndex].name}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default OtherDetailsWithTabs;

// import React, { useState, useEffect } from "react";
// import OtherDetails from "../subcomponent/OtherDetails";
// import CompanyInfo from "../subcomponent/CompanyInfo";
// import SalePerson from "../subcomponent/SalesPerson";
// import FinanceAccount from "../subcomponent/FinanceAccount";
// import BankInfo from "../subcomponent/BankInfo";
// import DocumentUpload from "../subcomponent/DocumentUpload";

// const OtherDetailsWithTabs = ({ initialData = {}, onTabSave, businessId, customerId, vendorFirstName }) => {
//   const [activeTabIndex, setActiveTabIndex] = useState(0);
//   const [formData, setFormData] = useState({
//     otherDetails: initialData.otherDetails || {},
//     companyInfo: initialData.companyInfo || {},
//     salePerson: initialData.salePerson || {},
//     financeAccount: initialData.financeAccount || {},
//     bankInfo: initialData.bankInfo || {},
//   });

//   const [validationErrors, setValidationErrors] = useState({
//     otherDetails: false,
//     companyInfo: false,
//     salePerson: false,
//     financeAccount: false,
//     bankInfo: false,
//   });

//   const tabs = [
//     { name: "Other Details", component: OtherDetails, key: "otherDetails" },
//     { name: "Company Info", component: CompanyInfo, key: "companyInfo" },
//     { name: "Sale Person", component: SalePerson, key: "salePerson" },
//     { name: "Finance Account", component: FinanceAccount, key: "financeAccount" },
//     { name: "Bank Info", component: BankInfo, key: "bankInfo" },
//     { name: "Document", component: DocumentUpload, key: "DocumentUpload" },
//   ];

//   useEffect(() => {
//     if (initialData && Object.keys(initialData).length > 0) {
//       setFormData({
//         otherDetails: initialData.otherDetails || {},
//         companyInfo: initialData.companyInfo || {},
//         salePerson: initialData.salePerson || {},
//         financeAccount: initialData.financeAccount || {},
//         bankInfo: initialData.bankInfo || {},
//       });
//     }
//   }, [initialData]);

//   const handleTabChange = (key, data) => {
//     setFormData((prev) => ({
//       ...prev,
//       [key]: data,
//     }));
//   };

//   const isSaveDisabled = validationErrors[tabs[activeTabIndex].key];

//   const ActiveComponent = tabs[activeTabIndex].component;

//   return (
//     <div className="bg-white rounded-lg p-6 shadow-md">
//       {/* Tabs Navigation */}
//       <div className="border-b border-gray-300 mb-6">
//         <nav className="flex text-sm">
//           {tabs.map((tab, index) => (
//             <button
//               key={tab.name}
//               onClick={() => setActiveTabIndex(index)}
//               className={`px-4 py-2 font-medium transition-all ${
//                 activeTabIndex === index ? "text-black border-b-4 border-green-600" : "text-gray-400"
//               }`}
//             >
//               {tab.name}
//             </button>
//           ))}
//         </nav>
//       </div>

//       {/* Render Active Tab Component */}
//       <ActiveComponent
//         initialData={formData[tabs[activeTabIndex].key]}
//         onChange={(data) => handleTabChange(tabs[activeTabIndex].key, data)}
//         businessId={businessId}
//         customerId={customerId}
//         vendorFirstName={vendorFirstName}
//         setValidationErrors={setValidationErrors} // ✅ Pass validation function
//       />

//       {/* Save Button for Each Tab */}
//       {tabs[activeTabIndex].key !== "DocumentUpload" && (
//         <div className="mt-6 flex justify-end space-x-3">
//           <button
//             onClick={() => history.goBack()}
//             className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={() =>
//               onTabSave(
//                 tabs[activeTabIndex].key,
//                 formData[tabs[activeTabIndex].key]
//               )
//             }
//             disabled={isSaveDisabled} // ✅ Disable Save button when validation fails
//             className={`px-6 py-2 rounded-xl text-white ${
//               isSaveDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-[var(--p-blue)]"
//             }`}
//           >
//             Save {tabs[activeTabIndex].name}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default OtherDetailsWithTabs;

import React, { useState, useEffect, useMemo } from "react";
import { useHistory } from "react-router-dom";
import KeyContact from "../subcomponent/KeyContact";
import DocumentUpload from "../subcomponent/DocumentUpload";
import Addresses from "../subcomponent/Addresses";
import ActivityTimeline from "@/components/timeline/ActivityTimeline";

const OtherDetailsWithTabs = ({
  initialData = {},
  onTabSave,
  businessId,
  customerId,
  vendorId,
  vendorFirstName,
}) => {
  const history = useHistory();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [formData, setFormData] = useState({
    keyContacts: initialData.keyContacts || [],
    addresses: initialData.addresses || [],
  });

  const [validationErrors, setValidationErrors] = useState({
    keyContacts: false,
    addresses: false,
    DocumentUpload: false,
  });

  const [isButtonDisabled, setIsButtonDisabled] = useState(false); // ✅ Track button disabled state

  const timelineVendorId = vendorId || customerId;

  const tabs = useMemo(() => {
    const base = [
      { name: "Contacts", component: KeyContact, key: "keyContacts" },
      { name: "Documents", component: DocumentUpload, key: "DocumentUpload" },
      { name: "Addresses", component: Addresses, key: "addresses" },
    ];
    if (timelineVendorId) {
      base.push({ name: "Activity", component: null, key: "activityLog" });
    }
    return base;
  }, [timelineVendorId]);

  useEffect(() => {
    if (activeTabIndex >= tabs.length) setActiveTabIndex(0);
  }, [tabs.length, activeTabIndex]);

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        keyContacts: initialData.keyContacts || [],
        addresses: initialData.addresses || [],
      });
    }
  }, [initialData]);

  const handleTabChange = (key, data) => {
    setFormData((prev) => ({
      ...prev,
      [key]: data,
    }));
  };

  const handleSave = () => {
    if (isButtonDisabled) return; // ✅ Prevent multiple clicks
    setIsButtonDisabled(true); // ✅ Disable button

    onTabSave(tabs[activeTabIndex].key, formData[tabs[activeTabIndex].key]);

    // ✅ Re-enable button after 2 seconds
    setTimeout(() => {
      setIsButtonDisabled(false);
    }, 2000);
  };

  const isSaveDisabled = validationErrors[tabs[activeTabIndex].key];
  const ActiveComponent = tabs[activeTabIndex].component;
  const activeTabKey = tabs[activeTabIndex].key;
  const isActivityTab = activeTabKey === "activityLog";

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      {/* Tabs Navigation */}
      <div className="border-b border-gray-300 mb-6">
        <nav className="flex text-sm">
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              onClick={() => setActiveTabIndex(index)}
              className={`px-4 py-2 font-medium transition-all ${
                activeTabIndex === index
                  ? "text-black border-b-4 border-green-600"
                  : "text-gray-400"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {isActivityTab ? (
        <ActivityTimeline
          query={{ vendorId: timelineVendorId }}
          title=""
          pageSize={20}
          embedded
        />
      ) : (
        <ActiveComponent
          initialData={formData[tabs[activeTabIndex].key]}
          onChange={(data) => handleTabChange(tabs[activeTabIndex].key, data)}
          businessId={businessId}
          customerId={customerId}
          vendorFirstName={vendorFirstName}
          setValidationErrors={setValidationErrors}
        />
      )}

      {/* Save Button for Each Tab */}
      {!isActivityTab && tabs[activeTabIndex].key !== "DocumentUpload" && (
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => history.goBack()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled || isButtonDisabled} // ✅ Disable button when needed
            className={`px-6 py-2 rounded-xl text-white ${
              isSaveDisabled || isButtonDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[var(--p-blue)]"
            }`}
          >
            {isButtonDisabled
              ? "Processing..."
              : `Save ${tabs[activeTabIndex].name}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default OtherDetailsWithTabs;
