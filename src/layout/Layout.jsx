import React, {
  useContext,
  Suspense,
  useEffect,
  lazy,
  useMemo,
} from "react";
import { Switch, Route, Redirect, useLocation } from "react-router-dom";
import useSyncBrowserHistory from "@/hooks/useSyncBrowserHistory";
import { fetchConfiguration } from "@/components/formatAmount";
// Remove notification service import since useNotifications hook handles initialization
// import notificationService from "@/services/notificationService.jsx";

//internal import
import Main from "@/layout/Main";
import buildAppRoutes from "@/routes/index";
import Header from "@/components/header/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import { SidebarContext } from "@/context/SidebarContext";
import ThemeSuspense from "@/components/theme/ThemeSuspense";
import { AdminContext } from "@/context/AdminContext";
import VersionInfo from "@/components/VersionInfo";
import PageAuth from "@/components/PageAuth";
import { MainShellContext } from "@/context/MainShellContext";
// import NotificationDebug from "@/components/NotificationDebug.jsx";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import { notifyError } from "@/utils/toast";
import { logoutUser } from "@/utils/generic";
import notificationSound from "@/utils/notificationSound";
import { useModuleLabels } from "@/context/ModuleLabelsContext";
import { useConfiguration } from "@/hooks/useConfiguration";

const Page404 = lazy(() => import("@/pages/404"));

const Layout = () => {
  const { isSidebarOpen, closeSidebar, navBar } = useContext(SidebarContext);
  let location = useLocation();
  const isOnline = navigator.onLine;
  const { dispatch, state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { moduleLabelsVersion, moduleLabelsHydrated } = useModuleLabels();
  /**
   * Hydrate the global Configuration singleton (`dateFormat`, `timeFormat`,
   * `decimalPlaces`) so any module that reads it synchronously — e.g. the
   * dynamic placeholder parser used in recurring / customer invoices — sees
   * the value the user picked on Global Settings > Configuration without
   * each page having to re-fetch.
   */
  useConfiguration();

  const routes = useMemo(
    () => buildAppRoutes(),
    [moduleLabelsVersion, moduleLabelsHydrated],
  );
  const hideSidebar =
    location.pathname === "/home" ||
    location.pathname === "/create-document-template" ||
    location.pathname === "/sign-contract" ||
    location.pathname.includes("edit-document-template") ||
    location.pathname === "/pos" ||
    location.pathname === "/kitchen" ||
    location.pathname.startsWith("/qr-order");
  const hideHeader =
    location.pathname === "/home" ||
    location.pathname === "/pos" ||
    location.pathname === "/kitchen";

  // Close mobile nav only on route change — do not depend on closeSidebar
  // identity or opening the menu will immediately close it again.
  useEffect(() => {
    closeSidebar();
  }, [location.pathname, location.search, closeSidebar]);

  useSyncBrowserHistory();

  useEffect(() => {
    console.log("Message fetchConfiguration: ");
    fetchConfiguration(adminInfo?.token);
  }, []);

  useEffect(() => {
    const fcm_token = Cookies.get("fcm_token");
    if (!fcm_token) {
      const sessionExpired = localStorage.getItem("session_expired");
      if (sessionExpired) {
        try {
          notificationSound.play("error");
          console.log("🔊 NotificationService: Played notification sound");
        } catch (error) {
          console.warn("Could not play notification sound:", error);
        }

        toast.error("No Session. Please login again. Click to logout", {
          position: "top-right",
          hideProgressBar: true,
          autoClose: false,
          closeOnClick: true,
          // autoClose: 2000,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          style: {
            boxShadow: "1.5px 1.5px 1.5px 1.5px rgba(255, 0, 0, 0.65)",
          },
          onClick: () => {
            logoutUser();
            window.location.href = "/login";
          },

          onClose: () => {
            logoutUser();
            window.location.href = "/login";
          },
          closeButton: ({ closeToast }) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeToast();
              }}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "16px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ×
            </button>
          ),
        });
      }
    }
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 z-50 w-full bg-red-500 text-white p-2 text-center">
          You are in offline mode!
        </div>
      )}
      <div
        className={`admin-shell flex h-screen ${
          isSidebarOpen && "overflow-hidden"
        }`}
      >
        {!hideSidebar && navBar && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col w-full overflow-x-hidden">
          {!hideHeader && navBar && <Header />}
          <MainShellContext.Provider value={true}>
            <Main>
              <PageAuth>
                <Suspense fallback={<ThemeSuspense />}>
                  {adminInfo?.token && !moduleLabelsHydrated ? (
                    <ThemeSuspense />
                  ) : (
                    <Switch
                      key={`${location.pathname}${location.search}${location.key || ""}:${moduleLabelsVersion}`}
                    >
                      {/* Redirect to landing page on root URL */}
                      <Route exact path="/">
                        {/* <Redirect to={state?.adminInfo?.role?.landing_page || '/dashboard'} /> */}
                        <Redirect to={"/home"} />
                      </Route>
                      {/* Map through route configurations */}
                      {routes.map((route, i) => {
                        const routeKey = Array.isArray(route.path)
                          ? route.path.join("|")
                          : route.path ?? `route-${i}`;
                        return route.component ? (
                          <Route
                            key={routeKey}
                            exact={route.exact}
                            path={route.path}
                            render={(props) => (
                              <route.component
                                key={`${props.location.pathname}${props.location.search}`}
                                {...props}
                              />
                            )}
                          />
                        ) : null;
                      })}

                      {/* Handle 404 */}
                      <Route component={Page404} />
                    </Switch>
                  )}
                </Suspense>
                <VersionInfo />
              </PageAuth>
            </Main>
          </MainShellContext.Provider>
        </div>
      </div>
      {/* Debug panel for notifications - remove in production */}
      {/* <NotificationDebug userId={adminInfo?.id} /> */}
    </>
  );
};

export default Layout;
