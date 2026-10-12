import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import {
  Button,
  Card as WindmillCard,
  CardBody,
} from "@windmill/react-ui";
import { Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import { useTranslation } from "react-i18next";
import {
  FiTrash2,
  FiUploadCloud,
  FiXCircle,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiLock,
  FiClipboard,
} from "react-icons/fi";
import { Button as LayoutButton } from "@/page-layouts/index";
import { Scrollbars } from "react-custom-scrollbars-2";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import Title from "@/components/form/others/Title";
import MainDrawer from "@/components/drawer/MainDrawer";
import LabelArea from "@/components/form/selectOption/LabelArea";
import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useHistory } from "react-router-dom";
import useButtonColor from "@/hooks/useButtonColor";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import {
  DropdownBasic,
  InputField,
  Tooltip,
  ActionButtons,
} from "@/page-layouts/index";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import PortalButton from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { useModulePermissions } from "@/utils/permissionUtils";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import { USER_ROLES_CHANGED_EVENT } from "@/utils/userRolesEvents";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SystemUsers = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { toggleDrawer } = useContext(SidebarContext);
  const [data, setData] = useState([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [FilterStatus, setFilterStatus] = useState("");
  const [FilterName, setFilterText] = useState("");
  const [FilterRole, setFilterRole] = useState("");
  const [ToBeDeleted, setToBeDeleted] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageS3Key, setImageS3Key] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [status, setStatus] = useState("");
  const [ParentModules, setParentModules] = useState([]);
  const [Business, setBusiness] = useState("");
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [formBusinessGroup, setFormBusinessGroup] = useState("");
  const [businessGroups, setBusinessGroups] = useState([]);
  const [allRolesForFilter, setAllRolesForFilter] = useState([]);
  const [showImage, setShowImage] = useState(false);
  const buttonColor = useButtonColor();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const isAdminUser = adminInfo?.role?.isSuperAdmin === true;

  const getLoggedInBusinessGroupId = () => {
    const bg = adminInfo?.role?.businessGroup;
    if (!bg) return "";
    if (typeof bg === "object") {
      return bg._id || bg.id || "";
    }
    return String(bg);
  };
  // RBAC action permissions resolved from the current route (incl. fallback route->module mappings).
  // For this page we care about Add / Update(Edit) / Delete.
  const {
    canAdd,
    canUpdate,
    canDelete,
    canView,
  } = useModulePermissions("Global Settings", "System Users");

  const getPlaceholderImage = (name) => {
    const initials = name ? name.substring(0, 2).toUpperCase() : "NA";
    return `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=150`;
  };

  // Infer S3 object key (e.g. "uploads/xyz.png") from a full S3 URL
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

  const handleView = (_id) => {
    history.push("/viewBusinessDetails", { SystemUser_id: _id });
  };

  const handleRemoveImage = async (img) => {
    try {
      // Show a loading state
      setLoading(true);

      // Work out the correct S3 key to delete
      const key =
        imageS3Key && imageS3Key.trim().length > 0
          ? imageS3Key
          : inferS3KeyFromUrl(img);

      if (!key) {
        notifyError(t("systemUsers.failedToDeleteImageFromServer"));
        setLoading(false);
        return;
      }

      // Call the backend API to delete the image (same base URL as upload)
      const response = await axios.delete(
        `${Base_URL}/upload/${encodeURIComponent(key)}`
      );

      // Check if the response indicates success
      if (response.data.status) {
        notifySuccess(t("systemUsers.imageDeletedSuccessfully"));
        setImageUrl(""); // Clear the image URL
        setImageS3Key("");
        setShowImage(false); // Hide the image from UI immediately
        setFiles([]); // Clear any preview files
      } else {
        notifyError(response?.data?.message || t("systemUsers.failedToDeleteImageFromServer"));
      }

      setLoading(false); // Hide the loading state
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err.response?.data?.message || t("systemUsers.failedToDeleteImage"));
      setLoading(false); // Hide the loading state
    }
  };

  const closeModal = async () => {
    setIsModalOpen(false);
  };

  const handleDelete = async (_id) => {
    if (!canDelete) return;
    setToBeDeleted(_id);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!canDelete) {
      setIsModalOpen(false);
      return;
    }
    try {
      // Show a loading state
      setLoading(true);
      setIsSubmitting(true);
      const headers = adminInfo
        ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
        : {};
      // Call the backend API to delete the image
      const response = await axios.delete(
        `${Base_URL}/SystemUsers/delete/${ToBeDeleted}`,
        { headers }
      );

      // Check if the response indicates success
      if (response.data.status) {
        notifySuccess(t("systemUsers.systemUsersDeletedSuccessfully"));
        setIsModalOpen(false);
        fetchData(FilterStatus, FilterName, FilterRole, currentPage, rowsPerPage);
      } else {
        setIsModalOpen(false);
        notifyError(response.data.message || t("systemUsers.failedToDeleteSystemUsers"));
      }

      setIsSubmitting(false);
      setLoading(false); // Hide the loading state
    } catch (err) {
      setIsModalOpen(false);
      console.error("Error removing user:", err);
      notifyError(
        err.response?.data?.message || t("systemUsers.failedToDeleteSystemUsers")
      );
      setIsSubmitting(false);
      setLoading(false); // Hide the loading state
    }
  };

  // Fetch business groups for the form dropdown
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

  // Fetch roles for the selected Business Group (for System User form)
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
      const roles = res.data?.data ?? [];
      setParentModules(
        isAdminUser
          ? roles
          : roles.filter((role) => role?.isSuperAdmin !== true)
      );
    } catch (err) {
      console.error("Failed to fetch roles by business group:", err);
      setParentModules([]);
    }
  };

  // Fetch businesses for the selected Business Group (for Assigned Businesses)
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

  // Fetch roles for the current business group (list filter + form)
  const fetchAllRolesForFilter = async () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    const businessGroupId = getLoggedInBusinessGroupId();
    const payload =
      isAdminUser || !businessGroupId ? {} : { businessGroupId };
    try {
      const res = await axios.post(
        `${Base_URL}/UserRoles/get_all_user_roles`,
        payload,
        { headers }
      );
      const roles = res.data?.data ?? [];
      setAllRolesForFilter(
        isAdminUser
          ? roles
          : roles.filter((role) => role?.isSuperAdmin !== true)
      );
    } catch (err) {
      setAllRolesForFilter([]);
    }
  };

  useEffect(() => {
    fetchBusinessGroupsList();
    fetchAllRolesForFilter();
  }, []);

  useEffect(() => {
    if (businessGroups.length !== 1 || formBusinessGroup) return;
    setFormBusinessGroup(businessGroups[0]._id);
  }, [businessGroups, formBusinessGroup]);

  useEffect(() => {
    if (businesses.length !== 1) return;
    const onlyId = businesses[0]._id;
    setSelectedBusinesses((prev) => {
      if (prev.length === 1 && String(prev[0]) === String(onlyId)) return prev;
      return [onlyId];
    });
  }, [businesses]);

  useEffect(() => {
    const onRolesChanged = () => fetchAllRolesForFilter();
    window.addEventListener(USER_ROLES_CHANGED_EVENT, onRolesChanged);
    return () => window.removeEventListener(USER_ROLES_CHANGED_EVENT, onRolesChanged);
  }, [adminInfo?.token, isAdminUser]);

  // When Business Group is selected in the form, load roles and businesses for that group
  useEffect(() => {
    if (formBusinessGroup) {
      fetchRolesByBusinessGroup(formBusinessGroup);
      fetchBusinessesByGroup(formBusinessGroup);
    } else {
      setParentModules([]);
      if (id) {
        // Edit mode with global role (no business group): load scoped roles and businesses
        const headers = adminInfo
          ? { "Content-Type": "application/json", authorization: `Bearer ${adminInfo.token}` }
          : {};
        const businessGroupId = getLoggedInBusinessGroupId();
        const rolePayload =
          isAdminUser || !businessGroupId ? {} : { businessGroupId };
        axios
          .post(`${Base_URL}/UserRoles/get_all_user_roles`, rolePayload, { headers })
          .then((res) => {
            const roles = res.data?.data ?? [];
            setParentModules(
              isAdminUser
                ? roles
                : roles.filter((role) => role?.isSuperAdmin !== true)
            );
          })
          .catch(() => setParentModules([]));
        axios
          .post(`${Base_URL}/Business/getALL`, {}, { headers })
          .then((res) => setBusinesses(Array.isArray(res?.data?.data) ? res.data.data : []))
          .catch(() => setBusinesses([]));
      } else {
        setBusinesses([]);
      }
    }
  }, [formBusinessGroup, id]);

  // Refresh role dropdown when roles are created/updated elsewhere or tab regains focus
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

  // Keep selectedBusinesses in sync with loaded businesses (only allow assigned businesses that are in the current list – avoids duplicates and invalid IDs)
  useEffect(() => {
    if (!id || businesses.length === 0) return;
    setSelectedBusinesses((prev) => {
      const allowedIds = new Set(businesses.map((b) => (b._id || b).toString()));
      const next = prev.filter((bId) => allowedIds.has((bId || "").toString()));
      return next.length === prev.length ? prev : next;
    });
  }, [id, businesses]);

  const fetchData = (FilterStatus, FilterName, FilterRole, page = 1, limit = rowsPerPage) => {
    setLoading(true);
    const headers = adminInfo
      ? {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      }
      : {};
    let payload = {
      FilterStatus,
      FilterName,
      FilterRole,
      page,
      limit,
    };

    axios
      .post(`${Base_URL}/SystemUsers/get_all`, payload, { headers })
      .then((response) => {
        const apiData = response.data.data || [];
        // Extra safety: on the UI, non-super-admins must never see Super Admin users
        const safeData = isAdminUser
          ? apiData
          : apiData.filter(
              (user) => user?.role?.isSuperAdmin !== true
            );
        setData(safeData);
        setTotalRecords(response.data.totalRecords || 0); // get from backend
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
        notifyError(t("systemUsers.failedToFetchUsersData"));
      });
  };

  // Image Upload Handling with Dropzone
  const onDrop = (acceptedFiles) => {
    setLoading(true);

    // Preview files for UI feedback
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
        clearError("imageUrl"); // Clear image error when upload is successful
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

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => files.forEach((file) => URL.revokeObjectURL(file.preview));
  }, [files]);

  const handleResetField = useCallback(() => {
    setFilterStatus("");
    setFilterText("");
    setFilterRole("");
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (!adminInfo?.token) return;
    fetchData(FilterStatus, FilterName, FilterRole, currentPage, rowsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [FilterStatus, FilterRole, currentPage, rowsPerPage]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchData(FilterStatus, FilterName, FilterRole, 1, rowsPerPage);
    }, 400);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [FilterName]);

  const portalFilterValues = {
    status: FilterStatus === "" ? "" : String(FilterStatus),
    role: FilterRole || "",
  };

  const portalFilters = useMemo(
    () => [
      {
        key: "status",
        placeholder: t("systemUsers.selectStatus"),
        options: [
          { value: "", label: t("systemUsers.selectStatus") },
          { value: "true", label: t("active") },
          { value: "false", label: t("inactive") },
        ],
      },
      {
        key: "role",
        placeholder: t("systemUsers.selectRole"),
        options: [
          { value: "", label: t("systemUsers.selectRole") },
          ...allRolesForFilter.map((roleOption) => ({
            value: roleOption._id,
            label: roleOption.name || roleOption.internalName || "",
          })),
        ],
      },
    ],
    [allRolesForFilter, t],
  );

  const handlePortalFilterChange = (key, value) => {
    if (key === "status") {
      setFilterStatus(value === "" ? "" : value === "true");
      setCurrentPage(1);
      return;
    }
    if (key === "role") {
      setFilterRole(value || "");
      setCurrentPage(1);
    }
  };

  const handleAdd = () => {
    if (!canAdd) return;
    history.push("/system-users/new");
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

  // Validate fields before submission
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
    };

    // Required validation for name
    if (!name.trim()) {
      newErrors.name = t("systemUsers.validation.nameIsRequired");
      isValid = false;
    } else if (name.length < 3) {
      newErrors.name = t("systemUsers.validation.nameMustBeAtLeast3Characters");
      isValid = false;
    } else if (name.length > 50) {
      newErrors.name = t("systemUsers.validation.nameMustBeLessThan50Characters");
      isValid = false;
    }

    // Email validation with proper regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      newErrors.email = t("systemUsers.validation.emailIsRequired");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = t("systemUsers.validation.pleaseEnterValidEmailAddress");
      isValid = false;
    } else if (email.length > 100) {
      newErrors.email = t("systemUsers.validation.emailMustBeLessThan100Characters");
      isValid = false;
    }

    if (!id) {
      // New user: password and confirm password are required
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
      // Existing user: only validate when a new password is provided
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

    // Phone/contact validation
    if (!contact.trim()) {
      newErrors.contact = t("systemUsers.validation.contactNumberIsRequired");
      isValid = false;
    } else {
      const cleanContact = contact.replace(/[^0-9]/g, "");
      if (!/^\d{10,15}$/.test(cleanContact)) {
        newErrors.contact = t("systemUsers.validation.pleaseEnterValidContactNumber");
        isValid = false;
      }
    }

    if (!formBusinessGroup) {
      newErrors.businessGroup = t("systemUsers.validation.businessGroupIsRequired") || "Business Group is required";
      isValid = false;
    }

    if (!role) {
      newErrors.role = t("systemUsers.validation.roleIsRequired");
      isValid = false;
    }

    // Status validation
    if (status === "") {
      newErrors.status = t("systemUsers.validation.statusIsRequired");
      isValid = false;
    }

    // Image validation
    if (!imageUrl) {
      newErrors.imageUrl = t("systemUsers.validation.profileImageIsRequired");
      isValid = false;
    }

    // Businesses validation
    if (selectedBusinesses.length === 0) {
      newErrors.businesses = t("systemUsers.validation.atLeastOneBusinessMustBeSelected");
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleBusinessChange = (businessId) => {
    setSelectedBusinesses((prev) => {
      if (prev.includes(businessId)) {
        return prev.filter((id) => id !== businessId);
      } else {
        return [...prev, businessId];
      }
    });
    // Clear business error when user makes a selection
    clearError("businesses");
  };

  const clearError = (fieldName) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: ""
    }));
  };

  const handleUpdate = (selectedSystemUsers) => {
    if (!canUpdate) return;
    const userId = selectedSystemUsers?._id;
    if (userId) {
      history.push(`/system-users/edit/${userId}`, {
        user: selectedSystemUsers,
      });
    } else {
      notifyError(t("systemUsers.userDataNotFound"));
    }
  };

  const handleQuickStatusToggle = async (user) => {
    if (!canUpdate) return;
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };
    const normalizedBusinesses = Array.isArray(user?.businesses)
      ? user.businesses
        .map((b) => (typeof b === "object" ? b?._id : b))
        .filter(Boolean)
      : [];
    const payload = {
      name: user?.name || "",
      email: user?.email || "",
      image: user?.image || "",
      contact: user?.contact || "",
      role:
        typeof user?.role === "object"
          ? user?.role?._id || user?.role?.id || ""
          : user?.role || "",
      status: !(user?.status === true),
      businesses: normalizedBusinesses,
    };

    try {
      setLoading(true);
      const response = await axios.put(
        `${Base_URL}/SystemUsers/update/${user._id}`,
        payload,
        { headers }
      );
      if (response?.data?.status) {
        notifySuccess(response?.data?.message || "Status updated successfully");
        fetchData(FilterStatus, FilterName, FilterRole, currentPage, rowsPerPage);
      } else {
        notifyError(response?.data?.message || "Failed to update status");
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const SystemUsersSubmit = async (e) => {
    e.preventDefault();

    // Gate the actual submit action (not just the button visibility)
    if (id && !canUpdate) return;
    if (!id && !canAdd) return;

    // Run validation before proceeding
    if (!validateForm()) {
      notifyError(t("systemUsers.pleaseCorrectErrorsInForm"));
      return;
    }

    setIsSubmitting(true);

    const Data = {
      name,
      email,
      image: imageUrl,
      contact,
      role,
      status: status === "true", // Convert string to boolean
      businesses: selectedBusinesses,
    };

    // Only include password fields if they were provided
    if (password) {
      Data.password = password;
      Data.confirmPassword = confirmPassword;
    }

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    try {
      const url = id
        ? `${Base_URL}/SystemUsers/update/${id}`
        : `${Base_URL}/SystemUsers/add`;
      const method = id ? "put" : "post";

      let res = await axios[method](url, Data, { headers });

      if (res.data.status) {
        setIsSubmitting(false);
        fetchData(
          FilterStatus,
          FilterName,
          FilterRole,
          currentPage,
          rowsPerPage
        );
        toggleDrawer();
        notifySuccess(
          res.data.message ||
            (id
              ? t("systemUsers.userUpdatedSuccessfully")
              : t("systemUsers.userAddedSuccessfully"))
        );
      } else {
        setIsSubmitting(false);
        notifyError(res.data.message || "Operation failed");
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error("Error submitting System Users:", err);
      notifyError(err.response?.data?.message || "Failed to process request");
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "picture",
        header: t("systemUsers.picture"),
        width: "8%",
        render: (row) => (
          <img
            className="h-9 w-9 rounded-full object-cover"
            src={row.image || getPlaceholderImage(row.name)}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = getPlaceholderImage(row.name);
            }}
            alt={row.name || ""}
          />
        ),
      },
      {
        key: "name",
        header: t("hrReports.common.name"),
        width: "16%",
        render: (row) => (
          <div className="epc-cell__primary">{row.name || "—"}</div>
        ),
      },
      {
        key: "email",
        header: t("systemUsers.userEmail"),
        width: "22%",
        render: (row) => (
          <span className="epc-cell__secondary break-all">{row.email || "—"}</span>
        ),
      },
      {
        key: "role",
        header: t("systemUsers.role"),
        width: "16%",
        render: (row) => (
          <div className="epc-cell__primary">{row?.role?.name || "—"}</div>
        ),
      },
      {
        key: "status",
        header: t("hrReports.common.status"),
        width: "12%",
        render: (row) => (
          <StatusPill
            status={row.status === true ? t("active") : t("inactive")}
            tone={row.status === true ? "success" : "danger"}
          />
        ),
      },
      {
        key: "actions",
        header: t("Actions"),
        width: "16%",
        align: "right",
        render: (row) =>
          canUpdate || canDelete ? (
            <div className="flex items-center justify-end gap-3">
              {canUpdate && (
                <ToggleSwitch
                  isOn={row.status === true}
                  handleToggle={() => handleQuickStatusToggle(row)}
                />
              )}
              <ActionButtons
                maxVisibleActions={2}
                items={[
                  {
                    action: ACTION_BUTTON_TYPES.EDIT,
                    title: t("systemUsers.updateSystemUser"),
                    permission: canUpdate,
                    onClick: () => handleUpdate(row),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.DELETE,
                    title: t("Delete"),
                    permission: canDelete,
                    onClick: () => handleDelete(row._id),
                  },
                ]}
              />
            </div>
          ) : (
            <Tooltip
              id={`tooltip-lock-${row._id}`}
              tooltipContent="Access restricted"
            >
              <span className="inline-flex items-center text-gray-400 cursor-default">
                <FiLock size={18} />
              </span>
            </Tooltip>
          ),
      },
    ],
    [canDelete, canUpdate, t],
  );

  const content = (
    <EpcPage
      flush
      title={t("systemUsers.title")}
      subtitle={t(
        "systemUsers.subtitle",
        "Manage system users, roles, and account status.",
      )}
      action={
        canAdd ? (
          <PortalButton onClick={handleAdd}>
            <PlusIcon size={15} />
            {t("systemUsers.addSystemUser")}
          </PortalButton>
        ) : null
      }
    >
      {/* Generated Password Popup (kept above System User drawer for higher visual priority) */}
      <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)}>
        <ModalBody className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Generated Password
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            A password has been generated for this user. Please copy and save it securely. You
            will not be able to see it again.
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
        </ModalBody>
        <ModalFooter className="px-6 pb-6 pt-0 flex justify-end">
          <Button
            type="button"
            onClick={() => setIsPasswordModalOpen(false)}
            className="px-6"
            style={{ backgroundColor: "#0C2E5A" }}
          >
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <FilterBar
        subtitle={t(
          "systemUsers.filterSubtitle",
          "Narrow by name, status, or role.",
        )}
        searchPlaceholder={t("systemUsers.searchText")}
        searchValue={FilterName}
        onSearchChange={(value) => {
          setFilterText(value);
          setCurrentPage(1);
        }}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={handleResetField}
        filters={portalFilters}
      />

      <Card>
        <CardHeader
          title={t("systemUsers.title")}
          subtitle={
            loading ? "Loading…" : `${totalRecords} total users`
          }
        />
        <PortalDataTable
          columns={columns}
          rows={loading ? [] : data}
          rowKey="_id"
          emptyMessage={
            loading
              ? "Loading users…"
              : t("systemUsers.noUsersFound", "No system users found.")
          }
        />
        {!loading && totalRecords > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={rowsPerPage}
            total={totalRecords}
            itemLabel="users"
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(perPage) => {
              setRowsPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>

      <MainDrawer>
        <>
          <div className="w-full relative p-6 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {id ? (
              <Title
                title={t("systemUsers.updateSystemUser")}
                description={t("systemUsers.updateUserDetailsBelow")}
              />
            ) : (
              <Title
                title={t("systemUsers.addSystemUser")}
                description={t("systemUsers.fillAllFieldsToCreateNewUser")}
              />
            )}
          </div>
          <Scrollbars className="w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200">
            <WindmillCard className="overflow-y-scroll flex-grow scrollbar-hide w-full max-h-full">
              <CardBody>
                <form onSubmit={SystemUsersSubmit}>
                  <div className="px-6 pt-8 flex-grow scrollbar-hide w-full max-h-full pb-40">
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("Image")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
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
                            <em className="text-xs text-gray-400">
                              {t("imageFormat")}
                            </em>
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
                                  src={`${imageUrl}`}
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
                            <div className="mt-2">
                              <span className="text-red-400 text-sm">{errors.imageUrl}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("hrReports.common.name")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
                        <InputField
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            clearError("name");
                          }}
                          placeholder={t("systemUsers.userName")}
                          className={`mt-1 block w-full ${errors.name ? "border-red-500" : ""
                            }`}
                        />
                        {errors.name && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("systemUsers.userEmail")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
                        <InputField
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            clearError("email");
                          }}
                          placeholder={t("systemUsers.userEmail")}
                          className={`mt-1 block w-full ${errors.email ? "border-red-500" : ""
                            }`}
                        />
                        {errors.email && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Auto-generate password button above both fields */}
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAutoGeneratePassword}
                        className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md text-white hover:opacity-90 transition"
                        style={{ backgroundColor: "#0C2E5A" }}
                      >
                        <FiRefreshCw size={14} />
                        <span>Auto Generate</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-6 gap-4 mb-6">
                      <LabelArea label={t("Password")} required={!id} />

                      <div className="col-span-8 sm:col-span-4">
                        <div className="relative">
                          <InputField
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              clearError("password");
                            }}
                            placeholder={
                              id
                                ? t("systemUsers.leaveBlankToKeepCurrentPassword")
                                : "Enter password"
                            }
                            className={`w-full pr-10 ${
                              errors.password ? "border-red-500" : ""
                            }`}
                          />

                          {/* Show / Hide */}
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
                          <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-4 mb-6">
                      <LabelArea label={t("Confirm Password")} required={!id} />

                      <div className="col-span-8 sm:col-span-4">
                        <div className="relative">
                          <InputField
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              clearError("confirmPassword");
                            }}
                            placeholder={
                              id
                                ? t("systemUsers.leaveBlankToKeepCurrentPassword")
                                : "Confirm password"
                            }
                            className={`w-full ${
                              errors.confirmPassword ? "border-red-500" : ""
                            }`}
                          />

                          {/* Show / Hide (same eye icon for confirm field) */}
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
                          <p className="text-sm text-red-500 mt-1">
                            {errors.confirmPassword}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("hrReports.common.status")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
                        <DropdownBasic
                          value={status}
                          onChange={(value) => {
                            setStatus(value);
                            clearError("status");
                          }}
                          className={`mt-1 ${errors.status ? "border-red-500" : ""
                            }`}
                          options={[
                            { label: t("selectStatus"), value: "" },
                            { label: t("active"), value: 'true' },
                            { label: t("inactive"), value: 'false' },
                          ]}
                        />
                        {errors.status && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.status}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("systemUsers.userContactNo")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
                        <InputField
                          type="text"
                          value={contact}
                          onChange={(e) => {
                            setContact(e.target.value);
                            clearError("contact");
                          }}
                          placeholder={t("systemUsers.userContactNo")}
                          className={`mt-1 block w-full ${errors.contact ? "border-red-500" : ""
                            }`}
                        />
                        {errors.contact && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.contact}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {businessGroups.length !== 1 && (
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("systemUsers.businessGroup") || "Business Group"} required={true} />
                      <div className="col-span-8 sm:col-span-4">
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
                          placeholder={t("systemUsers.selectBusinessGroupFirst") || "Select Business Group first"}
                          options={[
                            { label: t("systemUsers.selectBusinessGroup") || "Select Business Group", value: "" },
                            ...businessGroups.map((bg) => ({
                              label: bg.companyName,
                              value: bg._id,
                            })),
                          ]}
                          disabled={!!id}
                        />
                        {id && (
                          <p className="mt-1 text-xs text-gray-500">
                            {t("systemUsers.businessGroupLockedOnEdit") || "Business Group cannot be changed when editing."}
                          </p>
                        )}
                        {errors.businessGroup && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.businessGroup}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("systemUsers.selectRole")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
                        <DropdownBasic
                          value={role}
                          onChange={(value) => {
                            setRole(value);
                            clearError("role");
                          }}
                          placeholder={
                            formBusinessGroup
                              ? t("systemUsers.selectRole")
                              : (t("systemUsers.selectBusinessGroupFirst") || "Select Business Group first")
                          }
                          options={ParentModules.map((userRole) => ({
                            label: userRole.name + (userRole.internalName ? ` (${userRole.internalName})` : ""),
                            value: userRole._id,
                          }))}
                        />
                        {errors.role && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.role}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!(
                      businesses.length === 1 ||
                      (businessGroups.length === 1 && businesses.length === 0)
                    ) && (
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("systemUsers.assignedBusiness")} required={true} />
                      <div className="col-span-8 sm:col-span-4">
                        <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 p-3 rounded-md">
                          {businesses.length > 0 ? (
                            businesses.map((business) => (
                              <div
                                key={business._id}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="checkbox"
                                  id={`business-${business._id}`}
                                  checked={selectedBusinesses.includes(
                                    business._id
                                  )}
                                  onChange={() =>
                                    handleBusinessChange(business._id)
                                  }
                                  className="form-checkbox h-4 w-4 text-emerald-500 focus:ring-emerald-400"
                                />
                                <label
                                  htmlFor={`business-${business._id}`}
                                  className="text-sm"
                                >
                                  {business.name}
                                </label>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">
                              {t("systemUsers.noBusinessesAvailable")}
                            </p>
                          )}
                        </div>
                        {errors.businesses && (
                          <div className="mt-1">
                            <span className="text-red-400 text-sm">{errors.businesses}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </div>

                  {isSubmitting ? (
                    <Button
                      disabled={true}
                      type="button"
                      className="w-full h-12"
                    >
                      <img
                        src={spinnerLoadingImage}
                        alt="Loading"
                        width={20}
                        height={10}
                      />{" "}
                      <span className="font-serif ml-2 font-light">
                        {t("processing")}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={SystemUsersSubmit}
                      type="submit"
                      className="w-full h-12"
                      style={{ backgroundColor: buttonColor }}
                      disabled={id ? !canUpdate : !canAdd}
                    >
                      {id ? (
                        <span>{t("systemUsers.updateSystemUser")}</span>
                      ) : (
                        <span>{t("systemUsers.addSystemUser")}</span>
                      )}
                    </Button>
                  )}
                </form>
              </CardBody>
            </WindmillCard>
          </Scrollbars>
        </>
      </MainDrawer>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalBody className="text-center custom-modal px-8 pt-6 pb-4">
          <span className="flex justify-center text-3xl mb-6 text-red-500">
            <FiTrash2 />
          </span>
          <h2 className="text-xl font-medium mb-2">
            {t("DeleteModalH2")}{" "}
            <span className="text-red-500">{t("systemUsers.title")}</span>?
          </h2>
          <p>{t("DeleteModalPtag")}</p>
        </ModalBody>

        <ModalFooter className="justify-center py-8">
          <LayoutButton
            secondary
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50"
            layout="outline"
            onClick={closeModal}
          >
            {t("modalKeepBtn")}
          </LayoutButton>
          <div className="flex justify-end">
            {isSubmitting ? (
              <LayoutButton
                disabled={true}
                type="button"
                className="w-full h-12 sm:w-auto"
              >
                <img
                  src={spinnerLoadingImage}
                  alt="Loading"
                  width={20}
                  height={10}
                />{" "}
                <span className="font-serif ml-2 font-light">
                  {t("Processing")}
                </span>
              </LayoutButton>
            ) : (
              <LayoutButton
                onClick={handleDeleteItem}
                className="w-full h-12 sm:w-auto bg-[#afcb49] hover:bg-[#afcb49]"
              >
                {t("modalDeletBtn")}
              </LayoutButton>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </EpcPage>
  );

  return (
    <ModuleAccessGate
      moduleName="Global Settings"
      subModuleName="System Users"
      title={t("systemUsers.title")}
    >
      {content}
    </ModuleAccessGate>
  );
};

export default SystemUsers;