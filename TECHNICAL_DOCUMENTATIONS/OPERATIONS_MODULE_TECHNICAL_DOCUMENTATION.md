# Operations Module - Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Submodules](#submodules)
4. [API Documentation](#api-documentation)
5. [Data Models](#data-models)
6. [Frontend Structure](#frontend-structure)
7. [Backend Structure](#backend-structure)
8. [Integration Points](#integration-points)
9. [Workflows](#workflows)
10. [Technical Implementation Details](#technical-implementation-details)

---

## Overview

The Operations module is a comprehensive logistics and supply chain management system that provides end-to-end visibility and control over shipping operations, inventory management, cargo readiness, quotation processes, and shipping documentation. It supports multi-business operations with role-based access control, real-time tracking, analytics, and integrated workflow management.

### Key Features

- **Multi-Business Support**: Manage operations across multiple business entities
- **Role-Based Access Control**: Secure access with permission-based features
- **Real-Time Tracking**: Monitor shipment status and cargo readiness
- **Analytics & Reporting**: Comprehensive dashboards and export capabilities
- **Document Management**: Centralized shipping document handling
- **Workflow Automation**: Status tracking and automated notifications

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Shipment │  │   Stock  │  │  Cargo   │  │   RFQ    │   │
│  │          │  │ Positions│  │Readiness │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Shipping Documents                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Shipment │  │   Stock  │  │  Cargo   │  │   RFQ    │   │
│  │Controller│  │Controller│  │Controller│  │Controller│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      Shipping Documents Controller                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MongoDB Database                         │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │   │
│  │  │Shipment│ │  Stock  │ │  Cargo │ │  RFQ   │      │   │
│  │  │ Model  │ │  Model  │ │ Model  │ │ Model  │      │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Module Dependencies

```
Operations Module
├── Purchase Contracts Module (External)
├── Vendor Management Module (External)
├── Business Module (External)
├── Document Management Module (External)
└── Notification System (External)
```

---

## Submodules

The Operations module consists of 5 interconnected submodules:

### 1. Shipment Management

**Path**: `/shipment`  
**Frontend**: `src/pages/Operations/Shipment/`  
**Backend**: `Operations/Shipment/`

**Purpose**: Complete shipment lifecycle management from creation to delivery.

**Key Features**:

- Create and manage shipments
- Track shipment status across 5 phases (planning, pre-shipment, in-transit-origin, in-transit-destination, post-shipment)
- Document management (upload, view, delete, update)
- Purchase contract reassignment
- Shipment analytics and reporting
- Multi-shipment creation
- LSP (Logistics Service Provider) connection with suppliers

**Status Flow**:

```
Planning → Pre-Shipment → In-Transit (Origin) → In-Transit (Destination) → Post-Shipment
```

### 2. Stock Positions

**Path**: `/stock-positions`  
**Frontend**: `src/pages/Operations/StockPositions/`  
**Backend**: `Operations/StockPositions/`

**Purpose**: Comprehensive stock management and analytics system.

**Key Features**:

- View and analyze stock positions
- Track inventory levels and stock age
- Monitor open purchase contracts
- Track unpurchased contracts
- Stock analytics with charts and reports
- Purchase contract status management

### 3. Cargo Readiness

**Path**: `/cargo-readiness`  
**Frontend**: `src/pages/Operations/CargoReadiness/`  
**Backend**: `Operations/CargoReadiness/`

**Purpose**: Track and manage cargo readiness dates and preparation status.

**Key Features**:

- Create cargo readiness dates (CRD)
- Monitor cargo preparation status
- Issue Shipping Instructions (SI)
- Match cargo with quotations
- Automatic delayed status detection
- Supplier notifications

**Status Options**:

- Draft
- Cargo Ready
- Confirmed
- Matched
- Delayed (auto-detected)
- Cancelled
- Completed

### 4. Request for Quotation (RFQ)

**Path**: `/request-for-quotation`  
**Frontend**: `src/pages/Operations/RequestForQuotation/`  
**Backend**: `Operations/RequestForQuotation/`

**Purpose**: Manage RFQs and receive quotations from logistics service providers.

**Key Features**:

- Create RFQs with detailed requirements
- Send RFQs to multiple LSPs
- Receive and compare quotations
- Public RFQ portal for external vendors
- Booking confirmation document upload
- Status management (Waiting for Quotation, Processing, Completed, Rejected)

### 5. Shipping Documents

**Path**: `/shipping-documents`  
**Frontend**: `src/pages/Operations/ShippingDocuments/`  
**Backend**: `Operations/ShippingDocuments/`

**Purpose**: Centralized management of shipping-related documents.

**Key Features**:

- Create shipping documents (Shipping Instructions)
- Bulk document creation
- Document search and filtering
- Document status management (active, inactive, deleted)
- Link documents to shipments and CRDs
- Document statistics and analytics

---

## API Documentation

### Base URL

All Operations module APIs are prefixed with `/api/operations/`

### Authentication

Most endpoints require authentication via `isAuth` middleware. Token should be included in the Authorization header.

### Shipment Management APIs

#### Create Shipment

```
POST /api/operations/shipment
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  rfqId: ObjectId,
  quotationId: ObjectId,
  adminId: ObjectId,
  crdId: ObjectId,
  business: ObjectId,
  purchaseContractId: ObjectId,
  shippingLine: String,
  containerType: String,
  grossWeight: String,
  netWeight: String,
  bookingConfirmationNumber: String,
  quantityMTS: Number,
  quantityFCL: Number,
  totalQuantityMTS: Number,
  portOfLoading: String,
  originETD: Date,
  portOfDischarge: String,
  originVesselName: String,
  podEta: Date,
  currency: ObjectId,
  freightAmount: Number,
  // Optional fields
  blNumber: String,
  transshipmentVesselName: String,
  transhipmentPort: String,
  transshipmentETAEtd: Date,
  insuranceFee: Number,
  warehousingFee: Number,
  documentationCharges: Number,
  terminalHandlingCharges: Number,
  bankCharges: Number,
  emptyContainerPickupDate: Date,
  cargoStuffingDate: Date,
  ladenContainerSendToPortDate: Date,
  ctrSealNumbers: [{
    id: Number,
    containerNumber: String,
    sealNumber: String
  }]
}
```

#### Get All Shipments

```
GET /api/operations/shipment?page=1&limit=10&businessIds[]=id1&businessIds[]=id2&search=query&status=status
Authorization: Bearer <token>
```

#### Get Shipment by ID

```
GET /api/operations/shipment/:id
Authorization: Bearer <token>
```

#### Update Shipment

```
PUT /api/operations/shipment/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Update Shipment Status

```
PUT /api/operations/shipment/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  status: String // One of the valid status values
}
```

#### Add Documents to Shipment

```
POST /api/operations/shipment/add-documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request Body:
{
  shipmentId: ObjectId,
  documents: [File]
}
```

#### Get Shipment Documents

```
GET /api/operations/shipment/documents?shipmentId=id
Authorization: Bearer <token>
```

#### Delete Shipment Document

```
DELETE /api/operations/shipment/:shipmentId/documents/:documentId
Authorization: Bearer <token>
```

#### Reassign Purchase Contract

```
POST /api/operations/shipment/reassign-purchase-contract
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  shipmentId: ObjectId,
  oldPurchaseContractId: ObjectId,
  newPurchaseContractId: ObjectId
}
```

#### Get Shipment Reassignment Logs

```
GET /api/operations/shipment/shipment-reassignment-logs?page=1&limit=10
Authorization: Bearer <token>
```

#### Get Shipment Count Logs

```
GET /api/operations/shipment/shipment-count-logs?page=1&limit=10
Authorization: Bearer <token>
```

#### Get Shipment Logs by Ports

```
GET /api/operations/shipment/shipment-logs-by-ports?page=1&limit=10
Authorization: Bearer <token>
```

### Cargo Readiness APIs

#### Create Cargo Readiness

```
POST /api/operations/cargo-readiness
Content-Type: application/json

Request Body:
{
  business: ObjectId,
  purchaseContract: ObjectId,
  quantityMTS: Number,
  quantityFCL: Number,
  totalQuantityMTS: Number,
  cargoReadinessDate: Date,
  status: String // Optional, defaults to "Draft"
}
```

#### Get All Cargo Readiness

```
GET /api/operations/cargo-readiness?page=1&limit=10&business=id&status=status
```

#### Get Cargo Readiness by ID

```
GET /api/operations/cargo-readiness/:id
```

#### Update Cargo Readiness

```
PUT /api/operations/cargo-readiness/:id
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Update Cargo Readiness Status

```
PUT /api/operations/cargo-readiness/:id/status
Content-Type: application/json

Request Body:
{
  status: String
}
```

#### Issue Shipping Instruction

```
POST /api/operations/cargo-readiness/issue-si
Content-Type: application/json

Request Body:
{
  crdId: ObjectId,
  siDocUrl: String
}
```

#### Notify Supplier

```
POST /api/operations/cargo-readiness/notify-supplier
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  crdId: ObjectId,
  message: String
}
```

### Request for Quotation APIs

#### Create RFQ

```
POST /api/operations/request-for-quotation
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  business: ObjectId,
  purchaseContract: ObjectId,
  purchaseContractNumber: String,
  etaPol: String,
  logisticServiceProviders: [ObjectId],
  adminId: ObjectId,
  itemId: ObjectId,
  containerType: String,
  unitOfContainer: String,
  grade: String,
  packing: String,
  No_of_Packages: String,
  quantityFCL: Number,
  quantityMTS: Number,
  totalQuantityMTS: Number,
  shippingTerms: String,
  expectedDeliveryDate: String,
  portOfLoading: String,
  portOfDischarge: String,
  passwords: [Object],
  // Optional
  netWeight: Number,
  hsCode: String
}
```

#### Get All RFQs

```
GET /api/operations/request-for-quotation?page=1&limit=10&business=id&status=status
Authorization: Bearer <token>
```

#### Get RFQ by ID

```
GET /api/operations/request-for-quotation/:id
```

#### Update RFQ

```
PUT /api/operations/request-for-quotation/:id
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Update RFQ Status

```
PUT /api/operations/request-for-quotation/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  status: String // "Waiting for Quotation", "Processing", "Completed", "Rejected"
}
```

#### Delete RFQ

```
DELETE /api/operations/request-for-quotation/:id
Authorization: Bearer <token>
```

### Quotation APIs

#### Create Quotation

```
POST /api/operations/quotation
Content-Type: application/json

Request Body:
{
  rfqId: ObjectId,
  logisticServiceProvider: ObjectId,
  quantity: Number,
  quantityMTS: Number,
  totalQuantityMTS: Number,
  date: Date,
  amount: Number,
  // Optional
  transhipmentPort: String,
  bookingConfirmationDoc: Object,
  rateValidity: Date,
  remarks: String,
  addedByAdmin: Boolean,
  addedByAdminId: ObjectId
}
```

#### Get All Quotations

```
GET /api/operations/quotation?page=1&limit=10&rfqId=id&status=status
```

#### Get Quotation by ID

```
GET /api/operations/quotation/:id
```

#### Update Quotation

```
PUT /api/operations/quotation/:id
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Update Quotation Status

```
POST /api/operations/quotation/update-statuses
Content-Type: application/json

Request Body:
{
  quotationIds: [ObjectId],
  status: String // "Pending", "Approved", "Matched", "Closed", "Rejected"
}
```

#### Get Matched Quotations

```
GET /api/operations/quotation/matched?page=1&limit=10
```

#### Get Quotations by RFQ ID

```
GET /api/operations/quotation/rfq?rfqId=id
```

#### Delete Quotation

```
DELETE /api/operations/quotation/:id
```

### Public Quotation APIs (No Authentication)

#### Get Public RFQ

```
GET /api/public/operations/quotation/:id
```

#### Update Public Quotation (Upload Booking Confirmation)

```
PUT /api/public/operations/quotation/:id
Content-Type: application/json

Request Body:
{
  bookingConfirmationDoc: Object
}
```

### Stock Positions APIs

#### Get Stock Position

```
GET /api/operations/stock-positions?page=1&limit=10&business=id
Authorization: Bearer <token>
```

#### Get Unpurchased Contracts

```
GET /api/operations/stock-positions/unpurchased-contracts?page=1&limit=10
Authorization: Bearer <token>
```

#### Update Unpurchased Contract Status

```
PUT /api/operations/stock-positions/unpurchased-contracts/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  status: String
}
```

#### Get Open Purchase Contracts

```
GET /api/operations/stock-positions/open-purchase-contracts?page=1&limit=10
Authorization: Bearer <token>
```

### Shipping Documents APIs

#### Create Shipping Document

```
POST /api/operations/shipping-documents
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  shipmentId: ObjectId, // Optional
  crdId: ObjectId, // Optional
  documentData: Object, // Required
  documentType: String, // "shipping-instructions"
  business: ObjectId, // Required
  createdBy: ObjectId // Required
}
```

#### Create Multiple Shipping Documents

```
POST /api/operations/shipping-documents/bulk
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  documents: [{
    shipmentId: ObjectId,
    crdId: ObjectId,
    documentData: Object,
    documentType: String,
    business: ObjectId,
    createdBy: ObjectId
  }]
}
```

#### Get All Shipping Documents

```
GET /api/operations/shipping-documents?page=1&limit=10&business=id&status=status
Authorization: Bearer <token>
```

#### Get Shipping Document by ID

```
GET /api/operations/shipping-documents/:id
Authorization: Bearer <token>
```

#### Get Shipping Documents by Shipment ID

```
GET /api/operations/shipping-documents/shipment/:shipmentId
Authorization: Bearer <token>
```

#### Search Shipping Documents

```
GET /api/operations/shipping-documents/search?query=searchTerm&page=1&limit=10
Authorization: Bearer <token>
```

#### Get Shipping Document Statistics

```
GET /api/operations/shipping-documents/stats?business=id
Authorization: Bearer <token>
```

#### Update Shipping Document

```
PUT /api/operations/shipping-documents/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (Same structure as create, all fields optional)
```

#### Update Shipping Document Status

```
PUT /api/operations/shipping-documents/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  status: String // "active", "inactive", "deleted"
}
```

#### Bulk Update Shipping Document Status

```
PUT /api/operations/shipping-documents/bulk/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  documentIds: [ObjectId],
  status: String
}
```

#### Delete Shipping Document (Soft Delete)

```
DELETE /api/operations/shipping-documents/:id
Authorization: Bearer <token>
```

#### Hard Delete Shipping Document

```
DELETE /api/operations/shipping-documents/:id/hard
Authorization: Bearer <token>
```

---

## Data Models

### Shipment Model

```javascript
{
  rfqId: ObjectId (ref: "RequestForQuotation"),
  quotationId: ObjectId (ref: "Quotation"),
  adminId: ObjectId (ref: "Admin"),
  crdId: ObjectId (ref: "crds"),
  business: ObjectId (ref: "Business"),
  purchaseContractId: ObjectId (ref: "Purchase_Contracts"),
  shipmentDisplayId: String (unique, auto-generated),
  isReassigned: Boolean (default: false),
  shippingLine: String (required),
  blNumber: String,
  containerType: String (required),
  grossWeight: String (required),
  netWeight: String (required),
  bookingConfirmationNumber: String (required),
  ctrSealNumbers: [{
    id: Number,
    containerNumber: String,
    sealNumber: String
  }],
  quantityMTS: Number (required),
  quantityFCL: Number (required),
  totalQuantityMTS: Number (required),
  portOfLoading: String (required),
  originETD: Date (required),
  transshipmentVesselName: String,
  portOfDischarge: String (required),
  originVesselName: String (required),
  transhipmentPort: String,
  transshipmentETAEtd: Date,
  podEta: Date (required),
  insuranceFee: Number,
  warehousingFee: Number,
  documentationCharges: Number,
  terminalHandlingCharges: Number,
  bankCharges: Number,
  currency: ObjectId (ref: "CurrencyTable", required),
  freightAmount: Number (required),
  emptyContainerPickupDate: Date,
  cargoStuffingDate: Date,
  ladenContainerSendToPortDate: Date,
  documents: [{
    business_id: ObjectId (ref: "Business"),
    created_by: ObjectId (ref: "Admin"),
    docType: ObjectId (ref: "DocType"),
    customer_id: ObjectId (ref: "Customer"),
    datetime_created: Date,
    file_path: String,
    file_size: Number,
    file_type: String,
    folder: ObjectId (ref: "Folder"),
    name: String,
    s3Key: String,
    sharedWith: [ObjectId (ref: "User")],
    status: String (enum: ["active", "inactive", "deleted"]),
    system_user_id: ObjectId (ref: "User"),
    uploadDate: Date,
    uploadedBy: ObjectId (ref: "Admin")
  }],
  status: String (enum: [
    "Pending Shipment Creation",
    "RFQ Sent",
    "Connected LSP with Supplier",
    "Cargo Ready",
    "Shipping Instruction Sent",
    "Awaiting Pickup",
    "Picked Up from Supplier",
    "Loaded on Vessel",
    "Sailed from Origin Port",
    "At Destination Port",
    "Customs Clearance (In Progress)",
    "Out for Final Delivery",
    "Delivered to Buyer/Warehouse",
    "Documents Sent to Buyer",
    "Shipment Closed"
  ], default: "Cargo Ready"),
  currentStep: String (enum: [
    "planning",
    "pre-shipment",
    "in-transit-origin",
    "in-transit-destination",
    "post-shipment"
  ], default: "planning", auto-updated based on status),
  createdAt: Date,
  updatedAt: Date
}
```

**Auto-Generated Fields**:

- `shipmentDisplayId`: Format `SHP{random}-{timestamp}` (e.g., `SHPabc-12345`)
- `currentStep`: Automatically updated when `status` changes

### Cargo Readiness Model

```javascript
{
  business: ObjectId (ref: "Business", required),
  purchaseContract: ObjectId (ref: "Purchase_Contracts", required),
  quantityMTS: Number (required),
  isConfirmed: Boolean (default: false),
  quantityFCL: Number (required),
  displayId: String (auto-generated),
  shippingDocumentId: ObjectId (ref: "ShippingDocument"),
  totalQuantityMTS: Number (required),
  cargoReadinessDate: Date (required),
  siDocUrl: String,
  status: String (enum: [
    "Draft",
    "Cargo Ready",
    "Confirmed",
    "Matched",
    "Delayed",
    "Cancelled",
    "Completed"
  ], default: "Draft"),
  createdAt: Date,
  updatedAt: Date
}
```

**Auto-Generated Fields**:

- `displayId`: Format `CRD{random}-{timestamp}` (e.g., `CRDabc-12345`)

**Auto-Detected Status**:

- `Delayed`: Automatically set if `cargoReadinessDate` is in the past and status is not "Completed" or "Cancelled"

### Request for Quotation Model

```javascript
{
  business: ObjectId (ref: "Business"),
  purchaseContract: ObjectId (ref: "Purchase_Contracts"),
  purchaseContractNumber: String,
  etaPol: String (required),
  logisticServiceProviders: [ObjectId (ref: "Vendor")],
  adminId: ObjectId (ref: "SystemUsers"),
  itemId: ObjectId (ref: "Item"),
  rfqDisplayId: String (required, auto-generated),
  containerType: String (required),
  unitOfContainer: String (required),
  grade: String (required),
  packing: String (required),
  No_of_Packages: String (required),
  quantityFCL: Number (required),
  quantityMTS: Number (required),
  totalQuantityMTS: Number (required),
  shippingTerms: String (required),
  expectedDeliveryDate: String (required),
  netWeight: Number,
  hsCode: String,
  portOfLoading: String (required),
  portOfDischarge: String (required),
  passwords: [Object] (required),
  status: String (enum: [
    "Waiting for Quotation",
    "Processing",
    "Completed",
    "Rejected"
  ], default: "Waiting for Quotation"),
  createdAt: Date,
  updatedAt: Date
}
```

**Auto-Generated Fields**:

- `rfqDisplayId`: Format `RFQ{random}-{timestamp}` (e.g., `RFQabc-12345`)

### Quotation Model

```javascript
{
  rfqId: ObjectId (ref: "RequestForQuotation", required),
  logisticServiceProvider: ObjectId (ref: "Vendor", required),
  quantity: Number (required),
  quantityMTS: Number (required),
  quotationDisplayId: String (unique, auto-generated),
  totalQuantityMTS: Number (required),
  date: Date (required),
  amount: Number (required),
  transhipmentPort: String,
  bookingConfirmationDoc: Object,
  rateValidity: Date,
  remarks: String,
  addedByAdmin: Boolean (default: false),
  addedByAdminId: ObjectId (ref: "SystemUsers"),
  status: String (enum: [
    "Pending",
    "Approved",
    "Matched",
    "Closed",
    "Rejected"
  ], default: "Pending", required),
  createdAt: Date,
  updatedAt: Date
}
```

**Auto-Generated Fields**:

- `quotationDisplayId`: Format `QTN{random}-{timestamp}` (e.g., `QTNabc-12345`)

### Shipping Document Model

```javascript
{
  docId: String (unique, auto-generated),
  shipmentId: ObjectId (ref: "Shipment"),
  crdId: ObjectId (ref: "crds"),
  documentData: Object (required),
  documentType: String (enum: ["shipping-instructions"], required),
  business: ObjectId (ref: "Business", required),
  createdBy: ObjectId (ref: "SystemUsers", required),
  status: String (enum: ["active", "inactive", "deleted"], default: "active"),
  createdAt: Date,
  updatedAt: Date
}
```

**Auto-Generated Fields**:

- `docId`: Format `DOC{random}-{timestamp}` (e.g., `DOCabcdef-123456`)

**Indexes**:

- `shipmentId`
- `docId`
- `business`
- `status`

---

## Frontend Structure

### Directory Structure

```
src/pages/Operations/
├── Shipment/
│   ├── index.jsx                    # Main shipment listing page
│   ├── CreateNewShipment.jsx        # Create shipment form
│   ├── UpdateShipment.jsx           # Update shipment form
│   ├── DocumentsTable.jsx           # Shipment documents table
│   ├── ExpensesTable.jsx            # Shipment expenses table
│   ├── ShipmentAnalytics.jsx       # Analytics dashboard
│   ├── ShipmentReassignmentModal.jsx # Reassignment modal
│   ├── ShipmentReassignmentLogs.jsx # Reassignment logs
│   ├── NumberOfShipmentLogs.jsx     # Shipment count logs
│   ├── ShipmentsbyPorts.jsx          # Port-based analytics
│   ├── constants.jsx                 # Constants and configurations
│   └── sections/
│       ├── ContainerDates.jsx       # Container date management
│       ├── CustomerPayments.jsx     # Payment tracking
│       ├── FreightDetails.jsx       # Freight information
│       ├── ImportantDates.jsx        # Key dates tracking
│       └── PortsVesselDetails.jsx   # Port and vessel info
│   └── ViewShipmentDetails/
│       ├── index.jsx                # Main detail view
│       ├── DocumentsTab.jsx         # Documents tab
│       └── HistoryTab.jsx           # History tab
│
├── StockPositions/
│   ├── index.jsx                    # Main stock positions page
│   └── components/
│       ├── OpenPurchaseContracts.jsx # Open contracts table
│       ├── StockAnalyticsChart.jsx   # Analytics charts
│       └── UnpurchasedContractsTable.jsx # Unpurchased contracts
│
├── CargoReadiness/
│   ├── index.jsx                    # Main CRD listing page
│   ├── AddCRD/
│   │   └── index.jsx                # Create CRD form
│   └── components/
│       ├── IssueSIModal.jsx         # Issue SI modal
│       ├── MatchedQuotations.jsx    # Matched quotations display
│       ├── QuotationsTable.jsx      # Quotations table
│       └── StatusChangeModel.jsx    # Status change modal
│
├── RequestForQuotation/
│   ├── index.jsx                    # Main RFQ listing page
│   ├── AddNew/
│   │   └── index.jsx                # Create RFQ form
│   ├── ViewRFQ/
│   │   ├── index.jsx                # RFQ detail view
│   │   └── components.jsx           # RFQ components
│   ├── ProvideBookingConfirmation/
│   │   ├── index.jsx                # Booking confirmation form
│   │   ├── components.jsx           # Booking components
│   │   └── shipmentDetails.jsx      # Shipment details
│   ├── RFQPublic/
│   │   ├── index.jsx                # Public RFQ view
│   │   ├── components.jsx           # Public components
│   │   ├── shipmentDetails.jsx      # Shipment details
│   │   └── components/
│   │       └── QuotationModal.jsx  # Quotation modal
│   └── components/
│       └── RFQStatusChangeModal.jsx # Status change modal
│
└── ShippingDocuments/
    ├── index.jsx                    # Main documents listing
    ├── AddNew/
    │   └── index.jsx                # Create document form
    ├── ViewShippingDocument/
    │   └── index.jsx                # Document detail view
    ├── components/
    │   └── BookingConfirmations.jsx # Booking confirmations
    └── constants.jsx                 # Constants
```

### Services Layer

**File**: `src/services/OperationsServices.js`

This file contains all API service methods for the Operations module:

- Request for Quotation services
- Shipment services
- Quotation services
- Cargo Readiness services
- Stock Position services
- Shipping Document services

### Key Frontend Technologies

- **React**: UI framework
- **React Router**: Navigation
- **Axios/HTTP Service**: API communication
- **Context API**: State management (AdminContext)
- **React Icons**: Icon library
- **Custom Components**: Reusable UI components from `@/page-layouts`

---

## Backend Structure

### Directory Structure

```
Operations/
├── Shipment/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── CargoReadiness/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── RequestForQuotation/
│   ├── routes.js                    # Express routes
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── Quotations/
│   ├── routes.js                    # Express routes (authenticated)
│   ├── publicRoutes.js              # Public routes (no auth)
│   ├── controller.js                # Business logic
│   └── model.js                     # Mongoose schema
│
├── StockPositions/
│   ├── routes.js                    # Express routes
│   └── controller.js                # Business logic
│
└── ShippingDocuments/
    ├── routes.js                    # Express routes
    ├── controller.js                # Business logic
    └── model.js                     # Mongoose schema
```

### Route Registration

Routes are registered in `index.js`:

```javascript
app.use("/api/operations/request-for-quotation", requestForQuotationRoutes);
app.use("/api/operations/shipment", shipmentRoutes);
app.use("/api/operations/quotation", quotationRoutes);
app.use("/api/public/operations/quotation", publicQuotationRoutes);
app.use("/api/operations/cargo-readiness", cargoReadinessRoutes);
app.use("/api/operations/stock-positions", StockPositionsRoutes);
app.use("/api/operations/shipping-documents", shippingDocumentsRoutes);
```

### Middleware

- **isAuth**: Authentication middleware (required for most routes)
- **Error Handling**: Centralized error handling
- **Validation**: Request validation (implemented in controllers)

---

## Integration Points

### External Module Dependencies

#### 1. Purchase Contracts Module

- **Used By**: Shipment, Cargo Readiness, RFQ, Stock Positions
- **Purpose**: Link shipments and CRDs to purchase contracts
- **Integration**: References via `purchaseContractId` field

#### 2. Vendor Management Module

- **Used By**: RFQ, Quotations
- **Purpose**: Manage logistics service providers
- **Integration**: References via `logisticServiceProvider` and `logisticServiceProviders` fields

#### 3. Business Module

- **Used By**: All submodules
- **Purpose**: Multi-business support
- **Integration**: References via `business` field

#### 4. Document Management Module

- **Used By**: Shipment (documents array)
- **Purpose**: Store and manage shipment documents
- **Integration**: Embedded document schema in Shipment model

#### 5. Notification System

- **Used By**: All submodules
- **Purpose**: Send notifications for status changes and important events
- **Integration**: Called from controllers

#### 6. Currency Module

- **Used By**: Shipment
- **Purpose**: Multi-currency support for freight amounts
- **Integration**: References via `currency` field

### Data Flow Between Submodules

```
┌─────────────────┐
│ Stock Positions │
│  (Inventory)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   RFQ Module    │
│ (Get Quotes)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Quotations     │
│  (Compare)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cargo Readiness │
│  (Plan Cargo)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Shipment       │
│  (Execute)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Shipping Documents│
│  (Document)     │
└─────────────────┘
```

---

## Workflows

### Complete Shipment Workflow

#### Phase 1: Planning

1. **Stock Analysis** (Stock Positions)

   - Review current inventory levels
   - Identify stock requirements
   - Check open purchase contracts

2. **Request for Quotation** (RFQ)

   - Create RFQ with shipping requirements
   - Select logistics service providers
   - Send RFQ to vendors

3. **Receive Quotations** (Quotations)
   - Vendors submit quotations via public portal
   - Compare quotations
   - Approve selected quotation

#### Phase 2: Pre-Shipment

4. **Cargo Readiness** (Cargo Readiness)

   - Create CRD with readiness date
   - Link to purchase contract
   - Issue Shipping Instructions (SI)
   - Match with approved quotation

5. **Create Shipment** (Shipment)
   - Create shipment from approved quotation and CRD
   - Link to purchase contract
   - Set initial status: "Cargo Ready"

#### Phase 3: In-Transit (Origin)

6. **Origin Operations** (Shipment)
   - Update status: "Shipping Instruction Sent"
   - Update status: "Awaiting Pickup"
   - Update status: "Picked Up from Supplier"
   - Update status: "Loaded on Vessel"
   - Update status: "Sailed from Origin Port"

#### Phase 4: In-Transit (Destination)

7. **Destination Operations** (Shipment)
   - Update status: "At Destination Port"
   - Update status: "Customs Clearance (In Progress)"
   - Update status: "Out for Final Delivery"

#### Phase 5: Post-Shipment

8. **Delivery** (Shipment)

   - Update status: "Delivered to Buyer/Warehouse"
   - Update status: "Documents Sent to Buyer"
   - Update status: "Shipment Closed"

9. **Documentation** (Shipping Documents)
   - Create shipping documents throughout the process
   - Link documents to shipments and CRDs
   - Manage document lifecycle

### Cargo Readiness Workflow

1. **Create CRD**

   - Select purchase contract
   - Set cargo readiness date
   - Enter quantities (MTS, FCL)
   - Status: "Draft"

2. **Confirm Cargo**

   - Update status: "Cargo Ready"
   - System checks for delayed status automatically

3. **Issue Shipping Instructions**

   - Generate SI document
   - Link to shipping document
   - Update status: "Confirmed"

4. **Match with Quotation**

   - Link to approved quotation
   - Update status: "Matched"

5. **Complete**
   - Update status: "Completed" or "Cancelled"

### RFQ Workflow

1. **Create RFQ**

   - Select purchase contract
   - Enter shipping requirements
   - Select logistics service providers
   - Status: "Waiting for Quotation"

2. **Send to Vendors**

   - RFQ accessible via public portal
   - Vendors can view and submit quotations

3. **Receive Quotations**

   - Vendors submit quotations
   - Compare multiple quotations
   - Status: "Processing"

4. **Approve/Reject**
   - Approve selected quotation
   - Reject others
   - Status: "Completed" or "Rejected"

---

## Technical Implementation Details

### Status Management

#### Shipment Status to Step Mapping

The system automatically maps shipment status to `currentStep`:

```javascript
const statusToStepMap = {
  // Planning phase
  "Pending Shipment Creation": "planning",
  "RFQ Sent": "planning",
  "Connected LSP with Supplier": "planning",

  // Pre-shipment phase
  "Cargo Ready": "pre-shipment",
  "Shipping Instruction Sent": "pre-shipment",
  "Awaiting Pickup": "pre-shipment",

  // In-transit origin phase
  "Picked Up from Supplier": "in-transit-origin",
  "Loaded on Vessel": "in-transit-origin",
  "Sailed from Origin Port": "in-transit-origin",

  // In-transit destination phase
  "At Destination Port": "in-transit-destination",
  "Customs Clearance (In Progress)": "in-transit-destination",
  "Out for Final Delivery": "in-transit-destination",

  // Post-shipment phase
  "Delivered to Buyer/Warehouse": "post-shipment",
  "Documents Sent to Buyer": "post-shipment",
  "Shipment Closed": "post-shipment",
};
```

This mapping is automatically applied via Mongoose pre-save and pre-update hooks.

### Auto-Generated Display IDs

All entities have auto-generated display IDs for user-friendly identification:

- **Shipment**: `SHP{random}-{timestamp}` (e.g., `SHPabc-12345`)
- **Cargo Readiness**: `CRD{random}-{timestamp}` (e.g., `CRDabc-12345`)
- **RFQ**: `RFQ{random}-{timestamp}` (e.g., `RFQabc-12345`)
- **Quotation**: `QTN{random}-{timestamp}` (e.g., `QTNabc-12345`)
- **Shipping Document**: `DOC{random}-{timestamp}` (e.g., `DOCabcdef-123456`)

### Delayed Status Detection

Cargo Readiness documents automatically detect delayed status:

- If `cargoReadinessDate` is in the past and status is not "Completed" or "Cancelled", status is set to "Delayed"
- This check runs on document creation and retrieval

### Document Management

Shipment documents are embedded in the Shipment model with full document metadata:

- File storage (S3 or local)
- Document type classification
- Sharing permissions
- Version tracking
- Soft delete support

### Pagination

All list endpoints support pagination:

- `page`: Page number (default: 1)
- `limit`: Records per page (default: 10)
- Response includes: `data`, `total`, `page`, `limit`, `totalPages`

### Search and Filtering

Most endpoints support:

- **Search**: Text search across relevant fields
- **Business Filtering**: Filter by business ID(s)
- **Status Filtering**: Filter by status
- **Date Range Filtering**: Filter by date ranges (where applicable)

### Error Handling

Standard error response format:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

### Authentication

Most endpoints require authentication:

- Token in `Authorization: Bearer <token>` header
- Public endpoints (quotation submission) don't require authentication
- Admin context available in authenticated requests

### Multi-Business Support

All entities support multi-business operations:

- Entities linked to business via `business` field
- Filtering by business ID(s) in queries
- Business-specific data isolation
- Cross-business reporting capabilities

---

## Best Practices

### Frontend

1. **State Management**: Use React Context for global state (AdminContext)
2. **API Calls**: Use OperationsServices for all API interactions
3. **Error Handling**: Implement try-catch blocks for all API calls
4. **Loading States**: Show loading indicators during API calls
5. **Pagination**: Implement pagination for large datasets
6. **Form Validation**: Validate forms before submission

### Backend

1. **Validation**: Validate all input data in controllers
2. **Error Handling**: Use consistent error response format
3. **Database Queries**: Use indexes for performance
4. **Middleware**: Apply authentication middleware where needed
5. **Logging**: Log important operations for debugging
6. **Transactions**: Use database transactions for multi-step operations

### Database

1. **Indexes**: Create indexes on frequently queried fields
2. **References**: Use proper references for related entities
3. **Validation**: Enforce schema validation
4. **Soft Deletes**: Use soft deletes where appropriate
5. **Timestamps**: Use Mongoose timestamps for audit trails

---

## Future Enhancements

### Planned Features

1. **Real-Time Updates**: WebSocket support for real-time status updates
2. **Advanced Analytics**: Machine learning for predictive analytics
3. **Mobile App**: Native mobile applications
4. **API Versioning**: Versioned API endpoints
5. **GraphQL Support**: GraphQL API alongside REST
6. **Automated Workflows**: Workflow automation engine
7. **Integration Hub**: Pre-built integrations with major logistics providers
8. **Advanced Reporting**: Custom report builder

### Performance Optimizations

1. **Caching**: Redis caching for frequently accessed data
2. **Database Optimization**: Query optimization and indexing
3. **CDN Integration**: CDN for document storage
4. **Background Jobs**: Queue system for heavy operations
5. **Data Archiving**: Archive old data for performance

---

## Troubleshooting

### Common Issues

#### 1. Status Not Updating

- **Issue**: Shipment status not updating `currentStep`
- **Solution**: Check Mongoose hooks are properly configured
- **Check**: Verify status value matches enum values

#### 2. Display ID Not Generated

- **Issue**: Display ID missing on new entities
- **Solution**: Check pre-save hooks are working
- **Check**: Verify model schema includes display ID field

#### 3. Delayed Status Not Detected

- **Issue**: CRD not showing as "Delayed"
- **Solution**: Check date comparison logic
- **Check**: Verify `cargoReadinessDate` is properly set

#### 4. Document Upload Fails

- **Issue**: Documents not uploading to shipment
- **Solution**: Check file size limits and S3 configuration
- **Check**: Verify authentication and permissions

#### 5. Purchase Contract Reassignment Issues

- **Issue**: Reassignment not working
- **Solution**: Check purchase contract exists and is valid
- **Check**: Verify shipment is not in closed status

---

## API Response Examples

### Success Response

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### Error Response

```json
{
  "error": "Shipment not found",
  "details": "No shipment found with ID: 507f1f77bcf86cd799439011"
}
```

### Single Entity Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "shipmentDisplayId": "SHPabc-12345",
  "status": "Cargo Ready",
  "currentStep": "pre-shipment",
  ...
}
```

---

## Conclusion

The Operations module provides a comprehensive, integrated solution for managing logistics and supply chain operations. With its five interconnected submodules, the system offers end-to-end visibility, efficient workflow management, and powerful analytics capabilities. The modular design ensures scalability while maintaining seamless integration between different operational aspects.

For additional support or questions, please refer to the individual submodule documentation files or contact the development team.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Development Team
