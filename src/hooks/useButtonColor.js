// src/hooks/useButtonColor.js
import { useState, useEffect, useContext, useCallback } from "react";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";
import Cookies from "js-cookie";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import {
  getCachedConfigurationResponse,
  CONFIGURATION_UPDATED_EVENT,
  applyThemeColorVars,
} from "@/utils/sessionApiCache";

const DEFAULT_BUTTON_COLOR = "var(--p-blue)";

const useButtonColor = () => {
  const [buttonColor, setButtonColor] = useState(DEFAULT_BUTTON_COLOR);
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();
  const checkTokenExpired = useCheckTokenExpired();

  const fetchConfiguration = useCallback(async () => {
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
      const configuration = response.data[0];

      if (configuration?.buttons_color) {
        setButtonColor(configuration.buttons_color);
        applyThemeColorVars({
          buttons_color: configuration.buttons_color,
          topbar_color: configuration.topbar_color,
          leftbar_color: configuration.leftbar_color,
          buttons_text_color: configuration.buttons_text_color,
        });
      }
    } catch (error) {
      console.error("Failed to fetch button color:", error);
    }
  }, [adminInfo?.token, checkTokenExpired, dispatch, history]);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  useEffect(() => {
    const onConfigurationUpdated = (event) => {
      const nextColor = event?.detail?.buttons_color;
      if (nextColor) {
        setButtonColor(nextColor);
        applyThemeColorVars(event.detail);
        return;
      }
      fetchConfiguration();
    };

    window.addEventListener(
      CONFIGURATION_UPDATED_EVENT,
      onConfigurationUpdated,
    );
    return () => {
      window.removeEventListener(
        CONFIGURATION_UPDATED_EVENT,
        onConfigurationUpdated,
      );
    };
  }, [fetchConfiguration]);

  return buttonColor;
};

export default useButtonColor;
