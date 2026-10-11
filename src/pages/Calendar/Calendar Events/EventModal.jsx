import React, { useState, useEffect } from "react";
import { CustomModal, Form, Loader } from "@/page-layouts/index";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  priorityOptions,
  categoryOptions,
  reminderTypeOptions,
  reminderStatusOptions,
  groupedCategoryOptions,
} from "./constants";

import { validateEventForm } from "./helpers";
import { formatDate } from "@/components/formatAmount";

const EventModal = ({
  open,
  setOpen,
  onClose,
  event = null,
  onSave,
  selectedSlot = null,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    start: new Date(),
    end: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour later
    priority: "medium",
    category: "task",
    description: "",
    reminderDateTime: new Date(),
    hasReminder: false,
    reminderType: "email",
    reminderStatus: "pending",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSystemEvent = event?.isSystemEvent || false;

  // Populate form when editing an event or when a slot is selected
  useEffect(() => {
    if (event) {
      // Editing existing event
      setFormData({
        title: event.title || "",
        start: event.start ? new Date(event.start) : new Date(),
        end: event.end ? new Date(event.end) : new Date(),
        priority: event.priority || "medium",
        category: event.category || "task",
        description: event.description || "",
        reminderDateTime: event.reminderDateTime
          ? new Date(event.reminderDateTime)
          : new Date(),
        hasReminder: !!event.reminderDateTime,
        reminderType: event.reminderType || "email",
        reminderStatus: event.reminderStatus || "pending",
      });
    } else if (selectedSlot) {
      // Creating new event with selected time slot
      const reminderTime = new Date(
        selectedSlot.start.getTime() - 15 * 60 * 1000
      ); // 15 minutes before
      setFormData({
        title: "",
        start: selectedSlot.start,
        end: selectedSlot.end,
        priority: "medium",
        category: "task",
        description: selectedSlot.description || "",
        reminderDateTime: reminderTime,
        hasReminder: false,
        reminderType: "email",
        reminderStatus: "pending",
      });
    } else {
      // Reset form for new event
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      const reminderTime = new Date(now.getTime() - 15 * 60 * 1000);
      setFormData({
        title: "",
        start: now,
        end: endTime,
        priority: "medium",
        category: "task",
        description: "",
        reminderDateTime: reminderTime,
        hasReminder: false,
        reminderType: "email",
        reminderStatus: "pending",
      });
    }
    setErrors({});
  }, [event, selectedSlot, open]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = validateEventForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      notifyError("Please fix the errors before submitting");
      return;
    }
    setIsSubmitting(true);

    try {
      const eventData = {
        id: event?.id || Date.now().toString(),
        title: formData.title.trim(),
        start: formData.start,
        end: formData.end,
        priority: formData.priority,
        category: formData.category,
        description: formData.description.trim(),
        reminderDateTime: formData.hasReminder
          ? formData.reminderDateTime
          : null,
        reminderType: formData.hasReminder ? formData.reminderType : "email",
        reminderStatus: formData.hasReminder
          ? formData.reminderStatus
          : "pending",
      };

      await onSave(eventData);
      setOpen(false);
      notifySuccess(
        event ? "Event updated successfully" : "Event created successfully",
        () => {
          onClose();
        }
      );
    } catch (error) {
      console.error("Error saving event:", error);
      if (error?.message === "FORBIDDEN_ADD") {
        notifyError("You don't have permission to add calendar events");
      } else if (error?.message === "FORBIDDEN_UPDATE") {
        notifyError("You don't have permission to edit calendar events");
      } else {
        notifyError("Failed to save event. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Helper function to get display value for select fields
  const getSelectDisplayValue = (value, options) => {
    const option = options.find((opt) => opt.value === value);
    return option ? option.label : value;
  };

  const formFields = [
    {
      name: "title",
      type: isSystemEvent ? "label" : "text",
      label: "Event Title",
      required: !isSystemEvent,
      placeholder: "Enter event title",
      value: formData.title,
      onChange: (e) => handleInputChange("title", e.target.value),
      error: errors.title,
      shouldShowError: !!errors.title,
    },
    {
      name: "category",
      type: isSystemEvent ? "label" : "select",
      label: "Category",
      required: !isSystemEvent,
      options: groupedCategoryOptions,
      value: isSystemEvent
        ? getSelectDisplayValue(formData.category, categoryOptions)
        : formData.category,
      onChange: (value) => handleInputChange("category", value),
      placeholder: "Select category",
      grouped: true,
    },
    ...(!isSystemEvent
      ? [
          {
            name: "priority",
            type: isSystemEvent ? "label" : "select",
            label: "Priority",
            required: !isSystemEvent,
            options: priorityOptions,
            value: isSystemEvent
              ? getSelectDisplayValue(formData.priority, priorityOptions)
              : formData.priority,
            onChange: (value) => handleInputChange("priority", value),
            placeholder: "Select priority",
          },
        ]
      : []),
    // Determine if both start and end are the same date (ignoring time) and both have no time component
    ...(() => {
      const start = formData.start ? new Date(formData.start) : null;
      const end = formData.end ? new Date(formData.end) : null;
      // Helper to check if a date has a time component (hours/minutes/seconds)

      console.debug({ start, end });

      const hasTime = (date) =>
        date &&
        (date.getHours() !== 0 ||
          date.getMinutes() !== 0 ||
          date.getSeconds() !== 0 ||
          date.getMilliseconds() !== 0);

      if (
        start &&
        end &&
        (start.toDateString() === end.toDateString() ||
          (!hasTime(start) && !hasTime(end)))
      ) {
        // Only show one field labeled "Date"
        return [
          {
            name: "start",
            type: isSystemEvent ? "label" : "date",
            label: "Date",
            required: !isSystemEvent,
            value: formatDate(formData.start, false, hasTime(start)),
            onChange: (e) =>
              handleInputChange("start", formatDate(e.target.value)),
          },
        ];
      } else {
        // Show both start and end fields with time
        return [
          {
            name: "start",
            type: isSystemEvent ? "label" : "datetime-local",
            label: "Start Date & Time",
            required: !isSystemEvent,
            value: formatDate(formData.start, false, hasTime(start)),
            onChange: (e) =>
              handleInputChange("start", formatDate(e.target.value)),
          },
          {
            name: "end",
            type: isSystemEvent ? "label" : "datetime-local",
            label: "End Date & Time",
            required: !isSystemEvent,
            value: formatDate(formData.end, false, hasTime(end)),
            onChange: (e) =>
              handleInputChange("end", formatDate(e.target.value)),
            error: errors.end,
            shouldShowError: !!errors.end,
          },
        ];
      }
    })(),
    {
      name: "description",
      type: isSystemEvent ? "label" : "textarea",
      label: `Description ${isSystemEvent ? "" : "(Optional)"}`,
      placeholder: "Add event description...",
      value: formData.description || (isSystemEvent ? "No description" : ""),
      onChange: (e) => handleInputChange("description", e.target.value),
      rows: 3,
    },
    ...(!isSystemEvent
      ? [
          {
            name: "hasReminder",
            type: "checkbox",
            label: "Set Reminder",
            value: formData.hasReminder,
            onChange: (value) => handleInputChange("hasReminder", value),
          },
        ]
      : []),
    ...(formData.hasReminder
      ? [
          {
            name: "reminderDateTime",
            type: isSystemEvent ? "label" : "datetime-local",
            label: "Reminder Date & Time",
            required: !isSystemEvent,
            value: formatDate(formData.reminderDateTime),
            onChange: (e) =>
              handleInputChange("reminderDateTime", formatDate(e.target.value)),
            error: errors.reminderDateTime,
            shouldShowError: !!errors.reminderDateTime,
          },
          {
            name: "reminderType",
            type: isSystemEvent ? "label" : "select",
            label: "Reminder Type",
            required: !isSystemEvent,
            options: reminderTypeOptions,
            value: isSystemEvent
              ? getSelectDisplayValue(
                  formData.reminderType,
                  reminderTypeOptions
                )
              : formData.reminderType,
            onChange: (value) =>
              handleInputChange("reminderType", value || "email"),
            placeholder: "Select reminder type",
          },
          {
            name: "reminderStatus",
            type: isSystemEvent ? "label" : "select",
            label: "Reminder Status",
            required: !isSystemEvent,
            options: reminderStatusOptions,
            value: isSystemEvent
              ? getSelectDisplayValue(
                  formData.reminderStatus,
                  reminderStatusOptions
                )
              : formData.reminderStatus,
            onChange: (value) =>
              handleInputChange("reminderStatus", value || "pending"),
            placeholder: "Select reminder status",
          },
        ]
      : []),
  ];

  return (
    <CustomModal
      open={open}
      onClose={handleClose}
      width="700px"
      title={
        isSystemEvent ? "View Event" : event ? "Edit Event" : "Add New Event"
      }
      confirmText={event ? "Update" : "Create"}
      savingText={event ? "Updating" : "Creating"}
      loading={isSubmitting}
      showActions={!isSystemEvent}
      onConfirm={handleSubmit}
      // actions={[
      //   {
      //     label: "Cancel",
      //     secondary: true,
      //     onClick: handleClose,
      //   },
      //   {
      //     label: isSubmitting ? "Save" : "Saving...",
      //     onClick: handleSubmit,
      //     loading: isSubmitting,
      //   },
      // ]}
    >
      <div className="relative">
        {isSubmitting && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
            <Loader />
          </div>
        )}
        <Form
          formFields={formFields}
          handleSubmit={handleSubmit}
          // fieldsPerRow={2}
          showFooterButtons={false}
          // labelAndFieldDirection="column"
          handleCancel={handleClose}
          customLabelWidth="w-1/2"
          disableReSubmission={false}
          isSubmitting={isSubmitting}
        />
      </div>
    </CustomModal>
  );
};

export default EventModal;
