export const ACTION_BUTTON_TYPES = {
  VIEW: "view",
  EDIT: "edit",
  DELETE: "delete",
  APPROVE_ACCOUNTS: "approve_accounts",
  REQUEST_APPROVAL: "request_approval",
  APPROVE: "approve",
  /** Ask customer to modify & resubmit — not a rejection (Action Required). */
  REQUEST_MODIFICATION: "request_modification",
  REJECT: "reject",
  CHANGE_STATUS: "change_status",
  VIEW_PDF: "view_pdf",
  ASSIGN: "assign",
  GRAPH: "graph",
  WORKFLOW: "workflow",
  SWAP: "swap",
  DUPLICATE: "duplicate",
  HISTORY: "history",
  TWO_LEVEL: "two_level",
  SEND_EMAIL: "send_email",
  /** Enable/disable (e.g. referral code) — same swap-arrow icon as status change */
  TOGGLE_ACTIVE: "toggle_active",
  /** Increment a counter (e.g. +1 referral) */
  ADD_COUNT: "add_count",
  WHATSAPP_DELIVERY: "whatsapp_delivery",
  EXPORT: "export",
  CAMPAIGN_QR: "campaign_qr",
  RUN_CAMPAIGN: "run_campaign",
  /** Copy a shareable URL to clipboard */
  COPY_LINK: "copy_link",
  /** Generate / rotate an invitation or share link */
  GENERATE_LINK: "generate_link",
  /** Soft-deactivate (inactive) without deleting */
  DEACTIVATE: "deactivate",
  /** Create customer from enquiry (or similar convert actions) */
  CREATE_CUSTOMER: "create_customer",
  /** Convert enquiry into an application */
  CONVERT_TO_APPLICATION: "convert_to_application",
  /** Download a file / template */
  DOWNLOAD: "download",
  /** Upload a file / template */
  UPLOAD: "upload",
  /** Remove an uploaded file without deleting the parent record */
  REMOVE_FILE: "remove_file",
};
