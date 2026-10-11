import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { DataTable, ActionButtons } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { AdminContext } from "@/context/AdminContext";
import { formatDate, formatQuantity } from "@/components/formatAmount";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  pending_inspection: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-800",
  reversed: "bg-purple-100 text-purple-800",
};

const STATUS_LABELS = {
  draft: "Draft",
  pending_inspection: "Pending Inspection",
  confirmed: "Confirmed",
  rejected: "Rejected",
  returned: "Returned",
  reversed: "Reversed",
};

const GoodsReceipts = () => {
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
  const [actionLoading, setActionLoading] = useState("");
  const [actionRowId, setActionRowId] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [toReject, setToReject] = useState(null);
  const [rejectRemark, setRejectRemark] = useState("");

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

      const response = await axios.get(`${Base_URL}/goods-receipts`, {
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
      setError(err.response?.data?.message || "Failed to fetch goods receipts.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessesLoading) return;
    currentPageRef.current = 1;
    setCurrentPage(1);
    fetchRows(selectedBusinesses, 1, recordsPerPage, searchTerm, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedBusinesses.join(","),
    statusFilter,
    businessesLoading,
    businesses,
  ]);

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
    currentPageRef.current = page;
    setCurrentPage(page);
    fetchRows(selectedBusinesses, page, recordsPerPage, searchTerm, statusFilter);
  };

  const openCancelModal = (row) => {
    setToCancel(row);
    setCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!toCancel?._id) return;
    setCancelling(true);
    try {
      await axios.post(
        `${Base_URL}/goods-receipts/${toCancel._id}/cancel`,
        {},
        { headers },
      );
      notifySuccess("GRN cancelled");
      setCancelModalOpen(false);
      setToCancel(null);
      fetchRows();
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to cancel GRN");
    } finally {
      setCancelling(false);
    }
  };

  const runRowAction = async (row, action) => {
    if (!row?._id) return;
    if (action === "reject") {
      setToReject(row);
      setRejectRemark("");
      setRejectModalOpen(true);
      return;
    }
    setActionLoading(action);
    setActionRowId(row._id);
    try {
      if (action === "inspect") {
        await axios.post(
          `${Base_URL}/goods-receipts/${row._id}/send-inspection`,
          {},
          { headers },
        );
        notifySuccess("GRN sent for inspection");
      } else if (action === "confirm") {
        await axios.post(
          `${Base_URL}/goods-receipts/${row._id}/confirm`,
          {},
          { headers },
        );
        notifySuccess("GRN confirmed");
      }
      fetchRows();
    } catch (err) {
      notifyError(err.response?.data?.message || `Failed to ${action} GRN`);
    } finally {
      setActionLoading("");
      setActionRowId("");
    }
  };

  const submitReject = async () => {
    if (!toReject?._id) return;
    const remark = String(rejectRemark || "").trim();
    if (!remark) {
      notifyError("Rejection remark is required");
      return;
    }
    setActionLoading("reject");
    setActionRowId(toReject._id);
    try {
      await axios.post(
        `${Base_URL}/goods-receipts/${toReject._id}/reject`,
        { remark },
        { headers },
      );
      notifySuccess("GRN rejected");
      setRejectModalOpen(false);
      setToReject(null);
      setRejectRemark("");
      fetchRows();
    } catch (err) {
      notifyError(err.response?.data?.message || "Failed to reject GRN");
    } finally {
      setActionLoading("");
      setActionRowId("");
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
      onChange: (value) => {
        const next = Array.isArray(value) ? value : value ? [value] : [];
        setSelectedBusinesses(next);
      },
      placeholder: "Select Business",
      isMulti: true,
      options: businesses.map((b) => ({
        value: b._id,
        label: b.name,
      })),
    }] : []),
    {
      value: statusFilter || "",
      onChange: (value) => setStatusFilter(value || ""),
      placeholder: "Status",
      options: [
        { value: "", label: "All" },
        ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      ],
    },
  ];

  const tableHeaders = [
    "GRN #",
    "Vendor",
    "Business",
    "PO(s)",
    "Status",
    "Accepted",
    "Date",
    "Actions",
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Goods Receipts
                </h1>
                <p className="text-gray-600 mt-2">
                  Receive against POs — stock in only on Confirm (accepted qty)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {canAdd && (
                  <button
                    type="button"
                    onClick={() =>
                      history.push("/goods-receipts/create", {
                        from: "/goods-receipts",
                      })
                    }
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                  >
                    <Plus size={20} />
                    New GRN
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
            <DataTable
              onSearch={handleSearch}
              searchValue={searchTerm}
              searchPlaceholder="Search GRN #, vendor, PO…"
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
              emptyMessage="No goods receipts yet. Create a GRN against an approved purchase order."
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
                      onClick={() => history.push(`/goods-receipts/${row._id}`)}
                    >
                      {row.reference || "-"}
                    </button>
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.vendorName || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.business?.name || "-"}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {(row.purchaseOrderNumbers || []).join(", ") || "-"}
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
                    {formatQuantity(row.totalAccepted || 0)}
                  </td>
                  <td className="py-2 px-4" style={{ fontSize: "14px" }}>
                    {row.createdAt ? formatDate(row.createdAt) || "-" : "-"}
                  </td>
                  <td className="py-2 px-4">
                    {(() => {
                      const rowBusy = actionRowId === row._id;
                      return (
                        <ActionButtons
                          maxVisibleActions={6}
                          items={[
                            {
                              tooltip: "View",
                              action: ACTION_BUTTON_TYPES.VIEW,
                              onClick: () =>
                                history.push(`/goods-receipts/${row._id}`),
                            },
                            canUpdate &&
                              row.status === "draft" && {
                                tooltip: "For inspection",
                                action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                                disabled: rowBusy,
                                loading: rowBusy && actionLoading === "inspect",
                                onClick: () => runRowAction(row, "inspect"),
                              },
                            canUpdate &&
                              (row.status === "draft" ||
                                row.status === "pending_inspection") && {
                                tooltip: "Accept",
                                action: ACTION_BUTTON_TYPES.APPROVE,
                                disabled: rowBusy,
                                loading: rowBusy && actionLoading === "confirm",
                                onClick: () => runRowAction(row, "confirm"),
                              },
                            canUpdate &&
                              (row.status === "draft" ||
                                row.status === "pending_inspection") && {
                                tooltip: "Reject",
                                action: ACTION_BUTTON_TYPES.REJECT,
                                disabled: rowBusy,
                                onClick: () => runRowAction(row, "reject"),
                              },
                            canUpdate &&
                              (row.status === "draft" ||
                                row.status === "pending_inspection") && {
                                tooltip: "Open",
                                action: ACTION_BUTTON_TYPES.EDIT,
                                onClick: () =>
                                  history.push(`/goods-receipts/${row._id}`),
                              },
                            canUpdate &&
                              (row.status === "draft" ||
                                row.status === "pending_inspection") && {
                                tooltip: "Cancel",
                                action: ACTION_BUTTON_TYPES.DELETE,
                                onClick: () => openCancelModal(row),
                              },
                          ].filter(Boolean)}
                        />
                      );
                    })()}
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
          <ModalHeader>Cancel GRN</ModalHeader>
          <ModalBody>
            {toCancel && (
              <p>
                Cancel GRN {toCancel.reference}? No stock has been posted yet.
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
              Back
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              disabled={cancelling}
              onClick={confirmCancel}
            >
              {cancelling ? "Cancelling…" : "Cancel GRN"}
            </button>
          </ModalFooter>
        </Modal>

        <Modal
          isOpen={rejectModalOpen}
          onClose={() => {
            if (actionLoading === "reject") return;
            setRejectModalOpen(false);
            setToReject(null);
            setRejectRemark("");
          }}
        >
          <ModalHeader>Reject GRN</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600 mb-3">
              {toReject?.reference
                ? `Reject ${toReject.reference}. Rejection remark is required.`
                : "Rejection remark is required."}
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              placeholder="Reason for rejection..."
              disabled={actionLoading === "reject"}
            />
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
              disabled={actionLoading === "reject"}
              onClick={() => {
                if (actionLoading === "reject") return;
                setRejectModalOpen(false);
                setToReject(null);
                setRejectRemark("");
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              disabled={actionLoading === "reject" || !String(rejectRemark).trim()}
              onClick={submitReject}
            >
              {actionLoading === "reject" ? "Rejecting..." : "Confirm Reject"}
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </RoutePermissionGate>
  );
};

export default GoodsReceipts;
