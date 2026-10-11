import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import PhoneInput, {
  isValidPhoneNumber,
  parsePhoneNumber,
} from "react-phone-number-input";
import enPhoneLabels from "react-phone-number-input/locale/en.json";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import {
  FiMail,
  FiPhone,
  FiBriefcase,
  FiUser,
  FiMessageSquare,
  FiEdit2,
  FiArrowLeft,
  FiHash,
  FiCalendar,
} from "react-icons/fi";
import { AdminContext } from "@/context/AdminContext";
import { PageHeader, useFormScreenExit, Form, DropdownBasic } from "@/page-layouts/index";
import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import EpcSurface from "@/components/Epc/EpcSurface";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import { notifyError } from "@/utils/toast";
import {
  getSoleAssignedBusinessId,
  readAssignedBusinessesFallback,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import EnquiryServices, {
  ENQUIRING_FOR_OPTIONS,
  ENQUIRY_CHANNEL_OPTIONS,
  ENQUIRY_STATUS_OPTIONS,
  MANDATORY_INSPECTION_SERVICE_OPTIONS,
  THIRD_PARTY_INSPECTION_SERVICE_OPTIONS,
  INSPECTION_OTHERS_VALUE,
  includesInspectionOthers,
  emptyInspectionEnquiryFields,
} from "@/services/EnquiryServices";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const PHONE_COUNTRY = "MY";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Prefer E.164; if local digits only, parse with default country (MY). */
function normalizeEnquiryPhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (isValidPhoneNumber(raw)) return raw;
  try {
    const parsed = parsePhoneNumber(raw, PHONE_COUNTRY);
    if (parsed?.number && isValidPhoneNumber(parsed.number)) {
      return parsed.number;
    }
  } catch (_) {
    /* keep raw */
  }
  return raw;
}

const STATUS_STYLES = {
  Open: "bg-sky-50 text-sky-800 ring-sky-200",
  Converted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Closed: "bg-slate-100 text-slate-700 ring-slate-200",
  Spam: "bg-rose-50 text-rose-800 ring-rose-200",
};

const TYPE_STYLES = {
  Certification: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  Inspection: "bg-amber-50 text-amber-900 ring-amber-200",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[status] || "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {status || "—"}
    </span>
  );
}

function TypePill({ value }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
        TYPE_STYLES[value] || "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {value || "—"}
    </span>
  );
}

function DetailItem({ icon: Icon, label, children }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden /> : null}
        <span>{label}</span>
      </div>
      <div className="text-[15px] font-medium text-slate-900 break-words leading-snug">
        {children || <span className="text-slate-400 font-normal">—</span>}
      </div>
    </div>
  );
}

function EnquiryView({
  formData,
  enquiryMeta,
  businessName,
  onBack,
  onEdit,
  canUpdate,
  enquiryId,
  headers,
}) {
  const submittedAt = enquiryMeta?.createdAt
    ? new Date(enquiryMeta.createdAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const fetchInspectionPdf = useCallback(async () => {
    const res = await EnquiryServices.getEnquiryPdf(enquiryId, { headers });
    return new Blob([res.data], { type: "application/pdf" });
  }, [enquiryId, headers]);

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <div className="w-full max-w-full mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3 transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Enquiries
            </button>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {formData.name || "Enquiry"}
              </h1>
              <StatusPill status={formData.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {enquiryMeta?.enquiryNumber ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <FiHash className="w-3.5 h-3.5" />
                  {enquiryMeta.enquiryNumber}
                </span>
              ) : null}
              {submittedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5" />
                  {submittedAt}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canUpdate ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--p-blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <FiEdit2 className="w-4 h-4" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Contact details
              </h2>
              <TypePill value={formData.enquiringFor} />
            </div>
            <div className="px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <DetailItem icon={FiUser} label="Name">
                {formData.name}
              </DetailItem>
              <DetailItem icon={FiMail} label="Email">
                {formData.email ? (
                  <a
                    href={`mailto:${formData.email}`}
                    className="text-[var(--p-blue)] hover:underline"
                  >
                    {formData.email}
                  </a>
                ) : null}
              </DetailItem>
              <DetailItem icon={FiPhone} label="Phone">
                {formData.phone ? (
                  <a
                    href={`tel:${formData.phone}`}
                    className="text-slate-900 hover:text-[var(--p-blue)]"
                  >
                    {formData.phone}
                  </a>
                ) : null}
              </DetailItem>
              <DetailItem icon={FiBriefcase} label="Company">
                {formData.companyName}
              </DetailItem>
              {businessName ? (
                <DetailItem label="Business">{businessName}</DetailItem>
              ) : null}
              <DetailItem label="Enquiry Channel">
                {formData.enquiryChannel}
              </DetailItem>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            </div>
            <div className="px-5 sm:px-6 py-5 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Status
                </p>
                <StatusPill status={formData.status} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Enquiring For
                </p>
                <TypePill value={formData.enquiringFor} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Channel
                </p>
                <p className="text-sm font-medium text-slate-800">
                  {formData.enquiryChannel || "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <FiMessageSquare className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Enquiry message
              </h2>
            </div>
            <div className="px-5 sm:px-6 py-5">
              {formData.enquiry?.trim() ? (
                <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {formData.enquiry}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No enquiry message provided.
                </p>
              )}
            </div>
          </section>

          {formData.enquiringFor === "Inspection" ? (
            <>
              <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Engineering Inspection (legacy)
                  </h2>
                </div>
                <div className="px-5 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                      Section A — Mandatory Inspection Services
                    </p>
                    {(formData.mandatoryInspectionServices || []).length ? (
                      <ul className="space-y-2 text-sm text-slate-800 list-disc pl-5">
                        {(formData.mandatoryInspectionServices || []).map(
                          (item) => (
                            <li key={item}>{item}</li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        None selected
                      </p>
                    )}
                    {formData.mandatoryInspectionOthers ? (
                      <p className="mt-3 text-sm text-slate-800">
                        <span className="font-medium text-slate-600">
                          Others:{" "}
                        </span>
                        {formData.mandatoryInspectionOthers}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                      Section B — Third Party Inspection
                    </p>
                    {(formData.thirdPartyInspectionServices || []).length ? (
                      <ul className="space-y-2 text-sm text-slate-800 list-disc pl-5">
                        {(formData.thirdPartyInspectionServices || []).map(
                          (item) => (
                            <li key={item}>{item}</li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        None selected
                      </p>
                    )}
                    {formData.thirdPartyInspectionOthers ? (
                      <p className="mt-3 text-sm text-slate-800">
                        <span className="font-medium text-slate-600">
                          Others:{" "}
                        </span>
                        {formData.thirdPartyInspectionOthers}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Temporarily hidden — re-enable by restoring `enquiryId ? (...)` */}
              {false && enquiryId ? (
                <div className="lg:col-span-3">
                  <EpcSurface>
                    <Card>
                      <CardHeader
                        title="Documents"
                        subtitle="Generated enquiry form, exactly as it is issued."
                      />
                      <DocumentPreview
                        title="Enquiry Form for Engineering Inspection"
                        documentCode="AQCTA-FOR-06-01"
                        audience="internal"
                        defaultOpen
                        available
                        note="Filled from this enquiry’s Section A / B selections."
                        fileName={`AQCTA-FOR-06-01-${
                          enquiryMeta?.enquiryNumber || enquiryId
                        }.pdf`}
                        fetchPdf={fetchInspectionPdf}
                        refreshToken={[
                          formData.mandatoryInspectionServices,
                          formData.mandatoryInspectionOthers,
                          formData.thirdPartyInspectionServices,
                          formData.thirdPartyInspectionOthers,
                          formData.name,
                          formData.email,
                          formData.phone,
                          formData.companyName,
                          formData.enquiry,
                        ].join("|")}
                      />
                    </Card>
                  </EpcSurface>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const EnquiryForm = () => {
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const exitScreen = useFormScreenExit("/enquiries");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const isView = location.pathname.includes("/enquiries/view/");
  const routePerms = useRouteModulePermissions();

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token]
  );

  const [businesses, setBusinesses] = useState(() =>
    readAssignedBusinessesFallback()
  );
  const [businessesLoading, setBusinessesLoading] = useState(
    () => readAssignedBusinessesFallback().length === 0
  );
  const [isLoadingForm, setIsLoadingForm] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [enquiryMeta, setEnquiryMeta] = useState({
    enquiryNumber: "",
    createdAt: null,
  });
  const [formData, setFormData] = useState(() => {
    const cached = readAssignedBusinessesFallback();
    return {
      business_id: getSoleAssignedBusinessId(cached) || cached?.[0]?._id || "",
      name: "",
      email: "",
      phone: "",
      companyName: "",
      enquiringFor: "",
      enquiry: "",
      enquiryChannel: "Domestic",
      status: "Open",
      ...emptyInspectionEnquiryFields(),
    };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      setBusinessesLoading(false);
      if (!id) {
        setFormData((prev) => ({
          ...prev,
          business_id:
            prev.business_id ||
            getSoleAssignedBusinessId(list) ||
            list?.[0]?._id ||
            "",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingForm(true);
        const response = await EnquiryServices.getEnquiryById(id, { headers });
        if (cancelled) return;
        const row = response.data?.data;
        if (!row) {
          notifyError("Enquiry not found.");
          history.push("/enquiries");
          return;
        }
        setFormData({
          business_id: row.business_id?._id || row.business_id || "",
          name: row.name || "",
          email: row.email || "",
          phone: normalizeEnquiryPhone(row.phone || ""),
          companyName: row.companyName || "",
          enquiringFor: row.enquiringFor || "",
          enquiry: row.enquiry || "",
          enquiryChannel: row.enquiryChannel || "Domestic",
          status: row.status || "Open",
          mandatoryInspectionServices: row.mandatoryInspectionServices || [],
          mandatoryInspectionOthers: row.mandatoryInspectionOthers || "",
          thirdPartyInspectionServices: row.thirdPartyInspectionServices || [],
          thirdPartyInspectionOthers: row.thirdPartyInspectionOthers || "",
        });
        setEnquiryMeta({
          enquiryNumber: row.enquiryNumber || "",
          createdAt: row.createdAt || null,
        });
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load enquiry.");
        history.push("/enquiries");
      } finally {
        if (!cancelled) setIsLoadingForm(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const clearFieldError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    clearFieldError(name);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const next = {};
    const phone = normalizeEnquiryPhone(formData.phone);
    if (!formData.business_id) next.business_id = "Business is required";
    if (!formData.name?.trim()) next.name = "Name is required";
    if (!formData.email?.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(formData.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (!phone) next.phone = "Phone is required";
    else if (!isValidPhoneNumber(phone)) {
      next.phone = "Enter a valid phone number with country code";
    }
    if (!formData.enquiringFor) {
      next.enquiringFor = "Enquiring For is required";
    }
    if (formData.enquiringFor === "Inspection") {
      if (!(formData.mandatoryInspectionServices || []).length) {
        next.mandatoryInspectionServices =
          "Select at least one Mandatory Inspection Service";
      }
      if (
        includesInspectionOthers(formData.mandatoryInspectionServices) &&
        !formData.mandatoryInspectionOthers?.trim()
      ) {
        next.mandatoryInspectionOthers = `Please specify ${INSPECTION_OTHERS_VALUE}`;
      }
      if (
        includesInspectionOthers(formData.thirdPartyInspectionServices) &&
        !formData.thirdPartyInspectionOthers?.trim()
      ) {
        next.thirdPartyInspectionOthers = `Please specify ${INSPECTION_OTHERS_VALUE}`;
      }
    }
    if (!formData.enquiryChannel) {
      next.enquiryChannel = "Enquiry Channel is required";
    }
    if (!formData.status) next.status = "Status is required";
    setErrors(next);
    if (phone && phone !== formData.phone) {
      setFormData((prev) => ({ ...prev, phone }));
    }
    return next;
  };

  const handleSubmit = async () => {
    if (isView) return false;
    const validationErrors = validate();
    const firstError = Object.values(validationErrors).find(Boolean);
    if (firstError) {
      notifyError(firstError);
      return false;
    }
    setSaving(true);
    try {
      const phone = normalizeEnquiryPhone(formData.phone);
      const isInspection = formData.enquiringFor === "Inspection";
      const payload = {
        business_id: formData.business_id,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone,
        companyName: formData.companyName?.trim() || "",
        enquiringFor: formData.enquiringFor,
        enquiry: formData.enquiry?.trim() || "",
        enquiryChannel: formData.enquiryChannel,
        status: formData.status,
        mandatoryInspectionServices: isInspection
          ? formData.mandatoryInspectionServices || []
          : [],
        mandatoryInspectionOthers: isInspection
          ? formData.mandatoryInspectionOthers?.trim() || ""
          : "",
        thirdPartyInspectionServices: isInspection
          ? formData.thirdPartyInspectionServices || []
          : [],
        thirdPartyInspectionOthers: isInspection
          ? formData.thirdPartyInspectionOthers?.trim() || ""
          : "",
      };
      if (id) {
        await EnquiryServices.updateEnquiry(id, payload, { headers });
      } else {
        await EnquiryServices.createEnquiry(payload, { headers });
      }
      return { success: true };
    } catch (err) {
      const apiMessage =
        err?.response?.data?.message || "Failed to save enquiry.";
      const apiField = err?.response?.data?.field;
      if (
        apiField === "email" ||
        /email already exists/i.test(String(apiMessage))
      ) {
        setErrors((prev) => ({
          ...prev,
          email: apiMessage,
        }));
      }
      throw new Error(apiMessage);
    } finally {
      setSaving(false);
    }
  };

  const businessName =
    businesses.find((b) => String(b._id) === String(formData.business_id))
      ?.name || "";

  const formFields = [
    {
      label: "Business",
      name: "business_id",
      type: "select",
      required: true,
      value: formData.business_id,
      onChange: (value) => {
        clearFieldError("business_id");
        setFormData((prev) => ({ ...prev, business_id: value || "" }));
      },
      placeholder: "Select Business",
      disabled: businessesLoading || !!id || businesses.length === 1,
      error: errors.business_id,
      shouldShowError: !!errors.business_id,
      options: [
        { value: "", label: "Select Business" },
        ...businesses.map((b) => ({
          value: b._id,
          label: b.name,
          key: b._id,
        })),
      ],
    },
    {
      label: "Name",
      name: "name",
      type: "text",
      required: true,
      value: formData.name,
      onChange: handleInputChange,
      placeholder: "Contact person name",
      error: errors.name,
      shouldShowError: !!errors.name,
    },
    {
      label: "Email",
      name: "email",
      type: "email",
      required: true,
      value: formData.email,
      onChange: handleInputChange,
      placeholder: "name@example.com",
      error: errors.email,
      shouldShowError: !!errors.email,
    },
    {
      label: "Phone",
      name: "phone",
      type: "custom",
      required: true,
      error: errors.phone,
      shouldShowError: !!errors.phone,
      component: () => (
        <div
          className={`w-full enquiry-phone-wrap${
            errors.phone ? " enquiry-phone-wrap--error" : ""
          }`}
        >
          <PhoneInput
            international
            defaultCountry={PHONE_COUNTRY}
            labels={enPhoneLabels}
            flags={flags}
            addInternationalOption={false}
            value={formData.phone || undefined}
            onChange={(value) => {
              clearFieldError("phone");
              setFormData((prev) => ({ ...prev, phone: value || "" }));
            }}
            placeholder="Enter phone number"
            className="enquiry-phone-input"
            numberInputProps={{
              name: "phone",
              autoComplete: "tel",
              "aria-label": "Phone number",
              "aria-invalid": !!errors.phone,
            }}
          />
        </div>
      ),
    },
    {
      label: "Company Name",
      name: "companyName",
      type: "text",
      required: false,
      value: formData.companyName,
      onChange: handleInputChange,
      placeholder: "Company name (optional)",
    },
    {
      label: "Enquiring For",
      name: "enquiringFor",
      type: "select",
      required: true,
      value: formData.enquiringFor,
      onChange: (value) => {
        clearFieldError("enquiringFor");
        setFormData((prev) => ({
          ...prev,
          enquiringFor: value || "",
          ...(value !== "Inspection" ? emptyInspectionEnquiryFields() : {}),
        }));
      },
      placeholder: "Select one",
      error: errors.enquiringFor,
      shouldShowError: !!errors.enquiringFor,
      options: [
        { value: "", label: "Select one" },
        ...ENQUIRING_FOR_OPTIONS.map((opt) => ({
          value: opt,
          label: opt,
        })),
      ],
    },
    ...(formData.enquiringFor === "Inspection"
      ? [
          {
            label: "Mandatory Inspection Services",
            name: "mandatoryInspectionServices",
            type: "custom",
            required: true,
            fullWidth: true,
            error: errors.mandatoryInspectionServices,
            shouldShowError: !!errors.mandatoryInspectionServices,
            component: () => {
              const selected = formData.mandatoryInspectionServices || [];
              const showOthers = includesInspectionOthers(selected);
              return (
                <div className="w-full space-y-3">
                  <DropdownBasic
                    isMulti
                    sortOptions={false}
                    value={selected}
                    options={MANDATORY_INSPECTION_SERVICE_OPTIONS.map(
                      (opt) => ({
                        value: opt,
                        label: opt,
                      }),
                    )}
                    placeholder="Select one or more"
                    error={errors.mandatoryInspectionServices}
                    shouldShowError={!!errors.mandatoryInspectionServices}
                    showErrorText={false}
                    onChange={(value) => {
                      clearFieldError("mandatoryInspectionServices");
                      clearFieldError("mandatoryInspectionOthers");
                      const next = Array.isArray(value) ? value : [];
                      setFormData((prev) => ({
                        ...prev,
                        mandatoryInspectionServices: next,
                        mandatoryInspectionOthers: includesInspectionOthers(
                          next,
                        )
                          ? prev.mandatoryInspectionOthers
                          : "",
                      }));
                    }}
                  />
                  {showOthers ? (
                    <div>
                      <label
                        htmlFor="mandatoryInspectionOthers"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Please specify (Others) *
                      </label>
                      <input
                        id="mandatoryInspectionOthers"
                        name="mandatoryInspectionOthers"
                        type="text"
                        autoFocus
                        value={formData.mandatoryInspectionOthers || ""}
                        placeholder="Enter the other mandatory inspection service"
                        onChange={(e) => {
                          clearFieldError("mandatoryInspectionOthers");
                          setFormData((prev) => ({
                            ...prev,
                            mandatoryInspectionOthers: e.target.value,
                          }));
                        }}
                        className={`w-full border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 rounded-[12px] shadow-sm px-[16px] py-[8px] bg-gray-100 text-sm ${
                          errors.mandatoryInspectionOthers
                            ? "ring-1 ring-red-400 border-red-400"
                            : ""
                        }`}
                      />
                      {errors.mandatoryInspectionOthers ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.mandatoryInspectionOthers}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            },
          },
          {
            label: "Third Party Inspection, Verification and Endorsement",
            name: "thirdPartyInspectionServices",
            type: "custom",
            required: false,
            fullWidth: true,
            error: errors.thirdPartyInspectionServices,
            shouldShowError: !!errors.thirdPartyInspectionServices,
            component: () => {
              const selected = formData.thirdPartyInspectionServices || [];
              const showOthers = includesInspectionOthers(selected);
              return (
                <div className="w-full space-y-3">
                  <DropdownBasic
                    isMulti
                    sortOptions={false}
                    value={selected}
                    options={THIRD_PARTY_INSPECTION_SERVICE_OPTIONS.map(
                      (opt) => ({
                        value: opt,
                        label: opt,
                      }),
                    )}
                    placeholder="Select one or more"
                    error={errors.thirdPartyInspectionServices}
                    shouldShowError={!!errors.thirdPartyInspectionServices}
                    showErrorText={false}
                    onChange={(value) => {
                      clearFieldError("thirdPartyInspectionServices");
                      clearFieldError("thirdPartyInspectionOthers");
                      const next = Array.isArray(value) ? value : [];
                      setFormData((prev) => ({
                        ...prev,
                        thirdPartyInspectionServices: next,
                        thirdPartyInspectionOthers: includesInspectionOthers(
                          next,
                        )
                          ? prev.thirdPartyInspectionOthers
                          : "",
                      }));
                    }}
                  />
                  {showOthers ? (
                    <div>
                      <label
                        htmlFor="thirdPartyInspectionOthers"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Please specify (Others) *
                      </label>
                      <input
                        id="thirdPartyInspectionOthers"
                        name="thirdPartyInspectionOthers"
                        type="text"
                        autoFocus
                        value={formData.thirdPartyInspectionOthers || ""}
                        placeholder="Enter the other third party inspection service"
                        onChange={(e) => {
                          clearFieldError("thirdPartyInspectionOthers");
                          setFormData((prev) => ({
                            ...prev,
                            thirdPartyInspectionOthers: e.target.value,
                          }));
                        }}
                        className={`w-full border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 rounded-[12px] shadow-sm px-[16px] py-[8px] bg-gray-100 text-sm ${
                          errors.thirdPartyInspectionOthers
                            ? "ring-1 ring-red-400 border-red-400"
                            : ""
                        }`}
                      />
                      {errors.thirdPartyInspectionOthers ? (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.thirdPartyInspectionOthers}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            },
          },
        ]
      : []),
    {
      label: "Enquiry",
      name: "enquiry",
      type: "textarea",
      required: false,
      value: formData.enquiry,
      onChange: handleInputChange,
      placeholder: "Describe the enquiry…",
      fullWidth: true,
    },
    {
      label: "Enquiry Channel",
      name: "enquiryChannel",
      type: "select",
      required: true,
      value: formData.enquiryChannel,
      onChange: (value) => {
        clearFieldError("enquiryChannel");
        setFormData((prev) => ({ ...prev, enquiryChannel: value || "" }));
      },
      placeholder: "Select channel",
      error: errors.enquiryChannel,
      shouldShowError: !!errors.enquiryChannel,
      options: ENQUIRY_CHANNEL_OPTIONS.map((opt) => ({
        value: opt,
        label: opt,
      })),
    },
    {
      label: "Status",
      name: "status",
      type: "select",
      required: true,
      value: formData.status,
      onChange: (value) => {
        clearFieldError("status");
        setFormData((prev) => ({ ...prev, status: value || "Open" }));
      },
      error: errors.status,
      shouldShowError: !!errors.status,
      options: (formData.status === "Converted"
        ? ENQUIRY_STATUS_OPTIONS.filter((opt) => opt !== "Open")
        : ENQUIRY_STATUS_OPTIONS
      ).map((opt) => ({
        value: opt,
        label: opt,
      })),
    },
  ];

  if (isLoadingForm) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-[var(--p-blue)] rounded-full animate-spin" />
      </div>
    );
  }

  if (isView) {
    return (
      <EnquiryView
        formData={formData}
        enquiryMeta={enquiryMeta}
        businessName={businessName}
        canUpdate={routePerms.canUpdate}
        enquiryId={id}
        headers={headers}
        onBack={exitScreen}
        onEdit={() => history.push(`/enquiries/edit/${id}`)}
      />
    );
  }

  const title = id ? "Edit Enquiry" : "Add Enquiry";

  return (
    <div className="py-6 px-6 min-h-screen">
      <PageHeader
        title={title}
        showBackButton
        onBackClick={exitScreen}
        backFallbackPath="/enquiries"
      />
      <Form
        formFields={formFields}
        handleSubmit={handleSubmit}
        handleCancel={exitScreen}
        isSubmitting={saving}
        showFooterButtons
        labelAndFieldDirection="column"
        tightLabelInputSpacing
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
        submitSuccessMessage={
          id
            ? "Enquiry updated successfully"
            : "Enquiry created successfully"
        }
        afterSubmit={exitScreen}
      />

      <style>{`
        .enquiry-phone-wrap .enquiry-phone-input {
          display: flex;
          align-items: center;
          width: 100%;
          border: 1px solid transparent;
          border-radius: 12px;
          background: #f3f4f6;
          padding: 8px 16px;
          min-height: 42px;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        }
        .enquiry-phone-wrap .enquiry-phone-input:focus-within {
          border-color: #93c5fd;
          box-shadow: 0 0 0 1px rgba(191, 219, 254, 1);
        }
        .enquiry-phone-wrap--error .enquiry-phone-input {
          border-color: #fca5a5;
          box-shadow: 0 0 0 1px rgba(252, 165, 165, 0.8);
        }
        .enquiry-phone-wrap .enquiry-phone-input .PhoneInputInput {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent !important;
          width: 100%;
          font-size: 0.95rem;
          color: #0f172a;
        }
        .enquiry-phone-wrap .enquiry-phone-input .PhoneInputCountry {
          margin-right: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default EnquiryForm;
