import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
  useRef,
} from "react";
import axios from "axios";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { DataTable } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import StandardPageHeader from "@/components/StandardPageHeader";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount, formatQuantity } from "@/components/formatAmount";
import { SummaryCardRow } from "./reports/reportShared";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const InventoryValuation = () => {
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

  const [businesses, setBusinesses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [allLines, setAllLines] = useState([]);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({
    quantity: 0,
    value: 0,
    lineCount: 0,
    itemCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalResults, setTotalResults] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const currentPageRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        setBusinessesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBusiness) {
      setWarehouses([]);
      setSelectedWarehouse("");
      return;
    }
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/warehouses`, {
          headers,
          params: {
            businessId: selectedBusiness,
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
  }, [selectedBusiness, headers]);

  const applyPage = useCallback((lines, page, limit, search) => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    let filtered = lines;
    if (q) {
      filtered = lines.filter((r) => {
        const hay = [
          r.item?.name,
          r.item?.itemCode,
          r.warehouse?.name,
          r.location?.name,
          r.lotNumber,
          r.business?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    setTotalResults(filtered.length);
    const skip = (page - 1) * limit;
    setRows(filtered.slice(skip, skip + limit));
  }, []);

  const fetchValuation = useCallback(
    async (
      businessId = selectedBusiness,
      warehouseId = selectedWarehouse,
      page = currentPageRef.current,
      limit = recordsPerPage,
      search = searchTerm,
      bizList = businesses,
    ) => {
      try {
        setLoading(true);
        const params = {};
        if (businessId) {
          params.businessId = businessId;
        } else if (bizList?.length) {
          params.businessIds = bizList.map((b) => b._id).join(",");
        } else {
          setAllLines([]);
          setRows([]);
          setTotals({ quantity: 0, value: 0, lineCount: 0, itemCount: 0 });
          setTotalResults(0);
          return;
        }
        if (warehouseId) params.warehouseId = warehouseId;

        const res = await axios.get(`${Base_URL}/inventory-valuation`, {
          headers,
          params,
        });
        const data = res.data?.data || {};
        const lines = data.lines || [];
        setAllLines(lines);
        setTotals(
          data.totals || {
            quantity: 0,
            value: 0,
            lineCount: 0,
            itemCount: 0,
          },
        );
        applyPage(lines, page, limit, search);
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to load inventory valuation",
        );
        setAllLines([]);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedBusiness,
      selectedWarehouse,
      recordsPerPage,
      searchTerm,
      headers,
      applyPage,
      businesses,
    ],
  );

  useEffect(() => {
    if (businessesLoading) return;
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchValuation(
      selectedBusiness,
      selectedWarehouse,
      1,
      recordsPerPage,
      searchTerm,
      businesses,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness, selectedWarehouse, businessesLoading, businesses.length]);

  const handleSearch = (value) => {
    setSearchTerm(value);
    currentPageRef.current = 1;
    setCurrentPage(1);
    applyPage(allLines, 1, recordsPerPage, value);
  };

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) && !selectedBusiness && !selectedWarehouse;
    setSelectedBusiness("");
    setSelectedWarehouse("");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      applyPage(allLines, 1, recordsPerPage, "");
    }
  };

  const handleBackfill = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedBusiness) params.businessId = selectedBusiness;
      else if (businesses.length) {
        params.businessIds = businesses.map((b) => b._id).join(",");
      }
      const res = await axios.post(
        `${Base_URL}/inventory-valuation/backfill`,
        {},
        { headers, params },
      );
      notifySuccess(
        res.data?.message ||
          "Existing stock costs refreshed from item cost price",
      );
      await fetchValuation();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Backfill failed");
    } finally {
      setLoading(false);
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
      type: "select",
      key: "business",
      label: t("Business") || "Business",
      value: selectedBusiness,
      options: [
        { value: "", label: "All businesses" },
        ...(businesses || []).map((b) => ({
          value: String(b._id),
          label: b.name,
        })),
      ],
      onChange: (v) => {
        setSelectedBusiness(v || "");
        setSelectedWarehouse("");
      },
      placeholder: "All businesses",
    }] : []),
    {
      type: "select",
      key: "warehouse",
      label: t("Warehouse") || "Warehouse",
      value: selectedWarehouse,
      options: [
        { value: "", label: "All warehouses" },
        ...(warehouses || []).map((w) => ({
          value: String(w._id),
          label: w.name,
        })),
      ],
      onChange: (v) => setSelectedWarehouse(v || ""),
      placeholder: selectedBusiness
        ? "All warehouses"
        : "Select a business first",
    },
  ];

  const tableHeaders = [
    "Product",
    "Warehouse",
    "Location",
    "Lot / Serial",
    "Qty",
    "Unit cost",
    "Value",
    "Costing",
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full">
        <div className="w-full mx-auto px-6 py-8">
          <StandardPageHeader
            title="Inventory Valuation"
            subtitle="On-hand stock × unit cost. No business selected = all assigned businesses. Existing stock uses item cost price until a GRN sets a receipt cost."
            showBackButton
            onBack={() => history.push("/inventory-reports")}
            actions={
              <button
                type="button"
                onClick={handleBackfill}
                disabled={loading}
                title="Refresh costs from items"
                aria-label="Refresh costs from items"
                className="inline-flex items-center justify-center w-11 h-11 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-5 h-5 text-gray-700 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            }
          />

          <SummaryCardRow
            cards={[
              { label: "Total value", value: formatAmount(totals.value) },
              { label: "On-hand qty", value: formatQuantity(totals.quantity) },
              { label: "Products", value: totals.itemCount || 0 },
              { label: "Stock lines", value: totals.lineCount || 0 },
            ]}
          />

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <DataTable
              onSearch={handleSearch}
              searchValue={searchTerm}
              searchPlaceholder="Search product, lot, warehouse…"
              filters={filters}
              loading={loading || businessesLoading}
              headers={tableHeaders}
              data={rows}
              totalRecords={totalResults}
              recordsPerPage={recordsPerPage}
              currentPage={currentPage}
              totalPages={Math.ceil(totalResults / recordsPerPage) || 1}
              onPageChange={(page) => {
                currentPageRef.current = page;
                setCurrentPage(page);
                applyPage(allLines, page, recordsPerPage, searchTerm);
              }}
              onRecordsPerPageChange={(n) => {
                setRecordsPerPage(n);
                currentPageRef.current = 1;
                setCurrentPage(1);
                applyPage(allLines, 1, n, searchTerm);
              }}
              emptyMessage="No on-hand stock found. Set stock under Stock Levels, or confirm a GRN."
              renderRow={(row) => (
                <tr
                  key={row._id}
                  className="border-b"
                  style={{ fontSize: "14px" }}
                >
                  <td className="py-2 px-4">
                    <div className="font-medium">{row.item?.name || "—"}</div>
                    <div className="text-xs text-gray-500">
                      {row.item?.itemCode || ""}
                    </div>
                  </td>
                  <td className="py-2 px-4">{row.warehouse?.name || "—"}</td>
                  <td className="py-2 px-4">
                    {row.location?.name || row.location?.code || "—"}
                  </td>
                  <td className="py-2 px-4 font-mono text-sm">
                    {row.lotNumber || "—"}
                  </td>
                  <td className="py-2 px-4 text-right whitespace-nowrap">
                    {formatQuantity(row.quantity)}
                    {row.item?.unit ? ` ${row.item.unit}` : ""}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {formatAmount(row.unitCost)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold">
                    {formatAmount(row.value)}
                  </td>
                  <td className="py-2 px-4">
                    {row.item?.costingMethod === "standard"
                      ? "Standard"
                      : "Average"}
                  </td>
                </tr>
              )}
            />
          </div>
        </div>
      </div>
    </RoutePermissionGate>
  );
};

export default InventoryValuation;
