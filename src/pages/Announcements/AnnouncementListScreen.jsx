import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import useButtonColor from "@/hooks/useButtonColor";
import {
  DataTable,
  ActionButtons,
  SummaryCards,
} from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION, useRouteModulePermissions } from "@/utils/permissionUtils";
import { Building, FileText, Send, Edit, Store, Briefcase } from "lucide-react";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

// Wrapper component for Building icon to work with SummaryCards
const BuildingIcon = ({ className, style }) => (
  <Building className={className} style={style} />
);

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const AnnouncementListScreen = () => {
  const checkTokenExpired = useCheckTokenExpired();
  const buttonColor = useButtonColor();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  // Get adminInfo from context, with fallback to localStorage
  const adminInfoFromContext = state?.adminInfo;
  const adminInfoFromStorage = localStorage.getItem("adminInfo") 
    ? JSON.parse(localStorage.getItem("adminInfo")) 
    : null;
  const adminInfo = adminInfoFromContext || adminInfoFromStorage;

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    totalBusinesses: 0,
  });

  const routePerms = useRouteModulePermissions();

  const headers = [
    "Title",
    "Status",
    "Audience",
    "Created By",
    "Published At",
    "Actions",
  ];

  // Load assigned businesses; auto-select only when exactly 1 business assigned
  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
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
        setStats((prev) => ({ ...prev, totalBusinesses: list.length }));
        if (list.length === 1) {
          setBusinessFilter(list[0]._id);
        }
        // If multiple businesses, leave businessFilter as "" to show all
      } catch (error) {
        console.error("Error fetching assigned businesses:", error);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    if (!adminInfo?.token) return;
    if (businesses.length === 0) return;
    fetchAnnouncements();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessFilter, adminInfo?.token, currentPage, statusFilter, recordsPerPage, businesses.length]);

  const fetchAnnouncements = async () => {
    if (!adminInfo?.token) {
      setLoading(false);
      return;
    }

    if (businesses.length === 0) {
      setLoading(false);
      setAnnouncements([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchTerm || undefined,
      };

      if (businessFilter) {
        params.business_id = businessFilter;
      } else {
        // No filter selected — fetch all assigned businesses
        params.business_ids = businesses.map((b) => b._id).join(",");
      }

      const response = await axios.get(`${Base_URL}/announcements`, {
        params,
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        },
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;

      if (response.data.status) {
        setAnnouncements(response.data.data || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
      } else {
        notifyError("Failed to load announcements");
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
      notifyError("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!adminInfo?.token || businesses.length === 0) return;

    try {
      const businessIds = businessFilter
        ? businessFilter
        : businesses.map((b) => b._id).join(",");
      const paramKey = businessFilter ? "business_id" : "business_ids";

      const [totalRes, publishedRes, draftRes] = await Promise.all([
        axios.get(`${Base_URL}/announcements`, {
          params: { [paramKey]: businessIds, limit: 1 },
          headers: { "Content-Type": "application/json", authorization: `Bearer ${adminInfo.token}` },
          withCredentials: true,
        }),
        axios.get(`${Base_URL}/announcements`, {
          params: { [paramKey]: businessIds, status: "published", limit: 1 },
          headers: { "Content-Type": "application/json", authorization: `Bearer ${adminInfo.token}` },
          withCredentials: true,
        }),
        axios.get(`${Base_URL}/announcements`, {
          params: { [paramKey]: businessIds, status: "draft", limit: 1 },
          headers: { "Content-Type": "application/json", authorization: `Bearer ${adminInfo.token}` },
          withCredentials: true,
        }),
      ]);

      setStats({
        total: totalRes.data?.total || 0,
        published: publishedRes.data?.total || 0,
        draft: draftRes.data?.total || 0,
        totalBusinesses: businesses.length,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) {
      return;
    }

    try {
      const userId = adminInfo?.id || adminInfo?._id;
      if (!userId) {
        notifyError("User information is missing");
        return;
      }

      const response = await axios.delete(`${Base_URL}/announcements/${id}`, {
        data: { user_id: userId },
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo?.token}`,
        },
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;

      if (response.data.status) {
        notifySuccess("Announcement deleted successfully");
        fetchAnnouncements();
      } else {
        notifyError("Failed to delete announcement");
      }
    } catch (error) {
      console.error("Error deleting announcement:", error);
      notifyError("Failed to delete announcement");
    }
  };

  const handleEdit = (id) => {
    history.push(`/Edit Announcement/${id}`);
  };

  const handleView = (id) => {
    history.push(`/View Announcement/${id}`);
  };

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    setCurrentPage(1);
  };

  // Debounced search effect
  useEffect(() => {
    if (!adminInfo?.token) return;

    const timeoutId = setTimeout(() => {
      fetchAnnouncements();
    }, 500); // Debounce search by 500ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);


  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    if (status === "published") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Published
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Draft
      </span>
    );
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
    setCurrentPage(1);
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Business",
            value: businessFilter,
            onChange: (value) => {
              setBusinessFilter(value);
              setCurrentPage(1);
            },
            options: [
              ...(businesses.length > 1
                ? [{ value: "", label: "All Businesses" }]
                : []),
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
            placeholder:
              businesses.length > 1 ? "All Businesses" : "Select Business",
            icon: Building,
          },
        ]
      : []),
    {
      label: "Status",
      value: statusFilter,
      onChange: (value) => {
        setStatusFilter(value);
        setCurrentPage(1);
      },
      options: [
        { value: "all", label: "All Status" },
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
      ],
      placeholder: "Select Status",
      icon: FileText,
    },
  ];

  const summaryCardsData = [
    {
      title: "Total Announcements",
      value: stats.total || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: SummarySvg,
    },
    {
      title: "Published",
      value: stats.published || 0,
      backgroundColor: "completed-light",
      iconColor: "completed-dark",
      Icon: CompletedSvg,
    },
    {
      title: "Draft",
      value: stats.draft || 0,
      backgroundColor: "processing-light",
      iconColor: "processing-dark",
      Icon: InProgressSvg,
    },
    {
      title: "Total Businesses",
      value: stats.totalBusinesses || 0,
      backgroundColor: "summary-light",
      iconColor: "summary-dark",
      Icon: BuildingIcon,
      renderIconAsComponent: true,
    },
  ];

  return (
    <RouteActionGate
      title="Announcements"
      requiredPermission={PERMISSION_ACTION.VIEW}
    >
      <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
          {/* Header (match Customer Invoices list layout) */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Announcements
                </h1>
                <p className="text-gray-600 mt-2">
                  Create, publish, and manage announcements across your assigned
                  businesses.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                {routePerms.canAdd && (
                  <button
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                    onClick={() => history.push("/New Announcement")}
                  >
                    Create Announcement
                  </button>
                )}
              </div>
            </div>
          </div>

      {/* Summary Cards */}
      <SummaryCards 
        cards={summaryCardsData} 
        columnsCount={4}
      />

      <DataTable
        onSearch={handleSearch}
        searchValue={searchTerm}
        searchPlaceholder="Search announcements..."
        filters={filters}
        headers={headers}
        headersToHide={[]}
        data={announcements}
        totalRecords={total}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={(page) => {
          setCurrentPage(page);
        }}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          setCurrentPage(1);
        }}
        renderRow={(announcement) => (
          <tr key={announcement._id} className="border-b">
            <td className="py-2 px-4">{announcement.title || "-"}</td>
            <td className="py-2 px-4">{getStatusBadge(announcement.status)}</td>
            <td className="py-2 px-4">
              {announcement.audienceDisplay || "-"}
            </td>
            <td className="py-2 px-4">
              {announcement.createdBy?.name || "-"}
            </td>
            <td className="py-2 px-4">{formatDate(announcement.publishedAt)}</td>
            <td className="py-2 px-4" style={{ width: "fit-content" }}>
              <ActionButtons
                items={[
                  ...(routePerms.canViewDetails
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.VIEW,
                          title: "View",
                          onClick: () => handleView(announcement._id),
                        },
                      ]
                    : []),
                  ...(routePerms.canUpdate
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.EDIT,
                          title: "Edit",
                          onClick: () =>
                            handleEdit(announcement._id),
                        },
                      ]
                    : []),
                  ...(routePerms.canDelete
                    ? [
                        {
                          action: ACTION_BUTTON_TYPES.DELETE,
                          title: "Delete",
                          onClick: () =>
                            handleDelete(announcement._id),
                        },
                      ]
                    : []),
                ]}
              />
            </td>
          </tr>
        )}
      />
        </div>
      </div>
    </RouteActionGate>
  );
};

export default AnnouncementListScreen;
