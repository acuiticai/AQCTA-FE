import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import moment from "moment";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";
import { ActionButtons, DateRangeComponent, Loader } from "@/page-layouts/index";
import { EpcPage } from "@/components/Epc/EpcSurface";
import FilterBar from "@/customer/components/ui/FilterBar";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import PortalDataTable from "@/customer/components/ui/DataTable";
import Pagination from "@/customer/components/ui/Pagination";
import { formatActivityFieldLabel } from "@/utils/activityLogFieldLabels";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ignoredAuditFields = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "password",
  "token",
  "fcm_token",
  "fcm_tokens",
]);

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const flattenObject = (obj, prefix = "") => {
  if (!isPlainObject(obj)) return {};
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (ignoredAuditFields.has(key)) return acc;
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value) && Object.keys(value).length <= 12) {
      return { ...acc, ...flattenObject(value, nextKey) };
    }
    acc[nextKey] = value;
    return acc;
  }, {});
};

const resolveAuditValue = (value, entityLabels = {}) => {
  if (value === undefined || value === null) return "";
  const id = isPlainObject(value) ? String(value._id || "").trim() : String(value).trim();
  if (id && entityLabels[id]) return entityLabels[id];
  if (typeof value === "string" && OBJECT_ID_RE.test(value) && entityLabels[value]) {
    return entityLabels[value];
  }
  if (isPlainObject(value)) {
    return (
      value.name ||
      value.title ||
      value.customerDisplayName ||
      value.vendorDisplayName ||
      value.code ||
      value.email ||
      (id && entityLabels[id]) ||
      ""
    );
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => resolveAuditValue(item, entityLabels) || stableStringify(item, entityLabels))
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
};

const stableStringify = (value, entityLabels = {}) => {
  const resolved = resolveAuditValue(value, entityLabels);
  if (resolved) return resolved;
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => stableStringify(item, entityLabels))
      .join(", ");
  }
  if (isPlainObject(value)) {
    return JSON.stringify(value);
  }
  return String(value);
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

/** One entry per id (ObjectId vs string duplicates). */
function dedupeById(list, idKey = "_id") {
  const map = new Map();
  for (const row of list || []) {
    const id = String(row?.[idKey] ?? "").trim();
    if (!id || map.has(id)) continue;
    map.set(id, { ...row, [idKey]: id });
  }
  return [...map.values()];
}

function uniqueModuleOptions(modules) {
  const seen = new Set();
  const out = [];
  for (const mod of modules || []) {
    const name = String(mod?.name || "").trim();
    const key = normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value: name, label: name });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function uniqueActionOptions(actions) {
  const seen = new Set();
  const out = [];
  for (const action of actions || []) {
    const label = String(action || "").trim();
    const key = normalizeKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value: label, label });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function uniqueUserOptions(users) {
  return dedupeById(users, "_id")
    .map((user) => ({
      value: user._id,
      label: user.name || user.email || user._id,
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

const getChangedFields = (previousData, newData, entityLabels = {}) => {
  const previous = flattenObject(previousData || {});
  const next = flattenObject(newData || {});
  const fields = [...new Set([...Object.keys(previous), ...Object.keys(next)])];
  return fields
    .map((field) => ({
      field,
      previousValue: stableStringify(previous[field], entityLabels),
      newValue: stableStringify(next[field], entityLabels),
    }))
    .filter(({ previousValue, newValue }) => previousValue !== newValue);
};

const ActivityLogs = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [data, setData] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [modules, setModules] = useState([]);
  const [actions, setActions] = useState([]);

  const { t } = useTranslation();
  const [filterUserId, setFilterUserId] = useState("");
  const [filterBusinessId, setFilterBusinessId] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [systemUsers, setSystemUsers] = useState([]);
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("HH:mm:ss");
  const [fetchingData, setFetchingData] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    const fetchConfiguration = async () => {
      try {
        const response = await axios.get(`${Base_URL}/configuration`);
        if (response.data && response.data.length > 0) {
          console.log("✅ Configuration Fetched:", response.data[0]);
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
    if (!adminInfo) return;

    const fetchAssignedBusinesses = async () => {
      try {
        const adminId = adminInfo.id || adminInfo._id;
        if (!adminId) return;
        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        };
        const response = await axios.get(`${Base_URL}/admin/assigned/${adminId}`, {
          headers,
        });
        const list = dedupeById(
          response.data?.businesses || adminInfo.businesses || [],
          "_id",
        );
        setBusinesses(list);
        if (list.length > 0) {
          setFilterBusinessId((prev) => prev || list[0]._id);
        }
      } catch (error) {
        console.error("❌ Error fetching assigned businesses:", error);
        const fallbackBusinesses = dedupeById(adminInfo.businesses || [], "_id");
        setBusinesses(fallbackBusinesses);
        if (fallbackBusinesses.length > 0) {
          setFilterBusinessId((prev) => prev || fallbackBusinesses[0]._id);
        }
      }
    };

    fetchAssignedBusinesses();
  }, [adminInfo]);

  const formatDateTime = (dateString) => {
    if (!dateString) return t("activityLogs.notAvailable", "N/A");
    return moment(dateString).format(`${dateFormat} ${timeFormat}`);
  };

  const authHeaders = useMemo(
    () =>
      adminInfo
        ? {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          }
        : {},
    [adminInfo]
  );

  const handleView = async (_id) => {
    if (!_id || !adminInfo) return;
    setDetailsLoading(true);
    setSelectedLog(null);
    try {
      const response = await axios.post(
        `${Base_URL}/ActivityLogs/get_single`,
        { _id },
        { headers: authHeaders }
      );
      setSelectedLog(response.data.data || {});
    } catch (error) {
      console.error("Error fetching activity log details:", error);
      setSelectedLog(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const clearAllFilters = () => {
    setFilterAction("");
    setFilterModule("");
    setFilterUserId("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setSearchTerm("");
    setFilterBusinessId(businesses[0]?._id || "");
    setCurrentPage(1);
  };

  // Fetch Data when filters or pagination change
  useEffect(() => {
    if (!adminInfo) return;
    if (businesses.length > 0 && !filterBusinessId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    recordsPerPage,
    filterUserId,
    filterBusinessId,
    filterModule,
    filterAction,
    dateRangeStart,
    dateRangeEnd,
    searchTerm,
    adminInfo,
  ]);

  const fetchData = () => {
    setFetchingData(true);

    let payload = {
      business_id: filterBusinessId || undefined,
      FilterModule: filterModule || undefined,
      FilterAction: filterAction || undefined,
      user_id: filterUserId || undefined,
      startDate: dateRangeStart || undefined,
      endDate: dateRangeEnd || undefined,
      search: searchTerm || undefined,
      page: currentPage,
      limit: recordsPerPage,
    };

    axios
      .post(`${Base_URL}/ActivityLogs/getALL`, payload, {
        headers: authHeaders,
      })
      .then((response) => {
        const responseData = response.data.data || [];
        setData(responseData);
        setTotalResults(response.data.total || 0);
        setModules(response.data.filters?.modules || []);
        setActions(response.data.filters?.actions || []);
        setSystemUsers(response.data.filters?.users || []);
      })
      .catch(() => setData([]))
      .finally(() => {
        setFetchingData(false);
      });
  };

  const tableRows = useMemo(() => dedupeById(data, "_id"), [data]);

  const businessOptions = useMemo(
    () =>
      dedupeById(businesses, "_id").map((business) => ({
        value: business._id,
        label: business.name,
      })),
    [businesses],
  );

  const moduleOptions = useMemo(() => uniqueModuleOptions(modules), [modules]);
  const userOptions = useMemo(() => uniqueUserOptions(systemUsers), [systemUsers]);
  const actionOptions = useMemo(() => uniqueActionOptions(actions), [actions]);

  const portalFilterValues = {
    business: filterBusinessId || "",
    module: filterModule || "",
    user: filterUserId || "",
    action: filterAction || "",
  };

  const portalFilters = useMemo(
    () => [
      ...(businesses.length !== 1
        ? [
            {
              key: "business",
              placeholder: t("activityLogs.selectBusiness", "Select Business"),
              options: [
                {
                  value: "",
                  label: t("activityLogs.selectBusiness", "Select Business"),
                },
                ...businessOptions,
              ],
            },
          ]
        : []),
      {
        key: "module",
        placeholder: t("activityLogs.selectModule", "Select Module"),
        options: [
          {
            value: "",
            label: t("activityLogs.selectModule", "Select Module"),
          },
          ...moduleOptions,
        ],
      },
      {
        key: "user",
        placeholder: t("activityLogs.selectUser", "Select User"),
        options: [
          { value: "", label: t("activityLogs.selectUser", "Select User") },
          ...userOptions,
        ],
      },
      {
        key: "action",
        placeholder: t("activityLogs.selectAction", "Select Action"),
        options: [
          {
            value: "",
            label: t("activityLogs.selectAction", "Select Action"),
          },
          ...actionOptions,
        ],
      },
    ],
    [
      actionOptions,
      businessOptions,
      businesses.length,
      moduleOptions,
      t,
      userOptions,
    ],
  );

  const handlePortalFilterChange = (key, value) => {
    if (key === "business") {
      setFilterBusinessId(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "module") {
      setFilterModule(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "user") {
      setFilterUserId(value || "");
      setCurrentPage(1);
      return;
    }
    if (key === "action") {
      setFilterAction(value || "");
      setCurrentPage(1);
    }
  };

  const handleDateRangeApply = useCallback((start, end) => {
    setDateRangeStart(start || "");
    setDateRangeEnd(end || "");
    setCurrentPage(1);
  }, []);

  const handleDateRangeClear = useCallback(() => {
    setDateRangeStart("");
    setDateRangeEnd("");
    setCurrentPage(1);
  }, []);

  const columns = useMemo(
    () => [
      ...(businesses.length !== 1
        ? [
            {
              key: "business",
              header: t("activityLogs.business", "Business"),
              width: "12%",
              render: (row) => (
                <div className="epc-cell__primary">
                  {row.businessName ||
                    t("activityLogs.notAvailable", "N/A")}
                </div>
              ),
            },
          ]
        : []),
      {
        key: "module",
        header: t("activityLogs.module", "Module"),
        width: "12%",
        render: (row) => (
          <div className="epc-cell__primary">
            {row.moduleName || row.Collection || "—"}
          </div>
        ),
      },
      {
        key: "user",
        header: t("activityLogs.userName", "User Name"),
        width: "14%",
        render: (row) => (
          <div className="epc-cell__primary">
            {row.userDetails?.name ||
              t("activityLogs.notAvailable", "N/A")}
          </div>
        ),
      },
      {
        key: "actionType",
        header: t("activityLogs.actionType", "Action Type"),
        width: "12%",
        render: (row) => (
          <div className="epc-cell__secondary">{row.Action || "—"}</div>
        ),
      },
      {
        key: "reference",
        header: t("activityLogs.reference", "Reference"),
        width: "12%",
        render: (row) => (
          <div className="epc-cell__secondary">
            {row.documentRef || t("activityLogs.notAvailable", "N/A")}
          </div>
        ),
      },
      {
        key: "date",
        header: t("activityLogs.date", "Date"),
        width: "14%",
        render: (row) => (
          <div className="epc-cell__secondary">
            {formatDateTime(row.Date)}
          </div>
        ),
      },
      {
        key: "device",
        header: t("activityLogs.deviceInfo", "IP / Device"),
        width: "14%",
        render: (row) => (
          <div className="epc-cell__secondary">
            {[row.ipAddress, row.deviceInfo].filter(Boolean).join(" / ") ||
              t("activityLogs.notAvailable", "N/A")}
          </div>
        ),
      },
      {
        key: "actions",
        header: t("activityLogs.action", "Action"),
        width: "10%",
        align: "right",
        render: (row) => (
          <ActionButtons
            maxVisibleActions={1}
            items={[
              {
                action: ACTION_BUTTON_TYPES.VIEW,
                title: t("activityLogs.view"),
                onClick: () => handleView(row._id),
              },
            ]}
          />
        ),
      },
    ],
    [businesses.length, dateFormat, t, timeFormat],
  );

  const renderDetailsDrawer = () => {
    if (!detailsLoading && !selectedLog) return null;
    const entityLabels = selectedLog?.entityLabels || {};
    const changes = selectedLog
      ? getChangedFields(
          selectedLog.previousData,
          selectedLog.newData,
          entityLabels,
        )
      : [];

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
        <button
          type="button"
          className="flex-1 cursor-default"
          aria-label={t("activityLogs.closeDetails", "Close details")}
          onClick={() => setSelectedLog(null)}
        />
        <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t("activityLogs.activityDetails", "Activity Details")}
              </h2>
              {selectedLog && (
                <p className="mt-1 text-sm text-gray-500">
                  {selectedLog.moduleName || selectedLog.Collection} - {selectedLog.Action}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => setSelectedLog(null)}
            >
              {t("activityLogs.close", "Close")}
            </button>
          </div>

          {detailsLoading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader color="var(--p-blue)" />
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900 md:grid-cols-2">
                <div>
                  <div className="text-gray-500">{t("activityLogs.userName", "User Name")}</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedLog?.userDetails?.name || t("activityLogs.notAvailable", "N/A")}
                  </div>
                </div>
                {businesses.length !== 1 && (
                <div>
                  <div className="text-gray-500">{t("activityLogs.business", "Business")}</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedLog?.businessName || t("activityLogs.notAvailable", "N/A")}
                  </div>
                </div>
                )}
                <div>
                  <div className="text-gray-500">{t("activityLogs.reference", "Reference")}</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedLog?.documentRef || t("activityLogs.notAvailable", "N/A")}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">{t("activityLogs.dateTime", "Date Time")}</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDateTime(selectedLog?.Date || selectedLog?.createdAt)}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-gray-500">{t("activityLogs.deviceInfo", "IP / Device")}</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {[selectedLog?.ipAddress, selectedLog?.deviceInfo].filter(Boolean).join(" / ") ||
                      t("activityLogs.notAvailable", "N/A")}
                  </div>
                </div>
              </div>

              <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                {t("activityLogs.changedFields", "Changed Fields")}
              </h3>
              {changes.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
                  {t("activityLogs.noChangesAvailable", "No changes available")}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">{t("activityLogs.field", "Field")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("activityLogs.previousValue", "Previous Value")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("activityLogs.newValue", "New Value")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {changes.map((change) => (
                        <tr key={change.field}>
                          <td className="px-4 py-3 font-medium">
                            {formatActivityFieldLabel(change.field)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {change.previousValue || t("activityLogs.notAvailable", "N/A")}
                          </td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                            {change.newValue || t("activityLogs.notAvailable", "N/A")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <EpcPage
      flush
      title={t("activityLogs.title")}
      subtitle={t(
        "activityLogs.subtitle",
        "Audit trail of user actions across businesses and modules.",
      )}
      action={
        <DateRangeComponent
          startDate={dateRangeStart}
          endDate={dateRangeEnd}
          onApply={handleDateRangeApply}
          onClear={handleDateRangeClear}
          placeholder={t("activityLogs.filterByDateRange", "Filter by date range")}
        />
      }
    >
      <FilterBar
        subtitle={t(
          "activityLogs.filterSubtitle",
          "Narrow by business, module, user, or action.",
        )}
        searchPlaceholder={t(
          "activityLogs.searchPlaceholder",
          "Search module, action, reference...",
        )}
        searchValue={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        values={portalFilterValues}
        onChange={handlePortalFilterChange}
        onReset={clearAllFilters}
        filters={portalFilters}
      />

      <Card>
        <CardHeader
          title={t("activityLogs.title")}
          subtitle={
            fetchingData ? "Loading…" : `${totalResults} total activity logs`
          }
        />
        <PortalDataTable
          columns={columns}
          rows={fetchingData ? [] : tableRows}
          rowKey="_id"
          emptyMessage={
            fetchingData
              ? "Loading activity logs…"
              : t("activityLogs.sorryThereIsNoDataRightNow")
          }
        />
        {!fetchingData && totalResults > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={recordsPerPage}
            total={totalResults}
            itemLabel="activity logs"
            onPageChange={setCurrentPage}
            onPageSizeChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </Card>

      {renderDetailsDrawer()}
    </EpcPage>
  );
};

export default ActivityLogs;
