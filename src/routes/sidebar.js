import {
  FiGrid,
  FiUsers,
  FiUser,
  FiCompass,
  FiSettings,
  FiSlack,
  FiGlobe,
  FiReport,
  FiTarget,
} from "react-icons/fi";

/**
 * ⚠ These are used just to render the Sidebar!
 * You can include any link here, local or external.
 *
 * If you're looking to actual Router routes, go to
 * `routes/index.js`
 */
const sidebar = [
  {
    path: "/dashboard", // the url
    icon: FiGrid, // icon
    name: "Dashboard", // name that appear in Sidebar
  },
  {
    icon: FiTarget,
    name: "POS",
    routes: [
      {
        path: "/pos",
        name: "POS Terminal",
      },
      {
        path: "/pos/tables-summary",
        name: "Tables Summary",
      },
      {
        path: "/kitchen",
        name: "Kitchen Board",
      },
      {
        path: "/pos/reports",
        name: "POS Reports",
      },
      {
        path: "/pos/settings",
        name: "POS Settings",
      },
    ],
  },

  {
    icon: FiSlack,
    name: "Catalog",
    routes: [
      {
        path: "/products",
        name: "Products",
      },
      {
        path: "/categories",
        name: "Categories",
      },
      {
        path: "/attributes",
        name: "Attributes",
      },
      {
        path: "/coupons",
        name: "Coupons",
      },
    ],
  },

  {
    path: "/customers",
    icon: FiUsers,
    name: "Customers",
  },
  {
    path: "/orders",
    icon: FiCompass,
    name: "Orders",
  },

  {
    path: "/our-staff",
    icon: FiUser,
    name: "OurStaff",
  },

  {
    icon: FiGlobe,
    name: "International",
    routes: [
      {
        path: "/languages",
        name: "Languages",
      },
      {
        path: "/currencies",
        name: "Currencies",
      },
    ],
  },
  {
    icon: FiSlack,
    name: "Pages",
    routes: [
      // submenu

      {
        path: "/404",
        name: "404",
      },
      {
        path: "/coming-soon",
        name: "Coming Soon",
      },
    ],
  },
  {
    icon: FiReport,
    name: "Reports",
    routes: [
      {
        path: "/all-reports",
        name: "Sales & Purchase Reports",
      },
      {
        path: "/P_L_Reports",
        name: "P&L Reports",
      },
      {
        path: "/supplier-reports",
        name: "Supplier Reports",
      },
      {
        path: "/sales-reports",
        name: "Sales Analytics",
      },
      {
        path: "/sales-without-purchase-reports",
        name: "Sales Without Purchase",
      },
      {
        path: "/purchase-without-sales-reports",
        name: "Purchase Without Sales",
      },
      {
        path: "/daily-reports",
        name: "Daily Reports",
      },
      {
        path: "/tax-reports",
        name: "Tax Reports",
      },
    ],
  },
  {
    icon: FiSettings,
    name: "Settings",
    routes: [
      {
        path: "/SystemUsers",
        name: "System Users",
      },
      {
        path: "/ConfigTab",
        name: "Configurations",
      },
      {
        path: "/document-sequencing",
        name: "Document Numbering",
      },
      {
        path: "/UserRoles",
        name: "User Roles",
      },
      {
        path: "/business",
        icon: FiUser,
        name: "Business",
      },
      {
        path: "/ActivityLogs",
        name: "Activity Logs",
      },
      // {
      //   path: "/EmailsLogs",
      //   name: "Emails Logs",
      // },
      {
        path: "/EmailLog",
        name: "Emails Logs",
      },

      {
        path: "/Business",
        name: "Business",
      },
      {
        path: "/settings?settingTab=common-settings",
        name: "Dastar Configuration",
      },
      {
        path: "/subscription-catalog",
        name: "Subscription Catalog",
      },
    ],
  },
];

export default sidebar;
