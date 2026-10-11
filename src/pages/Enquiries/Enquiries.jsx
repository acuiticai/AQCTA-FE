import React, { useState, useEffect, useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { Building, FileText, Inbox } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  SummaryCards,
  CustomModal,
  DropdownBasic,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import EnquiryServices, {
  ENQUIRING_FOR_OPTIONS,
  ENQUIRY_CHANNEL_OPTIONS,
  ENQUIRY_STATUS_OPTIONS,
} from "@/services/EnquiryServices";
import {
  customerLabel,
  enquiryToApplicationFormSeed,
  mergeApplicationSeeds,
  nCustomerToProfile,
  profileSeed,
} from "@/utils/applicationProfileSeed";
import { typeFromEnquiringFor } from "@/customer/config/applicationTypes";
import axios from "axios";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_STYLES = {
  Open: "bg-blue-100 text-blue-800",
  Converted: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-800",
  Spam: "bg-red-100 text-red-800",
};

const Enquiries = () => {
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const routePerms = useRouteModulePermissions();
  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token]
  );

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [enquiringForFilter, setEnquiringForFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    Open: 0,
    Converted: 0,
    Closed: 0,
    Spam: 0,
  });
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [statusChangeRow, setStatusChangeRow] = useState(null);
  const [statusChangeValue, setStatusChangeValue] = useState("");
  const [creatingCustomerId, setCreatingCustomerId] = useState(null);
  const [createCustomerModalOpen, setCreateCustomerModalOpen] = useState(false);
  const [enquiryToConvert, setEnquiryToConvert] = useState(null);
  const [convertingToAppId, setConvertingToAppId] = useState(null);
  const [convertAppModalOpen, setConvertAppModalOpen] = useState(false);
  const [enquiryToApplication, setEnquiryToApplication] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [enquiryToDelete, setEnquiryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const headers = [
    "Enquiry #",
    "Name",
    "Company",
    "Email",
    "Phone",
    "Enquiring For",
    "Channel",
    "Status",
    "Submitted",
    "Actions",
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      if (list.length === 1) {
        setBusinessFilter(list[0]._id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchEnquiries = async () => {
    if (!adminInfo?.token || businesses.length === 0) {
      setLoading(false);
      setEnquiries([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        enquiringFor:
          enquiringForFilter !== "all" ? enquiringForFilter : undefined,
        enquiryChannel: channelFilter !== "all" ? channelFilter : undefined,
        search: searchTerm || undefined,
      };

      if (businessFilter) {
        params.business_id = businessFilter;
      } else {
        params.business_ids = businesses.map((b) => b._id).join(",");
      }

      const response = await EnquiryServices.getAllEnquiries(params, {
        headers: authHeaders,
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;

      if (response.data?.status) {
        setEnquiries(response.data.data || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
        if (response.data.stats) {
          setStats((prev) => ({ ...prev, ...response.data.stats }));
        }
      } else {
        notifyError(response.data?.message || "Failed to load enquiries");
      }
    } catch (error) {
      console.error("Error fetching enquiries:", error);
      notifyError(
        error?.response?.data?.message || "Failed to load enquiries"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminInfo?.token || businesses.length === 0) return;
    fetchEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessFilter,
    adminInfo?.token,
    currentPage,
    statusFilter,
    enquiringForFilter,
    channelFilter,
    recordsPerPage,
    businesses.length,
  ]);

  useEffect(() => {
    if (!adminInfo?.token || businesses.length === 0) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchEnquiries();
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const openDeleteModal = (row) => {
    setEnquiryToDelete(row);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setEnquiryToDelete(null);
  };

  const confirmDeleteEnquiry = async () => {
    if (!enquiryToDelete?._id) return;
    try {
      setDeleteLoading(true);
      const response = await EnquiryServices.deleteEnquiry(enquiryToDelete._id, {
        headers: authHeaders,
        withCredentials: true,
        data: { user_id: adminInfo?.id || adminInfo?._id },
      });
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess("Enquiry deleted successfully");
        setDeleteModalOpen(false);
        setEnquiryToDelete(null);
        fetchEnquiries();
      } else {
        notifyError(response.data?.message || "Failed to delete enquiry");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to delete enquiry"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusOptionsForRow = (row) => {
    if (row?.status === "Converted") {
      return ENQUIRY_STATUS_OPTIONS.filter((s) => s !== "Open");
    }
    return ENQUIRY_STATUS_OPTIONS;
  };

  const openStatusChangeModal = (row) => {
    setStatusChangeRow(row);
    setStatusChangeValue(row?.status || "Open");
  };

  const closeStatusChangeModal = () => {
    if (statusUpdatingId) return;
    setStatusChangeRow(null);
    setStatusChangeValue("");
  };

  const handleStatusChange = async (id, status, currentStatus) => {
    if (currentStatus === "Converted" && status === "Open") {
      notifyError("Converted enquiries cannot be changed back to Open");
      return;
    }
    if (status === currentStatus) return;
    try {
      setStatusUpdatingId(id);
      const response = await EnquiryServices.updateEnquiryStatus(id, status, {
        headers: authHeaders,
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        notifySuccess("Status updated");
        fetchEnquiries();
      } else {
        notifyError(response.data?.message || "Failed to update status");
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to update status"
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const confirmStatusChange = () => {
    if (!statusChangeRow) return;
    const next = statusChangeValue || statusChangeRow.status || "Open";
    if (next === (statusChangeRow.status || "Open")) {
      closeStatusChangeModal();
      return;
    }
    const row = statusChangeRow;
    setStatusChangeRow(null);
    setStatusChangeValue("");
    handleStatusChange(row._id, next, row.status);
  };

  const openCreateCustomerModal = (row) => {
    if (!row?._id) return;
    if (row.status !== "Open") {
      notifyError("Only Open enquiries can be converted to a customer.");
      return;
    }
    if (row.customerId) {
      notifyError("A customer has already been created from this enquiry.");
      return;
    }
    setEnquiryToConvert(row);
    setCreateCustomerModalOpen(true);
  };

  const closeCreateCustomerModal = () => {
    if (creatingCustomerId) return;
    setCreateCustomerModalOpen(false);
    setEnquiryToConvert(null);
  };

  const confirmCreateCustomer = async () => {
    if (!enquiryToConvert?._id) return;

    try {
      setCreatingCustomerId(enquiryToConvert._id);
      const response = await EnquiryServices.createCustomerFromEnquiry(
        enquiryToConvert._id,
        {
          headers: authHeaders,
          withCredentials: true,
        }
      );
      if (checkTokenExpired(response)) return;
      if (response.data?.status) {
        const customerId = response.data?.data?.customerId;
        notifySuccess(
          response.data?.message ||
            "Customer created. Portal password emailed to the customer."
        );
        setCreateCustomerModalOpen(false);
        setEnquiryToConvert(null);
        fetchEnquiries();
        if (customerId) {
          history.push(`/Edit Customer/${customerId}`);
        }
      } else {
        notifyError(
          response.data?.message || "Failed to create customer from enquiry"
        );
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message ||
          "Failed to create customer from enquiry"
      );
    } finally {
      setCreatingCustomerId(null);
    }
  };

  const openConvertToApplicationModal = (row) => {
    if (!row?._id) return;
    if (row.status === "Spam" || row.status === "Closed") {
      notifyError(
        "Spam or Closed enquiries cannot be converted to an application."
      );
      return;
    }
    setEnquiryToApplication(row);
    setConvertAppModalOpen(true);
  };

  const closeConvertToApplicationModal = () => {
    if (convertingToAppId) return;
    setConvertAppModalOpen(false);
    setEnquiryToApplication(null);
  };

  const confirmConvertToApplication = async () => {
    if (!enquiryToApplication?._id) return;

    try {
      setConvertingToAppId(enquiryToApplication._id);

      const ensureRes = await EnquiryServices.ensureCustomerForApplication(
        enquiryToApplication._id,
        {
          headers: authHeaders,
          withCredentials: true,
        }
      );
      if (checkTokenExpired(ensureRes)) return;
      if (!ensureRes.data?.status) {
        notifyError(
          ensureRes.data?.message ||
            "Failed to prepare customer for application"
        );
        return;
      }

      const customerId = ensureRes.data?.data?.customerId;
      const businessId =
        ensureRes.data?.data?.businessId ||
        enquiryToApplication.business_id;
      if (!customerId || !businessId) {
        notifyError("Customer or business missing for this enquiry.");
        return;
      }

      let enquiryFull = enquiryToApplication;
      try {
        const enquiryRes = await EnquiryServices.getEnquiryById(
          enquiryToApplication._id,
          { headers: authHeaders, withCredentials: true }
        );
        if (enquiryRes.data?.status && enquiryRes.data?.data) {
          enquiryFull = enquiryRes.data.data;
        }
      } catch {
        /* use list row */
      }

      const customerRes = await axios.get(`${Base_URL}/customers/${customerId}`, {
        headers: authHeaders,
      });
      const customer = customerRes.data?.data || customerRes.data;
      if (!customer?._id) {
        notifyError("Customer not found");
        return;
      }

      const type = typeFromEnquiringFor(enquiryFull.enquiringFor);
      const seed = mergeApplicationSeeds(
        profileSeed(nCustomerToProfile(customer), {}),
        enquiryToApplicationFormSeed(enquiryFull)
      );

      if (ensureRes.data?.data?.customerCreated) {
        notifySuccess(
          "Customer created. Opening application form with enquiry details."
        );
      } else {
        notifySuccess("Opening application form with enquiry details.");
      }

      setConvertAppModalOpen(false);
      setEnquiryToApplication(null);
      fetchEnquiries();

      history.push(`/applications/${type}/new`, {
        mode: "admin",
        customerId: String(customer._id),
        businessId: String(businessId),
        profileSeed: seed,
        customerLabel: customerLabel(customer),
        enquiryId: String(enquiryToApplication._id),
      });
    } catch (error) {
      notifyError(
        error?.response?.data?.message ||
          "Failed to convert enquiry to application"
      );
    } finally {
      setConvertingToAppId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status || "-"}
    </span>
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setEnquiringForFilter("all");
    setChannelFilter("all");
    setBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: { onClick: clearAllFilters },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Business",
            value: businessFilter,
            onChange: (value) => {
              setBusinessFilter(value);
              setCurrentPage(1);
            },
            options: [
              ...(businesses.length > 1
                ? [{ value: "", label: "All Businesses" }]
                : []),
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
            placeholder:
              businesses.length > 1 ? "All Businesses" : "Select Business",
            icon: Building,
          },
        ]
      : []),
    {
      label: "Status",
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Status" },
        ...ENQUIRY_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Status",
      icon: FileText,
    },
    {
      label: "Enquiring For",
      value: enquiringForFilter,
      onChange: (value) => {
        setEnquiringForFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Types" },
        ...ENQUIRING_FOR_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Type",
      icon: Inbox,
    },
    {
      label: "Channel",
      value: channelFilter,
      onChange: (value) => {
        setChannelFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Channels" },
        ...ENQUIRY_CHANNEL_OPTIONS.map((s) => ({ value: s, label: s })),
      ],
      placeholder: "Select Channel",
      icon: FileText,
    },
  ];

  const summaryCardsData = [
    {
      title: "Total Enquiries",
      value: stats.total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Open",
      value: stats.Open || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Converted",
      value: stats.Converted || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Closed",
      value: stats.Closed || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Enquiry</h1>
                <p className="text-gray-600 mt-2">
                  Manage customer and admin enquiries for Inspection and
                  Certification.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                {routePerms.canAdd && (
                  <button
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                    onClick={() => history.push("/enquiries/create")}
                  >
                    Add Enquiry
                  </button>
                )}
              </div>
            </div>
          </div>

          <SummaryCards cards={summaryCardsData} columnsCount={4} />

          <DataTable
            onSearch={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            searchValue={searchTerm}
            searchPlaceholder="Search by name, email, company, enquiry #..."
            filters={filters}
            headers={headers}
            headersToHide={[]}
            data={enquiries}
            totalRecords={total}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            recordsPerPage={recordsPerPage}
            onPageChange={setCurrentPage}
            onRecordsPerPageChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
            renderRow={(row) => (
              <tr key={row._id} className="border-b">
                <td className="py-2 px-4 whitespace-nowrap">
                  {routePerms.canViewDetails && row._id ? (
                    <button
                      type="button"
                      className="text-[var(--p-blue)] hover:underline font-medium text-left"
                      onClick={() =>
                        history.push(`/enquiries/view/${row._id}`)
                      }
                    >
                      {row.enquiryNumber || "-"}
                    </button>
                  ) : (
                    row.enquiryNumber || "-"
                  )}
                </td>
                <td className="py-2 px-4">{row.name || "-"}</td>
                <td className="py-2 px-4">{row.companyName || "-"}</td>
                <td className="py-2 px-4">{row.email || "-"}</td>
                <td className="py-2 px-4 whitespace-nowrap">{row.phone || "-"}</td>
                <td className="py-2 px-4">{row.enquiringFor || "-"}</td>
                <td className="py-2 px-4">{row.enquiryChannel || "-"}</td>
                <td className="py-2 px-4 whitespace-nowrap">
                  {getStatusBadge(row.status)}
                </td>
                <td className="py-2 px-4 whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
                <td className="py-2 px-4" style={{ width: "fit-content" }}>
                  <ActionButtons
                    maxVisibleActions={2}
                    items={[
                      ...(routePerms.canUpdate
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.EDIT,
                              title: "Edit",
                              onClick: () =>
                                history.push(`/enquiries/edit/${row._id}`),
                            },
                            {
                              action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                              title: "Change Status",
                              loading: statusUpdatingId === row._id,
                              disabled: statusUpdatingId === row._id,
                              onClick: () => openStatusChangeModal(row),
                            },
                          ]
                        : []),
                      ...(routePerms.canUpdate &&
                      row.status === "Open" &&
                      !row.customerId
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.CREATE_CUSTOMER,
                              title: "Create Customer",
                              loading: creatingCustomerId === row._id,
                              disabled: creatingCustomerId === row._id,
                              onClick: () => openCreateCustomerModal(row),
                            },
                          ]
                        : []),
                      ...(routePerms.canUpdate &&
                      row.status !== "Spam" &&
                      row.status !== "Closed"
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.CONVERT_TO_APPLICATION,
                              title: "Convert to Application",
                              loading: convertingToAppId === row._id,
                              disabled:
                                convertingToAppId === row._id ||
                                creatingCustomerId === row._id,
                              onClick: () =>
                                openConvertToApplicationModal(row),
                            },
                          ]
                        : []),
                      ...(routePerms.canDelete
                        ? [
                            {
                              action: ACTION_BUTTON_TYPES.DELETE,
                              title: "Delete",
                              onClick: () => openDeleteModal(row),
                            },
                          ]
                        : []),
                    ]}
                  />
                </td>
              </tr>
            )}
          />

          <CustomModal
            open={Boolean(statusChangeRow)}
            onClose={closeStatusChangeModal}
            title="Change Status"
            width="440px"
            showActions
            actions={[
              {
                label: "Cancel",
                secondary: true,
                onClick: closeStatusChangeModal,
                disabled: Boolean(statusUpdatingId),
              },
              {
                label: statusUpdatingId ? "Updating..." : "Update Status",
                disabled:
                  Boolean(statusUpdatingId) ||
                  !statusChangeValue ||
                  statusChangeValue === (statusChangeRow?.status || "Open"),
                onClick: confirmStatusChange,
              },
            ]}
          >
            {statusChangeRow ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  Update status for{" "}
                  <span className="font-semibold">
                    {statusChangeRow.enquiryNumber || "this enquiry"}
                  </span>
                  .
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Current status
                  </label>
                  <div>{getStatusBadge(statusChangeRow.status)}</div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    New status
                  </label>
                  <DropdownBasic
                    options={getStatusOptionsForRow(statusChangeRow).map(
                      (s) => ({
                        value: s,
                        label: s,
                      })
                    )}
                    value={statusChangeValue}
                    onChange={setStatusChangeValue}
                    placeholder="Select status"
                    className="w-full"
                    isDisabled={Boolean(statusUpdatingId)}
                    isClearable={false}
                    sortOptions={false}
                  />
                </div>
              </div>
            ) : null}
          </CustomModal>

          <CustomModal
            open={createCustomerModalOpen}
            onClose={closeCreateCustomerModal}
            title="Create Customer"
            width="480px"
            showActions
            actions={[
              {
                label: "Cancel",
                secondary: true,
                onClick: closeCreateCustomerModal,
                disabled: !!creatingCustomerId,
              },
              {
                label: creatingCustomerId
                  ? "Creating..."
                  : "Create Customer",
                primary: true,
                onClick: confirmCreateCustomer,
                disabled: !!creatingCustomerId,
              },
            ]}
          >
            {enquiryToConvert && (
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  Create a customer from enquiry{" "}
                  <span className="font-semibold">
                    {enquiryToConvert.enquiryNumber || "-"}
                  </span>
                  ?
                </p>
                <p>
                  Available enquiry details will be copied. A portal password
                  will be emailed to{" "}
                  <span className="font-semibold">
                    {enquiryToConvert.email || "the customer"}
                  </span>
                  .
                </p>
              </div>
            )}
          </CustomModal>

          <CustomModal
            open={convertAppModalOpen}
            onClose={closeConvertToApplicationModal}
            title="Convert to Application"
            width="520px"
            showActions
            actions={[
              {
                label: "Cancel",
                secondary: true,
                onClick: closeConvertToApplicationModal,
                disabled: !!convertingToAppId,
              },
              {
                label: convertingToAppId
                  ? "Preparing..."
                  : "Continue to Application",
                primary: true,
                onClick: confirmConvertToApplication,
                disabled: !!convertingToAppId,
              },
            ]}
          >
            {enquiryToApplication && (
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  Convert enquiry{" "}
                  <span className="font-semibold">
                    {enquiryToApplication.enquiryNumber || "-"}
                  </span>{" "}
                  into a{" "}
                  <span className="font-semibold">
                    {enquiryToApplication.enquiringFor || "service"}
                  </span>{" "}
                  application?
                </p>
                <p>
                  Enquiry details (name, email, company, notes
                  {enquiryToApplication.enquiringFor === "Inspection"
                    ? ", inspection services"
                    : ""}
                  ) will prefill the form. You can complete the remaining
                  fields on the application page.
                </p>
                {!enquiryToApplication.customerId ? (
                  <p>
                    If no customer exists for{" "}
                    <span className="font-semibold">
                      {enquiryToApplication.email || "this email"}
                    </span>
                    , one will be created first (portal password emailed).
                  </p>
                ) : (
                  <p>This enquiry is already linked to a customer.</p>
                )}
              </div>
            )}
          </CustomModal>

          <CustomModal
            open={deleteModalOpen}
            onClose={closeDeleteModal}
            title="Delete Enquiry"
            width="440px"
            showActions
            actions={[
              {
                label: "Cancel",
                secondary: true,
                onClick: closeDeleteModal,
                disabled: deleteLoading,
              },
              {
                label: deleteLoading ? "Deleting..." : "Delete",
                failure: true,
                disabled: deleteLoading,
                onClick: confirmDeleteEnquiry,
              },
            ]}
          >
            {enquiryToDelete && (
              <p className="text-sm text-gray-700">
                Are you sure you want to delete enquiry{" "}
                <span className="font-semibold">
                  {enquiryToDelete.enquiryNumber || "-"}
                </span>
                ? This action cannot be undone.
              </p>
            )}
          </CustomModal>
        </div>
      </div>
  );
};

export default Enquiries;
