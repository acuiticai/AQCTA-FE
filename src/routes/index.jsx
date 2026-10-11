import MyHr from "@/pages/HrManagement/MyHR/MyHR";
import StaffApplyWFHPage from "@/pages/HrManagement/WFHRequests/StaffApplyWFHPage";
import Unauthorized from "@/pages/Unauthorized";
import TestPermissions from "@/pages/TestPermissions";
import RouteActionGate from "@/components/RouteActionGate";
import SettingsChildGuard from "@/components/SettingsChildGuard";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";
import {
  getModuleLabel,
  getModuleRouteAliases,
  getModuleRoutePath,
  getSaleOrderCanonicalRedirectSpecs,
} from "@/utils/moduleLabels";
import React, { lazy } from "react";
import { Redirect } from "react-router-dom";
import AnalyticsPage from "@/pages/HrManagement/Analytics/AnalyticsPage";
import Reports from "@/pages/HrManagement/Reports/Reports";
import AllReports from "@/pages/AllReports/AllReports";
import P_L_Reports from "@/pages/AllReports/P_L_Reports";
import SalesWithoutPurchaseReports from "@/pages/AllReports/SalesWithoutPurchaseReports";
import PurchaseWithoutSalesReports from "@/pages/AllReports/PurchaseWithoutSalesReports";
import SupplierReports from "@/pages/AllReports/SupplierReports";
import CustomerReports from "@/pages/AllReports/CustomerReports";
import TaxReportPage from "@/pages/TaxReportPage";
import DailyReports from "@/pages/DailyReports/DailyReports";
import {
  DailyReportsDashboard,
  ShiftReportsList,
  CreateShiftReport,
  ViewShiftReport,
  DailyReportsAnalytics,
} from "@/pages/DailyReports";
import DailyReportsGuard from "@/components/DailyReportsGuard";
import AttendanceReport from "@/pages/HrManagement/Reports/AttendanceReport";
import AttendancePercentageReport from "@/pages/HrManagement/Reports/AttendancePercentageReport";
import OvertimeReport from "@/pages/HrManagement/Reports/OvertimeReport";
import LatenessSummaryReport from "@/pages/HrManagement/Reports/LatenessSummaryReport";
import WorkingHoursReport from "@/pages/HrManagement/Reports/WorkingHoursReport";
import LeaveTakenReport from "@/pages/HrManagement/Reports/LeaveTakenReport";
import LeaveUtilizationReport from "@/pages/HrManagement/Reports/LeaveUtilizationReport";
import EventPerformanceReport from "@/pages/HrManagement/Reports/EventPerformanceReport";
import WorkPassExpiryReport from "@/pages/HrManagement/Reports/WorkPassExpiryReport";
import StaffClaimDetails from "@/pages/HrManagement/ClaimManagement/StaffClaimDetails";

// POS module
const PosPage = lazy(() => import("@/pages/POS/PosPage"));
const PosTablesSummary = lazy(() => import("@/pages/POS/PosTablesSummary"));
const PosReports = lazy(() => import("@/pages/POS/PosReports"));

// Kitchen module (separate from POS so it can evolve independently)
const KitchenBoard = lazy(() => import("@/pages/Kitchen/KitchenBoard"));

// Payroll module
const PayrollDashboard = lazy(() => import("@/pages/Payroll/PayrollDashboard"));
const PayrollAnalytics = lazy(() => import("@/pages/Payroll/PayrollAnalytics"));
const PayrollReports = lazy(() => import("@/pages/Payroll/PayrollReports"));
const PayrollRunDetail = lazy(() => import("@/pages/Payroll/PayrollRunDetail"));
const MyPayslips = lazy(() => import("@/pages/Payroll/MyPayslips"));
const EmployeePayrollProfile = lazy(
  () => import("@/pages/Payroll/EmployeePayrollProfile"),
);

// use lazy for better code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Attributes = lazy(() => import("@/pages/Attributes"));
const ChildAttributes = lazy(() => import("@/pages/ChildAttributes"));
const Products = lazy(() => import("@/pages/Products"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));
const Category = lazy(() => import("@/pages/Category"));
const ChildCategory = lazy(() => import("@/pages/ChildCategory"));
const Staff = lazy(() => import("@/pages/Staff"));
const Business = lazy(() => import("@/pages/Business/Business"));
const viewBusinessDetails = lazy(
  () => import("@/pages/Business/viewBusinessDetails"),
);
const CalendarEvents = lazy(
  () => import("@/pages/Calendar/Calendar Events/CalendarEvents"),
);
const NotificationSettings = lazy(
  () => import("@/pages/NotificationEvents/NotificationEvents"),
);
const UserRoles = lazy(() => import("@/pages/RoleBaseAccess/UserRoles"));
const SystemUsers = lazy(() => import("@/pages/RoleBaseAccess/SystemUsers"));
const SystemUserForm = lazy(
  () => import("@/pages/RoleBaseAccess/SystemUserForm"),
);
const ActivityLogs = lazy(() => import("@/pages/ActivityLogs/ActivityLogs"));
const ApplicationDocumentsPage = lazy(
  () => import("@/pages/Settings/Applications/ApplicationDocumentsPage"),
);
const ApplicationFieldsPage = lazy(
  () => import("@/pages/Settings/Applications/ApplicationFieldsPage"),
);
const DynamicFormsPage = lazy(
  () => import("@/pages/Settings/Applications/DynamicFormsPage"),
);
const ClassCategoriesPage = lazy(
  () => import("@/pages/Settings/Applications/ClassCategoriesPage"),
);
const Departments_Positions = lazy(
  () => import("@/pages/Settings/HR/Departments_Positions"),
);
const Branch_locations = lazy(
  () => import("@/pages/Settings/HR/Branch_Locations"),
);
const Sales_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/sales/Sales_Misc_Data_Types"),
);
const Modules = lazy(() => import("@/pages/Modules/Modules"));
const viewActivityLogsDetails = lazy(
  () => import("@/pages/ActivityLogs/viewActivityLogsDetails"),
);
const EmailLogs = lazy(() => import("@/pages/EmailLogs/EmailLogs"));
const viewEmailLogsDetails = lazy(
  () => import("@/pages/EmailLogs/viewEmailLogsDetails"),
);
//customer
const Customers = lazy(() => import("@/pages/Customer/CustomerListScreen"));
const ViewCustomerDetails = lazy(
  () => import("@/pages/Customer/viewCustomerDetails"),
);
const NewCustomerScreen = lazy(
  () => import("@/pages/Customer/NewCustomerScreen.jsx"),
);

//Accounts
const AccountsScreen = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/CustomerInvoice"),
);
const PrepareSaleContract = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/PrepareSaleContract"),
);

const PreparePurchaseContract = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/PreparePurchaseContract"),
);

const UploadSignedDocument = lazy(() => import("@/pages/UploadSignedDocument"));

//Vendor
const Vendor = lazy(() => import("@/pages/Purchase/Vendors/VendorListScreen"));
const NewVendorScreen = lazy(
  () => import("@/pages/Purchase/Vendors/NewVendorScreen"),
);
// const Vendor = lazy(() => import("@/pages/Purchase/Vendors/VendorListScreen"))

const CustomerOrder = lazy(() => import("@/pages/CustomerOrder"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderInvoice = lazy(() => import("@/pages/OrderInvoice"));
const Coupons = lazy(() => import("@/pages/Coupons"));
// const Setting = lazy(() => import("@/pages/Setting"));
const Page404 = lazy(() => import("@/pages/404"));
const ComingSoon = lazy(() => import("@/pages/ComingSoon"));
// const EditProfile = lazy(() => import("@/pages/EditProfile"));
const Languages = lazy(() => import("@/pages/Languages"));
const Currencies = lazy(() => import("@/pages/Currencies"));
const Setting = lazy(() => import("@/pages/Setting"));
const Configuration = lazy(
  () => import("@/pages/Configuration/Configurations"),
);

const StoreHome = lazy(() => import("@/pages/StoreHome"));
const StoreSetting = lazy(() => import("@/pages/StoreSetting"));
const Notifications = lazy(() => import("@/pages/Notifications"));

const ConfigTab = lazy(() => import("@/pages/Configuration/ConfigTab"));
const TabEmailConfig = lazy(
  () => import("@/pages/Configuration/TabEmailConfig"),
);
const TabDocumentNumbering = lazy(
  () => import("@/pages/Configuration/TabDocumentNumbering"),
);
// const EmailTemplatesUI = lazy(() => import("@/pages/EmailPage/EmailTemplate"));
// const AddEmailTemplate = lazy(() =>
//   import("@/pages/EmailPage/AddEmailTemplate")
// );
const Items = lazy(() => import("@/pages/Items/Items"));
const Categories = lazy(() => import("@/pages/Categories/Categories"));
const NewCategoryScreen = lazy(
  () => import("@/pages/Categories/NewCategoryScreen"),
);
const EditCategoryScreen = lazy(
  () => import("@/pages/Categories/EditCategoryScreen"),
);
const TaxClasses = lazy(() => import("@/pages/Settings/items/TaxClasses"));
const NewTaxClassScreen = lazy(
  () => import("@/pages/Settings/items/NewTaxClassScreen"),
);
const EditTaxClassScreen = lazy(
  () => import("@/pages/Settings/items/EditTaxClassScreen"),
);
const DocumentNumbering = lazy(
  () => import("@/pages/Settings/documents/DocumentNumbering"),
);
// const Stock_Group = lazy(() => import("@/pages/Items/Stock_Group"));

const DocsManagement = lazy(
  () => import("@/pages/DocsManagement/DocsManagement"),
);
const SharedWithMe = lazy(() => import("@/pages/DocsManagement/SharedWithMe"));
const Recent = lazy(() => import("@/pages/DocsManagement/Recent"));
const Trash = lazy(() => import("@/pages/DocsManagement/Trash"));

const Home = lazy(() => import("@/pages/Home"));
const UploadNew = lazy(() => import("@/pages/DocsManagement/UploadNew"));
const EmailLog = lazy(() => import("@/pages/EmailPage/EmailLogs"));
const NewItemScreen = lazy(() => import("@/pages/Items/NewItemScreen"));
const EditItemScreen = lazy(() => import("@/pages/Items/EditItemScreen"));
const Recipes = lazy(() => import("@/pages/Items/Recipes"));
const RecipeForm = lazy(() => import("@/pages/Items/RecipeForm"));
const PurchasePlanning = lazy(() => import("@/pages/Items/PurchasePlanning"));
const Warehouses = lazy(() => import("@/pages/Inventory/Warehouses"));
const WarehouseForm = lazy(() => import("@/pages/Inventory/WarehouseForm"));
const Locations = lazy(() => import("@/pages/Inventory/Locations"));
const StockLevels = lazy(() => import("@/pages/Inventory/StockLevels"));
const InventoryAdjustments = lazy(
  () => import("@/pages/Inventory/InventoryAdjustments"),
);
const InventoryAdjustmentForm = lazy(
  () => import("@/pages/Inventory/InventoryAdjustmentForm"),
);
const InternalTransfers = lazy(
  () => import("@/pages/Inventory/InternalTransfers"),
);
const InternalTransferForm = lazy(
  () => import("@/pages/Inventory/InternalTransferForm"),
);
const GoodsReceipts = lazy(() => import("@/pages/Inventory/GoodsReceipts"));
const GoodsReceiptForm = lazy(
  () => import("@/pages/Inventory/GoodsReceiptForm"),
);
const StockTraceability = lazy(
  () => import("@/pages/Inventory/StockTraceability"),
);
const StockTraceabilityItem = lazy(
  () => import("@/pages/Inventory/StockTraceabilityItem"),
);
const ReorderingRules = lazy(
  () => import("@/pages/Inventory/ReorderingRules"),
);
const ReorderingRuleForm = lazy(
  () => import("@/pages/Inventory/ReorderingRuleForm"),
);
const PickLists = lazy(() => import("@/pages/Inventory/PickLists"));
const ExpiryAlerts = lazy(() => import("@/pages/Inventory/ExpiryAlerts"));
const InventoryValuation = lazy(
  () => import("@/pages/Inventory/InventoryValuation"),
);
const InventoryReports = lazy(
  () => import("@/pages/Inventory/InventoryReports"),
);
const CurrentStockReport = lazy(
  () => import("@/pages/Inventory/reports/CurrentStockReport"),
);
const ProductMovementReport = lazy(
  () => import("@/pages/Inventory/reports/ProductMovementReport"),
);
const StockAgingReport = lazy(
  () => import("@/pages/Inventory/reports/StockAgingReport"),
);
const LowStockReport = lazy(
  () => import("@/pages/Inventory/reports/LowStockReport"),
);
const InventoryForecastReport = lazy(
  () => import("@/pages/Inventory/reports/InventoryForecastReport"),
);
const LotSerialReport = lazy(
  () => import("@/pages/Inventory/reports/LotSerialReport"),
);
const WarehousePerformanceReport = lazy(
  () => import("@/pages/Inventory/reports/WarehousePerformanceReport"),
);
const StockGroupListScreen = lazy(
  () => import("@/pages/StockGroup/StockGroupListScreen"),
);
const NewStockGroupScreen = lazy(
  () => import("@/pages/StockGroup/NewStockGroupScreen"),
);
const EditStockGroupScreen = lazy(
  () => import("@/pages/StockGroup/EditStockGroupScreen"),
);
const settingsCategories = lazy(
  () => import("@/pages/SettingScreen/SettingScree"),
);
const PContractListScreen = lazy(
  () => import("@/pages/Purchase/PurchaseContract/PContractListScreen"),
);
const PContractScreen = lazy(
  () => import("@/pages/Purchase/PurchaseContract/PContractScreen"),
);
const ContractDetails = lazy(
  () => import("@/pages/Purchase/PurchaseContract/actions/ContractDetail"),
);

const CreateShipment = lazy(
  () =>
    import("@/pages/Purchase/PurchaseContract/actions/component/subcomponent/CreateShipment"),
);
const MainShipmentDetails = lazy(
  () =>
    import("@/pages/Purchase/PurchaseContract/actions/component/subcomponent/shipmentaction/MainShipmentDetails"),
);
const BillOfLanding = lazy(
  () =>
    import("@/pages/Purchase/PurchaseContract/actions/component/subcomponent/shipmentaction/BillOfLanding"),
);

//Purchase Contracts:
const PurchaseContract = lazy(
  () => import("@/pages/Purchase_Contract/PurchaseContract"),
);

const PurchaseStatementGenerator = lazy(
  () => import("@/pages/Purchase_Contract/PurchaseStatementGenerator"),
);

const AddTwoLevelPurchaseContract = lazy(
  () => import("@/pages/Purchase_Contract/AddTwoLevelPurchaseContract"),
);

const PurchaseContractView = lazy(
  () => import("@/pages/Purchase_Contract/actions/PurchaseContractDetail"),
);

const OverViewPurchase = lazy(
  () => import("@/pages/Purchase_Contract/actions/OverViewPurchase"),
);

const OverViewSales = lazy(
  () => import("@/pages/SalesContract/actions/OverViewSales"),
);

// Operations
const Campaigns = lazy(() => import("@/pages/Operations/Campaigns/index"));
const CampaignView = lazy(
  () => import("@/pages/Operations/Campaigns/CampaignView"),
);
const CampaignApplications = lazy(
  () => import("@/pages/Operations/Campaigns/Applications"),
);
const ReferralProgramPage = lazy(() => import("@/pages/ReferralProgram/index.jsx"));
const FleetJobsPage = lazy(
  () => import("@/pages/FleetManagement/JobsPage.jsx"),
);
const AppointmentsPage = lazy(
  () => import("@/pages/Appointments/AppointmentsPage.jsx"),
);
const AppointmentDetailPage = lazy(
  () => import("@/pages/Appointments/AppointmentDetailPage.jsx"),
);
const PractitionersPage = lazy(
  () => import("@/pages/Practitioners/PractitionersPage.jsx"),
);
const FleetJobDetailsPage = lazy(
  () => import("@/pages/FleetManagement/JobDetailsPage.jsx"),
);
const FleetSchedulingEntry = lazy(
  () => import("@/pages/FleetManagement/SchedulingEntry.jsx"),
);

const SalesContract = lazy(() => import("@/pages/SalesContract/SalesContract"));
const SalesContractView = lazy(
  () => import("@/pages/SalesContract/actions/ContractDetail"),
);

const viewInvoiceDetails = lazy(
  () =>
    import("@/pages/SalesContract/actions/headercomponents/viewInvoiceDetails"),
);

const CreatePerformaInvoice = lazy(
  () => import("@/pages/SalesContract/actions/CreatePerformaInvoice"),
);

const CreateCustomerInvoice = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/CreateCustomerInvoice"),
);

const ViewCustomerInvoice = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/CustomerInvoiceViewer.jsx"),
);

const EInvoiceDetailsPage = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/EInvoiceDetailsPage"),
);

const UpdateCustomerInvoice = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/UpdateCustomerInvoice"),
);

const CustomerInvoices = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/CustomerInvoices"),
);

const Quotations = lazy(
  () => import("@/pages/Accounts/Quotations/Quotations"),
);

const Enquiries = lazy(() => import("@/pages/Enquiries/Enquiries"));
const EnquiryForm = lazy(() => import("@/pages/Enquiries/EnquiryForm"));
const Applications = lazy(() => import("@/pages/Applications/Applications"));
const ApplicationView = lazy(
  () => import("@/pages/Applications/ApplicationView"),
);
const ApplicationActions = lazy(
  () => import("@/pages/Applications/ApplicationActions"),
);
const Projects = lazy(() => import("@/pages/Projects/Projects"));
const ProjectDetail = lazy(() => import("@/pages/Projects/ProjectDetail"));
const CostingSheets = lazy(() => import("@/pages/CostingSheets/CostingSheets"));
const CertificationInvoices = lazy(() => import("@/pages/Invoices/Invoices"));
const CertificationQuotations = lazy(
  () => import("@/pages/CertificationQuotations/CertificationQuotations"),
);
const AdminCreateApplication = lazy(
  () => import("@/pages/Applications/AdminCreateApplication"),
);
const AdminApplicationWizardPage = lazy(
  () => import("@/pages/Applications/AdminApplicationWizardPage"),
);

const CreateQuotation = lazy(
  () => import("@/pages/Accounts/Quotations/CreateQuotation"),
);

const UpdateQuotation = lazy(
  () => import("@/pages/Accounts/Quotations/UpdateQuotation"),
);

const ViewQuotation = lazy(
  () => import("@/pages/Accounts/Quotations/QuotationViewer"),
);

const RecurringInvoices = lazy(
  () => import("@/pages/Accounts/RecurringInvoice/RecurringInvoices"),
);
const CreateRecurringInvoice = lazy(
  () => import("@/pages/Accounts/RecurringInvoice/CreateRecurringInvoice"),
);
const ViewRecurringInvoice = lazy(
  () => import("@/pages/Accounts/RecurringInvoice/ViewRecurringInvoice"),
);

const CustomerStatement = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/CustomerStatement"),
);

const CustomerStatementGenerator = lazy(
  () => import("@/pages/Accounts/CustomerInvoice/CustomerStatementGenerator"),
);

// Sales Orders
const SalesOrdersList = lazy(
  () => import("@/pages/SalesOrders/SalesOrdersList.jsx"),
);
const SalesOrderForm = lazy(
  () => import("@/pages/SalesOrders/SalesOrderForm.jsx"),
);
const ViewSalesOrder = lazy(
  () => import("@/pages/SalesOrders/ViewSalesOrder.jsx"),
);
const SalesOrderEmailPreview = lazy(
  () => import("@/pages/SalesOrders/SalesOrderEmailPreview.jsx"),
);
const PurchaseOrdersList = lazy(
  () => import("@/pages/PurchaseOrders/PurchaseOrdersList.jsx"),
);
const PurchaseOrderForm = lazy(
  () => import("@/pages/PurchaseOrders/PurchaseOrderForm.jsx"),
);
const ViewPurchaseOrder = lazy(
  () => import("@/pages/PurchaseOrders/ViewPurchaseOrder.jsx"),
);

const VendorInvoices = lazy(
  () => import("@/pages/Accounts/VendorInvoices/VendorInvoices"),
);

const VendorStatement = lazy(
  () => import("@/pages/Accounts/VendorInvoices/VendorStatement"),
);

const VendorPayments = lazy(
  () => import("@/pages/Accounts/VendorInvoices/VendorPayments"),
);

const CreateVendorInvoice = lazy(
  () => import("@/pages/Accounts/VendorInvoices/CreateVendorInvoiceNew"),
);

const UpdateVendorInvoice = lazy(
  () => import("@/pages/Accounts/VendorInvoices/UpdateVendorInvoice"),
);

const ViewVendorInvoice = lazy(
  () => import("@/pages/Accounts/VendorInvoices/ViewVendorInvoice"),
);

const Expenses = lazy(() => import("@/pages/Accounts/Expenses/Expenses"));

const CreateExpense = lazy(
  () => import("@/pages/Accounts/Expenses/CreateExpense"),
);

const UpdateExpense = lazy(
  () => import("@/pages/Accounts/Expenses/UpdateExpense"),
);

const ViewExpense = lazy(() => import("@/pages/Accounts/Expenses/ViewExpense"));

const BorrowingInvoices = lazy(
  () => import("@/pages/Accounts/BorrowingInvoices/BorrowingInvoices"),
);

const SpecialTransfers = lazy(
  () => import("@/pages/Accounts/SpecialTransfers/SpecialTransfers"),
);

const ProfitabilityCalculation = lazy(
  () => import("@/pages/Accounts/Reporting/Reporting"),
);

const CreateSpecialTransfer = lazy(
  () => import("@/pages/Accounts/SpecialTransfers/CreateSpecialTransfer"),
);

const ViewSpecialTransfer = lazy(
  () => import("@/pages/Accounts/SpecialTransfers/ViewSpecialTransfer"),
);

const UpdateSpecialTransfer = lazy(
  () => import("@/pages/Accounts/SpecialTransfers/UpdateSpecialTransfer"),
);

const SpecialTransfersTypes = lazy(
  () => import("@/components/SpecialTransfersTypes/SpecialTransfersTypes"),
);

const CreateBorrowingInvoice = lazy(
  () => import("@/pages/Accounts/BorrowingInvoices/CreateBorrowingInvoice"),
);

const UpdateBorrowingInvoice = lazy(
  () => import("@/pages/Accounts/BorrowingInvoices/UpdateBorrowingInvoice"),
);

const ViewBorrowingInvoice = lazy(
  () => import("@/pages/Accounts/BorrowingInvoices/ViewBorrowingInvoice"),
);

const CreditNotes = lazy(
  () => import("@/pages/Accounts/CreditNotes/CreditNotes"),
);

const CreateCreditNote = lazy(
  () => import("@/pages/Accounts/CreditNotes/CreateCreditNote"),
);

const UpdateCreditNote = lazy(
  () => import("@/pages/Accounts/CreditNotes/UpdateCreditNote"),
);

const ViewCreditNote = lazy(
  () => import("@/pages/Accounts/CreditNotes/ViewCreditNote"),
);

const DebitNotes = lazy(() => import("@/pages/Accounts/DebitNotes/DebitNotes"));

const CreateDebitNote = lazy(
  () => import("@/pages/Accounts/DebitNotes/CreateDebitNote"),
);

const ViewDebitNote = lazy(
  () => import("@/pages/Accounts/DebitNotes/ViewDebitNote"),
);

const UpdateDebitNote = lazy(
  () => import("@/pages/Accounts/DebitNotes/UpdateDebitNote"),
);

const CustomerPayments = lazy(
  () => import("@/pages/Accounts/CustomerPayments/CustomerPayments"),
);

const EmailPreview = lazy(
  () => import("@/pages/SalesContract/actions/EmailPreview"),
);
const SalesContractAdd = lazy(
  () => import("@/pages/SalesContract/SalesContractScreen"),
);
const UpdateSalesContractScreen = lazy(
  () => import("@/pages/SalesContract/UpdateSalesContractScreen"),
);
const PurchaseContractAdd = lazy(
  () => import("@/pages/Purchase_Contract/AddPurchase_Contract"),
);
const UpdatePurchaseContractScreen = lazy(
  () => import("@/pages/Purchase_Contract/UpdatePurchaseContractScreen"),
);

const DocumentTemplateCreate = lazy(
  () => import("@/pages/Document_Template/DocumentTemplateCreate"),
);

const BankManagement = lazy(
  () => import("@/pages/TreasuryAndFinance/BankingManagement"),
);
const AddAccount = lazy(
  () => import("@/pages/TreasuryAndFinance/AddBankAccount"),
);
const EditAccount = lazy(
  () => import("@/pages/TreasuryAndFinance/EditBankAccount"),
);
const Ledgers = lazy(() => import("@/pages/TreasuryAndFinance/Ledgers"));
const FinancialDashboard = lazy(
  () => import("@/pages/TreasuryAndFinance/Dashboard/financial-dashboard"),
);

const AddLedger = lazy(() => import("@/pages/TreasuryAndFinance/AddLedger"));

const EditChart = lazy(() => import("@/pages/TreasuryAndFinance/EditAccount"));
const ChartOfAccounts = lazy(
  () => import("@/pages/TreasuryAndFinance/ChartOfAccounts.jsx"),
);

const StaffListScreen = lazy(
  () => import("@/pages/HrManagement/pages/Staff/StaffListScreen"),
);
const AddStaffPage = lazy(
  () => import("@/pages/HrManagement/pages/Staff/AddStaffPage"),
);
const StaffProfilePage = lazy(
  () => import("@/pages/HrManagement/pages/Staff/StaffProfilePage"),
);
const AddChartAccount = lazy(
  () => import("@/pages/TreasuryAndFinance/AddAccount"),
);

const BankStatements = lazy(
  () => import("@/pages/TreasuryAndFinance/BankStatements"),
);
const BankReconciliations = lazy(
  () => import("@/pages/TreasuryAndFinance/BankReconciliations"),
);
const InitiateReconciliation = lazy(
  () => import("@/pages/TreasuryAndFinance/InitiateReconciliation"),
);
const ReconciliationWorkspace = lazy(
  () => import("@/pages/TreasuryAndFinance/ReconciliationWorkspace"),
);
const ReconciliationStatusReport = lazy(
  () => import("@/pages/TreasuryAndFinance/ReconciliationStatusReport"),
);
const ViewReconciliation = lazy(
  () => import("@/pages/TreasuryAndFinance/ViewReconciliation"),
);
const LedgerCoverageReport = lazy(
  () => import("@/pages/TreasuryAndFinance/LedgerCoverageReport"),
);
const ProviderSettlements = lazy(
  () => import("@/pages/TreasuryAndFinance/ProviderSettlements"),
);

const AuthorizationRequests = lazy(
  () => import("@/pages/TreasuryAndFinance/AuthorizationRequests"),
);

const Receivables = lazy(
  () => import("@/pages/TreasuryAndFinance/Receivables"),
);

const CreateAuthorizationLetter = lazy(
  () => import("@/pages/TreasuryAndFinance/CreateAuthorizationLetter"),
);

const Payments = lazy(() => import("@/pages/TreasuryAndFinance/Payments"));

const AuthorizationLetterTemplates = lazy(
  () => import("@/pages/TreasuryAndFinance/AuthorizationLetterTemplates.jsx"),
);

const SendEmail = lazy(() => import("@/pages/TreasuryAndFinance/SendEmail"));

const StaffManagement = lazy(
  () => import("@/pages/HrManagement/StaffManagement"),
);

const ViewStaffDetails = lazy(
  () => import("@/pages/HrManagement/ViewStaffDetails"),
);

const LeaveRequestsPage = lazy(
  () => import("@/pages/HrManagement/LeaveManagement/LeaveRequestPage.jsx"),
);

const StaffLeaveRequestsPage = lazy(
  () => import("@/pages/HrManagement/LeaveManagement/StaffLeaveRequestPage"),
);

const ApplyLeavePage = lazy(
  () => import("@/pages/HrManagement/LeaveManagement/ApplyLeavePage.jsx"),
);

const StaffApplyLeavePage = lazy(
  () => import("@/pages/HrManagement/LeaveManagement/StaffApplyLeavePage"),
);

const StaffLeaveBalancePage = lazy(
  () =>
    import("@/pages/HrManagement/LeaveManagement/StaffLeaveBalancePage.jsx"),
);

const StaffIndividualLeaveBalancePage = lazy(
  () =>
    import("@/pages/HrManagement/LeaveManagement/StaffIndividualLeaveBalancePage.jsx"),
);

const HrCalendarEvents = lazy(
  () => import("@/pages/HrManagement/HrCalendar/HrCalendarEvents.jsx"),
);

const MyCalendarEvents = lazy(
  () => import("@/pages/HrManagement/HrCalendar/MyCalendarEvents.jsx"),
);

const WFHRequestsPage = lazy(
  () => import("@/pages/HrManagement/WFHRequests/WFHRequestsPage.jsx"),
);

const StaffWFHRequestsPage = lazy(
  () => import("@/pages/HrManagement/WFHRequests/StaffWFHRequestsPage"),
);

const AttendancePage = lazy(
  () => import("@/pages/HrManagement/Attendance/AttendancePage.jsx"),
);

const EventManagementPage = lazy(
  () => import("@/pages/HrManagement/EventManagement/EventManagement"),
);
const StaffEventManagementPage = lazy(
  () => import("@/pages/HrManagement/EventManagement/StaffEventMangement"),
);
const ViewStaffPoints = lazy(
  () => import("@/pages/HrManagement/components/ViewStaffPoints"),
);
const TaskManagementPage = lazy(
  () => import("@/pages/HrManagement/EventManagement/TaskManagement"),
);
const StaffTaskManagementPage = lazy(
  () => import("@/pages/HrManagement/EventManagement/StaffTaskManagement"),
);
const ViewAttendees = lazy(
  () => import("@/pages/HrManagement/EventManagement/ViewEventAttendees"),
);
const AddAttendeePoints = lazy(
  () => import("@/pages/HrManagement/EventManagement/AddAttendeePoints.jsx"),
);

const UserAttendancePage = lazy(
  () => import("@/pages/UserAttendance/UserAttendance.jsx"),
);

const AttendanceDetailPage = lazy(
  () => import("@/pages/HrManagement/Attendance/AttendanceDetail.jsx"),
);

const ApplyWFHPage = lazy(
  () => import("@/pages/HrManagement/WFHRequests/ApplyWFHPage.jsx"),
);

const WFHNotificationSetting = lazy(
  () => import("@/pages/HrManagement/WFHRequests/WFHNotificationSettings"),
);

const AddEventPage = lazy(
  () => import("@/pages/HrManagement/EventManagement/AddEventPage"),
);

const AddTaskPage = lazy(
  () => import("@/pages/HrManagement/EventManagement/AddTaskPage"),
);

const ClaimsDashboard = lazy(
  () => import("@/pages/HrManagement/ClaimManagement/ClaimsDashboard"),
);

const ClaimDetails = lazy(
  () => import("@/pages/HrManagement/ClaimManagement/ClaimDetails"),
);

const NewClaimForm = lazy(
  () => import("@/pages/HrManagement/ClaimManagement/NewClaimForm"),
);
const StaffClaimManagement = lazy(
  () => import("@/pages/HrManagement/ClaimManagement/StaffClaimsDashboard"),
);
const StaffNewClaimForm = lazy(
  () => import("@/pages/HrManagement/ClaimManagement/StaffClaimForm"),
);

// Business Group
const BusinessGroupListScreen = lazy(
  () => import("@/pages/BusinessGroup/BusinessGroupListScreen"),
);
const NewBusinessGroupScreen = lazy(
  () => import("@/pages/BusinessGroup/NewBusinessGroupScreen"),
);
const AnnouncementListScreen = lazy(
  () => import("@/pages/Announcements/AnnouncementListScreen"),
);
const CreateAnnouncement = lazy(
  () => import("@/pages/Announcements/CreateAnnouncement"),
);
const BroadcastListScreen = lazy(
  () => import("@/pages/Broadcasts/BroadcastListScreen"),
);
const BroadcastDetailScreen = lazy(
  () => import("@/pages/Broadcasts/BroadcastDetailScreen"),
);

/** Legacy URL → campaign detail page (send history section). */
const BroadcastWhatsappHistoryRedirect = ({ match }) => (
  <Redirect to={`/broadcasts/${match.params.id}#send-history`} />
);
const ChequeListScreen = lazy(() => import("@/pages/Cheques/ChequeListScreen"));
const ChequeDashboard = lazy(() => import("@/pages/Cheques/ChequeDashboard"));
const ChequeForm = lazy(() => import("@/pages/Cheques/ChequeForm"));
const ChequeDetail = lazy(() => import("@/pages/Cheques/ChequeDetail"));
const ChequeReportingPage = lazy(
  () => import("@/pages/Accounts/Reporting/ChequeReportingPage"),
);

// Business
const NewBusinessScreen = lazy(
  () => import("@/pages/Business/NewBusinessScreen"),
);

// Subscription pricing plans
const SubscriptionPlans = lazy(
  () => import("@/pages/SubscriptionPlans/SubscriptionPlans"),
);
const SubscriptionPlanForm = lazy(
  () => import("@/pages/SubscriptionPlans/SubscriptionPlanForm"),
);
const SubscriptionCoupons = lazy(
  () => import("@/pages/SubscriptionPlans/SubscriptionCoupons"),
);
const SubscriptionCouponForm = lazy(
  () => import("@/pages/SubscriptionPlans/SubscriptionCouponForm"),
);
const PlanInvitationsPage = lazy(
  () => import("@/pages/SubscriptionPlans/PlanInvitationsPage"),
);
const Billing = lazy(() => import("@/pages/Billing/Billing"));
const ModuleSelection = lazy(() => import("@/pages/onboarding/ModuleSelection"));
const PricingPlans = lazy(() => import("@/pages/onboarding/PricingPlans"));

const Protected = lazy(() => import("./Protected"));

/*
//  * ⚠ These are internal routes!
//  * They will be rendered inside the app, using the default `containers/Layout`.
//  * If you want to add a route to, let's say, a landing page, you should add
//  * it to the `App`'s router, exactly like `Login`, `CreateAccount` and other pages
//  * are routed.
//  *
//  * If you're looking for the links rendered in the SidebarContent, go to
//  * `routes/sidebar.js`
 */

const buildSaleOrderRedirectRoutes = () =>
  getSaleOrderCanonicalRedirectSpecs().map((spec) => ({
    path: spec.path,
    exact: spec.exact,
    component: ({ match }) => {
      const to =
        spec.routeKey === "edit" || spec.routeKey === "view"
          ? getModuleRoutePath("saleOrder", spec.routeKey, {
              id: match.params.id,
            })
          : getModuleRoutePath("saleOrder", spec.routeKey);
      return <Redirect to={to} />;
    },
  }));

export function buildAppRoutes() {
  return [
    ...buildSaleOrderRedirectRoutes(),
  {
    path: "/dashboard",
    component: Dashboard,
  },
  {
    path: "/subscription-catalog/create",
    exact: true,
    component: SubscriptionPlanForm,
  },
  {
    path: "/subscription-catalog/edit/:id",
    exact: true,
    component: SubscriptionPlanForm,
  },
  {
    path: "/subscription-catalog/coupons/create",
    exact: true,
    component: SubscriptionCouponForm,
  },
  {
    path: "/subscription-catalog/coupons/edit/:id",
    exact: true,
    component: SubscriptionCouponForm,
  },
  {
    path: "/subscription-catalog/coupons",
    exact: true,
    component: SubscriptionCoupons,
  },
  {
    path: "/subscription-catalog/:planId/invitations",
    exact: true,
    component: PlanInvitationsPage,
  },
  {
    path: "/subscription-catalog",
    exact: true,
    component: SubscriptionPlans,
  },
  {
    path: "/customer-onboarding",
    exact: true,
    render: () => <Redirect to="/subscription-catalog" />,
  },
  {
    path: "/billing/adjust/modules",
    exact: true,
    render: () => <Redirect to="/onboarding/modules?adjustment=1" />,
  },
  {
    path: "/billing/adjust/pricing",
    exact: true,
    render: () => <Redirect to="/onboarding/pricing?adjustment=1" />,
  },
  {
    path: "/billing",
    exact: true,
    component: Billing,
  },
  {
    path: "/protected",
    component: Protected,
  },
  {
    path: "/unauthorized",
    component: Unauthorized,
  },
  {
    path: "/test-permissions",
    component: TestPermissions,
  },
  {
    path: "/treasury/receivables",
    component: Receivables,
  },
  {
    path: "/treasury/authorization-requests",
    component: AuthorizationRequests,
  },
  {
    path: "/treasury/create-authorization",
    component: CreateAuthorizationLetter,
  },
  {
    path: "/payments",
    component: Payments,
  },
  {
    path: "/treasury/authorization-templates",
    component: AuthorizationLetterTemplates,
  },
  {
    path: "/treasury/send-email",
    component: SendEmail,
  },
  {
    path: "/leave-management",
    component: (props) => (
      <RouteActionGate
        title="Leave Management"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <LeaveRequestsPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/apply-leave-on-behalf",
    component: (props) => (
      <RouteActionGate
        title="Leave Management"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <ApplyLeavePage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-apply-leave",
    component: (props) => (
      <RouteActionGate
        title="Request Leaves"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <StaffApplyLeavePage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-leave-management",
    component: (props) => (
      <RouteActionGate
        title="Leave Management"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StaffLeaveRequestsPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-leave-balance",
    component: (props) => (
      <RouteActionGate
        title="Leave Management"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StaffLeaveBalancePage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/my-leave-balance",
    component: (props) => (
      <RouteActionGate
        title="Leave Management"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <StaffIndividualLeaveBalancePage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/hr-calendar",
    component: (props) => (
      <RouteActionGate
        title="HR Calendar"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <HrCalendarEvents {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/my-calendar",
    component: (props) => (
      <RouteActionGate
        title="HR Calendar"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <MyCalendarEvents {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/WFH-management",
    component: (props) => (
      <RouteActionGate
        title="WFH Requests"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <WFHRequestsPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/Staff-WFH-management",
    component: (props) => (
      <RouteActionGate
        title="WFH Requests"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StaffWFHRequestsPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/user-attendance",
    component: (props) => (
      <RouteActionGate
        title="Mark Attendance"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <UserAttendancePage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/attendance",
    component: (props) => (
      <RouteActionGate
        title="Attendance"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <AttendancePage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/attendance-details",
    component: (props) => (
      <RouteActionGate
        title="Attendance"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <AttendanceDetailPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/event-management",
    component: (props) => (
      <RouteActionGate
        title="Event Management"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <EventManagementPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/HR-Analytics",
    component: (props) => (
      <RouteActionGate
        title="Analytics"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <AnalyticsPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/reports",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Reports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/all-reports",
    component: (props) => (
      <RouteActionGate
        title="Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <AllReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/P_L_Reports",
    component: (props) => (
      <RouteActionGate
        title="Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <P_L_Reports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/sales-without-purchase-reports",
    component: (props) => (
      <RouteActionGate
        title="Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <SalesWithoutPurchaseReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-without-sales-reports",
    component: (props) => (
      <RouteActionGate
        title="Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PurchaseWithoutSalesReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/supplier-reports",
    component: (props) => (
      <RouteActionGate
        title="Supplier Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <SupplierReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/sales-reports",
    component: (props) => (
      <RouteActionGate
        title="Sales Analytics"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/customer-reports",
    component: (props) => (
      <RouteActionGate
        title="Sales Analytics"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/tax-reports",
    component: (props) => (
      <RouteActionGate
        title="Tax Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <TaxReportPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/attendance-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <AttendanceReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/attendance-percentage-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <AttendancePercentageReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/lateness-summary-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <LatenessSummaryReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/working-hours-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <WorkingHoursReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/overtime-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <OvertimeReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/leave-taken-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <LeaveTakenReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/leave-utilization-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <LeaveUtilizationReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/work-pass-expiry-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <WorkPassExpiryReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/event-performance-report",
    component: (props) => (
      <RouteActionGate
        title="HR Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <EventPerformanceReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-event-management",
    component: (props) => (
      <RouteActionGate
        title="My Events"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StaffEventManagementPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/view-points/:id",
    component: ViewStaffPoints,
  },
  {
    path: "/task-management",
    component: (props) => (
      <RouteActionGate
        title="Event Management"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <TaskManagementPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-task-management",
    component: (props) => (
      <RouteActionGate
        title="My Events"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StaffTaskManagementPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/view-attendees",
    component: (props) => (
      <RouteActionGate
        title="Event Management"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewAttendees {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/add-attendee-points",
    component: (props) => (
      <RouteActionGate
        title="Event Management"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <AddAttendeePoints {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/apply-WFH",
    component: (props) => (
      <RouteActionGate
        title="WFH Requests"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <ApplyWFHPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-apply-WFH",
    component: (props) => (
      <RouteActionGate
        title="Request WFH"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <StaffApplyWFHPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/WFH-notifications-settings",
    component: (props) => (
      <RouteActionGate
        title="WFH Requests"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <WFHNotificationSetting {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/add-event",
    component: (props) => (
      <RouteActionGate
        title="Event Management"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <AddEventPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/add-task",
    component: (props) => (
      <RouteActionGate
        title="Event Management"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <AddTaskPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/claim-management",
    component: (props) => (
      <RouteActionGate
        title="Claims"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ClaimsDashboard {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/claim-details/:id",
    component: (props) => (
      <RouteActionGate
        title="Claims"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ClaimDetails {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-claim-details/:id",
    component: (props) => (
      <RouteActionGate
        title="Claims"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <StaffClaimDetails {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/new-claim",
    component: (props) => (
      <RouteActionGate
        title="Claims"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <NewClaimForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-claim-management",
    component: (props) => (
      <RouteActionGate
        title="Claims"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StaffClaimManagement {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/staff-new-claim",
    component: (props) => (
      <RouteActionGate
        title="Request Claims"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <StaffNewClaimForm {...props} />
      </RouteActionGate>
    ),
  },
  // Payroll Module
  {
    path: "/my-payslips",
    component: (props) => (
      <RouteActionGate
        title="My Payslips"
        allowAnyOf={[PERMISSION_ACTION.VIEW, PERMISSION_ACTION.VIEW_DETAILS]}
      >
        <MyPayslips {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/payroll/employee/:employeeId",
    component: (props) => (
      <RouteActionGate
        title="Payroll"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <EmployeePayrollProfile {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/payroll/run/:id",
    component: (props) => (
      <RouteActionGate
        title="Payroll"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <PayrollRunDetail {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/payroll/analytics",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Payroll Analytics"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PayrollAnalytics {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/payroll/reports",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Payroll Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PayrollReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/payroll",
    component: (props) => (
      <RouteActionGate
        title="Payroll"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PayrollDashboard {...props} />
      </RouteActionGate>
    ),
  },

  // POS
  {
    path: "/pos",
    exact: true,
    component: PosPage,
  },
  {
    path: "/pos/tables-summary",
    component: PosTablesSummary,
  },
  {
    path: "/pos/reports",
    component: PosReports,
  },

  // Kitchen
  {
    path: "/kitchen",
    component: KitchenBoard,
  },

  //HR Management
  {
    path: "/StaffListScreen",
    component: StaffListScreen,
  },
  {
    path: "/AddStaffPage",
    component: AddStaffPage,
  },
  {
    path: "/staff-management",
    component: StaffManagement,
  },
  {
    path: "/staff/:id",
    component: ViewStaffDetails,
  },
  {
    path: "/StaffProfilePage",
    component: StaffProfilePage,
  },
  {
    path: "/view_invoice_details",
    component: viewInvoiceDetails,
  },
  {
    path: "/purchases",
    component: PContractListScreen,
  },
  {
    path: "/Edit Contract/:contractId",
    component: PContractScreen,
  },
  {
    path: "/New Contract",
    component: PContractScreen,
  },
  {
    path: "/Contract Details",
    component: ContractDetails,
  },
  {
    path: "/Create Shipment",
    component: CreateShipment,
  },
  {
    path: "/Shipment Details",
    component: MainShipmentDetails,
  },
  {
    path: "/Bill Of Landing",
    component: BillOfLanding,
  },

  {
    path: "/sales",
    component: SalesContract,
  },
  {
    path: "/purchase_contracts",
    component: PurchaseContract,
  },
  {
    path: "/over-view-sales",
    component: OverViewSales,
  },
  {
    path: "/over-view-purchase",
    component: OverViewPurchase,
  },
  {
    path: "/campaigns",
    component: (props) => (
      <RouteActionGate
        title="Campaigns"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Campaigns {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/campaigns/:campaignId/applications",
    component: (props) => (
      <RouteActionGate
        title="Campaign Applications"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CampaignApplications {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/campaigns/:campaignId",
    component: (props) => (
      <RouteActionGate
        title="Campaign Details"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CampaignView {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/referral-program",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Referral program"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ReferralProgramPage {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/appointments",
    exact: true,
    component: AppointmentsPage,
  },
  {
    path: "/appointments/:appointmentId",
    exact: true,
    component: AppointmentDetailPage,
  },
  {
    path: "/practitioners",
    exact: true,
    component: PractitionersPage,
  },
  {
    path: "/jobs",
    exact: true,
    component: FleetJobsPage,
  },
  {
    path: "/jobs/:jobId",
    exact: true,
    component: FleetJobDetailsPage,
  },
  {
    path: "/scheduling",
    component: FleetSchedulingEntry,
  },
  {
    path: "/notification-events",
    component: (props) => (
      <SettingsChildGuard>
        <NotificationSettings {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/view-purchase-contract",
    component: PurchaseContractView,
  },
  {
    path: "/view-purchase-contract/:_id",
    component: PurchaseContractView,
  },
  {
    path: "/add-purchase-contract",
    component: PurchaseContractAdd,
  },
  {
    path: "/update-purchase-contract",
    component: UpdatePurchaseContractScreen,
  },
  {
    path: "/purchase-contract-statement",
    component: PurchaseStatementGenerator,
  },

  {
    path: "/add-sales-contract",
    component: SalesContractAdd,
  },
  {
    path: "/update-sales-contract",
    component: UpdateSalesContractScreen,
  },
  {
    path: "/view-sales-contract",
    component: SalesContractView,
  },
  {
    path: "/view-sales-contract/:_id",
    component: SalesContractView,
  },
  {
    path: "/upload-signed-document/:contractId",
    component: UploadSignedDocument,
  },
  {
    path: "/create-performa-invoice",
    component: CreatePerformaInvoice,
  },
  {
    path: "/create-customer-invoice",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("invoice", "Customer Invoices")}
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <CreateCustomerInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/view-customer-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("invoice", "Customer Invoices")}
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewCustomerInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/invoices/e-invoice/:code",
    component: (props) => <EInvoiceDetailsPage {...props} />,
  },
  {
    path: "/update-customer-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("invoice", "Customer Invoices")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <UpdateCustomerInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/customer-invoices",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("invoice", "Customer Invoices")}
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerInvoices {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/e-invoices",
    component: (props) => (
      <RouteActionGate
        title="E-Invoices"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerInvoices {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/quotations/create",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("quotation", "Quotations")}
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <CreateQuotation {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/quotations/view/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("quotation", "Quotations")}
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewQuotation {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/quotations/edit/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("quotation", "Quotations")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <UpdateQuotation {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/quotation-email-preview",
    component: SalesOrderEmailPreview,
  },
  {
    path: "/quotations",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("quotation", "Quotations")}
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Quotations {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/enquiries/create",
    component: (props) => (
      <RouteActionGate
        title="Enquiry"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <EnquiryForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/enquiries/view/:id",
    component: (props) => (
      <RouteActionGate
        title="Enquiry"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <EnquiryForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/enquiries/edit/:id",
    component: (props) => (
      <RouteActionGate
        title="Enquiry"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <EnquiryForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/enquiries",
    component: (props) => (
      <RouteActionGate
        title="Enquiry"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Enquiries {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/applications/new",
    component: (props) => (
      <RouteActionGate
        title="Applications"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <AdminCreateApplication {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/applications/:type(certification|inspection)/new",
    component: (props) => (
      <RouteActionGate
        title="Applications"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <AdminApplicationWizardPage {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/projects",
    component: (props) => (
      <RouteActionGate
        title="Projects"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Projects {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    // Where the audit phase is run: the four audit documents, the auditor and
    // the commercial papers, on the job they belong to.
    path: "/projects/:id",
    component: (props) => (
      <RouteActionGate
        title="Project"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ProjectDetail {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    // Matches the path the Finance -> Costing Sheet nav item already links to.
    path: "/costing-sheet",
    component: (props) => (
      <RouteActionGate
        title="Costing Sheet"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CostingSheets {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    // PARKED — AQCTA FOR-01-07 certification quotations UI.
    // Finance → Quotations uses Flexa Accounts Quotations at /quotations
    // (DocumentTemplate PDF). Keep this route only as a fallback URL.
    path: "/certification-quotations",
    component: (props) => (
      <RouteActionGate
        title="Quotations (AQCTA — parked)"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CertificationQuotations {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    // Dedicated certification invoices, kept separate from the platform's
    // general ledger (Customer Invoices / Proforma Invoice).
    path: "/certification-invoices",
    component: (props) => (
      <RouteActionGate
        title="Invoices"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CertificationInvoices {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/applications/actions/:id",
    component: (props) => (
      <RouteActionGate
        title="Applications"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ApplicationActions {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/applications/view/:id",
    component: (props) => (
      <RouteActionGate
        title="Applications"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ApplicationView {...props} />
      </RouteActionGate>
    ),
  },
  /* Old links used /applications/:id before view lived under /view/:id */
  {
    path: "/applications/:id([a-f0-9]{24})",
    exact: true,
    render: ({ match }) => (
      <Redirect to={`/applications/view/${match.params.id}`} />
    ),
  },
  {
    path: "/applications",
    component: (props) => (
      <RouteActionGate
        title="Applications"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Applications {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/recurring-Invoice",
    component: (props) => (
      <RouteActionGate
        title="Customer Invoices"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <RecurringInvoices {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/create-recurring-invoice",
    component: (props) => (
      <RouteActionGate
        title="Customer Invoices"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <CreateRecurringInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/view-recurring-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title="Customer Invoices"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ViewRecurringInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/update-recurring-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title="Customer Invoices"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <CreateRecurringInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: getModuleRouteAliases("saleOrder", "create"),
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("saleOrder", "Sale Order")}
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <SalesOrderForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: getModuleRouteAliases("saleOrder", "edit"),
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("saleOrder", "Sale Order")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <SalesOrderForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: getModuleRouteAliases("saleOrder", "view"),
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("saleOrder", "Sale Order")}
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewSalesOrder {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: getModuleRouteAliases("saleOrder", "emailPreview"),
    component: SalesOrderEmailPreview,
  },
  {
    path: "/purchase-order-email-preview",
    component: SalesOrderEmailPreview,
  },
  {
    path: getModuleRouteAliases("saleOrder", "list"),
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("saleOrder", "Sale Order")}
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <SalesOrdersList {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/purchase-orders/create",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <PurchaseOrderForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-order/create",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <PurchaseOrderForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-orders/edit/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <PurchaseOrderForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-order/edit/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <PurchaseOrderForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-orders/view/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewPurchaseOrder {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-order/view/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewPurchaseOrder {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-orders",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PurchaseOrdersList {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/purchase-order",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("purchaseOrder", "Purchase Orders")}
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PurchaseOrdersList {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/customer-statement",
    component: (props) => (
      <RouteActionGate
        title="Customer Statement"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerStatement {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/customer-statement/generator",
    component: (props) => (
      <RouteActionGate
        title="Customer Statement"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerStatementGenerator {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/vendor-statement",
    component: (props) => (
      <RouteActionGate
        title="Vendor Statement"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <VendorStatement {...props} />
      </RouteActionGate>
    ),
    exact: true,
  },
  {
    path: "/expenses",
    component: Expenses,
  },
  {
    path: "/create-expense",
    component: CreateExpense,
  },
  {
    path: "/update-expense/:id",
    component: UpdateExpense,
  },
  {
    path: "/view-expense/:id",
    component: ViewExpense,
  },
  {
    path: "/borrowing-invoices",
    component: BorrowingInvoices,
  },
  {
    path: "/create-borrowing-invoice",
    component: CreateBorrowingInvoice,
  },
  {
    path: "/update-borrowing-invoice/:id",
    component: UpdateBorrowingInvoice,
  },
  {
    path: "/view-borrowing-invoice/:id",
    component: ViewBorrowingInvoice,
  },
  {
    path: "/special-transfers",
    component: SpecialTransfers,
  },
  {
    path: "/reporting",
    component: ProfitabilityCalculation,
  },
  {
    path: "/create-special-transfer",
    component: CreateSpecialTransfer,
  },
  {
    path: "/view-special-transfer/:id",
    component: ViewSpecialTransfer,
  },
  {
    path: "/update-special-transfer/:id",
    component: UpdateSpecialTransfer,
  },
  {
    path: "/special-transfer-types",
    component: SpecialTransfersTypes,
  },
  {
    path: "/credit-notes",
    component: CreditNotes,
  },
  {
    path: "/create-credit-note",
    component: CreateCreditNote,
  },
  {
    path: "/update-credit-note/:id",
    component: UpdateCreditNote,
  },
  {
    path: "/view-credit-note/:id",
    component: ViewCreditNote,
  },
  {
    path: "/debit-notes",
    component: DebitNotes,
  },
  {
    path: "/update-debit-note/:id",
    component: UpdateDebitNote,
  },
  {
    path: "/view-debit-note/:id",
    component: ViewDebitNote,
  },
  {
    path: "/create-debit-note",
    component: CreateDebitNote,
  },
  {
    path: "/create-debit-note",
    component: CreateDebitNote,
  },
  {
    path: "/vendor-invoices",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("vendorInvoice", "Vendor Invoices")}
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <VendorInvoices {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/vendor-payments",
    component: (props) => (
      <RouteActionGate
        title="Vendor Payment"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <VendorPayments {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/create-vendor-invoice",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("vendorInvoice", "Vendor Invoices")}
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <CreateVendorInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/view-vendor-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("vendorInvoice", "Vendor Invoices")}
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewVendorInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/update-vendor-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("vendorInvoice", "Vendor Invoices")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <UpdateVendorInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/edit-vendor-invoice/:id",
    component: (props) => (
      <RouteActionGate
        title={getModuleLabel("vendorInvoice", "Vendor Invoices")}
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <UpdateVendorInvoice {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/customer-payments",
    component: (props) => (
      <RouteActionGate
        title="Customer Payments"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CustomerPayments {...props} />
      </RouteActionGate>
    ),
  },

  {
    path: "/prepare-sales-contract",
    component: PrepareSaleContract,
  },
  {
    path: "/prepare-purchase-contract",
    component: PreparePurchaseContract,
  },
  // {
  //   path: "/customer-invoices",
  //   component: AccountsScreen,
  // },

  {
    path: "/email-preview",
    component: EmailPreview,
  },
  {
    path: "/products",
    component: (props) => (
      <RouteActionGate
        title="Products"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Products {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/New Customer",
    component: NewCustomerScreen,
  },
  {
    path: "/Edit Customer/:id",
    component: NewCustomerScreen,
  },
  // {
  //   path: "/Settings",
  //   component: settingsCategories,
  // },
  {
    path: "/New Vendor",
    component: (props) => (
      <RouteActionGate
        title="Vendors"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <NewVendorScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/Edit Vendor/:id",
    component: (props) => (
      <RouteActionGate
        title="Vendors"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <NewVendorScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/attributes",
    component: Attributes,
  },
  {
    path: "/items",
    component: (props) => (
      <RouteActionGate
        title="Items"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Items {...props} />
      </RouteActionGate>
    ),
  },
  /*
   * Bank reconciliation.
   *
   * These sit ahead of "/bank-management" and are marked exact because the router
   * is a v5 <Switch>: the first matching route wins, and "/bank-management" is
   * declared without `exact`, so it would otherwise swallow every URL below it.
   * Within this block, "new" and "status-report" precede the bare ":id" for the
   * same reason.
   */
  {
    path: "/bank-management/:accountId/reconciliations/new",
    exact: true,
    component: InitiateReconciliation,
  },
  {
    path: "/bank-management/:accountId/reconciliations/:id/edit",
    exact: true,
    component: InitiateReconciliation,
  },
  {
    path: "/bank-management/:accountId/reconciliations/:id/status-report",
    exact: true,
    component: ReconciliationStatusReport,
  },
  {
    path: "/bank-management/:accountId/reconciliations/:id/view",
    exact: true,
    component: ViewReconciliation,
  },
  {
    path: "/bank-management/:accountId/reconciliations/:id",
    exact: true,
    component: ReconciliationWorkspace,
  },
  {
    path: "/bank-management/:accountId/reconciliations",
    exact: true,
    component: BankReconciliations,
  },
  {
    path: "/ledger-coverage",
    exact: true,
    component: LedgerCoverageReport,
  },
  {
    path: "/provider-settlements",
    exact: true,
    component: ProviderSettlements,
  },
  {
    path: "/bank-management",
    component: BankManagement,
  },
  {
    path: "/add-account",
    component: AddAccount,
  },
  {
    path: "/edit-account/:id",
    component: EditAccount,
  },
  {
    path: "/bank-management",
    component: BankManagement,
  },
  {
    path: "/ledger-management",
    component: Ledgers,
  },
  {
    path: "/treasury-and-finance-dashboard",
    component: FinancialDashboard,
  },
  {
    path: "/add-ledger",
    component: AddLedger,
  },
  {
    path: "/chart-of-account/:id",
    component: EditChart,
  },
  {
    path: "/chart-of-accounts",
    component: ChartOfAccounts,
  },
  {
    path: "/add-new-account",
    component: AddChartAccount,
  },
  {
    path: "/bank-statements",
    component: BankStatements,
  },
  {
    path: "/Add New Item",
    component: (props) => (
      <RouteActionGate title="Items" requiredPermission={PERMISSION_ACTION.ADD}>
        <NewItemScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/edit-item/:id",
    component: (props) => (
      <RouteActionGate
        title="Items"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <EditItemScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/recipes",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Items"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Recipes {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/recipes/create",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Items"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <RecipeForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/recipes/edit/:id",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Items"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <RecipeForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/warehouses",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Warehouses"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Warehouses {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/warehouses/create",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Warehouses"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <WarehouseForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/warehouses/edit/:id",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Warehouses"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <WarehouseForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/locations",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Locations"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Locations {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/stock-levels",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Stock Levels"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StockLevels {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-adjustments",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Adjustments"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InventoryAdjustments {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-adjustments/create",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Adjustments"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <InventoryAdjustmentForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-adjustments/:id",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Adjustments"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InventoryAdjustmentForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/internal-transfers",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Internal Transfers"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InternalTransfers {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/internal-transfers/create",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Internal Transfers"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <InternalTransferForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/internal-transfers/:id",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Internal Transfers"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InternalTransferForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/goods-receipts",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Goods Receipts"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <GoodsReceipts {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/goods-receipts/create",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Goods Receipts"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <GoodsReceiptForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/goods-receipts/:id",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Goods Receipts"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <GoodsReceiptForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/stock-traceability",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Stock Traceability"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StockTraceability {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/stock-traceability/item/:itemId",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Stock Traceability"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StockTraceabilityItem {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/reordering-rules",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Reordering Rules"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ReorderingRules {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/reordering-rules/create",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Reordering Rules"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <ReorderingRuleForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/reordering-rules/:id",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Reordering Rules"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ReorderingRuleForm {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/pick-lists",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Pick Lists"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PickLists {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/expiry-alerts",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Expiry Alerts"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ExpiryAlerts {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-valuation",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Valuation"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InventoryValuation {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InventoryReports {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/current-stock",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CurrentStockReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/movements",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <ProductMovementReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/aging",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StockAgingReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/low-stock",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <LowStockReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/forecast",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <InventoryForecastReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/lots",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <LotSerialReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/inventory-reports/warehouse-performance",
    exact: true,
    component: (props) => (
      <RouteActionGate
        title="Inventory Reports"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <WarehousePerformanceReport {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/purchase-planning",
    component: (props) => (
      <RouteActionGate
        title="Items"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <PurchasePlanning {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/categories",
    component: (props) => (
      <RouteActionGate
        title="Categories"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Categories {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/Add New Category",
    component: (props) => (
      <RouteActionGate
        title="Categories"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <NewCategoryScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/edit-category/:id",
    component: (props) => (
      <RouteActionGate
        title="Categories"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <EditCategoryScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/tax-classes",
    component: (props) => (
      <RouteActionGate
        title="Tax Classes"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <TaxClasses {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/Add New Tax Class",
    component: (props) => (
      <RouteActionGate
        title="Tax Classes"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <NewTaxClassScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/edit-tax-class/:id",
    component: (props) => (
      <RouteActionGate
        title="Tax Classes"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <EditTaxClassScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/document-numbering",
    component: DocumentNumbering,
  },
  {
    path: "/Stock Groups",
    exact: true,
    component: () => <Redirect to="/stock-groups" />,
  },
  {
    path: "/New Stock Group",
    exact: true,
    component: () => <Redirect to="/new-stock-group" />,
  },
  {
    path: "/Edit Stock Group/:id",
    exact: true,
    component: ({ match }) => (
      <Redirect to={`/edit-stock-group/${match.params.id}`} />
    ),
  },
  {
    path: "/stock-groups",
    component: (props) => (
      <RouteActionGate
        title="Stock Groups"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <StockGroupListScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/new-stock-group",
    component: (props) => (
      <RouteActionGate
        title="Stock Groups"
        requiredPermission={PERMISSION_ACTION.ADD}
      >
        <NewStockGroupScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/edit-stock-group/:id",
    component: (props) => (
      <RouteActionGate
        title="Stock Groups"
        requiredPermission={PERMISSION_ACTION.UPDATE}
      >
        <EditStockGroupScreen {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/docs-management",
    component: DocsManagement,
  },
  {
    path: "/shared_with_me",
    component: SharedWithMe,
  },
  {
    path: "/recent",
    component: Recent,
  },
  {
    path: "/trash",
    component: Trash,
  },
  {
    path: "/home",
    component: Home,
  },
  {
    path: "/My-Hr",
    component: MyHr,
  },
  // Business Group
  {
    path: "/business-group",
    component: BusinessGroupListScreen,
  },
  {
    path: "/Add New Business Group",
    component: NewBusinessGroupScreen,
  },
  {
    path: "/Edit Business Group/:id",
    component: NewBusinessGroupScreen,
  },
  {
    path: "/View Business Group/:id",
    component: NewBusinessGroupScreen,
  },
  // Announcements
  {
    path: "/announcements",
    component: AnnouncementListScreen,
  },
  // Marketing Announcements (scheduled outbound messages — separate from announcements)
  {
    path: "/broadcasts",
    exact: true,
    component: BroadcastListScreen,
  },
  {
    path: "/broadcasts/:id/whatsapp-history",
    component: BroadcastWhatsappHistoryRedirect,
  },
  {
    path: "/broadcasts/:id",
    component: BroadcastDetailScreen,
  },
  {
    path: "/New Announcement",
    component: CreateAnnouncement,
  },
  {
    path: "/Edit Announcement/:id",
    component: CreateAnnouncement,
  },
  {
    path: "/View Announcement/:id",
    component: CreateAnnouncement,
  },
  {
    path: "/cheque_dashboard",
    component: ChequeDashboard,
  },
  {
    path: "/cheque_reporting",
    component: ChequeReportingPage,
  },
  {
    path: "/Cheques/dashboard",
    component: () => <Redirect to="/cheque_dashboard" />,
  },
  {
    path: "/Cheques/new",
    component: ChequeForm,
  },
  {
    path: "/Cheques/:id/edit",
    component: ChequeForm,
  },
  {
    path: "/Cheques/:id",
    component: ChequeDetail,
  },
  {
    path: "/Cheques",
    exact: true,
    component: ChequeListScreen,
  },
  {
    path: "/Add New Business",
    component: NewBusinessScreen,
  },
  {
    path: "/Edit Business/:id",
    component: NewBusinessScreen,
  },
  {
    path: "/View Business/:id",
    component: NewBusinessScreen,
  },
  {
    path: "/attributes/:id",
    component: ChildAttributes,
  },
  {
    path: "/product/:id",
    component: ProductDetails,
  },
  {
    path: "/categories",
    component: Category,
  },
  {
    path: "/languages",
    component: Languages,
  },
  {
    path: "/currencies",
    component: Currencies,
  },

  {
    path: "/categories/:id",
    component: ChildCategory,
  },
  {
    path: "/customers",
    component: (props) => (
      <RouteActionGate
        title="Customers"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Customers {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/viewCustomerDetails",
    component: (props) => (
      <RouteActionGate
        title="Customers"
        requiredPermission={PERMISSION_ACTION.VIEW_DETAILS}
      >
        <ViewCustomerDetails {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/Vendors",
    component: (props) => (
      <RouteActionGate
        title="Vendors"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <Vendor {...props} />
      </RouteActionGate>
    ),
  },

  {
    path: "/customer-order/:id",
    component: CustomerOrder,
  },
  {
    path: "/our-staff",
    component: Staff,
  },
  {
    path: "/business",
    component: Business,
  },

  {
    path: "/accounts",
    component: AccountsScreen,
  },

  {
    path: "/PrepareSaleContract",
    component: PrepareSaleContract,
  },
  {
    path: "/PreparePurchaseContract",
    component: PreparePurchaseContract,
  },
  {
    path: "/add-two-level-purchase-contract",
    component: AddTwoLevelPurchaseContract,
  },

  {
    path: "/viewBusinessDetails",
    component: viewBusinessDetails,
  },
  {
    path: "/calendar-events",
    component: (props) => (
      <RouteActionGate
        title="Calendar Events"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <CalendarEvents {...props} />
      </RouteActionGate>
    ),
  },
  {
    path: "/SystemUsers",
    component: SystemUsers,
  },
  {
    path: "/system-users/new",
    component: SystemUserForm,
  },
  {
    path: "/system-users/edit/:id",
    component: SystemUserForm,
  },
  {
    path: "/ActivityLogs",
    component: ActivityLogs,
  },
  {
    path: "/Modules",
    component: Modules,
  },
  {
    path: "/viewActivityLogsDetails",
    component: viewActivityLogsDetails,
  },
  {
    path: "/EmailLogs",
    component: EmailLogs,
  },
  {
    path: "/viewEmailLogsDetails",
    component: viewEmailLogsDetails,
  },
  {
    path: "/UserRoles",
    component: UserRoles,
  },
  {
    path: "/orders",
    component: Orders,
  },
  {
    path: "/order/:id",
    component: OrderInvoice,
  },
  {
    path: "/coupons",
    component: Coupons,
  },
  // Former top-gear All Settings hub — pages now live under System Settings.
  {
    path: "/settings",
    exact: true,
    component: () => <Redirect to="/Configuration" />,
  },
  {
    path: "/Settings",
    exact: true,
    component: () => <Redirect to="/Configuration" />,
  },
  {
    path: "/settings/application-documents",
    component: (props) => (
      <SettingsChildGuard>
        <ApplicationDocumentsPage {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/settings/application-fields",
    component: (props) => (
      <SettingsChildGuard>
        <ApplicationFieldsPage {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/settings/dynamic-forms",
    component: (props) => (
      <SettingsChildGuard>
        <DynamicFormsPage {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/settings/class-categories",
    component: (props) => (
      <SettingsChildGuard>
        <ClassCategoriesPage {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/Departments_Positions",
    component: (props) => (
      <SettingsChildGuard>
        <Departments_Positions {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/Branch_locations",
    component: (props) => (
      <SettingsChildGuard>
        <Branch_locations {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/Branch_Locations",
    component: (props) => (
      <SettingsChildGuard>
        <Branch_locations {...props} />
      </SettingsChildGuard>
    ),
  },
  {
    path: "/Sales_Misc_Data_Types",
    component: (props) => (
      <SettingsChildGuard>
        <Sales_Misc_Data_Types {...props} />
      </SettingsChildGuard>
    ),
  },

  { path: "/Configuration", component: Configuration },

  { path: "/ConfigTab", component: ConfigTab },

  { path: "/ConfigTab", component: TabEmailConfig },

  {
    path: "/document-sequencing",
    component: (props) => (
      <RouteActionGate
        title="Document Sequencing"
        requiredPermission={PERMISSION_ACTION.VIEW}
      >
        <TabDocumentNumbering {...props} />
      </RouteActionGate>
    ),
  },

  // { path: "/EmailTemplatesUI", component: EmailTemplatesUI },

  // { path: "/AddEmailTemplate", component: AddEmailTemplate },

  // { path: "/edit-template/:id", component: AddEmailTemplate },

  { path: "/EmailLog", component: EmailLog },

  { path: "/create-document-template", component: DocumentTemplateCreate },
  // { path: "/edit-document-template/:id", component: DocumentTemplateCreate },
  {
    path: "/edit-document-template/:templateId",
    component: DocumentTemplateCreate,
  },
  {
    path: "/edit-document-template/:templateId/:recordId",
    component: DocumentTemplateCreate,
  },

  {
    path: "/store/customization",
    component: StoreHome,
  },
  {
    path: "/store/store-settings",
    component: StoreSetting,
  },
  {
    path: "/404",
    component: Page404,
  },
  {
    path: "/coming-soon",
    component: ComingSoon,
  },
  // {
  //   path: "/edit-profile",
  //   component: EditProfile,
  // },

  {
    path: "/notifications",
    component: Notifications,
  },
  // Daily Reports - New Implementation (wrapped with DailyReportsGuard for Create-only redirect)
  {
    path: "/daily-reports",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          allowAnyOf={[
            PERMISSION_ACTION.VIEW,
            PERMISSION_ACTION.VIEW_OWN,
            PERMISSION_ACTION.ADD,
          ]}
        >
          <DailyReportsDashboard {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
    exact: true,
  },
  {
    path: "/daily-reports/dashboard",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          allowAnyOf={[
            PERMISSION_ACTION.VIEW,
            PERMISSION_ACTION.VIEW_OWN,
            PERMISSION_ACTION.ADD,
          ]}
        >
          <DailyReportsDashboard {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
  },
  {
    path: "/daily-reports/analytics",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          allowAnyOf={[
            PERMISSION_ACTION.VIEW,
            PERMISSION_ACTION.VIEW_OWN,
            PERMISSION_ACTION.ADD,
          ]}
        >
          <DailyReportsAnalytics {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
  },
  {
    path: "/daily-reports/",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          allowAnyOf={[
            PERMISSION_ACTION.VIEW,
            PERMISSION_ACTION.VIEW_OWN,
            PERMISSION_ACTION.ADD,
          ]}
        >
          <ShiftReportsList {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
    exact: true,
  },
  {
    path: "/daily-reports-collection",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          allowAnyOf={[
            PERMISSION_ACTION.VIEW,
            PERMISSION_ACTION.VIEW_OWN,
            PERMISSION_ACTION.ADD,
          ]}
        >
          <ShiftReportsList {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
    exact: true,
  },
  {
    path: "/daily-reports/create",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          requiredPermission={PERMISSION_ACTION.ADD}
        >
          <CreateShiftReport {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
  },
  {
    path: "/daily-reports/edit/:id",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          requiredPermission={PERMISSION_ACTION.UPDATE}
        >
          <CreateShiftReport {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
  },
  {
    path: "/daily-reports/view/:id",
    component: (props) => (
      <DailyReportsGuard>
        <RouteActionGate
          title="Daily Collection Report"
          allowAnyOf={[
            PERMISSION_ACTION.VIEW_DETAILS,
            PERMISSION_ACTION.VIEW_OWN,
            PERMISSION_ACTION.UPDATE,
          ]}
        >
          <ViewShiftReport {...props} />
        </RouteActionGate>
      </DailyReportsGuard>
    ),
  },
  // Legacy Daily Reports route (can be removed later)
  {
    path: "/daily-reports-old",
    component: DailyReports,
  },
  ];
}

export default buildAppRoutes;
