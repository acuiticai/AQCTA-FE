import React from "react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import TabDynamicForms from "@/pages/Configuration/TabDynamicForms";

const DynamicFormsPage = () => (
  <AppLayout>
    <Header />
    <div className="w-full max-w-full mx-auto max-h-[90vh] min-w-0 overflow-y-auto px-6 py-6 pb-[120px]">
      <SettingsOrgBanner />
      <TabDynamicForms />
    </div>
  </AppLayout>
);

export default DynamicFormsPage;
