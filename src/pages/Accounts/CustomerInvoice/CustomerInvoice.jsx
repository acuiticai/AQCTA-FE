import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiEye, FiEdit } from "react-icons/fi"; // Importing the pen icon
import { Link, useHistory } from "react-router-dom";
import Dropdown from "@/components/Dropdown";
import SearchBar from "@/components/SearchBar";
import Table from "@/components/Table";
import StyledLabel2 from "@/components/StyledLabel2";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifySuccess, notifyError } from "@/utils/toast";
import { Button, DataTable, PageHeader } from "@/page-layouts/index";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";

const CustomerInvoice = () => {
  useTranslation();
  const history = useHistory();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]); // State for businesses

  const headers = [
    ciText("Purchase Contract No."),
    ciText("Buyer Name"),
    ciText("Quantity"),
    ciText("Price"),
    ciText("Status"),
    ciText("Action"),
  ];

  const statusColors = {
    Open: "text-green-500",
    Draft: "text-lime-500", // Light Green for draft
    "Waiting Management Approval": "text-blue-500", // Blue for pending approval
    "Preparing Contract": "text-orange-500", // Orange for in-progress contract
    "Waiting Customer Approval": "text-yellow-500", // Yellow to indicate waiting status
    Pending: "text-purple-500", // Purple for general pending states
    Processing: "text-indigo-500", // Indigo for active processing
    "On-hold": "text-gray-500", // Gray for hold status
    Cancelled: "text-red-500", // Red for cancellations
    Completed: "text-green-500", // Green for completed contracts
  };

  // Static Business Data
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const parsedBusinesses = JSON.parse(storedBusinesses);
      setBusinesses(parsedBusinesses);
      if (parsedBusinesses.length > 0) {
        setSelectedBusiness(parsedBusinesses[0]._id); // Set first business as default
        fetchContracts(parsedBusinesses[0]._id); // Fetch contracts for the first business
      }
    }
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      fetchContracts(selectedBusiness); // Fetch contracts based on selected business
    }
  }, [selectedBusiness]);

  const fetchContracts = async (businessId) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/contracts/business/${businessId}`
      );
      setContracts(response.data.data); // Assuming the response contains data
      setFilteredContracts(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    const searchValue = value.toLowerCase();
    setSearchTerm(searchValue);

    const filtered = contracts.filter(
      (contract) =>
        contract.basicInfo.contractNumber.toLowerCase().includes(searchValue) ||
        contract.basicInfo.supplierName.toLowerCase().includes(searchValue)
    );
    setFilteredContracts(filtered);
  };

  const handleBusinessChange = (businessId) => {
    setSelectedBusiness(businessId);
  };

  const handleViewContract = (contractId) => {
    history.push(`/Contract Details/${contractId}`);
  };

  const handleEditContract = (contractId) => {
    console.log("Navigating to edit screen with contractId:", contractId);
    history.push(`/Edit Contract/${contractId}`);
  };

  const filters = [
    {
      placeholder: ciText("Select a Business"),
      onChange: handleBusinessChange,
      value: selectedBusiness,
      options: businesses.map((business) => ({
        value: business._id,
        label: `${business.name}`,
      })),
    },
  ];

  const CustomFilterComponent = () => {
    return (
      <div className="flex justify-right gap-2">
        <Button secondary onClick={() => history.push("/New Contract")}>
          <FiPlus className="mr-2 text-black" /> {ciText("Create Invoice")}
        </Button>
        <Button primary onClick={() => history.push("/PrepareSaleContract")}>
          <FiPlus className="mr-2" /> {ciText("Prepare Sales Contract")}
        </Button>
        <Button
          primary
          onClick={() => history.push("/PreparePurchaseContract")}
        >
          <FiPlus className="mr-2" /> {ciText("Prepare Purchase Contract")}
        </Button>
      </div>
    );
  };

  return (
    <div
      className="p-6 bg-white min-h-screen"
      style={{ backgroundColor: "#FFFF" }}
    >
      <div className="flex justify-between mb-6">
        <PageHeader
          title={ciText("Customer Invoice Management")}
          CustomFilterComponent={CustomFilterComponent}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-green-100 rounded-lg shadow-md">
          <p className="text-sm text-gray-600">{ciText("Total Invoices")}</p>
          <h2 className="text-xl font-bold">{contracts.length}</h2>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <p className="text-sm text-gray-600">{ciText("Open Contracts")}</p>
          <h2 className="text-xl font-bold">
            {contracts.filter((contract) => contract.status === "Open").length}
          </h2>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <p className="text-sm text-gray-600">
            {ciText("Cancelled Contracts")}
          </p>
          <h2 className="text-xl font-bold">
            {
              contracts.filter((contract) => contract.status === "Cancelled")
                .length
            }
          </h2>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <p className="text-sm text-gray-600">
            {ciText("Completed Contracts")}
          </p>
          <h2 className="text-xl font-bold">
            {
              contracts.filter((contract) => contract.status === "Completed")
                .length
            }
          </h2>
        </div>
      </div>

      <div
        className="bg-white shadow-md rounded-xl p-4"
        style={{ backgroundColor: "#F9F9FA" }}
      >
        <DataTable
          title={ciText("All Contracts")}
          filters={filters}
          loading={loading}
          headers={headers}
          noPagination={true}
          searchValue={searchTerm}
          onSearch={handleSearch}
          searchPlaceholder={ciText("Search")}
          noPadding={true}
          data={filteredContracts}
          renderRow={(contract) => (
            <tr key={contract._id} className="border-b">
              <td className="py-2 px-4">{contract.basicInfo.contractNumber}</td>
              <td className="py-2 px-4">{contract.basicInfo.supplierName}</td>
              <td className="py-2 px-4">{contract.productInfo[0]?.item}</td>
              {/* Displaying product item */}
              <td className="py-2 px-4">{contract.productInfo[0]?.price}</td>
              {/* Displaying price */}
              <td className={`py-2 px-4 font-medium ${statusColors["Open"]}`}>
                {ciText("Open")}
              </td>
              <td className="py-2 px-4">
                <button
                  className="p-2 hover:bg-gray-100 rounded-md"
                  onClick={() => handleViewContract(contract._id)}
                  title={ciText("View")}
                >
                  <FiEye className="text-gray-600" />
                </button>
                <button
                  className="p-2 hover:bg-gray-100 rounded-md ml-2"
                  onClick={() => handleEditContract(contract._id)}
                  title={ciText("Edit")}
                >
                  <FiEdit className="text-gray-600" />
                </button>
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
};

export default CustomerInvoice;
