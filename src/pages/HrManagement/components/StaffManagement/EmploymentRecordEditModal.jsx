import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
} from "react";
import axios from "axios";
import { X, ChevronDown } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { CustomDatePicker, InputField } from "@/page-layouts/index";
import ReactSelect from "react-select";
import reactSelectConfig from "@/utils/react-select-style-config";
import {
  branchIdsFromStaffRef,
} from "@/utils/staffBranchLocationsForm";
import BranchLocationSelectWithAdd from "@/components/hr/BranchLocationSelectWithAdd";
import PositionSelectWithAdd from "@/components/hr/PositionSelectWithAdd";
import DepartmentSelectWithAdd from "@/components/hr/DepartmentSelectWithAdd";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";
import SingleBusinessField from "@/components/SingleBusinessField";

const EMPTY_APPROVAL_SELECTORS = {
  level1: { role: "", user: "" },
  level2: { role: "", user: "" },
  level3: { role: "", user: "" },
};

const EmploymentRecordEditModal = ({
  isOpen,
  onClose,
  recordData,
  staffId,
  onRecordUpdated,
}) => {
  const [formData, setFormData] = useState({
    business: "",
    department: "",
    position: "",
    leaveGroup: "",
    claimGroup: "",
    joiningDate: "",
    shift: "",
    reasonForLeaving: "",
    branchLocations: [],
    workPassType: "", // Added
    visaExpiryDate: "", // Added
    uniformSize: "", // Added
    employmentType: "", // Added
    probationStartDate: "", // Added
    probationEndDate: "", // Added
    confirmationDate: "", // Added
    isAttendanceAllowed: true,
    claimApprovalLevel: 1,
    leaveApprovalLevel: 1, // Default value for leave approval level
    blockedLeaveTypes: [], // Array of leave type IDs to block
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [BranchLocations, setBranchLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveGroups, setLeaveGroups] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [claimGroups, setClaimGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [positions, setPositions] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [validationErrors, setValidationErrors] = useState({}); // New state for validation errors
  const [roles, setRoles] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [workPassTypes, setWorkPassTypes] = useState([]);
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
  const [assignedBusinesses, setAssignedBusinesses] = useState([]);

  const activeBusinessId = formData.business?._id
    ? String(formData.business._id)
    : "";

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token || ""}`,
    }),
    [adminInfo]
  );
  const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

  console.log("record data", recordData);
  console.log("leave groups", leaveGroups);
  console.log("claim groups", claimGroups);
  console.log("branch location", BranchLocations);

  const fetchBranchLocations = useCallback(
    async (businessId) => {
      if (!businessId) {
        setBranchLocations([]);
        return [];
      }
      try {
        const response = await axios.post(
          `${Base_URL}/branches/get_all`,
          {
            business_id: businessId,
            FilterStatus: "",
            FilterName: "",
            includePrivateForStaff: true,
            staff_id: staffId || "",
          },
          { headers }
        );
        const data = response.data.data || [];
        setBranchLocations(data);
        return data;
      } catch (error) {
        console.error("Error fetching BranchLocations:", error);
        setBranchLocations([]);
        return [];
      }
    },
    [Base_URL, headers, staffId]
  );

  const fetchLeaveGroups = useCallback(
    async (businessId) => {
      if (!businessId) {
        setLeaveGroups([]);
        return [];
      }
      try {
        const response = await axios.post(
          `${Base_URL}/LeaveGroups/get_all`,
          {
            business_id: businessId,
            FilterStatus: "",
            FilterName: "",
          },
          { headers }
        );
        const data = response.data.data || [];
        setLeaveGroups(data);
        return data;
      } catch (error) {
        console.error("Error fetching leave groups:", error);
        setLeaveGroups([]);
        return [];
      }
    },
    [Base_URL, headers]
  );

  const fetchLeaveTypes = async (
    businessId,
    leaveGroupId,
    groupsList = null
  ) => {
    if (!businessId || !leaveGroupId) {
      setLeaveTypes([]);
      return;
    }

    try {
      // Use provided groupsList or fallback to state
      const groupsToUse = groupsList || leaveGroups;

      // Find the leave group name from the leaveGroups array
      const selectedLeaveGroup = groupsToUse.find(
        (group) => group._id === leaveGroupId
      );

      if (!selectedLeaveGroup) {
        setLeaveTypes([]);
        return;
      }

      const params = {
        bid: businessId,
        leaveGroup: selectedLeaveGroup.name,
      };

      const response = await axios.get(`${Base_URL}/leaveTypes`, {
        params,
        headers,
      });

      setLeaveTypes(response.data || []);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      setLeaveTypes([]);
    }
  };

  const fetchClaimGroups = useCallback(
    async (businessId) => {
      if (!businessId) {
        setClaimGroups([]);
        return [];
      }
      try {
        const response = await axios.get(`${Base_URL}/claim-groups`, {
          params: { bid: businessId, FilterStatus: "", FilterName: "" },
          headers,
        });
        const data = response.data || [];
        setClaimGroups(data);
        return data;
      } catch (error) {
        console.error("Error fetching claim groups:", error);
        setClaimGroups([]);
        return [];
      }
    },
    [Base_URL, headers]
  );

  const fetchDepartments = useCallback(
    async (businessId) => {
      if (!businessId) {
        setDepartments([]);
        return [];
      }
      try {
        const response = await axios.post(
          `${Base_URL}/Departments/get_all`,
          {
            business_id: businessId,
            FilterStatus: "",
            FilterName: "",
            includePrivateForStaff: true,
            staff_id: staffId || "",
          },
          { headers }
        );
        const data = response.data.data || [];
        setDepartments(data);
        return data;
      } catch (err) {
        console.log("Failed to fetch departments");
        setDepartments([]);
        return [];
      }
    },
    [Base_URL, headers, staffId]
  );

  const fetchPositions = useCallback(
    async (businessId) => {
      if (!businessId) {
        setPositions([]);
        return [];
      }
      try {
        const response = await axios.post(
          `${Base_URL}/Positions/get_all`,
          {
            business_id: businessId,
            FilterStatus: "",
            FilterName: "",
            includePrivateForStaff: true,
            staff_id: staffId || "",
          },
          { headers }
        );
        const data = response.data.data || [];
        setPositions(data);
        return data;
      } catch (err) {
        console.log("Failed to fetch positions");
        setPositions([]);
        return [];
      }
    },
    [Base_URL, headers, staffId]
  );

  const fetchShifts = useCallback(
    async (businessId) => {
      if (!businessId) {
        setShifts([]);
        return [];
      }
      try {
        const response = await axios.post(
          `${Base_URL}/shifts/get_all`,
          {
            business_id: businessId,
            FilterStatus: "",
            FilterName: "",
          },
          { headers }
        );
        const data = response.data.data || [];
        setShifts(data);
        return data;
      } catch (err) {
        console.log("Failed to fetch shifts");
        setShifts([]);
        return [];
      }
    },
    [Base_URL, headers]
  );

  const fetchRoles = useCallback(
    async (businessId) => {
      if (!businessId) {
        setRoles([]);
        return;
      }
      setRoles([]);
      try {
        const response = await axios.post(
          `${Base_URL}/UserRoles/get_all`,
          { FilterStatus: "", FilterName: "", page: 1, limit: 1000 },
          { headers }
        );
        const all = response.data.data || [];
        const filtered = all.filter((role) =>
          role.assignedBusinesses?.some(
            (b) => String(b._id) === String(businessId)
          )
        );
        setRoles(filtered);
      } catch (err) {
        console.log("Failed to fetch roles");
        setRoles([]);
      }
    },
    [headers]
  );

  const fetchSystemUsers = useCallback(async () => {
    try {
      const response = await axios.post(
        `${Base_URL}/SystemUsers/get_all`,
        { FilterStatus: "", FilterName: "", page: 1, limit: 1000 },
        { headers }
      );
      setSystemUsers(response.data.data || []);
    } catch (err) {
      console.log("Failed to fetch system users");
      setSystemUsers([]);
    }
  }, [Base_URL, headers]);

  const fetchWorkPassTypes = useCallback(
    async (businessId) => {
      if (!businessId) {
        setWorkPassTypes([]);
        return;
      }
      try {
        const response = await axios.get(
          `${Base_URL}/work-pass-types/get?business=${businessId}`,
          { headers }
        );
        setWorkPassTypes(response.data.data || []);
      } catch (err) {
        console.log("Failed to fetch work pass types");
        setWorkPassTypes([]);
      }
    },
    [Base_URL, headers]
  );

  const refetchAllBusinessData = useCallback(
    async (businessId) => {
      if (!businessId) return;
      setIsLoading(true);
      try {
        await Promise.all([
          fetchBranchLocations(businessId),
          fetchDepartments(businessId),
          fetchLeaveGroups(businessId),
          fetchClaimGroups(businessId),
          fetchPositions(businessId),
          fetchShifts(businessId),
          fetchRoles(businessId),
          fetchWorkPassTypes(businessId),
          fetchSystemUsers(),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      fetchBranchLocations,
      fetchDepartments,
      fetchLeaveGroups,
      fetchClaimGroups,
      fetchPositions,
      fetchShifts,
      fetchRoles,
      fetchWorkPassTypes,
      fetchSystemUsers,
    ]
  );

  const clearBusinessScopedFormFields = useCallback(() => ({
    department: "",
    position: "",
    shift: "",
    leaveGroup: "",
    claimGroup: "",
    branchLocations: [],
    workPassType: "",
    blockedLeaveTypes: [],
    leaveApprovalLevel: 1,
    claimApprovalLevel: 1,
  }), []);

  const handleBusinessChange = useCallback(
    (businessId) => {
      if (!businessId) return;
      const nextId = String(businessId);
      if (nextId === activeBusinessId) return;

      const match = assignedBusinesses.find((b) => String(b._id) === nextId);
      const business = match
        ? { _id: match._id, name: match.name }
        : { _id: businessId, name: "" };

      setFormData((prev) => ({
        ...prev,
        business,
        ...clearBusinessScopedFormFields(),
      }));
      setLeaveTypes([]);
      setLeaveApprovalSelectors({ ...EMPTY_APPROVAL_SELECTORS });
      setClaimApprovalSelectors({ ...EMPTY_APPROVAL_SELECTORS });
      refetchAllBusinessData(nextId);
    },
    [
      activeBusinessId,
      assignedBusinesses,
      clearBusinessScopedFormFields,
      refetchAllBusinessData,
    ]
  );

  useEffect(() => {
    if (!isOpen || !adminInfo?.id) return;
    axios
      .get(`${Base_URL}/admin/assigned/${adminInfo.id}`, { headers })
      .then((res) => setAssignedBusinesses(res.data?.businesses || []))
      .catch(() => setAssignedBusinesses([]));
  }, [isOpen, adminInfo?.id, Base_URL, headers]);

  console.log("record data", recordData);

  useEffect(() => {
    if (!isOpen) return;

    if (recordData) {
      // Format dates for date inputs (yyyy-MM-dd)
      const formattedStartDate = recordData.joiningDate
        ? new Date(recordData.joiningDate).setHours(0, 0, 0, 0)
        : "";

      const formattedEndDate = recordData.endDate
        ? new Date(recordData.endDate).setHours(0, 0, 0, 0)
        : "";

      setFormData({
        business: recordData.business || "",
        department: recordData.department?._id || "",
        position: recordData.position?._id || "",
        branchLocations: branchIdsFromStaffRef(recordData.branchLocations),
        shift: recordData.shift?._id || "",
        leaveGroup: recordData.leaveGroup?._id || "",
        claimGroup: recordData.claimGroup?._id || "",
        joiningDate: formattedStartDate,
        endDate: formattedEndDate,
        workPassType: recordData?.workPassType || "",
        reasonForLeaving: recordData?.reasonForLeaving || "",
        visaExpiryDate: recordData?.visaExpiryDate
          ? new Date(recordData.visaExpiryDate).setHours(0, 0, 0, 0)
          : "", // Ensure Date object
        uniformSize: recordData?.uniformSize || "",
        employmentType: recordData?.employmentType || "",
        probationStartDate: recordData?.probationStartDate
          ? new Date(recordData.probationStartDate).setHours(0, 0, 0, 0)
          : "", // Ensure Date object
        probationEndDate: recordData?.probationEndDate
          ? new Date(recordData.probationEndDate).setHours(0, 0, 0, 0)
          : "", // Ensure Date object
        confirmationDate: recordData?.confirmationDate
          ? new Date(recordData.confirmationDate).setHours(0, 0, 0, 0)
          : "", // Ensure Date object
        isAttendanceAllowed: recordData?.isAttendanceAllowed !== false,
        claimApprovalLevel: recordData.claimApprovalLevel || 1,
        leaveApprovalLevel: recordData.leaveApprovalLevel || 1,
        blockedLeaveTypes: recordData?.blockedLeaveTypes
          ? recordData.blockedLeaveTypes.map((lt) =>
              typeof lt === "string" ? lt : lt._id
            )
          : [],
      });

      // Initialize leave approval selectors from existing data
      if (
        recordData.leaveApprovalLevels &&
        Array.isArray(recordData.leaveApprovalLevels)
      ) {
        const initialSelectors = {
          level1: { role: "", user: "" },
          level2: { role: "", user: "" },
          level3: { role: "", user: "" },
        };

        recordData.leaveApprovalLevels.forEach((levelData) => {
          const levelKey = `level${levelData.level}`;
          if (initialSelectors[levelKey]) {
            // Role is now stored as name (string), not ID
            const roleName = levelData.role?.name || levelData.role || "";
            initialSelectors[levelKey] = {
              role: roleName,
              user: levelData.user?._id || levelData.user || "",
            };
          }
        });

        setLeaveApprovalSelectors(initialSelectors);
      } else {
        // Reset to default if no data exists
        setLeaveApprovalSelectors({
          level1: { role: "", user: "" },
          level2: { role: "", user: "" },
          level3: { role: "", user: "" },
        });
      }

      if (
        recordData.claimApprovalLevels &&
        Array.isArray(recordData.claimApprovalLevels)
      ) {
        const initialClaimSelectors = {
          level1: { role: "", user: "" },
          level2: { role: "", user: "" },
          level3: { role: "", user: "" },
        };
        recordData.claimApprovalLevels.forEach((levelData) => {
          const levelKey = `level${levelData.level}`;
          if (initialClaimSelectors[levelKey]) {
            const roleName = levelData.role?.name || levelData.role || "";
            initialClaimSelectors[levelKey] = {
              role: roleName,
              user: levelData.user?._id || levelData.user || "",
            };
          }
        });
        setClaimApprovalSelectors(initialClaimSelectors);
      } else {
        setClaimApprovalSelectors({
          level1: { role: "", user: "" },
          level2: { role: "", user: "" },
          level3: { role: "", user: "" },
        });
      }

      const bizId = recordData.business?._id
        ? String(recordData.business._id)
        : "";
      if (bizId) {
        refetchAllBusinessData(bizId);
      }
    } else {
      setFormData({
        business: "",
        department: "",
        position: "",
        leaveGroup: "",
        claimGroup: "",
        joiningDate: "",
        shift: "",
        reasonForLeaving: "",
        branchLocations: [],
        workPassType: "",
        visaExpiryDate: "",
        uniformSize: "",
        employmentType: "",
        probationStartDate: "",
        probationEndDate: "",
        confirmationDate: "",
        isAttendanceAllowed: true,
        claimApprovalLevel: 1,
        leaveApprovalLevel: 1,
        blockedLeaveTypes: [],
      });
      setLeaveTypes([]);
      setLeaveApprovalSelectors({ ...EMPTY_APPROVAL_SELECTORS });
      setClaimApprovalSelectors({ ...EMPTY_APPROVAL_SELECTORS });
    }
  }, [recordData, refetchAllBusinessData, isOpen]);

  // Fetch leave types when leave group is selected and leave groups are loaded
  useEffect(() => {
    if (formData.leaveGroup && activeBusinessId && leaveGroups.length > 0) {
      fetchLeaveTypes(activeBusinessId, formData.leaveGroup, leaveGroups);
    } else if (!formData.leaveGroup) {
      setLeaveTypes([]);
    }
  }, [formData.leaveGroup, activeBusinessId, leaveGroups]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error for the field as user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: null }));
    }
    // If leaveApprovalLevel changes, reset selectors for levels beyond the new level
    if (name === "leaveApprovalLevel") {
      const newLevel = parseInt(value) || 0;
      setLeaveApprovalSelectors((prev) => {
        const updated = { ...prev };
        if (newLevel < 3) updated.level3 = { role: "", user: "" };
        if (newLevel < 2) updated.level2 = { role: "", user: "" };
        if (newLevel < 1) updated.level1 = { role: "", user: "" };
        return updated;
      });
    }
    if (name === "claimApprovalLevel") {
      const newLevel = parseInt(value) || 0;
      setClaimApprovalSelectors((prev) => {
        const updated = { ...prev };
        if (newLevel < 3) updated.level3 = { role: "", user: "" };
        if (newLevel < 2) updated.level2 = { role: "", user: "" };
        if (newLevel < 1) updated.level1 = { role: "", user: "" };
        return updated;
      });
    }
    // If leaveGroup changes, fetch leave types for that group (if leaveGroups are loaded)
    if (name === "leaveGroup" && value && activeBusinessId && leaveGroups.length > 0) {
      fetchLeaveTypes(activeBusinessId, value, leaveGroups);
      // Reset blocked leave types when leave group changes
      setFormData((prev) => ({ ...prev, blockedLeaveTypes: [] }));
    } else if (name === "leaveGroup" && !value) {
      setLeaveTypes([]);
      setFormData((prev) => ({ ...prev, blockedLeaveTypes: [] }));
    }
  };

  const handleBlockedLeaveTypeToggle = (leaveTypeId) => {
    setFormData((prev) => {
      const currentBlocked = prev.blockedLeaveTypes || [];
      const isBlocked = currentBlocked.includes(leaveTypeId);

      if (isBlocked) {
        // Remove from blocked list
        return {
          ...prev,
          blockedLeaveTypes: currentBlocked.filter((id) => id !== leaveTypeId),
        };
      } else {
        // Add to blocked list
        return {
          ...prev,
          blockedLeaveTypes: [...currentBlocked, leaveTypeId],
        };
      }
    });
  };

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
      if (validationErrors[errorKey]) {
        setValidationErrors((prev) => ({ ...prev, [errorKey]: null }));
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
      if (validationErrors[errorKey]) {
        setValidationErrors((prev) => ({ ...prev, [errorKey]: null }));
      }
    }
  };

  // Filter system users based on selected role for a specific level
  const getFilteredSystemUsers = (level) => {
    const levelKey = `level${level}`;
    const selectedRoleName = leaveApprovalSelectors[levelKey]?.role;

    if (!selectedRoleName) {
      // If no role is selected, show all system users
      return systemUsers;
    }

    // Filter system users by the selected role name
    return systemUsers.filter((user) => {
      if (!user.role) return false;

      // Compare role names (selectedRoleName is now a role name string, not ID)
      const userRoleName = user.role?.name || user.role;
      return (
        userRoleName && selectedRoleName && userRoleName === selectedRoleName
      );
    });
  };

  const getFilteredClaimSystemUsers = (level) => {
    const levelKey = `level${level}`;
    const selectedRoleName = claimApprovalSelectors[levelKey]?.role;

    if (!selectedRoleName) {
      return systemUsers;
    }

    return systemUsers.filter((user) => {
      if (!user.role) return false;
      const userRoleName = user.role?.name || user.role;
      return (
        userRoleName && selectedRoleName && userRoleName === selectedRoleName
      );
    });
  };

  const validateFormFields = useCallback(() => {
    const errors = {};

    if (!formData.business?._id) {
      errors.business = "Company is required";
    }

    // Validate fields present in EmploymentRecordEditModal based on your criteria
    if (
      !formData.branchLocations ||
      !Array.isArray(formData.branchLocations) ||
      formData.branchLocations.length === 0
    ) {
      errors.branchLocations = "Select at least one branch / location";
    }
    if (!formData.department) {
      errors.department = "Department is required";
    }
    if (!formData.position) {
      errors.position = "Position is required";
    }
    if (!formData.shift) {
      errors.shift = "Shift is required";
    }
    if (!formData.joiningDate) {
      errors.joiningDate = "Joining date is required";
    }
    if (!formData.probationStartDate) {
      errors.probationStartDate = "Probation start date is required";
    }

    if (!formData.probationEndDate) {
      errors.probationEndDate = "Probation end date is required";
    } else if (
      formData.probationStartDate &&
      new Date(formData.probationEndDate).setHours(0, 0, 0, 0) <
        new Date(formData.probationStartDate).setHours(0, 0, 0, 0)
    ) {
      errors.probationEndDate =
        "Probation end date cannot be before start date";
    }
    if (!formData.confirmationDate) {
      errors.confirmationDate = "Confirmation date is required";
    }
    if (!formData.employmentType) {
      errors.employmentType = "Employment type is required";
    }

    // Corrected Visa Expiry Date validation
    if (formData.visaExpiryDate) {
      // Only validate if a date is selected
      if (
        formData.joiningDate &&
        new Date(formData.visaExpiryDate).setHours(0, 0, 0, 0) <
          new Date(formData.joiningDate).setHours(0, 0, 0, 0)
      ) {
        errors.visaExpiryDate =
          "Visa expiry date cannot be before joining date";
      }
    }

    // Removed reasonForLeaving as it's commented out in JSX

    return errors;
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous API errors

    const errors = validateFormFields();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return; // Stop form submission if there are validation errors
    }

    setIsSubmitting(true);
    setValidationErrors({}); // Clear validation errors if validation passes

    try {
      let url;
      let method;
      // Build leave approval levels data - only include levels with roles (role is required)
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
      const claimCap = parseInt(formData.claimApprovalLevel) || 0;
      for (let i = 1; i <= claimCap; i++) {
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

      let dataToSend = {
        business: formData.business?._id || formData.business,
        department: formData.department,
        position: formData.position,
        shift: formData.shift,
        leaveGroup: formData.leaveGroup || "",
        claimGroup: formData.claimGroup || "",
        joiningDate: formData.joiningDate,
        reasonForLeaving: formData.reasonForLeaving,
        branchLocations: formData.branchLocations,
        workPassType: formData?.workPassType || "",
        visaExpiryDate: formData.visaExpiryDate,
        uniformSize: formData.uniformSize,
        employmentType: formData.employmentType,
        probationStartDate: formData.probationStartDate || "",
        probationEndDate: formData.probationEndDate || "",
        confirmationDate: formData.confirmationDate || "",
        isAttendanceAllowed: formData.isAttendanceAllowed !== false,
        claimApprovalLevel: formData.claimApprovalLevel || "",
        claimApprovalLevels,
        leaveApprovalLevel: formData.leaveApprovalLevel || "",
        leaveApprovalLevels: leaveApprovalLevels, // Array of { level, role, user }
        blockedLeaveTypes: formData.blockedLeaveTypes || [], // Array of leave type IDs to block
      };

      if (recordData && recordData._id) {
        // Update existing record
        url = `${Base_URL}/staff-management/${staffId}`;
        method = "put";
      } else {
        // Create new record
        url = `${Base_URL}/staff-management/${staffId}/employment-records`;
        method = "post";
      }

      const response = await axios[method](url, dataToSend);

      setIsSubmitting(false);
      onRecordUpdated(response.data);
      onClose();
    } catch (err) {
      console.error("Error updating employment record:", err);
      setError("Failed to save employment record. Please try again.");
      setIsSubmitting(false);
    }
  };

  const getApprovalLevelText = (level) => {
    return `${level} Level${level > 1 ? "s" : ""}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 pt-6 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            {recordData && recordData._id
              ? "Edit Employment Record"
              : "Add Employment Record"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Basic Information Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SingleBusinessField
                className="space-y-2 col-span-3"
                selectedValue={activeBusinessId}
                onAutoSelect={handleBusinessChange}
              >
                <label className="block text-sm font-medium text-gray-700">
                  Company <span className="text-red-500">*</span>
                </label>
                <BusinessDropdown
                  adminId={adminInfo?.id}
                  selectedBusiness={activeBusinessId}
                  onChange={handleBusinessChange}
                  isClearable={false}
                  placeholder="Select Business"
                />
                {validationErrors.business && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.business}
                  </p>
                )}
              </SingleBusinessField>

              {/* Position field - currently commented out in original JSX, re-add if needed */}
              {/* <div className="space-y-2">
              <label className="block text-sm text-gray-600">Position</label>
              <div className="relative">
                <select
                  className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                >
                  <option value="">Position</option>
                  {positions?.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
                {validationErrors.position && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.position}
                  </p>
                )}
              </div>
            </div> */}
            </div>
          </div>

          {/* Leave Configuration */}
          <div className="mb-8 rounded-lg border border-gray-200 p-5 space-y-6">
            <h3 className="text-base font-semibold text-gray-900">
              Leave Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leave Group
                </label>
                <div className="relative">
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                      validationErrors.leaveGroup
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white"
                    }`}
                    name="leaveGroup"
                    value={formData.leaveGroup}
                    onChange={handleChange}
                  >
                    <option value="">Select Leave Group</option>
                    {leaveGroups?.map((item) => (
                      <option key={item?._id} value={item?._id}>
                        {item?.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={16}
                  />
                  {validationErrors.leaveGroup && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.leaveGroup}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leave Approval Level
                </label>
                <div className="relative">
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                      validationErrors.leaveApprovalLevel
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white"
                    }`}
                    name="leaveApprovalLevel"
                    value={formData.leaveApprovalLevel}
                    onChange={handleChange}
                  >
                    <option value="">Select Level</option>
                    {[1, 2, 3].map((level) => (
                      <option key={level} value={level}>
                        {getApprovalLevelText(level)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={16}
                  />
                  {validationErrors.leaveApprovalLevel && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.leaveApprovalLevel}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-800">Leave types</h4>

              {formData.leaveGroup && leaveTypes.length > 0 && (
                <p className="text-sm text-gray-600">
                  Uncheck a leave type to{" "}
                  <span className="font-medium text-red-600">block</span> it for
                  this staff. Checked types remain{" "}
                  <span className="font-medium text-green-700">available</span>.
                </p>
              )}

              {formData.leaveGroup && leaveTypes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {leaveTypes.map((leaveType) => {
                    const isBlocked =
                      formData.blockedLeaveTypes?.includes(leaveType._id) ||
                      false;
                    return (
                      <label
                        key={leaveType._id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                          isBlocked
                            ? "border-red-200 bg-red-50/40"
                            : "border-green-200 bg-green-50/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!isBlocked}
                          onChange={() =>
                            handleBlockedLeaveTypeToggle(leaveType._id)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                        />
                        <span
                          className={`text-sm font-medium flex-1 min-w-0 truncate ${
                            isBlocked
                              ? "text-red-700 line-through"
                              : "text-gray-800"
                          }`}
                        >
                          {leaveType.name}
                        </span>
                        <span
                          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                            isBlocked
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {isBlocked ? "Blocked" : "Active"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {formData.leaveGroup && leaveTypes.length === 0 && !isLoading && (
                <p className="text-sm text-gray-500 py-3 text-center border border-dashed border-gray-200 rounded-md">
                  No leave types found for this group
                </p>
              )}

              {!formData.leaveGroup && (
                <p className="text-sm text-gray-500">
                  Select a leave group to configure leave types.
                </p>
              )}
            </div>

            {formData.leaveApprovalLevel && (
              <div className="pt-5 border-t border-gray-200">
                <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4 space-y-5">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Approval workflow
                  </h4>
                  {Array.from(
                    { length: parseInt(formData.leaveApprovalLevel) || 0 },
                    (_, i) => {
                      const level = i + 1;
                      const levelKey = `level${level}`;
                      const selectorData = leaveApprovalSelectors[levelKey] || {
                        role: "",
                        user: "",
                      };

                      return (
                        <div
                          key={level}
                          className={
                            i > 0
                              ? "pt-5 border-t border-gray-200 space-y-3"
                              : "space-y-3"
                          }
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Level {level}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role
                              </label>
                              <div className="relative">
                                <select
                                  className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                                    validationErrors[
                                      `leaveApprovalLevel${level}Role`
                                    ]
                                      ? "border-red-300 bg-red-50"
                                      : "border-gray-300 bg-white"
                                  }`}
                                  value={selectorData.role}
                                  onChange={(e) =>
                                    handleLeaveApprovalSelectorChange(
                                      level,
                                      "role",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">Select Role</option>
                                  {roles?.map((role) => (
                                    <option key={role._id} value={role.name}>
                                      {role.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                  size={16}
                                />
                                {validationErrors[
                                  `leaveApprovalLevel${level}Role`
                                ] && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {
                                      validationErrors[
                                        `leaveApprovalLevel${level}Role`
                                      ]
                                    }
                                  </p>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                System User{" "}
                                <span className="text-gray-400 font-normal">
                                  (optional)
                                </span>
                              </label>
                              <div className="relative">
                                <select
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                  value={selectorData.user}
                                  onChange={(e) =>
                                    handleLeaveApprovalSelectorChange(
                                      level,
                                      "user",
                                      e.target.value,
                                    )
                                  }
                                  disabled={!selectorData.role}
                                >
                                  <option value="">
                                    {selectorData.role
                                      ? "Select System User"
                                      : "Select a role first"}
                                  </option>
                                  {getFilteredSystemUsers(level)?.map((user) => (
                                    <option key={user._id} value={user._id}>
                                      {user.name}
                                      {user.last_name ? ` ${user.last_name}` : ""}{" "}
                                      ({user.email})
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                  size={16}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Claim Configuration */}
          <div className="mb-8 rounded-lg border border-gray-200 p-5 space-y-6">
            <h3 className="text-base font-semibold text-gray-900">
              Claim Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Claim Group
                </label>
                <div className="relative">
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                      validationErrors.claimGroup
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white"
                    }`}
                    name="claimGroup"
                    value={formData.claimGroup}
                    onChange={handleChange}
                  >
                    <option value="">Select Claim Group</option>
                    {claimGroups?.map((item) => (
                      <option key={item?._id} value={item?._id}>
                        {item?.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={16}
                  />
                  {validationErrors.claimGroup && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.claimGroup}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Claim Approval Level
                </label>
                <div className="relative">
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                      validationErrors.claimApprovalLevel
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white"
                    }`}
                    name="claimApprovalLevel"
                    value={formData.claimApprovalLevel}
                    onChange={handleChange}
                  >
                    <option value="">Select Level</option>
                    {[1, 2, 3].map((level) => (
                      <option key={level} value={level}>
                        {getApprovalLevelText(level)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={16}
                  />
                  {validationErrors.claimApprovalLevel && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.claimApprovalLevel}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {formData.claimApprovalLevel && (
              <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4 space-y-5">
                <h4 className="text-sm font-semibold text-gray-800">
                  Approval workflow
                </h4>
                {Array.from(
                  { length: parseInt(formData.claimApprovalLevel) || 0 },
                  (_, i) => {
                    const level = i + 1;
                    const levelKey = `level${level}`;
                    const selectorData = claimApprovalSelectors[levelKey] || {
                      role: "",
                      user: "",
                    };

                    return (
                      <div
                        key={level}
                        className={
                          i > 0 ? "pt-5 border-t border-gray-200 space-y-3" : "space-y-3"
                        }
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Level {level}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Role
                            </label>
                            <div className="relative">
                              <select
                                className={`w-full px-3 py-2 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
                                  validationErrors[`claimApprovalLevel${level}Role`]
                                    ? "border-red-300 bg-red-50"
                                    : "border-gray-300 bg-white"
                                }`}
                                value={selectorData.role}
                                onChange={(e) =>
                                  handleClaimApprovalSelectorChange(
                                    level,
                                    "role",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">Select Role</option>
                                {roles?.map((role) => (
                                  <option key={role._id} value={role.name}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                size={16}
                              />
                              {validationErrors[`claimApprovalLevel${level}Role`] && (
                                <p className="text-red-500 text-xs mt-1">
                                  {validationErrors[`claimApprovalLevel${level}Role`]}
                                </p>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              System User{" "}
                              <span className="text-gray-400 font-normal">
                                (optional)
                              </span>
                            </label>
                            <div className="relative">
                              <select
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                value={selectorData.user}
                                onChange={(e) =>
                                  handleClaimApprovalSelectorChange(
                                    level,
                                    "user",
                                    e.target.value,
                                  )
                                }
                                disabled={!selectorData.role}
                              >
                                <option value="">
                                  {selectorData.role
                                    ? "Select System User"
                                    : "Select a role first"}
                                </option>
                                {getFilteredClaimSystemUsers(level)?.map(
                                  (user) => (
                                    <option key={user._id} value={user._id}>
                                      {user.name}
                                      {user.last_name ? ` ${user.last_name}` : ""} (
                                      {user.email})
                                    </option>
                                  ),
                                )}
                              </select>
                              <ChevronDown
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                size={16}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* Employment Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Employment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker
                  type="date"
                  name="joiningDate"
                  bgColor="#F3F4F6"
                  value={formData.joiningDate}
                  onChange={(date) => {
                    setFormData({ ...formData, joiningDate: date });
                    // Clear error on change
                    if (validationErrors.joiningDate) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        joiningDate: null,
                      }));
                    }
                  }}
                  className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                />
                {validationErrors.joiningDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.joiningDate}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 lg:col-span-2">
                <BranchLocationSelectWithAdd
                  businessId={activeBusinessId}
                  privateStaffId={staffId}
                  allowPrivateForStaff
                  value={formData.branchLocations}
                  onChange={(ids) => {
                    setFormData((prev) => ({
                      ...prev,
                      branchLocations: ids,
                    }));
                    if (validationErrors.branchLocations) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        branchLocations: null,
                      }));
                    }
                  }}
                  branches={BranchLocations}
                  onBranchesRefetch={() => fetchBranchLocations(activeBusinessId)}
                  error={validationErrors.branchLocations}
                  label="Branch Location"
                  labelClassName="block text-sm font-medium text-gray-700"
                  errorClassName="text-red-500 text-xs mt-1.5"
                  required
                  idleBorderColor="#d1d5db"
                  controlMinHeight="42px"
                  overlayClassName="z-[70]"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                <DepartmentSelectWithAdd
                  businessId={activeBusinessId}
                  privateStaffId={staffId}
                  allowPrivateForStaff
                  value={formData.department}
                  onChange={(id) => {
                    setFormData((prev) => ({ ...prev, department: id }));
                    if (validationErrors.department) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        department: null,
                      }));
                    }
                  }}
                  departments={departments}
                  onDepartmentsRefetch={() => fetchDepartments(activeBusinessId)}
                  error={validationErrors.department}
                  label="Department"
                  labelClassName="block text-sm font-medium text-gray-700"
                  errorClassName="text-red-500 text-xs mt-1.5"
                  required
                  idleBorderColor="#d1d5db"
                  controlMinHeight="42px"
                  overlayClassName="z-[70]"
                />

                <PositionSelectWithAdd
                  businessId={activeBusinessId}
                  privateStaffId={staffId}
                  allowPrivateForStaff
                  value={formData.position}
                  onChange={(id) => {
                    setFormData((prev) => ({ ...prev, position: id }));
                    if (validationErrors.position) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        position: null,
                      }));
                    }
                  }}
                  positions={positions}
                  onPositionsRefetch={() => fetchPositions(activeBusinessId)}
                  error={validationErrors.position}
                  label="Position"
                  labelClassName="block text-sm font-medium text-gray-700"
                  errorClassName="text-red-500 text-xs mt-1.5"
                  required
                  idleBorderColor="#d1d5db"
                  controlMinHeight="42px"
                  overlayClassName="z-[70]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Shift <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className={`w-full p-3 bg-white rounded-lg border appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all ${
                      validationErrors.shift
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    name="shift"
                    value={formData.shift}
                    onChange={handleChange}
                  >
                    <option value="">Select Shift</option>
                    {shifts?.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={18}
                  />
                  {validationErrors.shift && (
                    <p className="text-red-500 text-xs mt-1.5">
                      {validationErrors.shift}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Attendance status
                </label>
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300">
                  <input
                    type="checkbox"
                    id="isAttendanceAllowed"
                    name="isAttendanceAllowed"
                    checked={formData.isAttendanceAllowed !== false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isAttendanceAllowed: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--p-blue)] focus:ring-[var(--p-blue)]"
                  />
                  <label
                    htmlFor="isAttendanceAllowed"
                    className="text-sm text-gray-700 cursor-pointer select-none whitespace-nowrap"
                  >
                    {formData.isAttendanceAllowed !== false
                      ? "Allowed"
                      : "Not allowed"}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Employment Type
                </label>
                <div className="relative">
                  <select
                    className={`w-full p-3 bg-white rounded-lg border appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all ${
                      validationErrors.employmentType
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleChange}
                  >
                    <option value="">Select Employment Type</option>
                    {[
                      { label: "Full-time", value: "Full-time" },
                      { label: "Part-time", value: "Part-time" },
                      { label: "Intern", value: "Intern" },
                      { label: "Contract", value: "Contract" },
                      { label: "Freelancer", value: "Freelancer" },
                    ].map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={18}
                  />
                  {validationErrors.employmentType && (
                    <p className="text-red-500 text-xs mt-1.5">
                      {validationErrors.employmentType}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-600">
                  Work Pass Type
                </label>
                <div className="relative">
                  <select
                    className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    name="workPassType" // Added name attribute
                    value={formData.workPassType}
                    onChange={handleChange} // Use general handleChange
                  >
                    <option value="">Work Pass Type</option>
                    {workPassTypes?.map((p) => (
                      <option key={p._id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-600 capitalize">
                  Visa Expiry Date
                </label>
                <CustomDatePicker
                  type="date"
                  name="visaExpiryDate"
                  bgColor="#F3F4F6"
                  value={formData.visaExpiryDate}
                  onChange={(date) => {
                    setFormData({ ...formData, visaExpiryDate: date });
                    // Clear error on change
                    if (validationErrors.visaExpiryDate) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        visaExpiryDate: null,
                      }));
                    }
                  }}
                  className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                />
                {validationErrors.visaExpiryDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.visaExpiryDate}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-gray-600">
                  Uniform Size
                </label>
                <div className="relative">
                  <select
                    className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                    name="uniformSize" // Added name attribute
                    value={formData.uniformSize}
                    onChange={handleChange} // Use general handleChange
                  >
                    <option value="">Uniform Size</option>
                    {[
                      { label: "XS", value: "XS" },
                      { label: "S", value: "S" },
                      { label: "M", value: "M" },
                      { label: "L", value: "L" },
                      { label: "XL", value: "XL" },
                      { label: "XXL", value: "XXL" },
                    ].map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-600 capitalize">
                  Probation Start Date
                </label>
                <CustomDatePicker
                  type="date"
                  name="probationStartDate"
                  bgColor="#F3F4F6"
                  value={formData.probationStartDate}
                  onChange={(date) => {
                    setFormData({ ...formData, probationStartDate: date });
                    // Clear error on change
                    if (validationErrors.probationStartDate) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        probationStartDate: null,
                      }));
                    }
                  }}
                  className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                />
                {validationErrors.probationStartDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.probationStartDate}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-600 capitalize">
                  Probation End Date
                </label>
                <CustomDatePicker
                  type="date"
                  name="probationEndDate"
                  bgColor="#F3F4F6"
                  value={formData.probationEndDate}
                  onChange={(date) => {
                    setFormData({ ...formData, probationEndDate: date });
                    // Clear error on change
                    if (validationErrors.probationEndDate) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        probationEndDate: null,
                      }));
                    }
                  }}
                  className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                />
                {validationErrors.probationEndDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.probationEndDate}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-600 capitalize">
                  Confirmation Date
                </label>
                <CustomDatePicker
                  type="date"
                  name="confirmationDate"
                  bgColor="#F3F4F6"
                  value={formData.confirmationDate}
                  onChange={(date) => {
                    setFormData({ ...formData, confirmationDate: date });
                    // Clear error on change
                    if (validationErrors.confirmationDate) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        confirmationDate: null,
                      }));
                    }
                  }}
                  className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                />
                {validationErrors.confirmationDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.confirmationDate}
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* Reason for leaving is commented out in your original code, so I'm keeping it commented out for now.
          <div className="mb-6">
            <label className="block text-sm text-gray-600 mb-2">
              Reason for Leaving
            </label>
            <textarea
              name="reasonForLeaving"
              value={formData.reasonForLeaving}
              onChange={handleChange}
              className="w-full p-3 bg-gray-100 rounded-md border border-gray-200 h-32"
              placeholder="Reason for leaving (if applicable)"
            ></textarea>
          </div> */}

          </div>

          <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--p-blue)] text-white rounded-md hover:bg-[#9CBA33] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : recordData && recordData._id
                  ? "Update Record"
                  : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmploymentRecordEditModal;
