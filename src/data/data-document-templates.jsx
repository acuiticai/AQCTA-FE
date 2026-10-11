// TabsConfig.jsx
import React from "react";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline";
import TableChartIcon from "@mui/icons-material/TableChart";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ReplayIcon from "@mui/icons-material/Replay";
import LoopIcon from "@mui/icons-material/Loop";
import DescriptionIcon from "@mui/icons-material/Description";
export const tabs = [
  {
    id: "general",
    label: "General",
    icon: () => (
      <DescriptionOutlinedIcon className="w-5 h-5" fontSize="small" />
    ),
  },
  {
    id: "header-footer",
    label: "Header & Footer",
    icon: () => <ViewHeadlineIcon className="w-5 h-5" fontSize="small" />,
  },
  {
    id: "content",
    label: "Content",
    icon: () => <DescriptionIcon className="w-5 h-5" fontSize="small" />,
  },
  {
    id: "table",
    label: "Table",
    icon: () => <TableChartIcon className="w-5 h-5" fontSize="small" />,
  },
  {
    id: "other",
    label: "Other Details",
    icon: () => <MoreHorizIcon className="w-5 h-5" fontSize="small" />,
  },
];

export const actionButtons = [
  {
    id: "undo",
    label: "Undo",
    icon: () => <ReplayIcon className="w-5 h-5" fontSize="small" />,
  },
  {
    id: "refresh",
    label: "Refresh Preview",
    icon: () => <LoopIcon className="w-5 h-5" fontSize="small" />,
  },
];
