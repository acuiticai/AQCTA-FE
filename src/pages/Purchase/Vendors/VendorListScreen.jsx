import React, { useState, useEffect, useContext, useMemo } from "react";
import axios from "axios";
import { FiEye, FiKey, FiCopy, FiCheck, FiTrash2 } from "react-icons/fi";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import Dropdown from "@/components/Dropdown";
import addMoreButton from "../../../assets/img/icons/moreIcon.svg";
import { notifyError, notifySuccess } from "@/utils/toast";
import SearchBar from "@/components/SearchBar";
import { AdminContext } from "@/context/AdminContext";
import Table from "@/components/Table";
import { useHistory } from "react-router-dom";
import StyledLabel2 from "@/components/StyledLabel2";
import useButtonColor from "@/hooks/useButtonColor";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@windmill/react-ui";
import {
  DataTable,
  Button as LayoutButton,
  ToggleSwitch,
  CustomModal,
  SummaryCards,
} from "@/page-layouts/index";
import { groupVendorsByEmail } from "@/utils/groupByEntity";
import { Tooltip } from "react-tooltip";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import SummarySvg from "@/assets/img/summary.svg";
import DelayedSvg from "@/assets/img/delayed.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const VendorListScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const buttonColor = useButtonColor();
  const routePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canView, canViewDetails, canDelete } = routePerms;
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [TotalRecords, setTotalRecords] = useState(0);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedVendorCategory, setSelectedVendorCategory] = useState("");
  const [selectedVendorType, setSelectedVendorType] = useState("");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [vendorToUpdateStatus, setVendorToUpdateStatus] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [generatedCredential, setGeneratedCredential] = useState(null);
  const [copiedCredential, setCopiedCredential] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [overallStats, setOverallStats] = useState({
    totalVendors: 0,
    activeVendors: 0,
    inactiveVendors: 0,
    companyVendors: 0,
  });

  const headers = [
    t("vendor.vendorName"),
    t("vendor.companyName"),
    t("vendor.workPhone"),
    t("vendor.email"),
    t("vendor.type"),
    t("vendor.category"),
    t("vendor.businesses"),
    t("vendor.status"),
    t("vendor.action"),
  ];


  const handleViewVendor = (vendorId) => {
    if (!(canView || canViewDetails || canUpdate)) return;
    history.push(`/Edit Vendor/${vendorId}`);
  };

  const openDeleteVendor = (vendor) => {
    if (!canDelete) return;
    setVendorToDelete(vendor);
    setDeleteModalOpen(true);
  };

  const closeDeleteVendorModal = () => {
    setDeleteModalOpen(false);
    setVendorToDelete(null);
  };

  const confirmDeleteVendor = async () => {
    if (!vendorToDelete?._id || !canDelete) return;
    const token = adminInfo?.token;
    try {
      setDeleteLoading(true);
      await axios.delete(`${Base_URL}/vendors/${vendorToDelete._id}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      notifySuccess(t("vendor.deletedSuccess"));
      closeDeleteVendorModal();
      fetchVendors();
    } catch (error) {
      console.error(error);
      notifyError(
        error?.response?.data?.message || error?.response?.data?.error || t("vendor.deleteFailed")
      );
    } finally {
      setDeleteLoading(false);
    }
  };
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      const parsedBusinesses = JSON.parse(storedBusinesses);
      setBusinesses(parsedBusinesses);
    }
    fetchVendors();
  }, [selectedBusiness, currentPage, recordsPerPage, searchTerm, selectedVendorCategory, selectedVendorType]);


  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always fallback to empty array if nothing is found
      const storedBusinesses = localStorage.getItem("businesses");
      const parsedBusinesses = storedBusinesses ? JSON.parse(storedBusinesses) : [];
      setBusinesses(parsedBusinesses);

      // Create a flat array of business IDs
      // If business is deselected (empty string or null), fetch from all businesses
      const businessIdArr =
        !selectedBusiness || selectedBusiness === ""
          ? (parsedBusinesses.length > 0 ? parsedBusinesses.map(b => b._id) : [])
          : [selectedBusiness];

      // Build query parameters
      const params = new URLSearchParams();
      // Only add businessId if we have businesses to filter
      if (businessIdArr.length > 0) {
        params.append("businessId", JSON.stringify(businessIdArr));
      } else {
        // If no businesses available, return empty results
        setFilteredVendors([]);
        setTotalPages(1);
        setTotalRecords(0);
        setLoading(false);
        return;
      }
      if (selectedVendorCategory) {
        params.append("vendorCategory", selectedVendorCategory);
      }
      if (selectedVendorType) {
        params.append("vendorType", selectedVendorType);
      }

      const isMultipleBusinesses = businessIdArr.length > 1;
      if (isMultipleBusinesses) {
        params.append("page", 1);
        params.append("limit", 9999);
      } else {
        params.append("page", currentPage);
        params.append("limit", recordsPerPage);
      }
      params.append("search", searchTerm || "");

      const response = await axios.get(`${Base_URL}/vendors/paginated?${params.toString()}`);

      let vendorsData = response.data?.vendors || [];
      let total = response.data?.totalPages || 1;
      let totalRecords = response.data?.totalRecords || 0;

      if (isMultipleBusinesses && vendorsData.length > 0) {
        const grouped = groupVendorsByEmail(vendorsData, parsedBusinesses);
        totalRecords = grouped.length;
        total = Math.ceil(grouped.length / recordsPerPage) || 1;
        const start = (currentPage - 1) * recordsPerPage;
        vendorsData = grouped.slice(start, start + recordsPerPage);
      }

      setFilteredVendors(vendorsData);
      setTotalPages(total);
      setTotalRecords(totalRecords);

      const fromApi = response.data?.overallStats;
      if (fromApi && typeof fromApi === "object") {
        setOverallStats({
          totalVendors: totalRecords,
          activeVendors: Number(fromApi.activeVendors) || 0,
          inactiveVendors: Number(fromApi.inactiveVendors) || 0,
          companyVendors: Number(fromApi.companyVendors) || 0,
        });
      } else {
        setOverallStats({
          totalVendors: totalRecords || 0,
          activeVendors: 0,
          inactiveVendors: 0,
          companyVendors: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
      setError(t("vendor.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };





  const handleSearch = (value) => {
    setSearchTerm(value || "");
    setCurrentPage(1); // reset to first page on search
    // fetchVendors will be called automatically via useEffect
  };


  const handleStatusClick = (vendor) => {
    setVendorToUpdateStatus(vendor);
    setNewStatus(vendor.status === "Active" ? "Inactive" : "Active");
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setVendorToUpdateStatus(null);
    setNewStatus("");
  };

  const updateStatus = async () => {
    if (!vendorToUpdateStatus || !newStatus) return;
    if (!canUpdate) return;

    try {
      setLoading(true);
      const response = await axios.put(
        `${Base_URL}/vendors/status/${vendorToUpdateStatus._id}`
      );

      if (response.status === 200) {
        notifySuccess(t("vendor.statusUpdated", { from: vendorToUpdateStatus.status, to: newStatus }));
        closeStatusModal();
        // Refetch data to reflect the toggle change
        fetchVendors();
      } else {
        notifyError(t("vendor.statusUpdateFailed"));
      }
    } catch (error) {
      console.error("Error updating vendor status:", error);
      notifyError(t("vendor.statusUpdateFailed"));
    } finally {
      setLoading(false);
    }
  };
  const clearAllFilters = () => {
    setSelectedBusiness("");
    setSearchTerm("");
    setSelectedVendorCategory("");
    setSelectedVendorType("");
    setCurrentPage(1);
    // fetchVendors will be called automatically via useEffect
  };

  const handleSendCredential = async (vendor) => {
    if (!canUpdate) return;
    try {
      setLoading(true);
      const response = await axios.post(
        `${Base_URL}/vendors/${vendor._id}/send-rider-credential`
      );

      const payload = response?.data?.data;
      if (!payload?.username || !payload?.password) {
        notifyError(t("vendor.credential.incompleteResponse"));
        return;
      }

      setGeneratedCredential({
        vendorName:
          vendor.basicInformation?.vendorDisplayName ||
          vendor.basicInformation?.companyName ||
          "Vendor",
        username: payload.username,
        password: payload.password,
        maxActiveSlots: payload.maxActiveSlots,
      });
      setCredentialModalOpen(true);
      notifySuccess(t("vendor.credential.generatedSuccess"));
    } catch (error) {
      notifyError(error?.response?.data?.message || t("vendor.credential.generateFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredential = async () => {
    if (!generatedCredential) return;
    const credentialText = [
      `Vendor: ${generatedCredential.vendorName || ""}`,
      `Username: ${generatedCredential.username || ""}`,
      `Password: ${generatedCredential.password || ""}`,
      `Max Active Slots: ${generatedCredential.maxActiveSlots ?? ""}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(credentialText);
      notifySuccess(t("vendor.credential.credentialCopied"));
      setCopiedCredential(true);
      setTimeout(() => setCopiedCredential(false), 1800);
    } catch (error) {
      notifyError(t("vendor.credential.copyFailed"));
    }
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
        adminId: adminInfo.id,
        selectedBusiness,
        onChange: (value) => {
          setSelectedBusiness(value);
          setCurrentPage(1);
        },
      },
    },
    {
      options: [
        { value: "", label: t("vendor.allCategories") },
        { value: "Internal", label: t("vendor.internal") },
        { value: "External", label: t("vendor.external") },
      ],
      value: selectedVendorCategory,
      onChange: (value) => {
        setSelectedVendorCategory(value);
        setCurrentPage(1);
      },
      placeholder: t("vendor.vendorCategory"),
      isClearable: true
    },
    {
      options: [
        { value: "", label: t("vendor.allTypes") },
        { value: "Individual", label: t("vendor.individual") },
        { value: "Company", label: t("vendor.company") },
      ],
      value: selectedVendorType,
      onChange: (value) => {
        setSelectedVendorType(value);
        setCurrentPage(1);
      },
      placeholder: t("vendor.type"),
      isClearable: true
    },
  ];

  const summaryCardsData = useMemo(
    () => [
      {
        title: t("vendor.totalVendors"),
        value: overallStats.totalVendors || TotalRecords || 0,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: t("vendor.active"),
        value: overallStats.activeVendors || 0,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: t("vendor.inactive"),
        value: overallStats.inactiveVendors || 0,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: InProgressSvg,
      },
      {
        title: t("vendor.companies"),
        value: overallStats.companyVendors || 0,
        backgroundColor: "completed-light",
        iconColor: "overdue-dark",
        Icon: DelayedSvg,
      },
    ],
    [overallStats, TotalRecords, t],
  );

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t("vendor.title")}</h1>
              <p className="text-gray-600 mt-2">{t("vendor.manageSubtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4">
              {canAdd && (
                <button
                  type="button"
                  onClick={() => history.push("/New Vendor")}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  {t("vendor.addNew")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 w-full max-w-full min-w-0 overflow-x-hidden">
          <SummaryCards cards={summaryCardsData} columnsCount={4} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
      <DataTable
        //for filters
        onSearch={handleSearch}
        searchValue={searchTerm}
        searchPlaceholder={t("Search", { defaultValue: "Search" })}
        filters={filters}
        //for table
        headers={headers}
        data={filteredVendors}
        totalRecords={TotalRecords}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={(page) => {
          setCurrentPage(page);
          // fetchVendors will be called automatically via useEffect
        }}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          setCurrentPage(1);
          // fetchVendors will be called automatically via useEffect
        }}
        renderRow={(vendor) => (
          <tr key={vendor._id} className="border-b">
            <td className="py-2 px-4">
              {vendor.basicInformation?.vendorDisplayName ||
                vendor.basicInformation?.companyName ||
                "-"}
            </td>
            <td className="py-2 px-4">
              {vendor.basicInformation?.companyName}
            </td>
            <td className="py-2 px-4">
              {vendor.basicInformation?.vendorPhone?.workPhone}
            </td>
            <td className="py-2 px-4">
              {vendor.basicInformation?.vendorEmail}
            </td>
            <td className="py-2 px-4">
              {vendor.basicInformation?.vendorType}
            </td>
            <td className="py-2 px-4">
              <span
                className={`px-2 py-1 rounded-full text-white text-sm ${vendor.basicInformation?.vendorCategory === "Internal"
                  ? "bg-blue-500"
                  : "bg-green-500"
                  }`}
              >
                {vendor.basicInformation?.vendorCategory || "N/A"}
              </span>
            </td>
            <td className="py-2 px-4">
              {(() => {
                // When a business filter is selected, show only that business (same as group-by-email)
                const filterBusinessName = selectedBusiness
                  ? (businesses.find((b) => (b._id || b.id)?.toString() === String(selectedBusiness))?.name)
                  : null;
                if (selectedBusiness) return filterBusinessName || vendor?.business?.name || "-";
                return vendor.businessesDisplay ?? (() => {
                  const names = new Set();
                  const primary = vendor?.business?.name;
                  if (primary) names.add(primary);
                  if (Array.isArray(vendor.businesses)) {
                    vendor.businesses.forEach((b) => {
                      const id = (b?._id || b)?.toString();
                      const found = businesses.find((x) => (x._id || x.id)?.toString() === id);
                      if (found?.name) names.add(found.name);
                    });
                  }
                  return Array.from(names).filter(Boolean).join(", ") || "-";
                })();
              })()}
            </td>
            <td className="py-2 px-4">
              <ToggleSwitch
                isOn={vendor.status === "Active"}
                handleToggle={() => handleStatusClick(vendor)}
                disabled={loading || !canUpdate}
              />
            </td>
            <td className="py-2 px-4" style={{ width: "fit-content" }}>
              <div className="flex items-center gap-1 flex-wrap">
                {(canView || canViewDetails || canUpdate) && (
                  <button
                    type="button"
                    className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => handleViewVendor(vendor._id)}
                    title={t("common.view") || "View"}
                  >
                    <FiEye size={14} />
                  </button>
                )}
                {/*
                {canUpdate && (
                  <button
                    type="button"
                    className="p-1.5 text-gray-500 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => handleSendCredential(vendor)}
                    title="Send Credential"
                  >
                    <FiKey size={14} />
                  </button>
                )}
                */}
                {canDelete && (
                  <button
                    type="button"
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => openDeleteVendor(vendor)}
                    title={t("common.delete") || "Delete"}
                  >
                    <FiTrash2 size={14} />
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      />
        </div>

      {/* Status Update Modal */}
      <CustomModal
        open={statusModalOpen}
        onClose={closeStatusModal}
        title={t("vendor.updateVendorStatus")}
        width="500px"
        showActions={true}
        actions={[
          {
            label: t("common.cancel", { defaultValue: "Cancel" }),
            secondary: true,
            onClick: closeStatusModal,
          },
          {
            label: loading ? t("vendor.updating") : t("vendor.updateStatus"),
            primary: true,
            onClick: updateStatus,
            disabled: loading || !newStatus,
          },
        ]}
      >
        {vendorToUpdateStatus && (
          <div className="space-y-4">
            <div className="mb-4">
              <p className="text-base text-gray-700 font-medium">
                {t("vendor.areYouSureChangeStatus")}
              </p>
            </div>
          </div>
        )}
      </CustomModal>

      <CustomModal
        open={credentialModalOpen}
        onClose={() => {
          setCredentialModalOpen(false);
          setCopiedCredential(false);
        }}
        title={t("vendor.credential.title")}
        width="380px"
        showActions={true}
        actions={[
          {
            label: t("common.close"),
            secondary: true,
            onClick: () => {
              setCredentialModalOpen(false);
              setCopiedCredential(false);
            },
          },
        ]}
      >
        {generatedCredential ? (
          <div className="space-y-2 text-sm relative">
            <div className="flex justify-end absolute top-0 right-0">
              <button
                type="button"
                data-tooltip-id="copy-credential-tooltip-list"
                data-tooltip-content={
                  copiedCredential ? t("vendor.credential.copied") : t("vendor.credential.copyCredentials")
                }
                onClick={handleCopyCredential}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
                  copiedCredential
                    ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                    : "text-gray-600 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {copiedCredential ? <FiCheck /> : <FiCopy />}
              </button>
              <Tooltip
                id="copy-credential-tooltip-list"
                place="top"
                delayShow={150}
                noArrow
                className="!bg-white !text-gray-800 !border !border-gray-300 !opacity-100"
                style={{ zIndex: 10000 }}
              />
            </div>
            <p>
              <strong>{t("vendor.credential.vendor")}:</strong> {generatedCredential.vendorName}
            </p>
            <p>
              <strong>{t("vendor.credential.username")}:</strong> {generatedCredential.username}
            </p>
            <p>
              <strong>{t("vendor.credential.password")}:</strong> {generatedCredential.password}
            </p>
            <p>
              <strong>{t("vendor.credential.maxActiveSlots")}:</strong> {generatedCredential.maxActiveSlots}
            </p>
          </div>
        ) : null}
      </CustomModal>

      <CustomModal
        open={deleteModalOpen}
        onClose={closeDeleteVendorModal}
        title={t("vendor.deleteVendor")}
        width="440px"
        showActions
        actions={[
          { label: t("common.cancel", { defaultValue: "Cancel" }), secondary: true, onClick: closeDeleteVendorModal },
          {
            label: deleteLoading ? t("vendor.deleting") : t("common.delete"),
            failure: true,
            disabled: deleteLoading,
            onClick: confirmDeleteVendor,
          },
        ]}
      >
        {vendorToDelete && (
          <p className="text-sm text-gray-700">
            {t("vendor.confirmDeleteVendor")}
          </p>
        )}
      </CustomModal>
    </div>
    </div>
  );
};

export default VendorListScreen;
