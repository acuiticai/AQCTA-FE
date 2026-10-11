"use client";

import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import AdvanceTypesSettings from "./AdvanceTypesSettings";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { AdminContext } from "@/context/AdminContext";
import { useLocation } from "react-router-dom";

const AdvanceTypesPage = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">{t("accountsSettings.advanceTypes.title", "Advance Types")}</h1>
        </div>
        <SettingsOrgBanner />
        <AdvanceTypesSettings />
      </div>
    </AppLayout>
  );
};

export default AdvanceTypesPage;
