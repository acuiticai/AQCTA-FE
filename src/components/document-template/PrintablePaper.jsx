import React from "react";
import { Paper } from "@mui/material";

const PrintablePaper = ({ paperRef, zoom, documentType, children }) => {
  return (
    <div className="min-h-screen flex justify-center bg-gray-100 p-0">
      <div className="w-full max-w-[9.5in]">
        <div className="sticky top-0">
          <Paper
            ref={paperRef}
            elevation={4}
            className="font-mono text-black bg-white"
            style={{
              width: "9.5in",
              minHeight: "12.8in",
              padding: "0.5in",
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              margin: "0 auto",
              boxShadow: "0 0 10px rgba(0, 0, 0, 0.2)",
              pageBreakAfter: "always",
            }}
          >
            {documentType && children}
          </Paper>
        </div>
      </div>
    </div>
  );
};

export default PrintablePaper;
