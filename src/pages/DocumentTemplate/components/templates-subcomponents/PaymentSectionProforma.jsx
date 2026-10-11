const PaymentAccountInfo = ({
  title = "PLEASE MAKE THE PAYMENT TO BELOW ACCOUNT INFO",
  accountDetails = [
    { label: "Account Holder", value: "BARENA GROUP SDN BHD" },
    { label: "Account Number", value: "1221 1101 0000 605" },
    { label: "Account Type", value: "TRADE FCA ACCOUNT (USD)" },
    { label: "Bank Name", value: "ALLIANCE BANK BERHAD" },
    {
      label: "Bank Address",
      value:
        "UNIT SR3-G, GROUND FLOOR, WISMA STAR,NO. 1, JALAN YAP KWAN SENG, 50450 KUALA LUMPUR",
    },
  ],
}) => {
  return (
    <div className="mb-3">
      <h2 className="mb-2">{title}</h2>
      <div className="grid grid-cols-[1fr_3fr]">
        <h1 className="font-bold text-[12px]">Beneficiary</h1>
        <ItemListDocumentSection details={accountDetails} />
      </div>
    </div>
  );
};

export default PaymentAccountInfo;

export const ItemListDocumentSection = ({ details }) => {
  return (
    <div className="text-sm space-y-1">
      {details.map((detail, index) => {
        if (detail.label === "Bank Name")
          return (
            <div className="flex justify-between">
              <ItemStyle
                key={index + "1"}
                detail={detail}
                className="grid grid-cols-[2.05fr_0fr_2fr]"
              />
              <ItemStyle
                key={index + "a"}
                detail={{ label: "SWIFT CODE", value: "MFBBMYKL" }}
                className="grid grid-cols-[2fr_0fr_2fr]"
              />
            </div>
          );
        return <ItemStyle key={index} detail={detail} />;
      })}
    </div>
  );
};

const ItemStyle = ({ detail, className = "grid grid-cols-[1fr_0fr_3fr]" }) => {
  return (
    <div className={className + " text-[12px]"}>
      <span className="max-w-max">{detail.label}</span>
      <span className="mr-1 font-bold">:</span>
      <span className="font-bold max-w-sm">{detail.value}</span>
    </div>
  );
};
