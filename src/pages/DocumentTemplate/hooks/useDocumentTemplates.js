import { useState, useEffect } from "react";
import requests from "@/services/httpService";

export const useDocumentTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await requests.get("/document-templates");
      console.log("Full response from requests.get():", response);
      console.log("response type:", typeof response);
      console.log("Is response array?", Array.isArray(response));
      
      // Handle different response structures
      let documentsArray = [];
      
      // Case 1: Response is already an array
      if (Array.isArray(response)) {
        documentsArray = response;
      }
      // Case 2: Response is { success: true, data: [...] }
      else if (response?.data && Array.isArray(response.data)) {
        documentsArray = response.data;
      }
      // Case 3: Response is { data: [...] } (nested)
      else if (response?.data?.data && Array.isArray(response.data.data)) {
        documentsArray = response.data.data;
      }
      // Case 4: Fallback - try response.data or empty array
      else {
        documentsArray = response?.data || [];
      }
      
      console.log("Extracted documentsArray:", documentsArray);
      console.log("Is array?", Array.isArray(documentsArray));
      console.log("Array length:", documentsArray.length);
      
      // Ensure we have an array
      if (!Array.isArray(documentsArray)) {
        console.warn("documentsArray is not an array, setting to empty array");
        documentsArray = [];
      }
      
      setTemplates(documentsArray);
      setError(null);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(err.message || "Failed to fetch templates");
      setTemplates([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSetDefault = async (templateId) => {
    try {
      await requests.put(`/document-templates/${templateId}/set-default`);
      const updatedTemplates = templates.map((template) => ({
        ...template,
        isDefault: template._id === templateId, // Using _id as per MongoDB convention
      }));
      setTemplates(updatedTemplates);
    } catch (err) {
      setError(err.message || "Failed to set default template");
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      // Fixed typo in URL (temples -> templates)
      await requests.delete(`/document-templates/${templateId}`);
      const updatedTemplates = templates.filter((t) => t._id !== templateId);
      setTemplates(updatedTemplates);
    } catch (err) {
      setError(err.message || "Failed to delete template");
    }
  };

  const handleCloneTemplate = async (template) => {
    try {
      // Fixed typo in URL (temples -> templates)
      const response = await requests.post("/document-templates/clone", {
        templateId: template._id,
      });
      // Ensure we're getting the correct data structure from the response
      const newTemplate = response?.data?.data || response?.data;
      if (newTemplate) {
        setTemplates((prevTemplates) => [...prevTemplates, newTemplate]);
      }
    } catch (err) {
      setError(err.message || "Failed to clone template");
    }
  };

  // Separate filter functions for better clarity
  const filterBySearch = (docs) => {
    if (!searchQuery) return docs;
    return docs.filter((doc) => {
      const searchTerm = searchQuery.toLowerCase();
      const templateName = (doc.name || "").toLowerCase();
      const documentType = (doc.type || "").toLowerCase();
      return (
        templateName.includes(searchTerm) || documentType.includes(searchTerm)
      );
    });
  };

  const filterByType = (docs) => {
    console.log(filterType);

    if (filterType === "all") return docs;
    return docs.filter((doc) => doc.type === filterType);
  };

  // Compute filtered templates
  const getFilteredTemplates = () => {
    try {
      if (!Array.isArray(templates)) {
        console.warn("Templates is not an array:", templates);
        return [];
      }

      // Apply filters in sequence
      const searchFiltered = filterBySearch(templates);
      const typeFiltered = filterByType(searchFiltered);

      return typeFiltered;
    } catch (err) {
      console.error("Error filtering templates:", err);
      return [];
    }
  };

  const filteredTemplates = getFilteredTemplates();

  return {
    templates: filteredTemplates,
    loading,
    error,
    filterType,
    searchQuery,
    setFilterType,
    setSearchQuery,
    handleSetDefault,
    handleDeleteTemplate,
    handleCloneTemplate,
    refreshTemplates: fetchTemplates,
  };
};
