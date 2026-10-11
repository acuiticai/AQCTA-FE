import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  CalendarClock,
  CalendarRange,
  AlertTriangle,
  XCircle,
  Ban,
  Wallet,
} from "lucide-react";
import { SummaryCards, Loader } from "@/page-layouts";
import { formatAmount } from "@/components/formatAmount";
import { notifyError } from "@/utils/toast";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import CompletedSvg from "@/assets/img/completed.svg";
import DelayedSvg from "@/assets/img/delayed.svg";
import { makeChequeT } from "@/utils/chequeI18n";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emptySummary = () => ({
  dueToday: { count: 0, totalAmount: 0 },
  dueTomorrow: { count: 0, totalAmount: 0 },
  dueThisWeek: { count: 0, totalAmount: 0 },
  overdue: { count: 0, totalAmount: 0 },
  pending: { count: 0, totalAmount: 0 },
  cleared: { count: 0, totalAmount: 0 },
  bounced: { count: 0, totalAmount: 0 },
  cancelled: { count: 0, totalAmount: 0 },
});

/**
 * Alerts banner + KPI summary cards (shared by list & dashboard).
 */
export default function ChequeDashboardQuickInfo({
  token,
  businessFilter = "",
  businessIds = [],
  hideViewChequesLink = false,
  onViewCheques,
  className = "",
}) {
  const { t } = useTranslation();
  const cq = makeChequeT(t);
  const checkTokenExpired = useCheckTokenExpired();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(emptySummary());
  const [alerts, setAlerts] = useState(null);

  const businessIdsKey = useMemo(
    () => (Array.isArray(businessIds) ? businessIds.map(String).join(",") : ""),
    [businessIds],
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const ids =
      businessFilter && String(businessFilter).trim()
        ? [businessFilter]
        : businessIds.filter(Boolean);
    if (!ids.length) {
      setSummary(emptySummary());
      setAlerts(null);
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params =
          businessFilter && String(businessFilter).trim()
            ? { business_id: businessFilter }
            : { business_ids: ids.join(",") };
        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        };
        const [response, alertsRes] = await Promise.all([
          axios.get(`${Base_URL}/cheques/dashboard`, {
            params,
            headers,
            withCredentials: true,
          }),
          axios.get(`${Base_URL}/cheques/alerts`, {
            params,
            headers,
            withCredentials: true,
          }),
        ]);
        if (!active) return;
        checkTokenExpired(response);
        setAlerts(alertsRes.data || null);
        setSummary({ ...emptySummary(), ...(response.data?.data?.summary || {}) });
      } catch (e) {
        if (active) {
          console.error(e);
          notifyError(
            e.response?.data?.error ||
              cq(
                "dashboard.quickInfo.errors.loadFailed",
                "Failed to load cheque summary",
              ),
          );
          setSummary(emptySummary());
          setAlerts(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
    // checkTokenExpired is recreated each render — must not be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, businessFilter, businessIdsKey]);

  const dueDateCards = useMemo(() => {
    const s = summary;
    return [
      {
        title: cq("dashboard.quickInfo.dueToday", "Due today"),
        value: s.dueToday.count,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: Calendar,
        renderIconAsComponent: true,
        tooltip: cq(
          "dashboard.quickInfo.tooltipOutstanding",
          "{{amount}} outstanding · {{count}} cheques",
          {
            amount: formatAmount(s.dueToday.totalAmount || 0),
            count: s.dueToday.count,
          },
        ),
      },
      {
        title: cq("dashboard.quickInfo.dueTomorrow", "Due tomorrow"),
        value: s.dueTomorrow.count,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: CalendarClock,
        renderIconAsComponent: true,
        tooltip: cq(
          "dashboard.quickInfo.tooltipOutstanding",
          "{{amount}} outstanding · {{count}} cheques",
          {
            amount: formatAmount(s.dueTomorrow.totalAmount || 0),
            count: s.dueTomorrow.count,
          },
        ),
      },
      {
        title: cq("dashboard.quickInfo.dueThisWeek", "Due this week"),
        value: s.dueThisWeek.count,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CalendarRange,
        renderIconAsComponent: true,
        tooltip: cq(
          "dashboard.quickInfo.tooltipOutstanding",
          "{{amount}} outstanding · {{count}} cheques",
          {
            amount: formatAmount(s.dueThisWeek.totalAmount || 0),
            count: s.dueThisWeek.count,
          },
        ),
      },
      {
        title: cq("dashboard.quickInfo.overdue", "Overdue"),
        value: s.overdue.count,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: DelayedSvg,
        isHighlighted: s.overdue.count > 0,
        highlightColor: "processing-light",
        tooltip: cq(
          "dashboard.quickInfo.tooltipOutstanding",
          "{{amount}} outstanding · {{count}} cheques",
          {
            amount: formatAmount(s.overdue.totalAmount || 0),
            count: s.overdue.count,
          },
        ),
      },
    ];
  }, [summary, t, cq]);

  const liabilityCards = useMemo(() => {
    const s = summary;
    return [
      {
        title: cq("dashboard.quickInfo.pendingLiability", "Pending liability"),
        value: formatAmount(s.pending.totalAmount || 0),
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: Wallet,
        renderIconAsComponent: true,
        tooltip: cq(
          "dashboard.quickInfo.tooltipPendingLiability",
          "{{count}} cheques · Draft, Issued, Due Soon",
          { count: s.pending.count },
        ),
      },
      {
        title: cq("dashboard.quickInfo.clearedAllTime", "Cleared (all time)"),
        value: formatAmount(s.cleared.totalAmount || 0),
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
        tooltip: cq(
          "dashboard.quickInfo.tooltipCleared",
          "{{count}} cleared cheques",
          { count: s.cleared.count },
        ),
      },
      {
        title: cq("dashboard.quickInfo.bounced", "Bounced"),
        value: formatAmount(s.bounced.totalAmount || 0),
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: XCircle,
        renderIconAsComponent: true,
        tooltip: cq(
          "dashboard.quickInfo.tooltipBounced",
          "{{count}} bounced",
          { count: s.bounced.count },
        ),
      },
      {
        title: cq("dashboard.quickInfo.cancelled", "Cancelled"),
        value: formatAmount(s.cancelled.totalAmount || 0),
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: Ban,
        renderIconAsComponent: true,
        tooltip: cq(
          "dashboard.quickInfo.tooltipCancelled",
          "{{count}} cancelled",
          { count: s.cancelled.count },
        ),
      },
    ];
  }, [summary, t, cq]);

  const showAlerts =
    alerts && (alerts.dueToday > 0 || alerts.dueTomorrow > 0 || alerts.overdue > 0);

  if (loading) {
    return (
      <div className={`flex justify-center py-8 ${className}`}>
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showAlerts ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-amber-950">
            <span className="font-semibold inline-flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {cq("dashboard.quickInfo.alertsTitle", "Cheque alerts")}
            </span>
            {alerts.overdue > 0 ? (
              <span>
                {cq("dashboard.quickInfo.alertsOverdue", "{{count}} overdue", {
                  count: alerts.overdue,
                })}
              </span>
            ) : null}
            {alerts.dueToday > 0 ? (
              <span>
                {cq(
                  "dashboard.quickInfo.alertsDueToday",
                  "{{count}} due today",
                  { count: alerts.dueToday },
                )}
              </span>
            ) : null}
            {alerts.dueTomorrow > 0 ? (
              <span>
                {cq(
                  "dashboard.quickInfo.alertsDueTomorrow",
                  "{{count}} due tomorrow",
                  { count: alerts.dueTomorrow },
                )}
              </span>
            ) : null}
            {!hideViewChequesLink && typeof onViewCheques === "function" ? (
              <button
                type="button"
                onClick={onViewCheques}
                className="ml-auto text-[var(--p-blue)] font-medium hover:underline"
              >
                {cq("dashboard.quickInfo.viewCheques", "View cheques")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <SummaryCards cards={dueDateCards} columnsCount={4} />
      <SummaryCards cards={liabilityCards} columnsCount={4} />
    </div>
  );
}
