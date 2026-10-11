import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import moment from "moment";
import { PageHeader, Loader } from "@/page-layouts/index";
import { formatActivityFieldLabel } from "@/utils/activityLogFieldLabels";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const resolveEntityDisplay = (value, entityLabels = {}) => {
  if (value === undefined || value === null) return "";
  const id =
    typeof value === "object" && value !== null
      ? String(value._id || "").trim()
      : String(value).trim();
  if (id && entityLabels[id]) return entityLabels[id];
  if (typeof value === "string" && OBJECT_ID_RE.test(value) && entityLabels[value]) {
    return entityLabels[value];
  }
  if (typeof value === "object" && value !== null) {
    return (
      value.name ||
      value.title ||
      value.customerDisplayName ||
      value.vendorDisplayName ||
      ""
    );
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
};

const ActivityLogDetails = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("HH:mm:ss");

  const location = useLocation();
  const logId = location.state ? location.state.ActivityLogs_id : null;

  useEffect(() => {
    const fetchConfiguration = async () => {
      try {
        const response = await axios.get(`${Base_URL}/configuration`);
        if (response.data && response.data.length > 0) {
          setDateFormat(response.data[0].date_format || "YYYY-MM-DD");
          setTimeFormat(response.data[0].time_format || "HH:mm:ss");
        }
      } catch (error) {
        console.error("❌ Error fetching configuration:", error);
      }
    };

    fetchConfiguration();
  }, []);

  useEffect(() => {
    if (logId && adminInfo) {
      fetchLogDetails();
    }
  }, [logId, adminInfo]);

  const fetchLogDetails = async () => {
    if (!adminInfo) return;

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo.token}`,
    };

    try {
      const response = await axios.post(
        `${Base_URL}/ActivityLogs/get_single`,
        { _id: logId },
        { headers }
      );
      setData(response.data.data || {});
    } catch (error) {
      console.error("Error fetching log details:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return t("activityLogs.notAvailable");
    return moment(dateString).format(`${dateFormat} ${timeFormat}`);
  };

  if (loading) {
    return (
      <div className="w-full max-w-full px-4 sm:px-6 py-6 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center min-h-[60vh] overflow-x-hidden">
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  if (!logId) {
    return (
      <div className="w-full max-w-full px-4 sm:px-6 py-6 bg-white dark:bg-gray-800 rounded-lg overflow-x-hidden">
        <PageHeader title={t("activityLogs.logDetails")} />
        <div className="text-center py-8 text-gray-500">
          {t("activityLogs.noLogIdProvided")}
        </div>
      </div>
    );
  }

  const ignoredFields = new Set([
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "password",
    "token",
    "refreshToken",
    "refresh_token",
    "accessToken",
    "access_token",
  ]);

  const renderFieldChanges = () => {
    const { previousData, newData, entityLabels = {} } = data;

    if (!previousData && !newData) {
      return (
        <tr>
          <td colSpan="3" className="text-center px-4 py-2">
            {t("No data available")}
          </td>
        </tr>
      );
    }

    const fields = new Set([
      ...(previousData ? Object.keys(previousData) : []),
      ...(newData ? Object.keys(newData) : []),
    ]);

    // Helper to stringify and format objects/arrays for comparison
    const formatValue = (value) => {
      const resolved = resolveEntityDisplay(value, entityLabels);
      if (resolved) return resolved;

      if (Array.isArray(value)) {
        return value.length
          ? value.map((item, index) => (
              <div key={index} className="ml-2">
                {typeof item === "object" ? formatValue(item) : item}
              </div>
            ))
          : "[]";
      } else if (typeof value === "object" && value !== null) {
        return (
          <pre className="whitespace-pre-wrap break-words text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded max-w-full overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      } else {
        return value !== undefined && value !== null ? value.toString() : t("activityLogs.notAvailable");
      }
    };

    const highlightChange = (prevValue, newValue) => {
      return prevValue !== newValue ? "bg-yellow-100 font-semibold" : "";
    };

    const changedFields = [...fields].filter((field) => {
      if (ignoredFields.has(field)) return false;
      const prevValue = previousData ? previousData[field] : null;
      const newValue = newData ? newData[field] : null;
      return JSON.stringify(prevValue) !== JSON.stringify(newValue);
    });

    if (changedFields.length === 0) {
      return (
        <tr>
          <td colSpan="3" className="text-center px-4 py-2">
            {t("activityLogs.noChangesAvailable")}
          </td>
        </tr>
      );
    }

    return changedFields.map((field) => {
      const prevValue = previousData ? previousData[field] : null;
      const newValue = newData ? newData[field] : null;

      return (
        <tr key={field} className="hover:bg-gray-50 dark:hover:bg-gray-700">
          <td className="border px-6 py-4 break-words font-semibold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 min-w-[180px] max-w-[250px]">
            {formatActivityFieldLabel(field)}
          </td>

          {/* Previous Data */}
          <td
            className={`border px-6 py-4 break-words text-gray-700 dark:text-gray-300 min-w-[250px] ${highlightChange(
              prevValue,
              newValue
            )}`}
            style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
          >
            {field === "image" && prevValue && typeof prevValue === "string" && prevValue.startsWith("http") ? (
              <img
                src={prevValue}
                alt={t("activityLogs.previous")}
                className="h-16 w-16 object-cover mx-auto rounded"
              />
            ) : (
              formatValue(prevValue)
            )}
          </td>

          {/* New Data */}
          <td
            className={`border px-6 py-4 break-words text-gray-700 dark:text-gray-300 min-w-[250px] ${highlightChange(
              prevValue,
              newValue
            )}`}
            style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
          >
            {field === "image" && newValue && typeof newValue === "string" && newValue.startsWith("http") ? (
              <img
                src={newValue}
                alt={t("activityLogs.new")}
                className="h-16 w-16 object-cover mx-auto rounded"
              />
            ) : (
              formatValue(newValue)
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 py-6 bg-white dark:bg-gray-800 rounded-lg overflow-x-hidden">
      <PageHeader title={t("activityLogs.logDetails")} onBack={() => history.goBack()} />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/40">
          <div className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {t("activityLogs.module", "Module")}
          </div>
          <p className="mt-1 break-words text-lg font-semibold text-gray-900 dark:text-gray-100">
            {data?.moduleName || data?.Collection || t("activityLogs.notAvailable")}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t("activityLogs.action")}
          </div>
          <p className="mt-1 break-words text-lg font-semibold text-gray-900 dark:text-gray-100">
            {data?.Action || t("activityLogs.notAvailable")}
          </p>
        </div>
        <div className="rounded-lg border border-violet-100 bg-violet-50/80 p-4 dark:border-violet-900 dark:bg-violet-950/40">
          <div className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
            {t("activityLogs.reference", "Reference")}
          </div>
          <p className="mt-1 break-words font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
            {data?.documentRef || data?._id || t("activityLogs.notAvailable")}
          </p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {t("activityLogs.dateTime")}
          </div>
          <p className="mt-1 break-words text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatDateTime(data?.createdAt || data?.Date)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 mt-8 w-full">
        <div className="flex flex-col gap-8 w-full">
          {/* Log Metadata */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 sm:p-8 w-full overflow-x-hidden">
            <h3 className="text-lg font-semibold mb-6 text-gray-800 dark:text-gray-200">
              {t("activityLogs.logInformation")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block">
                  {t("activityLogs.userName")}:
                </span>
                <p className="text-gray-900 dark:text-gray-100 break-words">
                  {data?.userDetails?.name || t("activityLogs.notAvailable")}
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block">
                  {t("activityLogs.userEmail")}:
                </span>
                <p className="text-gray-900 dark:text-gray-100 break-words">
                  {data?.userDetails?.email || t("activityLogs.notAvailable")}
                </p>
              </div>
              {!isSingleAssignedBusiness() && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block">
                  {t("activityLogs.business", "Business")}:
                </span>
                <p className="text-gray-900 dark:text-gray-100 break-words">
                  {data?.businessName ||
                    data?.businessDetails?.name ||
                    t("activityLogs.notAvailable")}
                </p>
              </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block">
                  {t("activityLogs.deviceInfo", "IP / Device")}:
                </span>
                <p className="text-gray-900 dark:text-gray-100 break-words font-mono text-sm">
                  {[data?.ipAddress, data?.deviceInfo].filter(Boolean).join(" / ") ||
                    t("activityLogs.notAvailable")}
                </p>
              </div>
              {data?.Function ? (
                <div className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block">
                    {t("activityLogs.functionLabel", "Screen / function")}:
                  </span>
                  <p className="text-gray-900 dark:text-gray-100 break-words">{data.Function}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Field Changes */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 sm:p-8 w-full overflow-x-hidden">
            <h3 className="text-lg font-semibold mb-6 text-gray-800 dark:text-gray-200">
              {t("activityLogs.dataDetails")}
            </h3>
            <div className="overflow-x-auto w-full">
              <table
                className="table-auto w-full border-collapse border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                style={{ minWidth: "800px" }}
              >
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="border px-6 py-4 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[180px]">
                      {t("activityLogs.field")}
                    </th>
                    <th className="border px-6 py-4 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[300px]">
                      {t("activityLogs.previousValue")}
                    </th>
                    <th className="border px-6 py-4 text-left font-semibold text-gray-700 dark:text-gray-300 min-w-[300px]">
                      {t("activityLogs.newValue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderFieldChanges() || (
                    <tr>
                      <td
                        colSpan="3"
                        className="text-center px-4 py-8 text-gray-500 dark:text-gray-400"
                      >
                        {t("activityLogs.noChangesAvailable")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogDetails;
