import React from "react";
const DynamicHeader = ({ brandLogo, invoiceTitle, ...rest }) => {
  const {
    tagline,
    invoiceNumber,
    buyerInfo,
    contractNo,
    poNo,
    intermediate,
    date,
    terms,
  } = rest;

  return (
    <>
      {/* Top Header Section */}
      <div className="w-full flex flex-col items-center text-center">
        {brandLogo && <img src={"/" + brandLogo.file.path} alt="brand logo" />}
        <span className="italic font-semibold">{tagline}</span>
      </div>

      {/* Invoice Title & Number */}
      <div className="flex font-bold text-xl items-baseline gap-x-5 mt-2">
        <h1>{invoiceTitle}:</h1>
        <p>{invoiceNumber}</p>
      </div>

      {/* Company Information */}
      <div className="flex justify-between mt-2">
        <div className="flex gap-2 font-bold mb-3">
          <span>BUYER:</span>
          <p className="w-72 uppercase">{buyerInfo}</p>
        </div>
        <div className="flex flex-col w-max">
          <div className="flex">
            <div className="flex justify-between w-32">
              <span>Contract No</span>
              <span>:</span>
            </div>
            <span>{contractNo}</span>
          </div>
          <div className="flex">
            <div className="flex justify-between w-32">
              <span>PO No</span>
              <span>:</span>
            </div>
            <span>{poNo}</span>
          </div>
          <div className="flex">
            <div className="flex justify-between w-32">
              <span>Intermediate</span>
              <span>:</span>
            </div>
            <span>{intermediate}</span>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-2 gap-x-8 text-sm mb-3">
        <div className="space-y-1">
          <div className="flex">
            <span className="w-24">Date</span>
            <span className="mr-1">:</span>
            <span>{date}</span>
          </div>
          <div className="flex">
            <span className="w-24">Terms</span>
            <span className="mr-1 uppercase">:</span>
            <span>{terms}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default DynamicHeader;
