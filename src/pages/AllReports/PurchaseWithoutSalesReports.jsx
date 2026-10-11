import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Download, Search, RefreshCw } from "lucide-react";
import {
  DataTable,
  InputField,
  DropdownBasic,
  FormInput,
  Loader,
} from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { toast } from "react-toastify";
import { AdminContext } from "@/context/AdminContext";
import BusinessDropdown from "@/page-layouts/components/helpers/BusinessDropdown";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PurchaseWithoutSalesReports = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const adminId = adminInfo?.id || adminInfo?._id;

  const [searchParams, setSearchParams] = useState({
    search: "",
    business: "",
    vendorId: "",
    itemName: "",
    contractNo: "",
    startDate: "",
    endDate: "",
    // Force only Purchase Without Sales
    salesFilter: "without_sales",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [vendorOptions, setVendorOptions] = useState([]);
  const [productTypeOptions, setProductTypeOptions] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [summaryData, setSummaryData] = useState({
    summary: [],
    grandTotal: { totalMTS: 0, totalValue: 0, averagePrice: 0 },
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const [items, setItems] = useState([]);

  const fetchProductTypes = async () => {
    try {
      let businessIds = [];
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const businessesArr = JSON.parse(storedBusinesses);
        businessIds = businessesArr.map((b) => b._id);
      }

      let query = {};
      if (searchParams.business) {
        query.businessId = searchParams.business;
      } else if (businessIds.length > 0) {
        query.businessIds = businessIds;
      }

      const response = await axios.get(`${Base_URL}/items`, { params: query });

      if (response.status === 200 && response.data) {
        const itemsData = Array.isArray(response.data)
          ? response.data
          : response.data.items || [];
        setItems(itemsData);

        const uniqueTypes = [
          ...new Map(
            itemsData
              .map((item) => {
                const itemName =
                  item.name || item.title || item.typeOfProduct || "";
                return [itemName, { value: itemName, label: itemName }];
              })
              .filter(([name]) => name && name.trim() !== "")
          ).values(),
        ].sort((a, b) => a.label.localeCompare(b.label));

        setProductTypeOptions([
          { value: "", label: "All Products" },
          ...uniqueTypes,
        ]);
      }
    } catch (err) {
      console.error("Error fetching product types:", err);
      setProductTypeOptions([
        { value: "", label: "All Products" },
        { value: "LATEX", label: "LATEX" },
        { value: "NATURAL", label: "NATURAL" },
        { value: "SYNTHETIC", label: "SYNTHETIC" },
        { value: "CARBON BLACK", label: "CARBON BLACK" },
        { value: "NATURAL RUBBER", label: "NATURAL RUBBER" },
        { value: "RUBBER", label: "RUBBER" },
        { value: "OTHER", label: "OTHER" },
      ]);
    }
  };

  const fetchVendorOptions = async () => {
    try {
      const response = await axios.get(`${Base_URL}/vendors`);
      if (response.status) {
        const vendors = response?.data.vendors || response?.data || [];
        const transformedVendors = vendors.map((vendor) => ({
          value: vendor._id,
          label:
            vendor?.basicInformation?.vendorDisplayName ||
            vendor?.name ||
            "Unknown Vendor",
        }));

        setVendorOptions([
          { value: "", label: "All Vendors" },
          ...transformedVendors,
        ]);
      } else {
        setVendorOptions([{ value: "", label: "All Vendors" }]);
      }
    } catch (error) {
      console.error("❌ Error fetching vendors:", error);
      setVendorOptions([{ value: "", label: "All Vendors" }]);
    }
  };

  const fetchData = async (page = 1, perPage = limit) => {
    setLoading(true);
    try {
      const cleanParams = Object.fromEntries(
        Object.entries({
          page,
          limit: perPage,
          ...searchParams,
        }).filter(
          ([, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      // Convert business to businessId for the API
      if (cleanParams.business) {
        cleanParams.businessId = cleanParams.business;
        delete cleanParams.business;
      }

      console.log("🔍 Fetching purchase contracts - Params:", cleanParams);

      const res = await axios.get(`${Base_URL}/purchase-contracts`, {
        params: cleanParams,
      });

      console.log("🔍 API Response:", res.data);
      console.log("🔍 Contracts received:", res.data?.contracts?.length || 0);

      if (res.data && res.data.contracts) {
        // Flatten purchase contracts with productInfo for display
        const flattenedRecords = [];
        (res.data.contracts || []).forEach((contract) => {
          if (contract.productInfo && contract.productInfo.length > 0) {
            contract.productInfo.forEach((product) => {
              flattenedRecords.push({
                ...contract,
                productInfo: product,
              });
            });
          } else {
            flattenedRecords.push(contract);
          }
        });

        setRecords(flattenedRecords);
        setCurrentPage(res.data.currentPage || 1);
        setTotalPages(res.data.totalPages || 1);
        setLimit(limit);
        setTotal(res.data.totalContracts || 0);
        setBaseCurrency(res.data.baseCurrency || "USD");
      }
    } catch (err) {
      console.error("❌ API Error:", err);
      toast.error("Failed to fetch purchase without sales reports");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(
          ([, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      // Convert business to businessId for the API
      if (cleanParams.business) {
        cleanParams.businessId = cleanParams.business;
        delete cleanParams.business;
      }

      const res = await axios.get(
        `${Base_URL}/purchase-contracts/summary/pws`,
        {
          params: cleanParams,
        }
      );

      if (res.data.success) {
        setSummaryData(
          res.data.data || {
            summary: [],
            grandTotal: { totalMTS: 0, totalValue: 0, averagePrice: 0 },
          }
        );
        setBaseCurrency(res.data.baseCurrency || "USD");
      }
    } catch (err) {
      console.error("❌ API Error fetching summary:", err);
      setSummaryData({
        summary: [],
        grandTotal: { totalMTS: 0, totalValue: 0, averagePrice: 0 },
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, limit);
    fetchVendorOptions();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, limit]);

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetchProductTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.business]);

  useEffect(() => {
    fetchProductTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, limit);
    fetchSummary();
  };

  const handleReset = () => {
    const resetParams = {
      search: "",
      business: "",
      vendorId: "",
      itemName: "",
      contractNo: "",
      startDate: "",
      endDate: "",
      salesFilter: "without_sales",
    };

    setSearchParams(resetParams);
    setResetKey((prev) => prev + 1);
    setCurrentPage(1);

    setLoading(true);
    const cleanParams = Object.fromEntries(
      Object.entries({
        page: 1,
        limit,
        ...resetParams,
      }).filter(
        ([, v]) =>
          v !== "" && v !== null && v !== undefined && v !== "undefined"
      )
    );

    if (cleanParams.business) {
      cleanParams.businessId = cleanParams.business;
      delete cleanParams.business;
    }

    axios
      .get(`${Base_URL}/purchase-contracts`, { params: cleanParams })
      .then((res) => {
        if (res.data && res.data.contracts) {
          const flattenedRecords = [];
          (res.data.contracts || []).forEach((contract) => {
            if (contract.productInfo && contract.productInfo.length > 0) {
              contract.productInfo.forEach((product) => {
                flattenedRecords.push({
                  ...contract,
                  productInfo: product,
                });
              });
            } else {
              flattenedRecords.push(contract);
            }
          });
          setRecords(flattenedRecords);
          setCurrentPage(res.data.currentPage || 1);
          setTotalPages(res.data.totalPages || 1);
          setLimit(limit);
          setTotal(res.data.totalContracts || 0);
        }
      })
      .catch((err) => {
        console.error("❌ API Error:", err);
        toast.error("Failed to fetch purchase without sales reports");
        setRecords([]);
      })
      .finally(() => {
        setLoading(false);
      });

    fetchSummary();
  };

  const handleDownload = async () => {
    setExcelLoading(true);
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(
          ([, v]) =>
            v !== "" && v !== null && v !== undefined && v !== "undefined"
        )
      );

      const params = new URLSearchParams(cleanParams).toString();
      const url = `${Base_URL}/purchase-contracts/export/pws-excel?${params}`;

      const response = await axios.get(url, {
        responseType: "blob",
        timeout: 60000,
      });

      const blob = new Blob([response.data]);
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `purchase-without-sales-${Date.now()}.xlsx`;
      link.click();

      toast.success("Purchase Without Sales report exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Purchase Without Sales report");
    } finally {
      setExcelLoading(false);
    }
  };

  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      (rec.contractNo || "").toLowerCase().includes(q) ||
      (
        rec.basicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName ||
        ""
      )
        .toLowerCase()
        .includes(q) ||
      (rec.productInfo?.title || "").toLowerCase().includes(q)
    );
  });

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: baseCurrency || "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatCurrencyWithCode = (
    value,
    currencyCode = baseCurrency || "USD"
  ) => {
    if (!value && value !== 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const stripHtmlTags = (html) => {
    if (!html) return "";
    // Remove HTML tags and decode HTML entities
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const getShipmentEstMonth = (contract) => {
    if (contract.basicInfo?.ETD_Port) {
      return contract.basicInfo.ETD_Port;
    }
    if (contract.productInfo?.estimatedDeparture) {
      return contract.productInfo.estimatedDeparture;
    }
    return "-";
  };

  const getPaymentMade = (contract) => {
    // This would need to be calculated from VendorInvoices if available
    // For now, return 0 as placeholder
    return 0;
  };

  return (
    <div
      className="p-6 bg-gray-50 min-h-screen"
      style={{ overflowX: "hidden" }}
    >
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Purchase Without Sales Reports
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Detailed list of purchase contracts without any linked sales,
              matching Excel layout.
            </p>
            {baseCurrency && baseCurrency !== "USD" && (
              <p className="text-sm text-gray-600 mt-1">
                Base Currency:{" "}
                <span className="font-semibold">{baseCurrency}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={handleDownload}
              disabled={excelLoading}
            >
              {excelLoading ? (
                <>
                  <Loader color="white" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="relative">
            <InputField
              type="text"
              name="search"
              value={searchParams.search || ""}
              placeholder="Search by contract, supplier, product..."
              className="pl-10 text-sm"
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, search: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          </div>

          {adminId ? (
            <BusinessDropdown
              adminId={adminId}
              selectedBusiness={searchParams.business || ""}
              onChange={(val) => {
                setSearchParams((prev) => ({
                  ...prev,
                  business: val,
                }));
              }}
              placeholder="Business"
              className="text-sm"
            />
          ) : (
            <InputField
              type="text"
              name="business"
              value=""
              placeholder="Business (Loading...)"
              className="text-sm"
              disabled
            />
          )}

          <DropdownBasic
            placeholder="Vendor"
            name="vendorId"
            value={searchParams.vendorId || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, vendorId: val }))
            }
            options={vendorOptions}
            className="text-sm"
            disabled={vendorOptions.length <= 1}
          />

          <DropdownBasic
            placeholder="Product Type"
            name="itemName"
            value={searchParams.itemName || ""}
            onChange={(val) =>
              setSearchParams((prev) => ({ ...prev, itemName: val }))
            }
            options={productTypeOptions}
            className="text-sm"
          />

          <InputField
            type="text"
            name="contractNo"
            value={searchParams.contractNo || ""}
            placeholder="Contract No."
            className="text-sm"
            onChange={(e) =>
              setSearchParams((prev) => ({
                ...prev,
                contractNo: e.target.value,
              }))
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <FormInput
            key={resetKey}
            type="date-range"
            initialStartDate={searchParams.startDate}
            initialEndDate={searchParams.endDate}
            onChange={(value) => {
              setSearchParams((prev) => ({
                ...prev,
                startDate: value.startDate,
                endDate: value.endDate,
              }));
            }}
            marginLeft="-44px"
          />

          <div className="flex gap-2 md:col-span-4">
            <button
              onClick={handleSearch}
              className="bg-[var(--p-blue)] hover:bg-[#9FBF29] text-white flex items-center justify-center px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Search className="mr-2" size={16} />
              Search
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <style>{`
          .pws-table-wrapper {
            width: 100%;
            max-width: 100vw;
            overflow-x: auto;
            overflow-y: visible;
            -webkit-overflow-scrolling: touch;
            position: relative;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
            isolation: isolate;
          }

          .pws-table-wrapper::-webkit-scrollbar {
            height: 8px;
          }

          .pws-table-wrapper::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }

          .pws-table-wrapper::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }

          .pws-table-wrapper::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }

          .pws-table-wrapper .data-table-layout {
            width: 100%;
            max-width: 100%;
            overflow: visible;
          }

          .pws-table-wrapper .data-table-layout > div > div.overflow-x-hidden,
          .pws-table-wrapper .data-table-layout .overflow-x-hidden,
          .pws-table-wrapper .data-table-layout > div.overflow-x-hidden,
          .pws-table-wrapper .overflow-x-hidden {
            overflow-x: auto !important;
            overflow-y: visible !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          .pws-table-wrapper [class*="overflow-x-hidden"] {
            overflow-x: auto !important;
            overflow-y: visible !important;
          }

          .pws-table-wrapper .data-table-layout table,
          .pws-table-wrapper table {
            min-width: max-content !important;
            width: max-content !important;
            table-layout: auto !important;
            display: table !important;
          }

          .pws-table-wrapper .data-table-layout table td,
          .pws-table-wrapper .data-table-layout table th,
          .pws-table-wrapper table td,
          .pws-table-wrapper table th {
            white-space: nowrap !important;
          }

          .pws-table-wrapper > * {
            max-width: 100%;
          }
        `}</style>
        <div className="pws-table-wrapper">
          <DataTable
            noBackground={true}
            noPadding={true}
            containerClassName="w-full"
            headers={[
              "Status",
              "Purchase Date",
              "Supplier Name",
              "Purchase Contract No.",
              "Grade",
              "Shipping Terms",
              "Unit Price (USD/MT)",
              "MTS",
              "Value (USD)",
              "Origin",
              "Destination",
              "Shipment Estimation Month",
              "Packing",
              "Remarks",
              "Payment Made (USD)",
            ]}
            data={filteredRecords}
            searchValue={searchQuery}
            onSearch={setSearchQuery}
            searchPlaceholder="Search in results..."
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            recordsPerPage={limit}
            onRecordsPerPageChange={setLimit}
            loading={loading}
            colWidths={{
              Status: "100px",
              "Purchase Date": "130px",
              "Supplier Name": "220px",
              "Purchase Contract No.": "180px",
              Grade: "100px",
              "Shipping Terms": "140px",
              "Unit Price (USD/MT)": "150px",
              MTS: "120px",
              "Value (USD)": "140px",
              Origin: "150px",
              Destination: "150px",
              "Shipment Estimation Month": "180px",
              Packing: "160px",
              Remarks: "200px",
              "Payment Made (USD)": "180px",
            }}
            renderRow={(rec) => {
              const product = rec.productInfo || {};
              const qty = product.totalQuantityMTS || product.quantityMTS || 0;
              const price = product.price || 0;
              const value = product.totalValue || qty * price;
              const vendorName =
                rec.basicInfo?.selectedVendorId?.basicInformation
                  ?.vendorDisplayName ||
                rec.basicInfo?.selectedVendorId?.name ||
                "N/A";

              return (
                <tr
                  key={`${rec._id}-${product._id || ""}`}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                      STOCK
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.basicInfo?.contractDate
                      ? formatDate(rec.basicInfo.contractDate)
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {vendorName}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-blue-600 whitespace-nowrap">
                    {rec.contractNo || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {product.grade || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {product.shippingTerms
                      ? stripHtmlTags(product.shippingTerms)
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {price ? (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(product.price || price)}</span>
                        {product.currency &&
                          product.currency !== baseCurrency &&
                          product.priceOriginal && (
                            <span className="text-xs text-gray-500 mt-1">
                              ≈{" "}
                              {formatCurrencyWithCode(
                                product.priceOriginal,
                                product.currency
                              )}
                            </span>
                          )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {qty?.toFixed(2) || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">
                        {formatCurrency(product.totalValue || value)}
                      </span>
                      {product.currency &&
                        product.currency !== baseCurrency &&
                        product.totalValueOriginal && (
                          <span className="text-xs text-gray-500 mt-1">
                            ≈{" "}
                            {formatCurrencyWithCode(
                              product.totalValueOriginal,
                              product.currency
                            )}
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.basicInfo?.origin_country ||
                      product.origin_country ||
                      "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {product.portOfDestination || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {getShipmentEstMonth(rec)}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {product.packing || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {rec.status || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right whitespace-nowrap">
                    {formatCurrency(getPaymentMade(rec))}
                  </td>
                </tr>
              );
            }}
          />
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
          <span className="text-gray-400 text-xs">← Scroll →</span>
          <span className="text-gray-500">
            Total records: <span className="font-semibold">{total}</span>
          </span>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow mt-6 overflow-hidden">
        <div className="p-4 bg-blue-600">
          <h3 className="text-lg font-bold text-white">
            Summary of Stock (Position)
          </h3>
        </div>
        {summaryLoading ? (
          <div className="p-8 text-center">
            <Loader color="gray" />
            <p className="text-gray-500 mt-2">Loading summary...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-100">
                  <th className="px-4 py-3 text-left font-bold text-black border border-gray-300">
                    GRADE
                  </th>
                  <th className="px-4 py-3 text-right font-bold text-black border border-gray-300">
                    SUM of TOTAL (MTS)
                  </th>
                  <th className="px-4 py-3 text-right font-bold text-black border border-gray-300">{`SUM of TOTAL (${baseCurrency})`}</th>
                  <th className="px-4 py-3 text-right font-bold text-black border border-gray-300">{`AVERAGE of (${baseCurrency}/MT)`}</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.summary.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-4 text-center text-gray-500 border border-gray-300"
                    >
                      No data available
                    </td>
                  </tr>
                ) : (
                  <>
                    {summaryData.summary.map((row, index) => (
                      <tr
                        key={row.grade}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-4 py-2 text-sm border border-gray-300">
                          {row.grade}
                        </td>
                        <td className="px-4 py-2 text-sm text-right border border-gray-300">
                          {row.totalMTS.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right border border-gray-300">
                          <div className="flex flex-col items-end">
                            <span className="font-medium">
                              {formatCurrency(row.totalValue)}
                            </span>
                            {row.totalValueOriginal &&
                              row.totalValueOriginal !== row.totalValue && (
                                <span className="text-xs text-gray-500 mt-1">
                                  ≈{" "}
                                  {formatCurrencyWithCode(
                                    row.totalValueOriginal,
                                    baseCurrency
                                  )}
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-right border border-gray-300">
                          <div className="flex flex-col items-end">
                            <span>{formatCurrency(row.averagePrice)}</span>
                            {row.averagePriceOriginal &&
                              row.averagePriceOriginal !== row.averagePrice && (
                                <span className="text-xs text-gray-500 mt-1">
                                  ≈{" "}
                                  {formatCurrencyWithCode(
                                    row.averagePriceOriginal,
                                    baseCurrency
                                  )}
                                </span>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-700 text-white font-bold">
                      <td className="px-4 py-3 text-sm border border-gray-300">
                        Grand Total
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300">
                        {summaryData.grandTotal.totalMTS.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300">
                        <div className="flex flex-col items-end">
                          <span>
                            {formatCurrency(summaryData.grandTotal.totalValue)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300">
                        <div className="flex flex-col items-end">
                          <span>
                            {formatCurrency(
                              summaryData.grandTotal.averagePrice
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseWithoutSalesReports;
