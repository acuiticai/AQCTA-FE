import { useMemo } from "react";
import { ClipboardList, CircleCheck, Clock, CircleX, Laptop } from "lucide-react";
import { SummaryCards } from "@/page-layouts/index";

/**
 * Shared stat strip for HR list pages (claims, leaves) using the global SummaryCards layout.
 * Cards always render (zeros until API updates); no full-strip loading spinner.
 *
 * @param {object} props
 * @param {{ total?: number, approved?: number, pending?: number, rejected?: number }} props.stats
 * @param {{ total: string, approved: string, pending: string, rejected: string }} props.labels — pre-translated titles
 * @param {number} [props.columnsCount]
 * @param {"default" | "wfh"} [props.variant] — WFH uses Laptop icon for total
 */
export default function HrListStatsSummaryCards({
  stats = {},
  labels,
  columnsCount = 4,
  variant = "default",
}) {
  const TotalIcon = variant === "wfh" ? Laptop : ClipboardList;

  const cards = useMemo(
    () => [
      {
        title: labels.total,
        value: stats.total ?? 0,
        backgroundColor: "summary-light",
        iconBackdrop: "summary-dark",
        Icon: TotalIcon,
        renderIconAsComponent: true,
      },
      {
        title: labels.approved,
        value: stats.approved ?? 0,
        backgroundColor: "completed-light",
        iconBackdrop: "completed-dark",
        Icon: CircleCheck,
        renderIconAsComponent: true,
      },
      {
        title: labels.pending,
        value: stats.pending ?? 0,
        backgroundColor: "processing-light",
        iconBackdrop: "processing-dark",
        Icon: Clock,
        renderIconAsComponent: true,
      },
      {
        title: labels.rejected,
        value: stats.rejected ?? 0,
        backgroundColor: "overdue-light",
        iconBackdrop: "overdue-dark",
        Icon: CircleX,
        renderIconAsComponent: true,
      },
    ],
    [stats, labels, TotalIcon]
  );

  return (
    <SummaryCards
      cards={cards}
      columnsCount={columnsCount}
      loading={false}
      renderIconAsComponent
    />
  );
}
