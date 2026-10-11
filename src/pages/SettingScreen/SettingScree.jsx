import React from "react";
import { Card, CardContent } from "@/pages/SettingScreen/components/ui/card";
import sales from "@/pages/SettingScreen/icons/icon7.svg";
import Purchase from "@/pages/SettingScreen/icons/icon6.svg";
import Operations from "@/pages/SettingScreen/icons/icon1.svg";
import Accounts from "@/pages/SettingScreen/icons/icon2.svg";
import Finance from "@/pages/SettingScreen/icons/icon3.svg";
import DocumentManager from "@/pages/SettingScreen/icons/icon4.svg";
import HRManagement from "@/pages/SettingScreen/icons/icon5.svg";
import { Link } from "react-router-dom";
import { getModuleLabel } from "@/utils/moduleLabels";

const buildSettingsCategories = () => [
  {
    title: "Sales",
    icon: <img src={sales} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-green-100",
    items: [
      "Estimates",
      "Retainer Invoices",
      getModuleLabel("saleOrder", "Sale Order"),
      "Delivery Challans",
      "Invoices",
      "Recurring Invoices",
      "Credit Notes",
      "Delivery Notes",
      "Packing Slips",
    ],
  },
  {
    title: "Purchase",
    icon: <img src={Purchase} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-blue-100",
    items: [
      "Expenses",
      "Recurring Expenses",
      "Recurring Bills",
      "Purchase Orders",
    ],
  },
  {
    title: "Operations",
    icon: <img src={Operations} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-yellow-100",
    items: Array(8).fill("Settings Title"),
  },
  {
    title: "Accounts",
    icon: <img src={Accounts} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-gray-100",
    items: Array(8).fill("Settings Title"),
  },
  {
    title: "Finance",
    icon: <img src={Finance} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-indigo-100",
    items: Array(8).fill("Settings Title"),
  },
  {
    title: "Document Manager",
    icon: <img src={DocumentManager} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-pink-100",
    items: Array(8).fill("Settings Title"),
  },
  {
    title: "HR Management",
    icon: <img src={HRManagement} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-red-100",
    items: Array(8).fill("Settings Title"),
  },
  {
    title: "Templates",
    icon: <img src={DocumentManager} alt="Sales Icon" className="w-6 h-6" />,
    // bgColor: "bg-yellow-100",
    items: [
      "Email Templates",
      "Sales Contracts",
      "Purchase Contracts",
      "Invoices",
      "Payments",
      "Shipping",
      "Document Templates",
    ],
  },
];

const SettingsScreen = () => {
  const settingsCategories = buildSettingsCategories();
  return (
    <div className="p-10 bg-gray-50 min-h-screen font-inter">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-sm font-bold text-gray-900">All Settings</h1>
        <span className="text-sm  text-red-500 cursor-pointer hover:text-red-700">
          X Close Settings
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {settingsCategories.map((category, index) => (
          <Card key={index} className="p-4 shadow-md rounded-xl bg-white">
            <CardContent>
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-lg ${category.bgColor}`}
                >
                  <span>{category.icon}</span>
                </div>
                <h2 className="text-sm font-bold text-gray-800">
                  {category.title}
                </h2>
              </div>
              <ul className="mt-2 text-gray-600 space-y-1 text-xs font-normal">
                {category.items.map((item, idx) => {
                  if (item === "Document Templates")
                    return (
                      <Link to="/document-templates">
                        <li
                          key={idx}
                          className="hover:text-gray-900 cursor-pointer"
                        >
                          {item}
                        </li>
                      </Link>
                    );
                  return (
                    <li
                      key={idx}
                      className="hover:text-gray-900 cursor-pointer"
                    >
                      {item}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SettingsScreen;
