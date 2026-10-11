import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@windmill/react-ui";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";

const Configuration = ({ businessId }) => {
  const { t } = useTranslation();
  const qrCodeRef = useRef(null);

  const loginUrl = `https://example.com/Login_Customer?business_id=${businessId}`;
  const [logo, setLogo] = useState(localStorage.getItem("system_logo"));
  const [data, setData] = useState({
    name: "IPH System",
    email: "ihtesham112@gmail.com",
    status: "Active",
  });

  useEffect(() => {
    // Example logic for fetching business data; replace with actual API call
    // Simulate loading and populate data
    setData({
      name: "IPH System",
      email: "ihtesham112@gmail.com",
      status: "Active",
    });
  }, [businessId]);

  const downloadQRCode = () => {
    html2canvas(qrCodeRef.current).then((canvas) => {
      const link = document.createElement("a");
      link.download = "qrcode.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  const printQRCode = () => {
    const qrWindow = window.open("", "QR Code", "width=600,height=800");
    qrWindow.document.write(
      `<html><head><title>Print QR Code</title></head><body><div style="text-align: center; font-family: Arial, sans-serif;">
        <img src="${logo}" alt="Logo" style="max-width: 120px; margin-bottom: 20px;" />
        <h1>${data.name}</h1>
        <p>${data.email}</p>
        <img src="${qrCodeRef.current.children[0].toDataURL()}" alt="QR Code" style="border: 2px solid #ccc; padding: 10px; margin-top: 20px;" />
        <p style="margin-top: 20px;">${t("Scan the QR code to get your e-invoice")}</p>
      </div></body></html>`
    );
    qrWindow.document.close();
    qrWindow.print();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 ">
        <div ref={qrCodeRef} className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold">{t("Welcome to Our Store")}</h1>
          {/* Logo */}
          <img
            src={logo}
            alt="Logo"
            className="w-24 h-24 object-cover mb-4"
          />

          {/* Business Info */}
          <h2 className="text-xl font-semibold mb-2">{data.name}</h2>
          <p className="text-sm text-gray-500 mb-4">{data.email}</p>

          {/* QR Code */}
          <QRCodeCanvas value={loginUrl} size={300} className="border p-2" />

          {/* Description */}
          <p className="text-sm text-gray-600 mt-4">
            {t("Scan the QR code to get your e-invoice")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button
            className="bg-blue-500 text-white hover:bg-blue-600"
            onClick={downloadQRCode}
          >
            {t("Download QR Code")}
          </Button>
          <Button
            className="bg-gray-500 text-white hover:bg-gray-600"
            onClick={printQRCode}
          >
            {t("Print QR Code")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Configuration;
