import React from "react";

const FormHeader = () => {
  const handleBackClick = () => {};

  return (
    <div className="border-b flex gap-2 items-center pb-4">
      <h2
        className="text-lg cursor-pointer font-semibold"
        onClick={handleBackClick}
      >
        &#11164;
      </h2>
      <h2 className="text-2xl font-bold text-gray-800">
        Create Document Template
      </h2>
    </div>
  );
};

export default FormHeader;
