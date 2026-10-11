import moment from "moment";
import { categoryColors, priorityColors } from "./constants";

// Helper function to ensure events have proper Date objects
export const ensureDateObjects = (events) => {
  return events.map((event) => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
    reminderDateTime: event.reminderDateTime
      ? new Date(event.reminderDateTime)
      : null,
  }));
};

// Helper function to get date range for current view
export const getDateRange = (date, view) => {
  let startDate, endDate;

  switch (view) {
    case "month":
      startDate = moment(date).startOf("month").startOf("week");
      endDate = moment(date).endOf("month").endOf("week");
      break;
    case "week":
      startDate = moment(date).startOf("week");
      endDate = moment(date).endOf("week");
      break;
    case "day":
      startDate = moment(date).startOf("day");
      endDate = moment(date).endOf("day");
      break;
    case "agenda":
      // For agenda view, show events for next 30 days
      startDate = moment(date).startOf("day");
      endDate = moment(date).add(30, "days").endOf("day");
      break;
    default:
      startDate = moment(date).startOf("month").startOf("week");
      endDate = moment(date).endOf("month").endOf("week");
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

// Custom event style function
export const eventStyleGetter = (event) => {
  const categoryColor = categoryColors[event.category] || "#6b7280"; // Default gray color
  const priorityColor = priorityColors[event.priority] || priorityColors.medium;

  return {
    style: {
      backgroundColor: categoryColor,
      borderRadius: "6px",
      opacity: 0.9,
      color: event.category === "reminder" ? "#374151" : "white", // Dark text for light reminder background
      ...(event.isSystemEvent
        ? {
            borderLeft: "none",
            width: "95%",
            height: "95%",
            margin: "auto",
          }
        : { borderLeft: `4px solid ${categoryColor}` }),
      display: "block",
      fontSize: "12px",
      fontWeight: "500",
    },
  };
};

// Filter events based on filters and current month view
export const filterEvents = (events, filters, currentDate) => {
  return events.filter((event) => {
    // First, check if the event is in the current month view
    const eventStartDate = new Date(event.start);
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Only show events that are in the current month view
    if (
      eventStartDate.getMonth() !== currentMonth ||
      eventStartDate.getFullYear() !== currentYear
    ) {
      return false;
    }

    const matchesPriority =
      filters.priority === "" || event.priority === filters.priority;
    const matchesCategory =
      filters.category === "" || event.category === filters.category;
    const matchesSearch =
      !filters.search ||
      event.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      (event.description &&
        event.description.toLowerCase().includes(filters.search.toLowerCase()));

    return matchesPriority && matchesCategory && matchesSearch;
  });
};

// Validate form data for EventModal
export const validateEventForm = (formData) => {
  const newErrors = {};

  if (!formData.title.trim()) {
    newErrors.title = "Title is required";
  }

  if (formData.start >= formData.end) {
    newErrors.end = "End time must be after start time";
  }

  if (formData.hasReminder && formData.reminderDateTime >= formData.start) {
    newErrors.reminderDateTime =
      "Reminder time must be before event start time";
  }

  return newErrors;
};
