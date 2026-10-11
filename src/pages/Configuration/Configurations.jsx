import { useTranslation } from "react-i18next";
import { Button, Select } from "@windmill/react-ui";
import { useState, useEffect, useContext } from "react";
import Cookies from "js-cookie";

//internal import

import PageTitle from "@/components/Typography/PageTitle";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import InputAreaTwo from "@/components/form/input/InputAreaTwo";
import { AdminContext } from "@/context/AdminContext";
import { useHistory } from "react-router-dom";

import AnimatedContent from "@/components/common/AnimatedContent";
import { SketchPicker } from "react-color";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import {
  normalizeLogoUrl,
  writeCachedBrandingLogo,
} from "@/utils/brandingLogo";
import useButtonColor from "@/hooks/useButtonColor";
import { Form, FormTitle, PageHeader } from "@/page-layouts/index";
import { type } from "jquery";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import {
  invalidateConfigurationCache,
  notifyConfigurationUpdated,
  applyThemeColorVars,
} from "@/utils/sessionApiCache";
import _ from "lodash";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const Configuration = () => {
  // const { errors, register, isSave, isSubmitting, onSubmit, handleSubmit } =
  //   useSettingSubmit();
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const history = useHistory();

  const [logoPreview, setLogoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const buttonColor = useButtonColor();
  const checkTokenExpired = useCheckTokenExpired(); // ✅ hook used properly

  const [configData, setConfigData] = useState({});
  const [selectedDateFormat, setSelectedDateFormat] = useState("");
  const [selectedTimeFormat, setSelectedTimeFormat] = useState("");

  useEffect(() => {
    const fetchConfiguration = async () => {
      try {
        if (!adminInfo?.token) {
          dispatch({ type: "USER_LOGOUT" });
          Cookies.remove("adminInfo");
          history?.push?.("/login");
          return;
        }

        const headers = {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        };
        const response = await axios.get(`${Base_URL}/configuration`, {
          headers,
        });
        if (checkTokenExpired(response)) return;
        const data = response.data[0];
        console.log("configData configData ", data); // Assuming only one record
        setConfigData(data);
        setSelectedDateFormat(data.date_format);
        setSelectedTimeFormat(data.time_format);

        // Set colors from the DB
        setSelectedColors([
          data.buttons_color || "",
          data.topbar_color || "",
          data.leftbar_color || "",
          data.buttons_text_color || "",
        ]);
        applyThemeColorVars({
          buttons_color: data.buttons_color,
          topbar_color: data.topbar_color,
          leftbar_color: data.leftbar_color,
          buttons_text_color: data.buttons_text_color,
        });

        // Set logo preview if exists (should be S3 signed URL)
        if (data.system_logo) {
          // If it's already a full URL (S3 signed URL), use it directly
          // Otherwise, construct the URL (for backward compatibility with old local uploads)
          const logoUrl = data.system_logo.startsWith('http') 
            ? data.system_logo 
            : `${Base_URL}${data.system_logo}`;
          setLogoPreview(logoUrl);
          writeCachedBrandingLogo(normalizeLogoUrl(logoUrl));
        } else {
          setLogoPreview(null);
          writeCachedBrandingLogo(null);
        }

        try {
          localStorage.setItem(
            "configurations",
            JSON.stringify({
              name: data.name,
              email: data.email,
              website: data.website || "",
              system_logo: data.system_logo || null,
              buttons_color: data.buttons_color || "",
              system_color: data.system_color || "",
            }),
          );
        } catch (_) {
          // ignore
        }
      } catch (error) {
        console.error("Error fetching configuration:", error);
        notifyError(t("configurations.failedToLoadConfigurationData"));
      }
    };

    fetchConfiguration();
  }, []);

  const handleLogoChange = (file, fileUrl) => {
    let actualFile = file;
    if (file && file.target && file.target.files) {
      actualFile = file.target.files[0];
    }
    
    if (actualFile && actualFile instanceof File) {
      // Show preview and store file for upload on submit
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(actualFile);
      setConfigData({ ...configData, system_logo: actualFile });
    } else if (fileUrl) {
      setLogoPreview(fileUrl);
      if (typeof fileUrl === 'string' && fileUrl.startsWith('http')) {
        setConfigData({ ...configData, system_logo: fileUrl });
      }
    } else {
      setLogoPreview(null);
      setConfigData({ ...configData, system_logo: null });
    }
  };

  const [displayPickers, setDisplayPickers] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [selectedColors, setSelectedColors] = useState([
    localStorage.getItem("buttons_color") || "",
    localStorage.getItem("topbar_color") || "",
    localStorage.getItem("leftbar_color") || "",
    localStorage.getItem("buttons_text_color") || "",
  ]);

  const { t } = useTranslation();

  const handleColorPickerDisplay = (index) => {
    const updatedPickers = [false, false, false, false];
    updatedPickers[index] = true;
    setDisplayPickers(updatedPickers);
  };

  const handleColorChange = (color, index) => {
    const updatedColors = [...selectedColors];
    updatedColors[index] = color.hex;
    setSelectedColors(updatedColors);

    const cssVars = [
      "--buttons-color",
      "--topbar-color",
      "--leftbar-color",
      "--buttons-text-color",
    ];
    document.documentElement.style.setProperty(cssVars[index], color.hex);
  };

  const handleColorPickerClose = (index) => {
    const updatedPickers = [...displayPickers];
    updatedPickers[index] = false;
    setDisplayPickers(updatedPickers);
  };

  const ColorPicker = ({
    label,
    color,
    onClick,
    onClose,
    onChange,
    display,
  }) => (
    <div className="grid md:grid-cols-5 sm:grid-cols-12 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
      <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 sm:col-span-2">
        {label}
      </label>
      <div className="sm:col-span-3 flex items-center">
        <Button
          type="button"
          style={{ backgroundColor: color }}
          onClick={onClick}
          className="w-10 h-10 rounded-full border"
        />
        {display && (
          <div className="absolute z-50">
            <div
              className="fixed inset-0"
              onClick={onClose}
              style={{ background: "rgba(0,0,0,0.3)" }}
            />
            <SketchPicker color={color} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(); // FormData for multipart data

      // Get values from the form fields
      const formElements = configData;

      const name = configData.name || ""; // Default to empty if undefined
      const email = configData.email || "";

      const login_email = configData.login_email || "";
      const login_alerts = configData.login_alerts === true ? true : false;
      const google_api_key = configData.google_api_key || "";
      const date_format = selectedDateFormat;
      let amount_format = configData.amount_format || "2";
      const time_format = selectedTimeFormat;
      amount_format = Number(amount_format);

      // Append values to FormData
      formData.append("name", name);
      formData.append("email", email);
      formData.append("website", configData.website || "");
      formData.append("system_color", selectedColors[0]);
      formData.append("buttons_color", selectedColors[0]);
      formData.append("leftbar_color", selectedColors[2]);
      formData.append("topbar_color", selectedColors[1]);
      if (selectedColors[3]) {
        formData.append("buttons_text_color", selectedColors[3]);
      }

      formData.append("login_email", login_email);
      formData.append("date_format", date_format);
      formData.append("login_alerts", login_alerts);
      formData.append("google_api_key", google_api_key);
      formData.append("time_format", time_format);
      //   notifyError("Invalid amount format. Allowed values: 0, 1, 2, 3");
      //   setIsSubmitting(false);
      //   return;
      // }

      formData.append("amount_format", amount_format);

      // Table entries per page (frontend setting)
      const tableEntries = Number(configData.table_entries_per_page) || 10;
      formData.append("table_entries_per_page", tableEntries);

      const waDelay = Number(configData.marketing_whatsapp_recipient_delay_seconds);
      const allowedWaDelays = [5, 10, 15, 30, 45, 60];
      formData.append(
        "marketing_whatsapp_recipient_delay_seconds",
        allowedWaDelays.includes(waDelay) ? waDelay : 10,
      );

      const allowedCronKeys = [
        "every_minute",
        "every_10_minutes",
        "every_15_minutes",
        "every_30_minutes",
        "every_50_minutes",
        "every_hour",
        "every_2_hours",
        "every_6_hours",
        "daily_midnight",
      ];
      const cronKey = String(configData.marketing_announcement_cron || "").trim();
      formData.append(
        "marketing_announcement_cron",
        allowedCronKeys.includes(cronKey) ? cronKey : "every_10_minutes",
      );

      const allowedReorderCronKeys = [
        "daily_0600",
        "daily_0700",
        "daily_0800",
        "daily_0900",
        "daily_1000",
        "daily_1200",
        "daily_1800",
        "every_hour",
        "every_6_hours",
      ];
      const reorderCronKey = String(configData.reorder_alert_cron || "").trim();
      formData.append(
        "reorder_alert_cron",
        allowedReorderCronKeys.includes(reorderCronKey)
          ? reorderCronKey
          : "daily_0800",
      );

      const sessionDays = Number(configData.sessionExpiryDays);
      formData.append(
        "sessionExpiryDays",
        Number.isFinite(sessionDays) && sessionDays >= 1 && sessionDays <= 365
          ? sessionDays
          : 30,
      );

      // Handle logo: upload to S3 if it's a new file, otherwise use existing URL
      const logoFile = configData.system_logo;
      if (logoFile) {
        if (logoFile instanceof File) {
          // New file selected - upload to S3 first
          const uploadFormData = new FormData();
          uploadFormData.append("image", logoFile);
          
          const uploadResponse = await axios.post(`${Base_URL}/upload`, uploadFormData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          
          if (uploadResponse.data && uploadResponse.data.url) {
            formData.append("system_logo", uploadResponse.data.url);
          } else {
            throw new Error("Failed to upload logo");
          }
        } else if (typeof logoFile === 'string') {
          // Existing logo URL - use it directly
          formData.append("system_logo", logoFile);
        }
      }

      // Prepare headers with authorization
      const headers = {
        "Content-Type": "multipart/form-data",
      };
      
      if (adminInfo?.token) {
        headers.authorization = `Bearer ${adminInfo.token}`;
      }

      // Use Base_URL for the API call
      const response = await axios.post(`${Base_URL}/configuration`, formData, {
        headers,
      });

      // Store configuration in localStorage
      const themeColors = {
        buttons_color: selectedColors[0],
        leftbar_color: selectedColors[2],
        topbar_color: selectedColors[1],
        buttons_text_color: selectedColors[3] || "",
      };
      const configToStore = {
        name: configData.name,
        email: configData.email,
        website: configData.website || "",
        system_color: selectedColors[0],
        ...themeColors,
        login_email: configData.login_email,
        google_api_key: configData.google_api_key || "",
        date_format: selectedDateFormat,
        login_alerts: configData.login_alerts,
        time_format: selectedTimeFormat,
        amount_format: configData.amount_format,
        table_entries_per_page: configData.table_entries_per_page || 10,
        marketing_whatsapp_recipient_delay_seconds:
          configData.marketing_whatsapp_recipient_delay_seconds ?? 10,
        marketing_announcement_cron:
          configData.marketing_announcement_cron ?? "every_10_minutes",
        reorder_alert_cron:
          configData.reorder_alert_cron ?? "daily_0800",
        sessionExpiryDays: configData.sessionExpiryDays ?? 30,
        system_logo:
          response.data?.data?.system_logo ??
          response.data?.system_logo ??
          (typeof configData.system_logo === "string"
            ? configData.system_logo
            : null),
      };
      localStorage.setItem("configurations", JSON.stringify(configToStore));

      const savedLogo = normalizeLogoUrl(configToStore.system_logo);
      writeCachedBrandingLogo(savedLogo);

      // Drop stale GET /configuration cache and push theme to open screens
      invalidateConfigurationCache();
      applyThemeColorVars(themeColors);
      notifyConfigurationUpdated(themeColors);

      notifySuccess(t("configurations.configurationSavedSuccessfully"));
      console.log("API Response:", response.data);
    } catch (error) {
      console.error("Error:", error);
      // alert(error.response?.data?.message || "Failed to save configuration");
      notifyError(
        error.response?.data?.message || t("configurations.failedToSaveConfiguration")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AnimatedContent>
        <div className="sm:container w-full mx-auto bg-white  dark:bg-gray-800 dark:text-gray-200 rounded-lg mt-4">
          <Form
            handleSubmit={handleSubmit}
            handleCancel={() => {}}
            buttonColor={selectedColors[0] || buttonColor}
            cancelButtonText={t("Cancel")}
            saveButtonText={t("Save")}
            formFields={[
              {
                label: t("configurations.systemName"),
                name: "name",
                type: "text",
                placeholder: t("configurations.systemName"),
                value: configData.name,
                description:
                  "This value will be used as SYSTEM_NAME in the browser tab title (PAGE_NAME - SYSTEM_NAME).",
                onChange: (e) =>
                  setConfigData({ ...configData, name: e.target.value }),
              },
              {
                label: t("configurations.adminEmail"),
                name: "email",
                type: "email",
                placeholder: t("admin@gmail.com"),
                value: configData.email,
                onChange: (e) =>
                  setConfigData({ ...configData, email: e.target.value }),
              },
              {
                label: "Website",
                name: "website",
                type: "text",
                placeholder: "www.example.com",
                value: configData.website || "",
                description:
                  "Shown in outbound email footers (with Admin Email under POWERED BY).",
                onChange: (e) =>
                  setConfigData({ ...configData, website: e.target.value }),
              },
              {
                label: t("configurations.loginAlert"),
                name: "login_email",
                type: "email",
                placeholder: t("syslab@gmail.com"),
                value: configData.login_email,
                onChange: (e) =>
                  setConfigData({ ...configData, login_email: e.target.value }),
              },
              {
                label: t("configurations.loginAlerts"),
                name: "login_alerts",
                type: "toggle",
                value: configData.login_alerts || false,
                onChange: (e) =>
                  setConfigData({
                    ...configData,
                    login_alerts: e.target.checked,
                  }),
                toggle: true,
              },
              {
                label: "Session expiry (days)",
                name: "sessionExpiryDays",
                type: "number",
                placeholder: "30",
                value: configData.sessionExpiryDays ?? 30,
                onChange: (e) =>
                  setConfigData({
                    ...configData,
                    sessionExpiryDays: Number(e.target.value),
                  }),
              },
              {
                label: "Google Map API Key",
                name: "google_api_key",
                type: "text",
                placeholder: "Enter Google Map API Key",
                value: configData.google_api_key || "",
                onChange: (e) =>
                  setConfigData({ ...configData, google_api_key: e.target.value }),
              },
              {
                label: t("configurations.dateFormat"),
                name: "date_format",
                type: "select",
                options: [
                  { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
                  { label: "DD-MM-YYYY", value: "DD-MM-YYYY" },
                  { label: "MM-DD-YYYY", value: "MM-DD-YYYY" },
                  { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
                  { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
                  { label: "YYYY/MM/DD", value: "YYYY/MM/DD" },
                  { label: "YYYY.MM.DD", value: "YYYY.MM.DD" },
                  { label: "DD.MM.YYYY", value: "DD.MM.YYYY" },
                  { label: "MM.DD.YYYY", value: "MM.DD.YYYY" },
                  { label: "DD MMMM YYYY", value: "DD MMMM YYYY" }, // 28 May 2026
                  { label: "MMMM DD, YYYY", value: "MMMM DD, YYYY" }, // May 28, 2026
                  { label: "YYYY MMMM DD", value: "YYYY MMMM DD" }, // 2026 May 28
                  { label: "DD MMM YYYY", value: "DD MMM YYYY" }, // 28 May 2026 (short month)
                  { label: "MMM DD, YYYY", value: "MMM DD, YYYY" }, // May 28, 2026 (short month)
                  { label: "DD/MM/YY", value: "DD/MM/YY" },
                  { label: "MM/DD/YY", value: "MM/DD/YY" },
                  { label: "YY-MM-DD", value: "YY-MM-DD" },
                  { label: "DD-MM-YY", value: "DD-MM-YY" },
                ],
                placeholder: t("configurations.selectDateFormat"),
                value: selectedDateFormat,
                onChange: (value) => setSelectedDateFormat(value),
              },
              {
                label: t("configurations.timeFormat"),
                name: "time_format",
                type: "select",
                options: [
                  { label: "HH:mm:ss", value: "HH:mm:ss" },
                  { label: "hh:mm A", value: "hh:mm A" },
                ],
                placeholder: t("configurations.selectTimeFormat"),
                value: selectedTimeFormat,
                onChange: (value) => setSelectedTimeFormat(value),
              },
              {
                label: t("configurations.amountFormat"),
                name: "amount_format",
                type: "select",
                options: [
                  { label: "0", value: 0 },
                  { label: "1", value: 1 },
                  { label: "2", value: 2 },
                  { label: "3", value: 3 },
                ],
                placeholder: t("configurations.selectAmountFormat"),
                value: configData.amount_format || 2,
                defaultValue: configData.amount_format,
                onChange: (value) =>
                  setConfigData({ ...configData, amount_format: value }),
              },
              {
                label: t("configurations.tableEntriesPerPage"),
                name: "table_entries_per_page",
                type: "select",
                options: [
                  { label: "5", value: 5 },
                  { label: "10", value: 10 },
                  { label: "25", value: 25 },
                  { label: "50", value: 50 },
                ],
                placeholder: t("configurations.selectTableEntriesPerPage"),
                value: configData.table_entries_per_page ?? 10,
                defaultValue: configData.table_entries_per_page,
                onChange: (value) =>
                  setConfigData({
                    ...configData,
                    table_entries_per_page: value,
                  }),
              },
              {
                label: t(
                  "configurations.marketingWhatsappRecipientDelaySeconds",
                ),
                name: "marketing_whatsapp_recipient_delay_seconds",
                type: "select",
                options: [
                  { label: t("configurations.nSeconds", { n: 5 }), value: 5 },
                  { label: t("configurations.nSeconds", { n: 10 }), value: 10 },
                  { label: t("configurations.nSeconds", { n: 15 }), value: 15 },
                  { label: t("configurations.nSeconds", { n: 30 }), value: 30 },
                  { label: t("configurations.nSeconds", { n: 45 }), value: 45 },
                  { label: t("configurations.nSeconds", { n: 60 }), value: 60 },
                ],
                placeholder: t(
                  "configurations.selectMarketingWhatsappRecipientDelay",
                ),
                description: t(
                  "configurations.marketingWhatsappRecipientDelayHint",
                ),
                value:
                  configData.marketing_whatsapp_recipient_delay_seconds ?? 10,
                defaultValue:
                  configData.marketing_whatsapp_recipient_delay_seconds,
                onChange: (value) =>
                  setConfigData({
                    ...configData,
                    marketing_whatsapp_recipient_delay_seconds: value,
                  }),
              },
              {
                label: t("configurations.marketingAnnouncementCron"),
                name: "marketing_announcement_cron",
                type: "select",
                options: [
                  {
                    label: t("configurations.marketingCronEveryMinute"),
                    value: "every_minute",
                  },
                  {
                    label: t("configurations.marketingCronEvery10Minutes"),
                    value: "every_10_minutes",
                  },
                  {
                    label: t("configurations.marketingCronEvery15Minutes"),
                    value: "every_15_minutes",
                  },
                  {
                    label: t("configurations.marketingCronEvery30Minutes"),
                    value: "every_30_minutes",
                  },
                  {
                    label: t("configurations.marketingCronEvery50Minutes"),
                    value: "every_50_minutes",
                  },
                  {
                    label: t("configurations.marketingCronEveryHour"),
                    value: "every_hour",
                  },
                  {
                    label: t("configurations.marketingCronEvery2Hours"),
                    value: "every_2_hours",
                  },
                  {
                    label: t("configurations.marketingCronEvery6Hours"),
                    value: "every_6_hours",
                  },
                  {
                    label: t("configurations.marketingCronDailyMidnight"),
                    value: "daily_midnight",
                  },
                ],
                placeholder: t("configurations.selectMarketingAnnouncementCron"),
                description: t("configurations.marketingAnnouncementCronHint"),
                value:
                  configData.marketing_announcement_cron ?? "every_10_minutes",
                defaultValue: configData.marketing_announcement_cron,
                onChange: (value) =>
                  setConfigData({
                    ...configData,
                    marketing_announcement_cron: value,
                  }),
              },
              {
                label: t("configurations.reorderAlertCron"),
                name: "reorder_alert_cron",
                type: "select",
                options: [
                  {
                    label: t("configurations.reorderCronDaily0600"),
                    value: "daily_0600",
                  },
                  {
                    label: t("configurations.reorderCronDaily0700"),
                    value: "daily_0700",
                  },
                  {
                    label: t("configurations.reorderCronDaily0800"),
                    value: "daily_0800",
                  },
                  {
                    label: t("configurations.reorderCronDaily0900"),
                    value: "daily_0900",
                  },
                  {
                    label: t("configurations.reorderCronDaily1000"),
                    value: "daily_1000",
                  },
                  {
                    label: t("configurations.reorderCronDaily1200"),
                    value: "daily_1200",
                  },
                  {
                    label: t("configurations.reorderCronDaily1800"),
                    value: "daily_1800",
                  },
                  {
                    label: t("configurations.marketingCronEveryHour"),
                    value: "every_hour",
                  },
                  {
                    label: t("configurations.marketingCronEvery6Hours"),
                    value: "every_6_hours",
                  },
                ],
                placeholder: t("configurations.selectReorderAlertCron"),
                description: t("configurations.reorderAlertCronHint"),
                value: configData.reorder_alert_cron ?? "daily_0800",
                defaultValue: configData.reorder_alert_cron,
                onChange: (value) =>
                  setConfigData({
                    ...configData,
                    reorder_alert_cron: value,
                  }),
              },
              {
                label: t("configurations.themeColors"),
                type: "multi-field",
                direction: "column",
                fields: [
                  {
                    label: t("configurations.buttons"),
                    name: "buttons_color",
                    type: "color",
                    color: selectedColors[0],
                    onChange: (value) => {
                      setSelectedColors([value, ...selectedColors.slice(1)]);
                      applyThemeColorVars({ buttons_color: value });
                    },
                  },
                  {
                    label: t("configurations.topbar"),
                    name: "topbar_color",
                    type: "color",
                    color: selectedColors[1],
                    onChange: (value) => {
                      setSelectedColors([
                        ...selectedColors.slice(0, 1),
                        value,
                        ...selectedColors.slice(2),
                      ]);
                      applyThemeColorVars({ topbar_color: value });
                    },
                  },
                  {
                    label: t("configurations.leftbar"),
                    name: "leftbar_color",
                    type: "color",
                    color: selectedColors[2],
                    onChange: (value) => {
                      setSelectedColors([
                        ...selectedColors.slice(0, 2),
                        value,
                        ...selectedColors.slice(3),
                      ]);
                      applyThemeColorVars({ leftbar_color: value });
                      notifyConfigurationUpdated({ leftbar_color: value });
                    },
                  },
                  {
                    label: t("configurations.buttonsText"),
                    name: "buttons_text_color",
                    type: "color",
                    color: selectedColors[3],
                    onChange: (value) => {
                      setSelectedColors([...selectedColors.slice(0, 3), value]);
                      applyThemeColorVars({ buttons_text_color: value });
                    },
                  },
                ],
              },
              {
                label: t("configurations.uploadLogo"),
                name: "system_logo",
                type: "file",
                onFileSelect: handleLogoChange,
                onChange: handleLogoChange,
                currentFile: logoPreview || (configData.system_logo && typeof configData.system_logo === 'string' 
                  ? (configData.system_logo.startsWith('http') ? configData.system_logo : `${Base_URL}${configData.system_logo}`)
                  : null),
                value: logoPreview || (configData.system_logo && typeof configData.system_logo === 'string' 
                  ? (configData.system_logo.startsWith('http') ? configData.system_logo : `${Base_URL}${configData.system_logo}`)
                  : null),
                onClear: () => {
                  setLogoPreview(null);
                  setConfigData({ ...configData, system_logo: null });
                },
              },
            ]}
          />
        </div>
      </AnimatedContent>
    </>
  );
};
export default Configuration;
