import React from "react";
import { useTranslation } from "react-i18next";
import ActivityTimeline from "@/components/timeline/ActivityTimeline";

const CustomerActivityTimelineTab = ({ customerId }) => {
  const { t } = useTranslation();

  if (!customerId) {
    return (
      <div className="text-sm text-gray-500">
        {t("customer.tabs.noCustomerSelected")}
      </div>
    );
  }

  return (
    <ActivityTimeline
      query={{ customerId }}
      title=""
      pageSize={25}
      embedded
    />
  );
};

export default CustomerActivityTimelineTab;
