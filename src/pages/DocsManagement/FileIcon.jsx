import React from "react";
import DOC from "@/assets/DocIcons/DOC.svg";
import GIF from "@/assets/DocIcons/GIF.svg";
import MP3 from "@/assets/DocIcons/MP3.svg";
import PDF from "@/assets/DocIcons/PDF.svg";
import PNG from "@/assets/DocIcons/PNG.svg";
import JPEG from "@/assets/DocIcons/JPEG.svg";
import PPT from "@/assets/DocIcons/PPT.svg";
import PSD from "@/assets/DocIcons/PSD.svg";
import SVG from "@/assets/DocIcons/SVG.svg";
import TXT from "@/assets/DocIcons/TXT.svg";
import XLS from "@/assets/DocIcons/XLS.svg";
import ZIP from "@/assets/DocIcons/ZIP.svg";

const FileTypeIcon = ({ name }) => {
  const getTypeFromName = (filename) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    const iconMap = {
      pdf: PDF,
      svg: SVG,
      docx: DOC,
      doc: DOC,
      jpeg: JPEG,
      png: PNG,
      xls: XLS,
      xlsx: XLS,
      ppt: PPT,
      pptx: PPT,
      zip: ZIP,
      txt: TXT,
      gif: GIF,
      mp3: MP3,
      psd: PSD,
    };

    return iconMap[ext] || null; // Return the matching SVG or null
  };

  const IconComponent = getTypeFromName(name);

  return (
    <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {IconComponent ? (
        <img
          src={IconComponent}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#F3F4F6",
            color: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
            borderRadius: "0.5rem"
          }}
        >
          ?
        </div>
      )}
    </div>
  );
};

export default FileTypeIcon;
