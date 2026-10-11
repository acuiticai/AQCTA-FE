import React, { useEffect, useState } from "react";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";
import axios from "axios";
import moment from "moment";
import DOMPurify from "dompurify";
import {
  MdInventory,
  MdLocalShipping,
  MdAttachMoney,
  MdDescription,
  MdBusiness,
  MdPerson,
  MdSchedule,
  MdLocationOn,
  MdEmail,
  MdPhone,
  MdAccountBalance,
  MdWeb,
} from "react-icons/md";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
    <div className="flex items-center mb-4">
      <div className="bg-blue-100 rounded-lg p-2 mr-3">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value, isHTML = false, icon: Icon }) => (
  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
    {Icon && (
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <span className="font-medium text-gray-700 block mb-1">{label}</span>
      {isHTML ? (
        <div
          className="text-gray-600 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(value || "N/A"),
          }}
        />
      ) : (
        <span className="text-gray-600">{value || "N/A"}</span>
      )}
    </div>
  </div>
);

const GeneralInfo = ({ Data }) => {
  const [itemDetailsMap, setItemDetailsMap] = useState({});
  const [businessDetails, setBusinessDetails] = useState({});
  const [vendorDetails, setVendorDetails] = useState({});
  const [agentDetails, setAgentDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const product = Data?.productInfo?.[0] || {};
  const basic = Data?.basicInfo || {};
  const vendor = basic?.selectedVendorId?.basicInformation || {};

  useEffect(() => {
    const fetchData = async () => {
      if (!Data) return;

      setLoading(true);
      try {
        const promises = [];

        // Fetch item details
        if (Data?.productInfo?.length) {
          const itemFetchPromises = Data.productInfo.map((prod) =>
            axios.get(`${Base_URL}/items/${prod.item}`)
          );
          promises.push(Promise.allSettled(itemFetchPromises));
        }

        // Fetch business details
        if (Data?.business) {
          promises.push(axios.get(`${Base_URL}/business/${Data.business}`));
        }

        // Fetch vendor details
        if (typeof basic?.selectedVendorId === "string") {
          promises.push(
            axios.get(`${Base_URL}/vendors/${basic.selectedVendorId}`)
          );
        }

        // Fetch agent details
        if (basic?.agent_id) {
          promises.push(axios.get(`${Base_URL}/vendors/${basic.agent_id}`));
        }

        const results = await Promise.allSettled(promises);

        // Process item details
        if (Data?.productInfo?.length && results[0]?.status === "fulfilled") {
          const itemResults = results[0].value;
          const mapped = {};
          itemResults.forEach((res, index) => {
            const itemId = Data.productInfo[index].item;
            if (res.status === "fulfilled") {
              mapped[itemId] = res.value.data;
            } else {
              console.warn(`Item fetch failed for ${itemId}`, res.reason);
            }
          });
          setItemDetailsMap(mapped);
        }

        // Process business details
        if (Data?.business && results[1]?.status === "fulfilled") {
          setBusinessDetails(results[1].value.data);
        }

        // Process vendor details
        if (basic?.selectedVendorId && results[2]?.status === "fulfilled") {
          setVendorDetails(results[2].value.data);
        }

        // Process agent details
        if (basic?.agent_id && results[3]?.status === "fulfilled") {
          setAgentDetails(results[3].value.data);
        }
      } catch (err) {
        console.error("❌ Error fetching data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [Data]);

  const itemDetail = itemDetailsMap[product?.item] || {};

  return (
    <div className="space-y-6">
      {/* Business Information Section */}
      {businessDetails?.name && (
        <Section title="Business Information" icon={MdBusiness}>
          <InfoRow
            label="Business Name"
            value={businessDetails.name}
            icon={MdBusiness}
          />
          <InfoRow
            label="Business Email"
            value={businessDetails.email}
            icon={MdEmail}
          />
          <InfoRow
            label="Business Phone"
            value={businessDetails.tel}
            icon={MdPhone}
          />
          <InfoRow
            label="Business Address"
            value={businessDetails.address}
            icon={MdLocationOn}
          />
          <InfoRow
            label="Business Status"
            value={businessDetails.status}
            icon={MdBusiness}
          />
        </Section>
      )}

      {/* Vendor Information Section */}
      {vendorDetails?.basicInformation && (
        <Section title="Vendor Information" icon={MdPerson}>
          <InfoRow
            label="Vendor Company"
            value={vendorDetails.basicInformation.companyName}
            icon={MdBusiness}
          />
          <InfoRow
            label="Vendor Display Name"
            value={vendorDetails.basicInformation.vendorDisplayName}
            icon={MdPerson}
          />
          <InfoRow
            label="Vendor Email"
            value={vendorDetails.basicInformation.vendorEmail}
            icon={MdEmail}
          />
          <InfoRow
            label="Vendor Phone"
            value={vendorDetails.basicInformation.vendorPhone?.mobile}
            icon={MdPhone}
          />
          <InfoRow
            label="Vendor Type"
            value={vendorDetails.basicInformation.vendorType}
            icon={MdBusiness}
          />
          <InfoRow
            label="Vendor Category"
            value={vendorDetails.basicInformation.vendorCategory}
            icon={MdBusiness}
          />
        </Section>
      )}

      {/* Vendor Company Details Section */}
      {vendorDetails?.companyInfo && (
        <Section title="Vendor Company Details" icon={MdBusiness}>
          <InfoRow
            label="Company Address"
            value={vendorDetails.companyInfo.companyAddress}
            icon={MdLocationOn}
          />
          <InfoRow
            label="City/State"
            value={vendorDetails.companyInfo.townCityState}
            icon={MdLocationOn}
          />
          <InfoRow
            label="Country"
            value={vendorDetails.companyInfo.country}
            icon={MdLocationOn}
          />
          <InfoRow
            label="Company Website"
            value={vendorDetails.companyInfo.companyWebsite}
            icon={MdWeb}
          />
          <InfoRow
            label="Type of Business"
            value={vendorDetails.companyInfo.typeOfBusiness}
            icon={MdBusiness}
          />
          <InfoRow
            label="Nature of Business"
            value={vendorDetails.companyInfo.natureOfBusiness}
            icon={MdBusiness}
          />
          <InfoRow
            label="Registration Number"
            value={vendorDetails.companyInfo.companyRegistrationNumber}
            icon={MdAccountBalance}
          />
          <InfoRow
            label="Date of Incorporation"
            value={
              vendorDetails.companyInfo.dateOfIncorporation
                ? formatDate(
                    new Date(vendorDetails.companyInfo.dateOfIncorporation)
                  )
                : "N/A"
            }
            icon={MdSchedule}
          />
        </Section>
      )}

      {/* Agent Information Section */}
      {agentDetails?.basicInformation && (
        <Section title="Agent Information" icon={MdPerson}>
          <InfoRow
            label="Agent Name"
            value={basic?.agentName}
            icon={MdPerson}
          />
          <InfoRow
            label="Agent Company"
            value={agentDetails.basicInformation.companyName}
            icon={MdBusiness}
          />
          <InfoRow
            label="Agent Email"
            value={agentDetails.basicInformation.vendorEmail}
            icon={MdEmail}
          />
          <InfoRow
            label="Agent Phone"
            value={agentDetails.basicInformation.vendorPhone?.mobile}
            icon={MdPhone}
          />
          <InfoRow
            label="Commission per MTS"
            value={`$${basic?.commissionPerMTS || "N/A"}`}
            icon={MdAttachMoney}
          />
        </Section>
      )}

      <Section title="Contract Information" icon={MdDescription}>
        <InfoRow
          label="Contract No"
          value={Data?.contractNo}
          icon={MdDescription}
        />
        <InfoRow label="Status" value={Data?.status} icon={MdBusiness} />
        <InfoRow
          label="Created Date"
          value={formatDate(Data?.createdAt)}
          icon={MdSchedule}
        />
        <InfoRow
          label="Contract Date (Agreed)"
          value={
            basic?.contractDate
              ? formatDate(new Date(basic.contractDate))
              : "N/A"
          }
          icon={MdSchedule}
        />
        <InfoRow
          label="Supplier Contract Date"
          value={
            basic?.supplierContractDate
              ? formatDate(new Date(basic.supplierContractDate))
              : "N/A"
          }
          icon={MdSchedule}
        />
        <InfoRow
          label="ETD Port"
          value={moment(basic?.ETD_Port).format("MMM YYYY")}
          icon={MdSchedule}
        />
        <InfoRow
          label="Vendor Name"
          value={
            Data?.basicInfo?.selectedVendorId?.basicInformation
              ?.vendorDisplayName ||
            Data?.basicInfo?.vendorName ||
            Data?.basicInfo?.supplierName ||
            vendorDetails?.basicInformation?.vendorDisplayName ||
            vendorDetails?.basicInformation?.companyName ||
            "N/A"
          }
          icon={MdPerson}
        />
        <InfoRow
          label="Supplier Contract No."
          value={basic?.supplierContractNo}
          icon={MdDescription}
        />
        <InfoRow
          label="Supplier Contract Date"
          value={
            basic?.supplierContractDate
              ? formatDate(new Date(basic.supplierContractDate))
              : "N/A"
          }
          icon={MdSchedule}
        />
        <InfoRow
          label="Origin Country"
          value={product?.origin_country}
          icon={MdLocationOn}
        />
      </Section>

      <Section title="Product Information" icon={MdInventory}>
        <InfoRow label="Item Title" value={product?.title} icon={MdInventory} />
        <InfoRow
          label="Item Grade"
          value={itemDetail?.grade || product?.grade}
          icon={MdInventory}
        />
        <InfoRow label="Packing" value={product?.packing} icon={MdInventory} />
        <InfoRow
          label="No. of Packages"
          value={product?.No_of_Packages}
          icon={MdLocalShipping}
        />
        <InfoRow
          label="Quantity Per FCL"
          value={formatQuantity(product?.quantityMTS)}
          icon={MdInventory}
        />
        <InfoRow
          label="Total Quantity (MTS)"
          value={product?.quantityMTS && product?.quantityFCL 
            ? (Number(product.quantityMTS) * Number(product.quantityFCL)).toFixed(2)
            : formatQuantity(product?.quantityMTS * product?.quantityFCL)}
          icon={MdInventory}
        />
        <InfoRow
          label="No. of containers"
          value={product?.quantityFCL}
          icon={MdLocalShipping}
        />
        <InfoRow
          label="Container Type"
          value={product?.containerType}
          icon={MdLocalShipping}
        />
        <InfoRow
          label="FCL Size"
          value={product?.fclSize}
          icon={MdLocalShipping}
        />
        <InfoRow
          label="Container Weight"
          value={`${product?.containerWeight} MTS`}
          icon={MdLocalShipping}
        />
        <InfoRow
          label="Estimated Departure"
          value={formatDate(product?.estimatedDeparture)}
          icon={MdSchedule}
        />
        <InfoRow
          label="Port of Loading"
          value={product?.portOfLanding}
          icon={MdLocationOn}
        />
        <InfoRow
          label="Port of Destination"
          value={product?.portOfDestination}
          icon={MdLocationOn}
        />
        <InfoRow
          label="Remarks"
          value={product?.remarks}
          icon={MdDescription}
        />
      </Section>

      <Section title="Pricing & Financial Details" icon={MdAttachMoney}>
        <InfoRow
          label="Unit Price (USD)"
          value={`$${formatAmount(product?.price)}`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Total Value"
          value={`$${formatAmount(
            product?.price * product?.quantityMTS * product?.quantityFCL
          )}`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Currency"
          value={product?.selectedCurrency}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Conversion Rate"
          value={product?.conversionRate}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Amount in Selected Currency"
          value={`${product?.selectedCurrency} ${formatAmount(
            product?.amountInSelectedCurrency
          )}`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Additional Charges"
          value={`$${formatAmount(product?.additionalCharges)}`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Deposit"
          value={`${formatAmount(product?.deposit)}%`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Break Even Value"
          value={product?.breakEvenValue}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Payment Terms"
          value={product?.paymentTerms}
          isHTML={true}
          icon={MdAttachMoney}
        />
        <InfoRow
          label="Shipping Terms"
          value={product?.shippingTerms}
          isHTML={true}
          icon={MdLocalShipping}
        />
      </Section>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading contract details...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralInfo;
