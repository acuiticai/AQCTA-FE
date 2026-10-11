import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, GitBranch } from "lucide-react";
import { DataTable, ActionButtons } from "@/page-layouts";
import { DateRangeComponent } from "@/page-layouts/index";
import StandardPageHeader from "@/components/StandardPageHeader";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import {
  formatDate,
  formatQuantity,
  formatTime,
} from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TYPE_STYLES = {
  purchase_received: "bg-emerald-100 text-emerald-800",
  sale_delivery: "bg-blue-100 text-blue-800",
  sale_consumption: "bg-indigo-100 text-indigo-800",
  adjustment: "bg-amber-100 text-amber-800",
  internal_transfer: "bg-purple-100 text-purple-800",
};

const formatSignedQty = (qty) => {
  if (qty === null || qty === undefined || qty === "") return "—";
  const n = parseFloat(qty);
  if (Number.isNaN(n)) return "—";
  const formatted = formatQuantity(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
};

const shortLoc = (loc) => {
  if (!loc) return "—";
  return loc.code || loc.name || "—";
};

const StockTraceability = () => {
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

  useRouteModulePermissions();

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);

  const [typeFilter, setTypeFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [lotFilter, setLotFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeOptions, setTypeOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const currentPageRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        if (list?.length) {
          setSelectedBusiness((prev) => prev || list[0]._id);
        }
        setBusinessesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/stock-movements/types`, {
          headers,
        });
        if (!cancelled) setTypeOptions(res.data?.data || []);
      } catch (_) {
        if (!cancelled) setTypeOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [headers]);

  useEffect(() => {
    if (!selectedBusiness) {
      setWarehouses([]);
      setWarehouseFilter("");
      setLocations([]);
      setLocationFilter("");
      setItems([]);
      setItemFilter("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [whRes, itemRes] = await Promise.all([
          axios.get(`${Base_URL}/warehouses`, {
            headers,
            params: {
              businessId: selectedBusiness,
              status: "Active",
              limit: 100,
            },
          }),
          axios.get(`${Base_URL}/items`, {
            headers,
            params: {
              businessId: selectedBusiness,
              limit: 200,
            },
          }),
        ]);
        if (!cancelled) {
          setWarehouses(whRes.data?.data || []);
          const itemList = itemRes.data?.data || itemRes.data || [];
          setItems(Array.isArray(itemList) ? itemList : []);
        }
      } catch (_) {
        if (!cancelled) {
          setWarehouses([]);
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBusiness, headers]);

  useEffect(() => {
    if (!warehouseFilter) {
      setLocations([]);
      setLocationFilter("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${Base_URL}/locations`, {
          headers,
          params: { warehouseId: warehouseFilter, storeableOnly: "true" },
        });
        if (!cancelled) setLocations(res.data?.data || []);
      } catch (_) {
        if (!cancelled) setLocations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warehouseFilter, headers]);

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !typeFilter &&
      !directionFilter &&
      !warehouseFilter &&
      !locationFilter &&
      !itemFilter &&
      !lotFilter &&
      !dateFrom &&
      !dateTo;
    setTypeFilter("");
    setDirectionFilter("");
    setWarehouseFilter("");
    setLocationFilter("");
    setItemFilter("");
    setLotFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      fetchRows(1, recordsPerPage, "");
    }
  };

  const fetchRows = useCallback(
    async (
      page = currentPageRef.current,
      limit = recordsPerPage,
      search = searchTerm,
    ) => {
      try {
        setLoading(true);
        setError(null);

        if (!selectedBusiness) {
          setRows([]);
          setTotalResults(0);
          return;
        }

        const response = await axios.get(`${Base_URL}/stock-movements`, {
          headers,
          params: {
            businessId: selectedBusiness,
            page,
            limit,
            search: search || undefined,
            type: typeFilter || undefined,
            direction: directionFilter || undefined,
            warehouseId: warehouseFilter || undefined,
            locationId: locationFilter || undefined,
            itemId: itemFilter || undefined,
            lotNumber: lotFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
        });
        setRows(response.data?.data || []);
        setTotalResults(response.data?.total || 0);
      } catch (err) {
        console.error(err);
        setError(
          err?.response?.data?.message ||
            tWithFallback(
              "stockTraceability.messages.fetchFailed",
              "Failed to fetch stock movements.",
            ),
        );
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedBusiness,
      recordsPerPage,
      searchTerm,
      headers,
      typeFilter,
      directionFilter,
      warehouseFilter,
      locationFilter,
      itemFilter,
      lotFilter,
      dateFrom,
      dateTo,
    ],
  );

  useEffect(() => {
    if (businessesLoading) return;
    fetchRows(1, recordsPerPage, searchTerm);
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, [
    selectedBusiness,
    typeFilter,
    directionFilter,
    warehouseFilter,
    locationFilter,
    itemFilter,
    lotFilter,
    dateFrom,
    dateTo,
    businessesLoading,
  ]);

  const handleSearch = (value) => {
    const trimmed = value || "";
    setSearchTerm(trimmed);
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchRows(1, recordsPerPage, trimmed);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchRows(page, recordsPerPage, searchTerm);
  };

  const filterByLot = (lot) => {
    if (!lot) return;
    setLotFilter(lot);
  };

  const tableHeaders = [
    "When",
    "Product",
    "Movement",
    "In / Out",
    "Qty",
    "Lot",
    "From",
    "To / Location",
    "Document",
    "By",
    "Actions",
  ];

  const filters = [
    {
      isClearButton: true,
      tooltip: tWithFallback("stockTraceability.clearFilters", "Clear Filters"),
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusiness || "",
      onChange: (v) => {
        setSelectedBusiness(v || "");
        setWarehouseFilter("");
        setLocationFilter("");
        setItemFilter("");
      },
      placeholder: t("Business") || "Business",
      options: businesses.map((b) => ({
        value: b._id,
        label: b.name,
      })),
    }] : []),
    {
      value: typeFilter || "",
      onChange: (v) => setTypeFilter(v || ""),
      placeholder: "Movement type",
      options: [
        { value: "", label: "All types" },
        ...typeOptions.map((o) => ({
          value: o.value,
          label: o.label,
        })),
      ],
    },
    {
      value: directionFilter || "",
      onChange: (v) => setDirectionFilter(v || ""),
      placeholder: "In / Out",
      options: [
        { value: "", label: "All" },
        { value: "in", label: "Stock In" },
        { value: "out", label: "Stock Out" },
      ],
    },
    {
      value: itemFilter || "",
      onChange: (v) => setItemFilter(v || ""),
      placeholder: "Product",
      options: [
        { value: "", label: "All products" },
        ...items.map((it) => ({
          value: it._id,
          label: `${it.name}${it.itemCode ? ` (${it.itemCode})` : ""}`,
        })),
      ],
    },
    {
      value: warehouseFilter || "",
      onChange: (v) => {
        setWarehouseFilter(v || "");
        setLocationFilter("");
      },
      placeholder: "Warehouse",
      options: [
        { value: "", label: "All warehouses" },
        ...warehouses.map((w) => ({
          value: w._id,
          label: `${w.name}${w.code ? ` (${w.code})` : ""}`,
        })),
      ],
    },
    {
      value: locationFilter || "",
      onChange: (v) => setLocationFilter(v || ""),
      placeholder: "Location",
      options: [
        { value: "", label: warehouseFilter ? "All locations" : "All locations" },
        ...locations.map((l) => ({
          value: l._id,
          label: `${l.code || ""} — ${l.name}`.trim(),
        })),
      ],
    },
    {
      isTextInput: true,
      value: lotFilter,
      onChange: (v) => setLotFilter(v || ""),
      placeholder: "Lot / Serial",
    },
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <StandardPageHeader
            title={tWithFallback(
              "stockTraceability.title",
              "Stock Traceability",
            )}
            subtitle="Follow where stock came from, where it went, and which document moved it."
            actions={
              <>
                <DateRangeComponent
                  startDate={dateFrom}
                  endDate={dateTo}
                  onApply={(start, end) => {
                    setDateFrom(start || "");
                    setDateTo(end || "");
                  }}
                  onClear={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                />
                {itemFilter ? (
                  <button
                    type="button"
                    onClick={() =>
                      history.push(`/stock-traceability/item/${itemFilter}`)
                    }
                    className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <GitBranch size={18} />
                    Product timeline
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => history.push("/stock-levels")}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Stock Levels
                </button>
              </>
            }
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              onSearch={handleSearch}
              searchValue={searchTerm}
              searchPlaceholder="Search product, lot, location, document, user…"
              filters={filters}
              loading={loading || businessesLoading}
              headers={tableHeaders}
              data={rows}
              totalRecords={totalResults}
              recordsPerPage={recordsPerPage}
              currentPage={currentPage}
              totalPages={Math.ceil(totalResults / recordsPerPage) || 1}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={(n) => {
                setRecordsPerPage(n);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchRows(1, n, searchTerm);
              }}
              tableError={error}
              emptyMessage="No movements match these filters. Try clearing filters or pick a wider date range."
              renderRow={(row) => {
                const isIn = (row.quantity || 0) >= 0;
                const fromLoc =
                  row.fromLocation ||
                  (!isIn ? row.location : null);
                const toLoc =
                  row.toLocation ||
                  (isIn ? row.location : null) ||
                  row.location;

                return (
                  <tr
                    key={row._id}
                    className="border-b"
                    style={{ fontSize: "12px", fontWeight: "400" }}
                  >
                    <td className="py-2 px-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {row.createdAt ? formatDate(row.createdAt) || "—" : "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.createdAt ? formatTime(row.createdAt) : ""}
                      </div>
                    </td>

                    <td className="py-2 px-4 min-w-[140px]">
                      {row.item?._id ? (
                        <button
                          type="button"
                          className="text-left group"
                          onClick={() =>
                            history.push(
                              `/stock-traceability/item/${row.item._id}`,
                            )
                          }
                          title="Open product timeline"
                        >
                          <span className="font-medium text-gray-900 group-hover:text-[var(--p-blue)] group-hover:underline">
                            {row.item?.name || "—"}
                          </span>
                          {row.item?.itemCode ? (
                            <span className="block text-xs text-gray-500">
                              {row.item.itemCode}
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="py-2 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                          TYPE_STYLES[row.type] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {row.typeLabel || row.type}
                      </span>
                    </td>

                    <td className="py-2 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                          isIn
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {isIn ? (
                          <ArrowDownLeft size={12} />
                        ) : (
                          <ArrowUpRight size={12} />
                        )}
                        {isIn ? "IN" : "OUT"}
                      </span>
                    </td>

                    <td
                      className={`py-2 px-4 font-semibold whitespace-nowrap ${
                        isIn ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {formatSignedQty(row.quantity)}
                      {row.item?.unit || row.item?.uom ? (
                        <span className="text-xs font-normal text-gray-500 ml-0.5">
                          {row.item.unit || row.item.uom}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-2 px-4">
                      {row.lotNumber ? (
                        <button
                          type="button"
                          className="text-[var(--p-blue)] hover:underline font-medium"
                          title="Filter by this lot"
                          onClick={() => filterByLot(row.lotNumber)}
                        >
                          {row.lotNumber}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-2 px-4 text-gray-700 max-w-[120px]">
                      <span className="block truncate" title={shortLoc(fromLoc)}>
                        {shortLoc(fromLoc)}
                      </span>
                    </td>

                    <td className="py-2 px-4 text-gray-700 max-w-[140px]">
                      <span
                        className="block truncate font-medium"
                        title={
                          row.warehouse
                            ? `${row.warehouse.name} / ${shortLoc(toLoc)}`
                            : shortLoc(toLoc)
                        }
                      >
                        {(row.warehouse?.code || row.warehouse?.name || "") &&
                          `${row.warehouse.code || row.warehouse.name} / `}
                        {shortLoc(toLoc)}
                      </span>
                    </td>

                    <td className="py-2 px-4">
                      <span className="font-medium text-gray-800">
                        {row.reference?.label || "—"}
                      </span>
                      {row.business?.name ? (
                        <span className="block text-xs text-gray-400 truncate max-w-[120px]">
                          {row.business.name}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-2 px-4 text-gray-600 whitespace-nowrap">
                      {row.user?.name || "—"}
                    </td>

                    <td className="py-2 px-4">
                      <ActionButtons
                        items={[
                          {
                            tooltip: "Details",
                            action: ACTION_BUTTON_TYPES.VIEW,
                            onClick: () => setDetail(row),
                          },
                          row.item?._id && {
                            tooltip: "Trace product",
                            action: ACTION_BUTTON_TYPES.EDIT,
                            onClick: () => {
                              const lotQuery = row.lotNumber
                                ? `?lot=${encodeURIComponent(row.lotNumber)}`
                                : "";
                              history.push(
                                `/stock-traceability/item/${row.item._id}${lotQuery}`,
                              );
                            },
                          },
                        ].filter(Boolean)}
                      />
                    </td>
                  </tr>
                );
              }}
            />
          </div>
        </div>

        <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)}>
          <ModalHeader>Movement details</ModalHeader>
          <ModalBody>
            {detail && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      TYPE_STYLES[detail.type] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {detail.typeLabel || detail.type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      detail.quantity >= 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {detail.quantity >= 0 ? "IN" : "OUT"}{" "}
                    {formatSignedQty(detail.quantity)}
                  </span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <dt className="text-xs text-gray-500">When</dt>
                    <dd>
                      {detail.createdAt
                        ? formatDate(detail.createdAt, false, true) || "—"
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Product</dt>
                    <dd>
                      {detail.item?.name || "—"}
                      {detail.item?.itemCode
                        ? ` (${detail.item.itemCode})`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Lot / Serial</dt>
                    <dd>{detail.lotNumber || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Document</dt>
                    <dd>{detail.reference?.label || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">From</dt>
                    <dd>{shortLoc(detail.fromLocation) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">To / Location</dt>
                    <dd>
                      {detail.warehouse?.name
                        ? `${detail.warehouse.name} / `
                        : ""}
                      {shortLoc(detail.toLocation || detail.location)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">User</dt>
                    <dd>{detail.user?.name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Stock after</dt>
                    <dd>
                      Total: {detail.stockAfter ?? "—"}
                      {detail.stockAfterLocation != null
                        ? ` · Loc: ${detail.stockAfterLocation}`
                        : ""}
                    </dd>
                  </div>
                </dl>
                {detail.notes ? (
                  <p className="text-gray-600 border-t pt-2">
                    <span className="text-xs text-gray-500 block mb-0.5">
                      Notes
                    </span>
                    {detail.notes}
                  </p>
                ) : null}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {detail?.item?._id && (
              <button
                type="button"
                className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg mr-auto"
                onClick={() => {
                  const lot = detail.lotNumber
                    ? `?lot=${encodeURIComponent(detail.lotNumber)}`
                    : "";
                  history.push(
                    `/stock-traceability/item/${detail.item._id}${lot}`,
                  );
                }}
              >
                Trace this product
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 border rounded-lg"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default StockTraceability;
