"use client";

import { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import PaymentMethodsSettings from "./PaymentMethodsSettings";
import SettingsOrgBanner from "../SettingsOrgBanner";
import { AdminContext } from "@/context/AdminContext";
import { useLocation } from "react-router-dom";

const PaymentMethodsPage = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">{t("accountsSettings.paymentMethods.title", "Payment Methods")}</h1>
        </div>
        <SettingsOrgBanner />
        <PaymentMethodsSettings />
      </div>
    </AppLayout>
  );
};

export default PaymentMethodsPage;
