import React from "react";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import TabClassCategories from "@/pages/Configuration/TabClassCategories";

const ClassCategoriesPage = () => (
  <AppLayout>
    <Header />
    <div className="w-full max-w-full mx-auto py-6 px-6 max-h-[90vh] overflow-y-auto pb-[120px] min-w-0 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 min-h-screen">
      <SettingsOrgBanner />
      <TabClassCategories />
    </div>
  </AppLayout>
);

export default ClassCategoriesPage;
