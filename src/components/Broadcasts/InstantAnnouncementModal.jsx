import React, { useState } from "react";
import axios from "axios";
import { CustomModal, FormInput } from "@/page-layouts";
import MarketingRecipientsEditor from "@/components/Broadcasts/MarketingRecipientsEditor";
import MarketingCustomerRecipientsPicker from "@/components/Broadcasts/MarketingCustomerRecipientsPicker";
import MarketingListRecipientsPicker from "@/components/Broadcasts/MarketingListRecipientsPicker";
import MarketingSystemRecipientsPicker, {
  emptySystemConfig,
} from "@/components/Broadcasts/MarketingSystemRecipientsPicker";
import BroadcastImportModal from "@/components/Broadcasts/BroadcastImportModal";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  formatRecipientsWhatsapp,
  recipientToWhatsappE164,
} from "@/utils/whatsappPhoneFormat";
import { mergeImportedRecipients } from "@/utils/broadcastCustomerRecipients";
import BroadcastWhatsAppIntegrationAlert, {
  countWhatsappRecipients,
} from "@/components/Broadcasts/BroadcastWhatsAppIntegrationAlert";
import {
  getSoleAssignedBusinessId,
  isSingleAssignedBusiness,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emptyInstantForm = (businessId = "") => ({
  business_id: businessId,
  title: "",
  messageContent: "",
  recipients: [],
  recipientListIds: [],
  systemRecipients: emptySystemConfig(),
});

function InstantFormSection({ step, title, description, children }) {
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

export default function InstantAnnouncementModal({
  open,
  onClose,
  businesses = [],
  defaultBusinessId = "",
  authHeaders,
  adminToken,
  checkTokenExpired,
}) {
  const [formData, setFormData] = useState(() => emptyInstantForm(defaultBusinessId));
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const hideBusinessField = isSingleAssignedBusiness() || businesses.length === 1;
  const resolvedBusinessId =
    formData.business_id ||
    defaultBusinessId ||
    (businesses.length === 1 ? businesses[0]._id : "") ||
    getSoleAssignedBusinessId() ||
    "";
  const resetAndClose = () => {
    setFormData(emptyInstantForm(defaultBusinessId || resolvedBusinessId));
    onClose();
  };

  React.useEffect(() => {
    if (open) {
      const soleId =
        defaultBusinessId ||
        (businesses.length === 1 ? businesses[0]._id : "") ||
        getSoleAssignedBusinessId() ||
        "";
      setFormData((p) => ({
        ...emptyInstantForm(soleId || p.business_id),
        title: p.title,
        messageContent: p.messageContent,
        recipients: p.recipients,
        recipientListIds: p.recipientListIds,
        systemRecipients: p.systemRecipients,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBusinessId]);

  const handleSend = async () => {
    const businessId = formData.business_id || resolvedBusinessId;
    if (!businessId) {
      notifyError("Business is required");
      return;
    }
    if (!formData.title?.trim()) {
      notifyError("Subject / name is required (used as email subject)");
      return;
    }
    if (!formData.messageContent?.trim()) {
      notifyError("Message is required");
      return;
    }

    const recipients = (formData.recipients || []).filter(
      (r) => r.name?.trim() || r.email?.trim() || r.whatsappNumber?.trim(),
    );
    const sys = formData.systemRecipients || emptySystemConfig();
    const hasSystem =
      sys.notifyAllSystemUsers || (sys.userRoles && sys.userRoles.length > 0);
    const hasLists = (formData.recipientListIds || []).length > 0;
    if (recipients.length === 0 && !hasSystem && !hasLists) {
      notifyError("Add recipients, select saved list(s), or select user role(s)");
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(
        `${Base_URL}/broadcasts/instant-send`,
        {
          business_id: businessId,
          title: formData.title.trim(),
          messageContent: formData.messageContent.trim(),
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
        },
        { headers: authHeaders },
      );
      if (checkTokenExpired?.(response)) return;

      const data = response.data?.data || {};
      const count = data.totalRecipients ?? 0;
      notifySuccess(
        count > 0
          ? `Sending to ${count} recipient(s) in the background. You'll be notified when it's done.`
          : "Instant send queued. You'll be notified when it's done.",
      );
      resetAndClose();
    } catch (error) {
      notifyError(error.response?.data?.error || "Instant send failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <CustomModal
        open={open}
        onClose={resetAndClose}
        title="Instant Campaign"
        width="900px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: resetAndClose,
            disabled: submitting,
          },
          {
            label: submitting ? "Starting…" : "Send now",
            primary: true,
            onClick: handleSend,
            disabled: submitting,
          },
        ]}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Messages are sent in the background. You can close this and keep working —
            you&apos;ll get an in-app notification when sending is complete.
            Nothing is saved to the campaigns list.
          </p>

          <BroadcastWhatsAppIntegrationAlert
            businessId={resolvedBusinessId}
            whatsappRecipientCount={countWhatsappRecipients(formData.recipients) || null}
          />

            <InstantFormSection
              step="1"
              title="Message"
              description="What everyone will receive right now"
            >
              {!hideBusinessField && (
                <div>
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
                    disabled={submitting}
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
                label="Subject / name *"
                placeholder='e.g. "New Product Launch"'
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                disabled={submitting}
              />

              <div>
                <label className="block text-sm text-gray-600 mb-1">Message *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[100px]"
                  value={formData.messageContent}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, messageContent: e.target.value }))
                  }
                  placeholder="Your announcement text…"
                  disabled={submitting}
                />
              </div>
            </InstantFormSection>

            <InstantFormSection
              step="2"
              title="Recipients"
              description="Saved lists, customers, manual rows, file import, or user roles"
            >
              <MarketingListRecipientsPicker
                businessId={formData.business_id}
                selectedListIds={formData.recipientListIds}
                onChange={(recipientListIds) =>
                  setFormData((p) => ({ ...p, recipientListIds }))
                }
                authHeaders={authHeaders}
                disabled={submitting}
              />

              <MarketingCustomerRecipientsPicker
                businessId={formData.business_id}
                recipients={formData.recipients}
                onRecipientsChange={(recipients) =>
                  setFormData((p) => ({ ...p, recipients }))
                }
                authHeaders={authHeaders}
                disabled={submitting}
              />

              <MarketingRecipientsEditor
                recipients={formData.recipients}
                onChange={(recipients) => setFormData((p) => ({ ...p, recipients }))}
                onImportClick={() => setImportOpen(true)}
              />

              <MarketingSystemRecipientsPicker
                businessId={formData.business_id}
                value={formData.systemRecipients}
                onChange={(systemRecipients) =>
                  setFormData((p) => ({ ...p, systemRecipients }))
                }
                authHeaders={authHeaders}
                disabled={submitting}
              />
            </InstantFormSection>
        </div>
      </CustomModal>

      <BroadcastImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        mode="parse"
        adminToken={adminToken}
        onRecipientsParsed={(parsed) => {
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
          setImportOpen(false);
        }}
      />
    </>
  );
}
