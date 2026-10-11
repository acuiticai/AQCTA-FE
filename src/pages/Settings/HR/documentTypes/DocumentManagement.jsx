import React from "react";
import { useTranslation } from "react-i18next";
import DocumentTypes from "./DocumentTypes";
import { useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../../app-layout";
import SettingsOrgBanner from "../../SettingsOrgBanner";

const DocumentManagement = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const selectedOrg = queryParams.get("selectedOrg");

  return (
    <AppLayout>
      <Header />
      <div className="w-full max-w-7xl mx-auto py-6 px-4 max-h-[90vh] overflow-y-auto pb-[120px]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {t(
              "settingsPage.documentManager.documentManagement",
              "Document Management",
            )}
          </h1>
        </div>
        <SettingsOrgBanner />
        <DocumentTypes selectedOrg={selectedOrg} />
      </div>
    </AppLayout>
  );
};

export default DocumentManagement;
