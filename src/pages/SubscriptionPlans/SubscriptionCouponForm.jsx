import React, { useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { FiSearch, FiX } from "react-icons/fi";
import SubscriptionCouponServices from "@/services/SubscriptionCouponServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  Loader,
  PageHeader,
  FormInput,
  FooterButtons,
  DropdownBasic,
} from "@/page-layouts/index";
import "./subscriptionPlans.css";

const EMPTY_COUPON = {
  code: "",
  title: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  duration: "once",
  billingCycles: "3",
  usageLimit: "",
  usagePerUser: "1",
  minimumAmount: "0",
  maximumDiscount: "",
  startDate: "",
  expiryDate: "",
  isActive: true,
  applicableUsers: [],
  sendNotification: true,
};

const DISCOUNT_TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed", label: "Fixed amount (cents)" },
];

const DURATION_OPTIONS = [
  { value: "once", label: "Once (first payment only)" },
  { value: "forever", label: "Forever (every renewal)" },
  { value: "repeating", label: "Repeating (N billing cycles)" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const toDateInput = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const fieldLabel = (text, required = false, hint = "") => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {text}
    {required ? <span className="text-red-500"> *</span> : null}
    {hint ? (
      <span className="ml-1 text-xs font-normal text-gray-400">{hint}</span>
    ) : null}
  </label>
);

const Section = ({ title, description, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
    {title ? (
      <div className="border-b border-gray-100 pb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description ? (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        ) : null}
      </div>
    ) : null}
    {children}
  </div>
);

const SubscriptionCouponForm = () => {
  const history = useHistory();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [form, setForm] = useState(EMPTY_COUPON);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await SubscriptionCouponServices.get(id);
        const coupon = res.coupon;
        if (cancelled || !coupon) return;
        setForm({
          code: coupon.code || "",
          title: coupon.title || "",
          description: coupon.description || "",
          discountType: coupon.discountType || "percentage",
          discountValue:
            coupon.discountValue != null ? String(coupon.discountValue) : "",
          duration: coupon.duration || "once",
          billingCycles:
            coupon.billingCycles != null ? String(coupon.billingCycles) : "3",
          usageLimit:
            coupon.usageLimit != null ? String(coupon.usageLimit) : "",
          usagePerUser:
            coupon.usagePerUser != null ? String(coupon.usagePerUser) : "1",
          minimumAmount:
            coupon.minimumAmount != null ? String(coupon.minimumAmount) : "0",
          maximumDiscount:
            coupon.maximumDiscount != null
              ? String(coupon.maximumDiscount)
              : "",
          startDate: toDateInput(coupon.startDate),
          expiryDate: toDateInput(coupon.expiryDate),
          isActive: coupon.isActive !== false,
          sendNotification: true,
          applicableUsers: (coupon.applicableUsers || []).map((u) =>
            typeof u === "object"
              ? {
                  id: u.id || u._id,
                  _id: u.id || u._id,
                  name: u.name || "",
                  email: u.email || "",
                }
              : { id: String(u), _id: String(u), name: "", email: "" },
          ),
        });
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load coupon.");
        history.push("/subscription-catalog/coupons");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, history]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = userQuery.trim();
    if (q.length < 2) {
      setUserResults([]);
      return undefined;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await SubscriptionCouponServices.searchUsers(q);
        const selected = new Set(
          (form.applicableUsers || []).map((u) => String(u.id || u._id)),
        );
        setUserResults(
          (res.users || []).filter((u) => !selected.has(String(u.id || u._id))),
        );
      } catch {
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [userQuery, form.applicableUsers]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addUser = (user) => {
    const uid = String(user.id || user._id);
    setForm((prev) => {
      if ((prev.applicableUsers || []).some((u) => String(u.id || u._id) === uid)) {
        return prev;
      }
      return {
        ...prev,
        applicableUsers: [...(prev.applicableUsers || []), user],
      };
    });
    setUserQuery("");
    setUserResults([]);
  };

  const removeUser = (uid) => {
    setForm((prev) => ({
      ...prev,
      applicableUsers: (prev.applicableUsers || []).filter(
        (u) => String(u.id || u._id) !== String(uid),
      ),
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!form.code.trim() || !form.title.trim()) {
      notifyError("Code and title are required.");
      return;
    }
    if (!(form.applicableUsers || []).length) {
      notifyError("Select at least one applicable user.");
      return;
    }
    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      notifyError("Enter a valid discount value.");
      return;
    }
    const duration = form.duration || "once";
    if (duration === "repeating") {
      const cycles = Number(form.billingCycles);
      if (!Number.isFinite(cycles) || cycles < 1) {
        notifyError("Enter billing cycles (at least 1) for repeating coupons.");
        return;
      }
    }

    const body = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue,
      duration,
      billingCycles:
        duration === "repeating" ? Number(form.billingCycles) : null,
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      usagePerUser: Number(form.usagePerUser) || 1,
      minimumAmount: Number(form.minimumAmount) || 0,
      maximumDiscount:
        form.maximumDiscount === "" ? null : Number(form.maximumDiscount),
      startDate: form.startDate || null,
      expiryDate: form.expiryDate || null,
      isActive: form.isActive === true,
      sendNotification: form.sendNotification === true,
      applicableUsers: (form.applicableUsers || []).map((u) => u.id || u._id),
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await SubscriptionCouponServices.update(id, body)
        : await SubscriptionCouponServices.create(body);
      const message =
        res?.message ||
        (isEdit ? "Coupon updated." : "Coupon created.");
      const failed = res?.emailResults?.failed || 0;
      if (failed > 0) notifyError(message);
      else notifySuccess(message);
      history.push("/subscription-catalog/coupons");
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save coupon.");
    } finally {
      setSaving(false);
    }
  };

  const handleResendEmail = async () => {
    if (!isEdit || !id) return;
    setResending(true);
    try {
      const res = await SubscriptionCouponServices.resendEmail(id);
      const failed = res?.emailResults?.failed || 0;
      const message =
        res?.message || "Coupon email sent to assigned users.";
      if (failed > 0) notifyError(message);
      else notifySuccess(message);
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to resend coupon email.",
      );
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="sp-page">
        <div className="sp-loading">
          <Loader color="var(--p-blue)" />
        </div>
      </div>
    );
  }

  return (
    <div className="sp-page">
      <PageHeader
        title={isEdit ? "Edit Coupon" : "Create Coupon"}
        description="Assign this code to specific users. Only listed users can redeem it at checkout."
        showBackButton
        backFallbackPath="/subscription-catalog/coupons"
        showAddButton={false}
      />

      <form className="space-y-6 mt-4" onSubmit={handleSubmit}>
        <Section title="Basic details">
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Coupon code", true)}
              <FormInput
                type="text"
                value={form.code}
                placeholder="WELCOME20"
                onChange={(e) =>
                  setField("code", String(e.target.value || "").toUpperCase())
                }
                noLabel
              />
            </div>
            <div>
              {fieldLabel("Title", true)}
              <FormInput
                type="text"
                value={form.title}
                placeholder="Welcome discount"
                onChange={(e) => setField("title", e.target.value)}
                noLabel
              />
            </div>
          </div>

          <div>
            {fieldLabel("Description")}
            <FormInput
              type="textarea"
              rows={2}
              value={form.description}
              placeholder="Optional notes shown internally"
              onChange={(e) => setField("description", e.target.value)}
              noLabel
            />
          </div>
        </Section>

        <Section
          title="Discount & usage"
          description="Set how much to discount and how often the coupon can be used."
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Discount type", true)}
              <DropdownBasic
                options={DISCOUNT_TYPE_OPTIONS}
                value={form.discountType}
                onChange={(value) => setField("discountType", value)}
                placeholder="Select discount type"
                width="100%"
                isClearable={false}
              />
            </div>
            <div>
              {fieldLabel(
                form.discountType === "percentage"
                  ? "Discount (%)"
                  : "Discount (cents)",
                true,
              )}
              <FormInput
                type="number"
                min="0"
                value={form.discountValue}
                onChange={(e) => setField("discountValue", e.target.value)}
                noLabel
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Usage limit (total)", false, "empty = unlimited")}
              <FormInput
                type="number"
                min="0"
                value={form.usageLimit}
                onChange={(e) => setField("usageLimit", e.target.value)}
                noLabel
              />
            </div>
            <div>
              {fieldLabel("Usage per user")}
              <FormInput
                type="number"
                min="1"
                value={form.usagePerUser}
                onChange={(e) => setField("usagePerUser", e.target.value)}
                noLabel
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Minimum amount (cents)")}
              <FormInput
                type="number"
                min="0"
                value={form.minimumAmount}
                onChange={(e) => setField("minimumAmount", e.target.value)}
                noLabel
              />
            </div>
            <div>
              {fieldLabel("Maximum discount (cents)", false, "optional")}
              <FormInput
                type="number"
                min="0"
                value={form.maximumDiscount}
                onChange={(e) => setField("maximumDiscount", e.target.value)}
                noLabel
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Duration", true)}
              <DropdownBasic
                options={DURATION_OPTIONS}
                value={form.duration || "once"}
                onChange={(value) => setField("duration", value || "once")}
                placeholder="Select duration"
                width="100%"
                isClearable={false}
              />
              <p className="sp-help">
                Once = first invoice only. Forever = every renewal. Repeating =
                first N billing cycles.
              </p>
            </div>
            {form.duration === "repeating" ? (
              <div>
                {fieldLabel("Billing cycles", true)}
                <FormInput
                  type="number"
                  min="1"
                  value={form.billingCycles}
                  placeholder="e.g. 3"
                  onChange={(e) => setField("billingCycles", e.target.value)}
                  noLabel
                />
                <p className="sp-help">
                  Discount applies for this many subscription invoices, then
                  full price.
                </p>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Validity & status">
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Start date")}
              <FormInput
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                noLabel
              />
            </div>
            <div>
              {fieldLabel("Expiry date")}
              <FormInput
                type="date"
                value={form.expiryDate}
                onChange={(e) => setField("expiryDate", e.target.value)}
                noLabel
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Status")}
              <DropdownBasic
                options={STATUS_OPTIONS}
                value={form.isActive ? "true" : "false"}
                onChange={(value) => setField("isActive", value === "true")}
                placeholder="Select status"
                width="100%"
                isClearable={false}
              />
            </div>
          </div>

          <label className="inline-flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
              checked={form.sendNotification === true}
              onChange={(e) => setField("sendNotification", e.target.checked)}
            />
            <span>
              Email coupon code to assigned users when saving
              {!form.isActive ? " (only when coupon is active)" : ""}
            </span>
          </label>

          {isEdit ? (
            <div className="sp-coupon-resend">
              <button
                type="button"
                className="sp-btn sp-btn--ghost sp-btn--sm"
                onClick={handleResendEmail}
                disabled={resending || saving || !form.isActive}
              >
                {resending ? "Sending email…" : "Resend coupon email now"}
              </button>
              <p className="sp-help">
                Sends the coupon code immediately without saving other changes.
              </p>
            </div>
          ) : null}
        </Section>

        <Section
          title="Assigned users"
          description="Search by name or email. Only listed users can redeem this coupon."
        >
          <div className="sp-coupon-users__search">
            <FiSearch className="sp-coupon-users__search-icon" aria-hidden />
            <input
              type="text"
              className="sp-input sp-coupon-users__search-input"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search users by name or email…"
            />
            {searchingUsers ? (
              <span className="sp-coupon-users__hint">Searching…</span>
            ) : null}
          </div>

          {userResults.length > 0 ? (
            <ul className="sp-coupon-users__results">
              {userResults.map((user) => (
                <li key={user.id || user._id}>
                  <button type="button" onClick={() => addUser(user)}>
                    <strong>{user.name || "User"}</strong>
                    <span>{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {(form.applicableUsers || []).length > 0 ? (
            <div className="sp-coupon-users__chips">
              {(form.applicableUsers || []).map((user) => {
                const uid = user.id || user._id;
                return (
                  <span key={uid} className="sp-chip">
                    <span className="sp-chip__text">
                      {user.name || user.email || uid}
                      {user.name && user.email ? (
                        <span className="sp-chip__sub">{user.email}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="sp-chip__remove"
                      aria-label={`Remove ${user.name || user.email || uid}`}
                      onClick={() => removeUser(uid)}
                    >
                      <FiX />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="sp-coupon-users__empty">
              No users assigned yet. Search above to add at least one user.
            </div>
          )}
        </Section>

        <FooterButtons
          onCancel={() => history.push("/subscription-catalog/coupons")}
          onSave={handleSubmit}
          saveButtonText={isEdit ? "Save changes" : "Create coupon"}
          cancelButtonText="Cancel"
          loading={saving}
          disableSubmission={saving}
        />
      </form>
    </div>
  );
};

export default SubscriptionCouponForm;
