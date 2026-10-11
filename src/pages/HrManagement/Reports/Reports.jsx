import {
  CalendarCheck,
  UserRoundCheck,
  Timer,
  Clock,
  ChartPie,
  CalendarDays,
  BarChart3,
  ChevronRight,
  IdCard,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { PageHeader } from "@/page-layouts/index";
import {
  HR_PAGE_INNER,
  HR_PAGE_SHELL,
} from "../components/hrPageHeaderStyles";

const Reports = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const reports = [
    {
      id: 1,
      title: t("hrReports.attendanceReport.title"),
      subtitle: t("hrReports.attendanceReport.subtitle"),
      icon: CalendarCheck,
      link: "/attendance-report",
    },
    {
      id: 2,
      title: t("hrReports.attendancePercentageReport.title"),
      subtitle: t("hrReports.attendancePercentageReport.subtitle"),
      icon: UserRoundCheck,
      link: "/attendance-percentage-report",
    },
    {
      id: 3,
      title: t("hrReports.latenessReport.title"),
      subtitle: t("hrReports.latenessReport.subtitle"),
      icon: Timer,
      link: "/lateness-summary-report",
    },
    {
      id: 4,
      title: t("hrReports.workingHoursReport.title"),
      subtitle: t("hrReports.workingHoursReport.subtitle"),
      icon: Clock,
      link: "/working-hours-report",
    },
    {
      id: 5,
      title: t("hrReports.overtimeReport.title"),
      subtitle: t("hrReports.overtimeReport.subtitle"),
      icon: Timer,
      link: "/overtime-report",
    },
    {
      id: 6,
      title: t("hrReports.leaveTakenReport.title"),
      subtitle: t("hrReports.leaveTakenReport.subtitle"),
      icon: IdCard,
      link: "/leave-taken-report",
    },
    {
      id: 7,
      title: t("hrReports.leaveUtilizationReport.title"),
      subtitle: t("hrReports.leaveUtilizationReport.subtitle"),
      icon: ChartPie,
      link: "/leave-utilization-report",
    },
    {
      id: 8,
      title: t("hrReports.staffLeaveBalance.title"),
      subtitle: t("hrReports.staffLeaveBalance.subtitle"),
      icon: Users,
      link: "/staff-leave-balance",
    },
    // {
    //   id: 8,
    //   title: "Comparison Report",
    //   subtitle: "Comparison report by department and/or position.",
    //   icon: BarChart3,
    //   bgColor: "bg-[#F9F9FA]",
    //   link: "#",
    // },
    {
      id: 9,
      title: t("hrReports.eventPerformanceReport.title"),
      subtitle: t("hrReports.eventPerformanceReport.subtitle"),
      icon: CalendarDays,
      link: "/event-performance-report",
    },
    {
      id: 10,
      title: t("hrReports.workPassExpiryReport.title"),
      subtitle: t("hrReports.workPassExpiryReport.subtitle"),
      icon: IdCard,
      link: "/work-pass-expiry-report",
    },
  ];

  return (
    <div className={HR_PAGE_SHELL}>
      <div className={HR_PAGE_INNER}>
        <PageHeader
          variant="large"
          title={t("hrReports.title")}
          description={t("hrReports.pageDescription")}
          showAddButton={false}
        />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
        {reports.map((report) => {
          const IconComponent = report.icon;
          return (
            <div
              key={report.id}
              role="button"
              tabIndex={0}
              className="group relative flex min-h-[195px] min-w-[200px] flex-1 cursor-pointer flex-col items-start justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[var(--p-blue)] hover:bg-[rgba(var(--p-blue-rgb),0.08)] hover:shadow-md"
              onClick={() => history.push(report.link)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  history.push(report.link);
                }
              }}
            >
              <div className="flex flex-1 flex-col">
                <div className="mb-3">
                  <IconComponent className="h-12 w-12 text-gray-600 transition-colors duration-200 group-hover:text-[var(--p-blue)]" />
                </div>

                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-medium leading-tight text-gray-900 transition-colors duration-200 group-hover:text-[var(--p-blue)]">
                    {report.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">
                    {report.subtitle}
                  </p>
                </div>
              </div>

              <div className="absolute right-2 top-3 self-end">
                <ChevronRight className="h-5 w-5 text-gray-400 transition-colors duration-200 group-hover:text-[var(--p-blue)]" />
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default Reports;
