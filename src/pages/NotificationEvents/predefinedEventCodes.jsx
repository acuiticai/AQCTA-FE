import { getModuleLabel } from "@/utils/moduleLabels";

export const getPredefinedEventCodes = () => {
  const saleOrderLabel = getModuleLabel("saleOrder", "Sale Order");
  const saleOrderLabelPlural = `${saleOrderLabel}s`;

  return [
  // Customer invoices (standard add/update — not proforma or commercial document types)
  {
    value: "CUSTOMER_INVOICE_CREATED",
    label: "Customer Invoice Created",
    category: "Customer Invoices",
  },
  {
    value: "CUSTOMER_INVOICE_UPDATED",
    label: "Customer Invoice Updated",
    category: "Customer Invoices",
  },

  // Sales orders
  {
    value: "SALES_ORDER_CREATED",
    label: `${saleOrderLabel} Created`,
    category: saleOrderLabelPlural,
  },
  {
    value: "SALES_ORDER_UPDATED",
    label: `${saleOrderLabel} Updated`,
    category: saleOrderLabelPlural,
  },
  {
    value: "SALES_ORDER_CONFIRMED",
    label: `${saleOrderLabel} Confirmed`,
    category: saleOrderLabelPlural,
  },

  // Recurring invoices
  {
    value: "RECURRING_INVOICE_CREATED",
    label: "Recurring Invoice Schedule Created",
    category: "Recurring Invoices",
  },
  {
    value: "RECURRING_INVOICE_UPDATED",
    label: "Recurring Invoice Schedule Updated",
    category: "Recurring Invoices",
  },
  {
    value: "RECURRING_INVOICE_RUN",
    label: "Recurring Invoice Generated (Run)",
    category: "Recurring Invoices",
  },

  // Purchase orders
  {
    value: "PURCHASE_ORDER_CREATED",
    label: "Purchase Order Created",
    category: "Purchase Orders",
  },
  {
    value: "PURCHASE_ORDER_UPDATED",
    label: "Purchase Order Updated",
    category: "Purchase Orders",
  },
  {
    value: "PURCHASE_ORDER_SUBMITTED",
    label: "Purchase Order Submitted for Approval",
    category: "Purchase Orders",
  },

  // Purchase / vendor invoices (accounts payable)
  {
    value: "PURCHASE_INVOICE_CREATED",
    label: "Purchase Invoice Created",
    category: "Purchase Invoices",
  },
  {
    value: "PURCHASE_INVOICE_UPDATED",
    label: "Purchase Invoice Updated",
    category: "Purchase Invoices",
  },
  {
    value: "PURCHASE_INVOICE_APPROVAL_REQUIRED",
    label: "Purchase Invoice Approval Required",
    category: "Purchase Invoices",
  },

  // Payment Events
  {
    value: "PAYMENT_RECEIVED",
    label: "Payment Received",
    category: "Payment",
  },
  { value: "PAYMENT_DUE", label: "Payment Due", category: "Payment" },
  { value: "PAYMENT_OVERDUE", label: "Payment Overdue", category: "Payment" },

  // System Events
  {
    value: "SYSTEM_MAINTENANCE",
    label: "System Maintenance",
    category: "System",
  },
  { value: "SYSTEM_UPDATE", label: "System Update", category: "System" },
  { value: "SYSTEM_DELETE", label: "System Delete", category: "System" },

  // Announcement
  { value: "ANNOUNCEMENT", label: "Announcement", category: "Announcement" },
  // Claims Events
  { value: "CLAIM_APPROVED", label: "Claim Approved", category: "Claims" },
  { value: "CLAIM_REJECTED", label: "Claim Rejected", category: "Claims" },

  {
    value: "CLAIM_ADMIN_APPROVAL",
    label: "Claim Admin/HR Approval",
    category: "Claims",
  },
  {
    value: "CLAIM_MANAGEMENT_APPROVAL",
    label: "Claim Management Approval",
    category: "Claims",
  },
  { value: "LEAVE_APPROVED", label: "Leave Approved", category: "Leaves" },
  { value: "LEAVE_REJECTED", label: "Leave Rejected", category: "Leaves" },
  {
    value: "LEAVE_ADMIN_APPROVAL",
    label: "Leave Admin/HR Approval",
    category: "Leaves",
  },
  {
    value: "LEAVE_MANAGEMENT_APPROVAL",
    label: "Leave Management Approval",
    category: "Leaves",
  },
  {
    value: "MANAGEMENT_APPROVAL",
    label: "Management Approval",
    category: "Management",
  },
  { value: "WFH_APPLIED", label: "WFH Applied", category: "WFH" },
  { value: "WFH_APPROVED", label: "WFH Approved", category: "WFH" },
  { value: "WFH_REJECTED", label: "WFH Rejected", category: "WFH" },

  {
    value: "EVENT_CREATED",
    label: "Event Created",
    category: "Event Management",
  },
  {
    value: "EVENT_TASK_CREATED",
    label: "Event Task Created",
    category: "Event Management",
  },
  {
    value: "RIDER_CAMPAIGN_APPLICATION_SUBMITTED",
    label: "Rider Campaign Application Submitted",
    category: "Rider",
  },
  {
    value: "RIDER_PAYMENT_COMPLETED",
    label: "Rider Payment Completed",
    category: "Rider",
  },
  {
    value: "DEBIT_NOTE_APPROVAL_REQUIRED",
    label: "Debit Note Approval Required",
    category: "Debit Note",
  },
  {
    value: "CREDIT_NOTE_APPROVAL_REQUIRED",
    label: "Credit Note Approval Required",
    category: "Credit Note",
  },
  {
    value: "CREDIT_NOTE_AUTOMATICALLY_APPROVED",
    label: "Credit Note Automatically Approved, need to prepare payment",
    category: "Credit Note",
  },
  {
    value: "CREDIT_NOTE_APPLIED_TO_INVOICE",
    label: "Credit Note Applied to Invoice",
    category: "Credit Note",
  },
  {
    value: "CREDIT_NOTE_APPROVED_BY_MANAGEMENT",
    label: "Credit Note Approved by Management, need to prepare payment",
    category: "Credit Note",
  },
  {
    value: "CREDIT_NOTE_MAKE_TRANSACTION",
    label: "Credit Note Make Transaction, need to prepare payment",
    category: "Credit Note",
  },
  {
    value: "CREDIT_NOTE_APPROVE_TRANSACTION",
    label: "Credit Note Approve Transaction, payment completed",
    category: "Credit Note",
  },

  // Expenses Events
  {
    value: "STAFF_CLAIM_CREATED_BY_ACCOUNTS",
    label: "Staff Claim Created by Accounts, Management Approval Required",
    category: "Expenses",
  },
  {
    value: "EXPENSE_CREATED",
    label: "Expense Created, Management Approval Required",
    category: "Expenses",
  },
  {
    value: "EXPENSE_APPROVED_BY_MANAGEMENT",
    label: "Expense Approved by Management, need to prepare payment",
    category: "Expenses",
  },
  {
    value: "EXPENSE_MAKE_TRANSACTION",
    label: "Expense Make Transaction, need to prepare payment",
    category: "Expenses",
  },
  {
    value: "EXPENSE_APPROVE_TRANSACTION",
    label: "Expense Approve Transaction, payment completed",
    category: "Expenses",
  },

  // Vendor invoice events (legacy codes — still used in some flows)
  {
    value: "VENDOR_INVOICE_CREATED",
    label: "Vendor Invoice Created, Management Approval Required",
    category: "Vendor Invoice",
  },
  {
    value: "VENDOR_INVOICE_APPROVED_BY_MANAGEMENT",
    label: "Vendor Invoice Approved by Management, need to prepare payment",
    category: "Vendor Invoice",
  },
  {
    value: "VENDOR_INVOICE_AUTOMATICALLY_APPROVED",
    label: "Vendor Invoice Automatically Approved, need to prepare payment",
    category: "Vendor Invoice",
  },
  {
    value: "VENDOR_INVOICE_MAKE_TRANSACTION",
    label: "Vendor Invoice Make Transaction, need to prepare payment",
    category: "Vendor Invoice",
  },
  {
    value: "VENDOR_INVOICE_APPROVE_TRANSACTION",
    label: "Vendor Invoice Approve Transaction, payment completed",
    category: "Vendor Invoice",
  },

  //Money changer events
  {
    value: "MONEY_CHANGER_REQUEST_GENERATED",
    label: "Money Changer Request Generated",
    category: "Money Changer",
  },
  {
    value: "MONEY_CHANGER_REQUEST_UPDATED",
    label: "Need to schedule collection details",
    category: "Money Changer",
  },
  {
    value: "MONEY_CHANGER_SCHEDULED",
    label: "Money Changer Scheduled",
    category: "Money Changer",
  },
  // Operations Events
  {
    value: "RFQ_CREATED",
    label: "RFQ Created",
    category: "Operations",
  },

  {
    value: "NOTIFY_ADMIN_ON_RFQ_CREATION",
    label: "Notify Admin on RFQ Creation",
    category: "Operations",
  },

  {
    value: "ON_QUOTATION_APPROVED",
    label: "On Quotation Approved",
    category: "Operations",
  },
  {
    value: "On_QUOTATION_UPDATE",
    label: "On Quotation Update",
    category: "Operations",
  },
  {
    value: "ON_QUOTATION_BOOKING_CONFIRMATION_PROVIDED",
    label: "On Quotation Booking Confirmation Provided",
    category: "Operations",
  },
  {
    value: "ON_LSP_PROVIDE_QUOTATION",
    label: "On LSP Provide Quotation",
    category: "Operations",
  },
  {
    value: "NOTIFY_LSP_ON_PROVIDING_QUOTATION",
    label: "Notify LSP on Providing Quotation",
    category: "Operations",
  },
  {
    value: "ON_ADDING_ADMIN_PROVIDED_QUOTATION",
    label: "On Adding Admin Provided Quotation",
    category: "Operations",
  },
  {
    value: "SHIPMENT_BOOKING_CONFIRMATION",
    label: "Shipment Booking Confirmation",
    category: "Operations",
  },
  {
    value: "CONNECT_LSP_WITH_SUPPLIER",
    label: "Connect LSP with Supplier",
    category: "Operations",
  },
  {
    value: "CONNECT_SUPPLIER_WITH_LSP",
    label: "Connect Supplier with LSP",
    category: "Operations",
  },
  {
    value: "SHIPMENT_SAILING_REMINDER",
    label: "Shipment Sailing Reminder",
    category: "Operations",
  },
  // Cheques (accounts payable)
  {
    value: "CHEQUE_PAYMENT_REMINDER",
    label: "Cheque Payment Reminder",
    category: "Cheques",
  },
  {
    value: "CHEQUE_DUE_SOON",
    label: "Cheque Due Soon",
    category: "Cheques",
  },
  {
    value: "CHEQUE_STATUS_CHANGED",
    label: "Cheque Status Changed",
    category: "Cheques",
  },

  // Marketing announcements (broadcasts)
  {
    value: "MARKETING_ANNOUNCEMENT_EMAIL",
    label: "Marketing Announcement Email",
    category: "Marketing Announcements",
  },

  //payroll
  {
    value: "PAYROLL_REMINDER",
    label: "Payroll Execution Reminder",
    category: "Payroll",
  },

  // Inventory
  {
    value: "REORDERING_RULE_ALERT",
    label: "Reordering Rule / Low Stock Alert",
    category: "Inventory",
  },
  {
    value: "STOCK_EXPIRY_ALERT",
    label: "Stock Expiry / Batch Expiry Alert",
    category: "Inventory",
  },
  {
    value: "STOCK_GRN_CONFIRMED",
    label: "Goods Receipt Confirmed",
    category: "Inventory",
  },
  {
    value: "STOCK_GRN_REVERSED",
    label: "Goods Receipt Reversed",
    category: "Inventory",
  },
  {
    value: "STOCK_PICK_LIST_CREATED",
    label: "Pick List Created",
    category: "Inventory",
  },
  {
    value: "STOCK_TRANSFER_DONE",
    label: "Internal Transfer Validated",
    category: "Inventory",
  },
  {
    value: "STOCK_ADJUSTMENT_DONE",
    label: "Inventory Adjustment Validated",
    category: "Inventory",
  },

  // HR / Attendance
  {
    value: "VISA_EXPIRY_ALERT",
    label: "Work Pass / Visa Expiry Alert",
    category: "HR & Attendance",
  },
  {
    value: "ATTENDANCE_CHECKIN_CHECKOUT_ALERT",
    label: "Attendance Check-in / Check-out Alert",
    category: "HR & Attendance",
  },
  {
    value: "ATTENDANCE_CHECKIN_SNAPSHOT_REPORT",
    label: "Shift Check-in Snapshot Report",
    category: "HR & Attendance",
  },
  {
    value: "ATTENDANCE_SHIFT_REPORT",
    label: "Shift Attendance Report",
    category: "HR & Attendance",
  },
  {
    value: "STAFF_BIRTHDAY_GREETING",
    label: "Staff Birthday Greeting",
    category: "HR & Attendance",
  },
  {
    value: "POS_NEW_SALE_ORDER_RECEIVED",
    label: `POS New ${saleOrderLabel} Received`,
    category: "Sales",
  },
  {
    value: "ENQUIRY_SUBMITTED",
    label: "Enquiry Submitted",
    category: "Enquiry",
  },
  {
    value: "CUSTOMER_CREATED_FROM_ENQUIRY",
    label: "Customer Created from Enquiry",
    category: "Enquiry",
  },
  {
    value: "ENQUIRY_STATUS_CHANGED",
    label: "Enquiry Status Updated",
    category: "Enquiry",
  },
  {
    value: "ENQUIRY_CONVERTED_VIA_APPLICATION",
    label: "Enquiry Converted via Application",
    category: "Enquiry",
  },
  {
    value: "APPLICATION_SUBMITTED",
    label: "Application Submitted",
    category: "Application",
  },
  {
    value: "APPLICATION_RESUBMITTED",
    label: "Application Resubmitted",
    category: "Application",
  },
  {
    value: "APPLICATION_APPROVED",
    label: "Application Approved",
    category: "Application",
  },
  {
    value: "APPLICATION_REJECTED",
    label: "Application Rejected",
    category: "Application",
  },
  {
    value: "APPLICATION_ACTION_REQUIRED",
    label: "Application — Modification Requested",
    category: "Application",
  },
  {
    value: "APPLICATION_ASSIGNED",
    label: "Application Assigned",
    category: "Application",
  },
  {
    value: "APPLICATION_STATUS_CHANGED",
    label: "Application Status Updated",
    category: "Application",
  },
];
};