import { getModuleRouteAliases } from "@/utils/moduleLabels";
import { buildMyHrRoutePermissionFallbacks } from "@/utils/myHrRoutePermissions";

/**
 * When no role module path matches the URL (exact or prefix), map the route to
 * module/submodule names as stored in role.modules (from Modules admin).
 * First matching rule wins; within a rule, the first candidate that yields any
 * permission string is used; if none, the first candidate’s effective list is used.
 *
 * Adjust names here if your database uses different module labels.
 */

export const ROUTE_PERMISSION_FALLBACKS = [
  // Inventory — warehouses / locations / stock levels / adjustments / pick / expiry
  {
    test: (p) => /^\/inventory-reports/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Inventory Reports" },
      { moduleName: "Inventory", subModuleName: "Inventory Valuation" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/inventory-valuation/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Inventory Valuation" },
      { moduleName: "Inventory", subModuleName: "Inventory Reports" },
      { moduleName: "Inventory", subModuleName: "Pick Lists" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/pick-lists/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Pick Lists" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/expiry-alerts/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Expiry Alerts" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/reordering-rules/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Reordering Rules" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "Purchase Planning" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/stock-traceability/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Stock Traceability" },
      { moduleName: "Inventory", subModuleName: "Traceability" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/internal-transfers/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Internal Transfers" },
      { moduleName: "Inventory", subModuleName: "Transfers" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/goods-receipts/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Goods Receipts" },
      { moduleName: "Inventory", subModuleName: "Goods Receipt Notes" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
      { moduleName: "Purchase", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/inventory-adjustments/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Inventory Adjustments" },
      { moduleName: "Inventory", subModuleName: "Adjustments" },
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/stock-levels/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Stock Levels" },
      { moduleName: "Inventory", subModuleName: "Stock" },
      { moduleName: "Inventory", subModuleName: "Warehouses" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/locations/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Locations" },
      { moduleName: "Inventory", subModuleName: "Warehouses" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/warehouses/i.test(p),
    candidates: [
      { moduleName: "Inventory", subModuleName: "Warehouses" },
      { moduleName: "Inventory", subModuleName: "Warehouse" },
      { moduleName: "Inventory", subModuleName: "" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  // Items — categories / tax / stock (more specific routes first)
  {
    test: (p) => /^\/(categories|Add New Category|edit-category)/i.test(p),
    candidates: [
      { moduleName: "Items", subModuleName: "Category" },
      { moduleName: "Items", subModuleName: "Categories" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(tax-classes|Add New Tax Class|edit-tax-class)/i.test(p),
    candidates: [
      { moduleName: "Items", subModuleName: "Tax Classes" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(stock-groups|new-stock-group|edit-stock-group|Stock Groups|New Stock Group|Edit Stock Group)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Items", subModuleName: "Stock" },
      { moduleName: "Items", subModuleName: "Stock Groups" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/products$/i.test(p),
    candidates: [
      { moduleName: "Items", subModuleName: "Products" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(items|Add New Item|edit-item)/i.test(p),
    candidates: [
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(recipes|Add New Recipe|edit-recipe)/i.test(p),
    candidates: [
      { moduleName: "Items", subModuleName: "Recipes" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/purchase-planning/i.test(p),
    candidates: [
      { moduleName: "Items", subModuleName: "Purchase Planning" },
      { moduleName: "Items", subModuleName: "Items" },
      { moduleName: "Items", subModuleName: "" },
    ],
  },
  // Sales + sub-routes
  {
    test: (p) =>
      /^\/(sales|add-sales-contract|update-sales-contract|view-sales-contract|over-view-sales|create-performa-invoice|prepare-sale|PrepareSaleContract)/i.test(
        p,
      ) || /^\/(upload-signed-document)/i.test(p),
    candidates: [
      { moduleName: "Sales", subModuleName: "Sales Contracts" },
      { moduleName: "Sales", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(customer-invoices|e-invoices|create-customer-invoice|view-customer-invoice\/|update-customer-invoice\/|recurring-Invoice|create-recurring-invoice|view-recurring-invoice\/|update-recurring-invoice\/)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Sales", subModuleName: "Customer Invoices" },
      { moduleName: "Sales", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/customer-payments/i.test(p),
    candidates: [
      { moduleName: "Sales", subModuleName: "Customer Payments" },
      { moduleName: "Sales", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/customer-statement(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Sales", subModuleName: "Customer Statement" },
      { moduleName: "Sales", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/vendor-statement(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Purchase", subModuleName: "Vendor Statement" },
      { moduleName: "Purchase", subModuleName: "Vendor Payments" },
      { moduleName: "Purchase", subModuleName: "" },
      { moduleName: "Purchases", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/vendor-payments(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Purchase", subModuleName: "Vendor Payments" },
      { moduleName: "Purchase", subModuleName: "Vendor Statement" },
      { moduleName: "Purchase", subModuleName: "" },
      { moduleName: "Purchases", subModuleName: "" },
    ],
  },
  {
    test: (p) => {
      const path = String(p || "").toLowerCase();
      const saleOrderAliases = [
        ...getModuleRouteAliases("saleOrder", "list"),
        ...getModuleRouteAliases("saleOrder", "create"),
        ...getModuleRouteAliases("saleOrder", "view"),
        ...getModuleRouteAliases("saleOrder", "edit"),
      ]
        .filter(Boolean)
        .map((routePath) =>
          String(routePath)
            .replace(/:id\b/g, "")
            .toLowerCase()
        );
      return (
        /^\/(create-sale-order|sales-orders|sale-order)/i.test(path) ||
        saleOrderAliases.some((alias) => path.startsWith(alias))
      );
    },
    candidates: [
      { moduleName: "Sales", subModuleName: "Sales Orders" },
      { moduleName: "Sales", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(customers|New Customer|Edit Customer|viewCustomerDetails)/i.test(p),
    candidates: [
      { moduleName: "Sales", subModuleName: "Customers" },
      { moduleName: "Sales", subModuleName: "" },
      { moduleName: "Customers", subModuleName: "Customers" },
      { moduleName: "Customers", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(projects|auditors)/i.test(p),
    candidates: [
      { moduleName: "Projects", subModuleName: "Projects" },
      { moduleName: "Projects", subModuleName: "" },
      { moduleName: "Auditors", subModuleName: "Auditors" },
      { moduleName: "Auditors", subModuleName: "" },
      { moduleName: "Sales", subModuleName: "Auditors" },
      { moduleName: "Sales", subModuleName: "" },
      { moduleName: "Operations", subModuleName: "Projects" },
      { moduleName: "Operations", subModuleName: "" },
      { moduleName: "Applications", subModuleName: "Auditors" },
      { moduleName: "Applications", subModuleName: "" },
    ],
  },
  {
    /* Do not fall back to Operations/Sales parent Update: that made Auditor
       (Projects only) see Approve/Return on Applications while the API
       correctly denied Update on /applications. */
    test: (p) => /^\/(applications|my-applications)/i.test(p),
    candidates: [
      { moduleName: "Operations", subModuleName: "Applications" },
      { moduleName: "Applications", subModuleName: "Applications" },
      { moduleName: "Sales", subModuleName: "Applications" },
      { moduleName: "Applications", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/enquir(y|ies)/i.test(p),
    candidates: [
      { moduleName: "Sales", subModuleName: "Enquiry" },
      { moduleName: "Sales", subModuleName: "Enquiries" },
      { moduleName: "Operations", subModuleName: "Enquiries" },
      { moduleName: "Operations", subModuleName: "Enquiry" },
    ],
  },
  // Purchase (contracts + legacy list + flows)
  {
    test: (p) =>
      /^\/(purchase_contracts|view-purchase-contract|add-purchase-contract|update-purchase-contract|purchase-contract-statement|over-view-purchase|add-two-level-purchase-contract)/i.test(
        p,
      ) || /^\/(PreparePurchaseContract|prepare-purchase-contract)/i.test(p),
    candidates: [
      { moduleName: "Purchase Contracts", subModuleName: "Purchase Contracts" },
      { moduleName: "Purchase Contracts", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(purchases|New Contract|Edit Contract|Contract Details|Create Shipment|Shipment Details|Bill Of Landing)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Purchases", subModuleName: "Purchases" },
      { moduleName: "Purchases", subModuleName: "" },
      { moduleName: "Purchase Contracts", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(purchase-orders|purchase-order)/i.test(p),
    candidates: [
      { moduleName: "Purchase", subModuleName: "Purchase Order" },
      { moduleName: "Purchase", subModuleName: "Purchase Orders" },
      { moduleName: "Purchases", subModuleName: "" },
      { moduleName: "Purchase Contracts", subModuleName: "" },
    ],
  },
  // Vendor invoices — create/view/update use paths that do not prefix /vendor-invoices
  {
    test: (p) =>
      /^\/(create-vendor-invoice|view-vendor-invoice|update-vendor-invoice|edit-vendor-invoice)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Purchase", subModuleName: "Vendor Invoices" },
      { moduleName: "Purchases", subModuleName: "Vendor Invoices" },
      { moduleName: "Purchase", subModuleName: "" },
      { moduleName: "Purchases", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(Vendors|New Vendor|Edit Vendor)/i.test(p),
    candidates: [
      { moduleName: "Purchase", subModuleName: "Vendors" },
      { moduleName: "Purchases", subModuleName: "" },
    ],
  },
  // Treasury & Finance (banking + chart accounts)
  {
    // Banking Accounts (Treasury & Finance)
    // - List: /bank-management
    // - Add/Edit: /add-account, /edit-account/:id
    test: (p) => /^\/(bank-management|add-account|edit-account\/)/i.test(p),
    candidates: [
      {
        moduleName: "Treasury & Finance",
        subModuleName: "Banking Accounts",
      },
      { moduleName: "Treasury & Finance", subModuleName: "" },
    ],
  },
  {
    // Chart of Accounts (Treasury & Finance)
    // - List: /chart-of-accounts
    // - Add/Edit: /add-new-account, /chart-of-account/:id
    test: (p) =>
      /^\/(chart-of-accounts|add-new-account|chart-of-account\/)/i.test(p),
    candidates: [
      {
        moduleName: "Treasury & Finance",
        subModuleName: "Chart of Accounts",
      },
      { moduleName: "Treasury & Finance", subModuleName: "" },
    ],
  },
  // Business Group
  {
    test: (p) =>
      /^\/(business-group|Add New Business Group|Edit Business Group|View Business Group)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Business Group", subModuleName: "Business Group" },
      { moduleName: "Business Group", subModuleName: "" },
    ],
  },
  // Announcements (list + create/edit/view routes use different URL bases)
  {
    test: (p) =>
      /^\/(announcements|New Announcement|Edit Announcement|View Announcement)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Announcements", subModuleName: "Announcements" },
      { moduleName: "Announcements", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/broadcasts(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Marketing Announcements", subModuleName: "Marketing Announcements" },
      { moduleName: "Marketing Announcements", subModuleName: "" },
      { moduleName: "Broadcasts", subModuleName: "Broadcasts" },
      { moduleName: "Broadcasts", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/cheque_dashboard(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Cheque Dashboard", subModuleName: "" },
      { moduleName: "Accounts", subModuleName: "Cheque Dashboard" },
      { moduleName: "Accounts", subModuleName: "Cheque Management" },
      { moduleName: "Finance", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/cheque_reporting(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Cheque Reporting", subModuleName: "" },
      { moduleName: "Cheque Reports", subModuleName: "" },
      { moduleName: "Accounts", subModuleName: "Cheque Reporting" },
      { moduleName: "Accounts", subModuleName: "Cheque Reports" },
    ],
  },
  {
    test: (p) => /^\/Cheques(\/|$)/i.test(p) && !/^\/Cheques\/dashboard/i.test(p),
    candidates: [
      { moduleName: "Accounts", subModuleName: "Cheque Management" },
      { moduleName: "Accounts", subModuleName: "" },
      { moduleName: "Finance", subModuleName: "" },
      { moduleName: "Treasury & Finance", subModuleName: "" },
    ],
  },
  // Business (per-business screens)
  {
    test: (p) =>
      /^\/(business|Add New Business|Edit Business|View Business|viewBusinessDetails)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Business", subModuleName: "Business" },
      { moduleName: "Business", subModuleName: "" },
      { moduleName: "Business Group", subModuleName: "Business" },
    ],
  },
  // My HR staff portal (full list: myHrRoutePermissions.js → MY_HR_ROUTE_TABLE)
  ...buildMyHrRoutePermissionFallbacks(),
  // HR admin calendar (company-wide) — not My HR staff portal
  {
    test: (p) => /^\/hr-calendar(\/|$)/i.test(p),
    candidates: [
      { moduleName: "HR Calendar", subModuleName: "HR Calendar" },
      { moduleName: "HR Calendar", subModuleName: "" },
      { moduleName: "Calendar", subModuleName: "" },
    ],
  },
  // HR Management + requests (admin)
  {
    test: (p) => /^\/(attendance|attendance-details)/i.test(p),
    candidates: [
      { moduleName: "Attendance", subModuleName: "Attendance" },
      { moduleName: "Attendance", subModuleName: "" },
      { moduleName: "Mark Attendance", subModuleName: "" },
      { moduleName: "Attendance Management", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/leave-management/i.test(p),
    candidates: [
      { moduleName: "Leave Management", subModuleName: "Leave Management" },
      { moduleName: "Leaves", subModuleName: "" },
      { moduleName: "Leave Management", subModuleName: "" },
      { moduleName: "Leave", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/apply-leave-on-behalf/i.test(p),
    candidates: [
      { moduleName: "Leave Management", subModuleName: "Leave Management" },
      { moduleName: "Leaves", subModuleName: "" },
      { moduleName: "Leave Management", subModuleName: "" },
      { moduleName: "Leave", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(WFH-management|apply-WFH|WFH-notifications-settings)/i.test(p),
    candidates: [
      { moduleName: "WFH Requests", subModuleName: "WFH Requests" },
      { moduleName: "WFH", subModuleName: "" },
      { moduleName: "WFH Requests", subModuleName: "" },
      { moduleName: "Work From Home", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(claim-management|new-claim|claim-details\/)/i.test(p),
    candidates: [
      { moduleName: "Claims", subModuleName: "Claims" },
      { moduleName: "Claims", subModuleName: "" },
      { moduleName: "Claim Management", subModuleName: "" },
      { moduleName: "Claims Management", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(staff-management|staff\/|StaffListScreen|AddStaffPage|StaffProfilePage)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Staff Management", subModuleName: "Staff Management" },
      { moduleName: "Staff Management", subModuleName: "" },
      { moduleName: "Staff", subModuleName: "" },
    ],
  },
  {
    test: (p) =>
      /^\/(event-management|add-event|task-management|add-task|view-attendees|add-attendee-points|view-points\/)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Event Management", subModuleName: "Event Management" },
      { moduleName: "Event Management", subModuleName: "" },
      { moduleName: "Task Management", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/HR-Analytics/i.test(p),
    candidates: [
      { moduleName: "Analytics", subModuleName: "Analytics" },
      { moduleName: "Analytics", subModuleName: "" },
      { moduleName: "HR Analytics", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/(reports|attendance-report|attendance-percentage-report|lateness-summary-report|working-hours-report|overtime-report|leave-taken-report|leave-utilization-report|event-performance-report|work-pass-expiry-report)/i.test(p),

    candidates: [
      { moduleName: "HR Reports", subModuleName: "HR Reports" },
      { moduleName: "HR Reports", subModuleName: "" },
      { moduleName: "Reports", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/daily-reports-collection(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Reports", subModuleName: "Daily Reports Collection" },
      { moduleName: "Reports", subModuleName: "Daily Report Collection" },
      { moduleName: "Reports", subModuleName: "Daily Reports" },
    ],
  },
  {
    test: (p) =>
      /^\/(all-reports|P_L_Reports|sales-reports|sales-without-purchase-reports|purchase-without-sales-reports|supplier-reports|customer-reports|tax-reports|daily-reports)/i.test(
        p,
      ),
    candidates: [
      { moduleName: "Reports", subModuleName: "Reports" },
      { moduleName: "Reports", subModuleName: "Supplier Reports" },
      { moduleName: "Reports", subModuleName: "Customer Reports" },
      { moduleName: "Reports", subModuleName: "Daily Collection Report" },
      { moduleName: "Reports", subModuleName: "Daily Reports" },
      { moduleName: "Reports", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/payroll(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Payroll", subModuleName: "Payroll" },
      { moduleName: "Payroll", subModuleName: "" },
    ],
  },
  {
    test: (p) => /^\/referral-program/i.test(p),
    candidates: [
      { moduleName: "Referral Program", subModuleName: "" },
      { moduleName: "Operations", subModuleName: "" },
    ],
  },
  {
    // Calendar Events screen
    test: (p) => /^\/calendar-events\/?$/i.test(p),
    candidates: [{ moduleName: "Calendar", subModuleName: "" }],
  },
  {
    test: (p) => /^\/campaigns(\/|$)/i.test(p),
    candidates: [
      { moduleName: "Campaigns", subModuleName: "Campaigns" },
      { moduleName: "Campaigns", subModuleName: "" },
      { moduleName: "Operations", subModuleName: "Campaigns" },
      { moduleName: "Operations", subModuleName: "" },
    ],
  },
  // System Users add/edit routes (drawer)
  {
    test: (p) => /^\/system-users(\/(new|edit\/.*))?/i.test(p),
    candidates: [{ moduleName: "System Users", subModuleName: "" }],
  },
  // Global Settings + configuration
  {
    test: (p) =>
      /^\/(settings|document-numbering|Configuration|ConfigTab|document-sequencing)/i.test(
        p,
      ) ||
      /^\/settings\/(application-documents|application-fields|dynamic-forms|class-categories)/i.test(
        p,
      ) ||
      /^\/(EmailLog|Modules|UserRoles|SystemUsers|ActivityLogs|EmailLogs|viewActivityLogsDetails|viewEmailLogsDetails)/i.test(
        p,
      ) ||
      /^\/store\//i.test(p),
    candidates: [
      { moduleName: "Global Settings", subModuleName: "Global Settings" },
      { moduleName: "Global Settings", subModuleName: "" },
      { moduleName: "Settings", subModuleName: "" },
      // Common admin/global submodule labels
      { moduleName: "System Users", subModuleName: "" },
      { moduleName: "User Roles", subModuleName: "" },
      { moduleName: "Modules", subModuleName: "" },
      { moduleName: "Configuration", subModuleName: "" },
      { moduleName: "Configurations", subModuleName: "" },
      { moduleName: "Document Numbering", subModuleName: "" },
    ],
  },
];
