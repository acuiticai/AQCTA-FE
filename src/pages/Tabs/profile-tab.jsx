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

    if (!profileData.name || profileData.name.trim() === "") {
      newErrors.name = "First name is required";
      isValid = false;
    }

    if (!profileData.last_name || profileData.last_name.trim() === "") {
      newErrors.last_name = "Last name is required";
      isValid = false;
    }

    if (!profileData.email || profileData.email.trim() === "") {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      newErrors.email = "Email is invalid";
      isValid = false;
    }

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
      notifyError("Please fix the errors in the form");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: profileData.name,
        last_name: profileData.last_name,
        email: profileData.email,
        phone: profileData.contact,
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

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div>
      <h3 className="ep-title">User Info</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="ep-label">Name</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                name="name"
                value={profileData?.name || ""}
                onChange={handleChange}
                placeholder="First Name"
                className={`ep-input${errors.name ? " is-error" : ""}`}
              />
              {errors.name && (
                <span className="ep-error">{errors.name}</span>
              )}
            </div>
            <div>
              <input
                type="text"
                name="last_name"
                value={profileData?.last_name || ""}
                onChange={handleChange}
                placeholder="Last Name"
                className={`ep-input${errors.last_name ? " is-error" : ""}`}
              />
              {errors.last_name && (
                <span className="ep-error">{errors.last_name}</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="ep-label">Email</label>
          <input
            type="email"
            name="email"
            value={profileData?.email || ""}
            readOnly
            disabled
            className="ep-input"
          />
        </div>

        <div>
          <label className="ep-label">Phone Number</label>
          <input
            type="tel"
            name="contact"
            value={profileData?.contact || ""}
            onChange={handleChange}
            placeholder="Phone Number"
            className={`ep-input${errors.contact ? " is-error" : ""}`}
          />
          {errors.contact && (
            <span className="ep-error">{errors.contact}</span>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading} className="ep-btn">
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
