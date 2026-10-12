import { LoadScript, Autocomplete } from "@react-google-maps/api";
import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Calendar,
  Search,
  RefreshCw,
  Image as ImageIcon,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Briefcase,
  Phone,
  Building2,
  Shield,
} from "lucide-react";
import { FiClipboard, FiEye, FiEyeOff, FiRefreshCw } from "react-icons/fi";
import ISO6391 from "iso-639-1";
import reactSelectConfig from "@/utils/react-select-style-config";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { AdminContext } from "@/context/AdminContext";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";
import csv from "../../assets/img/icons/csv.png";
import pdfIcon from "../../assets/img/icons/pdf.png";
import personPlaceholder from "../../assets/img/person-placeholder.png";
import { useHistory } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { formatDate } from "@/components/formatAmount";
// import { toast, ToastContainer } from "react-toastify";
const libraries = ["places"];
import { refreshSeatUsage } from "@/hooks/useUserLimit";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import PortalButton from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon } from "@/customer/components/ui/icons";

// Assuming Base_URL is defined somewhere else in your application
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL; // Replace with your actual API endpoint
const STAFF_FORM_TAB_CONFIG = [
  {
    label: "Personal Info",
    description: "Capture core profile details and identity information.",
    icon: UserRound,
  },
  {
    label: "Employment Details",
    description: "Set role, department, and employment configuration.",
    icon: Briefcase,
  },
  {
    label: "Contact Information",
    description: "Manage addresses, phone numbers, and reachability.",
    icon: Phone,
  },
  {
    label: "Bank Details",
    description: "Keep payroll-ready banking information organized.",
    icon: Building2,
  },
  {
    label: "System User",
    description: "Configure access permissions and account activation.",
    icon: Shield,
  },
];
const STAFF_FORM_TABS = STAFF_FORM_TAB_CONFIG.map((tab) => tab.label);
import { Select } from "@windmill/react-ui";
import ReactSelect from "react-select";
import BranchLocationSelectWithAdd from "@/components/hr/BranchLocationSelectWithAdd";
import PositionSelectWithAdd from "@/components/hr/PositionSelectWithAdd";
import DepartmentSelectWithAdd from "@/components/hr/DepartmentSelectWithAdd";
import {
  ActionButtons,
  Button,
  DropdownBasic,
  InputField,
  PageHeader,
  CustomDatePicker,
  CurrencyDropdown,
} from "@/page-layouts/index";
import { bloods, genders, martialStatuses, religions } from "./util";
import nationalities from "@dropdowns/nationalities";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import {
  HR_PAGE_INNER,
  HR_PAGE_SHELL,
} from "./components/hrPageHeaderStyles";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import useGoogleMapsApiKey from "@/hooks/useGoogleMapsApiKey";
import useUserLimit from "@/hooks/useUserLimit";
import UserLimitBanner from "@/components/subscription/UserLimitBanner";
import { readConfiguredPageSize } from "./Reports/hrReportHelpers";

function StaffManagement() {
  const { t } = useTranslation();
  const history = useHistory();
  const routePerms = useRouteModulePermissions();
  const canViewStaff = routePerms.canView;
  const canViewStaffDetails = routePerms.canViewDetails || routePerms.canView;
  const canAddStaff = routePerms.canAdd;
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTab, setSelectedTab] = useState("Personal Info");
  const [currentView, setCurrentView] = useState("list"); // 'list' or 'add'
  const contentPanelRef = useRef(null);
  const tabRailRef = useRef(null);
  const tabButtonRefs = useRef({});
  const shouldScrollContentOnTabChangeRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const [imageUrl, setImageUrl] = useState("");
  const [leaveGroups, setLeaveGroups] = useState([]);
  const [claimGroups, setClaimGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newRecordsLoading, setNewRecordsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { userUsage } = useUserLimit();
  const { googleMapsApiKey, loading: googleMapsKeyLoading } = useGoogleMapsApiKey();
  const [formErrors, setFormErrors] = useState({});
  const [departments, setDepartments] = useState([]);
  const [branchLocations, setBranchLocations] = useState([]);
  const [positions, setPositions] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [workPassTypes, setWorkPassTypes] = useState([]);
  const [businessGroups, setBusinessGroups] = useState([]);
  /** Roles / businesses for System User tab — scoped by business group (same as System User screen). */
  const [systemUserRoles, setSystemUserRoles] = useState([]);
  const [systemUserBusinesses, setSystemUserBusinesses] = useState([]);
  const [leaveApprovalSelectors, setLeaveApprovalSelectors] = useState({
    level1: { role: "", user: "" },
    level2: { role: "", user: "" },
    level3: { role: "", user: "" },
  });
  const [claimApprovalSelectors, setClaimApprovalSelectors] = useState({
    level1: { role: "", user: "" },
    level2: { role: "", user: "" },
    level3: { role: "", user: "" },
  });

  console.log("departments", departments);
  console.log("positions", positions);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token || ""}`,
    }),
    [adminInfo]
  );

  /** System users linked to the selected business — leave approval pickers (create staff). */
  const leaveApprovalUsersPool = useMemo(() => {
    if (
      !selectedBusiness ||
      selectedBusiness === "Select Business" ||
      selectedBusiness === ""
    ) {
      return [];
    }
    const selectedBusinessId = String(selectedBusiness).trim();
    return (users || []).filter((u) => {
      if (!u.businesses || !Array.isArray(u.businesses) || u.businesses.length === 0) {
        return false;
      }
      return u.businesses.some((business) => {
        let businessId = null;
        if (typeof business === "string") {
          businessId = String(business).trim();
        } else if (business && typeof business === "object") {
          businessId = business._id
            ? String(business._id).trim()
            : String(business).trim();
        } else {
          businessId = String(business).trim();
        }
        return businessId === selectedBusinessId;
      });
    });
  }, [users, selectedBusiness]);

  /** User roles assigned to the selected business — leave approval role pickers (create staff). */
  const leaveApprovalRolesOptions = useMemo(() => {
    const businessId = String(selectedBusiness || "").trim();
    if (
      !businessId ||
      selectedBusiness === "Select Business" ||
      selectedBusiness === ""
    ) {
      return [];
    }
    return (roles || []).filter((role) =>
      role.assignedBusinesses?.some((b) => String(b._id) === businessId)
    );
  }, [roles, selectedBusiness]);

  // Staff list state
  const [staffList, setStaffList] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(() =>
    readConfiguredPageSize(10)
  );
  const [currentPage, setCurrentPage] = useState(1);
  console.log("current page", currentPage);

  useEffect(() => {
    const tabRail = tabRailRef.current;
    const activeTabButton = tabButtonRefs.current[selectedTab];
    if (tabRail && activeTabButton) {
      const tabRailRect = tabRail.getBoundingClientRect();
      const activeTabRect = activeTabButton.getBoundingClientRect();
      const targetTop =
        tabRail.scrollTop + (activeTabRect.top - tabRailRect.top);
      const targetLeft =
        tabRail.scrollLeft + (activeTabRect.left - tabRailRect.left);
      tabRail.scrollTo({
        top: Math.max(targetTop, 0),
        left: Math.max(targetLeft, 0),
        behavior: "smooth",
      });
    } else if (activeTabButton?.scrollIntoView) {
      activeTabButton.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }

    if (shouldScrollContentOnTabChangeRef.current && contentPanelRef.current) {
      contentPanelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      shouldScrollContentOnTabChangeRef.current = false;
    }
  }, [selectedTab]);
  const currentPageRef = useRef(1);
  const skipStaffFilterEffect = useRef(true);

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    displayName: "",
    nationality: "Malaysian",
    maritalStatus: "Single",
    bloodType: "",
    religion: "",
    spokenLanguages: [],
    dateOfBirth: "",
    gender: "Male",
    icorpassport: "",
    email: "",
    mobileNumber: "",
    googleLocation: "",
    unitHouseInfo: "",
    streetBlock: "",
    suburb: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
    image: "",

    // Employment Details
    employeeId: "",
    department: "",
    position: "",
    shift: "",
    leaveGroup: "",
    claimGroup: "",
    joiningDate: "",
    probationStartDate: "",
    probationEndDate: "",
    confirmationDate: "",
    employmentType: "", // Full-time, Part-time, etc.
    workPassType: "",
    visaExpiryDate: "",
    uniformSize: "",
    branchLocations: [],
    jobRole: "",
    workingShift: "",
    endDate: "",
    reasonForLeaving: "",
    leaveApprovalLevel: "",
    claimApprovalLevel: "",
    bankDetails: {
      accountHolderName: "",
      bankName: "",
      bankBranch: "",
      accountNumber: "",
      accountType: "",
      ifscCode: "",
      swiftCode: "",
      iban: "",
      currency: "",
      remarks: "",
    },
  });

  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);

  // System User creation state
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
  const [showSystemUserPassword, setShowSystemUserPassword] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [existingSystemUserForEmail, setExistingSystemUserForEmail] = useState(null);
  const [checkingExistingSystemUser, setCheckingExistingSystemUser] = useState(false);

  const validateSystemUserForm = useCallback(() => {
    if (!addAsSystemUser) return {};
    const errors = {};
    if (!systemUserForm.name.trim()) errors.sysName = "Name is required";
    if (!systemUserForm.password) errors.sysPassword = "Password is required";
    else if (systemUserForm.password.length < 6) errors.sysPassword = "Password must be at least 6 characters";
    if (!systemUserForm.confirmPassword) errors.sysConfirmPassword = "Confirm password is required";
    else if (systemUserForm.password !== systemUserForm.confirmPassword) errors.sysConfirmPassword = "Passwords do not match";
    if (!systemUserForm.businessGroup) {
      errors.sysBusinessGroup = "Business Group is required";
    }
    if (!systemUserForm.role) errors.sysRole = "Role is required";
    if (!systemUserForm.businesses.length) errors.sysBusinesses = "At least one business must be assigned";
    return errors;
  }, [addAsSystemUser, systemUserForm]);

  // When "Add as System User" is on and staff email is set, check if a system user already exists for that email
  useEffect(() => {
    if (!addAsSystemUser || !formData.email?.trim()) {
      setExistingSystemUserForEmail(null);
      return;
    }
    const email = formData.email.trim().toLowerCase();
    let cancelled = false;
    setCheckingExistingSystemUser(true);
    setExistingSystemUserForEmail(null);
    axios
      .post(
        `${Base_URL}/SystemUsers/get_all`,
        { FilterName: formData.email.trim(), limit: 20, page: 1 },
        { headers }
      )
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        const match = list.find((u) => (u.email || "").toLowerCase() === email);
        setExistingSystemUserForEmail(match || null);
      })
      .catch(() => {
        if (!cancelled) setExistingSystemUserForEmail(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingExistingSystemUser(false);
      });
    return () => { cancelled = true; };
  }, [addAsSystemUser, formData.email, headers]);

  // Clear existing-user state when toggle is off
  useEffect(() => {
    if (!addAsSystemUser) setExistingSystemUserForEmail(null);
  }, [addAsSystemUser]);

  // Same as SystemUserForm: generate random 6-digit password, fill both fields, show copy modal
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

  useEffect(() => {
    if (isFormSubmitted) {
      const errors = validateForm(selectedTab);
      setFormErrors(errors);
      console.log("Chnaged");
    }
  }, [formData]);

  useEffect(() => {
    setFormErrors({});
    setIsFormSubmitted(false);
  }, [selectedTab]);

  useEffect(() => {
    if (currentView === "add" && !canAddStaff) {
      notifyError("You do not have permission to add staff.");
      setCurrentView("list");
      setModalOpen(false);
    }
  }, [currentView, canAddStaff]);

  // Filter state
  const [filters, setFilters] = useState({
    business: "",
    name: "",
    department: "",
    position: "",
    status: "Active",
    date: "",
  });

  // Image upload handler using useDropzone
  const onDrop = useCallback((acceptedFiles) => {
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("image", file);
    });

    // Show preview of the first image before uploading
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData((prev) => ({ ...prev, image: e.target.result }));
      };
      reader.readAsDataURL(file);
    }

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
        // Handle error appropriately - show message to user
      });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    onDrop,
  });

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [key]: value }));
  }, []);

  const handleFormChange = useCallback((key, value) => {
    setFormData((prevState) => ({
      ...prevState,
      [key]: value,
    }));
    // If leaveApprovalLevel changes, reset selectors for levels beyond the new level
    if (key === "leaveApprovalLevel") {
      const newLevel = parseInt(value) || 0;
      setLeaveApprovalSelectors((prev) => {
        const updated = { ...prev };
        if (newLevel < 3) updated.level3 = { role: "", user: "" };
        if (newLevel < 2) updated.level2 = { role: "", user: "" };
        if (newLevel < 1) updated.level1 = { role: "", user: "" };
        return updated;
      });
    }
    if (key === "claimApprovalLevel") {
      const newLevel = parseInt(value) || 0;
      setClaimApprovalSelectors((prev) => {
        const updated = { ...prev };
        if (newLevel < 3) updated.level3 = { role: "", user: "" };
        if (newLevel < 2) updated.level2 = { role: "", user: "" };
        if (newLevel < 1) updated.level1 = { role: "", user: "" };
        return updated;
      });
    }
  }, []);

  const handleLeaveApprovalSelectorChange = (level, type, value) => {
    setLeaveApprovalSelectors((prev) => {
      const updated = {
        ...prev,
        [`level${level}`]: {
          ...prev[`level${level}`],
          [type]: value,
        },
      };
      // If role changes, reset the user selection for that level
      if (type === "role") {
        updated[`level${level}`].user = "";
      }
      return updated;
    });
    // Clear validation error for this field when user makes a selection
    if (type === "role") {
      const errorKey = `leaveApprovalLevel${level}Role`;
      if (formErrors[errorKey]) {
        setFormErrors((prev) => ({ ...prev, [errorKey]: null }));
      }
    }
  };

  const handleClaimApprovalSelectorChange = (level, type, value) => {
    setClaimApprovalSelectors((prev) => {
      const updated = {
        ...prev,
        [`level${level}`]: {
          ...prev[`level${level}`],
          [type]: value,
        },
      };
      if (type === "role") {
        updated[`level${level}`].user = "";
      }
      return updated;
    });
    if (type === "role") {
      const errorKey = `claimApprovalLevel${level}Role`;
      if (formErrors[errorKey]) {
        setFormErrors((prev) => ({ ...prev, [errorKey]: null }));
      }
    }
  };

  useEffect(() => {
    setLeaveApprovalSelectors({
      level1: { role: "", user: "" },
      level2: { role: "", user: "" },
      level3: { role: "", user: "" },
    });
    setClaimApprovalSelectors({
      level1: { role: "", user: "" },
      level2: { role: "", user: "" },
      level3: { role: "", user: "" },
    });
  }, [selectedBusiness]);

  useEffect(() => {
    if (isSingleBusiness && singleBusinessId && !selectedBusiness) {
      setSelectedBusiness(singleBusinessId);
    }
  }, [isSingleBusiness, singleBusinessId, selectedBusiness]);

  useEffect(() => {
    const onlyId =
      systemUserBusinesses.length === 1
        ? systemUserBusinesses[0]?._id
        : isSingleBusiness
          ? singleBusinessId
          : null;
    if (!onlyId) return;
    setSystemUserForm((prev) => {
      if (prev.businesses?.length === 1 && String(prev.businesses[0]) === String(onlyId)) {
        return prev;
      }
      if (prev.businesses?.length > 0 && !isSingleBusiness && systemUserBusinesses.length !== 1) {
        return prev;
      }
      return { ...prev, businesses: [onlyId] };
    });
  }, [systemUserBusinesses, isSingleBusiness, singleBusinessId]);

  // Filter system users: selected business first, then by role name for that level
  const getFilteredSystemUsers = (level) => {
    const levelKey = `level${level}`;
    const selectedRoleName = leaveApprovalSelectors[levelKey]?.role;
    const pool = leaveApprovalUsersPool;

    if (!selectedRoleName) {
      return pool;
    }

    return pool.filter((user) => {
      if (!user.role) return false;
      const userRoleName = user.role?.name || user.role;
      return (
        userRoleName && selectedRoleName && userRoleName === selectedRoleName
      );
    });
  };

  const getFilteredClaimSystemUsers = (level) => {
    const levelKey = `level${level}`;
    const selectedRoleName = claimApprovalSelectors[levelKey]?.role;
    const pool = leaveApprovalUsersPool;

    if (!selectedRoleName) {
      return pool;
    }

    return pool.filter((user) => {
      if (!user.role) return false;
      const userRoleName = user.role?.name || user.role;
      return (
        userRoleName && selectedRoleName && userRoleName === selectedRoleName
      );
    });
  };

  const validateForm = (tab) => {
    const errors = {};

    // Personal Info — IC/Passport is optional.
    if (tab === "Personal Info") {
      if (!formData.fullName.trim()) errors.fullName = "Full name is required";
      if (!formData.nationality) errors.nationality = "Nationality is required";
      if (!formData.maritalStatus) errors.maritalStatus = "Marital status is required";
      if (!formData.gender) errors.gender = "Gender is required";
      // Date of birth is optional; only validate if a value is entered
      if (
        formData.dateOfBirth &&
        new Date(new Date(formData.dateOfBirth).setHours(0, 0, 0, 0)) >
          new Date(new Date().setHours(0, 0, 0, 0))
      ) {
        errors.dateOfBirth = "Date of birth cannot be in the future";
      }
    }

    // Employment Details — 4 required fields; other fields optional
    if (tab === "Employment Details") {
      if (!formData.employeeId?.trim())
        errors.employeeId = "Employee ID is required";
      if (!formData.position) errors.position = "Position is required";
      if (!formData.shift) errors.shift = "Shift is required";
      if (!formData.department) errors.department = "Department is required";
      if (
        !formData.branchLocations ||
        !Array.isArray(formData.branchLocations) ||
        formData.branchLocations.length === 0
      ) {
        errors.branchLocations = "Select at least one branch / location";
      }
      // Cross-field date range checks (only when both values are present)
      if (
        formData.probationStartDate &&
        formData.probationEndDate &&
        new Date(formData.probationEndDate) <
          new Date(formData.probationStartDate)
      ) {
        errors.probationEndDate =
          "Probation end date cannot be before start date";
      }
      if (formData.visaExpiryDate && formData.joiningDate) {
        const visaDate = new Date(formData.visaExpiryDate).setHours(0, 0, 0, 0);
        const joiningDate = new Date(formData.joiningDate).setHours(0, 0, 0, 0);
        if (visaDate < joiningDate) {
          errors.visaExpiryDate =
            "Visa expiry date cannot be before joining date";
        }
      }
    }

    // Contact Information — only email is required; validate mobile format if provided
    if (tab === "Contact Information") {
      if (!formData.email.trim()) {
        errors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Invalid email format";
      }
      if (
        formData.mobileNumber &&
        formData.mobileNumber.trim() &&
        !/^\+?[0-9]{8,15}$/.test(formData.mobileNumber.replace(/\s/g, ""))
      ) {
        errors.mobileNumber = "Invalid mobile number format";
      }
    }

    return errors;
  };

  // Display error message under specific field
  const renderError = (field) => {
    if (formErrors[field]) {
      return <p className="text-red-500 text-sm mt-1">{formErrors[field]}</p>;
    }
    return null;
  };

  const fetchStaff = useCallback(
    async (page = 1, limit = recordsPerPage) => {
      try {
        setIsLoading(true);
        setNewRecordsLoading(true);

        console.log("Calling fetchStaff with headers:", headers);

        const response = await axios.get(`${Base_URL}/staff-management`, {
          params: {
            page,
            limit,
            name: filters.name,
            department: filters.department,
            position: filters.position,
            status: filters.status === "all" ? "" : filters.status,
            date: filters.date ? new Date(filters.date).toISOString() : "",
            business: filters.business,
          },
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminInfo?.token}`,
          },
        });

        console.log(
          "🚀 Staff Response:",
          JSON.stringify(response.data, null, 2)
        );
        setStaffList(response.data.staffList || []);
        setTotalResults(response.data.total || 0);
        setTotalPages(response.data.totalPages || 0);
        setNewRecordsLoading(false);
      } catch (error) {
        console.error("Full fetchStaff error:", JSON.stringify(error, null, 2));

        if (error.response) {
          console.log("Status Code:", error.response.status);
          console.log("Error Data:", error.response.data);
        } else {
          console.log("Error:", error.message);
        }
        console.error("fetchStaff error:", error.response || error);
        setFetchError("Failed to load staff data");
        setNewRecordsLoading(false);
      } finally {
        setIsLoading(false);
        setNewRecordsLoading(false);
      }
    },
    [filters, adminInfo?.token, recordsPerPage]
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;
  };

  const validateAllTabs = () => {
    let combinedErrors = {
      ...validateForm("Personal Info"),
      ...validateForm("Employment Details"),
      ...validateForm("Contact Information"),
    };

    return combinedErrors;
  };

  const addNewStaff = useCallback(async () => {
    if (!canAddStaff) {
      notifyError("You do not have permission to add staff.");
      return;
    }

    const data = {
      ...formData,
      spokenLanguages: formData.spokenLanguages?.map((e) => e.value) || [],
    };

    console.log("Submit button clicked. Form Data:", data);

    setIsFormSubmitted(true);
    try {
      // On System User tab, validate all previous tabs
      let errors = {};
      if (selectedTab === "System User") {
        errors = {
          ...validateForm("Personal Info"),
          ...validateForm("Employment Details"),
          ...validateForm("Contact Information"),
        };
      } else {
        errors = validateForm(selectedTab);
      }
      setFormErrors(errors);
      console.log("Validation errors:", errors);
      if (Object.keys(errors).length > 0) {
        if (selectedTab === "System User") {
          notifyError("Please complete all required fields before submitting.");
        }
        return;
      }

      setIsLoading(true);

      // Build leave approval levels data — only include levels with a role when configured
      const leaveApprovalLevels = [];
      const approvalLevel = parseInt(formData.leaveApprovalLevel) || 0;
      for (let i = 1; i <= approvalLevel; i++) {
        const levelKey = `level${i}`;
        const selectorData = leaveApprovalSelectors[levelKey] || {
          role: "",
          user: "",
        };
        // Only include levels that have a role (role is required)
        if (selectorData.role) {
          leaveApprovalLevels.push({
            level: i,
            role: selectorData.role,
            user: selectorData.user || null,
          });
        }
      }

      const claimApprovalLevels = [];
      const claimLevelCount = parseInt(formData.claimApprovalLevel) || 0;
      for (let i = 1; i <= claimLevelCount; i++) {
        const levelKey = `level${i}`;
        const selectorData = claimApprovalSelectors[levelKey] || {
          role: "",
          user: "",
        };
        if (selectorData.role) {
          claimApprovalLevels.push({
            level: i,
            role: selectorData.role,
            user: selectorData.user || null,
          });
        }
      }

      const leaveApprovalLevelValue =
        data.leaveApprovalLevel === "" || data.leaveApprovalLevel == null
          ? null
          : Number(data.leaveApprovalLevel);
      const claimApprovalLevelValue =
        data.claimApprovalLevel === "" || data.claimApprovalLevel == null
          ? null
          : Number(data.claimApprovalLevel);

      // Create a new staff member with the form data
      const dataToSend = {
        ...data,
        currentTab: selectedTab,
        business: selectedBusiness,
        leaveGroup: data.leaveGroup || "",
        claimGroup: data.claimGroup || "",
        leaveApprovalLevel: leaveApprovalLevelValue,
        claimApprovalLevel: claimApprovalLevelValue,
        leaveApprovalLevels: leaveApprovalLevels,
        claimApprovalLevels,
      };

      if (dataToSend.displayName === "") {
        dataToSend.displayName = dataToSend.fullName;
      }

      // If it's not the final tab, just advance to next tab
      if (selectedTab === "Personal Info") {
        setSelectedTab("Employment Details");
        return;
      }

      if (selectedTab === "Employment Details") {
        setSelectedTab("Contact Information");
        return;
      }

      if (selectedTab === "Contact Information") {
        setSelectedTab("Bank Details");
        return;
      }

      if (selectedTab === "Bank Details") {
        setSelectedTab("System User");
        return;
      }

      // System User tab — final step: save staff + optionally create or link system user
      if (selectedTab === "System User") {
        // If linking to existing system user, no form validation needed
        if (addAsSystemUser && !existingSystemUserForEmail) {
          const sysErrors = validateSystemUserForm();
          setSystemUserFormErrors(sysErrors);
          if (Object.keys(sysErrors).length > 0) {
            notifyError("Please complete all System User fields.");
            return;
          }
        }

        // Save staff first
        const staffRes = await axios.post(`${Base_URL}/staff-management`, dataToSend);
        const newStaffId = staffRes.data?.data?._id;

        // Link to existing system user or create new one
        if (addAsSystemUser && newStaffId) {
          if (existingSystemUserForEmail?._id) {
            // Link staff to existing system user (same email)
            await axios.put(`${Base_URL}/staff-management/${newStaffId}`, {
              systemUserId: existingSystemUserForEmail._id,
            });
          } else {
            // Create new system user and link
            const suRes = await axios.post(`${Base_URL}/SystemUsers/add`, {
              name: systemUserForm.name,
              email: formData.email,
              contact: formData.mobileNumber,
              image: formData.image || "",
              password: systemUserForm.password,
              role: systemUserForm.role,
              businesses: systemUserForm.businesses,
              status: systemUserForm.status,
            });
            const newSystemUserId = suRes.data?.data?._id;
            if (newSystemUserId) {
              await axios.put(`${Base_URL}/staff-management/${newStaffId}`, {
                systemUserId: newSystemUserId,
              });
            }
          }
          refreshSeatUsage();
        }

        // Reset everything
        setFormData({ ...initialFormData });
        setLeaveApprovalSelectors({
          level1: { role: "", user: "" },
          level2: { role: "", user: "" },
          level3: { role: "", user: "" },
        });
        setAddAsSystemUser(false);
        setSystemUserForm({
          name: "",
          password: "",
          confirmPassword: "",
          businessGroup: "",
          role: "",
          businesses: [],
          status: true,
        });
        setSystemUserRoles([]);
        setSystemUserBusinesses([]);
        setSystemUserFormErrors({});
        setIsPasswordModalOpen(false);
        setGeneratedPassword("");
        setImageUrl("");
        setFormErrors({});
        setSelectedTab("Personal Info");
        setCurrentView("list");
        notifySuccess("Staff member added successfully.");
        fetchStaff();
      }
    } catch (err) {
      console.error("Error adding staff:", err);
        const message =
          err?.response?.data?.message ||
          "Something went wrong while adding staff.";
        notifyError(message);
    } finally {
      setIsLoading(false);
    }
  }, [canAddStaff, formData, selectedTab, selectedBusiness, fetchStaff, addAsSystemUser, systemUserForm, validateSystemUserForm, existingSystemUserForEmail]);

  const fetchSystemUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${Base_URL}/SystemUsers/get_all`, {
        limit: 999999,
      });
      if (response.data?.status && Array.isArray(response.data.data)) {
        setUsers(response.data.data);
        // Debug: Log first user's businesses structure
        if (response.data.data.length > 0) {
          console.log("Sample system user businesses:", response.data.data[0].businesses);
        }
      } else {
        setUsers([]);
      }
      return response.data;
    } catch (error) {
      console.error("Error fetching system users:", error);
      setUsers([]);
      setFetchError("Failed to load system users");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await axios.post(
        `${Base_URL}/UserRoles/get_all`,
        { FilterStatus: "", FilterName: "", page: 1, limit: 1000 },
        { headers }
      );
      setRoles(response.data.data || []);
    } catch (err) {
      console.log("Failed to fetch roles");
      setRoles([]);
    }
  }, [headers]);

  const fetchBusinessGroupsList = useCallback(async () => {
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
  }, [headers]);

  const fetchSystemUserRolesByBusinessGroup = useCallback(
    async (businessGroupId) => {
      if (!businessGroupId) {
        setSystemUserRoles([]);
        return;
      }
      try {
        const res = await axios.post(
          `${Base_URL}/UserRoles/get_all_user_roles`,
          { businessGroupId },
          { headers }
        );
        const scopedRoles = Array.isArray(res.data?.data)
          ? res.data.data.filter((role) => role?.isSuperAdmin !== true)
          : [];
        setSystemUserRoles(scopedRoles);
      } catch (err) {
        console.error("Failed to fetch roles by business group:", err);
        setSystemUserRoles([]);
      }
    },
    [headers]
  );

  const fetchSystemUserBusinessesByGroup = useCallback(
    async (businessGroupId) => {
      if (!businessGroupId) {
        setSystemUserBusinesses([]);
        return;
      }
      try {
        const res = await axios.post(
          `${Base_URL}/Business/getALL`,
          { businessGroup: businessGroupId },
          { headers }
        );
        const list = res?.data?.data || [];
        setSystemUserBusinesses(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to fetch businesses by group:", err);
        setSystemUserBusinesses([]);
      }
    },
    [headers]
  );

  useEffect(() => {
    if (systemUserForm.businessGroup) {
      fetchSystemUserRolesByBusinessGroup(systemUserForm.businessGroup);
    } else {
      setSystemUserRoles([]);
    }
  }, [systemUserForm.businessGroup, fetchSystemUserRolesByBusinessGroup]);

  useEffect(() => {
    if (systemUserForm.businessGroup) {
      fetchSystemUserBusinessesByGroup(systemUserForm.businessGroup);
    } else {
      setSystemUserBusinesses([]);
    }
  }, [systemUserForm.businessGroup, fetchSystemUserBusinessesByGroup]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    fetchBusinessGroupsList();
  }, [adminInfo?.token, fetchBusinessGroupsList]);

  // Filter system users by selected business for the modal
  const filteredSystemUsers = useMemo(() => {
    if (!selectedBusiness || selectedBusiness === "Select Business" || selectedBusiness === "") {
      return []; // Don't show any users if no business is selected
    }
    
    // Normalize selectedBusiness to string for comparison
    const selectedBusinessId = String(selectedBusiness).trim();
    
    // Debug logging
    console.log("Filtering users for business:", selectedBusinessId);
    console.log("Total users:", users?.length);
    
    const filtered = users?.filter((user) => {
      // Check if user has the selected business in their businesses array
      if (!user.businesses || !Array.isArray(user.businesses) || user.businesses.length === 0) {
        return false;
      }
      
      const hasBusiness = user.businesses.some((business) => {
        let businessId = null;
        
        // Handle different formats: string, ObjectId, or object with _id
        if (typeof business === "string") {
          businessId = String(business).trim();
        } else if (business && typeof business === "object") {
          // If it's an object, check _id property or toString
          businessId = business._id ? String(business._id).trim() : String(business).trim();
        } else {
          businessId = String(business).trim();
        }
        
        // Compare normalized IDs
        const matches = businessId === selectedBusinessId;
        if (matches) {
          console.log(`User ${user.name} matches business ${selectedBusinessId}`);
        }
        return matches;
      });
      
      return hasBusiness;
    }) || [];
    
    console.log("Filtered users count:", filtered.length);
    
    return filtered.map((user) => ({
      value: user._id,
      label: user.name,
    }));
  }, [users, selectedBusiness]);

  const fetchLeaveGroups = useCallback(async () => {
    if (!selectedBusiness || selectedBusiness === "Select Business") {
      // Don't fetch if no business is selected
      return [];
    }

    try {
      setIsLoading(true);
      const payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };

      const response = await axios.post(
        `${Base_URL}/LeaveGroups/get_all`,
        payload,
        { headers }
      );
      setLeaveGroups(response.data.data || []);
      return response.data;
    } catch (error) {
      console.error("Error fetching leave groups:", error);
      setFetchError("Failed to load leave groups");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [selectedBusiness, headers]);

  const fetchClaimGroups = useCallback(async () => {
    if (!selectedBusiness || selectedBusiness === "Select Business") {
      // Don't fetch if no business is selected
      return [];
    }

    try {
      const payload = {
        bid: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      setIsLoading(true);
      const response = await axios.get(`${Base_URL}/claim-groups`, {
        params: payload,
        headers,
      });
      setClaimGroups(response.data || []);
      return response.data;
    } catch (error) {
      console.error("Error fetching claim groups:", error);
      setFetchError("Failed to load claim groups");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [selectedBusiness, headers]);

  // Load list when token, page, or page size changes (not when fetchStaff callback identity changes).
  useEffect(() => {
    if (!adminInfo?.token) return;

    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      try {
        setBusinesses(JSON.parse(storedBusinesses));
      } catch {
        // ignore invalid cache
      }
    }

    const load = async () => {
      setFetchError(null);
      try {
        await fetchStaff(currentPageRef.current || currentPage, recordsPerPage);
        await fetchSystemUsers();
        await fetchRoles();
      } catch (error) {
        console.error("Staff list load error:", error);
        setFetchError("Failed to load initial data");
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit deps only; avoid refetch loop when fetchStaff is recreated
  }, [adminInfo?.token, currentPage, recordsPerPage]);

  const fetchDepartments = async () => {
    try {
      let payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      let response = await axios.post(
        `${Base_URL}/Departments/get_all`,
        payload,
        { headers }
      );

      const data = response.data.data || [];
      setDepartments(data);
      return data;
    } catch (err) {
      console.log("Failed to fetch items");
      return [];
    }
  };

  const fetchBranchLocations = async () => {
    try {
      let payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      let response = await axios.post(`${Base_URL}/branches/get_all`, payload, {
        headers,
      });
      const data = response.data.data || [];
      setBranchLocations(data);
      return data;
    } catch (err) {
      console.log("Failed to fetch items");
      return [];
    }
  };

  const fetchPositions = async () => {
    try {
      let payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      console.log("payload", payload);

      let response = await axios.post(
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

  const fetchShifts = async () => {
    try {
      let payload = {
        business_id: selectedBusiness,
        FilterStatus: "",
        FilterName: "",
      };
      console.log("payload", payload);

      let response = await axios.post(`${Base_URL}/shifts/get_all`, payload, {
        headers,
      });
      console.log("shifts response", response);
      setShifts(response.data.data);
    } catch (err) {
      console.log("Failed to fetch items");
    }
  };

  const fetchWorkPassTypes = async () => {
    try {
      let response = await axios.get(
        `${Base_URL}/work-pass-types/get?business=${selectedBusiness}`,
        { headers }
      );
      setWorkPassTypes(response.data.data || []);
    } catch (err) {
      console.log("Failed to fetch work pass types");
    }
  };

  // Only fetch leave groups and claim groups when a business is selected
  useEffect(() => {
    if (selectedBusiness && selectedBusiness !== "Select Business") {
      const loadBusinessSpecificData = async () => {
        setIsLoading(true);
        setFetchError(null);

        try {
          await fetchLeaveGroups();
          await fetchClaimGroups();
          await fetchDepartments();
          await fetchBranchLocations();
          await fetchPositions();
          await fetchShifts();
          await fetchWorkPassTypes();
        } catch (error) {
          console.error("Error loading business-specific data:", error);
          setFetchError("Failed to load business data");
        } finally {
          setIsLoading(false);
        }
      };

      loadBusinessSpecificData();
    }
  }, [selectedBusiness]);

  const handleSelectUser = useCallback(async (userId) => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const response = await axios.post(
        `${Base_URL}/SystemUsers/get_single/${userId}`
      );

      if (response.data?.data) {
        const userData = response.data.data;
        setSelectedUser(userData);
        setFormData((prev) => ({
          ...prev,
          fullName: userData.name || "",
          mobileNumber: userData.mobileNumber || "",
          email: userData.email || "",
          image: userData.image || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      setFetchError("Failed to load user details");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh data function
  const refreshData = useCallback(() => {
    fetchStaff();
  }, [fetchStaff]);

  const fetchDepartmentsForFilter = async (businessId) => {
    console.log("fetchDepartmentforfilter is running", businessId);
    try {
      const payload = {
        business_id: businessId,
        FilterStatus: "",
        FilterName: "",
      };
      const res = await axios.post(`${Base_URL}/Departments/get_all`, payload, {
        headers,
      });
      setDepartments(res.data.data || []);
    } catch (err) {
      console.log("Failed to fetch departments");
    }
  };

  const fetchPositionsForFilter = async (businessId) => {
    try {
      const payload = {
        business_id: businessId,
        FilterStatus: "",
        FilterName: "",
      };
      const res = await axios.post(`${Base_URL}/Positions/get_all`, payload, {
        headers,
      });
      setPositions(res.data.data || []);
    } catch (err) {
      console.log("Failed to fetch positions");
    }
  };

  const Loader = () => (
    <div className="flex justify-center items-center py-10">
      <div className="w-10 h-10 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
    </div>
  );

  const resetStaffFilters = useCallback(() => {
    setFilters({
      business: "",
      name: "",
      department: "",
      position: "",
      status: "Active",
      date: "",
    });
    setDepartments([]);
    setPositions([]);
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, []);

  useEffect(() => {
    if (skipStaffFilterEffect.current) {
      skipStaffFilterEffect.current = false;
      return;
    }
    if (!adminInfo?.token) return;

    const id = setTimeout(() => {
      if (currentPageRef.current !== 1) {
        setCurrentPage(1);
        currentPageRef.current = 1;
      } else {
        fetchStaff(1, recordsPerPage);
      }
    }, 350);

    return () => clearTimeout(id);
  }, [
    filters.business,
    filters.name,
    filters.department,
    filters.position,
    filters.status,
    filters.date,
    adminInfo?.token,
    fetchStaff,
    recordsPerPage,
  ]);

  const portalFilters = useMemo(() => {
    const list = [];

    if (!isSingleBusiness) {
      list.push({
        key: "business",
        placeholder: t("Select Business"),
        options: [
          { value: "", label: t("Select Business") },
          ...businesses.map((b) => ({
            value: b._id,
            label: b.name,
          })),
        ],
      });
    }

    list.push(
      {
        key: "department",
        placeholder: t("staffManagement.searchByDepartment"),
        options: [
          { value: "", label: t("staffManagement.searchByDepartment") },
          ...(departments || []).map((dept) => ({
            value: dept._id,
            label: dept.name,
          })),
        ],
      },
      {
        key: "position",
        placeholder: t("staffManagement.searchByPosition"),
        options: [
          { value: "", label: t("staffManagement.searchByPosition") },
          ...(positions || []).map((pos) => ({
            value: pos._id,
            label: pos.name,
          })),
        ],
      },
      {
        key: "status",
        placeholder: t("staffManagement.searchByStatus"),
        options: [
          { value: "", label: "All" },
          { value: "Active", label: "Active" },
          { value: "Inactive", label: "Inactive" },
          { value: "On Leave", label: "On Leave" },
          { value: "Resigned", label: "Resigned" },
          { value: "Promoted", label: "Promoted" },
          { value: "Terminated", label: "Terminated" },
        ],
      }
    );

    return list;
  }, [isSingleBusiness, businesses, departments, positions, t]);

  const portalFilterValues = {
    business: filters.business || "",
    department: filters.department || "",
    position: filters.position || "",
    status: filters.status === "all" ? "" : filters.status || "",
  };

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      handleFilterChange("business", value || "");
      handleFilterChange("department", "");
      handleFilterChange("position", "");
      if (value) {
        fetchDepartmentsForFilter(value);
        fetchPositionsForFilter(value);
      } else {
        setDepartments([]);
        setPositions([]);
      }
      return;
    }
    if (key === "status") {
      handleFilterChange("status", value || "all");
      return;
    }
    handleFilterChange(key, value || "");
  };

  const staffListColumns = useMemo(
    () => [
      {
        key: "name",
        header: t("staffManagement.name"),
        width: "24%",
        render: (staff) => (
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={staff.image ? `${staff.image}` : personPlaceholder}
              onError={(e) => {
                e.target.src = personPlaceholder;
              }}
              alt={staff.displayName || staff.person || ""}
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
            />
            <span className="epc-cell__primary truncate" title={staff.displayName || ""}>
              {staff.displayName || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "icPassport",
        header: t("staffManagement.icPassport"),
        width: "14%",
        render: (staff) => (
          <span className="epc-cell__secondary">{staff.icorpassport || "—"}</span>
        ),
      },
      {
        key: "phone",
        header: t("staffManagement.phone"),
        width: "12%",
        render: (staff) => staff.mobileNumber || "—",
      },
      {
        key: "position",
        header: t("staffManagement.position"),
        width: "14%",
        render: (staff) => (
          <span className="epc-cell__primary">
            {staff?.position?.name || "—"}
          </span>
        ),
      },
      {
        key: "department",
        header: t("staffManagement.department"),
        width: "14%",
        render: (staff) => staff?.department?.name || "—",
      },
      {
        key: "status",
        header: t("staffManagement.status"),
        width: "10%",
        render: (staff) => <StatusPill status={staff.status || "—"} />,
      },
      {
        key: "actions",
        header: t("staffManagement.action"),
        width: "12%",
        align: "right",
        render: (staff) =>
          canViewStaffDetails ? (
            <div className="epc-rowactions">
              <ActionButtons
                isCell
                justifyCenter
                items={[
                  {
                    action: ACTION_BUTTON_TYPES.VIEW,
                    tooltip: t("common.view") || "View",
                    permission: true,
                    onClick: () => history.push(`/staff/${staff._id}`),
                  },
                ]}
              />
            </div>
          ) : (
            <span className="epc-cell__secondary text-sm">No access</span>
          ),
      },
    ],
    [t, canViewStaffDetails, history]
  );

  const staffExportFilterLines = useMemo(() => {
    const lines = [];

    if (filters.business) {
      const business = businesses.find(
        (b) => String(b._id) === String(filters.business)
      );
      lines.push({
        label: t("Select Business"),
        value: business?.name || filters.business,
      });
    }
    if (filters.name?.trim()) {
      lines.push({
        label: t("staffManagement.searchByName"),
        value: filters.name.trim(),
      });
    }
    if (filters.department) {
      const department = departments.find(
        (d) => String(d._id) === String(filters.department)
      );
      lines.push({
        label: t("staffManagement.searchByDepartment"),
        value: department?.name || filters.department,
      });
    }
    if (filters.position) {
      const position = positions.find(
        (p) => String(p._id) === String(filters.position)
      );
      lines.push({
        label: t("staffManagement.searchByPosition"),
        value: position?.name || filters.position,
      });
    }
    if (filters.status && filters.status !== "all") {
      lines.push({
        label: t("staffManagement.searchByStatus"),
        value: filters.status,
      });
    }
    if (filters.date) {
      lines.push({
        label: "Date",
        value: formatDate(filters.date),
      });
    }

    return lines;
  }, [filters, businesses, departments, positions, t]);

  const fetchAllStaffForExport = useCallback(async () => {
    try {
      const response = await axios.get(`${Base_URL}/staff-management`, {
        params: {
          page: 1,
          limit: 99999,
          name: filters.name,
          department: filters.department,
          position: filters.position,
          status: filters.status === "all" ? "" : filters.status,
          date: filters.date ? new Date(filters.date).toISOString() : "",
          business: filters.business,
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminInfo?.token}`,
        },
      });
      return response.data.staffList || [];
    } catch (error) {
      console.error("Error fetching staff for export:", error);
      notifyError("Failed to fetch staff data for export.");
      return [];
    }
  }, [filters, adminInfo?.token]);

  const downloadExcel = async () => {
    try {
      const staffRows = await fetchAllStaffForExport();
      if (!staffRows.length) {
        notifyError("No staff records to export.");
        return;
      }

      const nameCol = t("staffManagement.name");
      const icCol = t("staffManagement.icPassport");
      const phoneCol = t("staffManagement.phone");
      const positionCol = t("staffManagement.position");
      const departmentCol = t("staffManagement.department");
      const statusCol = t("staffManagement.status");

      const exportData = staffRows.map((staff) => ({
        [nameCol]: staff.displayName || "",
        [icCol]: staff.icorpassport || "",
        [phoneCol]: staff.mobileNumber || "",
        [positionCol]: staff?.position?.name || "",
        [departmentCol]: staff?.department?.name || "",
        [statusCol]: staff.status || "",
      }));

      const generatedOnRow = {
        [nameCol]: `Generated on: ${formatDate(new Date())}`,
      };
      const totalCountRow = {
        [nameCol]: `Total Staff: ${staffRows.length}`,
      };

      const worksheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_json(worksheet, [generatedOnRow, totalCountRow], {
        skipHeader: true,
        origin: "A1",
      });
      XLSX.utils.sheet_add_json(worksheet, exportData, {
        skipHeader: false,
        origin: "A4",
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Staff List");
      XLSX.writeFile(workbook, "Staff_List.xlsx");
    } catch (error) {
      console.error("Error downloading Excel:", error);
      notifyError("Error downloading Excel file. Please try again.");
    }
  };

  const downloadPDF = async () => {
    try {
      const staffRows = await fetchAllStaffForExport();
      if (!staffRows.length) {
        notifyError("No staff records to export.");
        return;
      }

      const doc = new jsPDF({ orientation: "landscape" });
      let y = 15;

      doc.setFontSize(16);
      doc.text(t("staffManagement.title"), 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Generated on: ${formatDate(new Date())}`, 14, y);
      y += 7;

      doc.setFontSize(12);
      doc.text(`Total Staff: ${staffRows.length}`, 14, y);
      y += 8;

      if (staffExportFilterLines.length > 0) {
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("Filters applied:", 14, y);
        y += 6;
        doc.setFont(undefined, "normal");
        doc.setFontSize(9);
        staffExportFilterLines.forEach(({ label, value }) => {
          doc.text(`${label}: ${value}`, 14, y);
          y += 5;
        });
        y += 4;
      }

      const headers = [
        t("staffManagement.name"),
        t("staffManagement.icPassport"),
        t("staffManagement.phone"),
        t("staffManagement.position"),
        t("staffManagement.department"),
        t("staffManagement.status"),
      ];
      const rows = staffRows.map((staff) => [
        staff.displayName || "",
        staff.icorpassport || "",
        staff.mobileNumber || "",
        staff?.position?.name || "",
        staff?.department?.name || "",
        staff.status || "",
      ]);

      autoTable(doc, {
        startY: y,
        head: [headers],
        body: rows,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [242, 144, 16] },
      });

      doc.save("Staff_List.pdf");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      notifyError("Error downloading PDF file. Please try again.");
    }
  };

  const getApprovalLevelText = (level) => {
    return `${level} Level${level > 1 ? "s" : ""}`;
  };

  const handleCancel = () => {
    setFormData({
      fullName: "",
      displayName: "",
      nationality: "Malaysian",
      maritalStatus: "Single",
      bloodType: "",
      religion: "",
      spokenLanguages: [],
      dateOfBirth: "",
      gender: "Male",
      icorpassport: "",
      email: "",
      mobileNumber: "",
      googleLocation: "",
      unitHouseInfo: "",
      streetBlock: "",
      suburb: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
      image: "",

      // Employment Details
      employeeId: "",
      department: "",
      position: "",
      shift: "",
      leaveGroup: "",
      claimGroup: "",
      joiningDate: "",
      probationStartDate: "",
      probationEndDate: "",
      confirmationDate: "",
      employmentType: "", // Full-time, Part-time, etc.
      workPassType: "",
      visaExpiryDate: "",
      uniformSize: "",
      branchLocations: [],
      jobRole: "",
      workingShift: "",
      endDate: "",
      reasonForLeaving: "",
      leaveApprovalLevel: "",
      claimApprovalLevel: "",
      bankDetails: {
        accountHolderName: "",
        bankName: "",
        bankBranch: "",
        accountNumber: "",
        accountType: "",
        ifscCode: "",
        swiftCode: "",
        iban: "",
        currency: "",
        remarks: "",
      },
    });

    setLeaveApprovalSelectors({
      level1: { role: "", user: "" },
      level2: { role: "", user: "" },
      level3: { role: "", user: "" },
    });

    setClaimApprovalSelectors({
      level1: { role: "", user: "" },
      level2: { role: "", user: "" },
      level3: { role: "", user: "" },
    });

    setFormErrors({});
    setSelectedTab("Personal Info");
    setSelectedUser("");
    setModalOpen(false);
    setCurrentView("list");
    setAddAsSystemUser(false);
    setSystemUserForm({
      name: "",
      password: "",
      confirmPassword: "",
      businessGroup: "",
      role: "",
      businesses: [],
      status: true,
    });
    setSystemUserRoles([]);
    setSystemUserBusinesses([]);
    setSystemUserFormErrors({});
    setIsPasswordModalOpen(false);
    setGeneratedPassword("");
  };

  const handleRecordsPerPageChange = (perPage) => {
    setRecordsPerPage(perPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const initialFormData = {
    fullName: "",
    displayName: "",
    nationality: "Malaysian",
    maritalStatus: "Single",
    bloodType: "",
    religion: "",
    spokenLanguages: [],
    dateOfBirth: "",
    gender: "Male",
    icorpassport: "",
    email: "",
    mobileNumber: "",
    googleLocation: "",
    unitHouseInfo: "",
    streetBlock: "",
    suburb: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
    image: "",

    // Employment Details
    employeeId: "",
    department: "",
    position: "",
    shift: "",
    leaveGroup: "",
    claimGroup: "",
    joiningDate: "",
    probationStartDate: "",
    probationEndDate: "",
    confirmationDate: "",
    employmentType: "", // Full-time, Part-time, etc.
    workPassType: "",
    visaExpiryDate: "",
    uniformSize: "",
    branchLocations: [],
    jobRole: "",
    workingShift: "",
    endDate: "",
    reasonForLeaving: "",
  };

  return (
    <RoutePermissionGate title={t("staffManagement.title")}>
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

      {/* <ToastContainer position="top-center" /> */}
      {currentView === "list" ? (
        <EpcPage
          flush
          title={t("staffManagement.title")}
          subtitle={t("staffManagement.pageDescription")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {canViewStaff ? (
                <>
                  <PortalButton variant="secondary" onClick={downloadExcel}>
                    <img
                      src={csv || "/placeholder.svg"}
                      alt=""
                      className="w-4 h-4 object-contain"
                    />
                    {t("staffManagement.downloadExcel")}
                  </PortalButton>
                  <PortalButton variant="secondary" onClick={downloadPDF}>
                    <img
                      src={pdfIcon || "/placeholder.svg"}
                      alt=""
                      className="w-4 h-4 object-contain"
                    />
                    {t("staffManagement.downloadPDF")}
                  </PortalButton>
                </>
              ) : null}
              {canAddStaff ? (
                <PortalButton
                  onClick={() => {
                    setCurrentView("add");
                    setModalOpen(true);
                  }}
                >
                  <PlusIcon size={15} />
                  {t("staffManagement.addNew")}
                </PortalButton>
              ) : null}
            </div>
          }
        >
          <div className="epc-stack">
            <UserLimitBanner userUsage={userUsage} />

            {!canViewStaff ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
                You do not have permission to view staff records.
              </div>
            ) : (
              <>
                <FilterBar
                  subtitle={t("staffManagement.pageDescription")}
                  searchPlaceholder={t("staffManagement.searchByName")}
                  searchValue={filters.name}
                  onSearchChange={(value) => handleFilterChange("name", value)}
                  filters={portalFilters}
                  values={portalFilterValues}
                  onChange={handlePortalFilterChange}
                  onReset={resetStaffFilters}
                />

                <div className="flex flex-wrap gap-3 items-center">
                  <label className="text-sm text-gray-600 flex items-center gap-2">
                    <span>Date</span>
                    <input
                      type="date"
                      value={filters.date || ""}
                      onChange={(e) =>
                        handleFilterChange("date", e.target.value)
                      }
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>

                <Card>
                  <CardHeader
                    title={t("staffManagement.title")}
                    subtitle={
                      newRecordsLoading
                        ? "Loading…"
                        : `${totalResults} total staff`
                    }
                  />

                  <PortalDataTable
                    columns={staffListColumns}
                    rows={newRecordsLoading ? [] : staffList}
                    rowKey="_id"
                    emptyMessage={
                      newRecordsLoading
                        ? "Loading…"
                        : "No staff match these filters."
                    }
                  />

                  {!newRecordsLoading && totalResults > 0 ? (
                    <Pagination
                      page={currentPage}
                      pageSize={recordsPerPage}
                      total={totalResults}
                      itemLabel="staff"
                      onPageChange={handlePageChange}
                      onPageSizeChange={handleRecordsPerPageChange}
                    />
                  ) : null}
                </Card>
              </>
            )}
          </div>
        </EpcPage>
      ) : (
        <div className={HR_PAGE_SHELL}>
        <div className={HR_PAGE_INNER}>
          {/* Add New Staff Form */}
           <PageHeader
            title={t("staffManagement.addNew")}
            showBackButton
            onBackClick={() => setCurrentView("list")}
            backFallbackPath="/staff-management"
          />

          <UserLimitBanner userUsage={userUsage} />

          <div className="mb-8 flex flex-col lg:flex-row gap-6">
            {/* Vertical tab rail */}
            <div className="lg:w-[320px] shrink-0">
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 lg:sticky lg:top-20">
                <div
                  ref={tabRailRef}
                  className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto lg:max-h-[calc(100dvh-10rem)] lg:overscroll-contain lg:pb-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                {STAFF_FORM_TAB_CONFIG.map((tabConfig) => {
                  const tab = tabConfig.label;
                  const TabIcon = tabConfig.icon;
                  return (
                  <button
                    key={tab}
                    type="button"
                    ref={(el) => {
                      if (el) tabButtonRefs.current[tab] = el;
                    }}
                    onClick={() => {
                    if (tab === "Employment Details") {
                      const errors = validateForm("Personal Info");
                      if (Object.keys(errors).length > 0) {
                        setFormErrors(errors);
                        notifyError(
                          "Please complete Personal Info before proceeding."
                        );
                        setIsFormSubmitted(true);
                        return;
                      }
                    }

                    if (tab === "Contact Information") {
                      const errors = {
                        ...validateForm("Personal Info"),
                        ...validateForm("Employment Details"),
                      };
                      if (Object.keys(errors).length > 0) {
                        setFormErrors(errors);
                        notifyError(
                          "Please complete previous steps before proceeding."
                        );
                        return;
                      }
                    }

                    if (tab === "Bank Details") {
                      const errors = {
                        ...validateForm("Personal Info"),
                        ...validateForm("Employment Details"),
                        ...validateForm("Contact Information"),
                      };
                      if (Object.keys(errors).length > 0) {
                        setFormErrors(errors);
                        notifyError(
                          "Please complete previous steps before proceeding."
                        );
                        return;
                      }
                    }

                    if (tab === "System User") {
                      const errors = {
                        ...validateForm("Personal Info"),
                        ...validateForm("Employment Details"),
                        ...validateForm("Contact Information"),
                      };
                      if (Object.keys(errors).length > 0) {
                        setFormErrors(errors);
                        notifyError(
                          "Please complete previous steps before proceeding."
                        );
                        return;
                      }
                    }

                    shouldScrollContentOnTabChangeRef.current = true;
                    setSelectedTab(tab);
                  }}
                    className={`group min-w-[220px] lg:min-w-0 lg:w-full flex flex-1 items-start gap-3 text-left rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                      selectedTab === tab
                        ? "border-[var(--p-blue)] bg-[var(--p-blue)]/10 text-[var(--p-blue)] shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selectedTab === tab
                          ? "bg-[var(--p-blue)] text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}
                    >
                      <TabIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`text-sm font-semibold ${
                          selectedTab === tab ? "text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {tab}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {tabConfig.description}
                      </span>
                    </span>
                  </button>
                );
              })}
                </div>
              </div>
            </div>
            {/* Form content panel */}
            <div className="flex-1 min-w-0">
              <div
                ref={contentPanelRef}
                className="rounded-2xl mb-6 bg-white border border-slate-200 p-4 md:p-6 transition-all duration-200 ease-out"
              >
            {selectedTab === "Personal Info" && (
              <div className="rounded-lg">
                <PageHeader title="Personal Info" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <div
                      {...getRootProps()}
                      className={`bg-gray-200 rounded-lg flex flex-col items-center justify-center h-72 relative cursor-pointer border-2 border-dashed ${
                        formErrors.image
                          ? "border-red-500"
                          : "border-gray-300 hover:border-[var(--p-blue)]"
                      } transition-colors`}
                    >
                      <input {...getInputProps()} />
                      {formData.image ? (
                        <div className="relative w-full h-full">
                          <img
                            src={`${formData.image}`}
                            alt="Profile"
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                            <div className="text-white text-center p-2">
                              <ImageIcon size={24} className="mx-auto mb-2" />
                              <p>Click to change</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <div className="w-24 h-24 bg-gray-300 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <ImageIcon size={32} className="text-gray-500" />
                          </div>
                          <p className="text-gray-500">
                            Drag & drop image here
                          </p>
                          <p className="text-gray-400 text-sm">
                            or click to select
                          </p>
                        </div>
                      )}
                    </div>
                    {formErrors.image && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.image}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <InputField
                          type="text"
                          placeholder="Full Name"
                          value={formData.fullName}
                          onChange={(e) =>
                            handleFormChange("fullName", e.target.value)
                          }
                          error={formErrors.fullName}
                          shouldShowError={true}
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Preferred Name
                        </label>
                        <InputField
                          type="text"
                          placeholder="Preferred Name"
                          value={formData.displayName}
                          onChange={(e) =>
                            handleFormChange("displayName", e.target.value)
                          }
                          error={formErrors.displayName}
                          shouldShowError={true}
                        />
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
                          options={nationalities
                            .getAllNationalities()
                            .map((e) => ({
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

                        {formErrors.nationality && (
                          <div className="text-red-500 text-sm mt-1">
                            {formErrors.nationality}
                          </div>
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

                        {/* Optional error display below */}
                        {formErrors.maritalStatus && (
                          <div className="text-red-500 text-sm mt-1">
                            {formErrors.maritalStatus}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          IC/Passport
                        </label>
                        <InputField
                          type="text"
                          placeholder="IC/Passport"
                          value={formData.icorpassport}
                          onChange={(e) =>
                            handleFormChange("icorpassport", e.target.value)
                          }
                          error={formErrors.icorpassport}
                          shouldShowError={true}
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Date of Birth
                        </label>
                        <div className="relative">
                          <CustomDatePicker
                            value={formData.dateOfBirth}
                            onChange={(date) =>
                              handleFormChange("dateOfBirth", date)
                            }
                            bgColor="#F3F4F6"
                            error={formErrors.dateOfBirth}
                            shouldShowError={true}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <ReactSelect
                            value={
                              formData.gender
                                ? {
                                    value: formData.gender,
                                    label: formData.gender,
                                  }
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
                          {formErrors.gender && (
                            <div className="text-red-500 text-sm mt-1">
                              {formErrors.gender}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Blood Type
                        </label>
                        <div className="relative">
                          <DropdownBasic
                            value={formData.bloodType}
                            onChange={(value) =>
                              handleFormChange("bloodType", value)
                            }
                            placeholder="Blood Type"
                            options={bloods}
                            error={formErrors.bloodType}
                            shouldShowError={true}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Religion
                        </label>
                        <div className="relative">
                          <ReactSelect
                            value={
                              formData.religion
                                ? {
                                    value: formData.religion,
                                    label: formData.religion,
                                  }
                                : null
                            }
                            onChange={(selectedOption) =>
                              handleFormChange(
                                "religion",
                                selectedOption ? selectedOption.value : ""
                              )
                            }
                            placeholder="Religion"
                            options={religions}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isSearchable
                            menuPlacement="auto"
                            styles={reactSelectConfig}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Spoken Languages
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
                          className="react-select-container"
                          classNamePrefix="react-select"
                          menuPlacement="top"
                          styles={{
                            ...reactSelectConfig,
                            control: (base, state) => ({
                              ...reactSelectConfig.control?.(base, state),
                              borderColor: state.isFocused
                                ? "var(--p-blue)"
                                : "transparent",
                              "&:hover": {
                                borderColor: "none",
                              },
                            }),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === "Employment Details" && (
              <div className="rounded-lg">
                <PageHeader title="Employment Details" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Employee ID */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Employee ID <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      type="text"
                      placeholder="Employee ID"
                      value={formData.employeeId}
                      onChange={(e) =>
                        handleFormChange("employeeId", e.target.value)
                      }
                      error={formErrors.employeeId}
                      shouldShowError={true}
                    />
                  </div>

                  {/* 2. Job Title (Position) */}
                  <PositionSelectWithAdd
                    businessId={selectedBusiness}
                    value={formData.position}
                    onChange={(id) => handleFormChange("position", id)}
                    positions={positions}
                    onPositionsRefetch={fetchPositions}
                    error={formErrors.position}
                    required
                    idleBorderColor="transparent"
                  />

                  {/* 2. Assign Shift */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Shift <span className="text-red-500">*</span>
                    </label>
                    <ReactSelect
                      value={
                        formData.shift
                          ? {
                              value: formData.shift,
                              label: shifts?.find(
                                (p) => p._id === formData.shift
                              )?.name,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "shift",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Shift"
                      options={shifts?.map((p) => ({
                        label: p.name,
                        value: p._id,
                      }))}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.shift
                            ? "#dc2626"
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                    {/* Optional error display below */}
                    {formErrors.shift && (
                      <div className="text-red-500 text-sm mt-1">
                        {formErrors.shift}
                      </div>
                    )}
                  </div>

                  {/* 3. Department / Team */}
                  <DepartmentSelectWithAdd
                    businessId={selectedBusiness}
                    value={formData.department}
                    onChange={(id) => handleFormChange("department", id)}
                    departments={departments}
                    onDepartmentsRefetch={fetchDepartments}
                    error={formErrors.department}
                    required
                    idleBorderColor="transparent"
                  />

                  {/* 4. Branch / Location */}
                  <BranchLocationSelectWithAdd
                    businessId={selectedBusiness}
                    value={formData.branchLocations}
                    onChange={(ids) =>
                      handleFormChange("branchLocations", ids)
                    }
                    branches={branchLocations}
                    onBranchesRefetch={fetchBranchLocations}
                    error={formErrors.branchLocations}
                    required
                    idleBorderColor="transparent"
                  />

                  {/* 5. Joining Date */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Date of Joining
                    </label>
                    <CustomDatePicker
                      value={formData.joiningDate}
                      bgColor="#F3F4F6"
                      onChange={(date) => handleFormChange("joiningDate", date)}
                      error={formErrors.joiningDate}
                      shouldShowError={true}
                    />
                  </div>

                  {/* 6. Probation Start Date */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Probation Start Date{" "}
                     
                    </label>
                    <CustomDatePicker
                      value={formData.probationStartDate}
                      bgColor="#F3F4F6"
                      onChange={(date) =>
                        handleFormChange("probationStartDate", date)
                      }
                      error={formErrors.probationStartDate}
                      shouldShowError={true}
                    />
                  </div>

                  {/* 7. Probation End Date */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Probation End Date 
                    </label>
                    <CustomDatePicker
                      value={formData.probationEndDate}
                      bgColor="#F3F4F6"
                      onChange={(date) =>
                        handleFormChange("probationEndDate", date)
                      }
                      error={formErrors.probationEndDate}
                      shouldShowError={true}
                    />
                  </div>

                  {/* 8. Confirmation Date */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Confirmation Date 
                    </label>
                    <CustomDatePicker
                      value={formData.confirmationDate}
                      bgColor="#F3F4F6"
                      onChange={(date) =>
                        handleFormChange("confirmationDate", date)
                      }
                      error={formErrors.confirmationDate}
                      shouldShowError={true}
                    />
                  </div>

                  {/* 9. Employment Type */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Employment Type
                    </label>
                    <ReactSelect
                      value={
                        formData.employmentType
                          ? {
                              value: formData.employmentType,
                              label: formData.employmentType,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "employmentType",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Employment Type"
                      options={[
                        { label: "Full-time", value: "Full-time" },
                        { label: "Part-time", value: "Part-time" },
                        { label: "Intern", value: "Intern" },
                        { label: "Contract", value: "Contract" },
                        { label: "Freelancer", value: "Freelancer" },
                      ]}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.employmentType
                            ? "#dc2626"
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                    {/* Optional error display below */}
                    {formErrors.employmentType && (
                      <div className="text-red-500 text-sm mt-1">
                        {formErrors.employmentType}
                      </div>
                    )}
                  </div>

                  {/* 10. Work Pass Type (Optional) */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Work Pass Type
                    </label>
                    <ReactSelect
                      value={
                        formData.workPassType
                          ? {
                              value: formData.workPassType,
                              label: formData.workPassType,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "workPassType",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Work Pass Type"
                      options={workPassTypes?.map((type) => ({
                        label: type.name,
                        value: type.name,
                      }))}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.workPassType
                            ? "#dc2626"
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

                  {/* 11. Visa Expiry Date (Optional) */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Work Pass / Visa Expiry Date
                    </label>
                    <CustomDatePicker
                      value={formData.visaExpiryDate}
                      bgColor="#F3F4F6"
                      onChange={(date) =>
                        handleFormChange("visaExpiryDate", date)
                      }
                      error={formErrors.visaExpiryDate}
                      shouldShowError={true}
                    />
                  </div>

                  {/* 12. Uniform Size (Optional) */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Uniform Size
                    </label>
                    <ReactSelect
                      value={
                        formData.uniformSize
                          ? {
                              value: formData.uniformSize,
                              label: formData.uniformSize,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "uniformSize",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Size"
                      options={[
                        { label: "XS", value: "XS" },
                        { label: "S", value: "S" },
                        { label: "M", value: "M" },
                        { label: "L", value: "L" },
                        { label: "XL", value: "XL" },
                        { label: "XXL", value: "XXL" },
                      ]}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.uniformSize
                            ? "#dc2626"
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

                  {/* 13. Leave Group */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Leave Group 
                 
                    </label>
                    <ReactSelect
                      value={
                        formData.leaveGroup
                          ? {
                              value: formData.leaveGroup,
                              label: leaveGroups?.find(
                                (l) => l._id === formData.leaveGroup
                              )?.name,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "leaveGroup",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Leave Group"
                      options={leaveGroups?.map((item) => ({
                        label: item?.name,
                        value: item?._id,
                      }))}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      isClearable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.leaveGroup
                            ? "#dc2626"
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                    {/* Optional error display below */}
                    {formErrors.leaveGroup && (
                      <div className="text-red-500 text-sm mt-1">
                        {formErrors.leaveGroup}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-2">
                      Leave Approval Level{" "}
                    </label>
                    <ReactSelect
                      value={
                        formData.leaveApprovalLevel
                          ? {
                              value: formData.leaveApprovalLevel,
                              label: getApprovalLevelText(
                                formData.leaveApprovalLevel
                              ),
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "leaveApprovalLevel",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Approval Level"
                      options={[1, 2, 3]?.map((level) => ({
                        label: getApprovalLevelText(level),
                        value: level,
                      }))}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      isClearable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.leaveApprovalLevel
                            ? "#dc2626"
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                    {/* Optional error display below */}
                    {formErrors.leaveApprovalLevel && (
                      <div className="text-red-500 text-sm mt-1">
                        {formErrors.leaveApprovalLevel}
                      </div>
                    )}
                  </div>

                  {/* Leave Approval Level Selectors - Show based on selected level */}
                  {formData.leaveApprovalLevel && (
                    <div className="col-span-1 md:col-span-2 space-y-4 mt-4 p-5 bg-blue-50 rounded-xl border border-blue-200">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Leave Approval Level Configuration
                      </h3>
                      {Array.from(
                        { length: parseInt(formData.leaveApprovalLevel) || 0 },
                        (_, i) => {
                          const level = i + 1;
                          const levelKey = `level${level}`;
                          const selectorData = leaveApprovalSelectors[
                            levelKey
                          ] || {
                            role: "",
                            user: "",
                          };

                          return (
                            <div
                              key={level}
                              className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Level {level} - Role
                                </label>
                                <ReactSelect
                                  value={
                                    selectorData.role
                                      ? {
                                          value: selectorData.role,
                                          label: selectorData.role,
                                        }
                                      : null
                                  }
                                  onChange={(selectedOption) =>
                                    handleLeaveApprovalSelectorChange(
                                      level,
                                      "role",
                                      selectedOption ? selectedOption.value : ""
                                    )
                                  }
                                  placeholder="Select Role"
                                  options={leaveApprovalRolesOptions?.map(
                                    (role) => ({
                                      label: role.name,
                                      value: role.name,
                                    })
                                  )}
                                  className="react-select-container"
                                  classNamePrefix="react-select"
                                  isSearchable
                                  menuPlacement="auto"
                                  styles={{
                                    ...reactSelectConfig,
                                    control: (base, state) => ({
                                      ...reactSelectConfig.control?.(
                                        base,
                                        state
                                      ),
                                      borderColor: formErrors[
                                        `leaveApprovalLevel${level}Role`
                                      ]
                                        ? "#dc2626"
                                        : state.isFocused
                                        ? "var(--p-blue)"
                                        : "transparent",
                                      "&:hover": {
                                        borderColor: "none",
                                      },
                                    }),
                                  }}
                                />
                                {formErrors[
                                  `leaveApprovalLevel${level}Role`
                                ] && (
                                  <div className="text-red-500 text-sm mt-1">
                                    {
                                      formErrors[
                                        `leaveApprovalLevel${level}Role`
                                      ]
                                    }
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Level {level} - System User{" "}
                                  <span className="text-gray-500 text-xs font-normal">
                                    (Optional)
                                  </span>
                                </label>
                                <ReactSelect
                                  value={
                                    selectorData.user
                                      ? (() => {
                                          const selectedUser =
                                            getFilteredSystemUsers(level)?.find(
                                              (u) => u._id === selectorData.user
                                            );
                                          return selectedUser
                                            ? {
                                                value: selectorData.user,
                                                label: `${selectedUser.name} ${
                                                  selectedUser.last_name || ""
                                                } (${selectedUser.email})`,
                                              }
                                            : null;
                                        })()
                                      : null
                                  }
                                  onChange={(selectedOption) =>
                                    handleLeaveApprovalSelectorChange(
                                      level,
                                      "user",
                                      selectedOption ? selectedOption.value : ""
                                    )
                                  }
                                  placeholder={
                                    selectorData.role
                                      ? "Select System User"
                                      : "Please select a role first"
                                  }
                                  options={getFilteredSystemUsers(level)?.map(
                                    (user) => ({
                                      label: `${user.name} ${
                                        user.last_name ? user.last_name : ""
                                      } (${user.email})`,
                                      value: user._id,
                                    })
                                  )}
                                  className="react-select-container"
                                  classNamePrefix="react-select"
                                  isSearchable
                                  menuPlacement="auto"
                                  isDisabled={!selectorData.role}
                                  styles={{
                                    ...reactSelectConfig,
                                    control: (base, state) => ({
                                      ...reactSelectConfig.control?.(
                                        base,
                                        state
                                      ),
                                      backgroundColor: !selectorData.role
                                        ? "#f3f4f6"
                                        : "transparent",
                                      borderColor: state.isFocused
                                        ? "var(--p-blue)"
                                        : "transparent",
                                      "&:hover": {
                                        borderColor: "none",
                                      },
                                    }),
                                  }}
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}

                  {/* 14. Claim Group */}
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Claim Group 
                    </label>
                    <ReactSelect
                      value={
                        formData.claimGroup
                          ? {
                              value: formData.claimGroup,
                              label: claimGroups?.find(
                                (c) => c._id === formData.claimGroup
                              )?.name,
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "claimGroup",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Claim Group"
                      options={claimGroups?.map((item) => ({
                        label: item?.name,
                        value: item?._id,
                      }))}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      isClearable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.claimGroup
                            ? "#dc2626"
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                    {/* Optional error display below */}
                    {formErrors.claimGroup && (
                      <div className="text-red-500 text-sm mt-1">
                        {formErrors.claimGroup}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-2">
                      Claim Approval Level{" "}
                    </label>
                    <ReactSelect
                      value={
                        formData.claimApprovalLevel
                          ? {
                              value: formData.claimApprovalLevel,
                              label: getApprovalLevelText(
                                formData.claimApprovalLevel
                              ),
                            }
                          : null
                      }
                      onChange={(selectedOption) =>
                        handleFormChange(
                          "claimApprovalLevel",
                          selectedOption ? selectedOption.value : ""
                        )
                      }
                      placeholder="Select Approval Level"
                      options={[1, 2, 3]?.map((level) => ({
                        label: getApprovalLevelText(level),
                        value: level,
                      }))}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      isSearchable
                      isClearable
                      menuPlacement="auto"
                      styles={{
                        ...reactSelectConfig,
                        control: (base, state) => ({
                          ...reactSelectConfig.control?.(base, state),
                          borderColor: formErrors.claimApprovalLevel
                            ? "#dc2626"
                            : state.isFocused
                            ? "var(--p-blue)"
                            : "transparent",
                          "&:hover": {
                            borderColor: "none",
                          },
                        }),
                      }}
                    />
                    {/* Optional error display below */}
                    {formErrors.claimApprovalLevel && (
                      <div className="text-red-500 text-sm mt-1">
                        {formErrors.claimApprovalLevel}
                      </div>
                    )}
                  </div>

                  {formData.claimApprovalLevel && (
                    <div className="col-span-1 md:col-span-2 space-y-4 mt-4 p-5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Claim Approval Level Configuration
                      </h3>
                      {Array.from(
                        {
                          length: parseInt(formData.claimApprovalLevel) || 0,
                        },
                        (_, i) => {
                          const level = i + 1;
                          const levelKey = `level${level}`;
                          const selectorData = claimApprovalSelectors[
                            levelKey
                          ] || {
                            role: "",
                            user: "",
                          };

                          return (
                            <div
                              key={level}
                              className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Level {level} - Role
                                </label>
                                <ReactSelect
                                  value={
                                    selectorData.role
                                      ? {
                                          value: selectorData.role,
                                          label: selectorData.role,
                                        }
                                      : null
                                  }
                                  onChange={(selectedOption) =>
                                    handleClaimApprovalSelectorChange(
                                      level,
                                      "role",
                                      selectedOption ? selectedOption.value : ""
                                    )
                                  }
                                  placeholder="Select Role"
                                  options={leaveApprovalRolesOptions?.map(
                                    (role) => ({
                                      label: role.name,
                                      value: role.name,
                                    })
                                  )}
                                  className="react-select-container"
                                  classNamePrefix="react-select"
                                  isSearchable
                                  menuPlacement="auto"
                                  styles={{
                                    ...reactSelectConfig,
                                    control: (base, state) => ({
                                      ...reactSelectConfig.control?.(
                                        base,
                                        state
                                      ),
                                      borderColor: formErrors[
                                        `claimApprovalLevel${level}Role`
                                      ]
                                        ? "#dc2626"
                                        : state.isFocused
                                        ? "var(--p-blue)"
                                        : "transparent",
                                      "&:hover": {
                                        borderColor: "none",
                                      },
                                    }),
                                  }}
                                />
                                {formErrors[
                                  `claimApprovalLevel${level}Role`
                                ] && (
                                  <div className="text-red-500 text-sm mt-1">
                                    {
                                      formErrors[
                                        `claimApprovalLevel${level}Role`
                                      ]
                                    }
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Level {level} - System User{" "}
                                  <span className="text-gray-500 text-xs font-normal">
                                    (Optional)
                                  </span>
                                </label>
                                <ReactSelect
                                  value={
                                    selectorData.user
                                      ? (() => {
                                          const selectedUser =
                                            getFilteredClaimSystemUsers(
                                              level
                                            )?.find(
                                              (u) => u._id === selectorData.user
                                            );
                                          return selectedUser
                                            ? {
                                                value: selectorData.user,
                                                label: `${selectedUser.name} ${
                                                  selectedUser.last_name || ""
                                                } (${selectedUser.email})`,
                                              }
                                            : null;
                                        })()
                                      : null
                                  }
                                  onChange={(selectedOption) =>
                                    handleClaimApprovalSelectorChange(
                                      level,
                                      "user",
                                      selectedOption ? selectedOption.value : ""
                                    )
                                  }
                                  placeholder={
                                    selectorData.role
                                      ? "Select System User"
                                      : "Please select a role first"
                                  }
                                  options={getFilteredClaimSystemUsers(
                                    level
                                  )?.map((user) => ({
                                    label: `${user.name} ${
                                      user.last_name ? user.last_name : ""
                                    } (${user.email})`,
                                    value: user._id,
                                  }))}
                                  className="react-select-container"
                                  classNamePrefix="react-select"
                                  isSearchable
                                  menuPlacement="auto"
                                  isDisabled={!selectorData.role}
                                  styles={{
                                    ...reactSelectConfig,
                                    control: (base, state) => ({
                                      ...reactSelectConfig.control?.(
                                        base,
                                        state
                                      ),
                                      backgroundColor: !selectorData.role
                                        ? "#f3f4f6"
                                        : "transparent",
                                      borderColor: state.isFocused
                                        ? "var(--p-blue)"
                                        : "transparent",
                                      "&:hover": {
                                        borderColor: "none",
                                      },
                                    }),
                                  }}
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTab === "Contact Information" && (
              (() => {
                const contactInfoBody = (
                <div className="rounded-lg">
                  <PageHeader title="Contact Information" />
                  {!googleMapsKeyLoading && !googleMapsApiKey ? (
                    <p className="mb-4 text-sm text-amber-700">
                      Address search is unavailable. Add a Google Map API key in Configuration
                      (and allow this site in Google Cloud referrer settings).
                    </p>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <InputField
                        type="text"
                        placeholder="Mobile Number"
                        value={formData.mobileNumber}
                        onChange={(e) =>
                          handleFormChange("mobileNumber", e.target.value)
                        }
                        error={formErrors.mobileNumber}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <InputField
                        type="email"
                        placeholder="Enter Email"
                        value={formData.email}
                        onChange={(e) =>
                          handleFormChange("email", e.target.value)
                        }
                        error={formErrors.email}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Google Location
                      </label>
                      <PlacesAutocomplete
                        formData={formData}
                        handleFormChange={handleFormChange}
                        plainTextOnly={!googleMapsApiKey}
                        error={formErrors.googleLocation}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Unit/House Info
                      </label>
                      <InputField
                        type="text"
                        placeholder="Unit/House Info"
                        value={formData.unitHouseInfo}
                        onChange={(e) =>
                          handleFormChange("unitHouseInfo", e.target.value)
                        }
                        error={formErrors.unitHouseInfo}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Street/Block
                      </label>
                      <InputField
                        type="text"
                        placeholder="Street/Block"
                        value={formData.streetBlock}
                        onChange={(e) =>
                          handleFormChange("streetBlock", e.target.value)
                        }
                        error={formErrors.streetBlock}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">Suburb</label>
                      <InputField
                        type="text"
                        placeholder="Suburb"
                        value={formData.suburb}
                        onChange={(e) =>
                          handleFormChange("suburb", e.target.value)
                        }
                        error={formErrors.suburb}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">City</label>
                      <InputField
                        type="text"
                        placeholder="city"
                        value={formData.city}
                        onChange={(e) =>
                          handleFormChange("city", e.target.value)
                        }
                        error={formErrors.city}
                        shouldShowError={true}
                      />
                      {/* <div className="relative">
                        <DropdownBasic
                          value={formData.city}
                          onChange={(value) => handleFormChange("city", value)}
                          placeholder="Select City"
                          options={[
                            { label: "New York", value: "NY" },
                            { label: "Los Angeles", value: "CA" },
                            { label: "Chicago", value: "IL" },
                          ]}
                          error={formErrors.city}
                          shouldShowError={true}
                        />
                      </div> */}
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">State</label>
                      <InputField
                        type="text"
                        placeholder="State"
                        value={formData.state}
                        onChange={(e) =>
                          handleFormChange("state", e.target.value)
                        }
                        error={formErrors.state}
                        shouldShowError={true}
                      />
                      {/* <div className="relative">
                        <DropdownBasic
                          value={formData.state}
                          onChange={(value) => handleFormChange("state", value)}
                          placeholder="Select State"
                          options={[
                            { label: "New York", value: "NY" },
                            { label: "California", value: "CA" },
                            { label: "Illinois", value: "IL" },
                          ]}
                          error={formErrors.state}
                          shouldShowError={true}
                        />
                      </div> */}
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Postcode
                      </label>
                      <InputField
                        type="text"
                        placeholder="Postcode"
                        value={formData.postcode}
                        onChange={(e) =>
                          handleFormChange("postcode", e.target.value)
                        }
                        error={formErrors.postcode}
                        shouldShowError={true}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">
                        Country
                      </label>
                      <InputField
                        type="text"
                        placeholder="Country"
                        value={formData.country}
                        onChange={(e) =>
                          handleFormChange("country", e.target.value)
                        }
                        error={formErrors.country}
                        shouldShowError={true}
                      />
                      {/* <div className="relative">
                        <DropdownBasic
                          value={formData.country}
                          onChange={(value) =>
                            handleFormChange("country", value)
                          }
                          placeholder="Select Country"
                          options={[
                            { label: "USA", value: "USA" },
                            { label: "Canada", value: "Canada" },
                            { label: "UK", value: "UK" },
                          ]}
                          error={formErrors.country}
                          shouldShowError={true}
                        />
                      </div> */}
                    </div>
                  </div>
                </div>
                );
                return googleMapsApiKey ? (
                  <LoadScript
                    key={googleMapsApiKey}
                    googleMapsApiKey={googleMapsApiKey}
                    libraries={libraries}
                  >
                    {contactInfoBody}
                  </LoadScript>
                ) : (
                  contactInfoBody
                );
              })()
            )}
            {selectedTab === "Bank Details" && (
              <div className="rounded-lg">
                <PageHeader title="Bank Details" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Account Holder Name
                    </label>
                    <InputField
                      type="text"
                      placeholder="Account Holder Name"
                      value={formData.bankDetails?.accountHolderName || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          accountHolderName: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.accountHolderName}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Bank Name
                    </label>
                    <InputField
                      type="text"
                      placeholder="Bank Name"
                      value={formData.bankDetails?.bankName || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          bankName: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.bankName}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Bank Branch
                    </label>
                    <InputField
                      type="text"
                      placeholder="Bank Branch"
                      value={formData.bankDetails?.bankBranch || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          bankBranch: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.bankBranch}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Account Number
                    </label>
                    <InputField
                      type="text"
                      placeholder="Account Number"
                      value={formData.bankDetails?.accountNumber || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          accountNumber: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.accountNumber}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">
                      Account Type
                    </label>
                    <DropdownBasic
                      options={[
                        { value: "Savings Account", label: "Savings Account" },
                        { value: "Current Account", label: "Current Account" },
                        {
                          value: "Business Account",
                          label: "Business Account",
                        },
                        { value: "Salary Account", label: "Salary Account" },
                        { value: "Joint Account", label: "Joint Account" },
                      ]}
                      value={formData.bankDetails?.accountType || ""}
                      onChange={(selectedValue) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          accountType: selectedValue,
                        })
                      }
                      placeholder="Select Account Type"
                      error={formErrors.bankDetails?.accountType}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">
                      IFSC Code
                    </label>
                    <InputField
                      type="text"
                      placeholder="IFSC Code"
                      value={formData.bankDetails?.ifscCode || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          ifscCode: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.ifscCode}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">
                      SWIFT Code
                    </label>
                    <InputField
                      type="text"
                      placeholder="SWIFT Code"
                      value={formData.bankDetails?.swiftCode || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          swiftCode: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.swiftCode}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">IBAN</label>
                    <InputField
                      type="text"
                      placeholder="IBAN"
                      value={formData.bankDetails?.iban || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          iban: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.iban}
                      shouldShowError={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">Currency</label>
                    <CurrencyDropdown
                      businessId={selectedBusiness}
                      value={formData.bankDetails?.currency}
                      onChange={(currencyData) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          currency: currencyData ? currencyData.value : "",
                        })
                      }
                      placeholder="Select Currency"
                      isDisabled={!selectedBusiness}
                      shouldShowError={false}
                      error=""
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-2">Remarks</label>
                    <InputField
                      type="text"
                      placeholder="Remarks"
                      value={formData.bankDetails?.remarks || ""}
                      onChange={(e) =>
                        handleFormChange("bankDetails", {
                          ...formData.bankDetails,
                          remarks: e.target.value,
                        })
                      }
                      error={formErrors.bankDetails?.remarks}
                      shouldShowError={true}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── System User Tab ─── */}
            {selectedTab === "System User" && (
              <div className="rounded-lg">
                <PageHeader title="System User" />

                {/* Toggle */}
                <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={addAsSystemUser}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setAddAsSystemUser(on);
                        if (on) {
                          setSystemUserForm((prev) => ({
                            ...prev,
                            name: prev.name || formData.fullName || "",
                            businessGroup: "",
                            role: "",
                            businesses: [],
                          }));
                          setSystemUserRoles([]);
                          setSystemUserBusinesses([]);
                        } else {
                          setSystemUserForm((prev) => ({
                            ...prev,
                            businessGroup: "",
                            role: "",
                            businesses: [],
                          }));
                          setSystemUserRoles([]);
                          setSystemUserBusinesses([]);
                        }
                        setSystemUserFormErrors({});
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--p-blue)]"></div>
                  </label>
                  <div>
                    <p className="font-medium text-gray-800">Add this staff as System User</p>
                    <p className="text-sm text-gray-500">Create a login account for this staff member</p>
                  </div>
                </div>

                {!addAsSystemUser && (
                  <div className="p-6 bg-gray-50 rounded-lg text-center">
                    <p className="text-gray-500">Toggle the option above to create a system user account for this staff member, or click <strong>Submit</strong> to save the staff record without a system user.</p>
                  </div>
                )}

                {addAsSystemUser && checkingExistingSystemUser && (
                  <div className="p-6 bg-gray-50 rounded-lg text-center">
                    <p className="text-gray-500">Checking if a system user already exists for this email...</p>
                    <div className="mt-3 flex justify-center">
                      <svg className="animate-spin h-6 w-6 text-[var(--p-blue)]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  </div>
                )}

                {addAsSystemUser && !checkingExistingSystemUser && existingSystemUserForEmail && (
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-medium text-green-800 mb-2">System user already exists for this email</p>
                    <p className="text-sm text-green-700 mb-4">This staff will be linked to the existing system user account. No new login will be created.</p>
                    <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg border border-green-100">
                      {existingSystemUserForEmail.image ? (
                        <img src={existingSystemUserForEmail.image} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg">
                          {(existingSystemUserForEmail.name || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800">{existingSystemUserForEmail.name}</p>
                        <p className="text-sm text-gray-600">{existingSystemUserForEmail.email}</p>
                        <p className="text-sm text-gray-500">{existingSystemUserForEmail.contact || "—"}</p>
                        {existingSystemUserForEmail.role?.name && (
                          <p className="text-xs text-gray-500 mt-1">Role: {existingSystemUserForEmail.role.name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {addAsSystemUser && !checkingExistingSystemUser && !existingSystemUserForEmail && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Auto-populated (read-only) */}
                    <div>
                      <label className="block text-gray-600 mb-2">Name (from staff profile)</label>
                      <InputField
                        type="text"
                        value={formData.fullName}
                        readOnly
                        className="bg-gray-100"
                        shouldShowError={false}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">Email (from staff profile)</label>
                      <InputField
                        type="text"
                        value={formData.email}
                        readOnly
                        className="bg-gray-100"
                        shouldShowError={false}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-2">Contact No (from staff profile)</label>
                      <InputField
                        type="text"
                        value={formData.mobileNumber}
                        readOnly
                        className="bg-gray-100"
                        shouldShowError={false}
                      />
                    </div>

                    {/* Editable display name */}
                    <div>
                      <label className="block text-gray-600 mb-2">User Name <span className="text-red-500">*</span></label>
                      <InputField
                        type="text"
                        placeholder="Enter display name"
                        value={systemUserForm.name}
                        onChange={(e) => setSystemUserForm((p) => ({ ...p, name: e.target.value }))}
                        error={systemUserFormErrors.sysName}
                        shouldShowError={true}
                      />
                    </div>

                    {/* Password - same as SystemUserForm: Auto Generate + Show/Hide eye icon */}
                    <div>
                      <div className="flex justify-between">
                        <label className="block text-gray-600 mb-2">Password <span className="text-red-500">*</span></label>
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
                          placeholder="Enter password"
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
                        >
                          {showSystemUserPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password - same eye icon as SystemUserForm */}
                    <div>
                      <label className="block text-gray-600 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <InputField
                          type={showSystemUserPassword ? "text" : "password"}
                          placeholder="Confirm password"
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

                    {/* Business Group → Role → Assigned Business (same flow as System User screen) */}
                    <div className="md:col-span-2 grid gap-6 grid-cols-1 md:grid-cols-2">
                      <div>
                        <label className="block text-gray-600 mb-2">
                          Business Group <span className="text-red-500">*</span>
                        </label>
                        <ReactSelect
                          options={businessGroups.map((bg) => ({
                            value: bg._id,
                            label: bg.companyName,
                          }))}
                          value={
                            systemUserForm.businessGroup
                              ? {
                                  value: systemUserForm.businessGroup,
                                  label:
                                    businessGroups.find(
                                      (bg) => String(bg._id) === String(systemUserForm.businessGroup)
                                    )?.companyName || "",
                                }
                              : null
                          }
                          onChange={(opt) => {
                            setSystemUserForm((p) => ({
                              ...p,
                              businessGroup: opt?.value || "",
                              role: "",
                              businesses: [],
                            }));
                            setSystemUserFormErrors((e) => ({
                              ...e,
                              sysBusinessGroup: "",
                              sysRole: "",
                              sysBusinesses: "",
                            }));
                          }}
                          placeholder="Select Business Group"
                          styles={reactSelectConfig}
                        />
                        {systemUserFormErrors.sysBusinessGroup && (
                          <p className="text-red-500 text-xs mt-1">{systemUserFormErrors.sysBusinessGroup}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-2">Role <span className="text-red-500">*</span></label>
                        <ReactSelect
                          isDisabled={!systemUserForm.businessGroup}
                          options={systemUserRoles.map((r) => ({
                            value: r._id,
                            label: r.name || r.internalName || "",
                          }))}
                          value={
                            systemUserForm.role
                              ? (() => {
                                  const r = systemUserRoles.find(
                                    (x) => String(x._id) === String(systemUserForm.role)
                                  );
                                  return {
                                    value: systemUserForm.role,
                                    label: r ? r.name || r.internalName || "" : "",
                                  };
                                })()
                              : null
                          }
                          onChange={(opt) => {
                            setSystemUserForm((p) => ({
                              ...p,
                              role: opt?.value || "",
                              businesses: [],
                            }));
                            setSystemUserFormErrors((e) => ({
                              ...e,
                              sysRole: "",
                              sysBusinesses: "",
                            }));
                          }}
                          placeholder={
                            systemUserForm.businessGroup ? "Select Role" : "Select Business Group first"
                          }
                          styles={reactSelectConfig}
                        />
                        {systemUserFormErrors.sysRole && (
                          <p className="text-red-500 text-xs mt-1">{systemUserFormErrors.sysRole}</p>
                        )}
                      </div>
                    </div>

                    {/* Assigned Businesses */}
                    {!(isSingleBusiness || systemUserBusinesses.length === 1) ? (
                    <div className="md:col-span-2">
                      <label className="block text-gray-600 mb-2">Assigned Business <span className="text-red-500">*</span></label>
                      <ReactSelect
                        isMulti
                        isDisabled={!systemUserForm.role}
                        options={systemUserBusinesses.map((b) => ({
                          value: b._id,
                          label: b.name,
                        }))}
                        value={systemUserForm.businesses.map((id) => ({
                          value: id,
                          label:
                            systemUserBusinesses.find((b) => String(b._id) === String(id))?.name || id,
                        }))}
                        onChange={(opts) =>
                          setSystemUserForm((p) => ({
                            ...p,
                            businesses: opts ? opts.map((o) => o.value) : [],
                          }))
                        }
                        placeholder={
                          systemUserForm.role ? "Select Business(es)" : "Select Role first"
                        }
                        styles={reactSelectConfig}
                      />
                      {systemUserFormErrors.sysBusinesses && (
                        <p className="text-red-500 text-xs mt-1">{systemUserFormErrors.sysBusinesses}</p>
                      )}
                    </div>
                    ) : null}

                    {/* Status */}
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
                )}
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <button
              className="px-6 py-3 bg-gray-100 rounded-lg"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>

            {/* Stepper logic: Next or Submit */}
            {selectedTab !== "System User" && (
              <button
                className="px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg flex items-center justify-center"
                onClick={() => {
                  setIsFormSubmitted(true);
                  const errors = validateForm(selectedTab);
                  setFormErrors(errors);
                  if (Object.keys(errors).length > 0) return;
                  if (selectedTab === "Personal Info")
                    setSelectedTab("Employment Details");
                  else if (selectedTab === "Employment Details")
                    setSelectedTab("Contact Information");
                  else if (selectedTab === "Contact Information")
                    setSelectedTab("Bank Details");
                  else if (selectedTab === "Bank Details")
                    setSelectedTab("System User");
                }}
                disabled={isLoading}
              >
                Next
              </button>
            )}
            {selectedTab === "System User" && (
              <button
                className="px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg flex items-center justify-center"
                onClick={addNewStaff}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            )}
          </div>

          {/* Modal for Add Staff */}
          {modalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-[400px]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-bold text-black">
                    Add Staff Member
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // prevent bubbling
                      if (
                        !selectedBusiness ||
                        selectedBusiness === "Select Business" ||
                        selectedBusiness === ""
                      ) {
                        notifyError(
                          "Please select a business before proceeding."
                        );
                        return;
                      }
                      setModalOpen(false);
                    }}
                  >
                    <X size={20} className="text-gray-500 hover:text-black" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Add staff member from system users or create a new member
                </p>
                {!isSingleBusiness && (
                <div className="col-span-2 mb-4 relative">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t("Select Business")}
                  </label>
                  <DropdownBasic
                    name="company"
                    type="select"
                    isBusinessDropdown={true}
                    businessDropdownProps={{
                      adminId: adminInfo?.id,
                      selectedBusiness: selectedBusiness,
                      onChange: (value) => setSelectedBusiness(value),
                      placeholder: t("Select Business"),
                    }}
                  />
                </div>
                )}
                {/* <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Select a System User
                  </label>
                  <DropdownBasic
                    options={filteredSystemUsers}
                    value={selectedUser._id}
                    onChange={handleSelectUser}
                    placeholder="Select a System User"
                  />
                </div> */}
                {selectedUser ? (
                  <Button
                    className="mt-4 w-full py-3 rounded-xl text-white bg-[var(--p-blue)]"
                    onClick={() => {
                      if (
                        !selectedBusiness ||
                        selectedBusiness === "Select Business" ||
                        selectedBusiness === ""
                      ) {
                        notifyError(
                          "Please select a business before proceeding."
                        );
                        return;
                      }
                      setSelectedTab("Personal Info");
                      setModalOpen(false);
                    }}
                  >
                    Select User
                  </Button>
                ) : (
                  <Button
                    className="mt-4 w-full py-2.5 bg-[var(--p-blue)] text-white rounded-xl mb-0"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent bubbling
                      if (
                        !selectedBusiness ||
                        selectedBusiness === "Select Business" ||
                        selectedBusiness === ""
                      ) {
                        notifyError(
                          "Please select a business before proceeding."
                        );
                        return;
                      }

                      setModalOpen(false);
                      setFormErrors({});
                      setFormData({ ...initialFormData });
                      setLeaveApprovalSelectors({
                        level1: { role: "", user: "" },
                        level2: { role: "", user: "" },
                        level3: { role: "", user: "" },
                      });
                      setSelectedTab("Personal Info");
                      setSelectedUser("");
                      setCurrentView("add");
                    }}
                  >
                    Create New Member
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Toast Container */}
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </div>
        </div>
      )}
    </RoutePermissionGate>
  );
}

export default StaffManagement;

// Add this component to your file
const PlacesAutocomplete = ({
  formData,
  handleFormChange,
  plainTextOnly = false,
  error,
  shouldShowError,
}) => {
  const autocompleteRef = useRef(null);

  if (plainTextOnly) {
    return (
      <InputField
        type="text"
        placeholder="Enter address manually"
        value={formData.googleLocation || ""}
        onChange={(e) => handleFormChange("googleLocation", e.target.value)}
        error={error}
        shouldShowError={shouldShowError}
      />
    );
  }

  const handlePlaceSelect = () => {
    const place = autocompleteRef.current.getPlace();

    if (!place || !place.address_components) {
      console.warn("No place details available");
      return;
    }

    console.log("place selected:", place);

    // Initialize empty values
    let address = {
      street_number: "",
      route: "",
      sublocality: "",
      locality: "",
      administrative_area_level_1: "",
      postal_code: "",
      country: "",
      unitHouseInfo: "", // added this field
    };

    // Extract address components
    place.address_components.forEach((component) => {
      const types = component.types;

      if (types.includes("street_number")) {
        address.street_number = component.long_name;
      }

      if (types.includes("route")) {
        address.route = component.long_name;
      }

      if (types.includes("subpremise") || types.includes("premise")) {
        address.unitHouseInfo = component.long_name;
      }

      if (
        types.includes("sublocality") ||
        types.includes("sublocality_level_1") ||
        types.includes("neighborhood")
      ) {
        address.sublocality = component.long_name;
      }

      if (types.includes("locality")) {
        address.locality = component.long_name;
      }

      if (types.includes("administrative_area_level_1")) {
        address.administrative_area_level_1 = component.short_name;
      }

      if (types.includes("postal_code")) {
        address.postal_code = component.long_name;
      }

      if (types.includes("country")) {
        address.country = component.long_name;
      }
    });

    console.log("Extracted address components:", address);

    // Compose streetBlock from street_number and route
    const streetBlock = [address.street_number, address.route]
      .filter(Boolean)
      .join(" ");

    // Prepare updated formData with all extracted info
    const updatedFormData = {
      ...formData,
      googleLocation: place.formatted_address || "",
      streetBlock: streetBlock || formData.streetBlock,
      unitHouseInfo: address.unitHouseInfo || formData.unitHouseInfo,
      suburb: address.sublocality || formData.suburb,
      city: address.locality || formData.city,
      state: address.administrative_area_level_1 || formData.state,
      postcode: address.postal_code || formData.postcode,
      country: address.country || formData.country,
    };

    // Batch update only changed fields
    Object.keys(updatedFormData).forEach((key) => {
      if (updatedFormData[key] !== formData[key]) {
        handleFormChange(key, updatedFormData[key]);
      }
    });
  };

  return (
    <Autocomplete
      onLoad={(autocomplete) => {
        autocompleteRef.current = autocomplete;
      }}
      onPlaceChanged={handlePlaceSelect}
      options={{
        types: ["address"],
        componentRestrictions: { country: [] },
        fields: ["address_components", "formatted_address", "geometry", "name"],
      }}
    >
      <InputField
        type="text"
        placeholder="Enter address to autofill fields"
        className="w-full p-3 bg-gray-100 rounded-lg focus:outline-none"
        value={formData.googleLocation}
        onChange={(e) => handleFormChange("googleLocation", e.target.value)}
        error={error}
        shouldShowError={shouldShowError}
      />
    </Autocomplete>
  );
};
