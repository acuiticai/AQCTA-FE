import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { DataTable } from "@/page-layouts";
import { notifyError, notifySuccess } from "@/utils/toast";
import { syncAssignedBusinessesFromApi, isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";
import RoutePermissionGate from "@/components/RoutePermissionGate";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { AdminContext } from "@/context/AdminContext";
import { formatDate, formatQuantity } from "@/components/formatAmount";
import { SummaryCardRow } from "./reports/reportShared";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ExpiryAlerts = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { canUpdate } = useRouteModulePermissions();
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningAlerts, setRunningAlerts] = useState(false);
  const [expired, setExpired] = useState(0);
  const [soon, setSoon] = useState(0);
  const [days, setDays] = useState(30);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const currentPageRef = useRef(1);

  useEffect(() => {
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      setBusinesses(list || []);
    })();
  }, []);

  const fetchRows = async (
    bizIds = selectedBusinesses,
    page = currentPageRef.current,
    limit = recordsPerPage,
  ) => {
    try {
      setLoading(true);
      let ids = Array.isArray(bizIds) ? bizIds.filter(Boolean) : [];
      if (!ids.length) {
        ids = (businesses || []).map((b) => b._id).filter(Boolean);
      }
      const params = { days };
      if (ids.length) params.businessIds = ids.join(",");

      const res = await axios.get(`${Base_URL}/expiry-alerts`, {
        headers,
        params,
      });
      const all = res.data?.data || [];
      setExpired(res.data?.expired || 0);
      setSoon(res.data?.soon || 0);
      setTotalResults(all.length);
      const skip = (page - 1) * limit;
      setRows(all.slice(skip, skip + limit));
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load expiry alerts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(selectedBusinesses, 1, recordsPerPage);
    setCurrentPage(1);
    currentPageRef.current = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinesses.join(","), days, businesses]);

  const runAlertsNow = async () => {
    try {
      setRunningAlerts(true);
      const res = await axios.post(
        `${Base_URL}/expiry-alerts/run-alerts`,
        { days },
        { headers },
      );
      const d = res.data?.data || {};
      notifySuccess(
        `Alerts sent: ${d.sent || 0} · skipped: ${d.skipped || 0} · already sent today: ${d.dupes || 0}`,
      );
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to run expiry alerts");
    } finally {
      setRunningAlerts(false);
    }
  };

  const clearFilters = () => {
    setSelectedBusinesses([]);
    setDays(30);
    setCurrentPage(1);
    currentPageRef.current = 1;
  };

  const filters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: {
        onClick: clearFilters,
      },
    },
    ...(!isSingleAssignedBusiness() ? [{
      value: selectedBusinesses,
      onChange: (value) => {
        const next = Array.isArray(value) ? value : value ? [value] : [];
        setSelectedBusinesses(next);
      },
      placeholder: t("Business") || "Business",
      isMulti: true,
      options: businesses.map((b) => ({ value: b._id, label: b.name })),
    }] : []),
    {
      value: String(days),
      onChange: (v) => setDays(parseInt(v, 10) || 30),
      placeholder: "Days",
      options: [
        { value: "7", label: "7 days" },
        { value: "14", label: "14 days" },
        { value: "30", label: "30 days" },
        { value: "60", label: "60 days" },
        { value: "90", label: "90 days" },
      ],
    },
  ];

  return (
    <RoutePermissionGate>
      <div className="bg-gray-50 min-h-screen w-full">
        <div className="w-full mx-auto px-6 py-8">
          <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Expiry Alerts</h1>
              <p className="text-gray-600 mt-2">
                Lots that are expired or expiring soon. Daily cron sends in-app
                + email alerts (STOCK_EXPIRY_ALERT). Stock-out uses FEFO when
                expiry dates exist.
              </p>
            </div>
            {canUpdate && (
              <button
                type="button"
                onClick={runAlertsNow}
                disabled={runningAlerts}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--p-blue)] text-white text-sm font-medium disabled:opacity-60"
              >
                <Bell className="w-4 h-4" />
                {runningAlerts ? "Sending..." : "Send alerts now"}
              </button>
            )}
          </div>

          <SummaryCardRow
            cards={[
              { label: "Total alerts", value: totalResults },
              { label: "Expired", value: expired },
              { label: "Expiring soon", value: soon },
            ]}
          />

          <div className="bg-white rounded-xl border overflow-hidden">
            <DataTable
              filters={filters}
              loading={loading}
              headers={[
                "Product",
                "Lot",
                "Qty",
                "Expiry",
                "Days left",
                "Warehouse",
                "Location",
                "Business",
              ]}
              data={rows}
              totalResults={totalResults}
              resultsPerPage={recordsPerPage}
              currentPage={currentPage}
              onPageChange={(page) => {
                setCurrentPage(page);
                currentPageRef.current = page;
                fetchRows(selectedBusinesses, page, recordsPerPage);
              }}
              emptyMessage="No expiring stock in this window."
              renderRow={(row) => (
                <tr key={row._id} className="border-b" style={{ fontSize: "14px" }}>
                  <td className="py-2 px-4">
                    <div>{row.item?.name || "—"}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {row.item?.itemCode || ""}
                    </div>
                  </td>
                  <td className="py-2 px-4 font-mono text-xs">
                    {row.lotNumber || "—"}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {formatQuantity(row.quantity)}
                  </td>
                  <td className="py-2 px-4 text-xs">
                    {row.expiryDate ? formatDate(row.expiryDate) || "—" : "—"}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <span
                      className={
                        row.isExpired
                          ? "text-red-600 font-semibold"
                          : row.daysLeft != null && row.daysLeft <= 7
                            ? "text-amber-600 font-semibold"
                            : ""
                      }
                    >
                      {row.isExpired
                        ? `${Math.abs(row.daysLeft)} overdue`
                        : row.daysLeft}
                    </span>
                  </td>
                  <td className="py-2 px-4">{row.warehouse?.name || "—"}</td>
                  <td className="py-2 px-4">{row.location?.name || "—"}</td>
                  <td className="py-2 px-4">{row.business?.name || "—"}</td>
                </tr>
              )}
            />
          </div>
        </div>
      </div>
    </RoutePermissionGate>
  );
};

export default ExpiryAlerts;
