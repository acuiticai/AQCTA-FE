import React, { useState, useEffect, useContext } from "react";
import { useHistory, useParams } from "react-router-dom";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { PageHeader, Form, useFormScreenExit } from "@/page-layouts/index";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import { X, Upload, FileText, Users, ChevronDown, ChevronUp, Search } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Inline Selection Checklist Component
const InlineChecklist = ({ 
  isOpen, 
  items, 
  selectedIds, 
  onToggle, 
  searchTerm, 
  onSearchChange,
  loading,
  placeholder = "Search..."
}) => {
  if (!isOpen) return null;

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = (item.name || item.displayName || item.fullName || 
                 item.basicInformation?.customerDisplayName || 
                 item.basicInformation?.vendorDisplayName || 
                 item.customerDisplayName || 
                 item.vendorDisplayName || "").toLowerCase();
    const email = (item.email || 
                  item.basicInformation?.customerEmail || 
                  item.basicInformation?.vendorEmail || 
                  item.customerEmail || 
                  item.vendorEmail || "").toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower);
  });

  return (
    <div className="mt-2 border border-gray-300 rounded-lg bg-white shadow-sm">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-1 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            {filteredItems.filter(item => selectedIds.some(id => String(id) === String(item._id))).length} of {filteredItems.length} selected
          </span>
          <button
            type="button"
            onClick={(e) => {
              // Prevent form submit when this button is rendered inside a <form>
              e.preventDefault();
              e.stopPropagation();

              const normalizedSelectedIds = selectedIds.map(id => String(id));
              const filteredSelectedCount = filteredItems.filter(item => 
                normalizedSelectedIds.includes(String(item._id))
              ).length;
              const allFilteredSelected = filteredSelectedCount === filteredItems.length && filteredItems.length > 0;
              
              if (allFilteredSelected) {
                // Deselect all filtered items
                filteredItems.forEach(item => {
                  if (normalizedSelectedIds.includes(String(item._id))) {
                    onToggle(item._id, false);
                  }
                });
              } else {
                // Select all filtered items
                filteredItems.forEach(item => {
                  if (!normalizedSelectedIds.includes(String(item._id))) {
                    onToggle(item._id, true);
                  }
                });
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {filteredItems.filter(item => selectedIds.some(id => String(id) === String(item._id))).length === filteredItems.length && filteredItems.length > 0 ? "Deselect All" : "Select All"}
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="max-h-64 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-2">No items found</p>
            <p className="text-xs text-gray-400">
              Total items: {items.length} | Press F12 to open console for details
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-2">No items match your search</p>
            <p className="text-xs text-gray-400">
              Showing 0 of {items.length} items | Try a different search term
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredItems.map((item) => {
              const itemId = item._id;
              const normalizedSelectedIds = selectedIds.map(id => String(id));
              const isSelected = normalizedSelectedIds.includes(String(itemId));
              const name = item.name || item.displayName || item.fullName || 
                         item.basicInformation?.customerDisplayName || 
                         item.basicInformation?.vendorDisplayName || 
                         item.customerDisplayName || 
                         item.vendorDisplayName || "N/A";
              const email = item.email || 
                          item.basicInformation?.customerEmail || 
                          item.basicInformation?.vendorEmail || 
                          item.customerEmail || 
                          item.vendorEmail || "";

              return (
                <div
                  key={itemId}
                  onClick={() => onToggle(itemId, !isSelected)}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-transparent hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(itemId, !isSelected)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {email && (
                        <p className="text-xs text-gray-500 truncate">{email}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const CreateAnnouncement = () => {
  const history = useHistory();
  const exitAnnouncementsScreen = useFormScreenExit("/announcements");
  const { id } = useParams();
  const buttonColor = useButtonColor();
  const checkTokenExpired = useCheckTokenExpired();
  const { state } = useContext(AdminContext);
  // Get adminInfo from context, with fallback to localStorage
  const adminInfoFromContext = state?.adminInfo;
  const adminInfoFromStorage = localStorage.getItem("adminInfo") 
    ? JSON.parse(localStorage.getItem("adminInfo")) 
    : null;
  const adminInfo = adminInfoFromContext || adminInfoFromStorage;

  const isEditMode = !!id && history.location.pathname.includes("/Edit Announcement/");
  const isViewMode = !!id && history.location.pathname.includes("/View Announcement/");
  const requiredPermission = isViewMode
    ? PERMISSION_ACTION.VIEW_DETAILS
    : isEditMode
      ? PERMISSION_ACTION.UPDATE
      : PERMISSION_ACTION.ADD;

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    attachments: [],
    audience: {
      staff: false,
      staffIds: [],
      customers: false,
      customerIds: [],
      vendors: false,
      vendorIds: [],
    },
    status: "draft",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Business selection
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  
  // Inline checklist states
  const [showStaffList, setShowStaffList] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showVendorList, setShowVendorList] = useState(false);
  
  // Search terms for each list
  const [staffSearch, setStaffSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  
  // Data lists
  const [staffList, setStaffList] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  const [vendorList, setVendorList] = useState([]);
  const [loadingLists, setLoadingLists] = useState({
    staff: false,
    customers: false,
    vendors: false,
  });
  
  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    staff: { count: 0, error: null, lastFetch: null },
    customers: { count: 0, error: null, lastFetch: null },
    vendors: { count: 0, error: null, lastFetch: null },
  });

  // Debug adminInfo on mount and changes
  useEffect(() => {
    console.log("AdminInfo in CreateAnnouncement:", adminInfo);
    console.log("AdminInfo ID:", adminInfo?.id || adminInfo?._id);
    if (!adminInfo) {
      console.warn("⚠️ AdminInfo is null or undefined!");
    } else if (!adminInfo.id && !adminInfo._id) {
      console.warn("⚠️ AdminInfo exists but has no id or _id property!");
      console.warn("AdminInfo keys:", Object.keys(adminInfo));
    }
  }, [adminInfo]);

  // Load assigned businesses from API (only auto-select if exactly 1 assigned)
  useEffect(() => {
    if (!adminInfo?.id || !adminInfo?.token) return;
    const fetchBusinesses = async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          {
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${adminInfo.token}`,
            },
          }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
        // For create mode: auto-select only if 1 business assigned
        // For edit mode: fetchAnnouncement will set the correct business
        if (!id && list.length === 1) {
          setSelectedBusiness(list[0]._id);
        }
      } catch (error) {
        console.error("Error fetching assigned businesses:", error);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (id) {
      fetchAnnouncement(id);
    }
  }, [id]);

  // Fetch lists when business is selected
  useEffect(() => {
    if (selectedBusiness && adminInfo?.token) {
      fetchStaffList(selectedBusiness);
      fetchCustomerList(selectedBusiness);
      fetchVendorList(selectedBusiness);
    }
  }, [selectedBusiness, adminInfo?.token]);

  const fetchAnnouncement = async (announcementId) => {
    try {
      setFetching(true);
      const response = await axios.get(`${Base_URL}/announcements/${announcementId}`, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo?.token}`,
        },
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;

      if (response.data.status) {
        const data = response.data.data;
        
        // Always restore the announcement's business when editing
        if (data.business_id) {
          setSelectedBusiness(
            typeof data.business_id === "object"
              ? data.business_id._id || data.business_id.toString()
              : data.business_id
          );
        }
        
        setFormData({
          title: data.title || "",
          content: data.content || "",
          attachments: data.attachments || [],
          audience: {
            staff: data.audience?.staff || false,
            staffIds: data.audience?.staffIds?.map((id) => id.toString()) || [],
            customers: data.audience?.customers || false,
            customerIds: data.audience?.customerIds?.map((id) => id.toString()) || [],
            vendors: data.audience?.vendors || false,
            vendorIds: data.audience?.vendorIds?.map((id) => id.toString()) || [],
          },
          status: data.status || "draft",
        });
      } else {
        notifyError("Failed to load announcement");
      }
    } catch (error) {
      console.error("Error fetching announcement:", error);
      notifyError("Failed to load announcement");
    } finally {
      setFetching(false);
    }
  };

  const fetchStaffList = async (businessId) => {
    businessId = businessId || selectedBusiness || adminInfo?.business_id;
    
    if (!businessId || !adminInfo?.token) {
      console.log("Missing business_id or token for staff fetch", { businessId, hasToken: !!adminInfo?.token });
      setDebugInfo(prev => ({
        ...prev,
        staff: {
          count: 0,
          error: `Missing: ${!businessId ? 'Business ID' : ''} ${!adminInfo?.token ? 'Token' : ''}`,
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      return;
    }
    
    try {
      setLoadingLists((prev) => ({ ...prev, staff: true }));
      console.log("Fetching staff with business_id:", businessId);
      
      const response = await axios.get(`${Base_URL}/staff-management`, {
        params: {
          business: businessId,
          status: "Active",
          limit: 1000,
          page: 1,
        },
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
      });
      
      if (checkTokenExpired(response)) return;
      
      console.log("Staff API Response:", response.data);
      const staffData = response.data.staffList || response.data.data || [];
      setStaffList(staffData);
      console.log("Fetched staff:", staffData.length, "items");
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        staff: {
          count: staffData.length,
          error: null,
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      
      if (staffData.length === 0) {
        console.warn("No staff found. Check business_id and filters.");
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      // Update debug info with error
      setDebugInfo(prev => ({
        ...prev,
        staff: {
          count: 0,
          error: error.response?.data?.message || error.message || "Unknown error",
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      
      notifyError(error.response?.data?.message || "Failed to load staff list");
    } finally {
      setLoadingLists((prev) => ({ ...prev, staff: false }));
    }
  };

  const fetchCustomerList = async (businessId) => {
    businessId = businessId || selectedBusiness || adminInfo?.business_id;
    
    if (!businessId || !adminInfo?.token) {
      console.log("Missing business_id or token for customer fetch", { businessId, hasToken: !!adminInfo?.token });
      setDebugInfo(prev => ({
        ...prev,
        customers: {
          count: 0,
          error: `Missing: ${!businessId ? 'Business ID' : ''} ${!adminInfo?.token ? 'Token' : ''}`,
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      return;
    }
    
    try {
      setLoadingLists((prev) => ({ ...prev, customers: true }));
      console.log("Fetching customers with business_id:", businessId);
      
      const response = await axios.get(`${Base_URL}/customers`, {
        params: {
          businessId: businessId,
          limit: 1000,
          page: 1,
        },
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
      });
      
      if (checkTokenExpired(response)) return;
      
      console.log("Customer API Response:", response.data);
      // Handle different response structures
      const customersData = response.data.customers || response.data.data || [];
      setCustomerList(customersData);
      console.log("Fetched customers:", customersData.length, "items");
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        customers: {
          count: customersData.length,
          error: null,
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      
      if (customersData.length === 0) {
        console.warn("No customers found. Check business_id and filters.");
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      // Update debug info with error
      setDebugInfo(prev => ({
        ...prev,
        customers: {
          count: 0,
          error: error.response?.data?.message || error.message || "Unknown error",
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      
      notifyError(error.response?.data?.message || "Failed to load customer list");
    } finally {
      setLoadingLists((prev) => ({ ...prev, customers: false }));
    }
  };

  const fetchVendorList = async (businessId) => {
    businessId = businessId || selectedBusiness || adminInfo?.business_id;
    
    if (!businessId || !adminInfo?.token) {
      console.log("Missing business_id or token for vendor fetch", { businessId, hasToken: !!adminInfo?.token });
      setDebugInfo(prev => ({
        ...prev,
        vendors: {
          count: 0,
          error: `Missing: ${!businessId ? 'Business ID' : ''} ${!adminInfo?.token ? 'Token' : ''}`,
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      return;
    }
    
    try {
      setLoadingLists((prev) => ({ ...prev, vendors: true }));
      console.log("Fetching vendors with business_id:", businessId);
      
      const response = await axios.get(`${Base_URL}/vendors`, {
        params: {
          business: businessId,
          limit: 1000,
        },
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
      });
      
      if (checkTokenExpired(response)) return;
      
      console.log("Vendor API Response:", response.data);
      const vendorsData = response.data.data || response.data.vendors || [];
      setVendorList(vendorsData);
      console.log("Fetched vendors:", vendorsData.length, "items");
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        vendors: {
          count: vendorsData.length,
          error: null,
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      
      if (vendorsData.length === 0) {
        console.warn("No vendors found. Check business_id and filters.");
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      // Update debug info with error
      setDebugInfo(prev => ({
        ...prev,
        vendors: {
          count: 0,
          error: error.response?.data?.message || error.message || "Unknown error",
          lastFetch: new Date().toLocaleTimeString(),
        }
      }));
      
      notifyError(error.response?.data?.message || "Failed to load vendor list");
    } finally {
      setLoadingLists((prev) => ({ ...prev, vendors: false }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith("audience.")) {
      const audienceField = name.split(".")[1];
      const newValue = checked;
      
      setFormData((prev) => {
        const updated = {
          ...prev,
          audience: {
            ...prev.audience,
            [audienceField]: newValue,
          },
        };
        
        // If unchecking, clear the IDs and close the list
        if (!newValue) {
          if (audienceField === "staff") {
            updated.audience.staffIds = [];
            setShowStaffList(false);
          } else if (audienceField === "customers") {
            updated.audience.customerIds = [];
            setShowCustomerList(false);
          } else if (audienceField === "vendors") {
            updated.audience.vendorIds = [];
            setShowVendorList(false);
          }
        } else {
          // If checking, open the list
          if (audienceField === "staff") {
            setShowStaffList(true);
          } else if (audienceField === "customers") {
            setShowCustomerList(true);
          } else if (audienceField === "vendors") {
            setShowVendorList(true);
          }
        }
        
        return updated;
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleToggleItem = (type, itemId, isSelected) => {
    // Normalize ID to string for consistent comparison
    const normalizedId = String(itemId);
    
    setFormData((prev) => {
      const updated = { ...prev };
      
      if (type === "staff") {
        if (isSelected) {
          // Only add if not already present (prevent duplicates)
          if (!updated.audience.staffIds.some(id => String(id) === normalizedId)) {
            updated.audience.staffIds = [...updated.audience.staffIds, normalizedId];
          }
        } else {
          updated.audience.staffIds = updated.audience.staffIds.filter(id => String(id) !== normalizedId);
        }
        updated.audience.staff = updated.audience.staffIds.length > 0;
      } else if (type === "customers") {
        if (isSelected) {
          // Only add if not already present (prevent duplicates)
          if (!updated.audience.customerIds.some(id => String(id) === normalizedId)) {
            updated.audience.customerIds = [...updated.audience.customerIds, normalizedId];
          }
        } else {
          updated.audience.customerIds = updated.audience.customerIds.filter(id => String(id) !== normalizedId);
        }
        updated.audience.customers = updated.audience.customerIds.length > 0;
      } else if (type === "vendors") {
        if (isSelected) {
          // Only add if not already present (prevent duplicates)
          if (!updated.audience.vendorIds.some(id => String(id) === normalizedId)) {
            updated.audience.vendorIds = [...updated.audience.vendorIds, normalizedId];
          }
        } else {
          updated.audience.vendorIds = updated.audience.vendorIds.filter(id => String(id) !== normalizedId);
        }
        updated.audience.vendors = updated.audience.vendorIds.length > 0;
      }
      
      return updated;
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const invalidFiles = files.filter((file) => file.size > maxSize);
    if (invalidFiles.length > 0) {
      notifyError(`Files exceed 10MB limit: ${invalidFiles.map((f) => f.name).join(", ")}`);
      e.target.value = "";
      return;
    }

    setUploading(true);

    const uploadedAttachments = [];
    for (const file of files) {
      try {
        const formDataForUpload = new FormData();
        const businessId = selectedBusiness || adminInfo?.business_id;
        formDataForUpload.append("file_path", `Announcements/${formData.title || "Draft"}`);
        formDataForUpload.append("business_id", businessId);
        formDataForUpload.append("uploadedBy", adminInfo?.id || adminInfo?._id);
        formDataForUpload.append("file_type", file.type);
        formDataForUpload.append("file_size", file.size);
        formDataForUpload.append("file", file);

        const response = await axios.post(
          // Use the same upload endpoint used across the app (mounted at /api/documents/uploadDocument)
          `${Base_URL}/documents/uploadDocument`,
          formDataForUpload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (response.data.message === "File uploaded successfully") {
          const uploadedFile = response.data.file;
          const fileDetailsResponse = await axios.get(
            `${Base_URL}/documents/getFileWithAllData/${uploadedFile._id}`
          );

          if (fileDetailsResponse.data.success) {
            const fileData = fileDetailsResponse.data.data;
            uploadedAttachments.push({
              fileName: file.name,
              storageKey: fileData.s3Key,
              mimeType: file.type,
              size: file.size,
            });
          }
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        notifyError(`Failed to upload ${file.name}`);
      }
    }

    if (uploadedAttachments.length > 0) {
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedAttachments],
      }));
      notifySuccess(`${uploadedAttachments.length} file(s) uploaded successfully`);
    }

    setUploading(false);
    e.target.value = "";
  };

  const handleRemoveAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
    notifySuccess("Attachment removed");
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title || formData.title.trim() === "") {
      newErrors.title = "Title is required";
    }

    if (!formData.content || formData.content.trim() === "") {
      newErrors.content = "Content is required";
    }

    // Check if at least one audience type checkbox is checked
    const hasAudienceTypeChecked = formData.audience.staff || formData.audience.customers || formData.audience.vendors;
    
    if (!hasAudienceTypeChecked) {
      newErrors.audience = "At least one audience type must be selected";
    } else {
      // If an audience type is checked, ensure at least one ID is selected
      const audienceErrors = [];
      
      // Check staff
      if (formData.audience.staff) {
        const staffIdsCount = Array.isArray(formData.audience.staffIds) ? formData.audience.staffIds.length : 0;
        if (staffIdsCount === 0) {
          audienceErrors.push("Please select at least one staff member");
        }
      }
      
      // Check customers
      if (formData.audience.customers) {
        const customerIdsCount = Array.isArray(formData.audience.customerIds) ? formData.audience.customerIds.length : 0;
        if (customerIdsCount === 0) {
          audienceErrors.push("Please select at least one customer");
        }
      }
      
      // Check vendors
      if (formData.audience.vendors) {
        const vendorIdsCount = Array.isArray(formData.audience.vendorIds) ? formData.audience.vendorIds.length : 0;
        if (vendorIdsCount === 0) {
          audienceErrors.push("Please select at least one vendor");
        }
      }
      
      if (audienceErrors.length > 0) {
        newErrors.audience = audienceErrors.join(". ");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Debug: Log current form state before validation
    console.log("Form submission - Current state:", {
      title: formData.title,
      content: formData.content,
      audience: {
        staff: formData.audience.staff,
        staffIds: formData.audience.staffIds,
        staffIdsLength: formData.audience.staffIds.length,
        customers: formData.audience.customers,
        customerIds: formData.audience.customerIds,
        customerIdsLength: formData.audience.customerIds.length,
        vendors: formData.audience.vendors,
        vendorIds: formData.audience.vendorIds,
        vendorIdsLength: formData.audience.vendorIds.length,
      }
    });

    if (!validateForm()) {
      notifyError("Please fill in all required fields");
      return;
    }

    setLoading(true);

    const businessId = selectedBusiness || adminInfo?.business_id;
    const trimmedTitle = formData.title?.trim() || "";
    const trimmedContent = formData.content?.trim() || "";
    // Try both id and _id as adminInfo structure may vary
    const creatorId = adminInfo?.id || adminInfo?._id;
    
    // Validate all required fields are present and non-empty
    if (!businessId || businessId.trim() === "") {
      setLoading(false);
      notifyError("Please select a business");
      return;
    }

    if (!trimmedTitle) {
      setLoading(false);
      notifyError("Title is required");
      return;
    }

    if (!trimmedContent) {
      setLoading(false);
      notifyError("Content is required");
      return;
    }

    if (!creatorId) {
      setLoading(false);
      console.error("AdminInfo structure:", adminInfo);
      notifyError("User information is missing. Please refresh the page and try again.");
      return;
    }

    try {
      const payload = {
        ...(id && { _id: id }),
        business_id: businessId,
        title: trimmedTitle,
        content: trimmedContent,
        attachments: formData.attachments || [],
        audience: formData.audience || {
          staff: false,
          staffIds: [],
          customers: false,
          customerIds: [],
          vendors: false,
          vendorIds: [],
        },
        status: formData.status || "draft",
        createdBy: creatorId,
      };

      console.log("Submitting announcement with payload:", {
        business_id: payload.business_id,
        title: payload.title,
        content: payload.content?.substring(0, 50) + "...",
        createdBy: payload.createdBy,
        status: payload.status,
      });

      const url = id
        ? `${Base_URL}/announcements/${id}`
        : `${Base_URL}/announcements`;
      const method = id ? "put" : "post";

      const response = await axios[method](url, payload, {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;

      if (response.data.status) {
        notifySuccess(
          id
            ? "Announcement updated successfully"
            : formData.status === "published"
            ? "Announcement published successfully"
            : "Announcement saved as draft"
        );
        setTimeout(() => {
          history.push("/announcements");
        }, 1000);
      } else {
        notifyError(response.data.error || "Failed to save announcement");
      }
    } catch (error) {
      console.error("Error saving announcement:", error);
      notifyError(error.response?.data?.error || "Failed to save announcement");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getSelectedCount = (type) => {
    if (type === "staff") return formData.audience.staffIds.length;
    if (type === "customers") return formData.audience.customerIds.length;
    if (type === "vendors") return formData.audience.vendorIds.length;
    return 0;
  };

  const formFields = [
    {
      label: "Business",
      name: "business",
      type: "select",
      required: true,
      value: selectedBusiness,
      onChange: (value) => {
        setSelectedBusiness(value);
        // Clear fetched lists and audience selections when business changes
        setStaffList([]);
        setCustomerList([]);
        setVendorList([]);
        setFormData((prev) => ({
          ...prev,
          audience: {
            staff: false,
            staffIds: [],
            customers: false,
            customerIds: [],
            vendors: false,
            vendorIds: [],
          },
        }));
      },
      disabled: isViewMode,
      options: [
        { value: "", label: "Select Business" },
        ...businesses.map((business) => ({
          value: business._id,
          label: business.name,
        })),
      ],
      helpText: "Select a business to load staff, customers, and vendors",
    },
    {
      label: "Title",
      name: "title",
      type: "text",
      required: true,
      placeholder: "Enter announcement title",
      value: formData.title,
      onChange: handleInputChange,
      disabled: isViewMode,
      error: errors.title,
    },
    {
      label: "Content",
      name: "content",
      type: "custom",
      required: true,
      component: () => (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content <span className="text-red-500">*</span>
          </label>
          <div 
            className="rich-text-editor-wrapper w-full border border-gray-300 rounded-lg shadow-sm bg-white hover:border-gray-400 transition-colors"
            style={{ marginBottom: "50px", minHeight: "200px" }}
          >
            <style>{`
              .rich-text-editor-wrapper {
                resize: vertical;
                overflow: auto;
              }
              .rich-text-editor-wrapper .ql-toolbar {
                border-top: none;
                border-left: none;
                border-right: none;
                border-bottom: 1px solid #e5e7eb;
                background-color: #f9fafb;
                padding: 12px;
                border-radius: 0.5rem 0.5rem 0 0;
              }
              .rich-text-editor-wrapper .ql-container {
                border: none;
                border-radius: 0 0 0.5rem 0.5rem;
                font-size: 14px;
                min-height: 150px;
                height: auto;
              }
              .rich-text-editor-wrapper .ql-editor {
                min-height: 150px;
                padding: 16px;
                color: #374151;
                line-height: 1.6;
              }
              .rich-text-editor-wrapper .ql-editor.ql-blank::before {
                color: #9ca3af;
                font-style: normal;
                left: 16px;
              }
              .rich-text-editor-wrapper .ql-toolbar .ql-stroke {
                stroke: #6b7280;
              }
              .rich-text-editor-wrapper .ql-toolbar .ql-fill {
                fill: #6b7280;
              }
              .rich-text-editor-wrapper .ql-toolbar button:hover,
              .rich-text-editor-wrapper .ql-toolbar button:focus,
              .rich-text-editor-wrapper .ql-toolbar button.ql-active {
                color: #4b5563;
              }
              .rich-text-editor-wrapper .ql-toolbar button:hover .ql-stroke,
              .rich-text-editor-wrapper .ql-toolbar button:focus .ql-stroke,
              .rich-text-editor-wrapper .ql-toolbar button.ql-active .ql-stroke {
                stroke: #4b5563;
              }
              .rich-text-editor-wrapper .ql-toolbar button:hover .ql-fill,
              .rich-text-editor-wrapper .ql-toolbar button:focus .ql-fill,
              .rich-text-editor-wrapper .ql-toolbar button.ql-active .ql-fill {
                fill: #4b5563;
              }
              .rich-text-editor-wrapper:focus-within {
                border-color: #9ca3af;
                box-shadow: 0 0 0 2px rgba(156, 163, 175, 0.1);
              }
            `}</style>
            <ReactQuill
              theme="snow"
              value={formData.content || ""}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, content: value }));
                setErrors((prev) => ({ ...prev, content: "" }));
              }}
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, 4, 5, 6, false] }],
                  ["bold", "italic", "underline", "strike"],
                  [{ list: "ordered" }, { list: "bullet" }],
                  [{ color: [] }, { background: [] }],
                  [{ align: [] }],
                  ["link"],
                  ["clean"],
                ],
              }}
              formats={[
                "header",
                "bold",
                "italic",
                "underline",
                "strike",
                "list",
                "bullet",
                "color",
                "background",
                "align",
                "link",
              ]}
              readOnly={isViewMode}
              placeholder="Enter announcement content..."
            />
          </div>
          {errors.content && (
            <p className="text-sm text-red-600 mt-1">{errors.content}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Use the toolbar above to format your announcement content with rich text editing.
          </p>
        </div>
      ),
    },
    {
      label: "Attachments",
      name: "attachments",
      type: "custom",
      component: () => (
        <div className="space-y-4">
          {!isViewMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Files
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">Max 10MB per file</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileChange}
                    disabled={uploading || isViewMode}
                  />
                </label>
              </div>
              {uploading && (
                <p className="mt-2 text-sm text-gray-500">Uploading files...</p>
              )}
            </div>
          )}

          {formData.attachments.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Attached Files ({formData.attachments.length})
              </label>
              <div className="space-y-2">
                {formData.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)} • {attachment.mimeType}
                        </p>
                      </div>
                    </div>
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="ml-2 p-1 text-red-600 hover:text-red-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
      fullWidth: true,
    },
    {
      label: "Audience",
      name: "audience",
      type: "custom",
      required: true,
      component: () => (
        <div className="space-y-3">
          {/* Staff */}
          <div>
            <div 
              className="flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                if (isViewMode) return;
                if (!formData.audience.staff) {
                  handleInputChange({ target: { name: "audience.staff", type: "checkbox", checked: true } });
                } else {
                  setShowStaffList(prev => !prev);
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="audience-staff"
                  name="audience.staff"
                  checked={formData.audience.staff}
                  onChange={handleInputChange}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isViewMode}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="audience-staff" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Staff</span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                {formData.audience.staff && (
                  <span className="text-sm text-blue-600 font-medium">
                    {getSelectedCount("staff")} selected
                  </span>
                )}
                {showStaffList ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            <InlineChecklist
              isOpen={showStaffList && formData.audience.staff}
              items={staffList}
              selectedIds={formData.audience.staffIds.map(id => String(id))}
              onToggle={(id, isSelected) => handleToggleItem("staff", id, isSelected)}
              searchTerm={staffSearch}
              onSearchChange={setStaffSearch}
              loading={loadingLists.staff}
              placeholder="Search staff by name or email..."
            />
          </div>

          {/* Customers */}
          <div>
            <div 
              className="flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                if (isViewMode) return;
                if (!formData.audience.customers) {
                  handleInputChange({ target: { name: "audience.customers", type: "checkbox", checked: true } });
                } else {
                  setShowCustomerList(prev => !prev);
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="audience-customers"
                  name="audience.customers"
                  checked={formData.audience.customers}
                  onChange={handleInputChange}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isViewMode}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="audience-customers" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Customers</span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                {formData.audience.customers && (
                  <span className="text-sm text-blue-600 font-medium">
                    {getSelectedCount("customers")} selected
                  </span>
                )}
                {showCustomerList ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            <InlineChecklist
              isOpen={showCustomerList && formData.audience.customers}
              items={customerList}
              selectedIds={formData.audience.customerIds.map(id => String(id))}
              onToggle={(id, isSelected) => handleToggleItem("customers", id, isSelected)}
              searchTerm={customerSearch}
              onSearchChange={setCustomerSearch}
              loading={loadingLists.customers}
              placeholder="Search customers by name or email..."
            />
          </div>

          {/* Vendors */}
          <div>
            <div 
              className="flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                if (isViewMode) return;
                if (!formData.audience.vendors) {
                  handleInputChange({ target: { name: "audience.vendors", type: "checkbox", checked: true } });
                } else {
                  setShowVendorList(prev => !prev);
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="audience-vendors"
                  name="audience.vendors"
                  checked={formData.audience.vendors}
                  onChange={handleInputChange}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isViewMode}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="audience-vendors" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Vendors</span>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                {formData.audience.vendors && (
                  <span className="text-sm text-blue-600 font-medium">
                    {getSelectedCount("vendors")} selected
                  </span>
                )}
                {showVendorList ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            <InlineChecklist
              isOpen={showVendorList && formData.audience.vendors}
              items={vendorList}
              selectedIds={formData.audience.vendorIds.map(id => String(id))}
              onToggle={(id, isSelected) => handleToggleItem("vendors", id, isSelected)}
              searchTerm={vendorSearch}
              onSearchChange={setVendorSearch}
              loading={loadingLists.vendors}
              placeholder="Search vendors by name or email..."
            />
          </div>
          
          {errors.audience && (
            <p className="text-sm text-red-600">{errors.audience}</p>
          )}
        </div>
      ),
    },
    {
      label: "Status",
      name: "status",
      type: "custom",
      required: true,
      component: () => (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              disabled={isViewMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="draft">Draft</option>
              <option value="published">Publish</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Save as draft to work on it later, or publish to send it immediately
            </p>
          </div>
        </div>
      ),
    },
  ];

  const getPageTitle = () => {
    if (isViewMode) return "View Announcement";
    if (isEditMode) return "Edit Announcement";
    return "Create Announcement";
  };

  const getSaveButtonText = () => {
    if (isViewMode) return "View";
    if (isEditMode) return "Update Announcement";
    return formData.status === "published" ? "Publish" : "Save as Draft";
  };

  if (fetching) {
    return (
      <RouteActionGate
        title="Announcements"
        requiredPermission={requiredPermission}
      >
        <div className="p-6 bg-white min-h-screen flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </RouteActionGate>
    );
  }

  return (
    <RouteActionGate
      title="Announcements"
      requiredPermission={requiredPermission}
    >
      <div className="py-6 px-6 min-h-screen">
        <PageHeader
          title={getPageTitle()}
          showBackButton
          backFallbackPath="/announcements"
        />
        <Form
          formFields={formFields}
          handleSubmit={handleSubmit}
          handleCancel={exitAnnouncementsScreen}
          loading={loading}
          buttonColor={buttonColor}
          isOpen={true}
          saveButtonText={getSaveButtonText()}
          cancelButtonText="Cancel"
          noDefaultValidation={true}
          showFooterButtons={!isViewMode}
          fieldsPerRow={1}
        />
      </div>
    </RouteActionGate>
  );
};

export default CreateAnnouncement;
