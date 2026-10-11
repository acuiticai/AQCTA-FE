"use client";

import { useState, useEffect, useContext, useCallback } from "react";
import { AdminContext } from "@/context/AdminContext";
import WFHManagementServices from "@/services/WFHManagementServices";
import { notifyError, notifySuccess } from "@/utils/toast";

export const useWFHManagement = (organization) => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // Business settings state
  const [businessAllowance, setBusinessAllowance] = useState(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessSaving, setBusinessSaving] = useState(false);

  // Department data state
  const [departments, setDepartments] = useState([]);
  const [departmentAllowances, setDepartmentAllowances] = useState([]); // This will be an array
  const [departmentCapacities, setDepartmentCapacities] = useState({
    business_id: null,
    defaultMinimumPeopleRequired: 0,
    departmentCapacities: [],
  }); // This will be an object with departmentCapacities array
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  // Error state
  const [error, setError] = useState(null);

  // Business allowance functions
  const fetchBusinessAllowance = useCallback(async () => {
    if (!organization) return;

    setBusinessLoading(true);
    try {
      const response = await WFHManagementServices.getBusinessWFHAllowance(
        organization
      );
      console.log("response Allowance Data is:", response.data);
      setBusinessAllowance(response.data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch business allowance:", err);
      setError("Failed to fetch business allowance");
      setBusinessAllowance({
        business_id: organization,
        allowedWfh: 0,
        defaultMinimumPeopleRequired: 0,
        isNew: true,
      });
    } finally {
      setBusinessLoading(false);
    }
  }, [organization]);

  const saveBusinessAllowance = useCallback(
    async (formData) => {
      if (!organization) return;

      setBusinessSaving(true);

      // Optimistic update
      const optimisticUpdate = {
        ...businessAllowance,
        allowedWfh: formData.allowedWfh,
        defaultMinimumPeopleRequired: formData.defaultMinimumPeopleRequired,
        business_id: organization,
      };
      setBusinessAllowance(optimisticUpdate);

      try {
        const payload = {
          business_id: organization,
          allowedWfh: formData.allowedWfh,
          defaultMinimumPeopleRequired: formData.defaultMinimumPeopleRequired,
        };

        const response = await WFHManagementServices.setBusinessWFHAllowance(
          payload
        );

        if (response.data.status) {
          // Update with actual server response
          setBusinessAllowance(response.data.data);
          notifySuccess("Business WFH settings updated successfully");
        } else {
          // Revert optimistic update on failure
          await fetchBusinessAllowance();
        }
        setError(null);
      } catch (err) {
        console.error("Failed to save business allowance:", err);
        notifyError(
          err.response?.data?.error || "Failed to save business WFH settings"
        );
        setError("Failed to save business WFH settings");
        // Revert optimistic update
        await fetchBusinessAllowance();
      } finally {
        setBusinessSaving(false);
      }
    },
    [organization, businessAllowance, fetchBusinessAllowance]
  );

  // Department functions
  const fetchDepartments = useCallback(async () => {
    if (!organization) return;

    try {
      const payload = {
        business_id: organization,
        FilterStatus: "",
        FilterName: "",
      };

      const response = await fetch(
        `${import.meta.env.VITE_APP_API_BASE_URL}/Departments/get_all`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      setDepartments(data.data || []);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setError("Failed to fetch departments");
    }
  }, [organization, adminInfo.token]);

  const fetchDepartmentAllowances = useCallback(async () => {
    if (!organization) return;

    try {
      const response = await WFHManagementServices.getDepartmentAllowances(
        organization
      );
      console.log("Department allowances response:", response.data);
      // The response.data is already an array based on your API structure
      setDepartmentAllowances(response.data || []);
    } catch (err) {
      console.error("Failed to fetch department allowances:", err);
      setDepartmentAllowances([]);
    }
  }, [organization]);

  const fetchDepartmentCapacities = useCallback(async () => {
    if (!organization) return;

    try {
      const response = await WFHManagementServices.getDepartmentCapacities(
        organization
      );
      console.log("Department capacities response:", response.data);
      // The response.data is an object with departmentCapacities array
      setDepartmentCapacities(
        response.data || {
          business_id: organization,
          defaultMinimumPeopleRequired: 0,
          departmentCapacities: [],
        }
      );
    } catch (err) {
      console.error("Failed to fetch department capacities:", err);
      setDepartmentCapacities({
        business_id: organization,
        defaultMinimumPeopleRequired: 0,
        departmentCapacities: [],
      });
    }
  }, [organization]);

  // Department allowance operations with immediate state updates
  const saveDepartmentAllowance = useCallback(
    async (formData, department) => {
      try {
        const payload = {
          business_id: organization,
          department_id: department._id,
          allowedWfh: formData.allowedWfh,
          status: formData.status,
        };

        let updatedItem;
        if (formData._id) {
          // Update existing
          const response =
            await WFHManagementServices.updateDepartmentAllowance(
              formData._id,
              payload
            );
          updatedItem = response.data.data || {
            ...formData,
            ...payload,
            isActive: formData.status === "active",
            isDefault: false,
          };

          // Immediately update state - handle array properly
          setDepartmentAllowances((prev) => {
            if (!Array.isArray(prev)) {
              console.warn("departmentAllowances is not an array:", prev);
              return [updatedItem];
            }
            return prev.map((item) =>
              item._id === formData._id ? updatedItem : item
            );
          });
        } else {
          // Create new
          const response = await WFHManagementServices.setDepartmentAllowance(
            payload
          );
          updatedItem = response.data.data || {
            ...payload,
            _id: Date.now().toString(),
            isActive: payload.status === "active",
            isDefault: false,
            department: {
              _id: department._id,
              name: department.name,
            },
          };

          // Immediately add to state - handle array properly
          setDepartmentAllowances((prev) => {
            if (!Array.isArray(prev)) {
              console.warn("departmentAllowances is not an array:", prev);
              return [updatedItem];
            }
            return [...prev, updatedItem];
          });
        }

        notifySuccess(
          `Department allowance ${
            formData._id ? "updated" : "added"
          } successfully`
        );
      } catch (err) {
        console.error("Failed to save department allowance:", err);
        notifyError(
          err.response?.data?.error || "Failed to save department allowance"
        );
        // Refresh data on error
        await fetchDepartmentAllowances();
      }
    },
    [organization, fetchDepartmentAllowances]
  );

  const deleteDepartmentAllowance = useCallback(
    async (itemId) => {
      // Optimistic update - handle array properly
      setDepartmentAllowances((prev) => {
        if (!Array.isArray(prev)) {
          console.warn("departmentAllowances is not an array:", prev);
          return [];
        }
        return prev.filter((item) => item._id !== itemId);
      });

      try {
        await WFHManagementServices.deleteDepartmentAllowance(itemId);
        notifySuccess("Department allowance deleted successfully");
      } catch (err) {
        console.error("Failed to delete department allowance:", err);
        notifyError("Failed to delete department allowance");
        // Revert on error
        await fetchDepartmentAllowances();
      }
    },
    [fetchDepartmentAllowances]
  );

  const toggleDepartmentAllowanceStatus = useCallback(
    async (department, item) => {
      // Determine the new status: if item exists and is active, new status is false, else true.
      const newStatus = item?.isActive ? false : true;
      let tempId = null; // To store the temporary ID for new items

      // Optimistic update
      setDepartmentAllowances((prev) => {
        if (!Array.isArray(prev)) {
          console.warn("departmentAllowances is not an array:", prev);
          return [];
        }

        if (item) {
          // Update existing item
          return prev.map((allowance) =>
            allowance._id === item._id
              ? { ...allowance, isActive: newStatus }
              : allowance
          );
        } else {
          // Add new item (when toggling 'on' for a department without custom settings)
          tempId = `temp_${Date.now()}`; // Generate and store tempId
          const newItem = {
            _id: tempId,
            business_id: organization,
            department_id: department._id,
            department: {
              _id: department._id,
              name: department.name,
            },
            allowedWfh: businessAllowance?.allowedWfh || 0, // Use business default as initial value
            isActive: newStatus, // This will be true for new items
            isDefault: false,
          };
          return [...prev, newItem];
        }
      });

      try {
        const payload = {
          business_id: organization,
          department_id: department._id,
          allowedWfh: item?.allowedWfh || businessAllowance?.allowedWfh || 0,
          status: newStatus ? "active" : "inactive",
        };

        let response;
        if (item) {
          // Update existing record
          response = await WFHManagementServices.updateDepartmentAllowance(
            item._id,
            payload
          );
        } else {
          // Create new record
          response = await WFHManagementServices.setDepartmentAllowance(
            payload
          );
        }

        // Re-fetch all allowances to ensure state is fully consistent with backend
        // This is safer than complex manual state updates for toggles that create/update
        await fetchDepartmentAllowances();
        notifySuccess("Department allowance status updated successfully");
      } catch (err) {
        console.error("Failed to update department allowance status:", err);
        notifyError("Failed to update department allowance status");
        // Revert optimistic update by re-fetching
        await fetchDepartmentAllowances();
      }
    },
    [organization, businessAllowance, fetchDepartmentAllowances]
  );

  // Department capacity operations with immediate state updates - FIXED
  const saveDepartmentCapacity = useCallback(
    async (formData, department) => {
      try {
        const payload = {
          business_id: organization,
          department_id: department._id,
          minimumPeopleRequired: formData.minimumPeopleRequired,
          description: formData.description,
          status: formData.status,
        };

        let updatedItem;
        if (formData._id) {
          // Update existing
          const response = await WFHManagementServices.updateDepartmentCapacity(
            formData._id,
            payload
          );
          updatedItem = response.data.data || {
            ...formData,
            ...payload,
            isActive: formData.status === "active",
            department_id: {
              _id: department._id,
              name: department.name,
            },
          };

          // Immediately update state - handle object structure properly
          setDepartmentCapacities((prev) => {
            if (!prev || typeof prev !== "object") {
              console.warn("departmentCapacities is not an object:", prev);
              return {
                business_id: organization,
                defaultMinimumPeopleRequired: 0,
                departmentCapacities: [updatedItem],
              };
            }

            const currentCapacities = Array.isArray(prev.departmentCapacities)
              ? prev.departmentCapacities
              : [];
            return {
              ...prev,
              departmentCapacities: currentCapacities.map((item) =>
                item._id === formData._id ? updatedItem : item
              ),
            };
          });
        } else {
          // Create new
          const response = await WFHManagementServices.setDepartmentCapacity(
            payload
          );
          updatedItem = response.data.data || {
            ...payload,
            _id: Date.now().toString(),
            isActive: payload.status === "active",
            department_id: {
              _id: department._id,
              name: department.name,
            },
          };

          // Immediately add to state - handle object structure properly
          setDepartmentCapacities((prev) => {
            if (!prev || typeof prev !== "object") {
              console.warn("departmentCapacities is not an object:", prev);
              return {
                business_id: organization,
                defaultMinimumPeopleRequired: 0,
                departmentCapacities: [updatedItem],
              };
            }

            const currentCapacities = Array.isArray(prev.departmentCapacities)
              ? prev.departmentCapacities
              : [];
            return {
              ...prev,
              departmentCapacities: [...currentCapacities, updatedItem],
            };
          });
        }

        notifySuccess(
          `Department capacity ${
            formData._id ? "updated" : "added"
          } successfully`
        );
      } catch (err) {
        console.error("Failed to save department capacity:", err);
        notifyError(
          err.response?.data?.error || "Failed to save department capacity"
        );
        // Refresh data on error
        await fetchDepartmentCapacities();
      }
    },
    [organization, fetchDepartmentCapacities]
  );

  const deleteDepartmentCapacity = useCallback(
    async (itemId) => {
      // Optimistic update - handle object structure properly
      setDepartmentCapacities((prev) => {
        if (!prev || typeof prev !== "object") {
          console.warn("departmentCapacities is not an object:", prev);
          return {
            business_id: organization,
            defaultMinimumPeopleRequired: 0,
            departmentCapacities: [],
          };
        }

        const currentCapacities = Array.isArray(prev.departmentCapacities)
          ? prev.departmentCapacities
          : [];
        return {
          ...prev,
          departmentCapacities: currentCapacities.filter(
            (item) => item._id !== itemId
          ),
        };
      });

      try {
        await WFHManagementServices.deleteDepartmentCapacity(itemId);
        notifySuccess("Department capacity deleted successfully");
      } catch (err) {
        console.error("Failed to delete department capacity:", err);
        notifyError("Failed to delete department capacity");
        // Revert on error
        await fetchDepartmentCapacities();
      }
    },
    [organization, fetchDepartmentCapacities]
  );

  const toggleDepartmentCapacityStatus = useCallback(
    async (department, item) => {
      const newStatus = item?.isActive ? false : true;
      let tempId = null; // To store the temporary ID for new items

      // Optimistic update
      setDepartmentCapacities((prev) => {
        if (!prev || typeof prev !== "object") {
          console.warn("departmentCapacities is not an object:", prev);
          return {
            business_id: organization,
            defaultMinimumPeopleRequired: 0,
            departmentCapacities: [],
          };
        }

        const currentCapacities = Array.isArray(prev.departmentCapacities)
          ? prev.departmentCapacities
          : [];

        if (item) {
          // Update existing item
          return {
            ...prev,
            departmentCapacities: currentCapacities.map((capacity) =>
              capacity._id === item._id
                ? { ...capacity, isActive: newStatus }
                : capacity
            ),
          };
        } else {
          // Add new item (when toggling 'on' for a department without custom settings)
          tempId = `temp_${Date.now()}`; // Generate and store tempId
          const newItem = {
            _id: tempId,
            business_id: organization,
            department_id: {
              _id: department._id,
              name: department.name,
            },
            minimumPeopleRequired:
              businessAllowance?.defaultMinimumPeopleRequired || 0,
            description: "",
            isActive: newStatus, // This will be true for new items
          };
          return {
            ...prev,
            departmentCapacities: [...currentCapacities, newItem],
          };
        }
      });

      try {
        const payload = {
          business_id: organization,
          department_id: department._id,
          minimumPeopleRequired:
            item?.minimumPeopleRequired ||
            businessAllowance?.defaultMinimumPeopleRequired ||
            0,
          description: item?.description || "",
          status: newStatus ? "active" : "inactive",
        };

        let response;
        if (item) {
          // Update existing record
          response = await WFHManagementServices.updateDepartmentCapacity(
            item._id,
            payload
          );
        } else {
          // Create new record
          response = await WFHManagementServices.setDepartmentCapacity(payload);
        }

        // Re-fetch all capacities to ensure state is fully consistent with backend
        await fetchDepartmentCapacities();
        notifySuccess("Department capacity status updated successfully");
      } catch (err) {
        console.error("Failed to update department capacity status:", err);
        notifyError("Failed to update department capacity status");
        // Revert optimistic update by re-fetching
        await fetchDepartmentCapacities();
      }
    },
    [organization, businessAllowance, fetchDepartmentCapacities]
  );

  // Initialize data
  useEffect(() => {
    if (organization) {
      setDepartmentsLoading(true);
      Promise.all([
        fetchBusinessAllowance(),
        fetchDepartments(),
        fetchDepartmentAllowances(),
        fetchDepartmentCapacities(),
      ]).finally(() => {
        setDepartmentsLoading(false);
      });
    }
  }, [
    organization,
    fetchBusinessAllowance,
    fetchDepartments,
    fetchDepartmentAllowances,
    fetchDepartmentCapacities,
  ]);

  // Utility functions
  const getEffectiveAllowance = useCallback(
    async (departmentId) => {
      if (!organization || !departmentId) return null;

      try {
        const response = await WFHManagementServices.getEffectiveWFHAllowance(
          organization,
          departmentId
        );
        return response.data.data;
      } catch (err) {
        console.error("Failed to get effective allowance:", err);
        return null;
      }
    },
    [organization]
  );

  const getEffectiveCapacity = useCallback(
    async (departmentId) => {
      if (!organization || !departmentId) return null;

      try {
        const response = await WFHManagementServices.getEffectiveWFHCapacity(
          organization,
          departmentId
        );
        return response.data.data;
      } catch (err) {
        console.error("Failed to get effective capacity:", err);
        return null;
      }
    },
    [organization]
  );

  return {
    // State
    businessAllowance,
    businessLoading,
    businessSaving,
    departments,
    departmentAllowances,
    departmentCapacities,
    departmentsLoading,
    error,

    // Business functions
    fetchBusinessAllowance,
    saveBusinessAllowance,

    // Department functions
    fetchDepartments,
    fetchDepartmentAllowances,
    fetchDepartmentCapacities,

    // Department allowance functions
    saveDepartmentAllowance,
    deleteDepartmentAllowance,
    toggleDepartmentAllowanceStatus,

    // Department capacity functions
    saveDepartmentCapacity,
    deleteDepartmentCapacity,
    toggleDepartmentCapacityStatus,

    // Utility functions
    getEffectiveAllowance,
    getEffectiveCapacity,
  };
};
