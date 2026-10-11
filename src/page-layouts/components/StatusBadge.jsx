import React from "react";

const statusColors = {
  // Default colors
  default: "text-gray-500",

  // Specific status colors
  Open: "text-yellow-500",
  Completed: "text-green-500",
  Cancelled: "text-red-500",
  Draft: "text-lime-500",
  "Waiting Management Approval": "text-blue-500",
  "Amendments Requested (Management)": "text-yellow-600",
  "Rejected (Management)": "text-red-600",
  "Preparing Contract": "text-orange-500",
  "Waiting Customer Approval": "text-yellow-500",
  Pending: "text-purple-500",
  Processing: "text-indigo-500",
  Rejected: "text-red-500",
  "On-hold": "text-gray-500",
  Active: "text-green-500",
};

const StatusBadge = ({ status, customColor }) => {
  const colorClass =
    customColor || statusColors[status] || statusColors.default;

  return <span className={`font-medium ${colorClass}`}>{status}</span>;
};

export default StatusBadge;
