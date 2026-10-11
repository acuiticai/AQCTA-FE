import React, { useState, useEffect, useContext, useRef } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Pagination,
  Select,
  Table,
  TableCell,
  TableContainer,
  TableFooter,
  TableHeader,
  TableBody,
  TableRow,
  Avatar,
} from "@windmill/react-ui";
import { Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import { useTranslation } from "react-i18next";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiUploadCloud,
  FiXCircle,
  FiEye,
  FiUsers,
  FiLock,
} from "react-icons/fi";
import axios from "axios";
import useFilter from "@/hooks/useFilter";
import useUtilsFunction from "@/hooks/useUtilsFunction";
import useToggleDrawer from "@/hooks/useToggleDrawer";
import AnimatedContent from "@/components/common/AnimatedContent";
import PageTitle from "@/components/Typography/PageTitle";
import TableLoading from "@/components/preloader/TableLoading";
import NotFound from "@/components/table/NotFound";
import Status from "@/components/table/Status";
import Tooltip from "@/components/tooltip/Tooltip";
import DeleteModal from "@/components/modal/DeleteModal";
import MainDrawer from "@/components/drawer/MainDrawer";
import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { notifyError, notifySuccess } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import { useModulePermissions } from "@/utils/permissionUtils";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import { dispatchUserRolesChanged } from "@/utils/userRolesEvents";
import {
  isHiddenSidebarModule,
  getProductNavDisplayName,
} from "@/utils/hiddenSidebarPaths";
import {
  DropdownBasic,
  InputField,
  PageHeader,
  Button as LayoutButton,
  DataTable,
  ToggleSwitch,
  ActionButtons,
} from "@/page-layouts/index";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const isHiddenRoleModule = (mod = {}, parentName = "") =>
  isHiddenSidebarModule({
    name: mod.name || mod.module || "",
    path: mod.path || "",
    parentName,
  });

const formatRolePermissionLabel = (permission) =>
  permission === "ViewOwn" ? "View Own (my reports only)" : permission;

/** Module.permissions may be stored as array or object — User Roles UI always needs an array. */
const modulePermissionsList = (permissions) => {
  if (Array.isArray(permissions)) {
    return permissions.filter((p) => typeof p === "string" && p.trim());
  }
  if (permissions && typeof permissions === "object") {
    const fromValues = Object.values(permissions).filter(
      (p) => typeof p === "string" && p.trim(),
    );
    if (fromValues.length > 0) return fromValues;
    return Object.keys(permissions);
  }
  return [];
};

const buildAllowedIndex = (allowedModules) => {
  const allowedIndex = new Map();
  (allowedModules || []).forEach((mod) => {
    const modId = mod?._id;
    if (!modId) return;
    const perms = Array.isArray(mod.permissions) ? mod.permissions : [];
    const subPermsIndex = {};
    (mod.subModules || []).forEach((sub) => {
      if (!sub?._id) return;
      subPermsIndex[String(sub._id)] = Array.isArray(sub.permissions)
        ? sub.permissions
        : [];
    });
    allowedIndex.set(String(modId), {
      permissions: perms,
      subPermissions: subPermsIndex,
    });
  });
  return allowedIndex;
};

const groupFetchedModules = (fetchedModules) =>
  (fetchedModules || [])
    .filter(
      (item) =>
        !item.parent_id &&
        item.status &&
        !isHiddenRoleModule(item)
    )
    .map((parent) => ({
      _id: parent._id,
      module: parent.name,
      /* Raw DB names are legacy ("⁠Applications", "Accounts"); show the same
         label the sidebar shows so a role reads like the product nav. */
      label: getProductNavDisplayName(parent.name),
      path: parent.path,
      permissions: modulePermissionsList(parent.permissions),
      subModules: (fetchedModules || [])
        .filter(
          (child) =>
            String(child.parent_id) === String(parent._id) &&
            child.status &&
            !isHiddenRoleModule(child, parent.name)
        )
        .map((child) => ({
          _id: child._id,
          module: child.name,
          label: getProductNavDisplayName(child.name, {
            parentName: parent.name,
          }),
          path: child.path,
          permissions: modulePermissionsList(child.permissions),
        })),
    }));

/** Edit view: show every permission on the role; mark ones the editor cannot change. */
const mergeModulesForRoleEdit = (
  fetchedModules,
  roleModules,
  allowedIndex,
  isSuperAdmin
) => {
  const grouped = groupFetchedModules(fetchedModules);
  const flatById = new Map(
    (fetchedModules || []).map((m) => [String(m._id), m])
  );
  const roleById = new Map(
    (roleModules || []).map((m) => [String(m._id), m])
  );
  const merged = [];
  const seenParent = new Set();

  for (const parent of grouped) {
    const roleParent = roleById.get(String(parent._id));
    const allowedParent = allowedIndex.get(String(parent._id));
    if (!roleParent && !allowedParent) continue;

    seenParent.add(String(parent._id));

    const rolePerms = modulePermissionsList(roleParent?.permissions);
    const allowedPerms = allowedParent?.permissions || [];
    const visibleParentPerms = [
      ...new Set([
        ...rolePerms,
        ...parent.permissions.filter((p) => allowedPerms.includes(p)),
      ]),
    ];
    const parentReadOnly = isSuperAdmin
      ? []
      : visibleParentPerms.filter((p) => !allowedPerms.includes(p));

    const subModules = parent.subModules
      .map((sub) => {
        const roleSub = (roleParent?.subModules || []).find(
          (s) => String(s._id) === String(sub._id)
        );
        const subAllowed =
          allowedParent?.subPermissions?.[String(sub._id)] || [];
        const roleSubPerms = modulePermissionsList(roleSub?.permissions);
        const hasRoleSub = roleSubPerms.length > 0;

        if (!hasRoleSub && !subAllowed.length) return null;

        const visibleSubPerms = [
          ...new Set([
            ...roleSubPerms,
            ...sub.permissions.filter((p) => subAllowed.includes(p)),
          ]),
        ];
        const subReadOnly = isSuperAdmin
          ? []
          : visibleSubPerms.filter((p) => !subAllowed.includes(p));

        return {
          ...sub,
          permissions: visibleSubPerms,
          readOnlyPermissions: subReadOnly,
          isSubmoduleReadOnly:
            !isSuperAdmin && hasRoleSub && !subAllowed.length,
        };
      })
      .filter(Boolean);

    if (!visibleParentPerms.length && !subModules.length) continue;

    merged.push({
      ...parent,
      permissions: visibleParentPerms,
      readOnlyPermissions: parentReadOnly,
      isModuleReadOnly:
        !isSuperAdmin && !!roleParent && !allowedParent && rolePerms.length > 0,
      subModules,
    });
  }

  for (const [modId, roleMod] of roleById) {
    if (seenParent.has(modId)) continue;
    const flat = flatById.get(modId);
    const orphanName = flat?.name || roleMod.name || roleMod.module || "Module";
    const orphanPath = flat?.path || roleMod.path || "#";
    if (isHiddenRoleModule({ name: orphanName, path: orphanPath })) continue;

    const rolePerms = modulePermissionsList(roleMod.permissions);
    merged.push({
      _id: roleMod._id,
      module: orphanName,
      label: getProductNavDisplayName(orphanName),
      path: orphanPath,
      permissions: rolePerms,
      readOnlyPermissions: isSuperAdmin ? [] : rolePerms,
      isModuleReadOnly: !isSuperAdmin,
      subModules: (roleMod.subModules || [])
        .map((s) => {
          const flatSub = flatById.get(String(s._id));
          const subName = flatSub?.name || s.name || "Submodule";
          const subPath = flatSub?.path || s.path || "#";
          if (isHiddenRoleModule({ name: subName, path: subPath })) return null;
          const subPerms = modulePermissionsList(s.permissions);
          return {
            _id: s._id,
            module: subName,
            label: getProductNavDisplayName(subName, {
              parentName: orphanName,
            }),
            path: subPath,
            permissions: subPerms,
            readOnlyPermissions: isSuperAdmin ? [] : subPerms,
            isSubmoduleReadOnly: !isSuperAdmin,
          };
        })
        .filter(Boolean),
    });
  }

  return merged;
};

const roleHasRestrictedPermissions = (mods) =>
  (mods || []).some(
    (m) =>
      !!m.isModuleReadOnly ||
      (m.readOnlyPermissions || []).length > 0 ||
      (m.subModules || []).some(
        (s) =>
          !!s.isSubmoduleReadOnly || (s.readOnlyPermissions || []).length > 0
      )
  );

const UserRoles = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { toggleDrawer, lang } = useContext(SidebarContext);
  const [data, setData] = useState([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [FilterStatus, setFilterStatus] = useState("");
  const [FilterName, setFilterText] = useState("");
  const [ToBeDeleted, setToBeDeleted] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: "", landingPage: "" });
  const { t } = useTranslation();
  const { showDateFormat, showingTranslateValue } = useUtilsFunction();
  const [landingPage, setLandingPage] = useState(""); // Landing page
  const [selectedModules, setSelectedModules] = useState({}); // Module selection
  const [modules, setModules] = useState([]);
  const buttonColor = useButtonColor();
  const [landingOptions, setLandingOptions] = useState([]);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [resultsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [businessGroup, setBusinessGroup] = useState("");
  const [FilterBusinessGroup, setFilterBusinessGroup] = useState("");
  const [businessGroups, setBusinessGroups] = useState([]);
  const [status, setStatus] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const editingRoleBaselineRef = useRef(null);

  // Assigned members modal state
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState([]);
  const [selectedRoleName, setSelectedRoleName] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);

  const closeModal = async () => {
    setIsModalOpen(false);
  };

  const closeMembersModal = () => {
    setIsMembersModalOpen(false);
    setAssignedMembers([]);
    setSelectedRoleName("");
  };

  const handleViewAssignedMembers = async (roleId, roleName) => {
    if (!isSuperAdmin && !canViewDetails) {
      notifyError("Access restricted: you don't have permission to view assigned members.");
      return;
    }
    setSelectedRoleName(roleName);
    setLoadingMembers(true);
    setIsMembersModalOpen(true);

    try {
      const headers = adminInfo
        ? {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          }
        : {};

      const response = await axios.get(
        `${Base_URL}/UserRoles/get-assigned-users/${roleId}`,
        { headers }
      );

      if (response.data.status) {
        setAssignedMembers(response.data.data || []);
      } else {
        notifyError(t("userRoles.failedToFetchAssignedMembers"));
        setAssignedMembers([]);
      }
    } catch (err) {
      console.error("Error fetching assigned members:", err);
      notifyError(
        err.response?.data?.message || t("userRoles.failedToFetchAssignedMembers")
      );
      setAssignedMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleDelete = async (_id) => {
    if (!isSuperAdmin && !canDelete) return;
    setToBeDeleted(_id);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!isSuperAdmin && !canDelete) {
      notifyError("Access restricted: you don't have permission to delete roles.");
      return;
    }
    try {
      setLoading(true);
      const headers = adminInfo
        ? {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          }
        : {};
      const response = await axios.delete(
        `${Base_URL}/UserRoles/delete/${ToBeDeleted}`,
        { headers }
      );
      if (response.data.status) {
        notifySuccess(t("userRoles.userRolesDeletedSuccessfully"));
        setIsModalOpen(false);
        fetchData(FilterStatus, FilterName, FilterBusinessGroup, currentPage, resultsPerPage);
      } else {
        notifyError(t("userRoles.failedToDeleteTheRole"));
      }
      setLoading(false);
    } catch (err) {
      console.error("Error removing role:", err);
      notifyError(err.response?.data?.message || t("userRoles.failedToDeleteRole"));
      setLoading(false);
    }
  };

  const fetchBusinessGroups = async () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    try {
      const res = await axios.get(`${Base_URL}/business-groups`, { headers });
      const list = Array.isArray(res.data?.businessGroups)
        ? res.data.businessGroups
        : Array.isArray(res.data)
          ? res.data
          : [];
      setBusinessGroups(list);
    } catch (err) {
      console.error("Failed to fetch business groups:", err);
      setBusinessGroups([]);
    }
  };

  useEffect(() => {
    fetchModules();
    fetchBusinessGroups();
  }, []);

  // When not superadmin, backend returns only assigned business group(s); auto-select when there is exactly one (create mode)
  const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;
  const {
    canAdd,
    canUpdate,
    canDelete,
    canView,
    canViewDetails,
  } = useModulePermissions("Global Settings", "User Roles");

  const currentUserRoleId = (adminInfo?.role?._id ?? adminInfo?.role?.id)?.toString?.() ?? "";
  const canEditRole = (roleRow) =>
    isSuperAdmin || !roleRow?._id || roleRow._id.toString() !== currentUserRoleId;
  useEffect(() => {
    if (businessGroups.length === 1 && !businessGroup) {
      setBusinessGroup(businessGroups[0]._id);
    }
  }, [businessGroups, businessGroup]);

  useEffect(() => {
    if (businessGroups.length === 1 && !FilterBusinessGroup) {
      setFilterBusinessGroup(businessGroups[0]._id);
    }
  }, [businessGroups, FilterBusinessGroup]);

  useEffect(() => {
    fetchData(FilterStatus, FilterName, FilterBusinessGroup, currentPage, resultsPerPage);
  }, [FilterStatus, FilterName, FilterBusinessGroup, currentPage, resultsPerPage]);

  const fetchData = (
    filterStatus,
    filterName,
    filterBusinessGroup,
    page = currentPage,
    limit = resultsPerPage
  ) => {
    setLoading(true);
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    axios
      .post(
        `${Base_URL}/UserRoles/get_all`,
        {
          FilterStatus: filterStatus,
          FilterName: filterName,
          FilterBusinessGroup: filterBusinessGroup || undefined,
          page,
          limit,
        },
        { headers }
      )
      .then((response) => {
        setData(response.data.data || []);
        setTotalRecords(response.data.totalRecords || 0);
        setLoading(false);
      })
      .catch((error) => {
        setData([]);
        setLoading(false);
      });
  };

  const fetchModules = () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    const isSuperAdmin = adminInfo?.role?.isSuperAdmin === true;

    // Step 1: get all modules definitions
    axios
      .post(`${Base_URL}/Module/get_all_modules`, {}, { headers })
      .then((response) => {
        const fetchedModules = response.data.data || [];

        // Super Admin can see/assign all modules + permissions
        if (isSuperAdmin) {
          const groupedModules = groupFetchedModules(fetchedModules).map((m) => ({
            ...m,
            readOnlyPermissions: [],
            isModuleReadOnly: false,
            subModules: m.subModules.map((s) => ({
              ...s,
              readOnlyPermissions: [],
              isSubmoduleReadOnly: false,
            })),
          }));
          setModules(groupedModules);
          buildLandingOptions(groupedModules);
          return;
        }

        // Step 2: get current user's allowed modules (with permissions)
        return axios
          .get(`${Base_URL}/Module/get_Dynamic_Modules/${adminInfo.id}`, {
            headers,
          })
          .then((dynRes) => {
            const roleDetails = dynRes.data?.role || {};
            const allowed = Array.isArray(roleDetails.modules)
              ? roleDetails.modules
              : [];
            const allowedIndex = buildAllowedIndex(allowed);

            const groupedModules = groupFetchedModules(fetchedModules)
              .map((parent) => {
                const allowedParent = allowedIndex.get(String(parent._id));
                if (!allowedParent) return null;

                const parentPermissions = parent.permissions.filter((p) =>
                  allowedParent.permissions.includes(p)
                );

                const subModules = parent.subModules
                  .map((child) => {
                    const subAllowed =
                      allowedParent.subPermissions[String(child._id)];
                    if (!subAllowed || !subAllowed.length) return null;

                    return {
                      ...child,
                      permissions: child.permissions.filter((p) =>
                        subAllowed.includes(p)
                      ),
                      readOnlyPermissions: [],
                      isSubmoduleReadOnly: false,
                    };
                  })
                  .filter(Boolean);

                if (!parentPermissions.length && !subModules.length) return null;

                return {
                  ...parent,
                  permissions: parentPermissions,
                  readOnlyPermissions: [],
                  isModuleReadOnly: false,
                  subModules,
                };
              })
              .filter(Boolean);

            setModules(groupedModules);
            buildLandingOptions(groupedModules);
          });
      })
      .catch((error) => {
        console.error("Error fetching modules:", error);
      });
  };

  // Function to build landing page options based on all available modules
  const buildLandingOptions = (modulesList = modules) => {
    const options = [];

    // Add a default option
    options.push({
      name: t("userRoles.mainPage"),
      path: "/home",
    });

    // Add all modules and submodules as options
    modulesList.forEach((module) => {
      // Add parent module
      options.push({
        name: module.label || module.module,
        path: module.path || "#",
      });

      // Add submodules
      module.subModules.forEach((sub) => {
        options.push({
          name: `${module.label || module.module} > ${sub.label || sub.module}`,
          path: sub.path || "#",
        });
      });
    });

    setLandingOptions(options);
  };

  const loadEditModuleView = async (selectedUserRole) => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    setModulesLoading(true);
    try {
      const allRes = await axios.post(
        `${Base_URL}/Module/get_all_modules`,
        {},
        { headers }
      );
      const fetchedModules = allRes.data?.data || [];

      if (isSuperAdmin) {
        const grouped = groupFetchedModules(fetchedModules).map((m) => ({
          ...m,
          readOnlyPermissions: [],
          isModuleReadOnly: false,
          subModules: m.subModules.map((s) => ({
            ...s,
            readOnlyPermissions: [],
            isSubmoduleReadOnly: false,
          })),
        }));
        setModules(grouped);
        buildLandingOptions(grouped);
        return;
      }

      const dynRes = await axios.get(
        `${Base_URL}/Module/get_Dynamic_Modules/${adminInfo.id}`,
        { headers }
      );
      const allowed = Array.isArray(dynRes.data?.role?.modules)
        ? dynRes.data.role.modules
        : [];
      const allowedIndex = buildAllowedIndex(allowed);
      const merged = mergeModulesForRoleEdit(
        fetchedModules,
        selectedUserRole.modules,
        allowedIndex,
        false
      );
      setModules(merged);
      buildLandingOptions(merged);
    } catch (err) {
      console.error("Failed to load modules for role edit:", err);
      notifyError(t("userRoles.failedToLoadModules") || "Failed to load modules");
    } finally {
      setModulesLoading(false);
    }
  };

  const handleAdd = () => {
    if (!isSuperAdmin && !canAdd) return;
    editingRoleBaselineRef.current = null;
    setId("");
    setName("");
    setLandingPage("");
    setSelectedModules({});
    setBusinessGroup("");
    setStatus(true);
    setErrors({ name: "", landingPage: "", businessGroup: "" });
    fetchModules();
    toggleDrawer();
  };

  const validateForm = async () => {
    let isValid = true;
    const newErrors = { name: "", landingPage: "", businessGroup: "" };

    if (!id && !businessGroup) {
      newErrors.businessGroup = t("userRoles.validation.businessGroupIsRequired") || "Business Group is required";
      isValid = false;
    }

    if (!name.trim()) {
      newErrors.name = t("userRoles.validation.roleNameIsRequired");
      isValid = false;
    } else if (name.length < 3) {
      newErrors.name = t("userRoles.validation.roleNameMustBeAtLeast3Characters");
      isValid = false;
    }

    if (!landingPage) {
      newErrors.landingPage = t("userRoles.validation.landingPageSelectionIsRequired");
      isValid = false;
    }

    const hasSelectedModule = Object.values(selectedModules).some(
      (module) => module.isSelected
    );
    if (!hasSelectedModule) {
      notifyError(t("userRoles.validation.atLeastOneModuleMustBeSelected"));
      isValid = false;
    }

    if (isValid && name.trim() && !id && businessGroup) {
      const normalizeForDuplicate = (n) =>
        (n || "").trim().replace(/\s+/g, " ").toLowerCase();
      const nameNorm = normalizeForDuplicate(name);
      const existingRole = data.find(
        (r) =>
          (r.businessGroup?._id || r.businessGroup) === businessGroup &&
          normalizeForDuplicate(r.name) === nameNorm
      );
      if (existingRole) {
        newErrors.name = "Role already exists in this Business Group";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleUpdate = async (UserRolesId) => {
    if (!isSuperAdmin && !canUpdate) return;
    setErrors({ name: "", landingPage: "", businessGroup: "" });
    const selectedUserRole = data.find((item) => item._id === UserRolesId);

    if (selectedUserRole) {
      editingRoleBaselineRef.current = JSON.parse(
        JSON.stringify(selectedUserRole.modules || [])
      );
      setId(UserRolesId);
      setName(selectedUserRole.name);
      setBusinessGroup(selectedUserRole.businessGroup?._id || selectedUserRole.businessGroup || "");
      setStatus(selectedUserRole.status !== false);

      setLandingPage(selectedUserRole.landing_page || "");

      // Role documents only store module `_id` + permissions (no name/path).
      // Do NOT call isHiddenRoleModule on those stubs — empty name/path is treated
      // as "hidden" and would wipe every checkbox on edit. The modules grid already
      // filters via groupFetchedModules / mergeModulesForRoleEdit.
      const mappedModules = (selectedUserRole.modules || []).reduce(
        (acc, module) => {
          const moduleId = module?._id != null ? String(module._id) : "";
          if (!moduleId) return acc;

          const subModules = (module.subModules || []).reduce((subAcc, sub) => {
            const subId = sub?._id != null ? String(sub._id) : "";
            if (!subId) return subAcc;
            subAcc[subId] = {
              isSelected: true,
              permissions: modulePermissionsList(sub.permissions).reduce(
                (permAcc, perm) => {
                  permAcc[perm] = true;
                  return permAcc;
                },
                {}
              ),
            };
            return subAcc;
          }, {});

          acc[moduleId] = {
            isSelected: true,
            permissions: modulePermissionsList(module.permissions).reduce(
              (permAcc, perm) => {
                permAcc[perm] = true;
                return permAcc;
              },
              {}
            ),
            subModules,
          };
          return acc;
        },
        {}
      );

      setSelectedModules(mappedModules);
      await loadEditModuleView(selectedUserRole);
      toggleDrawer();
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Return if already submitting
    if (isSubmitting || isCheckingName) return;

    if (!isSuperAdmin) {
      if (!id && !canAdd) {
        notifyError("Access restricted: you don't have permission to add roles.");
        return;
      }
      if (id && !canUpdate) {
        notifyError("Access restricted: you don't have permission to update roles.");
        return;
      }
    }

    setIsSubmitting(true);

    // Validate form
    const isValid = await validateForm();
    if (!isValid) {
      setIsSubmitting(false);
      return;
    }

    // Structure the modules data for submission
    const moduleMetaById = new Map(
      (modules || []).map((m) => [String(m._id), m])
    );
    const structuredModules = Object.entries(selectedModules)
      .filter(([moduleId, moduleData]) => {
        if (!moduleData.isSelected) return false;
        const meta = moduleMetaById.get(String(moduleId));
        return !isHiddenRoleModule(meta || {});
      })
      .map(([moduleId, moduleData]) => {
        const parentMeta = moduleMetaById.get(String(moduleId));
        const subMetaById = new Map(
          (parentMeta?.subModules || []).map((s) => [String(s._id), s])
        );
        return {
          _id: moduleId,
          // Include only selected permissions
          permissions: Object.entries(moduleData.permissions || {})
            .filter(([_, isSelected]) => isSelected)
            .map(([permission]) => permission),

          // Include only selected submodules
          subModules: Object.entries(moduleData.subModules || {})
            .filter(([subId, subData]) => {
              if (!subData.isSelected) return false;
              const subMeta = subMetaById.get(String(subId));
              return !isHiddenRoleModule(subMeta || {});
            })
            .map(([subId, subData]) => ({
              _id: subId,
              // Include only selected permissions within submodules
              permissions: Object.entries(subData.permissions || {})
                .filter(([_, isSelected]) => isSelected)
                .map(([permission]) => permission),
            })),
        };
      });

    const payload = {
      name: name.trim(),
      landing_page: landingPage,
      modules: structuredModules,
      status: !!status,
    };
    if (businessGroup) {
      payload.businessGroup = businessGroup;
    }

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    try {
      const url = id
        ? `${Base_URL}/UserRoles/update/${id}`
        : `${Base_URL}/UserRoles/add`;
      const method = id ? "put" : "post";

      const res = await axios[method](url, payload, { headers });

      if (res.data.status) {
        notifySuccess(
          res.data.message ||
            (id ? t("userRoles.roleUpdatedSuccessfully") : t("userRoles.roleCreatedSuccessfully"))
        );
        dispatchUserRolesChanged({
          businessGroupId: businessGroup || null,
          roleId: res.data?.data?._id || id || null,
        });
        fetchData(FilterStatus, FilterName, FilterBusinessGroup, currentPage, resultsPerPage);
        toggleDrawer();
      } else {
        notifyError(res.data.message || "Operation failed");
      }
    } catch (err) {
      console.error("Error submitting User Role:", err);
      notifyError(
        err.response?.data?.message || "An error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (role) => {
    if (!isSuperAdmin && !canUpdate) {
      notifyError("Access restricted: you don't have permission to update roles.");
      return;
    }
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    try {
      setLoading(true);
      const res = await axios.put(
        `${Base_URL}/UserRoles/toggle-status/${role._id}`,
        {},
        { headers }
      );

      if (res.data.status) {
        notifySuccess(res.data.message || t("userRoles.statusUpdated"));
        fetchData(FilterStatus, FilterName, FilterBusinessGroup, currentPage, resultsPerPage);
      } else {
        notifyError(res.data.message || t("userRoles.failedToUpdateStatus"));
      }
    } catch (err) {
      console.error("Error toggling status:", err);
      notifyError(err.response?.data?.message || t("modules.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const renderDrawerContent = () => {
    const [openAccordion, setOpenAccordion] = useState({});

    const toggleAccordion = (key) => {
      setOpenAccordion((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    };

    return (
      <div className="p-6 rounded-lg shadow-lg bg-white">
        <h2 className="text-2xl font-semibold mb-6 text-gray-700">
          {id ? t("userRoles.updateRole") : t("userRoles.addRole")}
        </h2>

        {/* Business Group — hidden when only one */}
        {businessGroups.length !== 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            {t("userRoles.businessGroup") || "Business Group"} {!id && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={businessGroup}
            onChange={(e) => {
              setBusinessGroup(e.target.value);
              if (errors.businessGroup) setErrors({ ...errors, businessGroup: "" });
            }}
            className={`border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
              errors.businessGroup ? "border-red-500" : ""
            }`}
            disabled={!!id && (data.find((r) => r._id === id)?.isSuperAdmin)}
          >
            <option value="">{t("userRoles.chooseAnOption")}</option>
            {businessGroups.map((bg) => (
              <option key={bg._id} value={bg._id}>{bg.companyName}</option>
            ))}
          </Select>
          {errors.businessGroup && (
            <p className="mt-1 text-sm text-red-500">{errors.businessGroup}</p>
          )}
        </div>
        )}

        {/* Role Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            {t("userRoles.roleName")} <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: "" });
            }}
            placeholder={t("userRoles.enterRoleName")}
            className={`border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 ${
              errors.name ? "border-red-500" : ""
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Landing Page Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            {t("userRoles.selectLandingPage")} <span className="text-red-500">*</span>
          </label>
          <Select
            value={landingPage}
            onChange={(e) => {
              setLandingPage(e.target.value);
              if (errors.landingPage) setErrors({ ...errors, landingPage: "" });
            }}
            className={`border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] ${
              errors.landingPage ? "border-red-500" : ""
            }`}
          >
            <option value="">{t("userRoles.chooseAnOption")}</option>
            {landingOptions.map((option) => (
              <option key={option.path} value={option.path}>
                {option.name}
              </option>
            ))}
          </Select>
          {errors.landingPage && (
            <p className="mt-1 text-sm text-red-500">{errors.landingPage}</p>
          )}
        </div>

        {/* Status */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            {t("hrReports.common.status")}
          </label>
          <div className="flex items-center gap-2">
            <ToggleSwitch
              isOn={status}
              handleToggle={() => setStatus((prev) => !prev)}
            />
            <span>{status ? t("active") : t("inactive")}</span>
          </div>
        </div>

        {/* Module Selection Section */}
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-700 mb-3">
            {t("userRoles.selectModulesAndPermissions")}{" "}
            <span className="text-red-500">*</span>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {t("userRoles.selectAtLeastOneModuleAndPermissions")}
          </p>
          {!isSuperAdmin && roleHasRestrictedPermissions(modules) && (
            <div className="mb-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <FiLock className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{t("userRoles.restrictedPermissionsNotice")}</p>
            </div>
          )}
        </div>

        {modulesLoading ? (
          <p className="text-sm text-gray-500 py-4">{t("loading") || "Loading modules..."}</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((module) => (
            <div
              key={module._id}
              className="border rounded-lg p-4 bg-gray-50 shadow"
            >
              {/* Parent Module Checkbox */}
              <label className="flex items-center mb-3">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-emerald-500 border-gray-300 rounded focus:ring-emerald-400 disabled:opacity-60"
                  checked={!!selectedModules[module._id]?.isSelected}
                  disabled={!!module.isModuleReadOnly}
                  title={
                    module.isModuleReadOnly
                      ? "This module is on the role but not in your access — view only"
                      : undefined
                  }
                  onChange={() => {
                    if (module.isModuleReadOnly) return;
                    setSelectedModules((prev) => {
                      const isSelected = !prev[module._id]?.isSelected;
                      const readOnlySet = new Set(module.readOnlyPermissions || []);

                      const updatedSubModules = {};
                      module.subModules.forEach((sub) => {
                        const subReadOnly = new Set(sub.readOnlyPermissions || []);
                        const prevSub = prev[module._id]?.subModules?.[sub._id];
                        updatedSubModules[sub._id] = {
                          isSelected: sub.isSubmoduleReadOnly
                            ? prevSub?.isSelected ?? true
                            : isSelected,
                          permissions: sub.permissions.reduce(
                            (acc, permission) => {
                              acc[permission] = subReadOnly.has(permission)
                                ? prevSub?.permissions?.[permission] ?? true
                                : isSelected;
                              return acc;
                            },
                            {}
                          ),
                        };
                      });

                      const updatedPermissions = module.permissions.reduce(
                        (acc, permission) => {
                          acc[permission] = readOnlySet.has(permission)
                            ? prev[module._id]?.permissions?.[permission] ?? true
                            : isSelected;
                          return acc;
                        },
                        {}
                      );

                      return {
                        ...prev,
                        [module._id]: {
                          isSelected: isSelected || readOnlySet.size > 0,
                          subModules: updatedSubModules,
                          permissions: updatedPermissions,
                        },
                      };
                    });
                  }}
                />
                <span className="ml-3 font-medium text-gray-700">
                  {module.label || module.module}
                </span>
              </label>

              {/* SubModules or Direct Permissions */}
              {selectedModules[module._id]?.isSelected && (
                <div>
                  <div
                    className="flex items-center justify-between cursor-pointer bg-gray-200 p-3 rounded-md"
                    onClick={() => toggleAccordion(module._id)}
                  >
                    <span className="font-medium text-gray-800">
                      {t("userRoles.permissions")}
                    </span>
                    <span>{openAccordion[module._id] ? "▲" : "▼"}</span>
                  </div>

                  {openAccordion[module._id] && (
                    <div className="ml-4 mt-4">
                      {module.subModules.length > 0
                        ? module.subModules.map((sub) => (
                            <div key={sub._id} className="mb-4">
                              {/* Submodule Checkbox */}
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  className="form-checkbox h-5 w-5 text-emerald-500 border-gray-300 rounded focus:ring-emerald-400 disabled:opacity-60"
                                  checked={
                                    !!selectedModules[module._id]?.subModules?.[
                                      sub._id
                                    ]?.isSelected
                                  }
                                  disabled={!!sub.isSubmoduleReadOnly}
                                  onChange={() => {
                                    if (sub.isSubmoduleReadOnly) return;
                                    setSelectedModules((prev) => {
                                      const isSelected =
                                        !prev[module._id]?.subModules?.[sub._id]
                                          ?.isSelected;
                                      const subReadOnly = new Set(
                                        sub.readOnlyPermissions || []
                                      );
                                      const prevSub =
                                        prev[module._id]?.subModules?.[sub._id];

                                      const updatedPermissions =
                                        sub.permissions.reduce(
                                          (acc, permission) => {
                                            acc[permission] = subReadOnly.has(
                                              permission
                                            )
                                              ? prevSub?.permissions?.[permission] ??
                                                true
                                              : isSelected;
                                            return acc;
                                          },
                                          {}
                                        );

                                      return {
                                        ...prev,
                                        [module._id]: {
                                          ...prev[module._id],
                                          subModules: {
                                            ...prev[module._id]?.subModules,
                                            [sub._id]: {
                                              isSelected: isSelected,
                                              permissions: updatedPermissions,
                                            },
                                          },
                                        },
                                      };
                                    });
                                  }}
                                />
                                <span className="ml-3 text-gray-700">
                                  {sub.label || sub.module}
                                </span>
                              </label>

                              {/* Permissions Under Submodule */}
                              {selectedModules[module._id]?.subModules?.[
                                sub._id
                              ]?.isSelected && (
                                <div className="ml-6 mt-4">
                                  {sub.permissions.map((permission) => (
                                    <label
                                      key={permission}
                                      className="flex items-center mb-2 text-gray-600"
                                    >
                                      <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 text-emerald-500 border-gray-300 rounded focus:ring-emerald-400 disabled:opacity-60"
                                        checked={
                                          !!selectedModules[module._id]
                                            ?.subModules?.[sub._id]
                                            ?.permissions?.[permission]
                                        }
                                        disabled={sub.readOnlyPermissions?.includes(
                                          permission
                                        )}
                                        title={
                                          sub.readOnlyPermissions?.includes(permission)
                                            ? "Your role cannot modify this permission on this role"
                                            : undefined
                                        }
                                        onChange={() => {
                                          if (
                                            sub.readOnlyPermissions?.includes(
                                              permission
                                            )
                                          ) {
                                            return;
                                          }
                                          setSelectedModules((prev) => ({
                                            ...prev,
                                            [module._id]: {
                                              ...prev[module._id],
                                              subModules: {
                                                ...prev[module._id]?.subModules,
                                                [sub._id]: {
                                                  ...prev[module._id]
                                                    ?.subModules?.[sub._id],
                                                  permissions: {
                                                    ...prev[module._id]
                                                      ?.subModules?.[sub._id]
                                                      ?.permissions,
                                                    [permission]:
                                                      !prev[module._id]
                                                        ?.subModules?.[sub._id]
                                                        ?.permissions?.[
                                                        permission
                                                      ],
                                                  },
                                                },
                                              },
                                            },
                                          }));
                                        }}
                                      />
                                      <span className="ml-3">
                                        {formatRolePermissionLabel(permission)}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        : // Direct Permissions for Module without Submodules
                          module.permissions.map((permission) => (
                            <label
                              key={permission}
                              className="flex items-center mb-2"
                            >
                              <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-emerald-500 border-gray-300 rounded focus:ring-emerald-400 disabled:opacity-60"
                                checked={
                                  !!selectedModules[module._id]?.permissions?.[
                                    permission
                                  ]
                                }
                                disabled={module.readOnlyPermissions?.includes(
                                  permission
                                )}
                                title={
                                  module.readOnlyPermissions?.includes(permission)
                                    ? "Your role cannot modify this permission on this role"
                                    : undefined
                                }
                                onChange={() => {
                                  if (
                                    module.readOnlyPermissions?.includes(permission)
                                  ) {
                                    return;
                                  }
                                  setSelectedModules((prev) => ({
                                    ...prev,
                                    [module._id]: {
                                      ...prev[module._id],
                                      isSelected: true,
                                      permissions: {
                                        ...prev[module._id]?.permissions,
                                        [permission]:
                                          !prev[module._id]?.permissions?.[
                                            permission
                                          ],
                                      },
                                    },
                                  }));
                                }}
                              />
                              <span className="ml-3 text-gray-600">
                                {formatRolePermissionLabel(permission)}
                              </span>
                            </label>
                          ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        {/* Footer Buttons */}
        <div className="mt-8 flex justify-center">
          <Button
            style={{ background: "#E6E7EB", color: "black" }}
            onClick={toggleDrawer}
          >
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleFormSubmit}
            disabled={
              isSubmitting ||
              isCheckingName ||
              (!isSuperAdmin && (id ? !canUpdate : !canAdd))
            }
            className={`ml-3 ${isSubmitting ? "opacity-70" : ""}`}
            style={{ backgroundColor: buttonColor }}
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin inline-block mr-2">⟳</span>
                {id ? t("userRoles.updating") : t("userRoles.adding")}
              </>
            ) : id ? (
              t("userRoles.updateRole")
            ) : (
              t("userRoles.addRole")
            )}
          </Button>
        </div>
      </div>
    );
  };

  const content = (
    <div className="p-6 bg-white min-h-screen">
      <PageHeader title={t("userRoles.title")} />
      <AnimatedContent>
        <Card>
          <CardBody>
            <div className="flex flex-col md:flex-row gap-3 justify-end pb-4 flex-wrap items-center">
              <div className="w-full md:w-[220px] shrink-0">
                <InputField
                  type="text"
                  name="search"
                  value={FilterName}
                  onChange={(e) => {
                    setFilterText(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={t("systemUsers.searchText")}
                />
              </div>

              {businessGroups.length !== 1 && (
                <div className="w-full md:w-[220px] shrink-0">
                  <DropdownBasic
                    value={FilterBusinessGroup}
                    onChange={(value) => {
                      setFilterBusinessGroup(value);
                      setCurrentPage(1);
                    }}
                    width="220px"
                    options={[
                      {
                        label:
                          t("userRoles.allBusinessGroups") ||
                          "All Business Groups",
                        value: "",
                      },
                      ...businessGroups.map((bg) => ({
                        label: bg.companyName,
                        value: bg._id,
                      })),
                    ]}
                  />
                </div>
              )}

              <div className="w-full md:w-[180px] shrink-0">
                <DropdownBasic
                  value={FilterStatus}
                  onChange={(value) => {
                    setFilterStatus(value);
                    setCurrentPage(1);
                  }}
                  width="180px"
                  options={[
                    { label: t("All"), value: "" },
                    { label: t("active"), value: true },
                    { label: t("inactive"), value: false },
                  ]}
                />
              </div>

              {(isSuperAdmin || canAdd) && (
                <LayoutButton
                  onClick={handleAdd}
                  className="whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: buttonColor,
                    whiteSpace: "nowrap",
                    width: "auto",
                    minWidth: "max-content",
                  }}
                  startIcon={<FiPlus />}
                >
                  {t("userRoles.addRole")}
                </LayoutButton>
              )}
            </div>
          </CardBody>
        </Card>
      </AnimatedContent>

      <DataTable
        headers={[
          ...(businessGroups.length !== 1
            ? [t("userRoles.businessGroup") || "Business Group"]
            : []),
          t("hrReports.common.name"),
          t("userRoles.internalName") || "Internal Name",
          t("userRoles.selectLandingPage"),
          t("hrReports.common.status"),
          t("Actions"),
        ]}
        data={data}
        loading={loading}
        noPadding={true}
        // pagination
        currentPage={currentPage}
        recordsPerPage={resultsPerPage}
        totalRecords={totalRecords}
        totalPages={Math.ceil(totalRecords / resultsPerPage)}
        onPageChange={(page) => {
          setCurrentPage(page);
          fetchData(FilterStatus, FilterName, FilterBusinessGroup, page, resultsPerPage);
        }}
        onRecordsPerPageChange={(limit) => {
          const newLimit = Number(limit);
          setRecordsPerPage(newLimit);
          setCurrentPage(1);
          fetchData(FilterStatus, FilterName, FilterBusinessGroup, 1, newLimit);
        }}
        // rendering
        colWidths={{
          Actions: "150px",
        }}
        renderRow={(UserRoles) => (
          <TableRow key={UserRoles._id}>
            {businessGroups.length !== 1 && (
            <TableCell>
              {UserRoles.businessGroup?.companyName ?? (UserRoles.businessGroup ? "-" : t("userRoles.global") || "Global")}
            </TableCell>
            )}
            <TableCell>{UserRoles.name}</TableCell>
            <TableCell>{UserRoles.internalName || "-"}</TableCell>
            <TableCell>{UserRoles.landing_page}</TableCell>
            <TableCell>
              <ToggleSwitch
                isOn={UserRoles.status === true}
                handleToggle={() => handleStatusToggle(UserRoles)}
                disabled={!isSuperAdmin && (!canUpdate || !canEditRole(UserRoles))}
              />
            </TableCell>

            <TableCell>
              <ActionButtons
                isCell={true}
                items={[
                  {
                    action: ACTION_BUTTON_TYPES.VIEW,
                    tooltip: t("userRoles.viewAssignedMembers"),
                    permission: isSuperAdmin || canViewDetails,
                    onClick: () =>
                      handleViewAssignedMembers(UserRoles._id, UserRoles.name),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.EDIT,
                    tooltip: canEditRole(UserRoles) ? t("userRoles.editRole") : t("userRoles.cannotEditOwnRole"),
                    permission: isSuperAdmin || (canUpdate && canEditRole(UserRoles)),
                    onClick: () => handleUpdate(UserRoles._id),
                  },
                  {
                    action: ACTION_BUTTON_TYPES.DELETE,
                    tooltip: canEditRole(UserRoles) ? t("userRoles.deleteRole") : t("userRoles.cannotEditOwnRole"),
                    permission: isSuperAdmin || (canDelete && canEditRole(UserRoles)),
                    onClick: () => handleDelete(UserRoles._id),
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        )}
      />

      <MainDrawer>{renderDrawerContent()}</MainDrawer>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalBody className="text-center px-8 pt-6 pb-4">
          <FiTrash2 className="text-3xl mb-6 text-red-500 mx-auto" />
          <h2 className="text-xl font-medium mb-2">{t("userRoles.deleteThisRole")}</h2>
          <p>{t("userRoles.areYouSureDeleteThisRole")}</p>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button layout="outline" onClick={closeModal}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleDeleteItem}
            className="bg-red-500 w-full sm:w-auto"
            disabled={loading || (!isSuperAdmin && !canDelete)}
          >
            {loading ? t("userRoles.deleting") : t("Delete")}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Assigned Members Modal */}
      <Modal isOpen={isMembersModalOpen} onClose={closeMembersModal}>
        <ModalBody className="px-8 pt-6 pb-4">
          <div className="flex items-center mb-6">
            <FiUsers className="text-2xl text-blue-500 mr-3" />
            <h2 className="text-xl font-semibold text-gray-800">
              {t("userRoles.assignedMembers")} - {selectedRoleName}
            </h2>
          </div>

          {loadingMembers ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">{t("userRoles.loadingMembers")}</span>
            </div>
          ) : assignedMembers.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {assignedMembers.map((member, index) => (
                  <div
                    key={member.email || index}
                    className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {member.profileImage ? (
                        <img
                          src={member.profileImage}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {member.name
                              ? member.name.charAt(0).toUpperCase()
                              : "U"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {member.name || t("userRoles.unknownUser")}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {member.email ||
                              member.username ||
                              t("userRoles.noEmailProvided")}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              member.status === true
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {member.status === true ? t("active") : t("inactive")}
                          </span>
                        </div>
                      </div>
                      {member.createdAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t("userRoles.assigned")}{" "}
                          {new Date(member.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FiUsers className="text-4xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t("userRoles.noMembersAssigned")}
              </h3>
              <p className="text-gray-500">
                {t("userRoles.thisRoleDoesntHaveAnyUsersAssigned")}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button layout="outline" onClick={closeMembersModal}>
            {t("Close")}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );

  if (isSuperAdmin) return content;

  return (
    <ModuleAccessGate
      moduleName="Global Settings"
      subModuleName="User Roles"
      title={t("userRoles.title")}
    >
      {content}
    </ModuleAccessGate>
  );
};

export default UserRoles;
