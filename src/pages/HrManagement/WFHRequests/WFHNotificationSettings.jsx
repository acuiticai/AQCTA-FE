"use client";

import { useState, useEffect, useContext } from "react";
import { Plus, ChevronDown, X } from "lucide-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { notifyError } from "@/utils/toast";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemTable = ({ items, onEdit, onDelete }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Group Name
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Department
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Staff Count
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Allowed WFH Days
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item) => (
          <tr key={item._id}>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2">{item.department.name}</td>
            <td className="px-4 py-2">{item.staff?.length || 0}</td>
            <td className="px-4 py-2">{item.allowedWFH}</td>
            <td className="px-4 py-2 text-sm font-medium">
              <button
                onClick={() => onEdit(item)}
                className="text-blue-600 hover:text-blue-900 mr-2"
              >
                <FiEdit className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(item._id)}
                className="text-red-600 hover:text-red-900"
              >
                <FiTrash2 className="w-5 h-5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// const AddEditModal = ({ isOpen, onClose, type, item, departments, onSubmit, organization }) => {
//     const { state } = useContext(AdminContext)
//     const { adminInfo } = state
//     const [formData, setFormData] = useState({
//         _id: "",
//         name: "",
//         department: "",
//         staff: [],
//         allowedWFH: "",
//     })

//     const [staffList, setStaffList] = useState([])
//     const [validationErrors, setValidationErrors] = useState({})

//     const headers = {
//         "Content-Type": "application/json",
//         authorization: `Bearer ${adminInfo.token}`,
//     }

//     const fetchStaff = async (selectedOrg) => {
//         if (!selectedOrg) return;

//         try {
//             const response = await axios.get(`${BASE_URL}/staff-management/staff-names`, {
//                 headers,
//                 params: {
//                     business: selectedOrg,
//                     department: formData.department
//                 }
//             });
//             setStaffList(response.data.data);
//         } catch (err) {
//             console.error("Failed to fetch staff", err);
//         }
//     };

//     useEffect(() => {
//         if (formData.department) { fetchStaff(organization) }
//     }, [formData.department])

//     useEffect(() => {
//         if (item) {
//             setFormData({
//                 _id: item._id || "",
//                 name: item.name || "",
//                 department: item.department._id || "",
//                 staff: item.staff.map(e => e._id) || [],
//                 allowedWFH: item.allowedWFH || "",
//             })
//         } else {
//             setFormData({
//                 _id: "",
//                 name: "",
//                 department: "",
//                 staff: [],
//                 allowedWFH: "",
//             })
//         }
//         setValidationErrors({})
//     }, [item, isOpen])

//     const handleChange = (e) => {
//         const { name, value } = e.target
//         setFormData((prev) => ({ ...prev, [name]: value }))
//         setValidationErrors((prev) => ({ ...prev, [name]: "" }))
//     }

//     const handleSubmit = (e) => {
//         e.preventDefault()

//         const errors = {}
//         if (!formData.name) errors.name = "Name is required."
//         if (!formData.department) errors.department = "Department is required."
//         if (!formData.staff || formData.staff.length === 0) errors.staff = "At least one staff member is required."
//         if (!formData.allowedWFH) errors.allowedWFH = "Allowed WFH days is required."

//         setValidationErrors(errors)
//         if (Object.keys(errors).length > 0) return

//         onSubmit(formData)
//     }

//     if (!isOpen) return null

//     return (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//             <div className="bg-white rounded-lg p-6 m-6 max-w-3xl w-full">
//                 <div className="flex justify-between items-center mb-6">
//                     <h2 className="text-xl font-semibold">{item ? "Edit" : "Add New"} WFH Group</h2>
//                     <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
//                         <X className="w-5 h-5" />
//                     </button>
//                 </div>

//                 <form onSubmit={handleSubmit}>
//                     <div className="space-y-4 max-h-[70vh] overflow-y-auto" style={{ padding: "4px 4px" }}>
//                         {/* Name */}
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
//                             <input
//                                 type="text"
//                                 name="name"
//                                 value={formData.name}
//                                 onChange={handleChange}
//                                 className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${validationErrors.name ? "border-red-500" : "border-gray-300"}`}
//                             />
//                             {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
//                         </div>

//                         {/* Department */}
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
//                             <ReactSelect
//                                 value={
//                                     departments.find((dept) => dept._id === formData.department)
//                                         ? {
//                                             value: formData.department,
//                                             label: departments.find((dept) => dept._id === formData.department).name,
//                                         }
//                                         : null
//                                 }
//                                 onChange={(selectedOption) => {
//                                     setFormData((prev) => ({
//                                         ...prev,
//                                         department: selectedOption ? selectedOption.value : "",
//                                     }))
//                                     setValidationErrors((prev) => ({ ...prev, department: "" }))
//                                 }}
//                                 options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
//                                 placeholder="Select Department"
//                                 isSearchable
//                                 classNamePrefix="react-select"
//                                 styles={{
//                                     ...reactSelectConfig,
//                                     control: (base, state) => ({
//                                         ...reactSelectConfig.control?.(base, state),
//                                         background: "white",
//                                         borderWidth: 1,
//                                         borderColor: validationErrors.department ? "#ef4444" : state.isFocused ? "var(--p-blue)" : "#d1d5db",
//                                         "&:hover": {
//                                             borderColor: "none",
//                                         },
//                                     }),
//                                 }}
//                             />
//                             {validationErrors.department && (
//                                 <p className="text-red-500 text-sm mt-1">{validationErrors.department}</p>
//                             )}
//                         </div>

//                         {/* Staff */}
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-1">Staff Members</label>
//                             <ReactSelect
//                                 value={
//                                     formData.staff
//                                         ?.map((staffId) => {
//                                             const staffMember = staffList.find((s) => s._id === staffId)
//                                             return staffMember
//                                                 ? { value: staffId, label: staffMember.displayName }
//                                                 : null
//                                         })
//                                         .filter(Boolean) || []
//                                 }
//                                 onChange={(selectedOptions) => {
//                                     setFormData((prev) => ({
//                                         ...prev,
//                                         staff: selectedOptions ? selectedOptions.map((opt) => opt.value) : [],
//                                     }))
//                                     setValidationErrors((prev) => ({ ...prev, staff: "" }))
//                                 }}
//                                 options={staffList.map((staff) => ({
//                                     value: staff._id,
//                                     label: staff.displayName,
//                                 }))}
//                                 placeholder="Select Staff Members"
//                                 isMulti
//                                 isSearchable
//                                 classNamePrefix="react-select"
//                                 styles={{
//                                     ...reactSelectConfig,
//                                     control: (base, state) => ({
//                                         ...reactSelectConfig.control?.(base, state),
//                                         background: "white",
//                                         borderWidth: 1,
//                                         borderColor: validationErrors.staff ? "#ef4444" : state.isFocused ? "var(--p-blue)" : "#d1d5db",
//                                         "&:hover": {
//                                             borderColor: "none",
//                                         },
//                                     }),
//                                 }}
//                             />
//                             {validationErrors.staff && <p className="text-red-500 text-sm mt-1">{validationErrors.staff}</p>}
//                         </div>

//                         {/* Allowed WFH Days */}
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 mb-1">Allowed WFH Days</label>
//                             <input
//                                 min={1}
//                                 max={7}
//                                 type="number"
//                                 name="allowedWFH"
//                                 value={formData.allowedWFH}
//                                 onChange={handleChange}
//                                 className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] ${validationErrors.allowedWFH ? "border-red-500" : "border-gray-300"}`}
//                             />
//                             {validationErrors.allowedWFH && (
//                                 <p className="text-red-500 text-sm mt-1">{validationErrors.allowedWFH}</p>
//                             )}
//                         </div>
//                     </div>

//                     <div className="flex justify-end mt-4">
//                         <button
//                             type="submit"
//                             className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
//                         >
//                             {item ? "Update" : "Add"} {type}
//                         </button>
//                     </div>
//                 </form>
//             </div>
//         </div>
//     )
// }

const AddEditModal = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    dayOfWeek: "",
    timeOfDay: "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = {};
    if (!formData.dayOfWeek) validation.dayOfWeek = "Please select a day.";
    if (!formData.timeOfDay) validation.timeOfDay = "Please select a time.";

    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    // call parent or API
    console.log("Submitted:", formData);
    if (onSubmit) onSubmit(formData);
  };

  return (
    <div className=" max-w-md w-8/12 bg-red-300 mx-auto mt-10 bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Select Day & Time</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Day Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Day of Week
          </label>
          <select
            name="dayOfWeek"
            value={formData.dayOfWeek}
            onChange={handleChange}
            className={`w-full p-2 border rounded ${
              errors.dayOfWeek ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Day</option>
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          {errors.dayOfWeek && (
            <p className="text-red-500 text-sm mt-1">{errors.dayOfWeek}</p>
          )}
        </div>

        {/* Time Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Time
          </label>
          <input
            type="time"
            name="timeOfDay"
            value={formData.timeOfDay}
            onChange={handleChange}
            className={`w-full p-2 border rounded ${
              errors.timeOfDay ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.timeOfDay && (
            <p className="text-red-500 text-sm mt-1">{errors.timeOfDay}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
        >
          Save
        </button>
      </form>
    </div>
  );
};

const WFHNotificationSettings = () => {
  const [editItem, setEditItem] = useState(null);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  console.log("admin info is : ", adminInfo);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [organization, setOrganization] = useState(null);
  const [isOrgLoaded, setIsOrgLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }

    setIsOrgLoaded(true);
  }, [location]);

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchItems(organization);
    }
  }, [organization, isOrgLoaded]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const handleSubmit = async (item) => {
    try {
      const payload = {
        business_id: organization,
        name: item.name,
        department: item.department,
        staff: item.staff,
        allowedWFH: item.allowedWFH,
        status: item.status || "Active",
      };

      if (editItem) {
        await axios.put(
          `${BASE_URL}/wfh-groups/update/${editItem._id}`,
          payload,
          { headers }
        );
      } else {
        await axios.post(`${BASE_URL}/wfh-groups/add`, payload, { headers });
      }

      fetchItems(organization);
    } catch (err) {
      console.error("Failed to save item", err);
      notifyError(err?.response?.data?.error || "An error occurred");
    }
  };

  const fetchItems = async (selectedOrg) => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const payload = {
        business_id: selectedOrg,
        FilterStatus: "",
        FilterName: "",
      };
      const response = await axios.post(
        `${BASE_URL}/wfh-groups/get_all`,
        payload,
        { headers }
      );
      setItems(response.data.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch WFH groups");
    } finally {
      setLoading(false);
    }
  };

  return <>{<AddEditModal onSubmit={handleSubmit} />}</>;
};

export default WFHNotificationSettings;
