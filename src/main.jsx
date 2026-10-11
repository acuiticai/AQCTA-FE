import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Provider } from "react-redux";
import { Windmill } from "@windmill/react-ui";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";
import { ErrorBoundary } from "react-error-boundary";

// internal import
import "rc-tree/assets/index.css";
import "@/assets/css/custom.css";
import "@/assets/css/tailwind.css";
import "react-loading-skeleton/dist/skeleton.css";
import "@/i18n";
import App from "@/App";
import store from "@/reduxStore/store";
import myTheme from "@/assets/theme/myTheme";
import { AdminProvider } from "@/context/AdminContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { SalesContractProvider } from "@/pages/SalesContract/context/SalesContractContext";
import { PurchaseContractProvider } from "@/pages/Purchase_Contract/context/PurchaseContractContext";
import ThemeSuspense from "@/components/theme/ThemeSuspense";
import axios from "axios";
import { hostnameRequiresTenantCheck } from "@/utils/tenantHost";
import { setupAxiosAuthInterceptor } from "@/utils/setupAxiosAuth";

// global default: send cookies on cross-origin requests
axios.defaults.withCredentials = true;
setupAxiosAuthInterceptor();

// Ensure every request to our API includes Bearer token (fixes live/cross-domain when cookies are blocked)
const apiBaseURL = (import.meta.env.VITE_APP_API_BASE_URL || "").replace(/\/$/, "");
axios.interceptors.request.use((config) => {
  const url = config.url || "";
  const isApiRequest =
    (apiBaseURL && url.startsWith(apiBaseURL)) ||
    url.startsWith("/api") ||
    url.includes("/api/");
  if (!isApiRequest) return config;
  if (typeof window !== "undefined") {
    const host = window.location.host;
    const hn = window.location.hostname || "";
    if (host && hostnameRequiresTenantCheck(hn)) {
      config.headers = config.headers || {};
      config.headers["X-Forwarded-Host"] = host;
    }
  }
  config.headers = config.headers || {};

  // Customer portal APIs must use the customer JWT — never the admin session.
  if (url.includes("/customer-portal/")) {
    try {
      const customerToken = localStorage.getItem("customerToken");
      if (customerToken) {
        config.headers.Authorization = `Bearer ${customerToken}`;
      }
    } catch (_) {}
    return config;
  }

  // Do not overwrite an explicit Bearer token (e.g. set by a service module).
  if (config.headers.Authorization) return config;

  try {
    const raw = localStorage.getItem("adminInfo");
    const adminInfo = raw ? JSON.parse(raw) : null;
    const token = adminInfo?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.register();
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("New content available. Reload?")) {
      updateSW(true);
    }
  },
});

let persistor = persistStore(store);

function ErrorFallback({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center mb-6">
          <svg
            className="w-12 h-12 text-red-500 mr-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h1 className="text-2xl font-semibold text-gray-800">
            Oops! Something went wrong
          </h1>
        </div>

        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700 font-medium">Error Message:</p>
          <pre className="mt-2 text-sm text-red-600 whitespace-pre-wrap font-mono">
            {error.message}
          </pre>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error, errorInfo) => {
      // Log the error to an error reporting service
      console.log("Error:", error, errorInfo);
    }}
  >
    <AdminProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SidebarProvider>
            <SalesContractProvider>
              <PurchaseContractProvider>
                <Suspense fallback={<ThemeSuspense />}>
                  <Windmill light theme={myTheme}>
                    <App />
                  </Windmill>
                </Suspense>
              </PurchaseContractProvider>
            </SalesContractProvider>
          </SidebarProvider>
        </PersistGate>
      </Provider>
    </AdminProvider>
  </ErrorBoundary>
);
// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.register();
