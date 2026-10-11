"use client"

import { useRef, useState, useEffect, useContext } from "react"
import {
  Box,
  Card,
  CardContent,
  Button,
  Paper,
  Slider,
  Stack,
  IconButton,
  Typography,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material"
import { useHistory } from "react-router-dom"
import { notifyError, notifySuccess } from "@/utils/toast"
import { Printer, ZoomIn, ZoomOut, Upload } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import DOMPurify from 'dompurify';
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext"
import TemplateHeader from "./sections/HeaderSection"
import DocumentContent from "./sections/DocumentContent"
import SignatureTab from "./SignatureAdminTab"
import DynamicTable from "@/pages/DocumentTemplate/components/templates-subcomponents/TableDynamic"
import PaymentAccountInfo, {
  ItemListDocumentSection,
} from "@/pages/DocumentTemplate/components/templates-subcomponents/PaymentSectionProforma"
import TermsAndConditions from "@/pages/DocumentTemplate/components/templates-subcomponents/TermsAndCondition"
import { shippingDetails, tableFooter, terms, remarks } from "@/pages/DocumentTemplate/data/data-index"
import axios from "axios"
import { useParams } from "react-router-dom/cjs/react-router-dom.min"
import SignaturePad from "react-signature-canvas"
import { AdminContext } from "@/context/AdminContext"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const MainEditor = () => {
  const componentRef = useRef()
  const [zoom, setZoom] = useState(100)
  const [isGenerating, setIsGenerating] = useState(false)
  const history = useHistory()
  const { state } = useContext(AdminContext);
  const { adminInfo } = state
  const [signatureFileURL, setSignatureFileURL] = useState("")

  const UPLOAD_API_URL = `${Base_URL}/documents/uploadDocument`
  const {
    documentType,
    requireTable,
    requireContent,
    tableValues,
    FooterText,
    FooterText2,
    signees,
    tableFields,
    contractDetails,
    selectedTemplateId,
  } = useDocumentConext()
  const { id: neededIds } = useParams()

  console.log("contractDetails", contractDetails)
  // const tableColumns = tableFields?.map((field) => field.name) || []
  const initialValues = [
    { id: 1, name: "title", type: "text", width: 20 },
    { id: 2, name: "quantityMTS", type: "number", width: 20 },
    { id: 4, name: "price", type: "currency", width: 30 },
    { id: 5, name: "totalValue", type: "currency", width: 20 },
  ];
  const My_Columns = [
    { id: 1, name: "ITEM", type: "text", width: 20 },
    { id: 2, name: "QTY (MT)", type: "number", width: 20 },
    { id: 3, name: "DESCRIPTION OF GOODS", type: "currency", width: 30 },
    { id: 4, name: "UNIT PRICE (USD/MT)", type: "currency", width: 30 },
    { id: 5, name: "Total (USD)", type: "currency", width: 20 },
  ];


  const tableColumns = initialValues?.map((field) => field.name) || [];
  const Columns = My_Columns?.map((field) => field.name) || [];

  // Corrected mapping:
  const htmlToText = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const tableData = contractDetails?.productInfo?.map((row) =>
    initialValues.map((field) => {
      const value = row[field.name];
      return field.name === "shippingTerms" ? (
        <div
          style={{
            fontSize: '12px',
            width: '200px',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {htmlToText(value)}
        </div>
      ) : (
        value
      );
    })
  ) || [];


  const [documents, setDocuments] = useState()
  const handleZoomChange = (event, newValue) => {
    setZoom(newValue)
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50))
  }






  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const originalZoom = zoom;
      setZoom(100); // Ensure proper scaling
      await new Promise((resolve) => setTimeout(resolve, 100));

      const element = componentRef.current;

      // Ensure entire document is captured
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY, // Capture content even if it's outside the viewport
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight, // Ensure the full height is captured
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > 297) {
        let y = 0;
        while (y < imgHeight) {
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, y * -1, imgWidth, imgHeight);
          y += 297;
          if (y < imgHeight) pdf.addPage();
        }
      } else {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgWidth, imgHeight);
      }

      let fileName = contractDetails?.contractNo || "document";
      // This is the main document generation, so use 'initial' suffix
      const fileNameWithSuffix = `${fileName}_initial`;
      if (!fileNameWithSuffix.toLowerCase().endsWith(".pdf")) {
        fileName = fileNameWithSuffix + ".pdf";
      } else {
        fileName = fileNameWithSuffix;
      }

      try {
        const pdfBlob = pdf.output("blob");
        const pdfFile = new File([pdfBlob], fileName, {
          type: "application/pdf",
          lastModified: new Date().getTime(),
        });

        const formData = new FormData();
        formData.append("file", pdfFile);
        formData.append("uploadedBy", adminInfo.id);
        formData.append("file_path", `Sales Contracts/${contractDetails.contractNo}`);
        formData.append("business_id", contractDetails.business);
        formData.append("file_type", "application/pdf");
        formData.append("file_size", pdfFile.size.toString());

        const response = await axios.post(UPLOAD_API_URL, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.message === "File uploaded successfully") {
          notifySuccess(response.data.message || "File uploaded successfully!");
          pdf.save(fileName);

          if (response.data.file.s3Key && contractDetails._id) {
            await axios.put(`${Base_URL}/sales-contracts/add-document-details/${contractDetails._id}`, {
              template_id: selectedTemplateId,
              document_url: response.data.file.s3Key,
              document_id: response.data.file._id,
              signature: signatureFileURL,
            });
          }
        }
      } catch (error) {
        console.error("File upload error:", error);
        notifyError("Contract Save Action Failed");
      } finally {
        setZoom(originalZoom);
        setIsGenerating(false);
        history.push("/sales");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      setIsGenerating(false);
    }
  };

  const RenderSignatureBlocks = () => (
    <div className="w-full px-4 sm:px-6 lg:px-8 mt-1 mb-1">
      <div className="grid grid-cols-2 gap-8 text-left">
        {signees.map((signee, index) => (
          <div key={index} className="flex flex-col items-start">
            <span className="text-sm text-gray-700">{signee.title}</span>
            {signee.name && <span className="text-sm font-bold text-gray-900">{signee.name}</span>}

            {contractDetails && signee.title.toLowerCase().includes('seller') ? (
              signatureFileURL ? (
                <img src={`${signatureFileURL}`}  alt="Signature" className="max-h-24" />
              ) : (
                <div className="h-20" />
              )
            ) : (
              <div className="h-20" />
            )}

            <div className="w-full border-t border-black my-2" />
            {signee.title.toLowerCase().includes('seller') ? (
              <span className="text-sm italic text-gray-700">Authorized Signatory</span>
            ) : (
              <span className="text-sm text-gray-700">(sign & stamp)</span>
            )}
          </div>
        ))}
      </div>

      {/* Ensure FooterText is part of the captured content */}

      {FooterText2 && (
        <div style={{ textAlign: 'left', fontSize: '0.7rem', color: '#B6B7B9', marginTop: '0.1rem' }}>
          <strong>{FooterText2}</strong>
        </div>
      )}

      {FooterText && (
        <div className="text-center text-sm text-gray-900 mt-1">
          <strong>{FooterText}</strong>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    fetchProfileData()
  }, [])
  const fetchProfileData = async () => {
    try {
      // setLoading(true);
      const response = await axios.get(`${Base_URL}/admin/profile/${adminInfo.id}`);
      // setProfileData(response.data);
      console.log("response", response)
      if (response.data.signature) {
        setSignatureFileURL(response.data.signature);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      // setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" className="py-4">
      <Box className="bg-slate-50 rounded-lg p-4 shadow-sm ">
        <Card className="mb-4 bg-white shadow-sm">
          <CardContent className="py-2">
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton onClick={handleZoomOut} className="hover:bg-slate-100" disabled={isGenerating} size="small">
                <ZoomOut className="w-4 h-4" />
              </IconButton>

              <Slider
                value={zoom}
                onChange={handleZoomChange}
                min={50}
                max={200}
                step={10}
                disabled={isGenerating}
                className="max-w-40"
                size="small"
                sx={{
                  "& .MuiSlider-thumb": { bgcolor: "#84cc16" },
                  "& .MuiSlider-track": { bgcolor: "#84cc16" },
                }}
              />

              <IconButton onClick={handleZoomIn} className="hover:bg-slate-100" disabled={isGenerating} size="small">
                <ZoomIn className="w-4 h-4" />
              </IconButton>

              <Typography className="min-w-10 text-slate-600 text-[10px]">{zoom}%</Typography>

              <Box sx={{ flexGrow: 1 }} />

              {contractDetails && (
                <>
                  <Button
                    onClick={generatePDF}
                    variant="contained"
                    disabled={isGenerating}
                    className="bg-lime-500 hover:bg-lime-600 shadow-lime-200 text-[10px] py-1"
                    size="small"
                    startIcon={<Printer className="w-3 h-3" />}
                  >
                    {isGenerating ? "Generating..." : "Generate & Save PDF"}
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Box className="bg-slate-200 rounded-lg p-4 overflow-auto min-h-[700px] flex justify-center">
          <div
            className="relative w-[24cm] h-[29.7cm]"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            <Paper elevation={3} className="absolute inset-0 bg-white shadow-lg overflow-hidden">
              <div ref={componentRef} className="p-4 text-[12px] leading-snug max-w-[95%] mx-auto">
                {documentType && (
                  <>
                    <TemplateHeader />
                    {requireTable && tableColumns.length > 0 && tableData.length > 0 && (
                      <div className="text-[12px] leading-tight">
                        <DynamicTable columns={Columns} tableData={tableData} {...tableFooter} />
                        <PaymentAccountInfo title="PLEASE MAKE THE PAYMENT TO BELOW ACCOUNT INFO" />
                      </div>
                    )}

                    {requireContent && (
                      <div className="text-[12px] leading-tight">
                        <DocumentContent />
                      </div>
                    )}

                    <div className="text-[12px] leading-tight">
                      <TermsAndConditions
                        terms={
                          contractDetails
                            ? [
                              <span
                                style={{ whiteSpace: "pre-wrap" }}
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(contractDetails?.productInfo?.[0]?.paymentTerms || "N/A"),
                                }}
                              />,
                              <span
                                style={{ whiteSpace: "pre-wrap" }}
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(contractDetails?.productInfo?.[0]?.shippingTerms || "N/A"),
                                }}
                              />,
                            ]
                            : terms
                        }
                      />
                      <TermsAndConditions sectionTitle="Remarks" terms={contractDetails?.basicInfo?.remarks} />
                    </div>

                    <div className="mx-4 mb-1 text-[12px] leading-tight">
                      <ItemListDocumentSection details={shippingDetails} />
                    </div>
                  </>
                )}
                <RenderSignatureBlocks />
              </div>
            </Paper>
          </div>
        </Box>
      </Box>

    </Container>
  )
}

export default MainEditor

