// src/hooks/usePdfTemplates.js
import { useState } from "react";

export default function usePdfTemplate() {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleExportClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setAnchorEl(null);
  };

  const handleExport = (format) => {
    if (format === "print") {
      // We no longer call window.print() here.
      // The print functionality will be provided via a prop.
      console.log(`Print export is triggered`);
    } else {
      console.log(`Exporting as ${format}`);
    }
    handleExportClose();
  };

  return {
    anchorEl,
    setAnchorEl,
    handleExport,
    handleExportClick,
    handleExportClose,
  };
}
