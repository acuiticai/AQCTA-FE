import React from "react";

const StyledLabel2 = ({ text, className = "" }) => {
  return (
    <div>
      <label
        className={`text-lg text-black font-inter ${className}`}
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: "600",
        //   textTransform: "uppercase",
        //   letterSpacing: "0.5px",
          fontSize:"20px",
          
        }}
      >
        {text}
      </label>
    </div>
  );
};

export default StyledLabel2;
