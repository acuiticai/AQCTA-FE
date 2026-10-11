import React, { useState, useContext, useEffect, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import BusinessDropdown from "@/components/BusinessDropdown";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { formatDate } from "@/components/formatAmount";
import { formatAmount } from "@/components/formatAmount";
import CustomPagination from "@/components/CustomPagination";
import { Select } from "@windmill/react-ui";
import actionButton from "../../assets/img/icons/document-text.png";
import viewIcon from "../../assets/img/icons/eye.png"; // Assuming you have an icon for viewing
import { PageHeader, TabButton, DataTable } from "@/page-layouts/index";
import { debounce } from "lodash";

const AuthorizationRequests = () => {
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [activeTab, setActiveTab] = useState("requests"); // 'requests' or 'authorized'
  const [entriesPerPage, setEntriesPerPage] = useState(5);
  const [adminId, setAdminId] = useState();
  const [selectedBusiness, setSelectedBusiness] = useState();
  const [authorizationRequests, setAuthorizationRequests] = useState([]);
  const [authorizedPersons, setAuthorizedPersons] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [authorizedTotalResults, setAuthorizedTotalResults] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [authorizedCurrentPage, setAuthorizedCurrentPage] = useState(1);
  const [authorizedTotalPages, setAuthorizedTotalPages] = useState(1);
  const currentPageRef = useRef(1);
  const authorizedCurrentPageRef = useRef(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [requestSearchTerm, setRequestSearchTerm] = useState("");
  const [allFilteredRequests, setAllFilteredRequests] = useState([]);

  console.log("admin id", adminInfo.id);

  const fetchRequests = async (
    businessId = "",
    page = 1,
    limit = recordsPerPage,
    search = ""
  ) => {
    setIsLoading(true);

    try {
      // If searching, fetch all records without backend search filter
      // We'll do all filtering client-side to include contract numbers
      // Backend search only covers invoice_number and customer_name, not contract_id.contractNo
      const fetchLimit = search && search.trim() !== "" ? 999999 : limit;
      const fetchPage = search && search.trim() !== "" ? 1 : page;

      const params = {
        businessId,
        page: fetchPage,
        limit: fetchLimit,
      };

      // Don't send search to backend - we'll filter client-side for all fields including contract number
      // if (search && search.trim() !== "") {
      //   params.search = search.trim();
      // }

      const response = await axios.get(`${Base_URL}/auth-requests`, { params });
      console.log("requests!", response.data.data);
      // Debug: Check first request structure if available
      if (response.data.data && response.data.data.length > 0) {
        console.log("Sample request structure:", response.data.data[0]);
        console.log(
          "Contract ID structure:",
          response.data.data[0]?.contract_id
        );
      }

      let filteredData = response.data.data || [];

      // Apply client-side filtering for all search fields if search term is provided
      // This includes invoice number, customer name, and contract number
      if (search && search.trim() !== "") {
        const searchLower = search.trim().toLowerCase();
        filteredData = filteredData.filter((request) => {
          // Check invoice number
          const invoiceNumber = request?.invoice_number?.toString() || "";
          const invoiceMatch = invoiceNumber
            .toLowerCase()
            .includes(searchLower);

          // Check customer name
          const customerName = request?.customer_name?.toString() || "";
          const customerMatch = customerName
            .toLowerCase()
            .includes(searchLower);

          // Check contract number (this is the key fix - backend doesn't search this)
          // Handle both populated and non-populated contract_id
          const contractNo =
            request?.contract_id?.contractNo?.toString() ||
            request?.contract_id?.toString() ||
            "";
          const contractMatch = contractNo.toLowerCase().includes(searchLower);

          return invoiceMatch || customerMatch || contractMatch;
        });

        // Store all filtered results for pagination
        setAllFilteredRequests(filteredData);

        // Apply client-side pagination after filtering
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = filteredData.slice(startIndex, endIndex);
        setAuthorizationRequests(paginatedData);
        setTotalResults(filteredData.length); // Total filtered count
      } else {
        // No search, use backend pagination
        setAllFilteredRequests([]);
        setAuthorizationRequests(filteredData);
        setTotalResults(response.data.count);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuthorizedPersons = async (
    businessId = "",
    page = 1,
    limit = recordsPerPage,
    search = ""
  ) => {
    setIsLoading(true);
    const params = {
      businessId,
      page,
      limit,
      search,
    };
    try {
      const response = await axios.get(`${Base_URL}/authorization-letter`, {
        params,
      });
      console.log("authorized persons!", response.data);
      setAuthorizedPersons(response.data.data || []);
      setAuthorizedTotalResults(response.data.count || 0);
      setAuthorizedTotalPages(response.data.totalPages || 1);
    } catch (err) {
      console.log("Error fetching authorized persons:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "requests") {
      fetchRequests(
        selectedBusiness,
        currentPage,
        recordsPerPage,
        requestSearchTerm
      );
    } else {
      fetchAuthorizedPersons(
        selectedBusiness,
        authorizedCurrentPage,
        recordsPerPage,
        searchTerm
      );
    }
  }, [activeTab]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    currentPageRef.current = page;

    // If searching and we have cached filtered results, use them for pagination
    if (
      requestSearchTerm &&
      requestSearchTerm.trim() !== "" &&
      allFilteredRequests.length > 0
    ) {
      const startIndex = (page - 1) * recordsPerPage;
      const endIndex = startIndex + recordsPerPage;
      const paginatedData = allFilteredRequests.slice(startIndex, endIndex);
      setAuthorizationRequests(paginatedData);
    } else {
      // No search or no cached results, fetch from API
      fetchRequests(selectedBusiness, page, recordsPerPage, requestSearchTerm);
    }
  };

  const handleAuthorizedPageChange = (page) => {
    setAuthorizedCurrentPage(page);
    authorizedCurrentPageRef.current = page;
    fetchAuthorizedPersons(selectedBusiness, page, recordsPerPage);
  };

  const onChange = async (value) => {
    console.log("value", value);
    setSelectedBusiness(value);
    if (activeTab === "requests") {
      setAllFilteredRequests([]); // Clear cached filtered results when business changes
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchRequests(value, 1, recordsPerPage, requestSearchTerm);
    } else {
      setAuthorizedCurrentPage(1);
      authorizedCurrentPageRef.current = 1;
      fetchAuthorizedPersons(value, 1, recordsPerPage, searchTerm);
    }
  };

  const handleSearch = async (value) => {
    if (activeTab === "requests") {
      setRequestSearchTerm(value);
      setAllFilteredRequests([]); // Clear cached results when search changes
      setCurrentPage(1);
      currentPageRef.current = 1;
      await fetchRequests(selectedBusiness, 1, recordsPerPage, value);
    } else {
      setSearchTerm(value);
      setAuthorizedCurrentPage(1);
      authorizedCurrentPageRef.current = 1;
      await fetchAuthorizedPersons(selectedBusiness, 1, recordsPerPage, value);
    }
  };

  const clearAllFilters = () => {
    setSelectedBusiness("");
    if (activeTab === "requests") {
      setRequestSearchTerm("");
      setAllFilteredRequests([]); // Clear cached filtered results
      setCurrentPage(1);
      currentPageRef.current = 1;
      fetchRequests("", 1, recordsPerPage, "");
    } else {
      setSearchTerm("");
      setAuthorizedCurrentPage(1);
      authorizedCurrentPageRef.current = 1;
      fetchAuthorizedPersons("", 1, recordsPerPage, "");
    }
  };

  const handleIssueAuthorization = (requestId, businessId) => {
    console.log(
      "selectedBusiness",
      selectedBusiness,
      "requestId",
      requestId,
      "businessId",
      businessId
    );
    history.push({
      pathname: "/treasury/create-authorization",
      search: `?requestId=${requestId}&selectedBusiness=${businessId}`,
    });
  };

  const handleViewIDCard = (idCardUrl) => {
    // Open image in new tab or modal
    window.open(idCardUrl, "_blank");
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Reset pagination when switching tabs
    if (tab === "requests") {
      setCurrentPage(1);
      currentPageRef.current = 1;
      // Fetch requests with current filters
      fetchRequests(selectedBusiness, 1, recordsPerPage, requestSearchTerm);
    } else {
      setAuthorizedCurrentPage(1);
      authorizedCurrentPageRef.current = 1;
      // Fetch authorized persons with current filters
      fetchAuthorizedPersons(selectedBusiness, 1, recordsPerPage, searchTerm);
    }
  };

  const requestsHeaders = [
    "Invoice No",
    "Sales Contract No",
    "Customer",
    "Amount",
    "Due Date",
    "Collection Status",
    "Action",
  ];

  const authorizedHeaders = [
    "Invoice No",
    "Business",
    "Authorized Person",
    "Email",
    "ID Number",
    "Phone",
    "Date Created",
    "ID Card",
    "Action",
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Request Sent":
        return "text-blue-600 bg-blue-50";
      case "Pending Request":
        return "text-yellow-600 bg-yellow-50";
      case "Collection Scheduled":
        return "text-purple-600 bg-purple-50";
      case "Paid":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const renderRequestRow = (request) => (
    <tr className="border-b border-gray-200">
      <td className="py-4">{request?.invoice_number}</td>
      <td className="py-4">{request?.contract_id?.contractNo}</td>
      <td className="py-4">{request?.customer_name}</td>
      <td className="py-4">{formatAmount(request?.subTotal)}</td>
      <td className="py-4">{formatDate(request?.due_date)}</td>
      <td className="py-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            request?.status
          )}`}
        >
          {request?.status}
        </span>
      </td>
      <td className="py-4">
        <button
          className="text-gray-500 flex justify-center"
          onClick={() =>
            handleIssueAuthorization(request._id, request.business_id._id)
          }
        >
          <img src={actionButton} alt="Action" />
        </button>
      </td>
    </tr>
  );

  const renderAuthorizedRow = (person) => (
    <tr className="border-b border-gray-200">
      <td className="py-4">
        {person.proformaInvoice?.invoice_number || "N/A"}
      </td>
      <td className="py-4">{person.businessId?.name || "N/A"}</td>
      <td className="py-4">{person.authorizedPersonName}</td>
      <td className="py-4">{person.email}</td>
      <td className="py-4">{person.idNumber}</td>
      <td className="py-4">{person.phone}</td>
      <td className="py-4">{formatDate(person.createdAt)}</td>
      <td className="py-4">
        <button
          className="text-blue-500 flex items-center gap-1"
          onClick={() => handleViewIDCard(person.IDCardImage)}
        >
          <img src={viewIcon} alt="View" className="w-4 h-4" />
        </button>
      </td>
      <td className="py-4">
        <button
          className="text-gray-500 flex justify-center"
          onClick={() => {
            sessionStorage.setItem("fromPath", location.pathname);
            history.push({
              pathname: `/treasury/authorization-templates`,
              search: `?requestId=${person?.proformaInvoice?._id}&businessId=${person.businessId?._id}&authLetterId=${person._id}`,
            });
          }}
        >
          <img src={actionButton} alt="Action" />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      {/* <PageHeader title="Authorization Management" /> */}

      {/* Tab Navigation */}
      <div className="flex mb-6 gap-2">
        <TabButton
          name="requests"
          title="Authorization Requests"
          activeTab={activeTab}
          handleTabChange={handleTabChange}
        />
        <TabButton
          name="authorized"
          title="Authorized Persons"
          activeTab={activeTab}
          handleTabChange={handleTabChange}
        />
      </div>

      <div className="bg-gray-50 rounded-lg">
        <>
          {/* Authorization Requests Tab */}
          {activeTab === "requests" && (
            <DataTable
              headers={requestsHeaders}
              data={authorizationRequests}
              loading={isLoading}
              currentPage={currentPage}
              totalPages={Math.ceil(totalResults / recordsPerPage)}
              recordsPerPage={recordsPerPage}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={(value) => {
                setRecordsPerPage(value);
                setAllFilteredRequests([]); // Clear cached results when records per page changes
                currentPageRef.current = 1;
                setCurrentPage(1);
                fetchRequests(selectedBusiness, 1, value, requestSearchTerm);
              }}
              renderRow={renderRequestRow}
              emptyMessage="No authorization requests found"
              filters={[
                {
                  isClearButton: true,
                  buttonProps: {
                    onClick: clearAllFilters,
                  },
                },
                {
                  isBusinessDropdown: true,
                  businessDropdownProps: {
                    adminId: adminInfo.id,
                    selectedBusiness: selectedBusiness,
                    onChange: onChange,
                  },
                },
              ]}
              searchValue={requestSearchTerm}
              onSearch={handleSearch}
              searchPlaceholder="Search by invoice number, contract number, or customer name"
            />
          )}

          {/* Authorized Persons Tab */}
          {activeTab === "authorized" && (
            <DataTable
              headers={authorizedHeaders}
              data={authorizedPersons}
              loading={isLoading}
              currentPage={authorizedCurrentPage}
              totalPages={authorizedTotalPages}
              recordsPerPage={recordsPerPage}
              onPageChange={handleAuthorizedPageChange}
              onRecordsPerPageChange={(value) => {
                setRecordsPerPage(value);
                authorizedCurrentPageRef.current = 1;
                setAuthorizedCurrentPage(1);
                fetchAuthorizedPersons(selectedBusiness, 1, value, searchTerm);
              }}
              renderRow={renderAuthorizedRow}
              emptyMessage="No authorized persons found"
              filters={[
                {
                  isClearButton: true,
                  buttonProps: {
                    onClick: clearAllFilters,
                  },
                },
                {
                  isBusinessDropdown: true,
                  businessDropdownProps: {
                    adminId: adminInfo.id,
                    selectedBusiness: selectedBusiness,
                    onChange: onChange,
                  },
                },
              ]}
              searchValue={searchTerm}
              onSearch={handleSearch}
              searchPlaceholder="Search authorized persons"
            />
          )}
        </>
      </div>
    </div>
  );
};

export default AuthorizationRequests;
