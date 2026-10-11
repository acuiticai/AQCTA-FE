import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import useButtonColor from "@/hooks/useButtonColor";
import {
    DataTable,
    PageHeader,
    ActionButtons,
    ToggleSwitch,
    Button,
} from "@/page-layouts";
import { groupStockGroupsByCode } from "@/utils/groupByEntity";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { FiTrash2 } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const StockGroupListScreen = () => {
    const { t } = useTranslation();
    const checkTokenExpired = useCheckTokenExpired();
    const buttonColor = useButtonColor();
    const routePerms = useRouteModulePermissions();
    const {
        canAdd,
        canUpdate,
        canDelete,
        canView,
        canViewDetails,
    } = routePerms;
    const [filteredStockGroups, setFilteredStockGroups] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [businessesLoading, setBusinessesLoading] = useState(true);
    const [selectedBusiness, setSelectedBusiness] = useState("");
    const [totalResults, setTotalResults] = useState(0);
    // Match DataTable's stored table_entries_per_page so first fetch uses correct limit (avoids flash of 10 then 5)
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [selectedStockGroup, setSelectedStockGroup] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [stockGroupToUpdateStatus, setStockGroupToUpdateStatus] = useState(null);
    const [statusFilter, setStatusFilter] = useState("All");

    // For delete modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [stockGroupToDelete, setStockGroupToDelete] = useState(null);

    const currentPageRef = useRef(1);
    const history = useHistory();

    const headers = [
        t("stock.group.code"),
        t("stock.group.description"),
        "Businesses",
        t("stock.group.salesCode"),
        t("stock.group.cashSalesCode"),
        t("stock.group.salesReturnCode"),
        t("stock.group.balanceSheetStock"),
        t("stock.group.purchaseCode"),
        t("stock.group.cashPurchaseCode"),
        t("stock.group.purchaseReturnCode"),
        t("Status"),
        t("common.action"),
    ];


    const HiddenHeaders = [
        t("stock.group.cashSalesCode"),
        t("stock.group.balanceSheetStock"),
        t("stock.group.purchaseReturnCode")
    ];


    const handlePageChange = (page) => {
        setCurrentPage(page);
        currentPageRef.current = page;
        fetchStockGroups(selectedBusiness, page, recordsPerPage, searchTerm, statusFilter);
    };

    const handleAddNew = () => {
        if (!canAdd) return;
        history.push("/new-stock-group");
    };

    const handleEditStockGroup = (stockGroupId) => {
        if (!canUpdate) return;
        history.push(`/edit-stock-group/${stockGroupId}`);
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await syncAssignedBusinessesFromApi(Base_URL);
                if (cancelled) return;
                setBusinesses(list);
                setBusinessesLoading(false);
                fetchStockGroups("", 1, recordsPerPage, "", "All", list);
            } catch (err) {
                console.error("Error loading assigned businesses:", err);
                if (!cancelled) setBusinessesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchStockGroups = async (
        businessId,
        page = 1,
        limit,
        search = "",
        status = "All",
        businessesSnapshot = null
    ) => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                page: page,
                limit: limit || recordsPerPage,
            };

            const parsedBusinesses = Array.isArray(businessesSnapshot)
                ? businessesSnapshot
                : businesses;

            const isMultipleBusinesses = !businessId && parsedBusinesses.length > 1;

            if (businessId) {
                params.businessId = businessId;
            } else {
                const ids = parsedBusinesses.map((b) => b?._id).filter(Boolean);
                if (ids.length === 0) {
                    setFilteredStockGroups([]);
                    setTotalResults(0);
                    setLoading(false);
                    return;
                }
                if (ids.length === 1) {
                    params.businessId = ids[0];
                } else {
                    params.businessIds = JSON.stringify(ids);
                }
            }

            if (isMultipleBusinesses) {
                params.page = 1;
                params.limit = 9999;
            }

            if (search) {
                params.search = search;
            }

            if (status && status !== "All") {
                params.status = status;
            }

            const response = await axios.get(`${Base_URL}/stock-groups`, { params });

            let stockGroupsData = Array.isArray(response.data.stockGroups)
                ? response.data.stockGroups
                : [];
            let total = response.data.total;

            if (isMultipleBusinesses && stockGroupsData.length > 0) {
                const grouped = groupStockGroupsByCode(stockGroupsData, parsedBusinesses);
                total = grouped.length;
                const start = (page - 1) * (limit || recordsPerPage);
                stockGroupsData = grouped.slice(start, start + (limit || recordsPerPage));
            }

            setFilteredStockGroups(stockGroupsData);
            setTotalResults(total);
        } catch (err) {
            console.error("Error fetching stock groups:", err);
            notifyError(t("item.loadDataFailed"));
            setError(t("item.loadDataFailed"));
        } finally {
            setLoading(false);
        }
    };

    const handleBusinessChange = (businessId) => {
        setSelectedBusiness(businessId);
        setCurrentPage(1);
        currentPageRef.current = 1;
        fetchStockGroups(businessId, 1, recordsPerPage, searchTerm, statusFilter);
    };

    const handleSearch = (searchValue) => {
        setSearchTerm(searchValue);
        setCurrentPage(1);
        currentPageRef.current = 1;
        fetchStockGroups(selectedBusiness, 1, recordsPerPage, searchValue, statusFilter);
    };

    const handleStatusClick = (stockGroup) => {
        if (!canUpdate) return;
        setStockGroupToUpdateStatus(stockGroup);
        setStatusModalOpen(true);
    };

    const closeStatusModal = () => {
        setStatusModalOpen(false);
        setStockGroupToUpdateStatus(null);
    };

    const updateStatus = async (newStatus) => {
        try {
            setLoading(true);
            const response = await axios.put(
                `${Base_URL}/stock-groups/${stockGroupToUpdateStatus._id}/status`,
                { status: newStatus }
            );

            if (response.status === 200) {
                notifySuccess(t("common.statusUpdatedTo") + " " + (newStatus === "Active" ? t("common.active") : t("common.inactive")));
                // Refresh the data after status update
                fetchStockGroups(selectedBusiness, currentPage, recordsPerPage, searchTerm, statusFilter);
            } else {
                notifyError(t("common.statusUpdateFailed"));
            }
        } catch (error) {
            console.error("Error updating stock group status:", error);
            const errorMessage = error.response?.data?.message || t("common.statusUpdateFailed");
            notifyError(errorMessage);
        } finally {
            setLoading(false);
            closeStatusModal();
        }
    };

    const handleDeleteClick = (stockGroup) => {
        if (!canDelete) return;
        setStockGroupToDelete(stockGroup);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setDeleteModalOpen(false);
        setStockGroupToDelete(null);
    };

    const confirmDelete = async () => {
        if (!stockGroupToDelete || !canDelete) return;
        try {
            setLoading(true);
            const response = await axios.delete(
                `${Base_URL}/stock-groups/${stockGroupToDelete._id}`
            );

            if (response.status === 200) {
                notifySuccess(t("item.deletedSuccess"));
                // Remove from local state
                const updatedStockGroups = filteredStockGroups.filter(
                    (stockGroup) => stockGroup._id !== stockGroupToDelete._id
                );
                setFilteredStockGroups(updatedStockGroups);
                setTotalResults(totalResults - 1);
            } else {
                notifyError(t("item.messages.deleteFailed"));
            }
        } catch (error) {
            console.error("Error deleting stock group:", error);
            notifyError(t("item.messages.deleteFailed"));
        } finally {
            setLoading(false);
            closeDeleteModal();
        }
    };

    const handleStatusFilterChange = (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
        currentPageRef.current = 1;
        fetchStockGroups(selectedBusiness, 1, recordsPerPage, searchTerm, value);
    };

    const clearAllFilters = () => {
        setSelectedBusiness("");
        setSearchTerm("");
        setStatusFilter("All");
        setCurrentPage(1);
        currentPageRef.current = 1;
        fetchStockGroups("", 1, recordsPerPage, "", "All");
    };

    const filters = [
        {
            isClearButton: true,
            buttonProps: {
                onClick: clearAllFilters
            }
        },
        {
            isBusinessDropdown: true,
            businessDropdownProps: {
                businesses: businesses,
                selectedBusiness,
                onChange: handleBusinessChange,
            },
        },
        {
            options: [
                { value: "All", label: t("common.allStatuses") },
                { value: "Active", label: t("common.active") },
                { value: "Inactive", label: t("common.inactive") },
            ],
            value: statusFilter,
            onChange: handleStatusFilterChange,
            placeholder: t("Status"),
            isClearable: true
        },
    ];

    const totalPages = Math.ceil(totalResults / recordsPerPage);

    return (
        <RoutePermissionGate title={t("stock.group.title")}>
        <div className="p-6 min-h-screen" style={{ backgroundColor: "#FFFF" }}>
            <PageHeader
                title={t("stock.group.title")}
                onAddNew={handleAddNew}
                showAddButton={canAdd}
                addButtonText={t("Add New")}
                onMoreOptionsClick={() => { }}
            />

            <DataTable
                onSearch={handleSearch}
                searchValue={searchTerm}
                searchPlaceholder={t("Search")}
                filters={filters}
                headers={headers}
                headersToHide={HiddenHeaders}
                data={filteredStockGroups}
                totalRecords={totalResults}
                loading={loading || businessesLoading}
                currentPage={currentPage}
                totalPages={totalPages}
                recordsPerPage={recordsPerPage}
                onPageChange={handlePageChange}
                onRecordsPerPageChange={(perPage) => {
                    setRecordsPerPage(perPage);
                    currentPageRef.current = 1;
                    setCurrentPage(1);
                    fetchStockGroups(selectedBusiness, 1, perPage, searchTerm, statusFilter);
                }}
                renderRow={(stockGroup) => (
                    <tr key={stockGroup._id} className="border-b">
                        <td className="py-2 px-4">{stockGroup.stockCode}</td>
                        <td className="py-2 px-4">{stockGroup.description}</td>
                        <td className="py-2 px-4">{stockGroup.businessesDisplay ?? stockGroup.business?.name ?? "-"}</td>
                        <td className="py-2 px-4">{stockGroup.salesCode}</td>
                        <td className="py-2 px-4">{stockGroup.cashSalesCode}</td>
                        <td className="py-2 px-4">{stockGroup.salesReturnCode}</td>
                        <td className="py-2 px-4">{stockGroup.balanceSheetStock}</td>
                        <td className="py-2 px-4">{stockGroup.purchaseCode}</td>
                        <td className="py-2 px-4">{stockGroup.cashPurchaseCode}</td>
                        <td className="py-2 px-4">{stockGroup.purchaseReturnCode}</td>
                        <td className="py-2 px-4">
                            <div className="flex items-center justify-center">
                                <ToggleSwitch
                                    isOn={stockGroup.status === "Active"}
                                    handleToggle={() => handleStatusClick(stockGroup)}
                                    disabled={!canUpdate}
                                />
                            </div>
                        </td>
                        <td className="py-2 px-4" style={{ width: "fit-content" }}>
                            <ActionButtons
                                rbac={{
                                    canView,
                                    canViewDetails,
                                    canUpdate,
                                    canDelete,
                                }}
                                items={[
                                    {
                                        action: ACTION_BUTTON_TYPES.EDIT,
                                        title: t("Edit"),
                                        onClick: () => handleEditStockGroup(stockGroup._id),
                                    },
                                    {
                                        action: ACTION_BUTTON_TYPES.DELETE,
                                        title: t("Delete"),
                                        onClick: () => handleDeleteClick(stockGroup),
                                    },
                                ]}
                            />
                        </td>
                    </tr>
                )}
            />

            {/* Status Update Modal */}
            <Modal
                style={{ width: "auto", padding: "24px" }}
                isOpen={statusModalOpen}
                onClose={closeStatusModal}
            >
                <ModalHeader style={{ marginTop: 0 }}>{t("common.updateStatus")}</ModalHeader>
                <ModalBody style={{ marginBottom: "12px" }}>
                    {stockGroupToUpdateStatus && (
                        <div className="flex gap-4 py-2 items-center">
                            <p>
                                {t("common.updateStatus")}{" "}
                                <span className="font-semibold">
                                    {stockGroupToUpdateStatus.stockCode}
                                </span>
                                ?
                            </p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter style={{ padding: "12px 24px" }}>
                    <Button onClick={closeStatusModal} secondary>
                        {t("Cancel")}
                    </Button>
                    {stockGroupToUpdateStatus && (
                        <Button
                            gray={stockGroupToUpdateStatus.status === "Active"}
                            onClick={() =>
                                updateStatus(
                                    stockGroupToUpdateStatus.status === "Active"
                                        ? "Inactive"
                                        : "Active"
                                )
                            }
                        >
                            {stockGroupToUpdateStatus.status === "Active" ? t("common.inactive") : t("common.active")}
                        </Button>
                    )}
                </ModalFooter>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                style={{ width: "auto", padding: "24px" }}
                isOpen={deleteModalOpen}
                onClose={closeDeleteModal}
            >
                <ModalHeader style={{ marginTop: 0 }}>{t("Are you sure?")}</ModalHeader>
                <ModalBody style={{ marginBottom: "12px" }}>
                    {stockGroupToDelete && (
                        <div className="flex gap-4 py-2 items-center">
                            <FiTrash2 className="text-red-500" size={24} />
                            <p>
                                {t("Are you sure?")}{" "}
                                <span className="font-semibold">
                                    {stockGroupToDelete.stockCode}
                                </span>
                                ? {t("item.deleteConfirmFull")}
                            </p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter style={{ padding: "12px 24px" }}>
                    <Button onClick={closeDeleteModal} secondary>
                        {t("Cancel")}
                    </Button>
                    <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
                        {t("Delete")}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
        </RoutePermissionGate>
    );
};

export default StockGroupListScreen;
