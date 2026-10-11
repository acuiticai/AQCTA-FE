import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { DataTable, ActionButtons } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";
import { formatDate } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  draft: "Draft",
  done: "Validated",
  cancelled: "Cancelled",
};

const InternalTransfers = () => {
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

  const { canAdd, canUpdate } = useRouteModulePermissions();

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

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

  const fetchRows = async (
    bizIds = selectedBusinesses,
    page = currentPageRef.current,
    limit = recordsPerPage,
    search = searchTerm,
    status = statusFilter,
  ) => {
    try {
      setLoading(true);
      setError(null);

      let ids = Array.isArray(bizIds) ? bizIds.filter(Boolean) : [];
      if (!ids.length) {
        ids = (businesses || []).map((b) => b._id).filter(Boolean);
      }
      if (!ids.length) {
        setRows([]);
        setTotalResults(0);
        return;
      }

      const response = await axios.get(`${Base_URL}/internal-transfers`, {
        headers,
        params: {
          businessIds: ids.join(","),
          page,
          limit,
          search: search || undefined,
          status: status || undefined,
        },
      });
      setRows(response.data?.data || []);
      setTotalResults(response.data?.total || 0);
    } catch (err) {
      console.error(err);
      setError(
        tWithFallback(
          "internalTransfer.messages.fetchFailed",
          "Failed to fetch internal transfers.",
        ),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessesLoading) return;
    fetchRows(selectedBusinesses, 1, recordsPerPage, searchTerm, statusFilter);
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, [selectedBusinesses.join(","), statusFilter, businessesLoading, businesses]);

  const handleSearch = (value) => {
    const trimmed = value || "";
    setSearchTerm(trimmed);
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchRows(selectedBusinesses, 1, recordsPerPage, trimmed, statusFilter);
  };

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !selectedBusinesses.length &&
      !statusFilter;
    setSelectedBusinesses([]);
    setStatusFilter("");
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      fetchRows([], 1, recordsPerPage, "", "");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchRows(selectedBusinesses, page, recordsPerPage, searchTerm, statusFilter);
  };

  const openCancelModal = (row) => {
    setToCancel(row);
    setCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!toCancel || cancelling) return;
    setCancelling(true);
    try {
      await axios.post(
        `${Base_URL}/internal-transfers/${toCancel._id}/cancel`,
        {},
        { headers },
      );
      notifySuccess(
        tWithFallback(
          "internalTransfer.messages.cancelled",
          "Transfer cancelled",
        ),
      );
      setCancelModalOpen(false);
      setToCancel(null);
      fetchRows();
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          tWithFallback(
            "internalTransfer.messages.cancelFailed",
            "Failed to cancel transfer",
          ),
      );
    } finally {
      setCancelling(false);
    }
  };

  const tableHeaders = [
    tWithFallback("internalTransfer.reference", "Reference"),
    tWithFallback("internalTransfer.name", "Name"),
    t("Business"),
    tWithFallback("internalTransfer.from", "From"),
    tWithFallback("internalTransfer.to", "To"),
    t("Status"),
    tWithFallback("internalTransfer.lines", "Lines"),
    tWithFallback("internalTransfer.date", "Created"),
    t("common.action") || t("common.actions") || "Actions",
  ];

  const filters = [
    {
      isClearButton: true,
      tooltip: tWithFallback(
        "internalTransfer.clearFilters",
        "Clear Filters",
      ),
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusinesses,
      onChange: (value) => {
        const next = Array.isArray(value) ? value : value ? [value] : [];
        setSelectedBusinesses(next);
      },
      placeholder: t("item.selectBusinesses") || t("Business") || "Select Business",
      isMulti: true,
      options: businesses.map((b) => ({
        value: b._id,
        label: b.name,
      })),
    }] : []),
    {
      value: statusFilter || "",
      onChange: (value) => setStatusFilter(value || ""),
      placeholder: t("Status"),
      options: [
        { value: "", label: t("All") || "All" },
        { value: "draft", label: STATUS_LABELS.draft },
        { value: "done", label: STATUS_LABELS.done },
        { value: "cancelled", label: STATUS_LABELS.cancelled },
      ],
    },
  ];

  const locLabel = (wh, loc) => {
    const w = wh?.name || wh?.code || "";
    const l = loc?.name || loc?.code || "";
    if (w && l) return `${w} / ${l}`;
    return w || l || "-";
  };

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {tWithFallback(
                    "internalTransfer.title",
                    "Internal Transfers",
                  )}
                </h1>
                <p className="text-gray-600 mt-2">
                  {tWithFallback(
                    "internalTransfer.description",
                    "Move stock between warehouses or locations — source decreases, destination increases.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                <button
                  type="button"
                  onClick={() => history.push("/stock-levels")}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Stock Levels
                </button>
                {canAdd && (
                  <button
                    type="button"
                    onClick={() =>
                      history.push("/internal-transfers/create", {
                        from: "/internal-transfers",
                      })
                    }
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                  >
                    <Plus size={20} />
                    {tWithFallback(
                      "internalTransfer.new",
                      "New Internal Transfer",
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              onSearch={handleSearch}
              searchValue={searchTerm}
              searchPlaceholder={tWithFallback(
                "internalTransfer.searchPlaceholder",
                "Search by reference or name...",
              )}
              filters={filters}
              loading={loading || businessesLoading}
              headers={tableHeaders}
              data={rows}
              totalResults={totalResults}
              resultsPerPage={recordsPerPage}
              onPageChange={handlePageChange}
              onChangeResultsPerPage={(n) => {
                setRecordsPerPage(n);
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchRows(selectedBusinesses, 1, n, searchTerm, statusFilter);
              }}
              currentPage={currentPage}
              tableError={error}
              emptyMessage={tWithFallback(
                "internalTransfer.emptyMessage",
                "No internal transfers yet. Move stock between locations to get started.",
              )}
              renderRow={(row) => (
                <tr
                  key={row._id}
                  className="border-b"
                  style={{ fontSize: "12px", fontWeight: "400" }}
                >
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    <button
                      type="button"
                      className="text-[var(--p-blue)] hover:underline font-medium"
                      onClick={() =>
                        history.push(`/internal-transfers/${row._id}`)
                      }
                    >
                      {row.reference || "-"}
                    </button>
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.name || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.business?.name || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {locLabel(row.sourceWarehouse, row.sourceLocation)}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {locLabel(row.destWarehouse, row.destLocation)}
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        STATUS_STYLES[row.status] || STATUS_STYLES.draft
                      }`}
                    >
                      {STATUS_LABELS[row.status] || row.status}
                    </span>
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.lineCount ?? 0}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.createdAt ? formatDate(row.createdAt) || "-" : "-"}
                  </td>
                  <td className="py-2 px-4">
                    <ActionButtons
                      items={[
                        {
                          tooltip: "View",
                          action: ACTION_BUTTON_TYPES.VIEW,
                          onClick: () =>
                            history.push(`/internal-transfers/${row._id}`),
                        },
                        canUpdate &&
                          row.status === "draft" && {
                            tooltip: "Open",
                            action: ACTION_BUTTON_TYPES.EDIT,
                            onClick: () =>
                              history.push(`/internal-transfers/${row._id}`),
                          },
                        canUpdate &&
                          row.status === "draft" && {
                            tooltip: "Cancel",
                            action: ACTION_BUTTON_TYPES.DELETE,
                            onClick: () => openCancelModal(row),
                          },
                      ].filter(Boolean)}
                    />
                  </td>
                </tr>
              )}
            />
          </div>
        </div>

        <Modal
          isOpen={cancelModalOpen}
          onClose={() => {
            if (cancelling) return;
            setCancelModalOpen(false);
            setToCancel(null);
          }}
        >
          <ModalHeader>
            {tWithFallback(
              "internalTransfer.cancelTitle",
              "Cancel Transfer",
            )}
          </ModalHeader>
          <ModalBody>
            {toCancel && (
              <p>
                {tWithFallback(
                  "internalTransfer.cancelConfirm",
                  `Cancel transfer ${toCancel.reference}? Stock will not be moved.`,
                )}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
              disabled={cancelling}
              onClick={() => {
                if (cancelling) return;
                setCancelModalOpen(false);
                setToCancel(null);
              }}
            >
              {t("Cancel") || "Back"}
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
              disabled={cancelling}
              onClick={confirmCancel}
            >
              {cancelling && (
                <span
                  className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  aria-hidden
                />
              )}
              {cancelling
                ? "Cancelling…"
                : tWithFallback(
                    "internalTransfer.confirmCancel",
                    "Cancel Transfer",
                  )}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default InternalTransfers;
