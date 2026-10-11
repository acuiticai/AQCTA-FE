import { useState, useEffect, useMemo, useContext } from "react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/** Treat missing / undefined as enabled (backward compatible). */
export function isEInvoiceEnabledValue(business) {
  if (!business || typeof business !== "object") return true;
  return business.eInvoiceEnabled !== false;
}

/**
 * Loads a single business and returns whether MyInvois / e-invoice is enabled.
 */
export function useBusinessEInvoiceEnabled(businessId) {
  const { state } = useContext(AdminContext);
  const token = state?.adminInfo?.token;
  const [loading, setLoading] = useState(!!businessId);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      setEnabled(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const headers = token
      ? { "Content-Type": "application/json", authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
    axios
      .get(`${Base_URL}/Business/${businessId}`, { headers })
      .then((res) => {
        const b = res.data?.data;
        if (!cancelled) setEnabled(isEInvoiceEnabledValue(b));
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, token]);

  return { enabled, loading };
}

/**
 * Map of business id → e-invoice enabled. Used when multiple businesses are in play.
 */
export function useEInvoiceEnabledMap(businessIds) {
  const idsKey = useMemo(
    () =>
      [...new Set((businessIds || []).filter(Boolean).map(String))].sort().join(","),
    [businessIds],
  );
  const { state } = useContext(AdminContext);
  const token = state?.adminInfo?.token;
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(!!idsKey);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",").filter(Boolean) : [];
    if (!ids.length) {
      setMap({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const headers = token
      ? { "Content-Type": "application/json", authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
    Promise.all(
      ids.map((id) =>
        axios
          .get(`${Base_URL}/Business/${id}`, { headers })
          .then((res) => [id, isEInvoiceEnabledValue(res.data?.data)])
          .catch(() => [id, true]),
      ),
    )
      .then((pairs) => {
        if (cancelled) return;
        const m = {};
        pairs.forEach(([id, v]) => {
          m[id] = v;
        });
        setMap(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey, token]);

  return { eInvoiceByBusiness: map, loading };
}
