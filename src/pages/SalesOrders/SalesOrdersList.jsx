import { useEffect, useState, useContext } from "react";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Search,
  Building,
  User,
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
import SalesOrderServices from "@/services/SalesOrderServices";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useTranslation } from "react-i18next";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DollarSvg from "@/assets/img/icons/stats-1.png";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Status Badge Component
const StatusBadge = ({ status, t }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "confirmed":
        return "bg-blue-100 text-blue-700";
      case "partially delivered":
        return "bg-yellow-100 text-yellow-700";
      case "delivered":
        return "bg-green-100 text-green-700";
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
      {status
        ? t(`salesOrder.status.${status.toLowerCase().replace(/\s+/g, "")}`, {
            defaultValue: status,
          })
        : t("salesOrder.status.draft", { defaultValue: "Draft" })}
    </span>
  );
};

// Invoice Status Badge Component
const InvoiceStatusBadge = ({ status, t }) => {
  const getInvoiceStatusColor = (status) => {
    switch (status) {
      case "Not Invoiced":
        return "bg-gray-100 text-gray-700";
      case "Partially Invoiced":
        return "bg-yellow-100 text-yellow-700";
      case "Invoiced":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getInvoiceStatusColor(
        status
      )}`}
    >
      {status
        ? t(`salesOrder.invoiceStatus.${status.toLowerCase().replace(/\s+/g, "")}`, {
            defaultValue: status,
          })
        : t("salesOrder.invoiceStatus.notInvoiced", {
            defaultValue: "Not Invoiced",
          })}
    </span>
  );
};

// Payment Status Badge Component
const PaymentStatusBadge = ({ status, t }) => {
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
      {status
        ? t(`salesOrder.paymentStatus.${status.toLowerCase().replace(/\s+/g, "")}`, {
            defaultValue: status,
          })
        : t("salesOrder.paymentStatus.notApplicable", { defaultValue: "N/A" })}
    </span>
  );
};

export default function SalesOrdersList() {
  const { t } = useTranslation();
  const { getModuleLabel, getModuleRoutePath } = useModuleLabels();
  const configuredSaleOrderLabel = getModuleLabel("saleOrder", "Sale Order");
  const usesDefaultSaleOrderLabel = configuredSaleOrderLabel === "Sale Order";
  const saleOrderLabel = usesDefaultSaleOrderLabel
    ? t("salesOrder.label", { defaultValue: "Sale Order" })
    : configuredSaleOrderLabel;
  const saleOrderLabelPlural = usesDefaultSaleOrderLabel
    ? t("salesOrder.labelPlural", { defaultValue: "Sale Orders" })
    : `${configuredSaleOrderLabel}s`;
  const saleOrderNumberHeader = t("salesOrder.list.orderNumber", {
    defaultValue: "{{label}} Number",
    label: saleOrderLabel,
  });
  const customerNameHeader = t("salesOrder.fields.customerName", {
    defaultValue: "Customer Name",
  });
  const dateHeader = t("salesOrder.fields.date", { defaultValue: "Date" });
  const shipmentDateHeader = t("salesOrder.fields.expectedShipmentDate", {
    defaultValue: "Expected Shipment Date",
  });
  const totalAmountHeader = t("salesOrder.fields.totalAmount", {
    defaultValue: "Total Amount",
  });
  const statusHeader = t("common.status", { defaultValue: "Status" });
  const invoiceStatusHeader = t("salesOrder.fields.invoiceStatus", {
    defaultValue: "Invoice Status",
  });
  const paymentStatusHeader = t("salesOrder.fields.paymentStatus", {
    defaultValue: "Payment Status",
  });
  const actionsHeader = t("common.actions", { defaultValue: "Actions" });
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);
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
    closedOrders: 0,
    totalValue: 0,
  });

  const routePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canDelete, canView, canViewDetails } = routePerms;
  const canOpenSalesOrder = canView || canViewDetails || canUpdate;

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

  // Customers for the selected business (same pattern as Customer Invoices)
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!selectedBusiness) {
        setCustomers([]);
        setSelectedCustomer("");
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/customers_by_business/${selectedBusiness}`,
          { headers }
        );
        const list = Array.isArray(response?.data)
          ? response.data.filter(
              (c) => !c.status || c.status === "Active"
            )
          : [];
        setCustomers(list);
        setSelectedCustomer("");
      } catch (error) {
        console.error("Error fetching customers for business:", error);
        setCustomers([]);
      }
    };
    fetchCustomers();
  }, [selectedBusiness, adminInfo?.id]);

  // Fetch sales orders
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
        ...(selectedCustomer ? { customer: selectedCustomer } : {}),
        status: selectedStatus !== "All" ? selectedStatus : "",
      };

      const response = await SalesOrderServices.getAllSalesOrders(
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
          closedOrders: 0,
          totalValue: 0,
        });
      } else {
        notifyError(
          response.data.message ||
            t("salesOrder.notifications.fetchFailed", {
              defaultValue: "Failed to fetch sales orders",
            })
        );
      }
    } catch (error) {
      console.error("Error fetching sales orders:", error);
      notifyError(
        t("salesOrder.notifications.fetchFailed", {
          defaultValue: "Failed to fetch sales orders",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesOrders();
  }, [currentPage, recordsPerPage, searchTerm, selectedBusiness, selectedCustomer, selectedStatus, businesses.length]);

  const handleDelete = (id) => {
    if (!canDelete) return;
    setSelectedOrderId(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedOrderId) return;

    try {
      const response = await SalesOrderServices.deleteSalesOrder(
        selectedOrderId,
        headers
      );

      if (response.data.success) {
        notifySuccess(
          t("salesOrder.notifications.deleted", {
            defaultValue: "{{label}} deleted successfully",
            label: saleOrderLabel,
          })
        );
        fetchSalesOrders();
      } else {
        notifyError(
          response.data.message ||
            t("salesOrder.notifications.deleteFailed", {
              defaultValue: "Failed to delete {{label}}",
              label: saleOrderLabel.toLowerCase(),
            })
        );
      }
    } catch (error) {
      console.error("Error deleting sales order:", error);
      notifyError(
        t("salesOrder.notifications.deleteFailed", {
          defaultValue: "Failed to delete {{label}}",
          label: saleOrderLabel.toLowerCase(),
        })
      );
    } finally {
      setDeleteModalOpen(false);
      setSelectedOrderId(null);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedBusiness(businesses.length === 1 ? businesses[0]._id : "");
    setSelectedCustomer("");
    setSelectedStatus("All");
    setCurrentPage(1);
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
            label: t("common.business", { defaultValue: "Business" }),
            value: selectedBusiness,
            onChange: (value) => {
              setSelectedBusiness(value);
              setSelectedCustomer("");
              setCurrentPage(1);
            },
            options: businesses.map((b) => ({
              value: b._id,
              label: b.name,
            })),
            placeholder: t("salesOrder.placeholders.selectBusiness", {
              defaultValue: "Select Business",
            }),
            icon: Building,
          },
        ]
      : []),
    {
      label: t("common.customer", { defaultValue: "Customer" }),
      value: selectedCustomer,
      onChange: (value) => {
        setSelectedCustomer(value);
        setCurrentPage(1);
      },
      options: customers.map((c) => ({
        value: c._id,
        label:
          c.basicInformation?.customerDisplayName ??
          c.basicInformation?.companyName ??
          "—",
      })),
      placeholder: t("salesOrder.placeholders.selectCustomer", {
        defaultValue: "Select Customer",
      }),
      icon: User,
    },
    {
      label: t("common.status", { defaultValue: "Status" }),
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value);
        setCurrentPage(1);
      },
      options: [
        { value: "All", label: t("salesOrder.status.all", { defaultValue: "All Statuses" }) },
        { value: "Draft", label: t("salesOrder.status.draft", { defaultValue: "Draft" }) },
        { value: "Confirmed", label: t("salesOrder.status.confirmed", { defaultValue: "Confirmed" }) },
        { value: "Partially Delivered", label: t("salesOrder.status.partiallyDelivered", { defaultValue: "Partially Delivered" }) },
        { value: "Delivered", label: t("salesOrder.status.delivered", { defaultValue: "Delivered" }) },
        { value: "Closed", label: t("salesOrder.status.closed", { defaultValue: "Closed" }) },
      ],
      placeholder: t("salesOrder.placeholders.selectStatus", {
        defaultValue: "Select Status",
      }),
      icon: Package,
    },
  ];

  const summaryCardsData = [
    {
      title: t("salesOrder.summary.totalOrders", {
        defaultValue: "Total {{label}}",
        label: saleOrderLabelPlural,
      }),
      value: overallStats.totalSalesOrders || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: t("salesOrder.summary.confirmedOrders", {
        defaultValue: "Confirmed Orders",
      }),
      value: overallStats.confirmedOrders || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: t("salesOrder.summary.draftOrders", { defaultValue: "Draft Orders" }),
      value: overallStats.draftOrders || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: t("salesOrder.summary.totalValue", { defaultValue: "Total Value" }),
      value: `${formatAmount(overallStats.totalValue || 0)}`,
      backgroundColor: "completed-light",
      iconColor: "overdue-dark",
      Icon: DollarSvg,
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <StandardPageHeader
          title={saleOrderLabelPlural}
          subtitle={t("salesOrder.list.subtitle", {
            defaultValue: "Manage and track all {{label}}",
            label: saleOrderLabelPlural.toLowerCase(),
          })}
          actions={
            canAdd ? (
              <button
                onClick={() => history.push(getModuleRoutePath("saleOrder", "create"))}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
              >
                <Plus size={20} />
                {t("salesOrder.actions.create", {
                  defaultValue: "Create {{label}}",
                  label: saleOrderLabel,
                })}
              </button>
            ) : null
          }
        />

        {/* Stats Cards */}
        <SummaryCards cards={summaryCardsData} columnsCount={4} />

        <DataTable
          title=""
          headersWithoutCellTooltip={[totalAmountHeader]}
          colWidths={{
            [saleOrderNumberHeader]: "160px",
            [customerNameHeader]: "260px",
            [dateHeader]: "170px",
            [shipmentDateHeader]: "220px",
            [totalAmountHeader]: "180px",
            [statusHeader]: "150px",
            [invoiceStatusHeader]: "170px",
            [paymentStatusHeader]: "170px",
            [actionsHeader]: "160px",
          }}
          headers={[
            saleOrderNumberHeader,
            customerNameHeader,
            dateHeader,
            shipmentDateHeader,
            totalAmountHeader,
            statusHeader,
            invoiceStatusHeader,
            paymentStatusHeader,
            actionsHeader,
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
          searchPlaceholder={t("salesOrder.placeholders.search", {
            defaultValue: "Search {{label}}...",
            label: saleOrderLabelPlural.toLowerCase(),
          })}
          filters={filters}
          renderRow={(order) => (
            <>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {canOpenSalesOrder ? (
                  <button
                    type="button"
                    onClick={() =>
                      history.push(
                        getModuleRoutePath("saleOrder", "view", { id: order._id })
                      )
                    }
                    className="text-[var(--p-blue)] hover:underline"
                  >
                    {order.salesOrderNumber || order.soNumber || "-"}
                  </button>
                ) : (
                  order.salesOrderNumber || order.soNumber || "-"
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {/* Prefer the customer's chosen display name (matches the Customer filter dropdown); fall back to company name only when no display name is set. */}
                {order.customer?.basicInformation?.customerDisplayName ||
                  order.customer?.basicInformation?.customerName ||
                  order.customer?.basicInformation?.companyName ||
                  (typeof order.customer === "string"
                    ? t("common.loading", { defaultValue: "Loading..." })
                    : order.customerName) ||
                  "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatDate(order.salesOrderDate || order.date)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatDate(order.expectedShipmentDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {order.currency
                ? formatCurrencyAmount(order.currency, order.total || 0)
                : formatAmount(order.total || 0)}

              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={order.status} t={t} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <InvoiceStatusBadge status={order.invoiceStatus} t={t} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <PaymentStatusBadge status={order.paymentStatus} t={t} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center space-x-2">
                  {(canView || canViewDetails) && (
                    <button
                      onClick={() =>
                        history.push(
                          getModuleRoutePath("saleOrder", "view", { id: order._id })
                        )
                      }
                      className="text-blue-600 hover:text-blue-900"
                      title={t("common.view", { defaultValue: "View" })}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                  {order.paymentStatus !== "Paid" &&
                    order.paymentStatus !== "Partially Paid" &&
                    String(order.status || "").toLowerCase() !== "closed" &&
                    canUpdate && (
                      <button
                        onClick={() =>
                          history.push(
                            getModuleRoutePath("saleOrder", "edit", { id: order._id })
                          )
                        }
                        className="text-green-600 hover:text-green-900"
                        title={t("common.edit", { defaultValue: "Edit" })}
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(order._id)}
                      className="text-red-600 hover:text-red-900"
                      title={t("common.delete", { defaultValue: "Delete" })}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
        />

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t("salesOrder.delete.title", {
                  defaultValue: "Delete {{label}}",
                  label: saleOrderLabel,
                })}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {t("salesOrder.delete.confirmation", {
                  defaultValue:
                    "Are you sure you want to delete this {{label}}? This action cannot be undone.",
                  label: saleOrderLabel.toLowerCase(),
                })}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedOrderId(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t("common.delete", { defaultValue: "Delete" })}
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
  );
}
