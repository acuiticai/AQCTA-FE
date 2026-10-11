import React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { formatDate } from "@/components/formatAmount";
import {
  getAttendanceInOutDisplay,
  getAttendanceIpDisplay,
  getAttendanceStatusColor,
  staffDeptPositionShift,
} from "./hrReportHelpers";

const DetailField = ({ label, value, children, className = "" }) => (
  <div className={className}>
    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
      {label}
    </dt>
    <dd className="mt-1 text-sm text-gray-900 break-words">
      {children ?? value ?? "-"}
    </dd>
  </div>
);

const AttendanceReportDetailModal = ({ record, onClose }) => {
  const { t } = useTranslation();
  if (!record) return null;

  const { department, position, shift } = staffDeptPositionShift(record.staff);
  const { inValue, outValue } = getAttendanceInOutDisplay(record);
  const { checkInIp, checkOutIp } = getAttendanceIpDisplay(record);
  const status = record.status || t("hrReports.common.noRecord");
  const statusColor = getAttendanceStatusColor(record.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-record-detail-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2
            id="attendance-record-detail-title"
            className="text-lg font-semibold text-gray-900"
          >
            {t("hrReports.common.recordDetails")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("common.close", "Close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <DetailField
              label={t("hrReports.common.name")}
              value={record.staff?.displayName || "-"}
            />
            <DetailField
              label={t("hrReports.common.department")}
              value={department}
            />
            <DetailField
              label={t("hrReports.common.position")}
              value={position}
            />
            <DetailField label={t("hrReports.common.shift")} value={shift} />
            <DetailField
              label={t("hrReports.common.date")}
              value={record.date ? formatDate(record.date) : "-"}
            />
            <DetailField label={t("hrReports.common.status")}>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColor}`}
              >
                {status}
              </span>
            </DetailField>
            <DetailField label={t("hrReports.common.in")} value={inValue} />
            <DetailField label={t("hrReports.common.out")} value={outValue} />
            <DetailField
              label={t("hrReports.common.totalHours")}
              value={record.totalHours || "-"}
            />
            <DetailField
              label={t("hrReports.common.overtime")}
              value={record.overTime || "-"}
            />
            <DetailField
              label={t("hrReports.common.checkInIp")}
              value={checkInIp}
            />
            <DetailField
              label={t("hrReports.common.checkOutIp")}
              value={checkOutIp}
            />
          </dl>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900"
          >
            {t("common.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReportDetailModal;
