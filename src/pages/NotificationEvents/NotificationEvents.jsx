import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
} from "react";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout.jsx";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { CKEditor } from "ckeditor4-react";
import {
  FiPlus as PlusIcon,
  FiEdit as PencilIcon,
  FiX as XMarkIcon,
  FiBell,
  FiUsers,
  FiSettings,
  FiActivity,
} from "react-icons/fi";
import { Button, SummaryCards, DropdownBasic, ActionButtons } from "@/page-layouts/index";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import PortalButton from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { PlusIcon as PortalPlusIcon } from "@/customer/components/ui/icons";
import { getPredefinedEventCodes } from "./predefinedEventCodes";
import GlobalBusinessServices from "@/services/GlobalBusinessServices";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { buildNotificationEmailPreviewHtml } from "@/utils/notificationEmailWrapper";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Matches backend: business group companyName (business name). */
function buildEmailFromNamePlaceholder(businessDoc) {
  if (!businessDoc || typeof businessDoc !== "object") return "";
  const group = businessDoc.businessGroup?.companyName
    ? String(businessDoc.businessGroup.companyName).trim()
    : "";
  const biz = businessDoc.name ? String(businessDoc.name).trim() : "";
  if (group && biz) return `${group} (${biz})`;
  if (biz) return biz;
  if (group) return group;
  return "";
}

/** True when the API row has an explicit saved value (show as-is; do not replace with computed default). */
function eventHasSavedEmailFromName(ev) {
  return (
    ev &&
    ev.emailFromName != null &&
    String(ev.emailFromName).trim() !== ""
  );
}

const NotificationEvents = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { moduleLabelsVersion } = useModuleLabels();
  const predefinedEventCodes = useMemo(
    () => getPredefinedEventCodes(),
    [moduleLabelsVersion],
  );

  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();
  const assignedBusinessIds = useMemo(() => {
    const fromAdmin = adminInfo?.businesses;
    if (Array.isArray(fromAdmin) && fromAdmin.length > 0) {
      return fromAdmin
        .map((b) => (b && typeof b === "object" && b._id ? b._id : b))
        .map(String);
    }
    try {
      const raw = localStorage.getItem("businesses");
      const parsed = raw ? JSON.parse(raw) : [];
      return (Array.isArray(parsed) ? parsed : [])
        .map((b) => (b && typeof b === "object" && b._id ? b._id : b))
        .map(String);
    } catch {
      return [];
    }
  }, [adminInfo?.businesses]);

  const buttonColor = useButtonColor();
  const [organization, setOrganization] = useState(null); // Set initially as null
  const [isOrgLoaded, setIsOrgLoaded] = useState(false); // To track when organization is loaded
  const location = useLocation();
  const [roleUserSearch, setRoleUserSearch] = useState("");
  const [expandedRoles, setExpandedRoles] = useState([]);
  /** Super admin: global PCI templates. Others: single assigned business events. */
  const activeTab = isSuperAdmin ? "default" : "business";
  const [businessName, setBusinessName] = useState("");
  const [modalBusinessLabel, setModalBusinessLabel] = useState("");
  const [modalEmailFromNamePlaceholder, setModalEmailFromNamePlaceholder] =
    useState("");
  const businessNameFetchSeq = useRef(0);
  const modalNameFetchSeq = useRef(0);

  const canAccessSelectedBusiness = useMemo(
    () =>
      isSuperAdmin ||
      (organization &&
        assignedBusinessIds.includes(String(organization))),
    [isSuperAdmin, organization, assignedBusinessIds],
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true); // Organization has been fetched
  }, [location]);

  // State management
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);

  // Filter states
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  useEffect(() => {
    if (!isOrgLoaded) return;
    if (isSuperAdmin && activeTab === "default") {
      fetchEvents(organization || "");
      if (organization) fetchBusinessName(organization);
      return;
    }
    if (organization) {
      fetchEvents(organization);
      fetchBusinessName(organization);
    }
  }, [organization, isOrgLoaded, isSuperAdmin, activeTab]);

  // Form states
  const [formData, setFormData] = useState({
    eventCode: "",
    name: "",
    business: organization,
    userRoles: [],
    specificUsers: [],
    notifyAllUsers: false,
    customEmailRecipients: [],
    sendExternalEmails: false,
    additionalEmails: "",
    defaultTitle: "",
    defaultBody: "",
    sendNotification: true,
    sendEmail: false,
    emailSubject: "",
    emailBody: "",
    emailFromName: "",
    description: "",
  });

  useEffect(() => {
    if (!showEmailPreview || !formData.emailBody?.trim()) {
      setEmailPreviewHtml("");
      setEmailPreviewLoading(false);
      return undefined;
    }

    let cancelled = false;
    setEmailPreviewLoading(true);

    buildNotificationEmailPreviewHtml(formData.emailBody)
      .then((html) => {
        if (!cancelled) {
          setEmailPreviewHtml(html);
          setEmailPreviewLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmailPreviewHtml("");
          setEmailPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showEmailPreview, formData.emailBody]);

  // Available data
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);

  // ReactQuill configuration for email body
  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  };

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "font",
    "align",
    "link",
  ];

  // Statistics
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    inactiveEvents: 0,
  });

  // Group event codes by category for better organization
  const groupedEventCodes = predefinedEventCodes.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {});

  // Create options for DropdownBasic with grouped structure
  const eventCodeOptions = Object.entries(groupedEventCodes).map(
    ([category, events]) => ({
      label: `${category}`,
      options: events.map((event) => ({
        value: event.value,
        label: event.label,
        category: event.category,
      })),
    }),
  );

  // // Create a flat array of event code options for the dropdown
  // const flatEventCodeOptions = eventCodeOptions.flatMap(
  //   (group) => group.options
  // );

  // Summary cards data
  const summaryCardsData = [
    {
      title: "Total Events",
      value: stats.totalEvents,
      iconColor: "blue-100",
      backgroundColor: "blue-50",
    },
    {
      title: "Active Events",
      value: stats.activeEvents,
      iconColor: "blue-200",
      backgroundColor: "blue-100",
      isHighlighted: true,
      highlightColor: "blue-50",
    },
    {
      title: "Inactive Events",
      value: stats.inactiveEvents,
      iconColor: "gray-100",
      backgroundColor: "gray-50",
    },
  ];

  // Fetch data
  useEffect(() => {
    if (isSuperAdmin && activeTab === "default") {
      fetchEvents(organization || "");
      return;
    }
    if (organization) {
      fetchEvents(organization);
    }
  }, [
    currentPage,
    filterStatus,
    organization,
    resultsPerPage,
    activeTab,
    searchTerm,
    isSuperAdmin,
  ]);

  const fetchEvents = async (businessId) => {
    setLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const payload = {
        businessId: activeTab === "default" ? "" : businessId,
        isActive: filterStatus === "all" ? undefined : filterStatus,
        page: currentPage,
        limit: resultsPerPage,
        search: searchTerm,
      };

      console.log("Fetching events with payload:", payload);

      const response = await axios.post(
        `${Base_URL}/notification-events/get-all`,
        payload,
        { headers },
      );

      if (response.data.status) {
        setEvents(response.data.data || []);
        setTotalRecords(response.data.totalRecords || 0);

        // Calculate stats
        const totalEvents = response.data.totalRecords || 0;
        const activeEvents = response.data.activeEvents || 0;
        const inactiveEvents = response.data.inactiveEvents || 0;

        setStats({
          totalEvents,
          activeEvents,
          inactiveEvents,
        });

        console.log("Events fetched successfully:", {
          events: response.data.data?.length || 0,
          totalRecords: response.data.totalRecords,
          currentPage,
          resultsPerPage,
        });
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      notifyError("Failed to fetch notification events");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessName = async (businessId) => {
    if (!businessId) return;

    const seq = ++businessNameFetchSeq.current;
    try {
      const response = await GlobalBusinessServices.getBusinessById(
        `${businessId}`,
      );

      if (seq !== businessNameFetchSeq.current) return;

      if (response.data && response.data.name) {
        setBusinessName(response.data.name || "Business");
      }
    } catch (error) {
      console.error("Error fetching business name:", error);
      if (seq === businessNameFetchSeq.current) {
        setBusinessName("Business");
      }
    }
  };

  const fetchRolesAndUsers = async (businessId) => {
    if (!businessId) return;

    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    let payload = {
      FilterStatus: "",
      FilterName: "",
      page: 1,
      limit: 99999,
      businessId: businessId,
    };
    axios
      .post(`${Base_URL}/UserRoles/get_all`, payload, { headers })
      .then((response) => {
        setRoles(response.data.data || []);
      })
      .catch((error) => {
        console.error("Error fetching roles:", error);
        setRoles([]);
      });

    axios
      .post(`${Base_URL}/SystemUsers/get_all`, payload, { headers })
      .then((response) => {
        setUsers(response.data.data || []);
      })
      .catch((error) => {
        console.error("Error fetching users:", error);
        setUsers([]);
        notifyError("Failed to fetch users data");
      });
  };

  /** Business whose roles/users populate the modal (edit = event's org; create = selectedOrg). */
  const recipientsBusinessId = useMemo(() => {
    if (!isModalOpen) return null;
    if (isSuperAdmin && !selectedEvent && activeTab === "default") {
      return null;
    }
    if (selectedEvent) {
      const raw = formData.business;
      if (raw != null && String(raw).trim() !== "") {
        return String(raw);
      }
      return null;
    }
    return organization ? String(organization) : null;
  }, [
    isModalOpen,
    selectedEvent,
    formData.business,
    organization,
    isSuperAdmin,
    activeTab,
  ]);

  useEffect(() => {
    if (!recipientsBusinessId) return;
    fetchRolesAndUsers(recipientsBusinessId);
  }, [recipientsBusinessId]);

  // When modal shows a business-scoped event, load the exact name for the subtitle (avoids stale tab title).
  // Also resolve "Email from" preview: group companyName (business name), same as the server when the field is empty.
  useEffect(() => {
    if (!isModalOpen) {
      setModalBusinessLabel("");
      setModalEmailFromNamePlaceholder("");
      return;
    }
    if (isSuperAdmin && activeTab === "default" && !selectedEvent) {
      setModalBusinessLabel("");
      if (organization) {
        const seq = ++modalNameFetchSeq.current;
        (async () => {
          try {
            const response = await GlobalBusinessServices.getBusinessById(
              String(organization),
            );
            if (seq !== modalNameFetchSeq.current) return;
            const ph = buildEmailFromNamePlaceholder(response.data);
            setModalEmailFromNamePlaceholder(
              ph || "Group name (Business name)",
            );
          } catch {
            if (seq === modalNameFetchSeq.current) {
              setModalEmailFromNamePlaceholder(
                "Each business: group name (business name)",
              );
            }
          }
        })();
      } else {
        setModalEmailFromNamePlaceholder(
          "Each business: group name (business name)",
        );
      }
      return;
    }
    const bizRaw = formData.business;
    const hasBiz = bizRaw != null && String(bizRaw).trim() !== "";
    if (selectedEvent && !hasBiz) {
      setModalBusinessLabel("Global default");
      setModalEmailFromNamePlaceholder(
        "Each organization: group name (business name)",
      );
      return;
    }
    const id = String(hasBiz ? bizRaw : organization || "");
    if (!id) {
      setModalBusinessLabel("");
      setModalEmailFromNamePlaceholder("");
      return;
    }
    const seq = ++modalNameFetchSeq.current;
    (async () => {
      try {
        const response = await GlobalBusinessServices.getBusinessById(id);
        if (seq !== modalNameFetchSeq.current) return;
        setModalBusinessLabel(response.data?.name || "Business");
        const ph = buildEmailFromNamePlaceholder(response.data);
        setModalEmailFromNamePlaceholder(
          ph || "Group name (Business name)",
        );
        // Prefill "From" with the same string the server uses when the field is empty,
        // unless this record already has an explicit saved value (then keep that).
        if (!eventHasSavedEmailFromName(selectedEvent)) {
          setFormData((prev) => ({
            ...prev,
            emailFromName: ph || "",
          }));
        }
      } catch {
        if (seq === modalNameFetchSeq.current) {
          setModalBusinessLabel("Business");
          setModalEmailFromNamePlaceholder("Group name (Business name)");
        }
      }
    })();
  }, [
    isModalOpen,
    isSuperAdmin,
    activeTab,
    selectedEvent,
    formData.business,
    organization,
  ]);

  // Fetch roles and users when organization changes (page context, modal closed)
  useEffect(() => {
    if (organization && !isModalOpen) {
      fetchRolesAndUsers(organization);
    }
  }, [organization, isModalOpen]);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleEventCodeChange = (e) => {
    const value = e.target.value;

    if (value && value !== "") {
      // Auto-fill other fields based on selected event code
      const selectedEvent = predefinedEventCodes.find(
        (evt) => evt.value === value,
      );
      if (selectedEvent) {
        setFormData((prev) => ({
          ...prev,
          eventCode: value,
          name: selectedEvent.label,
          defaultTitle: `${selectedEvent.label} — {{refNo}}`,
          defaultBody: `${selectedEvent.label} ({{refNo}})`,
        }));
      }
    }

    // Clear error for this field
    if (errors.eventCode) {
      setErrors((prev) => ({ ...prev, eventCode: "" }));
    }
  };

  const handleRoleChange = (roleId, checked) => {
    const role = roles.find((r) => String(r._id) === String(roleId));
    if (!role) return;

    setFormData((prev) => {
      if (checked) {
        const roleUserIds = users
          .filter((u) => u.role && String(u.role._id) === String(roleId))
          .map((u) => String(u._id));
        return {
          ...prev,
          userRoles: prev.userRoles.map(String).includes(String(roleId))
            ? prev.userRoles
            : [...prev.userRoles, roleId],
          // Drop individual selections already covered by this role
          specificUsers: prev.specificUsers.filter(
            (id) => !roleUserIds.includes(String(id)),
          ),
        };
      }

      return {
        ...prev,
        userRoles: prev.userRoles.filter((id) => String(id) !== String(roleId)),
      };
    });
  };

  const handleUserChange = (userId, checked) => {
    const user = users.find((u) => String(u._id) === String(userId));
    if (!user) return;

    setFormData((prev) => {
      if (checked) {
        return {
          ...prev,
          specificUsers: prev.specificUsers.map(String).includes(String(userId))
            ? prev.specificUsers
            : [...prev.specificUsers, userId],
        };
      }

      return {
        ...prev,
        specificUsers: prev.specificUsers.filter((id) => String(id) !== String(userId)),
      };
    });
  };

  const parseAdditionalEmails = (text) => {
    if (text == null || String(text).trim() === "") return [];
    return String(text)
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const resetForm = () => {
    setFormData({
      eventCode: "",
      name: "",
      business:
        isSuperAdmin && activeTab === "default" ? "" : organization,
      userRoles: [],
      specificUsers: [],
      notifyAllUsers: false,
      customEmailRecipients: [],
      sendExternalEmails: false,
      additionalEmails: "",
      defaultTitle: "",
      defaultBody: "",
      sendNotification: true,
      sendEmail: false,
      emailSubject: "",
      emailBody: "",
      emailFromName: "",
      description: "",
    });
    setErrors({});
  };

  const openModal = (event = null) => {
    if (event) {
      if (!canUpdate) {
        notifyError("You do not have permission to edit notification events.");
        return;
      }
      let businessId = "";
      if (event.business) {
        if (typeof event.business === "string") {
          businessId = event.business;
        } else if (event.business._id) {
          businessId = event.business._id;
        }
      }

      if (
        !isSuperAdmin &&
        (!businessId ||
          !assignedBusinessIds.includes(String(businessId)))
      ) {
        notifyError(
          "You can only edit notification events for your own business.",
        );
        return;
      }

      const customList = event.customEmailRecipients || [];
      setFormData({
        eventCode: event.eventCode,
        name: event.name,
        business: businessId,
        userRoles: event.userRoles?.map((role) => role._id) || [],
        specificUsers: event.specificUsers?.map((user) => user._id) || [],
        notifyAllUsers: event.notifyAllUsers,
        customEmailRecipients: customList,
        sendExternalEmails: Array.isArray(customList) && customList.length > 0,
        additionalEmails: Array.isArray(customList)
          ? customList.join("\n")
          : "",
        defaultTitle: event.defaultTitle,
        defaultBody: event.defaultBody,
        sendNotification: event.sendNotification,
        sendEmail: event.sendEmail,
        emailSubject: event.emailSubject,
        emailBody: event.emailBody,
        emailFromName: eventHasSavedEmailFromName(event)
          ? String(event.emailFromName).trim()
          : "",
        description: event.description || "",
      });
      setSelectedEvent(event);
    } else {
      if (!canAdd) {
        notifyError("You do not have permission to add notification events.");
        return;
      }
      if (!isSuperAdmin) {
        if (!organization || !canAccessSelectedBusiness) {
          notifyError(
            "Select your business in the URL (selectedOrg) to add an event.",
          );
          return;
        }
        setFormData({
          eventCode: "",
          name: "",
          business: organization,
          userRoles: [],
          specificUsers: [],
          notifyAllUsers: false,
          customEmailRecipients: [],
          sendExternalEmails: false,
          additionalEmails: "",
          defaultTitle: "",
          defaultBody: "",
          sendNotification: true,
          sendEmail: false,
          emailSubject: "",
          emailBody: "",
          emailFromName: "",
          description: "",
        });
        setErrors({});
      } else {
        resetForm();
      }
      setSelectedEvent(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setSelectedEvent(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.eventCode.trim())
      newErrors.eventCode = "Event code is required";
    if (!formData.name.trim()) newErrors.name = "Event name is required";
    if (!formData.defaultTitle.trim())
      newErrors.defaultTitle = "Default title is required";
    if (!formData.defaultBody.trim())
      newErrors.defaultBody = "Default body is required";

    const extraList = formData.sendEmail && formData.sendExternalEmails
      ? parseAdditionalEmails(formData.additionalEmails)
      : [];
    const deployTemplateToAll =
      isSuperAdmin && activeTab === "default" && !selectedEvent;
    const hasRecipients =
      formData.notifyAllUsers ||
      (formData.userRoles && formData.userRoles.length > 0) ||
      (formData.specificUsers && formData.specificUsers.length > 0) ||
      extraList.length > 0;
    if (!hasRecipients && !deployTemplateToAll) {
      newErrors.recipients =
        "Choose at least one: all users, role(s), specific user(s), and/or custom email(s)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if ((selectedEvent && !canUpdate) || (!selectedEvent && !canAdd)) {
      notifyError(
        selectedEvent
          ? "You do not have permission to update notification events."
          : "You do not have permission to add notification events.",
      );
      return;
    }

    if (!validateForm()) {
      notifyError("Please correct the errors in the form");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const deployTemplateToAll =
        isSuperAdmin && activeTab === "default" && !selectedEvent;

      const hasExplicitBusiness =
        formData.business != null && String(formData.business).trim() !== "";

      const resolvedBusiness = !isSuperAdmin
        ? organization
        : deployTemplateToAll
          ? null
          : hasExplicitBusiness
            ? formData.business
            : null;

      if (
        !isSuperAdmin &&
        (!resolvedBusiness ||
          !assignedBusinessIds.includes(String(resolvedBusiness)))
      ) {
        notifyError("You can only save notification events for your business.");
        setIsSubmitting(false);
        return;
      }

      const normalizedUserRoles = Array.isArray(formData.userRoles)
        ? formData.userRoles
            .map((role) =>
              typeof role === "object" ? role?._id || role?.value : role,
            )
            .filter(Boolean)
        : [];
      const normalizedSpecificUsers = Array.isArray(formData.specificUsers)
        ? formData.specificUsers
            .map((user) =>
              typeof user === "object" ? user?._id || user?.value : user,
            )
            .filter(Boolean)
        : [];

      const payload = {
        ...formData,
        business: resolvedBusiness,
        notifyAllUsers:
          typeof formData.notifyAllUsers === "object" &&
          formData.notifyAllUsers?.target
            ? Boolean(formData.notifyAllUsers.target.checked)
            : Boolean(formData.notifyAllUsers),
        userRoles: normalizedUserRoles,
        specificUsers: normalizedSpecificUsers,
        customEmailRecipients: formData.sendEmail && formData.sendExternalEmails
          ? parseAdditionalEmails(formData.additionalEmails)
          : [],
      };

      if (deployTemplateToAll) {
        payload.deployTemplateToAllBusinesses = true;
        payload.userRoles = [];
        payload.specificUsers = [];
        payload.notifyAllUsers = false;
        payload.customEmailRecipients = [];
      }

      delete payload.sendExternalEmails;
      delete payload.additionalEmails;

      const url = selectedEvent
        ? `${Base_URL}/notification-events/update/${selectedEvent._id}`
        : `${Base_URL}/notification-events/create`;

      const method = selectedEvent ? "put" : "post";

      const response = await axios[method](url, payload, { headers });

      if (response.data.status) {
        notifySuccess(
          response.data.message ||
            (selectedEvent
              ? "Notification event updated successfully!"
              : "Notification event created successfully!"),
        );
        closeModal();
        fetchEvents(organization);
      } else {
        notifyError(response.data.message || "Operation failed");
      }
    } catch (error) {
      console.error("Error saving event:", error);
      notifyError(
        error.response?.data?.message || "Failed to save notification event",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!canDelete) {
      notifyError("You do not have permission to delete notification events.");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = {
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const response = await axios.delete(
        `${Base_URL}/notification-events/delete/${selectedEvent._id}`,
        { headers },
      );

      if (response.data.status) {
        notifySuccess("Notification event deleted successfully!");
        setIsDeleteModalOpen(false);
        setSelectedEvent(null);
        fetchEvents(organization);
      } else {
        notifyError(response.data.message || "Failed to delete event");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      notifyError(
        error.response?.data?.message || "Failed to delete notification event",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEventStatus = async (eventId) => {
    if (!canUpdate) {
      notifyError("You do not have permission to update notification events.");
      return;
    }
    try {
      const headers = {
        authorization: `Bearer ${adminInfo?.token}`,
      };

      const response = await axios.put(
        `${Base_URL}/notification-events/toggle-status/${eventId}`,
        {},
        { headers },
      );

      if (response.data.status) {
        notifySuccess(response.data.message);
        fetchEvents(organization);
      } else {
        notifyError(response.data.message || "Failed to toggle status");
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      notifyError("Failed to toggle event status");
    }
  };

  // Helper to highlight search matches
  function highlightMatch(text, search) {
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200 rounded px-1">
          {part}
        </span>
      ) : (
        part
      ),
    );
  }

  const clearAllFilters = () => {
    setFilterStatus("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const portalFilterValues = {
    status: filterStatus === "all" ? "" : filterStatus,
  };

  const portalFilters = [
    {
      key: "status",
      placeholder: "All Status",
      options: [
        { value: "", label: "All Status" },
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
    },
  ];

  const handlePortalFilterChange = (key, value) => {
    if (key === "status") {
      setFilterStatus(value || "all");
      setCurrentPage(1);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Event Name",
        width: "28%",
        render: (event) => (
          <>
            <div className="epc-cell__primary">{event.name || "—"}</div>
            {event.description?.trim() ? (
              <div
                className="epc-cell__secondary"
                title={event.description.trim()}
              >
                {event.description.trim()}
              </div>
            ) : (
              <div className="epc-cell__secondary">No description</div>
            )}
          </>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "10%",
        render: (event) => (
          <StatusPill
            status={event.isActive ? "Active" : "Inactive"}
            tone={event.isActive ? "success" : "danger"}
          />
        ),
      },
      {
        key: "recipients",
        header: "Recipients",
        width: "22%",
        render: (event) => {
          const roleNames =
            event.userRoles
              ?.map((role) => role?.name)
              .filter(Boolean)
              .join(", ") || "";
          const userNames =
            event.specificUsers
              ?.map((user) => user?.name || user?.email)
              .filter(Boolean)
              .join(", ") || "";
          const customEmails =
            event.customEmailRecipients
              ?.map((email) => String(email || "").trim())
              .filter(Boolean)
              .join(", ") || "";

          return (
            <div className="flex min-w-0 flex-col gap-1">
              {event.notifyAllUsers ? (
                <span className="epc-cell__secondary">
                  All users: every active user in this business
                </span>
              ) : null}
              {roleNames ? (
                <span className="epc-cell__secondary" title={roleNames}>
                  Roles: {roleNames}
                </span>
              ) : null}
              {userNames ? (
                <span className="epc-cell__secondary" title={userNames}>
                  Users: {userNames}
                </span>
              ) : null}
              {customEmails ? (
                <span className="epc-cell__secondary" title={customEmails}>
                  Custom emails: {customEmails}
                </span>
              ) : null}
              {!event.notifyAllUsers &&
              !roleNames &&
              !userNames &&
              !customEmails ? (
                <span className="epc-cell__secondary">No recipients</span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "notifications",
        header: "Notifications",
        width: "12%",
        render: (event) => (
          <StatusPill
            status={event.sendNotification ? "Enabled" : "Disabled"}
            tone={event.sendNotification ? "success" : "neutral"}
          />
        ),
      },
      {
        key: "email",
        header: "Email",
        width: "12%",
        render: (event) => (
          <StatusPill
            status={event.sendEmail ? "Enabled" : "Disabled"}
            tone={event.sendEmail ? "success" : "neutral"}
          />
        ),
      },
      {
        key: "actions",
        header: "Action",
        width: "14%",
        align: "right",
        render: (event) => (
          <ActionButtons
            maxVisibleActions={2}
            items={[
              {
                action: ACTION_BUTTON_TYPES.EDIT,
                title: "Edit Event",
                onClick: () => openModal(event),
                permission: canUpdate,
              },
              {
                action: ACTION_BUTTON_TYPES.CHANGE_STATUS,
                title: event.isActive
                  ? "Deactivate Event"
                  : "Activate Event",
                onClick: () => toggleEventStatus(event._id),
                permission: canUpdate,
              },
              {
                action: ACTION_BUTTON_TYPES.DELETE,
                title: "Delete Event",
                onClick: () => {
                  setSelectedEvent(event);
                  setIsDeleteModalOpen(true);
                },
                permission: canDelete,
              },
            ]}
          />
        ),
      },
    ],
    [canDelete, canUpdate],
  );

  if (adminInfo?.token && adminInfo?.role && !isSuperAdmin) {
    if (!organization) {
      return (
        <AppLayout>
          <Header />
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-8 max-w-lg mx-auto text-center text-gray-700">
            <h1 className="text-lg font-semibold">Select a business</h1>
            <p className="mt-2 text-sm">
              Open Notification Events from Settings with a business selected
              (URL query <span className="font-mono">selectedOrg=...</span>), or
              you will not see your organization&apos;s events.
            </p>
          </div>
        </AppLayout>
      );
    }
    if (!canAccessSelectedBusiness) {
      return (
        <AppLayout>
          <Header />
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-8 max-w-lg mx-auto text-center text-gray-700">
            <h1 className="text-lg font-semibold">Access restricted</h1>
            <p className="mt-2 text-sm">
              You can only manage notification events for businesses assigned to
              your account. This organization is not in your list.
            </p>
          </div>
        </AppLayout>
      );
    }
  }

  return (
    <AppLayout>
      <Header />
      <div className="h-full max-h-[90vh] overflow-y-auto pb-[120px]">
        <EpcPage
          flush
          title="Notification Events"
          subtitle={
            isSuperAdmin
              ? "PCI global notification templates. Deploying from here creates per-business copies with empty recipients."
              : "Manage event triggers, recipients, push notifications, and email delivery for your business."
          }
          action={
            canAccessSelectedBusiness && canAdd ? (
              <PortalButton onClick={() => openModal()}>
                <PortalPlusIcon size={15} />
                Add Event
              </PortalButton>
            ) : null
          }
        >
          {!(isSuperAdmin && activeTab === "default") && <SettingsOrgBanner />}

          {isSuperAdmin ? (
            <p className="mb-2 text-sm font-semibold text-gray-900">PCI</p>
          ) : null}

          <SummaryCards
            cards={summaryCardsData}
            columnsCount={3}
            loading={loading && events.length === 0}
          />

          <FilterBar
            subtitle="Narrow by status or search event names."
            searchPlaceholder="Search events..."
            searchValue={searchTerm}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            values={portalFilterValues}
            onChange={handlePortalFilterChange}
            onReset={clearAllFilters}
            filters={portalFilters}
          />

          <Card>
            <CardHeader
              title="Notification Events"
              subtitle={
                loading ? "Loading…" : `${totalRecords} total events`
              }
            />
            <PortalDataTable
              columns={columns}
              rows={loading ? [] : events}
              rowKey="_id"
              emptyMessage={
                loading
                  ? "Loading notification events…"
                  : "No notification events found"
              }
            />
            {!loading && totalRecords > 0 ? (
              <Pagination
                page={currentPage}
                pageSize={resultsPerPage}
                total={totalRecords}
                itemLabel="events"
                onPageChange={setCurrentPage}
                onPageSizeChange={(perPage) => {
                  setResultsPerPage(perPage);
                  setCurrentPage(1);
                }}
              />
            ) : null}
          </Card>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity"
                aria-hidden="true"
              >
                <div className="absolute inset-0 bg-slate-500/25 backdrop-blur-sm"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl ring-1 ring-slate-900/10 transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
                {/* Modal Header */}
                <div
                  className="relative border-b px-8 py-6"
                  style={{
                    borderColor: "var(--blue-100)",
                    background: `linear-gradient(to right, var(--blue-50), rgba(var(--p-blue-rgb), 0.06), var(--blue-50))`,
                  }}
                >
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div
                          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm ring-1 ring-[var(--blue-100)]"
                        >
                          {selectedEvent ? (
                            <PencilIcon
                              className="w-6 h-6"
                              style={{ color: "var(--p-blue)" }}
                            />
                          ) : (
                            <PlusIcon
                              className="w-6 h-6"
                              style={{ color: "var(--p-blue)" }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-xl font-bold text-slate-900">
                          {selectedEvent
                            ? "Edit Notification Event"
                            : "Create New Notification Event"}
                        </h3>
                        <p className="text-sm mt-1 text-slate-600">
                          {selectedEvent
                            ? "Update event configuration and settings"
                            : "Configure notification triggers and recipients"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium ring-1 ring-[var(--blue-200)]"
                            style={{ color: "var(--p-blue)" }}
                          >
                            {isSuperAdmin &&
                            activeTab === "default" &&
                            !selectedEvent
                              ? "Template: all businesses"
                              : selectedEvent &&
                                  (formData.business == null ||
                                    String(formData.business).trim() === "")
                                ? "Global default (no business)"
                                : `Business: ${
                                    modalBusinessLabel || businessName || "Selected"
                                  }`}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                            {formData.sendNotification
                              ? "Push enabled"
                              : "Push disabled"}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                            {formData.sendEmail
                              ? "Email enabled"
                              : "Email disabled"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <button
                        onClick={closeModal}
                        className="text-slate-500 hover:text-slate-800 transition-colors duration-200 p-2 rounded-xl hover:bg-white"
                      >
                        <XMarkIcon className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="max-h-[72vh] overflow-y-auto bg-slate-50 px-8 py-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative">
                      <p
                        className={`text-gray-500 justify-end text-xs mt-2 text-right w-full absolute top-1 right-1`}
                      >
                        {isSuperAdmin &&
                        activeTab === "default" &&
                        !selectedEvent ? (
                          "Creates the same template for every business with no recipients — each business adds recipients later."
                        ) : selectedEvent &&
                          (formData.business == null ||
                            String(formData.business).trim() === "") ? (
                          "Global default event — not scoped to a business. Business tabs hold per-org copies with their own recipients."
                        ) : (
                          <>
                            Only for the Business{" "}
                            <span className="text-p-blue">
                              {modalBusinessLabel || businessName || "…"}
                            </span>
                          </>
                        )}
                      </p>
                      {isSuperAdmin &&
                        activeTab === "default" &&
                        !selectedEvent && (
                          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Deploying from <strong>PCI</strong> copies
                            notification and email content to all businesses.
                            Recipients stay empty until configured per business.
                          </div>
                        )}
                      <div className="flex items-center mb-6">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                          <FiSettings className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            Basic Information
                          </h4>
                          <p className="text-gray-500 text-sm">
                            Configure the event details and identification
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Event Code *
                          </label>
                          {selectedEvent ? (
                            <div className="relative">
                              <input
                                name="eventCode"
                                value={formData.eventCode}
                                disabled={true}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-gray-600 font-mono text-sm"
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              </div>
                            </div>
                          ) : (
                            <DropdownBasic
                              options={eventCodeOptions}
                              value={formData.eventCode}
                              grouped={true}
                              onChange={(value) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  eventCode: value,
                                }));
                                handleEventCodeChange({ target: { value } });
                              }}
                              placeholder="Search and select event code..."
                              error={errors.eventCode}
                              shouldShowError={!!errors.eventCode}
                              isSearchable={true}
                            />
                          )}
                          {errors.eventCode && (
                            <p className="text-red-500 text-sm mt-2 flex items-center">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                              {errors.eventCode}
                            </p>
                          )}
                          {selectedEvent && (
                            <p className="text-gray-500 text-xs mt-2 flex items-center">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                              Event code cannot be changed once created
                            </p>
                          )}
                          {!selectedEvent && (
                            <p className="text-gray-500 text-xs mt-2 flex items-center">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                              Search and select from categorized event codes
                            </p>
                          )}
                          </div>
                          <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Event Name *
                          </label>
                          <input
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., send_management_approval"
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-mono text-sm ${
                              errors.name
                                ? "border-red-300 bg-red-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          />
                          {errors.name && (
                            <p className="text-red-500 text-sm mt-2 flex items-center">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                              {errors.name}
                            </p>
                          )}
                          </div>
                        </div>
                        <div className="w-full min-w-0">
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            What this event does
                          </label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="When it runs, who receives it, and what the notification is for"
                            rows={3}
                            className="w-full min-w-0 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 border-gray-200 bg-white hover:border-gray-300 text-sm resize-y"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notification Content Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <div className="flex items-center mb-6">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mr-4">
                          <FiBell className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            Notification Content
                          </h4>
                          <p className="text-gray-500 text-sm">
                            Define the default notification message and title
                          </p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Default Title *
                          </label>
                          <input
                            name="defaultTitle"
                            value={formData.defaultTitle}
                            onChange={handleInputChange}
                            placeholder="e.g., Contract {{contractNo}} Awaiting Approval"
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                              errors.defaultTitle
                                ? "border-red-300 bg-red-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          />
                          {errors.defaultTitle && (
                            <p className="text-red-500 text-sm mt-2 flex items-center">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                              {errors.defaultTitle}
                            </p>
                          )}
                          <p className="text-gray-500 text-xs mt-2 flex items-center">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                            Use {"{{variable}}"} syntax for dynamic content
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Default Body *
                          </label>
                          <textarea
                            name="defaultBody"
                            value={formData.defaultBody}
                            onChange={handleInputChange}
                            placeholder="e.g., Contract {{contractNo}} for {{buyerCompanyName}} is awaiting your approval."
                            rows={4}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none ${
                              errors.defaultBody
                                ? "border-red-300 bg-red-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          />
                          {errors.defaultBody && (
                            <p className="text-red-500 text-sm mt-2 flex items-center">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                              {errors.defaultBody}
                            </p>
                          )}
                          <p className="text-gray-500 text-xs mt-2 flex items-center">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                            Use {"{{variable}}"} syntax for dynamic content
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Communication Configuration Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <div className="flex items-center mb-6">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                          <FiActivity className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            Communication Channels
                          </h4>
                          <p className="text-gray-500 text-sm">
                            Choose how notifications will be delivered
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border border-blue-200 shadow-sm">
                          <input
                            type="checkbox"
                            id="sendNotification"
                            checked={formData.sendNotification}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                sendNotification: e.target.checked,
                              }))
                            }
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor="sendNotification"
                            className="ml-4 text-sm font-semibold text-gray-700 cursor-pointer flex-1"
                          >
                            Send push notifications
                          </label>
                          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                            <FiBell className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>

                        <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border border-green-200 shadow-sm">
                          <input
                            type="checkbox"
                            id="sendEmail"
                            checked={formData.sendEmail}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                sendEmail: e.target.checked,
                                sendExternalEmails: e.target.checked
                                  ? prev.sendExternalEmails
                                  : false,
                                additionalEmails: e.target.checked
                                  ? prev.additionalEmails
                                  : "",
                              }))
                            }
                            className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor="sendEmail"
                            className="ml-4 text-sm font-semibold text-gray-700 cursor-pointer flex-1"
                          >
                            Send email notifications
                          </label>
                          <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        </div>

                        {formData.sendEmail && (
                          <div className="space-y-6 pt-6 border-t border-gray-200">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Email Subject
                              </label>
                              <input
                                name="emailSubject"
                                value={formData.emailSubject}
                                onChange={handleInputChange}
                                placeholder="e.g., Contract {{contractNo}} Awaiting Approval"
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                                  errors.emailSubject
                                    ? "border-red-300 bg-red-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                              />
                              {errors.emailSubject && (
                                <p className="text-red-500 text-sm mt-2 flex items-center">
                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                                  {errors.emailSubject}
                                </p>
                              )}
                              <p className="text-gray-500 text-xs mt-2 flex items-center">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                                Leave empty to use notification title
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Email &quot;From&quot; name (optional)
                              </label>
                              <input
                                name="emailFromName"
                                value={formData.emailFromName}
                                onChange={handleInputChange}
                                placeholder={
                                  modalEmailFromNamePlaceholder ||
                                  "Leave blank for automatic sender name"
                                }
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-300"
                              />
                              <p className="text-gray-500 text-xs mt-2 flex items-center">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                                Pre-filled with the sender name used when this field was unset; clear it to resolve dynamically from group and business name at send time. Saved values are always shown as stored.
                              </p>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <label className="block text-sm font-semibold text-gray-700">
                                  Email Body
                                </label>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const placeholders = [
                                        "{{contractNo}}",
                                        "{{buyerCompanyName}}",
                                        "{{amount}}",
                                        "{{dueDate}}",
                                        "{{userName}}",
                                        "{{companyName}}",
                                      ];
                                      const placeholderText =
                                        placeholders.join(", ");
                                      const currentValue =
                                        formData.emailBody || "";
                                      setFormData((prev) => ({
                                        ...prev,
                                        emailBody:
                                          currentValue +
                                          (currentValue ? " " : "") +
                                          placeholderText,
                                      }));
                                    }}
                                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded-lg font-medium transition-colors"
                                    title="Insert common placeholders"
                                  >
                                    Insert Placeholders
                                  </button>
                                  {formData.emailBody && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowEmailPreview(!showEmailPreview)
                                      }
                                      className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1 rounded-lg font-medium transition-colors"
                                    >
                                      {showEmailPreview
                                        ? "Hide Preview"
                                        : "Show Preview"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {showEmailPreview && formData.emailBody ? (
                                <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                                  <div className="text-xs text-gray-500 mb-3 font-medium">
                                    Email preview (with standard header and footer):
                                  </div>
                                  {emailPreviewLoading ? (
                                    <div className="flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500" style={{ minHeight: 520 }}>
                                      Loading preview...
                                    </div>
                                  ) : (
                                    <iframe
                                      title="Notification email preview"
                                      srcDoc={emailPreviewHtml}
                                      className="w-full border border-gray-200 rounded-lg bg-white"
                                      style={{ minHeight: 520 }}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div
                                  className={`border rounded-lg ${
                                    errors.emailBody
                                      ? "border-red-300"
                                      : "border-gray-200"
                                  }`}
                                >
                                  <CKEditor
                                    initData={formData.emailBody}
                                    onChange={(event) => {
                                      const data = event.editor.getData();
                                      setFormData((prev) => ({
                                        ...prev,
                                        emailBody: data,
                                      }));
                                      if (errors.emailBody) {
                                        setErrors((prev) => ({
                                          ...prev,
                                          emailBody: "",
                                        }));
                                      }
                                    }}
                                    config={{
                                      height: 300,
                                      // Preserve full email HTML; CKEditor ACF otherwise strips styles on edit.
                                      allowedContent: true,
                                      extraPlugins:
                                        "colorbutton,font,justify,image2,table,print,pagebreak",
                                    }}
                                  />
                                </div>
                              )}
                              {errors.emailBody && (
                                <p className="text-red-500 text-sm mt-2 flex items-center">
                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                                  {errors.emailBody}
                                </p>
                              )}
                              <p className="text-gray-500 text-xs mt-2 flex items-center">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                                Edit message content only. Header and footer are added automatically — use Preview to see the full email. Use{" "}
                                {"{{variable}}"} syntax for dynamic content.
                              </p>
                            </div>

                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id="sendExternalEmails"
                                  checked={Boolean(
                                    formData.sendExternalEmails,
                                  )}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      sendExternalEmails: e.target.checked,
                                      additionalEmails: e.target.checked
                                        ? prev.additionalEmails
                                        : "",
                                    }))
                                  }
                                  className="h-5 w-5 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor="sendExternalEmails"
                                  className="ml-4 text-sm font-semibold text-gray-700 cursor-pointer flex-1"
                                >
                                  Send to external email addresses
                                </label>
                              </div>

                              {formData.sendExternalEmails && (
                                <div className="mt-4">
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    External / customer email addresses
                                  </label>
                                  <p className="text-xs text-gray-500 mb-2">
                                    Add people who are not in your user list.
                                    One per line or comma-separated. These
                                    addresses receive the email subject/body
                                    configured above.
                                  </p>
                                  <textarea
                                    name="additionalEmails"
                                    value={formData.additionalEmails}
                                    onChange={(e) => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        additionalEmails: e.target.value,
                                      }));
                                      if (errors.recipients) {
                                        setErrors((prev) => ({
                                          ...prev,
                                          recipients: "",
                                        }));
                                      }
                                    }}
                                    rows={3}
                                    placeholder="customer@example.com"
                                    className="w-full px-4 py-3 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recipients Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <div className="flex items-center mb-6">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-4">
                          <FiUsers className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            Recipients Configuration
                          </h4>
                          <p className="text-gray-500 text-sm">
                            Define who will receive these notifications
                          </p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <div className="flex items-center p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-2xl border border-indigo-200 shadow-sm">
                          <input
                            type="checkbox"
                            id="notifyAllUsers"
                            checked={Boolean(formData.notifyAllUsers)}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                notifyAllUsers: e.target.checked,
                              }))
                            }
                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor="notifyAllUsers"
                            className="ml-4 text-sm font-semibold text-gray-700 cursor-pointer flex-1"
                          >
                            Notify all users in business
                          </label>
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <FiUsers className="w-4 h-4 text-indigo-600" />
                          </div>
                        </div>
                      </div>

                      {errors.recipients && (
                        <p className="text-red-500 text-sm mb-4 flex items-center">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2" />
                          {errors.recipients}
                        </p>
                      )}

                      {!formData.notifyAllUsers && (
                        <div className="space-y-6">
                          <div>
                            <div className="mb-4 flex flex-col gap-1">
                              <label className="block text-sm font-semibold text-gray-700">
                                Users & Roles
                              </label>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-96 overflow-y-auto">
                              {/* Search Bar */}
                              <div className="sticky top-0 z-10 bg-gray-50 pb-2 mb-2">
                                <input
                                  type="text"
                                  value={roleUserSearch}
                                  onChange={(e) =>
                                    setRoleUserSearch(e.target.value)
                                  }
                                  placeholder="Search roles or users..."
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              {roles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {roles
                                    .filter((role) => {
                                      const roleUsers = users.filter(
                                        (user) =>
                                          user.role &&
                                          user.role._id === role._id,
                                      );
                                      const search = roleUserSearch
                                        .trim()
                                        .toLowerCase();
                                      if (!search) return true;
                                      const roleMatch = role.name
                                        .toLowerCase()
                                        .includes(search);
                                      const userMatch = roleUsers.some(
                                        (user) =>
                                          user.name
                                            .toLowerCase()
                                            .includes(search) ||
                                          user.email
                                            .toLowerCase()
                                            .includes(search),
                                      );
                                      return roleMatch || userMatch;
                                    })
                                    .map((role) => {
                                      const roleUsers = users.filter(
                                        (user) =>
                                          user.role &&
                                          String(user.role._id) === String(role._id),
                                      );
                                      const isRoleSelected =
                                        formData.userRoles.map(String).includes(String(role._id));
                                      const isExpanded = expandedRoles.map(String).includes(
                                        String(role._id),
                                      );
                                      const roleHasSelectedUsers = roleUsers.some((u) =>
                                        formData.specificUsers.map(String).includes(String(u._id))
                                      );
                                      const shouldExpand = isRoleSelected
                                        ? false
                                        : roleUserSearch
                                          ? true
                                          : roleUsers.length > 0;
                                      return (
                                        <div
                                          key={role._id}
                                          className={`border rounded-2xl bg-white shadow-sm transition hover:shadow-md flex flex-col ${
                                            isRoleSelected
                                              ? "border-blue-200 ring-1 ring-blue-100"
                                              : "border-gray-200"
                                          }`}
                                        >
                                          <div
                                            className="flex items-center p-3 cursor-pointer hover:bg-blue-50 transition rounded-t-2xl select-none"
                                            onClick={() => {
                                              const nowSelected = !isRoleSelected;
                                              handleRoleChange(role._id, nowSelected);
                                              if (roleUsers.length > 0) {
                                                setExpandedRoles((prev) =>
                                                  nowSelected
                                                    ? prev.filter((id) => id !== role._id)
                                                    : prev.includes(role._id)
                                                      ? prev.filter((id) => id !== role._id)
                                                      : [...prev, role._id],
                                                );
                                              }
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isRoleSelected}
                                              onChange={() => {}}
                                              className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-3 pointer-events-none"
                                            />
                                            <span className="text-sm font-semibold text-gray-700 flex-1">
                                              {highlightMatch(
                                                role.name,
                                                roleUserSearch,
                                              )}{" "}
                                              <span className="text-xs text-gray-400">
                                                ({roleUsers.length} users)
                                              </span>
                                            </span>
                                            {roleUsers.length > 0 && (
                                              <span
                                                className="ml-2 text-gray-400 inline-block transform transition-transform"
                                                style={{
                                                  transform: shouldExpand
                                                    ? "rotate(90deg)"
                                                    : "rotate(0deg)",
                                                }}
                                              >
                                                &#9654;
                                              </span>
                                            )}
                                          </div>
                                          {shouldExpand &&
                                            roleUsers.length > 0 && (
                                              <div className="p-2 space-y-1 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                                {roleUsers
                                                  .filter((user) => {
                                                    const search =
                                                      roleUserSearch
                                                        .trim()
                                                        .toLowerCase();
                                                    if (!search) return true;
                                                    return (
                                                      user.name
                                                        .toLowerCase()
                                                        .includes(search) ||
                                                      user.email
                                                        .toLowerCase()
                                                        .includes(search) ||
                                                      role.name
                                                        .toLowerCase()
                                                        .includes(search)
                                                    );
                                                  })
                                                  .map((user) => (
                                                    <div
                                                      key={user._id}
                                                      className="flex items-center pl-6 py-1 hover:bg-white rounded transition"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        id={`user-${user._id}`}
                                                        checked={formData.specificUsers.map(String).includes(String(user._id))}
                                                        onChange={(e) =>
                                                          handleUserChange(
                                                            user._id,
                                                            e.target.checked,
                                                          )
                                                        }
                                                        className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                      />
                                                      <label
                                                        htmlFor={`user-${user._id}`}
                                                        className="ml-3 text-sm text-gray-700 cursor-pointer flex-1"
                                                      >
                                                        <div>
                                                          <div className="font-medium">
                                                            {highlightMatch(
                                                              user.name,
                                                              roleUserSearch,
                                                            )}
                                                          </div>
                                                          <div className="text-gray-500 text-xs">
                                                            {highlightMatch(
                                                              user.email,
                                                              roleUserSearch,
                                                            )}
                                                          </div>
                                                        </div>
                                                      </label>
                                                    </div>
                                                  ))}
                                              </div>
                                            )}
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm text-center py-8">
                                  No roles available for this business
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </div>

                {/* Modal Footer */}
                <div className="bg-white px-8 py-5 border-t border-slate-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Select at least one recipient before saving this event.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-4 space-y-3 sm:space-y-0">
                    <Button
                      layout="outline"
                      onClick={closeModal}
                      className="w-full sm:w-auto px-6 py-3"
                    >
                      Cancel
                    </Button>
                    {(selectedEvent ? canUpdate : canAdd) && (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      style={{ backgroundColor: buttonColor }}
                      className="w-full sm:w-auto px-6 py-3 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {selectedEvent ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          {selectedEvent ? (
                            <PencilIcon className="w-4 h-4 mr-2" />
                          ) : (
                            <PlusIcon className="w-4 h-4 mr-2" />
                          )}
                          {selectedEvent ? "Update Event" : "Create Event"}
                        </>
                      )}
                    </Button>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity"
                aria-hidden="true"
              >
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Delete Notification Event
                      </h3>
                      <p>
                        Are you sure you want to delete the notification event "
                        {selectedEvent?.name}"?
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  {canDelete && (
                  <Button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    style={{ backgroundColor: "#dc2626" }}
                    className="w-full sm:w-auto sm:ml-3"
                  >
                    {isSubmitting ? "Deleting..." : "Delete"}
                  </Button>
                  )}
                  <Button
                    layout="outline"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="w-full sm:w-auto mt-3 sm:mt-0"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        </EpcPage>
      </div>
    </AppLayout>
  );
};

export default NotificationEvents;
