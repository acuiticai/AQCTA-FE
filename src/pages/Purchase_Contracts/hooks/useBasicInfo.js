import { useState, useEffect } from "react";
import request from "@/services/httpService";
import { notifySuccess, notifyError } from "@/utils/toast";
// import { useSalesContext } from "../context/SalesContractContext";
import { useHistory } from "react-router-dom";
const contractNumberGenerate = (
  entityNumber,
  itemCode,
  runningNumber = 1003
) => {
  const year = new Date().getFullYear().toString().slice(-2);
  const entity = entityNumber.toString().padStart(2, "0");
  const randomIncrement = Math.floor(Math.random() * 1000) + 1;

  const incrementedRunningNumber = runningNumber + randomIncrement;
  const running = incrementedRunningNumber.toString().padStart(4, "0");

  const contractNumber = `S${year}${entity}-${itemCode}${running}`;
  return contractNumber;
};

const submitBasicInfoData = async (data) => {
  console.log(data);
  const response = await request.post("/sales-contracts", data);
  return response;
};

const initialState = {
  typeOfSaleContract: "",
  salesPerson: "",
  buyerCompanyName: "",
  agentName: "",
  finalCustomerName: "",

};

function useBasicInfo(onSave) {
  const [basicInfo, setBasicInfo] = useState(initialState);
  // const { selectedBusiness, setSelectedBusiness, contractId, setContractId } =
  //   useSalesContext();
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [contractId, setContractId] = useState(null); // If needed in future

  // Fetch businesses from localStorage or API
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const stored = localStorage.getItem("businesses");
        if (stored) {
          setBusinesses(JSON.parse(stored));
        } else {
          const response = await request.get("/businesses");
          setBusinesses(response.data?.data || []);
        }
      } catch (error) {
        console.error("Error loading businesses:", error);
        notifyError("Failed to load businesses");
      }
    };

    fetchBusinesses();
  }, []);

  const [isOpen, setIsOpen] = useState(true);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory();


  useEffect(() => {
    const fetchContractData = async () => {
      if (!contractId) return;

      setIsLoading(true);
      try {
        const response = await request.get(`/sales-contracts/${contractId}`);
        const { basicInfo: contractBasicInfo, business } = response;

        setBasicInfo(contractBasicInfo || initialState);

        if (business) {
          setSelectedBusiness(business);
        }
      } catch (error) {
        console.error("Error fetching contract:", error);
        notifyError("Error loading contract data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchContractData();
  }, [contractId, setSelectedBusiness]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Log the update for debugging
    console.log("Updating field:", name, "with value:", value);

    setBasicInfo((prevState) => ({
      ...prevState,
      [name]: value,
    }));

    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: !value ? "This field is required" : "",
    }));
  };
  const handleSubmit = async () => {
    const newErrors = {};
    Object.keys(basicInfo).forEach((key) => {
      if (!basicInfo[key]) {
        newErrors[key] = "This field is required";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const data = {
        basicInfo,
      };

      if (contractId) {
        await request.put(`/sales-contracts/${contractId}`, data);
        notifySuccess("Sales Contract Updated Successfully");
        // showPopup("success", "Sales Contract Updated Successfully!", () => {})
      } else {
        // Contract number will be generated on backend
        data.business = selectedBusiness;
        const responseData = await submitBasicInfoData(data);
        notifySuccess("Sales Contract Basic Info Saved");
        // showPopup("success", "Sales Contract Basic Info Saved!", () => {})
        setBasicInfo(initialState);
        console.log("Calling Sales Contract: ", contractId);

        onSave(responseData?._id);
      }
    } catch (error) {
      notifyError(
        contractId
          ? "Error updating contract"
          : "Error saving Sales Contract Basic Info"
      );
      console.log("Error : ", error);
    }
  };

  const handleCancel = () => {
    setBasicInfo(initialState);
    setErrors({});
    setSelectedBusiness("");
    setContractId("");
    history.push("/sales");
  };

  return {
    handleCancel,
    handleSubmit,
    handleInputChange,
    basicInfo,
    errors,
    isOpen,
    setIsOpen,
    isLoading,
  };
}

export default useBasicInfo;
