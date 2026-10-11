import { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import OperationsServices from "@/services/OperationsServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { formatDateTime } from "@/components/formatAmount";
import {
  CustomModal,
  DataTable,
  DateRangeComponent,
  FormInput,
  Page,
  PageHeader,
} from "@/page-layouts/index";
import ActionButtons from "@/page-layouts/components/ActionButtons";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";
import { useHistory } from "react-router-dom";
import { LoadScript, Autocomplete } from "@react-google-maps/api";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

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
  coverage_area: "",
  campaign_status: "Draft",
  job_visibility: true,
};

const toYyyyMmDd = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string") return value;
  return "";
};

const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
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

const CampaignModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  onBusinessChange,
  businesses,
  customers,
  isSubmitting,
  isMediaUploading,
  onMediaUpload,
  editItem,
}) => {
  if (!isOpen) return null;
  const mediaInputRef = useRef(null);
  const campaignLocationAutocompleteRef = useRef(null);

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

    setFormData((prev) => ({
      ...prev,
      ...next,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 m-4 max-w-3xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {editItem ? "Edit Campaign" : "Create Campaign"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">
                Business *
              </label>
              <ReactSelect
                value={
                  businesses.find((b) => b.value === formData.business_id) || null
                }
                onChange={(opt) => {
                  const selectedBusinessId = opt ? opt.value : "";
                  setFormData((prev) => ({
                    ...prev,
                    business_id: selectedBusinessId,
                    advertiser: "",
                  }));
                  if (onBusinessChange) {
                    onBusinessChange(selectedBusinessId);
                  }
                }}
                options={businesses}
                isSearchable
                placeholder="Select Business"
                classNamePrefix="react-select"
                styles={reactSelectConfig}
              />
            </div>

            <div className="md:col-span-2">
              <FormInput
                direction="column"
                label="Campaign Title *"
                type="text"
                placeholder="Enter campaign title"
                value={formData.campaign_title}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    campaign_title: e.target.value,
                  }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <FormInput
                direction="column"
                label="Campaign Description"
                type="textarea"
                placeholder="Enter campaign description"
                value={formData.campaign_description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    campaign_description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">
                Campaign Media
              </label>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onMediaUpload) onMediaUpload(file);
                  e.target.value = "";
                }}
                disabled={isMediaUploading || isSubmitting}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={isMediaUploading || isSubmitting}
                >
                  Choose Image
                </button>
                <span className="text-xs text-gray-600 break-all">
                  {formData.campaign_media_file
                    ? decodeURIComponent(
                        (formData.campaign_media_file.split("/").pop() || "")
                          .split("?")[0]
                      )
                    : "No file chosen"}
                </span>
              </div>
              {isMediaUploading && (
                <p className="text-xs text-blue-600 mt-1">Uploading media...</p>
              )}
              {formData.campaign_media_file && (
                <a
                  href={formData.campaign_media_file}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline mt-1 inline-block"
                >
                  View uploaded media
                </a>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Advertiser (Customer) *
              </label>
              <ReactSelect
                value={
                  customers.find((c) => c.value === formData.advertiser) || null
                }
                onChange={(opt) =>
                  setFormData((prev) => ({
                    ...prev,
                    advertiser: opt ? opt.value : "",
                  }))
                }
                options={formData.business_id ? customers : []}
                isSearchable
                placeholder={
                  formData.business_id
                    ? "Select Customer"
                    : "Select business first"
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
                  [
                    { value: "Draft", label: "Draft" },
                    { value: "Open", label: "Open" },
                  ].find((s) => s.value === formData.campaign_status) || null
                }
                onChange={(opt) =>
                  setFormData((prev) => ({
                    ...prev,
                    campaign_status: opt ? opt.value : "Draft",
                  }))
                }
                options={[
                  { value: "Draft", label: "Draft" },
                  { value: "Open", label: "Open" },
                ]}
                placeholder="Select Status"
                classNamePrefix="react-select"
                styles={reactSelectConfig}
              />
            </div>

            <div>
              <FormInput
                direction="column"
                label="Start Date *"
                type="datetime-local"
                placeholder="Select start date and time"
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
            </div>

            <div>
              <FormInput
                direction="column"
                label="End Date *"
                type="datetime-local"
                placeholder="Select end date and time"
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
            </div>

            <div>
              <FormInput
                direction="column"
                label="Application Deadline *"
                type="datetime-local"
                placeholder="Select application deadline"
                value={formData.application_deadline}
                onChange={(dateValue) =>
                  setFormData((prev) => ({
                    ...prev,
                    application_deadline: toDateTimeLocal(dateValue),
                  }))
                }
                clearable={true}
                timeIntervals={15}
              />
            </div>

            <div>
              <FormInput
                direction="column"
                label="Required Riders"
                type="number"
                placeholder="Enter required riders"
                value={formData.required_riders}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    required_riders: Number(e.target.value || 0),
                  }))
                }
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
                googleMapsApiKey="AIzaSyD2Sj_UrDNY-TReJnMMNu3SlJTbs5z1nX8"
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
                      placeholder="Search city and select location"
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

            <div>
              <FormInput
                direction="column"
                label="City"
                type="text"
                placeholder="Enter city"
                value={formData.city}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>

            <div>
              <FormInput
                direction="column"
                label="State"
                type="text"
                placeholder="Enter state"
                value={formData.state}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: e.target.value }))
                }
              />
            </div>

            <div>
              <FormInput
                direction="column"
                label="Country"
                type="text"
                placeholder="Enter country"
                value={formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, country: e.target.value }))
                }
              />
            </div>

            <div>
              <FormInput
                direction="column"
                label="Radius (km)"
                type="number"
                placeholder="Enter radius in kilometers"
                value={formData.radius_km}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    radius_km: Number(e.target.value || 0),
                  }))
                }
              />
            </div>

          </div>

          <div className="flex justify-end mt-5 space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-gray-200 text-gray-800"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-[var(--p-blue)] text-white"
              disabled={isSubmitting || isMediaUploading}
            >
              {isMediaUploading
                ? "Uploading media..."
                : isSubmitting
                ? "Saving..."
                : editItem
                ? "Update"
                : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Campaigns() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [businessFilter, setBusinessFilter] = useState("");
  const [advertiserFilter, setAdvertiserFilter] = useState("");
  const [assignedBusinessIds, setAssignedBusinessIds] = useState([]);

  const [businesses, setBusinesses] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirm");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmActionLabel, setConfirmActionLabel] = useState("Confirm");
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingRow, setPendingRow] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const normalizedBusinessFilter =
    businessFilter && businessFilter !== "Select Business" ? businessFilter : "";

  const headers = [
    "Campaign Title",
    "Advertiser",
    "Start Date",
    "End Date",
    "Required Riders",
    "Payout (RM)",
    "Radius (km)",
    "Campaign Stage",
    "Action",
  ];

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
        .map((b) => ({
          value: b._id,
          label: b.name,
        }))
        .sort((a, b) =>
          String(a.label || "").localeCompare(String(b.label || ""), undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
      setBusinesses(list);
    } catch (error) {
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
      const params = {
        page: 1,
        limit: 9999,
      };
      if (ids.length === 1) {
        params.businessId = ids[0];
      } else {
        params.businessIds = JSON.stringify(ids);
      }

      const response = await axios.get(`${Base_URL}/customers`, { params });
      const merged = (response?.data?.customers || []).filter(Boolean);

      const deduped = Array.from(
        new Map(merged.map((c) => [c._id, c])).values()
      );

      const list = deduped.map((c) => ({
        value: c._id,
        label: getCustomerLabel(c),
      }));
      setCustomers(list);
    } catch (error) {
      notifyError("Failed to fetch customers");
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await OperationsServices.getCampaigns({
        page: currentPage,
        limit: recordsPerPage,
        search: searchValue,
        campaign_status: statusFilter,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
        business_id: normalizedBusinessFilter || undefined,
        business_ids:
          !normalizedBusinessFilter && assignedBusinessIds.length > 0
            ? JSON.stringify(assignedBusinessIds)
            : undefined,
        advertiser: advertiserFilter || undefined,
      });

      setCampaigns(response?.data || []);
      setTotalPages(response?.totalPages || 1);
      setTotalRecords(response?.total || 0);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminInfo?.id) fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    const targetBusinessIds = normalizedBusinessFilter
      ? [normalizedBusinessFilter]
      : assignedBusinessIds;
    fetchCustomersByBusiness(targetBusinessIds);
  }, [normalizedBusinessFilter, assignedBusinessIds]);

  useEffect(() => {
    fetchCampaigns();
  }, [
    currentPage,
    recordsPerPage,
    searchValue,
    statusFilter,
    startDateFilter,
    endDateFilter,
    normalizedBusinessFilter,
    advertiserFilter,
  ]);

  const renderStatusBadge = (status) => {
    const value = (status || "Draft").toString();
    const map = {
      Draft: "bg-slate-100 text-slate-700 border-slate-200",
      Open: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Closed: "bg-rose-100 text-rose-700 border-rose-200",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
          map[value] || "bg-gray-100 text-gray-700 border-gray-200"
        }`}
      >
        {value}
      </span>
    );
  };

  const openCreate = () => {
    setEditItem(null);
    setFormData({
      ...defaultForm,
      business_id: "",
    });
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    setEditItem(row);
    const campaign = row._id ? await OperationsServices.getCampaignById(row._id) : row;
    const data = campaign?.data || row;

    const selectedBusinessId =
      data?.business_id?._id || data?.business_id || normalizedBusinessFilter || "";
    await fetchCustomersByBusiness(
      selectedBusinessId ? [selectedBusinessId] : assignedBusinessIds
    );

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
      application_deadline: data?.application_deadline
        ? new Date(data.application_deadline).toISOString().slice(0, 16)
        : "",
      required_riders: data?.required_riders || 0,
      rider_payment_amount:
        data?.rider_payment_amount === undefined || data?.rider_payment_amount === null
          ? ""
          : String(data.rider_payment_amount),
      radius_km: Number(data?.radius_km || 0),
      city: data?.city || "",
      state: data?.state || "",
      country: data?.country || "",
      coverage_area: data?.coverage_area || "",
      campaign_status: data?.campaign_status || "Draft",
      job_visibility: true,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
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
      job_visibility: true,
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
      campaign_start_date: formData.campaign_start_date,
      campaign_end_date: formData.campaign_end_date,
      application_deadline: formData.application_deadline,
    };

    try {
      setIsSubmitting(true);
      if (editItem?._id) {
        await OperationsServices.updateCampaign(editItem._id, payload);
        notifySuccess("Campaign updated successfully");
      } else {
        await OperationsServices.createCampaign(payload);
        notifySuccess("Campaign created successfully");
      }
      setModalOpen(false);
      fetchCampaigns();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to save campaign");
    } finally {
      setIsSubmitting(false);
    }
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
      setFormData((prev) => ({
        ...prev,
        campaign_media_file: mediaUrl,
      }));
      notifySuccess("Media uploaded successfully");
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to upload media");
    } finally {
      setIsMediaUploading(false);
    }
  };

  const handleDelete = async (row) => {
    try {
      await OperationsServices.deleteCampaign(row._id);
      notifySuccess("Campaign deleted");
      fetchCampaigns();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to delete campaign");
    }
  };

  const handleDuplicate = async (row) => {
    if (!row?._id) return;
    try {
      await OperationsServices.duplicateCampaign(row._id);
      notifySuccess("Campaign duplicated successfully");
      fetchCampaigns();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to duplicate campaign");
    }
  };

  const openConfirmModal = ({
    title = "Confirm",
    message = "",
    actionLabel = "Confirm",
    action = "",
    row = null,
  }) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmActionLabel(actionLabel);
    setPendingAction(action);
    setPendingRow(row);
    setConfirmModalOpen(true);
  };

  const handleConfirmModal = async () => {
    const action = pendingAction;
    const row = pendingRow;
    setConfirmModalOpen(false);
    setPendingAction(null);
    setPendingRow(null);

    if (!row?._id) return;
    if (action === "delete_campaign") {
      await handleDelete(row);
      return;
    }
    if (action === "duplicate_campaign") {
      await handleDuplicate(row);
    }
  };

  const handleBulkStatusUpdate = async (selectedRows = []) => {
    if (!Array.isArray(selectedRows) || selectedRows.length === 0) return;
    const selectedIds = selectedRows.map((r) => r?._id).filter(Boolean);
    if (!selectedIds.length) return;

    const nextStatusRaw = window.prompt(
      "Enter target status for selected campaigns: Draft or Open",
      "Open"
    );
    if (!nextStatusRaw) return;
    const nextStatus = nextStatusRaw.trim();
    if (!["Draft", "Open"].includes(nextStatus)) {
      notifyError("Invalid status. Use Draft or Open.");
      return;
    }

    try {
      setBulkActionLoading(true);
      await OperationsServices.bulkUpdateCampaignStatus({
        campaign_ids: selectedIds,
        campaign_status: nextStatus,
      });
      notifySuccess(`Updated ${selectedIds.length} campaign(s) to ${nextStatus}.`);
      fetchCampaigns();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update campaign status in bulk");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const renderRow = (row) => (
    <tr key={row._id} className="hover:bg-gray-50">
      <td className="px-6 py-4">{row.campaign_title || "-"}</td>
      <td className="px-6 py-4">{getCustomerLabel(row?.advertiser)}</td>
      <td className="px-6 py-4">
        {row.campaign_start_date ? formatDateTime(row.campaign_start_date) : "-"}
      </td>
      <td className="px-6 py-4">
        {row.campaign_end_date ? formatDateTime(row.campaign_end_date) : "-"}
      </td>
      <td className="px-6 py-4">{row.required_riders ?? 0}</td>
      <td className="px-6 py-4">{row.rider_payment_amount ?? 0}</td>
      <td className="px-6 py-4">{row.radius_km ?? 0}</td>
      <td className="px-6 py-4">{renderStatusBadge(row.campaign_status)}</td>
      <td>
        <ActionButtons
          items={[
            {
              action: ACTION_BUTTON_TYPES.VIEW,
              title: "View Campaign",
              onClick: () => history.push(`/campaigns/${row._id}`),
              permission: true,
            },
            {
              action: ACTION_BUTTON_TYPES.DELETE,
              title: "Delete Campaign",
              onClick: () =>
                openConfirmModal({
                  title: "Delete Campaign",
                  message: "Are you sure you want to delete this campaign?",
                  actionLabel: "Delete",
                  action: "delete_campaign",
                  row,
                }),
              permission: true,
            },
            {
              action: ACTION_BUTTON_TYPES.DUPLICATE,
              title: "Duplicate Campaign",
              onClick: () =>
                openConfirmModal({
                  title: "Duplicate Campaign",
                  message: "Are you sure you want to duplicate this campaign?",
                  actionLabel: "Duplicate",
                  action: "duplicate_campaign",
                  row,
                }),
              permission: true,
            },
          ]}
        />
      </td>
    </tr>
  );

  const filters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: {
        onClick: () => {
          setStatusFilter("all");
          setStartDateFilter("");
          setEndDateFilter("");
          setAdvertiserFilter("");
          setBusinessFilter("");
          setSearchValue("");
          setCurrentPage(1);
        },
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        adminId: adminInfo?.id,
        selectedBusiness: businessFilter,
        onChange: (value) => {
          setBusinessFilter(value || "");
          setAdvertiserFilter("");
          setCurrentPage(1);
        },
        setAssignedBusinesses: setAssignedBusinessIds,
        placeholder: "Select Business",
      },
    },
    {
      name: "status",
      label: "Campaign Stage",
      type: "select",
      isClearable: false,
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Status" },
        { value: "Draft", label: "Draft" },
        { value: "Open", label: "Open" },
        { value: "Closed", label: "Closed" },
      ],
    },
    {
      name: "campaign_date_range",
      customComponent: (
        <DateRangeComponent
          width="100%"
          startDate={startDateFilter}
          endDate={endDateFilter}
          onApply={(start, end) => {
            setStartDateFilter(start || "");
            setEndDateFilter(end || "");
            setCurrentPage(1);
          }}
          onClear={() => {
            setStartDateFilter("");
            setEndDateFilter("");
            setCurrentPage(1);
          }}
          placeholder="Filter by campaign date range"
          className="w-full"
        />
      ),
    },
    {
      name: "advertiser",
      label: "Advertiser",
      type: "select",
      isClearable: false,
      value: advertiserFilter,
      onChange: (value) => {
        setAdvertiserFilter(value);
        setCurrentPage(1);
      },
      options: [{ value: "", label: "All Advertisers" }, ...customers],
    },
  ];

  return (
    <Page>
      <div className="mt-6">  </div>
      <PageHeader
        title={"Campaigns"}
        showAddButton
        addButtonText="Add Campaign"
        onAddNew={openCreate}
      />

      <DataTable
        headers={headers}
        data={campaigns}
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
        searchPlaceholder="Search title, description, city, state, country, or Google location..."
        filters={filters}
        renderRow={renderRow}
        emptyMessage="No campaigns found"
        selectable={true}
        selectionActions={[
          {
            label: bulkActionLoading ? "Updating..." : "Change Status",
            onClick: handleBulkStatusUpdate,
            disabled: bulkActionLoading,
          },
        ]}
        colWidths={{
          "Required Riders": "110px",
          "Payout (RM)": "120px",
          "Radius (km)": "90px",
          "Campaign Stage": "110px",
        }}
      />

      <CampaignModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        formData={formData}
        setFormData={setFormData}
        onBusinessChange={(businessId) => {
          const targetBusinessIds = businessId ? [businessId] : assignedBusinessIds;
          fetchCustomersByBusiness(targetBusinessIds);
        }}
        businesses={businesses}
        customers={customers}
        isSubmitting={isSubmitting}
        isMediaUploading={isMediaUploading}
        onMediaUpload={handleMediaUpload}
        editItem={editItem}
      />

      <CustomModal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title={confirmTitle}
        width="420px"
        showActions={true}
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => setConfirmModalOpen(false),
          },
          {
            label: confirmActionLabel,
            primary: true,
            onClick: handleConfirmModal,
          },
        ]}
      >
        <p className="text-sm text-gray-700">{confirmMessage}</p>
      </CustomModal>
    </Page>
  );
}
