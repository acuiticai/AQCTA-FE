import React, { useState, useContext, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import BusinessDropdown from "@/components/BusinessDropdown";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { formatDate, formatAmount } from "@/components/formatAmount";
import CustomPagination from "@/components/CustomPagination";
import { Select } from "@windmill/react-ui";
import actionButton from "../../assets/img/icons/document-text.png";
import { notifySuccess } from "@/utils/toast";
import { PageHeader, DataTable } from "@/page-layouts/index";

const Receivables = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [selectedBusiness, setSelectedBusiness] = useState();
  const [receivables, setReceivables] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchReceivables = async (
    businessId = "",
    page = 1,
    limit = recordsPerPage,
    search = "",
    status = ""
  ) => {
    const params = {
      businessId,
      page,
      limit,
      search,
      status: "Collection Scheduled", // We only want receivables with this status
    };
    try {
      const response = await axios.get(`${Base_URL}/auth-requests`, { params });
      console.log("receivables!", response.data.data);
      setReceivables(response.data.data);
      setTotalResults(response.data.count);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchReceivables(
      selectedBusiness,
      page,
      recordsPerPage,
      searchTerm,
      statusFilter
    );
  };

  const onChange = async (value) => {
    console.log("value", value);
    setSelectedBusiness(value);
    fetchReceivables(value, 1, recordsPerPage, searchTerm, statusFilter);
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    fetchReceivables(selectedBusiness, 1, recordsPerPage, value, statusFilter);
  };

  const handleStatusChange = (e) => {
    const value = e.target.value;
    setStatusFilter(value);
    fetchReceivables(selectedBusiness, 1, recordsPerPage, searchTerm, value);
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setCategoryFilter(value);
    // Add category filtering logic when backend support is available
  };

  const handleRecordPayment = (receivable) => {
    // Navigate to invoice viewer with state to auto-open payment modal
    history.push({
      pathname: `/view-customer-invoice/${receivable._id}`,
      state: {
        fromReceivables: true,
        autoOpenPaymentModal: true,
      },
    });
  };

  return (
    <div className="p-6">
      <PageHeader title="Receivables" />

      <div className="bg-gray-50 rounded-lg">
        <DataTable
          headers={[
            "Invoice No",
            "Sales Contract No",
            "Customer",
            "Amount",
            "Due Date",
            "Status",
            "Action",
          ]}
          data={receivables}
          loading={false}
          currentPage={currentPage}
          totalPages={Math.ceil(totalResults / recordsPerPage)}
          recordsPerPage={recordsPerPage}
          onPageChange={handlePageChange}
          onRecordsPerPageChange={(value) => {
            setRecordsPerPage(value);
            currentPageRef.current = 1;
            setCurrentPage(1);
            fetchReceivables(
              selectedBusiness,
              1,
              value,
              searchTerm,
              statusFilter
            );
          }}
          renderRow={(receivable) => (
            <tr className="border-b border-gray-200">
              <td className="py-4">{receivable.invoice_number}</td>
              <td className="py-4">{receivable.contract_id.contractNo}</td>
              <td className="py-4">{receivable.customer_name}</td>
              <td className="py-4">{formatAmount(receivable.subTotal)}</td>
              <td className="py-4">{formatDate(receivable.due_date)}</td>
              <td className="py-4">
                <span className="text-red-500 font-medium">
                  {receivable.status}
                </span>
              </td>
              <td className="py-4">
                <div className="flex space-x-2">
                  <button
                    className="text-gray-500 hover:text-[var(--p-blue)] transition-colors duration-200"
                    onClick={() => handleRecordPayment(receivable)}
                    title="Record Payment"
                  >
                    <img src={actionButton} alt="Record Payment" />
                  </button>
                </div>
              </td>
            </tr>
          )}
          emptyMessage="No receivables found"
          filters={[
            {
              label: "Transaction Type",
              value: statusFilter,
              onChange: (value) => handleStatusChange({ target: { value } }),
              options: [
                { label: "All", value: "" },
                {
                  label: "Collection Scheduled",
                  value: "Collection Scheduled",
                },
                { label: "Paid", value: "Paid" },
              ],
            },
            {
              label: "Category",
              value: categoryFilter,
              onChange: (value) => handleCategoryChange({ target: { value } }),
              options: [
                { label: "All", value: "" },
                { label: "Invoice", value: "invoice" },
                { label: "Contract", value: "contract" },
              ],
            },
            {
              isBusinessDropdown: true,
              businessDropdownProps: {
                adminId: adminInfo.id,
                selectedBusiness: selectedBusiness,
                onChange: onChange,
              },
            },
          ]}
          searchValue={searchTerm}
          onSearch={handleSearch}
          searchPlaceholder="Search receivables"
        />
      </div>
    </div>
  );
};

export default Receivables;
