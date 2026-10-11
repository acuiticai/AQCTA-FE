import React, { useState, useCallback, useEffect, useContext } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import EventModal from "./EventModal";
import {
  Button,
  DropdownBasic,
  InputField,
  Page,
  PageHeader,
  Loader,
  CustomModal,
} from "@/page-layouts/index";
import { notifySuccess, notifyError } from "@/utils/toast";
import CalendarServices from "@/services/CalendarServices";
import {
  categoryColors,
  priorityColors,
  filterOptions,
  getCategoryGroup,
  groupedCategoryOptions,
  groupedCategoryColors,
} from "./constants";
import {
  ensureDateObjects,
  getDateRange,
  eventStyleGetter,
  filterEvents,
} from "./helpers";
import { calendarStyles } from "./styles";

import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

const CalendarEvents = ({ events: initialEvents = [] }) => {
  // Ensure initial events have proper Date objects
  const initialEventsWithDates = initialEvents.map((event) => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
    reminderDateTime: event.reminderDateTime
      ? new Date(event.reminderDateTime)
      : null,
  }));

  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const routePerms = useRouteModulePermissions();
  const canAdd = !!routePerms?.canAdd;
  const canUpdate = !!routePerms?.canUpdate;
  const canDelete = !!routePerms?.canDelete;

  const isStaff = state?.adminInfo?.userType === "staff" || false;
  const staffEmail = state?.adminInfo?.email;
  const roleModules = adminInfo?.role?.modules;

  let allowedModules = [];

  if (roleModules?.length) {
    roleModules?.forEach((roleModule) =>
      allowedModules.push(
        ...roleModule?.subModules?.map(
          (subModule) => `${roleModule.name.trim()}.${subModule?.name.trim()}`
        )
      )
    );
  }

  console.debug({ allowedModules });

  const [events, setEvents] = useState(initialEventsWithDates);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" or "list"

  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(isMobile ? "day" : "month");

  // Filter states
  const [filters, setFilters] = useState({
    priority: "",
    category: "",
    search: "",
  });

  const fetchEvents = useCallback(
    async (customFilters = null) => {
      setLoading(true);
      try {
        setEvents([]);
        const params = {
          allowedModules,
          // priority: customFilters?.priority || filters.priority,
          category: customFilters?.category || filters?.category || "",
          search: customFilters?.search || filters?.search,
        };

        // Add date range if provided
        if (customFilters?.startDate) {
          params.startDate = customFilters.startDate;
        }
        if (customFilters?.endDate) {
          params.endDate = customFilters.endDate;
        }

        if (isStaff) {
          params.isStaff = state?.adminInfo?.userType === "staff" || false;
        }
        if(isStaff && staffEmail) {
          params.staffEmail = staffEmail;
        }

        const res = await CalendarServices.getCalendarEvents(params);
        console.log("API Response:", res);
        const eventsData = res.data;
        const eventsWithDates = ensureDateObjects(eventsData);
        setEvents(eventsWithDates);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
      setLoading(false);
    },
    [filters, ensureDateObjects]
  );

  // Handle calendar navigation (next/previous month, week, day)
  const handleNavigate = useCallback(
    (newDate, view, action) => {
      if (loading) return;
      setEvents([]);
      console.log("Calendar navigated:", { newDate, view, action });
      setCurrentDate(newDate);

      // Get date range for the new date and the view (use the view param if provided, else currentView)
      const effectiveView = view || currentView;
      const dateRange = getDateRange(newDate, effectiveView);
      console.log("Fetching events for date range:", dateRange);

      // Always use the latest filters, do not reset or clear them on navigation
      fetchEvents({ ...filters, ...dateRange });
    },
    [currentView, filters, fetchEvents, loading]
  );

  // Handle view change (month, week, day, agenda)
  const handleViewChange = useCallback(
    (newView) => {
      if (loading) return;
      console.log("Calendar view changed:", newView);
      setCurrentView(newView);

      // Get date range for current date and new view
      const dateRange = getDateRange(currentDate, newView);
      console.log("Fetching events for new view:", {
        view: newView,
        dateRange,
      });

      // Always use the latest filters, do not reset or clear them on view change
      fetchEvents({ ...filters, ...dateRange });
    },
    [currentDate, filters, fetchEvents, loading]
  );

  // Initial data loading with date range
  useEffect(() => {
    const dateRange = getDateRange(currentDate, currentView);
    console.log("Initial load - fetching events for:", {
      currentView,
      dateRange,
    });
    fetchEvents({ ...filters, ...dateRange });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode("list");
        setCurrentView("day");
      } else {
        setViewMode("calendar");
        setCurrentView("month");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check for upcoming reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const upcoming = events.filter((event) => {
        if (!event.reminderDateTime) return false;
        const reminder = new Date(event.reminderDateTime);
        const timeDiff = reminder.getTime() - now.getTime();
        return timeDiff > 0 && timeDiff <= 60000; // Within 1 minute
      });

      upcoming.forEach((event) => {
        notifySuccess(
          `Reminder: ${event.title} starting at ${moment(event.start).format(
            "HH:mm"
          )}`,
          {
            autoClose: 10000,
          }
        );
      });
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [events]);

  // Filter events based on current filters
  const filteredEvents = filterEvents(events, filters, currentDate);

  // Custom toolbar component to disable navigation buttons when loading
  const CustomToolbar = useCallback(
    (toolbar) => {
      const goToBack = () => {
        if (!loading) {
          toolbar.onNavigate("PREV");
        }
      };

      const goToNext = () => {
        if (!loading) {
          toolbar.onNavigate("NEXT");
        }
      };

      const goToCurrent = () => {
        if (!loading) {
          toolbar.onNavigate("TODAY");
        }
      };

      const viewNames = toolbar.views.map((name) => ({
        name,
        label: toolbar.messages?.[name] || name,
      }));

      return (
        <div
          className="rbc-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            backgroundColor: "#f8f9fa",
            borderBottom: "1px solid #e9ecef",
            borderRadius: "8px 8px 0 0",
          }}
        >
          {/* Left side - Navigation buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={goToCurrent}
              disabled={loading}
              className="rbc-btn"
              style={{
                padding: "8px 16px",
                border: "1px solid #007bff",
                borderRadius: "6px",
                backgroundColor: "#007bff",
                color: "#ffffff",
                fontWeight: "500",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#0056b3";
                  e.target.style.borderColor = "#0056b3";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#007bff";
                  e.target.style.borderColor = "#007bff";
                }
              }}
            >
              {toolbar.messages?.today || "Today"}
            </button>
            <button
              type="button"
              onClick={goToCurrent}
              disabled={loading}
              className="rbc-btn"
              style={{
                opacity: 0,
                width: "70px",
              }}
            >
              {}
            </button>
          </div>
          {/* Center - Month/Year label */}
          <div
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#212529",
              textAlign: "center",
              flex: "1",
              margin: "0 16px",
            }}
          >
            {toolbar.label}
          </div>

          {/* Right side - Today button */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={goToBack}
              disabled={loading}
              className="rbc-btn"
              style={{
                padding: "8px 16px",
                border: "1px solid #dee2e6",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                color: "#495057",
                fontWeight: "500",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#e9ecef";
                  e.target.style.borderColor = "#adb5bd";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#ffffff";
                  e.target.style.borderColor = "#dee2e6";
                }
              }}
            >
              {toolbar.messages?.previous || "Previous"}
            </button>

            <button
              type="button"
              onClick={goToNext}
              disabled={loading}
              className="rbc-btn"
              style={{
                padding: "8px 16px",
                border: "1px solid #dee2e6",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                color: "#495057",
                fontWeight: "500",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#e9ecef";
                  e.target.style.borderColor = "#adb5bd";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#ffffff";
                  e.target.style.borderColor = "#dee2e6";
                }
              }}
            >
              {toolbar.messages?.next || "Next"}
            </button>
          </div>
        </div>
      );
    },
    [loading]
  );

  // Handle selecting a time slot (for creating new events)
  const handleSelectSlot = useCallback(
    ({ start, end }) => {
      // Check if the selected slot is on a day that belongs to the current month view
      const selectedDate = new Date(start);
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Check if the selected date is in the current month view
      if (
        selectedDate.getMonth() !== currentMonth ||
        selectedDate.getFullYear() !== currentYear
      ) {
        // This is a non-month day (grayed out), don't allow creating events
        // notifyError("Cannot create events on non-month days");
        return;
      }

      if (!canAdd) {
        notifyError("You don't have permission to add calendar events");
        return;
      }

      setSelectedEvent(null);
      setSelectedSlot({ start, end });
      setModalOpen(true);
    },
    [currentDate, canAdd]
  );

  // Handle selecting an existing event (for editing)
  const handleSelectEvent = useCallback(
    (event) => {
      if (!event?.isSystemEvent && !canUpdate) {
        notifyError("You don't have permission to edit calendar events");
        return;
      }

      setSelectedEvent(event);
      setSelectedSlot(null);
      setModalOpen(true);
    },
    [canUpdate]
  );

  // Handle drag and drop for rescheduling
  const handleEventDrop = useCallback(async ({ event, start, end }) => {
    if (event.isSystemEvent) {
      notifyError("Cannot reschedule system events");
      return;
    }

    if (!canUpdate) {
      notifyError("You don't have permission to update calendar events");
      return;
    }

    const updatedEvent = {
      ...event,
      start: new Date(start),
      end: new Date(end),
    };

    // Optimistically update UI
    setEvents((prev) =>
      prev.map((e) => (e._id === event._id ? updatedEvent : e))
    );

    try {
      await CalendarServices.updateCalendarEvent(event._id, updatedEvent);
      notifySuccess(`"${event.title}" rescheduled successfully`);
    } catch (error) {
      console.error("Error updating event:", error);
      notifyError("Failed to reschedule event");
      // Revert the change
      setEvents((prev) => prev.map((e) => (e._id === event._id ? event : e)));
    }
  }, [canUpdate]);

  // Handle event resize
  const handleEventResize = useCallback(async ({ event, start, end }) => {
    if (event.isSystemEvent) {
      notifyError("Cannot resize system events");
      return;
    }

    if (!canUpdate) {
      notifyError("You don't have permission to update calendar events");
      return;
    }

    const updatedEvent = {
      ...event,
      start: new Date(start),
      end: new Date(end),
    };

    // Optimistically update UI
    setEvents((prev) =>
      prev.map((e) => (e._id === event._id ? updatedEvent : e))
    );

    try {
      await CalendarServices.updateCalendarEvent(event._id, updatedEvent);
      notifySuccess(`"${event.title}" duration updated`);
    } catch (error) {
      console.error("Error updating event:", error);
      notifyError("Failed to update event duration");
      // Revert the change
      setEvents((prev) => prev.map((e) => (e._id === event._id ? event : e)));
    }
  }, [canUpdate]);

  // Handle saving an event (create or update)
  const handleSaveEvent = useCallback(
    async (eventData) => {
      setIsSubmitting(true);
      try {
        if (selectedEvent) {
          if (!canUpdate) {
            // Let EventModal show the RBAC-friendly message
            throw new Error("FORBIDDEN_UPDATE");
          }
          // Update existing event
          await CalendarServices.updateCalendarEvent(
            selectedEvent._id,
            eventData
          );
          const updatedEventWithDates = {
            ...eventData,
            _id: selectedEvent._id,
            start: new Date(eventData.start),
            end: new Date(eventData.end),
            reminderDateTime: eventData.reminderDateTime
              ? new Date(eventData.reminderDateTime)
              : null,
          };
          setEvents((prev) =>
            prev.map((event) =>
              event._id === selectedEvent._id ? updatedEventWithDates : event
            )
          );
        } else {
          if (!canAdd) {
            // Let EventModal show the RBAC-friendly message
            throw new Error("FORBIDDEN_ADD");
          }
          // Create new event
          const response = await CalendarServices.createCalendarEvent(
            eventData
          );
          const newEvent = response.data;
          const newEventWithDates = {
            ...newEvent,
            start: new Date(newEvent.start),
            end: new Date(newEvent.end),
            reminderDateTime: newEvent.reminderDateTime
              ? new Date(newEvent.reminderDateTime)
              : null,
          };
          setEvents((prev) => [...prev, newEventWithDates]);
        }
      } catch (error) {
        console.error("Error saving event:", error);
        throw error; // Re-throw to let the modal handle it
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedEvent, canAdd, canUpdate]
  );

  // Handle closing the modal
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedEvent(null);
    setSelectedSlot(null);
  }, []);

  // Handle double-click to create new event
  const handleDoubleClickEvent = useCallback(
    (event) => {
      handleSelectEvent(event);
    },
    [handleSelectEvent]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    async (filterType, value) => {
      try {
        const newFilters = { ...filters, [filterType]: value };
        setFilters(newFilters);

        if (!value && filterType === "category") {
          setFilters({
            priority: "",
            category: "",
            search: filters?.search || "",
          });
        }

        // Get current date range and fetch events with new filters
        const dateRange = getDateRange(currentDate, currentView);
        console.debug({ newFilters, dateRange });
        await fetchEvents({ ...newFilters, ...dateRange });
      } catch (e) {
        console.error({ e });
      }
    },
    [filters, fetchEvents, currentDate, currentView]
  );

  // Delete event
  const handleDeleteEvent = useCallback(async (eventId) => {
    if (!canDelete) {
      notifyError("You don't have permission to delete calendar events");
      return;
    }

    try {
      await CalendarServices.deleteCalendarEvent(eventId);
      setEvents((prev) => prev.filter((e) => e._id !== eventId));
      notifySuccess("Event deleted successfully");
      setDeleteModalOpen(false);
      setEventToDelete(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      notifyError("Failed to delete event");
    }
  }, [canDelete]);

  // Handle delete confirmation
  const handleDeleteConfirmation = useCallback(
    (event) => {
    if (event.isSystemEvent) {
      notifyError("Cannot delete system events");
      return;
    }

    if (!canDelete) {
      notifyError("You don't have permission to delete calendar events");
      return;
    }

    setEventToDelete(event);
    setDeleteModalOpen(true);
    },
    [canDelete]
  );

  const filteredGroupedCategoryOptions = groupedCategoryOptions
    .filter((group) =>
      allowedModules.find((allowedModule) =>
        group.options.some((category) => category.subModule === allowedModule)
      )
    )
    .map((group) => ({
      ...group,
      options: group.options.filter((category) =>
        allowedModules.includes(category.subModule)
      ),
    }));

  // Custom event component to show priority and reminders
  const EventComponent = ({ event }) => {
    const categoryGroup = event.category
      ? getCategoryGroup(event.category)
      : null;
    const eventContent = `${event.title}${
      event.category ? ` - ${categoryGroup} (${event.category})` : ""
    }${event.reminderDateTime ? " 🔔" : ""}`;

    return (
      <div
        className="rbc-event-content p-1 relative group cursor-pointer"
        style={{
          height: isMobile ? "50px" : "60px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          whiteSpace: "break-spaces",
        }}
        title={eventContent}
      >
        {/* Delete button - appears on hover (only for non-system events) */}
        {!event.isSystemEvent && canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent event selection
              handleDeleteConfirmation(event);
            }}
            className="absolute top-[2px] font-bold right-[8px] w-4 h-4 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
            title="Delete event"
          >
            <span className="text-xs leading-none" style={{ fontSize: "12px" }}>
              ×
            </span>
          </button>
        )}

        {/* Event title - can wrap to multiple lines */}
        <div
          className={`flex items-start justify-between w-full ${
            !event.isSystemEvent ? "gap-[26px] group-hover:pl-2" : "gap-2"
          } transition-all duration-200`}
        >
          <span
            className="font-normal text-xs flex-1 leading-tight"
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              lineHeight: "1.2",
            }}
          >
            {event.title}
          </span>
          <div className="flex items-center space-x-1 flex-shrink-0 mt-0.5">
            {event.reminderDateTime && <span className="text-xs">🔔</span>}
            {/* TODO: Add this back in when the non system events are implemented */}
            {/* {event.isSystemEvent && (
              <span className="text-xs" title="System Event">
                🔒
              </span>
            )} */}
          </div>
        </div>

        {/* Event category group - shown at bottom */}
        <div
          className={`text-[9px] opacity-75 pt-2 capitalize ${
            !event.isSystemEvent ? "group-hover:pl-2" : ""
          } transition-all duration-200`}
        >
          {event.category || categoryGroup}
        </div>
      </div>
    );
  };

  // List view component for mobile
  const ListView = () => (
    <div className="space-y-2">
      {filteredEvents
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .map((event) => (
          <div
            key={event._id}
            className="bg-white border rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleSelectEvent(event)}
            style={{
              borderLeft: `4px solid ${
                categoryColors[event.category] || "#6b7280"
              }`,
            }}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{event.title}</h3>
                <p className="text-sm text-gray-600 capitalize">
                  {event.category
                    ? getCategoryGroup(event.category)
                    : event.category}
                </p>
                {event.description && (
                  <p className="text-sm text-gray-500 mt-1">
                    {event.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end space-y-1">
                <span
                  className={`text-xs px-2 py-1 rounded text-white`}
                  style={{ backgroundColor: priorityColors[event.priority] }}
                >
                  {event.priority}
                </span>
                {event.reminderDateTime && (
                  <span className="text-xs text-gray-500">🔔 Reminder</span>
                )}
                {event.isSystemEvent && (
                  <span className="text-xs text-gray-500" title="System Event">
                    🔒 System Event
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <div>{moment(event.start).format("MMM DD, YYYY")}</div>
              <div>
                {moment(event.start).format("HH:mm")} -{" "}
                {moment(event.end).format("HH:mm")}
              </div>
            </div>
            {!event.isSystemEvent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConfirmation(event);
                }}
                className="mt-2 text-xs text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      {filteredEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No events found matching your filters
        </div>
      )}
    </div>
  );

  return (
    <Page>
      {/* Header with controls */}
      <PageHeader
        title="Calendar Events"
        // TODO: Add this back in when the non system events are implemented
        // showAddButton={true}
        // addButtonText="Add Event"
        // onAddNew={() => {
        //   setSelectedEvent(null);
        //   setSelectedSlot(null);
        //   setModalOpen(true);
        // }}
      />

      <div className="flex flex-col sm:flex-row items-start justify-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full lg:w-auto mb-8">
        {/* View Toggle for Mobile */}
        {isMobile && (
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              List
            </button>
          </div>
        )}
        {/* Search */}
        <div className="w-full max-w-[300px]">
          <InputField
            type="text"
            placeholder="Search events..."
            value={filters.search}
            onChange={async (e) =>
              await handleFilterChange("search", e?.target?.value)
            }
            // className="w-full sm:w-48"
          />
        </div>
        {/* Priority Filter */}
        {/* <div className="w-full max-w-[300px]">
          <DropdownBasic
            options={filterOptions.priority}
            value={filters.priority}
            onChange={(value) => handleFilterChange("priority", value)}
            placeholder="Priority"
            // className="w-full sm:w-32"
          />
        </div> */}
        {/* Category Filter */}
        <div className="w-full max-w-[300px]">
          <DropdownBasic
            options={filteredGroupedCategoryOptions}
            value={filters?.category}
            onChange={async (value) =>
              await handleFilterChange("category", value)
            }
            placeholder="Category"
            grouped={true}
            // className="w-full sm:w-32"
          />
        </div>
      </div>

      {/* Filter Summary */}
      {(filters.priority || filters.category || filters.search) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-wrap items-center gap-2 text-sm text-blue-800">
            <span className="font-medium">Active filters:</span>
            {filters.priority && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                Priority: {filters.priority}
              </span>
            )}
            {filters.category && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                {getCategoryGroup(filters.category)} ({filters.category})
              </span>
            )}
            {filters.search && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                Search: "{filters.search}"
              </span>
            )}
            {/* <button
              onClick={() =>
                setFilters({ priority: "", category: "", search: "" })
              }
              className="text-blue-600 hover:text-blue-800 underline ml-2"
            >
              Clear all
            </button> */}
          </div>
        </div>
      )}

      {/* Calendar or List View */}
      <div className="bg-white rounded-lg p-4 relative mb-6">
        {loading && (
          // <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
          <div className="absolute left-[130px] flex items-center gap-2 top-[35px]">
            <Loader />
          </div>
          // </div>
        )}
        {viewMode === "list" ? (
          <ListView />
        ) : (
          <DragAndDropCalendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            style={{
              height: isMobile ? 500 : 600,
              minHeight: isMobile ? 500 : 600,
            }}
            // onSelectSlot={ handleSelectSlot} // TODO: Add this back in when the non system events are implemented
            onSelectEvent={handleSelectEvent}
            onDoubleClickEvent={handleDoubleClickEvent}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onNavigate={handleNavigate}
            onView={handleViewChange}
            date={currentDate}
            view={currentView}
            selectable={true}
            resizable={false}
            popup={true}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventComponent,
              toolbar: CustomToolbar,
            }}
            views={["month"]}
            defaultView={"month"}
            step={15}
            timeslots={4}
            formats={{
              timeGutterFormat: "HH:mm",
              eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                localizer.format(start, "HH:mm", culture) +
                " - " +
                localizer.format(end, "HH:mm", culture),
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3">Legend</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3"></h4>
            <div className="space-y-3">
              {filteredGroupedCategoryOptions.map((group) => (
                <div
                  key={group.label}
                  className="border-l-2 pl-3"
                  style={{
                    borderLeftColor: groupedCategoryColors[group.label],
                  }}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {/* <div
                        className="w-3 h-3 rounded"
                        style={{
                          backgroundColor: groupedCategoryColors[group.label],
                        }}
                      ></div> */}
                    <span className="text-sm font-medium capitalize">
                      {group.label}
                    </span>
                  </div>
                  {group.options.length > 0 ? (
                    <div className="ml-5 space-y-1">
                      {group.options.map((category) => (
                        <div
                          key={category.value}
                          className="flex items-center space-x-2"
                        >
                          <div
                            className="w-2 h-2 rounded"
                            style={{
                              backgroundColor: categoryColors[category.value],
                            }}
                          ></div>
                          <span className="text-xs text-gray-600">
                            {category.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ml-5">
                      <span className="text-xs text-gray-400 italic">
                        No categories yet
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Features</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• Click event to view</div>
              <div>• Events only shown for current month</div>
              <div>• Group colors represent category groups</div>
              <div>• Individual colors represent specific categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        open={modalOpen}
        setOpen={setModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        onSave={handleSaveEvent}
        selectedSlot={selectedSlot}
      />

      {/* Enhanced Custom CSS */}
      <style jsx>{calendarStyles}</style>

      {/* Delete Confirmation Modal */}
      <CustomModal
        open={deleteModalOpen}
        title="Delete Event"
        onClose={() => {
          setDeleteModalOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={() => {
          if (eventToDelete) {
            handleDeleteEvent(eventToDelete._id);
          }
        }}
        loading={loading}
      >
        <div className="p-0">
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete the event{" "}
            <span className="font-semibold text-gray-900">
              "{eventToDelete?.title}"
            </span>
            ?
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
        </div>
      </CustomModal>
    </Page>
  );
};

export default CalendarEvents;
