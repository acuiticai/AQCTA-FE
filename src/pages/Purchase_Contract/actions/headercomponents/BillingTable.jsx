import React, { useState, useRef, useEffect, useContext } from "react";
import {
  AddButton,
  DataCard,
  DataTable,
  FilterDropdown,
  PageHeader,
  StatusBadge,
} from "./StyledComponents";
import { FiEye, FiTrash2, FiDownload, FiFileText, FiBriefcase } from "react-icons/fi";
import { useHistory } from "react-router-dom";
import { AdminContext } from "@/context/AdminContext";
import axios from 'axios';
import { formatAmount, formatDate } from "@/components/formatAmount";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Billing = ({ Data }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false);
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [invoices, setInvoices] = useState([]);
  const dropdownRef = useRef(null);
  const history = useHistory();
  const handleAddNew = () => {
    setDropdownOpen((prev) => !prev);
  };
  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  };

  const columns = [
    {
      key: "invoice_date",
      header: "Invoice Date",
      render: (row) => formatDate(row.invoice_date),
    },
    { key: "invoice_number", header: "Invoice Number" },
    { key: "type", header: "Invoice Type" },
    {
      key: "due_date",
      header: "Due Date",
      render: (row) => formatDate(row.due_date),
    },
    {
      key: "grandTotal",
      header: "Amount",
      render: (row) => formatAmount(row.grandTotal),
    },
    {
      key: "remaining",
      header: "Remaining Amount",
      render: (row) => formatAmount(row.remaining),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Action",
      render: (row) => (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <FiFileText
            title="Generate PDF"
            style={{ cursor: "pointer" }}
            onClick={() => console.log("Generate PDF for", row.invoice_number)}
          />
          <FiEye
            title="View"
            style={{ cursor: "pointer" }}
            onClick={() => history.push({
              pathname: "/view_invoice_details",
              state: row,
            })}
          />
          <FiDownload
            title="Download"
            style={{ cursor: "pointer" }}
            onClick={async () => {
              try {
                let response = await axios.get(`${Base_URL}/proforma-invoice/download/${row._id}`, { headers });
                //  let response = await axios.get(`${Base_URL}/proforma-invoice/get_by_contract/${Data._id}`, { headers });
                console.log("Download response", response);
                if (response.data?.data) {
                  window.open(response.data.data, '_blank');
                }
              } catch (err) {
                console.log("Failed to download invoice", err);
              }
            }}
          />
        </div>
      ),
    },
  ];


  const columnsPayment = [
    { key: "payment date", header: "Payment Date" },
    { key: "Payments", header: "Invoice Number" },
    { key: "contracts", header: "Contracts" },
    { key: "creditNotes", header: "Credit Notes" },
    { key: "amount", header: "Amount" },
    { key: "balanceDue", header: "Balance Due" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  useEffect(() => {
    console.log("response.data fetchInvoices");
    fetchInvoices();
  }, []);


  const fetchInvoices = async () => {
    console.log("Data._id", Data._id);

    if (!Data._id) return;
    setLoading(true);
    try {
      console.log("err 1234");
      let response = await axios.get(`${Base_URL}/proforma-invoice/get_by_contract/${Data._id}`, { headers });
      console.log("response.data", response.data.data);
      setInvoices(response.data.data);
      console.log("err 12345");
      // setError(null);
    } catch (err) {
      console.log("err 123456", err);
      // setError('Failed to fetch items');
    } finally {
      console.log("err 1234567");
      setLoading(false);
    }
  };
  console.log("invoices", invoices);

  // Close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setDropdownOpen(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div>
      <DataCard>
        <PageHeader title="Invoices">
          <FilterDropdown
            options={[
              { value: "draft", label: "Draft" },
              { value: "paid", label: "Paid" },
              { value: "pending", label: "Pending" },
            ]}
            onChange={(e) => console.log("Filter changed:", e.target.value)}
          />
          <div className="relative" ref={dropdownRef}>
            <AddButton onClick={handleAddNew} />
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg z-10 border">
                <ul className="py-1">
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() =>
                      history.push({
                        pathname: "/create-performa-invoice",
                        state: { contractId: Data._id },
                      })}
                  >
                    Performa Invoice
                  </li>
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => console.log("Commercial Invoice Clicked")}
                  >
                    Commercial Invoice
                  </li>
                </ul>
              </div>
            )}
          </div>
        </PageHeader>

        <DataTable
          columns={columns}
          data={invoices}
          getRowKey={(row) => row.invoice_number}
        />
      </DataCard>

      <DataCard>
        <PageHeader title="Payments">
          <FilterDropdown
            options={[
              { value: "draft", label: "Draft" },
              { value: "paid", label: "Paid" },
              { value: "pending", label: "Pending" },
            ]}
            onChange={(e) => console.log("Filter changed:", e.target.value)}
          />
          <div className="relative" >
            <AddButton onClick={handleAddNew} />
            {/* {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg z-10 border">
                <ul className="py-1">
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => history.push("/create-performa-invoice")}
                  >
                    Performa Invoice
                  </li>
                  <li
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => console.log("Commercial Invoice Clicked")}
                  >
                    Commercial Invoice
                  </li>
                </ul>
              </div>
            )} */}
          </div>
        </PageHeader>

        <DataTable
          columns={columnsPayment}
          data={[
            // {
            //   date: "03-12-2024",
            //   invoiceNumber: "2611321",
            //   contracts: "2611321",
            //   creditNotes: "2316514",
            //   amount: "USD 1651.00",
            //   balanceDue: "USD 1000.00",
            //   status: "Draft",
            // },
          ]}
          getRowKey={(row) => row.invoiceNumber}
        />
      </DataCard>
    </div >
  );
};

export default Billing;
