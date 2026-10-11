import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Building, FileText, Plus, User } from "lucide-react";
import {
  ActionButtons,
  DataTable,
  SummaryCards,
  DateRangeComponent,
} from "@/page-layouts/index";
import StandardPageHeader from "@/components/StandardPageHeader";
import { formatAmount, formatDate } from "@/components/formatAmount";
import QuotationServices from "@/services/QuotationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "../../../assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const isPciApplicationQuotation = (quotation) =>
  ["product_certification", "engineering_inspection"].includes(
    String(quotation?.module || "").trim(),
  );

const emptyStats = {
  draft: 0,
  sent: 0,
  accepted: 0,
  rejected: 0,
  expired: 0,
  totalValue: 0,
};

const statusStyles = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
};

function StatusBadge({ status, t }) {
  const normalized = QuotationServices.normalizeStatus(status);
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${
        statusStyles[normalized] || statusStyles.draft
      }`}
    >
      {t(`accounts.quotations.statuses.${normalized}`, {
        defaultValue: QuotationServices.getStatusLabel(normalized),
      })}
    </span>
  );
}

export default function Quotations() {
  const { t } = useTranslation();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const { canAdd, canUpdate, canDelete, canView, canViewDetails } =
    useRouteModulePermissions();

  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(emptyStats);
  const [currenciesList, setCurrenciesList] = useState([]);

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) {
        setBusinessesLoading(false);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers },
        );
        setBusinesses(response.data?.businesses || []);
      } catch (error) {
        console.error("Failed to fetch assigned businesses:", error);
      } finally {
        setBusinessesLoading(false);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id, headers]);

  useEffect(() => {
    if (businessesLoading) return;
    if (businesses.length !== 1) return;
    const onlyId = businesses[0]?._id;
    if (!onlyId) return;
    if (selectedBusinessFilter) return;
    setSelectedBusinessFilter(String(onlyId));
  }, [businessesLoading, businesses, selectedBusinessFilter]);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!selectedBusinessFilter) {
        setCustomers([]);
        setSelectedCustomerFilter("");
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/customers_by_business/${selectedBusinessFilter}`,
          { headers },
        );
        const list = Array.isArray(response?.data)
          ? response.data.filter((c) => !c.status || c.status === "Active")
          : [];
        setCustomers(list);
        setSelectedCustomerFilter("");
      } catch (error) {
        console.error("Error fetching customers for business:", error);
        setCustomers([]);
      }
    };
    fetchCustomers();
  }, [selectedBusinessFilter, adminInfo?.id]);

  useEffect(() => {
    if (!selectedBusinessFilter) {
      setCurrenciesList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/finance/currencies`, {
          params: { business_id: selectedBusinessFilter },
        });
        if (!cancelled) setCurrenciesList(res.data?.data || []);
      } catch {
        if (!cancelled) setCurrenciesList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBusinessFilter]);

  const assignedBusinessIds = useMemo(
    () => (businesses || []).map((b) => b?._id).filter(Boolean),
    [businesses],
  );

  const clearAllFilters = useCallback(() => {
    setSelectedBusinessFilter("");
    setSelectedCustomerFilter("");
    setSelectedStatusFilter("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  }, []);

  const fetchQuotations = useCallback(async () => {
    if (businessesLoading) return;
    if (!businesses.length) {
      setQuotations([]);
      setTotalPages(1);
      setTotalCount(0);
      setStats(emptyStats);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = {
        ...(selectedBusinessFilter
          ? { businessId: selectedBusinessFilter }
          : assignedBusinessIds.length > 0
            ? { businessIds: assignedBusinessIds.join(",") }
            : {}),
        ...(selectedCustomerFilter ? { customerId: selectedCustomerFilter } : {}),
        ...(selectedStatusFilter !== "All" ? { status: selectedStatusFilter } : {}),
        ...(dateRangeStart && { dateFrom: dateRangeStart }),
        ...(dateRangeEnd && { dateTo: dateRangeEnd }),
        search: searchTerm || undefined,
        page: currentPage,
        limit: entriesPerPage,
      };

      const response = await QuotationServices.getAllQuotations(params);
      setQuotations(response.data?.data || []);
      setTotalPages(response.data?.totalPages || 1);
      setTotalCount(response.data?.totalCount ?? 0);
      setStats({ ...emptyStats, ...(response.data?.stats || {}) });
    } catch (error) {
      notifyError(
        error.response?.data?.message ||
          t("accounts.quotations.messages.loadFailed", {
            defaultValue: "Failed to load quotations",
          }),
      );
    } finally {
      setLoading(false);
    }
  }, [
    assignedBusinessIds,
    businessesLoading,
    currentPage,
    dateRangeEnd,
    dateRangeStart,
    entriesPerPage,
    searchTerm,
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedStatusFilter,
  ]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleDateRangeApply = (startDate, endDate) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1);
  };

  const handleDateRangeClear = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  };

  const handleDelete = async (quotation) => {
    if (
      !window.confirm(
        t("accounts.quotations.confirm.delete", {
          defaultValue: "Delete quotation {{number}}?",
          number: quotation.quote_number,
        }),
      )
    )
      return;
    try {
      await QuotationServices.deleteQuotation(quotation._id);
      notifySuccess(
        t("accounts.quotations.messages.deleted", {
          defaultValue: "Quotation deleted successfully",
        }),
      );
      fetchQuotations();
    } catch (error) {
      notifyError(
        error.response?.data?.message ||
          t("accounts.quotations.messages.deleteFailed", {
            defaultValue: "Failed to delete quotation",
          }),
      );
    }
  };

  const handleNavigateToInvoiceFromQuotation = (quotation) => {
    if (
      !window.confirm(
        t("accounts.quotations.confirm.convertToInvoice", {
          defaultValue:
            "Open a new invoice draft from quotation {{number}}? You'll complete and save it like a normal invoice.",
          number: quotation.quote_number,
        }),
      )
    )
      return;
    history.push({
      pathname: "/create-customer-invoice",
      state: { fromQuotationId: quotation._id },
    });
  };

  const filters = useMemo(
    () => [
      {
        isClearButton: true,
        buttonProps: {
          onClick: () => {
            clearAllFilters();
            setCurrentPage(1);
          },
        },
      },
      ...(!isSingleAssignedBusiness()
        ? [
            {
              label: t("common.business", { defaultValue: "Business" }),
              value: selectedBusinessFilter,
              onChange: (value) => {
                setSelectedBusinessFilter(value);
                setCurrentPage(1);
              },
              options: businesses.map((b) => ({
                value: b._id,
                label: b.name,
              })),
              placeholder: t("common.selectBusiness", {
                defaultValue: "Select Business",
              }),
              icon: Building,
            },
          ]
        : []),
      {
        label: t("common.customer", { defaultValue: "Customer" }),
        value: selectedCustomerFilter,
        onChange: (value) => {
          setSelectedCustomerFilter(value);
          setCurrentPage(1);
        },
        options: customers.map((c) => ({
          value: c._id,
          label:
            c.basicInformation?.customerDisplayName ??
            c.basicInformation?.companyName ??
            "—",
        })),
        placeholder: t("common.selectCustomer", { defaultValue: "Select Customer" }),
        icon: User,
      },
      {
        label: t("common.status", { defaultValue: "Status" }),
        value: selectedStatusFilter,
        onChange: (value) => {
          setSelectedStatusFilter(value);
          setCurrentPage(1);
        },
        options: [
          { value: "All", label: t("accounts.quotations.statuses.all", { defaultValue: "All Statuses" }) },
          ...["draft", "sent", "accepted", "rejected", "expired"].map((status) => ({
            value: status,
            label: t(`accounts.quotations.statuses.${status}`, {
              defaultValue: QuotationServices.getStatusLabel(status),
            }),
          })),
        ],
        placeholder: t("accounts.quotations.filters.allStatuses", {
          defaultValue: "Quotation Status: All",
        }),
        icon: FileText,
      },
    ],
    [
      businesses,
      customers,
      selectedBusinessFilter,
      selectedCustomerFilter,
      selectedStatusFilter,
      clearAllFilters,
      t,
    ],
  );

  const quotationTableHeaders = [
    t("accounts.quotations.table.quoteNumber", { defaultValue: "Quote No" }),
    t("common.customer", { defaultValue: "Customer" }),
    t("common.business", { defaultValue: "Business" }),
    t("accounts.quotations.fields.quoteDate", { defaultValue: "Quote Date" }),
    t("accounts.quotations.fields.expiryDate", { defaultValue: "Expiry Date" }),
    t("common.status", { defaultValue: "Status" }),
    t("common.amount", { defaultValue: "Amount" }),
    t("common.actions", { defaultValue: "Actions" }),
  ];

  const quotationTableColWidths = useMemo(
    () => ({
      [t("accounts.quotations.table.quoteNumber", { defaultValue: "Quote No" })]:
        "120px",
      [t("common.customer", { defaultValue: "Customer" })]: "200px",
      [t("common.business", { defaultValue: "Business" })]: "200px",
      [t("accounts.quotations.fields.quoteDate", { defaultValue: "Quote Date" })]:
        "120px",
      [t("accounts.quotations.fields.expiryDate", {
        defaultValue: "Expiry Date",
      })]: "120px",
      [t("common.status", { defaultValue: "Status" })]: "100px",
      [t("common.amount", { defaultValue: "Amount" })]: "120px",
      [t("common.actions", { defaultValue: "Actions" })]: "160px",
    }),
    [t],
  );

  const summaryCardsData = useMemo(
    () => [
      {
        title: t("accounts.quotations.summary.total", { defaultValue: "Total Quotations" }),
        value: totalCount,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: t("accounts.quotations.statuses.draft", { defaultValue: "Draft" }),
        value: stats.draft ?? 0,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: t("accounts.quotations.statuses.sent", { defaultValue: "Sent" }),
        value: stats.sent ?? 0,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: InProgressSvg,
      },
      {
        title: t("accounts.quotations.summary.totalValue", { defaultValue: "Total Value" }),
        value: formatAmount(stats.totalValue ?? 0),
        backgroundColor: "completed-light",
        iconColor: "overdue-dark",
        Icon: DollarSvg,
      },
    ],
    [stats, totalCount, t],
  );

  return (
    <div className="bg-gray-50 min-h-screen overflow-x-hidden">
      <div className="max-w-full mx-auto px-6 py-8 min-w-0 w-full">
        <StandardPageHeader
          title={t("accounts.quotations.title", { defaultValue: "Quotations" })}
          subtitle={t("accounts.quotations.subtitle", {
            defaultValue: "Manage and track customer quotations before invoicing.",
          })}
          actions={
            <>
              <DateRangeComponent
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onApply={handleDateRangeApply}
                onClear={handleDateRangeClear}
                placeholder={t("common.filterByDateRange", {
                  defaultValue: "Filter by date range",
                })}
              />
              {canAdd && (
                <button
                  type="button"
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                  onClick={() => history.push("/quotations/create")}
                >
                  <Plus size={20} />
                  {t("accounts.quotations.actions.new", { defaultValue: "New Quotation" })}
                </button>
              )}
            </>
          }
        />

        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
          <DataTable
            filters={filters}
            colWidths={quotationTableColWidths}
            wideTable={true}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalCount}
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
            searchPlaceholder={t("accounts.quotations.searchPlaceholder", {
              defaultValue: "Search quotations...",
            })}
            headers={quotationTableHeaders}
            data={quotations}
            loading={loading || businessesLoading}
            emptyMessage={t("accounts.quotations.empty", {
              defaultValue: "No quotations found.",
            })}
            renderRow={(quotation) => (
              <tr
                key={quotation._id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 px-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => history.push(`/quotations/view/${quotation._id}`)}
                      className="font-semibold text-[var(--p-blue)] hover:underline"
                    >
                      #{quotation.quote_number}
                    </button>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <User size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">
                        {quotation.customer_name ||
                          quotation.customer_id?.basicInformation?.customerDisplayName ||
                          quotation.customer_id?.basicInformation?.companyName ||
                          "-"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {t("common.customer", { defaultValue: "Customer" })}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">
                        {quotation.business_id?.name || "-"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {t("common.business", { defaultValue: "Business" })}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-900">{formatDate(quotation.quote_date)}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-900">{formatDate(quotation.expiry_date)}</span>
                </td>
                <td className="py-4 px-4">
                  <StatusBadge status={quotation.status} t={t} />
                </td>
                <td className="py-4 px-4 text-right font-semibold text-gray-900">
                  {QuotationServices.formatCurrency(
                    quotation.grandTotal,
                    quotation.currency,
                    currenciesList,
                  )}
                </td>
                <td className="py-4 px-4">
                  <ActionButtons
                    maxVisibleActions={2}
                    items={[
                      {
                        action: ACTION_BUTTON_TYPES.VIEW,
                        title: t("common.view", { defaultValue: "View" }),
                        permission: canView || canViewDetails,
                        onClick: () =>
                          history.push(`/quotations/view/${quotation._id}`),
                      },
                      {
                        action: ACTION_BUTTON_TYPES.EDIT,
                        title: t("common.edit", { defaultValue: "Edit" }),
                        permission:
                          canUpdate && !quotation.convertedInvoiceId,
                        onClick: () =>
                          history.push(`/quotations/edit/${quotation._id}`),
                      },
                      {
                        action: ACTION_BUTTON_TYPES.VIEW_PDF,
                        title: t(
                          "accounts.quotations.actions.convertToInvoice",
                          { defaultValue: "Convert to Invoice" },
                        ),
                        permission:
                          !isPciApplicationQuotation(quotation) &&
                          !["rejected", "expired"].includes(
                            QuotationServices.normalizeStatus(
                              quotation.status,
                            ),
                          ) && !quotation.convertedInvoiceId,
                        onClick: () =>
                          handleNavigateToInvoiceFromQuotation(quotation),
                      },
                      {
                        action: ACTION_BUTTON_TYPES.DELETE,
                        title: t("common.delete", {
                          defaultValue: "Delete",
                        }),
                        permission:
                          canDelete && !quotation.convertedInvoiceId,
                        onClick: () => handleDelete(quotation),
                      },
                    ]}
                  />
                </td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  );
}
