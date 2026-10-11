import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import RegistrationServices from "@/services/RegistrationServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  Loader,
  PageHeader,
  FormInput,
  DropdownBasic,
  FooterButtons,
} from "@/page-layouts/index";
import SubscriptionCurrencySelect from "./SubscriptionCurrencySelect";
import "./subscriptionPlans.css";

const formatUserLimitLabel = (mode, fixedUsers, minUsers, maxUsers) => {
  if (mode === "unlimited") {
    return "Unlimited users";
  }
  if (mode === "maximum") {
    const max = parseInt(maxUsers ?? fixedUsers, 10);
    if (!Number.isFinite(max) || max < 1) return "";
    return `Up to ${max} user${max === 1 ? "" : "s"}`;
  }
  if (mode === "minimum") {
    const min = parseInt(minUsers, 10);
    if (!Number.isFinite(min) || min < 1) return "";
    return `${min}+ users`;
  }
  if (mode === "range") {
    const min = parseInt(minUsers, 10);
    const max = parseInt(maxUsers, 10);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < 1) {
      return "";
    }
    if (min === max) return `${max} user${max === 1 ? "" : "s"}`;
    return `${min} to ${max} users`;
  }
  const count = parseInt(fixedUsers, 10);
  if (!Number.isFinite(count) || count < 1) return "";
  return `${count} user${count === 1 ? "" : "s"}`;
};

const isUserLimitFeature = (text) => {
  const value = String(text || "").trim();
  if (!value) return false;
  return (
    /^unlimited\s+users?$/i.test(value) ||
    /^\d+\s+users?$/i.test(value) ||
    /^\d+\+\s+users?$/i.test(value) ||
    /^\d+\s+to\s+\d+\s+users?$/i.test(value) ||
    /^up to\s+\d+\s+users?$/i.test(value) ||
    /^\d+\s+to\s+\d+\s+system users?$/i.test(value) ||
    /^up to\s+\d+\s+system users?$/i.test(value)
  );
};

const DISCOUNT_FEATURE_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:volume\s+)?discount/i;

const isDiscountFeature = (text) => {
  const value = String(text || "").trim();
  if (!value) return false;
  return DISCOUNT_FEATURE_RE.test(value);
};

const mergeUserLimitIntoFeatures = (features, userLimitLabel) => {
  const manualFeatures = (features || []).filter(
    (feature) => !isUserLimitFeature(feature) && !isDiscountFeature(feature),
  );
  if (!userLimitLabel) {
    return manualFeatures.length ? manualFeatures : [""];
  }
  const rest = manualFeatures.filter((feature) => String(feature).trim());
  return [userLimitLabel, ...(rest.length ? rest : [""])];
};

const applyUserLimitToFeatures = (nextForm) => {
  const label = formatUserLimitLabel(
    nextForm.userLimitMode,
    nextForm.fixedUsers,
    nextForm.minUsers,
    nextForm.maxUsers,
  );
  return {
    ...nextForm,
    features: mergeUserLimitIntoFeatures(nextForm.features, label),
  };
};

const EMPTY_PLAN = {
  name: "",
  code: "",
  description: "",
  monthlyCents: 0,
  yearlyCents: 0,
  currency: "usd",
  features: [""],
  recommended: false,
  badge: "",
  color: "#0C2E5A",
  order: 0,
  active: true,
  discountPercent: 0,
  discountDuration: "forever",
  discountBillingCycles: 3,
  planType: "tier",
  pricingChannel: "self-service",
  includedUsers: 3,
  userLimitMode: "fixed",
  fixedUsers: 5,
  minUsers: 5,
  maxUsers: 5,
};

const PLAN_TYPE_OPTIONS = [
  { value: "tier", label: "Tier (per extra user)" },
  { value: "core", label: "Core (mandatory branch fee)" },
];

const PRICING_CHANNEL_OPTIONS = [
  { value: "self-service", label: "Self-service pricing" },
  { value: "invitation", label: "Invitation pricing" },
];

const USER_LIMIT_MODE_OPTIONS = [
  { value: "fixed", label: "Exact number" },
  { value: "range", label: "Range (min to max)" },
  { value: "minimum", label: "From minimum (no max)" },
];

const INVITATION_USER_LIMIT_OPTIONS = [
  { value: "unlimited", label: "Unlimited" },
  { value: "maximum", label: "Maximum users" },
];

const PLAN_DISCOUNT_TYPE_OPTIONS = [
  { value: "once", label: "Once (first payment only)" },
  { value: "forever", label: "Forever (every renewal)" },
  { value: "repeating", label: "Repeating (N billing cycles)" },
];

const dollarsToCents = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
};

const centsToDollars = (cents) => {
  const amount = Number(cents || 0);
  if (!Number.isFinite(amount)) return "";
  return (amount / 100).toFixed(2);
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

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
    {title ? (
      <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">
        {title}
      </h2>
    ) : null}
    {children}
  </div>
);

const resolveLoadedUserLimitMode = (plan, isInvitation) => {
  const unlimited =
    plan.unlimitedMaxUsers === true || plan.maxUsers == null;
  if (isInvitation) {
    return unlimited ? "unlimited" : "maximum";
  }
  if (unlimited) return "minimum";
  const minUsers = Math.max(
    1,
    Number(plan.minUsers) || Number(plan.maxUsers) || 5,
  );
  const maxUsers = Math.max(minUsers, Number(plan.maxUsers) || minUsers);
  return minUsers === maxUsers ? "fixed" : "range";
};

const SubscriptionPlanForm = () => {
  const history = useHistory();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_PLAN);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const isInvitation = form.pricingChannel === "invitation";

  const userLimitPreview = formatUserLimitLabel(
    form.userLimitMode,
    form.fixedUsers,
    form.minUsers,
    form.maxUsers,
  );

  const setUserLimitField = (field, value) => {
    setForm((prev) => applyUserLimitToFeatures({ ...prev, [field]: value }));
  };

  const setUserLimitMode = (mode) => {
    setForm((prev) =>
      applyUserLimitToFeatures({ ...prev, userLimitMode: mode }),
    );
  };

  useEffect(() => {
    if (!isEdit) {
      setForm((prev) => applyUserLimitToFeatures(prev));
    }
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await RegistrationServices.getPricingPlan(id);
        const plan = res.plan || {};
        const pricingChannel =
          plan.pricingChannel === "invitation"
            ? "invitation"
            : "self-service";
        const isInvitationPlan = pricingChannel === "invitation";
        const unlimited =
          plan.unlimitedMaxUsers === true || plan.maxUsers == null;
        const minUsers = Math.max(
          1,
          Number(plan.minUsers) || Number(plan.maxUsers) || 5,
        );
        const maxUsers = unlimited
          ? null
          : Math.max(minUsers, Number(plan.maxUsers) || minUsers);
        const userLimitMode = resolveLoadedUserLimitMode(
          plan,
          isInvitationPlan,
        );
        const loadedForm = {
          ...EMPTY_PLAN,
          ...plan,
          planType: isInvitationPlan
            ? "tier"
            : plan.planType === "core"
              ? "core"
              : "tier",
          pricingChannel,
          includedUsers: Math.max(0, Number(plan.includedUsers) || 3),
          monthlyPrice: centsToDollars(plan.monthlyCents),
          discountPercent:
            Number(plan.discountPercent) ||
            Number(plan.effectiveDiscountPercent) ||
            0,
          discountDuration: ["once", "forever", "repeating"].includes(
            plan.discountDuration,
          )
            ? plan.discountDuration
            : "forever",
          discountBillingCycles:
            plan.discountBillingCycles != null
              ? Number(plan.discountBillingCycles)
              : 3,
          features: plan.features?.length ? plan.features : [""],
          userLimitMode,
          fixedUsers: maxUsers ?? minUsers,
          minUsers: isInvitationPlan ? 1 : minUsers,
          maxUsers: maxUsers ?? minUsers,
        };
        setForm(applyUserLimitToFeatures(loadedForm));
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load plan.");
        history.push("/subscription-catalog");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, history]);

  const setField = (field, value) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "pricingChannel") {
        if (value === "invitation") {
          next.planType = "tier";
          next.includedUsers = 0;
          next.userLimitMode = "unlimited";
          next.minUsers = 1;
          next.maxUsers = 1;
          next.fixedUsers = 1;
          return applyUserLimitToFeatures(next);
        }
        if (prev.pricingChannel === "invitation") {
          next.userLimitMode = "fixed";
          next.fixedUsers = 5;
          next.minUsers = 5;
          next.maxUsers = 5;
          next.includedUsers = next.includedUsers || 3;
          return applyUserLimitToFeatures(next);
        }
      }

      if (field === "planType" && value === "core") {
        next.badge = next.badge || "MANDATORY FOR ALL CLIENTS";
        next.includedUsers = next.includedUsers || 3;
      }
      return next;
    });

  const setFeature = (index, value) =>
    setForm((prev) => {
      const features = [...prev.features];
      features[index] = value;
      return { ...prev, features };
    });

  const addFeature = () =>
    setForm((prev) => ({ ...prev, features: [...prev.features, ""] }));

  const removeFeature = (index) =>
    setForm((prev) => {
      if (index === 0 && isUserLimitFeature(prev.features[0])) {
        return prev;
      }
      return applyUserLimitToFeatures({
        ...prev,
        features: prev.features.filter((_, i) => i !== index),
      });
    });

  const buildUserLimitsForSubmit = () => {
    if (isInvitation) {
      if (form.userLimitMode === "unlimited") {
        return { minUsers: 1, maxUsers: null, unlimitedMaxUsers: true };
      }
      const maxUsers = parseInt(form.maxUsers ?? form.fixedUsers, 10);
      if (!Number.isFinite(maxUsers) || maxUsers < 1) {
        throw new Error("Maximum users must be at least 1.");
      }
      return { minUsers: 1, maxUsers, unlimitedMaxUsers: false };
    }

    if (form.planType === "core") {
      const included = Math.max(0, parseInt(form.includedUsers, 10) || 3);
      return {
        minUsers: included,
        maxUsers: included,
        unlimitedMaxUsers: false,
      };
    }

    const userLimitMode = form.userLimitMode;

    if (userLimitMode === "minimum") {
      const minUsers = parseInt(form.minUsers, 10);
      if (!Number.isFinite(minUsers) || minUsers < 1) {
        throw new Error("Minimum users must be at least 1.");
      }
      return { minUsers, maxUsers: null, unlimitedMaxUsers: true };
    }

    if (userLimitMode === "range") {
      const minUsers = parseInt(form.minUsers, 10);
      const maxUsers = parseInt(form.maxUsers, 10);
      if (!Number.isFinite(minUsers) || minUsers < 1) {
        throw new Error("Minimum users must be at least 1.");
      }
      if (!Number.isFinite(maxUsers) || maxUsers < 1) {
        throw new Error("Maximum users must be at least 1.");
      }
      if (minUsers > maxUsers) {
        throw new Error("Minimum users cannot be greater than maximum users.");
      }
      return { minUsers, maxUsers, unlimitedMaxUsers: false };
    }

    const maxUsers = parseInt(form.fixedUsers, 10);
    if (!Number.isFinite(maxUsers) || maxUsers < 1) {
      throw new Error("Enter a valid user limit (at least 1).");
    }
    return { minUsers: maxUsers, maxUsers, unlimitedMaxUsers: false };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notifyError("Plan name is required.");
      return;
    }

    let minUsers;
    let maxUsers;
    let unlimitedMaxUsers;
    try {
      ({ minUsers, maxUsers, unlimitedMaxUsers } = buildUserLimitsForSubmit());
    } catch (err) {
      notifyError(err.message);
      return;
    }

    const syncedForm = applyUserLimitToFeatures(form);
    const discountPercent = Math.min(
      100,
      Math.max(0, Math.round(Number(form.discountPercent) || 0)),
    );
    const discountDuration =
      discountPercent > 0
        ? ["once", "forever", "repeating"].includes(form.discountDuration)
          ? form.discountDuration
          : "forever"
        : "forever";
    let discountBillingCycles = null;
    if (discountPercent > 0 && discountDuration === "repeating") {
      const cycles = Math.round(Number(form.discountBillingCycles));
      if (!Number.isFinite(cycles) || cycles < 1) {
        notifyError("Billing cycles must be at least 1 for repeating discounts.");
        return;
      }
      discountBillingCycles = cycles;
    }

    const payload = {
      ...syncedForm,
      name: form.name.trim(),
      description: form.description.trim(),
      planType: isInvitation
        ? "tier"
        : form.planType === "core"
          ? "core"
          : "tier",
      pricingChannel: isInvitation ? "invitation" : "self-service",
      includedUsers:
        !isInvitation && form.planType === "core"
          ? Math.max(0, parseInt(form.includedUsers, 10) || 3)
          : 0,
      monthlyCents: dollarsToCents(form.monthlyPrice),
      discountPercent,
      discountDuration,
      discountBillingCycles,
      features: syncedForm.features.map((f) => f.trim()).filter(Boolean),
      order: parseInt(form.order, 10) || 0,
      minUsers,
      maxUsers,
      unlimitedMaxUsers,
    };

    delete payload.monthlyPrice;
    delete payload.userLimitMode;
    delete payload.fixedUsers;

    setSaving(true);
    try {
      if (isEdit) {
        await RegistrationServices.updatePricingPlan(id, payload);
        notifySuccess("Plan updated.");
      } else {
        await RegistrationServices.createPricingPlan(payload);
        notifySuccess("Plan created.");
      }
      history.push("/subscription-catalog");
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save plan.");
    } finally {
      setSaving(false);
    }
  };

  const renderDiscountFields = () => {
    const discPct = Math.max(0, Number(form.discountPercent) || 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            {fieldLabel("Volume discount", false, "(% off list price)")}
            <FormInput
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="0"
              value={form.discountPercent ?? 0}
              onChange={(e) => setField("discountPercent", e.target.value)}
              noLabel
            />
          </div>
          <div>
            {fieldLabel("Discount type")}
            <DropdownBasic
              options={PLAN_DISCOUNT_TYPE_OPTIONS}
              value={form.discountDuration || "forever"}
              onChange={(value) =>
                setField("discountDuration", value || "forever")
              }
              placeholder="Select discount type"
              width="100%"
              isClearable={false}
              isDisabled={discPct <= 0}
            />
          </div>
        </div>
        {discPct > 0 && form.discountDuration === "repeating" ? (
          <div className="max-w-xs">
            {fieldLabel("Billing cycles", true)}
            <FormInput
              type="number"
              min="1"
              placeholder="e.g. 3"
              value={form.discountBillingCycles ?? 3}
              onChange={(e) =>
                setField("discountBillingCycles", e.target.value)
              }
              noLabel
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderInvitationUserLimitFields = () => {
    const previewField = (
      <div>
        {fieldLabel("Preview", false, "(shown on pricing screen)")}
        <FormInput
          type="text"
          value={userLimitPreview}
          readOnly
          inActive
          placeholder="Select a user limit"
          noLabel
        />
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="max-w-md">
          {fieldLabel("User limit", false, "(optional capacity)")}
          <DropdownBasic
            options={INVITATION_USER_LIMIT_OPTIONS}
            value={form.userLimitMode}
            onChange={(value) => setUserLimitMode(value)}
            placeholder="Select user limit"
            width="100%"
            isClearable={false}
          />
        </div>

        {form.userLimitMode === "maximum" ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Maximum users")}
              <FormInput
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={form.maxUsers}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) =>
                    applyUserLimitToFeatures({
                      ...prev,
                      maxUsers: value,
                      fixedUsers: value,
                    }),
                  );
                }}
                noLabel
              />
            </div>
            {previewField}
          </div>
        ) : (
          <div className="max-w-md">{previewField}</div>
        )}
      </div>
    );
  };

  const renderSelfServiceUserLimitFields = () => {
    if (form.planType !== "tier") return null;

    const previewField = (
      <div>
        {fieldLabel("Preview", false, "(shown on pricing screen)")}
        <FormInput
          type="text"
          value={userLimitPreview}
          readOnly
          inActive
          placeholder="Enter user limits above"
          noLabel
        />
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="max-w-md">
          {fieldLabel("User limit type")}
          <DropdownBasic
            options={USER_LIMIT_MODE_OPTIONS}
            value={form.userLimitMode}
            onChange={(value) => setUserLimitMode(value)}
            placeholder="Select limit type"
            width="100%"
            isClearable={false}
          />
        </div>

        {form.userLimitMode === "range" ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Minimum users")}
              <FormInput
                type="number"
                min="1"
                value={form.minUsers}
                onChange={(e) => setUserLimitField("minUsers", e.target.value)}
                noLabel
              />
            </div>
            <div>
              {fieldLabel("Maximum users")}
              <FormInput
                type="number"
                min="1"
                value={form.maxUsers}
                onChange={(e) => setUserLimitField("maxUsers", e.target.value)}
                noLabel
              />
            </div>
            {previewField}
          </div>
        ) : form.userLimitMode === "minimum" ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Starting from")}
              <FormInput
                type="number"
                min="1"
                placeholder="200"
                value={form.minUsers}
                onChange={(e) => setUserLimitField("minUsers", e.target.value)}
                noLabel
              />
            </div>
            {previewField}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Number of users")}
              <FormInput
                type="number"
                min="1"
                placeholder="5"
                value={form.fixedUsers}
                onChange={(e) =>
                  setUserLimitField("fixedUsers", e.target.value)
                }
                noLabel
              />
            </div>
            {previewField}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  return (
    <div className="sp-page">
      <PageHeader
        title={isEdit ? "Edit Pricing Plan" : "Create Pricing Plan"}
        description={
          isInvitation
            ? "Invitation plans use a fixed monthly fee assigned by admin."
            : "Set plan details, pricing, and display options."
        }
        showBackButton
        backFallbackPath="/subscription-catalog"
        showAddButton={false}
      />

      <form className="space-y-6 mt-4" onSubmit={handleSubmit}>
        <Section title="Basic details">
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Plan name", true)}
              <FormInput
                type="text"
                value={form.name}
                placeholder="e.g. Premium"
                onChange={(e) => setField("name", e.target.value)}
                noLabel
              />
            </div>
            <div>
              {fieldLabel(
                "Code",
                false,
                isEdit ? "(fixed)" : "(optional)",
              )}
              <FormInput
                type="text"
                value={form.code || ""}
                placeholder="e.g. premium"
                disabled={isEdit}
                onChange={(e) => setField("code", e.target.value)}
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
              placeholder="Short tagline shown under the plan name"
              onChange={(e) => setField("description", e.target.value)}
              noLabel
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Pricing channel")}
              <DropdownBasic
                options={PRICING_CHANNEL_OPTIONS}
                value={form.pricingChannel}
                onChange={(value) => setField("pricingChannel", value)}
                placeholder="Select pricing channel"
                width="100%"
                isClearable={false}
              />
            </div>
            {!isInvitation ? (
              <div>
                {fieldLabel("Plan type")}
                <DropdownBasic
                  options={PLAN_TYPE_OPTIONS}
                  value={form.planType}
                  onChange={(value) => setField("planType", value)}
                  placeholder="Select plan type"
                  width="100%"
                  isClearable={false}
                />
              </div>
            ) : (
              <div>
                {fieldLabel("Pricing model")}
                <FormInput
                  type="text"
                  value="Fixed monthly"
                  readOnly
                  inActive
                  noLabel
                />
              </div>
            )}
          </div>
          {!isInvitation && form.planType === "core" ? (
            <div className="max-w-xs">
              {fieldLabel("Free users included")}
              <FormInput
                type="number"
                min="0"
                value={form.includedUsers}
                onChange={(e) => setField("includedUsers", e.target.value)}
                noLabel
              />
            </div>
          ) : null}
        </Section>

        <Section title="Pricing">
          {isInvitation ? (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  {fieldLabel("Monthly Fixed Price", true)}
                  <FormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.monthlyPrice ?? centsToDollars(form.monthlyCents)
                    }
                    onChange={(e) => setField("monthlyPrice", e.target.value)}
                    noLabel
                  />
                </div>
                <div>
                  {fieldLabel("Currency")}
                  <SubscriptionCurrencySelect
                    value={form.currency || "usd"}
                    onChange={(next) => setField("currency", next)}
                    width="100%"
                  />
                </div>
              </div>
              {renderDiscountFields()}
              {renderInvitationUserLimitFields()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  {fieldLabel(
                    form.planType === "core"
                      ? "Monthly price (per branch)"
                      : "Monthly price (per extra user)",
                  )}
                  <FormInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.monthlyPrice ?? centsToDollars(form.monthlyCents)
                    }
                    onChange={(e) => setField("monthlyPrice", e.target.value)}
                    noLabel
                  />
                </div>
                <div>
                  {fieldLabel("Currency")}
                  <SubscriptionCurrencySelect
                    value={form.currency || "usd"}
                    onChange={(next) => setField("currency", next)}
                    width="100%"
                  />
                </div>
              </div>

              {renderDiscountFields()}

              {renderSelfServiceUserLimitFields()}
            </>
          )}
        </Section>

        <Section title="Display & status">
          <div className="grid grid-cols-2 gap-6">
            <div>
              {fieldLabel("Badge text", false, "(optional)")}
              <FormInput
                type="text"
                value={form.badge}
                placeholder="e.g. Most Popular"
                onChange={(e) => setField("badge", e.target.value)}
                noLabel
              />
            </div>
            <div>
              {fieldLabel("Display order")}
              <FormInput
                type="number"
                value={form.order}
                onChange={(e) => setField("order", e.target.value)}
                noLabel
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                checked={form.recommended}
                onChange={(e) => setField("recommended", e.target.checked)}
              />
              Mark as recommended
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                checked={form.active}
                onChange={(e) => setField("active", e.target.checked)}
              />
              Active (visible to customers)
            </label>
          </div>
        </Section>

        <Section title="Features">
          {form.features.map((feature, index) => {
            const isAutoFeature = index === 0 && isUserLimitFeature(feature);
            return (
              <div className="flex gap-2 items-center" key={`feature-${index}`}>
                <div className="relative flex-1">
                  <FormInput
                    type="text"
                    value={feature}
                    placeholder={`Feature ${index + 1}`}
                    readOnly={isAutoFeature}
                    disabled={isAutoFeature}
                    onChange={(e) => setFeature(index, e.target.value)}
                    noLabel
                  />
                  {isAutoFeature ? (
                    <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-semibold">
                      Auto
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                  disabled={isAutoFeature}
                  onClick={() => removeFeature(index)}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="text-sm font-medium text-[var(--p-blue)] hover:text-[#0C2E5A]"
            onClick={addFeature}
          >
            + Add feature
          </button>
        </Section>

        <FooterButtons
          saveButtonText={isEdit ? "Update Plan" : "Create Plan"}
          cancelButtonText="Cancel"
          onCancel={() => history.push("/subscription-catalog")}
          loading={saving}
          disableSubmission={saving}
        />
      </form>
    </div>
  );
};

export default SubscriptionPlanForm;
