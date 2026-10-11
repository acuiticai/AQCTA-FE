import React, { Fragment, useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import { FiHelpCircle } from "react-icons/fi";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TabSupportInfo = () => {
    const { t } = useTranslation();
    const { state } = useContext(AdminContext);
    const { adminInfo } = state;
    const checkTokenExpired = useCheckTokenExpired();

    const [supportInfo, setSupportInfo] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [configId, setConfigId] = useState(null);

    useEffect(() => {
        fetchSupportInfo();
    }, []);

    const fetchSupportInfo = async () => {
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
                setSupportInfo(config.support_info || "");
            }
        } catch (error) {
            console.error("Error fetching support info:", error);
            notifyError(
                error.response?.data?.message ||
                t("configTab.failedToLoadSupportInfo")
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!adminInfo?.token) {
            notifyError(t("configTab.authenticationRequired"));
            return;
        }

        if (!configId) {
            notifyError(t("configTab.configurationNotFound"));
            return;
        }

        setSaving(true);

        try {
            const headers = {
                "Content-Type": "application/json",
                authorization: `Bearer ${adminInfo.token}`,
            };

            const response = await axios.put(
                `${Base_URL}/configuration/${configId}`,
                {
                    support_info: supportInfo,
                },
                { headers }
            );

            if (checkTokenExpired(response)) return;

            if (response.data) {
                notifySuccess(t("configTab.supportInfoSavedSuccessfully"));
            }
        } catch (error) {
            console.error("Error saving support info:", error);
            notifyError(
                error.response?.data?.message ||
                t("configTab.failedToSaveSupportInfo")
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-gray-500">{t("Loading")}</div>
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
                                <FiHelpCircle className="text-blue-600 dark:text-blue-400 text-xl" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                    {t("configTab.supportInfo")}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t("configTab.manageSupportInfoContent")}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="support_info"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    {t("configTab.supportInfoContent")}
                                </label>
                                <div className="rich-text-editor-wrapper">
                                    <ReactQuill
                                        theme="snow"
                                        value={supportInfo}
                                        onChange={setSupportInfo}
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
                                        placeholder={t("configTab.enterSupportInfoContent")}
                                        style={{
                                            minHeight: "400px",
                                            backgroundColor: "white",
                                        }}
                                    />
                                </div>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    {t("configTab.youCanUseHTML")}
                                </p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => fetchSupportInfo()}
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
                                    {saving ? t("Loading") : t("Save")}
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

export default TabSupportInfo;
