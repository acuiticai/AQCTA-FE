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
        <h1 className="text-xl font-semibold">
          {contractId ? "Edit Contract" : "New Contract"}
        </h1>

        <select
          value={contractData.businessId}
          onChange={(e) => updateContractData("businessId", e.target.value)}
          className="block w-52 border-gray-300 focus:outline-none rounded-md focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
        >
          <option value="">Select a Business</option>
          {businesses.map((business) => (
            <option key={business._id} value={business._id}>
              {business.name}
            </option>
          ))}
        </select>
      </div>

      <Tabs
        selectedIndex={selectedTab}
        onSelect={(index) => setSelectedTab(index)}
      >
        <TabList className="border-b flex space-x-4">
          {[
            "Basic Info",
            "Product Info",
            "Contract Sales",
            "Contract Shipment",
          ].map((tab, index) => (
            <Tab
              key={index}
              className="p-2 cursor-pointer border-b-2"
              selectedClassName="border-green-500 font-bold text-green-600"
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
