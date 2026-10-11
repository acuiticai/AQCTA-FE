import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
export const SEAT_USAGE_REFRESH_EVENT = "flexa:seat-usage-refresh";

/** Notify all mounted useUserLimit hooks to reload seat usage from the API. */
export const refreshSeatUsage = () => {
  window.dispatchEvent(new CustomEvent(SEAT_USAGE_REFRESH_EVENT));
};

/** Load System User seat usage against the subscription plan limit. */
export default function useUserLimit({ enabled = true } = {}) {
  const { state } = useContext(AdminContext);
  const adminInfo = state?.adminInfo;
  const [userUsage, setUserUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    refreshSeatUsage();
  }, []);

  useEffect(() => {
    const onRefresh = () => setRefreshKey((key) => key + 1);
    window.addEventListener(SEAT_USAGE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(SEAT_USAGE_REFRESH_EVENT, onRefresh);
  }, []);

  useEffect(() => {
    if (!enabled || !adminInfo?.token) {
      setUserUsage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    axios
      .get(`${Base_URL}/SystemUsers/seat-usage`, {
        headers: { authorization: `Bearer ${adminInfo.token}` },
      })
      .then((res) => {
        if (!cancelled && res.data?.status) {
          setUserUsage(res.data.seats || null);
        }
      })
      .catch(() => {
        if (!cancelled) setUserUsage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, adminInfo?.token, refreshKey]);

  return { userUsage, loading, refresh };
}
