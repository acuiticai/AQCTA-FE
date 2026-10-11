import { paymentInputFields } from "@/data/data-document-content";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import DynamicInputsForm from "../../ui/DynamicInputs";

// Payment Details Component
export const PaymentDetails = () => {
  const {
    paymentEntries,
    setPaymentEntries,
    setRequireContent,
    requiredPayment,
    setRequiredPayment,
  } = useDocumentConext();

  const handleAddContent = () => {
    setRequireContent(true);
    setRequiredPayment(true);
  };

  return (
    <DynamicInputsForm
      title="Payment Details"
      subtitle="Manage payment information"
      isVisible={requiredPayment}
      setIsVisible={setRequiredPayment}
      entries={paymentEntries}
      setEntries={setPaymentEntries}
      onAddContent={handleAddContent}
      inputFields={paymentInputFields}
      section={"payment"}
    />
  );
};
