import requests from "./httpService";
import axios from "axios";
const DownloadServices = {
  htmlToPdf: (data) => {
    return axios
      .post(`${import.meta.env.VITE_APP_API_BASE_URL}/html-to-pdf/`, data, {
        responseType: "blob",
      })
      .then((response) => response.data); // response.data is the Blob
  },
};

export default DownloadServices;
