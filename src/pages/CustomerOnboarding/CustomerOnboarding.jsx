import React from "react";
import { Redirect } from "react-router-dom";

/** Legacy path — invite from invitation plans on Subscription Catalog. */
const CustomerOnboarding = () => (
  <Redirect to="/subscription-catalog?channel=invitation" />
);

export default CustomerOnboarding;
