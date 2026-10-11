# Operations Module Documentation

## Shipment Module

### 1. Overview

Manages shipment tracking and logistics operations across businesses → Allows create, view, update, and manage shipment records with support for multi-stage status tracking, document management, and comprehensive analytics across the entire shipment lifecycle from planning to delivery.

### 2. List & Filter

Navigate to Shipments → Table displays all shipments with filters (Business, Status, Date Created, Purchase Contracts) → Use search bar for instant filtering → Apply status-based filters grouped by shipment stages → View summary cards showing shipments in Planning, Pre-Shipment, In-Transit (Origin), In-Transit (Destination), and Post-Shipment phases.

### 3. Add Shipment

Click "Create New Shipment" → Select from existing Cargo Readiness Date (CRD) and Quotation → Fill Customer Payments section (Shipping Line, BL Number, Container Type, Weights, Booking Confirmation) → Complete Ports and Vessel Details (Origin/Destination ports, vessel names, ETD/ETA dates, transshipment info) → Enter Freight Details (amount, currency, fees, charges) → Save shipment → Redirected to shipment listing.

### 4. View Shipment

Click Eye icon → Opens detailed shipment view → Shows shipment summary with progress bar indicating current step → Displays Purchase Contract, Vendor, Sales Contract, and Customer information → Access to three detail cards: Shipment Details, Ports and Vessel Details, Freight Details → View Documents tab, Expenses tab, and Reassignment History → Access to actions: Connect LSP with Supplier, Reassign, Change Status.

### 5. Edit Shipment

Click Edit icon → Form opens with pre-filled values from existing shipment → Modify Customer Payments details (shipping line, container info, weights) → Update Ports and Vessel Details (ports, vessels, dates) → Adjust Freight Details (amounts, fees, currency) → Save changes → Shipment updated in system.

### 6. Status Management

View shipment status across five main stages: Planning (Pending Shipment Creation, RFQ Sent, Connected LSP with Supplier) → Pre-Shipment (Cargo Ready, Shipping Instruction Sent, Awaiting Pickup) → In-Transit Origin (Picked Up from Supplier, Loaded on Vessel, Sailed from Origin Port) → In-Transit Destination (At Destination Port, Customs Clearance, Out for Final Delivery) → Post-Shipment (Delivered to Buyer, Documents Sent, Shipment Closed) → Update status through Change Status action → Track progress via visual progress bar.

### 7. LSP-Supplier Connection

View shipment → Click "Connect LSP with Supplier" → Fill connection details (Empty Container Pickup Date, Cargo Stuffing Date, Laden Container Send to Port Date) → Submit → Email notifications sent to both LSP and Supplier → Connection established for coordination → Dates recorded in system.

### 8. Reassignment Management

View shipment → Click "Reassign" action → Select new business assignment → Choose reassignment reason → Submit reassignment → Shipment transferred to new business → Reassignment logged in history → Original business loses access → New business gains access → Reassignment badge displayed on shipment.

### 9. Document Management

View shipment → Access Documents tab → Upload shipment-related documents → View uploaded files → Download documents → Manage file attachments → Link documents to specific shipment stages → Track document status and approvals → Organize documents by type and date.

### 10. Analytics & Reporting

Access Analytics tab → View comprehensive shipment analytics → Summary cards showing distribution across shipment stages → Shipment reassignment logs with reassignment history → Number of shipment logs with time-based charts (daily/weekly/monthly views) → Shipments by ports analysis → Export analytics data → Generate shipment performance reports → Track shipment trends and patterns.

### 11. Progress Tracking

Visual progress bar displays current shipment step → Five-stage progress indicator (Planning, Pre-Shipment, In-Transit Origin, In-Transit Destination, Post-Shipment) → Current step highlighted → Status updates automatically advance progress → Manual status changes update progress bar → Track shipment lifecycle completion percentage.

### 12. Business Assignment

Shipments assigned to specific businesses → Business filter available in main listing → Reassignment functionality for business transfers → Assigned businesses control access → Selected business context maintained → Business-specific analytics and reporting → Multi-business support with proper access control.

### 13. Integration Features

Shipments linked to Purchase Contracts → Connected to Sales Contracts → Associated with Cargo Readiness Dates → Linked to Request for Quotations → Vendor/LSP integration → Customer information integration → Contract number tracking → Seamless data flow between modules.

### 14. Search & Filtering

Global search across shipment fields → Status-based filtering with grouped options → Business-specific filtering → Date range filtering → Real-time search results → Advanced filter combinations → Export filtered results → Save filter preferences → Quick filter shortcuts.

### 15. History & Audit Trail

Complete reassignment history tracking → Status change logs → Document upload history → User action tracking → Timestamp recording → Change reason documentation → Audit trail for compliance → Historical data preservation → User accountability tracking.

### 16. Multi-Stage Workflow

Five distinct shipment stages with specific statuses → Planning stage (3 statuses) → Pre-Shipment stage (3 statuses) → In-Transit Origin stage (3 statuses) → In-Transit Destination stage (3 statuses) → Post-Shipment stage (3 statuses) → Sequential progression through stages → Status validation and business rules → Workflow automation support.

### 17. Container & Cargo Management

Container type specification → Container and seal number tracking → Gross and net weight management → Quantity tracking (FCL, MTS, Total MTS) → Cargo readiness coordination → Container pickup and delivery scheduling → Weight and measurement validation → Cargo documentation management.

### 18. Port & Vessel Operations

Origin and destination port management → Vessel name tracking → ETD/ETA date management → Transshipment port handling → Transshipment vessel coordination → Port-to-port tracking → Vessel schedule management → Port operation status updates → Shipping line coordination.

### 19. Freight & Financial Management

Freight amount calculation → Currency specification → Warehousing fee tracking → Insurance fee management → Miscellaneous charges handling → Total cost calculation → Financial reporting integration → Cost breakdown analysis → Budget tracking and alerts.

### 20. Communication & Notifications

LSP-Supplier email notifications → Status change notifications → Reassignment notifications → Document upload alerts → System-generated communications → Email template integration → Notification preferences → Communication history tracking → Automated reminder system.
