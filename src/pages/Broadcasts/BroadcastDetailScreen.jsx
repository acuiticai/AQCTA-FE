import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useHistory, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Megaphone,
  MessageSquare,
  Play,
  QrCode,
  Send,
  Users,
} from "lucide-react";
import { Loader } from "@/page-layouts";
import { notifyBrowserPush, notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION, useRouteModulePermissions } from "@/utils/permissionUtils";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import MarketingWhatsappHistoryPanel from "@/components/Broadcasts/MarketingWhatsappHistoryPanel";
import MarketingWhatsappRunModal from "@/components/Broadcasts/MarketingWhatsappRunModal";
import BroadcastCampaignFormModal from "@/components/Broadcasts/BroadcastCampaignFormModal";
import BroadcastCampaignQrModal from "@/components/Broadcasts/BroadcastCampaignQrModal";
import BroadcastRunCampaignModal from "@/components/Broadcasts/BroadcastRunCampaignModal";
import {
  SEND_FREQUENCY_OPTIONS,
  formatScheduleLabel,
  toYyyyMmDd,
} from "@/utils/marketingAnnouncementSchedule";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import { computeLastActivityAt } from "@/utils/broadcastActivityUtils";
import { exportCampaignRecipientsFromApi } from "@/utils/broadcastCustomerRecipients";
import BroadcastServices from "@/services/BroadcastServices";
import BroadcastWhatsAppIntegrationAlert from "@/components/Broadcasts/BroadcastWhatsAppIntegrationAlert";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800",
  scheduled: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-yellow-100 text-yellow-800",
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function SectionCard({ title, icon: Icon, children, id, className = "" }) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 bg-gray-50/60">
        {Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailField({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900 break-words">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }) {
  const label = STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
        STATUS_COLORS[status] || STATUS_COLORS.draft
      }`}
    >
      {label}
    </span>
  );
}

function DeliveryBadge({ sent, sentAt, error, replied, replyBody, replyAt }) {
  if (replied && replyBody) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
          Replied
        </span>
        <span
          className="text-xs text-gray-700 truncate max-w-[12rem]"
          title={replyBody}
        >
          {replyBody}
        </span>
        {replyAt ? (
          <span className="text-xs text-gray-500">{formatDateTime(replyAt)}</span>
        ) : null}
      </span>
    );
  }
  if (sent) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Sent
        </span>
        {sentAt ? (
          <span className="text-xs text-gray-500">{formatDateTime(sentAt)}</span>
        ) : null}
      </span>
    );
  }
  if (error) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Failed
        </span>
        <span className="text-xs text-red-600 truncate max-w-[12rem]" title={error}>
          {error}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
      Pending
    </span>
  );
}

const BroadcastDetailScreen = () => {
  const { id } = useParams();
  const history = useHistory();
  const location = useLocation();
  const checkTokenExpired = useCheckTokenExpired();
  const routePerms = useRouteModulePermissions();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [waRunOpen, setWaRunOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const loadDetail = async () => {
    if (!adminInfo?.token || !id) return;
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/broadcasts/${id}`, {
        headers: authHeaders,
      });
      if (checkTokenExpired(response)) return;
      if (!response.data?.status) {
        notifyError("Could not load campaign");
        setItem(null);
        return;
      }
      setItem(response.data.data);
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to load campaign");
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adminInfo?.token]);

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers: authHeaders },
        );
        setBusinesses(response.data?.businesses || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminInfo?.id, adminInfo?.token]);

  useEffect(() => {
    if (loading || !item) return;
    if (location.hash === "#send-history") {
      const el = document.getElementById("send-history");
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }
  }, [loading, item, location.hash]);

  const handleExportRecipients = async () => {
    if (!item?._id) return;
    const manualCount = (item.recipients || []).filter((r) => !r.systemUserId).length;
    try {
      const result = await exportCampaignRecipientsFromApi({
        campaignId: item._id,
        campaignTitle: item.title,
        authHeaders,
        checkTokenExpired,
        recipientCount: manualCount,
      });
      if (result?.cancelled) return;
      notifySuccess(`Exported ${manualCount} recipient(s)`);
    } catch (error) {
      notifyError(error.response?.data?.error || error.message || "Export failed");
    }
  };

  const handleRunCampaign = async () => {
    if (!item?._id || running) return;

    const campaignName = (item.title || "Campaign").trim() || "Campaign";
    setRunning(true);

    try {
      const response = await BroadcastServices.runCampaignManually(item._id, authHeaders);
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
      await loadDetail();
    } catch (error) {
      const errMsg = error.response?.data?.error || "Failed to run campaign";
      notifyError(errMsg);
      notifyBrowserPush(`${campaignName} failed`, errMsg);
    } finally {
      setRunning(false);
    }
  };

  const businessName = useMemo(() => {
    const bid = item?.business_id?._id || item?.business_id;
    if (!bid) return "—";
    const match = businesses.find((b) => String(b._id) === String(bid));
    return match?.name || item?.business_id?.name || "—";
  }, [item, businesses]);

  const frequencyLabel = useMemo(() => {
    if (!item) return "—";
    if (item.sendFrequency === "custom") {
      const n = item.sendIntervalDays || 1;
      return `Every ${n} day${n === 1 ? "" : "s"}`;
    }
    const opt = SEND_FREQUENCY_OPTIONS.find((o) => o.value === item.sendFrequency);
    return opt?.label || item.sendFrequency || "—";
  }, [item]);

  const systemRecipientsLabel = useMemo(() => {
    const sys = item?.systemRecipients;
    if (!sys) return null;
    if (sys.notifyAllSystemUsers) return "All system users in business";
    const roles = sys.userRoles || [];
    if (roles.length === 0) return null;
    const names = roles
      .map((r) => (typeof r === "object" ? r.name || r.roleName : null))
      .filter(Boolean);
    return names.length
      ? `${names.length} role(s): ${names.join(", ")}`
      : `${roles.length} role(s) selected`;
  }, [item]);

  const whatsappSummary = item?.whatsappCurrentRun?.summary;

  const lastActivityAt = useMemo(
    () => computeLastActivityAt(item),
    [item],
  );

  return (
    <RouteActionGate
      title="Campaign Details"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <div className="bg-gray-50 min-h-screen w-full">
        <div className="w-full max-w-6xl mx-auto px-6 py-8">
          <button
            type="button"
            onClick={() => history.push("/broadcasts")}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft size={16} />
            Back to Campaigns
          </button>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader />
            </div>
          ) : !item ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
              Campaign not found.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {item.title || "Campaign"}
                    </h1>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-gray-600 text-sm">
                    {item.scheduleLabel || formatScheduleLabel(item)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {routePerms.canUpdate ? (
                    <button
                      type="button"
                      disabled={running}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 bg-white rounded-lg text-sm hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setRunConfirmOpen(true)}
                    >
                      <Play size={16} />
                      {running ? "Running…" : "Run now"}
                    </button>
                  ) : null}
                  {(item.whatsappRecipientCount ?? 0) > 0 ? (
                    <button
                      type="button"
                      className="px-4 py-2 border border-green-600 text-green-700 bg-white rounded-lg text-sm hover:bg-green-50"
                      onClick={() => setWaRunOpen(true)}
                    >
                      WhatsApp delivery log
                    </button>
                  ) : null}
                  {routePerms.canUpdate ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-700 bg-white rounded-lg text-sm hover:bg-indigo-50"
                      onClick={() => setQrOpen(true)}
                    >
                      <QrCode size={16} />
                      Campaign QR
                    </button>
                  ) : null}
                  {routePerms.canUpdate ? (
                    <button
                      type="button"
                      className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg text-sm hover:opacity-90"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit campaign
                    </button>
                  ) : null}
                </div>
              </div>

              <BroadcastWhatsAppIntegrationAlert
                businessId={item.business_id?._id || item.business_id}
                whatsappRecipientCount={item.whatsappRecipientCount}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Recipients",
                    value: item.recipientCount ?? (item.recipients || []).length,
                    icon: Users,
                  },
                  {
                    label: "Total sends",
                    value: item.runCount ?? 0,
                    icon: Send,
                  },
                  {
                    label: "Last run",
                    value: formatDateTime(lastActivityAt),
                    icon: Clock,
                    small: true,
                  },
                  {
                    label: "Next send",
                    value: formatDateTime(item.nextSendAt),
                    icon: CalendarClock,
                    small: true,
                  },
                ].map(({ label, value, icon: Icon, small }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">
                      <Icon size={14} />
                      {label}
                    </div>
                    <p
                      className={`font-semibold text-gray-900 ${
                        small ? "text-sm leading-snug" : "text-2xl"
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Campaign overview" icon={Megaphone}>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {!isSingleAssignedBusiness() && (
                      <DetailField label="Business">{businessName}</DetailField>
                    )}
                    <DetailField label="Status">
                      <StatusBadge status={item.status} />
                    </DetailField>
                    <DetailField label="Frequency">{frequencyLabel}</DetailField>
                    <DetailField label="Send time">{item.sendTime || "—"}</DetailField>
                    <DetailField label="Start date">
                      {toYyyyMmDd(item.startDate) || "—"}
                    </DetailField>
                    <DetailField label="Schedule">
                      {item.scheduleLabel || formatScheduleLabel(item)}
                    </DetailField>
                    <DetailField label="First sent at">
                      {formatDateTime(item.sentAt)}
                    </DetailField>
                    <DetailField label="Last run at">
                      {formatDateTime(lastActivityAt)}
                    </DetailField>
                    <DetailField label="Next send at">
                      {formatDateTime(item.nextSendAt)}
                    </DetailField>
                    <DetailField label="Total send cycles">
                      {item.runCount ?? 0}
                    </DetailField>
                    <DetailField label="Created">
                      {formatDateTime(item.createdAt)}
                      {item.createdBy?.name ? ` · ${item.createdBy.name}` : ""}
                    </DetailField>
                    <DetailField label="Last updated">
                      {formatDateTime(item.updatedAt)}
                      {item.updatedBy?.name ? ` · ${item.updatedBy.name}` : ""}
                    </DetailField>
                  </dl>
                </SectionCard>

                <SectionCard title="Message" icon={MessageSquare}>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {item.messageContent || "—"}
                  </p>
                  {systemRecipientsLabel ? (
                    <p className="mt-4 text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                      <strong>System users:</strong> {systemRecipientsLabel}
                    </p>
                  ) : null}
                  {whatsappSummary ? (
                    <div className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-900">
                      <strong>Current WhatsApp go:</strong>{" "}
                      {item.whatsappCurrentRun?.inProgress ? "In progress · " : ""}
                      {whatsappSummary.sent ?? 0} sent, {whatsappSummary.failed ?? 0}{" "}
                      failed, {whatsappSummary.pending ?? 0} pending
                    </div>
                  ) : null}
                </SectionCard>
              </div>

              <SectionCard title="Recipients" icon={Users}>
                <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
                  {(item.recipients || []).some((r) => !r.systemUserId) ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                      onClick={handleExportRecipients}
                    >
                      Export recipients
                    </button>
                  ) : null}
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-gray-50">
                      <tr className="text-gray-600 text-xs">
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">WhatsApp</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">
                          WhatsApp delivery
                        </th>
                        <th className="text-left px-3 py-2 font-medium">
                          Email delivery
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.recipients || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-gray-500"
                          >
                            No recipients added yet.
                          </td>
                        </tr>
                      ) : (
                        (item.recipients || []).map((r, i) => (
                          <tr key={r._id || i} className="border-t border-gray-100">
                            <td className="px-3 py-2">{r.name || "—"}</td>
                            <td className="px-3 py-2">{r.whatsappNumber || "—"}</td>
                            <td className="px-3 py-2">{r.email || "—"}</td>
                            <td className="px-3 py-2">
                              <DeliveryBadge
                                sent={r.whatsappSent}
                                sentAt={r.whatsappSentAt}
                                error={r.whatsappLastError}
                                replied={r.whatsappReplied}
                                replyBody={r.whatsappLastReplyBody}
                                replyAt={r.whatsappLastReplyAt}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <DeliveryBadge
                                sent={r.emailSent}
                                sentAt={r.emailSentAt}
                                error={r.emailLastError}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard
                id="send-history"
                title="Send history"
                icon={Clock}
              >
                <p className="text-sm text-gray-600 mb-4">
                  Each send cycle (go) shows when this campaign ran, how many
                  messages were delivered, and per-recipient status.
                </p>
                <MarketingWhatsappHistoryPanel
                  key={item._id}
                  announcementId={item._id}
                  authHeaders={authHeaders}
                  checkTokenExpired={checkTokenExpired}
                  onResendComplete={loadDetail}
                  variant="embedded"
                />
              </SectionCard>
            </div>
          )}
        </div>
      </div>

      <MarketingWhatsappRunModal
        open={waRunOpen}
        onClose={() => setWaRunOpen(false)}
        announcementId={item?._id}
        announcementTitle={item?.title}
        authHeaders={authHeaders}
        checkTokenExpired={checkTokenExpired}
        onResendComplete={loadDetail}
      />

      <BroadcastCampaignFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        campaignId={item?._id}
        businesses={businesses}
        defaultBusinessId={item?.business_id?._id || item?.business_id || ""}
        prefilledBusinessId={item?.business_id?._id || item?.business_id || ""}
        prefilledWhatsappRecipientCount={item?.whatsappRecipientCount ?? null}
        authHeaders={authHeaders}
        adminToken={adminInfo?.token}
        checkTokenExpired={checkTokenExpired}
        onSaved={() => loadDetail()}
      />

      <BroadcastCampaignQrModal
        open={qrOpen}
        campaign={item}
        headers={authHeaders}
        onClose={() => setQrOpen(false)}
        onChanged={(updated) => {
          setItem((prev) => (prev ? { ...prev, ...updated } : prev));
        }}
      />

      <BroadcastRunCampaignModal
        open={runConfirmOpen}
        onClose={() => setRunConfirmOpen(false)}
        campaignTitle={item?.title}
        recipientCount={item?.recipientCount}
        whatsappRecipientCount={item?.whatsappRecipientCount}
        businessId={item?.business_id?._id || item?.business_id}
        running={running}
        onConfirm={handleRunCampaign}
      />
    </RouteActionGate>
  );
};

export default BroadcastDetailScreen;
