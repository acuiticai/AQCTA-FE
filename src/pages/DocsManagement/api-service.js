import axios from "axios"

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

class DocumentService {
  constructor(token) {
    this.api = axios.create({
      baseURL: BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
  }

  // Get folder structure with filters
  async getFolderStructureWithFilters(businessId, userId, filters = null) {
    try {
      const response = await this.api.post(`/documents/structure-with-filters/${businessId}/${userId}`, { filters })
      return response.data
    } catch (error) {
      console.error("Error fetching filtered folder structure:", error)
      throw error
    }
  }

  // Get folder structure
  async getFolderStructure(businessId, userId) {
    try {
      const response = await this.api.get(`/documents/structure/${businessId}/${userId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching folder structure:", error)
      throw error
    }
  }

  // Create folder
  async createFolder(folderData) {
    try {
      const response = await this.api.post("/documents/folders", folderData)
      return response.data
    } catch (error) {
      console.error("Error creating folder:", error)
      throw error
    }
  }

  // Upload file
  async uploadFile(formData) {
    try {
      const response = await this.api.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      return response.data
    } catch (error) {
      console.error("Error uploading file:", error)
      throw error
    }
  }

  // Upload file with all data
  async uploadFileWithAllData(formData) {
    try {
      const response = await this.api.post("/documents/uploadDocument", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      return response.data
    } catch (error) {
      console.error("Error uploading file with data:", error)
      throw error
    }
  }

  // Rename folder
  async renameFolder(folderId, newName) {
    try {
      const response = await this.api.put(`/documents/folders/rename/${folderId}`, { newName })
      return response.data
    } catch (error) {
      console.error("Error renaming folder:", error)
      throw error
    }
  }

  // Rename file
  async renameFile(fileId, newName) {
    try {
      const response = await this.api.put(`/documents/files/rename/${fileId}`, { newName })
      return response.data
    } catch (error) {
      console.error("Error renaming file:", error)
      throw error
    }
  }

  // Move file to trash
  async moveFileToTrash(fileId) {
    try {
      const response = await this.api.put(`/documents/files/move-to-trash/${fileId}`)
      return response.data
    } catch (error) {
      console.error("Error moving file to trash:", error)
      throw error
    }
  }

  // Move folder to trash
  async moveFolderToTrash(folderId) {
    try {
      const response = await this.api.put(`/documents/folders/move-to-trash/${folderId}`)
      return response.data
    } catch (error) {
      console.error("Error moving folder to trash:", error)
      throw error
    }
  }

  // Get file details
  async getFileDetails(fileId) {
    try {
      const response = await this.api.get(`/documents/fileDetails/${fileId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching file details:", error)
      throw error
    }
  }

  // Get folder details
  async getFolderDetails(folderId) {
    try {
      const response = await this.api.get(`/documents/folderDetails/${folderId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching folder details:", error)
      throw error
    }
  }

  // Share item with users
  async shareItem(itemId, itemType, users) {
    try {
      const response = await this.api.post(`/documents/share/${itemId}/${itemType}`, { users })
      return response.data
    } catch (error) {
      console.error("Error sharing item:", error)
      throw error
    }
  }

  // Get file versions
  async getFileVersions(fileId) {
    try {
      const response = await this.api.get(`/documents/fileDetails/${fileId}/versions`)
      return response.data
    } catch (error) {
      console.error("Error fetching file versions:", error)
      throw error
    }
  }

  // Upload new version
  async uploadNewVersion(formData) {
    try {
      const response = await this.api.post("/documents/upload_version", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      return response.data
    } catch (error) {
      console.error("Error uploading new version:", error)
      throw error
    }
  }
}

export default DocumentService
