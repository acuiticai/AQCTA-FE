import { useEffect, useState, useContext } from "react";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Search,
  Building,
  Store,
  Calendar,
  Package,
} from "lucide-react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { DataTable, SummaryCards } from "@/page-layouts/index";
import StandardPageHeader from "@/components/StandardPageHeader";
import { formatDate, formatAmount, formatCurrencyAmount } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import PurchaseOrderServices from "@/services/PurchaseOrderServices";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "@/assets/img/icons/stats-1.png";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function formatPoStatusLabel(status) {
  if (!status) return "Draft";
  const s = String(status).toLowerCase();
  if (s === "confirmed" || s === "issued") return "Approved";
  if (s === "partially delivered") return "Partially Received";
  if (s === "delivered" || s === "received") return "Fully Received";
  // Legacy billing-on-status values — lifecycle display only (Bill Status is separate)
  if (s === "partially billed" || s === "partially invoiced") {
    return "Partially Received";
  }
  if (s === "fully billed" || s === "fully invoiced") return "Fully Received";
  return status;
}

// Status Badge Component (SRS PO lifecycle — receipt/approval, not billing)
const StatusBadge = ({ status }) => {
  const getStatusColor = (statusRaw) => {
    const s = statusRaw?.toLowerCase() || "";
    switch (s) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "submitted":
        return "bg-amber-100 text-amber-800";
      case "approved":
      case "issued":
      case "confirmed":
        return "bg-blue-100 text-blue-700";
      case "partially received":
      case "partially delivered":
      case "partially invoiced":
      case "partially billed":
        return "bg-yellow-100 text-yellow-700";
      case "fully received":
      case "received":
      case "delivered":
      case "fully invoiced":
      case "fully billed":
        return "bg-green-100 text-green-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "closed":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
        status
      )}`}
    >
      {formatPoStatusLabel(status)}
    </span>
  );
};

// Bill status (vendor invoices / AP) vs PO
const BillStatusBadge = ({ status }) => {
  const getColor = (st) => {
    switch (st) {
      case "Not Billed":
      case "Not Invoiced":
        return "bg-gray-100 text-gray-700";
      case "Partially Billed":
      case "Partially Invoiced":
        return "bg-yellow-100 text-yellow-700";
      case "Fully Billed":
      case "Invoiced":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const label =
    status === "Not Invoiced"
      ? "Not Billed"
      : status === "Partially Invoiced"
        ? "Partially Billed"
        : status === "Invoiced"
          ? "Fully Billed"
          : status || "Not Billed";

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getColor(
        status
      )}`}
    >
      {label}
    </span>
  );
};

// Payment Status Badge Component
const PaymentStatusBadge = ({ status }) => {
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Partially Paid":
        return "bg-yellow-100 text-yellow-700";
      case "Unpaid":
        return "bg-red-100 text-red-700";
      case "N/A":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
        status
      )}`}
    >
      {status || "N/A"}
    </span>
  );
};

export default function PurchaseOrdersList() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const routePerms = useRouteModulePermissions();
  const {
    canAdd,
    canUpdate,
    canDelete,
    canView,
    canViewDetails,
  } = routePerms;
  const canOpenPo = canView || canViewDetails;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [businesses, setBusinesses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [overallStats, setOverallStats] = useState({
    totalSalesOrders: 0,
    draftOrders: 0,
    confirmedOrders: 0,
    issuedOrders: 0,
    closedOrders: 0,
    totalValue: 0,
  });

  // Fetch assigned businesses for the logged-in user (not all businesses)
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        // Only auto-select when there is exactly one business; if multiple, leave none selected
        if (list.length === 1) {
          setSelectedBusiness((prev) => (prev === "" ? list[0]._id : prev));
        }
      } catch (error) {
        console.error("Error fetching assigned businesses:", error);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  // Vendors for the selected business (same as PurchaseOrderForm — PO `customer` refs Vendor)
  useEffect(() => {
    const fetchVendors = async () => {
      if (!selectedBusiness) {
        setVendors([]);
        setSelectedVendor("");
        return;
      }
      try {
        const response = await axios.get(`${Base_URL}/vendors`, {
          headers,
          params: { business: selectedBusiness, limit: 9999 },
        });
        const raw =
          response?.data?.data || response?.data?.vendors || response?.data;
        const list = Array.isArray(raw) ? raw : [];
        // Only Active vendors in search filter (missing status treated as Active)
        setVendors(
          list.filter(
            (v) => String(v?.status ?? "Active").toLowerCase() === "active"
          )
        );
        setSelectedVendor("");
      } catch (error) {
        console.error("Error fetching vendors for business:", error);
        setVendors([]);
      }
    };
    fetchVendors();
  }, [selectedBusiness, adminInfo?.id]);

  // Fetch purchase orders
  const fetchSalesOrders = async () => {
    if (businesses.length === 0) {
      setLoading(false);
      setSalesOrders([]);
      setTotalPages(1);
      setTotalRecords(0);
      setOverallStats({
        totalSalesOrders: 0,
        draftOrders: 0,
        confirmedOrders: 0,
    issuedOrders: 0,
        closedOrders: 0,
        totalValue: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const assignedIds = (businesses || []).map((b) => b._id).filter(Boolean);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        search: searchTerm,
        ...(selectedBusiness
          ? { business: selectedBusiness }
          : assignedIds.length > 0
          ? { businessIds: assignedIds.join(",") }
          : {}),
        ...(selectedVendor ? { customer: selectedVendor } : {}),
        status: selectedStatus !== "All" ? selectedStatus : "",
      };

      const response = await PurchaseOrderServices.getAllSalesOrders(
        params,
        headers
      );

      if (response.data.success) {
        setSalesOrders(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalRecords(response.data.total || 0);
        setOverallStats(response.data.overallStats || {
          totalSalesOrders: 0,
          draftOrders: 0,
          confirmedOrders: 0,
    issuedOrders: 0,
          closedOrders: 0,
          totalValue: 0,
        });
      } else {
        notifyError(response.data.message || "Failed to fetch purchase orders");
      }
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      notifyError("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesOrders();
  }, [currentPage, recordsPerPage, searchTerm, selectedBusiness, selectedVendor, selectedStatus, businesses.length]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedBusiness("");
    setSelectedVendor("");
    setSelectedStatus("All");
    setCurrentPage(1);
  };

  const handleDelete = (id) => {
    if (!canDelete) return;
    setSelectedOrderId(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedOrderId || !canDelete) return;

    try {
      const response = await PurchaseOrderServices.deleteSalesOrder(
        selectedOrderId,
        headers
      );

      if (response.data.success) {
        notifySuccess("Purchase order deleted successfully");
        fetchSalesOrders();
      } else {
        notifyError(response.data.message || "Failed to delete purchase order");
      }
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      notifyError("Failed to delete purchase order");
    } finally {
      setDeleteModalOpen(false);
      setSelectedOrderId(null);
    }
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Business",
            value: selectedBusiness,
            onChange: (value) => {
              setSelectedBusiness(value);
              setSelectedVendor("");
              setCurrentPage(1);
            },
            options: businesses.map((b) => ({
              value: b._id,
              label: b.name,
            })),
            placeholder: "Select Business",
            icon: Building,
          },
        ]
      : []),
    {
      label: "Vendor",
      value: selectedVendor,
      onChange: (value) => {
        setSelectedVendor(value);
        setCurrentPage(1);
      },
      options: vendors
        .filter((v) => String(v?.status ?? "Active").toLowerCase() === "active")
        .map((v) => ({
        value: v._id,
        label:
          v.basicInformation?.companyName ||
          v.basicInformation?.vendorDisplayName ||
          "—",
      })),
      placeholder: "Select Vendor",
      icon: Store,
    },
    {
      label: "Status",
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: "All Statuses" },
        { value: "Draft", label: "Draft" },
        { value: "Submitted", label: "Submitted" },
        { value: "Approved", label: "Approved" },
        { value: "Partially Received", label: "Partially Received" },
        { value: "Fully Received", label: "Fully Received" },
        { value: "Closed", label: "Closed" },
        { value: "Cancelled", label: "Cancelled" },
      ],
      placeholder: "Select Status",
      icon: Package,
    },
  ];

  const summaryCardsData = [
    {
      title: "Total Purchase Orders",
      value: overallStats.totalSalesOrders || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Approved Orders",
      value: overallStats.approvedOrders ?? overallStats.issuedOrders ?? overallStats.confirmedOrders ?? 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Draft Orders",
      value: overallStats.draftOrders || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Total Value",
      value: `${formatAmount(overallStats.totalValue || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <StandardPageHeader
          title="Purchase Orders"
          subtitle="Manage and track all purchase orders"
          actions={
            <button
              type="button"
              onClick={() => canAdd && history.push("/purchase-orders/create")}
              disabled={!canAdd}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} />
              Create Purchase Order
            </button>
          }
        />

        <div className="mb-8">
          <SummaryCards cards={summaryCardsData} columnsCount={4} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
        <DataTable
          title=""
          headersWithoutCellTooltip={["Total Amount"]}
          colWidths={{
            "PO Number": "160px",
            "Vendor Name": "260px",
            Date: "170px",
            "Total Amount": "180px",
            Status: "150px",
            "Bill Status": "170px",
            "Payment Status": "170px",
            Actions: "160px",
          }}
          headers={[
            "PO Number",
            "Vendor Name",
            "Date",
            "Total Amount",
            "Status",
            "Bill Status",
            "Payment Status",
            "Actions",
          ]}
          data={salesOrders}
          loading={loading}
          totalRecords={totalRecords}
          currentPage={currentPage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={(perPage) => {
            setRecordsPerPage(perPage);
            setCurrentPage(1);
          }}
          searchValue={searchTerm}
          onSearch={setSearchTerm}
          searchPlaceholder="Search purchase orders..."
          filters={filters}
          renderRow={(order) => (
            <>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {canOpenPo ? (
                  <button
                    type="button"
                    onClick={() => history.push(`/purchase-orders/view/${order._id}`)}
                    className="text-[var(--p-blue)] hover:underline"
                  >
                    {order.purchaseOrderNumber || order.poNumber || "-"}
                  </button>
                ) : (
                  order.purchaseOrderNumber || order.poNumber || "-"
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {order.customer?.basicInformation?.companyName ||
                  order.customer?.basicInformation?.vendorDisplayName ||
                  order.customer?.basicInformation?.customerDisplayName ||
                  (typeof order.customer === "string" ? "Loading..." : order.customerName) ||
                  "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatDate(
                  order.purchaseOrderDate ||
                    order.salesOrderDate ||
                    order.orderDate ||
                    order.date ||
                    order.createdAt
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
              {order.currency
                ? formatCurrencyAmount(order.currency, order.total || 0)
                : formatAmount(order.total || 0)}

              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <BillStatusBadge status={order.billStatus || order.invoiceStatus} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <PaymentStatusBadge status={order.paymentStatus} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      canOpenPo &&
                      history.push(`/purchase-orders/view/${order._id}`)
                    }
                    className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="View"
                    disabled={!canOpenPo}
                  >
                    <Eye size={14} />
                  </button>
                  {order.paymentStatus !== "Paid" &&
                    order.paymentStatus !== "Partially Paid" &&
                    !["closed", "cancelled", "fully received"].includes(
                      String(order.status || "").toLowerCase(),
                    ) &&
                    !["received", "delivered"].includes(
                      String(order.status || "").toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        onClick={() =>
                          canUpdate &&
                          history.push(`/purchase-orders/edit/${order._id}`)
                        }
                        className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Edit"
                        disabled={!canUpdate}
                      >
                        <Edit size={14} />
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => handleDelete(order._id)}
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete"
                    disabled={!canDelete}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </>
          )}
        />
        </div>

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Delete Purchase Order
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this purchase order? This action
                cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedOrderId(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Total Sales Summary */}
        {/* {salesOrders.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Total Sales:
              </span>
              <span className="text-lg font-semibold text-gray-900">
                {formatAmount(
                  salesOrders.reduce((sum, order) => sum + (order.total || 0), 0)
                )}
              </span>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
}
