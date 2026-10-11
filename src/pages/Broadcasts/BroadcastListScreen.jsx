import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Building, Megaphone, Users } from "lucide-react";
import {
  DataTable,
  ActionButtons,
  CustomModal,
} from "@/page-layouts";
import { notifyBrowserPush, notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION, useRouteModulePermissions } from "@/utils/permissionUtils";
import BroadcastCampaignFormModal, {
  BROADCAST_STATUS_OPTIONS,
} from "@/components/Broadcasts/BroadcastCampaignFormModal";
import MarketingWhatsappRunModal from "@/components/Broadcasts/MarketingWhatsappRunModal";
import BroadcastDashboardQuickInfo from "@/components/Broadcasts/BroadcastDashboardQuickInfo";
import InstantAnnouncementModal from "@/components/Broadcasts/InstantAnnouncementModal";
import BroadcastCampaignQrModal from "@/components/Broadcasts/BroadcastCampaignQrModal";
import { formatScheduleLabel } from "@/utils/marketingAnnouncementSchedule";
import { exportCampaignRecipientsFromApi } from "@/utils/broadcastCustomerRecipients";
import BroadcastRecipientListsPanel from "@/components/Broadcasts/BroadcastRecipientListsPanel";
import BroadcastRunCampaignModal from "@/components/Broadcasts/BroadcastRunCampaignModal";
import BroadcastServices from "@/services/BroadcastServices";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BroadcastListScreen = () => {
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfoFromContext = state?.adminInfo;
  const adminInfoFromStorage = localStorage.getItem("adminInfo")
    ? JSON.parse(localStorage.getItem("adminInfo"))
    : null;
  const adminInfo = adminInfoFromContext || adminInfoFromStorage;
  const routePerms = useRouteModulePermissions();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState(null);
  const [cloneFromId, setCloneFromId] = useState(null);
  const [formCampaignMeta, setFormCampaignMeta] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [waRunOpen, setWaRunOpen] = useState(false);
  const [waRunRow, setWaRunRow] = useState(null);
  const [instantOpen, setInstantOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrRow, setQrRow] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);
  const [runTarget, setRunTarget] = useState(null);
  const [activeTab, setActiveTab] = useState("campaigns");
  const headers = [
    "Campaign",
    "Recipients",
    "Message",
    "Schedule",
    "Status",
    "Actions",
  ];

  const authHeaders = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers: authHeaders },
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        if (list.length === 1) setBusinessFilter(list[0]._id);
      } catch (error) {
        console.error(error);
      }
    };
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo?.id, adminInfo?.token]);

  const fetchList = async () => {
    if (!adminInfo?.token) {
      setLoading(false);
      return;
    }
    if (businesses.length === 0) {
      setLoading(false);
      setRows([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchTerm || undefined,
      };
      if (businessFilter) {
        params.business_id = businessFilter;
      } else {
        params.business_ids = businesses.map((b) => b._id).join(",");
      }

      const response = await axios.get(`${Base_URL}/broadcasts`, {
        params,
        headers: authHeaders,
      });
      if (checkTokenExpired(response)) return;

      if (response.data.status) {
        setRows(response.data.data || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to load Campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminInfo?.token || businesses.length === 0) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessFilter,
    adminInfo?.token,
    currentPage,
    statusFilter,
    recordsPerPage,
    businesses.length,
  ]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchList();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);


  const openCreate = () => {
    setEditCampaignId(null);
    setCloneFromId(null);
    setFormCampaignMeta(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditCampaignId(row._id);
    setCloneFromId(null);
    setFormCampaignMeta({
      businessId: row.business_id?._id || row.business_id,
      whatsappRecipientCount: row.whatsappRecipientCount,
    });
    setFormOpen(true);
  };

  const openClone = (row) => {
    setEditCampaignId(null);
    setCloneFromId(row._id);
    setFormCampaignMeta({
      businessId: row.business_id?._id || row.business_id,
      whatsappRecipientCount: row.whatsappRecipientCount,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditCampaignId(null);
    setCloneFromId(null);
    setFormCampaignMeta(null);
  };

  const openView = (row) => {
    history.push(`/broadcasts/${row._id}`);
  };

  const handleExportRecipients = async (row) => {
    if ((row.recipientCount ?? 0) <= 0) {
      notifyError("No recipients to export");
      return;
    }
    try {
      const result = await exportCampaignRecipientsFromApi({
        campaignId: row._id,
        campaignTitle: row.title,
        authHeaders,
        checkTokenExpired,
        recipientCount: row.recipientCount,
      });
      if (result?.cancelled) return;
      notifySuccess(`Exported ${row.recipientCount} recipient(s)`);
    } catch (error) {
      notifyError(error.response?.data?.error || error.message || "Export failed");
    }
  };

  const openRunConfirm = (row) => {
    if (!row?._id || runningId) return;
    setRunTarget(row);
    setRunConfirmOpen(true);
  };

  const handleRunCampaign = async () => {
    if (!runTarget?._id || runningId) return;

    const campaignId = runTarget._id;
    const campaignName = (runTarget.title || "Campaign").trim() || "Campaign";
    setRunningId(campaignId);

    try {
      const response = await BroadcastServices.runCampaignManually(campaignId, authHeaders);
      if (checkTokenExpired(response)) return;
      if (!response.data?.status) {
        const errMsg = response.data?.error || "Failed to run campaign";
        notifyError(errMsg);
        notifyBrowserPush(`${campaignName} failed`, errMsg);
        return;
      }
      const { emailsSent = 0, emailsFailed = 0, whatsappsSent = 0, whatsappsFailed = 0 } =
        response.data;
      const summary = `Email: ${emailsSent} sent${emailsFailed ? `, ${emailsFailed} failed` : ""}; WhatsApp: ${whatsappsSent} sent${whatsappsFailed ? `, ${whatsappsFailed} failed` : ""}`;
      notifySuccess(`Campaign finished — ${summary}`);
      notifyBrowserPush(`${campaignName} finished`, summary);
      fetchList();
    } catch (error) {
      const errMsg = error.response?.data?.error || "Failed to run campaign";
      notifyError(errMsg);
      notifyBrowserPush(`${campaignName} failed`, errMsg);
    } finally {
      setRunningId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem?._id) return;
    try {
      setDeleting(true);
      const response = await axios.delete(`${Base_URL}/broadcasts/${deleteItem._id}`, {
        headers: { authorization: `Bearer ${adminInfo.token}` },
      });
      if (checkTokenExpired(response)) return;
      notifySuccess("Campaign deleted");
      setDeleteOpen(false);
      setDeleteItem(null);
      fetchList();
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      scheduled: "bg-blue-100 text-blue-800",
      sent: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      cancelled: "bg-yellow-100 text-yellow-800",
    };
    const label = BROADCAST_STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${colors[status] || colors.draft
          }`}
      >
        {label}
      </span>
    );
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
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
      options: [{ value: "all", label: "All Status" }, ...BROADCAST_STATUS_OPTIONS],
      placeholder: "Status",
      icon: Megaphone,
    },
  ];

  return (
    <RouteActionGate
      title="Campaigns"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0">
          <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-gray-600 mt-2">
                Create campaigns, manage recipient lists, and send the same message to
                many people on your schedule.
              </p>
            </div>
            {routePerms.canAdd && activeTab === "campaigns" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-5 py-2.5 border border-[var(--p-blue)] text-[var(--p-blue)] bg-white rounded-lg text-sm hover:bg-blue-50"
                  onClick={() => setInstantOpen(true)}
                >
                  Instant Campaign
                </button>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-[var(--p-blue)] text-white rounded-lg text-sm hover:opacity-90"
                  onClick={openCreate}
                >
                  New Campaign
                </button>
              </div>
            ) : null}
          </div>

          <div className="mb-6 flex gap-1 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "campaigns"
                  ? "border-[var(--p-blue)] text-[var(--p-blue)]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
            >
              Campaigns
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lists")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "lists"
                  ? "border-[var(--p-blue)] text-[var(--p-blue)]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
            >
              Recipient lists
            </button>
          </div>

          {activeTab === "lists" ? (
            <BroadcastRecipientListsPanel
              businesses={businesses}
              businessFilter={businessFilter}
              authHeaders={authHeaders}
              adminToken={adminInfo?.token}
              checkTokenExpired={checkTokenExpired}
              routePerms={routePerms}
            />
          ) : (
            <>
              <BroadcastDashboardQuickInfo
                className="mb-6"
                token={adminInfo?.token}
                businessFilter={businessFilter}
                businessIds={businesses.map((b) => b._id)}
              />

              <DataTable
                onSearch={(v) => setSearchTerm(v)}
                searchValue={searchTerm}
                searchPlaceholder="Search title, message, recipient…"
                filters={filters}
                headers={headers}
                data={rows}
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
                renderRow={(row) => {
                  // Collect action buttons in an array so we can manipulate their order
                  const actionItems = [
                    {
                      action: ACTION_BUTTON_TYPES.VIEW,
                      title: "View campaign details",
                      onClick: () => openView(row),
                    },
                  ];



                  // WhatsApp delivery log (2nd action)
                  if ((row.whatsappRecipientCount ?? 0) > 0) {
                    actionItems.push({
                      action: ACTION_BUTTON_TYPES.WHATSAPP_DELIVERY,
                      title: row.whatsappCurrentRun?.inProgress
                        ? `WhatsApp send (Go #${row.whatsappCurrentRun.goNumber}): ${row.whatsappCurrentRun.sent ?? 0} sent, ${row.whatsappCurrentRun.pending ?? 0} pending, ${row.whatsappCurrentRun.failed ?? 0} failed`
                        : "WhatsApp Current Go",
                      onClick: () => {
                        setWaRunRow(row);
                        setWaRunOpen(true);
                      },
                    });
                  }

                  // Edit (3rd action)
                  if (routePerms.canUpdate) {
                    actionItems.push({
                      action: ACTION_BUTTON_TYPES.EDIT,
                      title: "Edit",
                      onClick: () => openEdit(row),
                    });
                  }
                  if (routePerms.canUpdate) {
                    actionItems.push({
                      action: ACTION_BUTTON_TYPES.RUN_CAMPAIGN,
                      title: "Run campaign now",
                      // description: "Send to all recipients immediately (ignores status & schedule)",
                      onClick: () => openRunConfirm(row),
                      loading: runningId === row._id,
                      disabled: !!runningId,
                    });
                  }

                  // Export action: should be placed as the 4th action (index 3, since 0-based)
                  if ((row.recipientCount ?? 0) > 0) {
                    const exportBtn = {
                      action: ACTION_BUTTON_TYPES.EXPORT,
                      title: "Export recipients",
                      // description: "Download as Excel (same format as import)",
                      onClick: () => handleExportRecipients(row),
                    };
                    // Insert export at position 3 (4th action)
                    if (actionItems.length >= 3) {
                      actionItems.splice(3, 0, exportBtn);
                    } else {
                      // If less than 3 actions yet, just push at the end
                      actionItems.push(exportBtn);
                    }
                  }

                  if (routePerms.canAdd) {
                    actionItems.push({
                      action: ACTION_BUTTON_TYPES.DUPLICATE,
                      title: "Clone",
                      onClick: () => openClone(row),
                    });
                  }
                  if (routePerms.canUpdate) {
                    actionItems.push({
                      action: ACTION_BUTTON_TYPES.CAMPAIGN_QR,
                      title: row.qrEnabled ? "Campaign QR code" : "Generate campaign QR",
                      // description: row.qrEnabled
                      //   ? "Download or manage sign-up QR"
                      //   : "Create a QR for public sign-up",
                      onClick: () => {
                        setQrRow(row);
                        setQrOpen(true);
                      },
                    });
                  }
                  if (routePerms.canDelete) {
                    actionItems.push({
                      action: ACTION_BUTTON_TYPES.DELETE,
                      title: "Delete",
                      onClick: () => {
                        setDeleteItem(row);
                        setDeleteOpen(true);
                      },
                    });
                  }

                  return (
                    <tr key={row._id} className="border-b">
                      <td className="py-2 px-4 font-medium">
                        {row.title || "-"}
                      </td>
                      <td className="py-2 px-4">
                        <button
                          type="button"
                          onClick={() => openView(row)}
                          className="inline-flex items-center gap-1 text-sm text-[var(--p-blue)] hover:underline"
                          title="View campaign details"
                        >
                          <Users size={14} />
                          {row.recipientCount ?? 0}
                        </button>
                      </td>
                      <td className="py-2 px-4 max-w-xs truncate" title={row.messageContent}>
                        {row.messageContent || "-"}
                      </td>
                      <td className="py-2 px-4">{row.scheduleLabel || formatScheduleLabel(row)}</td>
                      <td className="py-2 px-4">{statusBadge(row.status)}</td>
                      <td
                        className="py-2 px-4 overflow-visible"
                        style={{ width: "fit-content", minWidth: "5.5rem" }}
                      >
                        <ActionButtons
                          maxVisibleActions={2}
                          isCell
                          items={actionItems}
                        />
                      </td>
                    </tr>
                  );
                }}
              />
            </>
          )}
        </div>
      </div>

      <BroadcastCampaignFormModal
        open={formOpen}
        onClose={closeForm}
        campaignId={editCampaignId}
        cloneFromId={cloneFromId}
        businesses={businesses}
        defaultBusinessId={businessFilter || (businesses.length === 1 ? businesses[0]._id : "")}
        prefilledBusinessId={formCampaignMeta?.businessId || ""}
        prefilledWhatsappRecipientCount={formCampaignMeta?.whatsappRecipientCount ?? null}
        authHeaders={authHeaders}
        adminToken={adminInfo?.token}
        checkTokenExpired={checkTokenExpired}
        onSaved={() => fetchList()}
      />

      <MarketingWhatsappRunModal
        open={waRunOpen}
        onClose={() => {
          setWaRunOpen(false);
          setWaRunRow(null);
        }}
        announcementId={waRunRow?._id}
        announcementTitle={waRunRow?.title}
        authHeaders={authHeaders}
        checkTokenExpired={checkTokenExpired}
        onResendComplete={fetchList}
      />

      <BroadcastRunCampaignModal
        open={runConfirmOpen}
        onClose={() => {
          setRunConfirmOpen(false);
          setRunTarget(null);
        }}
        campaignTitle={runTarget?.title}
        recipientCount={runTarget?.recipientCount}
        whatsappRecipientCount={runTarget?.whatsappRecipientCount}
        businessId={runTarget?.business_id?._id || runTarget?.business_id}
        running={Boolean(runningId)}
        onConfirm={handleRunCampaign}
      />

      <CustomModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteItem(null);
        }}
        title="Delete Campaign"
        width="480px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => {
              setDeleteOpen(false);
              setDeleteItem(null);
            },
          },
          {
            label: deleting ? "Deleting…" : "Delete",
            primary: true,
            onClick: confirmDelete,
            disabled: deleting,
            style: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
          },
        ]}
      >
        <p className="text-sm text-gray-600">
          Delete <strong>{deleteItem?.title}</strong> and all
          its recipients? This cannot be undone.
        </p>
      </CustomModal>

      <InstantAnnouncementModal
        open={instantOpen}
        onClose={() => setInstantOpen(false)}
        businesses={businesses}
        defaultBusinessId={businessFilter || (businesses.length === 1 ? businesses[0]._id : "")}
        authHeaders={authHeaders}
        adminToken={adminInfo?.token}
        checkTokenExpired={checkTokenExpired}
      />

      <BroadcastCampaignQrModal
        open={qrOpen}
        campaign={qrRow}
        headers={authHeaders}
        onClose={() => {
          setQrOpen(false);
          setQrRow(null);
        }}
        onChanged={(updated) => {
          setQrRow((prev) => (prev ? { ...prev, ...updated } : prev));
          setRows((prev) =>
            prev.map((r) =>
              String(r._id) === String(updated?.campaignId || qrRow?._id)
                ? { ...r, ...updated, _id: r._id }
                : r,
            ),
          );
        }}
      />
    </RouteActionGate>
  );
};

export default BroadcastListScreen;
