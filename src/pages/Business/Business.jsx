import React, { useState, useEffect, useContext } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Pagination,
  Select,
  Table,
  TableCell,
  TableContainer,
  TableFooter,
  TableHeader,
  TableBody,
  TableRow,
  Avatar,
} from "@windmill/react-ui";

import { Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import { useTranslation } from "react-i18next";
import {
  FiUploadCloud,
  FiXCircle,
  FiTrash2,
} from "react-icons/fi";
import { Plus } from "lucide-react";
import { Scrollbars } from "react-custom-scrollbars-2";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useDropzone } from "react-dropzone";
import Cookies from "js-cookie";
import axios from "axios";
import Title from "@/components/form/others/Title";
import useAsync from "@/hooks/useAsync";
import useUtilsFunction from "@/hooks/useUtilsFunction";
import useToggleDrawer from "@/hooks/useToggleDrawer";
import AnimatedContent from "@/components/common/AnimatedContent";
import PageTitle from "@/components/Typography/PageTitle";
import TableLoading from "@/components/preloader/TableLoading";
import NotFound from "@/components/table/NotFound";
import Status from "@/components/table/Status";
import Tooltip from "@/components/tooltip/Tooltip";
import DeleteModal from "@/components/modal/DeleteModal";
import MainDrawer from "@/components/drawer/MainDrawer";
import LabelArea from "@/components/form/selectOption/LabelArea";
import InputArea from "@/components/form/input/InputArea";
import Error from "@/components/form/others/Error";
import Container from "@/components/image-uploader/Container";
import SettingServices from "@/services/SettingServices";
import { AdminContext } from "@/context/AdminContext";
import { SidebarContext } from "@/context/SidebarContext";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useHistory } from "react-router-dom";
import useButtonColor from "@/hooks/useButtonColor";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  DropdownBasic,
  InputField,
  PageHeader,
  Button as LayoutButton,
  DataTable,
  ToggleSwitch,
  ActionButtons,
} from "@/page-layouts/index";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import RouteActionGate from "@/components/RouteActionGate";
import { PERMISSION_ACTION } from "@/utils/permissionUtils";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Business = () => {
  const history = useHistory();
  const checkTokenExpired = useCheckTokenExpired(); // ✅ hook used properly
  const { state, dispatch } = useContext(AdminContext);
  const { adminInfo } = state;
  const { toggleDrawer, lang } = useContext(SidebarContext);
  const [data, setData] = useState([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [businessGroup, setBusinessGroup] = useState("");
  const [businessGroups, setBusinessGroups] = useState([]);
  const [address, setAddress] = useState("");
  const [tel, setTel] = useState("");
  const [fax, setFax] = useState("");
  const [FilterStatus, setFilterStatus] = useState("");
  const [FilterName, setFilterText] = useState("");
  const [ToBeDeleted, setToBeDeleted] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    businessGroup: "",
    imageUrl: "",
    address: "",
    tel: "",
    fax: "",
  });
  const { t } = useTranslation();
  const { showDateFormat, showingTranslateValue } = useUtilsFunction();
  // Local pagination (like Bank Management) so we can reset page when filters change
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;
  const totalResults = data?.length || 0;
  const totalPages = Math.ceil(totalResults / resultsPerPage) || 1;
  const dataTable = data?.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  ) || [];
  const handleChangePage = (p) => setCurrentPage(p);
  const handleView = (_id) => {
    history.push(`/View Business/${_id}`);
  };

  const [pagePermissions, setPagePermissions] = useState([]);
  const buttonColor = useButtonColor();

  // 🔍 Function to check permissions in both modules and submodules
  const checkPagePermissions = () => {
    if (adminInfo && adminInfo.role.modules) {
      const currentPath = location.pathname;
      console.log("currentPath", currentPath);

      // 🔎 Search in modules and submodules
      adminInfo.role.modules.forEach((module) => {
        // Check in the main module
        if (currentPath === module.path) {
          console.log("currentPath module", module.path);
          setPagePermissions(module.permissions);
        }
        // Check in submodules (if any)
        if (module.subModules && module.subModules.length > 0) {
          module.subModules.forEach((subModule) => {
            if (currentPath === subModule.path) {
              console.log("subModule module", subModule.path);
              setPagePermissions(subModule.permissions);
            }
          });
        }
      });
    }
  };
  useEffect(() => {
    checkPagePermissions();
  }, [location]);

  // ✅ Check if the user has a specific permission
  const hasPermission = (permission) => {
    return pagePermissions.includes(permission);
  };

  const handleRemoveImage = async (img) => {
    try {
      // Show a loading state
      setLoading(true);

      // Extract the filename from the image URL
      const filename = (img && img?.split("/").pop()) || ""; // Get the filename from the URL
      console.log("filename", filename);
      // Call the backend API to delete the image
      const response = await axios.delete(`/api/upload/${filename}`);
      console.log("response", response);
      // Check if the response indicates success
      if (response.data.status) {
        notifySuccess(t("business.imageDeletedSuccessfully"));

        // // Update the frontend state
        // if (id) {
        //   const result = imageUrl?.filter((i) => i !== img); // Remove the specific image from the state
        //   setImageUrl(result);
        // } else {
        setImageUrl(""); // Clear the image URL if there are no products
        // }
      } else {
        notifyError(t("business.failedToDeleteImageFromServer"));
      }

      setLoading(false); // Hide the loading state
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err.response?.data?.message || t("business.failedToDeleteImage"));
      setLoading(false); // Hide the loading state
    }
  };
  const closeModal = async () => {
    setIsModalOpen(false);
  };

  const handleDelete = async (_id) => {
    setToBeDeleted(_id);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async () => {
    try {
      // Show a loading state
      setLoading(true);
      const headers = adminInfo
        ? {
            "Content-Type": "application/json",
            authorization: `Bearer ${adminInfo.token}`,
          }
        : {};
      // Call the backend API to delete the business
      const response = await axios.delete(
        `${Base_URL}/Business/delete/${ToBeDeleted}`,
        { headers }
      );
      if (checkTokenExpired(response)) return;
      // Check if the response indicates success
      if (response.data?.status) {
        notifySuccess(t("business.businessDeletedSuccessfully"));

        let businesses = JSON.parse(localStorage.getItem("businesses")) || [];
        businesses = businesses.filter((b) => b._id !== ToBeDeleted);
        localStorage.setItem("businesses", JSON.stringify(businesses));

        setIsModalOpen(false);
        fetchData(FilterStatus, FilterName);
      } else {
        notifyError(response.data?.message || t("business.failedToDeleteBusiness"));
      }

      setLoading(false);
    } catch (err) {
      console.error("Error deleting business:", err);
      notifyError(err.response?.data?.message || t("business.failedToDeleteBusiness"));
      setLoading(false);
    }
  };

  const handleStatusToggle = async (
    businessId,
    currentStatus,
    businessName
  ) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo.token}`,
    };

    try {
      setLoading(true);
      const response = await axios.put(
        `${Base_URL}/Business/status/${businessId}`,
        { status: newStatus },
        { headers }
      );
      if (checkTokenExpired(response)) return;

      if (response.status === 200) {
        if (newStatus === "Inactive") {
          localStorage.getItem("businesses");
          let businesses = JSON.parse(localStorage.getItem("businesses")) || [];
          businesses = businesses.filter((b) => b._id !== businessId);
          localStorage.setItem("businesses", JSON.stringify(businesses));
        } else {
          localStorage.getItem("businesses");
          let businesses = JSON.parse(localStorage.getItem("businesses")) || [];
          businesses.push({ _id: businessId, name: businessName });
          localStorage.setItem("businesses", JSON.stringify(businesses));
        }
        notifySuccess(`${t("business.statusUpdatedTo")} ${newStatus}`);
        fetchData(FilterStatus, FilterName); // Refresh data after update
      } else {
        notifyError(t("business.failedToUpdateStatus"));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      notifyError(t("modules.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const HandleFilter = async () => {
    try {
      fetchData(FilterStatus, FilterName);
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err || "Failed to delete image.");
      setLoading(false); // Hide the loading state
    }
  };

  // Fetch business groups on load
  useEffect(() => {
    fetchBusinessGroups();
  }, []);

  // Fetch data when filters change (same pattern as Bank Management)
  useEffect(() => {
    setCurrentPage(1);
    fetchData(FilterStatus, FilterName);
  }, [FilterStatus, FilterName]);

  // Fetch Business Groups for dropdown
  const fetchBusinessGroups = async () => {
    try {
      const response = await axios.get(`${Base_URL}/business-groups`, {
        params: { limit: 1000 }, // Get all business groups
      });
      if (checkTokenExpired(response)) return;
      
      const businessGroupsData = Array.isArray(response.data.businessGroups)
        ? response.data.businessGroups
        : Array.isArray(response.data)
        ? response.data
        : [];
      
      setBusinessGroups(businessGroupsData);
    } catch (err) {
      console.error("Error fetching business groups:", err);
      notifyError("Failed to load business groups");
    }
  };

  const fetchData = (FilterStatus, FilterName) => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    const filterNameTrimmed = (FilterName != null && String(FilterName).trim()) || "";
    const payload = {
      FilterStatus: FilterStatus || "",
      FilterName: filterNameTrimmed,
    };
    axios
      .post(`${Base_URL}/Business/getALL`, payload, { headers })
      .then((response) => setData(response.data.data || []))
      .catch(() => setData([]));
  };

  // Image Upload Handling with Dropzone
  const onDrop = (acceptedFiles) => {
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("image", file);
    });

    axios
      .post(`${Base_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => setImageUrl(res.data.url))
      .catch((err) => console.error("Error uploading image:", err));
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    onDrop,
  });

  const handleResetField = () => {
    setFilterStatus("");
    setFilterText("");
    fetchData("", "");
  };

  const handleAdd = () => {
    history.push("/Add New Business");
  };
  // Validate fields before submission
  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      name: "",
      email: "",
      imageUrl: "",
      address: "",
      tel: "",
      fax: "",
    };

    if (!name) {
      newErrors.name = t("business.validation.nameIsRequired");
      isValid = false;
    }

    if (!address) {
      newErrors.address = t("business.validation.addressIsRequired");
      isValid = false;
    }
    if (!tel) {
      newErrors.tel = t("business.validation.phoneIsRequired");
      isValid = false;
    }
    if (!fax) {
      newErrors.fax = t("business.validation.faxIsRequired");
      isValid = false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      newErrors.email = t("business.validation.pleaseEnterValidEmailAddress");
      isValid = false;
    }

    if (!imageUrl) {
      newErrors.imageUrl = t("business.validation.businessImageIsRequired");
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleUpdate = (businessId) => {
    history.push(`/Edit Business/${businessId}`);
  };
  const thumbs = files.map((file) => (
    <div key={file.name}>
      <div>
        <img
          className="inline-flex border-2 border-gray-100 w-24 max-h-24"
          src={file.preview}
          alt={file.name}
        />
      </div>
    </div>
  ));

  const handleLogout = () => {
    dispatch({ type: "USER_LOGOUT" });
    Cookies.remove("adminInfo");
    history.push("/login");
  };

  const BusinessSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return; // Don't submit if validation fails
    }
    setIsSubmitting(true);

    const BusinessData = {
      name,
      email,
      businessGroup,
      image: imageUrl,
      address,
      tel,
      fax,
    };
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    };

    try {
      const url = id
        ? `${Base_URL}/Business/update/${id}`
        : `${Base_URL}/Business/add`;
      const method = id ? "put" : "post";
      let res = await axios[method](url, BusinessData, { headers });
      console.log("res", res);
      if (checkTokenExpired(res)) return;
      if (res.data.status) {
        setIsSubmitting(false);
        fetchData(FilterStatus, FilterName);
        toggleDrawer();
        notifySuccess(res.data.message);
        console.log(
          "-----------------testing...........",
          !id && res.data?.data
        );
        if (!id && res.data?.data) {
          console.log("running...........");
          const newBusiness = res.data.data; // includes _id and name
          const businesses =
            JSON.parse(localStorage.getItem("businesses")) || [];
          businesses.push({ _id: newBusiness._id, name: newBusiness.name });
          localStorage.setItem("businesses", JSON.stringify(businesses));
        }
        console.log("res  --- 1");
      } else if (res?.data?.token === "expired") {
        handleLogout();
      } else {
        setIsSubmitting(false);
        const isDuplicate =
          (res.data?.message || "").toLowerCase().includes("already exists") ||
          (res.data?.message || "").toLowerCase().includes("same name or email");
        notifyError(
          isDuplicate
            ? "Business already exists with the same name or email."
            : res.data?.message || t("modules.somethingWentWrong")
        );
        // Do not toggleDrawer — keep user on Add/Edit form to correct the issue
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error("Error submitting business:", err);
    }
  };

  const clearAllFilters = () => {
    setFilterText("");
    setFilterStatus("");
    setCurrentPage(1);
    fetchData("", "");
  };

  const tableFilters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          clearAllFilters();
          setCurrentPage(1);
        },
      },
    },
    {
      value: FilterName,
      onChange: (value) => setFilterText(value),
      placeholder: t("business.searchPlaceholder"),
      name: "search",
      isTextInput: true,
    },
    {
      options: [
        { label: t("business.selectStatus"), value: "" },
        { label: t("business.active"), value: "Active" },
        { label: t("business.inactive"), value: "Inactive" },
      ],
      value: FilterStatus,
      onChange: (value) => {
        setFilterStatus(value);
        setCurrentPage(1);
      },
      placeholder: t("business.selectStatus"),
    },
  ];

  return (
    <RouteActionGate title="Business" requiredPermission={PERMISSION_ACTION.VIEW}>
      <div className="w-full container py-8 px-8">
      {/* Header - same style as Banking Management */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("business.title")}</h1>
            <p className="text-gray-600 mt-2">Manage businesses</p>
          </div>
          <div className="flex items-center gap-4">
            {hasPermission("Add") && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                style={buttonColor ? { backgroundColor: buttonColor } : {}}
              >
                <Plus size={20} />
                {t("business.addBusiness")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <DataTable
          title=""
          headers={[
            t("business.picture"),
            t("business.name"),
            t("business.email"),
            t("business.address"),
            t("business.phoneNo"),
            t("business.fax"),
            "Business Group",
            t("hrReports.common.status"),
            t("Actions"),
          ]}
          data={dataTable}
          loading={loading}
          totalRecords={totalResults}
          recordsPerPage={resultsPerPage}
          currentPage={currentPage}
          totalPages={totalPages}
          filters={tableFilters}
          onPageChange={handleChangePage}
          onSearch={(val) => {
            setFilterText(val);
            setCurrentPage(1);
          }}
          searchValue={FilterName}
          searchPlaceholder={t("business.searchPlaceholder")}
          colWidths={{
            Actions: "200px",
          }}
          renderRow={(business) => (
            <tr key={business._id} className="border-t border-gray-100">
              <td className="py-3 px-4">
                {business.image ? (
                  <img
                    src={business.image}
                    alt="img"
                    className="max-h-24 rounded-full"
                  />
                ) : (
                  business.name?.[0] || "-"
                )}
              </td>
              <td className="py-3 px-4">{business.name}</td>
              <td className="py-3 px-4">{business.email}</td>
              <td className="py-3 px-4">{business.address}</td>
              <td className="py-3 px-4">{business.tel}</td>
              <td className="py-3 px-4">{business.fax}</td>
              <td className="py-3 px-4">
                {business.businessGroup?.companyName || "N/A"}
              </td>
              <td className="py-3 px-4">
                <ToggleSwitch
                  isOn={business.status === "Active"}
                  handleToggle={() =>
                    hasPermission("Update") &&
                    handleStatusToggle(
                      business._id,
                      business.status,
                      business.name
                    )
                  }
                />
              </td>
              <td className="py-3 px-4" style={{ width: "fit-content" }}>
                <ActionButtons
                  items={[
                    ...(hasPermission("ViewDetails")
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.VIEW,
                            title: "View",
                            onClick: () => handleView(business._id),
                          },
                        ]
                      : []),
                    ...(hasPermission("Update")
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.EDIT,
                            title: "Edit",
                            onClick: () => handleUpdate(business._id),
                          },
                        ]
                      : []),
                    ...(hasPermission("Delete")
                      ? [
                          {
                            action: ACTION_BUTTON_TYPES.DELETE,
                            title: "Delete",
                            onClick: () => handleDelete(business._id),
                          },
                        ]
                      : []),
                  ]}
                />
              </td>
            </tr>
          )}
        />
      </div>

      <MainDrawer>
        <>
          <div className="w-full relative p-6 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {id ? (
              <Title
                // register={register}
                // handleSelectLanguage={handleSelectLanguage}
                title={t("business.updateBusiness")}
                description={t("business.updatingBusinessDetails")}
              />
            ) : (
              <Title
                // register={register}
                // handleSelectLanguage={handleSelectLanguage}
                title={t("business.addBusiness")}
                description={t("business.addingNewBusiness")}
              />
            )}
          </div>
          <Scrollbars className="w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200">
            <Card className="overflow-y-scroll flex-grow scrollbar-hide w-full max-h-full">
              <CardBody>
                <form onSubmit={BusinessSubmit}>
                  <div className="px-6 pt-8 flex-grow scrollbar-hide w-full max-h-full pb-40">
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("Image")} />
                      <div className="col-span-8 sm:col-span-4">
                        <div className="w-full text-center">
                          <div
                            className="border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer px-6 pt-5 pb-6"
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span className="mx-auto flex justify-center">
                              <FiUploadCloud className="text-3xl text-emerald-500" />
                            </span>
                            <p className="text-sm mt-2">{t("DragYourImage")}</p>
                            <em className="text-xs text-gray-400">
                              {t("imageFormat")}
                            </em>
                          </div>

                          <div className="text-emerald-500">{loading}</div>
                          <aside className="flex flex-row flex-wrap mt-4">
                            {dataTable && imageUrl ? (
                              <DndProvider backend={HTML5Backend}>
                                <div>
                                  <div className="relative">
                                    <img
                                      className="inline-flex border rounded-md border-gray-100 dark:border-gray-600 w-24 max-h-24 p-2 m-2"
                                      src={imageUrl}
                                      alt=""
                                      //
                                    />
                                    {/* {index === 0 && (
                                      <p className="text-xs absolute py-1 w-full bottom-0 inset-x-0 bg-blue-500 rounded-full text-white text-center ">
                                        Default Image
                                      </p>
                                    )} */}

                                    <button
                                      type="button"
                                      className="absolute top-0 right-0 text-red-500 focus:outline-none"
                                      onClick={() =>
                                        handleRemoveImage(imageUrl)
                                      }
                                    >
                                      <FiXCircle />
                                    </button>
                                  </div>
                                </div>
                              </DndProvider>
                            ) : imageUrl ? (
                              <div className="relative">
                                {" "}
                                <img
                                  className="inline-flex border rounded-md border-gray-100 dark:border-gray-600 w-24 max-h-24 p-2"
                                  src={imageUrl}
                                  alt="product"
                                />
                                <button
                                  type="button"
                                  className="absolute top-0 right-0 text-red-500 focus:outline-none"
                                  onClick={() => handleRemoveImage(imageUrl)}
                                >
                                  <FiXCircle />
                                </button>
                              </div>
                            ) : (
                              thumbs
                            )}
                            {errors.imageUrl && (
                              <Error errorName={errors.imageUrl} />
                            )}
                          </aside>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("business.name")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t("business.enterName")}
                          className="mt-1 block w-full"
                        />
                        {errors.name && (
                          <span className="text-red-500 text-xs">
                            {errors.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("business.email")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("business.enterEmail")}
                          className="mt-1 block w-full"
                        />
                        {errors.email && (
                          <span className="text-red-500 text-xs">
                            {errors.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Business Group" />
                      <div className="col-span-8 sm:col-span-4">
                        <DropdownBasic
                          value={businessGroup}
                          onChange={(value) => setBusinessGroup(value)}
                          options={businessGroups.map((bg) => ({
                            value: bg._id,
                            label: bg.companyName,
                          }))}
                          placeholder="Select Business Group"
                        />
                        {errors.businessGroup && (
                          <span className="text-red-500 text-xs">
                            {errors.businessGroup}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("business.address")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={t("business.enterAddress")}
                          className="mt-1 block w-full"
                        />
                        {errors.address && (
                          <span className="text-red-500 text-xs">
                            {errors.address}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("business.phoneNo")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={tel}
                          onChange={(e) => setTel(e.target.value)}
                          placeholder={t("business.enterPhoneNo")}
                          className="mt-1 block w-full"
                        />
                        {errors.tel && (
                          <span className="text-red-500 text-xs">
                            {errors.tel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label={t("business.fax")} />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={fax}
                          onChange={(e) => setFax(e.target.value)}
                          placeholder={t("business.enterFax")}
                          className="mt-1 block w-full"
                        />
                        {errors.fax && (
                          <span className="text-red-500 text-xs">
                            {errors.fax}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSubmitting ? (
                    <Button
                      disabled={true}
                      type="button"
                      className="w-full h-12"
                    >
                      <img
                        src={spinnerLoadingImage}
                        alt="Loading"
                        width={20}
                        height={10}
                      />{" "}
                      <span className="font-serif ml-2 font-light">
                        {t("processing")}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={BusinessSubmit}
                      type="submit"
                      className="w-full h-12"
                      style={{ backgroundColor: buttonColor }}
                    >
                      {id ? (
                        <span>{t("business.updateBusiness")}</span>
                      ) : (
                        <span>{t("business.addBusiness")}</span>
                      )}
                    </Button>
                  )}
                  {/* <DrawerButton id={id} title="Business" isSubmitting={BusinessSubmit} /> */}
                </form>
              </CardBody>
            </Card>
          </Scrollbars>
        </>
      </MainDrawer>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalBody className="text-center custom-modal px-8 pt-6 pb-4">
          <span className="flex justify-center text-3xl mb-6 text-red-500">
            <FiTrash2 />
          </span>
          {/* <h2 className="text-xl font-medium mb-1">{t('DeleteModalH2')}</h2> */}
          <h2 className="text-xl font-medium mb-2">
            {t("DeleteModalH2")}{" "}
            <span className="text-red-500">{t("business.title")}</span>?
          </h2>
          <p>{t("DeleteModalPtag")}</p>
        </ModalBody>

        <ModalFooter className="justify-center">
          <Button
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50 "
            layout="outline"
            onClick={closeModal}
          >
            {t("modalKeepBtn")}
          </Button>
          <div className="flex justify-end">
            {isSubmitting ? (
              <Button
                disabled={true}
                type="button"
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                <img
                  src={spinnerLoadingImage}
                  alt="Loading"
                  width={20}
                  height={10}
                />{" "}
                <span className="font-serif ml-2 font-light">
                  {t("processing")}
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleDeleteItem}
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                {t("modalDeletBtn")}
              </Button>
              // <button
              //   type="submit"
              //   className="text-sm mt-6 leading-4 inline-flex items-center cursor-pointer transition ease-in-out duration-300 font-semibold font-serif text-center justify-center border-0 border-transparent rounded-md focus-visible:outline-none focus:outline-none text-white px-4 md:px-6 lg:px-8 py-4 md:py-3.5 lg:py-4 hover:text-white bg-emerald-400 hover:bg-emerald-500 h-10"
              // >
              //   Park Order
              // </button>
            )}
          </div>
        </ModalFooter>
      </Modal>
      </div>
    </RouteActionGate>
  );
};

export default Business;
