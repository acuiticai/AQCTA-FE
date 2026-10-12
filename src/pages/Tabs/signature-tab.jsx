import { useRef, useState, useEffect } from "react";
import SignaturePad from "react-signature-canvas";
import { Upload } from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function SignatureTab({ profileData }) {
  const toAbsoluteUrl = (value) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    const base = (Base_URL || "").replace(/\/$/, "");
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
  };

  const signaturePad = useRef(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signatureFileURL, setSignatureFileURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentSignature, setCurrentSignature] = useState(
    toAbsoluteUrl(profileData?.signature)
  );
  const [imageLoadError, setImageLoadError] = useState(false);

  // Update currentSignature when profileData changes
  useEffect(() => {
    if (profileData?.signature) {
      setCurrentSignature(toAbsoluteUrl(profileData.signature));
      setImageLoadError(false);
    }
  }, [profileData]);

  const handleClear = () => {
    signaturePad.current?.clear();
  };

  const handleSave = async () => {
    if (signatureFileURL) {
      setLoading(true);
      try {
        const response = await axios.put(`${Base_URL}/admin/signature/${profileData.id}`, {
          signature: signatureFileURL
        });

        // Update current signature with the new one
        setCurrentSignature(toAbsoluteUrl(response?.data?.signature || signatureFileURL));
        setImageLoadError(false);
        notifySuccess("Signature saved successfully!");
        setIsEditing(false);
      } catch (error) {
        console.error("Failed to save signature:", error);
        notifyError("Failed to save signature. Try again.");
      } finally {
        setLoading(false);
      }
    } else if (!signaturePad.current?.isEmpty()) {
      const canvas = signaturePad.current.getCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          notifyError("Failed to process signature. Try again.");
          return;
        }

        const formData = new FormData();
        formData.append("image", blob, "signature.png");

        setLoading(true);
        try {
          // Log the request before sending
          console.log("Uploading signature image with FormData");

          // Modify axios request to include proper headers for multipart/form-data
          let uploadResponse = await axios.post(`${Base_URL}/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          console.log("Upload response:", uploadResponse.data);

          if (!uploadResponse.data.url) {
            throw new Error("Upload response missing URL");
          }

          const imageUrl = toAbsoluteUrl(uploadResponse?.data?.url);
          setSignatureFileURL(imageUrl);

          // Save the signature URL to the user profile
          const saveResponse = await axios.put(`${Base_URL}/admin/signature/${profileData.id}`, {
            signature: imageUrl
          });

          // Update current signature with the new one
          setCurrentSignature(toAbsoluteUrl(saveResponse?.data?.signature || imageUrl));
          setImageLoadError(false);
          notifySuccess("Signature saved successfully!");
          setIsEditing(false);

        } catch (error) {
          console.error("Failed to upload signature:", error);
          console.error("Error details:", error.response?.data || error.message);
          notifyError("Failed to upload signature. Try again.");
        } finally {
          setLoading(false);
        }
      }, 'image/png');
    } else {
      notifyError("Please Upload or Draw Signature");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      notifyError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      notifyError("File size exceeds 5MB limit");
      return;
    }

    setSignatureFile(file);
    const formData = new FormData();
    formData.append("image", file);

    setLoading(true);
    try {
      console.log("Uploading file:", file.name);

      // Modify axios request to include proper headers for multipart/form-data
      let response = await axios.post(`${Base_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log("Upload response:", response.data);

      if (response.data.url) {
        setSignatureFileURL(toAbsoluteUrl(response.data.url));
      } else {
        throw new Error("Upload response missing URL");
      }
    } catch (error) {
      console.error("Failed to upload signature:", error);
      console.error("Error details:", error.response?.data || error.message);
      notifyError("Failed to upload signature. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="ep-title">Digital Signature</h3>

      {!isEditing && currentSignature && (
        <div className="space-y-4">
          <div className="ep-surface">
            <img
              src={`${currentSignature}`}
              alt="Signature"
              onError={() => {
                setImageLoadError(true);
                notifyError("Signature image failed to load. Please re-upload.");
              }}
              className="max-h-48 mx-auto"
            />
          </div>
          {imageLoadError && (
            <a
              href={currentSignature}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
              style={{ color: "#fe3a55" }}
            >
              Open signature in new tab
            </a>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="ep-btn"
          >
            Change Signature
          </button>
        </div>
      )}

      {(isEditing || !currentSignature) && (
        <div className="space-y-6">
          <div>
            <label className="ep-label">Draw Signature</label>
            <div className="ep-surface">
              <SignaturePad
                ref={signaturePad}
                canvasProps={{
                  className: "w-full h-48 rounded-md",
                  style: { background: "#f3eee8" },
                }}
              />
              <button
                type="button"
                onClick={handleClear}
                className="mt-2 text-sm text-[#6e6e6e] hover:text-[#2f2f2f]"
              >
                Clear
              </button>
            </div>
          </div>

          <div>
            <label className="ep-label">Upload Signature</label>
            <div className="ep-upload">
              <div className="flex flex-col items-center justify-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="signature-upload"
                />
                <label htmlFor="signature-upload" className="flex flex-col items-center cursor-pointer">
                  <Upload className="w-6 h-6 mb-2" style={{ color: "#fe3a55" }} />
                  <span className="text-sm text-[#6e6e6e]">Choose File</span>
                </label>
                {signatureFile && (
                  <div className="mt-2 text-sm text-[#6e6e6e]">{signatureFile.name}</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="ep-btn ep-btn--ghost"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="ep-btn"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}