import React, { useState, useRef, useEffect, useContext } from "react";
import {
  AddButton,
  DataCard,
  DataTable,
  FilterDropdown,
  PageHeader,
  StatusBadge,
} from "./StyledComponents";
import {
  FiEye,
  FiTrash2,
  FiDownload,
  FiFileText,
  FiBriefcase,
  FiX,
  FiCalendar,
  FiClock,
} from "react-icons/fi";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import collectionIcon from "../../../../../src/assets/img/icons/battery-full.png";
import CustomDatePicker from "@/components/CustomDatePicker";
import { notifyError } from "@/utils/toast";
import SalesContractSelector from "@/components/SalesContractSelector";
import TwoLevelContractsModal from "@/components/TwoLevelContractsModal";
import { MdAccountTree } from "react-icons/md";

// Separate the modal component with its own state
const CollectionDetailsModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading,
}) => {
  const [localCollectionData, setLocalCollectionData] = useState({
    address: "",
    date: "",
    time: "",
    invoiceData: null,
  });

  // Update local state when the modal opens with new initialData
  useEffect(() => {
    if (isOpen && initialData) {
      setLocalCollectionData({
        address: initialData.address || "",
        date: initialData.date || "",
        time: initialData.time || "",
        invoiceData: initialData.invoiceData || null,
      });
    }
  }, [isOpen, initialData]);

  const handleDateChange = (date) => {
    setLocalCollectionData((prev) => ({
      ...prev,
      date: date,
    }));
  };

  console.log("in component");

  const handleTimeChange = (e) => {
    const selectedTime = e.target.value;
    if (selectedTime) {
      // Ensure the time has seconds (HH:MM:SS format)
      const timeWithSeconds = selectedTime.includes(":")
        ? selectedTime.split(":").length === 2
          ? `${selectedTime}:00`
          : selectedTime
        : `${selectedTime}:00:00`;

      setLocalCollectionData((prev) => ({
        ...prev,
        time: timeWithSeconds,
      }));
    } else {
      setLocalCollectionData((prev) => ({
        ...prev,
        time: "",
      }));
    }
  };

  // This function will handle the final submission using the local state
  const handleSubmit = () => {
    onSubmit(localCollectionData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Collection Details</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-gray-600 mb-2">
              Address of the Collection
            </label>
            <input
              type="text"
              id="address"
              value={localCollectionData.address}
              onChange={(e) =>
                setLocalCollectionData((prev) => ({
                  ...prev,
                  address: e.target.value,
                }))
              }
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
              placeholder="Collection address"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-600 mb-2">Date</label>
            <CustomDatePicker
              className="bg-gray-100 rounded-md py-2 px-4 w-full focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
              bgColor="#F3F4F6"
              value={localCollectionData.date}
              onChange={handleDateChange}
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-600 mb-2">Time</label>
            <input
              type="time"
              value={localCollectionData.time?.substring(0, 5) || ""}
              onChange={handleTimeChange}
              className="w-full p-2 border rounded focus:outline-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full px-6 py-2 bg-[var(--p-blue)] text-white rounded hover:bg-[var(--p-blue)]"
            disabled={loading}
          >
            {loading ? "Sending..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Billing = ({ Data }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authRequestSent, setAuthRequestSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [invoices, setInvoices] = useState([]);
  const dropdownRef = useRef(null);
  const history = useHistory();
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isTwoLevelModalOpen, setIsTwoLevelModalOpen] = useState(false);
  const [collectionData, setCollectionData] = useState({
    address: "",
    date: "",
    time: "",
    invoiceData: null,
  });

  const handleAddNew = () => {
    // setDropdownOpen((prev) => !prev);
    setIsModalOpen(true);
    // history.push({
    //   // pathname: "/create-performa-invoice",
    //   pathname: "/create-customer-invoice",
    //   state: { contractId: Data._id },
    // })
  };

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const columns = [
    {
      key: "contractNo",
      header: "Contract No.",
      render: (row) => row.contractNo,
    },
    {
      key: "BuyerName",
      header: "Customer",
      render: (row) => row?.basicInfo?.buyerCompanyName,
    },
    {
      key: "Item",
      header: "Item",
      render: (row) =>
        `${row?.productInfo?.[0]?.title} ${row?.productInfo?.[0]?.packing} : ${
          row?.productInfo?.[0]?.remarks ||
          row?.productInfo?.[0]?.item?.remarks ||
          ""
        }`,
    },
    {
      key: "Grade",
      header: "Grade",
      render: (row) =>
        row?.productInfo?.[0]?.item?.grade ||
        row?.productInfo?.[0]?.grade ||
        "N/A",
    },
    {
      key: "TotalQTY",
      header: "QTY (MTS)",
      render: (row) => {
        const quantityMTS = row?.productInfo?.[0]?.quantityMTS || 0;
        const quantityFCL = row?.productInfo?.[0]?.quantityFCL || 0;
        const totalQTY = quantityMTS * quantityFCL;
        return formatQuantity(totalQTY);
      },
    },
    {
      key: "Price",
      header: "Price USD/MT",
      render: (row) => formatAmount(row?.productInfo?.[0]?.price),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Action",
      render: (row) => (
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <FiEye
            title="View"
            style={{ cursor: "pointer" }}
            onClick={() =>
              history.push({
                pathname: "/view-purchase-contract",
                state: { contractId: row._id },
              })
            }
          />
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchInvoices();
    // Re-fetch whenever purchase contract changes (e.g. after initial load)
  }, [Data?._id]);

  const fetchInvoices = async () => {
    if (!Data?._id) return;
    setLoading(true);
    try {
      let response = await axios.get(
        `${Base_URL}/purchase-contracts/get_assigned_to_purchase/${Data._id}`,
        { headers }
      );
      console.log("response.data.contracts", response.data.contracts);
      setInvoices(response.data.contracts);
    } catch (err) {
      console.log("Failed to fetch invoices", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCollectionModal = (invoice) => {
    if (!invoice.authLetter) {
      notifyError(
        "Please create authorization letter from treasury first, to send collection details."
      );
      return;
    }
    setCollectionData({
      address: "",
      date: "",
      time: "",
      invoiceData: invoice,
    });
    setShowCollectionModal(true);
  };

  const handleCloseCollectionModal = () => {
    setShowCollectionModal(false);
  };

  const handleSendMailToAuthorisedPerson = async (submittedData) => {
    const { address, date, time, invoiceData } = submittedData;

    // Validate all required fields
    if (!address || !date || !time) {
      notifyError("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      // Send the request to the server - backend will create the email template
      const response = await axios.post(
        `${Base_URL}/authorization-letter/send-email-authorised-person`,
        submittedData
      );

      if (response.data.success) {
        setEmailSent(true);
        handleCloseCollectionModal();
        fetchInvoices(); // Refresh invoice list to show updated status

        // Show success message for 5 seconds
        setTimeout(() => {
          setEmailSent(false);
        }, 5000);
      } else {
        throw new Error(
          response.data.message || "Failed to send collection email"
        );
      }
    } catch (error) {
      console.error("Failed to send collection email", error);
      notifyError(
        `Failed to send collection email: ${
          error.message || "Please try again"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const createAuthRequest = async (invoice) => {
    if (
      invoice.isAuthRequestGenerated === true ||
      invoice.status === "Collection Scheduled"
    ) {
      notifyError("Request already generated.");
      return;
    }
    try {
      const response = await axios.post(`${Base_URL}/auth-requests`, invoice, {
        headers,
      });

      if (response.data.success) {
        setAuthRequestSent(true);
        fetchInvoices();
        setTimeout(() => {
          setAuthRequestSent(false);
        }, 5000);
      }
    } catch (error) {
      console.error("Failed to create auth request", error);
      notifyError("Failed to create authorization request. Please try again.");
    }
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div>
      <DataCard>
        <PageHeader title="Sales Contracts">
          {/* <FilterDropdown
            options={[
              { value: "draft", label: "Draft" },
              { value: "paid", label: "Paid" },
              { value: "pending", label: "Pending" },
            ]}
            onChange={(e) => console.log("Filter changed:", e.target.value)}
          /> */}
          {/* Two-Level Contract Chain Button */}
          {Data?.is_two_level && Data?.related_contracts && (
            <button
              onClick={() => setIsTwoLevelModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: "var(--p-blue)",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#9bc030";
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "var(--p-blue)";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
              }}
            >
              <MdAccountTree size={20} />
              View Contract Chain
            </button>
          )}
          <div className="relative" ref={dropdownRef}>
            <AddButton onClick={handleAddNew} />
          </div>
        </PageHeader>

        <DataTable
          columns={columns}
          data={invoices}
          getRowKey={(row) => row.invoice_number}
          loading={loading}
        />

        {authRequestSent && (
          <div className="bg-green-100 border border-green-200 text-green-700 px-6 py-4 rounded-md mt-4 text-center">
            <h3 className="text-lg font-medium text-green-800">
              Authorization Letter Request Sent!
            </h3>
            <p>
              Authorization Letter Request has been successfully sent to the
              Treasury & Finance Team, they will respond asap.
            </p>
          </div>
        )}

        {emailSent && (
          <div className="bg-green-100 border border-green-200 text-green-700 px-6 py-4 rounded-md mt-4 text-center">
            <h3 className="text-lg font-medium text-green-800">
              Collection Details Email Sent!
            </h3>
            <p>
              Collection details have been successfully sent to the provided
              email address.
            </p>
          </div>
        )}
      </DataCard>
      <SalesContractSelector
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchInvoices();
        }}
        salesContractData={Data}
        alreadyAssignedContracts={invoices}
      />

      <CollectionDetailsModal
        isOpen={showCollectionModal}
        onClose={handleCloseCollectionModal}
        onSubmit={handleSendMailToAuthorisedPerson}
        initialData={collectionData}
        loading={loading}
      />

      {/* Two-Level Contracts Modal */}
      <TwoLevelContractsModal
        isOpen={isTwoLevelModalOpen}
        onClose={() => setIsTwoLevelModalOpen(false)}
        contractData={Data}
      />
    </div>
  );
};

export default Billing;
