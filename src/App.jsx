import React, { lazy, useEffect, useContext, useState } from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
  useLocation,
} from "react-router-dom";
import AccessibleNavigationAnnouncer from "@/components/AccessibleNavigationAnnouncer";
import PrivateRoute from "@/components/login/PrivateRoute";
import { withSettingsChildGuard } from "@/components/SettingsChildGuard";

const SG = withSettingsChildGuard;
import VersionUpdateModal from "@/components/VersionUpdateModal";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import {
  messaging,
  getToken,
  onMessage,
  initializeMessaging,
} from "./firebase-config";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminContext } from "@/context/AdminContext";
import { fetchConfiguration } from "./components/formatAmount";
import DynamicPageTitle from "@/components/common/DynamicPageTitle";
import Cookies from "js-cookie";
import { useHistory } from "react-router-dom";
import Login from "@/pages/Login";
import notificationService from "@/services/notificationService.jsx";
import notificationSound from "@/utils/notificationSound";
import { handleNotificationPermission } from "@/utils/generic";
import { ModuleLabelsProvider } from "@/context/ModuleLabelsContext";
import {
  hostnameRequiresTenantCheck,
  isTenantPublicRoute,
  getInitialTenantGate,
  isUserAuthorizedForCurrentTenant,
} from "@/utils/tenantHost";
import { isOnboardingRoute } from "@/utils/subscriptionRedirect";
import { ensurePublicEmailConfigLoaded } from "@/services/publicConfigService";
import useSyncBrowserHistory from "@/hooks/useSyncBrowserHistory";
const Layout = lazy(() => import("@/layout/Layout"));
const User_Login = lazy(() => import("@/pages/User_Login"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const ForgetPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const OtpVerification = lazy(() => import("@/pages/OtpVerification"));
const Reset = lazy(() => import("@/pages/Reset"));
const SelfRegister = lazy(() => import("@/pages/onboarding/Register"));
// AQCTA Customer Portal (public, separate branding — see src/customer)
const CustomerRoutes = lazy(() => import("@/customer/routes/CustomerRoutes"));
const VerifyEmailOnboarding = lazy(() => import("@/pages/onboarding/VerifyEmail"));
const SetPasswordOnboarding = lazy(() => import("@/pages/onboarding/SetPassword"));
const ModuleSelection = lazy(() => import("@/pages/onboarding/ModuleSelection"));
const PricingPlans = lazy(() => import("@/pages/onboarding/PricingPlans"));
const RegistrationSubmitted = lazy(() =>
  import("@/pages/onboarding/RegistrationSubmitted"),
);
const WaitingForInvitation = lazy(() =>
  import("@/pages/onboarding/WaitingForInvitation"),
);
const InvitationLanding = lazy(() =>
  import("@/pages/onboarding/InvitationLanding"),
);
const PaymentSuccess = lazy(() => import("@/pages/onboarding/PaymentSuccess"));
const EditProfile = lazy(() => import("@/pages/EditProfile"));
const UploadSign = lazy(() => import("@/pages/DocumentTemplate/UploadSign"));
const UploadPurchaseSign = lazy(
  () => import("@/pages/DocumentTemplate/UploadPurchaseSign"),
);
const EmailTemplatesUI = lazy(() => import("@/pages/EmailPage/EmailTemplate"));
const AddEmailTemplate = lazy(
  () => import("@/pages/EmailPage/AddEmailTemplate"),
);

const PosSettings = lazy(() => import("@/pages/POS/PosSettings"));
const Item_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/items/Item_Misc_Data_Types"),
);
// const NewCustomerScreen = lazy(() => import("@/pages/Customer/NewCustomerScreen"))
const CustomFieldsSettings = lazy(
  () => import("@/pages/Settings/CustomFieldsSettings"),
);
const ModuleLabelsSettings = lazy(
  () => import("@/pages/Settings/documents/ModuleLabels"),
);
const Purchase_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/purchase/Purchase_Misc_Data_Types"),
);
const Foreign_Worker_Management = lazy(
  () => import("@/pages/Settings/HR/Foreign_Worker_Management"),
);

const Shifts = lazy(() => import("@/pages/Settings/HR/Shifts"));
const Channels = lazy(() => import("@/pages/Settings/HR/Channels"));
const PaymentMethods = lazy(() => import("@/pages/Settings/HR/PaymentMethods"));
const TransactionTypes = lazy(
  () => import("@/pages/Settings/HR/TransactionTypes"),
);
const AdvanceTypes = lazy(() => import("@/pages/Settings/HR/AdvanceTypes"));
const PublicHolidays = lazy(() => import("@/pages/Settings/HR/PublicHolidays"));
const WFHSetting = lazy(() => import("@/pages/Settings/HR/WFHSettings"));
const WFHGroup = lazy(() => import("@/pages/Settings/HR/WFHGroup"));

const Leaves = lazy(() => import("@/pages/Settings/HR/Leaves"));

const Reminders = lazy(() => import("@/pages/Reminders/Reminders.jsx"));
const ChequeReminders = lazy(
  () => import("@/pages/ChequeReminders/ChequeReminders.jsx"),
);
const TaxList = lazy(() => import("@/components/taxes/TaxList"));
const TaxForm = lazy(() => import("@/components/taxes/TaxForm"));

const Claims = lazy(() => import("@/pages/Settings/HR/claims/Claims"));
const VendorInvoiceApproval = lazy(
  () => import("@/components/VendorInvoiceApproval/VendorInvoiceApproval"),
);
const SpecialTransfersTypes = lazy(
  () => import("@/components/SpecialTransfersTypes/SpecialTransfersTypes"),
);
const CreditNotesApproval = lazy(
  () => import("@/components/CreditNotes/CreditNotesApproval"),
);
const EInvoiceSettingsPage = lazy(
  () => import("@/pages/Accounts/EInvoiceSettings/EInvoiceSettingsPage"),
);
const ServiceMonsterSettingsPage = lazy(
  () =>
    import("@/pages/Accounts/ServiceMonsterSettings/ServiceMonsterSettingsPage"),
);
const ZohoBooksSettingsPage = lazy(
  () => import("@/pages/Accounts/ZohoBooksSettings/ZohoBooksSettingsPage"),
);
const WhatsAppIntegrationSettingsPage = lazy(
  () =>
    import("@/pages/Accounts/WhatsAppIntegration/WhatsAppIntegrationSettingsPage"),
);
const ClinikoManagePage = lazy(
  () => import("@/pages/Settings/Integrations/ClinikoManagePage"),
);

const DocumentManagement = lazy(
  () => import("@/pages/Settings/HR/documentTypes/DocumentManagement"),
);

// Payroll Settings
const PayElements = lazy(
  () => import("@/pages/Settings/HR/Payroll/PayElements"),
);
const PayrollCompanySettings = lazy(
  () => import("@/pages/Settings/HR/Payroll/PayrollSettings"),
);
const StatutorySettings = lazy(
  () => import("@/pages/Settings/HR/Payroll/StatutorySettings"),
);
const PayGroups = lazy(() => import("@/pages/Settings/HR/Payroll/PayGroups"));

const Miscellanious_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/miscellanious/Miscellanious_Misc_Data_Types"),
);
const Operations_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/operations/Operations_Misc_Data_Types"),
);
const FleetJobSchedulingSettings = lazy(
  () => import("@/pages/Settings/operations/FleetJobSchedulingSettings"),
);
const Documents_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/documents/Documents_Misc_Data_Types"),
);
const Finance_Misc_Data_Types = lazy(
  () => import("@/pages/Settings/finance/Finance_Misc_Data_Types"),
);
const Currency = lazy(() => import("@/pages/Settings/finance/CurrencyTab"));
const AccountTypes = lazy(
  () => import("@/pages/Settings/TreasuryAndFinance/AccountTypes"),
);
const BankAccountTypes = lazy(
  () => import("@/pages/Settings/TreasuryAndFinance/BankAccountTypes"),
);
const BankAccountMapping = lazy(
  () => import("@/pages/Settings/TreasuryAndFinance/BankAccountMapping"),
);
const DocumentTemplate = lazy(
  () => import("@/pages/DocumentTemplate/DocumentTemplate"),
);
const PrivacyPolicyPublic = lazy(
  () => import("@/pages/PrivacyPolicy/PrivacyPolicyPublic"),
);
const SupportPublic = lazy(() => import("@/pages/Support/SupportPublic"));
const QrOrderPage = lazy(() => import("@/pages/QrOrder/QrOrderPage"));
const CampaignPublicSignupPage = lazy(() =>
  import("@/pages/Broadcasts/CampaignPublicSignupPage"),
);

const InvalidTenantScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">
        This URL is not valid
      </h1>
      <p className="text-gray-600 text-sm leading-relaxed">
        The site address does not match an active organization. Check the link
        or contact your administrator.
      </p>
    </div>
  </div>
);

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const App = () => {
  const [tenantGate, setTenantGate] = useState(getInitialTenantGate);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hostnameRequiresTenantCheck(window.location.hostname)) {
      setTenantGate({ ready: true, invalid: false });
      return;
    }

    const base = Base_URL ? String(Base_URL).replace(/\/$/, "") : "";
    const url = base ? `${base}/api/configuration` : "/api/configuration";

    let cancelled = false;
    axios
      .get(url, { validateStatus: (s) => s >= 200 && s < 600 })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 403) {
          setTenantGate({ ready: true, invalid: true });
          return;
        }
        setTenantGate({ ready: true, invalid: false });
      })
      .catch(() => {
        if (!cancelled) setTenantGate({ ready: true, invalid: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    ensurePublicEmailConfigLoaded().catch(() => {
      // Individual email screens surface errors via useEmailDefaults.
    });
  }, []);

  return (
    <Router>
      <ModuleLabelsProvider>
        <AppShell tenantGate={tenantGate} />
      </ModuleLabelsProvider>
    </Router>
  );
};

function AppShell({ tenantGate }) {
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const location = useLocation();
  useSyncBrowserHistory();
  const { showUpdateModal, newVersion, dismissUpdate } = useVersionCheck();
  const needsTenantGate =
    typeof window !== "undefined" &&
    hostnameRequiresTenantCheck(window.location.hostname);
  const publicAllowed = isTenantPublicRoute(location.pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!adminInfo) return;
    if (!hostnameRequiresTenantCheck(window.location.hostname)) return;
    if (isUserAuthorizedForCurrentTenant(adminInfo, window.location.hostname)) {
      return;
    }

    dispatch({ type: "USER_LOGOUT" });
    toast.error("You are not authorized for this business group.");
    history.replace("/login");
  }, [adminInfo, dispatch, history]);

  useEffect(() => {
    if (!tenantGate.ready || tenantGate.invalid) return;

    // Proactively request notification permission on page load
    const requestNotificationPermission = async () => {
      if ("Notification" in window && Notification.permission === "default") {
        try {
          const permission = await Notification.requestPermission();
          console.log("🔔 Initial permission request result:", permission);
        } catch (error) {
          console.error("❌ Error requesting notification permission:", error);
        }
      }
    };

    // Request permission immediately
    requestNotificationPermission();

    // Also request permission on first user interaction
    const handleUserInteraction = async () => {
      if ("Notification" in window && Notification.permission === "default") {
        try {
          const permission = await Notification.requestPermission();
          console.log(
            "🔔 User interaction permission request result:",
            permission,
          );

          // Remove the event listeners after first interaction
          document.removeEventListener("click", handleUserInteraction);
          document.removeEventListener("keydown", handleUserInteraction);
          document.removeEventListener("scroll", handleUserInteraction);
        } catch (error) {
          console.error(
            "❌ Error requesting notification permission on interaction:",
            error,
          );
        }
      }
    };

    // Add event listeners for user interaction
    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true });
    document.addEventListener("scroll", handleUserInteraction, { once: true });

    const getFCMToken = async () => {
      try {
        // Check if service worker is supported
        if (!("serviceWorker" in navigator)) {
          console.warn("⚠️ Service Worker not supported in this browser");
          return;
        }

        // Register service worker with correct scope
        const swReg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          {
            scope: "/firebase-cloud-messaging-push-scope",
          },
        );

        console.log("✅ Service worker registered with correct scope:", swReg);

        if (!adminInfo?.token) {
          // Keep public onboarding routes (register, verify-email, set-password) usable
          // without forcing a redirect to /login.
          if (
            isTenantPublicRoute(location.pathname) ||
            isOnboardingRoute(location.pathname)
          ) {
            return;
          }
          dispatch({ type: "USER_LOGOUT" });
          Cookies?.remove("adminInfo");
          history?.push("/login");
          return;
        }

        // Use the common notification permission handler
        await handleNotificationPermission({
          serviceWorkerRegistration: swReg,
          onTokenReceived: async (token) => {
            if (token) {
              await axios.post(`${Base_URL}/admin/save-token`, {
                _id: adminInfo?.id,
                token,
              });
            } else {
              console.warn(
                "⚠️ No FCM token received - user may have denied permission",
              );
            }
          },
          retryFunction: getFCMToken,
        });
      } catch (error) {
        console.error("❌ Error in getFCMToken:", error);
        // Don't throw the error - just log it and continue
      }
    };

    getFCMToken();

    // Listen for messages only if messaging is available
    const setupMessageListener = async () => {
      try {
        const messagingInstance = await initializeMessaging();
        if (messagingInstance) {
          onMessage(messagingInstance, (payload) => {
            console.log("Message received: ", payload);

            const title = payload.notification?.title || "New Notification";
            const body =
              payload.notification?.body || "You have a new notification";
            const data = payload.data || {};

            // Show toast notification with navigation support (includes sound)
            notificationService.showNotification(title, body, data);
          });
        }
      } catch (error) {
        console.error("❌ Error setting up message listener:", error);
      }
    };

    setupMessageListener();
  }, [tenantGate.ready, tenantGate.invalid, adminInfo?.token, location.pathname]);

  useEffect(() => {
    if (!tenantGate.ready || tenantGate.invalid) return;
    fetchConfiguration(adminInfo?.token);
  }, [tenantGate.ready, tenantGate.invalid, adminInfo?.token]);

  if (needsTenantGate && !tenantGate.ready && !publicAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (needsTenantGate && tenantGate.invalid) {
    return <InvalidTenantScreen />;
  }

  return (
    <>
      <VersionUpdateModal
        isOpen={showUpdateModal}
        onLater={dismissUpdate}
        newVersion={newVersion}
      />
      <ToastContainer
        position="top-right"
        autoClose={6000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ zIndex: 99999 }}
      />
      <DynamicPageTitle />
      <AccessibleNavigationAnnouncer />
      <Switch>
        <Route
          path="/settings/custom-fields"
          component={SG(CustomFieldsSettings)}
        />
        <Route
          path="/settings/module-labels"
          component={SG(ModuleLabelsSettings)}
        />
        <Route path="/pos/settings" component={SG(PosSettings)} />
        <Route path="/Item_Misc_Data_Types" component={SG(Item_Misc_Data_Types)} />
        <Route
          path="/Purchase_Misc_Data_Types"
          component={SG(Purchase_Misc_Data_Types)}
        />
        <Route
          path="/Foreign_Worker_Management"
          component={SG(Foreign_Worker_Management)}
        />

        <Route path="/Shifts" component={SG(Shifts)} />
        <Route path="/Channels" component={SG(Channels)} />
        <Route path="/PaymentMethods" component={SG(PaymentMethods)} />
        <Route path="/TransactionTypes" component={SG(TransactionTypes)} />
        <Route path="/AdvanceTypes" component={SG(AdvanceTypes)} />
        <Route path="/PublicHolidays" component={SG(PublicHolidays)} />
        <Route path="/WFHSettings" component={SG(WFHSetting)} />
        <Route path="/WFHGroups" component={SG(WFHGroup)} />
        <Route path="/Leaves" component={SG(Leaves)} />
        <Route path="/claims" component={SG(Claims)} />
        <Route path="/document-types" component={SG(DocumentManagement)} />
        <Route
          path="/Miscellanious_Misc_Data_Types"
          component={SG(Miscellanious_Misc_Data_Types)}
        />
        <Route path="/payroll-pay-elements" component={SG(PayElements)} />
        <Route
          path="/payroll-company-settings"
          component={SG(PayrollCompanySettings)}
        />
        <Route
          path="/payroll-statutory-settings"
          component={SG(StatutorySettings)}
        />
        <Route path="/payroll-pay-groups" component={SG(PayGroups)} />

        <Route path="/account-types" component={SG(AccountTypes)} />
        <Route path="/bank-account-types" component={SG(BankAccountTypes)} />
        <Route path="/bank-account-mapping" component={SG(BankAccountMapping)} />

        <Route
          path="/accounts/e-invoice-settings"
          component={SG(EInvoiceSettingsPage)}
        />
        <Route
          path="/accounts/service-monster"
          component={SG(ServiceMonsterSettingsPage)}
        />
        <Route path="/accounts/zoho-books" component={SG(ZohoBooksSettingsPage)} />
        <Route
          path="/accounts/whatsapp-integration"
          component={SG(WhatsAppIntegrationSettingsPage)}
        />
        <Route
          exact
          path="/settings/integrations/cliniko"
          component={SG(ClinikoManagePage)}
        />
        <Route
          exact
          path="/settings/integrations"
          render={({ location }) => (
            <Redirect to={`/Configuration${location.search || ""}`} />
          )}
        />
        <Route path="/reminders" component={SG(Reminders)} />
        <Route path="/cheque-reminders" component={SG(ChequeReminders)} />
        <Route path="/taxes/new" component={SG(TaxForm)} />
        <Route path="/taxes/edit/:id" component={SG(TaxForm)} />
        <Route path="/taxes" component={SG(TaxList)} />

        <Route
          path="/vendor-invoice-approval"
          component={SG(VendorInvoiceApproval)}
        />
        <Route
          path="/special-transfers-types"
          component={SG(SpecialTransfersTypes)}
        />
        <Route path="/credit-notes-approval" component={SG(CreditNotesApproval)} />

        <Route path="/EmailTemplatesUI" component={SG(EmailTemplatesUI)} />
        <Route path="/sign-contract/:id" component={UploadSign} />
        <Route
          path="/sign-purchase-contract/:id"
          component={UploadPurchaseSign}
        />
        <Route path="/AddEmailTemplate" component={AddEmailTemplate} />

        <Route path="/edit-template/:id" component={AddEmailTemplate} />

        <Route path="/edit-profile" component={EditProfile} />
        <Route
          path="/Operations_Misc_Data_Types"
          component={SG(Operations_Misc_Data_Types)}
        />
        <Route
          path="/fleet-job-scheduling-settings"
          component={SG(FleetJobSchedulingSettings)}
        />
        <Route
          path="/Documents_Misc_Data_Types"
          component={SG(Documents_Misc_Data_Types)}
        />
        <Route
          path="/Finance_Misc_Data_Types"
          component={SG(Finance_Misc_Data_Types)}
        />
        <Route path="/Currency" component={SG(Currency)} />
        <Route path="/document_templates" component={SG(DocumentTemplate)} />

        <Route path="/login" component={Login} />
        <Route path="/register" component={SelfRegister} />
        <Route path="/verify-email" component={VerifyEmailOnboarding} />
        <Route path="/set-password" component={SetPasswordOnboarding} />
        <Route path="/onboarding/modules" component={ModuleSelection} />
        <Route path="/onboarding/pricing" component={PricingPlans} />
        <Route path="/onboarding/payment-success" component={PaymentSuccess} />
        {/* Invitation checkout (assigned plan) + legacy wait pages */}
        <Route
          path="/onboarding/registration-submitted"
          component={RegistrationSubmitted}
        />
        <Route
          path="/onboarding/waiting-invitation"
          component={WaitingForInvitation}
        />
        <Route
          path="/onboarding/invitation/:token"
          component={InvitationLanding}
        />
        <Route path="/User_Login" component={User_Login} />
        {/* <Route path="/signup" component={SignUp} /> */}
        <Route path="/signup/:user_type/:business_id" component={SignUp} />
        <Route path="/forgot-password" component={ForgetPassword} />
        <Route path="/reset-password/:token" component={ResetPassword} />
        <Route exact path="/OtpVerification" component={OtpVerification} />
        <Route exact path="/Reset" component={Reset} />

        {/* Privacy Policy Public */}
        <Route path="/privacy-policy" component={PrivacyPolicyPublic} />
        {/* Support Info Public */}
        <Route path="/support" component={SupportPublic} />
        {/* POS QR ordering (customer-facing, unauthenticated) */}
        <Route path="/qr-order/:token" component={QrOrderPage} />
        {/* Campaign QR sign-up (public, unauthenticated) */}
        <Route path="/campaign-signup/:token" component={CampaignPublicSignupPage} />
        {/* AQCTA Customer Portal (public, unauthenticated) */}
        <Route path="/customer" component={CustomerRoutes} />
        {/* <PrivateRoute> */}
        <Route path="/" component={Layout} />
        {/* </PrivateRoute> */}
        <Redirect exact from="/" to="/login" />
      </Switch>
    </>
  );
}

export default App;
