"use client";

import { useState } from "react";
import AddTaskForm from "../components/AddTaskForm";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyWarning, notifySuccess } from "@/utils/toast";

const CreateTaskPage = () => {
  // Renamed component from ApplyEventPage
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const Location = useLocation();

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);

      // Extract only the fields needed for task creation
      const taskData = {
        event: formData.event, // Event ID now comes from formData, which gets it from URL params
        description: formData.description,
        taskName: formData.taskName,
        weightage: parseInt(formData.weightage, 10), // Ensure weightage is an integer
        documents: formData.documents || [],
      };

      console.log("Submitting task data:", taskData);

      // Updated API endpoint for creating a task
      const res = await axios.post(`${Base_URL}/task/create-task`, taskData);

      console.log("Task creation response:", res);

      notifySuccess("Task created successfully!", () => {
        history.push(`/task-management${Location.search}`); // Redirect to task management page
      });
    } catch (err) {
      console.error("Error creating task:", err);

      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to create task.";

      notifyWarning(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    history.push(`/task-management${Location.search}`); // Redirect to task management page
  };

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-60 z-10 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)] mb-4"></div>
            <p className="text-gray-600 text-sm">Creating task...</p>
          </div>
        )}

        <AddTaskForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          disabled={loading} // optional: pass to disable form inputs
        />
      </div>
    </div>
  );
};

export default CreateTaskPage;
