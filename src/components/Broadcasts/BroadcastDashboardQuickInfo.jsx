import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CalendarClock, AlertCircle } from "lucide-react";
import { SummaryCards, Loader } from "@/page-layouts";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import InProgressSvg from "@/assets/img/in-progress.svg";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ScheduledIcon = ({ className, style }) => (
  <CalendarClock className={className} style={style} />
);

const FailedIcon = ({ className, style }) => (
  <AlertCircle className={className} style={style} />
);

/**
 * KPI row for /broadcasts — totals by status for assigned businesses.
 */
export default function BroadcastDashboardQuickInfo({
  token,
  businessFilter = "",
  businessIds = [],
  className = "",
}) {
  const checkTokenExpired = useCheckTokenExpired();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    draft: 0,
    sent: 0,
    failed: 0,
  });

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
      setStats({ total: 0, scheduled: 0, draft: 0, sent: 0, failed: 0 });
      setLoading(false);
      return;
    }

    let active = true;
    const paramKey = businessFilter ? "business_id" : "business_ids";
    const businessParam = businessFilter ? businessFilter : ids.join(",");
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    };

    const fetchCount = (status) =>
      axios.get(`${Base_URL}/broadcasts`, {
        params: {
          [paramKey]: businessParam,
          ...(status ? { status } : {}),
          limit: 1,
        },
        headers,
        withCredentials: true,
      });

    const load = async () => {
      setLoading(true);
      try {
        const [totalRes, scheduledRes, draftRes, sentRes, failedRes] =
          await Promise.all([
            fetchCount(),
            fetchCount("scheduled"),
            fetchCount("draft"),
            fetchCount("sent"),
            fetchCount("failed"),
          ]);
        if (!active) return;
        checkTokenExpired(totalRes);
        setStats({
          total: totalRes.data?.total ?? 0,
          scheduled: scheduledRes.data?.total ?? 0,
          draft: draftRes.data?.total ?? 0,
          sent: sentRes.data?.total ?? 0,
          failed: failedRes.data?.total ?? 0,
        });
      } catch (e) {
        if (active) {
          console.error(e);
          setStats({ total: 0, scheduled: 0, draft: 0, sent: 0, failed: 0 });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, businessFilter, businessIdsKey]);

  const cards = useMemo(
    () => [
      {
        title: "Total Campaigns",
        value: stats.total,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: "Scheduled",
        value: stats.scheduled,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: ScheduledIcon,
        renderIconAsComponent: true,
      },
      {
        title: "Draft",
        value: stats.draft,
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: InProgressSvg,
      },
      {
        title: "Sent",
        value: stats.sent,
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: "Failed",
        value: stats.failed,
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: FailedIcon,
        renderIconAsComponent: true,
      },
    ],
    [stats],
  );

  if (loading) {
    return (
      <div className={`flex justify-center py-8 ${className}`}>
        <Loader color="var(--p-blue)" />
      </div>
    );
  }

  return (
    <div className={className}>
      <SummaryCards cards={cards} columnsCount={5} />
    </div>
  );
}
