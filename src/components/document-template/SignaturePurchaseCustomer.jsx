import { useState, useRef, useEffect, useContext } from "react"
import SignaturePad from "react-signature-canvas"
import { Upload } from "lucide-react"
import axios from "axios"
import { notifyError, notifySuccess } from "@/utils/toast"
import request from "@/services/httpService";
import { AdminContext } from "@/context/AdminContext"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

export default function SignatureAdminTab({ contractId, onClose, onSignatureSave }) {
  const [loading, setLoading] = useState(false)
  const { state } = useContext(AdminContext);
  const { adminInfo } = state
  // console.log("adminInfo", adminInfo.businesses)
  const [activeTab, setActiveTab] = useState("draw") // 'draw'f or 'upload'
  const [action, setAction] = useState('accept') // null, 'accept', 'reject', 'confirmReject'
  const [profileData, setProfileData] = useState([])
  const signaturePad = useRef(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [signatureFileURL, setSignatureFileURL] = useState("")

  const handleClear = () => {
    if (activeTab === "draw") {
      signaturePad.current?.clear()
    } else {
      setSignatureFile(null)
      setSignatureFileURL("")
    }
  }

  const uploadSignature = async (file) => {
    const formData = new FormData()
    formData.append("image", file)

    try {
      const response = await axios.post(`${Base_URL}/upload`, formData)
      return response.data.url
    } catch (error) {
      console.error("Failed to upload signature:", error)
      notifyError("Failed to upload signature. Try again.")
      throw error
    }
  }
  const convertSignatureToFile = async () => {
    return new Promise((resolve) => {
      const canvas = signaturePad.current.getCanvas()
      canvas.toBlob((blob) => {
        const signatureFile = new File([blob], 'signature.png', { type: 'image/png' })
        resolve(signatureFile)
      }, 'image/png')
    })
  }

  console.log("profileData", profileData)

  const handleAccept = async () => {
    try {
      setLoading(true)

      let signatureUrl = null

      if (signatureFileURL) {
        // Use the already uploaded file URL
        signatureUrl = signatureFileURL
      } else if (!signaturePad.current?.isEmpty()) {
        // Convert signature pad to blob and upload
        const signatureFile = await convertSignatureToFile()
        signatureUrl = await uploadSignature(signatureFile)

      } else {
        notifyError("Please Upload or Draw Signature")
        setLoading(false)
        return
      }

      // For file upload or if draw path immediately resolves  
      if (signatureUrl) {
        await finishSaveProcess(signatureUrl)
        onSignatureSave(signatureUrl); 
      }
    } catch (error) {
      console.error("Failed to save signature:", error)
      notifyError("Failed to save signature. Try again.")
      setLoading(false)
    }
  }



  const finishSaveProcess = async (signatureUrl) => {
    try {
      const data = {
        signature: signatureUrl
      };

      await request.put(`/purchase-contracts/Accept_by_customer/${contractId}`, data);
      // Removed the success notification here - will be shown after PDF generation instead
      onClose()
    } catch (error) {
      notifyError(
        _id
          ? "Error updating contract"
          : "Error saving Purchase Contract Basic Info"
      );
      console.log("Error : ", error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setSignatureFile(file)
    const formData = new FormData()
    formData.append("image", file)

    setLoading(true)
    try {
      let response = await axios.post(`${Base_URL}/upload`, formData)
      console.log("file response ", response);
      setSignatureFileURL(response.data.url)
      // Show success message
    } catch (error) {
      console.error("Failed to upload signature:", error)
      // Show error message
    } finally {
      setLoading(false)
    }
  }

 

  useEffect(() => {
    if (signatureFileURL && signaturePad.current) {
      signaturePad.current.fromDataURL(signatureFileURL); // Load signature with full URL
    }
  }, [signatureFileURL]);

  // Accept action with signature options
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Accept Contract</h3>

        <div className="mb-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("draw")}
              className={`py-2 px-4 font-medium text-sm ${activeTab === "draw"
                ? "border-b-2 border-green-500 text-green-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Draw Signature
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`py-2 px-4 font-medium text-sm ${activeTab === "upload"
                ? "border-b-2 border-green-500 text-green-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Upload Signature
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {activeTab === "draw" && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">Draw Signature</label>
              <div className="rounded-md bg-gray-50 p-4">
                <SignaturePad
                  ref={signaturePad}
                  
                  canvasProps={{
                    className: "w-full h-48 bg-white rounded-md border border-gray-300",
                  }}
                />
                {signatureFileURL && (
                  <img src={signatureFileURL}
                    
                    alt="Saved Signature"
                    className="max-h-24 mt-2 border rounded-md p-1 bg-white" />
                )}
              </div>
            </div>
          )}


          {activeTab === "upload" && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">Upload Signature</label>
              <div className="border border-dashed border-gray-300 rounded-md p-4">
                <div className="flex flex-col items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="signature-upload"
                  />
                  <label htmlFor="signature-upload" className="flex flex-col items-center cursor-pointer">
                    <Upload className="w-6 h-6 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Choose File</span>
                  </label>
                  {signatureFile && <div className="mt-2 text-sm text-gray-500">{signatureFile.name}</div>}
                  {signatureFileURL && (
                    <div className="mt-2">
                      <img
                        src={signatureFileURL}
                        
                        alt="Saved Signature"
                        className="max-h-24 mt-2 border rounded-md p-1 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              onClick={() => onClose()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Back
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Clear
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? "Accepting..." : "Accept Contract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}