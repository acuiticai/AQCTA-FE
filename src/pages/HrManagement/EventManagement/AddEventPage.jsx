"use client";

import { useState } from "react";
import ApplyEventForm from "../components/AddEvent";
import axios from "axios";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyWarning, notifySuccess } from "@/utils/toast";
import moment from "moment";

const ApplyEventPage = () => {
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);

      // Extract only the fields needed by the backend
      const eventData = {
        eventName: formData.eventName,
        eventDate: moment(formData.eventDate).format("YYYY-MM-DD"),
        startTime: (() => {
          let [h, m] = formData.startTime.split(":").map(Number);
          return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${
            h >= 12 ? "PM" : "AM"
          }`;
        })(),
        endTime: (() => {
          let [h, m] = formData.endTime.split(":").map(Number);
          return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${
            h >= 12 ? "PM" : "AM"
          }`;
        })(),
        attendees: formData.attendees,
        location: formData.location,
        documents: formData.documents || [],
        business: formData.business,
        status: formData.status || "Pending",
      };

      console.log("Submitting event data:", eventData);

      const res = await axios.post(`${Base_URL}/event/create-event`, eventData);

      console.log("Event creation response:", res);

      notifySuccess("Event created successfully!", () => {
        history.push("/event-management");
      });
    } catch (err) {
      console.error("Error creating event:", err);

      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to create event.";

      notifyWarning(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    history.push("/event-management");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-60 z-10 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)] mb-4"></div>
            <p className="text-gray-600 text-sm">Creating event...</p>
          </div>
        )}

        <ApplyEventForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          disabled={loading} // optional: disable fields while loading
        />
      </div>
    </div>
  );
};

export default ApplyEventPage;
