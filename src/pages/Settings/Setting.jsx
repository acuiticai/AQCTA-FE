import { useState, useEffect, useContext, useMemo } from "react";
import { X, Building, Plug, ChevronRight } from "lucide-react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import icon7 from "@/pages/SettingScreen/icons/icon7.svg";
import icon6 from "@/pages/SettingScreen/icons/icon6.svg";
import icon1 from "@/pages/SettingScreen/icons/icon1.svg";
import icon2 from "@/pages/SettingScreen/icons/icon2.svg";
import icon3 from "@/pages/SettingScreen/icons/icon3.svg";
import icon4 from "@/pages/SettingScreen/icons/icon4.svg";
import icon5 from "@/pages/SettingScreen/icons/icon5.svg";
import { AdminContext } from "@/context/AdminContext";
import { Redirect, useHistory, useLocation } from "react-router-dom";
import { notifyError } from "@/utils/toast";
import { DropdownBasic } from "@/page-layouts/index";
import { FiBell, FiDollarSign, FiClipboard } from "react-icons/fi";
import { GiBank } from "react-icons/gi";
import { TbTemplate } from "react-icons/tb";
import { FiMonitor } from "react-icons/fi";
import CloneSettingsModal from "@/components/settings/CloneSettingsModal";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import {
  filterVisibleSettingsSections,
  getSubscribedModuleKeys,
} from "@/utils/settingsRbacConfig";
import FleetManagementServices from "@/services/FleetManagementServices";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  FLEET_TERMINOLOGY_CHANGED_EVENT,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import { useBusinessEInvoiceEnabled } from "@/hooks/useBusinessEInvoiceEnabled";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SECTION_ACCENTS = {
  Operations: {
    badge: "bg-violet-50 text-violet-700",
    link: "hover:border-violet-200 hover:bg-violet-50/70 hover:text-violet-700",
    chevron: "group-hover/item:text-violet-500",
  },
  Notification: {
    badge: "bg-amber-50 text-amber-700",
    link: "hover:border-amber-200 hover:bg-amber-50/70 hover:text-amber-700",
    chevron: "group-hover/item:text-amber-500",
  },
};

const SettingsPage = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  const ts = (key, defaultValue, options) =>
    t(`settingsPage.${key}`, { defaultValue, ...options });
  const [businesses, setBusinesses] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [hasSelectedOrg, setHasSelectedOrg] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [fleetTerms, setFleetTerms] = useState(DEFAULT_FLEET_TERMINOLOGY);

  useEffect(() => {
    if (!adminInfo?.id) return;
    axios
      .get(`${Base_URL}/admin/assigned/${adminInfo.id}`, {
        headers: { authorization: `Bearer ${adminInfo?.token}` },
      })
      .then((res) => setBusinesses(res.data?.businesses || []))
      .catch(() => {});
  }, [adminInfo?.id]);

  useEffect(() => {
    // Only restore from URL param (when navigating back from a sub-settings page)
    const searchParams = new URLSearchParams(window.location.search);
    const urlSelectedOrg = searchParams.get("selectedOrg");
    if (urlSelectedOrg) {
      setSelectedOrg(urlSelectedOrg);
      setHasSelectedOrg(true);
    }
  }, []);

  // Monitor route changes and clear business selection when leaving settings
  useEffect(() => {
    const settingsRoutes = [
      "/Settings",
      "/settings",
      "/reminders",
      "/cheque-reminders",
      "/accounts/e-invoice-settings",
      "/accounts/service-monster",
      "/accounts/whatsapp-integration",
      "/accounts/zoho-books",
      "/settings/integrations/cliniko",
      "/taxes",
      "/vendor-invoice-approval",
      "/credit-notes-approval",
      "/special-transfers-types",
      "/PaymentMethods",
      "/TransactionTypes",
      "/AdvanceTypes",
      "/Channels",
      "/Documents_Misc_Data_Types",
      "/Finance_Misc_Data_Types",
      "/Currency",
      "/Departments_Positions",
      "/Leaves",
      "/claims",
      "/Branch_Locations",
      "/Shifts",
      "/PublicHolidays",
      "/WFHSettings",
      "/WFHGroups",
      "/Item_Misc_Data_Types",
      "/Miscellanious_Misc_Data_Types",
      "/notification-events",
      "/EmailTemplatesUI",
      "/Operations_Misc_Data_Types",
      "/fleet-job-scheduling-settings",
      "/Purchase_Misc_Data_Types",
      "/Sales_Misc_Data_Types",
      "/settings/module-labels",
      "/account-types",
      "/bank-account-types",
      "/bank-account-mapping",
      "/document-types",
      "/document_templates",
      "/payroll-pay-elements",
      "/payroll-company-settings",
      "/payroll-statutory-settings",
      "/payroll-pay-groups",
      "/settings/custom-fields",
      "/settings/application-documents",
      "/settings/application-fields",
      "/settings/dynamic-forms",
      "/settings/class-categories",
      "/pos/settings",
    ];

    const checkAndClearBusiness = () => {
      const currentPath = window.location.pathname;
      const isSettingsRoute = settingsRoutes.some(
        (route) => currentPath === route || currentPath.startsWith(route + "/"),
      );

      if (!isSettingsRoute) {
        // Clear business selection when leaving settings
        sessionStorage.removeItem("settingsSelectedOrg");
      }
    };

    // Check on mount
    checkAndClearBusiness();

    // Listen to route changes
    const unlisten = history.listen((location) => {
      checkAndClearBusiness();
    });

    return () => {
      unlisten();
    };
  }, [history]);

  // Update hasSelectedOrg when selectedOrg changes
  useEffect(() => {
    if (selectedOrg) {
      setHasSelectedOrg(true);
    } else {
      setHasSelectedOrg(false);
    }
  }, [selectedOrg]);

  const roleModules = adminInfo?.role?.modules;
  const modulesReady = Array.isArray(roleModules);

  const canAccessPath = (path) => {
    if (!path) return false;
    if (adminInfo?.role?.isSuperAdmin) return true;
    return hasPathPermission(roleModules, path, PERMISSION_ACTION.VIEW);
  };

  const canViewSettings = useMemo(() => {
    if (adminInfo?.role?.isSuperAdmin) return true;
    if (!modulesReady) return false;
    return canAccessPath("/settings");
  }, [adminInfo?.role?.isSuperAdmin, modulesReady, roleModules]);

  useEffect(() => {
    if (!selectedOrg) {
      setFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
      return;
    }
    let cancelled = false;
    FleetManagementServices.getFleetScheduleSettings({ business: selectedOrg })
      .then((res) => {
        if (!cancelled) setFleetTerms(normalizeFleetTerminology(res?.data));
      })
      .catch(() => {
        if (!cancelled) setFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrg, location.pathname]);

  useEffect(() => {
    const onFleetTermsChanged = (e) => {
      const bid = e?.detail?.businessId;
      if (!bid || String(bid) !== String(selectedOrg)) return;
      FleetManagementServices.getFleetScheduleSettings({
        business: selectedOrg,
      })
        .then((res) => setFleetTerms(normalizeFleetTerminology(res?.data)))
        .catch(() => setFleetTerms(DEFAULT_FLEET_TERMINOLOGY));
    };
    window.addEventListener(
      FLEET_TERMINOLOGY_CHANGED_EVENT,
      onFleetTermsChanged,
    );
    return () =>
      window.removeEventListener(
        FLEET_TERMINOLOGY_CHANGED_EVENT,
        onFleetTermsChanged,
      );
  }, [selectedOrg]);

  const { enabled: eInvoiceModuleEnabled } =
    useBusinessEInvoiceEnabled(selectedOrg);

  const sections = useMemo(
    () => [
      // Accounts first; Integrations grouped separately (matches sidebar)
      {
        title: "Accounts",
        icon: <img src={icon2} alt="Sales Icon" className="w-11 h-11" />,
        bgClass: "bg-blue-100",
        items: [
          ...(eInvoiceModuleEnabled
            ? [
                {
                  name: "E-Invoice Settings",
                  nameKey: "eInvoiceSettings",
                  href: `/accounts/e-invoice-settings?selectedOrg=${selectedOrg}`,
                },
              ]
            : []),
          {
            name: "Payment Reminders",
            nameKey: "paymentReminders",
            href: `/reminders?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Cheque Reminders",
            nameKey: "chequeReminders",
            href: `/cheque-reminders?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Taxes",
            nameKey: "taxes",
            href: `/taxes?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Vendor Invoice Approval",
            nameKey: "vendorInvoiceApproval",
            href: `/vendor-invoice-approval?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Credit Notes Approval",
            nameKey: "creditNotesApproval",
            href: `/credit-notes-approval?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Special Transfers Types",
            nameKey: "specialTransfersTypes",
            href: `/special-transfers-types?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Payment Methods",
            nameKey: "paymentMethods",
            href: `/PaymentMethods?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Transaction Types",
            nameKey: "transactionTypes",
            href: `/TransactionTypes?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Advance Types",
            nameKey: "advanceTypes",
            href: `/AdvanceTypes?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Sales Channels",
            nameKey: "salesChannels",
            href: `/Channels?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Integrations",
        icon: <Plug className="w-6 h-6 text-gray-600" />,
        bgClass: "bg-indigo-100",
        items: [
          {
            name: "Service Monster Config",
            nameKey: "serviceMonsterConfig",
            href: `/accounts/service-monster?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Zoho Books",
            nameKey: "zohoBooks",
            href: `/accounts/zoho-books?selectedOrg=${selectedOrg}`,
          },
          {
            name: "WhatsApp Integration",
            nameKey: "whatsappIntegration",
            href: `/accounts/whatsapp-integration?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Cliniko",
            nameKey: "cliniko",
            href: `/settings/integrations/cliniko?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Operations",
        icon: <FiClipboard className="w-5 h-5 text-violet-600" />,
        bgClass: "bg-violet-100",
        description: "Configure application documents, fields, and categories.",
        items: [
          {
            name: "Application Documents",
            nameKey: "applicationDocuments",
            href: `/settings/application-documents?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Application Fields",
            nameKey: "applicationFields",
            href: `/settings/application-fields?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Dynamic Forms",
            nameKey: "dynamicForms",
            href: `/settings/dynamic-forms?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Class / Category",
            nameKey: "classCategories",
            href: `/settings/class-categories?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Fleet management",
        icon: <img src={icon1} alt="Fleet management" className="w-11 h-11" />,
        bgClass: "bg-sky-100",
        items: [
          {
            name: fleetTerms.vehicleTypeLabelPlural,
            nameKey:
              fleetTerms.vehicleTypeLabelPlural === "Vehicle types"
                ? "vehicleTypes"
                : undefined,
            href: `/fleet-job-scheduling-settings?selectedOrg=${selectedOrg}&fleetTab=vehicle-types`,
          },
          {
            name: fleetTerms.vehicleLabelPlural,
            nameKey:
              fleetTerms.vehicleLabelPlural === "Vehicles"
                ? "vehicles"
                : undefined,
            href: `/fleet-job-scheduling-settings?selectedOrg=${selectedOrg}&fleetTab=vehicles`,
          },
          {
            name: "Dispatch schedule",
            nameKey: "dispatchSchedule",
            href: `/fleet-job-scheduling-settings?selectedOrg=${selectedOrg}&fleetTab=schedule`,
          },
          {
            name: "Custom names (labels)",
            nameKey: "customNamesLabels",
            href: `/fleet-job-scheduling-settings?selectedOrg=${selectedOrg}&fleetTab=terminology`,
          },
        ],
      },
      {
        title: "Document Manager",
        icon: <img src={icon4} alt="Document Manager" className="w-11 h-11" />,
        bgClass: "bg-gray-200",
        items: [
          {
            name: "Misc. Data Types",
            nameKey: "miscDataTypes",
            href: `/Documents_Misc_Data_Types?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Document Types",
            nameKey: "documentTypes",
            href: `/document-types?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Finance",
        icon: <img src={icon3} alt="Sales Icon" className="w-11 h-11" />,
        bgClass: "bg-gray-200",
        items: [
          {
            name: "Currency",
            nameKey: "currency",
            href: `/Currency?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "HR Management",
        icon: (
          <img src={icon5} alt="HR Management Icon" className="w-11 h-11" />
        ),
        bgClass: "bg-gray-200",
        items: [
          {
            name: "Departments & Positions",
            nameKey: "departmentsPositions",
            href: `/Departments_Positions?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Foreign Worker Management",
            nameKey: "foreignWorkerManagement",
            href: `/Foreign_Worker_Management?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Leaves",
            nameKey: "leaves",
            href: `/Leaves?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Claims",
            nameKey: "claims",
            href: `/claims?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Branches & Locations",
            nameKey: "branchesLocations",
            href: `/Branch_Locations?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Shifts",
            nameKey: "shifts",
            href: `/Shifts?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Public Holidays",
            nameKey: "publicHolidays",
            href: `/PublicHolidays?selectedOrg=${selectedOrg}`,
          },
          {
            name: "WFH Allowance",
            nameKey: "wfhAllowance",
            href: `/WFHSettings?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Payroll",
        icon: <FiDollarSign className="w-5 h-5 text-gray-500" />,
        bgClass: "bg-emerald-100",
        items: [
          {
            name: "Pay Elements",
            nameKey: "payElements",
            href: `/payroll-pay-elements?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Settings",
            nameKey: "settings",
            href: `/payroll-company-settings?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Statutory Config",
            nameKey: "statutoryConfig",
            href: `/payroll-statutory-settings?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Pay Groups",
            nameKey: "payGroups",
            href: `/payroll-pay-groups?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Notification",
        icon: <FiBell className="w-5 h-5 text-amber-600" />,
        bgClass: "bg-amber-100",
        description: "Manage notification events and delivery settings.",
        items: [
          {
            name: "Notification Events",
            nameKey: "notificationEvents",
            href: `/notification-events?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "POS",
        icon: <FiMonitor className="w-5 h-5 text-gray-500" />,
        bgClass: "bg-orange-100",
        items: [
          {
            name: "POS Settings",
            nameKey: "posSettings",
            href: `/pos/settings?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Purchase",
        icon: <img src={icon6} alt="Sales Icon" className="w-11 h-11" />,
        bgClass: "bg-gray-200",
        items: [
          {
            name: "Misc. Data Types",
            nameKey: "miscDataTypes",
            href: `/Purchase_Misc_Data_Types?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Customer",
        icon: <img src={icon7} alt="Customer Icon" className="w-11 h-11" />,
        bgClass: "bg-gray-200",
        items: [
          {
            name: "Dynamic Module Labels",
            nameKey: "dynamicModuleLabels",
            href: `/settings/module-labels?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Misc. Data Types",
            nameKey: "miscDataTypes",
            href: `/Sales_Misc_Data_Types?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Templates",
        icon: <TbTemplate className="w-5 h-5 text-gray-500" />,
        bgClass: "bg-purple-100",
        items: [
          {
            name: "Document Templates",
            nameKey: "documentTemplates",
            href: `/document_templates?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Treasury & Finance",
        icon: <GiBank className="w-5 h-5 text-gray-500" />,
        bgClass: "bg-green-100",
        items: [
          {
            name: "Account Types",
            nameKey: "accountTypes",
            href: `/account-types?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Bank Account Types",
            nameKey: "bankAccountTypes",
            href: `/bank-account-types?selectedOrg=${selectedOrg}`,
          },
          {
            name: "Bank Account Mapping",
            nameKey: "bankAccountMapping",
            href: `/bank-account-mapping?selectedOrg=${selectedOrg}`,
          },
        ],
      },
      {
        title: "Clone Settings",
        icon: (
          <div className="w-5 h-5 flex items-center justify-center text-gray-600 font-semibold">
            ⧉
          </div>
        ),
        bgClass: "bg-yellow-100",
        items: [
          {
            name: "Clone Settings",
            nameKey: "cloneSettings",
            isAction: true,
            requiredPath: "/settings",
            onClick: () => {
              if (!businesses?.length) {
                notifyError(
                  ts(
                    "noBusinessesToClone",
                    "No businesses available to clone settings.",
                  ),
                );
                return;
              }
              setCloneModalOpen(true);
            },
          },
        ],
      },
    ],
    [
      selectedOrg,
      fleetTerms,
      businesses,
      eInvoiceModuleEnabled,
      adminInfo?.role?.isSuperAdmin,
      roleModules,
      t,
    ],
  );

  const subscribedModuleKeys = useMemo(
    () => getSubscribedModuleKeys(adminInfo, roleModules),
    [adminInfo, roleModules],
  );

  const applyModuleSettingsFilter =
    adminInfo?.subscription?.isSelfRegistered === true;

  const visibleSections = useMemo(
    () =>
      filterVisibleSettingsSections(sections, {
        canAccessPath,
        subscribedKeys: subscribedModuleKeys,
        applyModuleFilter: applyModuleSettingsFilter,
        roleModules,
        isSuperAdmin: adminInfo?.role?.isSuperAdmin === true,
      }),
    [
      sections,
      adminInfo?.role?.isSuperAdmin,
      roleModules,
      subscribedModuleKeys,
      applyModuleSettingsFilter,
    ],
  );

  return (
    <>
      <AppLayout>
        <Header />
        <div className="relative min-h-screen max-h-[90vh] overflow-y-auto bg-[#f4f6fb]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-violet-100/50 blur-3xl" />
            <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-amber-100/40 blur-3xl" />
          </div>
          {modulesReady && !canViewSettings ? (
            <Redirect to="/unauthorized" />
          ) : (
            <div className="relative px-6 py-8 pb-[120px]">
              <div className="mb-10 rounded-3xl border border-slate-200/70 bg-white px-6 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] lg:px-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      {ts("settingsHubLabel", "Settings")}
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                      {ts("allSettings", "All Settings")}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                      {ts(
                        "settingsHubSubtitle",
                        "Manage your organization configuration, operations, and notifications from one place.",
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      sessionStorage.removeItem("settingsSelectedOrg");
                      const fromPath = sessionStorage.getItem("fromPath") || "/";
                      history.push(fromPath);
                      sessionStorage.removeItem("fromPath");
                    }}
                    className="inline-flex items-center self-start rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-100"
                  >
                    <X className="mr-2 h-4 w-4" />
                    {ts("closeSettings", "Close Settings")}
                  </button>
                </div>
              </div>

              <div className="relative">
                {!hasSelectedOrg && (
                  <div className="pointer-events-none fixed left-0 right-0 top-1/3 z-10 flex items-center justify-center px-4">
                    <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-50">
                        <Building className="h-6 w-6 text-[#A6C437]" />
                      </div>
                      <h3 className="text-center text-lg font-semibold text-slate-900">
                        {ts("selectBusiness", "Select Business")}
                      </h3>
                      <p className="mt-2 text-center text-sm text-slate-500">
                        {ts(
                          "selectBusinessPrompt",
                          "Please select a business from the dropdown to access settings.",
                        )}
                      </p>
                      <div className="relative z-20 mt-5 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <Building className="mr-3 h-5 w-5 shrink-0 text-slate-400" />
                        <DropdownBasic
                          name="company"
                          type="select"
                          className={`w-full ${!hasSelectedOrg ? "border-[#A6C437] animate-pulse" : "border-transparent"}`}
                          isBusinessDropdown={true}
                          businessDropdownProps={{
                            selectedBusiness: selectedOrg,
                            onChange: (value) => {
                              setSelectedOrg(value);
                              setHasSelectedOrg(value !== "");
                              if (value) {
                                sessionStorage.setItem(
                                  "settingsSelectedOrg",
                                  value,
                                );
                              } else {
                                sessionStorage.removeItem("settingsSelectedOrg");
                              }
                            },
                            placeholder: ts("selectBusiness", "Select Business"),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={`relative mx-auto grid max-w-5xl grid-cols-1 gap-7 md:grid-cols-2 ${
                    !hasSelectedOrg ? "blur-[2px] opacity-90" : ""
                  } transition-all duration-300`}
                >
                  {visibleSections.map((section, index) => {
                    const accent =
                      SECTION_ACCENTS[section.title] || SECTION_ACCENTS.Operations;
                    const itemCount = section.items.filter(
                      (item) => item?.name || item?.href || item?.isAction,
                    ).length;

                    return (
                    <div
                      key={index}
                      className="group rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_10px_40px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                    >
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                        <span
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${section.bgClass || "bg-gray-200"}`}
                        >
                          {section.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900">
                              {ts(
                                `sectionTitles.${section.title}`,
                                section.title,
                              )}
                            </h2>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${accent.badge}`}>
                              {itemCount}
                            </span>
                          </div>
                          {section.description ? (
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                              {section.description}
                            </p>
                          ) : null}
                        </div>
                        </div>
                      </div>

                      <ul className="space-y-2.5">
                        {section.items
                          .filter((item) => item?.name || item?.href || item?.isAction)
                          .map((item, itemIndex) => (
                          <li key={itemIndex} className="group/item">
                            {item.isAction ? (
                              <button
                                type="button"
                                className={`flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 text-left text-sm font-medium text-slate-700 transition ${
                                  !hasSelectedOrg
                                    ? "pointer-events-none cursor-not-allowed opacity-60"
                                    : accent.link
                                }`}
                                onClick={(e) => {
                                  if (!hasSelectedOrg) return;
                                  item.onClick?.(e);
                                }}
                              >
                                <span>
                                  {item.nameKey
                                    ? ts(`items.${item.nameKey}`, item.name)
                                    : item.name}
                                </span>
                                <ChevronRight className={`h-4 w-4 text-slate-400 transition ${!hasSelectedOrg ? "" : accent.chevron}`} />
                              </button>
                            ) : (
                              <a
                                href={hasSelectedOrg ? item.href : "#"}
                                className={`flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 text-sm font-medium text-slate-700 transition ${
                                  !hasSelectedOrg
                                    ? "pointer-events-none cursor-not-allowed opacity-60"
                                    : accent.link
                                }`}
                                onClick={(e) => {
                                  if (!hasSelectedOrg) {
                                    e.preventDefault();
                                    document.querySelector("select")?.focus();
                                  }
                                }}
                              >
                                <span>
                                  {item.nameKey
                                    ? ts(`items.${item.nameKey}`, item.name)
                                    : item.name}
                                </span>
                                <ChevronRight className={`h-4 w-4 text-slate-400 transition ${!hasSelectedOrg ? "" : accent.chevron}`} />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    );
                  })}
                </div>

                {hasSelectedOrg && visibleSections.length === 0 && (
                  <div className="flex justify-center py-10">
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center text-sm text-slate-600 shadow-sm">
                      {ts(
                        "noModulesAvailable",
                        "No settings modules are available for your role.",
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppLayout>

      <CloneSettingsModal
        open={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        businesses={businesses}
      />
    </>
  );
};

export default SettingsPage;
