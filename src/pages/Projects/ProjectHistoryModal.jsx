import React, { useMemo } from "react";
import { CustomModal } from "@/page-layouts";
import {
  buildApplicationTimeline,
  formatTimelineDate,
} from "@/utils/applicationTimeline";

/**
 * Activity log for a project — project milestones plus the linked
 * application's review history (same log the Applications list uses).
 */
const ProjectHistoryModal = ({ open, onClose, project }) => {
  const entries = useMemo(() => {
    if (!project) return [];

    const milestones = [];
    if (project.quotationAcceptedAt || project.createdAt) {
      milestones.push({
        date: formatTimelineDate(
          project.quotationAcceptedAt || project.createdAt,
        ),
        title: "Project opened",
        note: project.quotationAcceptedBy
          ? `Accepted by ${project.quotationAcceptedBy}`
          : project.quotationRef
            ? `From quotation ${project.quotationRef}`
            : "",
        tone: "done",
        _at: new Date(
          project.quotationAcceptedAt || project.createdAt || 0,
        ).getTime(),
      });
    }
    if (project.invoiceRaisedAt || project.invoiceNumber) {
      milestones.push({
        date: formatTimelineDate(
          project.invoiceRaisedAt || project.updatedAt,
        ),
        title: "Invoice raised",
        note: [project.invoiceNumber, project.invoiceStatus]
          .filter(Boolean)
          .join(" · "),
        tone: "done",
        _at: new Date(
          project.invoiceRaisedAt || project.updatedAt || 0,
        ).getTime(),
      });
    }

    const hasReviewHistory =
      Array.isArray(project.reviewHistory) && project.reviewHistory.length > 0;

    if (hasReviewHistory) {
      const sortedHistory = [...project.reviewHistory].sort(
        (a, b) =>
          new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
      );
      const reviewEntries = buildApplicationTimeline(project).map(
        (entry, idx) => ({
          ...entry,
          _at: new Date(sortedHistory[idx]?.at || 0).getTime(),
        }),
      );
      return [...milestones, ...reviewEntries]
        .sort((a, b) => (b._at || 0) - (a._at || 0))
        .map(({ _at, ...rest }) => rest);
    }

    return milestones
      .sort((a, b) => (b._at || 0) - (a._at || 0))
      .map(({ _at, ...rest }) => rest);
  }, [project]);

  const ref =
    project?.projectNumber ||
    project?.applicationNumber ||
    project?._id ||
    "—";

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
        {project?.status ? (
          <p className="text-sm text-gray-600">
            Current status:{" "}
            <span className="font-medium text-gray-900">{project.status}</span>
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

export default ProjectHistoryModal;
