import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Button, Select } from "@windmill/react-ui";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
import { Input } from "@windmill/react-ui";
import Error from "@/components/form/others/Error";
import useSettingSubmit from "@/hooks/useSettingSubmit";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import InputAreaTwo from "@/components/form/input/InputAreaTwo";
import AnimatedContent from "@/components/common/AnimatedContent";
import { useHistory } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import { Button as LayoutButton } from "@/page-layouts";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;


const Configuration = ({ businessId }) => {
  const { errors, register, isSave, isSubmitting, onSubmit, handleSubmit } =
    useSettingSubmit();

  const { t } = useTranslation();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [businessImage, setBusinessImage] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true); // Loading state

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setBusinessImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    const headers = adminInfo
      ? {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      }
      : {};
    let payload = {
      _id: businessId,
    };
    axios
      .post(`${Base_URL}/Business/get_single`, payload, { headers })
      .then((response) => {
        setData(response.data.data);
        setBusinessImage(response.data.data.image || null); // Set image if exists
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setData({}); // Reset data on error
      });
  };
  const SignUpLink = () => {
    let link = `${getPublicAppUrl()}/signup/${"customer"}/${businessId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        notifySuccess(t("business.linkCopiedToClipboard"));
      })
      .catch((err) => {
        notifyError(err);
      });
  };

  return (
    <>
      <AnimatedContent>
        <div className="sm:container w-full bg-white dark:bg-gray-800 dark:text-gray-200 rounded-lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-12 font-sans">
              <div className="col-span-12 md:col-span-12 lg:col-span-12 mr-3">
                <div className="flex-grow scrollbar-hide w-[500px] m-auto ml-10 max-h-full pb-0">
                  <h2 className="text-xl font-semibold mb-6">
                    {t("business.basicInfo")}
                  </h2>

                  <div className="grid md:grid-cols-5 items-center sm:grid-cols-3 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 sm:col-span-2">
                      {t("business.name")}
                    </label>
                    <div className="sm:col-span-3">
                      <Input
                        type="text"
                        value={data?.name || ""}
                        // onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("business.enterName")}
                        className="mt-1 block w-full"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-5 items-center sm:grid-cols-12 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                    <label className="block text-sm text-gray-600 font-semibold dark:text-gray-400 mb-1 sm:col-span-2">
                      {t("business.email")}
                    </label>
                    <div className="sm:col-span-3">
                      <Input
                        type="text"
                        value={data?.email || ""}
                        // onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("business.enterEmail")}
                        className="mt-1 block w-full"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-5 items-center sm:grid-cols-12 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 sm:col-span-2">
                      {t("business.status")}
                    </label>

                    <div className="sm:col-span-3">
                      <Input
                        type="text"
                        value={data?.status === true || data?.status === "Active" ? t("business.active") : data?.status === false || data?.status === "Inactive" ? t("business.inactive") : data?.status || ""}
                        // onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("business.status")}
                        className="mt-1 block w-full"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-5 items-center sm:grid-cols-12 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 sm:col-span-2">
                      {t("business.businessImage")}
                    </label>
                    <div className="sm:col-span-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-gray-600 dark:text-gray-300 border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring focus:ring-blue-500"
                      />
                      {businessImage && (
                        <div className="mt-4">
                          <img
                            src={businessImage}
                            alt={t("business.businessPreview")}
                            className="w-full max-h-48 object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-8 grid md:grid-cols-5 items-center sm:grid-cols-12 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6 mt-6">
                    <LayoutButton
                      secondary
                      className="mt-6"
                      onClick={SignUpLink}
                    >
                      {t("business.signUpLink")}
                    </LayoutButton>
                  </div>
                  {/* <div className="flex flex-row-reverse pb-6">
                    {isSubmitting ? (
                      <Button disabled={true} type="button" className="h-12">
                        <img
                          src={spinnerLoadingImage}
                          alt="Loading"
                          width={20}
                          height={10}
                        />
                        <span className="font-serif ml-2 font-light">
                          Processing
                        </span>
                      </Button>
                    ) : (
                      <Button type="submit" className="h-12 px-8">
                        {isSave ? "Save" : "Update"}
                      </Button>
                    )}
                  </div> */}
                </div>
              </div>
            </div>
          </form>
        </div>
      </AnimatedContent>
    </>
  );
};

export default Configuration;
