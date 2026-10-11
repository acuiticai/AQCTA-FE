import React, { useEffect, useState, useContext, useMemo, useRef } from "react"
import axios from "axios"
import { useHistory } from "react-router-dom"
import { DataTable } from "@/page-layouts/index"
import { AdminContext } from "@/context/AdminContext"
import { formatAmount } from "@/components/formatAmount"
import eyeIcon from "@/assets/img/icons/eye.png"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

// Helper functions (copy from ClaimsDashboard or import if available)
const calculateTotalClaimableAmount = (items) => {
  if (!items || !Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + (item.claimableAmount || 0), 0)
}
const getUniqueCurrencies = (items) => {
  if (!items || !Array.isArray(items)) return []
  const currencies = items.map((item) => item.currency?.name || item.currency?.code || item.currency)
  return [...new Set(currencies.filter(Boolean))]
}
const getCurrencyWiseTotals = (items) => {
  if (!items || !Array.isArray(items)) return {}
  return items.reduce((acc, item) => {
    const currency = item.currency?.name || item.currency?.code || item.currency
    if (!currency) return acc
    acc[currency] = (acc[currency] || 0) + (item.claimableAmount || 0)
    return acc
  }, {})
}

const getAllSupportingDocuments = (items) => {
  if (!items || !Array.isArray(items)) return []
  return items.map((item) => item.supportingDocuments).filter((doc) => doc)
}

const OpenClaims = ({ filters = {}, company = "" }) => {
  const history = useHistory()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { state } = useContext(AdminContext)
  const { adminInfo } = state

  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters])
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!adminInfo?.token) return

    const myId = ++requestIdRef.current
    const ac = new AbortController()

    const run = async () => {
      try {
        setLoading(true)
        let filterValues = {}
        try {
          filterValues = JSON.parse(filtersKey)
        } catch {
          filterValues = {}
        }
        const params = { ...filterValues, page: currentPage, limit }
        if (company) params.company = company
        if (filterValues.startDate) params.startDate = filterValues.startDate
        if (filterValues.endDate) params.endDate = filterValues.endDate

        const res = await axios.get(`${Base_URL}/claims/open-claims`, {
          params,
          signal: ac.signal,
          headers: {
            Authorization: `Bearer ${adminInfo.token}`,
          },
        })
        if (myId !== requestIdRef.current) return

        setClaims(res.data?.data || res.data.data || [])
        setTotalPages(res.data?.totalPages || 1)
        // Avoid syncing page/limit from API + DataTable bootstrap loop (see Leaves.jsx).
      } catch (error) {
        if (axios.isCancel?.(error) || error?.name === "CanceledError") return
        console.error("Error fetching open claims", error)
      } finally {
        if (myId === requestIdRef.current) setLoading(false)
      }
    }

    run()
    return () => ac.abort()
  }, [adminInfo?.token, filtersKey, company, currentPage, limit])

  // Table columns: Emp Name, Emp Code, Items Count, Claim Amount, Currencies, Company, Status, Documents, Action
  const ClaimAmountCell = ({ items }) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return <span className="text-gray-500">-</span>
    }
    const currencies = getUniqueCurrencies(items)
    if (currencies.length <= 1) {
      const total = calculateTotalClaimableAmount(items)
      return <span className="font-medium">{formatAmount(total)}</span>
    }
    const currencyTotals = getCurrencyWiseTotals(items)
    return (
      <div className="space-y-1">
        {Object.entries(currencyTotals).map(([currency, amount], index) => (
          <div key={currency} className="text-xs">
            <span className="font-medium">{formatAmount(amount)}</span>
            <span className="text-gray-500 ml-1">{currency}</span>
          </div>
        ))}
      </div>
    )
  }

  const HandleOpenFile = async (documentId) => {
    try {
      const res = await axios.get(`${Base_URL}/documents/getFileWithAllData/${documentId}`)
      window.open(res.data.data.url, "_blank")
    } catch (error) {
      console.error("Error getting file", error)
    }
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">Open Claims</h3>
      <div className="mb-6 bg-[#F9F9FA] rounded-xl">
        <div className="overflow-x-auto">
          <DataTable
            headers={[
              "Emp Name",
              "Emp Code",
              "Items Count",
              "Claim Amount",
              "Currencies",
              "Company",
              "Status",
              "Documents",
              "Action",
            ]}
            noPadding={true}
            containerClassName="p-0"
            data={claims}
            loading={loading}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            recordsPerPage={limit}
            onRecordsPerPageChange={setLimit}
            renderRow={(claim) => (
              <tr key={claim._id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{claim.employee?.displayName || claim.employeeName || "-"}</td>
                <td className="py-3 px-4">{claim.employeeCode}</td>
                <td className="py-3 px-4">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {claim.items?.length || 0} items
                  </span>
                </td>
                <td className="py-3 px-4">
                  <ClaimAmountCell items={claim.items} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {getUniqueCurrencies(claim.items).map((currency, index) => (
                      <span key={index} className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">
                        {currency}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">{claim.company?.name}</td>
                <td className="py-3 px-4">
                <div className="flex flex-col items-center gap-2">
                    {claim.status === "Pending" && claim.hasActed ? (
                    <span>{claim.nextActionMessage}</span>
                  ) : (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${claim.status === "Approved"
                          ? "bg-green-100 text-green-800"
                          : claim.status === "Rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                    >
                      {claim.status}
                    </span>
                  )}
                    {claim.status === "Approved" && <div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${claim.isExpenseCreated? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{claim.isExpenseCreated? "Expense Created" : "Expense Not Created"}</span>
                    </div>}
                
                  
                  </div>
                </td>
                <td className="py-3 px-4">
                  {(() => {
                    const documents = getAllSupportingDocuments(claim.items)
                    if (documents.length === 0) return "-"
                    if (documents.length === 1) {
                      return (
                        <button
                          onClick={() => HandleOpenFile(documents[0].fileId)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {documents[0].name}
                        </button>
                      )
                    }
                    return (
                      <div className="flex flex-col gap-1">
                        {documents.slice(0, 2).map((doc, index) => (
                          <button
                            key={index}
                            onClick={() => HandleOpenFile(doc.fileId)}
                            className="text-blue-600 hover:underline text-xs text-left"
                          >
                            {doc.name}
                          </button>
                        ))}
                        {documents.length > 2 && (
                          <span className="text-xs text-gray-500">+{documents.length - 2} more</span>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2" style={{ width: "fit-content" }}>
                    <img
                      src={eyeIcon || "/placeholder.svg"}
                      onClick={() => history.push(`/claim-details/${claim._id}`)}
                      className="w-6 h-6 cursor-pointer mx-auto"
                    />
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  )
}

export default OpenClaims 