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
import { formatAmount, formatDate } from "@/components/formatAmount";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import collectionIcon from "../../../../../src/assets/img/icons/battery-full.png";
import CustomDatePicker from "@/components/CustomDatePicker";
import { notifyError } from "@/utils/toast";

// Simple Tooltip Component
const Tooltip = ({ children, text }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div
          className="absolute z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap"
          style={{
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "5px",
          }}
        >
          {text}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #1f2937",
            }}
          />
        </div>
      )}
    </div>
  );
};
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
  const [authRequestSent, setAuthRequestSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [invoices, setInvoices] = useState([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const dropdownRef = useRef(null);
  const history = useHistory();
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionData, setCollectionData] = useState({
    address: "",
    date: "",
    time: "",
    invoiceData: null,
  });

  const [payments, setPayments] = useState([]);
  console.log("testing");

  const handleAddNew = () => {
    // setDropdownOpen((prev) => !prev);
    history.push({
      // pathname: "/create-performa-invoice",
      pathname: "/create-customer-invoice",
      state: { contractId: Data._id },
    });
  };

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const columns = [
    {
      key: "invoice_date",
      header: "Invoice Date",
      render: (row) => formatDate(row.invoice_date),
    },
    { key: "invoice_number", header: "Invoice Number" },
    {
      key: "type",
      header: "Invoice Type",
      render: (row) =>
        row.invoiceType === "Proforma" ? "Proforma" : "Commercial",
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (row) => formatDate(row.due_date),
    },
    {
      key: "grandTotal",
      header: "Amount",
      render: (row) =>
        formatAmount(
          row.invoiceType === "Proforma"
            ? row.advanceDepositAmount || row.depositAmount
            : row.grandTotal
        ),
    },
    // {
    //   key: "remaining",
    //   header: "Remaining Amount",
    //   render: (row) => {
    //     if (row?.status === "Paid") {
    //       return "0.00";
    //     }
    //     return formatAmount(row.remaining);
    //   },
    // },
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
          {console.log("row.status", row?.status)}
          {row?.status === "Paid" ? (
            ""
          ) : row?.status === "Request Issued" ||
            row?.status === "Request Sent" ? (
            <Tooltip text="Collection Details">
              <div>
                <img
                  src={collectionIcon}
                  className="w-5 h-5"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleOpenCollectionModal(row)}
                />
              </div>
            </Tooltip>
          ) : (
            <Tooltip text="Generate Authorization Letter">
              <FiFileText
                style={{ cursor: "pointer" }}
                onClick={() => createAuthRequest(row)}
              />
            </Tooltip>
          )}
          <Tooltip text="View Invoice">
            <FiEye
              style={{ cursor: "pointer" }}
              onClick={() =>
                history.push({
                  pathname: `/view-customer-invoice/${row?._id}`,
                  state: row,
                })
              }
            />
          </Tooltip>
          <Tooltip text="Download Invoice">
            <FiDownload
              style={{ cursor: "pointer" }}
              onClick={async () => {
                try {
                  let response = await axios.get(
                    `${Base_URL}/proforma-invoice/download/${row._id}`,
                    { headers }
                  );
                  if (response.data?.data) {
                    window.open(response.data.data, "_blank");
                  }
                } catch (err) {
                  console.log("Failed to download invoice", err);
                }
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const columnsPayment = [
    {
      key: "invoice_date",
      header: "Invoice Date",
      render: (row) => formatDate(row.invoice_date),
    },
    { key: "invoice_number", header: "Invoice Number" },
    {
      key: "type",
      header: "Invoice Type",
      render: (row) =>
        row.invoiceType === "Proforma" ? "Proforma" : "Commercial",
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (row) => formatDate(row.due_date),
    },
    {
      key: "grandTotal",
      header: "Amount",
      render: (row) =>
        formatAmount(
          row.advanceDepositAmount || row.depositAmount || row.grandTotal
        ),
    },
    {
      key: "remaining",
      header: "Remaining Amount",
      render: (row) => {
        if (row?.status === "Paid") {
          return "0.00";
        }
        return formatAmount(row.remaining);
      },
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
          {/* <Tooltip text="View Payment">
            <FiEye
              style={{ cursor: "pointer" }}
              onClick={() =>
                history.push({
                  pathname: "/view_invoice_details",
                  state: row,
                })
              }
            />
          </Tooltip> */}
          <Tooltip text="Download Payment">
            <FiDownload
              style={{ cursor: "pointer" }}
              onClick={async () => {
                try {
                  let response = await axios.get(
                    `${Base_URL}/proforma-invoice/download/${row._id}`,
                    { headers }
                  );
                  if (response.data?.data) {
                    window.open(response.data.data, "_blank");
                  }
                } catch (err) {
                  console.log("Failed to download invoice", err);
                }
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchInvoices();
    fetchPayments();
  }, [Data?._id, selectedStatusFilter]);

  const fetchPayments = async () => {
    if (!Data?._id) return;
    setLoading(true);
    try {
      let response = await axios.get(
        `${Base_URL}/proforma-invoice/get-contract-payments/${Data._id}`,
        { headers }
      );

      console.log("response.data.data", response.data.data);
      setPayments(response.data.data);
    } catch (err) {
      console.log("Failed to fetch payments", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    if (!Data?._id) return;
    setLoading(true);
    try {
      // Statuses that may have case mismatches in database (Paid, Partially Paid)
      // For these, we'll skip backend filter and filter client-side only
      const statusesWithCaseIssues = [
        "Paid",
        "Partially Paid",
        "paid",
        "partially paid",
      ];
      const shouldFilterClientSideOnly =
        selectedStatusFilter &&
        selectedStatusFilter !== "All" &&
        statusesWithCaseIssues.some(
          (s) => s.toLowerCase() === selectedStatusFilter.toLowerCase()
        );

      // Build query params with status filter
      const params = {};
      // Only send status to backend if it's not a problematic status
      if (
        selectedStatusFilter &&
        selectedStatusFilter !== "All" &&
        !shouldFilterClientSideOnly
      ) {
        params.status = selectedStatusFilter.toLowerCase();
      }

      let response = await axios.get(
        `${Base_URL}/proforma-invoice/get_by_contract/${Data._id}`,
        {
          headers,
          params,
        }
      );

      // Apply case-insensitive client-side filtering
      // This is especially important for statuses with case mismatches (Paid, Partially Paid)
      let filteredInvoices = response.data.data || [];
      if (selectedStatusFilter && selectedStatusFilter !== "All") {
        const normalizedFilterStatus = selectedStatusFilter.toLowerCase();
        filteredInvoices = filteredInvoices.filter((invoice) => {
          if (!invoice.status) return false;
          const invoiceStatus = invoice.status.toLowerCase().trim();

          // Handle special cases
          if (
            normalizedFilterStatus === "request sent" ||
            normalizedFilterStatus === "sent"
          ) {
            return invoiceStatus === "request sent" || invoiceStatus === "sent";
          }

          // Handle "Partially Paid" variations
          if (normalizedFilterStatus === "partially paid") {
            return invoiceStatus === "partially paid";
          }

          // Handle "Paid" variations
          if (normalizedFilterStatus === "paid") {
            return invoiceStatus === "paid";
          }

          return invoiceStatus === normalizedFilterStatus;
        });
      }

      setInvoices(filteredInvoices);
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
        <PageHeader title="Invoices">
          <FilterDropdown
            options={[
              { value: "All", label: "All Statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Generated", label: "Generated" },
              { value: "Request Sent", label: "Request Sent" },
              { value: "Sent", label: "Sent" },
              { value: "Collection Scheduled", label: "Collection Scheduled" },
              { value: "Partially Paid", label: "Partially Paid" },
              { value: "Paid", label: "Paid" },
            ]}
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          />
          <div className="relative" ref={dropdownRef}>
            <AddButton onClick={handleAddNew} />
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg z-10 border">
                <ul className="py-1">
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() =>
                      history.push({
                        // pathname: "/create-performa-invoice",
                        pathname: "/create-customer-invoice",
                        state: { contractId: Data._id },
                      })
                    }
                  >
                    Performa Invoice
                  </li>
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => console.log("Commercial Invoice Clicked")}
                  >
                    Commercial Invoice
                  </li>
                </ul>
              </div>
            )}
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

      <DataCard>
        <PageHeader title="Payments">
          <div className="relative">
            <AddButton onClick={() => console.log("Add new payment")} />
          </div>
        </PageHeader>

        <DataTable
          columns={columnsPayment}
          data={payments}
          getRowKey={(row) => row.payment_id}
        />
      </DataCard>

      <CollectionDetailsModal
        isOpen={showCollectionModal}
        onClose={handleCloseCollectionModal}
        onSubmit={handleSendMailToAuthorisedPerson}
        initialData={collectionData}
        loading={loading}
      />
    </div>
  );
};

export default Billing;
