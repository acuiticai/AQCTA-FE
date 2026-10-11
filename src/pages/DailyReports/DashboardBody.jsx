import React from "react";
import { useHistory } from "react-router-dom";
import {
  Eye,
  Edit,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Wallet,
  Activity,
  Receipt,
  Banknote,
} from "lucide-react";
import { formatDate, formatAmount } from "@/components/formatAmount";
import {
  CollectionsByChannel,
  CollectionsTrendChart,
  CashFlowChart,
  ShiftsPerformanceChart,
  KpiHeroCard,
  SectionHeader,
  fmtRm,
} from "./DashboardCharts";

export default function DashboardBody({
  summary,
  netFlowPositive,
  totalChannelAmount,
  channelChartData,
  collectionsTrend,
  cashFlowData,
  shiftsData,
  recentReports,
  canCreate,
  canView,
  canUpdate,
  getStatusBadge,
}) {
  const history = useHistory();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiHeroCard
          title="Today's Collections"
          value={fmtRm(summary.todayCollections)}
          subtitle={`Week: ${fmtRm(summary.weekCollections)}`}
          icon={DollarSign}
          accent="#1d9e6b"
        />
        <KpiHeroCard
          title="Net Cash Flow"
          value={fmtRm(summary.netCashFlow)}
          subtitle={netFlowPositive ? "Positive balance" : "Negative balance"}
          icon={Wallet}
          accent={netFlowPositive ? "#1d9e6b" : "#e85555"}
        />
        <KpiHeroCard
          title="Outstanding Advances"
          value={fmtRm(summary.outstandingAdvances)}
          subtitle={`${summary.advancesCount || 0} open advance(s)`}
          icon={Receipt}
          accent="#8B5CF6"
        />
        <KpiHeroCard
          title="Total Collections"
          value={fmtRm(summary.totalCollections)}
          subtitle={`${summary.reportCount || 0} report(s) in range`}
          icon={Banknote}
          accent="#0C2E5A"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Payouts", value: fmtRm(summary.totalPayouts) },
          { label: "Staff Advances", value: fmtRm(summary.totalAdvances) },
          { label: "Channel Total", value: fmtRm(totalChannelAmount) },
          { label: "Reports", value: String(summary.reportCount || 0) },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">
              {m.label}
            </p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
        <SectionHeader
          icon={PieChartIcon}
          badge={
            channelChartData.length > 0
              ? `${channelChartData.length} channel${channelChartData.length !== 1 ? "s" : ""}`
              : undefined
          }
        >
          Collections by Channel
        </SectionHeader>
        <div className="p-6">
          {channelChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <DollarSign className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-sm">No collection data available</p>
            </div>
          ) : (
            <CollectionsByChannel
              channels={channelChartData}
              totalAmount={totalChannelAmount}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
          <SectionHeader icon={TrendingUp}>Collections Trend</SectionHeader>
          <div className="p-4">
            <CollectionsTrendChart data={collectionsTrend} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
          <SectionHeader icon={Activity}>Cash Flow Overview</SectionHeader>
          <div className="p-4">
            <CashFlowChart data={cashFlowData} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
        <SectionHeader
          icon={BarChart3}
          badge={shiftsData.length ? `${shiftsData.length} shifts` : undefined}
        >
          Shifts Performance
        </SectionHeader>
        <div className="p-4">
          <ShiftsPerformanceChart
            shiftsData={shiftsData}
            formatAmount={formatAmount}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 shadow-md bg-white overflow-hidden">
        <SectionHeader icon={Calendar} badge="Latest 5">
          Recent Reports
        </SectionHeader>
        <div className="p-6">
          {recentReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Calendar className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-sm">No reports yet</p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() =>
                    history.push("/daily-reports/create", {
                      returnTo: "/daily-reports/dashboard",
                    })
                  }
                  className="mt-3 text-sm font-medium hover:underline"
                  style={{ color: "var(--p-blue)" }}
                >
                  Create your first report
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4 -mt-2">
                <button
                  type="button"
                  onClick={() => history.push("/daily-reports-collection")}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--p-blue)" }}
                >
                  View all reports →
                </button>
              </div>
              <div className="space-y-2">
                {recentReports.slice(0, 5).map((report) => (
                  <div
                    key={report._id}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50/80 hover:bg-gray-100 border border-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-white rounded-xl p-2.5 shadow-sm border border-gray-100 flex-shrink-0">
                        <Calendar
                          className="w-5 h-5"
                          style={{ color: "var(--p-blue)" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">
                          {formatDate(report.businessDate)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {report.shiftSnapshot?.name || report.shiftId?.name
                            ? `${report.shiftSnapshot?.name || report.shiftId?.name} Shift`
                            : report.shiftNo === 1
                              ? "Morning Shift"
                              : report.shiftNo === 2
                                ? "Evening Shift"
                                : report.shiftNo != null
                                  ? `Shift ${report.shiftNo}`
                                  : "Shift"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getStatusBadge(report.status)}`}
                      >
                        {report.status}
                      </span>
                      {canView && (
                        <button
                          type="button"
                          onClick={() =>
                            history.push(`/daily-reports/view/${report._id}`, {
                              returnTo: "/daily-reports/dashboard",
                            })
                          }
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {canUpdate && report.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() =>
                            history.push(`/daily-reports/edit/${report._id}`, {
                              returnTo: "/daily-reports/dashboard",
                            })
                          }
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
