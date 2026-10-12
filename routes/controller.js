const CalendarEvent = require("../models/CalendarEvent"); // Adjust import path as needed
//add middleware to check if the user is authenticated

// Create a new calendar event
const createCalendarEvent = async (req, res) => {
  try {
    const {
      title,
      start,
      end,
      priority,
      category,
      description,
      reminderDateTime,
    } = req.body;

    // Validate required fields
    if (!title || !start || !end) {
      return res.status(400).json({
        success: false,
        message: "Title, start time, and end time are required",
      });
    }

    // Validate that end time is after start time
    if (new Date(end) <= new Date(start)) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    const calendarEvent = new CalendarEvent({
      title,
      start: new Date(start),
      end: new Date(end),
      priority: priority || "medium",
      category: category || "task",
      description,
      reminderDateTime: reminderDateTime ? new Date(reminderDateTime) : null,
      userId: req.user.id, // From auth middleware
      createdBy: req.user.id,
    });

    const savedEvent = await calendarEvent.save();

    res.status(201).json({
      success: true,
      message: "Calendar event created successfully",
      data: savedEvent,
    });
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create calendar event",
      error: error.message,
    });
  }
};

// Get all calendar events (with optional filtering)
const getAllCalendarEvents = async (req, res) => {
  try {
    const {
      priority,
      category,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 100,
    } = req.query;

    // Build filter object
    const filter = {};

    if (priority && priority !== "all") {
      filter.priority = priority;
    }

    if (category && category !== "all") {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      filter.start = {};
      if (startDate) {
        filter.start.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.start.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await CalendarEvent.find(filter)
      .sort({ start: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await CalendarEvent.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar events",
      error: error.message,
    });
  }
};

// Get calendar event by ID
const getCalendarEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await CalendarEvent.findById(id).populate(
      "createdBy",
      "name email"
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found",
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error fetching calendar event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar event",
      error: error.message,
    });
  }
};

// Update calendar event
const updateCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate that end time is after start time if both are provided
    if (updateData.start && updateData.end) {
      if (new Date(updateData.end) <= new Date(updateData.start)) {
        return res.status(400).json({
          success: false,
          message: "End time must be after start time",
        });
      }
    }

    // Convert date strings to Date objects
    if (updateData.start) {
      updateData.start = new Date(updateData.start);
    }
    if (updateData.end) {
      updateData.end = new Date(updateData.end);
    }
    if (updateData.reminderDateTime) {
      updateData.reminderDateTime = new Date(updateData.reminderDateTime);
    }

    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate("createdBy", "name email");

    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Calendar event updated successfully",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Error updating calendar event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update calendar event",
      error: error.message,
    });
  }
};

// Delete calendar event
const deleteCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedEvent = await CalendarEvent.findByIdAndDelete(id);

    if (!deletedEvent) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Calendar event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete calendar event",
      error: error.message,
    });
  }
};

// Get calendar events for a specific user
const getUserCalendarEvents = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const filter = { userId };

    // Date range filter
    if (startDate || endDate) {
      filter.start = {};
      if (startDate) {
        filter.start.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.start.$lte = new Date(endDate);
      }
    }

    const events = await CalendarEvent.find(filter)
      .sort({ start: 1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching user calendar events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user calendar events",
      error: error.message,
    });
  }
};

// Get calendar events summary (counts by category, priority, etc.)
const getCalendarEventsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build filter for date range
    const filter = {};
    if (startDate || endDate) {
      filter.start = {};
      if (startDate) {
        filter.start.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.start.$lte = new Date(endDate);
      }
    }

    // Get summary statistics
    const [
      totalEvents,
      categoryStats,
      priorityStats,
      upcomingEvents,
    ] = await Promise.all([
      CalendarEvent.countDocuments(filter),
      CalendarEvent.aggregate([
        { $match: filter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      CalendarEvent.aggregate([
        { $match: filter },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      CalendarEvent.find({
        ...filter,
        start: { $gte: new Date() },
      })
        .sort({ start: 1 })
        .limit(5)
        .populate("createdBy", "name email"),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEvents,
        categoryStats,
        priorityStats,
        upcomingEvents,
      },
    });
  } catch (error) {
    console.error("Error fetching calendar events summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar events summary",
      error: error.message,
    });
  }
};

module.exports = {
  createCalendarEvent,
  getAllCalendarEvents,
  getCalendarEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
  getUserCalendarEvents,
  getCalendarEventsSummary,
};