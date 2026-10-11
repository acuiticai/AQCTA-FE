import { useState } from "react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

export default function ProfileTab({ user_id, profileData, setProfileData }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Name validation
    if (!profileData.name || profileData.name.trim() === "") {
      newErrors.name = "First name is required";
      isValid = false;
    }

    // Last name validation
    if (!profileData.last_name || profileData.last_name.trim() === "") {
      newErrors.last_name = "Last name is required";
      isValid = false;
    }

    // Email validation (even though it's disabled, we still validate it)
    if (!profileData.email || profileData.email.trim() === "") {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      newErrors.email = "Email is invalid";
      isValid = false;
    }

    // Phone number validation
    if (!profileData.contact || profileData.contact.trim() === "") {
      newErrors.contact = "Phone number is required";
      isValid = false;
    } else if (
      !/^\d{10,15}$/.test(profileData.contact.replace(/[^0-9]/g, ""))
    ) {
      newErrors.contact = "Phone number must be between 10-15 digits";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Show validation error toast
      notifyError("Please fix the errors in the form");
      return;
    }

    setLoading(true);

    try {
      // Create the payload with the correct field names for the backend
      const payload = {
        name: profileData.name,
        last_name: profileData.last_name,
        email: profileData.email,
        phone: profileData.contact, // Map contact to phone as per backend
        image: profileData.image,
      };

      await axios.put(`${Base_URL}/admin/${user_id}`, payload);
      notifySuccess("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      notifyError(error.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-[#2d3748] mb-6">User Info</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm text-[#4a5568] mb-2">Name</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                name="name"
                value={profileData?.name || ""}
                onChange={handleChange}
                placeholder="First Name"
                className={`w-full px-4 py-2.5 bg-[#f8fafc] border ${
                  errors.name ? "border-red-500" : "border-[#e2e8f0]"
                } rounded-md focus:outline-none focus:ring-2 focus:ring-[#bcd374] focus:border-transparent`}
              />
              {errors.name && (
                <span className="text-red-500 text-xs mt-1">{errors.name}</span>
              )}
            </div>
            <div>
              <input
                type="text"
                name="last_name"
                value={profileData?.last_name || ""}
                onChange={handleChange}
                placeholder="Last Name"
                className={`w-full px-4 py-2.5 bg-[#f8fafc] border ${
                  errors.last_name ? "border-red-500" : "border-[#e2e8f0]"
                } rounded-md focus:outline-none focus:ring-2 focus:ring-[#bcd374] focus:border-transparent`}
              />
              {errors.last_name && (
                <span className="text-red-500 text-xs mt-1">
                  {errors.last_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-[#4a5568] mb-2">Email</label>
          <input
            type="email"
            name="email"
            value={profileData?.email || ""}
            readOnly
            disabled
            className="w-full px-4 py-2.5 bg-[#f1f5f9] border border-[#e2e8f0] rounded-md text-gray-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm text-[#4a5568] mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            name="contact"
            value={profileData?.contact || ""}
            onChange={handleChange}
            placeholder="Phone Number"
            className={`w-full px-4 py-2.5 bg-[#f8fafc] border ${
              errors.contact ? "border-red-500" : "border-[#e2e8f0]"
            } rounded-md focus:outline-none focus:ring-2 focus:ring-[#bcd374] focus:border-transparent`}
          />
          {errors.contact && (
            <span className="text-red-500 text-xs mt-1">{errors.contact}</span>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#bcd374] text-white px-8 py-2.5 rounded-lg hover:bg-[#a8bf60] transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
