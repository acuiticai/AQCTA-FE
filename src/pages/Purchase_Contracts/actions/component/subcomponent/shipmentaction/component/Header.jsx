import React from "react";
import { useHistory } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import FrameIcon from "../iconsvg/frame.svg";

const Header = ({ shipmentId }) => {
  const history = useHistory();

  return (
    <div className="flex justify-between items-center rounded-lg">
      <button
        className="flex items-center text-gray-600 text-sm font-medium"
        onClick={() => history.goBack()}
      >
        <FiArrowLeft className="mr-2" size={18} />
        Back
      </button>

      <div className="flex space-x-3">
        <button
          className="bg-[var(--p-blue)] text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm"
          onClick={() => history.push("/Bill Of Landing")}
        >
          + Prepare Bill of Lading
        </button>

        <button
          className="bg-gray-200 px-4 py-2 rounded-xl flex items-center font-medium shadow-sm"
          onClick={() => history.push("/export-bill-of-lading")}
        >
          <img src={FrameIcon} alt="Export Icon" className="w-5 h-5 mr-2" />
          Export
        </button>
      </div>
    </div>
  );
};

export default Header;
