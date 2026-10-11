import { useCallback, useEffect, useState } from "react";

import CustomerApplicationServices from "../services/applicationService";
import CustomerInvoiceServices from "../services/invoiceService";
import CustomerQuotationServices from "../services/quotationService";
import CustomerProjectServices from "../services/projectService";
import CustomerNotificationServices from "../services/notificationService";
import { buildDashboardPayload } from "../utils/buildDashboardPayload";

const emptyLists = () => ({
  applications: [],
  invoices: [],
  quotations: [],
  notifications: [],
  projects: [],
});

/**
 * Loads every customer-portal list the dashboard can derive from, in parallel,
 * and maps them into the widget payload.
 */
export default function useCustomerDashboardData() {
  const [data, setData] = useState(() =>
    buildDashboardPayload({ audience: "customer" }),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        CustomerApplicationServices.getMyApplications({ limit: 100 }),
        CustomerInvoiceServices.getMyInvoices(),
        CustomerQuotationServices.getMyQuotations(),
        CustomerNotificationServices.getMyNotifications(),
        CustomerProjectServices.getMyProjects(),
      ]);

      const pick = (index) => {
        const r = results[index];
        if (r.status !== "fulfilled") return [];
        const body = r.value?.data;
        return Array.isArray(body?.data) ? body.data : [];
      };

      const lists = {
        applications: pick(0),
        invoices: pick(1),
        quotations: pick(2),
        notifications: pick(3),
        projects: pick(4),
      };

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === results.length) {
        setError("Could not load dashboard data. Please try again.");
        setData(buildDashboardPayload({ audience: "customer", ...emptyLists() }));
      } else {
        setData(buildDashboardPayload({ audience: "customer", ...lists }));
        if (failed > 0) {
          setError("Some dashboard sections could not be loaded.");
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard.");
      setData(buildDashboardPayload({ audience: "customer", ...emptyLists() }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
