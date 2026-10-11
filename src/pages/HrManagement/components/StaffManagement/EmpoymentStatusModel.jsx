"use client";

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
import CustomDatePicker from "@/components/CustomDatePicker";
import moment from "moment";
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

const Statuses = [
  "Active",
  "Inactive",
  "On Leave",
  "Terminated",
  "Resigned",
  "Promoted",
];

const EmploymentRecordStatusModal = ({
  isOpen,
  onClose,
  recordData,
  staffId,
  onRecordUpdated,
}) => {
  const [formData, setFormData] = useState({
    business: "",
    department: "",
    branchLocations: [],
    employmentType: "",
    position: "",
    leaveGroup: "",
    claimGroup: "",
    joiningDate: "",
    endDate: "",
    reasonForLeaving: "",
    status: "",
  });

  console.log("form data", formData);
  console.log("record data", recordData);

  const [newJoiningDate, setNewJoiningData] = useState(null);
  const [newEndDate, setNewEndDate] = useState(null);

  console.log("form data", formData);
  console.log("joining date", formData.joiningDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [leaveGroups, setLeaveGroups] = useState([]);
  const [claimGroups, setClaimGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branchLocations, setBranchLocations] = useState([]);
  const [fetchError, setFetchError] = useState(null);
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

  const fetchLeaveGroups = useCallback(
    async (businessId) => {
      if (!businessId) {
        setLeaveGroups([]);
        return [];
      }
      try {
        setIsLoading(true);
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
        setFetchError("Failed to load leave groups");
        setLeaveGroups([]);
        return [];
      } finally {
        setIsLoading(false);
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
      } catch (err) {
        console.log("Failed to fetch branches");
        setBranchLocations([]);
        return [];
      }
    },
    [Base_URL, headers, staffId]
  );

  const fetchClaimGroups = useCallback(
    async (businessId) => {
      if (!businessId) {
        setClaimGroups([]);
        return [];
      }
      try {
        setIsLoading(true);
        const response = await axios.get(`${Base_URL}/claim-groups`, {
          params: { bid: businessId },
          headers,
        });
        const data = response.data || [];
        setClaimGroups(data);
        return data;
      } catch (error) {
        console.error("Error fetching claim groups:", error);
        setFetchError("Failed to load claim groups");
        setClaimGroups([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [Base_URL, headers]
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

  const refetchAllBusinessData = useCallback(
    async (businessId) => {
      if (!businessId) return;
      setIsLoading(true);
      try {
        await Promise.all([
          fetchLeaveGroups(businessId),
          fetchClaimGroups(businessId),
          fetchPositions(businessId),
          fetchDepartments(businessId),
          fetchBranchLocations(businessId),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      fetchLeaveGroups,
      fetchClaimGroups,
      fetchPositions,
      fetchDepartments,
      fetchBranchLocations,
    ]
  );

  const clearBusinessScopedFormFields = useCallback(
    () => ({
      department: "",
      position: "",
      branchLocations: [],
      leaveGroup: "",
      claimGroup: "",
    }),
    []
  );

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

  useEffect(() => {
    if (!isOpen) return;

    if (recordData) {
      const formattedStartDate = recordData.joiningDate
        ? new Date(recordData.joiningDate).toISOString().split("T")[0]
        : "";

      const formattedEndDate = recordData?.endDate
        ? new Date(recordData.endDate).toISOString().split("T")[0]
        : "";

      setFormData({
        business: recordData.business || "",
        department: recordData.department || "",
        branchLocations: branchIdsFromStaffRef(recordData.branchLocations),
        position: recordData.position || "",
        employmentType: recordData.employmentType || "",
        leaveGroup: recordData.leaveGroup || "",
        claimGroup: recordData.claimGroup || "",
        joiningDate: formattedStartDate,
        endDate: formattedEndDate,
        reasonForLeaving: recordData?.reasonForLeaving || "",
        status: recordData?.status || "",
      });

      const bizId = recordData.business?._id
        ? String(recordData.business._id)
        : "";
      if (bizId) {
        refetchAllBusinessData(bizId);
      }
    }
  }, [recordData, refetchAllBusinessData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let url;
      let method;
      let dataToSend = {};

      const status = formData.status;

      if (!status) {
        setError("Status is required");
        setIsSubmitting(false);
        return;
      }

      switch (status) {
        case "Active":
          dataToSend.status = status;
          dataToSend.endDate = null;
          dataToSend.reasonForLeaving = "";
          break;
        case "On Leave":
        case "Inactive":
          dataToSend.status = status;
          break;

        case "Resigned":
        case "Terminated":
          if (!formData.reasonForLeaving) {
            setError("Reason for leaving is required.");
            setIsSubmitting(false);
            return;
          }
          dataToSend.status = status;
          dataToSend.endDate = newEndDate;
          dataToSend.reasonForLeaving = formData.reasonForLeaving;
          break;

        case "Promoted":
          if (!newJoiningDate) {
            setError("Joining date is required.");
            setIsSubmitting(false);
            scrollRef.current?.scrollTo({
              top: 0,
              behavior: "smooth", // Optional: Adds a smooth scrolling animation
            });
            return;
          }
          if (
            !formData.branchLocations ||
            !Array.isArray(formData.branchLocations) ||
            formData.branchLocations.length === 0
          ) {
            setError("Select at least one branch / location.");
            setIsSubmitting(false);
            return;
          }
          console.log(newJoiningDate, "new joining date");
          // Step 2: Build previous role
          const previousRole = {
            ...recordData,
            position: recordData?.position || recordData?.position?._id,
            department: recordData?.department || recordData?.department?._id,
            branchLocations: branchIdsFromStaffRef(recordData.branchLocations),
            employmentType:
              recordData?.employmentType || recordData?.employmentType?._id,
            leaveGroup: recordData?.leaveGroup || recordData?.leaveGroup?._id,
            claimGroup: recordData?.claimGroup || recordData?.claimGroup?._id,
            joiningDate: recordData?.joiningDate,
            endDate: newJoiningDate
              ? moment(newJoiningDate).subtract(1, "days").toDate()
              : null, // fallback
            status: "Promoted",
            reasonForLeaving: formData.reasonForLeaving || "", // Step 2
          };

          // Step 3: Populate new data
          dataToSend = {
            status: "Active", // reset to Active
            business: formData.business?._id || formData.business,
            position: formData.position?._id || formData.position,
            department: formData.department?._id || formData.department, // Added department
            branchLocations: Array.isArray(formData.branchLocations)
              ? formData.branchLocations
              : branchIdsFromStaffRef(formData.branchLocations),
            employmentType:
              formData.employmentType?._id || formData.employmentType,
            leaveGroup: formData.leaveGroup?._id || formData.leaveGroup,
            claimGroup: formData.claimGroup?._id || formData.claimGroup,
            joiningDate: newJoiningDate,
            reasonForLeaving: "",
            endDate: null, // Step 3: clear current endDate
            previousRoles: [...(recordData?.previousRoles || []), previousRole],
          };
          break;

        default:
          setError("Unknown status selected.");
          setIsSubmitting(false);
          return;
      }

      if (recordData && recordData._id) {
        url = `${Base_URL}/staff-management/${staffId}`;
        method = "put";
      } else {
        url = `${Base_URL}/staff-management/${staffId}/employment-records`;
        method = "post";
      }

      console.log("data to send", dataToSend);

      const response = await axios[method](url, dataToSend);
      setIsSubmitting(false);
      onRecordUpdated(response.data);
      onClose();
    } catch (err) {
      console.error("Error updating employment record:", err);
      setError("Failed to save employment record. Please try again.");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setError(null);
      }, 3000);
      setNewJoiningData(null);
    }
  };

  const scrollRef = React.useRef(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={scrollRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {"Update Status"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">Status</label>
              <div className="relative">
                <select
                  className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  value={formData.status}
                  onChange={(e) => {
                    e.target.value !== "Promoted"
                      ? setFormData({
                          ...formData,
                          status: e.target.value,
                          reasonForLeaving: "",
                        })
                      : setFormData({
                          ...formData,
                          status: e.target.value,
                          reasonForLeaving: "Promoted",
                        });
                  }}
                >
                  <option value="">Status</option>
                  {Statuses.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
              </div>
            </div>
          </div>

          {formData.status === "Promoted" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <SingleBusinessField
                  className="space-y-2"
                  selectedValue={activeBusinessId}
                  onAutoSelect={handleBusinessChange}
                >
                  <label className="block text-sm text-gray-600">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <BusinessDropdown
                    adminId={adminInfo?.id}
                    selectedBusiness={activeBusinessId}
                    onChange={handleBusinessChange}
                    isClearable={false}
                    placeholder="Select Business"
                  />
                </SingleBusinessField>

                <PositionSelectWithAdd
                  businessId={activeBusinessId}
                  privateStaffId={staffId}
                  allowPrivateForStaff
                  value={formData.position?._id || formData.position || ""}
                  onChange={(id) => {
                    const selected = positions.find(
                      (p) => String(p._id) === String(id)
                    );
                    setFormData({
                      ...formData,
                      position: selected || null,
                    });
                  }}
                  positions={positions}
                  onPositionsRefetch={() => fetchPositions(activeBusinessId)}
                  label="Position"
                  labelClassName="block text-sm text-gray-600"
                  placeholder="Select Position"
                  overlayClassName="z-[70]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <DepartmentSelectWithAdd
                  businessId={activeBusinessId}
                  privateStaffId={staffId}
                  allowPrivateForStaff
                  value={formData.department?._id || formData.department || ""}
                  onChange={(id) => {
                    const selected = departments.find(
                      (d) => String(d._id) === String(id)
                    );
                    setFormData({
                      ...formData,
                      department: selected || null,
                    });
                  }}
                  departments={departments}
                  onDepartmentsRefetch={() => fetchDepartments(activeBusinessId)}
                  label="Department"
                  labelClassName="block text-sm text-gray-600"
                  placeholder="Select Department"
                  overlayClassName="z-[70]"
                />

                <BranchLocationSelectWithAdd
                  businessId={activeBusinessId}
                  privateStaffId={staffId}
                  allowPrivateForStaff
                  value={formData.branchLocations}
                  onChange={(ids) =>
                    setFormData({
                      ...formData,
                      branchLocations: ids,
                    })
                  }
                  branches={branchLocations}
                  onBranchesRefetch={() => fetchBranchLocations(activeBusinessId)}
                  label="Branch / Location (one or more)"
                  labelClassName="block text-sm text-gray-600"
                  placeholder="Select branches"
                  overlayClassName="z-[70]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Leave Group */}
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600">
                    Leave Group
                  </label>
                  <div>
                    <div className="relative">
                      <select
                        className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                        value={formData.leaveGroup?._id || ""}
                        onChange={(e) => {
                          const selected = leaveGroups.find(
                            (item) => item._id === e.target.value
                          );
                          setFormData({ ...formData, leaveGroup: selected });
                        }}
                      >
                        <option value="">Leave Group</option>
                        {leaveGroups?.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                    </div>
                  </div>
                </div>

                {/* Claim Group */}
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600">
                    Claim Group
                  </label>
                  <div className="relative">
                    <select
                      className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      value={formData.claimGroup?._id || ""}
                      onChange={(e) => {
                        const selected = claimGroups.find(
                          (item) => item._id === e.target.value
                        );
                        setFormData({ ...formData, claimGroup: selected });
                      }}
                    >
                      <option value="">Claim Group</option>
                      {claimGroups?.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600">
                    Employment Type
                  </label>
                  <div className="relative">
                    <select
                      className="w-full p-3 bg-gray-100 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      value={formData.employmentType || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          employmentType: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select employment type</option>
                      {[
                        { label: "Full-time", value: "Full-time" },
                        { label: "Part-time", value: "Part-time" },
                        { label: "Intern", value: "Intern" },
                        { label: "Contract", value: "Contract" },
                        { label: "Freelancer", value: "Freelancer" },
                      ].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600">
                    Joining Date
                  </label>
                  <CustomDatePicker
                    type="date"
                    name="newJoiningDate"
                    bgColor="#F3F4F6"
                    value={newJoiningDate}
                    onChange={(date) => setNewJoiningData(date)}
                    className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {(formData.status === "Terminated" ||
            formData.status === "Resigned") && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">End Date</label>
              <CustomDatePicker
                type="date"
                name="newEndDate"
                bgColor="#F3F4F6"
                value={newEndDate}
                onChange={(date) => setNewEndDate(date)}
                className="w-full p-3 bg-gray-100 rounded-md border border-gray-200"
                required
              />
            </div>
          )}

          {formData.status !== "Active" &&
            formData.status !== "On Leave" &&
            formData.status !== "Inactive" && (
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
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[var(--p-blue)] hover:bg-[#9CBD33] text-white rounded-md disabled:bg-gray-300"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : recordData && recordData._id
                ? "Update"
                : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmploymentRecordStatusModal;
