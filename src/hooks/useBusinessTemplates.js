import { useState, useEffect } from "react";
import requests from "@/services/httpService";

export const useBusinessTemplates = (businessId) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await requests.get(`/business-templates/${businessId}`);
      setAssignments(response.data.data || []);
    } catch (err) {
      setError(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) fetchAssignments();
  }, [businessId]);

  const handleSetDefault = async (assignmentId) => {
    try {
      await requests.put(`/business-templates/${assignmentId}`, {
        isDefault: true,
      });
      fetchAssignments();
    } catch (err) {
      setError(err.message || "Failed to set default");
    }
  };

  const handleToggleActive = async (assignmentId, isActive) => {
    try {
      await requests.put(`/business-templates/${assignmentId}`, {
        isActive: !isActive,
      });
      fetchAssignments();
    } catch (err) {
      setError(err.message || "Failed to update status");
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await requests.delete(`/business-templates/${assignmentId}`);
      fetchAssignments();
    } catch (err) {
      setError(err.message || "Failed to delete assignment");
    }
  };

  return {
    templates: assignments.map((a) => ({
      ...a.templateId,
      isDefault: a.isDefault,
      isActive: a.isActive,
      assignmentId: a._id,
    })),
    loading,
    error,
    handleSetDefault,
    handleToggleActive,
    handleDeleteAssignment,
    // refreshTemplates: fetchAssignments,
  };
};
