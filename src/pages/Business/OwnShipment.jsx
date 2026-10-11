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
import { DataTable, PageHeader } from "@/page-layouts/index";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const Business = ({ businessId }) => {
  console.log("businessId");
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
  // const [region, setRegion] = useState('');
  const [shipmentMethod, setShipmentMethod] = useState("Flat Rate");
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
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState([]);

  // Function to add a region chip
  const addRegion = () => {
    if (region.trim() && !regions.includes(region)) {
      setRegions([...regions, region]);
      setRegion(""); // Clear input after adding
    }
  };

  // Function to remove a region chip
  const removeRegion = (index) => {
    setRegions(regions.filter((_, i) => i !== index));
  };

  // Handle Enter key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRegion();
    }
  };

  const [flatRateName, setFlatRateName] = useState(""); // For Flat Rate Name
  const [perKgName, setPerKgName] = useState("");
  const [expressFlat, setExpressFlat] = useState("");
  const [freeDelivery, setFreeDelivery] = useState("");
  const [PerKg, setPerKg] = useState("");

  const [expressPerKg, setExpressPerKg] = useState("");

  const handleView = (_id) => {
    history.push("/viewBusinessDetails", { business_id: _id });
  };

  const closeModal = async () => {
    setIsModalOpen(false);
  };

  const handleDelete = async (_id) => {
    setToBeDeleted(_id);
    setIsModalOpen(true);
  };
  const deleteShipment = async () => {
    setLoading(true); // Show loading state during the API request

    try {
      // Call the DELETE API with the selected shipment ID
      const url = `${Base_URL}/shipment/delete/${ToBeDeleted}`; // `ToBeDeleted` contains the ID of the shipment to delete
      const response = await axios.delete(url);
      console.log("response.data:", response);

      // Handle response
      if (response.data.status) {
        notifySuccess("Shipment deleted successfully!");
        fetchData(FilterStatus, FilterName); // Re-fetch the data after deletion to reflect the changes
        setIsModalOpen(false); // Close the confirmation modal
      } else {
        notifyError(response.data.message || "Failed to delete shipment.");
      }
    } catch (err) {
      console.error("Error deleting shipment:", err);
      notifyError(
        err.response?.data?.message ||
          "An error occurred while deleting the shipment."
      );
    } finally {
      setLoading(false); // Hide loading state after the API request finishes
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
  // const payload={
  //   name: "",
  //   regions: ["North", "South", "East", "West"], // Set predefined regions
  //   business_id: businessId, // Automatically bind business ID
  //   shipment_method: "Flat Rate", // Default method
  //   normal_per_kg: "",
  //   express_per_kg: "",
  //   normal_flat: "",
  //   express_flat: "",
  //   free_delivery: false,
  // }

  // Fetch Data on Load
  useEffect(() => {
    fetchData(FilterStatus, FilterName);
  }, []);

  const fetchData = async (FilterStatus, FilterName) => {
    try {
      const response = await axios.get(`${Base_URL}/shipment/get`);

      if (response.data.status) {
        setData(response.data.data || []);

        // Set regions state from first record if exists
        if (response.data.data.length > 0) {
          setRegions(response.data.data[0].regions || []);
        }
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setData([]);
    }
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
    // Reset all form fields for adding a new shipment
    setId(""); // Clear the ID to indicate a new record
    setName("");
    setRegion("");
    setShipmentMethod("Flat Rate");
    setFreeDelivery("");
    setFlatRateName("");
    setPerKgName("");
    setPerKg("");

    setExpressPerKg("");
    setExpressFlat("");

    toggleDrawer(); // Open the drawer/modal for adding a new shipment
  };

  const handleUpdate = (business) => {
    setId(business._id);
    setName(business.name);

    // Convert backend regions array to frontend array state
    setRegions(business.regions || []); // Ensures it's always an array

    setShipmentMethod(business.shipment_method);
    setFreeDelivery(business.free_delivery ? "yes" : "no");
    setFlatRateName(business.normal_flat || "");
    setPerKgName(business.normal_per_kg || "");
    setExpressFlat(business.express_flat || "");
    setExpressPerKg(business.express_per_kg || "");

    toggleDrawer();
  };

  const updateShipment = async () => {
    setIsSubmitting(true);

    // Construct the payload for the API
    const payload = {
      name,
      regions, // Already an array, so send directly
      business_id: businessId,
      shipment_method: shipmentMethod,
      normal_per_kg: shipmentMethod === "Per kg" ? perKgName : "",
      express_per_kg: shipmentMethod === "Per kg" ? expressFlat : "",
      normal_flat: shipmentMethod === "Flat Rate" ? flatRateName : "",
      express_flat: shipmentMethod === "Flat Rate" ? expressFlat : "",
      free_delivery: freeDelivery === "yes",
    };

    // Log the payload for debugging
    console.log("Payload being sent:", payload);

    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    try {
      // API Call to Update Shipment
      const url = `${Base_URL}/shipment/put/${id}`; // Use the selected business ID (e.g., `678644a903680a14f448ba81`)
      const response = await axios.put(url, payload, { headers });
      console.log("response.data:", response);

      // Handle the response
      if (response.data.status) {
        notifySuccess("Shipment updated successfully!");
        setIsSubmitting(false);
        fetchData(FilterStatus, FilterName); // Re-fetch data to reflect the update
        toggleDrawer(); // Close the drawer after the update
      } else {
        notifyError(response.data.message || "Failed to update shipment.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Error updating shipment:", err);
      notifyError(
        err.response?.data?.message ||
          "An error occurred while updating shipment."
      );
      setIsSubmitting(false);
    }
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

    // Construct the payload
    const payload = {
      name,
      regions, // Already an array, so send directly
      business_id: businessId,
      shipment_method: shipmentMethod,
      normal_per_kg: shipmentMethod === "Per kg" ? perKgName : "",
      express_per_kg: shipmentMethod === "Per kg" ? expressFlat : "",
      normal_flat: shipmentMethod === "Flat Rate" ? flatRateName : "",
      express_flat: shipmentMethod === "Flat Rate" ? expressFlat : "",
      free_delivery: freeDelivery === "yes",
    };

    // Log the payload for debugging
    console.log("Payload being sent:", payload);

    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};

    try {
      // API Call to Add Shipment
      const url = `${Base_URL}/shipment/add`;
      const response = await axios.post(url, payload, { headers });
      console.log("response.data:", response);

      // Handle the response
      if (response.data.status) {
        notifySuccess("Shipment added successfully!");
        setIsSubmitting(false);
        fetchData(FilterStatus, FilterName);
        toggleDrawer();
      } else {
        notifyError(response.data.message || "Failed to add shipment.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Error submitting business:", err);
      notifyError(
        err.response?.data?.message ||
          "An error occurred while adding shipment."
      );
      setIsSubmitting(false);
    }
  };

  console.log("Image src:", `${data?.[0]?.image}`);

  return (
    <>
      <PageHeader
        title={t("business.flatShipmentZones")}
        CustomFilterComponent={() => (
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
              {t("business.enabled")}
            </Button>
            <Button
              onClick={handleAdd}
              className="px-3 py-2 text-xs border-gray-500 dark:bg-gray-700 dark:text-gray-200"
              style={{ minWidth: "120px" }}
            >
              <FiPlus />
              <span>{t("business.addNew")}</span>
            </Button>
          </div>
        )}
      />

      <DataTable
        headers={[t("business.name"), t("business.regions"), t("business.status"), t("Actions")]}
        data={data}
        loading={loading}
        noPagination={true}
        emptyMessage={t("No data available")}
        renderRow={(business) => (
          <TableRow key={business._id}>
            <TableCell>{business.name}</TableCell>
            <TableCell>{business.regions}</TableCell>
            {/* <TableCell>{business.shipment_method}</TableCell>
      <TableCell>{business.shipment_method && business.shipment_method == 'Flat Rate' ? business.normal_flat : business.normal_per_kg}</TableCell>
      <TableCell>{business.shipment_method && business.shipment_method == 'Flat Rate' ? '-' : business.express_per_kg}</TableCell>
      {console.log(business.free_delivery)}
      <TableCell>{business.free_delivery && business.free_delivery === false ? 'yes' : 'no'}</TableCell> */}
            <TableCell>
              {/* Check if status is boolean or string */}
              {/* {business.status === false  ? (
                          <span className="text-green-500">Active</span>
                           ) : (
                       <span className="text-red-500">Inactive</span>
                         )} */}
              {
                (business.status = true ? (
                  <span className="text-green-500">{t("business.active")}</span>
                ) : (
                  <span className="text-red-500">{t("business.inactive")}</span>
                ))
              }
            </TableCell>

            <TableCell>
              <Button onClick={() => handleUpdate(business)}>
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
        )}
      />

      <MainDrawer>
        <>
          <div className="w-full relative p-6 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {id ? (
              <Title
                // register={register}
                // handleSelectLanguage={handleSelectLanguage}
                title={t("business.updateShipmentZone")}
                description={t("business.updatingShipment")}
              />
            ) : (
              <Title
                // register={register}
                // handleSelectLanguage={handleSelectLanguage}
                title={t("business.addShipmentZone")}
                description={t("business.adding")}
              />
            )}
          </div>
          <Scrollbars className="w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200">
            <Card className="overflow-y-scroll flex-grow scrollbar-hide w-full max-h-full">
              <CardBody>
                <form onSubmit={BusinessSubmit}>
                  <div className="px-6 pt-8 flex-grow scrollbar-hide w-full max-h-full pb-40">
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
                      <LabelArea label="Region" />
                      <div className="col-span-8 sm:col-span-4">
                        <input
                          type="text"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Enter regions"
                          className="border p-2 rounded w-full"
                        />
                      </div>
                    </div>

                    {/* Display added region chips */}
                    <div
                      className={`flex flex-wrap mt-3 gap-2 transition-all duration-300 ${
                        regions.length === 0
                          ? "justify-center"
                          : "justify-start"
                      }`}
                    >
                      {regions.map((reg, index) => (
                        <div
                          key={index}
                          className="flex items-center bg-gray-200 px-3 py-1 rounded-full transition-all duration-300"
                          style={{ marginBottom: "8px" }}
                        >
                          <span className="text-gray-700">{reg}</span>
                          <button
                            onClick={() => removeRegion(index)}
                            className="ml-2 text-red-500 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Shipment Method radio buttons */}
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Shipment Method" />
                      <div className="col-span-8 sm:col-span-4">
                        <Select
                          value={shipmentMethod}
                          onChange={(e) => setShipmentMethod(e.target.value)}
                          className="mt-1 block w-full"
                        >
                          <option value="Flat Rate">Flat Rate</option>
                          <option value="Per kg">Per kg</option>
                          {/* Add more options if necessary */}
                        </Select>
                        <Error errorName={errors.shipmentMethod} />
                      </div>
                    </div>

                    {/* Conditional Input Field for Flat Rate */}
                    {shipmentMethod === "Flat Rate" && (
                      <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                        <LabelArea label="Flat Rate" />
                        <div className="col-span-8 sm:col-span-4">
                          <Input
                            type="text"
                            value={flatRateName} // Create a state variable `flatRateName` for this input
                            onChange={(e) => setFlatRateName(e.target.value)}
                            placeholder="Enter Flat Rate"
                            className="mt-1 block w-full"
                          />
                          <Error errorName={errors.flatRateName} />
                        </div>
                      </div>
                    )}

                    {/* Conditional Input Field for Per kg */}
                    {shipmentMethod === "Per kg" && (
                      <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                        <LabelArea label="Per kg" />
                        <div className="col-span-8 sm:col-span-4">
                          <Input
                            type="text"
                            value={perKgName} // Create a state variable `perKgName` for this input
                            onChange={(e) => setPerKgName(e.target.value)}
                            placeholder="Enter Per kg"
                            className="mt-1 block w-full"
                          />
                          <Error errorName={errors.perKgName} />
                        </div>
                      </div>
                    )}

                    {/* ///this  */}

                    {/* Normal Per Kg Input Field */}
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Per Kg" />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={PerKg} // Bind to normalPerKg state
                          onChange={(e) => setPerKg(e.target.value)} // Update the state when the input changes
                          placeholder="Enter  per Kg" // Placeholder text
                          className="mt-1 block w-full" // Consistent styling with other input fields
                        />
                        <Error errorName={errors.normalPerKg} />{" "}
                        {/* Display error if any */}
                      </div>
                    </div>

                    {/* Express Per Kg Input Field */}
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Express Per Kg" />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={expressPerKg}
                          onChange={(e) => setExpressPerKg(e.target.value)}
                          placeholder="Enter Express per Kg"
                          className="mt-1 block w-full"
                        />
                        <Error errorName={errors.expressPerKg} />
                      </div>
                    </div>
                    {/* Express Flat Rate Input Field */}

                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Express Flat Rate" />
                      <div className="col-span-8 sm:col-span-4">
                        <Input
                          type="text"
                          value={expressFlat} // Binding to expressFlat state
                          onChange={(e) => setExpressFlat(e.target.value)} // Handling state update
                          placeholder="Enter Express Flat Rate"
                          className="mt-1 block w-full" // Consistent styling with other input fields
                        />
                        <Error errorName={errors.expressFlat} />
                      </div>
                    </div>

                    {/* Free Delivery Dropdown */}
                    <div className="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                      <LabelArea label="Free Delivery" />
                      <div className="col-span-8 sm:col-span-4">
                        <Select
                          value={freeDelivery}
                          onChange={(e) => setFreeDelivery(e.target.value)} // Handle the state update when a selection is made
                          className="mt-1 block w-full"
                        >
                          <option value="">Select Free Delivery</option>{" "}
                          {/* Placeholder */}
                          <option value="yes">Yes</option>{" "}
                          {/* Option for Yes */}
                          <option value="no">No</option> {/* Option for No */}
                        </Select>
                        <Error errorName={errors.freeDelivery} />{" "}
                        {/* Display error message */}
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
                      onClick={!id ? BusinessSubmit : updateShipment}
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
                className="w-full h-12 sm:w-autov bg-p-blue hover:bg-p-blue-dark"
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
                onClick={deleteShipment}
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
