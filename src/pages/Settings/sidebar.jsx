import { useState, useEffect, useContext, useMemo } from "react";
import {
  ArrowLeft,
  DollarSign,
  Plug,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import icon7 from "@/pages/SettingScreen/icons/icon7.svg";
import icon6 from "@/pages/SettingScreen/icons/icon6.svg";
import icon1 from "@/pages/SettingScreen/icons/icon1.svg";
import icon2 from "@/pages/SettingScreen/icons/icon2.svg";
import icon3 from "@/pages/SettingScreen/icons/icon3.svg";
import icon4 from "@/pages/SettingScreen/icons/icon4.svg";
import icon5 from "@/pages/SettingScreen/icons/icon5.svg";
import bellIcon from "@/assets/img/icons/bell.svg";
import { AdminContext } from "@/context/AdminContext";
import { useLocation, useHistory } from "react-router-dom";
import FleetManagementServices from "@/services/FleetManagementServices";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  FLEET_TERMINOLOGY_CHANGED_EVENT,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import { useBusinessEInvoiceEnabled } from "@/hooks/useBusinessEInvoiceEnabled";
import { hasPathPermission, PERMISSION_ACTION } from "@/utils/permissionUtils";
import {
  filterVisibleSettingsSections,
  getSubscribedModuleKeys,
} from "@/utils/settingsRbacConfig";
// Keep Settings logo consistent with the main app sidebar/navbar logo
import { FiBell, FiClipboard } from "react-icons/fi";
import { GiBank } from "react-icons/gi";
import { TbTemplate } from "react-icons/tb";
import { FiMonitor } from "react-icons/fi";

import {
  BRANDING_PLACEHOLDER_LOGO,
  fetchBrandingLogo,
  readCachedBrandingLogo,
  writeCachedBrandingLogo,
} from "@/utils/brandingLogo";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Sidebar = ({ isOpen, onClose, onOpen }) => {
  const { t } = useTranslation();
  const ts = (key, defaultValue, options) =>
    t(`settingsPage.${key}`, { defaultValue, ...options });
  const location = useLocation();
  const history = useHistory();
  const isSettingsHome =
    location.pathname === "/Settings" || location.pathname === "/settings";
  const [logo, setLogo] = useState(
    () => readCachedBrandingLogo() || BRANDING_PLACEHOLDER_LOGO,
  );
  const [isLogoLoading, setIsLogoLoading] = useState(true);
  const { dispatch, state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [organization, setOrganization] = useState(null); // Use `null` instead of empty string
  const [isOrgLoaded, setIsOrgLoaded] = useState(false); // Loading state
  const [fleetTerms, setFleetTerms] = useState(DEFAULT_FLEET_TERMINOLOGY);
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true); // Mark organization as loaded
  }, [location]);

  useEffect(() => {
    if (!organization) {
      setFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
      return;
    }
    let cancelled = false;
    FleetManagementServices.getFleetScheduleSettings({ business: organization })
      .then((res) => {
        if (!cancelled) setFleetTerms(normalizeFleetTerminology(res?.data));
      })
      .catch(() => {
        if (!cancelled) setFleetTerms(DEFAULT_FLEET_TERMINOLOGY);
      });
    return () => {
      cancelled = true;
    };
  }, [organization]);

  useEffect(() => {
    const onFleetTermsChanged = (e) => {
      const bid = e?.detail?.businessId;
      if (!bid || !organization || bid !== String(organization)) return;
      FleetManagementServices.getFleetScheduleSettings({
        business: organization,
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
  }, [organization]);

  // Monitor route changes and clear business selection when leaving settings
  useEffect(() => {
    const settingsRoutes = [
      "/Settings",
      "/settings",
      "/reminders",
      "/cheque-reminders",
      "/accounts/e-invoice-settings",
      "/accounts/service-monster",
      "/accounts/zoho-books",
      "/accounts/whatsapp-integration",
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
  }, [history, location]);
  useEffect(() => {
    const fetchConfiguration = async () => {
      setIsLogoLoading(true);
      try {
        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${state?.adminInfo?.token}`,
        };
        // Keep global configuration as fallback for logo.
        const response = await axios.get(`${Base_URL}/configuration`, {
          headers,
        });
        const configuration = response.data[0];

        // Prefer tenant-aware branding logo.
        try {
          const nextLogo = await fetchBrandingLogo({ headers });
          setLogo(nextLogo || BRANDING_PLACEHOLDER_LOGO);
          writeCachedBrandingLogo(nextLogo);
        } catch (_) {
          const cached = readCachedBrandingLogo();
          setLogo(cached || BRANDING_PLACEHOLDER_LOGO);
        }
      } catch (error) {
        console.error("Failed to fetch configuration:", error);
        // Keep default logo on error
      } finally {
        setIsLogoLoading(false);
      }
    };

    fetchConfiguration();
  }, [state?.adminInfo?.token]);

  const { enabled: eInvoiceModuleEnabled } =
    useBusinessEInvoiceEnabled(organization);

  const roleModules = adminInfo?.role?.modules;

  const canAccessPath = (path) => {
    if (!path) return false;
    if (adminInfo?.role?.isSuperAdmin) return true;
    return hasPathPermission(roleModules, path, PERMISSION_ACTION.VIEW);
  };

  const sections = useMemo(
    () => [
      // Accounts first; Integrations grouped separately (matches main settings grid)
      {
        title: "Accounts",
        icon: <img src={icon2} alt="Sales Icon" className="w-11 h-11" />,
        bgClass: "bg-blue-100",
        items: [
          ...(eInvoiceModuleEnabled
            ? [
                {
                  name: "E-Invoice Settings",
                  href: `/accounts/e-invoice-settings?selectedOrg=${organization}`,
                },
              ]
            : []),
          {
            name: "Payment Reminders",
            href: `/reminders?selectedOrg=${organization}`,
          },
          {
            name: "Cheque Reminders",
            href: `/cheque-reminders?selectedOrg=${organization}`,
          },
          {
            name: "Taxes",
            href: `/taxes?selectedOrg=${organization}`,
          },
          {
            name: "Vendor Invoice Approval",
            href: `/vendor-invoice-approval?selectedOrg=${organization}`,
          },
          {
            name: "Credit Notes Approval",
            href: `/credit-notes-approval?selectedOrg=${organization}`,
          },
          {
            name: "Special Transfers Types",
            href: `/special-transfers-types?selectedOrg=${organization}`,
          },
          {
            name: "Payment Methods",
            href: `/PaymentMethods?selectedOrg=${organization}`,
          },
          {
            name: "Transaction Types",
            href: `/TransactionTypes?selectedOrg=${organization}`,
          },
          {
            name: "Advance Types",
            href: `/AdvanceTypes?selectedOrg=${organization}`,
          },
          {
            name: "Sales Channels",
            href: `/Channels?selectedOrg=${organization}`,
          },
          // { name: "Misc. Data Types", href: `/Accounts_Misc_Data_Types?selectedOrg=${organization}` },
        ],
      },
      {
        title: "Integrations",
        titleKey: "Integrations",
        icon: <Plug className="w-6 h-6 text-gray-600" />,
        bgClass: "bg-indigo-100",
        items: [
          {
            name: "Service Monster Config",
            nameKey: "serviceMonsterConfig",
            href: `/accounts/service-monster?selectedOrg=${organization}`,
          },
          {
            name: "Zoho Books",
            nameKey: "zohoBooks",
            href: `/accounts/zoho-books?selectedOrg=${organization}`,
          },
          {
            name: "WhatsApp Integration",
            nameKey: "whatsappIntegration",
            href: `/accounts/whatsapp-integration?selectedOrg=${organization}`,
          },
          {
            name: "Cliniko",
            nameKey: "cliniko",
            href: `/settings/integrations/cliniko?selectedOrg=${organization}`,
          },
        ],
      },
      {
        title: "Operations",
        icon: <FiClipboard className="w-5 h-5 text-violet-600" />,
        bgClass: "bg-violet-100",
        items: [
          {
            name: "Application Documents",
            nameKey: "applicationDocuments",
            href: `/settings/application-documents?selectedOrg=${organization}`,
          },
          {
            name: "Application Fields",
            nameKey: "applicationFields",
            href: `/settings/application-fields?selectedOrg=${organization}`,
          },
          {
            name: "Dynamic Forms",
            nameKey: "dynamicForms",
            href: `/settings/dynamic-forms?selectedOrg=${organization}`,
          },
          {
            name: "Class / Category",
            nameKey: "classCategories",
            href: `/settings/class-categories?selectedOrg=${organization}`,
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
            href: `/Documents_Misc_Data_Types?selectedOrg=${organization}`,
          },
          {
            name: "Document Types",
            nameKey: "documentTypes",
            href: `/document-types?selectedOrg=${organization}`,
          },
        ],
      },
      {
        title: "Finance",
        icon: <img src={icon3} alt="Sales Icon" className="w-11 h-11" />,
        bgClass: "bg-gray-200",
        items: [
          // {
          //   name: "Misc. Data Types",
          //   href: `/Finance_Misc_Data_Types?selectedOrg=${organization}`,
          // },
          {
            name: "Currency",
            nameKey: "currency",
            href: `/Currency?selectedOrg=${organization}`,
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
            href: `/Departments_Positions?selectedOrg=${organization}`,
          },
          {
            name: "Foreign Worker Management",
            nameKey: "foreignWorkerManagement",
            href: `/Foreign_Worker_Management?selectedOrg=${organization}`,
          },
          {
            name: "Leaves",
            nameKey: "leaves",
            href: `/Leaves?selectedOrg=${organization}`,
          },
          {
            name: "Claims",
            nameKey: "claims",
            href: `/claims?selectedOrg=${organization}`,
          },
          {
            name: "Branches & Locations",
            nameKey: "branchesLocations",
            href: `/Branch_Locations?selectedOrg=${organization}`,
          },
          {
            name: "Shifts",
            nameKey: "shifts",
            href: `/Shifts?selectedOrg=${organization}`,
          },
          {
            name: "Public Holidays",
            nameKey: "publicHolidays",
            href: `/PublicHolidays?selectedOrg=${organization}`,
          },
          {
            name: "WFH Allowance",
            nameKey: "wfhAllowance",
            href: `/WFHSettings?selectedOrg=${organization}`,
          },
          // { name: "WFH Groups ", href: `/WFHGroups?selectedOrg=${organization}` },
        ],
      },
      {
        title: "Payroll",
        icon: <DollarSign className="w-6 h-6 text-gray-600" />,
        bgClass: "bg-emerald-100",
        items: [
          {
            name: "Pay Elements",
            nameKey: "payElements",
            href: `/payroll-pay-elements?selectedOrg=${organization}`,
          },
          {
            name: "Settings",
            nameKey: "settings",
            href: `/payroll-company-settings?selectedOrg=${organization}`,
          },
          {
            name: "Statutory Config",
            nameKey: "statutoryConfig",
            href: `/payroll-statutory-settings?selectedOrg=${organization}`,
          },
          {
            name: "Pay Groups",
            nameKey: "payGroups",
            href: `/payroll-pay-groups?selectedOrg=${organization}`,
          },
        ],
      },
      // Items section hidden — Misc. Data Types / Tax Classes not in use
      // {
      //   title: "Items",
      //   icon: <img src={icon2} alt="Sales Icon" className="w-11 h-11" />,
      //   bgClass: "bg-gray-200",
      //   items: [
      //     {
      //       name: "Misc. Data Types",
      //       href: `/Item_Misc_Data_Types?selectedOrg=${organization}`,
      //     },
      //     {
      //       name: "Tax Classes",
      //       href: `/tax-classes?selectedOrg=${organization}`,
      //     },
      //   ],
      // },
      // Miscellaneous section hidden — not in use
      // {
      //   title: "Miscellaneous",
      //   icon: (
      //     <img src={icon6} alt="Miscellaneous Icon" className="w-11 h-11" />
      //   ),
      //   bgClass: "bg-gray-200",
      //   items: [
      //     {
      //       name: "Misc. Data Types",
      //       href: `/Miscellanious_Misc_Data_Types?selectedOrg=${organization}`,
      //     },
      //   ],
      // },
      {
        title: "Notification",
        icon: <FiBell className="w-5 h-5 text-amber-600" />,
        bgClass: "bg-amber-100",
        items: [
          // {
          //   name: "Email Templates",
          //   href: `/EmailTemplatesUI?selectedOrg=${organization}`,
          // },
          {
            name: "Notification Events",
            href: `/notification-events?selectedOrg=${organization}`,
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
            href: `/pos/settings?selectedOrg=${organization}`,
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
            href: `/fleet-job-scheduling-settings?selectedOrg=${organization}&fleetTab=vehicle-types`,
          },
          {
            name: fleetTerms.vehicleLabelPlural,
            href: `/fleet-job-scheduling-settings?selectedOrg=${organization}&fleetTab=vehicles`,
          },
          {
            name: "Dispatch schedule",
            href: `/fleet-job-scheduling-settings?selectedOrg=${organization}&fleetTab=schedule`,
          },
          {
            name: "Custom names",
            href: `/fleet-job-scheduling-settings?selectedOrg=${organization}&fleetTab=terminology`,
          },
        ],
      },
      // Operations section hidden — Misc. Data Types not in use
      // {
      //   title: "Operations",
      //   icon: <img src={icon1} alt="Sales Icon" className="w-11 h-11" />,
      //   bgClass: "bg-gray-200",
      //   items: [
      //     {
      //       name: "Misc. Data Types",
      //       href: `/Operations_Misc_Data_Types?selectedOrg=${organization}`,
      //     },
      //   ],
      // },
      {
        title: "Purchase",
        icon: <img src={icon6} alt="Sales Icon" className="w-11 h-11" />,
        bgClass: "bg-gray-200",
        items: [
          {
            name: "Misc. Data Types",
            href: `/Purchase_Misc_Data_Types?selectedOrg=${organization}`,
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
            href: `/settings/module-labels?selectedOrg=${organization}`,
          },
          {
            name: "Misc. Data Types",
            href: `/Sales_Misc_Data_Types?selectedOrg=${organization}`,
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
            href: `/document_templates?selectedOrg=${organization}`,
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
            href: `/account-types?selectedOrg=${organization}`,
          },
          {
            name: "Bank Account Types",
            href: `/bank-account-types?selectedOrg=${organization}`,
          },
          {
            name: "Bank Account Mapping",
            href: `/bank-account-mapping?selectedOrg=${organization}`,
          },
        ],
      },
    ],
    [
      organization,
      fleetTerms,
      eInvoiceModuleEnabled,
      adminInfo?.role?.isSuperAdmin,
      roleModules,
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

  const isItemActive = (href = "") => {
    const itemPath = href.split("?")[0];
    return itemPath === location.pathname;
  };

  return (
    <>
      {/* Overlay for mobile — OUTSIDE the sidebar so it doesn't block nav clicks */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 transform border-r border-slate-200/80 bg-[#F7F8FA] shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="border-b border-slate-200/80 bg-white px-6 py-5">
            <a className="block" href="/home">
              <img
                src={isLogoLoading ? logo : logo || BRANDING_PLACEHOLDER_LOGO}
                alt="Sidebar Logo"
                width="180"
                style={{ borderRadius: "10px" }}
                height="72"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = BRANDING_PLACEHOLDER_LOGO;
                }}
              />
            </a>
          </div>

          {!isSettingsHome && (
            <div className="border-b border-slate-200/80 px-4 py-4">
              <button
                onClick={() => {
                  const selectedOrg =
                    organization ||
                    sessionStorage.getItem("settingsSelectedOrg") ||
                    "";
                  history.push(
                    selectedOrg
                      ? `/Settings?selectedOrg=${selectedOrg}`
                      : "/Settings",
                  );
                }}
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900"
              >
                <ArrowLeft className="mr-3 h-4 w-4" />
                {ts(
                  "integrations.backToAllSettings",
                  "Back to all Settings",
                )}
              </button>
            </div>
          )}

          <nav className="flex-1 space-y-5 px-4 py-5">
            {visibleSections.map((section) => (
              <div
                key={section.title}
                className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${section.bgClass || "bg-gray-200"}`}
                  >
                    {section.icon}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {ts(`sectionTitles.${section.title}`, section.title)}
                  </span>
                </div>

                <div className="space-y-1 p-2">
                  {section.items.map((item, index) => {
                    const active = isItemActive(item.href || "");
                    return (
                      <a
                        key={index}
                        href={item.href}
                        className={`block rounded-xl px-3 py-2.5 text-sm transition ${
                          active
                            ? "bg-slate-900 font-medium text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {item.nameKey
                          ? ts(`items.${item.nameKey}`, item.name)
                          : item.name}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
