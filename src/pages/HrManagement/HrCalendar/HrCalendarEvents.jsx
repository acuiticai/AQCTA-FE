import React, { useState, useCallback, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, momentLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import EventModal from "../../Calendar/Calendar Events/EventModal";
import {
  Button,
  DropdownBasic,
  InputField,
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
  groupedCategoryColors,
} from "../../Calendar/Calendar Events/constants";
import {
  ensureDateObjects,
  getDateRange,
  eventStyleGetter,
  filterEvents,
} from "../../Calendar/Calendar Events/helpers";
import { calendarStyles } from "../../Calendar/Calendar Events/styles";

import { AdminContext } from "@/context/AdminContext";

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

const HrCalendarEvents = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  // HR-specific category options
  const hrCategoryOptions = [
    { label: t("hrCalendar.allCategories"), value: "all" },
    { label: t("hrCalendar.hrEvent"), value: "HR Event" },
    { label: t("hrCalendar.leave"), value: "Leave" },
    { label: t("hrCalendar.wfh"), value: "WFH" },
  ];

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

  // Filter to only HR modules
  const hrModules = allowedModules.filter((module) => module.startsWith("HR."));

  console.debug({ allowedModules, hrModules });

  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(isMobile ? "day" : "month");

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
          allowedModules: hrModules.length > 0 ? hrModules : undefined,
          category: customFilters?.category || filters?.category || "",
          search: customFilters?.search || filters?.search || "",
        };

        if (customFilters?.startDate) {
          params.startDate = customFilters.startDate;
        }
        if (customFilters?.endDate) {
          params.endDate = customFilters.endDate;
        }

        // HR Calendar - always pass isStaff=false to get full data
        params.isStaff = false;

        const res = await CalendarServices.getHREvents(params);
        console.log("HR Events API Response:", res);
        const eventsData = res.data || [];
        const eventsWithDates = ensureDateObjects(eventsData);
        setEvents(eventsWithDates);
      } catch (error) {
        console.error("Error fetching HR events:", error);
        notifyError("Failed to fetch HR calendar events");
      }
      setLoading(false);
    },
    [filters, hrModules]
  );

  const handleNavigate = useCallback(
    (newDate, view, action) => {
      if (loading) return;
      setEvents([]);
      setCurrentDate(newDate);
      const effectiveView = view || currentView;
      const dateRange = getDateRange(newDate, effectiveView);
      fetchEvents({ ...filters, ...dateRange });
    },
    [currentView, filters, fetchEvents, loading]
  );

  const handleViewChange = useCallback(
    (newView) => {
      if (loading) return;
      setCurrentView(newView);
      const dateRange = getDateRange(currentDate, newView);
      fetchEvents({ ...filters, ...dateRange });
    },
    [currentDate, filters, fetchEvents, loading]
  );

  useEffect(() => {
    const dateRange = getDateRange(currentDate, currentView);
    fetchEvents({ ...filters, ...dateRange });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768 && currentView !== "day") {
        setCurrentView("day");
      } else if (window.innerWidth >= 768 && currentView === "day") {
        setCurrentView("month");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentView]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handleSelectSlot = ({ start, end }) => {
    setSelectedSlot({ start, end });
    setSelectedEvent(null);
    setModalOpen(true);
  };

  const handleFilterChange = async (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    const dateRange = getDateRange(currentDate, currentView);
    await fetchEvents({ ...newFilters, ...dateRange });
  };

  const handleEventSave = async (eventData) => {
    setIsSubmitting(true);
    try {
      if (selectedEvent && selectedEvent._id) {
        await CalendarServices.updateCalendarEvent(
          selectedEvent._id,
          eventData
        );
        notifySuccess("Event updated successfully");
      } else {
        await CalendarServices.createCalendarEvent(eventData);
        notifySuccess("Event created successfully");
      }

      const dateRange = getDateRange(currentDate, currentView);
      await fetchEvents({ ...filters, ...dateRange });

      setModalOpen(false);
      setSelectedEvent(null);
      setSelectedSlot(null);
    } catch (error) {
      console.error("Error saving event:", error);
      notifyError("Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsSubmitting(true);
    try {
      await CalendarServices.deleteCalendarEvent(eventToDelete._id);
      notifySuccess("Event deleted successfully");

      const dateRange = getDateRange(currentDate, currentView);
      await fetchEvents({ ...filters, ...dateRange });

      setDeleteModalOpen(false);
      setEventToDelete(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      notifyError("Failed to delete event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = filterEvents(events, filters, currentDate);

  // Custom Toolbar with translations
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
          {/* Left side - Today button */}
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
              {t("hrCalendar.today")}
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

          {/* Right side - Back and Next buttons */}
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
              {t("hrCalendar.back")}
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
              {t("hrCalendar.next")}
            </button>
          </div>
        </div>
      );
    },
    [loading, t]
  );

  return (
    <div className="p-6">
      <PageHeader title={t("hrCalendar.title")} />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
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
              {t("hrCalendar.calendar")}
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {t("hrCalendar.list")}
            </button>
          </div>
        )}

        <div className="w-full max-w-[300px]">
          <InputField
            type="text"
            placeholder={t("hrCalendar.searchEvents")}
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e?.target?.value)}
          />
        </div>

        <div className="w-full max-w-[300px]">
          <DropdownBasic
            options={hrCategoryOptions}
            value={filters?.category}
            onChange={(value) => handleFilterChange("category", value)}
            placeholder={t("hrCalendar.category")}
          />
        </div>
      </div>

      {/* Filter Summary */}
      {(filters.category || filters.search) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-wrap items-center gap-2 text-sm text-blue-800">
            <span className="font-medium">{t("hrCalendar.activeFilters")}</span>
            {filters.category && filters.category !== "all" && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                {t("hrCalendar.category")}: {filters.category}
              </span>
            )}
            {filters.search && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                {t("hrCalendar.searchEvents")}: "{filters.search}"
              </span>
            )}
          </div>
        </div>
      )}

      {/* Calendar View */}
      <div className="bg-white rounded-lg p-4 relative mb-6">
        {loading && (
          <div className="absolute left-[130px] flex items-center gap-2 top-[35px]">
            <Loader />
          </div>
        )}

        {viewMode === "calendar" ? (
          <DragAndDropCalendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            style={{
              height: isMobile ? 500 : 600,
              minHeight: isMobile ? 500 : 600,
            }}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onNavigate={handleNavigate}
            onView={handleViewChange}
            date={currentDate}
            view={currentView}
            selectable={true}
            popup={true}
            eventPropGetter={eventStyleGetter}
            components={{
              toolbar: CustomToolbar,
            }}
            views={["month"]}
            defaultView={"month"}
            step={15}
            timeslots={4}
          />
        ) : (
          <div className="space-y-2">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t("hrCalendar.noHrEventsFound")}
              </div>
            ) : (
              filteredEvents.map((event, index) => (
                <div
                  key={index}
                  className="p-4 border-l-4 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  style={{
                    borderLeftColor: categoryColors[event.category] || "#6b7280",
                  }}
                  onClick={() => handleSelectEvent(event)}
                >
                  <h3 className="font-semibold text-gray-900">{event.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {event.description || t("hrCalendar.noDescription")}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-2 py-1 text-xs rounded text-white"
                      style={{
                        backgroundColor: categoryColors[event.category] || "#6b7280",
                      }}
                    >
                      {event.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      {moment(event.start).format("MMM DD, YYYY")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3">{t("hrCalendar.legend")}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="space-y-3">
              <div
                className="border-l-2 pl-3"
                style={{ borderLeftColor: groupedCategoryColors["HR"] }}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium capitalize">{t("hrCalendar.hr")}</span>
                </div>
                <div className="ml-5 space-y-1">
                  {hrCategoryOptions
                    .filter((opt) => opt.value !== "all")
                    .map((category) => (
                      <div key={category.value} className="flex items-center space-x-2">
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
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t("hrCalendar.features")}</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• {t("hrCalendar.clickEventToView")}</div>
              <div>• {t("hrCalendar.eventsOnlyShownForCurrentMonth")}</div>
              <div>• {t("hrCalendar.hrEventsOnly")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        open={modalOpen}
        setOpen={setModalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEvent(null);
          setSelectedSlot(null);
        }}
        event={selectedEvent}
        selectedSlot={selectedSlot}
        onSave={handleEventSave}
      />

      {/* Delete Confirmation Modal */}
      <CustomModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setEventToDelete(null);
        }}
        title={t("hrCalendar.deleteEvent")}
        size="sm"
      >
        <div className="p-0">
          <p className="text-gray-700 mb-4">
            {t("hrCalendar.areYouSureDeleteEvent")}{" "}
            <span className="font-semibold text-gray-900">
              "{eventToDelete?.title}"
            </span>
            ?
          </p>
          <p className="text-sm text-gray-500 mb-4">{t("hrCalendar.thisActionCannotBeUndone")}</p>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDeleteModalOpen(false);
                setEventToDelete(null);
              }}
              variant="outline"
              disabled={isSubmitting}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleDeleteEvent}
              variant="danger"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("hrCalendar.deleting") : t("hrCalendar.delete")}
            </Button>
          </div>
        </div>
      </CustomModal>

      {/* Enhanced Custom CSS */}
      <style jsx>{calendarStyles}</style>
    </div>
  );
};

export default HrCalendarEvents;
