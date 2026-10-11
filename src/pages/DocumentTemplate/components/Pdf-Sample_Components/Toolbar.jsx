// src/components/Toolbar.js
import {
  Save as SaveIcon,
  PictureAsPdf as PdfIcon,
  Description as WordIcon,
  Print as PrintIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "@mui/icons-material";

import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
} from "@mui/material";
import usePdfTemplate from "../../hooks/usePdfTemplates";

function CustomToolbar({ zoom, onZoom, onPrint }) {
  const { anchorEl, handleExport, handleExportClick, handleExportClose } =
    usePdfTemplate();
  return (
    <AppBar
      position="static"
      color="default"
      elevation={1}
      className="no-print"
    >
      <Toolbar variant="dense">
        <div className="flex items-center space-x-2">
          <Tooltip title="Save Template">
            <IconButton>
              <SaveIcon />
            </IconButton>
          </Tooltip>

          <Button
            startIcon={<PdfIcon />}
            onClick={handleExportClick}
            variant="outlined"
            size="small"
          >
            Export
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleExportClose}
          >
            <MenuItem
              onClick={() => {
                handleExport("pdf");
              }}
            >
              <PdfIcon className="mr-2" /> Export as PDF
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleExport("word");
              }}
            >
              <WordIcon className="mr-2" /> Export as Word
            </MenuItem>
            <MenuItem
              onClick={() => {
                // Close the menu and then call the onPrint function passed in from the parent.
                handleExportClose();
                onPrint();
              }}
            >
              <PrintIcon className="mr-2" /> Print
            </MenuItem>
          </Menu>

          <Divider orientation="vertical" flexItem />

          <IconButton onClick={() => onZoom((z) => Math.min(z + 10, 200))}>
            <ZoomInIcon />
          </IconButton>
          <span className="text-sm">{zoom}%</span>
          <IconButton onClick={() => onZoom((z) => Math.max(z - 10, 50))}>
            <ZoomOutIcon />
          </IconButton>
        </div>
      </Toolbar>
    </AppBar>
  );
}

export default CustomToolbar;
