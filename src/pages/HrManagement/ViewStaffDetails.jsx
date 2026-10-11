"use client";

import { useState, useEffect, useMemo, useContext, useCallback } from "react";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import EditDetails from "./components/EditDetails";
import { formatDate } from "@/components/formatAmount";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { Checkbox, CustomDatePicker, PageHeader } from "@/page-layouts/index";
import { AdminContext } from "@/context/AdminContext";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";

import penIcon from "../../assets/img/icons/Button.png";
import profileIcon from "../../assets/img/icons/Profile.png";
import documentIcon from "../../assets/img/icons/Document.png";
import fileIcon from "../../assets/img/icons/File.png";
import certificateIcon from "../../assets/img/icons/Certificate.png";
import closeIcon from "../../assets/img/icons/add.png";
import { bloods, genders, martialStatuses, religions } from "./util";
import { InputField } from "@/page-layouts/index";
import nationalities from "@dropdowns/nationalities";
import ISO6391 from "iso-639-1";
import { refreshSeatUsage } from "@/hooks/useUserLimit";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  FiBriefcase,
  FiCheckCircle,
  FiClipboard,
  FiEye,
  FiEyeOff,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";
import { Button } from "@windmill/react-ui";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import PositionSelectWithAdd from "@/components/hr/PositionSelectWithAdd";
import DepartmentSelectWithAdd from "@/components/hr/DepartmentSelectWithAdd";

const STAFF_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "On Leave", label: "On Leave" },
  { value: "Resigned", label: "Resigned" },
  { value: "Promoted", label: "Promoted" },
  { value: "Terminated", label: "Terminated" },
];

const StaffDetailsComponent = () => {
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const routePerms = useRouteModulePermissions();
  const canViewStaffDetails = routePerms.canViewDetails || routePerms.canView;
  const canUpdateStaff = routePerms.canUpdate;
  const [staffData, setStaffData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [formErrors, setFormErrors] = useState({});

  // System User state
  const [roles, setRoles] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const [businessGroups, setBusinessGroups] = useState([]);
  const [existingSystemUser, setExistingSystemUser] = useState(null);
  const [addAsSystemUser, setAddAsSystemUser] = useState(false);
  const [systemUserForm, setSystemUserForm] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    businessGroup: "",
    role: "",
    businesses: [],
    status: true,
  });
  const [systemUserFormErrors, setSystemUserFormErrors] = useState({});
  const [savingSystemUser, setSavingSystemUser] = useState(false);
  const [isEditingSystemUser, setIsEditingSystemUser] = useState(false);
  const [showSystemUserPassword, setShowSystemUserPassword] = useState(false);
  const [regeneratingPassword, setRegeneratingPassword] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    displayName: "",
    status: "Active",
    nationality: "",
    maritalStatus: "",
    bloodType: "",
    religion: "",
    spokenLanguages: [],
    dateOfBirth: "",
    gender: "",
    email: "",
    position: "",
    department: "",
    image: "",
  });

  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  useEffect(() => {
    if (isFormSubmitted) {
      const errors = validateForm();
      setFormErrors(errors);
      console.log("Chnaged");
    }
  }, [formData]);

  useEffect(() => {
    const onlyId =
      businesses.length === 1
        ? businesses[0]?._id
        : isSingleBusiness
          ? singleBusinessId
          : null;
    if (!onlyId) return;
    setSystemUserForm((prev) => {
      if (prev.businesses?.length === 1 && String(prev.businesses[0]) === String(onlyId)) {
        return prev;
      }
      return { ...prev, businesses: [onlyId] };
    });
  }, [businesses, isSingleBusiness, singleBusinessId]);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token || ""}`,
    }),
    [adminInfo]
  );

  console.log("departments", departments);
  console.log("positions", positions);

  const fetchDepartments = async (business_id) => {
    try {
      const payload = {
        business_id: business_id,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.post(
        `${Base_URL}/Departments/get_all`,
        payload,
        { headers }
      );
      console.log("departments res", response);
      const data = response.data.data || [];
      setDepartments(data);
      return data;
    } catch (err) {
      console.log("Failed to fetch items");
      return [];
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) errors.fullName = "Full name is required";
    if (!formData.icorpassport.trim())
      errors.icorpassport = "IC/Passport is required";
    if (!formData.nationality) errors.nationality = "Nationality is required";
    if (!formData.gender) errors.gender = "Gender is required";
    if (!formData.email) errors.email = "Email is required";
    if (!formData.maritalStatus)
      errors.maritalStatus = "Marital Status is required";
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = "Date of birth is required";
    } else {
      // Check if date of birth is in the future
      const dateOfBirth = new Date(formData.dateOfBirth);
      const today = new Date();
      // Set time to midnight for accurate date comparison
      today.setHours(0, 0, 0, 0);
      dateOfBirth.setHours(0, 0, 0, 0);

      if (dateOfBirth > today) {
        errors.dateOfBirth = "Date of birth cannot be in the future";
      }
    }
    if (!formData.gender) errors.gender = "Gender is required";
    if (!formData.status) errors.status = "Status is required";
    // Optional: Display name validation (can be auto-generated if not provided)
    // if (!formData.displayName) {

    //   // Auto-generate display name from full name
    //   const displayName = `${formData.fullName.trim()}`;
    //   handleFormChange("displayName", displayName);
    // }

    return errors;
  };

  const fetchPositions = async (business_id) => {
    try {
      const payload = {
        business_id: business_id,
        FilterStatus: "",
        FilterName: "",
      };
      console.log("payload", payload);

      const response = await axios.post(
        `${Base_URL}/Positions/get_all`,
        payload,
        { headers }
      );
      console.log("positions response", response);
      const data = response.data.data || [];
      setPositions(data);
      return data;
    } catch (err) {
      console.log("Failed to fetch items");
      return [];
    }
  };

  const fetchStaffData = async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management/${id}`);
      console.log("staff response", response);
      setStaffData(response.data);

      console.log("business id in view details", response.data);

      fetchPositions(response.data.business?._id);
      fetchDepartments(response.data.business?._id);

      // Format date for date input (yyyy-MM-dd)
      const formattedDate = response.data.dateOfBirth
        ? new Date(response.data.dateOfBirth).toISOString().split("T")[0]
        : "";

      setFormData((prevData) => ({
        ...response.data,
        dateOfBirth: new Date(response.data.dateOfBirth),
        spokenLanguages: (response.data.spokenLanguages || [])
          .filter((lang) => lang !== null && lang !== undefined && lang !== "") // Filter out null/undefined/empty values
          .map((lang) => ({
            value: lang,
            label: lang,
          })),
      }));

      setImageUrl(response.data.image || "");

      // Find linked system user — first by systemUserId, then fall back to email match
      const populateSystemUser = (su) => {
        setExistingSystemUser(su);
        setAddAsSystemUser(true);
        setSystemUserForm((prev) => ({
          ...prev,
          name: su.name || "",
          businessGroup: su.role?.businessGroup?._id || su.role?.businessGroup || "",
          role: su.role?.isSuperAdmin === true ? "" : su.role?._id || su.role || "",
          businesses: su.businesses || [],
          status: su.status ?? true,
        }));
      };

      if (response.data.systemUserId) {
        try {
          const suRes = await axios.post(
            `${Base_URL}/SystemUsers/get_single/${response.data.systemUserId}`
          );
          if (suRes.data?.data) populateSystemUser(suRes.data.data);
        } catch (_) { /* deleted system user — fall through to email check */ }
      }

      // No systemUserId (or fetch failed) — check by email so pre-existing users are detected
      if (!response.data.systemUserId && response.data.email) {
        try {
          const suListRes = await axios.post(`${Base_URL}/SystemUsers/get_all`, {
            FilterName: response.data.email,
            FilterStatus: "",
            page: 1,
            limit: 10,
          });
          const matched = (suListRes.data?.data || []).find(
            (u) => u.email?.toLowerCase() === response.data.email?.toLowerCase()
          );
          if (matched) {
            populateSystemUser(matched);
            // Auto-link so future loads skip this check
            await axios.put(`${Base_URL}/staff-management/${response.data._id}`, {
              systemUserId: matched._id,
            });
          }
        } catch (_) { /* ignore */ }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching staff data:", error);
      setLoading(false);
    }
  };

  const fetchBusinessGroups = useCallback(async () => {
    try {
      const response = await axios.get(`${Base_URL}/business-groups`, { headers });
      const list = Array.isArray(response.data?.businessGroups)
        ? response.data.businessGroups
        : Array.isArray(response.data)
        ? response.data
        : [];
      setBusinessGroups(list);
    } catch (_) {
      setBusinessGroups([]);
    }
  }, [headers]);

  const fetchRolesByBusinessGroup = useCallback(async (businessGroupId) => {
    if (!businessGroupId) {
      setRoles([]);
      return;
    }
    try {
      const response = await axios.post(
        `${Base_URL}/UserRoles/get_all_user_roles`,
        { businessGroupId },
        { headers }
      );
      const scopedRoles = Array.isArray(response.data?.data)
        ? response.data.data.filter((role) => role?.isSuperAdmin !== true)
        : [];
      setRoles(scopedRoles);
    } catch (_) {
      setRoles([]);
    }
  }, [headers]);

  const fetchBusinessesByGroup = useCallback(async (businessGroupId) => {
    if (!businessGroupId) {
      setBusinesses([]);
      return;
    }
    try {
      const response = await axios.post(
        `${Base_URL}/Business/getALL`,
        { businessGroup: businessGroupId },
        { headers }
      );
      setBusinesses(response.data?.data || []);
    } catch (_) {
      setBusinesses([]);
    }
  }, [headers]);

  const validateSystemUserForm = () => {
    if (!addAsSystemUser) return {};
    const errors = {};
    if (!systemUserForm.name.trim()) errors.sysName = "Name is required";
    if (!existingSystemUser) {
      if (!systemUserForm.password) errors.sysPassword = "Password is required";
      else if (systemUserForm.password.length < 6) errors.sysPassword = "Min 6 characters";
      if (!systemUserForm.confirmPassword) errors.sysConfirmPassword = "Confirm password is required";
      else if (systemUserForm.password !== systemUserForm.confirmPassword) errors.sysConfirmPassword = "Passwords do not match";
    } else if (systemUserForm.password) {
      if (systemUserForm.password.length < 6) errors.sysPassword = "Min 6 characters";
      if (!systemUserForm.confirmPassword) errors.sysConfirmPassword = "Confirm password is required";
      else if (systemUserForm.password !== systemUserForm.confirmPassword) errors.sysConfirmPassword = "Passwords do not match";
    }
    if (!systemUserForm.businessGroup) errors.sysBusinessGroup = "Business Group is required";
    if (!systemUserForm.role) errors.sysRole = "Role is required";
    if (!systemUserForm.businesses.length) errors.sysBusinesses = "At least one business must be assigned";
    return errors;
  };

  const handleSaveSystemUser = async () => {
    if (!canUpdateStaff) {
      notifyError("You do not have permission to update staff.");
      return;
    }

    const errors = validateSystemUserForm();
    setSystemUserFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingSystemUser(true);
    try {
      if (existingSystemUser) {
        // Update existing system user
        const payload = {
          name: systemUserForm.name,
          email: formData.email || staffData?.email,
          contact: formData.mobileNumber || staffData?.mobileNumber,
          image: staffData?.image || "",
          role: systemUserForm.role,
          businesses: systemUserForm.businesses,
          status: systemUserForm.status,
        };
        if (systemUserForm.password) {
          payload.password = systemUserForm.password;
          payload.confirmPassword = systemUserForm.confirmPassword;
        }
        await axios.put(
          `${Base_URL}/SystemUsers/update/${existingSystemUser._id}`,
          payload,
          { headers: { "Content-Type": "application/json", authorization: `Bearer ${adminInfo?.token}` } }
        );
        notifySuccess("System user updated successfully.");
        refreshSeatUsage();
        setSystemUserForm((p) => ({ ...p, password: "", confirmPassword: "" }));
      } else {
        // Create new system user and link to staff
        const suRes = await axios.post(`${Base_URL}/SystemUsers/add`, {
          name: systemUserForm.name,
          email: staffData?.email,
          contact: staffData?.mobileNumber,
          image: staffData?.image || "",
          password: systemUserForm.password,
          role: systemUserForm.role,
          businesses: systemUserForm.businesses,
          status: systemUserForm.status,
        });
        const newSystemUserId = suRes.data?.data?._id;
        if (newSystemUserId) {
          await axios.put(`${Base_URL}/staff-management/${id}`, { systemUserId: newSystemUserId });
          setExistingSystemUser(suRes.data.data);
        }
        notifySuccess("System user created successfully.");
        refreshSeatUsage();
        setSystemUserForm((p) => ({ ...p, password: "", confirmPassword: "" }));
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save system user.");
    } finally {
      setSavingSystemUser(false);
    }
  };

  useEffect(() => {
    fetchBusinessGroups();
  }, [fetchBusinessGroups]);

  useEffect(() => {
    if (!systemUserForm.businessGroup) {
      setRoles([]);
      setBusinesses([]);
      return;
    }
    fetchRolesByBusinessGroup(systemUserForm.businessGroup);
    fetchBusinessesByGroup(systemUserForm.businessGroup);
  }, [systemUserForm.businessGroup, fetchRolesByBusinessGroup, fetchBusinessesByGroup]);

  useEffect(() => {
    fetchStaffData();
  }, [id]);

  const linkedBusinessGroupName = useMemo(() => {
    const directGroup = existingSystemUser?.role?.businessGroup;
    if (directGroup && typeof directGroup === "object") {
      return directGroup.companyName || directGroup.name || "";
    }

    const businessGroupId =
      typeof directGroup === "string"
        ? directGroup
        : systemUserForm.businessGroup || "";

    return (
      businessGroups.find((group) => group._id === businessGroupId)?.companyName ||
      ""
    );
  }, [existingSystemUser, systemUserForm.businessGroup, businessGroups]);

  const linkedRoleName = useMemo(() => {
    const directRole = existingSystemUser?.role;
    if (directRole && typeof directRole === "object") {
      return directRole.name || directRole.internalName || "";
    }

    const roleId =
      typeof directRole === "string" ? directRole : systemUserForm.role || "";

    const matchedRole = roles.find((role) => role._id === roleId);
    return matchedRole?.name || matchedRole?.internalName || "";
  }, [existingSystemUser, systemUserForm.role, roles]);

  const linkedAssignedBusinesses = useMemo(() => {
    const rawBusinesses = Array.isArray(existingSystemUser?.businesses)
      ? existingSystemUser.businesses
      : [];

    return rawBusinesses
      .map((business) => {
        if (business && typeof business === "object") {
          return business.name || "";
        }

        return businesses.find((item) => item._id === business)?.name || "";
      })
      .filter(Boolean);
  }, [existingSystemUser, businesses]);

  const handleBack = () => {
    history.goBack();
  };

  const handleFormChange = useCallback((key, value) => {
    setFormData((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canUpdateStaff) {
      notifyError("You do not have permission to update staff.");
      return;
    }
    setIsFormSubmitted(true);
    setSaving(true);

    if (isImageUploading) {
      setSaving(false);
      return;
    }

    const dataToSend = {
      ...formData,
      spokenLanguages: formData.spokenLanguages.map((lang) => lang.value),
    };
    try {
      // Validate form data for current tab
      const errors = validateForm();
      setFormErrors(errors);

      // If there are errors, don't proceed
      if (Object.keys(errors).length > 0) {
        // Optionally, show toast notification
        // toast.error("Please fix the errors before proceeding");
        console.log("stoped due to validation errors");
        console.log(errors);
        setSaving(false);
        return;
      }

      if (dataToSend.displayName === "") {
        dataToSend.displayName = dataToSend.fullName;
      }
      await axios.put(`${Base_URL}/staff-management/${id}`, dataToSend);

      // Update the staff data with the new values
      setStaffData({
        ...dataToSend,
        // Convert date back to the format expected by the view component
        dateOfBirth: dataToSend.dateOfBirth
          ? new Date(dataToSend.dateOfBirth)
          : null,
      });

      fetchStaffData();
      setSaving(false);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating staff data:", error);
      notifyError(error?.response?.data?.message); // 🔔 Show toast error from backend validation
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    const formattedDate = staffData.dateOfBirth
      ? new Date(staffData.dateOfBirth).toISOString().split("T")[0]
      : "";

    // Format spokenLanguages to ReactSelect format (array of objects with value and label)
    const formattedLanguages = (staffData.spokenLanguages || [])
      .filter((lang) => lang !== null && lang !== undefined && lang !== "") // Filter out null/undefined/empty values
      .map((lang) => ({
        value: lang,
        label: lang,
      }));

    setFormData({
      ...staffData,
      dateOfBirth: formattedDate,
      spokenLanguages: formattedLanguages,
    });
    setImageUrl(staffData?.image || "");

    setIsEditing(false);
  };

  const handleEdit = () => {
    if (!canUpdateStaff) {
      notifyError("You do not have permission to update staff.");
      return;
    }
    setImageUrl(staffData?.image || formData.image || "");
    setIsEditing(true);
  };

  // Image upload handler using useDropzone
  const onDrop = (acceptedFiles) => {
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("image", file);
    });
    const file = acceptedFiles[0];
    if (file) {
      // Keep preview local only; do not store base64 in formData.image
      setImageUrl(URL.createObjectURL(file));
    }
    setIsImageUploading(true);
    axios
      .post(`${Base_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        setImageUrl(res.data.url);
        setFormData((prev) => ({ ...prev, image: res.data.url }));
      })
      .catch((err) => {
        console.error("Error uploading image:", err);
        notifyError("Failed to upload image. Please try again.");
      })
      .finally(() => setIsImageUploading(false));
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    onDrop,
    // Disable click events on the dropzone area to prevent multiple dialogs
    noClick: true,
    noKeyboard: true,
  });

  const getStatusClass = useCallback((status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-500";
      case "On Leave":
        return "bg-yellow-100 text-yellow-700";
      case "Promoted":
        return "bg-blue-100 text-blue-700";
      case "Inactive":
        return "bg-yellow-100 text-yellow-500";
      case "Terminated":
        return "bg-red-100 text-red-500";
      case "Resigned":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-500";
    }
  }, []);

  // Same as SystemUserForm: generate random 6-digit password, show copy modal
  const handleAutoGeneratePassword = useCallback(() => {
    const chars = "0123456789";
    let generated = "";
    for (let i = 0; i < 6; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSystemUserForm((p) => ({
      ...p,
      password: generated,
      confirmPassword: generated,
    }));
    setSystemUserFormErrors((e) => ({ ...e, sysPassword: "", sysConfirmPassword: "" }));
    setShowSystemUserPassword(true);
    setGeneratedPassword(generated);
    setIsPasswordModalOpen(true);
  }, []);

  // Regenerate password via API (same as SystemUsers) — backend sends email with new password
  const handleRegeneratePassword = useCallback(async () => {
    if (!existingSystemUser?._id) return;
    if (!canUpdateStaff) {
      notifyError("You do not have permission to update staff.");
      return;
    }
    setRegeneratingPassword(true);
    try {
      const res = await axios.post(
        `${Base_URL}/SystemUsers/regenerate-password/${existingSystemUser._id}`,
        {},
        { headers }
      );
      if (res.data?.status) {
        notifySuccess(res.data.message || "Password regenerated and emailed successfully.");
        setSystemUserForm((p) => ({ ...p, password: "", confirmPassword: "" }));
      } else {
        notifyError(res.data?.message || "Failed to regenerate password.");
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to regenerate password.");
    } finally {
      setRegeneratingPassword(false);
    }
  }, [existingSystemUser?._id, headers, canUpdateStaff]);

  const _renderSystemUserForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-gray-600 mb-2">Email (from staff profile)</label>
        <input type="text" value={staffData?.email || ""} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 text-sm" />
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Contact No (from staff profile)</label>
        <input type="text" value={staffData?.mobileNumber || ""} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 text-sm" />
      </div>
      <div>
        <label className="block text-gray-600 mb-2">User Name <span className="text-red-500">*</span></label>
        <InputField type="text" placeholder="Enter display name" value={systemUserForm.name} onChange={(e) => setSystemUserForm((p) => ({ ...p, name: e.target.value }))} error={systemUserFormErrors.sysName} shouldShowError={true} />
      </div>
      <div>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <label className="block text-gray-600 mb-2">
            Password {existingSystemUser ? <span className="text-gray-400 text-xs"></span> : <span className="text-red-500">*</span>}
          </label>
          <button
            type="button"
            onClick={handleAutoGeneratePassword}
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md text-white hover:opacity-90 transition"
          >
            <FiRefreshCw size={14} className="text-black" />
            <span className="text-xs text-black">Auto Generate</span>
          </button>
        </div>
        <div className="relative">
          <InputField
            type={showSystemUserPassword ? "text" : "password"}
            placeholder={existingSystemUser ? "Leave blank to keep current password" : "Enter password"}
            value={systemUserForm.password}
            onChange={(e) => {
              setSystemUserForm((p) => ({ ...p, password: e.target.value }));
              setSystemUserFormErrors((e) => ({ ...e, sysPassword: "" }));
            }}
            error={systemUserFormErrors.sysPassword}
            shouldShowError={true}
            className="pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowSystemUserPassword((prev) => !prev)}
            className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
            aria-label={showSystemUserPassword ? "Hide password" : "Show password"}
            title={showSystemUserPassword ? "Hide password" : "View password"}
          >
            {showSystemUserPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-2">
          Confirm Password {existingSystemUser ? <span className="text-gray-400 text-xs"></span> : <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <InputField
            type={showSystemUserPassword ? "text" : "password"}
            placeholder={existingSystemUser ? "Leave blank to keep current password" : "Confirm password"}
            value={systemUserForm.confirmPassword}
            onChange={(e) => {
              setSystemUserForm((p) => ({ ...p, confirmPassword: e.target.value }));
              setSystemUserFormErrors((e) => ({ ...e, sysConfirmPassword: "" }));
            }}
            error={systemUserFormErrors.sysConfirmPassword}
            shouldShowError={true}
            className="pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowSystemUserPassword((prev) => !prev)}
            className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
            aria-label={showSystemUserPassword ? "Hide password" : "Show password"}
          >
            {showSystemUserPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Business Group <span className="text-red-500">*</span></label>
        <ReactSelect
          options={businessGroups.map((bg) => ({ value: bg._id, label: bg.companyName }))}
          value={systemUserForm.businessGroup ? { value: systemUserForm.businessGroup, label: businessGroups.find((bg) => bg._id === systemUserForm.businessGroup)?.companyName || "Selected Business Group" } : null}
          onChange={(opt) =>
            setSystemUserForm((p) => ({
              ...p,
              businessGroup: opt?.value || "",
              role: "",
              businesses: [],
            }))
          }
          placeholder="Select Business Group"
          styles={reactSelectConfig}
        />
        {systemUserFormErrors.sysBusinessGroup && <p className="text-red-500 text-xs mt-1">{systemUserFormErrors.sysBusinessGroup}</p>}
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Role <span className="text-red-500">*</span></label>
        <ReactSelect
          isDisabled={!systemUserForm.businessGroup}
          options={roles.map((r) => ({ value: r._id, label: r.name || r.internalName || "" }))}
          value={systemUserForm.role ? { value: systemUserForm.role, label: (roles.find((r) => r._id === systemUserForm.role)?.name || roles.find((r) => r._id === systemUserForm.role)?.internalName || "") } : null}
          onChange={(opt) => setSystemUserForm((p) => ({ ...p, role: opt?.value || "", businesses: [] }))}
          placeholder={systemUserForm.businessGroup ? "Select Role" : "Select Business Group first"}
          styles={reactSelectConfig}
        />
        {systemUserFormErrors.sysRole && <p className="text-red-500 text-xs mt-1">{systemUserFormErrors.sysRole}</p>}
      </div>
      <div>
        {!(isSingleBusiness || businesses.length === 1) && (
          <>
        <label className="block text-gray-600 mb-2">Assigned Business <span className="text-red-500">*</span></label>
        <ReactSelect
          isMulti
          isDisabled={!systemUserForm.role}
          options={businesses.map((b) => ({ value: b._id, label: b.name }))}
          value={systemUserForm.businesses.map((bId) => ({ value: bId, label: businesses.find((b) => b._id === bId)?.name || bId }))}
          onChange={(opts) => setSystemUserForm((p) => ({ ...p, businesses: opts ? opts.map((o) => o.value) : [] }))}
          placeholder={systemUserForm.role ? "Select Business(es)" : "Select Role first"}
          styles={reactSelectConfig}
        />
        {systemUserFormErrors.sysBusinesses && <p className="text-red-500 text-xs mt-1">{systemUserFormErrors.sysBusinesses}</p>}
          </>
        )}
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Status</label>
        <ReactSelect
          options={[{ value: true, label: "Active" }, { value: false, label: "Inactive" }]}
          value={{ value: systemUserForm.status, label: systemUserForm.status ? "Active" : "Inactive" }}
          onChange={(opt) => setSystemUserForm((p) => ({ ...p, status: opt.value }))}
          styles={reactSelectConfig}
        />
      </div>
    </div>
  );

  const renderSystemUserSection = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">

      {existingSystemUser && !isEditingSystemUser && (
        <>
         
          <div className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {existingSystemUser.image ? (
                  <img
                    src={existingSystemUser.image}
                    alt="avatar"
                    className="h-14 w-14 rounded-2xl object-cover border border-green-200"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-xl font-semibold text-white">
                    {existingSystemUser.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    <FiCheckCircle className="h-3.5 w-3.5" />
                    Linked
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">
                    {existingSystemUser.name || "Unnamed User"}
                  </h3>
                </div>
              </div>

              <button
                className="inline-flex items-center justify-center rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-green-100"
                onClick={() => setIsEditingSystemUser(true)}
              >
                Edit Account
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-green-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 border border-green-200">
                    <FiMail className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Email
                    </p>
                    <p className="mt-1 break-all text-sm font-medium text-gray-900">
                      {existingSystemUser.email || "No email available"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 border border-green-200">
                    <FiPhone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Contact Number
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {existingSystemUser.contact || "No contact number"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 border border-green-200">
                    <FiUsers className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Business Group
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {linkedBusinessGroupName || "No business group"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 border border-green-200">
                    <FiBriefcase className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Role
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {linkedRoleName || "No role assigned"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-white px-4 py-4 shadow-sm xl:col-span-1 md:col-span-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Assigned Businesses
                  </p>
                  {linkedAssignedBusinesses.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {linkedAssignedBusinesses.map((businessName) => (
                        <span
                          key={businessName}
                          className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                        >
                          {businessName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      No businesses assigned
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {existingSystemUser && isEditingSystemUser && (
        <>
          <p className="text-sm text-gray-500 mb-5">
            Update system user account information.
          </p>
          {_renderSystemUserForm()}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRegeneratePassword}
              disabled={regeneratingPassword}
              className="px-4 py-2 text-sm border border-amber-500 text-amber-700 rounded-lg hover:bg-amber-50 inline-flex items-center gap-2 disabled:opacity-60"
            >
              {regeneratingPassword ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Regenerating...
                </>
              ) : (
                <>Regenerate password & send email</>
              )}
            </button>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="px-5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              onClick={() => {
                setIsEditingSystemUser(false);
                setSystemUserFormErrors({});
              }}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
              onClick={handleSaveSystemUser}
              disabled={savingSystemUser}
            >
              {savingSystemUser ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Saving...
                </>
              ) : "Update System User"}
            </button>
          </div>
        </>
      )}

      {!existingSystemUser && (
        <>
          <p className="text-sm text-gray-500 mb-5">
            Create a system user account for this staff member to allow login
            access.
          </p>
          <div className="flex items-center gap-3 mb-5 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={addAsSystemUser}
                onChange={(e) => {
                  setAddAsSystemUser(e.target.checked);
                  if (e.target.checked && !systemUserForm.name) {
                    setSystemUserForm((prev) => ({
                      ...prev,
                      name: staffData?.fullName || "",
                    }));
                  }
                  setSystemUserFormErrors({});
                }}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--p-blue)]"></div>
            </label>
            <div>
              <p className="font-medium text-gray-800">
                Add this staff as System User
              </p>
              <p className="text-sm text-gray-500">
                Create a login account for this staff member
              </p>
            </div>
          </div>

          {addAsSystemUser && (
            <>
              {_renderSystemUserForm()}
              <div className="mt-6 flex justify-end">
                <button
                  className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
                  onClick={handleSaveSystemUser}
                  disabled={savingSystemUser}
                >
                  {savingSystemUser ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Saving...
                    </>
                  ) : "Create System User"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-base text-gray-600">Loading profile data...</div>
      </div>
    );
  }

  if (!canViewStaffDetails) {
    return (
      <RoutePermissionGate title="Staff Management">
        <div className="mx-auto px-4 py-5 w-full">
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
            You do not have permission to view staff details.
          </div>
        </div>
      </RoutePermissionGate>
    );
  }

  return (
    <RoutePermissionGate title="Staff Management">
    <div className="mx-auto px-4 py-5 w-full overflow-x-hidden">
      {/* Generated Password Popup - same as SystemUserForm */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generated Password</h3>
              <p className="text-sm text-gray-600 mb-4">
                A password has been generated for this user. Please copy and save it securely. You will not be able to see it again.
              </p>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex-1 px-3 py-2 rounded-md border border-gray-300 text-sm break-all">
                  {generatedPassword}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (generatedPassword) {
                      navigator.clipboard?.writeText(generatedPassword);
                      notifySuccess("Password copied to clipboard");
                    }
                  }}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                  aria-label="Copy password"
                >
                  <FiClipboard />
                </button>
              </div>
            </div>
            <div className="px-6 pb-6 pt-0 flex justify-end">
              <Button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-6"
                style={{ backgroundColor: "#0C2E5A" }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title={staffData?.displayName || staffData?.fullName || "Staff Member"}
        showBackButton
        onBackClick={handleBack}
        backFallbackPath="/staff-management"
        actionsContainerClassName="w-auto min-w-0 justify-end flex-nowrap"
        renderActions={
          !isEditing ? (
            <div className="flex items-center gap-3">
              <div className="flex space-x-3">
                {canUpdateStaff && (
                  <button
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                    onClick={handleEdit}
                  >
                    <img src={penIcon || "/placeholder.svg"} alt="pen icon" />
                  </button>
                )}
                <button
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  onClick={() => {
                    setActiveTab(2);
                    document
                      .getElementById("main-content")
                      .scrollTo({ top: 500, behavior: "smooth" });
                  }}
                >
                  <img src={profileIcon || "/placeholder.svg"} alt="profile icon" />
                </button>
                <button
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  onClick={() => {
                    setActiveTab(4);
                    document
                      .getElementById("main-content")
                      .scrollTo({ top: 500, behavior: "smooth" });
                  }}
                >
                  <img src={documentIcon || "/placeholder.svg"} alt="document icon" />
                </button>
                <button
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  onClick={() => {
                    setActiveTab(6);
                    document
                      .getElementById("main-content")
                      .scrollTo({ top: 500, behavior: "smooth" });
                  }}
                >
                  <img src={fileIcon || "/placeholder.svg"} alt="upload icon" />
                </button>
                <button
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  onClick={() => {
                    setActiveTab(7);
                    document
                      .getElementById("main-content")
                      .scrollTo({ top: 500, behavior: "smooth" });
                  }}
                >
                  <img
                    src={certificateIcon || "/placeholder.svg"}
                    alt="certificate icon"
                  />
                </button>
                <button
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  onClick={handleBack}
                >
                  <img src={closeIcon || "/placeholder.svg"} alt="close icon" />
                </button>
              </div>
            </div>
          ) : null
        }
      />

      {/* Profile Card */}
      {isEditing ? (
        /* Edit Mode */
        <form onSubmit={handleSave}>
          <div className="bg-[#F2F5F9] rounded-lg shadow-sm overflow-hidden flex flex-col md:flex-row">
            {/* Left side - Image */}
            <div className="md:w-72 p-5 pt-8 flex flex-col items-center">
              <div className="h-72 mb-3 md:w-full">
                <div
                  {...getRootProps()}
                  className="h-full rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer overflow-hidden"
                  style={{
                    backgroundImage: imageUrl
                      ? `url(${imageUrl})`
                      : formData.image
                      ? `url(${formData.image})`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  onClick={open} // Explicitly use the open function on click
                >
                  <input {...getInputProps()} />
                  {!imageUrl && !formData.image && (
                    <>
                      <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">
                        Drag & drop an image here, or click to select
                      </p>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="flex items-center text-[var(--p-blue)] text-lg mt-1 cursor-pointer"
                onClick={open} // Use the open function here too
              >
                <svg
                  className="w-6 h-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {formData.image
                  ? "Change Profile Image"
                  : "Upload Profile Image"}
              </button>
            </div>

            {/* Right side - Details */}
            <div className="flex-1 p-6 rounded-lg shadow-sm ">
              <h2 className="text-lg font-medium text-gray-800 mb-5">
                Personal Info
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-gray-600 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <InputField
                    type="text"
                    placeholder="Full Name"
                    className={`w-full p-3 bg-gray-200 rounded-lg focus:outline-none
                                  }`}
                    value={formData.fullName}
                    onChange={(e) =>
                      handleFormChange("fullName", e.target.value)
                    }
                  />
                  {formErrors?.fullName && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Preferred Name
                  </label>
                  <InputField
                    type="text"
                    placeholder="Preferred Name"
                    className={`w-full p-3 bg-gray-200 rounded-lg focus:outline-none
                                  }`}
                    value={formData.displayName}
                    onChange={(e) =>
                      handleFormChange("displayName", e.target.value)
                    }
                  />

                  {/* {formErrors?.displayName && <p className="text-red-500 text-sm mt-1">{formErrors.displayName}</p>} */}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <ReactSelect
                      value={
                        formData.status
                          ? STAFF_STATUS_OPTIONS.find(
                              (o) => o.value === formData.status,
                            ) || {
                              value: formData.status,
                              label: formData.status,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "status",
                          selectedOption ? selectedOption.value : "",
                        )
                      }
                      placeholder="Select Status"
                      options={STAFF_STATUS_OPTIONS}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable={false}
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          backgroundColor: "rgb(229, 231, 235)",
                          borderColor: formErrors.status
                            ? "#dc2626"
                            : state.isFocused
                              ? "var(--p-blue)"
                              : "transparent",
                          "&:hover": {
                            borderColor: formErrors.status
                              ? "#dc2626"
                              : "var(--p-blue)",
                          },
                        }),
                      }}
                    />
                    {formErrors.status && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.status}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    name="dateOfBirth"
                    bgColor="#e5e7eb"
                    value={formData.dateOfBirth || ""}
                    onChange={(date) => {
                      setFormData((prev) => ({ ...prev, dateOfBirth: date }));

                      // Real-time validation for future date
                      if (date) {
                        const dateOfBirth = new Date(date);
                        const today = new Date();
                        // Set time to midnight for accurate date comparison
                        today.setHours(0, 0, 0, 0);
                        dateOfBirth.setHours(0, 0, 0, 0);

                        if (dateOfBirth > today) {
                          setFormErrors((prev) => ({
                            ...prev,
                            dateOfBirth:
                              "Date of birth cannot be in the future",
                          }));
                        } else {
                          // Clear error if date is valid
                          setFormErrors((prev) => ({
                            ...prev,
                            dateOfBirth: "",
                          }));
                        }
                      } else {
                        // Clear error if date is cleared
                        setFormErrors((prev) => ({
                          ...prev,
                          dateOfBirth: "",
                        }));
                      }
                    }}
                    className="rounded-lg bg-gray-200 outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] p-3 text-base"
                    error={formErrors.dateOfBirth}
                    shouldShowError={!!formErrors.dateOfBirth}
                  />
                  {/* {formErrors?.dateOfBirth && <p className="text-red-500 text-sm mt-1">{formErrors.dateOfBirth}</p>} */}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <ReactSelect
                      value={
                        formData.gender
                          ? { value: formData.gender, label: formData.gender }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "gender",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Gender"
                      options={genders}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          backgroundColor: "rgb(229, 231, 235)",
                          borderColor: formErrors.gender
                            ? "#dc2626" // red-600
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                  </div>
                  {formErrors.gender && (
                    <div className="text-red-500 text-sm mt-1">
                      {formErrors.gender}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <InputField
                    type="email"
                    placeholder="Email"
                    className={`w-full p-3 bg-gray-200 rounded-lg focus:outline-none
                                  }`}
                    value={formData.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                  />
                  {formErrors?.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Marital Status <span className="text-red-500">*</span>
                  </label>
                  <ReactSelect
                    value={
                      formData.maritalStatus
                        ? {
                            value: formData.maritalStatus,
                            label: formData.maritalStatus,
                          }
                        : null
                    }
                    onChange={(selectedOption) =>
                      handleFormChange(
                        "maritalStatus",
                        selectedOption ? selectedOption.value : ""
                      )
                    }
                    placeholder="Marital Status"
                    options={martialStatuses}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    isSearchable
                    menuPlacement="auto"
                    styles={{
                      ...reactSelectConfig,
                      control: (base, state) => ({
                        ...reactSelectConfig.control?.(base, state),
                        backgroundColor: "rgb(229, 231, 235)",
                        borderColor: formErrors.maritalStatus
                          ? "#dc2626" // red-600
                          : state.isFocused
                          ? "var(--p-blue)"
                          : "transparent",
                        "&:hover": {
                          borderColor: "none",
                        },
                      }),
                    }}
                  />
                  {formErrors?.maritalStatus && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.maritalStatus}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    IC/Passport <span className="text-red-500">*</span>
                  </label>
                  <InputField
                    type="text"
                    placeholder="IC/Passport"
                    className={`w-full p-3 bg-gray-200 rounded-lg focus:outline-none`}
                    value={formData.icorpassport}
                    onChange={(e) =>
                      handleFormChange("icorpassport", e.target.value)
                    }
                  />
                  {formErrors?.icorpassport && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.icorpassport}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">
                    Nationality <span className="text-red-500">*</span>
                  </label>
                  <ReactSelect
                    value={
                      formData.nationality
                        ? {
                            value: formData.nationality,
                            label: formData.nationality,
                          }
                        : null
                    }
                    onChange={(selectedOption) =>
                      handleFormChange(
                        "nationality",
                        selectedOption ? selectedOption.value : ""
                      )
                    }
                    placeholder="Select Nationality"
                    options={nationalities.getAllNationalities().map((e) => ({
                      value: e.name,
                      label: e.name,
                    }))}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    isSearchable
                    menuPlacement="auto"
                    styles={{
                      ...reactSelectConfig,
                      control: (base, state) => ({
                        ...reactSelectConfig.control?.(base, state),
                        backgroundColor: "rgb(229, 231, 235)",
                        borderColor: formErrors.nationality
                          ? "#dc2626" // red-600
                          : state.isFocused
                          ? "var(--p-blue)"
                          : "transparent",
                        "&:hover": {
                          borderColor: "none",
                        },
                      }),
                    }}
                  />
                  {formErrors?.nationality && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.nationality}
                    </p>
                  )}
                </div>

                <PositionSelectWithAdd
                  businessId={staffData?.business?._id}
                  value={formData.position?._id || ""}
                  onChange={(id) => {
                    const selected = positions.find(
                      (p) => String(p._id) === String(id)
                    );
                    handleFormChange("position", selected || null);
                  }}
                  positions={positions}
                  onPositionsRefetch={() =>
                    fetchPositions(staffData?.business?._id)
                  }
                  error={formErrors.position}
                  required
                  controlBackgroundColor="rgb(229, 231, 235)"
                  idleBorderColor="transparent"
                />

                <DepartmentSelectWithAdd
                  businessId={staffData?.business?._id}
                  value={formData.department?._id || ""}
                  onChange={(id) => {
                    const selected = departments.find(
                      (d) => String(d._id) === String(id)
                    );
                    handleFormChange("department", selected || null);
                  }}
                  departments={departments}
                  onDepartmentsRefetch={() =>
                    fetchDepartments(staffData?.business?._id)
                  }
                  error={formErrors.department}
                  label="Department"
                  required
                  controlBackgroundColor="rgb(229, 231, 235)"
                  idleBorderColor="transparent"
                />

                <div>
                  <label className="block text-gray-600 mb-2">Blood Type</label>
                  <ReactSelect
                    value={
                      formData.bloodType
                        ? {
                            value: formData.bloodType,
                            label: formData.bloodType,
                          }
                        : null
                    }
                    onChange={(selectedOption) =>
                      handleFormChange(
                        "bloodType",
                        selectedOption ? selectedOption.value : ""
                      )
                    }
                    placeholder="Select Blood Type"
                    options={bloods}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    isSearchable
                    menuPlacement="auto"
                    styles={{
                      ...reactSelectConfig,
                      control: (base, state) => ({
                        ...reactSelectConfig.control?.(base, state),
                        backgroundColor: "rgb(229, 231, 235)", // same as style from your original
                        borderColor: state.isFocused
                          ? "var(--p-blue)"
                          : "transparent",
                        "&:hover": {
                          borderColor: "var(--p-blue)",
                        },
                      }),
                    }}
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-2">Religion</label>
                  <ReactSelect
                    value={
                      formData.religion
                        ? religions.find(
                            (r) => r.value === formData.religion
                          ) || null
                        : null
                    }
                    onChange={(selectedOption) =>
                      handleFormChange(
                        "religion",
                        selectedOption ? selectedOption.value : ""
                      )
                    }
                    placeholder="Select Religion"
                    options={religions}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    isSearchable
                    menuPlacement="auto"
                    styles={{
                      ...reactSelectConfig,
                      control: (base, state) => ({
                        ...reactSelectConfig.control?.(base, state),
                        backgroundColor: "rgb(229, 231, 235)", // Tailwind gray-200
                        borderColor: state.isFocused
                          ? "var(--p-blue)"
                          : "transparent",
                        "&:hover": {
                          borderColor: "var(--p-blue)",
                        },
                      }),
                    }}
                  />
                </div>

                <div className="relative z-50">
                  <label className="block text-gray-600 mb-2">
                    Spoken Languages <span className="text-red-500">*</span>
                  </label>
                  <ReactSelect
                    options={ISO6391.getAllNames().map((language) => ({
                      label: language,
                      value: language,
                    }))}
                    value={formData.spokenLanguages}
                    onChange={(selectedOptions) => {
                      setFormData((prev) => ({
                        ...prev,
                        spokenLanguages: selectedOptions || [],
                      }));
                    }}
                    isMulti
                    isSearchable
                    placeholder="Select languages..."
                    menuPlacement="top"
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: "rgb(229, 231, 235)",
                        borderWidth: "2px",
                        borderColor: state.isFocused ? "var(--p-blue)" : "none",
                        boxShadow: state.isFocused ? "none" : "none",
                        "&:hover": {
                          borderColor: "none",
                        },
                        borderRadius: "12px",
                        minHeight: "2.5rem",
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? "#eff6ff" : "white",
                        color: "#1f2937",
                        "&:active": {
                          backgroundColor: "#dbeafe",
                        },
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: "white",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                        zIndex: 9999,
                        position: "absolute",
                      }),
                      multiValue: (base) => ({
                        ...base,
                        backgroundColor: "#f9fafb",
                        borderRadius: "0.375rem",
                      }),
                      multiValueLabel: (base) => ({
                        ...base,
                        color: "#1f2937",
                      }),
                      multiValueRemove: (base) => ({
                        ...base,
                        color: "#ef4444",
                        ":hover": {
                          backgroundColor: "#fecaca",
                          color: "#b91c1c",
                        },
                      }),
                    }}
                  />
                  {formErrors?.spokenLanguages && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.spokenLanguages}
                    </p>
                  )}
                </div>
                
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md text-white bg-[var(--p-blue)] hover:bg-[#9CBD33] font-medium transition-colors"
                  disabled={saving || isImageUploading}
                >
                  {isImageUploading
                    ? "Uploading image..."
                    : saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* View Mode */
        <div className="bg-[#F9FAFB] rounded-xl shadow-md overflow-hidden flex flex-col md:flex-row">
          {/* Image and Info Block */}
          <div className="md:w-72 border-r flex flex-col items-center p-6">
            <img
              src={
                staffData.image
                  ? `${staffData.image}`
                  : "/placeholder-profile.jpg"
              }
              alt="Profile"
              className="h-64 w-64 rounded-xl object-cover object-center border shadow-sm"
            />

            {/* Mobile-only Info (visible on small screens only) */}
            <div className="mt-6 w-full block md:hidden">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                Personal Info
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: "Full Name", value: staffData?.fullName },
                  { label: "Preferred Name", value: staffData?.displayName },
                  { label: "Email", value: staffData?.email },
                  { label: "Nationality", value: staffData?.nationality },
                  { label: "Marital Status", value: staffData?.maritalStatus },
                  {
                    label: "IC/Passport",
                    value: staffData.icorpassport
                      ? formatDate(staffData.icorpassport)
                      : "-",
                  },
                  {
                    label: "Date of Birth",
                    value: staffData.dateOfBirth
                      ? formatDate(staffData.dateOfBirth)
                      : "-",
                  },
                  { label: "Gender", value: staffData.gender },
                  { label: "Position", value: staffData.position?.name },
                  { label: "Department", value: staffData.department?.name },
                  { label: "Blood Type", value: staffData.bloodType },
                  { label: "Religion", value: staffData.religion },
                ].map((field, index) => (
                  <div key={index}>
                    <p className="text-sm text-gray-500">{field.label}</p>
                    <p className="text-base font-medium text-gray-900">
                      {field.value || "-"}
                    </p>
                  </div>
                ))}
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                      staffData?.status
                    )}`}
                  >
                    {staffData?.status || "Unknown"}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Spoken Languages</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {staffData.spokenLanguages?.length ? (
                      staffData.spokenLanguages.map((e, id) => (
                        <span
                          key={id}
                          className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                        >
                          {e}
                        </span>
                      ))
                    ) : (
                      <span className="text-base font-medium text-gray-900">
                        -
                      </span>
                    )}
                  </div>
                </div>
                
              </div>
            </div>
          </div>

          {/* Desktop Details Block */}
          <div className="flex-1 p-6 hidden md:block">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">
              Personal Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData?.fullName || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Preferred Name</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData?.displayName || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                    staffData?.status
                  )}`}
                >
                  {staffData?.status || "Unknown"}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData?.email || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Nationality</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData?.nationality || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Marital Status</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData?.maritalStatus || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">IC/Passport</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.icorpassport}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.dateOfBirth
                    ? formatDate(staffData.dateOfBirth)
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Gender</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.gender || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Position</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.position?.name || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.department?.name || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Blood Type</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.bloodType || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Religion</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {staffData.religion || "-"}
                </p>
              </div>

              <div className="">
                <p className="text-sm text-gray-500">Spoken Languages</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {staffData.spokenLanguages?.length ? (
                    staffData.spokenLanguages.map((e, id) => (
                      <span
                        className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                        key={id}
                      >
                        {e}
                      </span>
                    ))
                  ) : (
                    <p className="text-base font-medium text-gray-900">-</p>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}
      <EditDetails
        formData={formData}
        setFormData={setFormData}
        id={id}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemUserContent={renderSystemUserSection()}
      />
    </div>
    </RoutePermissionGate>
  );
};

export default StaffDetailsComponent;
