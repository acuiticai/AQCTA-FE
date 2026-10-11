import React, { useState, useEffect } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import { FiArrowLeft } from "react-icons/fi";
import BasicInfo from "./components/BasicInfo";
import ProductInfo from "./components/ProductInfo";
import ContractSales from "./components/ContractSales";
import ContractShipment from "./components/ContractShipment";
import {
  ContractProvider,
  useContractContext,
} from "./context/ContractContext";
import { useHistory, useParams } from "react-router-dom";
import { DropdownBasic, PageHeader } from "@/page-layouts/index";

const PContractContent = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const history = useHistory();
  const { contractId } = useParams();
  const {
    contractData,
    updateContractData,
    saveContract,
    businesses,
    fetchContract,
  } = useContractContext();

  useEffect(() => {
    if (contractId) {
      fetchContract(contractId);
    }
  }, [contractId]);

  return (
    <div className="p-6 bg-white min-h-screen">
      <button
        className="flex items-center text-gray-600 hover:text-gray-800 transition mb-4"
        onClick={() => history.goBack()}
      >
        <FiArrowLeft className="mr-2" /> Back
      </button>

      <div className="flex justify-between items-center mb-4">
        <PageHeader title={contractId ? "Edit Contract" : "New Contract"} />

        <DropdownBasic
          value={contractData.businessId}
          onChange={(value) => updateContractData("businessId", value)}
          placeholder="Select a Business"
          options={businesses.map((business) => ({
            label: business.name,
            value: business._id,
          }))}
        />
      </div>

      <Tabs
        selectedIndex={selectedTab}
        onSelect={(index) => setSelectedTab(index)}
      >
        <TabList className="flex space-x-4 mb-6">
          {[
            "Basic Info",
            "Product Info",
            "Contract Sales",
            "Contract Shipment",
          ].map((tab, index) => (
            <Tab
              key={index}
              className="p-2 cursor-pointer border-b-2"
              selectedClassName="border-p-blue font-bold text-p-blue"
            >
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanel>
          <BasicInfo />
        </TabPanel>
        <TabPanel>
          <ProductInfo />
        </TabPanel>
        <TabPanel>
          <ContractSales />
        </TabPanel>
        <TabPanel>
          <ContractShipment />
        </TabPanel>
      </Tabs>

      <div className="flex justify-end space-x-3 mt-4">
        <button
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md"
          onClick={() => history.goBack()}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md"
          onClick={() => saveContract(contractId)}
        >
          {contractId ? "Update Contract" : "Save Contract"}
        </button>
      </div>
    </div>
  );
};

const PContractScreen = () => {
  return (
    <ContractProvider>
      <PContractContent />
    </ContractProvider>
  );
};

export default PContractScreen;
