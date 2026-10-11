import PageTitle from "@/components/common/PageTitle";
import { PageHeader } from "@/page-layouts/index";
import React, { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";

const TabEmailConfig = () => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(null);
  const emailConfigs = [
    {
      id: 1,
      service_type: "AWS",
      project_id: "12345",
      auth_provider_x509_cert_url: "https://example.com/cert",
      auth_uri: "https://example.com/auth",
      token_uri: "https://example.com/token",
      client_id: "client123",
      client_secret: "secret123",
    },
    {
      id: 2,
      service_type: "SMTP",
      API_KEY: "apikey123",
      email_logs: "1",
    },
  ];

  const toggleAccordion = (id) => {
    setActiveId(activeId === id ? null : id);
  };

  return (
    <Fragment>
      <div className="container mx-auto mt-4">
        <div className="space-y-4">
          {emailConfigs.map((config) => (
            <div
              key={config.id}
              className="border border-gray-200 dark:border-gray-700 rounded-[12px] overflow-hidden"
            >
              <div
                className="bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
                onClick={() => toggleAccordion(config.id)}
              >
                <h5 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {config.service_type}
                </h5>
                <button className="text-gray-500 dark:text-gray-400 mr-2">
                  {activeId === config.id ? "-" : "+"}
                </button>
              </div>
              {activeId === config.id && (
                <div className="bg-white dark:bg-gray-900 p-6">
                  <form className="space-y-4">
                    {config.project_id && (
                      <div>
                        <label
                          htmlFor="project_id"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Project ID
                        </label>
                        <input
                          type="text"
                          id="project_id"
                          defaultValue={config.project_id}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                    )}
                    {config.auth_provider_x509_cert_url && (
                      <div>
                        <label
                          htmlFor="auth_cert"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Auth Provider x509 Certificate URL
                        </label>
                        <input
                          type="text"
                          id="auth_cert"
                          defaultValue={config.auth_provider_x509_cert_url}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                    )}
                    {config.auth_uri && (
                      <div>
                        <label
                          htmlFor="auth_uri"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Authentication URI
                        </label>
                        <input
                          type="text"
                          id="auth_uri"
                          defaultValue={config.auth_uri}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                    )}
                    {config.client_id && (
                      <div>
                        <label
                          htmlFor="client_id"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Client ID
                        </label>
                        <input
                          type="text"
                          id="client_id"
                          defaultValue={config.client_id}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                    )}
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        {t("Cancel")}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-p-blue text-white rounded-md hover:bg-blue-700"
                      >
                        {t("Save")}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Fragment>
  );
};

export default TabEmailConfig;
