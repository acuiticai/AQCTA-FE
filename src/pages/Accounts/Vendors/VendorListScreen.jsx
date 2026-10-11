import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { FiPlus, FiEye } from "react-icons/fi";
import { Link } from "react-router-dom";
import Dropdown from "@/components/Dropdown";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { notifyError, notifySuccess } from "@/utils/toast";
import SearchBar from "@/components/SearchBar";
import Table from "@/components/Table"; // Import reusable Table component
import { useHistory } from "react-router-dom";
import StyledLabel2 from "@/components/StyledLabel2";
import { AdminContext } from "@/context/AdminContext";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const VendorListScreen = () => {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headersAuth = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo?.token}`,
  };

  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState("");

  const headers = [
    "Vendor Name",
    "Company Name",
    "Work Phone",
    "Email",
    "Status",
    "Action",
  ];

  const handleEditVendor = (vendorId) => {
    history.push(`/Edit Vendor/${vendorId}`);
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!adminInfo?.id) return;
      try {
        const response = await axios.get(
          `${Base_URL}/admin/assigned/${adminInfo.id}`,
          { headers: headersAuth }
        );
        const list = response.data?.businesses || [];
        setBusinesses(list);
      } catch (err) {
        console.error("Failed to fetch assigned businesses:", err);
      }
    };
    fetchBusinesses();
  }, [adminInfo?.id]);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    filterVendorsByBusiness(vendors, selectedBusiness);
  }, [selectedBusiness, vendors, businesses]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${Base_URL}/vendors`);

      const vendorsData = Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setVendors(vendorsData);
    } catch (err) {
      console.error("Error fetching vendors:", err);
      setError("Failed to fetch vendors.");
    } finally {
      setLoading(false);
    }
  };

  const filterVendorsByBusiness = (vendors, businessId) => {
    const assignedIds = (businesses || []).map((b) => b._id);
    if (businessId) {
      const filtered = vendors.filter(
        (v) => (v.business?._id ?? v.business) === businessId
      );
      setFilteredVendors(filtered);
      setError(filtered.length === 0 ? "No vendors exist for the selected business." : null);
      return;
    }
    if (assignedIds.length === 0) {
      setFilteredVendors([]);
      setError(null);
      return;
    }
    const filtered = vendors.filter((v) => {
      const bid = v.business?._id ?? v.business;
      return bid && assignedIds.includes(typeof bid === "string" ? bid : String(bid));
    });
    setFilteredVendors(filtered);
    setError(null);
  };

  const handleBusinessChange = (event) => {
    const businessId = event.target.value;
    setSelectedBusiness(businessId);
  };

  const handleSearch = (event) => {
    const searchValue = event.target.value.toLowerCase();
    setSearchTerm(searchValue);

    const assignedIds = (businesses || []).map((b) => b._id);
    const byBusiness = selectedBusiness
      ? vendors.filter((v) => (v.business?._id ?? v.business) === selectedBusiness)
      : vendors.filter((v) => {
          const bid = v.business?._id ?? v.business;
          return bid && assignedIds.some((id) => (typeof bid === "string" ? bid : String(bid)) === (typeof id === "string" ? id : String(id)));
        });

    const filtered = byBusiness.filter(
      (vendor) =>
        (vendor.basicInformation?.vendorDisplayName ?? "")
          .toLowerCase()
          .includes(searchValue) ||
        (vendor.basicInformation?.primaryContact?.firstName ?? "")
          .toLowerCase()
          .includes(searchValue) ||
        (vendor.basicInformation?.primaryContact?.lastName ?? "")
          .toLowerCase()
          .includes(searchValue) ||
        (vendor.basicInformation?.companyName ?? "")
          .toLowerCase()
          .includes(searchValue) ||
        (vendor.basicInformation?.vendorEmail ?? "")
          .toLowerCase()
          .includes(searchValue)
    );

    setFilteredVendors(filtered);
  };

  const handleToggleStatus = async (vendorId, currentStatus) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";

    try {
      const response = await axios.put(
        `${Base_URL}/vendors/status/${vendorId}`
      );

      if (response.status === 200) {
        notifySuccess(`Vendor status updated to ${newStatus}`);
        const updatedVendors = vendors.map((vendor) =>
          vendor._id === vendorId ? { ...vendor, status: newStatus } : vendor
        );
        setVendors(updatedVendors);
      }
    } catch (error) {
      console.error("Error updating vendor status:", error);
      notifyError("Failed to update vendor status.");
    }
  };

  return (
    <div
      className="p-6 bg-white min-h-screen"
      style={{ backgroundColor: "#FFFF" }}
    >
      <div className="flex justify-between  mb-6">
        <h1 className="text-lg font-semibold">Vendors</h1>
        <Link
          to="/New Vendor"
          className="flex items-center px-4 py-2 bg-lime-400 hover:bg-lime-500 text-white text-sm font-medium rounded-xl shadow-sm"
        >
          <FiPlus className="mr-2" /> Add New
        </Link>
      </div>

      <div
        className="bg-white shadow-md rounded-xl p-4"
        style={{ backgroundColor: "#F9F9FA" }}
      >
        <StyledLabel2 text="All Vendors" />
        <div className="flex justify-end items-center mb-4 gap-4">
          <Dropdown
            value={selectedBusiness}
            onChange={handleBusinessChange}
            options={businesses.map((business) => ({
              value: business._id,
              label: `${business.name}`,
            }))}
            placeholder="Select Business"
          />
          <SearchBar
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search"
          />
        </div>
        {loading ? (
          <p className="text-center text-gray-500">Loading...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : filteredVendors.length === 0 ? (
          <p className="text-center text-gray-500">
            No vendors found for the selected business.
          </p>
        ) : (
          <Table
            headers={headers}
            data={filteredVendors}
            renderRow={(vendor) => (
              <tr key={vendor._id} className="border-b">
                <td className="py-2 px-4">
                  {vendor.basicInformation?.vendorDisplayName ||
                    `${vendor.basicInformation?.primaryContact?.firstName || ""} ${vendor.basicInformation?.primaryContact?.lastName || ""}`.trim() ||
                    vendor.basicInformation?.companyName ||
                    "-"}
                </td>
                <td className="py-2 px-4">
                  {vendor.basicInformation?.companyName}
                </td>
                <td className="py-2 px-4">
                  {vendor.basicInformation?.vendorPhone?.workPhone}
                </td>
                <td className="py-2 px-4">
                  {vendor.basicInformation?.vendorEmail}
                </td>
                <td className="py-2 px-4">
                  <ToggleSwitch
                    isOn={vendor.status === "Active"}
                    handleToggle={() =>
                      handleToggleStatus(vendor._id, vendor.status)
                    }
                  />
                </td>
                <td className="py-2 px-4">
                  <button
                    className="p-2 hover:bg-gray-100 rounded-md"
                    onClick={() => handleEditVendor(vendor._id)}
                  >
                    <FiEye className="text-gray-600" />
                  </button>
                </td>
              </tr>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default VendorListScreen;
