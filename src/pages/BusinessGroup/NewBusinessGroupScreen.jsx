import React, { useState, useEffect, useRef } from "react";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { PageHeader, FormInput, Loader, useFormScreenExit } from "@/page-layouts/";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { FiTrash2 } from "react-icons/fi";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const NewBusinessGroupScreen = () => {
  const history = useHistory();
  const exitBusinessGroupScreen = useFormScreenExit("/business-group");
  const { id } = useParams();
  const checkTokenExpired = useCheckTokenExpired();

  const isEditMode = !!id && history.location.pathname.includes("/Edit Business Group/");
  const isViewMode = !!id && history.location.pathname.includes("/View Business Group/");
  const requiredPermission = isViewMode
    ? PERMISSION_ACTION.VIEW_DETAILS
    : isEditMode
      ? PERMISSION_ACTION.UPDATE
      : PERMISSION_ACTION.ADD;

  const [formData, setFormData] = useState({
    companyName: "",
    registrationNumber: "",
    subdomain: "",
    website: "",
    logo: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postCode: "",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoName, setSelectedLogoName] = useState("");
  const [errors, setErrors] = useState({});
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (id) {
      fetchBusinessGroupData(id);
    }
  }, [id]);

  const fetchBusinessGroupData = async (businessGroupId) => {
    setFetching(true);
    try {
      const response = await axios.get(`${Base_URL}/business-groups/${businessGroupId}`);
      if (checkTokenExpired(response)) return;

      const businessGroupData = response.data.data || response.data;

      if (businessGroupData) {
        setFormData({
          companyName: businessGroupData.companyName || "",
          registrationNumber: businessGroupData.registrationNumber || "",
          subdomain: businessGroupData.subdomain || "",
          website: businessGroupData.website || "",
          logo: businessGroupData.logo || "",
          email: businessGroupData.email || "",
          phone: businessGroupData.phone || "",
          address: businessGroupData.address || "",
          city: businessGroupData.city || "",
          state: businessGroupData.state || "",
          postCode: businessGroupData.postCode || "",
        });
      } else {
        notifyError("Business Group not found");
        history.push("/business-group");
      }
    } catch (err) {
      console.error("Error fetching business group:", err);
      notifyError(err.response?.data?.message || "Failed to fetch business group");
      history.push("/business-group");
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      setSelectedLogoName(file.name);
      const uploadData = new FormData();
      uploadData.append("image", file);
      const uploadResponse = await axios.post(`${Base_URL}/upload`, uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedUrl = uploadResponse?.data?.url || "";
      if (!uploadedUrl) {
        notifyError("Failed to upload logo");
        setSelectedLogoName("");
        return;
      }
      setFormData((prev) => ({ ...prev, logo: uploadedUrl }));
    } catch (err) {
      console.error("Logo upload error:", err);
      notifyError(err.response?.data?.message || "Failed to upload logo");
      setSelectedLogoName("");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.companyName || formData.companyName.trim() === "") {
      newErrors.companyName = "Company Name is required";
    }
    if (!formData.registrationNumber || formData.registrationNumber.trim() === "") {
      newErrors.registrationNumber = "Registration Number is required";
    }
    if (!formData.email || formData.email.trim() === "") {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (formData.website && formData.website.trim() !== "") {
      try {
        new URL(formData.website);
      } catch (e) {
        newErrors.website = "Please enter a valid website URL";
      }
    }
    if (formData.subdomain && formData.subdomain.trim() !== "") {
      if (!/^[a-z0-9-]+$/.test(formData.subdomain.trim())) {
        newErrors.subdomain =
          "Subdomain can contain lowercase letters, numbers, and hyphens only";
      }
    }
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
        companyName: formData.companyName.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        subdomain: formData.subdomain.trim() || undefined,
        website: formData.website.trim() || undefined,
        logo: formData.logo?.trim() || undefined,
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        postCode: formData.postCode.trim() || undefined,
      };
      let response;
      if (isEditMode) {
        response = await axios.put(`${Base_URL}/business-groups/${id}`, payload);
        if (checkTokenExpired(response)) return;
        notifySuccess("Business Group updated successfully");
      } else {
        response = await axios.post(`${Base_URL}/business-groups`, payload);
        if (checkTokenExpired(response)) return;
        notifySuccess("Business Group created successfully");
      }
      setTimeout(() => history.push("/business-group"), 1000);
    } catch (err) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} business group:`, err);
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

  const errorMsg = (msg) =>
    msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null;

  const getPageTitle = () => {
    if (isViewMode) return "View Business Group";
    if (isEditMode) return "Edit Business Group";
    return "Add New Business Group";
  };

  if (fetching) {
    return (
      <RouteActionGate
        title="Business Group"
        requiredPermission={requiredPermission}
      >
        <Loader fullContainer />
      </RouteActionGate>
    );
  }

  return (
    <RouteActionGate
      title="Business Group"
      requiredPermission={requiredPermission}
    >
      <div className="py-6 px-6 min-h-screen">
        <PageHeader
          title={getPageTitle()}
          showBackButton
          backFallbackPath="/business-group"
        />

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {/* Row 1: Company Name + Registration Number */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Company Name", true)}
            <FormInput
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              placeholder="Enter company name"
              error={errors.companyName}
              shouldShowError={!!errors.companyName}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.companyName)}
          </div>
          <div className="flex flex-col">
            {fieldLabel("Registration Number", true)}
            <FormInput
              type="text"
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleInputChange}
              placeholder="Enter registration number"
              error={errors.registrationNumber}
              shouldShowError={!!errors.registrationNumber}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.registrationNumber)}
          </div>
        </div>

        {/* Row 2: Subdomain */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Subdomain")}
            <FormInput
              type="text"
              name="subdomain"
              value={formData.subdomain}
              onChange={handleInputChange}
              placeholder="e.g. glow"
              error={errors.subdomain}
              shouldShowError={!!errors.subdomain}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.subdomain)}
            <p className="text-xs text-gray-500 mt-1">
              Optional: used for tenant URL (example: https://glow.flexaerp.com)
            </p>
          </div>
        </div>

        {/* Row 2: Website + Email */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Website Link")}
            <FormInput
              type="text"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://example.com"
              error={errors.website}
              shouldShowError={!!errors.website}
              noLabel
              disabled={isViewMode}
            />
            {errorMsg(errors.website)}
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

        {/* Row: Business Group Logo */}
        <div className="grid gap-6">
          <div className="flex flex-col">
            {fieldLabel("Upload Business Group Logo")}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              {!isViewMode ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-4 py-2 text-sm font-medium text-[var(--p-blue)] border border-[var(--p-blue)] rounded-md bg-white hover:bg-blue-50 disabled:opacity-60"
                    >
                      {uploadingLogo ? "Uploading..." : "Choose Logo"}
                    </button>
                    <span className="text-xs text-gray-600 max-w-full break-all">
                      {selectedLogoName
                        ? selectedLogoName
                        : formData.logo
                        ? "Logo selected"
                        : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Upload logo here using square image, PNG/JPG, max 2MB.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center">
                  View mode: open Edit Business Group to upload or change logo.
                </p>
              )}
              {uploadingLogo && (
                <p className="text-xs text-gray-500 mt-2 text-center">Uploading logo...</p>
              )}
              {formData.logo ? (
                <div className="mt-4">
                  <div className="mx-auto h-44 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <img
                      src={formData.logo}
                      alt="Business Group Logo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {!isViewMode && (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, logo: "" }));
                          setSelectedLogoName("");
                        }}
                      >
                        <FiTrash2 />
                        Remove logo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-3 text-center">
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Phone + Address */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Phone")}
            <FormInput
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter phone number"
              noLabel
              disabled={isViewMode}
            />
          </div>
          <div className="flex flex-col">
            {fieldLabel("Address")}
            <FormInput
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter address"
              noLabel
              disabled={isViewMode}
            />
          </div>
        </div>

        {/* Row 4: City + State + Post Code */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("City")}
            <FormInput
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="Enter city"
              noLabel
              disabled={isViewMode}
            />
          </div>
          <div className="flex flex-col">
            {fieldLabel("State")}
            <FormInput
              type="text"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              placeholder="Enter state"
              noLabel
              disabled={isViewMode}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Post Code")}
            <FormInput
              type="text"
              name="postCode"
              value={formData.postCode}
              onChange={handleInputChange}
              placeholder="Enter post code"
              noLabel
              disabled={isViewMode}
            />
          </div>
        </div>

        {/* Footer buttons - same as Bank Management */}
        {!isViewMode && (
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={exitBusinessGroupScreen}
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
              ) : isEditMode ? "Update Business Group" : "Create Business Group"}
            </button>
          </div>
        )}
        {isViewMode && (
          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={exitBusinessGroupScreen}
              className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back
            </button>
          </div>
        )}
        </form>
      </div>
    </RouteActionGate>
  );
};

export default NewBusinessGroupScreen;
