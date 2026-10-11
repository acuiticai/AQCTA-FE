import { useEffect, useState, useContext } from "react";
import Cookies from "js-cookie";
import { AdminContext } from "@/context/AdminContext";
import {
  BRANDING_LOGO_CACHE_KEY,
  BRANDING_PLACEHOLDER_LOGO,
  fetchBrandingLogo,
  readCachedBrandingLogo,
  writeCachedBrandingLogo,
} from "@/utils/brandingLogo";

export default function useConfigLogo() {
  const [logo, setLogo] = useState(() => {
    const cached = readCachedBrandingLogo();
    return cached || BRANDING_PLACEHOLDER_LOGO;
  });
  const adminCtx = useContext(AdminContext);
  const state = adminCtx?.state;

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        let token = localStorage.getItem("token");

        if (!token) {
          const cookieToken = Cookies.get("token");
          if (cookieToken) token = cookieToken;
        }

        if (!token) {
          const adminInfo = Cookies.get("adminInfo");
          if (adminInfo) {
            const parsedAdminInfo = JSON.parse(adminInfo);
            token = parsedAdminInfo.token;
          }
        }

        if (!token && state?.token) {
          token = state.token;
        }

        let bearerToken = token;
        if (typeof token === "string" && token.startsWith("{")) {
          try {
            const parsedToken = JSON.parse(token);
            bearerToken = parsedToken.token || parsedToken;
          } catch (_) {
            bearerToken = token;
          }
        }

        const axiosConfig = bearerToken
          ? { headers: { Authorization: `Bearer ${bearerToken}` } }
          : {};

        const nextLogo = await fetchBrandingLogo(axiosConfig);
        if (nextLogo) {
          setLogo(nextLogo);
          writeCachedBrandingLogo(nextLogo);
          return;
        }

        const cached = readCachedBrandingLogo();
        setLogo(cached || BRANDING_PLACEHOLDER_LOGO);
      } catch (_) {
        const cached = readCachedBrandingLogo();
        setLogo(cached || BRANDING_PLACEHOLDER_LOGO);
      }
    };

    fetchLogo();
  }, [state]);

  return logo;
}

export { BRANDING_LOGO_CACHE_KEY, BRANDING_PLACEHOLDER_LOGO };
