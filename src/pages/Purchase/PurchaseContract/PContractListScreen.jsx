import React, { useState, useEffect } from "react";
import { FiEye, FiEdit } from "react-icons/fi"; // Importing the pen icon
import { useHistory } from "react-router-dom";
import useButtonColor from "@/hooks/useButtonColor";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { DataTable, PageHeader, SummaryCards } from "@/page-layouts/index";

const PContractListScreen = () => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = useState("");
  const buttonColor = useButtonColor();
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]); // State for businesses

  const headers = [
    "Purchase Contract No.",
    "Buyer Name",
    "Quantity",
    "Price",
    "Status",
    "Action",
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
    }
  };

  const handleSearch = (value) => {
    const searchValue = value.toLowerCase();
    setSearchTerm(searchValue);
    setLoading(true);

    const filtered = contracts.filter(
      (contract) =>
        contract.basicInfo.contractNumber.toLowerCase().includes(searchValue) ||
        contract.basicInfo.supplierName.toLowerCase().includes(searchValue)
    );
    setFilteredContracts(filtered);
    setLoading(false);
  };

  const handleBusinessChange = (value) => {
    const businessId = value;
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
      label: "Select a Business",
      placeholder: "Select a Business",
      value: selectedBusiness,
      options: businesses.map((business) => {
        return {
          label: business.name,
          value: business._id,
        };
      }),
      onChange: handleBusinessChange,
    },
  ];

  return (
    <div
      className="p-6 bg-white min-h-screen"
      style={{ backgroundColor: "#FFFF" }}
    >
      <PageHeader
        title="Purchase Contract"
        addButtonText="Add New"
        showAddButton={true}
        onAddNew={() => history.push("/New Contract")}
      />

      <SummaryCards
        cards={[
          {
            title: "Total Contracts",
            value: contracts.length,
            isHighlighted: true,
          },
          {
            title: "Open Contracts",
            value: contracts.filter((contract) => contract.status === "Open")
              .length,
            isHighlighted: false,
          },
          {
            title: "Cancelled Contracts",
            value: contracts.filter(
              (contract) => contract.status === "Cancelled"
            ).length,
            isHighlighted: false,
          },
          {
            title: "Completed Contracts",
            value: contracts.filter(
              (contract) => contract.status === "Completed"
            ).length,
            isHighlighted: false,
          },
        ]}
      />

      <DataTable
        onSearch={handleSearch}
        searchValue={searchTerm}
        searchPlaceholder="Search"
        headers={headers}
        noPagination={true}
        data={filteredContracts || []}
        loading={loading}
        filters={filters}
        renderRow={(contract) => (
          <tr key={contract._id} className="border-b">
            <td className="py-2 px-4">{contract.basicInfo.contractNumber}</td>
            <td className="py-2 px-4">{contract.basicInfo.supplierName}</td>
            <td className="py-2 px-4">{contract.productInfo[0]?.item}</td>
            <td className="py-2 px-4">{contract.productInfo[0]?.price}</td>
            <td className={`py-2 px-4 font-medium ${statusColors["Open"]}`}>
              Open
            </td>
            <td className="py-2 px-4">
              <button
                className="p-2 hover:bg-gray-100 rounded-md"
                onClick={() => handleViewContract(contract._id)}
              >
                <FiEye className="text-gray-600" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 rounded-md ml-2"
                onClick={() => handleEditContract(contract._id)}
              >
                <FiEdit className="text-gray-600" />
              </button>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default PContractListScreen;
