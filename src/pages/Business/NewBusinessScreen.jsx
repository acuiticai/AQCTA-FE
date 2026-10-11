import React, { useState, useEffect, useContext } from "react";
import { useHistory, useParams, Link } from "react-router-dom";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { PageHeader, FormInput, Loader, useFormScreenExit } from "@/page-layouts/";
import SearchableDropdown from "@/components/SearchableDropdown";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { useDropzone } from "react-dropzone";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NewBusinessScreen = () => {
  const history = useHistory();
  const exitBusinessScreen = useFormScreenExit("/business");
  const { id } = useParams();
  const checkTokenExpired = useCheckTokenExpired();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const isEditMode = !!id && history.location.pathname.includes("/Edit Business/");
  const isViewMode = !!id && history.location.pathname.includes("/View Business/");
  const requiredPermission = isViewMode
    ? PERMISSION_ACTION.VIEW_DETAILS
    : isEditMode
      ? PERMISSION_ACTION.UPDATE
      : PERMISSION_ACTION.ADD;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    businessGroup: "",
    address: "",
    tel: "",
    fax: "",
    image: "",
    eInvoiceEnabled: true,
  });

  const [businessGroups, setBusinessGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    fetchBusinessGroups();
    if (id) fetchBusinessData(id);
  }, [id]);

  const fetchBusinessGroups = async () => {
    try {
      const response = await axios.get(`${Base_URL}/business-groups`, {
        params: { limit: 1000 },
      });
      if (checkTokenExpired(response)) return;
      const businessGroupsData = Array.isArray(response.data.businessGroups)
        ? response.data.businessGroups
        : Array.isArray(response.data)
        ? response.data
        : [];
      setBusinessGroups(businessGroupsData);
    } catch (err) {
      console.error("Error fetching business groups:", err);
      notifyError("Failed to load business groups");
    }
  };

  const fetchBusinessData = async (businessId) => {
    setFetching(true);
    try {
      const headers = adminInfo
        ? { "Content-Type": "application/json", authorization: `Bearer ${adminInfo.token}` }
        : { "Content-Type": "application/json" };
      const response = await axios.get(`${Base_URL}/Business/${businessId}`, { headers });
      if (checkTokenExpired(response)) return;
      const businessData = response.data.data || response.data;
      if (businessData) {
        const imageUrl = businessData.image || "";
        setFormData({
          name: businessData.name || "",
          email: businessData.email || "",
          businessGroup: businessData.businessGroup?._id || businessData.businessGroup || "",
          address: businessData.address || "",
          tel: businessData.tel || "",
          fax: businessData.fax || "",
          image: imageUrl,
          eInvoiceEnabled: businessData.eInvoiceEnabled !== false,
        });
        setImagePreviewUrl(imageUrl);
        if (businessData.businessGroup?.companyName && !businessGroups.find((bg) => bg._id === businessData.businessGroup._id)) {
          setBusinessGroups((prev) =>
            prev.find((b) => b._id === businessData.businessGroup._id)
              ? prev
              : [...prev, businessData.businessGroup]
          );
        }
      } else {
        notifyError("Business not found");
        history.push("/business");
      }
    } catch (err) {
      console.error("Error fetching business:", err);
      notifyError(err.response?.data?.message || "Failed to fetch business");
      history.push("/business");
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleBusinessGroupChange = (value) => {
    setFormData((prev) => ({ ...prev, businessGroup: value }));
    if (errors.businessGroup) setErrors((prev) => ({ ...prev, businessGroup: "" }));
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("image", file);
      const uploadResponse = await axios.post(`${Base_URL}/upload`, uploadFormData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedUrl = uploadResponse.data?.url ?? uploadResponse.data?.data?.url;
      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, image: uploadedUrl }));
        const reader = new FileReader();
        reader.onload = (e) => setImagePreviewUrl(e.target.result || "");
        reader.readAsDataURL(file);
        notifySuccess("Image uploaded successfully");
      } else {
        notifyError("Failed to upload image");
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      notifyError("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    onDrop,
    multiple: false,
  });

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: "" }));
    setImagePreviewUrl("");
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "Business Name is required";
    if (!formData.email?.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Please enter a valid email address";
    if (!formData.businessGroup) newErrors.businessGroup = "Business Group is required";
    if (!formData.address?.trim()) newErrors.address = "Address is required";
    if (!formData.tel?.trim()) newErrors.tel = "Phone is required";
    if (!formData.fax?.trim()) newErrors.fax = "Fax is required";
    if (!formData.image?.trim()) newErrors.image = "Business Image is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      notifyError("Please fill in all required fields correctly");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        businessGroup: formData.businessGroup,
        address: formData.address.trim(),
        tel: formData.tel.trim(),
        fax: formData.fax.trim(),
        image: formData.image,
        eInvoiceEnabled: !!formData.eInvoiceEnabled,
      };
      const headers = adminInfo
        ? { "Content-Type": "application/json", authorization: `Bearer ${adminInfo.token}` }
        : { "Content-Type": "application/json" };
      let response;
      if (isEditMode) {
        response = await axios.put(`${Base_URL}/Business/update/${id}`, payload, { headers });
        if (checkTokenExpired(response)) return;
      } else {
        response = await axios.post(`${Base_URL}/Business/add`, payload, { headers });
        if (checkTokenExpired(response)) return;
      }
      if (response.data && response.data.status === false) {
        const isDuplicate =
          (response.data.message || "").toLowerCase().includes("already exists") ||
          (response.data.message || "").toLowerCase().includes("same name or email");
        notifyError(
          isDuplicate ? "Business already exists with the same name or email." : response.data.message || "Something went wrong. Please try again."
        );
        return;
      }
      notifySuccess(isEditMode ? "Business updated successfully" : "Business created successfully");
      if (!isEditMode && response.data?.data) {
        const newBusiness = response.data.data;
        const businesses = JSON.parse(localStorage.getItem("businesses")) || [];
        businesses.push({ _id: newBusiness._id, name: newBusiness.name });
        localStorage.setItem("businesses", JSON.stringify(businesses));
      }
      setTimeout(() => history.push("/business"), 1000);
    } catch (err) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} business:`, err);
      notifyError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldLabel = (text, required) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );

  const errorMsg = (msg) => (msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null);

  const getPageTitle = () => {
    if (isViewMode) return "View Business";
    if (isEditMode) return "Edit Business";
    return "Add New Business";
  };

  if (fetching) {
    return (
      <RouteActionGate
        title="Business"
        requiredPermission={requiredPermission}
      >
        <Loader fullContainer />
      </RouteActionGate>
    );
  }

  return (
    <RouteActionGate title="Business" requiredPermission={requiredPermission}>
      <div className="py-6 px-6 min-h-screen">
        <PageHeader
          title={getPageTitle()}
          showBackButton
          backFallbackPath="/business"
        />

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {/* Image - full width (same pattern as Bank form) */}
        <div className="flex flex-col">
          {fieldLabel("Business Image", true)}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              errors.image ? "border-red-500" : "border-gray-200"
            } ${isViewMode ? "cursor-not-allowed opacity-50" : ""}`}
            style={{ pointerEvents: isViewMode ? "none" : "auto" }}
          >
            <input {...getInputProps()} disabled={isViewMode} />
            {formData.image ? (
              <div className="relative inline-block mt-2">
                <img
                  src={imagePreviewUrl || formData.image}
                  alt="Business"
                  className="max-h-40 w-auto rounded-lg object-contain border border-gray-200"
                />
                {!isViewMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-gray-600">{uploading ? "Uploading..." : "Click or drag image here"}</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 10MB</p>
              </div>
            )}
          </div>
          {errorMsg(errors.image)}
        </div>

        {/* Row 1: Business Name + Email */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Business Name", true)}
            <FormInput
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter business name"
              error={errors.name}
              shouldShowError={!!errors.name}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.name)}
          </div>
          <div className="flex flex-col">
            {fieldLabel("Email", true)}
            <FormInput
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email address"
              error={errors.email}
              shouldShowError={!!errors.email}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.email)}
          </div>
        </div>

        {/* Row 2: Business Group + Address */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Business Group", true)}
            <div className={errors.businessGroup ? "border-2 border-red-500 rounded-lg" : ""}>
              <SearchableDropdown
                name="businessGroup"
                value={formData.businessGroup}
                onChange={(e) => handleBusinessGroupChange(e?.target?.value ?? e)}
                placeholder={isViewMode && !formData.businessGroup ? "N/A" : "Select Business Group"}
                searchPlaceholder="Search business groups..."
                disabled={isViewMode}
                options={businessGroups.map((bg) => ({ value: bg._id, label: bg.companyName }))}
              />
            </div>
            {errorMsg(errors.businessGroup)}
          </div>
          <div className="flex flex-col">
            {fieldLabel("Address", true)}
            <FormInput
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter address"
              error={errors.address}
              shouldShowError={!!errors.address}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.address)}
          </div>
        </div>

        {/* Row 3: Phone + Fax */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Phone", true)}
            <FormInput
              type="text"
              name="tel"
              value={formData.tel}
              onChange={handleInputChange}
              placeholder="Enter phone number"
              error={errors.tel}
              shouldShowError={!!errors.tel}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.tel)}
          </div>
          <div className="flex flex-col">
            {fieldLabel("Fax", true)}
            <FormInput
              type="text"
              name="fax"
              value={formData.fax}
              onChange={handleInputChange}
              placeholder="Enter fax number"
              error={errors.fax}
              shouldShowError={!!errors.fax}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.fax)}
          </div>
        </div>

        <div className="max-w-xl rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/20 px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="eInvoiceEnabled"
              checked={!!formData.eInvoiceEnabled}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, eInvoiceEnabled: e.target.checked }))
              }
              disabled={isViewMode}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Enable e-invoice (Malaysia LHDN / MyInvois)
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                When off, e-invoice settings, customer e-invoice data, and invoice LHDN actions are hidden for this business.
              </span>
            </span>
          </label>
        </div>

        {/* Footer buttons - same as Bank Management */}
        {!isViewMode && (
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={exitBusinessScreen}
              className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Saving...
                </span>
              ) : isEditMode ? "Update Business" : "Create Business"}
            </button>
          </div>
        )}
        {isViewMode && (
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={exitBusinessScreen}
              className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </form>

      {/* {isEditMode && id && !isViewMode && (
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/80 dark:bg-slate-800/30 dark:border-slate-600 px-5 py-4 max-w-2xl">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            E-invoice (LHDN MyInvois)
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Supplier TIN, API credentials, and auto-approval are configured in{" "}
            <span className="font-medium">Accounts</span> →{" "}
            <Link
              to="/accounts/e-invoice-settings"
              className="text-[var(--p-blue)] font-medium hover:underline"
            >
              E-Invoice Settings
            </Link>
            . The legacy <span className="font-medium">View Business</span> →{" "}
            <span className="font-medium">Business Details</span> tab also shows the same
            form if you use that screen.
          </p>
        </div>
      )} */}
      </div>
    </RouteActionGate>
  );
};

export default NewBusinessScreen;
