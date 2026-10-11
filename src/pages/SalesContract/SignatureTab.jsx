import { useState, useRef, useEffect, useContext } from "react"
import SignaturePad from "react-signature-canvas"
import { Upload } from "lucide-react"
import axios from "axios"
import { notifyError, notifySuccess } from "@/utils/toast"
import request from "@/services/httpService";
import { AdminContext } from "@/context/AdminContext"
import { useTranslation } from "react-i18next"

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL
  ;

export default function ContractActionComponent({ contractId, onClose }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const { state } = useContext(AdminContext);
  const { adminInfo } = state
  // console.log("adminInfo", adminInfo.businesses)
  const [activeTab, setActiveTab] = useState("draw") // 'draw'f or 'upload'
  const [action, setAction] = useState(null) // null, 'approve', 'amendments', 'reject', 'confirmReject'
  const [profileData, setProfileData] = useState([])
  const signaturePad = useRef(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [signatureFileURL, setSignatureFileURL] = useState("")
  const [comment, setComment] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")

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

  const handleApprove = async () => {
    try {
      setLoading(true);

      let signatureUrl = null;

      if (signatureFileURL && activeTab === "upload") {
        // ✅ User uploaded a signature in current session
        signatureUrl = signatureFileURL;
      } else if (activeTab === "draw" && !signaturePad.current?.isEmpty()) {
        // ✅ User drew a signature
        const signatureFile = await convertSignatureToFile();
        signatureUrl = await uploadSignature(signatureFile);
      } else if (profileData?.signature) {
        // ✅ Fallback to saved admin signature from profile
        signatureUrl = profileData.signature;
      } else {
        notifyError("Please draw, upload, or have a saved signature to proceed.");
        setLoading(false);
        return;
      }

      await finishApproveProcess(signatureUrl);
    } catch (error) {
      console.error("Failed to save signature:", error);
      notifyError("Failed to save signature. Try again.");
      setLoading(false);
    }
  };

  const handleRequestAmendments = async () => {
    if (!comment.trim()) {
      notifyError("Please provide a comment explaining what amendments are needed and why.");
      return;
    }

    try {
      setLoading(true);
      await finishAmendmentsProcess();
    } catch (error) {
      console.error("Failed to request amendments:", error);
      notifyError("Failed to request amendments. Try again.");
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      notifyError("Please provide a reason for rejection.");
      return;
    }

    try {
      setLoading(true);
      await finishRejectProcess();
    } catch (error) {
      console.error("Failed to reject contract:", error);
      notifyError("Failed to reject contract. Try again.");
      setLoading(false);
    }
  };




  const finishApproveProcess = async (signatureUrl) => {
    try {
      const data = {
        action: 'approve',
        status: 'Preparing Contract',
        isApprovedByManagement: true,
        signature: signatureUrl,
        comment: comment || null
      };

      await request.put(`/sales-contracts/management-action/${contractId}`, data);
      notifySuccess("Sales Contract Approved, Notified Accounts!", () => {
        window.location.reload();
      });
      onClose()
    } catch (error) {
      notifyError("Error approving contract");
      console.log("Error : ", error);
      setLoading(false);
    }
  };

  const finishAmendmentsProcess = async () => {
    try {
      const data = {
        action: 'amendments',
        status: 'Amendments Requested (Management)',
        comment: comment
      };

      await request.put(`/sales-contracts/management-action/${contractId}`, data);
      notifySuccess("Amendments Requested, Notified Sales Team!", () => {
        window.location.reload();
      });
      onClose()
    } catch (error) {
      notifyError("Error requesting amendments");
      console.log("Error : ", error);
      setLoading(false);
    }
  };

  const finishRejectProcess = async () => {
    try {
      const data = {
        action: 'reject',
        status: 'Rejected (Management)',
        rejectionReason: rejectionReason
      };

      await request.put(`/sales-contracts/management-action/${contractId}`, data);
      notifySuccess("Contract Rejected, Notified Sales Team!", () => {
        window.location.reload();
      });
      onClose()
    } catch (error) {
      notifyError("Error rejecting contract");
      console.log("Error : ", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData()
  }, [])
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

  // const fetchProfileData = async () => {
  //   try {
  //     setLoading(true)
  //     const response = await axios.get(`${Base_URL}/admin/profile/${adminInfo.id}`)
  //     setProfileData(response.data)
  //   } catch (error) {
  //     console.error("Failed to fetch profile:", error)
  //   } finally {
  //     setLoading(false)
  //   }
  // }
  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${Base_URL}/admin/profile/${adminInfo.id}`);
      setProfileData(response.data);

      if (response.data.signature) {
        setSignatureFileURL(response.data.signature); // Append Image_URL
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (signatureFileURL && signaturePad.current) {
      signaturePad.current.fromDataURL(signatureFileURL); // Load signature with full URL
    }
  }, [signatureFileURL]);


  // Initial action selection screen
  if (!action) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t("salesContract.actions.contractAction", { defaultValue: "Contract Action" })}
          </h3>
          <p className="text-gray-700 mb-6">
            {t("salesContract.actions.choosePrompt", {
              defaultValue: "What action would you like to take for this contract?",
            })}
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("salesContract.actions.selectRequired", { defaultValue: "Select Action *" })}
            </label>
            <select
              value={action || ''}
              onChange={(e) => setAction(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t("salesContract.actions.chooseAction", { defaultValue: "Choose an action..." })}</option>
              <option value="approve">✓ {t("salesContract.actions.approveContract", { defaultValue: "Approve Contract" })}</option>
              <option value="amendments">✏️ {t("salesContract.actions.requestAmendments", { defaultValue: "Request Amendments" })}</option>
              <option value="reject">✗ {t("salesContract.actions.rejectContract", { defaultValue: "Reject Contract" })}</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Rejection confirmation popup
  if (action === 'reject') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t("salesContract.actions.rejectContract", { defaultValue: "Reject Contract" })}
          </h3>
          <p className="text-gray-700 mb-4">
            {t("salesContract.actions.rejectDescription", {
              defaultValue: "Please provide a reason for rejecting this contract. This action cannot be undone.",
            })}
          </p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("salesContract.actions.rejectionReasonRequired", { defaultValue: "Reason for Rejection *" })}
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              rows={4}
              placeholder={t("salesContract.actions.rejectionPlaceholder", {
                defaultValue: "Please explain why this contract is being rejected...",
              })}
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setAction(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              onClick={handleReject}
              disabled={loading || !rejectionReason.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading
                ? t("salesContract.actions.rejecting", { defaultValue: "Rejecting..." })
                : t("salesContract.actions.rejectContract", { defaultValue: "Reject Contract" })}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Amendments request popup
  if (action === 'amendments') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t("salesContract.actions.requestAmendments", { defaultValue: "Request Amendments" })}
          </h3>
          <p className="text-gray-700 mb-4">
            {t("salesContract.actions.amendmentsDescription", {
              defaultValue: "Please provide details about what amendments are needed and why.",
            })}
          </p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("salesContract.actions.amendmentDetailsRequired", { defaultValue: "Amendment Details *" })}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              rows={4}
              placeholder={t("salesContract.actions.amendmentsPlaceholder", {
                defaultValue: "Please explain what amendments are needed and why...",
              })}
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setAction(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              onClick={handleRequestAmendments}
              disabled={loading || !comment.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {loading
                ? t("salesContract.actions.requesting", { defaultValue: "Requesting..." })
                : t("salesContract.actions.requestAmendments", { defaultValue: "Request Amendments" })}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Approve action with signature options
  if (action === 'approve') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t("salesContract.actions.approveContract", { defaultValue: "Approve Contract" })}
          </h3>

          <div className="mb-4">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("draw")}
                className={`py-2 px-4 font-medium text-sm ${activeTab === "draw"
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t("documents.drawSignature", { defaultValue: "Draw Signature" })}
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`py-2 px-4 font-medium text-sm ${activeTab === "upload"
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t("documents.uploadSignature", { defaultValue: "Upload Signature" })}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {activeTab === "draw" && (
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  {t("documents.drawSignature", { defaultValue: "Draw Signature" })}
                </label>
                <div className="rounded-md bg-gray-50 p-4">
                  <SignaturePad
                    ref={signaturePad}

                    canvasProps={{
                      className: "w-full h-48 bg-white rounded-md border border-gray-300",
                    }}
                  />
                  {signatureFileURL && (
                    <img src={signatureFileURL}
                      alt={t("documents.savedSignature", { defaultValue: "Saved Signature" })}
                      className="max-h-24 mt-2 border rounded-md p-1 bg-white" />
                  )}
                </div>
              </div>
            )}


            {activeTab === "upload" && (
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  {t("documents.uploadSignature", { defaultValue: "Upload Signature" })}
                </label>
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
                      <span className="text-sm text-gray-500">
                        {t("documents.chooseFile", { defaultValue: "Choose File" })}
                      </span>
                    </label>
                    {signatureFile && <div className="mt-2 text-sm text-gray-500">{signatureFile.name}</div>}
                    {signatureFileURL && (
                      <div className="mt-2">
                        <img
                          src={signatureFileURL}
                          alt={t("documents.savedSignature", { defaultValue: "Saved Signature" })}
                          className="max-h-24 mt-2 border rounded-md p-1 bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("salesContract.actions.optionalComment", { defaultValue: "Optional Comment" })}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder={t("salesContract.actions.optionalCommentPlaceholder", {
                  defaultValue: "Add any additional comments (optional)...",
                })}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {t("common.back", { defaultValue: "Back" })}
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {t("common.clear", { defaultValue: "Clear" })}
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading
                  ? t("salesContract.actions.approving", { defaultValue: "Approving..." })
                  : t("salesContract.actions.approveContract", { defaultValue: "Approve Contract" })}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}