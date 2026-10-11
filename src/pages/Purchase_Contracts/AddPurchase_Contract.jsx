import React, { useState, useEffect } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import BasicInfo from "./components/BasicInfo";
import ProductInfo from "./components/ProductInfo";
import BackButton from "@/components/BackButton";

const SalesContractScreen = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [contractId, setContractId] = useState(null); // If needed in future

  // Fetch businesses from localStorage or API
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const stored = localStorage.getItem("businesses");
        if (stored) {
          setBusinesses(JSON.parse(stored));
        } else {
          const response = await request.get("/businesses");
          setBusinesses(response.data?.data || []);
        }
      } catch (error) {
        console.error("Error loading businesses:", error);
        notifyError("Failed to load businesses");
      }
    };

    fetchBusinesses();
  }, []);

  // const { selectedBusiness, setSelectedBusiness, setContractId, businesses } =
  //   useSalesContext(); // ✅ Getting businesses from context

  return (
    <div className="p-6 bg-white min-h-screen">
      <BackButton />
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">New Contract</h1>
      </div>

      {/* Tabs Component */}
      <Tabs
        selectedIndex={selectedTab}
        onSelect={(index) => setSelectedTab(index)}
      >
        <TabList className="border-b flex space-x-4">
          <Tab
            className="p-2 cursor-pointer border-b-2"
            selectedClassName="border-green-500 font-bold text-green-600"
          >
            Basic Info
          </Tab>
          <Tab
            className="p-2 cursor-pointer border-b-2"
            selectedClassName="border-green-500 font-bold text-green-600"
          >
            Product/Item Info
          </Tab>
        </TabList>

        {/* Tab Content */}
        <TabPanel>
          <BasicInfo
            businesses={businesses} // ✅ Pass businesses to BasicInfo
            selectedBusiness={selectedBusiness}
            setSelectedBusiness={setSelectedBusiness}
            onSave={(selectedContractId) => {
              setContractId(selectedContractId);
              setSelectedTab(1);
            }}
          />
        </TabPanel>
        <TabPanel>
          <ProductInfo
            selectedBusiness={selectedBusiness}
            contractId={contractId}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default SalesContractScreen;
