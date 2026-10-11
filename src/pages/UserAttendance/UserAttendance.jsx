"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;
import { notifyError, notifySuccess } from "@/utils/toast";
import axios from "axios";
import { FaCamera } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import { useLocation, useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function UserAttendance() {
  const location = useLocation();
  const history = useHistory();
  const searchParams = new URLSearchParams(location.search);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null); // Store stream reference to ensure we can always access it

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [ipAddress, setIpAddress] = useState("Fetching...");
  const [currentLocation, setCurrentLocation] = useState({
    lat: null,
    lng: null,
  });
  const [currentDateTime, setCurrentDateTime] = useState(
    format(new Date(), "PPpp")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState({
    message: "Preparing camera...",
    needsToCheckIn: true,
    lastEntryType: null,
    attendanceNotRequired: false,
  });

  // Enhanced stopCamera function that's more aggressive about cleanup
  const stopCamera = () => {
    try {
      // First try to stop tracks from the streamRef
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => {
          track.stop();
          console.log("Track stopped:", track.id);
        });
        streamRef.current = null;
      }

      // Also try to stop tracks from videoRef as a backup
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => {
          track.stop();
          console.log("Video track stopped:", track.id);
        });
        videoRef.current.srcObject = null;
      }

      setIsCameraActive(false);
      console.log("Camera stopped");
    } catch (err) {
      console.error("Error stopping camera:", err);
    }
  };

  const startCamera = async () => {
    try {
      // Stop any existing camera first
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      // Store stream in ref for reliable access during cleanup
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        console.log("Camera started");
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      notifyError("Could not access camera. Please check permissions.");
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.translate(canvasRef.current.width, 0); // Move origin to the right edge
        context.scale(-1, 1);
        context.drawImage(
          videoRef.current,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );

        canvasRef.current.toBlob((blob) => {
          if (blob) {
            setCapturedBlob(blob);
            setImagePreview(URL.createObjectURL(blob));
            stopCamera();
          }
        }, "image/png");
      }
    }
  };

  const retakePhoto = () => {
    setCapturedBlob(null);
    setImagePreview(null);
    startCamera();
  };

  const fetchIpAddress = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      setIpAddress(data.ip);
    } catch (err) {
      console.error("Error fetching IP address:", err);
      setIpAddress("Failed to fetch");
    }
  };

  const fetchAttendanceStatus = async () => {
    const adminInfo = localStorage.getItem("adminInfo");
    let email = "";

    if (adminInfo) {
      try {
        const parsedInfo = JSON.parse(adminInfo);
        email = parsedInfo.email || "";

        if (email) {
          try {
            const response = await axios.get(
              `${Base_URL}/attendance/last-attendance-status?email=${email}`
            );

            console.log("last attendance", response.data);
            setAttendanceStatus({
              message: response.data.message,
              needsToCheckIn: response.data.needsToCheckIn,
              lastEntryType: response.data.lastEntryType,
              attendanceNotRequired: Boolean(response.data.attendanceNotRequired),
            });
          } catch (error) {
            console.error("Error fetching attendance status:", error);
            setAttendanceStatus({
              message: "Ready to mark your attendance?",
              needsToCheckIn: true,
              lastEntryType: null,
            });
          }
        }
      } catch (error) {
        console.error("Error parsing adminInfo:", error);
      }
    }
  };

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Unable to fetch current location:", error?.message || error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Handle cleanup when component unmounts
  useEffect(() => {
    startCamera();
    fetchIpAddress();
    fetchCurrentLocation();
    fetchAttendanceStatus();

    // This will ensure the camera is stopped when the component unmounts
    return () => {
      console.log("Component unmounting - stopping camera");
      stopCamera();
    };
  }, []);

  // Handle visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Tab hidden - stopping camera");
        stopCamera();
      } else if (!imagePreview) {
        console.log("Tab visible - starting camera");
        startCamera();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopCamera();
    };
  }, [imagePreview]);

  // Handle beforeunload event (page navigation)
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("Page unloading - stopping camera");
      stopCamera();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Handle route changes for client-side navigation
  useEffect(() => {
    // This is a more aggressive approach - check and stop camera periodically
    const intervalId = setInterval(() => {
      if (!document.body.contains(videoRef.current)) {
        console.log("Component not in DOM - stopping camera");
        stopCamera();
        clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      stopCamera();
    };
  }, []);

  // Update time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(format(new Date(), "PPpp"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!capturedBlob) {
      alert("Please capture your image first");
      return;
    }

    const adminInfo = localStorage.getItem("adminInfo");
    let email = "";
    if (adminInfo) {
      try {
        const parsedInfo = JSON.parse(adminInfo);
        email = parsedInfo.email || "";
      } catch (error) {
        console.error("Error parsing adminInfo:", error);
      }
    }

    setIsSubmitting(true);

    // Prepare form data
    const formData = new FormData();
    formData.append("image", capturedBlob, "attendance.png");
    formData.append("ipAddress", ipAddress);
    formData.append("timestamp", currentDateTime);
    formData.append("submittedAt", new Date().toISOString());
    formData.append("email", email);
    if (currentLocation.lat != null && currentLocation.lng != null) {
      formData.append("lat", String(currentLocation.lat));
      formData.append("lng", String(currentLocation.lng));
    }

    try {
      // Make the API call
      const res = await axios.post(
        `${Base_URL}/attendance/user-attendance`,
        formData
      );

      // Log the response
      console.log("Response:", res);

      // On success, show a success notification
      notifySuccess("Attendance data submitted successfully!", () => {
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          // Refresh attendance status after successful submission
          fetchAttendanceStatus();
          // Reset the form
          setCapturedBlob(null);
          setImagePreview(null);
          startCamera();
        }, 3000); // Hide success message after 3 seconds
      });
    } catch (err) {
      console.error("Error submitting attendance data:", err);

      // Extract error message and show error notification
      const errorMessage =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Submission failed.";
      notifyError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [viewAttendanceAfterLogin, setViewAttendanceAfterLogin] = useState(
    () => {
      const adminInfo = localStorage.getItem("adminInfo");
      if (adminInfo) {
        try {
          const parsed = JSON.parse(adminInfo);
          return parsed.viewAttendanceAfterLogin || false;
        } catch {
          return false;
        }
      }
      return false;
    }
  );

  // Function to toggle
  const toggleViewAttendance = async () => {
    try {
      const newValue = !viewAttendanceAfterLogin;
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo"));
      const email = adminInfo?.email;

      if (!email) {
        notifyError("User info missing!");
        return;
      }

      await axios.patch(
        `${Base_URL}/staff-management/update-attendance-view-setting`,
        {
          email,
          viewAttendanceAfterLogin: newValue,
        }
      );

      // Update localStorage
      const updatedAdminInfo = {
        ...adminInfo,
        viewAttendanceAfterLogin: newValue,
      };
      localStorage.setItem("adminInfo", JSON.stringify(updatedAdminInfo));

      // Update UI
      setViewAttendanceAfterLogin(newValue);

      notifySuccess(
        `Attendance redirect ${newValue ? "enabled" : "disabled"} successfully!`
      );
    } catch (err) {
      console.error("Failed to update attendance view setting", err);
      notifyError("Failed to update setting.");
    }
  };

  return (
    <>
      {/* Status Message */}
      <div className="bg-gray-50 p-3 rounded-lg text-center relative">
        <p className="text-lg font-medium text-gray-800">
          {attendanceStatus.message}
        </p>
        <p className="text-sm text-gray-500">
          {attendanceStatus.lastEntryType
            ? `Last action: ${
                attendanceStatus.lastEntryType === "in"
                  ? "Checked in"
                  : "Checked out"
              }`
            : "No previous records today"}
        </p>
        <div className=" absolute right-2 top-0">
          <div className="text-center mt-4">
            {
              <button
                onClick={toggleViewAttendance}
                className="px-4 py-2 rounded bg-[var(--p-blue)] text-white hover:bg-[#92b726] transition"
              >
                {viewAttendanceAfterLogin
                  ? "Disable attendance at login"
                  : "Enable attendance at login"}
              </button>
            }
          </div>
        </div>
        <div className="absolute top-0 bottom-0 left-1 flex items-center justify-center ">
          <button
            onClick={() => history.push("/my-HR")}
            className="flex items-center justify-center w-10 h-16 bg-[var(--p-blue)] text-white hover:bg-[#92b726]  transition-colors duration-200"
          >
            <ChevronLeft size={24} />
          </button>
        </div>
      </div>
      <div className="min-h-screen flex justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white overflow-hidden h-max">
          <div className="p-6 space-y-6">
            {/* Camera or Captured Image */}
            <div className="relative h-[400px] w-full rounded-2xl overflow-hidden border-2 border-[var(--p-blue)]">
              {/* Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: imagePreview ? "none" : "scaleX(-1)" }}
                className={`w-full h-full object-cover ${
                  imagePreview ? "hidden" : "block"
                }`}
              />

              {/* Captured Image */}
              <img
                src={imagePreview || ""}
                alt="Captured"
                className={`w-full h-full object-cover ${
                  imagePreview ? "block" : "hidden"
                }`}
              />

              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex gap-3">
              {/* Controls */}
              <div className="flex justify-center">
                {!imagePreview ? (
                  <button
                    onClick={captureImage}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-md transition disabled:opacity-50"
                    disabled={
                      !isCameraActive || attendanceStatus.attendanceNotRequired
                    }
                  >
                    <FaCamera />
                  </button>
                ) : (
                  <button
                    onClick={retakePhoto}
                    className="flex items-center gap-2 px-4 py-2 border border-[var(--p-blue)] text-[var(--p-blue)] hover:bg-[teal-50] rounded-md"
                  >
                    <FiRefreshCw />
                  </button>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                className="w-full px-4 py-2 bg-[var(--p-blue)] text-white rounded-md transition disabled:opacity-80"
                disabled={
                  !capturedBlob ||
                  isSubmitting ||
                  attendanceStatus.attendanceNotRequired
                }
              >
                {isSubmitting
                  ? "Processing..."
                  : attendanceStatus.needsToCheckIn
                  ? "Check In"
                  : "Check Out"}
              </button>
            </div>

            {isSuccess && (
              <div className="text-green-600 bg-green-50 p-2 text-center rounded-md text-sm">
                Attendance recorded successfully!
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              {currentDateTime}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
