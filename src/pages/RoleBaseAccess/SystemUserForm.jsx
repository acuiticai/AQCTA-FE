import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
} from "@windmill/react-ui";
import { Scrollbars } from "react-custom-scrollbars-2";
import { useDropzone } from "react-dropzone";
import { useHistory, useLocation, useParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { FiClipboard, FiEye, FiEyeOff, FiRefreshCw, FiUploadCloud, FiXCircle } from "react-icons/fi";

import Title from "@/components/form/others/Title";
import LabelArea from "@/components/form/selectOption/LabelArea";
import { BackButton, InputField, PageHeader, DropdownBasic } from "@/page-layouts/index";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { useModulePermissions, PERMISSION_ACTION } from "@/utils/permissionUtils";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import { USER_ROLES_CHANGED_EVENT } from "@/utils/userRolesEvents";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SystemUserForm = () => {
  const history = useHistory();
  const { id } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const { canAdd, canUpdate, canView } = useModulePermissions(
    "Global Settings",
    "System Users"
  );

  const isEditMode = Boolean(id);
  const preloadedUser = location.state?.user || null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageS3Key, setImageS3Key] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [ParentModules, setParentModules] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [formBusinessGroup, setFormBusinessGroup] = useState("");
  const [businessGroups, setBusinessGroups] = useState([]);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    imageUrl: "",
    password: "",
    confirmPassword: "",
    contact: "",
    role: "",
    status: "",
    businesses: "",
    businessGroup: "",
  });
  const [showImage, setShowImage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const clearError = (fieldName) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: "",
    }));
  };

  const inferS3KeyFromUrl = (url) => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      return (urlObj.pathname || "").replace(/^\/+/, "");
    } catch (e) {
      const marker = ".amazonaws.com/";
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        return url.substring(idx + marker.length);
      }
      return url;
    }
  };

  const fetchBusinessGroupsList = async () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    try {
      const res = await axios.get(`${Base_URL}/business-groups`, { headers });
      const list = Array.isArray(res.data?.businessGroups)
        ? res.data.businessGroups
        : Array.isArray(res.data)
        ? res.data
        : [];
      setBusinessGroups(list);
    } catch (err) {
      console.error("Failed to fetch business groups:", err);
      setBusinessGroups([]);
    }
  };

  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

  const fetchRolesByBusinessGroup = async (businessGroupId) => {
    if (!businessGroupId) {
      setParentModules([]);
      return;
    }
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    try {
      const res = await axios.post(
        `${Base_URL}/UserRoles/get_all_user_roles`,
        { businessGroupId },
        { headers }
      );
      const roles = Array.isArray(res.data?.data) ? res.data.data : [];
      const scopedRoles = isSuperAdmin
        ? roles
        : roles.filter((role) => role?.isSuperAdmin !== true);
      setParentModules(scopedRoles);
    } catch (err) {
      console.error("Failed to fetch roles by business group:", err);
      setParentModules([]);
    }
  };

  const fetchBusinessesByGroup = async (businessGroupId) => {
    if (!businessGroupId) {
      setBusinesses([]);
      return;
    }
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    try {
      const res = await axios.post(
        `${Base_URL}/Business/getALL`,
        { businessGroup: businessGroupId },
        { headers }
      );
      const list = res?.data?.data || [];
      setBusinesses(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch businesses by group:", err);
      setBusinesses([]);
    }
  };

  /** Super Admin: all businesses (API returns full list for super-admin callers). */
  const fetchAllBusinesses = async () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    try {
      const res = await axios.post(`${Base_URL}/Business/getALL`, {}, { headers });
      const list = res?.data?.data || [];
      setBusinesses(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch all businesses:", err);
      setBusinesses([]);
    }
  };

  useEffect(() => {
    fetchBusinessGroupsList();
  }, []);

  // Single business group → auto-select (create + edit)
  useEffect(() => {
    if (businessGroups.length !== 1 || formBusinessGroup) return;
    setFormBusinessGroup(businessGroups[0]._id);
  }, [businessGroups, formBusinessGroup]);

  // Single business in list → auto-select assigned business
  useEffect(() => {
    if (businesses.length !== 1) return;
    const onlyId = businesses[0]._id;
    setSelectedBusinesses((prev) => {
      if (prev.length === 1 && String(prev[0]) === String(onlyId)) return prev;
      return [onlyId];
    });
    clearError("businesses");
  }, [businesses]);

  useEffect(() => {
    if (formBusinessGroup) {
      fetchRolesByBusinessGroup(formBusinessGroup);
    } else {
      setParentModules([]);
    }
  }, [formBusinessGroup]);

  // Refresh role dropdown when roles are created/updated elsewhere (e.g. User Roles page) or tab regains focus
  useEffect(() => {
    if (!formBusinessGroup) return;

    const refreshRoles = () => fetchRolesByBusinessGroup(formBusinessGroup);

    const onRolesChanged = (event) => {
      const changedGroupId = event.detail?.businessGroupId;
      if (
        changedGroupId &&
        String(changedGroupId) !== String(formBusinessGroup)
      ) {
        return;
      }
      refreshRoles();
    };

    window.addEventListener(USER_ROLES_CHANGED_EVENT, onRolesChanged);
    window.addEventListener("focus", refreshRoles);

    return () => {
      window.removeEventListener(USER_ROLES_CHANGED_EVENT, onRolesChanged);
      window.removeEventListener("focus", refreshRoles);
    };
  }, [formBusinessGroup]);

  const isEditingSuperAdminUser =
    isEditMode && preloadedUser?.role?.isSuperAdmin === true;

  const availableRoleOptions = useMemo(() => {
    if (isEditingSuperAdminUser && preloadedUser?.role) {
      return [preloadedUser.role];
    }
    return ParentModules;
  }, [isEditingSuperAdminUser, preloadedUser, ParentModules]);

  const targetRoleIsSuperAdmin = useMemo(() => {
    if (!role) return false;
    const fromList = availableRoleOptions.find(
      (r) => String(r._id) === String(role)
    );
    return fromList?.isSuperAdmin === true;
  }, [role, availableRoleOptions]);

  useEffect(() => {
    if (targetRoleIsSuperAdmin) {
      fetchAllBusinesses();
      return;
    }
    if (formBusinessGroup) {
      fetchBusinessesByGroup(formBusinessGroup);
    } else {
      setBusinesses([]);
    }
  }, [targetRoleIsSuperAdmin, formBusinessGroup, role]);

  useEffect(() => {
    if (!preloadedUser) return;

    setName(preloadedUser.name || "");
    setEmail(preloadedUser.email || "");
    setImageUrl(preloadedUser.image || "");
    setImageS3Key(inferS3KeyFromUrl(preloadedUser.image || ""));
    setShowImage(!!preloadedUser.image);

    const roleBusinessGroupId =
      preloadedUser.role?.businessGroup?._id ||
      preloadedUser.role?.businessGroup ||
      "";
    // Keep single-group auto-select if role has no businessGroup populated
    setFormBusinessGroup((prev) => roleBusinessGroupId || prev || "");
    setRole(preloadedUser.role?._id || "");
    setStatus(
      preloadedUser.status !== undefined
        ? preloadedUser.status.toString()
        : ""
    );
    setContact(preloadedUser.contact || "");
    setSelectedBusinesses(
      (Array.isArray(preloadedUser.businesses)
        ? preloadedUser.businesses
        : []
      )
        .map((b) => (typeof b === "object" ? b?._id || b?.id : b))
        .filter(Boolean)
    );
  }, [preloadedUser]);

  useEffect(
    () => () => files.forEach((file) => URL.revokeObjectURL(file.preview)),
    [files]
  );

  const onDrop = (acceptedFiles) => {
    setLoading(true);
    setFiles(
      acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      )
    );

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("image", file);
    });

    axios
      .post(`${Base_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        setImageUrl(res.data.url);
        if (res.data.s3Key) {
          setImageS3Key(res.data.s3Key);
        }
        setShowImage(true);
        setLoading(false);
        clearError("imageUrl");
        notifySuccess(t("systemUsers.imageUploadedSuccessfully"));
      })
      .catch((err) => {
        console.error("Error uploading image:", err);
        setLoading(false);
        notifyError(t("systemUsers.failedToUploadImage"));
      });
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    onDrop,
  });

  const handleRemoveImage = async (img) => {
    try {
      setLoading(true);
      const key =
        imageS3Key && imageS3Key.trim().length > 0
          ? imageS3Key
          : inferS3KeyFromUrl(img);

      if (!key) {
        notifyError(t("systemUsers.failedToDeleteImageFromServer"));
        setLoading(false);
        return;
      }

      const response = await axios.delete(
        `${Base_URL}/upload/${encodeURIComponent(key)}`
      );

      if (response.data.status) {
        notifySuccess(t("systemUsers.imageDeletedSuccessfully"));
        setImageUrl("");
        setImageS3Key("");
        setShowImage(false);
        setFiles([]);
      } else {
        notifyError(
          response?.data?.message ||
            t("systemUsers.failedToDeleteImageFromServer")
        );
      }

      setLoading(false);
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(
        err.response?.data?.message ||
          t("systemUsers.failedToDeleteImage")
      );
      setLoading(false);
    }
  };

  const handleBusinessChange = (businessId) => {
    const idStr = String(businessId);
    setSelectedBusinesses((prev) => {
      const has = prev.some((id) => String(id) === idStr);
      if (has) {
        return prev.filter((id) => String(id) !== idStr);
      }
      return [...prev, businessId];
    });
    clearError("businesses");
  };

  const isBusinessSelected = (businessId) =>
    selectedBusinesses.some((id) => String(id) === String(businessId));

  const allBusinessesInListSelected = useMemo(() => {
    if (!businesses.length) return false;
    return businesses.every((b) =>
      selectedBusinesses.some((id) => String(id) === String(b._id))
    );
  }, [businesses, selectedBusinesses]);

  const selectAllBusinessesRef = useRef(null);
  useEffect(() => {
    const el = selectAllBusinessesRef.current;
    if (!el || businesses.length === 0) {
      if (el) el.indeterminate = false;
      return;
    }
    const selectedCount = businesses.filter((b) =>
      selectedBusinesses.some((id) => String(id) === String(b._id))
    ).length;
    el.indeterminate = selectedCount > 0 && selectedCount < businesses.length;
  }, [businesses, selectedBusinesses]);

  const handleSelectAllBusinessesToggle = (checked) => {
    if (checked) {
      setSelectedBusinesses(businesses.map((b) => b._id));
    } else {
      setSelectedBusinesses([]);
    }
    clearError("businesses");
  };

  const handleAutoGeneratePassword = () => {
    const chars = "0123456789";
    let generated = "";
    for (let i = 0; i < 6; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setConfirmPassword(generated);
    setGeneratedPassword(generated);
    clearError("password");
    clearError("confirmPassword");
    setShowPassword(true);
    setIsPasswordModalOpen(true);
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      name: "",
      email: "",
      imageUrl: "",
      password: "",
      confirmPassword: "",
      contact: "",
      role: "",
      status: "",
      businesses: "",
      businessGroup: "",
    };

    if (!name.trim()) {
      newErrors.name = t("systemUsers.validation.nameIsRequired");
      isValid = false;
    } else if (name.length < 3) {
      newErrors.name = t(
        "systemUsers.validation.nameMustBeAtLeast3Characters"
      );
      isValid = false;
    } else if (name.length > 50) {
      newErrors.name = t(
        "systemUsers.validation.nameMustBeLessThan50Characters"
      );
      isValid = false;
    }

    const emailRegex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      newErrors.email = t("systemUsers.validation.emailIsRequired");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = t(
        "systemUsers.validation.pleaseEnterValidEmailAddress"
      );
      isValid = false;
    } else if (email.length > 100) {
      newErrors.email = t(
        "systemUsers.validation.emailMustBeLessThan100Characters"
      );
      isValid = false;
    }

    if (!isEditMode) {
      if (!password) {
        newErrors.password = t("systemUsers.validation.passwordIsRequired");
        isValid = false;
      } else if (password.length < 6) {
        newErrors.password = t(
          "systemUsers.validation.passwordMustBeAtLeast6Characters"
        );
        isValid = false;
      } else if (password.length > 50) {
        newErrors.password = t(
          "systemUsers.validation.passwordMustBeLessThan50Characters"
        );
        isValid = false;
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = t(
          "systemUsers.validation.confirmPasswordIsRequired"
        );
        isValid = false;
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = t(
          "systemUsers.validation.passwordsDoNotMatch"
        );
        isValid = false;
      }
    } else if (password && password !== confirmPassword) {
      newErrors.confirmPassword = t(
        "systemUsers.validation.passwordsDoNotMatch"
      );
      isValid = false;
    } else if (password && password.length < 6) {
      newErrors.password = t(
        "systemUsers.validation.passwordMustBeAtLeast6Characters"
      );
      isValid = false;
    } else if (password && password.length > 50) {
      newErrors.password = t(
        "systemUsers.validation.passwordMustBeLessThan50Characters"
      );
      isValid = false;
    }

    if (!contact.trim()) {
      newErrors.contact = t(
        "systemUsers.validation.contactNumberIsRequired"
      );
      isValid = false;
    } else {
      const cleanContact = contact.replace(/[^0-9]/g, "");
      if (!/^\d{10,15}$/.test(cleanContact)) {
        newErrors.contact = t(
          "systemUsers.validation.pleaseEnterValidContactNumber"
        );
        isValid = false;
      }
    }

    if (!targetRoleIsSuperAdmin && !formBusinessGroup) {
      newErrors.businessGroup =
        t("systemUsers.validation.businessGroupIsRequired") ||
        "Business Group is required";
      isValid = false;
    }

    if (!role) {
      newErrors.role = t("systemUsers.validation.roleIsRequired");
      isValid = false;
    }

    if (status === "") {
      newErrors.status = t("systemUsers.validation.statusIsRequired");
      isValid = false;
    }

    if (!imageUrl) {
      newErrors.imageUrl = t(
        "systemUsers.validation.profileImageIsRequired"
      );
      isValid = false;
    }

    if (selectedBusinesses.length === 0) {
      newErrors.businesses = t(
        "systemUsers.validation.atLeastOneBusinessMustBeSelected"
      );
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      notifyError(t("systemUsers.pleaseCorrectErrorsInForm"));
      return;
    }

    if (isEditMode && !canUpdate) {
      notifyError("Access restricted: you don't have permission to update System Users.");
      return;
    }
    if (!isEditMode && !canAdd) {
      notifyError("Access restricted: you don't have permission to add System Users.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name,
      email,
      image: imageUrl,
      contact,
      role,
      status: status === "true",
      businesses: selectedBusinesses,
    };

    if (password) {
      payload.password = password;
      payload.confirmPassword = confirmPassword;
    }

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    try {
      const url = isEditMode
        ? `${Base_URL}/SystemUsers/update/${id}`
        : `${Base_URL}/SystemUsers/add`;
      const method = isEditMode ? "put" : "post";
      const res = await axios[method](url, payload, { headers });

      if (res.data.status) {
        notifySuccess(
          res.data.message ||
            (isEditMode
              ? t("systemUsers.userUpdatedSuccessfully")
              : t("systemUsers.userAddedSuccessfully"))
        );
        history.push("/SystemUsers");
      } else {
        notifyError(res.data.message || "Operation failed");
      }
    } catch (err) {
      console.error("Error submitting System User:", err);
      notifyError(err.response?.data?.message || "Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageTitle = isEditMode
    ? t("systemUsers.updateSystemUser")
    : t("systemUsers.addSystemUser");

  const content = (
    <div className="py-6 px-6 min-h-screen">
      <BackButton onClick={() => history.push("/SystemUsers")} />
      <PageHeader title={pageTitle} />

      {/* Generated Password Popup */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generated Password
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                A password has been generated for this user. Please copy and
                save it securely. You will not be able to see it again.
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

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {/* <div className="w-full relative p-4 border border-gray-100 bg-gray-50 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <Title
            title={pageTitle}
            description={
              isEditMode
                ? t("systemUsers.updateUserDetailsBelow")
                : t("systemUsers.fillAllFieldsToCreateNewUser")
            }
          />
        </div> */}

               <div className="bg-white rounded-lg shadow-sm p-6 space-y-6 dark:bg-gray-900">
          {/* Row 0: Profile Image (full width) */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("Image")} <span className="text-red-500">*</span>
            </label>
            <div className="w-full text-center">
              <div
                className="border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer px-6 pt-5 pb-6"
                {...getRootProps()}
              >
                <input {...getInputProps()} />
                <span className="mx-auto flex justify-center">
                  <FiUploadCloud className="text-3xl text-emerald-500" />
                </span>
                <p className="text-sm mt-2">{t("DragYourImage")}</p>
                <em className="text-xs text-gray-400">{t("imageFormat")}</em>
              </div>

              {loading && (
                <div className="text-center mt-4">
                  <img
                    src={spinnerLoadingImage}
                    alt="Loading"
                    className="mx-auto w-10 h-10"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    {t("systemUsers.uploadingImage")}
                  </p>
                </div>
              )}

              <aside className="flex flex-row flex-wrap mt-4">
                {showImage && imageUrl ? (
                  <div className="relative">
                    <img
                      className="inline-flex border rounded-md border-gray-100 dark:border-gray-600 w-24 max-h-24 p-2"
                      src={imageUrl}
                      alt="user profile"
                    />
                    <button
                      type="button"
                      className="absolute top-0 right-0 text-red-500 focus:outline-none"
                      onClick={() => handleRemoveImage(imageUrl)}
                    >
                      <FiXCircle />
                    </button>
                  </div>
                ) : (
                  files.map((file) => (
                    <div key={file.name} className="relative mr-2">
                      <img
                        className="inline-flex border rounded-md border-gray-100 dark:border-gray-600 w-24 max-h-24 p-2"
                        src={file.preview}
                        alt={file.name}
                      />
                    </div>
                  ))
                )}
              </aside>
              {errors.imageUrl && (
                <p className="text-red-500 text-xs mt-1">{errors.imageUrl}</p>
              )}
            </div>
          </div>

          {/* Row 1: Name + Email */}
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("hrReports.common.name")} <span className="text-red-500">*</span>
              </label>
              <InputField
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder={t("systemUsers.userName")}
                className={`mt-1 block w-full ${errors.name ? "border-red-500" : ""}`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("systemUsers.userEmail")} <span className="text-red-500">*</span>
              </label>
              <InputField
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                placeholder={t("systemUsers.userEmail")}
                className={`mt-1 block w-full ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Auto-generate password button */}
          {/* <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAutoGeneratePassword}
              className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md text-white hover:opacity-90 transition"
              style={{ backgroundColor: "#0C2E5A" }}
            >
              <FiRefreshCw size={14} />
              <span>Auto Generate</span>
            </button>
          </div> */}

          {/* Row 2: Password + Confirm Password */}
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col">
            <div className="flex justify-between">
               <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEditMode
                  ? t("systemUsers.leaveBlankToKeepCurrentPassword")
                  : t("Password")}{" "}
                {!isEditMode && <span className="text-red-500">*</span>}
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError("password");
                  }}
                  placeholder={
                    isEditMode
                      ? t("systemUsers.leaveBlankToKeepCurrentPassword")
                      : "Enter password"
                  }
                  className={`w-full pr-10 ${errors.password ? "border-red-500" : ""}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEditMode
                  ? t("systemUsers.leaveBlankToKeepCurrentPassword")
                  : t("Confirm Password")}{" "}
                {!isEditMode && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <InputField
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError("confirmPassword");
                  }}
                  placeholder={
                    isEditMode
                      ? t("systemUsers.leaveBlankToKeepCurrentPassword")
                      : "Confirm password"
                  }
                  className={`w-full ${errors.confirmPassword ? "border-red-500" : ""}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* Row 3: Status + Contact */}
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("hrReports.common.status")} <span className="text-red-500">*</span>
              </label>
              <DropdownBasic
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  clearError("status");
                }}
                className={`mt-1 ${errors.status ? "border-red-500" : ""}`}
                options={[
                  { label: t("selectStatus"), value: "" },
                  { label: t("active"), value: "true" },
                  { label: t("inactive"), value: "false" },
                ]}
              />
              {errors.status && (
                <p className="text-red-500 text-xs mt-1">{errors.status}</p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("systemUsers.userContactNo")} <span className="text-red-500">*</span>
              </label>
              <InputField
                type="text"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  clearError("contact");
                }}
                placeholder={t("systemUsers.userContactNo")}
                className={`mt-1 block w-full ${errors.contact ? "border-red-500" : ""}`}
              />
              {errors.contact && (
                <p className="text-red-500 text-xs mt-1">{errors.contact}</p>
              )}
            </div>
          </div>

          {/* Row 4: Business Group + Role (hidden for Super Admin / single group) */}
          <div
            className={`grid gap-6 ${
              targetRoleIsSuperAdmin || businessGroups.length === 1
                ? "grid-cols-1"
                : "grid-cols-2"
            }`}
          >
            {!targetRoleIsSuperAdmin && businessGroups.length !== 1 && (
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("systemUsers.businessGroup") || "Business Group"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <DropdownBasic
                  value={formBusinessGroup}
                  onChange={(value) => {
                    setFormBusinessGroup(value);
                    setRole("");
                    setSelectedBusinesses([]);
                    clearError("role");
                    clearError("businesses");
                    clearError("businessGroup");
                  }}
                  placeholder={
                    t("systemUsers.selectBusinessGroupFirst") ||
                    "Select Business Group first"
                  }
                  options={[
                    {
                      label:
                        t("systemUsers.selectBusinessGroup") ||
                        "Select Business Group",
                      value: "",
                    },
                    ...businessGroups.map((bg) => ({
                      label: bg.companyName,
                      value: bg._id,
                    })),
                  ]}
                  disabled={isEditMode}
                />
                {isEditMode && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t("systemUsers.businessGroupLockedOnEdit") ||
                      "Business Group cannot be changed when editing."}
                  </p>
                )}
                {errors.businessGroup && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.businessGroup}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("systemUsers.selectRole")} <span className="text-red-500">*</span>
              </label>
              <DropdownBasic
                value={role}
                onChange={(value) => {
                  setRole(value);
                  clearError("role");
                  clearError("businesses");
                }}
                placeholder={
                  formBusinessGroup ||
                  targetRoleIsSuperAdmin ||
                  businessGroups.length === 1
                    ? t("systemUsers.selectRole")
                    : t("systemUsers.selectBusinessGroupFirst") ||
                      "Select Business Group first"
                }
                options={availableRoleOptions.map((userRole) => ({
                  label: userRole.name || userRole.internalName || "",
                  value: userRole._id,
                }))}
              />
              {errors.role && (
                <p className="text-red-500 text-xs mt-1">{errors.role}</p>
              )}
            </div>
          </div>

          {/* Row 5: Assigned Businesses — hide when only one (or none while single-group loads) */}
          {!(
            businesses.length === 1 ||
            (businessGroups.length === 1 &&
              !targetRoleIsSuperAdmin &&
              businesses.length === 0)
          ) && (
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("systemUsers.assignedBusiness")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 p-3 rounded-md">
              {businesses.length > 0 ? (
                <>
                  <div className="flex items-center space-x-2 pb-2 mb-2 border-b border-gray-200 dark:border-gray-600">
                    <input
                      ref={selectAllBusinessesRef}
                      type="checkbox"
                      id="assign-all-businesses"
                      checked={allBusinessesInListSelected}
                      onChange={(e) =>
                        handleSelectAllBusinessesToggle(e.target.checked)
                      }
                      className="form-checkbox h-4 w-4 text-emerald-500 focus:ring-emerald-400"
                    />
                    <label
                      htmlFor="assign-all-businesses"
                      className="text-sm font-medium text-gray-800 dark:text-gray-200"
                    >
                      {t("systemUsers.assignAllBusinesses")}
                    </label>
                  </div>
                  {businesses.map((business) => (
                    <div
                      key={business._id}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        id={`business-${business._id}`}
                        checked={isBusinessSelected(business._id)}
                        onChange={() => handleBusinessChange(business._id)}
                        className="form-checkbox h-4 w-4 text-emerald-500 focus:ring-emerald-400"
                      />
                      <label
                        htmlFor={`business-${business._id}`}
                        className="text-sm"
                      >
                        {targetRoleIsSuperAdmin &&
                        business.businessGroup?.companyName
                          ? `${business.name} (${business.businessGroup.companyName})`
                          : business.name}
                      </label>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  {t("systemUsers.noBusinessesAvailable")}
                </p>
              )}
            </div>
            {errors.businesses && (
              <p className="text-red-500 text-xs mt-1">{errors.businesses}</p>
            )}
          </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={() => history.push("/SystemUsers")}
            className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {t("cancel") || "Cancel"}
          </button>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              (isEditMode ? !canUpdate : !canAdd)
            }
            className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                {t("processing")}
              </span>
            ) : isEditMode ? (
              t("systemUsers.updateSystemUser")
            ) : (
              t("systemUsers.addSystemUser")
            )}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <ModuleAccessGate
      moduleName="Global Settings"
      subModuleName="System Users"
      title={pageTitle}
      requiredPermission={
        isEditMode ? PERMISSION_ACTION.UPDATE : PERMISSION_ACTION.ADD
      }
    >
      {content}
    </ModuleAccessGate>
  );
};

export default SystemUserForm;

