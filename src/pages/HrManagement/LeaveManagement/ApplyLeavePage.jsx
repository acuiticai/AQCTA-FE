import React, { useState } from "react";
import ApplyLeaveForm from "../components/ApplyLeaveForm";
import axios from "axios";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyWarning, notifySuccess } from "@/utils/toast";

const ApplyLeavePage = () => {
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const handleSubmit = async (formData, adminInfo) => {
    try {
      setLoading(true);

      const res = await axios.post(`${Base_URL}/leaves`, formData);

      console.log("response", res);

      notifySuccess("Leave request submitted successfully!", () => {
        history.push("/leave-management");
      });
    } catch (err) {
      console.error("Error submitting leave request:", err);

      // Extract meaningful error message from server or fallback
      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Failed to submit leave request.";

      notifyWarning(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    history.push("/leave-management");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-h-[90vh] overflow-y-auto pb-[120px]">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-50 z-10 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--p-blue)]"></div>
          </div>
        )}

        <ApplyLeaveForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          disabled={loading} // optional prop if you want to disable inputs while loading
        />
      </div>
    </div>
  );
};

export default ApplyLeavePage;
