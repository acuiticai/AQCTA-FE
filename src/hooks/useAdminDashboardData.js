import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import ApplicationServices from "@/services/ApplicationServices";
import ProjectServices from "@/services/ProjectServices";
import CustomerInvoiceServices from "@/services/CustomerInvoiceServices";
import { buildDashboardPayload } from "@/customer/utils/buildDashboardPayload";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emptyLists = () => ({
  applications: [],
  invoices: [],
  quotations: [],
  notifications: [],
  projects: [],
});

const normalizeAdminApps = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    id: row.applicationNumber || row.id || String(row._id || ""),
    submitted: row.submittedAt
      ? new Date(row.submittedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })
      : "—",
  }));

const normalizeAdminInvoices = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    invoiceNumber: row.invoice_number || row.invoiceNumber,
    amount: row.grandTotal ?? row.amount ?? 0,
    currency: row.currency || "MYR",
    issuedAt: row.invoice_date || row.createdAt,
    dueDate: row.due_date,
  }));

const authHeadersFromStorage = () => {
  try {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    return adminInfo?.token
      ? { Authorization: `Bearer ${adminInfo.token}` }
      : {};
  } catch {
    return {};
  }
};

/**
 * Admin home dashboard — same widgets as the customer portal, fed from
 * staff APIs. Recent Updates loads ALL customer-portal notifications
 * (not the admin's personal staff inbox).
 */
export default function useAdminDashboardData() {
  const [data, setData] = useState(() =>
    buildDashboardPayload({ audience: "admin" }),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = authHeadersFromStorage();
      const businesses = await syncAssignedBusinessesFromApi(Base_URL);
      const businessIds = (businesses || [])
        .map((b) => b._id)
        .filter(Boolean)
        .join(",");

      const appParams = { limit: 100, page: 1 };
      const projectParams = { limit: 100, page: 1 };
      const invoiceParams = { limit: 100, page: 1 };
      const notifParams = { limit: 40 };
      if (businessIds) {
        appParams.business_ids = businessIds;
        projectParams.businessIds = JSON.stringify(
          businessIds.split(","),
        );
        invoiceParams.businessIds = businessIds;
        notifParams.business_ids = businessIds;
      }

      const results = await Promise.allSettled([
        businessIds
          ? ApplicationServices.getAllApplications(appParams, { headers })
          : Promise.resolve({ data: { data: [] } }),
        ProjectServices.getAllProjects(projectParams, { headers }),
        CustomerInvoiceServices.getAllInvoices(invoiceParams),
        axios.get(`${Base_URL}/customer-notifications`, {
          headers,
          params: notifParams,
        }),
      ]);

      const appsRes = results[0];
      const projectsRes = results[1];
      const invoicesRes = results[2];
      const notesRes = results[3];

      const applications =
        appsRes.status === "fulfilled"
          ? normalizeAdminApps(appsRes.value?.data?.data)
          : [];
      const projects =
        projectsRes.status === "fulfilled"
          ? Array.isArray(projectsRes.value?.data?.data)
            ? projectsRes.value.data.data
            : []
          : [];
      const invoices =
        invoicesRes.status === "fulfilled"
          ? normalizeAdminInvoices(
              invoicesRes.value?.data?.data || invoicesRes.value?.data,
            )
          : [];
      const notifications =
        notesRes.status === "fulfilled" &&
        Array.isArray(notesRes.value?.data?.data)
          ? notesRes.value.data.data
          : [];

      const lists = {
        applications,
        invoices,
        quotations: [],
        notifications,
        projects,
      };

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === results.length) {
        setError("Could not load dashboard data. Please try again.");
        setData(buildDashboardPayload({ audience: "admin", ...emptyLists() }));
      } else {
        setData(buildDashboardPayload({ audience: "admin", ...lists }));
        if (failed > 0) {
          setError("Some dashboard sections could not be loaded.");
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard.");
      setData(buildDashboardPayload({ audience: "admin", ...emptyLists() }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
