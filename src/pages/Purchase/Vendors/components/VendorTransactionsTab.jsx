import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import { Eye, PenSquare } from "lucide-react";
import ActivityTimeline from "@/components/timeline/ActivityTimeline";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const VendorTransactionsTab = ({ vendorId }) => {
  const history = useHistory();
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("All");
  const [selectedInvoiceTypeFilter, setSelectedInvoiceTypeFilter] =
    useState("All");
  const [selectedInvoiceStatusFilter, setSelectedInvoiceStatusFilter] =
    useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [invoices, setInvoices] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const storedBusinesses = localStorage.getItem("businesses");
        if (storedBusinesses) {
          setBusinesses(JSON.parse(storedBusinesses));
        }
      } catch (error) {
        // Handle error
      }
    };
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (!isSingleAssignedBusiness() || businesses.length !== 1) return;
    const onlyId = businesses[0]?._id;
    if (!onlyId) return;
    if (selectedBusinessFilter !== "All") return;
    setSelectedBusinessFilter(String(onlyId));
  }, [businesses, selectedBusinessFilter]);

  const filters = [
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Business",
            value: selectedBusinessFilter,
            onChange: setSelectedBusinessFilter,
            options: [
              { value: "All", label: "All Businesses" },
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
            placeholder: "Select Business",
          },
        ]
      : []),
    {
      label: "Invoice Type",
      value: selectedInvoiceTypeFilter,
      onChange: setSelectedInvoiceTypeFilter,
      options: [
        { value: "All", label: "All Types" },
        { value: "Commercial", label: "Commercial" },
        { value: "Proforma", label: "Proforma" },
      ],
      placeholder: "Invoice Type: All",
    },
    {
      label: "Invoice Status",
      value: selectedInvoiceStatusFilter,
      onChange: setSelectedInvoiceStatusFilter,
      options: [
        { value: "All", label: "All Statuses" },
        { value: "Draft", label: "Draft" },
        { value: "Generated", label: "Generated" },
        { value: "Request Sent", label: "Request Sent" },
        { value: "Collection Scheduled", label: "Collection Scheduled" },
        { value: "Paid", label: "Paid" },
      ],
      placeholder: "Invoice Status: All",
    },
    {
      label: "Date Created",
      value: selectedDateCreatedFilter,
      onChange: (val) => setSelectedDateCreatedFilter(val),
      isDatePicker: true,
      placeholder: "Date Created",
    },
  ];

  const fetchInvoices = async () => {
    try {
      const res = await axios.get(`${Base_URL}/vendor-invoices`, {
        params: {
          businessId: selectedBusinessFilter,
          vendorId: vendorId,
          invoiceType: selectedInvoiceTypeFilter,
          status: selectedInvoiceStatusFilter,
          dateCreated: selectedDateCreatedFilter,
          dueDate: selectedDueDateFilter,
          search: searchTerm,
          page: currentPage,
          limit: entriesPerPage,
        },
      });

      setInvoices(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      // Handle error
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchInvoices();
    // eslint-disable-next-line
  }, [
    selectedBusinessFilter,
    selectedInvoiceTypeFilter,
    selectedInvoiceStatusFilter,
    selectedDateCreatedFilter,
    selectedDueDateFilter,
    searchTerm,
    vendorId,
  ]);

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line
  }, [currentPage, entriesPerPage]);

  const handleOpenFile = async (documentId) => {
    if (!documentId) return;
    try {
      let response = await axios.get(
        `${Base_URL}/documents/getFileWithAllData/${documentId}`
      );
      window.open(response.data.data.url, "_blank");
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Vendor Invoices</h2>
      <DataTable
        filters={filters}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
        recordsPerPage={entriesPerPage}
        onRecordsPerPageChange={(num) => {
          setEntriesPerPage(num);
          setCurrentPage(1);
        }}
        searchValue={searchTerm}
        onSearch={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search Invoice"
        headers={[
          "Invoice No",
          "Invoice Type",
          "Invoice Date",
          "Due Date",
          "Amount",
          "Status",
          "Document",
          "Action",
        ]}
        data={invoices}
        colWidths={{
          Name: "200px",
          Status: "100px",
        }}
        renderRow={(invoice) => (
          <tr key={invoice._id} className="border-b">
            <td className="py-4">{invoice.invoice_number}</td>
            <td className="py-4">{invoice?.invoiceType}</td>
            <td className="py-4">{formatDate(invoice?.invoice_date)}</td>
            <td className="py-4">{formatDate(invoice?.due_date)}</td>
            <td className="py-4">{formatAmount(invoice?.subTotal)}</td>
            <td className="py-4">{invoice?.status}</td>
            <td className="py-4 text-center">
              {invoice?.supportingDocument?.fileId && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenFile(invoice.supportingDocument.fileId)
                  }
                  className="text-sm text-blue-600 hover:underline text-center"
                >
                  View
                </button>
              )}
            </td>
            <td className="py-4 text-center">
              <div className="flex space-x-4">
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    history.push(`/view-vendor-invoice/${invoice._id}`)
                  }
                >
                  <Eye size={18} />
                </button>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    history.push(`/update-vendor-invoice/${invoice._id}`)
                  }
                >
                  <PenSquare size={18} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />
      <div className="mt-6 border-t pt-4">
        <ActivityTimeline
          query={{ vendorId }}
          title="Activity timeline"
          pageSize={10}
          compact
          embedded
        />
      </div>
    </div>
  );
};

export default VendorTransactionsTab;
