import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import ReactSelect from "react-select";
import { LoadScript, Autocomplete } from "@react-google-maps/api";
import {
  ActionButtons,
  CustomModal,
  DataTable,
  DateRangeComponent,
  DropdownBasic,
  FormInput,
  Page,
} from "@/page-layouts/index";
import reactSelectConfig from "@/utils/react-select-style-config";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { notifyError, notifySuccess } from "@/utils/toast";
import OperationsServices from "@/services/OperationsServices";
import { AdminContext } from "@/context/AdminContext";
import { formatDate, formatDateTime } from "@/components/formatAmount";
import {
  FiArrowLeft,
  FiCheck,
  FiEdit2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { Tooltip } from "react-tooltip";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const parseDateLikeValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Try native parser first (handles ISO and many standard formats)
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) return native;

  // Handle: "YYYY-MM-DD HH:mm[:ss]" (space instead of "T")
  const normalizedIsoLike = raw.replace(" ", "T");
  const isoLike = new Date(normalizedIsoLike);
  if (!Number.isNaN(isoLike.getTime())) return isoLike;

  // Handle: "DD/MM/YYYY hh:mm AM/PM"
  const dmy12h = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?)?$/
  );
  if (dmy12h) {
    const day = Number(dmy12h[1]);
    const month = Number(dmy12h[2]);
    const year = Number(dmy12h[3]);
    let hour = Number(dmy12h[4] || 0);
    const minute = Number(dmy12h[5] || 0);
    const meridiem = (dmy12h[6] || "").toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const toDateTimeLocal = (value) => {
  const date = parseDateLikeValue(value);
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const getCustomerLabel = (customer) => {
  if (!customer) return "";
  const display = customer?.basicInformation?.customerDisplayName;
  if (display) return display;

  const first = customer?.basicInformation?.primaryContact?.firstName || "";
  const last = customer?.basicInformation?.primaryContact?.lastName || "";
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;

  return (
    customer?.basicInformation?.companyName ||
    customer?.basicInformation?.customerEmail ||
    "-"
  );
};

/** Rows for read-only campaign details (order matches previous inline map). */
const buildCampaignReadOnlyFields = (campaign) => [
  { label: "Business", value: campaign?.business_id?.name || "-" },
  { label: "Campaign Title", value: campaign?.campaign_title || "-" },
  { label: "Advertiser", value: getCustomerLabel(campaign?.advertiser) || "-" },
  {
    label: "Campaign Stage",
    value: (
      <span
        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
          campaign?.campaign_status === "Open"
            ? "bg-emerald-100 text-emerald-700"
            : campaign?.campaign_status === "Closed"
            ? "bg-rose-100 text-rose-700"
            : "bg-slate-100 text-slate-700"
        }`}
      >
        {campaign?.campaign_status || "-"}
      </span>
    ),
  },
  {
    label: "Start Date",
    value: campaign?.campaign_start_date ? formatDateTime(campaign.campaign_start_date) : "-",
  },
  {
    label: "End Date",
    value: campaign?.campaign_end_date ? formatDateTime(campaign.campaign_end_date) : "-",
  },
  {
    label: "Application Deadline",
    value: formatDateTime(campaign?.application_deadline),
  },
  { label: "Rider payout amount", value: campaign?.rider_payment_amount ?? 0 },
  { label: "Location", value: campaign?.google_location || "-" },
  { label: "Radius (km)", value: campaign?.radius_km ?? 0 },
  { label: "City", value: campaign?.city || "-" },
  { label: "State", value: campaign?.state || "-" },
  { label: "Country", value: campaign?.country || "-" },
  {
    label: "Campaign Description",
    value: campaign?.campaign_description || "-",
    span: "md:col-span-2",
  },
];

const statusOptions = [
  { value: "Draft", label: "Draft" },
  { value: "Open", label: "Open" },
];
const applicationStatusFilterOptions = [
  { value: "all", label: "All Status" },
  { value: "Applied", label: "Applied" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Withdrawn", label: "Withdrawn" },
  { value: "Completed", label: "Completed" },
];
const deliveryStatusOptions = [
  "Pending",
  "Packed",
  "Shipped",
  "InTransit",
  "Delivered",
  "Failed",
  "Returned",
];

/** Portal menu above modal overlay; avoids expanding CustomModal’s scroll area */
const dispatchModalReactSelectStyles = {
  ...reactSelectConfig,
  menuPortal: (base) => ({ ...base, zIndex: 10050 }),
};

const getStatusBadgeClass = (value) => {
  const normalized = (value || "").toString();
  const map = {
    Pending: "bg-slate-100 text-slate-700",
    Packed: "bg-indigo-100 text-indigo-700",
    Shipped: "bg-blue-100 text-blue-700",
    InTransit: "bg-cyan-100 text-cyan-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Failed: "bg-rose-100 text-rose-700",
    Returned: "bg-amber-100 text-amber-700",
    NotStarted: "bg-slate-100 text-slate-700",
    Submitted: "bg-violet-100 text-violet-700",
    Active: "bg-emerald-100 text-emerald-700",
    Rejected: "bg-rose-100 text-rose-700",
    pending_review: "bg-violet-100 text-violet-700",
    points_credited: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    Completed: "bg-gray-200 text-gray-800",
  };
  return map[normalized] || "bg-gray-100 text-gray-700";
};

const getPointsAssignmentStatusLabel = (status) => {
  const normalized = (status || "").toString().trim();
  const map = {
    pending_review: "Pending Review",
    points_credited: "Points Credited",
    rejected: "Rejected",
  };
  return map[normalized] || normalized || "-";
};

const toReadableValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};

const formatActivityKey = (key = "") =>
  key
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildActivityFieldChanges = (entry) => {
  const before = entry?.metadata?.before;
  const after = entry?.metadata?.after;
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return [];
  }
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((key) => toReadableValue(before[key]) !== toReadableValue(after[key]))
    .map((key) => ({
      key,
      label: formatActivityKey(key),
      from: toReadableValue(before[key]),
      to: toReadableValue(after[key]),
    }));
};

const defaultForm = {
  business_id: "",
  campaign_title: "",
  campaign_description: "",
  campaign_media_file: "",
  google_location: "",
  lat: null,
  lng: null,
  advertiser: "",
  campaign_start_date: "",
  campaign_end_date: "",
  application_deadline: "",
  required_riders: 0,
  rider_payment_amount: "",
  radius_km: 0,
  city: "",
  state: "",
  country: "",
  campaign_status: "Draft",
};

export default function CampaignViewPage() {
  const history = useHistory();
  const { campaignId } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [campaign, setCampaign] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const campaignLocationAutocompleteRef = useRef(null);
  const mediaInputRef = useRef(null);
  const proofInputRef = useRef(null);

  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [applications, setApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    tracking_details: "",
    delivery_status: "Pending",
    delivery_date: "",
  });
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectSaving, setRejectSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetApplication, setRejectTargetApplication] = useState(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityItems, setActivityItems] = useState([]);
  const [activityTitle, setActivityTitle] = useState("Application Activity");
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityTotalRecords, setActivityTotalRecords] = useState(0);
  const [activityApplicationId, setActivityApplicationId] = useState("");

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token || ""}`,
    }),
    [adminInfo]
  );

  const fetchBusinesses = async () => {
    try {
      const response = await axios.get(
        `${Base_URL}/admin/assigned/${adminInfo?.id}`,
        { headers: authHeaders }
      );
      const list = (response?.data?.businesses || [])
        .map((b) => ({ value: b._id, label: b.name }))
        .sort((a, b) =>
          String(a.label || "").localeCompare(String(b.label || ""), undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
      setBusinesses(list);
    } catch {
      notifyError("Failed to fetch businesses");
    }
  };

  const fetchCustomersByBusiness = async (businessIds = []) => {
    const ids = (Array.isArray(businessIds) ? businessIds : [businessIds]).filter(
      Boolean
    );

    if (ids.length === 0) {
      setCustomers([]);
      return;
    }

    try {
      const params = { page: 1, limit: 9999 };
      if (ids.length === 1) {
        params.businessId = ids[0];
      } else {
        params.businessIds = JSON.stringify(ids);
      }

      const response = await axios.get(`${Base_URL}/customers`, { params });
      const merged = (response?.data?.customers || []).filter(Boolean);
      const deduped = Array.from(new Map(merged.map((c) => [c._id, c])).values());
      setCustomers(
        deduped.map((c) => ({
          value: c._id,
          label: getCustomerLabel(c),
        }))
      );
    } catch {
      notifyError("Failed to fetch customers");
    }
  };

  const setFormFromCampaign = async (data) => {
    const selectedBusinessId = data?.business_id?._id || data?.business_id || "";
    await fetchCustomersByBusiness(selectedBusinessId ? [selectedBusinessId] : []);

    setFormData({
      business_id: selectedBusinessId,
      campaign_title: data?.campaign_title || "",
      campaign_description: data?.campaign_description || "",
      campaign_media_file: data?.campaign_media_file || "",
      google_location: data?.google_location || "",
      lat:
        data?.lat === undefined || data?.lat === null || data?.lat === ""
          ? null
          : Number(data.lat),
      lng:
        data?.lng === undefined || data?.lng === null || data?.lng === ""
          ? null
          : Number(data.lng),
      advertiser: data?.advertiser?._id || data?.advertiser || "",
      campaign_start_date: toDateTimeLocal(data?.campaign_start_date),
      campaign_end_date: toDateTimeLocal(data?.campaign_end_date),
      application_deadline: toDateTimeLocal(data?.application_deadline),
      required_riders: Number(data?.required_riders || 0),
      rider_payment_amount:
        data?.rider_payment_amount === undefined || data?.rider_payment_amount === null
          ? ""
          : String(data.rider_payment_amount),
      radius_km: Number(data?.radius_km || 0),
      city: data?.city || "",
      state: data?.state || "",
      country: data?.country || "",
      campaign_status: data?.campaign_status || "Draft",
    });
  };

  const fetchCampaign = async () => {
    try {
      setLoadingCampaign(true);
      const response = await OperationsServices.getCampaignById(campaignId);
      const data = response?.data;
      setCampaign(data || null);
      if (data) {
        await setFormFromCampaign(data);
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to fetch campaign");
    } finally {
      setLoadingCampaign(false);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoadingApplications(true);
      const response = await OperationsServices.getCampaignApplications(campaignId, {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter,
        search: searchValue || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setApplications(response?.data || []);
      setTotalPages(response?.totalPages || 1);
      setTotalRecords(response?.total || 0);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to fetch applications");
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    const loadGoogleApiKey = async () => {
      try {
        const response = await axios.get(`${Base_URL}/configuration`);
        const configs = response?.data;
        const config =
          Array.isArray(configs) && configs.length > 0 ? configs[0] : null;
        setGoogleMapsApiKey(config?.google_api_key || "");
      } catch {
        setGoogleMapsApiKey("");
      }
    };
    loadGoogleApiKey();
  }, []);

  useEffect(() => {
    if (adminInfo?.id) fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (campaignId) fetchCampaign();
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) fetchApplications();
  }, [campaignId, currentPage, recordsPerPage, searchValue, statusFilter, startDate, endDate]);

  const handleCampaignLocationPlaceChanged = () => {
    const place = campaignLocationAutocompleteRef.current?.getPlace?.();
    if (!place) return;

    const next = {
      google_location: place.formatted_address || "",
      lat:
        typeof place.geometry?.location?.lat === "function"
          ? place.geometry.location.lat()
          : null,
      lng:
        typeof place.geometry?.location?.lng === "function"
          ? place.geometry.location.lng()
          : null,
      city: "",
      state: "",
      country: "",
    };

    const components = place.address_components || [];
    components.forEach((component) => {
      const types = component.types || [];
      if (
        types.includes("locality") ||
        types.includes("postal_town") ||
        types.includes("administrative_area_level_2")
      ) {
        if (!next.city) next.city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        next.state = component.long_name;
      } else if (types.includes("country")) {
        next.country = component.long_name;
      }
    });

    setFormData((prev) => ({ ...prev, ...next }));
  };

  const handleMediaUpload = async (file) => {
    const uploadData = new FormData();
    uploadData.append("image", file);
    try {
      setIsMediaUploading(true);
      const response = await axios.post(`${Base_URL}/upload`, uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const mediaUrl = response?.data?.url || "";
      setFormData((prev) => ({ ...prev, campaign_media_file: mediaUrl }));
      notifySuccess("Media uploaded successfully");
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to upload media");
    } finally {
      setIsMediaUploading(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (isMediaUploading) {
      return notifyError("Please wait for media upload to complete");
    }
    if (!formData.business_id) return notifyError("Business is required");
    if (!formData.campaign_title?.trim())
      return notifyError("Campaign title is required");
    if (!formData.advertiser) return notifyError("Advertiser is required");
    if (!formData.campaign_start_date || !formData.campaign_end_date) {
      return notifyError("Start and end dates are required");
    }
    if (!formData.application_deadline) {
      return notifyError("Application deadline is required");
    }
    if (
      formData.rider_payment_amount === "" ||
      !Number.isFinite(Number(formData.rider_payment_amount)) ||
      Number(formData.rider_payment_amount) < 0
    ) {
      return notifyError("Rider payout amount is required and must be non-negative");
    }
    if (new Date(formData.application_deadline) >= new Date(formData.campaign_start_date)) {
      return notifyError("Application deadline must be before campaign start date");
    }

    const payload = {
      ...formData,
      required_riders: Number(formData.required_riders || 0),
      rider_payment_amount: Number(formData.rider_payment_amount),
      radius_km: Number(formData.radius_km || 0),
      lat:
        formData.lat === undefined || formData.lat === null || formData.lat === ""
          ? null
          : Number(formData.lat),
      lng:
        formData.lng === undefined || formData.lng === null || formData.lng === ""
          ? null
          : Number(formData.lng),
      application_deadline: formData.application_deadline,
    };

    try {
      setIsSaving(true);
      await OperationsServices.updateCampaign(campaignId, payload);
      notifySuccess("Campaign updated successfully");
      await fetchCampaign();
      setIsEditMode(false);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update campaign");
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleApproveApplication = async (application) => {
    await handleUpdateStatus(application, "Approved");
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

  const openDispatchModal = (application) => {
    setSelectedApplication(application);
    setDispatchForm({
      tracking_details: application?.tracking_details || "",
      delivery_status: application?.delivery_status || "Pending",
      delivery_date: toDateTimeLocal(application?.delivery_date) || toDateTimeLocal(new Date()),
    });
    setDispatchModalOpen(true);
  };

  const handleSaveDispatch = async () => {
    if (!selectedApplication?._id) return;
    try {
      setDispatchSaving(true);
      await OperationsServices.updateCampaignApplicationDispatch(
        campaignId,
        selectedApplication._id,
        {
          tracking_details: dispatchForm.tracking_details,
          delivery_status: dispatchForm.delivery_status,
          delivery_date: dispatchForm.delivery_date || new Date().toISOString(),
        }
      );
      notifySuccess("Dispatch details updated.");
      setDispatchModalOpen(false);
      fetchApplications();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update dispatch details");
    } finally {
      setDispatchSaving(false);
    }
  };

  const handleConfirmDispatch = async (application) => {
    try {
      await OperationsServices.confirmCampaignApplicationDispatch(campaignId, application._id);
      notifySuccess("Delivery confirmed.");
      fetchApplications();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to confirm delivery");
    }
  };

  const openProofModal = (application) => {
    setSelectedApplication(application);
    setProofUrl(application?.activation_photo || "");
    setProofModalOpen(true);
  };

  const handleUploadProofFile = async (file) => {
    const uploadData = new FormData();
    uploadData.append("image", file);
    try {
      setProofUploading(true);
      const response = await axios.post(`${Base_URL}/upload`, uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedUrl = response?.data?.url || "";
      if (!uploadedUrl) {
        notifyError("Failed to upload proof file.");
        return;
      }
      setProofUrl(uploadedUrl);
      notifySuccess("Proof file uploaded successfully.");
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to upload proof file");
    } finally {
      setProofUploading(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!selectedApplication?._id) return;
    if (!proofUrl) {
      notifyError("Please upload proof image first.");
      return;
    }
    try {
      setProofUploading(true);
      await OperationsServices.uploadCampaignApplicationProof(campaignId, selectedApplication._id, {
        activation_photo: proofUrl,
      });
      notifySuccess("Activation proof submitted.");
      setProofModalOpen(false);
      fetchApplications();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to submit activation proof");
    } finally {
      setProofUploading(false);
    }
  };

  const fetchActivityLogs = async (applicationId, page = 1) => {
    if (!applicationId) return;
    try {
      setActivityLoading(true);
      const response = await OperationsServices.getCampaignApplicationActivityLogs(
        campaignId,
        applicationId,
        { page, limit: 10 }
      );
      setActivityItems(Array.isArray(response?.data) ? response.data : []);
      setActivityTotalPages(response?.totalPages || 1);
      setActivityTotalRecords(response?.total || 0);
      setActivityPage(page);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to fetch activity logs");
    } finally {
      setActivityLoading(false);
    }
  };

  const openActivityModal = (application) => {
    const riderName =
      application?.rider_id?.basicInformation?.vendorDisplayName || "Rider";
    const applicationId = application?._id || "";
    setActivityApplicationId(applicationId);
    setActivityItems([]);
    setActivityTotalPages(1);
    setActivityTotalRecords(0);
    setActivityPage(1);
    setActivityTitle(`Application Activity - ${riderName}`);
    setActivityModalOpen(true);
    fetchActivityLogs(applicationId, 1);
  };

  const renderApplicationRow = (item) => {
    const rider = item?.rider_id || {};
    const riderId = rider?._id || (typeof rider === "string" ? rider : "");
    const name = rider?.basicInformation?.vendorDisplayName || "-";
    const email = rider?.basicInformation?.vendorEmail || "-";
    const phone =
      rider?.basicInformation?.vendorPhone?.mobile ||
      rider?.basicInformation?.vendorPhone?.workPhone ||
      "-";
    const status = item?.application_status || "-";
    const canReject = ["Applied", "Approved"].includes(status);
    const deliveryStatus = item?.delivery_status || "Pending";
    const canConfirmDispatch = ["Shipped", "InTransit", "Packed"].includes(deliveryStatus);
    const canApproveApplication = deliveryStatus === "Delivered" && status === "Applied";

    return (
      <tr key={item?._id || `${name}-${email}`} className="hover:bg-gray-50">
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-600 break-all">{email}</p>
            <p className="text-xs text-gray-600">{phone}</p>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {item?.applied_at ? formatDate(item.applied_at) : "-"}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeClass(
              status
            )}`}
          >
            {status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="space-y-1 text-xs text-gray-700">
            <p className="whitespace-pre-wrap">
              <span className="font-medium">Tracking details:</span>{" "}
              {item?.tracking_details?.trim() ? item.tracking_details : "-"}
            </p>
            <p>
              <span className="font-medium">Delivery Status:</span>{" "}
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeClass(
                  deliveryStatus
                )}`}
              >
                {deliveryStatus}
              </span>
            </p>
            <p>
              <span className="font-medium">Date:</span>{" "}
              {item?.delivery_date ? formatDate(item.delivery_date) : "-"}
            </p>
            {item?.activation_photo ? (
              <div className="space-y-1">
                <a
                  href={item?.activation_photo}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  View proof image
                </a>
                {item?.activation_status ? (
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeClass(
                      item?.activation_status
                    )}`}
                  >
                    {getPointsAssignmentStatusLabel(
                      item?.activation_status
                    )}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3">
          <ActionButtons
            maxVisibleActions={2}
            items={[
              {
                action: ACTION_BUTTON_TYPES.EDIT,
                title: "Update Dispatch",
                onClick: () => openDispatchModal(item),
              },
              {
                action: ACTION_BUTTON_TYPES.APPROVE,
                title: "Confirm Received",
                onClick: () => handleConfirmDispatch(item),
                permission: canConfirmDispatch,
              },
              {
                action: ACTION_BUTTON_TYPES.APPROVE,
                title: "Approve Application",
                onClick: () => handleApproveApplication(item),
                permission: canApproveApplication,
              },
              {
                action: ACTION_BUTTON_TYPES.VIEW,
                title: "View Vendor",
                onClick: () => history.push(`/Edit Vendor/${riderId}`),
                permission: Boolean(riderId),
              },
              {
                action: ACTION_BUTTON_TYPES.HISTORY,
                title: "Activity Log",
                onClick: () => openActivityModal(item),
              },
              {
                action: ACTION_BUTTON_TYPES.DELETE,
                title: "Reject Application",
                onClick: () => openRejectModal(item),
                permission: canReject,
              },
            ]}
          />
        </td>
      </tr>
    );
  };

  const clearApplicationFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setSearchValue("");
    setCurrentPage(1);
  };

  const applicationFilters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: { onClick: clearApplicationFilters },
    },
    {
      name: "applications_date_range",
      customComponent: (
        <DateRangeComponent
          width="100%"
          startDate={startDate || ""}
          endDate={endDate || ""}
          onApply={(start, end) => {
            setStartDate(start || "");
            setEndDate(end || "");
            setCurrentPage(1);
          }}
          onClear={() => {
            setStartDate("");
            setEndDate("");
            setCurrentPage(1);
          }}
          placeholder="Select date range"
          className="w-full"
        />
      ),
    },
    {
      name: "application_status",
      label: "Application Status",
      type: "select",
      isClearable: false,
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value || "all");
        setCurrentPage(1);
      },
      options: applicationStatusFilterOptions,
    },
  ];

  const applicationTableHeaders = [
    "Rider",
    "Applied At",
    "Status",
    "Dispatch & Proof",
    "Action",
  ];

  const mediaUrl = isEditMode
    ? formData.campaign_media_file
    : campaign?.campaign_media_file;

  return (
    <Page customClassName="!overflow-x-visible">
      <div className="sticky top-0 z-20 -mx-6 px-6 pt-4 pb-0 mb-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap pb-2">
          <h2 className="text-lg font-semibold">
            {campaign?.campaign_title ? `Campaign - ${campaign.campaign_title}` : "Campaign"}
          </h2>
          <div className="flex items-center gap-2">
            <div
              data-tooltip-id="campaign-view-header-tooltip"
              data-tooltip-content="Approved / Required Riders"
              className="inline-flex items-center gap-1.5 px-2.5 h-10 rounded-md bg-gray-100 text-gray-700"
            >
              <FiUsers className="text-sm" />
              <span className="text-sm font-medium">
                {campaign?.approved_riders ?? 0} / {campaign?.required_riders ?? 0}
              </span>
            </div>
            <button
              type="button"
              data-tooltip-id="campaign-view-header-tooltip"
              data-tooltip-content="Back to Campaigns"
              className="w-10 h-10 inline-flex items-center justify-center rounded-md bg-gray-200 text-gray-800"
              onClick={() => history.push("/campaigns")}
            >
              <FiArrowLeft />
            </button>
            {isEditMode ? (
              <>
                <button
                  type="button"
                  data-tooltip-id="campaign-view-header-tooltip"
                  data-tooltip-content="Cancel"
                  onClick={async () => {
                    await setFormFromCampaign(campaign);
                    setIsEditMode(false);
                  }}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md bg-gray-200 text-gray-800"
                  disabled={isSaving}
                >
                  <FiX />
                </button>
                <button
                  type="button"
                  data-tooltip-id="campaign-view-header-tooltip"
                  data-tooltip-content="Submit"
                  onClick={handleSaveCampaign}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md bg-[var(--p-blue)] text-white"
                  disabled={isSaving || isMediaUploading}
                >
                  <FiCheck />
                </button>
              </>
            ) : (
              !loadingCampaign &&
              campaign && (
                <button
                  type="button"
                  data-tooltip-id="campaign-view-header-tooltip"
                  data-tooltip-content="Edit"
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md bg-[var(--p-blue)] text-white"
                  onClick={() => setIsEditMode(true)}
                >
                  <FiEdit2 />
                </button>
              )
            )}
          </div>
        </div>
      </div>
      <Tooltip
        id="campaign-view-header-tooltip"
        place="top"
        delayShow={200}
        noArrow
        style={{ zIndex: 10000 }}
        className="!bg-white !text-gray-800 !border !border-gray-300 !opacity-100"
      />

      <div className="bg-white rounded-lg p-5 mb-6">
        {loadingCampaign ? (
          <>
          {/* <p className="text-sm text-gray-500">Loading campaign details...</p> */}
          <section className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-[var(--p-blue)]"></div>
          </section>
          </>
        ) : !campaign ? (
          <p className="text-sm text-gray-500">Campaign not found.</p>
        ) : isEditMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 border border-gray-100 rounded-md p-4">
              <p className="text-sm font-medium mb-3">Campaign Media</p>
              <div className="w-full max-w-sm aspect-[4/3] rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                {mediaUrl ? (
                  <img
                    src={mediaUrl}
                    alt="Campaign media"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-500">No media uploaded</span>
                )}
              </div>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaUpload(file);
                  e.target.value = "";
                }}
                disabled={isMediaUploading || isSaving}
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={isMediaUploading || isSaving}
                >
                  Choose Image
                </button>
                <span className="text-xs text-gray-600 break-all">
                  {mediaUrl
                    ? decodeURIComponent((mediaUrl.split("/").pop() || "").split("?")[0])
                    : "No file chosen"}
                </span>
              </div>
              {mediaUrl && (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline mt-2 inline-block"
                >
                  View uploaded media
                </a>
              )}
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Business *</label>
                <ReactSelect
                  value={businesses.find((b) => b.value === formData.business_id) || null}
                  onChange={(opt) => {
                    const selectedBusinessId = opt ? opt.value : "";
                    setFormData((prev) => ({
                      ...prev,
                      business_id: selectedBusinessId,
                      advertiser: "",
                    }));
                    fetchCustomersByBusiness(selectedBusinessId ? [selectedBusinessId] : []);
                  }}
                  options={businesses}
                  isSearchable
                  placeholder="Select Business"
                  classNamePrefix="react-select"
                  styles={reactSelectConfig}
                />
              </div>

              <FormInput
                direction="column"
                label="Campaign Title *"
                type="text"
                value={formData.campaign_title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, campaign_title: e.target.value }))
                }
              />

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Advertiser (Customer) *
                </label>
                <ReactSelect
                  value={customers.find((c) => c.value === formData.advertiser) || null}
                  onChange={(opt) =>
                    setFormData((prev) => ({
                      ...prev,
                      advertiser: opt ? opt.value : "",
                    }))
                  }
                  options={formData.business_id ? customers : []}
                  isSearchable
                  placeholder={
                    formData.business_id ? "Select Customer" : "Select business first"
                  }
                  isDisabled={!formData.business_id}
                  classNamePrefix="react-select"
                  styles={reactSelectConfig}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Status</label>
                <ReactSelect
                  value={
                    statusOptions.find((s) => s.value === formData.campaign_status) || null
                  }
                  onChange={(opt) =>
                    setFormData((prev) => ({
                      ...prev,
                      campaign_status: opt ? opt.value : "Draft",
                    }))
                  }
                  options={statusOptions}
                  placeholder="Select Status"
                  classNamePrefix="react-select"
                  styles={reactSelectConfig}
                />
              </div>

              <FormInput
                direction="column"
                label="Start Date *"
                type="datetime-local"
                value={formData.campaign_start_date}
                onChange={(dateValue) =>
                  setFormData((prev) => ({
                    ...prev,
                    campaign_start_date: toDateTimeLocal(dateValue),
                  }))
                }
                clearable={true}
                timeIntervals={15}
              />

              <FormInput
                direction="column"
                label="End Date *"
                type="datetime-local"
                value={formData.campaign_end_date}
                onChange={(dateValue) =>
                  setFormData((prev) => ({
                    ...prev,
                    campaign_end_date: toDateTimeLocal(dateValue),
                  }))
                }
                clearable={true}
                timeIntervals={15}
              />

              <div className="md:col-span-2">
                <FormInput
                  direction="column"
                  label="Application Deadline *"
                  type="datetime-local"
                  value={formData.application_deadline}
                  onChange={(dateValue) =>
                    setFormData((prev) => ({
                      ...prev,
                      application_deadline: toDateTimeLocal(dateValue),
                    }))
                  }
                  placeholder="Select application deadline"
                  clearable={true}
                  timeIntervals={15}
                />
              </div>

              <div className="md:col-span-2">
                <FormInput
                  direction="column"
                  label="Rider payout amount *"
                  type="number"
                  placeholder="Enter payout amount for rider (RM)"
                  value={formData.rider_payment_amount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      rider_payment_amount: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <LoadScript
                  key={googleMapsApiKey || "empty-google-maps-key"}
                  googleMapsApiKey={googleMapsApiKey || ""}
                  libraries={["places"]}
                >
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      campaignLocationAutocompleteRef.current = autocomplete;
                    }}
                    onPlaceChanged={handleCampaignLocationPlaceChanged}
                    options={{ types: ["(cities)"] }}
                  >
                    <div>
                      <FormInput
                        direction="column"
                        label="Location"
                        type="text"
                        value={formData.google_location || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            google_location: e.target.value,
                            lat: null,
                            lng: null,
                          }))
                        }
                      />
                    </div>
                  </Autocomplete>
                </LoadScript>
              </div>

              <FormInput
                direction="column"
                label="Radius (km)"
                type="number"
                value={formData.radius_km}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    radius_km: Number(e.target.value || 0),
                  }))
                }
              />

              <FormInput
                direction="column"
                label="City"
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
              />

              <FormInput
                direction="column"
                label="State"
                type="text"
                value={formData.state}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: e.target.value }))
                }
              />

              <FormInput
                direction="column"
                label="Country"
                type="text"
                value={formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, country: e.target.value }))
                }
              />

              <div className="md:col-span-2">
                <FormInput
                  direction="column"
                  label="Campaign Description"
                  type="textarea"
                  value={formData.campaign_description}
                  rows={6}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      campaign_description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-4 border border-gray-100 rounded-md p-4 h-fit">
                <p className="text-sm font-medium mb-3">Campaign Media</p>
                <div className="w-full max-w-sm aspect-[4/3] rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt="Campaign media"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-500">No media uploaded</span>
                  )}
                </div>
                {mediaUrl ? (
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 underline mt-2 inline-block"
                  >
                    Open full image
                  </a>
                ) : null}
              </div>

              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {buildCampaignReadOnlyFields(campaign).map((item) => (
                  <div
                    key={item.label}
                    className={`border border-gray-100 rounded-md p-3 h-fit bg-gray-50/50 ${
                      item.span || ""
                    }`}
                  >
                    <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wide">
                      {item.label}
                    </p>
                    <div className="text-sm text-gray-800 break-words">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-6">
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Applications</h3>
        </div>
        <DataTable
          headers={applicationTableHeaders}
          data={applications}
          loading={loadingApplications}
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
          searchPlaceholder="Search by rider name, email, phone..."
          filters={applicationFilters}
          renderRow={renderApplicationRow}
          emptyMessage="No applications found."
          containerClassName="rounded-xl p-0 mb-0"
          isCollapsible={false}
          colWidths={{
            Rider: "210px",
            "Applied At": "105px",
            Status: "95px",
            "Dispatch & Proof": "240px",
            Action: "195px",
          }}
        />
      </div>

      <CustomModal
        open={activityModalOpen}
        onClose={() => {
          setActivityModalOpen(false);
          setActivityApplicationId("");
          setActivityItems([]);
          setActivityPage(1);
          setActivityTotalPages(1);
          setActivityTotalRecords(0);
        }}
        title={activityTitle}
        width="720px"
        showActions={false}
      >
        {activityLoading ? (
          <section className="-mt-1 flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-4 border-gray-200 border-t-[var(--p-blue)]" />
          </section>
        ) : activityItems.length === 0 ? (
          <p className="-mt-1 text-sm text-gray-500">No activity found for this application.</p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {activityItems.map((entry, idx) => {
              const actorLabel =
                entry?.actor?.actor_name ||
                entry?.actor?.actor_role ||
                entry?.actor?.actor_type ||
                "System";
              const fieldChanges = buildActivityFieldChanges(entry);
              return (
                <div
                  key={`${entry?.created_at || "activity"}-${idx}`}
                  className="rounded-md border border-gray-200 bg-gray-50/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">
                      {entry?.message || entry?.event_type || "Activity updated"}
                    </p>
                    <span className="text-[11px] text-gray-500">
                      {entry?.created_at ? formatDate(entry.created_at) : "-"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-gray-600">
                    <span className="font-medium">By:</span> {actorLabel}
                    {entry?.event_scope ? ` | ${entry.event_scope}` : ""}
                  </div>
                  {fieldChanges.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {fieldChanges.map((change) => (
                        <div
                          key={`${entry?.created_at || "activity"}-${idx}-${change.key}`}
                          className="text-xs text-gray-700"
                        >
                          <span className="font-medium">{change.label}:</span>{" "}
                          <span className="text-rose-700">{change.from}</span>
                          <span className="mx-1.5 text-gray-500">{"->"}</span>
                          <span className="text-emerald-700">{change.to}</span>
                        </div>
                      ))}
                    </div>
                  ) : entry?.metadata?.reason ? (
                    <div className="mt-2 text-xs text-gray-700">
                      <span className="font-medium">Reason:</span> {entry.metadata.reason}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {!activityLoading && activityTotalRecords > 0 ? (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {activityPage} of {Math.max(activityTotalPages, 1)} (Total {activityTotalRecords})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-50"
                disabled={activityPage <= 1}
                onClick={() => fetchActivityLogs(activityApplicationId, activityPage - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-50"
                disabled={activityPage >= activityTotalPages}
                onClick={() => fetchActivityLogs(activityApplicationId, activityPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </CustomModal>

      <CustomModal
        open={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title="Update Dispatch Details"
        width="560px"
        showActions={true}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setDispatchModalOpen(false),
          },
          {
            label: dispatchSaving ? "Saving..." : "Save",
            primary: true,
            disabled: dispatchSaving,
            onClick: handleSaveDispatch,
          },
        ]}
      >
        <div className="space-y-3">
          <FormInput
            rows={3}
            direction="column"
            label="Tracking details"
            type="textarea"
            placeholder="Courier name, tracking number, notes…"
            value={dispatchForm.tracking_details}
            onChange={(e) =>
              setDispatchForm((prev) => ({ ...prev, tracking_details: e.target.value }))
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Delivery Status</label>
            <ReactSelect
              value={
                deliveryStatusOptions
                  .map((value) => ({ value, label: value }))
                  .find((opt) => opt.value === dispatchForm.delivery_status) || null
              }
              onChange={(opt) =>
                setDispatchForm((prev) => ({
                  ...prev,
                  delivery_status: opt?.value || "Pending",
                }))
              }
              options={deliveryStatusOptions.map((value) => ({ value, label: value }))}
              placeholder="Select delivery status"
              classNamePrefix="react-select"
              menuPortalTarget={
                typeof document !== "undefined" ? document.body : null
              }
              menuPosition="fixed"
              menuShouldScrollIntoView={false}
              styles={dispatchModalReactSelectStyles}
            />
          </div>
          <FormInput
            direction="column"
            label="Expected Delivery Date"
            type="datetime-local"
            placeholder="Select date and time"
            value={dispatchForm.delivery_date}
            onChange={(date) =>
              setDispatchForm((prev) => ({
                ...prev,
                delivery_date: date ? toDateTimeLocal(date) : "",
              }))
            }
          />
          </div>
        </div>
      </CustomModal>

      <CustomModal
        open={proofModalOpen}
        onClose={() => setProofModalOpen(false)}
        title="Upload Activation Proof"
        width="560px"
        showActions={true}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setProofModalOpen(false),
          },
          {
            label: proofUploading ? "Submitting..." : "Submit Proof",
            primary: true,
            disabled: proofUploading || !proofUrl,
            onClick: handleSubmitProof,
          },
        ]}
      >
        <input
          ref={proofInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadProofFile(file);
            e.target.value = "";
          }}
          disabled={proofUploading}
        />
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
              onClick={() => proofInputRef.current?.click()}
              disabled={proofUploading}
            >
              Choose Proof Image
            </button>
            <span className="text-xs text-gray-600 break-all">
              {proofUrl
                ? decodeURIComponent((proofUrl.split("/").pop() || "").split("?")[0])
                : "No file selected"}
            </span>
          </div>
          {proofUrl ? (
            <div className="w-full max-w-sm aspect-[4/3] rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
              <img src={proofUrl} alt="Proof preview" className="w-full h-full object-cover" />
            </div>
          ) : (
            <p className="text-xs text-gray-500">Upload proof image to preview here.</p>
          )}
        </div>
      </CustomModal>

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
