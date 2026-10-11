// Category colors
export const categoryColors = {
  "Purchase Contract": "#eab308", // Medium Amber
  "Sales Contract": "#22c55e", // Medium Green
  "HR Event": "#f59e42", // Medium Orange
  Leave: "#4ade80", // Medium Green
  WFH: "#14b8a6", // Unique Teal
};

// Grouped category colors for Legend - matching database schema
export const groupedCategoryColors = {
  Purchase: "#eab308", // Medium Amber (from Purchase Contract)
  Sales: "#22c55e", // Medium Green (from Sales Contract)
  HR: "#f59e42", // Medium Orange (from HR Event)
  Accounts: "#8b5cf6", // Purple for Accounts
  "Treasury & Finance": "#06b6d4", // Cyan for Treasury & Finance
  Other: "#6b7280", // Gray for Other
};

// Priority colors (for borders/accent)
export const priorityColors = {
  urgent: "#dc2626", // Red
  high: "#ea580c", // Orange
  medium: "#2563eb", // Blue
  low: "#16a34a", // Green
};

// Category grouping function - matching database schema
export const getCategoryGroup = (category) => {
  switch (category) {
    case "Purchase Contract":
      return "Purchase";
    case "Sales Contract":
      return "Sales";
    case "HR Event":
    case "Leave":
    case "WFH":
      return "HR";
    default:
      return "Other";
  }
};

// Get color for grouped category
export const getGroupedCategoryColor = (groupedCategory) => {
  return groupedCategoryColors[groupedCategory] || "#6b7280"; // Default gray
};

// Get all available categories
export const getAllCategories = () => {
  return Object.keys(categoryColors);
};

// Get categories by group
export const getCategoriesByGroup = () => {
  const categories = getAllCategories();
  const grouped = {};

  categories.forEach((category) => {
    const group = getCategoryGroup(category);
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(category);
  });

  return grouped;
};

// Filter options for calendar
export const filterOptions = {
  priority: [
    { label: "All Priorities", value: "all" },
    { label: "Urgent", value: "urgent" },
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
  ],
  category: [{ label: "All Categories", value: "all" }],
};

// Grouped category options for dropdown - matching database schema
export const groupedCategoryOptions = [
  {
    label: "Purchase",
    options: [
      {
        label: "Purchase Contract",
        value: "Purchase Contract",
        subModule: "Purchase.Purchase Contract",
      },
    ],
  },
  {
    label: "Sales",
    options: [
      {
        label: "Sales Contract",
        value: "Sales Contract",
        subModule: "Sales.Sales Contract",
      },
    ],
  },
  {
    label: "HR",
    options: [
      {
        label: "HR Event",
        value: "HR Event",
        subModule: "HR.Event Management",
      },
      { label: "Leave", value: "Leave", subModule: "HR.Leave Management" },
      { label: "WFH", value: "WFH", subModule: "HR.WFH Requests" },
    ],
  },
];

// Form field options for EventModal
export const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

export const categoryOptions = [
  { label: "Purchase Contract", value: "Purchase Contract" },
  { label: "Sales Contract", value: "Sales Contract" },
  { label: "HR Event", value: "HR Event" },
  { label: "Leave", value: "Leave" },
  { label: "WFH", value: "WFH" },
];

export const reminderTypeOptions = [
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "Push Notification", value: "push" },
];

export const reminderStatusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Sent", value: "sent" },
  { label: "Failed", value: "failed" },
];
