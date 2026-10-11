import dayjs from "dayjs";
import SettingServices from "@/services/SettingServices";
import { useDispatch, useSelector } from "react-redux";
import { addSetting, removeSetting } from "@/reduxStore/slice/settingSlice";
import { useContext, useEffect, useState } from "react";
import { SidebarContext } from "@/context/SidebarContext";
import { getConfig } from "@/components/formatAmount";

const useUtilsFunction = () => {
  const dispatch = useDispatch();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { lang } = useContext(SidebarContext);

  const settings = useSelector((state) => state.setting.settingItem);

  const globalSetting = settings.find(
    (value) => value.name === "globalSetting"
  );

  // console.log("globalSetting", globalSetting);
  //for date and time format
  // Fallback prevents dayjs from formatting the literal string "undefined"
  // (e.g. "undefined" → "un2efine2" when `d` is replaced by day-of-week).
  const dateFormat =
    globalSetting?.default_date_format ||
    getConfig()?.date_format ||
    "DD-MM-YYYY";

  const showTimeFormat = (data, timeFormat) => {
    return dayjs(data).format(timeFormat);
  };

  const showDateFormat = (data) => {
    if (data == null || data === "") return "-";
    const parsed = dayjs(data);
    return parsed.isValid() ? parsed.format(dateFormat) : "-";
  };

  const showDateTimeFormat = (data) => {
    if (data == null || data === "") return "-";
    const parsed = dayjs(data);
    return parsed.isValid()
      ? parsed.format(`${dateFormat}  h:mm A`)
      : "-";
  };

  //for formatting number

  const getNumber = (value = 0) => {
    return Number(parseFloat(value || 0).toFixed(2));
  };

  const getNumberTwo = (value = 0) => {
    return parseFloat(value || 0).toFixed(globalSetting?.floating_number || 2);
  };

  //for translation
  const showingTranslateValue = (data) => {
    return data !== undefined && Object?.keys(data).includes(lang)
      ? data[lang]
      : data?.en;
  };

  const showingImage = (data) => {
    return data !== undefined && data;
  };

  const showingUrl = (data) => {
    return data !== undefined ? data : "!#";
  };

  const currency = globalSetting?.default_currency || "$";

  useEffect(() => {
    // console.log("globalSetting", globalSetting);
    const fetchGlobalSetting = async () => {
      try {
        setLoading(true);
        console.log("globalSetting setting not available");
        const res = await SettingServices.getGlobalSetting();
        const globalSettingData = {
          ...res,
          name: "globalSetting",
        };

        dispatch(addSetting(globalSettingData));

        setLoading(false);
      } catch (err) {
        setError(err.message);
        console.log("Error on getting storeCustomizationSetting setting", err);
      }
    };

    if (!globalSetting) {
      fetchGlobalSetting();
    }
  }, [globalSetting]);

  return {
    error,
    loading,
    currency,
    getNumber,
    getNumberTwo,
    showTimeFormat,
    showDateFormat,
    showingImage,
    showingUrl,
    globalSetting,
    showDateTimeFormat,
    showingTranslateValue,
  };
};

export default useUtilsFunction;
