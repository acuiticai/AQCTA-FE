import React, { useState, useEffect, useContext } from "react";
import { notifyError } from "@/utils/toast";
import request from "@/services/httpService";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function usePurchaseContract(
  selectedBusiness,
  currentPage,
  recordsPerPage,
  filters = {}
) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salesContractStats, setSalesContractStats] = useState({});
  const [reload, setReload] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [Vendors, setVendors] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    statuses: [],
    items: [],
  });
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${Base_URL}/vendors`);
        console.log("Vendors fetched successfully:", response.data);
        if (response.status) {
          setVendors(response.data.data);
        } else {
          console.error("Failed to fetch customers");
        }
      } catch (error) {
        console.error("❌ Error fetching customers:", error);
      } finally {
        // setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    const fetchContracts = async () => {
      console.log("Fetching contracts...");
      setLoading(true);

      try {
        // Build query parameters
        const queryParams = new URLSearchParams({
          page: currentPage,
          limit: recordsPerPage,
        });

        // Handle business filtering
        if (selectedBusiness) {
          // If specific business is selected, filter by that business
          queryParams.append("businessId", selectedBusiness);
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

        // Add filter parameters
        if (filters.status) {
          queryParams.append("status", filters.status);
        }
        if (filters.vendorId) {
          queryParams.append("vendorId", filters.vendorId);
        }
        if (filters.startDate) {
          queryParams.append("startDate", filters.startDate);
        }
        if (filters.itemId) {
          queryParams.append("itemId", filters.itemId);
        }
        if (filters.endDate) {
          queryParams.append("endDate", filters.endDate);
        }
        if (filters.itemName) {
          queryParams.append("itemName", filters.itemName);
        }
        if (filters.search) {
          queryParams.append("search", filters.search);
        }
        if (filters.salesFilter) {
          queryParams.append("salesFilter", filters.salesFilter);
        }
        if (filters.internalPurchaseFilter) {
          queryParams.append("internalPurchaseFilter", filters.internalPurchaseFilter);
        }

        console.log("🔍 Purchase Contract API Call - Query Params:", queryParams.toString());
        console.log("🔍 Internal Purchase Filter Value:", filters.internalPurchaseFilter);

        const response = await request.get(
          `/purchase-contracts?${queryParams.toString()}`
        );

        setContracts(response.contracts);
        setTotalPages(response.totalPages);

        // Set filter options if available
        if (response.filterOptions) {
          setFilterOptions(response.filterOptions);
        }

        setSalesContractStats({
          totalContracts: response.totalContracts,
          totalOpenContracts: response.totalOpenContracts,
          totalCancelledContracts: response.totalCancelledContracts,
          totalCompletedContracts: response.totalCompletedContracts,
        });
      } catch (error) {
        console.log(error);
        notifyError("Error while fetching contract details");
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, [reload, selectedBusiness, currentPage, recordsPerPage, filters]);

  return {
    contracts,
    loading,
    setReload,
    salesContractStats,
    filterOptions,
    totalPages,
    Vendors,
  };
}

export default usePurchaseContract;
