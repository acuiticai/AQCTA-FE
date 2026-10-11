import React, { useEffect, useState } from "react";
import axios from "axios";
import MarketingRecipientsEditor from "@/components/Broadcasts/MarketingRecipientsEditor";
import MarketingCustomerRecipientsPicker from "@/components/Broadcasts/MarketingCustomerRecipientsPicker";
import MarketingListRecipientsPicker from "@/components/Broadcasts/MarketingListRecipientsPicker";
import MarketingSystemRecipientsPicker, {
  emptySystemConfig,
} from "@/components/Broadcasts/MarketingSystemRecipientsPicker";
import BroadcastImportModal from "@/components/Broadcasts/BroadcastImportModal";
import { FormInput, CustomModal } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  SEND_FREQUENCY_OPTIONS,
  toYyyyMmDd,
} from "@/utils/marketingAnnouncementSchedule";
import {
  formatRecipientsWhatsapp,
  recipientToWhatsappE164,
} from "@/utils/whatsappPhoneFormat";
import {
  downloadRecipientsCsv,
  mergeImportedRecipients,
} from "@/utils/broadcastCustomerRecipients";
import BroadcastWhatsAppIntegrationAlert, {
  countWhatsappRecipients,
} from "@/components/Broadcasts/BroadcastWhatsAppIntegrationAlert";
import {
  getSoleAssignedBusinessId,
  isSingleAssignedBusiness,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const BROADCAST_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export const emptyBroadcastForm = {
  business_id: "",
  title: "",
  status: "draft",
  messageContent: "",
  sendFrequency: "once",
  sendIntervalDays: "7",
  sendTime: "09:00",
  startDate: "",
  recipients: [],
  recipientListIds: [],
  systemRecipients: emptySystemConfig(),
};

function FormSection({ step, title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p-blue)] text-white text-xs font-bold">
          {step}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description ? (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

export function getClonedBroadcastTitle(title) {
  const stripped = (title || "Campaign")
    .trim()
    .replace(/(\s\(Copy\))+$/i, "");
  return `${stripped || "Campaign"} (Copy)`;
}

export function mapBroadcastApiToForm(data, fallbackBusinessId = "", { clone = false } = {}) {
  if (!data) return { ...emptyBroadcastForm, business_id: fallbackBusinessId };
  const baseTitle = (data.title || "").trim();
  return {
    business_id: data.business_id?._id || data.business_id || fallbackBusinessId,
    title: clone ? getClonedBroadcastTitle(baseTitle) : baseTitle,
    status: clone ? "draft" : data.status || "draft",
    messageContent: data.messageContent || "",
    sendFrequency: data.sendFrequency || "once",
    sendIntervalDays: String(data.sendIntervalDays ?? 7),
    sendTime: data.sendTime || "09:00",
    startDate: toYyyyMmDd(data.startDate || data.nextSendAt),
    recipients: formatRecipientsWhatsapp(
      (data.recipients || [])
        .filter((r) => !r.systemUserId)
        .map((r) => ({
          name: r.name || "",
          email: r.email || "",
          whatsappNumber: r.whatsappNumber || "",
        })),
    ),
    systemRecipients: {
      notifyAllSystemUsers: Boolean(data.systemRecipients?.notifyAllSystemUsers),
      userRoles: (data.systemRecipients?.userRoles || []).map((r) =>
        typeof r === "object" && r?._id ? r._id : r,
      ),
    },
    recipientListIds: (data.recipientListIds || []).map((id) =>
      typeof id === "object" && id?._id ? id._id : id,
    ),
  };
}

const BroadcastCampaignFormModal = ({
  open,
  onClose,
  campaignId = null,
  cloneFromId = null,
  businesses = [],
  defaultBusinessId = "",
  prefilledBusinessId = "",
  prefilledWhatsappRecipientCount = null,
  authHeaders,
  adminToken,
  checkTokenExpired,
  onSaved,
}) => {
  const isEdit = Boolean(campaignId);
  const isClone = Boolean(cloneFromId) && !isEdit;
  const [formData, setFormData] = useState(emptyBroadcastForm);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loadedWhatsappRecipientCount, setLoadedWhatsappRecipientCount] = useState(null);

  const resolvedBusinessId =
    formData.business_id ||
    prefilledBusinessId ||
    defaultBusinessId ||
    (businesses.length === 1 ? businesses[0]._id : "") ||
    getSoleAssignedBusinessId() ||
    "";
  const hideBusinessField = isSingleAssignedBusiness() || businesses.length === 1;
  const resolvedWhatsappRecipientCount = Math.max(
    countWhatsappRecipients(formData.recipients),
    loadedWhatsappRecipientCount ?? 0,
    prefilledWhatsappRecipientCount ?? 0,
  );

  useEffect(() => {
    if (!open) return;

    if (!isEdit && !isClone) {
      const soleId =
        defaultBusinessId ||
        (businesses.length === 1 ? businesses[0]._id : "") ||
        getSoleAssignedBusinessId() ||
        "";
      setFormData({
        ...emptyBroadcastForm,
        business_id: soleId,
        recipients: [],
        systemRecipients: emptySystemConfig(),
      });
      setLoadedWhatsappRecipientCount(null);
      setFormLoading(false);
      return;
    }

    const sourceId = isEdit ? campaignId : cloneFromId;
    let cancelled = false;
    (async () => {
      setFormLoading(true);
      try {
        const response = await axios.get(`${Base_URL}/broadcasts/${sourceId}`, {
          headers: authHeaders,
        });
        if (checkTokenExpired?.(response)) return;
        if (cancelled) return;
        const data = response.data?.data;
        if (!data) {
          notifyError("Could not load campaign");
          onClose?.();
          return;
        }
        setFormData(mapBroadcastApiToForm(data, defaultBusinessId, { clone: isClone }));
        setLoadedWhatsappRecipientCount(
          data.whatsappRecipientCount ??
            countWhatsappRecipients(data.recipients || []),
        );
      } catch (error) {
        if (!cancelled) {
          notifyError(error.response?.data?.error || "Failed to load campaign");
          onClose?.();
        }
      } finally {
        if (!cancelled) setFormLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    campaignId,
    cloneFromId,
    isEdit,
    isClone,
    authHeaders,
    checkTokenExpired,
    defaultBusinessId,
    onClose,
  ]);

  const handleRecipientsImported = (parsed) => {
    if (!parsed?.length) return;
    const formatted = formatRecipientsWhatsapp(parsed);
    const { recipients, added, skippedDuplicate } = mergeImportedRecipients(
      formData.recipients,
      formatted,
    );
    setFormData((p) => ({ ...p, recipients }));
    if (skippedDuplicate > 0) {
      notifySuccess(
        `Added ${added} recipient(s). Skipped ${skippedDuplicate} duplicate(s).`,
      );
    }
  };

  const handleExportRecipients = async () => {
    const filled = (formData.recipients || []).filter(
      (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
    );
    if (filled.length === 0) {
      notifyError("No recipients to export");
      return;
    }

    const safeTitle = (formData.title || "campaign")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .slice(0, 60);

    if (campaignId) {
      try {
        const response = await axios.get(
          `${Base_URL}/broadcasts/${campaignId}/recipients/export`,
          {
            responseType: "blob",
            headers: authHeaders,
          },
        );
        if (checkTokenExpired?.(response)) return;
        const blob = new Blob([response.data], {
          type:
            response.headers["content-type"] ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = urlObj;
        a.download = `${safeTitle || "recipients"}_recipients.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
        notifySuccess(`Exported ${filled.length} recipient(s)`);
      } catch (error) {
        notifyError(error.response?.data?.error || "Export failed");
      }
      return;
    }

    downloadRecipientsCsv(filled, `${safeTitle || "recipients"}_recipients.csv`);
    notifySuccess(`Exported ${filled.length} recipient(s)`);
  };

  const handleAppendImportDone = async (_null, result) => {
    if (!campaignId || !result) return;
    try {
      const response = await axios.get(`${Base_URL}/broadcasts/${campaignId}`, {
        headers: authHeaders,
      });
      if (checkTokenExpired?.(response)) return;
      const data = response.data?.data;
      if (!data) return;
      setFormData((p) => ({
        ...p,
        recipients: formatRecipientsWhatsapp(
          (data.recipients || [])
            .filter((r) => !r.systemUserId)
            .map((r) => ({
              name: r.name || "",
              email: r.email || "",
              whatsappNumber: r.whatsappNumber || "",
            })),
        ),
      }));
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to refresh recipients");
    }
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      notifyError("Campaign title is required (e.g. Leave)");
      return;
    }
    const businessId = formData.business_id || resolvedBusinessId;
    if (!businessId) {
      notifyError("Business is required");
      return;
    }
    const recipients = (formData.recipients || []).filter(
      (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
    );
    const sys = formData.systemRecipients || emptySystemConfig();
    const hasSystemRecipients =
      sys.notifyAllSystemUsers || (sys.userRoles && sys.userRoles.length > 0);
    const hasLists = (formData.recipientListIds || []).length > 0;
    if (recipients.length === 0 && !hasSystemRecipients && !hasLists) {
      notifyError("Add manual recipients, select saved list(s), or select system users / roles");
      return;
    }
    if (formData.status === "scheduled") {
      if (!formData.sendTime?.trim()) {
        notifyError("Send time is required");
        return;
      }
      if (!formData.startDate) {
        notifyError("Start date is required");
        return;
      }
      if (
        formData.sendFrequency === "custom" &&
        (!formData.sendIntervalDays || Number(formData.sendIntervalDays) < 1)
      ) {
        notifyError("Custom interval must be at least 1 day");
        return;
      }
    }

    const sendTime = (formData.sendTime || "09:00").trim();
    const startDate = toYyyyMmDd(formData.startDate) || formData.startDate || null;

    const payload = {
      business_id: businessId,
      title: formData.title.trim(),
      name: formData.title.trim(),
      status: formData.status,
      messageContent: formData.messageContent.trim(),
      sendFrequency: formData.sendFrequency,
      sendTime,
      startDate,
      recipients: recipients.map((r) => ({
        name: r.name.trim(),
        email: r.email.trim(),
        whatsappNumber: recipientToWhatsappE164(r),
      })),
      systemRecipients: {
        notifyAllSystemUsers: Boolean(sys.notifyAllSystemUsers),
        userRoles: sys.userRoles || [],
      },
      recipientListIds: formData.recipientListIds || [],
      ...(formData.sendFrequency === "custom"
        ? { sendIntervalDays: parseInt(formData.sendIntervalDays, 10) || 1 }
        : {}),
    };

    try {
      setSaving(true);
      const url = isEdit
        ? `${Base_URL}/broadcasts/${campaignId}`
        : `${Base_URL}/broadcasts`;
      const method = isEdit ? "put" : "post";
      const response = await axios[method](url, payload, { headers: authHeaders });
      if (checkTokenExpired?.(response)) return;
      notifySuccess(
        isEdit ? "Campaign updated" : isClone ? "Campaign cloned" : "Campaign created",
      );
      onClose?.();
      onSaved?.(response.data?.data);
    } catch (error) {
      notifyError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to save",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CustomModal
        open={open}
        onClose={onClose}
        title={
          isEdit
            ? `Edit — ${formData.title || "Campaign"}`
            : isClone
              ? "Clone Campaign"
              : "New Campaign"
        }
        width="960px"
        showActions
        actions={[
          { label: "Cancel", secondary: true, onClick: onClose },
          {
            label: saving ? "Saving…" : "Save Campaign",
            primary: true,
            onClick: handleSave,
            disabled: saving || formLoading,
          },
        ]}
      >
        <div className="space-y-5">
          <BroadcastWhatsAppIntegrationAlert
            businessId={resolvedBusinessId}
            whatsappRecipientCount={resolvedWhatsappRecipientCount || null}
          />
          {formLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
          ) : (
            <>
            <FormSection
              step="1"
              title="Campaign details"
              description={
                hideBusinessField
                  ? "Title, message, and schedule"
                  : "Title, business, message, and schedule"
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!hideBusinessField && (
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Business *</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={formData.business_id}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          business_id: e.target.value,
                          systemRecipients: emptySystemConfig(),
                          recipientListIds: [],
                        }))
                      }
                      disabled={isEdit}
                    >
                      <option value="">Select business</option>
                      {businesses.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <FormInput
                  direction="column"
                  label="Campaign title *"
                  placeholder='e.g. "Leave"'
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                />
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formData.status}
                    onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  >
                    {BROADCAST_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">What to send</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[90px]"
                    value={formData.messageContent}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, messageContent: e.target.value }))
                    }
                    placeholder="Tomorrow is a public holiday. Office will be closed."
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-1">
                <p className="text-sm font-medium text-gray-800 mb-3">When to send</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Frequency</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={formData.sendFrequency}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, sendFrequency: e.target.value }))
                      }
                    >
                      {SEND_FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.sendFrequency === "custom" && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Every N days</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        value={formData.sendIntervalDays}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            sendIntervalDays: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Send time *</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={formData.sendTime}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, sendTime: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Start date *</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={toYyyyMmDd(formData.startDate) || formData.startDate || ""}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, startDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Same time is used on each repeat send.
                </p>
              </div>
            </FormSection>

            <FormSection
              step="2"
              title="Who receives this"
              description="Add saved lists, customers, manual rows, import a file, or pick user roles"
            >
              <MarketingListRecipientsPicker
                businessId={formData.business_id}
                selectedListIds={formData.recipientListIds}
                onChange={(recipientListIds) =>
                  setFormData((p) => ({ ...p, recipientListIds }))
                }
                authHeaders={authHeaders}
                disabled={formLoading || saving}
              />

              <MarketingCustomerRecipientsPicker
                businessId={formData.business_id}
                recipients={formData.recipients}
                onRecipientsChange={(recipients) =>
                  setFormData((p) => ({ ...p, recipients }))
                }
                authHeaders={authHeaders}
                disabled={formLoading || saving}
              />

              <MarketingRecipientsEditor
                recipients={formData.recipients}
                announcementTitle={formData.title}
                onChange={(recipients) => setFormData((p) => ({ ...p, recipients }))}
                onImportClick={() => setImportOpen(true)}
                onExportClick={handleExportRecipients}
                exportDisabled={formLoading || saving}
              />

              <MarketingSystemRecipientsPicker
                businessId={formData.business_id}
                value={formData.systemRecipients}
                onChange={(systemRecipients) =>
                  setFormData((p) => ({ ...p, systemRecipients }))
                }
                authHeaders={authHeaders}
                disabled={formLoading || saving}
              />
            </FormSection>
            </>
          )}
        </div>
      </CustomModal>

      <BroadcastImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        mode={campaignId ? "append" : "parse"}
        announcementId={campaignId || undefined}
        onRecipientsParsed={(parsed, appendResult) => {
          if (parsed?.length) {
            handleRecipientsImported(parsed);
            return;
          }
          if (appendResult) {
            handleAppendImportDone(null, appendResult);
          }
        }}
        adminToken={adminToken}
      />
    </>
  );
};

export default BroadcastCampaignFormModal;
