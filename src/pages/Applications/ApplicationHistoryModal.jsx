import React, { useMemo } from "react";
import { CustomModal } from "@/page-layouts";
import { buildApplicationTimeline } from "@/utils/applicationTimeline";

/**
 * Full activity log popup for admin Applications list.
 */
const ApplicationHistoryModal = ({ open, onClose, application }) => {
  const entries = useMemo(
    () => (application ? buildApplicationTimeline(application) : []),
    [application],
  );

  const ref =
    application?.applicationNumber || application?.id || application?._id || "—";

  return (
    <CustomModal
      open={open}
      onClose={onClose}
      title={`Activity log — ${ref}`}
      width="520px"
      showActions
      actions={[
        {
          label: "Close",
          primary: true,
          onClick: onClose,
        },
      ]}
    >
      <div className="space-y-3">
        {application?.status ? (
          <p className="text-sm text-gray-600">
            Current status:{" "}
            <span className="font-medium text-gray-900">
              {application.status}
            </span>
          </p>
        ) : null}

        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No activity recorded yet.
          </p>
        ) : (
          <ol className="m-0 flex max-h-[420px] list-none flex-col gap-4 overflow-y-auto p-0">
            {entries.map((entry, idx) => {
              const tone =
                entry.tone === "done"
                  ? "bg-emerald-500"
                  : entry.tone === "current"
                    ? "bg-[var(--p-blue)]"
                    : "bg-gray-300";
              return (
                <li
                  key={`${entry.title}-${entry.date}-${idx}`}
                  className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3"
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 rounded-full ${tone}`}
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-gray-400">{entry.date}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {entry.title}
                    </span>
                    {entry.note ? (
                      <span className="text-xs text-gray-500 whitespace-pre-wrap">
                        {entry.note}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </CustomModal>
  );
};

export default ApplicationHistoryModal;
