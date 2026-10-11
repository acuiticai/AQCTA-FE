import React, { useState } from "react";
import ApplyWFHForm from "../components/ApplyWFHForm";
import axios from "axios";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyError, notifySuccess } from "@/utils/toast";

const ApplyWFHPage = () => {
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);

      // Extract only the fields needed by the backend
      const wfhData = {
        employee: formData.employee,
        reason: formData.reason,
        date_from: formData.date_from,
        date_to: formData.date_to,
      };

      const res = await axios.post(`${Base_URL}/WFH`, wfhData);

      console.log("response", res);

      notifySuccess("Work From Home request submitted successfully!", () => {
        history.push("/WFH-management");
      });
    } catch (err) {
      console.error("Error submitting WFH request:", err);

      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Failed to submit WFH request.";

      notifyError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    history.push("/WFH-management");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-60 z-10 flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
          </div>
        )}

        <ApplyWFHForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          disabled={loading} // optional: disable inputs/buttons while loading
        />
      </div>
    </div>
  );
};

export default ApplyWFHPage;
