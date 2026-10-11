import React, { useState, useEffect, useContext } from "react";
import { notifyError } from "@/utils/toast";
import request from "@/services/httpService";

function useSalesContract(selectedBusiness, currentPage, recordsPerPage) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [salesContractStats, setSalesContractStats] = useState({});
  const [reload, setReload] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchContracts = async () => {
      console.log("Fetching contracts...");
      setLoading(true);

      try {
        const response = await request.get(
          `/sales-contracts?businessId=${selectedBusiness || ""}&page=${currentPage}&limit=${recordsPerPage}`
        );

        setContracts(response.contracts);
        setTotalPages(response.totalPages);

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
  }, [reload, selectedBusiness, currentPage, recordsPerPage]);

  return { contracts, loading, setReload, salesContractStats, totalPages };
}
export default useSalesContract;
