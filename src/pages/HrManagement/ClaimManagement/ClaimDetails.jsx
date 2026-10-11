"use client";

import { useEffect, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Eye,
  Calendar,
  Building,
  User,
  Hash,
  CreditCard,
  DollarSign,
} from "lucide-react";
import axios from "axios";
import { HiDotsVertical } from "react-icons/hi";
import { formatDate } from "@/components/formatAmount";
import { CurrencyDropdown } from "@/page-layouts/index";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
const File_URL = import.meta.env.VITE_APP_API_SOCKET_URL;

const DocumentCard = ({ doc, itemIndex }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [documentURL, setDocumentURL] = useState("");

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await axios.get(
          `${Base_URL}/documents/getFileWithAllData/${doc.fileId}`
        );
        setDocumentURL(response.data.data.url);
      } catch (error) {
        console.error("Error getting file", error);
      }
    };

    if (doc.fileId) {
      fetchDocument();
    }
  }, [doc.fileId]);

  const handleView = async () => {
    if (doc.fileId) {
      try {
        const response = await axios.get(
          `${Base_URL}/documents/getFileWithAllData/${doc.fileId}`
        );
        window.open(response.data.data.url, "_blank");
        setDocumentURL(response.data.data.url);
      } catch (error) {
        console.error("Error getting file", error);
        alert("Error opening the file. Please try again later.");
      }
    } else {
      alert("File ID is not available");
    }
    setShowMenu(false);
  };

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center space-x-3">
          <div className="bg-red-500 text-white px-2 py-1 rounded-md text-xs font-medium">
            <FileText className="w-3 h-3 inline mr-1" />
            PDF
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
              {doc.name}
            </span>
            {itemIndex !== undefined && (
              <span className="text-xs text-gray-500">
                Item {itemIndex + 1}
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <HiDotsVertical className="text-gray-400 text-lg" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg z-50 w-32 border border-gray-100">
              <button
                onClick={handleView}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2 rounded-lg"
              >
                <Eye className="w-4 h-4" />
                <span>View</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="h-48 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-center w-full h-full">
          {documentURL ? (
            <iframe
              src={documentURL}
              title="PDF Preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Loading preview...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ItemCard = ({ item, index, conversionData }) => {
  const getConvertedClaimableAmount = () => {
    if (!conversionData || !conversionData.converted || !item.currency?.name)
      return null;

    const conversion = conversionData.converted.find(
      (conv) =>
        conv.from === item.currency.name &&
        conv.originalAmount === item.claimableAmount
    );

    return conversion;
  };

  const convertedClaimableAmount = getConvertedClaimableAmount();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Item {index + 1}
          </h3>
          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-200">
            {item.claimType?.name || item.claimType?.type || "Unknown Type"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Hash className="w-4 h-4 text-gray-400" />
              <p className="text-gray-500 text-sm">Receipt No.</p>
            </div>
            <p className="font-medium text-gray-900">{item.receiptNo}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <p className="text-gray-500 text-sm">Receipt Date</p>
            </div>
            <p className="font-medium text-gray-900">
              {item.receiptDate ? formatDate(item.receiptDate) : "-"}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <p className="text-gray-500 text-sm">Currency</p>
            </div>
            <p className="font-medium text-gray-900">
              {item.currency?.symbol || "-"}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <p className="text-gray-500 text-sm">Receipt Amount</p>
            </div>
            <p className="font-medium text-gray-900">
              {item.receiptAmount?.toFixed(2) || "0.00"} {item.currency?.symbol}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-gray-500 text-sm">Claimable Amount</p>
            <p className="font-medium text-green-600 text-lg">
              {item.claimableAmount?.toFixed(2) || "0.00"}{" "}
              {item.currency?.symbol}
            </p>
            {/* {convertedClaimableAmount && (
              <p className="text-sm text-blue-600 font-semibold">
                <strong>≈ {convertedClaimableAmount.convertedAmount.toFixed(2)} MYR</strong>
              </p>
            )} */}
          </div>

          <div className="space-y-1">
            <p className="text-gray-500 text-sm">Purpose</p>
            <p className="font-medium text-gray-900">{item.purpose || "-"}</p>
          </div>

          {item.remarks && (
            <div className="md:col-span-2 lg:col-span-3 space-y-1">
              <p className="text-gray-500 text-sm">Remarks</p>
              <p className="font-medium text-gray-900 bg-gray-50 p-3 rounded-lg">
                {item.remarks}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ClaimDetails = () => {
  const isSingleBusiness = isSingleAssignedBusiness();
  const { id } = useParams();
  const history = useHistory();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  // Total claimable amount state
  const [selectedTotalCurrency, setSelectedTotalCurrency] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [conversionSummary, setConversionSummary] = useState(null);
  const [isCalculatingConversion, setIsCalculatingConversion] = useState(false);

  // Fetch currencies when claim data is available
  useEffect(() => {
    const fetchCurrencies = async () => {
      if (!claim?.company?._id) {
        setCurrencies([]);
        return;
      }

      try {
        const response = await axios.get(
          `${Base_URL}/finance/currencies?business_id=${claim.company._id}`
        );
        setCurrencies(response.data.data || []);
      } catch (error) {
        console.error("Error fetching currencies:", error);
        setCurrencies([]);
      }
    };

    fetchCurrencies();
  }, [claim?.company?._id]);

  // Calculate total claimable amount using conversion rates from currencies API
  const calculateTotalClaimableAmount = () => {
    if (
      !selectedTotalCurrency ||
      !claim?.items ||
      claim.items.length === 0 ||
      !currencies.length
    ) {
      setConversionSummary(null);
      return;
    }

    setIsCalculatingConversion(true);
    try {
      // Find the selected currency's conversion rate
      const selectedCurrencyData = currencies.find(
        (c) => c._id === selectedTotalCurrency
      );
      if (!selectedCurrencyData) {
        setConversionSummary(null);
        return;
      }

      // Group items by currency and sum amounts
      const currencyGroups = {};
      claim.items.forEach((item) => {
        if (item.currency?.symbol && item.claimableAmount) {
          const currency = item.currency.symbol;
          if (!currencyGroups[currency]) {
            currencyGroups[currency] = 0;
          }
          currencyGroups[currency] += parseFloat(item.claimableAmount) || 0;
        }
      });

      // Calculate conversions using the conversion rates from the API
      const conversions = [];
      let totalConvertedAmount = 0;

      Object.entries(currencyGroups).forEach(([fromCurrency, amount]) => {
        // Find currency by symbol (name) instead of ID
        const fromCurrencyData = currencies.find(
          (c) => c.symbol === fromCurrency
        );
        if (fromCurrencyData) {
          // Calculate conversion using the rates from the API
          const fromRate = fromCurrencyData.conversion_rate_to_base;
          const toRate = selectedCurrencyData.conversion_rate_to_base;
          const convertedAmount = (amount * fromRate) / toRate;

          conversions.push({
            from: fromCurrencyData.symbol,
            to: selectedCurrencyData.symbol,
            originalAmount: amount,
            convertedAmount: convertedAmount,
            rate: fromRate / toRate,
          });

          totalConvertedAmount += convertedAmount;
        }
      });

      setConversionSummary({
        totalConvertedAmount: totalConvertedAmount,
        conversions: conversions,
        isRealTime: false,
        source: "Local conversion rates",
      });
    } catch (error) {
      console.error("Error calculating conversion:", error);
      setConversionSummary(null);
    } finally {
      setIsCalculatingConversion(false);
    }
  };

  // Calculate conversion when items or selected currency changes
  useEffect(() => {
    calculateTotalClaimableAmount();
  }, [claim?.items, selectedTotalCurrency, currencies]);

  useEffect(() => {
    const fetchClaim = async () => {
      try {
        const res = await axios.get(`${Base_URL}/claims/${id}`);
        const claimData = res.data.data;
        setClaim(claimData);
      } catch (error) {
        console.error("Error fetching claim data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClaim();
  }, [id]);

  const getUniqueCurrencies = () => {
    if (!claim?.items) return [];
    const currencies = claim.items
      .map((item) => item.currency?.symbol)
      .filter((currency) => currency);
    return [...new Set(currencies)];
  };

  const getAllDocuments = () => {
    if (!claim?.items) return [];
    return claim.items
      .map((item, index) => {
        const sd = item.supportingDocuments;
        if (!sd || typeof sd !== "object") return null;
        const fileId = sd.fileId || sd.file_id || sd._id;
        if (fileId == null || fileId === "") return null;
        return {
          ...sd,
          fileId,
          itemIndex: index,
        };
      })
      .filter(Boolean);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--p-blue)] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading claim details...</p>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Claim not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <button
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 text-base transition-colors"
          onClick={() => history.push("/claim-management")}
        >
          <ArrowLeft className="mr-2 w-5 h-5" />
          Back to Claims
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Claim Details
          </h1>
          <p className="text-gray-600">Reference: {claim.claimReference}</p>
        </div>

        {/* Main Claim Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 flex items-center">
            <Building className="w-5 h-5 mr-2 text-[var(--p-blue)]" />
            Claim Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-gray-400" />
                <p className="text-gray-500 text-sm">Employee Name</p>
              </div>
              <p className="font-medium text-gray-900">
                {claim.employee?.displayName}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-gray-500 text-sm">Employee Code</p>
              <p className="font-medium text-gray-900">{claim.employeeCode}</p>
            </div>

            {!isSingleBusiness && (
              <div className="space-y-1">
                <p className="text-gray-500 text-sm">Company</p>
                <p className="font-medium text-gray-900">{claim.company?.name}</p>
              </div>
            )}

            {claim.claimGroup && (
              <div className="space-y-1">
                <p className="text-gray-500 text-sm">Claim Group</p>
                <p className="font-medium text-gray-900">
                  {claim.claimGroup?.name}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-gray-500 text-sm">Status</p>
              <span
                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                  claim.status
                )}`}
              >
                {claim.status}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-gray-500 text-sm">Total Items</p>
              <p className="font-medium text-gray-900">
                {claim.items?.length || 0}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-gray-500 text-sm">Currencies</p>
              <div className="flex flex-wrap gap-1">
                {getUniqueCurrencies().map((currency, index) => (
                  <span
                    key={index}
                    className="bg-[var(--p-blue)] text-white px-2 py-1 rounded-md text-xs font-medium"
                  >
                    {currency}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-gray-500 text-sm">Created Date</p>
              <p className="font-medium text-gray-900">
                {claim.createdAt ? formatDate(claim.createdAt) : "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Claim Items */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">
            Claim Items
          </h2>
          {claim.items && claim.items.length > 0 ? (
            <div className="space-y-6">
              {claim.items.map((item, index) => (
                <ItemCard
                  key={index}
                  item={item}
                  index={index}
                  conversionData={conversionSummary}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
              <p className="text-gray-500 text-lg">No claim items found.</p>
            </div>
          )}
        </div>

        {/* Professional Total Claimable Amount Section */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Total Claimable Amount
            </h2>
            <p className="text-sm text-gray-600">
              View the total claimable amount converted to your selected
              currency
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Currency Selection */}
            <div className="lg:col-span-1">
              {/* <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Currency
                </label> */}
              <CurrencyDropdown
                businessId={claim.company?._id}
                value={selectedTotalCurrency}
                onChange={(currencyData) =>
                  setSelectedTotalCurrency(currencyData.value)
                }
                placeholder="Select Currency"
                isDisabled={!claim.company?._id}
                shouldShowError={false}
                error=""
                showConversionRate={true}
              />
              {/* Information Note */}
              <div className="mt-4 p-4 min-h-[144px] bg-[var(--p-blue)]/5 border border-[var(--p-blue)]/20 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-[var(--p-blue)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700">
                      <strong>Note:</strong> This is a read-only section for
                      viewing the total claimable amount in different
                      currencies. This information is for display purposes only
                      and does not modify the original claim data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversion Summary */}
            <div className="lg:col-span-2">
              {isCalculatingConversion ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--p-blue)]"></div>
                  <span className="ml-3 text-gray-600">
                    Calculating conversion...
                  </span>
                </div>
              ) : conversionSummary ? (
                <div className="space-y-4">
                  {/* Total Amount */}
                  <div className="bg-gray-50 rounded-lg px-4 py-1 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Total Amount
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {conversionSummary.totalConvertedAmount?.toFixed(2) ||
                          "0.00"}{" "}
                        {currencies.find((c) => c._id === selectedTotalCurrency)
                          ?.symbol || selectedTotalCurrency}
                      </span>
                    </div>
                  </div>

                  {/* Conversion Breakdown */}
                  <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Conversion Breakdown
                    </h4>
                    <div className="space-y-3">
                      {conversionSummary.conversions?.map(
                        (conversion, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-sm px-4 py-1 bg-white rounded border border-gray-100"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-700">
                                {conversion.from}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium text-gray-700">
                                {conversion.to}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900">
                                {conversion.originalAmount?.toFixed(2)} →{" "}
                                {conversion.convertedAmount?.toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Rate: {conversion.rate?.toFixed(4)}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedTotalCurrency ? (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-center text-gray-500">
                    <div className="text-2xl font-bold text-gray-400 mb-2">
                      0.00
                    </div>
                    <div className="text-sm">
                      No claimable amounts to convert
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <div className="text-center text-gray-500">
                    <div className="text-sm">
                      Select a currency to view conversion
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">
            Supporting Documents
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(() => {
              const documents = getAllDocuments();
              if (documents.length === 0) {
                return (
                  <div className="col-span-full bg-white rounded-xl p-12 text-center border border-gray-100">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">
                      No supporting documents uploaded.
                    </p>
                  </div>
                );
              }
              return documents.map((doc, index) => (
                <DocumentCard
                  key={`${doc.itemIndex}-${index}`}
                  doc={doc}
                  itemIndex={doc.itemIndex}
                />
              ));
            })()}
          </div>
        </div>

        {/* Approval History */}
        {claim.approvals && claim.approvals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">
              Approval History
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {claim.approvals.map((approval, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {approval.role}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              approval.status
                            )}`}
                          >
                            {approval.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {approval.date ? formatDate(approval.date) : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {approval.remarks || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimDetails;
