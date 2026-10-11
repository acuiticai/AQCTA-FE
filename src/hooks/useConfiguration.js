import { useContext, useEffect } from "react";
import { useHistory } from "react-router-dom";
import {
  getCachedConfigurationResponse,
  applyThemeColorVars,
} from "@/utils/sessionApiCache";
import Cookies from "js-cookie";
import { AdminContext } from "@/context/AdminContext";
import useCheckTokenExpired from "./useCheckTokenExpired";

export const config = {
  decimalPlaces: 2,
  dateFormat: "DD-MM-YYYY",
  timeFormat: "hh:mm A",
};

export const useConfiguration = () => {
  const { dispatch, state } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  const checkTokenExpired = useCheckTokenExpired();

  useEffect(() => {
    const fetchConfiguration = async () => {
      if (!adminInfo?.token) {
        dispatch({ type: "USER_LOGOUT" });
        Cookies.remove("adminInfo");
        history.push("/login");
        return;
      }

      try {
        const response = await getCachedConfigurationResponse(adminInfo.token);
        if (!response) return;
        if (checkTokenExpired(response)) return;
        if (response.status === 200 && response.data && response.data[0]) {
          const data = response.data[0];
          config.decimalPlaces = data.amount_format || config.decimalPlaces;
          config.dateFormat = data.date_format || config.dateFormat;
          config.timeFormat = data.time_format || config.timeFormat;
          applyThemeColorVars({
            buttons_color: data.buttons_color,
            topbar_color: data.topbar_color,
            leftbar_color: data.leftbar_color,
            buttons_text_color: data.buttons_text_color,
          });
          console.log("✅ Configuration Updated:", config);
        } else {
          console.warn("⚠️ No configuration data received from server.");
        }
      } catch (error) {
        console.error("❌ Error fetching configuration:", error);
      }
    };

    fetchConfiguration();
  }, [dispatch, history, adminInfo?.token, checkTokenExpired]);

  return config;
};
