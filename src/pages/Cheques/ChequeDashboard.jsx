import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  CalendarClock,
  AlertTriangle,
  Landmark,
  List,
  Eye,
  TrendingUp,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PageHeader, Loader } from "@/page-layouts";
import { AdminContext } from "@/context/AdminContext";
import { formatAmount } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { makeChequeT, translateChequeStatus } from "@/utils/chequeI18n";
import ChequeDashboardCalendar from "./ChequeDashboardCalendar";
import ChequeDashboardQuickInfo from "@/components/cheques/ChequeDashboardQuickInfo";
import ChequeQuickViewModal from "./ChequeQuickViewModal";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const map = {
    Draft: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    Issued: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
    "Due Soon":
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    Cleared:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    Bounced: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    Cancelled: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    Replaced:
      "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  };
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || "bg-gray-100 text-gray-800"}`}
    >
      {translateChequeStatus(t, status)}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  accentClass = "from-[var(--p-blue)] to-indigo-600",
}) {
  return (
    <div className="flex items-start gap-3 mb-1">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accentClass} text-white shadow-md`}
      >
        <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900 dark:text-gray-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PanelHeader({ title, Icon, count, accentClass }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100/80 px-5 py-4 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-800/30">
      <div className="flex items-center gap-3 min-w-0">
        {Icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accentClass} text-white shadow-sm`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </span>
        ) : null}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">
          {title}
        </h3>
      </div>
      <span className="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-600 px-2.5 py-1 rounded-full tabular-nums shadow-sm">
        {count}
      </span>
    </div>
  );
}

function DueChequePanel({
  title,
  icon: Icon,
  rows,
  emptyMessage,
  onPreview,
  accentClass,
}) {
  const { t } = useTranslation();
  const cq = makeChequeT(t);

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 overflow-hidden flex flex-col min-h-[200px] max-h-[360px] ring-1 ring-slate-900/5">
      <PanelHeader
        title={title}
        Icon={Icon}
        count={rows.length}
        accentClass={accentClass}
      />
      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 mb-3">
            <Icon className="h-5 w-5 text-slate-400" />
          </span>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
              <tr className="border-b border-slate-100 dark:border-gray-800">
                <th className="w-[28%] text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {cq("fields.chequeNumberShort", "Cheque #")}
                </th>
                <th className="w-[38%] text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {cq("fields.vendor", "Vendor")}
                </th>
                <th className="w-[24%] text-right py-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {cq("fields.amount", "Amount")}
                </th>
                <th
                  className="w-10 py-2 px-1"
                  aria-label={cq("list.actions.view", "View")}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 dark:border-gray-800/80 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-gray-100 truncate">
                    {row.chequeNumber || "—"}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-gray-300 truncate">
                    {row.vendorDisplay || "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm font-medium text-slate-900 dark:text-gray-100 whitespace-nowrap">
                    {formatAmount(row.amount || 0)}
                  </td>
                  <td className="py-2.5 px-1 text-center">
                    <button
                      type="button"
                      onClick={() => onPreview(row)}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-[var(--p-blue)] hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                      title={cq("dashboard.viewDetails", "View details")}
                      aria-label={cq(
                        "dashboard.viewDetailsAria",
                        "View details for {{chequeNumber}}",
                        {
                          chequeNumber:
                            row.chequeNumber ||
                            cq(
                              "dashboard.viewDetailsAriaFallback",
                              "cheque",
                            ),
                        },
                      )}
                    >
                      <Eye className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const ChartTooltip = ({ active, payload }) => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);

  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-gray-600 dark:bg-gray-900">
      <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 max-w-[200px] truncate">
        {p?.fullName}
      </p>
      <p className="text-sm font-bold text-slate-900 dark:text-white">
        {formatAmount(p?.amount || 0)}
      </p>
      <p className="text-xs text-slate-500">
        {cq("dashboard.chequeCountTooltip", "{{count}} cheque(s)", {
          count: p?.count || 0,
        })}
      </p>
    </div>
  );
};

const ChequeDashboard = () => {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const adminId = adminInfo?.id || adminInfo?._id;

  const [loading, setLoading] = useState(true);
  const [businessFilter, setBusinessFilter] = useState("");
  const [assignedBusinessIds, setAssignedBusinessIds] = useState([]);
  const [bankWise, setBankWise] = useState([]);
  const [dueTodayList, setDueTodayList] = useState([]);
  const [dueTomorrowList, setDueTomorrowList] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewChequeId, setQuickViewChequeId] = useState(null);

  const openChequePreview = (row) => {
    if (!row?._id) return;
    setQuickViewChequeId(row._id);
    setQuickViewOpen(true);
  };

  const fetchDashboard = async () => {
    if (!adminInfo?.token) {
      setLoading(false);
      return;
    }
    const ids =
      businessFilter && String(businessFilter).trim()
        ? [businessFilter]
        : assignedBusinessIds;
    if (!ids.length) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params =
        businessFilter && String(businessFilter).trim()
          ? { business_id: businessFilter }
          : { business_ids: ids.join(",") };

      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      };
      const response = await axios.get(`${Base_URL}/cheques/dashboard`, {
        params,
        headers,
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;
      const data = response.data?.data || {};
      setBankWise(data.bankWise || []);
      setDueTodayList(data.dueTodayList || []);
      setDueTomorrowList(data.dueTomorrowList || []);
      setOverdueList(data.overdueList || []);
      setStatusBreakdown(data.statusBreakdown || []);
    } catch (e) {
      console.error(e);
      notifyError(
        e.response?.data?.error ||
          cq("dashboard.errors.loadFailed", "Failed to load cheque dashboard"),
      );
      setBankWise([]);
      setDueTodayList([]);
      setDueTomorrowList([]);
      setOverdueList([]);
      setStatusBreakdown([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminInfo?.token) return;
    if (!businessFilter && assignedBusinessIds.length === 0) return;
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessFilter, adminInfo?.token, assignedBusinessIds.join(",")]);

  const viewCheque = (id) => history.push(`/Cheques/${id}`);

  const bankFallback = cq("dashboard.bankFallback", "Bank");
  const bankChartData = useMemo(
    () =>
      bankWise.map((b, i) => ({
        name:
          b.bankAccountLabel && b.bankAccountLabel.length > 24
            ? `${b.bankAccountLabel.slice(0, 22)}…`
            : b.bankAccountLabel || bankFallback,
        fullName: b.bankAccountLabel,
        amount: b.totalAmount || 0,
        count: b.count || 0,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [bankWise, bankFallback],
  );

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-gray-900">
      <PageHeader
        variant="large"
        title={cq("dashboard.title", "Cheque Dashboard")}
        description={cq(
          "dashboard.description",
          "Track upcoming liabilities, bank commitments, and cheque status at a glance.",
        )}
        filters={
          adminId
            ? [
                {
                  name: "business",
                  type: "select",
                  isBusinessDropdown: true,
                  businessDropdownProps: {
                    adminId,
                    selectedBusiness: businessFilter || "",
                    onChange: (value) => setBusinessFilter(value || ""),
                    setAssignedBusinesses: setAssignedBusinessIds,
                    placeholder: cq(
                      "dashboard.allBusinesses",
                      "All Businesses",
                    ),
                    style: { width: "270px" },
                  },
                },
              ]
            : []
        }
        showAddButton
        addButtonText={cq("dashboard.newCheque", "New cheque")}
        onAddNew={() => history.push("/Cheques/new")}
        renderActions={
          <div
            key="all-cheques"
            className="!p-0 !bg-transparent !shadow-none !rounded-none"
          >
            <button
              type="button"
              onClick={() => history.push("/Cheques")}
              className="!bg-white !text-slate-700 border border-slate-200 hover:!bg-slate-50 dark:!bg-gray-800 dark:!text-gray-200 dark:border-gray-600 inline-flex items-center gap-2 h-[40px] px-4 py-2 text-sm rounded-xl"
            >
              <List className="w-4 h-4" />
              {cq("dashboard.allCheques", "All cheques")}
            </button>
          </div>
        }
      />
      <ChequeDashboardQuickInfo
        token={adminInfo?.token}
        businessFilter={businessFilter}
        businessIds={assignedBusinessIds}
        onViewCheques={() => history.push("/Cheques")}
      />
      {loading ? (
        <div className="flex flex-col items-center justify-center h-56 gap-3">
          <Loader color="var(--p-blue)" />
          <p className="text-sm text-slate-500">
            {cq("dashboard.loading", "Loading dashboard…")}
          </p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <section className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 p-5 md:p-6 ring-1 ring-slate-900/5">
              <SectionTitle
                icon={Building2}
                title={cq(
                  "dashboard.bankWiseCommitments",
                  "Bank-wise commitments",
                )}
                subtitle={cq(
                  "dashboard.bankWiseCommitmentsSubtitle",
                  "Outstanding amounts by bank (Draft, Issued, Due Soon with a due date)",
                )}
                accentClass="from-blue-600 to-indigo-600"
              />
              <div className="mt-5">
                {bankChartData.length === 0 ? (
                  <div className="h-72 flex flex-col items-center justify-center rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-dashed border-slate-200 dark:border-gray-700">
                    <Landmark className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">
                      {cq(
                        "dashboard.noBankCommitments",
                        "No outstanding bank commitments",
                      )}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={bankChartData}
                      margin={{ top: 12, right: 12, left: 4, bottom: 56 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        angle={-28}
                        textAnchor="end"
                        height={72}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v) => formatAmount(v)}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "rgba(59,130,246,0.06)" }}
                      />
                      <Bar
                        dataKey="amount"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={48}
                      >
                        {bankChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 p-5 md:p-6 ring-1 ring-slate-900/5">
              <SectionTitle
                icon={TrendingUp}
                title={cq("dashboard.byStatus", "By status")}
                subtitle={cq(
                  "dashboard.byStatusSubtitle",
                  "Count and total amount per status",
                )}
                accentClass="from-violet-600 to-purple-600"
              />
              <ul className="mt-5 space-y-2">
                {statusBreakdown.length === 0 ? (
                  <li className="text-sm text-slate-500 py-8 text-center">
                    {cq("dashboard.noChequeDataYet", "No cheque data yet.")}
                  </li>
                ) : (
                  statusBreakdown.map((row) => (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 dark:bg-gray-800/50 px-3 py-2.5 border border-slate-100/80 dark:border-gray-700/80"
                    >
                      <StatusBadge status={row.status} />
                      <span className="text-xs font-semibold text-slate-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                        {row.count} · {formatAmount(row.totalAmount || 0)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          {/* Due lists */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
            <DueChequePanel
              title={cq("dashboard.dueToday", "Due today")}
              icon={Calendar}
              rows={dueTodayList}
              emptyMessage={cq(
                "dashboard.emptyDueToday",
                "No cheques due today — you're clear for the day.",
              )}
              onPreview={openChequePreview}
              accentClass="from-sky-500 to-blue-600"
            />
            <DueChequePanel
              title={cq("dashboard.dueTomorrow", "Due tomorrow")}
              icon={CalendarClock}
              rows={dueTomorrowList}
              emptyMessage={cq(
                "dashboard.emptyDueTomorrow",
                "Nothing scheduled for tomorrow.",
              )}
              onPreview={openChequePreview}
              accentClass="from-violet-500 to-indigo-600"
            />
            <DueChequePanel
              title={cq("dashboard.overdue", "Overdue")}
              icon={AlertTriangle}
              rows={overdueList}
              emptyMessage={cq(
                "dashboard.emptyOverdue",
                "No overdue cheques — great job.",
              )}
              onPreview={openChequePreview}
              accentClass="from-rose-500 to-red-600"
            />
          </div>
        </>
      )}

      <ChequeQuickViewModal
        open={quickViewOpen}
        onClose={() => {
          setQuickViewOpen(false);
          setQuickViewChequeId(null);
        }}
        chequeId={quickViewChequeId}
        token={adminInfo?.token}
      />

      {(businessFilter || assignedBusinessIds.length > 0) && (
        <div className="mt-6">
          <ChequeDashboardCalendar
            adminToken={adminInfo?.token}
            businessFilter={businessFilter}
            assignedBusinessIds={assignedBusinessIds}
            checkTokenExpired={checkTokenExpired}
            onSelectCheque={viewCheque}
          />
        </div>
      )}
    </div>
  );
};

export default ChequeDashboard;
