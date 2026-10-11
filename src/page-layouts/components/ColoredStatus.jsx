export const ColoredStatus = ({ status, label }) => {
  switch (status) {
    case "active":
      return (
        <span className="font-medium text-completed-dark">
          {label || "Active"}
        </span>
      );
    case "inactive":
      return (
        <span className="font-medium text-pending-dark">
          {label || "Inactive"}
        </span>
      );
    case "deleted":
      return (
        <span className="font-medium text-rejected">{label || "Deleted"}</span>
      );
    case "pending":
      return (
        <span className="font-medium text-pending-dark">
          {label || "Pending"}
        </span>
      );
    case "pending-approval":
      return (
        <span className="font-medium text-pending-dark">
          {label || "Pending Approval"}
        </span>
      );
    case "processing":
      return (
        <span className="font-medium text-processing-dark">
          {label || "Processing"}
        </span>
      );
    case "in-progress":
      return (
        <span className="font-medium text-in-progress-dark">
          {label || "In Progress"}
        </span>
      );
    case "completed":
      return (
        <span className="font-medium text-completed-dark">
          {label || "Completed"}
        </span>
      );
    case "overdue":
      return (
        <span className="font-medium text-overdue-dark">
          {label || "Overdue"}
        </span>
      );
    case "rejected":
      return (
        <span className="font-medium text-rejected">{label || "Rejected"}</span>
      );
    case "delayed":
      return (
        <span className="font-medium text-overdue">{label || "Delayed"}</span>
      );
    default:
      return (
        <span className="font-medium text-pending-dark">
          {label || "Pending"}
        </span>
      );
  }
};
