import { useEffect, useState } from "react";
import { ensurePublicEmailConfigLoaded } from "@/services/publicConfigService";
import { notifyError } from "@/utils/toast";

/**
 * Loads default outbound email fields from GET /api/public-config.
 */
export function useEmailDefaults({ adminEmail } = {}) {
  const [defaults, setDefaults] = useState({
    from: "",
    cc: "",
    fromName: "",
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    ensurePublicEmailConfigLoaded()
      .then((cfg) => {
        if (cancelled) return;
        const admin = String(adminEmail || "").trim();
        setDefaults({
          from: admin || cfg.emailUser,
          cc: cfg.emailCc,
          fromName: cfg.emailFromName,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error?.message || "Could not load default email settings.";
        setDefaults({
          from: "",
          cc: "",
          fromName: "",
          loading: false,
          error: message,
        });
        notifyError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [adminEmail]);

  return defaults;
}
