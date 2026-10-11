import React from 'react';

const Loading = ({ loading }) => {
  return (
    <div
      style={{
        borderTop: "2px solid #84cc16",
        borderLeft: "2px solid #84cc16",
        borderRadius: "50%",
        width: "16px",
        height: "16px",
        animation: "spin 1s linear infinite",
      }}
    ></div>
  );
};

export default Loading;
