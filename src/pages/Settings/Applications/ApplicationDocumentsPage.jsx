import React from "react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import TabApplicationDocumentTypes from "@/pages/Configuration/TabApplicationDocumentTypes";

const ApplicationDocumentsPage = () => (
  <AppLayout>
    <Header />
    <div className="w-full max-w-full mx-auto px-6 py-4 max-h-[90vh] overflow-y-auto pb-[80px] min-w-0">
      <SettingsOrgBanner />
      <TabApplicationDocumentTypes />
    </div>
  </AppLayout>
);

export default ApplicationDocumentsPage;
