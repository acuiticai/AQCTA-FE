import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import moment from "moment";
import PageTitle from "@/components/Typography/PageTitle";
import AnimatedContent from "@/components/common/AnimatedContent";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ActivityLogDetails = () => {
  const { t } = useTranslation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const logId = location.state ? location.state.ActivityLogs_id : null;

  useEffect(() => {
    if (logId) {
      fetchLogDetails();
    }
  }, [logId]);

  const fetchLogDetails = async () => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    try {
      const response = await axios.post(
        `${Base_URL}/ActivityLogs/get_single`,
        { _id: logId },
        { headers }
      );
      setData(response.data.data || {});
    } catch (error) {
      console.error("Error fetching log details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>{t("Loading...")}</div>;
  }

  const renderFieldChanges = () => {
    const { previousData, newData } = data;

    if (!previousData && !newData) {
      return (
        <tr>
          <td colSpan="3" className="text-center px-4 py-2">
            {t("No data available")}
          </td>
        </tr>
      );
    }

    const fields = new Set([
      ...(previousData ? Object.keys(previousData) : []),
      ...(newData ? Object.keys(newData) : []),
    ]);

    return [...fields].map((field) => (
      <tr key={field}>
        <td className="border px-4 py-2 break-words">{field}</td>
        <td className="border px-4 py-2 break-words">
          {previousData && previousData[field] ? (
            field === "image" ? (
              <img
                src={previousData[field]}
                alt="Previous"
                className="h-16 w-16 object-cover mx-auto"
              />
            ) : (
              previousData[field]
            )
          ) : (
            "N/A"
          )}
        </td>
        <td className="border px-4 py-2 break-words">
          {newData && newData[field] ? (
            field === "image" ? (
              <img
                src={newData[field]}
                alt="New"
                className="h-16 w-16 object-cover mx-auto"
              />
            ) : (
              newData[field]
            )
          ) : (
            "N/A"
          )}
        </td>
      </tr>
    ));
  };

  return (
    <>
      <PageTitle>{t("Log Details")}</PageTitle>
      <AnimatedContent>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-semibold mb-4">{t("Log Details")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Log Metadata */}
            <div className="overflow-auto max-h-96">
              <table className="table-auto w-full border-collapse border border-gray-200 dark:border-gray-700">
                <tbody>
                  <tr>
                    <td className="font-semibold">{t("User Name")}</td>
                    <td className="break-words">
                      {data?.userDetails?.name || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-semibold">{t("User Email")}</td>
                    <td className="break-words">
                      {data?.userDetails?.email || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-semibold">{t("DB Table")}</td>
                    <td className="break-words">{data?.Collection || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">{t("Action")}</td>
                    <td className="break-words">{data?.Action || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">{t("Record ID")}</td>
                    <td className="break-words">{data?._id || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">{t("Date Time")}</td>
                    <td className="break-words">
                      {moment(data?.createdAt).format(
                        "DD-MM-YYYY, h:mm:ss A"
                      ) || "N/A"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Field Changes */}
            <div className="overflow-auto max-h-96">
              <h3 className="text-md font-semibold mb-2">
                {t("Data Details")}
              </h3>
              <table className="table-auto w-full border-collapse border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr>
                    <th className="border px-4 py-2">{t("Field")}</th>
                    <th className="border px-4 py-2">{t("Previous Value")}</th>
                    <th className="border px-4 py-2">{t("New Value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {renderFieldChanges() || (
                    <tr>
                      <td colSpan="3" className="text-center px-4 py-2">
                        {t("No changes available")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AnimatedContent>
    </>
  );
};

export default ActivityLogDetails;
