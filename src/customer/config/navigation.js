import {
  AwardIcon,
  ChatIcon,
  CheckCircleIcon,
  ClipboardIcon,
  DocumentIcon,
  FileIcon,
  GridIcon,
  InvoiceIcon,
  SearchIcon,
  SettingsIcon,
  WalletIcon,
} from "../components/ui/icons";
import { CUSTOMER_BASE } from "../routes/paths";

/**
 * The portal's module registry — the single place the sidebar is defined.
 *
 * Adding a module to the customer portal is one entry here plus one route in
 * `routes/CustomerRoutes.jsx`; the sidebar, the active-state highlighting and
 * the breadcrumb title all read from this list. `ready: false` renders the item
 * with a "Soon" tag and points it at the shared placeholder screen, so the nav
 * can show the full roadmap before every screen exists. `hidden: true` keeps
 * the route registered but omits the item from the sidebar.
 */
export const navSections = [
  {
    id: "main",
    label: "Main Menu",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: `${CUSTOMER_BASE}/dashboard`,
        icon: GridIcon,
        ready: true,
      },
      {
        id: "enquiries",
        label: "My Enquiries",
        path: `${CUSTOMER_BASE}/enquiries`,
        icon: ChatIcon,
      },
      {
        id: "applications",
        label: "My Applications",
        path: `${CUSTOMER_BASE}/applications`,
        icon: FileIcon,
      },
      {
        id: "projects",
        label: "Projects",
        path: `${CUSTOMER_BASE}/projects`,
        icon: ClipboardIcon,
      },
      {
        id: "inspections",
        label: "Inspections",
        path: `${CUSTOMER_BASE}/inspections`,
        icon: SearchIcon,
        hidden: true,
      },
      {
        id: "assessments",
        label: "Assessments",
        path: `${CUSTOMER_BASE}/assessments`,
        icon: CheckCircleIcon,
      },
      {
        id: "certificates",
        label: "Certificates",
        path: `${CUSTOMER_BASE}/certificates`,
        icon: AwardIcon,
        hidden: true,
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        id: "quotation",
        label: "Quotation",
        path: `${CUSTOMER_BASE}/quotation`,
        icon: ClipboardIcon,
      },
      {
        id: "invoices",
        label: "Invoices",
        path: `${CUSTOMER_BASE}/invoices`,
        icon: InvoiceIcon,
      },
      {
        id: "payments",
        label: "Payments",
        path: `${CUSTOMER_BASE}/payments`,
        icon: WalletIcon,
      },
      {
        id: "statement",
        label: "Statement",
        path: `${CUSTOMER_BASE}/statement`,
        icon: DocumentIcon,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "profile",
        label: "Profile Settings",
        path: `${CUSTOMER_BASE}/profile`,
        icon: SettingsIcon,
      },
    ],
  },
];

/** Flat view of every module, for route generation and lookups. */
export const navItems = navSections.flatMap((section) => section.items);

export const findNavItemByPath = (pathname) =>
  navItems.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

export default navSections;
