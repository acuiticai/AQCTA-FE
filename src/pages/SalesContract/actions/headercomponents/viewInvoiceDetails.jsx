"use client"

import { useState, useEffect, useContext } from "react"
import { Edit, Download, Printer, Clock, ArrowLeft } from "lucide-react"
import { useHistory, useLocation } from "react-router-dom"
import { AdminContext } from "@/context/AdminContext"
import axios from "axios"
import { formatAmount, formatDate } from "@/components/formatAmount"
import { MoreHorizontal } from "lucide-react";
import { notifySuccess, notifyError } from "@/utils/toast";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL
const statusOptions = ["paid", "pending", "void", "deleted"];

export default function InvoiceComponent() {
  const { t } = useTranslation()
  const { state } = useContext(AdminContext)
  const { adminInfo } = state
  const history = useHistory()
  const location = useLocation()
  const invoice = location.state
  const [pdfUrl, setPdfUrl] = useState(null)

  const [loading, setLoading] = useState(true)
  const [contractData, setContractData] = useState(null)
  const [customerData, setCustomerData] = useState(null)
  const [Business, setBusiness] = useState(null)
  const [error, setError] = useState(null)
  console.log("invoice", invoice)
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  }

  useEffect(() => {
    const fetchPdfUrl = async () => {
      try {
        const response = await axios.get(`${Base_URL}/proforma-invoice/print/${invoice._id}`, { headers });
        if (response.data?.data) {
          setPdfUrl(response.data.data);
        } else {
          notifyError("Failed to load PDF");
        }
      } catch (error) {
        console.error("Error loading PDF:", error)
        notifyError("Error loading PDF")
      } finally {
        setLoading(false)
      }
    }

    if (invoice?._id) {
      fetchPdfUrl()
    }
  }, [invoice])

  // Function to fetch contract data
  const fetchContractData = async () => {
    try {
      const response = await axios.get(`${Base_URL}/sales-contracts/${invoice.contract_id._id}`, { headers })
      setContractData(response.data)
    } catch (err) {
      console.log("Failed to fetch contract data:", err)
      setError("Failed to fetch contract data")
    }
  }

  // Function to fetch customer data
  const fetchCustomerData = async () => {
    try {
      const response = await axios.get(`${Base_URL}/customers/${invoice.customer_id._id}`, { headers })
      setCustomerData(response.data.data)
    } catch (err) {
      console.error("Failed to fetch customer data:", err)
      setError("Failed to fetch customer data")
    }
  }
  const handleStatusChange = async (newStatus) => {
    try {
      const response = await axios.patch(
        `${Base_URL}/proforma-invoice/update-status/${invoice._id}`,
        { status: newStatus },
        { headers }
      );
      if (response.data.status) {
        notifySuccess("Status updated to " + newStatus, () => {
          // history.push("/sales");
          window.location.reload();
        });
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };


  // Function to fetch customer data
  const fetchBusinessData = async () => {
    try {
      const response = await axios.get(`${Base_URL}/Business/${invoice.business_id._id}`, { headers })
      setBusiness(response.data.data)
    } catch (err) {
      console.error("Failed to fetch customer data:", err)
      setError("Failed to fetch business data")
    }
  }

  // Fetch all required data when component mounts
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchContractData(), fetchCustomerData(), fetchBusinessData()])
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Error fetching data")
      } finally {
        setLoading(false)
      }
    }

    if (invoice) {
      fetchAllData()
    }
  }, [invoice])

  // Function to convert number to words
  const numberToWords = (num) => {
    const ones = [
      "",
      "ONE",
      "TWO",
      "THREE",
      "FOUR",
      "FIVE",
      "SIX",
      "SEVEN",
      "EIGHT",
      "NINE",
      "TEN",
      "ELEVEN",
      "TWELVE",
      "THIRTEEN",
      "FOURTEEN",
      "FIFTEEN",
      "SIXTEEN",
      "SEVENTEEN",
      "EIGHTEEN",
      "NINETEEN",
    ]
    const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]

    const numString = num.toString()

    if (num < 20) return ones[num]

    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "")
    }

    if (num < 1000) {
      return ones[Math.floor(num / 100)] + " HUNDRED" + (num % 100 !== 0 ? " AND " + numberToWords(num % 100) : "")
    }

    if (num < 1000000) {
      return (
        numberToWords(Math.floor(num / 1000)) + " THOUSAND" + (num % 1000 !== 0 ? " " + numberToWords(num % 1000) : "")
      )
    }

    return (
      numberToWords(Math.floor(num / 1000000)) +
      " MILLION" +
      (num % 1000000 !== 0 ? " " + numberToWords(num % 1000000) : "")
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        {t("salesContract.invoice.loadingDetails", {
          defaultValue: "Loading invoice details...",
        })}
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>
  }

  if (!invoice) {
    return (
      <div className="p-4 text-center">
        {t("salesContract.invoice.noData", { defaultValue: "No invoice data found" })}
      </div>
    )
  }

  const handleSendEmail = async () => {
    setLoading(true)
    try {
      const payload = {
        invoice: invoice,
      }

      const response = await axios.post(`${Base_URL}/proforma-invoice/sendEmail`, payload, { headers })
      if (response.data) {
        history.push({
          pathname: "/view-sales-contract",
          state: { contractId: invoiceData.contract_id },
        })
      }
    } catch (error) {
      console.error("Error sending email:", error)
    } finally {
      setLoading(false)
    }
  }


  const handlePrintInvoice = async () => {
    if (invoice._id) {
      try {
        const response = await axios.get(`${Base_URL}/proforma-invoice/print/${invoice._id}`, { headers });
        const pdfUrl = response.data?.data;

        if (pdfUrl) {
          const printWindow = window.open(pdfUrl, "_blank");
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.focus();
              printWindow.print();
            };
          }
        }
      } catch (err) {
        console.log("Failed to load invoice for printing", err);
      }
    }
  };


  // Format the amount in words
  const amountInWords =
    numberToWords(Math.floor(invoice.grandTotal)) +
    " DOLLARS" +
    (invoice.grandTotal % 1 > 0 ? " AND " + numberToWords(Math.round((invoice.grandTotal % 1) * 100)) + " CENTS" : "")

  return (
    <div className="p-4">
      <div className="bg-gray-50">
        {/* Back Button */}
        <button className="mb-4 flex items-center text-gray-600 hover:text-gray-900" onClick={() => history.goBack()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span>{t("common.back", { defaultValue: "Back" })}</span>
        </button>

        {/* Invoice Header */}
        <div className="py-2 flex justify-between items-center mb-4">
          <h1 className="text-xl font-medium">
            {t("salesContract.invoice.invoiceType", { defaultValue: "Invoice Type" })}:{" "}
            {invoice.type || t("salesContract.invoice.proforma", { defaultValue: "Proforma" })}
          </h1>
          <div className="flex space-x-2">
            {/* <button className="p-2 bg-gray-100 rounded-md">
              <Edit className="h-5 w-5 text-gray-600" />
            </button> */}
            <button
              className="p-2 bg-gray-100 rounded-md"
              onClick={async () => {
                if (invoice._id) {
                  try {
                    let response = await axios.get(`${Base_URL}/proforma-invoice/download/${invoice._id}`, { headers });
                    if (response.data?.data) {
                      window.open(response.data.data, '_blank');
                    }
                  } catch (err) {
                    console.log("Failed to download invoice", err);
                  }
                }
              }}
            >
              <Download className="h-5 w-5 text-gray-600" />
            </button>
            <div onClick={handlePrintInvoice}
              style={{ cursor: 'pointer' }} className="flex items-center bg-gray-100 rounded-md px-3 py-1">
              <Printer className="h-4 w-4 text-gray-600 mr-1" />
              <span className="text-sm">
                {t("documents.pdfPrint", { defaultValue: "PDF/Print" })}
              </span>
            </div>
            {/* <div className="flex items-center bg-gray-100 rounded-md px-3 py-1">
              <Clock className="h-4 w-4 text-gray-600 mr-1" />
              <span className="text-sm">Reminders</span>
            </div> */}
            <button onClick={handleSendEmail}
              disabled={loading} className="bg-green-500 text-white px-4 py-1 rounded-md text-sm">
              {t("common.sendEmail", { defaultValue: "Send Email" })}
            </button>
            <div className="relative group">
              <button className="bg-gray-100 px-4 py-1 rounded-md text-sm">
                {t("common.more", { defaultValue: "More" })} ▼
              </button>
              <div className="absolute hidden group-hover:block right-0 mt-2 bg-white shadow-lg rounded-md z-10">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    {t(`salesContract.invoice.statuses.${status}`, {
                      defaultValue: status.charAt(0).toUpperCase() + status.slice(1),
                    })}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="mb-4 bg-blue-50 rounded-md p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">
                {t("salesContract.contractNo", { defaultValue: "Sales Contract No" })}
              </p>
              <p className="font-medium">{invoice.contract_no}</p>
              <p className="text-xs text-gray-500 mt-2">
                {t("common.amount", { defaultValue: "Amount" })}
              </p>
              <p className="font-medium">$ {formatAmount(invoice.grandTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {t("common.customerName", { defaultValue: "Customer Name" })}
              </p>
              <p className="font-medium">{invoice.customer_name}</p>
              <p className="text-xs text-gray-500 mt-2">
                {t("salesContract.invoice.billingAddress", { defaultValue: "Billing Address" })}
              </p>
              <p className="font-medium">
                {invoice.billingAddress || t("common.notAvailable", { defaultValue: "N/A" })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {t("salesContract.invoice.invoiceNumber", { defaultValue: "Invoice Number" })}
              </p>
              <p className="font-medium">{invoice.invoice_number}</p>
              <p className="text-xs text-gray-500 mt-2">
                {t("common.status", { defaultValue: "Status" })}
              </p>
              <p
                className={`font-medium ${invoice.status === "paid" ? "text-green-600" : invoice.status === "pending" ? "text-yellow-600" : "text-gray-600"}`}
              >
                {t(`salesContract.invoice.statuses.${invoice.status}`, {
                  defaultValue:
                    invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {t("salesContract.invoice.invoiceDate", { defaultValue: "Invoice Date" })}
              </p>
              <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {t("salesContract.invoice.dueDate", { defaultValue: "Due Date" })}
              </p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
          </div>
        </div>
        {loading ? (
          <p>{t("documents.loadingPdf", { defaultValue: "Loading PDF..." })}</p>
        ) : pdfUrl ? (
          <div style={{ overflow: 'hidden', padding: 0, margin: 0 }}>
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title={t("documents.invoicePdf", { defaultValue: "Invoice PDF" })}
              width="100%"
              height="1000px"
              style={{
                border: "none",
                margin: 0,
                frameBorder:"0",
                padding: 0,
                backgroundColor: "transparent",
                display: "block",
              }}
            />
          </div>
        ) : (
          <p className="text-red-500">
            {t("documents.noPdfAvailable", { defaultValue: "No PDF available." })}
          </p>
        )}


      </div>
    </div>
  )
}
