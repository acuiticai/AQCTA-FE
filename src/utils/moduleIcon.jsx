import * as CiIcons from "react-icons/ci";
import * as FiIcons from "react-icons/fi";
import * as AiIcons from "react-icons/ai";
import * as PiIcons from "react-icons/pi";
import * as LiaIcons from "react-icons/lia";
import * as GiIcons from "react-icons/gi";
import * as BiIcons from "react-icons/bi";
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as MdIcons from "react-icons/md";
import * as TbIcons from "react-icons/tb";

export const iconLibraries = {
  ...CiIcons,
  ...FiIcons,
  ...AiIcons,
  ...PiIcons,
  ...LiaIcons,
  ...GiIcons,
  ...BiIcons,
  ...FaIcons,
  ...Fa6Icons,
  ...MdIcons,
  ...TbIcons,
};

const MODULE_KEY_ICON_FALLBACKS = {
  SALES: "FiTrendingUp",
  Sales: "FiTrendingUp",
  PURCHASE: "FiShoppingCart",
  Purchase: "FiShoppingCart",
  ACCOUNTS: "FiBook",
  Accounts: "FiBook",
  TREASURY: "FiDollarSign",
  Treasury: "FiDollarSign",
  HR: "FiUsers",
  PAYROLL: "FiCreditCard",
  Payroll: "FiCreditCard",
  BROADCAST: "FiRadio",
  Broadcast: "FiRadio",
  POS: "FiMonitor",
};

export function resolveModuleIcon(iconName, moduleKey) {
  const fallbackName =
    MODULE_KEY_ICON_FALLBACKS[moduleKey] || "FiGrid";
  const fallback =
    iconLibraries[fallbackName] || TbIcons[fallbackName] || FiIcons.FiGrid;

  if (!iconName) return fallback;

  return (
    iconLibraries[iconName] ||
    TbIcons[iconName] ||
    fallback
  );
}

export function ModuleIcon({ icon, moduleKey, size = 22, className }) {
  const Icon = resolveModuleIcon(icon, moduleKey);
  return <Icon size={size} className={className} aria-hidden />;
}
