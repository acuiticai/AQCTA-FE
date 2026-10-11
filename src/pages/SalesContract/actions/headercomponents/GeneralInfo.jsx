import React, { useState, useEffect } from "react";
import {
  formatAmount,
  formatDate,
  formatQuantity,
} from "@/components/formatAmount";
import DOMPurify from "dompurify";
import axios from "axios";
import moment from "moment";
import {
  MdInventory,
  MdLocalShipping,
  MdAttachMoney,
  MdDescription,
  MdBusiness,
  MdPerson,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const product = Data?.productInfo?.[0] || {};
  const basic = Data?.basicInfo || {};
  const account = Data?.Account_Info || {};
  const [loading, setLoading] = useState(false);
  const [itemDetailsMap, setItemDetailsMap] = useState({});

  useEffect(() => {
    const fetchAllItems = async () => {
      setLoading(true);
      try {
        const productItems = Data?.productInfo || [];
        const itemFetchPromises = productItems.map((prod) =>
          axios.get(`${Base_URL}/items/${prod?.item}`)
        );

        const results = await Promise.allSettled(itemFetchPromises);

        const details = {};
        results.forEach((res, idx) => {
          const prod = productItems[idx];
          if (res.status === "fulfilled") {
            details[prod.item] = res.value.data;
          } else {
            console.warn(`Item fetch failed for ${prod.item}`, res.reason);
          }
        });

        setItemDetailsMap(details);
      } catch (err) {
        console.error("❌ Error fetching item details", err);
      } finally {
        setLoading(false);
      }
    };

    if (Data?.productInfo?.length) {
      fetchAllItems();
    }
  }, [Data]);

  const itemDetail = itemDetailsMap[product?.item] || {};

  return (
    <div className="space-y-6">
      {/* Product Details Section */}
      <Section title={t("salesContract.sections.productDetails", { defaultValue: "Product Details" })} icon={MdInventory}>
        <InfoRow
          label={t("common.item", { defaultValue: "Item" })}
          value={`${product?.title} (${itemDetail?.grade}) ${
            product?.packing
          } ${product?.itemDetail?.remarks || ""}`}
          icon={MdInventory}
        />
        <InfoRow
          label={t("salesContract.fields.packing", { defaultValue: "Packing" })}
          value={product?.packing}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("common.remarks", { defaultValue: "Remarks" })}
          value={product?.remarks}
          icon={MdDescription}
        />
        <InfoRow
          label={t("salesContract.fields.numberOfContainers", { defaultValue: "No. of containers" })}
          value={product?.quantityFCL}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.numberOfPackages", { defaultValue: "No. of Packages" })}
          value={product?.No_of_Packages}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.quantityPerFcl", { defaultValue: "Quantity Per FCL" })}
          value={formatQuantity(product?.quantityMTS)}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.totalQuantityMts", { defaultValue: "Total Quantity (MTS)" })}
          value={product?.quantityMTS && product?.quantityFCL 
            ? (Number(product.quantityMTS) * Number(product.quantityFCL)).toFixed(2)
            : formatQuantity(product?.quantityMTS * product?.quantityFCL)}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.pricePerUnit", { defaultValue: "Price (per unit)" })}
          value={`$${formatAmount(product?.price)}`}
          icon={MdAttachMoney}
        />
        {basic?.typeOfSaleContract === "Profit Sharing" && (
          <InfoRow
            label={t("salesContract.fields.finalCustomerPrice", { defaultValue: "Price for Final Customer" })}
            value={`$${formatAmount(product?.priceForFinalCustomer)}`}
            icon={MdAttachMoney}
          />
        )}
        <InfoRow
          label={t("salesContract.fields.deposit", { defaultValue: "Deposit" })}
          value={`${formatAmount(product?.deposit)}%`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label={t("salesContract.fields.totalValue", { defaultValue: "Total Value" })}
          value={`$${formatAmount(
            product?.price * product?.quantityMTS * product?.quantityFCL
          )}`}
          icon={MdAttachMoney}
        />
        <InfoRow
          label={t("salesContract.fields.forecastCostDescription", { defaultValue: "Forecast Cost Description" })}
          value={product?.forecastCostDescription}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.forecastCost", { defaultValue: "Forecast Cost" })}
          value={formatAmount(product?.forecastCost)}
          icon={MdLocalShipping}
        />
      </Section>

      {/* Basic Information Section */}
      <Section title={t("salesContract.sections.basicInformation", { defaultValue: "Basic Information" })} icon={MdBusiness}>
        <InfoRow
          label={t("salesContract.fields.contractType", { defaultValue: "Contract Type" })}
          value={basic?.typeOfSaleContract}
          icon={MdBusiness}
        />
        <InfoRow
          label={t("salesContract.fields.creationDate", { defaultValue: "Contract Creation Date" })}
          value={formatDate(basic?.contractCreationDate || basic?.createdAt)}
          icon={MdDescription}
        />
        <InfoRow
          label={t("salesContract.fields.agreedDate", { defaultValue: "Contract Date (Agreed)" })}
          value={formatDate(basic?.contractDate)}
          icon={MdDescription}
        />
        <InfoRow
          label={t("salesContract.fields.etdPortOfLoading", { defaultValue: "ETD Port of Loading" })}
          value={moment(basic?.ETD_Port).format("MMM YYYY")}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.etaPortOfDischarge", { defaultValue: "ETA Port of Discharge" })}
          value={moment(basic?.ETA_Port).format("MMM YYYY")}
          icon={MdLocalShipping}
        />
        <InfoRow
          label={t("salesContract.fields.paymentTerms", { defaultValue: "Payment Terms" })}
          value={product?.paymentTerms}
          icon={MdAttachMoney}
          isHTML={true}
        />
        <InfoRow
          label={t("common.remarks", { defaultValue: "Remarks" })}
          value={product?.remarks}
          isHTML={true}
          icon={MdDescription}
        />
      </Section>

      {/* Account Information Section */}
      <Section title={t("salesContract.sections.bankInformation", { defaultValue: "Bank Information" })} icon={MdPerson}>
        <InfoRow
          label={t("salesContract.fields.accountNumber", { defaultValue: "Account Number" })}
          value={account?.accountNumber}
          icon={MdBusiness}
        />
        <InfoRow
          label={t("salesContract.fields.bankName", { defaultValue: "Bank Name" })}
          value={account?.bankName}
          icon={MdBusiness}
        />
        <InfoRow
          label={t("salesContract.fields.swiftCode", { defaultValue: "Swift Code" })}
          value={account?.swiftCode}
          icon={MdBusiness}
        />
        <InfoRow
          label={t("salesContract.fields.accountName", { defaultValue: "Account Name" })}
          value={account?.accountName}
          icon={MdBusiness}
        />
      </Section>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">
              {t("salesContract.loadingItemDetails", {
                defaultValue: "Loading item details...",
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralInfo;
