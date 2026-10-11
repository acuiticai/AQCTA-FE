import React from "react";
import { useHistory, useLocation } from "react-router-dom";
import PlanPickerModal from "./PlanPickerModal";
import { isSubscriptionAdjustment } from "@/utils/subscriptionAdjustment";

/**
 * Deep-link / redirect target for plan selection.
 * Renders the plan picker modal over a minimal backdrop.
 */
const PricingPlans = () => {
  const history = useHistory();
  const location = useLocation();
  const isAdjustment = isSubscriptionAdjustment(location);

  return (
    <div className="plan-picker-page">
      <PlanPickerModal
        open
        isAdjustment={isAdjustment}
        onClose={() =>
          history.push(isAdjustment ? "/billing" : "/onboarding/modules")
        }
      />
    </div>
  );
};

export default PricingPlans;
