import React, { useState, useEffect, useContext } from "react";
import { notifyError } from "@/utils/toast";
import request from "@/services/httpService";

function useSalesContract(
  selectedBusiness,
  currentPage,
  recordsPerPage,
  selectedStatus = "",
  selectedCustomer = "",
  selectedDateCreated = "",
  searchTerm = "",
  selectedItem = "",
  purchaseFilter = "",
  internalSalesFilter = ""
) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salesContractStats, setSalesContractStats] = useState({});
  const [reload, setReload] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchContracts = async () => {
      console.log("Fetching contracts...");
      setLoading(true);

      try {
        // Build query parameters
        const queryParams = new URLSearchParams();

        // Add pagination parameters
        queryParams.append("page", currentPage);
        queryParams.append("limit", recordsPerPage);

        // Handle business filtering
        if (selectedBusiness) {
          console.debug("selectedBusiness", selectedBusiness);
          // If specific business is selected, filter by that business
          queryParams.append(
            "businessId",
            selectedBusiness?._id || selectedBusiness
          );
        } else {
          // If no business is selected, get businesses from localStorage
          const storedBusinesses = localStorage.getItem("businesses");
          if (storedBusinesses) {
            const parsedBusinesses = JSON.parse(storedBusinesses);
            const businessIds = parsedBusinesses.map(
              (business) => business._id
            );
            if (businessIds.length > 0) {
              queryParams.append("businessIds", JSON.stringify(businessIds));
            }
          }
        }

        if (selectedStatus) {
          queryParams.append("status", selectedStatus);
        }

        if (selectedCustomer) {
          queryParams.append("customerId", selectedCustomer);
        }

        if (selectedDateCreated) {
          queryParams.append("contractDate", selectedDateCreated);
        }

        if (selectedItem) {
          queryParams.append("itemId", selectedItem);
        }

        if (searchTerm) {
          queryParams.append("search", searchTerm);
        }

        if (purchaseFilter) {
          queryParams.append("purchaseFilter", purchaseFilter);
        }

        if (internalSalesFilter) {
          queryParams.append("internalSalesFilter", internalSalesFilter);
        }

        console.log(
          "🔍 Sales Contract API Call - Query Params:",
          queryParams.toString()
        );
        console.log("🔍 Purchase Filter Value:", purchaseFilter);
        console.log("🔍 Internal Sales Filter Value:", internalSalesFilter);

        const response = await request.get(
          `/sales-contracts?${queryParams.toString()}`
        );

        setContracts(response.contracts || response.data || []);
        setTotalPages(response.totalPages || 1);
        setTotalCount(response.totalCount || 0);
        setSalesContractStats({
          totalContracts: response.totalContracts || 0,
          totalOpenContracts: response.totalOpenContracts || 0,
          totalCancelledContracts: response.totalCancelledContracts || 0,
          totalCompletedContracts: response.totalCompletedContracts || 0,
        });
      } catch (error) {
        console.log(error);
        notifyError("Error while fetching contract details");
        setContracts([]);
        setTotalPages(1);
        setSalesContractStats({
          totalContracts: 0,
          totalOpenContracts: 0,
          totalCancelledContracts: 0,
          totalCompletedContracts: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, [
    reload,
    selectedBusiness,
    currentPage,
    recordsPerPage,
    selectedStatus,
    selectedCustomer,
    selectedDateCreated,
    searchTerm,
    selectedItem,
    purchaseFilter,
    internalSalesFilter,
  ]);

  return {
    contracts,
    loading,
    setReload,
    salesContractStats,
    totalPages,
    totalCount,
  };
}

export default useSalesContract;

// import React, { useState, useEffect } from "react";
// import { notifyError } from "@/utils/toast";
// import request from "@/services/httpService";

// function useSalesContract(
//   selectedBusiness,
//   currentPage,
//   recordsPerPage,
//   selectedStatus = "",
//   selectedCustomer = "",
//   selectedDateCreated = "",
//   searchTerm = ""
// ) {
//   const [contracts, setContracts] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [salesContractStats, setSalesContractStats] = useState({});
//   const [reload, setReload] = useState(false);
//   const [totalPages, setTotalPages] = useState(1);

//   useEffect(() => {
//     const fetchContracts = async () => {
//       setLoading(true);

//       try {
//         // Load businesses from localStorage
//         const storedBusinesses = localStorage.getItem("businesses");
//         const parsedBusinesses = storedBusinesses ? JSON.parse(storedBusinesses) : [];

//         // Prepare businessId array
//         const businessIdArr =
//           selectedBusiness === "" ? parsedBusinesses.map(b => b._id) : [selectedBusiness];
//         console.log("selectedBusiness",selectedBusiness)
//         // Build query parameters
//         const queryParams = new URLSearchParams();
//         queryParams.append("page", currentPage);
//         queryParams.append("limit", recordsPerPage);

//         if (businessIdArr.length > 0) {
//           queryParams.append("businessId", JSON.stringify(businessIdArr));
//         }

//         if (selectedStatus) {
//           queryParams.append("status", selectedStatus);
//         }

//         if (selectedCustomer) {
//           queryParams.append("customerId", selectedCustomer);
//         }

//         if (selectedDateCreated) {
//           queryParams.append("dateCreated", selectedDateCreated);
//         }

//         if (searchTerm) {
//           queryParams.append("search", searchTerm);
//         }

//         const response = await request.get(`/sales-contracts?${queryParams.toString()}`);

//         setContracts(response.contracts || response.data || []);
//         setTotalPages(response.totalPages || 1);

//         setSalesContractStats({
//           totalContracts: response.totalContracts || 0,
//           totalOpenContracts: response.totalOpenContracts || 0,
//           totalCancelledContracts: response.totalCancelledContracts || 0,
//           totalCompletedContracts: response.totalCompletedContracts || 0,
//         });
//       } catch (error) {
//         console.error(error);
//         notifyError("Error while fetching contract details");
//         setContracts([]);
//         setTotalPages(1);
//         setSalesContractStats({
//           totalContracts: 0,
//           totalOpenContracts: 0,
//           totalCancelledContracts: 0,
//           totalCompletedContracts: 0,
//         });
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchContracts();
//   }, [
//     reload,
//     selectedBusiness,
//     currentPage,
//     recordsPerPage,
//     selectedStatus,
//     selectedCustomer,
//     selectedDateCreated,
//     searchTerm,
//   ]);

//   return {
//     contracts,
//     loading,
//     setReload,
//     salesContractStats,
//     totalPages,
//   };
// }

// export default useSalesContract;
