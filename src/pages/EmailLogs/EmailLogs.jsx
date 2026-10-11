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
import moment from "moment";
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
import useButtonColor from "@/hooks/useButtonColor";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const ActivityLogs = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const { toggleDrawer, lang } = useContext(SidebarContext);
  const [data, setData] = useState([]);
  const [uniqueCollections, setUniqueCollections] = useState([]);
  const [uniqueActions, setUniqueActions] = useState([]);
  const [uniqueFunctions, setUniqueFunctions] = useState([]);
  const [FilterFunction, setFilterFunction] = useState("");
  const [FilterAction, setFilterAction] = useState("");
  const [FilterCollection, setFilterCollection] = useState("");
  const [FilterName, setFilterText] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const {
    totalResults,
    resultsPerPage,
    serviceData,
    dataTable,
    handleChangePage,
  } = useFilter(data);
  const buttonColor = useButtonColor();

  const handleView = (_id) => {
    history.push("/viewActivityLogsDetails", { ActivityLogs_id: _id });
  };

  const HandleFilter = async () => {
    try {
      fetchData(FilterAction, FilterCollection, FilterFunction);
    } catch (err) {
      console.error("Error removing image:", err);
      notifyError(err || "Failed to delete image.");
      setLoading(false); // Hide the loading state
    }
  };

  // Fetch Data on Load
  useEffect(() => {
    fetchData(FilterAction, FilterCollection, FilterFunction);
  }, []);

  const fetchData = (FilterAction, FilterCollection, FilterFunction) => {
    const headers = adminInfo
      ? {
          "Content-Type": "application/json",
          authorization: `Bearer ${adminInfo.token}`,
        }
      : {};
    let payload = {
      FilterAction: FilterAction,
      FilterCollection: FilterCollection,
      FilterFunction: FilterFunction,
    };
    axios
      .post(`${Base_URL}/ActivityLogs/getALL`, payload, { headers })
      .then((response) => {
        setData(response.data.data || []);
        const uniqueCollections = [
          ...new Set(response.data.data.map((item) => item.Collection)),
        ];
        setUniqueCollections(uniqueCollections);
        const uniqueActions = [
          ...new Set(response.data.data.map((item) => item.Action)),
        ];
        setUniqueActions(uniqueActions);
        const uniqueFunctions = [
          ...new Set(response.data.data.map((item) => item.Function)),
        ];
        setUniqueFunctions(uniqueFunctions);
      })
      .catch(() => setData([]));
  };

  const handleResetField = () => {
    setFilterAction("");
    setFilterText("");
    fetchData("", "", "");
  };

  return (
    <>
      <PageTitle>{t("Email Logs")}</PageTitle>
      <AnimatedContent>
        <Card>
          <CardBody>
            <form className="flex gap-4">
              {/* <div className="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                <Input
                  type="text"
                  name="search"
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder={t("Search Text")}
                />
                <button
                  type="submit"
                  className="absolute right-0 top-0 mt-5 mr-1"
                ></button>
              </div> */}

              <div className="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                <Select
                  onChange={(e) => setFilterCollection(e.target.value)}
                  className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                >
                  <option value="">{t("Select Collection")}</option>
                  {uniqueCollections.map((collection, index) => (
                    <option key={index} value={collection}>
                      {collection}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                <Select
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                >
                  <option value="All" defaultValue>
                    {t("Select Action")}
                  </option>
                  {uniqueActions.map((collection, index) => (
                    <option key={index} value={collection}>
                      {collection}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                <Select
                  onChange={(e) => setFilterFunction(e.target.value)}
                  className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                >
                  <option value="All" defaultValue>
                    {t("Select Function")}
                  </option>
                  {uniqueFunctions.map((collection, index) => (
                    <option key={index} value={collection}>
                      {collection}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-2 md:mt-0 flex items-center xl:gap-x-4 gap-x-1 flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                <div className="w-full mx-1">
                  <Button
                    onClick={HandleFilter}
                    className="h-12 w-full bg-emerald-700"
                  >
                    Filter
                  </Button>
                </div>

                <div className="w-full">
                  <Button
                    layout="outline"
                    onClick={handleResetField}
                    type="reset"
                    className="px-4 md:py-1 py-3 text-sm dark:bg-gray-700"
                  >
                    <span className="text-black dark:text-gray-200">
                      {t("Reset")}
                    </span>
                  </Button>
                </div>
              </div>
            </form>
          </CardBody>
        </Card>
      </AnimatedContent>

      {loading ? (
        <TableLoading row={12} col={5} />
      ) : serviceData?.length !== 0 ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableCell>{t("Collection")}</TableCell>
                <TableCell>{t("Action")}</TableCell>
                <TableCell>{t("Function")}</TableCell>
                <TableCell>{t("Date")}</TableCell>
                <TableCell>{t("Actions")}</TableCell>
              </tr>
            </TableHeader>
            <TableBody>
              {dataTable.map((ActivityLogs) => (
                <TableRow key={ActivityLogs._id}>
                  <TableCell>{ActivityLogs.Collection}</TableCell>
                  <TableCell>{ActivityLogs.Action}</TableCell>
                  <TableCell>{ActivityLogs.Function}</TableCell>
                  <TableCell>
                    {moment(ActivityLogs.Date).format("DD-MM-YYYY")}
                  </TableCell>
                  <TableCell>
                    <Button
                      style={{ background: "#007bff", marginRight: "10px" }}
                      onClick={() => {
                        handleView(ActivityLogs._id);
                      }}
                    >
                      <FiEye />
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
        <NotFound title="Sorry, There is No Data right now." />
      )}
    </>
  );
};

export default ActivityLogs;
