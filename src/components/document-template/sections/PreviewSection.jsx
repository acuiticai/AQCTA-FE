import React, { useState } from "react";
import { convertToRaw } from "draft-js";
import {
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  PictureAsPdf as PdfIcon,
  Description as WordIcon,
  Print as PrintIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "@mui/icons-material";

import draftToHtml from "draftjs-to-html";

const PreviewSection = ({
  documentType,
  templateName,
  logo,
  tableFields,
  tableValues,
  termsEditorState,
  paymentEditorState,
  signees,
  onSave,
  onExport,
}) => {
  const [zoom, setZoom] = useState(100);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleExportClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setAnchorEl(null);
  };

  const handleExport = (format) => {
    onExport(format);
    handleExportClose();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <div className="flex items-center space-x-2">
            <Tooltip title="Save Template">
              <IconButton onClick={onSave}>
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
              <MenuItem onClick={() => handleExport("pdf")}>
                <PdfIcon className="mr-2" /> Export as PDF
              </MenuItem>
              <MenuItem onClick={() => handleExport("word")}>
                <WordIcon className="mr-2" /> Export as Word
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => handleExport("print")}>
                <PrintIcon className="mr-2" /> Print
              </MenuItem>
            </Menu>

            <Divider orientation="vertical" flexItem />

            <IconButton onClick={() => setZoom((z) => Math.min(z + 10, 200))}>
              <ZoomInIcon />
            </IconButton>
            <span className="text-sm">{zoom}%</span>
            <IconButton onClick={() => setZoom((z) => Math.max(z - 10, 50))}>
              <ZoomOutIcon />
            </IconButton>
          </div>
        </Toolbar>
      </AppBar>

      {/* Document Preview */}
      <div
        style={{ scrollbarWidth: "none" }}
        className="flex-1 overflow-auto bg-gray-100 p-8"
      >
        <Paper
          elevation={2}
          className="mx-auto"
          style={{
            width: `${8.5 * zoom}px`,
            minHeight: `${11 * zoom}px`,
            padding: "1in",
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
          }}
        >
          {/* Document Header */}
          <div className="flex flex-col items-center mb-8">
            {logo && (
              <img
                src={logo.preview}
                alt="Logo"
                className="h-25 object-contain"
              />
            )}
            {documentType && (
              <div className="flex w-full gap-2 items-baseline">
                <h1 className="text-xl font-bold text-gray-900">
                  {documentType}:
                </h1>
                <h2 className="text-md text-gray-700 font-semibold">
                  {templateName}
                </h2>
              </div>
            )}
          </div>

          {/* Table Section */}
          {tableValues.length > 0 && (
            <table className="w-full border-collapse mb-8">
              <thead>
                <tr className="bg-gray-50">
                  {tableFields.map((field) => (
                    <th
                      key={field.id}
                      className="border border-gray-200 p-2 text-left"
                      style={{ width: `${field.width}%` }}
                    >
                      {field.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableValues.map((row) => (
                  <tr key={row.id}>
                    {tableFields.map((field) => (
                      <td key={field.id} className="border border-gray-200 p-2">
                        {row.values[field.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Terms Section */}
          <div className="mb-8">
            <h2 className="text-xl mb-4">Terms and Conditions: </h2>
            <div
              dangerouslySetInnerHTML={{
                __html: draftToHtml(
                  convertToRaw(termsEditorState.getCurrentContent())
                ),
              }}
              className="text-gray-700"
            />
          </div>

          {/* Payment Section */}
          <div className="mb-8">
            <h2 className="text-xl mb-4">Payment Instructions: </h2>
            <div
              dangerouslySetInnerHTML={{
                __html: draftToHtml(
                  convertToRaw(paymentEditorState.getCurrentContent())
                ),
              }}
              className="text-gray-700"
            />
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 mt-16 text-center">
            {signees.map((signee, index) => (
              <div key={index} className="w-64">
                <div className="border-b border-gray-400 h-16"></div>
                <p className="text-sm text-gray-600 mt-2">{signee.title}</p>
                {signee.name && (
                  <p className="text-sm font-semibold">{signee.name}</p>
                )}
              </div>
            ))}
          </div>
        </Paper>
      </div>
    </div>
  );
};

export default PreviewSection;
