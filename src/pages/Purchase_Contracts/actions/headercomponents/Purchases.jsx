// Similar implementation for Purchases page
import {
  AddButton,
  DataCard,
  DataTable,
  FilterDropdown,
  PageHeader,
  StatusBadge,
} from "./StyledComponents";

const purchases = [
  {
    date: "03-12-2024",
    invoiceNumber: "2611321",
    contracts: "2611321",
    creditNotes: "2316514",
    amount: "USD 1651.00",
    balanceDue: "USD 1000.00",
    status: "Draft",
  },
];

const PurchasesTabs = () => {
  const columns = [
    { key: "date", header: "Date" },
    { key: "invoiceNumber", header: "Invoice Number" },
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

  return (
    <DataTable
      columns={columns}
      data={purchases}
      getRowKey={(row) => row.invoiceNumber}
    />
  );
};

export default PurchasesTabs;
