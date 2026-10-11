import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable, SummaryCards } from "@/page-layouts";
import { notifyError } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import StandardPageHeader from "@/components/StandardPageHeader";
import { AdminContext } from "@/context/AdminContext";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";
import DelayedSvg from "@/assets/img/delayed.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const formatQty = (n) => formatQuantity(n ?? 0);

export const formatMoney = (n) => formatAmount(n ?? 0);

export { formatDate };

export const useInventoryReport = (endpoint, extraParams = {}) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [businesses, setBusinesses] = useState([]);
  const [businessesReady, setBusinessesReady] = useState(false);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [summary, setSummary] = useState(null);
  const [paramsMeta, setParamsMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const extraRef = useRef(extraParams);
  extraRef.current = extraParams;

  useEffect(() => {
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      setBusinesses(list || []);
      setBusinessesReady(true);
    })();
  }, []);

  useEffect(() => {
    const ids = (
      selectedBusinesses.length
        ? selectedBusinesses
        : (businesses || []).map((b) => b._id)
    ).filter(Boolean);
    if (!ids.length) {
      setWarehouses([]);
      setSelectedWarehouse("");
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: {
            businessIds: ids.join(","),
            status: "Active",
            limit: 100,
          },
        });
        const list = res.data?.data || [];
        setWarehouses(list);
        setSelectedWarehouse((prev) =>
          prev && list.some((w) => String(w._id) === String(prev)) ? prev : "",
        );
      } catch {
        setWarehouses([]);
      }
    })();
  }, [selectedBusinesses, businesses, headers]);

  const fetchRows = useCallback(
    async (
      bizIds = selectedBusinesses,
      page = currentPageRef.current,
      limit = recordsPerPage,
      search = searchTerm,
    ) => {
      try {
        setLoading(true);
        let ids = Array.isArray(bizIds) ? bizIds.filter(Boolean) : [];
        if (!ids.length) ids = (businesses || []).map((b) => b._id).filter(Boolean);
        const params = {
          page,
          limit,
          search: search || undefined,
          warehouseId: selectedWarehouse || undefined,
          ...extraRef.current,
        };
        if (ids.length) params.businessIds = ids.join(",");
        const res = await axios.get(`${Base_URL}/inventory-reports/${endpoint}`, {
          headers,
          params,
        });
        setRows(res.data?.data || []);
        setTotalResults(res.data?.total || 0);
        setTotals(res.data?.totals || null);
        setSummary(res.data?.summary || null);
        setParamsMeta(res.data?.params || null);
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load report");
        setRows([]);
        setTotalResults(0);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedBusinesses,
      recordsPerPage,
      searchTerm,
      selectedWarehouse,
      businesses,
      headers,
      endpoint,
    ],
  );

  useEffect(() => {
    if (!businessesReady) return;
    fetchRows(selectedBusinesses, 1, recordsPerPage, searchTerm);
    setCurrentPage(1);
    currentPageRef.current = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessesReady,
    selectedBusinesses.join(","),
    selectedWarehouse,
    businesses.length,
    JSON.stringify(extraParams),
  ]);

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !selectedBusinesses.length &&
      !selectedWarehouse;
    setSelectedBusinesses([]);
    setSelectedWarehouse("");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      fetchRows([], 1, recordsPerPage, "");
    }
  };

  const filters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusinesses,
      onChange: (value) =>
        setSelectedBusinesses(Array.isArray(value) ? value : []),
      placeholder: "Business",
      isMulti: true,
      options: businesses.map((b) => ({ value: b._id, label: b.name })),
    }] : []),
    {
      value: selectedWarehouse,
      onChange: (value) => setSelectedWarehouse(value || ""),
      placeholder: "Warehouse",
      options: [
        { value: "", label: "All warehouses" },
        ...warehouses.map((w) => ({ value: w._id, label: w.name })),
      ],
    },
  ];

  return {
    headers,
    businesses,
    selectedBusinesses,
    setSelectedBusinesses,
    warehouses,
    selectedWarehouse,
    setSelectedWarehouse,
    rows,
    totals,
    summary,
    paramsMeta,
    loading,
    searchTerm,
    setSearchTerm,
    totalResults,
    recordsPerPage,
    setRecordsPerPage,
    currentPage,
    setCurrentPage,
    currentPageRef,
    fetchRows,
    clearFilters,
    filters,
  };
};

export const InventoryReportShell = ({
  title,
  description,
  children,
  filters,
  searchTerm,
  onSearch,
  searchPlaceholder = "Search…",
  loading,
  headers,
  rows,
  totalResults,
  recordsPerPage,
  currentPage,
  onPageChange,
  onRecordsPerPageChange,
  renderRow,
  emptyMessage = "No data for this report.",
  summaryCards = null,
  extraFilters = null,
  actions = null,
}) => {
  const history = useHistory();

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <StandardPageHeader
            title={title}
            subtitle={description}
            showBackButton
            onBack={() => history.push("/inventory-reports")}
            actions={actions}
          />

          {summaryCards}

          {extraFilters}

          {children}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              onSearch={onSearch}
              searchValue={searchTerm}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              loading={loading}
              headers={headers}
              data={rows}
              totalRecords={totalResults}
              recordsPerPage={recordsPerPage}
              currentPage={currentPage}
              totalPages={Math.ceil(totalResults / recordsPerPage) || 1}
              onPageChange={onPageChange}
              onRecordsPerPageChange={onRecordsPerPageChange}
              emptyMessage={emptyMessage}
              renderRow={renderRow}
            />
          </div>
        </div>
      </div>
    </RoutePermissionGate>
  );
};

const CARD_STYLES = [
  {
    backgroundColor: "completed-light",
    iconColor: "completed-dark",
    Icon: CompletedSvg,
  },
  {
    backgroundColor: "processing-light",
    iconColor: "processing-dark",
    Icon: InProgressSvg,
  },
  {
    backgroundColor: "pending-light",
    iconColor: "pending-dark",
    Icon: PendingApprovalSvg,
  },
  {
    backgroundColor: "processing-light",
    iconColor: "processing-dark",
    Icon: DelayedSvg,
  },
];

const styleForInventoryCard = (label, index) => {
  const l = String(label || "").toLowerCase();
  if (/^\d/.test(l) && l.includes("day")) {
    return CARD_STYLES[index % CARD_STYLES.length];
  }
  if (l.includes("value") || l.includes("inbound") || l.includes("suggested")) {
    return CARD_STYLES[0];
  }
  if (
    l.includes("qty") ||
    l.includes("quantity") ||
    l.includes("on-hand") ||
    l.includes("on hand")
  ) {
    return CARD_STYLES[1];
  }
  if (l.includes("expired") || l.includes("outbound") || l.includes("risk")) {
    return CARD_STYLES[3];
  }
  if (l.includes("expir")) {
    return CARD_STYLES[1];
  }
  if (
    l.includes("low") ||
    l.includes("line") ||
    l.includes("item") ||
    l.includes("product") ||
    l.includes("lot") ||
    l.includes("warehouse") ||
    l.includes("movement") ||
    l.includes("alert")
  ) {
    return CARD_STYLES[2];
  }
  return CARD_STYLES[index % CARD_STYLES.length];
};

export const SummaryCardRow = ({ cards = [] }) => {
  if (!cards.length) return null;

  const mapped = cards.map((c, index) => {
    const style = styleForInventoryCard(c.label || c.title, index);
    return {
      title: c.title || c.label,
      value: c.value,
      backgroundColor: c.backgroundColor || style.backgroundColor,
      iconColor: c.iconColor || style.iconColor,
      Icon: c.Icon || style.Icon,
    };
  });

  return (
    <SummaryCards
      cards={mapped}
      columnsCount={Math.min(Math.max(mapped.length, 1), 4)}
    />
  );
};
