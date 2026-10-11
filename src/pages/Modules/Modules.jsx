import { useState, useEffect, useContext, useRef } from "react";
import { FiPlus, FiEdit, FiTrash2, FiEye, FiLock } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { Scrollbars } from "react-custom-scrollbars-2";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Modal,
  ModalBody,
  ModalFooter,
} from "@windmill/react-ui";
import Table from "@/components/Table";

import Title from "@/components/form/others/Title";
import useUtilsFunction from "@/hooks/useUtilsFunction";
import PageTitle from "@/components/Typography/PageTitle";
import TableLoading from "@/components/preloader/TableLoading";
import NotFound from "@/components/table/NotFound";
import MainDrawer from "@/components/drawer/MainDrawer";
import LabelArea from "@/components/form/selectOption/LabelArea";
import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { notifyError, notifySuccess } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { useModulePermissions } from "@/utils/permissionUtils";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import CustomPagination from "@/components/CustomPagination";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { getModuleRoutePath } from "@/utils/moduleLabels";
import { isHiddenSidebarModule } from "@/utils/hiddenSidebarPaths";
import {
  DropdownBasic,
  InputField,
  PageHeader,
  Button as LayoutButton,
  DataTable,
  ToggleSwitch,
} from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const isHiddenProductModule = (mod = {}) =>
  isHiddenSidebarModule({
    name: mod.name || "",
    path: mod.path || "",
  });

const Modules = () => {
  const { getModuleLabel } = useModuleLabels();
  const saleOrderLabel = getModuleLabel("saleOrder", "Sale Order");
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;
  const {
    canAdd,
    canUpdate,
    canDelete,
    canView,
    permissions,
  } = useModulePermissions("Global Settings", "Modules");
  const { toggleDrawer, lang, isDrawerOpen } = useContext(SidebarContext);
  const { t } = useTranslation();

  const [data, setData] = useState([]);
  const [totalModules, setTotalModules] = useState(0);
  const [id, setId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [icon, setIcon] = useState("");
  const [parent_id, setParent_id] = useState(null);
  const [position, setPosition] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState("");
  const [ParentModules, setParentModules] = useState([]);
  const [relatedBusinessModuleIds, setRelatedBusinessModuleIds] = useState([]);

  const [FilterStatus, setFilterStatus] = useState("");
  const [FilterName, setFilterText] = useState("");
  const [ToBeDeleted, setToBeDeleted] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: "", path: "", imageUrl: "" });
  const { showDateFormat, showingTranslateValue } = useUtilsFunction();
  const [pagePermissions, setPagePermissions] = useState([]);

  const buttonColor = useButtonColor();
  const [permissionList, setPermissionList] = useState([
    "Add",
    "Update",
    "Delete",
    "BulkDelete",
    "View",
    "ViewDetails",
  ]);
  const [recordsPerPage, setRecordsPerPage] = useState(10); // Default records per page
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const resetRelatedBusinessModules = () => {
    setRelatedBusinessModuleIds([]);
  };

  const loadRelatedBusinessModules = (module = {}) => {
    setRelatedBusinessModuleIds(
      Array.isArray(module.dependsOnModuleIds)
        ? module.dependsOnModuleIds.map((entry) => String(entry))
        : [],
    );
  };

  const toggleRelatedBusinessModule = (moduleId) => {
    const normalizedId = String(moduleId);
    setRelatedBusinessModuleIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((entry) => entry !== normalizedId)
        : [...prev, normalizedId],
    );
  };

  const isReportOrScreen = Boolean(parent_id);
  // Use a ref to store the current page to prevent re-renders
  const currentPageRef = useRef(1);

  const headers = [
    t("modules.name"),
    t("modules.path"),
    t("modules.icon"),
    t("modules.status"),
    t("Actions"),
  ];
  // Add a ref to track if we're currently fetching data
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (name.toLowerCase().includes("sales")) {
      setPermissionList((prevList) => [
        ...prevList,
        "Send For Approval",
        "Approve Sales",
        "Request Approval",
        "Accounts Approve Sales",
        "Create Document",
        "Change Status",
      ]);
    }
    if (name.toLowerCase().includes("purchase")) {
      setPermissionList((prevList) => [
        ...prevList,
        "Send For Approval",
        "Approve Purchase",
        "Accounts Approve Purchase",
        "Request Approval",
        "Change Status",
        "Create Document",
      ]);
    }
    const moduleName = name.toLowerCase();
    const modulePath = (path || "").toLowerCase();
    const isDailyReportsModule =
      moduleName.includes("daily report") ||
      moduleName.includes("daily collection") ||
      modulePath.includes("/daily-reports");
    if (isDailyReportsModule) {
      setPermissionList((prevList) =>
        prevList.includes("ViewOwn") ? prevList : [...prevList, "ViewOwn"]
      );
    }
  }, [name, path]);

  // 🔍 Function to check permissions in both modules and submodules
  const checkPagePermissions = () => {
    if (adminInfo && adminInfo.role.modules) {
      const currentPath = location.pathname;
      console.log("currentPath", currentPath);

      // 🔎 Search in modules and submodules
      adminInfo.role.modules.forEach((module) => {
        // Check in the main module
        if (currentPath === module.path) {
          console.log("currentPath module", module.path);
          setPagePermissions(module.permissions);
        }
        // Check in submodules (if any)
        if (module.subModules && module.subModules.length > 0) {
          module.subModules.forEach((subModule) => {
            if (currentPath === subModule.path) {
              console.log("subModule module", subModule.path);
              setPagePermissions(subModule.permissions);
            }
          });
        }
      });
    }
  };
  useEffect(() => {
    checkPagePermissions();
  }, [location]);

  // ✅ Check if the user has a specific permission
  const hasPermission = (permission) => {
    return isSuperAdmin || permissions.includes(permission);
  };

  const closeModal = async () => {
    setIsModalOpen(false);
  };

  const handleDelete = async (_id) => {
    setToBeDeleted(_id);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!isSuperAdmin && !canDelete) {
      notifyError("Access restricted: you don't have permission to delete modules.");
      return;
    }
    try {
      // Show a loading state
      setLoading(true);
      // const headers = adminInfo
      //   ? {
      //       "Content-Type": "application/json",
      //       authorization: `Bearer ${adminInfo.token}`,
      //     }
      //   : {};
      // Call the backend API to delete the image
      const response = await axios.delete(
        `${Base_URL}/Module/delete/${ToBeDeleted}`
      );
      console.log("delete response", response);
      // Check if the response indicates success
      if (response.data.status) {
        notifySuccess(t("modules.moduleDeletedSuccessfully"));
        setIsModalOpen(false);
        fetchData(
          FilterStatus,
          FilterName,
          currentPageRef.current,
          recordsPerPage
        );
      } else {
        setIsModalOpen(false);
        notifyError(response.data.message || t("modules.failedToDeleteModule"));
      }

      setLoading(false); // Hide the loading state
    } catch (err) {
      setIsModalOpen(false);
      console.error("Error removing Module:", err);
      notifyError(err.response?.data?.message || t("modules.failedToDeleteModule"));
      setLoading(false); // Hide the loading state
    }
  };

  const HandleFilter = async () => {
    try {
      currentPageRef.current = 1;
      setCurrentPage(1);
      setRecordsPerPage(10);
      fetchData(FilterStatus, FilterName, 1, 10);
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err || "Failed to delete image.");
      setLoading(false); // Hide the loading state
    }
  };

  // Fetch Data on Load
  useEffect(() => {
    fetchParentModules();
    // Initial data fetch
    fetchData(FilterStatus, FilterName, 1, recordsPerPage);
  }, []);

  // In the fetchData function, add more detailed logging and ensure the page parameter is explicitly set
  const fetchData = (FilterStatus, FilterName, page, limit) => {
    // Set fetching flag to true
    isFetchingRef.current = true;
    setLoading(true);

    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    // Ensure page is a number and not undefined
    const pageToFetch = Number(page) || 1;
    const limitToFetch = Number(limit) || 10;

    const payload = {
      FilterStatus,
      FilterName,
      page: pageToFetch,
      limit: limitToFetch,
    };

    console.log(
      `[FETCH_DATA] SENDING API REQUEST: Page=${pageToFetch}, Limit=${limitToFetch}`
    );
    console.log("[FETCH_DATA] Full payload:", payload);

    axios
      .post(`${Base_URL}/Module/get_all`, payload, { headers })
      .then((response) => {
        console.log(
          `[FETCH_DATA] API RESPONSE: Requested Page=${pageToFetch}, Returned Page=${response.data.currentPage}`
        );
        console.log("[FETCH_DATA] Full response data:", response.data);

        // Store the data without triggering any other effects
        const visibleModules = (response.data.data || []).filter(
          (mod) => !isHiddenProductModule(mod)
        );
        setData(visibleModules);
        setTotalModules(response.data.totalModules);
        setTotalResults(response.data.totalModules);

        // Don't update currentPage here - it should only be updated by user actions
        // This prevents the page from resetting

        setLoading(false);
        // Set fetching flag to false
        isFetchingRef.current = false;
      })
      .catch((error) => {
        console.error("[FETCH_DATA] API Error:", error);
        setData([]);
        setTotalResults(0);
        setLoading(false);
        // Set fetching flag to false
        isFetchingRef.current = false;
      });
  };

  const fetchParentModules = () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    const payload = {};
    axios
      .post(`${Base_URL}/Module/get_all_modules`, payload, { headers })
      .then((response) => {
        const modules = response.data.data || [];
        setParentModules(
          modules.filter(
            (mod) => !mod.parent_id && !isHiddenProductModule(mod)
          )
        );
      })
      .catch(() => {
        setParentModules([]);
      });
  };

  const handlePermissionChange = (permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((perm) => perm !== permission)
        : [...prev, permission]
    );
  };

  const handleResetField = () => {
    setFilterStatus("");
    setFilterText("");
    currentPageRef.current = 1;
    setCurrentPage(1);
    setRecordsPerPage(10);
    fetchData("", "", 1, 10);
  };

  const handleAdd = () => {
    if (!isSuperAdmin && !canAdd) {
      notifyError("Access restricted: you don't have permission to add modules.");
      return;
    }
    setId("");
    setName("");
    setPath("");
    setIcon("");
    setPosition("");
    setParent_id("");
    setSelectedPermissions("");
    resetRelatedBusinessModules();
    setErrors({});
    toggleDrawer();
  };
  // Validate fields before submission
  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      name: "",
      path: "",
      parent_id: "",
      icon: "",
      type: "",
      permissions: "",
    };

    if (!name) {
      newErrors.name = t("modules.validation.nameIsRequired");
      isValid = false;
    }

    if (!path) {
      newErrors.path = t("modules.validation.pathIsRequired");
      isValid = false;
    }

    if (!position) {
      newErrors.position = t("modules.validation.positionIsRequired");
      isValid = false;
    }

    if (!icon) {
      newErrors.icon = t("modules.validation.iconIsRequired");
      isValid = false;
    }

    if (!selectedPermissions) {
      newErrors.permissions = t("modules.validation.atLeastOneFunctionalityIsRequired");
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleUpdate = (ModuleId) => {
    if (!isSuperAdmin && !canUpdate) {
      notifyError("Access restricted: you don't have permission to update modules.");
      return;
    }
    const selectedModule = data.find((item) => item._id === ModuleId);
    setId(ModuleId);
    setName(selectedModule.name);
    setPath(selectedModule.path);
    setIcon(selectedModule.icon);
    setPosition(selectedModule.position);
    setStatus(selectedModule.status);
    setParent_id(selectedModule.parent_id);
    setSelectedPermissions(
      Array.isArray(selectedModule.permissions)
        ? selectedModule.permissions
        : selectedModule.permissions && typeof selectedModule.permissions === "object"
          ? Object.keys(selectedModule.permissions)
          : []
    );
    loadRelatedBusinessModules(selectedModule);
    toggleDrawer();
  };

  const ModuleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      if (id && !canUpdate) {
        notifyError("Access restricted: you don't have permission to update modules.");
        return;
      }
      if (!id && !canAdd) {
        notifyError("Access restricted: you don't have permission to add modules.");
        return;
      }
    }
    if (!validateForm()) {
      return;
    }
    setIsSubmitting(true);

    const ModuleData = {
      name,
      path,
      position,
      parent_id,
      icon,
      permissions: selectedPermissions,
      status,
      dependsOnModuleIds: parent_id ? relatedBusinessModuleIds : [],
    };
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    try {
      const url = id
        ? `${Base_URL}/Module/update/${id}`
        : `${Base_URL}/Module/add`;
      const method = id ? "put" : "post";
      const res = await axios[method](url, ModuleData, { headers });
      console.log("res", res);
      if (res.data.status) {
        setIsSubmitting(false);
        fetchData(
          FilterStatus,
          FilterName,
          currentPageRef.current,
          recordsPerPage
        );
        toggleDrawer();
        notifySuccess(res.data.message);
      } else {
        setIsSubmitting(false);
        notifyError(res.data.message);
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error("Error submitting Module:", err);
    }
  };

  // Update the handlePageChange function to use the ref instead of state
  const handlePageChange = (page) => {
    const newPage = Number(page);
    console.log(
      `[PAGE_CHANGE] Page change requested: ${currentPageRef.current} → ${newPage}`
    );

    if (newPage !== currentPageRef.current && !isFetchingRef.current) {
      console.log(`[PAGE_CHANGE] Setting current page to ${newPage}`);

      // Update the ref first
      currentPageRef.current = newPage;

      // Then update the state for UI rendering
      setCurrentPage(newPage);

      // Force a fetch with the new page
      console.log(`[PAGE_CHANGE] Forcing data fetch for page ${newPage}`);
      fetchData(FilterStatus, FilterName, newPage, recordsPerPage);
    } else {
      console.log(
        `[PAGE_CHANGE] Ignoring page change: currentPage=${currentPageRef.current}, newPage=${newPage}, isFetching=${isFetchingRef.current}`
      );
    }
  };

  // Calculate module counts by status
  const activeModules = data.filter((module) => module.status === true).length;
  const inactiveModules = data.filter(
    (module) => module.status === false
  ).length;

  const handleStatusToggle = async (module) => {
    if (!isSuperAdmin && !canUpdate) {
      notifyError("Access restricted: you don't have permission to update modules.");
      return;
    }
    console.log("currentStatus", module.status);
    // onChange={(e) => {
    //   const updatedModule = { ...module, status: e.target.value === "true" }
    //   const headers = {
    //     "Content-Type": "application/json",
    //     authorization: `Bearer ${adminInfo?.token}`,
    //   }
    //   axios
    //     .put(`${Base_URL}/Module/update/${module._id}`, updatedModule, { headers })
    //     .then((res) => {
    //       if (res.data.status) {
    //         notifySuccess("Status updated successfully")
    //         fetchData(FilterStatus, FilterName, currentPageRef.current, recordsPerPage)
    //       } else {
    //         notifyError(res.data.message)
    //       }
    //     })
    //     .catch((err) => {
    //       notifyError("Failed to update status")
    //       console.error(err)
    //     })
    // }}

    const newStatus = module.status === true ? false : true;
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo.token}`,
    };

    try {
      setLoading(true);
      const updatedModule = {
        ...module,
        status:
          module.status === true
            ? (module.status = false)
            : (module.status = true),
      };
      const response = await axios.put(
        `${Base_URL}/Module/update/${module._id}`,
        updatedModule,
        { headers }
      );

      if (response.status === 200) {
        notifySuccess(t("modules.statusUpdatedSuccessfully"));
        fetchData(
          FilterStatus,
          FilterName,
          currentPageRef.current,
          recordsPerPage
        );
      } else {
        notifyError(t("modules.failedToUpdateStatus"));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      notifyError(t("modules.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const getModuleDisplayName = (module) => {
    const modulePath = String(module?.path || "").toLowerCase();
    const moduleName = String(module?.name || "").toLowerCase();
    const saleOrderListPath = getModuleRoutePath("saleOrder", "list").toLowerCase();
    const isSalesOrderModule =
      modulePath.includes(saleOrderListPath) ||
      modulePath.includes("/sales-orders") ||
      modulePath.includes("/sale-order") ||
      moduleName === "sales orders" ||
      moduleName === "sale order";
    if (isSalesOrderModule) return saleOrderLabel;
    return module?.name || "";
  };

  const content = (
    <>
      <div
        className="p-6 bg-white min-h-screen"
        style={{ backgroundColor: "#FFFF" }}
      >
        <div className="flex justify-between mb-6">
          <PageHeader
            title={t("modules.title")}
            showAddButton={hasPermission("Add")}
            addButtonText={t("modules.addModule")}
            onAddNew={handleAdd}
          />
        </div>

        {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-100 rounded-lg shadow-md">
            <p className="text-sm text-gray-600">Total Modules</p>
            <h2 className="text-xl font-bold">{data.length}</h2>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-md">
            <p className="text-sm text-gray-600">Active Modules</p>
            <h2 className="text-xl font-bold">{activeModules}</h2>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-md">
            <p className="text-sm text-gray-600">Inactive Modules</p>
            <h2 className="text-xl font-bold">{inactiveModules}</h2>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-md">
            <p className="text-sm text-gray-600">Parent Modules</p>
            <h2 className="text-xl font-bold">{ParentModules.length}</h2>
          </div>
        </div> */}

        <div
          className="bg-white shadow-md rounded-xl p-4"
          style={{ backgroundColor: "#F9F9FA" }}
        >
          <div className="flex flex-col md:flex-row md:justify-end md:items-center mb-4 gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              {/* Status Dropdown */}
              <DropdownBasic
                onChange={(value) => setFilterStatus(value)}
                value={FilterStatus}
                style={{ width: "180px", height: "40px" }}
                placeholder={t("modules.selectStatus")}
                options={[
                  { label: t("All"), value: "" },
                  { label: t("active"), value: true },
                  { label: t("inactive"), value: false },
                ]}
              />

              {/* Search Input */}
              <InputField
                type="text"
                name="search"
                value={FilterName}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={t("systemUsers.searchText")}
                style={{ width: "180px", height: "40px" }}
              />

              {/* Filter Button */}
              <LayoutButton onClick={HandleFilter}>{t("filter")}</LayoutButton>

              {/* Reset Button */}
              <LayoutButton
                layout="outline"
                onClick={handleResetField}
                type="reset"
                gray
              >
                {t("reset")}
              </LayoutButton>
            </div>
          </div>

          <DataTable
            headers={headers}
            data={data}
            loading={loading}
            noPadding={true}
            // pagination
            currentPage={currentPage}
            totalRecords={totalModules}
            onPageChange={handlePageChange}
            recordsPerPage={recordsPerPage}
            totalPages={Math.ceil(totalResults / recordsPerPage)}
            onRecordsPerPageChange={(value) => {
              const newValue = Number(value);
              setRecordsPerPage(newValue);
              currentPageRef.current = 1;
              setCurrentPage(1);
              fetchData(FilterStatus, FilterName, 1, newValue);
            }}
            // rendering

            renderRow={(module) => (
              <tr key={module._id} className="border-b">
                <td className="py-2 px-4">{getModuleDisplayName(module)}</td>
                <td className="py-2 px-4">{module.path}</td>
                <td className="py-2 px-4">{module.icon}</td>
                <td
                  className={`py-2 px-4 font-medium ${
                    module.status ? "text-green-500" : "text-red-500"
                  }`}
                >
                  <ToggleSwitch
                    isOn={module.status === true}
                    handleToggle={() => handleStatusToggle(module)}
                    disabled={!isSuperAdmin && !canUpdate}
                  />
                </td>
                <td className="py-2 px-4">
                  {hasPermission("Update") && (
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md ml-2"
                      onClick={() => handleUpdate(module._id)}
                    >
                      <FiEdit className="text-gray-600" />
                    </button>
                  )}
                  {hasPermission("Delete") && (
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md ml-2"
                      onClick={() => handleDelete(module._id)}
                    >
                      <FiTrash2 className="text-gray-600" />
                    </button>
                  )}
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      <MainDrawer isDrawerOpen={isDrawerOpen} toggleDrawer={toggleDrawer}>
        <>
          <div className="w-full relative p-6 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {id ? (
              <Title
                title={t("modules.updateModule")}
                description={t("modules.updatingModuleDetails")}
              />
            ) : (
              <Title
                title={t("modules.addModule")}
                description={t("modules.addingNewModule")}
              />
            )}
          </div>
          <Scrollbars className="w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200">
            <Card className="overflow-y-scroll flex-grow scrollbar-hide w-full max-h-full">
              <CardBody>
                <form onSubmit={ModuleSubmit}>
                  <div className="px-6 pt-8 flex-grow scrollbar-hide w-full max-h-full pb-40">
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("modules.name")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t("modules.enterName")}
                          className="mt-1 block w-full"
                        />
                        {errors.name && (
                          <span className="text-red-500 text-xs">
                            {errors.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("modules.path")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={path}
                          onChange={(e) => setPath(e.target.value)}
                          placeholder={t("modules.enterPath")}
                          className="mt-1 block w-full"
                        />
                        {errors.path && (
                          <span className="text-red-500 text-xs">
                            {errors.path}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("modules.position")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="number"
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder={t("modules.enterPosition")}
                          className="mt-1 block w-full"
                        />
                        {errors.position && (
                          <span className="text-red-500 text-xs">
                            {errors.position}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("modules.icon")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={icon}
                          onChange={(e) => setIcon(e.target.value)}
                          placeholder={t("modules.enterIconText")}
                          className="mt-1 block w-full"
                        />
                        {errors.icon && (
                          <span className="text-red-500 text-xs">
                            {errors.icon}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label>{t("modules.parentModule")}</label>
                      <Select
                        value={parent_id}
                        onChange={(e) => setParent_id(e.target.value)}
                        className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                      >
                        <option value="">
                          {t("modules.selectParentModuleOptional")}
                        </option>
                        {ParentModules.map((module) => (
                          <option key={module._id} value={module._id}>
                            {module.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {isReportOrScreen && (
                      <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <label className="block font-medium text-gray-700 mb-1">
                          {t("modules.relatedBusinessModules")}
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                          {t("modules.relatedBusinessModulesHelp")}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {ParentModules.map((mod) => (
                            <label
                              key={mod._id}
                              className="flex items-center rounded-md border border-gray-200 bg-white px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-400"
                                checked={relatedBusinessModuleIds.includes(
                                  String(mod._id),
                                )}
                                onChange={() =>
                                  toggleRelatedBusinessModule(mod._id)
                                }
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {mod.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: "15px" }}>
                      {permissionList.map((perm) => (
                        <label key={perm} className="flex items-center mb-3">
                          <input
                            type="checkbox"
                            className="form-checkbox h-5 w-5 text-emerald-500 border-gray-300 rounded focus:ring-emerald-400"
                            checked={selectedPermissions.includes(perm)} // Checkbox reflects chosen permission
                            onChange={() => {
                              setSelectedPermissions(
                                (prev) =>
                                  prev.includes(perm)
                                    ? prev.filter((p) => p !== perm) // Remove if already selected
                                    : [...prev, perm] // Add if not selected
                              );
                            }}
                          />
                          <span className="ml-3 font-medium text-gray-700">
                            {perm === "ViewOwn" ? "View Own (my reports only)" : perm}
                          </span>
                        </label>
                      ))}
                      {errors.permissions && (
                        <span className="text-red-500 text-xs">
                          {errors.permissions}
                        </span>
                      )}
                    </div>
                    {id && (
                      <div>
                        <label>{t("modules.status")}</label>
                        <Select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                        >
                          <option value="">{t("modules.selectStatus")}</option>
                          <option key={true} value={true}>
                            {" "}
                            {t("active")}{" "}
                          </option>
                          <option key={false} value={false}>
                            {" "}
                            {t("inactive")}{" "}
                          </option>
                        </Select>
                      </div>
                    )}
                  </div>
                  {isSubmitting ? (
                    <Button
                      disabled={true}
                      type="button"
                      className="w-full h-12"
                    >
                      <img
                        src={spinnerLoadingImage || "/placeholder.svg"}
                        alt="Loading"
                        width={20}
                        height={10}
                      />{" "}
                      <span className="font-serif ml-2 font-light">
                        {t("processing")}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={ModuleSubmit}
                      type="submit"
                      disabled={!isSuperAdmin && (id ? !canUpdate : !canAdd)}
                      className="w-full h-12"
                    >
                      {id ? (
                        <span>{t("modules.updateModule")}</span>
                      ) : (
                        <span>{t("modules.addModule")}</span>
                      )}
                    </Button>
                  )}
                </form>
              </CardBody>
            </Card>
          </Scrollbars>
        </>
      </MainDrawer>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalBody className="text-center custom-modal px-8 pt-6 pb-4">
          <span className="flex justify-center text-3xl mb-6 text-red-500">
            <FiTrash2 />
          </span>
          <h2 className="text-xl font-medium mb-2">
            {t("DeleteModalH2")}{" "}
            <span className="text-red-500">{t("modules.title")}</span>?
          </h2>
          <p>{t("DeleteModalPtag")}</p>
        </ModalBody>

        <ModalFooter className="justify-center pb-10">
          <Button
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50"
            layout="outline"
            onClick={closeModal}
          >
            {t("modalKeepBtn")}
          </Button>
          <div className="flex justify-end">
            {isSubmitting ? (
              <Button
                disabled={true}
                type="button"
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                <img
                  src={spinnerLoadingImage || "/placeholder.svg"}
                  alt="Loading"
                  width={20}
                  height={10}
                />{" "}
                <span className="font-serif ml-2 font-light">
                  {t("processing")}
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleDeleteItem}
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
                disabled={loading || (!isSuperAdmin && !canDelete)}
              >
                {t("modalDeletBtn")}
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </>
  );

  if (isSuperAdmin) return content;

  return (
    <ModuleAccessGate
      moduleName="Global Settings"
      subModuleName="Modules"
      title={t("modules.title")}
    >
      {content}
    </ModuleAccessGate>
  );
};

export default Modules;
