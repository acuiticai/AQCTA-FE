import React, { Fragment, useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { FiShield } from "react-icons/fi";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TabPrivacyPolicy = () => {
  const { t } = useTranslation();
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const checkTokenExpired = useCheckTokenExpired();

  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(null);

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const fetchPrivacyPolicy = async () => {
    try {
      setLoading(true);
      if (!adminInfo?.token) {
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

      if (response.data && response.data.length > 0) {
        const config = response.data[0];
        setConfigId(config._id);
        setPrivacyPolicy(config.privacy_policy || "");
      }
    } catch (error) {
      console.error("Error fetching privacy policy:", error);
      notifyError(
        error.response?.data?.message ||
          t("privacyPolicy.failedToLoadPrivacyPolicy")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!adminInfo?.token) {
      notifyError(t("privacyPolicy.authenticationRequired"));
      return;
    }

    if (!configId) {
      notifyError(t("privacyPolicy.configurationNotFound"));
      return;
    }

    setSaving(true);

    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      };

      // Update only the privacy_policy field using PUT
      const response = await axios.put(
        `${Base_URL}/configuration/${configId}`,
        {
          privacy_policy: privacyPolicy,
        },
        { headers }
      );

      if (checkTokenExpired(response)) return;

      if (response.data) {
        notifySuccess(t("privacyPolicy.privacyPolicySavedSuccessfully"));
      }
    } catch (error) {
      console.error("Error saving privacy policy:", error);
      notifyError(
        error.response?.data?.message ||
          t("privacyPolicy.failedToSavePrivacyPolicy")
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">{t("privacyPolicy.loading")}</div>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="container mx-auto mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FiShield className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  {t("privacyPolicy.privacyPolicy")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("privacyPolicy.managePrivacyPolicyContent")}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="privacy_policy"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t("privacyPolicy.privacyPolicyContent")}
                </label>
                <div className="rich-text-editor-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={privacyPolicy}
                    onChange={setPrivacyPolicy}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, 4, 5, 6, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        [{ color: [] }, { background: [] }],
                        [{ font: [] }],
                        [{ align: [] }],
                        ["link", "image"],
                        ["blockquote", "code-block"],
                        ["clean"],
                      ],
                    }}
                    formats={[
                      "header",
                      "bold",
                      "italic",
                      "underline",
                      "strike",
                      "list",
                      "bullet",
                      "color",
                      "background",
                      "font",
                      "align",
                      "link",
                      "image",
                      "blockquote",
                      "code-block",
                    ]}
                    placeholder={t("privacyPolicy.enterPrivacyPolicyContent")}
                    style={{
                      minHeight: "400px",
                      backgroundColor: "white",
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("privacyPolicy.youCanUseHTML")}
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => fetchPrivacyPolicy()}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                  disabled={saving}
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-p-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? t("privacyPolicy.saving") : t("Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .rich-text-editor-wrapper .ql-container {
          min-height: 400px;
          font-size: 16px;
          font-family: inherit;
        }

        .rich-text-editor-wrapper .ql-editor {
          min-height: 400px;
          line-height: 1.8;
        }

        .rich-text-editor-wrapper .ql-toolbar {
          border-top: 1px solid #e5e7eb;
          border-left: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          border-bottom: none;
          border-radius: 8px 8px 0 0;
          background-color: #f9fafb;
        }

        .rich-text-editor-wrapper .ql-container {
          border-bottom: 1px solid #e5e7eb;
          border-left: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 8px 8px;
        }

        .rich-text-editor-wrapper .ql-editor.ql-blank::before {
          font-style: normal;
          color: #9ca3af;
        }

        .dark .rich-text-editor-wrapper .ql-toolbar {
          background-color: #374151;
          border-color: #4b5563;
        }

        .dark .rich-text-editor-wrapper .ql-container {
          background-color: #1f2937;
          border-color: #4b5563;
          color: #f3f4f6;
        }

        .dark .rich-text-editor-wrapper .ql-editor {
          color: #f3f4f6;
        }

        .dark .rich-text-editor-wrapper .ql-stroke {
          stroke: #9ca3af;
        }

        .dark .rich-text-editor-wrapper .ql-fill {
          fill: #9ca3af;
        }

        .dark .rich-text-editor-wrapper .ql-picker-label {
          color: #9ca3af;
        }
      `}</style>
    </Fragment>
  );
};

export default TabPrivacyPolicy;
