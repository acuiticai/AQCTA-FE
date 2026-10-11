import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";

import "../styles/index.css";

import { CustomerBrandingProvider } from "../branding";
import { AccountProvider, useAccount } from "../context/AccountContext";
import { navItems } from "../config/navigation";
import CustomerLogin from "../pages/CustomerLogin";
import CustomerRegister from "../pages/register/CustomerRegister";
import CustomerForgotPassword from "../pages/CustomerForgotPassword";
import CustomerResetPassword from "../pages/CustomerResetPassword";
import CustomerVerifyOtp from "../pages/CustomerVerifyOtp";
import CustomerEnquiry from "../pages/CustomerEnquiry";
import CustomerDashboard from "../pages/dashboard/CustomerDashboard";
import ModulePlaceholder from "../pages/ModulePlaceholder";
import EnquiriesList from "../pages/enquiries/EnquiriesList";
import EnquiryForm from "../pages/enquiries/EnquiryForm";
import EnquiryDetail from "../pages/enquiries/EnquiryDetail";
import ApplicationsList from "../pages/applications/ApplicationsList";
import CreateApplication from "../pages/applications/CreateApplication";
import ApplicationWizardPage from "../pages/applications/ApplicationWizardPage";
import ApplicationDetail from "../pages/applications/ApplicationDetail";
import Invoices from "../pages/invoices/Invoices";
import Quotations from "../pages/quotations/Quotations";
import ProjectsList from "../pages/projects/Projects";
import ProfileSettings from "../pages/profile/ProfileSettings";
import { customerPath } from "./paths";

/**
 * Entry point for the AQCTA Customer Portal.
 *
 * Mounted at `/customer`. Auth screens are public; portal modules require a
 * customer session (token stored after OTP verify).
 *
 * Module routes are generated from `config/navigation.js`: declaring a module
 * there gives it a working route immediately, and building its screen is a
 * matter of adding an entry to `MODULE_SCREENS` below.
 */
const MODULE_SCREENS = {
  dashboard: CustomerDashboard,
  enquiries: EnquiriesList,
  applications: ApplicationsList,
  invoices: Invoices,
  quotation: Quotations,
  projects: ProjectsList,
  profile: ProfileSettings,
};

/*
 * Sub-routes a module owns beyond its index screen. Declared before the
 * nav-driven routes below so `/enquiries/new` is not swallowed by the
 * `/enquiries` prefix match.
 */
const MODULE_SUBROUTES = [
  { path: `${customerPath.enquiries}/new`, exact: true, component: EnquiryForm },
  { path: `${customerPath.enquiries}/:id/edit`, exact: true, component: EnquiryForm },
  { path: `${customerPath.enquiries}/:id`, exact: true, component: EnquiryDetail },

  { path: `${customerPath.applications}/new`, exact: true, component: CreateApplication },
  {
    path: `${customerPath.applications}/:type(certification|inspection)/new`,
    exact: true,
    component: ApplicationWizardPage,
  },
  { path: `${customerPath.applications}/:id`, exact: true, component: ApplicationDetail },
];

function ProtectedCustomerRoute({ component: Component, ...rest }) {
  const { isAuthenticated } = useAccount();
  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect
            to={{
              pathname: customerPath.login,
              state: { from: props.location },
            }}
          />
        )
      }
    />
  );
}

function CustomerPortalSwitch() {
  return (
    <Switch>
      {/* Public auth + enquiry */}
      <Route exact path={customerPath.login} component={CustomerLogin} />
      <Route path={customerPath.register} component={CustomerRegister} />
      <Route
        exact
        path={customerPath.forgotPassword}
        component={CustomerForgotPassword}
      />
      <Route
        exact
        path={customerPath.resetPassword}
        component={CustomerResetPassword}
      />
      <Route exact path={customerPath.verifyOtp} component={CustomerVerifyOtp} />
      <Route exact path={customerPath.enquiry} component={CustomerEnquiry} />

      {/* Module sub-routes, before the nav prefix routes below */}
      {MODULE_SUBROUTES.map((route) => (
        <ProtectedCustomerRoute
          key={route.path}
          path={route.path}
          exact={route.exact}
          component={route.component}
        />
      ))}

      {/* Portal modules — require customer session */}
      {navItems.map((item) => (
        <ProtectedCustomerRoute
          key={item.id}
          path={item.path}
          component={MODULE_SCREENS[item.id] || ModulePlaceholder}
        />
      ))}

      <Redirect to={customerPath.login} />
    </Switch>
  );
}

export default function CustomerRoutes() {
  return (
    <CustomerBrandingProvider>
      <AccountProvider>
        <CustomerPortalSwitch />
      </AccountProvider>
    </CustomerBrandingProvider>
  );
}
