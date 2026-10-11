import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import BasicInfo from "./components/BasicInfo";
import ProductInfo from "./components/ProductInfo";
import { useSalesContext } from "./context/SalesContractContext";
import { useHistory } from "react-router-dom";
import { FiArrowLeft, FiInfo, FiPackage, FiFileText } from "react-icons/fi";

const SalesContractScreen = () => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);
  const history = useHistory();

  const { selectedBusiness, setSelectedBusiness, setContractId, businesses, contractId } =
    useSalesContext(); // ✅ Getting businesses from context

  const location = useLocation();
  let clearState = location.state?.clearState;
  useEffect(() => {
    if (clearState) {
      window.location.reload();
      setSelectedBusiness(null);
      setContractId(null);
      setSelectedTab(0);
      if (location?.state) {
        history.push({ pathname: "/add-sales-contract", state: { clearState: false } });
      }
      console.log("SalesContractScreen: State cleared and reloaded.");
    }
  }, [clearState]);

  return (
    <div className="py-6 px-6 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white font-sans sales-contract-add"  >
      <div className="w-full mx-auto my-1">
        {/* Single, left-aligned Back Button above the card */}
        <button
          className="flex items-center gap-2 text-gray-700 mb-6 px-5 py-2 rounded-full bg-white shadow hover:bg-green-50 hover:text-green-700 transition font-semibold text-lg border border-gray-200"
          onClick={() => history.push('/sales')}
        >
          <FiArrowLeft className="text-2xl" />{" "}
          <span>{t("common.back", { defaultValue: "Back" })}</span>
        </button>
        <div className="bg-white/95 rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100">
          {/* New Contract Header with icon */}
          <div className="flex items-center gap-3 mb-2">
            <FiFileText className="text-green-500 text-3xl" />
            <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
              {t("salesContract.newContract", { defaultValue: "New Contract" })}
            </h1>
          </div>
          <div className="text-gray-500 text-base mb-6 ml-1">
            {t("salesContract.createDescription", {
              defaultValue: "Fill in the details below to create a new contract.",
            })}
          </div>
          <div className="border-b border-gray-200 mb-8"></div>
          <Tabs
            selectedIndex={selectedTab}
            onSelect={(index) => setSelectedTab(index)}
          >
            <TabList className="flex mb-8 gap-4">
              <Tab
                className="flex items-center gap-2 px-6 py-2 cursor-pointer rounded-full text-gray-500 text-base font-semibold transition-all duration-200 hover:text-green-600 hover:bg-green-50 border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-green-300"
                selectedClassName="bg-green-500 text-white shadow-lg border-green-500 scale-105 z-10"
              >
                <FiInfo className="text-lg" />{" "}
                {t("salesContract.basicInfo", { defaultValue: "Basic Info" })}
              </Tab>
              <Tab
                className="flex items-center gap-2 px-6 py-2 cursor-pointer rounded-full text-gray-500 text-base font-semibold transition-all duration-200 hover:text-green-600 hover:bg-green-50 border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-green-300"
                selectedClassName="bg-green-500 text-white shadow-lg border-green-500 scale-105 z-10"
              >
                <FiPackage className="text-lg" />{" "}
                {t("salesContract.productItemInfo", {
                  defaultValue: "Product/Item Info",
                })}
              </Tab>
            </TabList>
            <div className="border-b border-gray-100 mb-8"></div>
            <TabPanel>
              <div className="animate-fade-in">
                <BasicInfo
                  businesses={businesses}
                  selectedBusiness={selectedBusiness}
                  setSelectedBusiness={setSelectedBusiness}
                  onSave={(selectedContractId) => {
                    setContractId(selectedContractId);
                    setSelectedTab(1);
                  }}
                />
              </div>
            </TabPanel>
            <TabPanel>
              <div className="animate-fade-in">
                <ProductInfo selectedBusiness={selectedBusiness} />
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </div>
      {/* Scoped style: make disabled field text visible (light green) */}
      <style jsx>{`
        .sales-contract-add input:disabled,
        .sales-contract-add select:disabled,
        .sales-contract-add textarea:disabled {
          color: #98B13D !important; /* tailwind green-500 */
          -webkit-text-fill-color: #98B13D; /* Safari */
          opacity: 1; /* ensure readable */
        }
        /* Some libraries use readonly instead of disabled */
        .sales-contract-add input[readonly],
        .sales-contract-add textarea[readonly] {
          color: #98B13D !important;
          -webkit-text-fill-color: #98B13D;
          opacity: 1;
        }
        /* Contract Date field should be black - target input with contract-date-field class */
        .sales-contract-add input.contract-date-field,
        .sales-contract-add input.contract-date-field:disabled,
        .sales-contract-add input.contract-date-field[readonly],
        .sales-contract-add .react-datepicker__input-container input.contract-date-field,
        .sales-contract-add .react-datepicker__input-container input.contract-date-field:disabled,
        .sales-contract-add .react-datepicker__input-container input.contract-date-field[readonly] {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default SalesContractScreen;
