import React from "react";
import { CustomModal } from "@/page-layouts";
import MarketingWhatsappHistoryPanel from "./MarketingWhatsappHistoryPanel";

const MarketingWhatsappHistoryModal = ({
  open,
  onClose,
  announcementId,
  announcementTitle,
  scheduleLabel,
  runCount,
  authHeaders,
  checkTokenExpired,
  onResendComplete,
}) => (
  <CustomModal
    open={open}
    onClose={onClose}
    title={`History — ${announcementTitle || "Announcement"}`}
    width="820px"
  >
    {(scheduleLabel || runCount != null) && (
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
        {scheduleLabel ? (
          <p>
            <span className="font-medium text-gray-800">Schedule:</span> {scheduleLabel}
          </p>
        ) : null}
        {runCount != null ? (
          <p className={scheduleLabel ? "mt-1" : ""}>
            <span className="font-medium text-gray-800">Total sends:</span> {runCount}
          </p>
        ) : null}
      </div>
    )}
    {open && announcementId ? (
      <MarketingWhatsappHistoryPanel
        key={announcementId}
        announcementId={announcementId}
        authHeaders={authHeaders}
        checkTokenExpired={checkTokenExpired}
        onResendComplete={onResendComplete}
        variant="modal"
      />
    ) : null}
  </CustomModal>
);

export default MarketingWhatsappHistoryModal;
