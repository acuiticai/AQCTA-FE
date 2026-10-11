"use client"

import { useEffect, useState, useCallback } from "react"
import { Box, CircularProgress, Typography } from "@mui/material"
import axios from "axios"
import { formatAmount, formatDate } from "@/components/formatAmount"
import moment from "moment"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

export default function PurchaseDocumentPreviewEmbed({ templateId, contractId, adminInfo, business_id, onReady }) {
  const [isLoading, setIsLoading] = useState(true)
  const [renderedHtml, setRenderedHtml] = useState("")

  useEffect(() => {
    const load = async () => {
      if (!templateId || !contractId) return
      setIsLoading(true)
      try {
        const contractResponse = await axios.get(`${Base_URL}/purchase-contracts/${contractId}`)
        const businessDataRes = await axios.get(`${Base_URL}/business/${business_id}`)
        const templateResponse = await axios.get(`${Base_URL}/document-templates/${templateId.split(":")[0]}`)

        const contract = contractResponse.data
        const business = businessDataRes?.data?.data
        const logo = business?.image

        const fullContract = { ...contract }
        fullContract.sellerName = fullContract?.basicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName
        fullContract.businessLogo = logo
        fullContract.businessName = business?.name || ""
        fullContract.supplierSign = contract?.approver_signature
        fullContract.BuyerSign = fullContract?.signature || ""

        const html = renderTemplateWithContractData(
          templateResponse?.data?.data?.htmlContent,
          fullContract,
          business,
          logo
        )
        setRenderedHtml(html)
        onReady && onReady()
      } catch (e) {
        console.error("Preview load error", e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [templateId, contractId, adminInfo, business_id])

  const renderTemplateWithContractData = useCallback((templateContent, contractData, Business, businessLogo) => {
    if (!templateContent || !contractData) return ""

    const businessName = contractData?.businessName || ""

    const data = {
      contract: {
        ref: contractData.contractNo || "",
        date: formatDate(contractData.createdAt) || "",
        buyerName: businessName || "",
        sellerAddress: contractData?.sellerAddress,
        buyerAddress2: contractData.basicInfo?.customerAddress?.split("\n").slice(1).join(", ") || "",
        grade: contractData.productInfo?.[0]?.title + " " + contractData.productInfo?.[0]?.grade || "",
        quantity: contractData.productInfo?.[0]?.quantityMTS * contractData.productInfo?.[0]?.quantityFCL +
          "MT (At " + contractData.productInfo?.[0]?.quantityMTS + "MTS x " + contractData.productInfo?.[0]?.containerType + " of " + contractData.productInfo?.[0]?.quantityFCL + " FCL)" || "",
        price: formatAmount(contractData.productInfo?.[0]?.price) || "",
        totalValue: formatAmount(contractData.productInfo?.[0]?.totalValue) || "",
        shippingTerms: contractData.productInfo?.[0]?.shippingTerms || "",
        packing: contractData.productInfo?.[0]?.packing || "",
        etdPort: contractData.basicInfo?.etdPort || "",
        ETD_Port: moment(contractData.basicInfo?.ETD_Port).format("MMM YYYY") || "",
        origin_country: contractData.basicInfo?.origin_country || "",
        port_of_loading: contractData.basicInfo?.port_of_loading || "",
        port_of_discharge: contractData.basicInfo?.port_of_discharge || "",
        payment: contractData.productInfo?.[0]?.paymentTerms || "",
        terms: contractData.productInfo?.[0]?.shippingTerms || "",
        remarks: contractData.productInfo?.[0]?.remarks || "",
        sellerName: contractData?.basicInfo?.selectedVendorId?.basicInformation?.vendorDisplayName,
        supplierContractNo: contractData?.basicInfo?.supplierContractNo || "",
        supplierContractDate: contractData?.basicInfo?.supplierContractDate ? formatDate(new Date(contractData.basicInfo.supplierContractDate)) : "",
        business: {
          address: Business?.address || "",
          tel: Business?.tel || "",
          phone: Business?.phone || "",
          email: Business?.email || "",
          image: businessLogo || "",
          name: Business?.name || "",
        },
      },
    }

    let htmlWithImages = templateContent
    const imageFields = ["buyerSign", "supplierSign", "Signed_Seller", "Signed_Buyer"]
    imageFields.forEach((field) => {
      const regex = new RegExp(`\\$\\{images\\.${field}\\}`, "g")
      htmlWithImages = htmlWithImages.replace(regex, data.contract[field] || "")
    })

    return htmlWithImages
      .replace(/\$\{contract\.ref\}/g, data.contract.ref)
      .replace(/\$\{contract\.date\}/g, data.contract.date)
      .replace(/\$\{contract\.buyerName\}/g, data.contract.buyerName)
      .replace(/\$\{contract\.sellerName\}/g, data.contract.sellerName || "")
      .replace(/\$\{contract\.grade\}/g, data.contract.grade || "")
      .replace(/\$\{contract\.quantity\}/g, data.contract.quantity || "")
      .replace(/\$\{contract\.price\}/g, data.contract.price || "")
      .replace(/\$\{contract\.totalValue\}/g, data.contract.totalValue || "")
      .replace(/\$\{contract\.shippingTerms\}/g, data.contract.shippingTerms || "")
      .replace(/\$\{contract\.packing\}/g, data.contract.packing || "")
      .replace(/\$\{contract\.etdPort\}/g, data.contract.etdPort || "")
      .replace(/\$\{contract\.ETD_Port\}/g, data.contract.ETD_Port || "")
      .replace(/\$\{contract\.origin_country\}/g, data.contract.origin_country || "")
      .replace(/\$\{contract\.port_of_loading\}/g, data.contract.port_of_loading || "")
      .replace(/\$\{contract\.port_of_discharge\}/g, data.contract.port_of_discharge || "")
      .replace(/\$\{contract\.payment\}/g, data.contract.payment || "")
      .replace(/\$\{contract\.terms\}/g, data.contract.terms || "")
      .replace(/\$\{contract\.remarks\}/g, data.contract.remarks || "")
      .replace(/\$\{Business\.address\}/g, data.contract.business.address || "")
      .replace(/\$\{Business\.tel\}/g, data.contract.business.tel || "")
      .replace(/\$\{Business\.phone\}/g, data.contract.business.phone || "")
      .replace(/\$\{Business\.email\}/g, data.contract.business.email || "")
      .replace(/\$\{Business\.image\}/g, data.contract.business.image || "")
      .replace(/\$\{Business\.name\}/g, data.contract.business.name || "")
  }, [])

  if (isLoading || !renderedHtml) {
    return (
      <Box className="flex justify-center items-center h-full flex-col">
        <CircularProgress />
        <Typography sx={{ ml: 2, mt: 2 }}>Generating document preview...</Typography>
      </Box>
    )
  }

  return (
    <iframe
      id="purchase-preview-iframe"
      srcDoc={renderedHtml}
      width="100%"
      height="100%"
      style={{ border: "none" }}
      title="Purchase Contract Preview"
    />
  )
}


