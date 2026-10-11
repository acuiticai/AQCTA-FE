import { useEffect, useState } from "react";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BusinessDropdown = ({
  adminId,
  selectedBusiness,
  onChange,
  hideWhenSingleBusiness = true,
}) => {
  const [businesses, setBusinesses] = useState([]);
  console.log("adminId", adminId);
  const fetchAssignedBusinesses = async () => {
    if (!adminId) return;

    try {
      const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`);
      const assigned = res.data.businesses || [];
      console.log("assigned", assigned);
      setBusinesses(assigned);

      // Auto-select if only one
      if (assigned.length === 1) {
        onChange(assigned[0]._id); // ✅ passing ID only
      }
    } catch (err) {
      console.error("Failed to fetch assigned businesses:", err);
    }
  };
  useEffect(() => {
    fetchAssignedBusinesses();
  }, [adminId]);

  if (hideWhenSingleBusiness && businesses.length === 1) {
    return null;
  }

  return (
    <div
      className="dropdown-wrapper"
      // style={{
      //     padding: "0rem 2rem 0rem .8rem",
      //     background: "rgb(242, 242, 242)",
      //     borderRadius: "8px"
      // }}
    >
      <select
        value={selectedBusiness}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "rgb(242, 242, 242)",
          borderRadius: "8px",
          outline: "none",
          fontSize: "0.875rem",
          padding: "0.5rem 2rem 0.5rem 1.4rem",
        }}
        className="focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
      >
        <option value="all">Select Business</option>
        {businesses.map((business) => (
          <option key={business._id} value={business._id}>
            {business.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BusinessDropdown;
