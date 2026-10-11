import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable } from "@/page-layouts/index";
import { formatDate, formatAmount } from "@/components/formatAmount";
import { Eye, PenSquare } from "lucide-react";
import ActivityTimeline from "@/components/timeline/ActivityTimeline";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TransactionsTab = ({ customerId }) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [businesses, setBusinesses] = useState([]);
  const [salesContracts, setSalesContracts] = useState([]);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("All");
  const [selectedInvoiceTypeFilter, setSelectedInvoiceTypeFilter] =
    useState("All");
  const [selectedInvoiceStatusFilter, setSelectedInvoiceStatusFilter] =
    useState("All");
  const [selectedDateCreatedFilter, setSelectedDateCreatedFilter] =
    useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("");
  const [selectedSalesContractsFilter, setSelectedSalesContractsFilter] =
    useState("All");
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

    const fetchSalesContracts = async () => {
      try {
        const response = await axios.get(`${Base_URL}/sales-contracts`);
        setSalesContracts(response?.data?.contracts || []);
      } catch (error) {
        // Handle error
      }
    };
    fetchSalesContracts();
  }, []);

  const filters = [
    {
      label: t("accounts.customerInvoices.business"),
      value: selectedBusinessFilter,
      onChange: setSelectedBusinessFilter,
      options: [
        { value: "All", label: t("common.allBusinesses") },
        ...businesses.map((b) => ({ value: b._id, label: b.name })),
      ],
      placeholder: t("accounts.customerInvoices.selectBusiness"),
    },
    {
      label: t("accounts.customerInvoices.invoiceType"),
      value: selectedInvoiceTypeFilter,
      onChange: setSelectedInvoiceTypeFilter,
      options: [
        { value: "All", label: t("accounts.customerInvoices.allTypes") },
        { value: "Commercial", label: t("accounts.customerInvoices.commercial") },
        { value: "Proforma", label: t("accounts.customerInvoices.proforma") },
      ],
      placeholder: t("customer.invoices.invoiceTypeAll"),
    },
    {
      label: t("accounts.customerInvoices.invoiceStatus"),
      value: selectedInvoiceStatusFilter,
      onChange: setSelectedInvoiceStatusFilter,
      options: [
        { value: "All", label: t("accounts.customerInvoices.allStatuses") },
        { value: "Draft", label: t("accounts.customerInvoices.draft") },
        { value: "Generated", label: t("accounts.customerInvoices.generated") },
        { value: "Request Sent", label: t("accounts.customerInvoices.requestSent") },
        { value: "Collection Scheduled", label: t("accounts.customerInvoices.collectionScheduled") },
        { value: "Paid", label: t("accounts.customerInvoices.paid") },
      ],
      placeholder: t("customer.invoices.invoiceStatusAll"),
    },
    {
      label: t("accounts.customerInvoices.dateCreated"),
      value: selectedDateCreatedFilter,
      onChange: (val) => setSelectedDateCreatedFilter(val),
      isDatePicker: true,
      placeholder: t("accounts.customerInvoices.dateCreated"),
    },
    {
      label: t("accounts.customerInvoices.salesContracts"),
      value: selectedSalesContractsFilter,
      onChange: setSelectedSalesContractsFilter,
      options: [
        { value: "All", label: t("accounts.customerInvoices.allContracts") },
        ...salesContracts.map((c) => ({ value: c._id, label: c.contractNo })),
      ],
      placeholder: t("customer.invoices.salesContractsAll"),
    },
  ];

  const fetchInvoices = async () => {
    try {
      const res = await axios.get(`${Base_URL}/proforma-invoice`, {
        params: {
          businessId: selectedBusinessFilter,
          module: "customer-invoices",
          customerId: customerId,
          invoiceType: selectedInvoiceTypeFilter,
          status: selectedInvoiceStatusFilter,
          dateCreated: selectedDateCreatedFilter,
          dueDate: selectedDueDateFilter,
          contractId: selectedSalesContractsFilter,
          search: searchTerm,
          page: currentPage,
          limit: entriesPerPage,
        },
      });

      console.log("res tab", res.data);
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
    selectedSalesContractsFilter,
    searchTerm,
    customerId,
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
      <h2 className="text-lg font-semibold mb-4">{t("customer.invoices.title")}</h2>
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
        searchPlaceholder={t("customer.invoices.searchPlaceholder")}
        headers={[
          t("customer.invoices.invoiceNo"),
          t("customer.invoices.invoiceType"),
          t("customer.invoices.invoiceDate"),
          t("customer.invoices.dueDate"),
          t("customer.invoices.amount"),
          t("customer.invoices.status"),
          t("customer.invoices.document"),
          t("common.action"),
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
                  {t("common.view")}
                </button>
              )}
            </td>
            <td className="py-4 text-center">
              <div className="flex space-x-4">
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    history.push(`/view-customer-invoice/${invoice._id}`)
                  }
                >
                  <Eye size={18} />
                </button>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    history.push(`/update-customer-invoice/${invoice._id}`)
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
          query={{ customerId }}
          title={t("customer.invoices.activityTimeline")}
          pageSize={10}
          compact
          embedded
        />
      </div>
    </div>
  );
};

export default TransactionsTab;
