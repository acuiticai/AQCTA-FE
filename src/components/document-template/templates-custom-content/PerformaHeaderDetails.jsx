import { BuyerInfo, ContractDetails, DateAndTerms } from "./CustomContent";

function ProformaHeaderDetails() {
  return (
    <div>
      <div className="flex justify-between mt-2">
        <BuyerInfo />
        <ContractDetails />
      </div>

      <DateAndTerms />
    </div>
  );
}

export default ProformaHeaderDetails;
