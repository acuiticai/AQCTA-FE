import React from "react";

const TermsAndConditions = ({ sectionTitle = "Terms & Conditions", terms }) => {
  return (
    <div className="my-2 grid grid-cols-[1fr_4fr]">
      <h2 className="font-bold">{sectionTitle} :</h2>
      <div className="text-[10px] text-justify">
        {typeof terms === "string" ? (
          <div>{terms}</div>
        ) : (
          terms?.map((term, index) => (
            <div key={index} className="flex">
              <span className="flex-shrink-0">{index + 1}.</span>
              <span>{term}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TermsAndConditions;
