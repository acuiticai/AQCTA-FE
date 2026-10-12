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
import {
  ActionButtons,
  SummaryCards,
  DateRangeComponent,
} from "@/page-layouts/index";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";
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

const QUOTATION_STATUS_TONES = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  expired: "warning",
};

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
    setSelectedBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
    setSelectedCustomerFilter("");
    setSelectedStatusFilter("All");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setCurrentPage(1);
  }, [businesses]);

  const fetchQuotations = useCallback(async () => {
    if (businessesLoading) return;
    if (!businesses.length) {
      setQuotations([]);
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
    businesses.length,
    currentPage,
    dateRangeEnd,
    dateRangeStart,
    entriesPerPage,
    searchTerm,
    selectedBusinessFilter,
    selectedCustomerFilter,
    selectedStatusFilter,
    t,
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

  const portalFilterValues = {
    business: selectedBusinessFilter || "",
    customer: selectedCustomerFilter || "",
    status: selectedStatusFilter === "All" ? "" : selectedStatusFilter,
  };

  const portalFilters = useMemo(
    () => [
      ...(!isSingleAssignedBusiness()
        ? [
            {
              key: "business",
              placeholder: t("common.selectBusiness", {
                defaultValue: "Select Business",
              }),
              options: [
                {
                  value: "",
                  label: t("common.allBusinesses", {
                    defaultValue: "All Businesses",
                  }),
                },
                ...businesses.map((b) => ({
                  value: b._id,
                  label: b.name,
                })),
              ],
            },
          ]
        : []),
      {
        key: "customer",
        placeholder: t("common.selectCustomer", {
          defaultValue: "Select Customer",
        }),
        options: [
          {
            value: "",
            label: t("common.allCustomers", { defaultValue: "All Customers" }),
          },
          ...customers.map((c) => ({
            value: c._id,
            label:
              c.basicInformation?.customerDisplayName ??
              c.basicInformation?.companyName ??
              "—",
          })),
        ],
      },
      {
        key: "status",
        placeholder: t("accounts.quotations.filters.allStatuses", {
          defaultValue: "All Statuses",
        }),
        options: [
          {
            value: "",
            label: t("accounts.quotations.statuses.all", {
              defaultValue: "All Statuses",
            }),
          },
          ...["draft", "sent", "accepted", "rejected", "expired"].map(
            (status) => ({
              value: status,
              label: t(`accounts.quotations.statuses.${status}`, {
                defaultValue: QuotationServices.getStatusLabel(status),
              }),
            }),
          ),
        ],
      },
    ],
    [businesses, customers, t],
  );

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      setSelectedBusinessFilter(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "customer") {
      setSelectedCustomerFilter(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "status") {
      setSelectedStatusFilter(value || "All");
      setCurrentPage(1);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "quoteNumber",
        header: t("accounts.quotations.table.quoteNumber", {
          defaultValue: "Quote No",
        }),
        width: "12%",
        render: (quotation) =>
          canView || canViewDetails ? (
            <button
              type="button"
              className="epc-cell__link"
              onClick={() => history.push(`/quotations/view/${quotation._id}`)}
            >
              #{quotation.quote_number}
            </button>
          ) : (
            <span className="epc-cell__primary">#{quotation.quote_number}</span>
          ),
      },
      {
        key: "customer",
        header: t("common.customer", { defaultValue: "Customer" }),
        width: "18%",
        render: (quotation) => (
          <>
            <div className="epc-cell__primary">
              {quotation.customer_name ||
                quotation.customer_id?.basicInformation?.customerDisplayName ||
                quotation.customer_id?.basicInformation?.companyName ||
                "—"}
            </div>
            <div className="epc-cell__secondary">
              {t("common.customer", { defaultValue: "Customer" })}
            </div>
          </>
        ),
      },
      {
        key: "business",
        header: t("common.business", { defaultValue: "Business" }),
        width: "16%",
        render: (quotation) => (
          <div className="epc-cell__primary">
            {quotation.business_id?.name || "—"}
          </div>
        ),
      },
      {
        key: "quoteDate",
        header: t("accounts.quotations.fields.quoteDate", {
          defaultValue: "Quote Date",
        }),
        width: "10%",
        render: (quotation) => formatDate(quotation.quote_date),
      },
      {
        key: "expiryDate",
        header: t("accounts.quotations.fields.expiryDate", {
          defaultValue: "Expiry Date",
        }),
        width: "10%",
        render: (quotation) => formatDate(quotation.expiry_date),
      },
      {
        key: "status",
        header: t("common.status", { defaultValue: "Status" }),
        width: "10%",
        render: (quotation) => {
          const normalized = QuotationServices.normalizeStatus(quotation.status);
          const label = t(`accounts.quotations.statuses.${normalized}`, {
            defaultValue: QuotationServices.getStatusLabel(normalized),
          });
          return (
            <StatusPill
              status={label}
              tone={QUOTATION_STATUS_TONES[normalized] || "neutral"}
            />
          );
        },
      },
      {
        key: "amount",
        header: t("common.amount", { defaultValue: "Amount" }),
        width: "12%",
        align: "right",
        render: (quotation) => (
          <span className="epc-cell__primary">
            {QuotationServices.formatCurrency(
              quotation.grandTotal,
              quotation.currency,
              currenciesList,
            )}
          </span>
        ),
      },
      {
        key: "actions",
        header: t("common.actions", { defaultValue: "Actions" }),
        width: "12%",
        align: "right",
        render: (quotation) => (
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
                permission: canUpdate && !quotation.convertedInvoiceId,
                onClick: () =>
                  history.push(`/quotations/edit/${quotation._id}`),
              },
              {
                action: ACTION_BUTTON_TYPES.VIEW_PDF,
                title: t("accounts.quotations.actions.convertToInvoice", {
                  defaultValue: "Convert to Invoice",
                }),
                permission:
                  !isPciApplicationQuotation(quotation) &&
                  !["rejected", "expired"].includes(
                    QuotationServices.normalizeStatus(quotation.status),
                  ) &&
                  !quotation.convertedInvoiceId,
                onClick: () =>
                  handleNavigateToInvoiceFromQuotation(quotation),
              },
              {
                action: ACTION_BUTTON_TYPES.DELETE,
                title: t("common.delete", { defaultValue: "Delete" }),
                permission: canDelete && !quotation.convertedInvoiceId,
                onClick: () => handleDelete(quotation),
              },
            ]}
          />
        ),
      },
    ],
    [
      canDelete,
      canUpdate,
      canView,
      canViewDetails,
      currenciesList,
      history,
      t,
    ],
  );

  const summaryCardsData = useMemo(
    () => [
      {
        title: t("accounts.quotations.summary.total", {
          defaultValue: "Total Quotations",
        }),
        value: totalCount,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: t("accounts.quotations.statuses.draft", {
          defaultValue: "Draft",
        }),
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
        title: t("accounts.quotations.summary.totalValue", {
          defaultValue: "Total Value",
        }),
        value: formatAmount(stats.totalValue ?? 0),
        backgroundColor: "completed-light",
        iconColor: "overdue-dark",
        Icon: DollarSvg,
      },
    ],
    [stats, totalCount, t],
  );

  const tableLoading = loading || businessesLoading;

  return (
    <EpcPage
      title={t("accounts.quotations.title", { defaultValue: "Quotations" })}
      subtitle={t("accounts.quotations.subtitle", {
        defaultValue: "Manage and track customer quotations before invoicing.",
      })}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeComponent
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            onApply={handleDateRangeApply}
            onClear={handleDateRangeClear}
            placeholder={t("common.filterByDateRange", {
              defaultValue: "Filter by date range",
            })}
          />
          {canAdd ? (
            <Button onClick={() => history.push("/quotations/create")}>
              <PlusIcon size={15} />
              {t("accounts.quotations.actions.new", {
                defaultValue: "New Quotation",
              })}
            </Button>
          ) : null}
        </div>
      }
    >
      <SummaryCards
        cards={summaryCardsData}
        columnsCount={4}
        loading={tableLoading && quotations.length === 0}
      />

      <FilterBar
        subtitle={t("accounts.quotations.filterSubtitle", {
          defaultValue: "Narrow by business, customer or status.",
        })}
        searchPlaceholder={t("accounts.quotations.searchPlaceholder", {
          defaultValue: "Search quotations...",
        })}
        searchValue={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={clearAllFilters}
        filters={portalFilters}
      />

      <Card>
        <CardHeader
          title={t("accounts.quotations.title", { defaultValue: "Quotations" })}
          subtitle={
            tableLoading
              ? "Loading…"
              : `${totalCount} total quotations`
          }
        />
        <PortalDataTable
          columns={columns}
          rows={tableLoading ? [] : quotations}
          rowKey="_id"
          emptyMessage={
            tableLoading
              ? "Loading quotations…"
              : t("accounts.quotations.empty", {
                  defaultValue: "No quotations found.",
                })
          }
        />
        {!tableLoading && totalCount > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={entriesPerPage}
            total={totalCount}
            itemLabel="quotations"
            onPageChange={setCurrentPage}
            onPageSizeChange={(perPage) => {
              setEntriesPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>
    </EpcPage>
  );
}
