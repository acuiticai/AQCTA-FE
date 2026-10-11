import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import { DetailRow } from "../templates-custom-content/CustomContent";
import { useLabelManagement } from "@/pages/DocumentTemplate/context/LabelContext";
import DOMPurify from 'dompurify';

function DocumentContent() {
  const { requiredGradeAndQuantity, requiredPayment, requiredShipping } =
    useDocumentConext();

  return (
    <div className="text-sm">
      {requiredGradeAndQuantity && <GradeAndQuantityPreview />}
      {requiredShipping && <ShippingDetailsPreview />}
      {requiredPayment && <PaymentDetailsPreview />}
    </div>
  );
}

const GradeAndQuantityPreview = () => {
  const { contentEntriesGradeAndQuantiy: entries, contractDetails } =
    useDocumentConext();
  const { getLabel } = useLabelManagement();
  console.log(contractDetails);

  return (
    <div className="mt-1">
      <DetailRow
        section="gradeQuantity"
        fieldId="intermediate"
        value={entries.intermediate}
        bold={true}
      />
      <h2 className="text-[10px] italic">
        we have this day sold to you the under mentioned {entries.description}
      </h2>
      <DetailRow
        section="gradeQuantity"
        fieldId="grade"
        value={
          contractDetails
            ? contractDetails?.productInfo[0]?.title
            : entries.grade
        }
        bold={true}
      />
      <div className="flex justify-between">
        <DetailRow
          section="gradeQuantity"
          fieldId="quantity"
          value={
            contractDetails
              ? contractDetails?.productInfo[0]?.quantityMTS + " Metric Tons"
              : entries.quantity
          }
          bold={true}
        />
        <DetailRow
          section="gradeQuantity"
          fieldId="price"
          value={
            contractDetails
              ? "$" + contractDetails?.productInfo[0]?.price
              : entries.price
          }
          bold={true}
        />
      </div>
    </div>
  );
};

const ShippingDetailsPreview = () => {
  const { shippingEntries: entries, contractDetails } = useDocumentConext();
  const { getLabel } = useLabelManagement();

  return (
    <div className="mt-1">
      <DetailRow
        section="shipping"
        fieldId="totalValue"
        value={
          contractDetails
            ? "USD  " + contractDetails?.productInfo[0]?.totalValue
            : entries.totalValue
        }
        bold={true}
      />
      <DetailRow
        section="shipping"
        fieldId="shippingTerms"
        value={
          <span
            style={{ whiteSpace: "pre-wrap" }}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                contractDetails
                  ? contractDetails?.productInfo?.[0]?.shippingTerms || "N/A"
                  : entries.shippingTerms || "N/A"
              ),
            }}
          />
        }
        bold={true}
      />

      <DetailRow
        section="shipping"
        fieldId="packing"
        value={
          contractDetails
            ? contractDetails?.productInfo[0]?.packing
            : entries.packing
        }
        bold={true}
      />
      <DetailRow
        section="shipping"
        fieldId="etdPortLoading"
        value={entries.etdPortLoading}
        bold={true}
      />
    </div>
  );
};

const PaymentDetailsPreview = () => {
  const { paymentEntries: entries } = useDocumentConext();
  const { getLabel } = useLabelManagement();

  return (
    <div className="mt-1">
      <DetailRow
        section="payment"
        fieldId="payment"
        value={entries.payment}
        bold={true}
      />
      <h2>Beneficiary</h2>
      <DetailRow
        section="payment"
        fieldId="accountHolder"
        value={entries.accountHolder}
        bold={true}
      />
      <DetailRow
        section="payment"
        fieldId="accountNumber"
        value={entries.accountNumber}
        bold={true}
      />
      <DetailRow
        section="payment"
        fieldId="accountType"
        value={entries.accountType}
        bold={true}
      />
      <div className="flex justify-between">
        <DetailRow
          section="payment"
          fieldId="bankName"
          value={entries.bankName}
          bold={true}
        />
        <DetailRow
          section="payment"
          fieldId="swiftCode"
          value={entries.swiftCode}
          bold={true}
        />
      </div>
      <DetailRow
        section="payment"
        fieldId="bankAddress"
        value={entries.bankAddress}
        bold={true}
      />
    </div>
  );
};

export default DocumentContent;
