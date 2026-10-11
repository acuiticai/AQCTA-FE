import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { CustomModal, DataTable, FormInput, Page, PageHeader } from "@/page-layouts/index";
import ActionButtons from "@/page-layouts/components/ActionButtons";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import OperationsServices from "@/services/OperationsServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { formatDate } from "@/components/formatAmount";

const toYyyyMmDd = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string") return value;
  return "";
};

export default function CampaignApplicationsPage() {
  const history = useHistory();
  const { campaignId } = useParams();

  const [loading, setLoading] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("Campaign Applications");
  const [applications, setApplications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectSaving, setRejectSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetApplication, setRejectTargetApplication] = useState(null);

  const headers = [
    "Rider Name",
    "Email",
    "Phone",
    "Applied At",
    "Status",
    "Action",
  ];

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await OperationsServices.getCampaignApplications(campaignId, {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter,
        search: searchValue || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      setApplications(response?.data || []);
      setCampaignTitle(
        response?.campaign?.campaign_title
          ? `Applications - ${response.campaign.campaign_title}`
          : "Campaign Applications"
      );
      setTotalPages(response?.totalPages || 1);
      setTotalRecords(response?.total || 0);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) fetchApplications();
  }, [campaignId, currentPage, recordsPerPage, searchValue, statusFilter, startDate, endDate]);

  const handleUpdateStatus = async (application, status, reason = "") => {
    try {
      await OperationsServices.updateCampaignApplicationStatus(
        campaignId,
        application._id,
        status,
        reason
      );
      notifySuccess(`Application ${status.toLowerCase()} successfully`);
      fetchApplications();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update status");
    }
  };

  const openRejectModal = (application) => {
    setRejectTargetApplication(application || null);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleRejectApplication = async () => {
    const reason = (rejectReason || "").toString().trim();
    if (!rejectTargetApplication?._id) {
      notifyError("Application not found.");
      return;
    }
    try {
      setRejectSaving(true);
      await handleUpdateStatus(rejectTargetApplication, "Rejected", reason);
      setRejectModalOpen(false);
      setRejectTargetApplication(null);
      setRejectReason("");
    } finally {
      setRejectSaving(false);
    }
  };

  const renderRow = (item) => {
    const rider = item?.rider_id || {};
    const riderId = rider?._id || (typeof rider === "string" ? rider : "");
    const name = rider?.basicInformation?.vendorDisplayName || "-";
    const email = rider?.basicInformation?.vendorEmail || "-";
    const phone =
      rider?.basicInformation?.vendorPhone?.mobile ||
      rider?.basicInformation?.vendorPhone?.workPhone ||
      "-";
    const status = item?.application_status || "-";
    const canApprove = status === "Applied";
    const canReject = ["Applied", "Approved"].includes(status);

    return (
      <tr key={item._id} className="hover:bg-gray-50">
        <td className="px-6 py-4">{name}</td>
        <td className="px-6 py-4">{email}</td>
        <td className="px-6 py-4">{phone}</td>
        <td className="px-6 py-4">{item?.applied_at ? formatDate(item.applied_at) : "-"}</td>
        <td className="px-6 py-4">{status}</td>
        <td>
          <ActionButtons
            items={[
              {
                action: ACTION_BUTTON_TYPES.VIEW,
                title: "View Vendor",
                onClick: () => history.push(`/Edit Vendor/${riderId}`),
                permission: Boolean(riderId),
              },
              {
                action: ACTION_BUTTON_TYPES.APPROVE,
                title: "Approve",
                onClick: () => handleUpdateStatus(item, "Approved"),
                permission: canApprove,
              },
              {
                action: ACTION_BUTTON_TYPES.REJECT,
                title: "Reject",
                onClick: () => openRejectModal(item),
                permission: canReject,
              },
            ]}
          />
        </td>
      </tr>
    );
  };

  const filters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: {
        onClick: () => {
          setStartDate("");
          setEndDate("");
          setStatusFilter("all");
          setSearchValue("");
          setCurrentPage(1);
        },
      },
    },
    {
      isDatePicker: true,
      value: startDate,
      onChange: (value) => {
        setStartDate(toYyyyMmDd(value));
        setCurrentPage(1);
      },
    },
    {
      isDatePicker: true,
      value: endDate,
      onChange: (value) => {
        setEndDate(toYyyyMmDd(value));
        setCurrentPage(1);
      },
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Status" },
        { value: "Applied", label: "Applied" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" },
        { value: "Withdrawn", label: "Withdrawn" },
        { value: "Completed", label: "Completed" },
      ],
    },
  ];

  return (
    <Page>
      <PageHeader
        title={campaignTitle}
        showAddButton
        addButtonText="Back to Campaigns"
        onAddNew={() => history.push("/campaigns")}
      />

      <DataTable
        headers={headers}
        data={applications}
        loading={loading}
        currentPage={currentPage}
        totalRecords={totalRecords}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={setCurrentPage}
        onRecordsPerPageChange={(val) => {
          setRecordsPerPage(val);
          setCurrentPage(1);
        }}
        onSearch={(value) => {
          setSearchValue(value);
          setCurrentPage(1);
        }}
        searchValue={searchValue}
        searchPlaceholder="Search by rider name/email/phone..."
        filters={filters}
        renderRow={renderRow}
        emptyMessage="No applications found"
      />

      <CustomModal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Application"
        width="520px"
        showActions={true}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setRejectModalOpen(false),
          },
          {
            label: rejectSaving ? "Rejecting..." : "Reject",
            primary: true,
            disabled: rejectSaving,
            onClick: handleRejectApplication,
          },
        ]}
      >
        <FormInput
          direction="column"
          label="Rejection reason (optional)"
          type="textarea"
          rows={4}
          placeholder="Enter rejection reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </CustomModal>
    </Page>
  );
}
