// API service for document templates
const API_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const fetchAllTemplates = async (
  page = 1,
  limit = 10,
  search = "",
  sortBy = "createdAt",
  sortOrder = "desc"
) => {
  try {
    const queryParams = new URLSearchParams({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    }).toString();

    const response = await fetch(
      `${API_URL}/document-templates?${queryParams}`,
      { credentials: "include" }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch templates");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }
};

export const fetchTemplateById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/document-templates/${id}`, {
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch template");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching template:", error);
    throw error;
  }
};
export const fetchTemplateByName = async (name) => {
  try {
    const response = await fetch(`${API_URL}/document-templates/name/${name}`, {
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch template");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching template:", error);
    throw error;
  }
};

export const createTemplate = async (templateData) => {
  try {
    const response = await fetch(`${API_URL}/document-templates/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templateData),
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to create template");
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating template:", error);
    throw error;
  }
};

export const updateTemplate = async (id, templateData) => {
  try {
    const response = await fetch(`${API_URL}/document-templates/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templateData),
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update template");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating template:", error);
    throw error;
  }
};

export const deleteTemplate = async (id) => {
  try {
    const response = await fetch(`${API_URL}/document-templates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to delete template");
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
};
