import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Plus } from "lucide-react";
import { FiTrash2 } from "react-icons/fi";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const FWAlertSettings = ({ organization, headers }) => {
  const { t } = useTranslation();
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options });

  const { canAdd, canDelete } = useSettingsCrudPermissions();
  const [alerts, setAlerts] = useState([]);
  const [daysBefore, setDaysBefore] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [inputError, setInputError] = useState("");

  useEffect(() => {
    if (organization) {
      fetchAlerts();
    }
  }, [organization]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${BASE_URL}/fw-alert-config/get?business=${organization}`,
        { headers }
      );
      setAlerts(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(thr("fwAlerts.failedToLoad", "Failed to load alert configurations."));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!canAdd) return;
    const val = parseInt(daysBefore);
    if (!daysBefore || isNaN(val) || val < 1) {
      setInputError(
        thr(
          "fwAlerts.validDaysMinimumOne",
          "Please enter a valid number of days (minimum 1).",
        ),
      );
      return;
    }
    setInputError("");
    setAdding(true);
    try {
      await axios.post(
        `${BASE_URL}/fw-alert-config/add`,
        { business_id: organization, daysBefore: val },
        { headers }
      );
      setDaysBefore("");
      fetchAlerts();
    } catch (err) {
      if (err.response?.status === 409) {
        setInputError(
          thr(
            "fwAlerts.alertAlreadyExists",
            "An alert for this number of days already exists.",
          ),
        );
      } else {
        setError(thr("fwAlerts.failedToAdd", "Failed to add alert."));
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    try {
      await axios.delete(`${BASE_URL}/fw-alert-config/delete/${id}`, { headers });
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setError(thr("fwAlerts.failedToDelete", "Failed to delete alert."));
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">
          {thr("fwAlerts.visaExpiryAlertConfig", "Visa Expiry Alert Configuration")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {thr(
            "fwAlerts.visaExpiryAlertConfigDesc",
            "Configure how many days before a staff member's work pass visa expires you want to receive an alert.",
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Add new alert row */}
      {canAdd && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {thr("fwAlerts.addNewAlert", "Add New Alert")}
          </p>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  {thr("fwAlerts.sendAlert", "Send alert")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={daysBefore}
                  onChange={(e) => {
                    setDaysBefore(e.target.value);
                    setInputError("");
                  }}
                  placeholder={thr("fwAlerts.daysBeforePlaceholder", "e.g. 10")}
                  className="w-24 p-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  {thr("fwAlerts.daysBeforeVisaExpiry", "days before visa expiry")}
                </span>
              </div>
              {inputError && (
                <p className="text-red-500 text-xs mt-1.5">{inputError}</p>
              )}
            </div>
            <button
              type="button"
              disabled={adding}
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white text-sm font-medium rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {adding
                ? thr("adding", "Adding...")
                : thr("fwAlerts.addAlert", "Add Alert")}
            </button>
          </div>
        </div>
      )}

      {/* Alerts table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            {thr("fwAlerts.loading", "Loading alerts...")}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-gray-500 text-sm">
              {thr("fwAlerts.noAlertConfigsYet", "No alert configurations yet.")}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {thr(
                "fwAlerts.addAlertAboveHint",
                "Add an alert above to get notified before a work pass expires.",
              )}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {thr("fwAlerts.alert", "Alert")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {thr("fwAlerts.daysBeforeExpiry", "Days Before Expiry")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {thr("actions", "Actions")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.map((alert) => (
                <tr key={alert._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {thr(
                      "fwAlerts.sendAlertBeforeVisaExpiry",
                      "Send alert before visa expiry",
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[var(--p-blue)] border border-blue-100">
                      {alert.daysBefore === 1
                        ? thr("fwAlerts.dayBefore", "{{count}} day before", {
                            count: alert.daysBefore,
                          })
                        : thr("fwAlerts.daysBefore", "{{count}} days before", {
                            count: alert.daysBefore,
                          })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(alert._id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title={thr("fwAlerts.deleteAlertTitle", "Delete alert")}
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FWAlertSettings;
