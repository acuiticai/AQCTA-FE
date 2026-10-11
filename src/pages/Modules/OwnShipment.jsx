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
  FiPlus,
  FiEdit,
  FiTrash2,
  FiUploadCloud,
  FiXCircle,
  FiEye,
} from "react-icons/fi";
import { Scrollbars } from "react-custom-scrollbars-2";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useDropzone } from "react-dropzone";
import Cookies from "js-cookie";
import axios from "axios";
import Title from "@/components/form/others/Title";
import useAsync from "@/hooks/useAsync";
import useFilter from "@/hooks/useFilter";
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

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const Business = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { toggleDrawer, lang } = useContext(SidebarContext);
  const [data, setData] = useState([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [FilterStatus, setFilterStatus] = useState("");
  const [FilterName, setFilterText] = useState("");
  const [ToBeDeleted, setToBeDeleted] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: "", email: "", imageUrl: "" });
  const { data: globalSetting } = useAsync(SettingServices.getGlobalSetting);
  const { t } = useTranslation();
  const { showDateFormat, showingTranslateValue } = useUtilsFunction();
  const {
    totalResults,
    resultsPerPage,
    serviceData,
    dataTable,
    handleChangePage,
  } = useFilter(data);

  const handleView = (_id) => {
    history.push("/viewBusinessDetails", { business_id: _id });
  };

  const handleRemoveImage = async (img) => {
    try {
      // Show a loading state
      setLoading(true);

      // Extract the filename from the image URL
      const filename = img?.split("/").pop(); // Get the filename from the URL

      // Call the backend API to delete the image
      const response = await axios.delete(`/api/upload/${filename}`);
      console.log("response", response);
      // Check if the response indicates success
      if (response.data.status) {
        notifySuccess("Image deleted successfully!");

        // // Update the frontend state
        // if (id) {
        //   const result = imageUrl?.filter((i) => i !== img); // Remove the specific image from the state
        //   setImageUrl(result);
        // } else {
        setImageUrl(""); // Clear the image URL if there are no products
        // }
      } else {
        notifyError("Failed to delete the image from the server.");
      }

      setLoading(false); // Hide the loading state
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err.response?.data?.message || "Failed to delete image.");
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

      // Call the backend API to delete the image
      const response = await axios.delete(
        `/api/Business/delete/${ToBeDeleted}`
      );
      console.log("delete response", response);
      // Check if the response indicates success
      if (response.data.status) {
        notifySuccess("Business deleted successfully!");
        setIsModalOpen(false);
        fetchData(FilterStatus, FilterName);
      } else {
        notifyError("Failed to delete the image from the server.");
      }

      setLoading(false); // Hide the loading state
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err.response?.data?.message || "Failed to delete image.");
      setLoading(false); // Hide the loading state
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

  // Fetch Data on Load
  useEffect(() => {
    fetchData(FilterStatus, FilterName);
  }, []);

  const fetchData = (FilterStatus, FilterName) => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    let payload = {
      FilterStatus: FilterStatus,
      FilterName: FilterName,
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
    setId("");
    setName("");
    setEmail("");
    setImageUrl("");
    toggleDrawer();
  };

  const handleUpdate = (businessId) => {
    const selectedBusiness = data.find((item) => item._id === businessId);
    setId(businessId);
    setName(selectedBusiness.name);
    setEmail(selectedBusiness.email);
    setImageUrl(selectedBusiness.image);
    toggleDrawer();
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
  const BusinessSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const BusinessData = { name, email, image: imageUrl };
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    try {
      const url = id
        ? `${Base_URL}/Business/update/${id}`
        : `${Base_URL}/Business/add`;
      const method = id ? "put" : "post";
      await axios[method](url, BusinessData, { headers });
      setIsSubmitting(false);
      fetchData(FilterStatus, FilterName);
      toggleDrawer();
    } catch (err) {
      setIsSubmitting(false);
      console.error("Error submitting business:", err);
    }
  };
  console.log("Image src:", `${data?.[0]?.image}`);

  return (
    <>
      <PageTitle>{t("Flat Shipment Zones")}</PageTitle>
      <div
        style={{ marginBottom: "10px" }}
        className="w-full flex justify-end items-center space-x-2"
      >
        <Button
          // layout="outline"
          onClick={handleResetField}
          type="reset"
          className="px-3 py-2 text-xs border-red-500 bg-red-500 dark:bg-red-700 dark:text-white"
          style={{ maxWidth: "100px" }}
        >
          {t("Enabled")}
        </Button>
        <Button
          onClick={handleAdd}
          className="px-3 py-2 text-xs border-gray-500 dark:bg-gray-700 dark:text-gray-200"
          style={{ minWidth: "120px" }}
        >
          <FiPlus />
          <span>{t("Add New")}</span>
        </Button>
      </div>

      {loading ? (
        <TableLoading row={12} col={5} />
      ) : serviceData?.length !== 0 ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableCell>{t("Name")}</TableCell>
                <TableCell>{t("Regions")}</TableCell>
                <TableCell>{t("Shipment Method")}</TableCell>
                <TableCell>{t("Normal Rate")}</TableCell>
                <TableCell>{t("Express Rate")}</TableCell>
                <TableCell>{t("Status")}</TableCell>
                <TableCell>{t("Actions")}</TableCell>
              </tr>
            </TableHeader>
            <TableBody>
              {dataTable.map((business) => (
                <TableRow key={business._id}>
                  <TableCell>{business.name}</TableCell>
                  <TableCell>{business.name}</TableCell>
                  <TableCell>{business.email}</TableCell>
                  <TableCell>{"12"}</TableCell>
                  <TableCell>{"29"}</TableCell>
                  <TableCell>
                    <Status status={business.status} />
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => handleUpdate(business._id)}>
                      <FiEdit />
                    </Button>
                    <Button
                      style={{ marginLeft: "10px", background: "red" }}
                      onClick={() => handleDelete(business._id)}
                    >
                      <FiTrash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TableFooter>
            <Pagination
              totalResults={totalResults}
              resultsPerPage={resultsPerPage}
              onChange={handleChangePage}
            />
          </TableFooter>
        </TableContainer>
      ) : (
        <NotFound title="Sorry, There are no Business right now." />
      )}

      <MainDrawer>
        <>
          <div className="w-full relative p-6 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {id ? (
              <Title
                // register={register}
                // handleSelectLanguage={handleSelectLanguage}
                title={t("Update Business")}
                description={t("Updating Business details")}
              />
            ) : (
              <Title
                // register={register}
                // handleSelectLanguage={handleSelectLanguage}
                title={t("Add Business")}
                description={t("Adding New Business")}
              />
            )}
          </div>
          <Scrollbars className="w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200">
            <Card className="overflow-y-scroll flex-grow scrollbar-hide w-full max-h-full">
              <CardBody>
                <form onSubmit={BusinessSubmit}>
                  <div className="px-6 pt-8 flex-grow scrollbar-hide w-full max-h-full pb-40">
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Image" />
                      <div className="col-span-8 sm:col-span-4">
                        {/* <Uploader
                                  imageUrl={imageUrl}
                                  setImageUrl={setImageUrl}
                                  folder="business"
                                /> */}
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
                                      alt="product"
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
                                {/* <img
                                  className="inline-flex border rounded-md border-gray-100 dark:border-gray-600 w-24 max-h-24 p-2 m-2"
                                  src={`${imageUrl}`}
                                  alt="N/A"
                                />
                                <button
                                  type="button"
                                  className="absolute top-0 right-0 text-red-500 focus:outline-none"
                                  onClick={() => handleRemoveImage(imageUrl)}
                                >
                                  <FiXCircle />
                                </button> */}
                                {/* <Container
                                  setImageUrl={setImageUrl}
                                  imageUrl={imageUrl}
                                  handleRemoveImage={handleRemoveImage}
                                /> */}
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
                          </aside>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Name" />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter name"
                          className="mt-1 block w-full"
                        />
                        {/* {errors.name && (
                                  <span className="text-red-500 text-xs">{errors.name}</span>
                                )} */}
                        <Error errorName={errors.name} />
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Email" />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter name"
                          className="mt-1 block w-full"
                        />
                        <Error errorName={errors.email} />
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
                        Processing
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={BusinessSubmit}
                      type="submit"
                      className="w-full h-12"
                    >
                      {id ? (
                        <span>Update Business</span>
                      ) : (
                        <span>Add Business</span>
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
            <span className="text-red-500">{t("Business")}</span>?
          </h2>
          <p>{t("DeleteModalPtag")}</p>
        </ModalBody>

        <ModalFooter className="justify-center">
          <Button
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50"
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
                className="w-full h-12 sm:w-auto  bg-p-blue hover:bg-p-blue-dark"
              >
                <img
                  src={spinnerLoadingImage}
                  alt="Loading"
                  width={20}
                  height={10}
                />{" "}
                <span className="font-serif ml-2 font-light">
                  {t("Processing")}
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleDeleteItem}
                className="w-full h-12 sm:w-auto  bg-p-blue hover:bg-p-blue-dark"
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
    </>
  );
};

export default Business;
