/**
 * Every customer-portal URL lives under this prefix so the whole surface can be
 * whitelisted as public in one place (see `isTenantPublicRoute`).
 */
export const CUSTOMER_BASE = "/customer";

export const customerPath = {
  base: CUSTOMER_BASE,
  login: `${CUSTOMER_BASE}/login`,
  register: `${CUSTOMER_BASE}/register`,
  forgotPassword: `${CUSTOMER_BASE}/forgot-password`,
  resetPassword: `${CUSTOMER_BASE}/reset-password`,
  verifyOtp: `${CUSTOMER_BASE}/verify-otp`,
  enquiry: `${CUSTOMER_BASE}/enquiry`,
  dashboard: `${CUSTOMER_BASE}/dashboard`,

  // Enquiries module
  enquiries: `${CUSTOMER_BASE}/enquiries`,
  enquiriesNew: `${CUSTOMER_BASE}/enquiries/new`,

  // Applications module
  applications: `${CUSTOMER_BASE}/applications`,
  applicationsNew: `${CUSTOMER_BASE}/applications/new`,

  // Quotations module
  quotation: `${CUSTOMER_BASE}/quotation`,

  // Profile
  profile: `${CUSTOMER_BASE}/profile`,
};

export default customerPath;
