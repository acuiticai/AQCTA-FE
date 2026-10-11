import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ChequeReminderList from "../../components/chequeReminders/ChequeReminderList";
import ChequeReminderForm from "../../components/chequeReminders/ChequeReminderForm";
import { ChequeReminderProvider, useChequeReminders } from "../../context/ChequeReminderContext";
import Header from "@/components/header/Header";
import AppLayout from "../../pages/Settings/app-layout";
import { useLocation, Link } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { PencilIcon, ExternalLinkIcon } from "@heroicons/react/outline";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ChequeRemindersContent = () => {
  const { t } = useTranslation();
  const { isFormOpen, selectedReminder, openAddReminderForm } = useChequeReminders();
  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();
  const [cronExpression, setCronExpression] = useState("");
  const [cronLoading, setCronLoading] = useState(false);
  const [cronEdit, setCronEdit] = useState(false);
  const [time, setTime] = useState("09:00"); // default 9:00 AM
  const [frequency, setFrequency] = useState("daily");
  const [summary, setSummary] = useState("");
  const { canAdd, canUpdate, canDelete } = useRouteModulePermissions();

  const getAuthHeaders = (includeJson = false) => {
    try {
      const raw = localStorage.getItem("adminInfo");
      const adminInfo = raw ? JSON.parse(raw) : null;
      const token = adminInfo?.token;
      return {
        ...(includeJson ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    } catch (_) {
      return includeJson ? { "Content-Type": "application/json" } : {};
    }
  };

  // Helper to generate cron from time/frequency
  const generateCron = (timeStr, freq) => {
    const [hour, minute] = timeStr.split(":");
    switch (freq) {
      case "daily":
        return `${parseInt(minute)} ${parseInt(hour)} * * *`;
      case "weekdays":
        return `${parseInt(minute)} ${parseInt(hour)} * * 1-5`;
      case "weekends":
        return `${parseInt(minute)} ${parseInt(hour)} * * 6,0`;
      default:
        return `${parseInt(minute)} ${parseInt(hour)} * * *`;
    }
  };

  // Helper to generate summary
  const getSummary = (timeStr, freq) => {
    const [hour, minute] = timeStr.split(":");
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const timeLabel = `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
    switch (freq) {
      case "daily":
        return t("accountsSettings.chequeReminders.summaryDaily", { time: timeLabel });
      case "weekdays":
        return t("accountsSettings.chequeReminders.summaryWeekdays", { time: timeLabel });
      case "weekends":
        return t("accountsSettings.chequeReminders.summaryWeekends", { time: timeLabel });
      default:
        return t("accountsSettings.chequeReminders.summaryDaily", { time: timeLabel });
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);

    // Fetch current cron expression
    const fetchCron = async () => {
      setCronLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/cheque-reminders/settings`, {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        setCronExpression(data.cronExpression || "0 9 * * *");
        // Try to parse cron to set time/frequency
        const parts = (data.cronExpression || "0 9 * * *").split(" ");
        if (parts.length === 5) {
          setTime(`${parts[1].padStart(2, "0")}:${parts[0].padStart(2, "0")}`);
          if (parts[4] === "1-5") setFrequency("weekdays");
          else if (parts[4] === "6,0") setFrequency("weekends");
          else setFrequency("daily");
        }
        setSummary(
          getSummary(
            `${parts[1].padStart(2, "0")}:${parts[0].padStart(2, "0")}`,
            frequency
          )
        );
      } catch (e) {
        setCronExpression("0 9 * * *");
        setTime("09:00");
        setFrequency("daily");
        setSummary(getSummary("09:00", "daily"));
      } finally {
        setCronLoading(false);
      }
    };
    fetchCron();
  }, [location]);

  useEffect(() => {
    const cron = generateCron(time, frequency);
    setCronExpression(cron);
    setSummary(getSummary(time, frequency));
  }, [time, frequency]);

  const handleTriggerReminders = async () => {
    try {
      const response = await fetch(`${BASE_URL}/trigger-cheque-reminders`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (data.success) {
        notifySuccess(t("accountsSettings.chequeReminders.triggeredSuccess", "Cheque reminders triggered successfully."));
      } else {
        notifyError(t("accountsSettings.chequeReminders.triggeredFailed", "Failed to trigger cheque reminders."));
      }
    } catch (error) {
      console.error("Trigger failed:", error);
      notifyError(t("accountsSettings.chequeReminders.triggerError", "Error triggering cheque reminders."));
    }
  };

  const handleSaveCron = async () => {
    setCronLoading(true);
    try {
      // Validate cron: must be 5 fields
      if (
        !/^([0-5]?\d)\s([01]?\d|2[0-3])\s\*\s\*\s(\*|1-5|6,0)$/.test(
          cronExpression
        )
      ) {
        notifyError(t("accountsSettings.chequeReminders.invalidTime"));
        setCronLoading(false);
        return;
      }
      const res = await fetch(`${BASE_URL}/cheque-reminders/settings`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ cronExpression }),
        credentials: "include",
      });
      if (res.ok) {
        notifySuccess(t("accountsSettings.chequeReminders.scheduleUpdated"));
        setCronEdit(false);
      } else {
        notifyError(t("accountsSettings.chequeReminders.scheduleUpdateFailed"));
      }
    } catch (e) {
      notifyError(t("accountsSettings.chequeReminders.scheduleUpdateFailed"));
    } finally {
      setCronLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px] max-h-[90vh] overflow-y-auto pb-[120px]">
      <h1 className="text-xl font-semibold mb-6">{t("accountsSettings.chequeReminders.title", "Cheque Reminders")}</h1>
      <SettingsOrgBanner />
      {organization && (
        <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <p dangerouslySetInnerHTML={{ __html: t("accountsSettings.chequeReminders.infoText") }} />
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950">
            <strong>{t("accountsSettings.chequeReminders.whenSent")}</strong>{" "}
            <span dangerouslySetInnerHTML={{ __html: t("accountsSettings.chequeReminders.infoWhenSentDetail") }} />
          </p>
          <Link
            to={`/notification-events?selectedOrg=${organization}`}
            className="inline-flex items-center gap-1 mt-2 font-medium text-[var(--p-blue)] hover:underline"
          >
            {t("accountsSettings.chequeReminders.configureEvents", "Configure notification events")}
            <ExternalLinkIcon className="h-4 w-4" />
          </Link>
        </div>
      )}
      {/* Cron Expression UI */}
      <div className="mb-6 bg-white rounded shadow p-4 flex flex-col md:flex-row md:items-center md:space-x-4">
        <div className="font-medium text-gray-700 mb-2 md:mb-0">
          {t("accountsSettings.chequeReminders.schedule")}
        </div>
        {cronEdit ? (
          <>
            <input
              type="time"
              className="border border-gray-300 rounded px-2 py-1 mr-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={cronLoading}
              style={{ width: 120 }}
            />
            <select
              className="border border-gray-300 rounded px-2 py-1 mr-2"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={cronLoading}
            >
              <option value="daily">{t("accountsSettings.chequeReminders.daily")}</option>
              <option value="weekdays">{t("accountsSettings.chequeReminders.weekdays")}</option>
              <option value="weekends">{t("accountsSettings.chequeReminders.weekends")}</option>
            </select>
            <button
              className="bg-[var(--p-blue)] text-white px-3 py-1 rounded mr-2"
              onClick={handleSaveCron}
              disabled={cronLoading || !canUpdate}
            >
              {t("Save")}
            </button>
            <button
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded"
              onClick={() => setCronEdit(false)}
              disabled={cronLoading}
            >
              {t("Cancel")}
            </button>
          </>
        ) : (
          <>
            <span className="text-gray-800 mr-4">{summary}</span>
            {canUpdate && (
              <button
                className="bg-[var(--p-blue)] text-white px-3 py-1 rounded"
                onClick={() => setCronEdit(true)}
                disabled={cronLoading}
              >
                <PencilIcon className="h-5 w-5" />
              </button>
            )}
          </>
        )}
        {/* <span className="ml-4 text-xs text-gray-500">(e.g. 9:00 AM daily)</span> */}
      </div>
      {isFormOpen ? (
        <ChequeReminderForm
          organization={organization}
          canAdd={canAdd}
          canUpdate={canUpdate}
        />
      ) : (
        <div>
          <div className="mb-4 flex justify-end gap-2">
            {canAdd && (
              <button
                onClick={openAddReminderForm}
                className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white px-4 py-2 rounded-md font-medium"
              >
                {t("accountsSettings.chequeReminders.addNew", "Add New Reminder")}
              </button>
            )}
            {canUpdate && (
              <button
                onClick={handleTriggerReminders}
                className="bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white px-4 py-2 rounded-md font-medium"
              >
                {t("accountsSettings.chequeReminders.runJob", "Run Cheque Reminder Job")}
              </button>
            )}
          </div>
          <ChequeReminderList
            organization={organization}
            canAdd={canAdd}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </div>
      )}
    </div>
  );
};

const ChequeReminders = () => {
  const { t } = useTranslation();
  return (
  <AppLayout>
    <Header title={t("accountsSettings.chequeReminders.headerTitle", "Cheque Reminders")} />
    <ChequeReminderProvider>
      <ChequeRemindersContent />
    </ChequeReminderProvider>
  </AppLayout>
  );
};

export default ChequeReminders;
