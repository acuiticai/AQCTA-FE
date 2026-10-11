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
import { formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ReorderingRules = () => {
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

  const { canAdd, canUpdate, canDelete } = useRouteModulePermissions();

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
  const [activeFilter, setActiveFilter] = useState("");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [runningAlerts, setRunningAlerts] = useState(false);

  const currentPageRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (!cancelled) {
        setBusinesses(list || []);
        // No default business — show all assigned
        setBusinessesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRows = async (
    bizId = selectedBusiness,
    page = currentPageRef.current,
    limit = recordsPerPage,
    search = searchTerm,
  ) => {
    try {
      setLoading(true);
      setError(null);

      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      if (!assignedIds.length && !bizId) {
        setRows([]);
        setTotalResults(0);
        return;
      }

      const params = {
        page,
        limit,
        search: search || undefined,
        active: activeFilter || undefined,
        withStock: "true",
      };

      if (bizId) {
        params.businessId = bizId;
      } else {
        params.businessIds = assignedIds.join(",");
      }

      const response = await axios.get(`${Base_URL}/reordering-rules`, {
        headers,
        params,
      });

      let data = response.data?.data || [];
      if (needsOnly) data = data.filter((r) => r.needsReorder);
      setRows(data);
      setTotalResults(
        needsOnly ? data.length : response.data?.total || data.length,
      );
    } catch (err) {
      console.error(err);
      setError(
        tWithFallback(
          "reorderingRule.messages.fetchFailed",
          "Failed to fetch reordering rules.",
        ),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessesLoading) return;
    fetchRows(selectedBusiness, 1, recordsPerPage, searchTerm);
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, [selectedBusiness, activeFilter, needsOnly, businessesLoading, businesses]);

  const handleSearch = (value) => {
    const trimmed = value || "";
    setSearchTerm(trimmed);
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchRows(selectedBusiness, 1, recordsPerPage, trimmed);
  };

  const clearFilters = () => {
    const onlySearchActive =
      Boolean(searchTerm) &&
      !selectedBusiness &&
      !activeFilter &&
      !needsOnly;
    setSelectedBusiness("");
    setActiveFilter("");
    setNeedsOnly(false);
    setSearchTerm("");
    setCurrentPage(1);
    currentPageRef.current = 1;
    if (onlySearchActive) {
      fetchRows("", 1, recordsPerPage, "");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
    fetchRows(selectedBusiness, page, recordsPerPage, searchTerm);
  };

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${Base_URL}/reordering-rules/${toDelete._id}`, {
        headers,
      });
      notifySuccess("Reordering rule deleted");
      setDeleteModalOpen(false);
      setToDelete(null);
      fetchRows();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete rule");
    } finally {
      setDeleting(false);
    }
  };

  const runAlertsNow = async () => {
    if (runningAlerts) return;
    setRunningAlerts(true);
    try {
      const res = await axios.post(
        `${Base_URL}/reordering-rules/run-alerts`,
        {},
        { headers },
      );
      const d = res.data?.data || {};
      notifySuccess(
        `Alerts done — sent: ${d.sent ?? 0}, already today: ${d.dupes ?? 0}, failed: ${d.skipped ?? 0}`,
      );
      fetchRows();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to run reorder alerts");
    } finally {
      setRunningAlerts(false);
    }
  };

  const tableHeaders = [
    "Business",
    "Product",
    "Scope",
    "Min",
    "Max",
    "Fixed Qty",
    "On Hand",
    "Suggested",
    "Status",
    "Active",
    "Actions",
  ];

  const filters = [
    {
      isClearButton: true,
      tooltip: tWithFallback("reorderingRule.clearFilters", "Clear Filters"),
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusiness || "",
      onChange: (value) => setSelectedBusiness(value || ""),
      placeholder: t("Business") || "All businesses",
      options: [
        { value: "", label: "All assigned businesses", first: true },
        ...businesses.map((b) => ({
          value: b._id,
          label: b.name,
        })),
      ],
    }] : []),
    {
      value: activeFilter || "",
      onChange: (value) => setActiveFilter(value || ""),
      placeholder: "Active",
      options: [
        { value: "", label: "All" },
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
    },
  ];

  const scopeLabel = (row) => {
    if (row.location?.name || row.location?.code) {
      return `${row.warehouse?.name || "WH"} / ${
        row.location.code || row.location.name
      }`;
    }
    if (row.warehouse?.name) return row.warehouse.name;
    return "Company-wide";
  };

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Reordering Rules
                </h1>
                <p className="text-gray-600 mt-2">
                  When stock hits the minimum, replenish toward the maximum (or
                  a fixed qty).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => history.push("/purchase-planning")}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Purchase Planning
                </button>
                <button
                  type="button"
                  onClick={runAlertsNow}
                  disabled={runningAlerts}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  {runningAlerts ? "Running alerts…" : "Run alerts now"}
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={needsOnly}
                    onChange={(e) => setNeedsOnly(e.target.checked)}
                  />
                  Needs reorder only
                </label>
                {canAdd && (
                  <button
                    type="button"
                    onClick={() =>
                      history.push("/reordering-rules/create", {
                        from: "/reordering-rules",
                      })
                    }
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] shadow-sm"
                  >
                    <Plus size={20} />
                    New Rule
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <DataTable
              onSearch={handleSearch}
              searchValue={searchTerm}
              searchPlaceholder="Search product, warehouse…"
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
                fetchRows(selectedBusiness, 1, n, searchTerm);
              }}
              tableError={error}
              emptyMessage="No reordering rules yet. Add a rule with min/max stock to get started."
              renderRow={(row) => (
                <tr key={row._id} className="border-b" style={{ fontSize: "13px" }}>
                  <td className="py-2 px-3">{row.business?.name || "—"}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{row.item?.name || "—"}</div>
                    <div className="text-xs text-gray-500">
                      {row.item?.itemCode || ""}
                    </div>
                  </td>
                  <td className="py-2 px-3">{scopeLabel(row)}</td>
                  <td className="py-2 px-3">{formatQuantity(row.minQty)}</td>
                  <td className="py-2 px-3">{formatQuantity(row.maxQty)}</td>
                  <td className="py-2 px-3">{formatQuantity(row.reorderQty)}</td>
                  <td className="py-2 px-3 font-semibold">
                    {formatQuantity(row.currentStock)}
                  </td>
                  <td className="py-2 px-3 text-[var(--p-blue)] font-semibold">
                    {formatQuantity(row.suggestedOrderQty)}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        row.needsReorder
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {row.needsReorder ? "Needs reorder" : "OK"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {row.active ? "Yes" : "No"}
                  </td>
                  <td className="py-2 px-3">
                    <ActionButtons
                      items={[
                        {
                          tooltip: "View",
                          action: ACTION_BUTTON_TYPES.VIEW,
                          onClick: () =>
                            history.push(`/reordering-rules/${row._id}`),
                        },
                        canUpdate && {
                          tooltip: "Edit",
                          action: ACTION_BUTTON_TYPES.EDIT,
                          onClick: () =>
                            history.push(`/reordering-rules/${row._id}`),
                        },
                        canDelete && {
                          tooltip: "Delete",
                          action: ACTION_BUTTON_TYPES.DELETE,
                          onClick: () => {
                            setToDelete(row);
                            setDeleteModalOpen(true);
                          },
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
          isOpen={deleteModalOpen}
          onClose={() => {
            if (deleting) return;
            setDeleteModalOpen(false);
            setToDelete(null);
          }}
        >
          <ModalHeader>Delete Reordering Rule</ModalHeader>
          <ModalBody>
            Delete rule for <strong>{toDelete?.item?.name}</strong>? Stock will
            not change — only the rule is removed.
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg"
              disabled={deleting}
              onClick={() => {
                setDeleteModalOpen(false);
                setToDelete(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default ReorderingRules;
